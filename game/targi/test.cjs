'use strict';
const assert=require('node:assert/strict'),E=require('./engine.js'),D=require('./cards.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const card=id=>E.clone(D.tribes.find(c=>c.id===id));
const apply=(s,type,rest={})=>E.dispatch(s,{type,...rest});
function actionState(){const s=E.create();s.phase='action';s.turn=0;s.actions=[[2],[3]];return s;}
function pending(s,id,source='expand'){s.pending={kind:'tribe',source,card:card(id)};if(source==='noble')s.pending.origin=1;return s;}
function give(s,...ids){s.players[0].rows=[ids.slice(0,4).map(card),ids.slice(4,8).map(card),ids.slice(8,12).map(card)];}
function buy(s,id,row=0,source='expand'){pending(s,id,source);return apply(s,'build',{row,payment:0});}
function rich(s){s.players[0].r=[20,20,20,20,4];return s;}

test('45 unique tribe cards, 19 goods, official type / point / resource distributions',()=>{
 assert.equal(D.tribes.length,45);assert.equal(new Set(D.tribes.map(c=>c.id)).size,45);assert.equal(D.goods.length,19);
 for(let i=0;i<5;i++){assert.equal(D.tribes.filter(c=>c.type===i).length,9);assert.equal(D.tribes.filter(c=>c.type===i&&c.vp===1).length,4);}
 assert.equal(D.goods.filter(c=>!c.gain.length).length,3);assert.equal(D.goods.filter(c=>c.gain[0]?.[0]===3).length,3);
 for(let i=0;i<3;i++){assert.equal(D.goods.filter(c=>c.gain.length===1&&c.gain[0][0]===i&&c.gain[0][1]===1).length,2);}
 assert.equal(D.tribes.filter(c=>c.effect==='none').length,15);
});
test('setup and placement restrictions; own opposite allowed; zero / one / two intersections',()=>{
 let s=E.create();assert.deepEqual(s.players[0].r,[2,2,2,1,4]);assert.equal(Object.values(s.board).filter(c=>c.kind==='goods').length,5);
 assert.equal(E.legal(s,1),false);assert.equal(E.legal(s,0),false);s=apply(s,'place',{cell:2});assert.equal(E.legal(s,22),false);s.turn=0;assert.equal(E.legal(s,22),true);
 assert.deepEqual(E.intersections([1,3,5]),[6,8]);assert.deepEqual(E.intersections([1,21,5]),[6]);assert.deepEqual(E.intersections([1,2,3]),[]);
});
test('robber ability does not override occupancy, opposite rule or corners',()=>{let s=E.create();give(s,'T03');assert.ok(E.legal(s,1));s.placed[1]=[21];assert.equal(E.legal(s,1),false);s.placed[1]=[];s.robber=16;assert.equal(E.legal(s,0),false);});
test('penalty grants exactly two workers next round; last placement not deadlocked',()=>{
 let s=rich(actionState());s=buy(s,'T41');assert.equal(s.players[1].blockedRound,2);s.phase='place';s.pending=null;s.round=2;s.placed=[[],[]];
 for(let i=0;i<5;i++)s=apply(s,'place',{cell:E.ring.find(x=>E.legal(s,x))});assert.equal(s.phase,'action');assert.deepEqual(s.placed.map(a=>a.length),[3,2]);s.round=3;assert.equal(E.quota(s,1),3);
});
test('alternative payment, player-selected discounts, stacking and gold protected',()=>{
 const s=rich(actionState());assert.equal(E.payments(s,card('T29')).length,2);give(s,'T01','T42');
 assert.deepEqual(E.payments(s,card('T06')).map(p=>p.pay),[[0,2,1,0],[1,1,1,0],[1,2,0,0]]);
 assert.ok(E.payments(s,card('T06'),'noble').every(p=>p.pay.slice(0,3).reduce((a,b)=>a+b,0)===2));assert.deepEqual(E.payments(s,card('T10'),'noble')[0].pay,[0,0,0,1]);
});
test('cannot pay with rewards from card currently being built; invalid dispatch atomic',()=>{let s=actionState();s.players[0].r=[0,0,0,0,4];pending(s,'T32');const before=JSON.stringify(s);assert.throws(()=>apply(s,'build',{row:0,payment:0}));assert.equal(JSON.stringify(s),before);});
test('stored gold: earned on entry, optional for later tribe, not spendable at silver / raid',()=>{
 let s=rich(actionState());s=buy(s,'T02');assert.equal(s.players[0].storedGold,1);s.players[0].r=[0,0,0,0,4];assert.equal(E.payments(s,card('T10'))[0].stored,1);s=buy(s,'T10');assert.equal(s.players[0].storedGold,0);
 s.players[0].storedGold=1;s.pending={kind:'silver',origin:22};assert.equal(E.exchanges(s).length,0);s.phase='raid';s.pending=null;s.robber=16;s.players[0].r[4]=0;assert.deepEqual(E.raidOptions(s),['unable']);
});
test('one held card; cannot overwrite, noble later round, free-hand surcharge and no discard',()=>{
 let s=actionState();pending(s,'T10');s=apply(s,'tribe',{choice:'hold'});assert.equal(s.players[0].hand.id,'T10');pending(s,'T11');assert.throws(()=>apply(s,'tribe',{choice:'hold'}));s.pending=null;s.actions[0]=[1];s=apply(s,'activate',{cell:1});assert.equal(E.mayBuild(s),false);s.round=2;assert.ok(E.mayBuild(s));s=apply(s,'tribe',{choice:'discard'});assert.equal(s.players[0].hand,null);
 give(s,'T05');s.players[0].hand=card('T07');s.players[0].r=[10,10,10,10,4];s=apply(s,'freeHand');assert.ok(E.payments(s,s.pending.card,'freeHand').every(v=>v.pay.slice(0,3).reduce((a,b)=>a+b,0)===5));assert.throws(()=>apply(s,'tribe',{choice:'discard'}));const actions=[...s.actions[0]];s=apply(s,'build',{row:1,payment:0});assert.deepEqual(s.actions[0],actions);assert.equal(s.players[0].hand,null);
});
test('all five discount cards affect only their own symbols',()=>{for(const id of ['T01','T10','T19','T29','T37']){const s=rich(actionState()),c=card(id);give(s,id);for(let t=0;t<5;t++){const x=D.tribes.find(d=>d.type===t&&d.effect==='none'&&!d.costs[0][3]);const sum=a=>a.slice(0,3).reduce((a,b)=>a+b,0);assert.equal(sum(E.payments(s,x)[0].pay),sum(x.costs[0])-(c.type===t?1:0));}}});
test('production each resource once / round; retroactive new card; border does not trigger',()=>{
 for(const [id,r] of [['T15',2],['T22',1],['T33',0]]){let s=actionState();give(s,id);s.board[6]={kind:'goods',id:'x',gain:[[r,1]]};s.board[7]={kind:'goods',id:'y',gain:[[r,2]]};s.actions[0]=[6,7];const before=s.players[0].r[r];s=apply(s,'activate',{cell:6});s=apply(s,'activate',{cell:7});assert.equal(s.players[0].r[r],before+4);}
 let s=rich(actionState());s.players[0].seen=[true,false,false];s=buy(s,'T33');assert.equal(s.players[0].r[0],19); // 20 - 2 + 1
 s=actionState();give(s,'T33');s=apply(s,'activate',{cell:2});assert.equal(s.players[0].r[0],3);assert.equal(s.players[0].seen[0],false);
});
test('no-goods compensation includes border-only and gold-card rounds; once',()=>{
 let s=actionState();give(s,'T24');s.actions[0]=[];s=apply(s,'endTurn');assert.equal(s.pending.kind,'bonusGoods');s=apply(s,'good',{resource:1});assert.equal(s.turn,1);assert.equal(s.players[0].r[1],3);
 s=actionState();give(s,'T24');s.players[0].seen[0]=true;s.actions[0]=[];s=apply(s,'endTurn');assert.equal(s.pending,null);assert.equal(s.turn,1);
});
test('three-way reward and built/empty-space one-time bonuses include self',()=>{
 let s=rich(actionState());s=buy(s,'T12');assert.equal(s.pending.left,5);for(let i=0;i<5;i++)s=apply(s,'good',{resource:i%3});assert.equal(s.pending,null);
 s=rich(actionState());give(s,'T07','T08','T09');s=buy(s,'T06');assert.equal(s.pending.left,2);
 for(const choice of ['goods','gold','vp']){s=rich(actionState());s=buy(s,'T32');const before=[...s.players[0].r];s=apply(s,'bonus',{choice});if(choice==='goods')assert.equal(s.pending.left,3);else assert.equal(s.players[0].r[choice==='gold'?3:4],before[choice==='gold'?3:4]+1);}
});
test('rearrange two arbitrary cards, swap, fill holes, no third card',()=>{
 let s=rich(actionState());give(s,'T07','T08','T09','T16');s=buy(s,'T23',1);s=apply(s,'rearrange',{op:'lift',row:0,col:0});assert.throws(()=>apply(s,'rearrange',{op:'done'}));s=apply(s,'rearrange',{op:'lift',row:1,col:0});assert.throws(()=>apply(s,'rearrange',{op:'lift',row:0,col:1}));s=apply(s,'rearrange',{op:'drop',row:1,col:0});s=apply(s,'rearrange',{op:'drop',row:0,col:0});s=apply(s,'rearrange',{op:'done'});assert.equal(s.players[0].rows[0][0].id,'T23');assert.equal(s.players[0].rows[1][0].id,'T07');
});
test('trader upgrade, silver once, all exchange ratios',()=>{
 let s=rich(actionState());s.pending={kind:'trade',origin:9};assert.ok(E.exchanges(s).some(x=>x.n===2&&x.j===1));give(s,'T38');assert.ok(E.exchanges(s).some(x=>x.n===1&&x.j===1));assert.ok(E.exchanges(s).filter(x=>x.j===3).every(x=>x.n===3));s.pending={kind:'silver',origin:22};assert.ok(E.exchanges(s).some(x=>x.i===3&&x.n===2&&x.m===4));s=apply(s,'exchange',{index:0});assert.equal(s.pending,null);
});
test('Fata Morgana excludes occupied and face-down, moves only an unspent marker',()=>{
 let s=actionState();s.actions=[[23,6],[7]];s.board[8]={kind:'back',card:card('T01')};s=apply(s,'activate',{cell:23});assert.ok(!E.moveTargets(s).includes(7));assert.ok(!E.moveTargets(s).includes(8));assert.throws(()=>apply(s,'move',{from:11,to:12}));s=apply(s,'move',{from:6,to:12});assert.deepEqual(s.actions[0],[12]);
});
test('central replacement is dealt immediately, not after later Tribal Expansion',()=>{
 let s=actionState();s.actions[0]=[6,10];s.board[6]={kind:'goods',id:'x',gain:[[0,1]]};const top=s.td.at(-1).id,next=s.td.at(-2).id;s=apply(s,'activate',{cell:6});assert.equal(s.board[6].kind,'back');assert.equal(s.board[6].card.id,top);s=apply(s,'activate',{cell:10});assert.equal(s.pending.card.id,next);
});
test('skip leaves central card in place without resources; marker removed',()=>{let s=actionState();s.actions[0]=[6];const before=[...s.players[0].r],id=s.board[6].id;s=apply(s,'skip',{cell:6});assert.equal(s.board[6].id,id);assert.equal(s.gx.length,0);assert.deepEqual(s.actions[0],[]);assert.deepEqual(s.players[0].r,before);});
test('goods reshuffle immediately on drawing last card, before Caravan discards it',()=>{let s=actionState();const last=s.gd.pop(),old=s.gd.pop();s.gd=[last];s.gx=[old];s.actions[0]=[15];s=apply(s,'activate',{cell:15});assert.deepEqual(s.gd.map(c=>c.id),[old.id]);assert.deepEqual(s.gx.map(c=>c.id),[last.id]);});
test('free-hand ability is once per round; cancelling does not spend it',()=>{let s=rich(actionState());give(s,'T05');s.players[0].hand=card('T07');s=apply(s,'freeHand');s=apply(s,'tribe',{choice:'cancel'});assert.equal(s.players[0].freeHandUsed,false);s=apply(s,'freeHand');s=apply(s,'build',{row:1,payment:0});s.players[0].hand=card('T08');assert.throws(()=>apply(s,'freeHand'));assert.equal(E.payments(s,s.players[0].hand,'freeHand').length,0);s.actions=[[],[]];s.players[0].r=[2,2,2,1,4];s=apply(s,'endTurn');s=apply(s,'endTurn');assert.equal(s.players[0].freeHandUsed,false);});
test('raid choices, immunity/reward exclusion, insufficient assets compensation',()=>{
 let s=E.create();s.phase='raid';s.robber=12;s.players[0].r=[0,0,0,0,1];assert.deepEqual(E.raidOptions(s),['unable']);s=apply(s,'raid',{choice:'unable'});assert.equal(s.players[1].r[4],6);assert.equal(s.players[0].r[4],1);
 s=E.create();s.phase='raid';s.robber=4;give(s,'T21','T30');const before=s.players[0].r[4];s=apply(s,'raid',{choice:'immune'});assert.equal(s.players[0].r[4],before);
 s.turn=0;s.raidPaid=0;s=apply(s,'raid',{choice:'vp'});assert.equal(s.players[0].r[4],before);
});
test('resource raids require complete payment before next player',()=>{let s=E.create();s.phase='raid';s.robber=8;s=apply(s,'raid',{choice:'resources'});assert.equal(s.pending.left,2);s=apply(s,'good',{resource:0});assert.equal(s.turn,0);s=apply(s,'good',{resource:1});assert.equal(s.turn,1);});
test('round limits after both players, player chooses goods, stored gold exempt',()=>{
 let s=actionState();s.actions=[[],[]];s.players[0].r=[6,6,1,5,4];s.players[0].storedGold=1;s=apply(s,'endTurn');assert.equal(s.players[0].r[3],5);s=apply(s,'endTurn');assert.equal(s.phase,'limit');assert.equal(s.players[0].r[3],3);for(let i=0;i<3;i++)s=apply(s,'limit',{resource:0});assert.equal(s.phase,'place');assert.equal(s.players[0].r[0],3);assert.equal(s.players[0].storedGold,1);
});
test('12 cards finish both player turns; fourth raid ends immediately; no round 13',()=>{
 let s=actionState();give(s,...D.tribes.slice(0,12).map(c=>c.id));s.actions=[[],[3]];s=apply(s,'endTurn');assert.equal(s.phase,'action');assert.equal(s.turn,1);s=apply(s,'skip',{cell:3});s=apply(s,'endTurn');assert.equal(s.phase,'end');
 s=actionState();s.round=12;s.robber=15;s.actions=[[],[]];s=apply(s,'endTurn');s=apply(s,'endTurn');assert.equal(s.phase,'raid');s=apply(s,'raid',{choice:'resources'});s=apply(s,'raid',{choice:'resources'});assert.equal(s.phase,'end');assert.equal(s.round,12);
});
test('all pair scoring abilities and rightmost / majority / ten / diversity',()=>{
 for(const id of ['T04','T13','T20','T31','T40']){const s=E.create(),c=card(id),others=D.tribes.filter(x=>x.type===c.arg).slice(0,4).map(x=>({...x,effect:'none'}));s.players[0].rows=[[c],others,[]];assert.equal(E.score(s,0).abilities,2);}
 let s=E.create();give(s,'T07','T08','T09','T14');assert.equal(E.score(s,0).abilities,2);s.players[0].rows[0].reverse();assert.equal(E.score(s,0).abilities,0);
 s=E.create();give(s,'T11');assert.equal(E.score(s,0).abilities,1);s.players[1].rows[0]=[card('T01')];assert.equal(E.score(s,0).abilities,0);
 s=E.create();const ids=['T39','T07','T08','T09','T16','T17','T18','T25','T26','T27'];give(s,...ids);assert.equal(E.score(s,0).abilities,1);
 s=E.create();give(s,'T07','T16','T25','T28','T08','T17','T26','T34','T09','T18','T27','T35');assert.equal(E.score(s,0).rowPoints,6);assert.equal(E.score(s,0).abilities,4);
});
test('tiebreak gold then goods; stored gold excluded',()=>{const s=E.create();s.players[0].storedGold=1;assert.equal(E.winner(s),null);s.players[1].r[3]++;assert.equal(E.winner(s),1);s.players[1].r[3]--;s.players[0].r[0]++;assert.equal(E.winner(s),0);});
test('complete state can be serialized during payment / rearrangement / raids',()=>{let s=rich(actionState());s=buy(s,'T23');s=apply(s,'rearrange',{op:'lift',row:0,col:0});s=JSON.parse(JSON.stringify(s));s=apply(s,'rearrange',{op:'drop',row:1,col:0});s=apply(s,'rearrange',{op:'done'});assert.equal(s.players[0].rows[1][0].id,'T23');});

// In a valid game every physical card occurs exactly once; pending borrowed card
// references are not separate cards. Validate this after every random move.
function conservation(s){
 const all=[...s.td,...s.gd,...s.tx,...s.gx,...Object.values(s.board).map(c=>c.kind==='back'?c.card:c),...s.players.flatMap(p=>[...E.cards(p),...(p.hand?[p.hand]:[])])];
 if(s.pending?.kind==='tribe'&&s.pending.source==='expand')all.push(s.pending.card);
 assert.equal(all.length,64);assert.equal(new Set(all.map(c=>c.id)).size,64);
 for(const p of s.players){assert.ok(p.r.every(n=>Number.isInteger(n)&&n>=0));assert.ok(p.rows.every(r=>r.length<=4));}
}
function mulberry(seed){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
test('200 complete random games: conservation, no negative resources, no deadlocks',()=>{
 for(let game=1;game<=200;game++){
  const rng=mulberry(game),choose=a=>a[Math.floor(rng()*a.length)];let s=E.create(game%2,rng),steps=0;
  while(s.phase!=='end'&&steps++<1600){const p=s.players[s.turn],q=s.pending;let a;
   if(q){switch(q.kind){
    case'tribe':{const pay=E.payments(s,q.card,q.source);if(pay.length&&E.mayBuild(s)&&rng()<.85)a={type:'build',row:choose([0,1,2].filter(i=>p.rows[i].length<4)),payment:Math.floor(rng()*pay.length)};else a={type:'tribe',choice:q.source==='freeHand'?'cancel':!p.hand&&!['noble','freeHand'].includes(q.source)&&rng()<.6?'hold':'discard'};break;}
    case'goods':case'bonusGoods':a={type:'good',resource:choose([0,1,2])};break;
    case'raidGoods':a={type:'good',resource:choose([0,1,2].filter(i=>p.r[i]))};break;
    case'choiceBonus':a={type:'bonus',choice:choose(['goods','gold','vp'])};break;
    case'rearrange':a={type:'rearrange',op:'cancel'};break;
    case'trade':case'silver':{const ex=E.exchanges(s);a=ex.length&&rng()<.6?{type:'exchange',index:Math.floor(rng()*ex.length)}:{type:'finish'};break;}
    case'move':{const from=s.actions[s.turn].filter(i=>E.centers.includes(i)),to=E.moveTargets(s);a=from.length&&to.length?{type:'move',from:choose(from),to:choose(to)}:{type:'finish'};break;}
    default:throw Error('unknown pending '+q.kind);
   }}else if(s.phase==='place')a={type:'place',cell:choose(E.ring.filter(i=>E.legal(s,i)))};
   else if(s.phase==='raid')a={type:'raid',choice:choose(E.raidOptions(s))};
   else if(s.phase==='limit')a={type:'limit',resource:choose([0,1,2].filter(i=>p.r[i]))};
   else if(p.hand&&E.has(p,'freeHand')&&E.payments(s,p.hand,'freeHand').length&&rng()<.3)a={type:'freeHand'};
   else if(s.actions[s.turn].length)a={type:rng()<.1?'skip':'activate',cell:choose(s.actions[s.turn])};
   else a={type:'endTurn'};
   try{s=E.dispatch(s,a);conservation(s);}catch(e){console.error({game,steps,phase:s.phase,pending:q,action:a});throw e;}
  }
  assert.ok(steps<1600,`game ${game} stalled`);assert.ok(s.round<=12);assert.ok(Number.isFinite(E.score(s,0).total));
 }
});
console.log(`\n${passed} test groups passed.`);
