var rd = require("reactive-dom")

var ReactiveConnection = require("./ReactiveConnection.js")
var RemoteObservable = require("./RemoteObservable.js")

class RemoteData {
  constructor(url, sessionId, settings) {
    this.url = url
    this.sessionId = sessionId
    this.settings = settings

    this.observables = new Map()

    this.settings.stateless = rd.settings.stateless
    this.connection = null

    if(this.settings.stateless) {
      this.connected = new Promise((resolve, reject) => {
        this.connection = new ReactiveConnection(this.url, this.sessionId, {
          onConnect: () => {
            resolve(true)
          },
          onDisconnect: () => {
            resolve(false)
          }
        })
      })
    } else {
      this.connected = rd.observable(false)
      this.connection = new ReactiveConnection(this.url, this.sessionId, {
        onConnect: () => {
          this.connected.update(true)
        },
        onDisconnect: () => {
          this.connected.update(false)
        }
      })
    }
  }

  observable(path) {
    var observable = this.observables.get(path)
    if(observable) return observable
    observable = new RemoteObservable(this, path.slice(0,-1), path[path.length-1])
    this.observables.set(path,observable)
    return observable
  }

  get(path) {
    return this.connected.then((connected) => {
      if(connected) {
        return this.connection.get(path.slice(0,-1), path[path.length-1])
      } else throw new Error("could not connect to api server")
    })
  }

  request(path, ...args) {
    return this.connection.request(path.slice(0,-1), path[path.length-1], args)
  }

  event(path, ...args) {
    return this.connection.event(path.slice(0,-1), path[path.length-1], args)
  }

  dispose() {
    this.connection.dispose()
  }
}

module.exports = RemoteData