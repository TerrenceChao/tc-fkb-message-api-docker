var config = require('config')
var util = require('util')
var path = require('path')

const {
  TO,
  EVENTS,
  RESPONSE_EVENTS
} = require(path.join(config.get('src.property'), 'property'))
const RES_META = require(path.join(config.get('src.property'), 'messageStatus')).SOCKET
var ResponseInfo = require(path.join(config.get('src.manager'), 'ResponseInfo'))
var EventHandler = require(path.join(config.get('src.manager'), 'EventHandler'))

const CHANNEL_JOINED_SUCCESS = RES_META.CHANNEL_JOINED_SUCCESS
var respondErr = RES_META.JOIN_CHANNEL_ERR

util.inherits(JoinChannelEventHandler, EventHandler)

function JoinChannelEventHandler () {
  this.name = arguments.callee.name
}

JoinChannelEventHandler.prototype.eventName = EVENTS.JOIN_CHANNEL

JoinChannelEventHandler.prototype.handle = function (requestInfo) {
  var storageService = this.globalContext.storageService
  var packet = requestInfo.packet
  var targetUid = packet.targetUid
  var chid = packet.chid

  /**
   * 待優化？
   * 拿到 chid 後，先將自己的 targetUid 廣播給 channel 內成員，讓他們拿到需要更新的 memebers (多一個 targetUid)，
   * 再來執行 channelJoined, then getChannelInfo, 最後 user 才會拿到整個 channelInfo ???
   *
   * 結論：
   * 沒有必要。在未加入 channel 前，除了 chid 以外，其他關於 channelInfo 的 name, chid, members ... etc
   * 都拿不到，沒有辦法傳送/接收訊息，僅僅讓其他成員搶先一步知道有新的成員即將加入沒有太大意義。
   */

  // channelJoined: refresh channelInfo FIRST
  Promise.resolve(storageService.channelJoined(targetUid, chid))
    .then(refreshedChannelInfo => this.executeJoin(refreshedChannelInfo, requestInfo),
      err => this.alertException(respondErr(err), requestInfo))
}

JoinChannelEventHandler.prototype.executeJoin = function (channelInfo, requestInfo) {
  var socketService = this.globalContext.socketService
  // socketServer.of('/').adapter.remoteJoin(requestInfo.socket.id, channelInfo.chid)

  // join 應該是該 userId 下的所有 socketId List 一起加入，不是只有 browser 的其中一個分頁加入
  // socketService.join(requestInfo.socket.id, channelInfo.chid)
  socketService.joinChannelSync(
    () => this.broadcastRecipientJoined(channelInfo, requestInfo),
    requestInfo.packet.targetUid,
    channelInfo.chid
  )
}

JoinChannelEventHandler.prototype.broadcastRecipientJoined = function (channelInfo, requestInfo) {
  var businessEvent = this.globalContext.businessEvent
  var packet = requestInfo.packet
  var targetUid = packet.targetUid
  var nickname = packet.nickname

  var resInfo = new ResponseInfo()
    .assignProtocol(requestInfo)
    .setHeader({
      to: TO.CHANNEL,
      receiver: channelInfo.chid,
      responseEvent: RESPONSE_EVENTS.CHANNEL_JOINED // notify in channel
    })
    .responsePacket({
      uid: targetUid,
      // 1. refresh members: add targetUid to channel.members(array), remove targetUid from channel.recipients(array) for "each member" in localStorage (frontend)
      // 2. 其他使用者登入時，只載入了少數的 channelInfo, 有可能沒載入此 channelInfo 的資訊。當新的成員加入時可提供更新後的 channelInfo 給前端
      channelInfo,
      datetime: Date.now()
    }, CHANNEL_JOINED_SUCCESS)
    .responseMsg(`${nickname} has joined`)

  businessEvent.emit(EVENTS.SEND_MESSAGE, resInfo)
}

module.exports = {
  handler: new JoinChannelEventHandler()
}
