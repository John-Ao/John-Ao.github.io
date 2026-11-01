import {token} from './signaling.js';
const check = (ok, message) => { if (!ok) throw Error(message); };
const LIMIT = 16000, MAX_EVENTS = 10000;

// Host sequences events; games still validate their own rules on both devices.
export class NearbyRoom extends EventTarget {
  constructor({gameId, seat = 0, id = token()}) {
    super();
    this.kind = 'nearby'; this.gameId = gameId; this.id = id; this.seat = seat;
    this.seq = 0; this.events = []; this.ready = false; this.stopped = false;
    this.pc = new RTCPeerConnection({iceServers: []});
    this.pc.ondatachannel = e => {
      if (this.channel || e.channel.label !== 'nearby-v1') { e.channel.close(); return; }
      this.bind(e.channel);
    };
    this.pc.onconnectionstatechange = () => {
      if (this.stopped) return;
      if (['disconnected', 'failed'].includes(this.pc.connectionState)) this.unavailable();
      else if (this.pc.connectionState === 'connected' && this.attached) this.connect();
    };
    if (seat === 0) this.bind(this.pc.createDataChannel('nearby-v1', {ordered: true}));
  }
  on(type, fn) { this.addEventListener(type, e => fn(e.detail)); return this; }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, {detail})); }
  bind(channel) {
    this.channel = channel;
    channel.onopen = () => { this.emit('paired'); if (this.attached) this.connect(); };
    channel.onclose = () => { if (!this.stopped) this.unavailable(); };
    channel.onerror = () => { if (!this.stopped) this.unavailable(); };
    channel.onmessage = ({data}) => {
      try {
        check(typeof data === 'string' && data.length <= LIMIT, '直连消息过长');
        this.receive(JSON.parse(data));
      } catch (error) { this.fail(error); }
    };
  }
  async description(type) {
    await this.pc.setLocalDescription(await (type === 'offer' ? this.pc.createOffer() : this.pc.createAnswer()));
    if (this.pc.iceGatheringState !== 'complete') await new Promise((resolve, reject) => {
      const finish = error => { clearTimeout(timer); this.pc.removeEventListener('icegatheringstatechange', changed); this.removeEventListener('disposed', disposed); error ? reject(error) : resolve(); };
      const changed = () => { if (this.pc.iceGatheringState === 'complete') finish(); };
      const disposed = () => finish(Error('配对已取消'));
      const timer = setTimeout(() => finish(Error('收集连接信息超时，请检查 Wi-Fi 后重试')), 15000);
      this.pc.addEventListener('icegatheringstatechange', changed); this.addEventListener('disposed', disposed); changed();
    });
    check(!this.stopped, '配对已取消');
    check(this.pc.localDescription.sdp.includes('a=candidate:'), '浏览器未提供本地连接地址，请检查本地网络权限或更换浏览器');
    return {v: 1, game: this.gameId, id: this.id, expires: Date.now() + 10 * 60 * 1000, description: this.pc.localDescription.toJSON()};
  }
  async accept(signal) {
    check(signal.game === this.gameId, '这不是当前游戏的配对码');
    check(signal.id === this.id, '应答码不属于当前房间');
    check(signal.description.type === (this.seat === 0 ? 'answer' : 'offer'), '请扫描对方的配对码');
    check(signal.expires > Date.now(), '配对码已过期，请重新创建');
    await this.pc.setRemoteDescription(signal.description);
  }
  wire(message) {
    check(this.channel?.readyState === 'open', '直连已断开，请返回本地对局后重新扫码配对');
    const data = JSON.stringify(message);
    check(data.length <= LIMIT, '直连消息过长');
    this.channel.send(data);
  }
  connect() {
    if (this.stopped) return;
    this.attached = true; this.ready = false; this.emit('status', 'connecting');
    clearTimeout(this.syncTimer);
    if (this.channel?.readyState !== 'open') { this.unavailable(); return; }
    this.syncTimer = setTimeout(() => this.unavailable(), 10000);
    if (this.seat === 1) this.wire({type: 'hello', game: this.gameId, id: this.id});
    else if (this.peerHello) this.sync();
  }
  reconnect() { this.connect(); }
  sync() {
    this.wire({type: 'snapshot', count: this.events.length});
    for (const event of this.events) this.wire({type: 'history', event});
    this.wire({type: 'synced'});
    this.publishSync();
  }
  publishSync() {
    clearTimeout(this.syncTimer);
    this.seq = this.events.length; this.ready = true;
    if (this.pending && this.events.some(e => e.id === this.pending.id)) this.clearPending();
    this.emit('sync', {seq: this.seq, seat: this.seat, events: [...this.events]});
    this.emit('presence', {joined: true, online: [0, 1]}); this.emit('status', 'connected');
  }
  receive(m) {
    check(m && typeof m.type === 'string', '直连消息无效');
    if (m.type === 'bye') { this.fail(Error('对方已离开面对面对局，请重新扫码配对')); return; }
    if (m.type === 'hello' && this.seat === 0) {
      check(m.game === this.gameId && m.id === this.id, '房间信息不匹配');
      this.peerHello = true; if (this.attached) this.sync(); return;
    }
    if (m.type === 'snapshot' && this.seat === 1) {
      check(Number.isInteger(m.count) && m.count >= 0 && m.count <= MAX_EVENTS, '同步长度无效');
      this.ready = false; this.snapshot = []; this.snapshotCount = m.count; return;
    }
    if (m.type === 'history' && this.seat === 1) {
      check(this.snapshot && this.snapshot.length < this.snapshotCount, '同步消息无效');
      this.validateEvent(m.event, this.snapshot.length + 1); this.snapshot.push(m.event); return;
    }
    if (m.type === 'synced' && this.seat === 1) {
      check(this.snapshot?.length === this.snapshotCount, '同步记录不完整');
      this.events = this.snapshot; this.snapshot = null; this.publishSync(); return;
    }
    if (m.type === 'request' && this.seat === 0) {
      check(this.ready, '房间尚未就绪');
      const old = this.events.find(e => e.id === m.id);
      if (old) { check(old.seat === 1, '重复操作身份不符'); this.wire({type: 'event', event: old}); return; }
      if (m.expectedSeq !== this.seq || this.pending) {
        this.wire({type: 'reject', id: m.id, message: '局面已变化，请同步后重试'}); this.sync(); return;
      }
      this.commit(m, 1); return;
    }
    if (m.type === 'event' && this.seat === 1) {
      const event = m.event;
      if (event?.seq <= this.seq) {
        check(this.events[event.seq - 1]?.id === event.id, '重复消息不一致');
      } else {
        this.validateEvent(event, this.seq + 1); this.events.push(event); this.seq++;
        this.emit('event', event);
      }
      this.wire({type: 'ack', id: event.id});
      if (this.pending?.id === event.id) this.clearPending(); return;
    }
    if (m.type === 'ack' && this.seat === 0) { if (this.pending?.id === m.id) this.clearPending(); return; }
    if (m.type === 'reject' && this.seat === 1) { if (this.pending?.id === m.id) this.clearPending(Error('局面已变化，请同步后重试')); return; }
    throw Error('未知直连消息');
  }
  validateEvent(event, seq) {
    check(event && event.seq === seq && /^[a-f0-9]{32}$/.test(event.id) && [0, 1].includes(event.seat) && event.payload && typeof event.payload === 'object', '操作记录无效');
    check(seq <= MAX_EVENTS, '对局记录已达上限，请重新配对');
  }
  commit(message, seat) {
    const event = {seq: this.seq + 1, id: message.id, seat, payload: message.payload};
    this.validateEvent(event, event.seq);
    this.wire({type: 'event', event});
    this.events.push(event); this.seq++; this.emit('event', event);
  }
  send(payload) {
    if (!this.ready || this.stopped) return Promise.reject(Error('连接尚未恢复'));
    if (this.pending) return Promise.reject(Error('上一条操作尚未确认'));
    const message = {type: 'request', id: token(), expectedSeq: this.seq, payload};
    return new Promise((resolve, reject) => {
      this.pending = message; this.resolve = resolve; this.reject = reject; this.emit('pending', true);
      this.pendingTimer = setTimeout(() => { this.clearPending(Error('操作确认超时，请重新同步后检查局面')); this.unavailable(); }, 12000);
      try { if (this.seat === 0) this.commit(message, 0); else this.wire(message); }
      catch (e) { this.clearPending(e); }
    });
  }
  clearPending(error) {
    clearTimeout(this.pendingTimer); this.pending = null;
    const resolve = this.resolve, reject = this.reject; this.resolve = this.reject = null;
    if (error) reject?.(error); else resolve?.(); this.emit('pending', false);
  }
  unavailable() {
    clearTimeout(this.syncTimer);
    this.ready = false; this.clearPending(Error('直连已中断，请重新同步或重新扫码配对'));
    this.emit('presence', {joined: true, online: [this.seat]}); this.emit('status', 'disconnected');
  }
  fail(error) { this.emit('error', error); this.disconnect(); this.emit('status', 'closed'); }
  disconnect() {
    if (this.stopped) return;
    try { this.wire({type: 'bye'}); } catch {}
    this.stopped = true; this.ready = false; clearTimeout(this.syncTimer); this.clearPending(Error('连接已结束'));
    this.channel?.close(); this.pc.close(); this.emit('disposed');
  }
}
