var rd = require("reactive-dom")

class RemoteObservable extends rd.Observable {

  constructor(dataSource, service, what) {
    super()
    //this.dataSource = dataSource
    this.service = service
    this.what = what
    this.connection = dataSource.connection
    this.observer = (signal,...args) => {
      if(signal == 'set') this.update(args[0])
    }
  }

  observe(observer) {
    this.observers.push(observer)
    if(this.observers.length == 1) {
      this.handleObserved()
    } else {
      observer(this.value)
    }
  }
  unobserve(observer) {
    this.observers.splice(this.observers.indexOf(observer), 1)
    if(this.observers.length == 0) this.handleUnobserved()
  }

  handleObserved() {
    this.connection.observe(this.service, this.what, this.observer)
  }
  handleUnobserved() {
    //console.trace("UNOBSERVE")
    this.connection.unobserve(this.service, this.what, this.observer)
  }
}

module.exports = RemoteObservable