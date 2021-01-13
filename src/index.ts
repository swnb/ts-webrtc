// import { logger } from "pkg/util/logger"
import { SyncEvent } from '@swnb/event'

type VoidFnWithSingleArg<T> = (arg: T) => void

type SDPDescriptionHandler = VoidFnWithSingleArg<RTCSessionDescriptionInit>

type PeerEventMap = {
  rtcPeerConnectionStateChange: VoidFnWithSingleArg<RTCPeerConnectionState>
  dataChannel: VoidFnWithSingleArg<RTCDataChannel>
  negotiationneeded: VoidFunction
  track: VoidFnWithSingleArg<RTCTrackEvent>
  sendCandidate: VoidFnWithSingleArg<RTCIceCandidate>
  sendOffer: SDPDescriptionHandler
  sendAnswer: SDPDescriptionHandler
  setCandidate: VoidFnWithSingleArg<RTCIceCandidate>
  setOffer: SDPDescriptionHandler
  setAnswer: SDPDescriptionHandler
  close: VoidFunction
}

export interface Options {
  connection: {
    userID: string
    roomID: string
  }
  offer?: RTCOfferOptions
  answer?: RTCAnswerOptions
}

const Console = console

abstract class Peer extends SyncEvent<PeerEventMap> {
  public isDebug = true

  // RTCPeerConnection
  protected rtcPeerConnection: RTCPeerConnection

  constructor(rtcPeerConnection: RTCPeerConnection) {
    super()
    this.rtcPeerConnection = rtcPeerConnection
    // 监听 ice 返回的 candidate 的一事件
    this.rtcPeerConnection.addEventListener('icecandidate', this.onIceCandidate)
    this.rtcPeerConnection.addEventListener('negotiationneeded', this.onNegotiationneeded)
    this.rtcPeerConnection.addEventListener('connectionstatechange', this.onConnectionStateChange)
    this.rtcPeerConnection.addEventListener('track', this.onTrack)
    this.rtcPeerConnection.addEventListener('datachannel', this.onDataChannel)
  }

  public setCandidate = async (candidate: RTCIceCandidate) => {
    if (this.isDebug) {
      Console.log('set candidate ', candidate)
    }
    await this.rtcPeerConnection.addIceCandidate(candidate)
    this.dispatch('setCandidate', candidate)
  }

  // 封装好的 senderOffer 方法
  public sendOffer = async (offerOptions?: RTCOfferOptions) => {
    const offer = await this.rtcPeerConnection.createOffer(offerOptions)
    this.rtcPeerConnection.setLocalDescription(offer)

    if (this.isDebug) {
      Console.log('create offer ', offer, ' prepare to send')
    }

    this.dispatch('sendOffer', offer)
  }

  // 封装好的 sendAnswer 方法
  public sendAnswer = async (answerOptions?: RTCAnswerOptions) => {
    const answer = await this.rtcPeerConnection.createAnswer(answerOptions)
    await this.rtcPeerConnection.setLocalDescription(answer)

    if (this.isDebug) {
      Console.log('create answer ', answer, ' prepare to send')
    }

    this.dispatch('sendAnswer', answer)
  }

  public setOffer = async (offer: RTCSessionDescriptionInit, answerOptions?: RTCAnswerOptions) => {
    if (this.isDebug) {
      Console.log('set offer ', offer)
    }

    // 设置接收到的 offer
    await this.rtcPeerConnection.setRemoteDescription(offer)
    this.dispatch('setOffer', offer)

    //  发送响应
    const answer = await this.rtcPeerConnection.createAnswer(answerOptions)

    if (this.isDebug) {
      Console.log('create answer ', answer, 'prepare to send')
    }

    await this.rtcPeerConnection.setLocalDescription(answer)
    this.dispatch('sendAnswer', answer)
  }

  public setAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (this.isDebug) {
      Console.log('set answer ', answer)
    }

    await this.rtcPeerConnection.setRemoteDescription(answer)
    this.dispatch('setAnswer', answer)
  }

  public destroy = () => {
    // 销毁 RTCPeerConnection 的回调函数
    this.rtcPeerConnection.removeEventListener('icecandidate', this.onIceCandidate)
    this.rtcPeerConnection.removeEventListener('negotiationneeded', this.onNegotiationneeded)
    this.rtcPeerConnection.removeEventListener(
      'connectionstatechange',
      this.onConnectionStateChange,
    )
    this.rtcPeerConnection.removeEventListener('track', this.onTrack)
    this.rtcPeerConnection.removeEventListener('datachannel', this.onDataChannel)
    this.rtcPeerConnection.close()
    this.dispatch('close')
    // 移除注册事件
    this.autoClear()
  }

  public createDataChannel = (label: string, dataChannelDict?: RTCDataChannelInit) => {
    return this.rtcPeerConnection.createDataChannel(label, dataChannelDict)
  }

  // 获取到 candidate 之后的触发
  private onIceCandidate = ({ candidate }: RTCPeerConnectionIceEvent) => {
    if (!candidate) {
      Console.warn('candidate is null , check why')
      return
    }

    if (this.isDebug) {
      Console.log('get ice candidate ', candidate, '  prepare to send')
    }

    // 准备完成开始发送 candidate
    this.dispatch('sendCandidate', candidate)
  }

  private onNegotiationneeded = () => {
    this.dispatch('negotiationneeded')
  }

  // 当 connectionStateChange 的时候发布状态
  private onConnectionStateChange = () => {
    if (this.isDebug) {
      Console.log(`RTCPeerConnection state changed ${this.rtcPeerConnection.connectionState}`)
    }

    this.dispatch('rtcPeerConnectionStateChange', this.rtcPeerConnection.connectionState)
  }

  private onTrack = (ev: RTCTrackEvent) => {
    this.dispatch('track', ev)
  }

  private onDataChannel = ({ channel }: RTCDataChannelEvent) => {
    this.dispatch('dataChannel', channel)
  }
}

export { Peer }
