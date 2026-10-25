const assert=require('node:assert/strict');const J=require('./engine.js');
const fresh=()=>{let s=J.round([0,0],0);s.players[0].hand=['gold','gold','cloth','cloth','cloth'];s.players[0].camels=3;s.market=['diamond','silver','leather','camel','camel'];return s;};
let s=J.round();assert.equal(s.deck.length,40);assert.equal(s.market.length,5);assert.equal(s.deck.length+s.market.length+s.players.reduce((n,p)=>n+p.hand.length+p.camels,0),55);
assert.throws(()=>J.act(fresh(),{type:'sell',hand:[0]}),/至少/);
assert.throws(()=>J.act(fresh(),{type:'sell',hand:[0,2]}),/一种/);
s=J.act(fresh(),{type:'sell',hand:[0,1]});assert.deepEqual(s.players[0].goods,[6,6]);assert.equal(s.turn,1);
s=J.act(fresh(),{type:'sell',hand:[2,3,4]});assert.equal(s.players[0].bonus.length,1);assert.equal(s.players[0].goods.reduce((a,b)=>a+b),11);
assert.throws(()=>J.act(fresh(),{type:'exchange',market:[0],camels:1}),/至少/);
s=fresh();s.market[0]='cloth';assert.throws(()=>J.act(s,{type:'exchange',market:[0,1],hand:[2],camels:1}),/同一种/);
s=J.act(fresh(),{type:'exchange',market:[0,1],hand:[0],camels:1});assert.equal(s.market.length,5);assert.equal(s.players[0].hand.length,6);assert.equal(s.players[0].camels,2);
s=fresh();s.players[0].hand=Array(7).fill('cloth');assert.throws(()=>J.act(s,{type:'take',market:[0]}),/已满/);assert.throws(()=>J.act(s,{type:'exchange',market:[0,1],camels:2}),/超过/);
s=J.act(fresh(),{type:'camels'});assert.equal(s.players[0].camels,5);assert.equal(s.market.length,5);
s=fresh();s.deck=['spice'];s=J.act(s,{type:'take',market:[0]});assert.equal(s.deck.length,0);assert.equal(s.ended,false);s=J.act(s,{type:'camels'});assert.equal(s.ended,true);
s=fresh();s.tokens.gold=[];s.tokens.silver=[];s.tokens.cloth=[1];s=J.act(s,{type:'sell',hand:[2,3,4]});assert.equal(s.ended,true);assert.equal(s.players[0].bonus.length,1);
s=fresh();s.tokens.gold=[];s.tokens.silver=[];s.tokens.cloth=[1];s.players[0].goods=[];s.players[1].goods=[1];s.players[0].camels=s.players[1].camels=0;s=J.act(s,{type:'sell',hand:[2]});assert.equal(s.result.winner,-1);
// Public accounting tracks tokens actually received, including exhausted piles.
s=fresh();s.tokens.cloth=[2];s=J.act(s,{type:'sell',hand:[2,3,4]});
assert.equal(s.players[0].publicStats.goodsScore,2);
assert.equal(s.players[0].publicStats.goodsCounts.cloth,1);
assert.equal(s.players[0].publicStats.bonusCounts[3],1);
assert.deepEqual(J.estimateScore(s.players[0].publicStats),{low:3,high:5,mean:4});
const publicEstimate=J.estimateScore(s.players[0].publicStats);
s.players[0].bonus=[999];s.players[0].camels=99;
assert.deepEqual(J.estimateScore(s.players[0].publicStats),publicEstimate);
s=fresh();s.bonuses[3]=[];s=J.act(s,{type:'sell',hand:[2,3,4]});
assert.equal(s.players[0].publicStats.bonusCounts[3],0);
// Random legal games: card conservation, hand limits, market size and eventual completion.
for(let run=0;run<100;run++){s=J.round();for(let turn=0;!s.ended&&turn<600;turn++){const p=s.players[s.turn],actions=[{type:'camels'},...s.market.map((_,i)=>({type:'take',market:[i]})),...J.TYPES.map(t=>({type:'sell',hand:p.hand.flatMap((x,i)=>x===t?[i]:[])}))];let valid=[];for(const a of actions){try{valid.push(J.act(s,a));}catch{}}assert.ok(valid.length);s=valid[Math.floor(Math.random()*valid.length)];assert.ok(s.players.every(p=>p.hand.length<=7));assert.equal(s.deck.length+s.market.length+s.discard.length+s.players.reduce((n,p)=>n+p.hand.length+p.camels,0),55);}assert.ok(s.ended);}
console.log('Passed: setup, selling, exchange, limits, endings, tie and 100 simulated rounds.');
