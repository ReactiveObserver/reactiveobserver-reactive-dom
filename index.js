var RemoteDataSource = require('./src/RemoteDataSource')

exports.connect = function(url, sessionId, settings) {
  return new RemoteDataSource(url, sessionId, settings)
}

exports.RemoteDataSource = RemoteDataSource
