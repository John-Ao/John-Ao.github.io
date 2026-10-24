import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { applyEvent, replay, GAME_VERSION } from '../../game/quoridor/online-protocol.mjs';
import { fromSeed, newIdentity, sign } from '../crypto/keys.js';
import { verify, random, requestMessage } from '../shared/protocol.js';
const Q = createRequire(import.meta.url)('../../game/quoridor/engine.js');
const initial = { id: random(16), seq: 1, seat: 0, payload: { version: GAME_VERSION, kind: 'init', roundId: random(16), turn: 0 } };
function event(model, seat, payload, seq=2) { return { id: random(16), seq, seat, payload: { version: GAME_VERSION, roundId: model.roundId, base: model.revision, ...payload } }; }
test('确定性 Ed25519 派生、不可导出会话私钥和签名上下文', async () => {
  const seed = new Uint8Array(32).fill(7), a = await fromSeed(seed), b = await fromSeed(seed);
  assert.equal(a.publicKey, b.publicKey); assert.equal(a.privateKey.extractable, false);
  const session = await newIdentity(); assert.equal(session.privateKey.extractable, false);
  const auth = { session: random(), time: Date.now(), nonce: random(16) };
  const text = requestMessage('/v1/rooms', { roomId:'example-region-01' }, auth, 'https://api.test');
  const signature = await sign(a.privateKey, text);
  assert(await verify(a.publicKey, signature, text));
  assert.equal(await verify(a.publicKey, signature, text.replace('/v1/rooms','/v1/admin/rotate')), false);
});
test('客户端拒绝非法棋步、错误回合和错误版本，保留原状态', () => {
  const m = applyEvent(Q,null,initial), before = JSON.stringify(m);
  assert.throws(()=>applyEvent(Q,m,event(m,0,{kind:'action',action:{type:'move',r:0,c:0}})), /非法/);
  assert.throws(()=>applyEvent(Q,m,event(m,1,{kind:'action',action:{type:'move',r:1,c:4}})), /回合/);
  assert.throws(()=>applyEvent(Q,m,event(m,0,{kind:'action',version:'other'})), /版本/);
  assert.equal(JSON.stringify(m),before);
});
test('双方重放得到一致棋盘，悔棋和新局需要对方确认', () => {
  let m=applyEvent(Q,null,initial); const move=event(m,0,{kind:'action',action:{type:'move',r:7,c:4}});
  m=applyEvent(Q,m,move); assert.deepEqual(replay(Q,[initial,move]),m);
  const proposal=event(m,0,{kind:'propose',operation:'undo'},3);m=applyEvent(Q,m,proposal);
  assert.throws(()=>applyEvent(Q,m,event(m,0,{kind:'respond',proposalId:proposal.id,accept:true})), /回复/);
  m=applyEvent(Q,m,event(m,1,{kind:'respond',proposalId:proposal.id,accept:true},4));assert.equal(m.board.pawns[0].r,8);
  const nextRound=random(16), restart=event(m,1,{kind:'propose',operation:'restart',nextRound,turn:1},5);m=applyEvent(Q,m,restart);
  m=applyEvent(Q,m,event(m,0,{kind:'respond',proposalId:restart.id,accept:true},6));assert.equal(m.roundId,nextRound);assert.equal(m.board.turn,1);
});
test('乱序记录与旧局操作被本地拒绝', () => {
  assert.throws(()=>replay(Q,[{...initial,seq:2}]), /连续/);
  const m=applyEvent(Q,null,initial);
  assert.throws(()=>applyEvent(Q,m,event(m,0,{kind:'resign',roundId:random(16)})), /局面/);
  assert.equal(applyEvent(Q,m,event(m,0,{kind:'resign'})).board.winner,1);
});
