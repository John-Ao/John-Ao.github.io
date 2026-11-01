// Offline, bounded, multipart QR signaling. No remote lookup is needed.
export const token = () => crypto.randomUUID().replaceAll('-', '');
const check = (ok, message = '配对码无效或版本不兼容') => { if (!ok) throw Error(message); };
const MAX = 24000;
export async function encodeSignal(signal) {
  let bytes = new TextEncoder().encode(JSON.stringify(signal)), format = 'j';
  check(bytes.length <= MAX, '连接信息过长，请关闭 VPN 后重试');
  if (typeof CompressionStream !== 'undefined') {
    bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    format = 'g';
  }
  const data = format + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const id = token(), count = Math.ceil(data.length / 480);
  return Array.from({length: count}, (_, i) => `nearby:1:${id}:${i}:${count}:${data.slice(i * 480, (i + 1) * 480)}`);
}
export class SignalReader {
  reset() { this.id = null; this.parts = new Map(); this.count = 0; }
  constructor() { this.reset(); }
  async add(text) {
    check(typeof text === 'string' && text.length < 600);
    const m = /^nearby:1:([a-f0-9]{32}):(\d+):(\d+):([\w-]+)$/.exec(text);
    check(m);
    const [, id, index, count, data] = m, i = Number(index), n = Number(count);
    check(n > 0 && n <= 68 && i >= 0 && i < n && data.length <= 480);
    check(!this.id || this.id === id, '这不是同一组配对码，请重新扫描');
    check(!this.count || this.count === n);
    check(!this.parts.has(i) || this.parts.get(i) === data);
    this.id = id; this.count = n; this.parts.set(i, data);
    if (this.parts.size !== n) return null;
    const joined = Array.from({length: n}, (_, k) => this.parts.get(k)).join('');
    check(['g', 'j'].includes(joined[0]));
    let bytes = Uint8Array.from(atob(joined.slice(1).replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    if (joined[0] === 'g') {
      check(typeof DecompressionStream !== 'undefined', '浏览器不支持此配对码，请升级浏览器');
      const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
      const chunks = []; let size = 0;
      try {
        while (true) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.length;
          if (size > MAX) { await reader.cancel(); throw Error('连接信息过长'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    }
    check(bytes.length <= MAX);
    const signal = JSON.parse(new TextDecoder().decode(bytes));
    check(signal?.v === 1 && typeof signal.game === 'string' && /^[a-f0-9]{32}$/.test(signal.id));
    check(['offer', 'answer'].includes(signal.description?.type) && typeof signal.description.sdp === 'string');
    check(Number.isFinite(signal.expires) && signal.expires > Date.now(), '配对码已过期，请重新创建');
    return signal;
  }
}
