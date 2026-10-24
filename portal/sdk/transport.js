import { api, apiBase } from './auth.js';
import { random } from '../shared/protocol.js';
export class RoomConnection extends EventTarget {
  constructor(client, id) {
    super(); this.client = client; this.id = id; this.seq = 0; this.ready = false; this.stopped = false; this.attempt = 0; this.generation = 0;
    this.outboxKey = `portal.outbox.${apiBase()}.${id}`;
    try { this.pending = JSON.parse(sessionStorage.getItem(this.outboxKey) || 'null'); } catch { this.pending = null; }
  }
  on(type, fn) { this.addEventListener(type, e => fn(e.detail)); return this; }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  async connect() {
    if (this.stopped) return;
    const generation = ++this.generation;
    clearTimeout(this.timer); this.ready = false; this.emit('status', 'connecting');
    try {
      const credentials = await this.client.credentials(this.id);
      if (this.stopped || generation !== this.generation) return;
      this.seat = credentials.scope === 'guest' ? 1 : 0;
      const { ticket } = await api(`/v1/rooms/${this.id}/ticket`, {}, credentials);
      if (this.stopped || generation !== this.generation) return;
      const url = new URL(`/v1/connect/${this.id}`, apiBase()); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('ticket', ticket);
      const ws = this.ws = new WebSocket(url);
      ws.onmessage = ({ data }) => {
        if (this.ws !== ws || generation !== this.generation || data === 'pong') return;
        let message; try { message = JSON.parse(data); } catch { this.emit('error', new Error('通信消息无法解析')); return; }
        if (message.type === 'sync') {
          this.seq = message.seq; this.seat = message.seat; this.ready = true; this.attempt = 0;
          const committed = this.pending && message.events.find(e => e.id === this.pending.id);
          if (committed) this.clearPending();
          this.emit('sync', message); this.emit('status', 'connected');
          if (this.pending) ws.send(JSON.stringify(this.pending));
        } else if (message.type === 'event') {
          if (message.event.seq <= this.seq) return;
          if (message.event.seq !== this.seq + 1) { ws.close(4000, 'Resync'); return; }
          this.seq = message.event.seq;
          if (this.pending?.id === message.event.id) this.clearPending();
          this.emit('event', message.event);
        } else if (message.type === 'ack') {
          if (this.pending?.id === message.id) this.clearPending();
        } else if (message.type === 'error') {
          const error = Object.assign(new Error(message.message), { status: message.status });
          if (message.id === this.pending?.id) this.clearPending(error);
          this.emit('error', error);
          if (message.status === 409) ws.close(4000, 'Resync');
        } else if (message.type === 'closed') {
          this.stopped = true; this.ready = false;
          const error = Object.assign(new Error(message.message), { status: 410, code: 4004 });
          this.clearPending(error); this.emit('error', error); this.emit('status', 'closed');
        }
        else this.emit(message.type, message);
      };
      ws.onclose = e => {
        if (this.ws !== ws || generation !== this.generation) return;
        this.ready = false; clearInterval(this.heartbeat);
        if ([4001, 4002, 4003, 4004].includes(e.code)) {
          this.stopped = true;
          const error = Object.assign(new Error(({4001:'会话已过期，请重新登录或请房主授权',4002:'此席位已在另一标签页打开',4003:'访客席位已被撤销',4004:'房间已关闭或过期'})[e.code]), { code: e.code, status: ({4001:401,4002:409,4003:403,4004:410})[e.code] });
          this.clearPending(error); this.emit('error', error);
        }
        this.emit('status', this.stopped ? 'closed' : 'disconnected'); this.retry();
      };
      ws.onerror = () => {}; // close handles network failures without duplicate retries.
      clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('ping'); }, 30000);
    } catch (e) {
      if (generation !== this.generation || this.stopped) return;
      if (e.scope === 'guest') this.seat = 1;
      this.emit('error', e);
      if ([401,403,410].includes(e.status)) { this.stopped = true; this.clearPending(e); }
      this.emit('status', this.stopped ? 'closed' : 'disconnected'); this.retry();
    }
  }
  retry() { clearTimeout(this.timer); if (!this.stopped) this.timer = setTimeout(() => this.connect(), Math.min(30000, 1000 * 2 ** Math.min(this.attempt++, 5)) + Math.random() * 500); }
  clearPending(error) {
    this.pending = null; sessionStorage.removeItem(this.outboxKey);
    if (error) this.reject?.(error); else this.resolve?.();
    this.resolve = this.reject = null; this.emit('pending', false);
  }
  send(payload) {
    if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('连接尚未恢复'));
    if (this.pending) return Promise.reject(new Error('上一条操作尚未确认'));
    const message = { type: 'event', id: random(16), expectedSeq: this.seq, payload };
    const encoded = JSON.stringify(message);
    sessionStorage.setItem(this.outboxKey, encoded); this.pending = message; this.emit('pending', true);
    return new Promise((resolve, reject) => {
      this.resolve = resolve; this.reject = reject;
      try { this.ws.send(encoded); } catch { this.reconnect(); }
    });
  }
  reconnect() {
    this.stopped = false; this.ready = false; this.generation++;
    clearTimeout(this.timer); clearInterval(this.heartbeat);
    const old = this.ws; this.ws = null; old?.close(4000, 'Resync');
    return this.connect();
  }
  disconnect() { this.stopped = true; this.ready = false; this.generation++; clearTimeout(this.timer); clearInterval(this.heartbeat); const ws = this.ws; this.ws = null; ws?.close(1000, 'Leaving'); if(this.pending)this.clearPending(new Error('连接已结束')); }
}
