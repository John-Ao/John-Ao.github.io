const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
function fresh(){return E.newGame(()=>0.31);}
function empty(){const s=fresh();s.board=Array(25).fill(null);s.bag=[];s.active=0;return s;}
function card(over={}){return {id:'test',level:1,color:0,bonus:1,points:0,crowns:0,ability:0,cost:[0,0,0,0,0,0],...over};}
function buySetup(c){const s=empty();s.market[0]=[c];s.decks[0]=[];return s;}
test('setup: 67 cards, 25 tokens, 5/4/3 market and second-player privilege',()=>{const s=fresh();assert.equal(E.CARDS.length,67);assert.deepEqual(s.decks.map(d=>d.length),[25,20,10]);assert.deepEqual(s.market.map(d=>d.length),[5,4,3]);assert.equal(s.players[1-s.active].privileges,1);assert(E.invariant(s));});
test('lines: adjacent horizontal/vertical/diagonal; no gaps, gold, wrap, duplicates or L shape',()=>{const b=Array(25).fill(0);for(const a of [[0],[0,1],[1,2,0],[0,5,10],[0,6,12],[4,8,12]])assert(E.validLine(b,a));for(const a of [[],[0,2],[4,5],[0,1,6],[0,0],[0,1,2,3],[-1],[25]])assert(!E.validLine(b,a));b[1]=null;assert(!E.validLine(b,[0,1,2]));b[1]=6;assert(!E.validLine(b,[0,1]));});
test('illegal actions leave original state unchanged',()=>{const s=fresh(),copy=JSON.stringify(s);assert.throws(()=>E.perform(s,{type:'take',indices:[-1]}));assert.equal(JSON.stringify(s),copy);});
test('three identical tokens / two pearls award exactly one privilege',()=>{for(const a of [[0,0,0],[5,5,0]]){let s=empty();s.players.forEach(p=>p.privileges=0);s.board.splice(0,3,...a);s=E.perform(s,{type:'take',indices:[0,1,2]});assert.equal(s.players[1].privileges,1);assert.equal(s.active,1);}});
test('privilege steals from opponent when pool exhausted, capped at three',()=>{let s=empty();s.players[0].privileges=0;s.players[1].privileges=3;s.board.splice(0,3,0,0,0);s=E.perform(s,{type:'take',indices:[0,1,2]});assert.equal(s.players[1].privileges,3);s=buySetup(card({ability:4}));s.players[0].privileges=0;s.players[1].privileges=3;s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.players[0].privileges,1);assert.equal(s.players[1].privileges,2);});
test('privilege optional action, then spiral refill; no privilege after refill',()=>{let s=empty();s.players[0].privileges=2;s.board[12]=0;s.bag=[1,2];s=E.perform(s,{type:'privilege',index:12});assert.equal(s.active,0);assert.equal(s.phase,'action');s=E.perform(s,{type:'refill'},()=>.99);assert.equal(s.board[12],2);assert.equal(s.board[13],1);assert.throws(()=>E.perform(s,{type:'privilege',index:12}));assert.throws(()=>E.perform(s,{type:'refill'}));});
test('reserve requires gold, max three, removes exact gold and replaces card',()=>{let s=fresh();const id=s.market[0][0].id,gold=s.board.indexOf(6),who=s.active;assert.throws(()=>E.perform(s,{type:'reserve',id,gold:s.board.indexOf(0)}));s=E.perform(s,{type:'reserve',id,gold});assert.equal(s.players[who].reserved[0].id,id);assert.equal(s.players[who].tokens[6],1);assert.equal(s.market[0].length,5);assert(E.invariant(s));s.active=who;s.players[who].reserved.push(card(),card());assert.throws(()=>E.perform(s,{type:'reserve',deck:0,gold:s.board.indexOf(6)}));});
test('blind reservation preserves complete deck',()=>{let s=fresh();s=E.perform(s,{type:'reserve',deck:2,gold:s.board.indexOf(6)});assert.equal(s.decks[2].length,9);assert(E.invariant(s));});
test('discount and pearl costs, gold substitutions, exact payment and free purchase',()=>{const p=fresh().players[0];p.cards=[card({bonus:2})];p.tokens=[1,0,0,0,0,0,2];const c=card({cost:[3,0,0,0,0,1]});assert.deepEqual(E.needs(p,c),[1,0,0,0,0,1]);assert.deepEqual(E.payment(p,c),[1,0,0,0,0,0,1]);let s=buySetup(c);s.players[0]=p;s=E.perform(s,{type:'buy',id:'test',payment:[0,0,0,0,0,0,2]});assert.equal(s.players[0].tokens[0],1);assert.equal(s.bag.length,2);let t=buySetup(c);t.players[0]=p;assert.throws(()=>E.perform(t,{type:'buy',id:'test',payment:[1,0,0,0,0,0,2]}));assert.equal(E.perform(buySetup(card()),{type:'buy',id:'test'}).players[0].cards.length,1);});
test('reserved card purchase uses player reserve',()=>{let s=empty();s.players[0].reserved=[card()];s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.players[0].reserved.length,0);assert.equal(s.players[0].cards.length,1);});
test('associate requires existing bonus and assigns its prestige to selected color',()=>{let s=buySetup(card({color:5,points:3,ability:1}));assert.throws(()=>E.perform(s,{type:'buy',id:'test',color:0}));s.players[0].cards=[card({id:'old',color:2})];assert.throws(()=>E.perform(s,{type:'buy',id:'test',color:0}));s=E.perform(s,{type:'buy',id:'test',color:2});assert.equal(E.stats(s.players[0]).colorPoints[2],3);assert.equal(s.active,0);assert.equal(s.turn,2);});
test('matching gem ability requires choosing exact position; skipped if absent',()=>{let s=buySetup(card({ability:3}));s.board[0]=0;s.board[1]=1;s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.phase,'effect');assert.throws(()=>E.perform(s,{type:'effect',index:1}));s=E.perform(s,{type:'effect',index:0});assert.equal(s.players[0].tokens[0],1);assert.equal(s.active,1);assert.equal(E.perform(buySetup(card({ability:3})),{type:'buy',id:'test'}).phase,'action');});
test('steal excludes gold, includes pearl, skips empty opponent',()=>{let s=buySetup(card({ability:5}));s.players[1].tokens[5]=1;s.players[1].tokens[6]=1;s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.phase,'effect');assert.throws(()=>E.perform(s,{type:'effect',color:6}));s=E.perform(s,{type:'effect',color:5});assert.equal(s.players[0].tokens[5],1);assert.equal(s.players[1].tokens[6],1);assert.equal(E.perform(buySetup(card({ability:5})),{type:'buy',id:'test'}).phase,'action');});
test('crossing three/six crowns triggers one royal each, including ability chain',()=>{let s=buySetup(card({crowns:2,ability:1}));s.players[0].cards=[card({id:'old',crowns:2})];s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.phase,'royal');s=E.perform(s,{type:'royal',id:'r2'});assert.equal(s.active,0);assert.equal(s.extra,1);assert.equal(s.players[0].royals.length,1);s.market[0]=[card({id:'next',crowns:2})];s=E.perform(s,{type:'buy',id:'next'});assert.equal(s.phase,'royal');s=E.perform(s,{type:'royal',id:'r4'});assert.equal(s.players[0].royals.length,2);});
test('discard to ten is mandatory before turn change, allows discarding gold',()=>{let s=empty();s.players[0].tokens=[3,3,2,1,0,0,1];s.board[0]=0;s.board[1]=1;s=E.perform(s,{type:'take',indices:[0,1]});assert.equal(s.phase,'discard');assert.equal(s.active,0);assert.throws(()=>E.perform(s,{type:'buy',id:s.market[0][0].id}));s=E.perform(s,{type:'discard',color:6});assert.equal(s.phase,'discard');s=E.perform(s,{type:'discard',color:0});assert.equal(s.active,1);assert.equal(E.total(s.players[0]),10);});
test('three victory conditions; no last response turn; no actions after game ends',()=>{for(const c of [card({points:20,color:6,bonus:0}),card({crowns:10}),card({points:10,color:2})]){let s=buySetup(c);s.players[0].royals=[{points:0},{points:0}];s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.phase,'over');assert.equal(s.winner.player,0);assert.throws(()=>E.perform(s,{type:'refill'}));}});
test('uncolored and royal points are excluded from monochromatic victory',()=>{let s=buySetup(card({points:6,color:6,bonus:0}));s.players[0].cards=[card({id:'old',points:5,color:6,bonus:0})];s.players[0].royals=[{points:3}];s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.winner,null);assert.deepEqual(E.stats(s.players[0]).colorPoints,[0,0,0,0,0]);});
test('seeded automated games preserve all cards/tokens and reach legal victories',()=>{let seed=42;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);for(let game=0;game<20;game++){let s=E.newGame(rng);for(let step=0;step<2200&&!s.winner;step++){const p=s.players[s.active];let a;if(s.phase==='royal')a={type:'royal',id:s.royals[Math.floor(rng()*s.royals.length)].id};else if(s.phase==='discard')a={type:'discard',color:p.tokens.findIndex(n=>n>0)};else if(s.phase==='effect'){const e=s.queue[0];a=e.kind==='gem'?{type:'effect',index:s.board.indexOf(e.color)}:{type:'effect',color:s.players[1-s.active].tokens.findIndex((n,i)=>i<6&&n>0)};}else{const buy=[...s.market.flat(),...p.reserved].filter(c=>E.affordable(p,c));if(buy.length){const c=buy.sort((a,b)=>(b.points+b.crowns*1.5+b.bonus)-(a.points+a.crowns*1.5+a.bonus))[0];a={type:'buy',id:c.id,color:c.color===5?E.stats(p).bonuses.findIndex(n=>n>0):undefined};}else if(!s.refilled&&s.bag.length&&(s.board.filter(c=>c!==null).length<8||rng()<.1))a={type:'refill'};else{const lines=[];for(let i=0;i<25;i++)for(const d of [1,4,5,6])for(let n=1;n<=3;n++){const x=Array.from({length:n},(_,j)=>i+d*j);if(E.validLine(s.board,x))lines.push(x);}if(p.reserved.length<3&&s.board.includes(6)&&(rng()<.13||!lines.length)){const c=s.market.flat()[0];a={type:'reserve',gold:s.board.indexOf(6),id:c.id};}else if(lines.length){lines.sort((a,b)=>b.length-a.length);a={type:'take',indices:lines[Math.floor(rng()*Math.min(lines.length,6))]};}else if(s.bag.length)a={type:'refill'};else throw Error('Unexpected deadlock');}}
 s=E.perform(s,a,rng);assert(E.invariant(s));}
 assert(s.winner,`game ${game} did not finish`);}});

test('verified level-three four-point cards have no crowns',()=>{const cards=E.CARDS.filter(c=>c.level===3&&c.points===4);assert.equal(cards.length,5);assert(cards.every(c=>c.crowns===0));});

test('mandatory refill is detected when board has only gold and reserve is full',()=>{
 let s=fresh();const p=s.players[s.active];
 for(let i=0;i<25;i++)if(s.board[i]!==6){s.bag.push(s.board[i]);s.board[i]=null;}
 p.reserved=s.decks[0].splice(0,3);
 assert(E.invariant(s));const legal=E.legalActions(s);
 assert(legal.forcedRefill);assert(!legal.reserve);assert.deepEqual(legal.take,[]);assert.deepEqual(legal.buy,[]);
 const who=s.active;s=E.perform(s,{type:'refill'});assert.equal(s.active,who);assert(!E.legalActions(s).forcedRefill);assert(E.legalActions(s).take.length);assert(E.invariant(s));
});
test('gold reservation or affordable reserved cards prevent forced refill',()=>{
 let s=empty();s.bag=[0];s.board[0]=6;assert(E.legalActions(s).reserve);assert(!E.legalActions(s).forcedRefill);
 s.board[0]=null;s.players[0].reserved=[card()];assert.deepEqual(E.legalActions(s).buy,['test']);assert(!E.legalActions(s).forcedRefill);
 s.players[0].reserved=[];s.market=[[],[],[]];s.decks=[[],[],[]];s.board[0]=6;assert(!E.legalActions(s).reserve);assert(E.legalActions(s).forcedRefill);
});
test('holding ten tokens does not prohibit taking tokens before end-of-turn discard',()=>{
 let s=empty();s.board[0]=2;s.players[0].tokens=[4,4,2,0,0,0,0];assert.deepEqual(E.legalActions(s).take,[0]);
 s=E.perform(s,{type:'take',indices:[0]});assert.equal(s.phase,'discard');
});
test('multiple privileges may take disconnected tokens without normal take penalties',()=>{
 for(const colors of [[0,0,0],[5,5,1]]){let s=empty();s.players[0].privileges=3;s.players[1].privileges=0;[0,12,24].forEach((i,j)=>s.board[i]=colors[j]);
 s=E.perform(s,{type:'privilege',indices:[0,12,24]});assert.equal(s.players[0].privileges,0);assert.equal(s.players[1].privileges,0);assert.equal(s.active,0);assert.equal(s.phase,'action');assert.equal(E.total(s.players[0]),3);}
});
test('invalid bulk privilege choices are atomic and cannot take gold or spend too many',()=>{
 const s=empty();s.players[0].privileges=2;s.board[0]=0;s.board[12]=5;s.board[24]=6;const before=JSON.stringify(s);
 for(const indices of [[],[0,0],[0,12,24],[24],[0,1],[-1]])assert.throws(()=>E.perform(s,{type:'privilege',indices}));assert.equal(JSON.stringify(s),before);
});
test('excess gained through privileges is discarded only after the mandatory action',()=>{
 let s=buySetup(card({cost:[2,0,0,0,0,0]}));s.players[0].privileges=2;s.players[0].tokens=[2,2,2,2,2,0,0];s.board[0]=0;s.board[24]=0;
 s=E.perform(s,{type:'privilege',indices:[0,24]});assert.equal(E.total(s.players[0]),12);assert.equal(s.phase,'action');
 s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.phase,'action');assert.equal(s.active,1);assert.equal(E.total(s.players[0]),10);
});
test('exhausted decks leave gaps: both purchase and reservation remove cards without replacement',()=>{
 for(const type of ['buy','reserve']){let s=buySetup(card());s.board[0]=6;s=E.perform(s,{type,id:'test',gold:0});assert.equal(s.market[0].length,0);assert.equal(s.decks[0].length,0);}
 const s=empty();s.decks=[[],[],[]];s.board[0]=6;assert.throws(()=>E.perform(s,{type:'reserve',deck:0,gold:0}));
});
test('associate on a double-bonus card adds one and does not repeat its ability',()=>{
 let s=buySetup(card({color:5,ability:2,points:1}));s.players[0].cards=[card({id:'old',color:1,bonus:2,ability:4})];s.players[0].privileges=0;
 s=E.perform(s,{type:'buy',id:'test',color:1});assert.equal(E.stats(s.players[0]).bonuses[1],3);assert.equal(s.players[0].privileges,0);
});
test('extra turn restores optional actions and can chain another extra turn',()=>{
 let s=buySetup(card({ability:1}));s.refilled=true;s.players[0].privileges=1;s.board[0]=0;s.bag=[1];
 s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.active,0);assert.equal(s.refilled,false);
 s=E.perform(s,{type:'privilege',index:0});s=E.perform(s,{type:'refill'});s.market[0]=[card({id:'again',ability:1})];
 s=E.perform(s,{type:'buy',id:'again'});assert.equal(s.active,0);assert.equal(s.turn,3);assert.equal(s.refilled,false);
});
test('royal steal resolves before discard; JSON save/resume preserves the pending choice',()=>{
 let s=buySetup(card({crowns:1}));s.players[0].cards=[card({id:'old',crowns:2})];s.players[0].tokens=[4,4,2,0,0,0,0];s.players[1].tokens[5]=1;
 s=E.perform(s,{type:'buy',id:'test'});s=JSON.parse(JSON.stringify(s));assert.equal(s.phase,'royal');
 s=E.perform(s,{type:'royal',id:'r1'});s=JSON.parse(JSON.stringify(s));assert.equal(s.phase,'effect');
 s=E.perform(s,{type:'effect',color:5});s=JSON.parse(JSON.stringify(s));assert.equal(s.phase,'discard');
 s=E.perform(s,{type:'discard',color:0});assert.equal(s.active,1);assert.equal(s.players[0].royals.length,1);
});
test('victory waits for abilities and discards, then reports all completed victory tracks',()=>{
 let s=buySetup(card({points:10,color:2,ability:5}));s.players[0].cards=[card({id:'old',points:10,color:1,crowns:10})];s.players[0].royals=[{points:0},{points:0}];s.players[0].tokens=[4,4,2,0,0,0,0];s.players[1].tokens[5]=1;
 s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.winner,null);assert.equal(s.phase,'effect');
 s=E.perform(s,{type:'effect',color:5});assert.equal(s.winner,null);assert.equal(s.phase,'discard');
 s=E.perform(s,{type:'discard',color:5});assert.equal(s.phase,'over');assert.equal(s.winner.reasons.length,4);assert.equal(s.active,0);
});
test('unbought reserves have no bonuses, prestige, crowns or end-game penalty',()=>{
 let s=buySetup(card({points:20,color:6,bonus:0}));s.players[0].reserved=[card({id:'held',points:10,crowns:10,bonus:2})];
 assert.deepEqual(E.stats(s.players[0]),{bonuses:[0,0,0,0,0,0],colorPoints:[0,0,0,0,0],points:0,crowns:0});
 s=E.perform(s,{type:'buy',id:'test'});assert.equal(s.winner.player,0);assert.equal(E.stats(s.players[0]).points,20);
});
test('refill skips occupied spiral positions and leaves every existing token in place',()=>{
 let s=empty();s.board[12]=6;s.board[18]=4;s.bag=[0,1,2];s=E.perform(s,{type:'refill'},()=>.99);
 assert.equal(s.board[12],6);assert.equal(s.board[18],4);assert.equal(s.board[13],2);assert.equal(s.board[17],1);assert.equal(s.board[16],0);assert.equal(s.bag.length,0);
});
