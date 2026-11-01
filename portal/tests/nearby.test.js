import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSignal, SignalReader} from '../nearby/signaling.js';
import {NearbyRoom} from '../nearby/room.js';

test('QR signaling accepts out-of-order and repeated parts, rejects mixed/expired/invalid codes', async () => {
  const signal = {v: 1, game: 'tacta', id: 'a'.repeat(32), expires: Date.now() + 60000, description: {type: 'offer', sdp: Array.from({length: 200}, () => crypto.randomUUID()).join('\n')}};
  const frames = await encodeSignal(signal), reader = new SignalReader();
  assert.ok(frames.length > 1);
  assert.equal(await reader.add(frames.at(-1)), null);
  assert.equal(await reader.add(frames.at(-1)), null);
  const other = await encodeSignal(signal);
  await assert.rejects(reader.add(other[0]), /同一组/);
  let decoded;
  for (const frame of frames.slice(0, -1).reverse()) decoded = await reader.add(frame);
  assert.deepEqual(decoded, signal);
  const expired = await encodeSignal({...signal, expires: 1, description: {type: 'answer', sdp: 'small'}});
  await assert.rejects(new SignalReader().add(expired[0]), /过期/);
  await assert.rejects(new SignalReader().add('https://example.com'), /无效/);
  await assert.rejects(new SignalReader().add(`nearby:1:${signal.id}:0:999:a`), /无效/);
});

// In-memory ordered channel exercises transport semantics independently of ICE.
function pair() {
  const original = globalThis.RTCPeerConnection;
  class Channel { readyState = 'open'; send(text) { queueMicrotask(() => this.peer.onmessage?.({data: text})); } close() { this.readyState = 'closed'; } }
  globalThis.RTCPeerConnection = class { createDataChannel() { return new Channel(); } close() {} };
  try {
    const host = new NearbyRoom({gameId: 'test'}), guest = new NearbyRoom({gameId: 'test', seat: 1, id: host.id});
    guest.bind(new Channel()); host.channel.peer = guest.channel; guest.channel.peer = host.channel;
    return [host, guest];
  } finally { globalThis.RTCPeerConnection = original; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('host orders both seats, rejects stale operations, resyncs, and reports departure', async () => {
  const [host, guest] = pair();
  try {
    guest.connect(); await tick(); assert.equal(guest.ready, false);
    host.connect(); await tick(); assert.ok(host.ready && guest.ready);
    await host.send({kind: 'init'}); await guest.send({kind: 'action'});
    assert.deepEqual(host.events, guest.events); assert.deepEqual(host.events.map(e => e.seat), [0, 1]);
    guest.seq = 0;
    await assert.rejects(guest.send({kind: 'stale'}), /局面已变化/); await tick();
    assert.equal(guest.seq, 2); assert.equal(host.events.length, 2);
    guest.events = []; guest.seq = 0; guest.reconnect(); await tick();
    assert.deepEqual(host.events, guest.events);
    host.disconnect(); await tick(); assert.equal(guest.stopped, true);
  } finally { host.disconnect(); guest.disconnect(); }
});
test('transport rejects oversized and malformed events without committing them', async () => {
  const [host, guest] = pair();
  try {
    host.connect(); guest.connect(); await tick();
    await assert.rejects(host.send({data: 'x'.repeat(17000)}), /过长/);
    assert.equal(host.events.length, 0); assert.equal(host.pending, null);
    guest.wire({type: 'request', id: 'bad', expectedSeq: 0, payload: {}}); await tick();
    assert.equal(host.stopped, true); assert.equal(host.events.length, 0);
  } finally { host.disconnect(); guest.disconnect(); }
});
test('pairing rejects another game, room, role, or expired answer', async () => {
  const [host, guest] = pair();
  try {
    const answer = {game: 'test', id: host.id, expires: Date.now() + 60000, description: {type: 'answer', sdp: ''}};
    await assert.rejects(host.accept({...answer, game: 'other'}), /当前游戏/);
    await assert.rejects(host.accept({...answer, id: 'b'.repeat(32)}), /当前房间/);
    await assert.rejects(host.accept({...answer, description: {type: 'offer', sdp: ''}}), /对方/);
    await assert.rejects(host.accept({...answer, expires: 1}), /过期/);
  } finally { host.disconnect(); guest.disconnect(); }
});
