var SockJS = require("sockjs-client")
var rd = require("reactive-dom")

class Connection {
  constructor(sessionId, settings) {
    if(!sessionId) throw new Error("SessionId undefined!")
    this.sessionId = sessionId
    this.settings = settings || {}

    this.connected = false
    this.lastRequestId = 0
    this.waitingRequests = {}

    this.observers = {}
    this.messageHandlers = {}

    this.autoReconnect = settings.autoReconnect || false

    rd.observable()

    this.finished = false
  }

  sendRequest(msg) {
    if(!this.connected) return new Promise(function(resolve,reject){ reject('disconnected') })
    msg.requestId = (++this.lastRequestId)

    var promise=new Promise((function(resolve,reject) {
      this.waitingRequests[msg.requestId]=(function(err,resp){
        if(err) {
          delete this.waitingRequests[msg.requestId]
          return reject(err)
        }
        if(resp.type=='error') {
          reject(resp.error)
          return false
        }
        resolve(resp.response)
        return false
      }).bind(this)
    }).bind(this))

    this.send(msg)
    return promise
  }
  request(to,method,args) {
    var msg={
      type:'request',
      method:method,
      to:to,
      args:args
    }
    return this.sendRequest(msg)
  }
  get(to,what) {
    var msg={
      type:'get',
      what: what,
      to: to
    }
    return this.sendRequest(msg)
  }
  event(to,method,args) {
    this.send({
      type:'event',
      to:to,
      method:method,
      args:args
    })
  }
  handleMessage(message) {
    if (message.type=="pong"){
      console.log("PONG")
    }
    if (message.responseId) {
      var handler=this.waitingRequests[message.responseId]
      if(handler(null,message)!='more') delete this.waitingRequests[message.responseId]
      return
    }
    if(message.type=="notify") {
      var from=message.from
      this.fireObservers(from,message.what,message.signal,message.args)
      return
    }
    var handler=this.messageHandlers[message.type]
    if(handler) handler(message)
  }
  fireObservers(from,what,signal,params) {
    var at=JSON.stringify([from,what])
    var observers=this.observers[at]
    console.log("fireObservers",from,what,at,this.observers,signal,params,observers)
    if(observers) observers.forEach((function(observer){
      process.nextTick(function(){
        observer.apply(observer,[signal].concat(params || []))
      })
    }).bind(this))
  }
  handleDisconnect() {
    console.info("REACTIVE OBSERVER DISCONNECTED")
    this.connected=false
    if(this.settings.onDisconnect) this.settings.onDisconnect()
    for(var k in this.waitingRequests) {
      this.waitingRequests[k]('disconnected')
    }
    this.waitingRequests={}
    if(this.autoReconnect) {
      setTimeout((function(){
        this.initialize()
      }).bind(this),this.settings.autoReconnectDelay || 2323)
    }
  }
 observe(to, what, observer) {
    console.info("observe ",to,what)
    var whatId = JSON.stringify([to,what])
    if(!this.observers[whatId]) {
      this.observers[whatId]=[]
      if(this.connected) this.send({
        type:"observe",
        what:what,
        to:to
      })
    }
    this.observers[whatId].push(observer)
  }
  unobserve(to, what, observer) {
    var whatId = JSON.stringify([to,what])
    var observers = this.observers[whatId]
    if(!observers) throw new Error("Removing non existing observer")
    var index = observers.indexOf(observer)
    if(index==-1) throw new Error("Removing non existing observer")
    observers.splice(index,1)
    if(observers.length==0) {
      delete this.observers[whatId]
      if(this.connected) this.send({
        type:"unobserve",
        what:what,
        to:to
      })
    }
  }
  handleConnect() {
    console.info("REACTIVE OBSERVER CONNECTED")
    this.connected=true
    this.send({
      type: 'initializeSession',
      sessionId: this.sessionId
    })
    /// REFRESH OBSERVABLES!
    for(var whatId in this.observers) {
      var what=JSON.parse(whatId)
      this.send({
        type:"observe",
        what:what[1],
        to:what[0]
      })
    }
    if(this.settings.onConnect) this.settings.onConnect()
  }
}

class SockJsConnection extends Connection {
  constructor(url, sessionId, settings) {
    super(sessionId, settings)
    this.url = url
    this.initialize()
  }

  initialize() {
    this.connection = new SockJS(this.url)
    console.info("NEW CONNECTION", this.sessionId)
    var connection = this.connection
    connection.onopen = (function () {
      if (connection.readyState === SockJS.CONNECTING) return setTimeout(connection.onopen, 230)
      this.handleConnect()
    }).bind(this)
    connection.onclose = (function () {
      var ef = function () {
      }
      connection.onclose = ef
      connection.onmessage = ef
      connection.onheartbeat = ef
      connection.onopen = ef
      this.handleDisconnect()
    }).bind(this)
    this.connection.onmessage = (function (e) {
      console.info("INCOMING MESSAGE", e.data)
      var message = JSON.parse(e.data)
      this.handleMessage(message)
    }).bind(this)
    /*this.connection.onheartbeat = (function(){
     console.log('BULLET PING!')
     this.send({type:"ping"})
     }).bind(this)*/
  }

  send(message) {
    var data = JSON.stringify(message)
    console.info("OUTGOING MESSAGE", data)
    this.connection.send(data)
  }

  reconnect() {
    this.connection.close()
    if (this.autoReconnect) return;
    this.initialize()
  }

  dispose() {
    this.finished = true
    this.connection.close()

  }

}

module.exports = SockJsConnection
