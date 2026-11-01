import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {protocol,seeded} from './online-protocol.mjs';
import {objectAdapter,radlandsAdapter} from './adapters.mjs';
import {adapter as lost} from '../lost_cities/online-adapter.mjs';
const require=createRequire(import.meta.url);
const Toy=require('../toy_battle/engine.js'), Schotten=require('../schotten_totten/game.js'), Seven=require('../7_wonders_duel/engine.js'), {Game:Rad}=require('../radlands/engine.js');
const cases=[
 [lost,{},s=>({name:'play',args:[0,true]})],
 [objectAdapter('toy_battle',Toy),{mapId:'castle',basic:false},s=>({name:'recruit',args:[]})],
 [objectAdapter('schotten_totten',Schotten),{tactics:true,expert:false,rounds:3,first:0},s=>({name:'play',args:[s.hands[s.player][0].id,0,{}]})],
 [objectAdapter('7_wonders_duel',Seven),{first:0,config:{pantheon:true,agora:true}},s=>({name:'draft',args:[s.draft[0]]})],
 [radlandsAdapter(Rad),{mode:'complete',setup:'draft'},s=>({name:'draft',args:[s.players[s.draft].offer.slice(0,3).map(c=>c.uid)]})]
];
for(const [adapter,options,move] of cases)test(adapter.id+' deterministic replay, seat checks, undo, restart, resign',()=>{
 const P=protocol(adapter),events=[];
 function add(seat,p){const event={seq:events.length+1,id:'id'+events.length,seat,payload:{version:P.version,seed:123,base:model?.revision,...p}};const result=P.apply(model,event);events.push(event);model=result;return event;}
 let model=null;
 add(0,{kind:'init',options});const start=structuredClone(model.board);
 assert.deepEqual(P.replay(events),model);
 const action={kind:'action',action:move(model.board)};
 assert.throws(()=>P.apply(model,{id:'wrong',seat:1-adapter.actor(model.board),payload:{version:P.version,base:model.revision,seed:1,...action}}));
 add(adapter.actor(model.board),action);assert.notDeepEqual(model.board,start);assert.deepEqual(P.replay(events),model);
 const q=add(0,{kind:'propose',operation:'undo'});
 assert.throws(()=>add(0,{kind:'respond',proposalId:q.id,accept:true}));
 add(1,{kind:'respond',proposalId:q.id,accept:true});assert.deepEqual(model.board,start);
 const restart=add(1,{kind:'propose',operation:'restart',options});add(0,{kind:'respond',proposalId:restart.id,accept:true});assert.deepEqual(model.board,start);
 add(0,{kind:'resign'});assert.equal(model.resigned,0);assert.throws(()=>add(adapter.actor(model.board),action));assert.deepEqual(P.replay(events),model);
 const bad=structuredClone(events);bad[1].seq=9;assert.throws(()=>P.replay(bad));
});
test('seeded scope restores ambient randomness on exceptions',()=>{const before=Math.random;assert.throws(()=>seeded(1,()=>{throw Error('x');}));assert.equal(Math.random,before);});
