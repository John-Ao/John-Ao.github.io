import test from 'node:test';
import assert from 'node:assert/strict';
import E from './engine.js';
import {applyEvent,replay,GAME_VERSION} from './online-protocol.mjs';
const init={seq:1,id:'init',seat:0,payload:{version:GAME_VERSION,kind:'init',roundId:'round_00000000001',seed:42}};
const start=()=>applyEvent(E,null,init);
const event=(m,seat,p)=>({id:'event',seat,payload:{version:GAME_VERSION,roundId:m.roundId,base:m.revision,...p}});
function move(m){for(const card of E.ends(m.board))for(let r=0;r<360;r+=45)for(const flip of [false,true]){const pos=E.moves(m.board,card,r,flip)[0];if(pos)return {id:card.id,rotation:r,flip,x:pos.x,y:pos.y};}throw Error('no move');}
test('seeded decks, immutable legal play, and complete replay',()=>{
 const m=start(),before=structuredClone(m),a={...event(m,m.board.turn,{kind:'action',action:move(m)}),seq:2};
 const n=applyEvent(E,m,a);assert.deepEqual(m,before);assert.equal(n.board.board.length,2);assert.deepEqual(replay(E,[init,a]),n);assert.deepEqual(start(),m);
});
test('reject invalid identity, version, round, revision, cards, coordinates, rotation and logs without mutation',()=>{
 const m=start(),before=structuredClone(m),a=move(m);
 for(const bad of [{version:'old'},{roundId:'old'},{base:9},{action:{...a,id:'not-a-card'}},{action:{...a,x:Infinity}},{action:{...a,x:99999}},{action:{...a,rotation:1}},{action:{...a,flip:1}}])assert.throws(()=>applyEvent(E,m,event(m,m.board.turn,{kind:'action',action:a,...bad})));
 assert.throws(()=>applyEvent(E,m,event(m,1-m.board.turn,{kind:'action',action:a})));
 assert.throws(()=>replay(E,[{...init,seq:2}]));assert.throws(()=>applyEvent(E,null,{...init,seat:1}));assert.deepEqual(m,before);
});
test('undo/restart require the other seat; rejection, resign and stale messages',()=>{
 let m=start();m=applyEvent(E,m,event(m,m.board.turn,{kind:'action',action:move(m)}));const played=m;
 m=applyEvent(E,m,event(m,0,{kind:'propose',operation:'undo'}));
 assert.throws(()=>applyEvent(E,m,event(m,0,{kind:'respond',proposalId:'event',accept:true})));
 assert.throws(()=>applyEvent(E,m,event(m,m.board.turn,{kind:'action',action:move(m)})));
 let n=applyEvent(E,m,event(m,1,{kind:'respond',proposalId:'event',accept:false}));assert.deepEqual(n.board,played.board);
 n=applyEvent(E,m,event(m,1,{kind:'respond',proposalId:'event',accept:true}));assert.deepEqual(n.board,start().board);
 n=applyEvent(E,n,event(n,0,{kind:'propose',operation:'restart',nextRound:'round_00000000002',seed:99}));
 n=applyEvent(E,n,event(n,1,{kind:'respond',proposalId:'event',accept:true}));assert.equal(n.revision,0);assert.equal(n.roundId,'round_00000000002');
 assert.throws(()=>applyEvent(E,n,event(played,0,{kind:'resign'})));
 n=applyEvent(E,n,event(n,1,{kind:'resign'}));assert.equal(n.board.resigned,1);assert.equal(n.board.finished,true);
});
test('complete network round and score replay identically',()=>{
 let m=start();const log=[init];let isolated=0;
 while(!m.board.finished){
  let action;
  if(E.hasMove(m.board))action=move(m);
  else{
   isolated++;
   const card=E.ends(m.board)[0];
   for(let y=-480;y<=480&&!action;y+=40)for(let x=-720;x<=720&&!action;x+=40){if(E.validate(m.board,card,0,false,x,y,true).ok)action={id:card.id,rotation:0,flip:false,x,y};}
  }
  assert(action,'legal placement exists');
  const e={...event(m,m.board.turn,{kind:'action',action}),id:'move-'+log.length,seq:log.length+1};
  log.push(e);m=applyEvent(E,m,e);
 }
 assert.equal(m.board.board.length,37);assert.equal(m.history.length,36);
 const restored=replay(E,log);assert.deepEqual(restored,m);assert.deepEqual(E.score(restored.board),E.score(m.board));
});
