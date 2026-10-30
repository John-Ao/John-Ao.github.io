'use strict';
const assert=require('node:assert/strict'),E=require('./engine.js');
const {CARDS:C,WONDERS:W,TOKENS:T,GODS:G,PLOTS:P,DECREES:D}=require('./data.js');
const id=n=>C.find(c=>c.name===n).id;
let seed=20261020;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};Math.random=random;
const pick=a=>a[Math.floor(random()*a.length)];
function fixture(name='祭坛',config={pantheon:true,agora:true}){const s=E.create(0,config);s.phase='play';s.flow=null;s.age=2;s.turn=0;s.players[0].coins=100;s.board=[{x:0,y:0,col:0,up:true,gone:false,token:null,card:id(name)},{x:2,y:0,col:1,up:true,gone:false,token:null,card:id('剧院')}];return s;}
function settle(s){let n=0;while(s.pending){assert(n++<80,'effect loop');E.choose(s,s.pending.options[0].value);}}
assert.deepEqual([1,2,3,4,5,6].map(a=>C.filter(c=>c.age===a).length),[23,23,20,7,5,13]);assert.equal(W.length,16);assert.equal(T.length,15);assert.equal(G.length,15);assert.equal(P.length,16);assert.equal(D.length,16);
for(let a=1;a<=3;a++){assert.equal(E.layout(a).length,20);assert.equal(E.layout(a,true).length,a===3?23:25);}
let s=fixture('引水渠',{});s.players[1].cards=[id('大型采石场')];assert.equal(E.quote(s,C[id('引水渠')],0).total,12);s.players[0].cards=[id('石材储备')];assert.equal(E.quote(s,C[id('引水渠')],0).total,3);s.players[0].cards.push(id('浴场'));assert.equal(E.quote(s,C[id('引水渠')],0).total,0);
s.players[0].cards=[id('商队旅馆')];s.players[0].tokens=[1];assert.equal(E.quote(s,{color:'wonder',cost:'sss'},0).total,0);
s=fixture('近卫军营',{});s.military=7;E.action(s,0,'build');assert.equal(s.result.reason,'军事霸权');
s=fixture('大学',{});s.players[0].cards=['工坊','药房','抄写室','药剂师','学院'].map(id);E.action(s,0,'build');assert.equal(s.result.reason,'科学霸权');
s=fixture('工坊',{});s.players[0].cards=[id('实验室')];s.tokens=[3];E.action(s,0,'build');assert.equal(s.pending.type,'token');assert.equal(s.turn,0);E.choose(s,3);assert.equal(s.turn,1);
s=fixture('近卫军营',{});s.military=2;E.action(s,0,'build');assert.equal(s.players[1].coins,5);assert.deepEqual(s.raids,['1:3']);
s=fixture('祭坛',{});s.players[0].wonders=[5];E.action(s,0,'wonder',5);assert.equal(s.turn,0);
s=fixture('祭坛',{});s.board=s.board.slice(0,1);s.players[0].wonders=[5];E.action(s,0,'wonder',5);assert.equal(s.phase,'starter');E.starter(s,1);assert.equal(s.age,3);assert.equal(s.turn,1);assert.equal(s.board.length,20);
s=fixture('祭坛',{});s.players[0].wonders=[1];s.players[1].cards=[id('玻璃工坊')];E.action(s,0,'wonder',1);E.choose(s,id('玻璃工坊'));assert(s.discard.includes(id('玻璃工坊')));
s=fixture('祭坛',{});s.players[0].wonders=[6];s.discard=[id('工坊')];s.players[0].cards=[id('实验室')];s.tokens=[3];E.action(s,0,'wonder',6);E.choose(s,id('工坊'));assert.equal(s.pending.type,'token');E.choose(s,3);assert.equal(s.turn,1);
// Pantheon: costs, no structure consumption, protected coins, scientific pairing and blocker.
s=fixture();s.slots[5]={god:15};s.players[0].built=[12];s.players[0].offerings=[2,4];assert.equal(E.godCost(s,5,[2,4]).total,8);
s=fixture();s.slots[0]={god:3};E.invoke(s,0);assert.equal(s.players[0].protected,7);assert(s.board.every(n=>!n.gone));assert.equal(s.turn,1);
s=fixture('近卫军营');s.minerva=2;E.action(s,0,'build');assert.equal(s.military,1);assert.equal(s.minerva,null);
s=fixture();s.players[0].tokens=[3];s.slots[0]={god:1};E.invoke(s,0);assert.equal(s.pending.type,'token');settle(s);assert.equal(E.science(s.players[0]).filter(x=>x==='⚖').length,2);
s=fixture();s.players[0].protected=7;s.players[0].coins=0;s.players[1].plots=[{id:13,ready:true,used:false}];s.turn=1;E.trigger(s,13);settle(s);assert.equal(s.players[0].protected,7);assert.equal(E.score(s,0).神祇,7);
s=fixture();const temple=C.find(c=>c.temple===0);s.players[1].myths=[0];s.chambers[0].decrees=[14];s.players[0].influence[0]=1;assert.equal(E.quote(s,temple).total,0);
// Agora: recruitment, action count, reserve, political victory and pre-turn conspiracy.
s=fixture();const politician=C.find(c=>c.senator==='politician');s.board[0].card=politician.id;s.players[0].cards=['祭坛','剧院','神庙','雕像'].map(id);E.action(s,0,'build');assert.equal(s.pending.type,'senate');assert.equal(s.queue.filter(t=>t.type==='senate').length,2);settle(s);assert.equal(s.players[0].influence.reduce((a,b)=>a+b),3);assert.equal(E.quote(s,politician,0).total,1);s.players[0].tokens=[13];assert.equal(E.quote(s,politician,0).total,0);
s=fixture();s.players[0].influence=[1,1,1,1,1,0];s.players[0].plots=[{id:4,ready:true,used:false}];E.trigger(s,4);E.choose(s,'p:5');assert.equal(s.result.reason,'政治霸权');
s=fixture();s.players[0].plots=[{id:15,ready:true,used:false}];E.trigger(s,15);assert.equal(s.turn,0);assert.equal(s.flow,null);assert.equal(s.military,2);assert.throws(()=>E.trigger(s,15));E.action(s,0,'discard');assert.equal(s.turn,1);
s=fixture();s.players[0].plots=[{id:8,ready:true,used:false}];E.trigger(s,8);E.choose(s,'skip');assert.equal(s.pending.type,'move');settle(s);assert(s.board.every(n=>!n.gone));
s=fixture();s.players[0].wonders=[0,1,2,3];s.players[1].wonders=[4,5,6,7];s.players[0].built=[0,1,2];s.players[1].built=[4,5,6];E.action(s,0,'wonder',3);settle(s);assert(s.locked.includes(7));s.turn=0;s.players[0].plots=[{id:2,ready:true,used:false}];E.trigger(s,2);settle(s);assert(!E.canWonder(s,1,7));
s=fixture();s.players[0].cards=['工坊','实验室','药房','抄写室','药剂师','学院'].map(id);s.players[1].cards=['大学','天文台','学校','图书馆','诊所','研究所'].map(id);s.players[0].plots=[{id:14,ready:true,used:false}];E.trigger(s,14);E.choose(s,id('工坊'));E.choose(s,id('大学'));assert.equal(s.result.winner,null);assert.equal(s.result.reason,'双方同时科学霸权');
// Every divinity and conspiracy resolves against populated legal targets.
for(let god=0;god<15;god++){s=fixture();s.slots[0]={god};s.players[0].wonders=[0,1,12,13];s.players[1].wonders=[2,3];s.players[1].built=[2];s.players[1].buried[2]=id('浴场');s.players[1].cards=['工坊','玻璃工坊'].map(id);s.discard=[id('酒馆')];E.invoke(s,0);settle(s);assert(s.players[0].gods.includes(god));assert(!s.pending);}
for(let plot=0;plot<16;plot++){s=fixture();s.players[0].plots=[{id:plot,ready:true,used:false}];s.players[0].influence[2]=1;s.players[1].influence[3]=1;s.players[0].cards=['祭坛','工坊'].map(id);s.players[1].cards=['神庙','实验室','酒馆','玻璃工坊'].map(id);s.players[1].wonders=[0,1];s.players[1].built=[0];s.players[1].buried[0]=id('浴场');E.trigger(s,plot);settle(s);assert(s.players[0].plots[0].used);assert(!s.pending);}
// Seeded full games cover draft effects, ages, replay, invocations and conspiracy chains.
const summary={};
for(const config of [{},{pantheon:true},{agora:true},{pantheon:true,agora:true}])for(let game=0;game<200;game++){
 const s=E.create(game%2,config);let steps=0;
 while(s.phase!=='end'&&steps++<1000){
  if(s.pending){E.choose(s,pick(s.pending.options).value);continue;}
  if(s.phase==='draft'){E.draft(s,pick(s.draft.slice(0,4-s.step%4)));continue;}
  if(s.phase==='starter'){E.starter(s,random()<.5?0:1);continue;}
  const p=s.players[s.turn],plots=p.plots.filter(x=>x.ready&&!x.used);
  if(!s.triggered&&plots.length&&random()<.5){E.trigger(s,pick(plots).id);continue;}
  const gods=s.slots.map((x,i)=>x&&s.age>1&&E.godCost(s,i,p.offerings).total<=E.totalMoney(p)?i:null).filter(x=>x!==null);
  if(gods.length&&random()<.25){E.invoke(s,pick(gods),[...p.offerings]);continue;}
  const available=s.board.map((_,i)=>i).filter(i=>E.available(s,i));assert(available.length);
  const i=pick(available),c=C[s.board[i].card],ws=p.wonders.filter(id=>E.canWonder(s,s.turn,id)&&E.quote(s,W[id]).total<=E.totalMoney(p)),prep=p.plots.filter(x=>!x.ready&&!x.used);
  if(ws.length&&random()<.3)E.action(s,i,'wonder',pick(ws));else if(prep.length&&random()<.25)E.action(s,i,'prepare',pick(prep).id);else E.action(s,i,E.quote(s,c).total<=E.totalMoney(p)&&random()<.9?'build':'discard');
  assert(s.players.every(p=>p.coins>=0&&p.protected>=0&&p.influence.every(x=>x>=0)&&p.influence.reduce((a,b)=>a+b)<=12));
  assert(s.players.reduce((n,p)=>n+p.built.length,0)<=7);
 }
 assert.equal(s.phase,'end');summary[s.result.reason]=(summary[s.result.reason]||0)+1;
}
console.log('PASS: component counts, trade, chains, base special effects, expansion regressions, all 15 gods and 16 conspiracies; 800 seeded complete games.',summary);
