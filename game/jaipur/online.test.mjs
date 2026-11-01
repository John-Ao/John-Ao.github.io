import assert from 'node:assert/strict';
import E from './engine.js';
import {applyEvent,replay,GAME_VERSION as version} from './online-protocol.mjs';
let model=null,events=[];
function send(seat,payload){const event={seat,id:`event-${events.length}`,seq:events.length+1,payload:{version,roundId:model?.roundId??'initial-round-0001',base:model?.revision??0,...payload}};const next=applyEvent(E,model,event);events.push(event);model=next;return event;}
function invalid(seat,payload){const before=JSON.stringify(model);assert.throws(()=>applyEvent(E,model,{seat,id:'bad',payload:{version,roundId:model.roundId,base:model.revision,...payload}}));assert.equal(JSON.stringify(model),before);}
send(0,{kind:'init'});
const camels={type:'camels',market:[],hand:[],camels:0};
invalid(1-model.board.turn,{kind:'action',action:camels});
invalid(model.board.turn,{kind:'action',action:camels,version:'other'});
invalid(model.board.turn,{kind:'action',action:camels,base:99});
invalid(model.board.turn,{kind:'action',action:camels,roundId:'wrong-round-0000'});
invalid(model.board.turn,{kind:'action',action:{...camels,hand:[0]}});
invalid(0,{kind:'propose',operation:'next',nextRound:'next-round-000001'});
const initial=JSON.stringify(model.board);send(model.board.turn,{kind:'action',action:camels});
const p=send(0,{kind:'propose',operation:'undo'});
invalid(0,{kind:'respond',proposalId:p.id,accept:true});
invalid(model.board.turn,{kind:'action',action:camels});
send(1,{kind:'respond',proposalId:p.id,accept:true});assert.equal(JSON.stringify(model.board),initial);
for(let round=0;round<3;round++){
  for(let step=0;!model.board.ended&&step<600;step++){
    const s=model.board,p=s.players[s.turn];
    const actions=[camels,...s.market.map((_,i)=>({type:'take',market:[i],hand:[],camels:0})),...E.TYPES.map(t=>({type:'sell',market:[],hand:p.hand.flatMap((x,i)=>x===t?[i]:[]),camels:0}))];
    const valid=actions.filter(a=>{try{E.act(s,a);return true;}catch{return false;}});
    send(s.turn,{kind:'action',action:valid[step%valid.length]});
  }
  assert.ok(model.board.ended);assert.deepEqual(replay(E,events),model);
  const operation=model.board.wins.some(n=>n>=2)?'restart':'next',wins=[...model.board.wins];
  const request=send(0,{kind:'propose',operation,nextRound:`next-round-00000${round}`});send(1,{kind:'respond',proposalId:request.id,accept:true});
  assert.deepEqual(model.board.wins,operation==='next'?wins:[0,0]);
}
assert.deepEqual(replay(E,events),model);
assert.throws(()=>replay(E,[events[0],events[0]]));
assert.throws(()=>replay(E,[{...events[0],seat:1}]));
assert.ok(events.every(e=>Buffer.byteLength(JSON.stringify(e.payload))<4096));
console.log('Passed: deterministic multi-round replay, seat/version/revision/action rejection, negotiation, undo, next round, restart, payload limits.');
