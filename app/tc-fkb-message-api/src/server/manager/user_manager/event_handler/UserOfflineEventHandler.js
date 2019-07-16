var config = require('config')
var util = require('util')
var path = require('path')

const {
  TO,
  EVENTS,
  RESPONSE_EVENTS
} = require(path.join(config.get('src.property'), 'property'))
var ResponseInfo = require(path.join(config.get('src.manager'), 'ResponseInfo'))
var EventHandler = require(path.join(config.get('src.manager'), 'EventHandler'))

util.inherits(UserOfflineEventHandler, EventHandler)

function UserOfflineEventHandler () {
  this.name = arguments.callee.name
}

UserOfflineEventHandler.prototype.eventName = EVENTS.USER_OFFLINE

UserOfflineEventHandler.prototype.handle = function (requestInfo) {
  if (!this.isValid(requestInfo)) {
    console.warn(`${this.eventName}`, `request info is invalid`)
    return
  }

  var socketServer = this.globalContext['socketServer']
  var businessEvent = this.globalContext['businessEvent']
  var socket = requestInfo.socket
  var packet = requestInfo.packet
  var uid = packet.uid

  var resInfo = new ResponseInfo()
    .assignProtocol(requestInfo)
    .setHeader({
      to: TO.USER,
      receiver: uid,
      responseEvent: RESPONSE_EVENTS.PERSONAL_INFO
    })
    .setPacket({
      msgCode: `user is offline`
    })
  businessEvent.emit(EVENTS.SEND_MESSAGE, resInfo)

  socketServer.of('/').adapter.remoteLeave(socket.id, uid)
}

UserOfflineEventHandler.prototype.isValid = function (requestInfo) {
  return requestInfo.packet != null &&
    requestInfo.packet.uid != null
}

module.exports = {
  handler: new UserOfflineEventHandler()
}
