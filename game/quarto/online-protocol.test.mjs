import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './engine.js';
import {GAME_VERSION,applyEvent,replay} from './online-protocol.mjs';
const roundId='quarto-test-round-0001';
const init={seq:1,id:'init',seat:0,payload:{version:GAME_VERSION,kind:'init',roundId}};
const start=()=>applyEvent(E,null,init);
const event=(m,seat,payload,id='event')=>({id,seat,payload:{version:GAME_VERSION,roundId:m.roundId,base:m.revision,...payload}});
const act=(m,seat,type,value)=>applyEvent(E,m,event(m,seat,{kind:'action',action:{type,value}}));
test('seat 0 gives; recipient places and gives without switching seat twice',()=>{
 let m=start();m=act(m,0,'choose',0);assert.equal(m.board.turn,2);assert.equal(m.board.held,0);
 assert.throws(()=>act(m,0,'place',0));m=act(m,1,'place',0);assert.equal(m.board.turn,2);
 m=act(m,1,'choose',1);m=act(m,0,'place',1);assert.deepEqual(m.board.board.slice(0,2),[0,1]);assert.equal(m.history.length,4);
});
test('invalid versions, seats, fields, stale rounds/revisions and wrong phase preserve input',()=>{
 const m=start(),before=structuredClone(m);
 for(const payload of [{version:'other'}, {roundId:'old'}, {base:-1}, {base:'0'}, {kind:'init'}, {kind:'action',action:{type:'place',value:0}}, {kind:'action',action:{type:'choose',value:'0'}}, {kind:'action',action:{type:'choose',value:16}}])assert.throws(()=>applyEvent(E,m,event(m,0,payload)));
 assert.throws(()=>applyEvent(E,null,{...init,seat:1}));assert.throws(()=>applyEvent(E,m,event(m,2,{kind:'propose',operation:'undo'})));
 assert.deepEqual(m,before);
});
test('undo negotiation binds proposer, proposal id and current board; close/refusal does not undo',()=>{
 let m=act(start(),0,'choose',3),before=m.board;
 m=applyEvent(E,m,event(m,0,{kind:'propose',operation:'undo'},'undo1'));
 assert.throws(()=>act(m,1,'place',0));assert.throws(()=>applyEvent(E,m,event(m,0,{kind:'respond',proposalId:'undo1',accept:true})));
 assert.throws(()=>applyEvent(E,m,event(m,1,{kind:'respond',proposalId:'wrong',accept:true})));
 m=applyEvent(E,m,event(m,1,{kind:'respond',proposalId:'undo1',accept:false}));assert.deepEqual(m.board,before);
 m=applyEvent(E,m,event(m,1,{kind:'propose',operation:'undo'},'undo2'));
 m=applyEvent(E,m,event(m,0,{kind:'respond',proposalId:'undo2',accept:true}));assert.deepEqual(m.board,E.create());assert.equal(m.revision,2);
});
test('undoing placement restores held piece and recipient, not a fresh choose phase',()=>{
 let m=act(act(start(),0,'choose',5),1,'place',2);
 m=applyEvent(E,m,event(m,1,{kind:'propose',operation:'undo'},'undo'));
 m=applyEvent(E,m,event(m,0,{kind:'respond',proposalId:'undo',accept:true}));
 assert.equal(m.board.held,5);assert.equal(m.board.turn,2);assert.equal(m.board.phase,'place');assert.equal(m.board.board[2],null);
});
test('restart requires other player acceptance, changes round, resets history',()=>{
 let m=act(start(),0,'choose',0),old=m;
 m=applyEvent(E,m,event(m,1,{kind:'propose',operation:'restart',nextRound:'quarto-test-round-0002'},'restart'));
 m=applyEvent(E,m,event(m,0,{kind:'respond',proposalId:'restart',accept:true}));
 assert.deepEqual(m.board,E.create());assert.equal(m.history.length,0);assert.equal(m.revision,0);
 assert.throws(()=>applyEvent(E,m,event(old,1,{kind:'action',action:{type:'place',value:0}})));
});
test('winning line finishes both clients; replay is deterministic and validates sequence/id',()=>{
 let m=start();const events=[init];
 for(let i=0;i<4;i++)for(const type of ['choose','place']){const e=event(m,m.board.turn-1,{kind:'action',action:{type,value:i}},'action'+events.length);e.seq=events.length+1;events.push(e);m=applyEvent(E,m,e);}
 assert.equal(m.board.winner,1);assert.deepEqual(m,replay(E,events));assert.throws(()=>act(m,0,'choose',4));
 assert.throws(()=>replay(E,[init,{...events[1],seq:3}]));assert.throws(()=>replay(E,[init,{...events[1],id:init.id}]));
 assert.throws(()=>replay(E,[init,{...events[1],payload:{...events[1].payload,version:'quoridor-net-v1'}}]));
});
