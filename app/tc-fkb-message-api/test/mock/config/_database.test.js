require('dotenv').config()
const path = require('path')
const mongoose = require('mongoose')

mongoose.Promise = global.Promise
mongoose.envParams = {
  writeConcern: {
    w: process.env.TEST_MONGODB_WRITE_CONCERN_W || 'majority',
    j: JSON.parse(process.env.TEST_MONGODB_WRITE_CONCERN_J || true),
    wtimeout: process.env.TEST_MONGODB_WRITE_CONCERN_WTIMEOUT || 1000
  }
}

function NosqlShell () {
  mongoose.connection.on('error', console.error.bind(console, 'connection error:'))
  mongoose.connection.once('open', () => {
    console.log('[TEST MODE] mongodb is connecting ...')
  })

  mongoose.connection.once('disconnected', () => {
    console.log('[TEST MODE] mongodb is disconnected')
  })
}

NosqlShell.prototype.db = function () {
  return mongoose
}

NosqlShell.prototype.connect = function (host = null) {
  host = host || process.env.TEST_MONGODB_HOST
  mongoose.connect(host, {
    useFindAndModify: false,
    useNewUrlParser: true,
    useCreateIndex: true,
    autoIndex: false,
    reconnectTries: Number.MAX_VALUE,
    reconnectInterval: process.env.TEST_MONGODB_RECONNECT_INTERVAL || 500,
    poolSize: process.env.TEST_MONGODB_POOL_SIZE || 10
  })
}

NosqlShell.prototype.disconnect = function () {
  mongoose.disconnect()
}

module.exports = function (root) {
  var database = path.join(root, 'infrastructure', 'database')
  var nosql = path.join(database, 'nosql')
  var sql = path.join(database, 'sql')

  return {
    nosql: {
      db: new NosqlShell(),
      factory: path.join(nosql, 'factory'),
      model: path.join(nosql, 'model'),
      Seed: path.join(nosql, 'seed')
    },
    sql: {
      factory: path.join(sql, 'factory'),
      model: path.join(sql, 'model'),
      Seed: path.join(sql, 'seed')
    }
  }
}
