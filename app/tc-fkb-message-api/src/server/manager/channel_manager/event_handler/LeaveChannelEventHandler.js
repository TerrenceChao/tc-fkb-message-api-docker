var config = require('config')
var util = require('util')
var path = require('path')

const {
  TO,
  EVENTS,
  BUSINESS_EVENTS,
  RESPONSE_EVENTS
} = require(path.join(config.get('src.property'), 'property'))
const RES_META = require(path.join(config.get('src.property'), 'messageStatus')).SOCKET
var ResponseInfo = require(path.join(config.get('src.manager'), 'ResponseInfo'))
var EventHandler = require(path.join(config.get('src.manager'), 'EventHandler'))

const CHANNEL_LEFT_SUCCESS = RES_META.CHANNEL_LEFT_SUCCESS
var respondErr = RES_META.LEAVE_CHANNEL_ERR

util.inherits(LeaveChannelEventHandler, EventHandler)

function LeaveChannelEventHandler () {
  this.name = arguments.callee.name
}

LeaveChannelEventHandler.prototype.eventName = EVENTS.LEAVE_CHANNEL

LeaveChannelEventHandler.prototype.handle = function (requestInfo) {
  var businessEvent = this.globalContext.businessEvent
  var storageService = this.globalContext.storageService

  var packet = requestInfo.packet
  var targetUid = packet.targetUid
  var chid = packet.chid

  /**
   * 待優化？
   * client 可以傳送自己版本的 channelInfo (除了自己 targetUid 的所有資訊), 藉此先更新其他成員的 channelInfo,
   * 等待 DB 確實更新 channelInfo 紀錄, 收到 response 後再刪除 client 端的 channelInfo。
   * [NOTE] 那如果沒接收到 DB 更新成功的訊息？
   * [NOTE] 是否要跟 join 成對的用同樣的 pattern? 交互的 join/leave 會有更新不即時的情況？
   *
   * 結論：
   * 沒有必要。即將離開的人不再傳送訊息，不會對流量造成壓力，不需要訊息先行，DB 後更新的機制
   */

  // channelLeaved: refresh channelInfo FIRST
  Promise.resolve(storageService.channelLeaved(targetUid, chid))
    .then(refreshedChannelInfo => this.executeLeave(refreshedChannelInfo, requestInfo),
      err => this.alertException(respondErr(err), requestInfo))
    .then(refreshedChannelInfo => {
      // remove entire channel & belonged conversations if there's no member
      if (refreshedChannelInfo.members.length === 0) {
        businessEvent.emit(BUSINESS_EVENTS.REMOVE_CHANNEL, requestInfo)
      }
    })
}

LeaveChannelEventHandler.prototype.executeLeave = function (channelInfo, requestInfo) {
  this.broadcastUserHasLeft(channelInfo, requestInfo)

  var socketService = this.globalContext.socketService
  // socketServer.of('/').adapter.remoteLeave(requestInfo.socket.id, channelInfo.chid)

  // leave 應該是該 userId 下的所有 socketId List 一起離開，不是只有 browser 的其中一個分頁離開
  // socketService.leave(requestInfo.socket.id, channelInfo.chid)
  socketService.leaveChannel(requestInfo.packet.targetUid, channelInfo.chid)

  return channelInfo
}

LeaveChannelEventHandler.prototype.broadcastUserHasLeft = function (channelInfo, requestInfo) {
  var businessEvent = this.globalContext.businessEvent
  var targetUid = requestInfo.packet.targetUid
  var nickname = requestInfo.packet.nickname

  var resInfo = new ResponseInfo()
    .assignProtocol(requestInfo)
    .setHeader({
      to: TO.CHANNEL,
      receiver: channelInfo.chid,
      responseEvent: RESPONSE_EVENTS.CHANNEL_LEFT // RESPONSE_EVENTS.CONVERSATION_FROM_CHANNEL
    })
    .responsePacket({
      uid: targetUid,
      // 1. delete targetUid from channel.members(array) for "each member" in localStorage (frontend)
      // 2. 其他使用者登入時，只載入了少數的 channelInfo, 有可能沒載入此 channelInfo 的資訊。當有成員離開時可提供更新後的 channelInfo 給前端
      channelInfo,
      datetime: Date.now()
    }, CHANNEL_LEFT_SUCCESS)
    .responseMsg(`${nickname} has left`)

  businessEvent.emit(EVENTS.SEND_MESSAGE, resInfo)
}

module.exports = {
  handler: new LeaveChannelEventHandler()
}
