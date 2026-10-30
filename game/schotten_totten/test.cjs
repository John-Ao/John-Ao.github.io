'use strict';
const assert=require('node:assert/strict'),G=require('./game.js');
let seed=20261020;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const c=(color,n)=>({id:color*9+n-1,c:color,n});
const tac=type=>G.tactics().find(c=>c.type===type);
let tests=0;function test(name,fn){fn();tests++;console.log('✓ '+name);}
function fixture(options={tactics:true}){return G.create(options);}
function give(s,card,p=0){s.hands[p]=[card];s.player=p;s.phase='play';}
function put(s,i,p,cards,time=1){s.stones[i].cards[p]=cards;s.stones[i].done[p]=cards.length===G.capacity(s.stones[i])?time:null;}
function conservation(s){const cards=[...s.deck,...s.tactics,...s.hands.flat(),...s.discard,...s.stones.flatMap(t=>[...t.cards.flat(),...t.modes])];assert.equal(cards.length,s.options.tactics?64:54);assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);}
test('全部牌组与基础/战术起手数量',()=>{for(const tactics of [false,true]){const s=G.create({tactics});assert.equal(s.hands[0].length,tactics?7:6);conservation(s);}assert.equal(G.tactics().filter(c=>c.type==='joker').length,2);});
test('三张与四张的五档牌型、顺子不循环',()=>{for(const size of [3,4]){assert.equal(G.rank(Array.from({length:size},(_,i)=>c(0,i+3)))[0],5);assert.equal(G.rank(Array.from({length:size},(_,i)=>c(i,5)))[0],4);assert.equal(G.rank(Array.from({length:size},(_,i)=>c(0,i*2+1)))[0],3);assert.equal(G.rank(Array.from({length:size},(_,i)=>c(i,i+3)))[0],2);}assert.equal(G.rank([c(0,9),c(1,1),c(2,2)])[0],1);});
test('提前占领和先完成者赢得平手',()=>{const s=fixture();put(s,0,0,[c(0,7),c(0,8),c(0,9)]);assert(G.claimable(s,0,0));put(s,0,0,[c(0,1),c(1,4),c(2,8)]);assert(!G.claimable(s,0,0));put(s,0,0,[c(0,3),c(0,4),c(0,5)],2);put(s,0,1,[c(1,3),c(1,4),c(1,5)],1);assert(!G.claimable(s,0,0));assert(G.claimable(s,0,1));});
test('公开弃牌可用于证明，隐藏手牌不能用于证明',()=>{const s=fixture();put(s,0,0,[c(1,5),c(1,6),c(1,7)]);put(s,0,1,[c(0,7),c(0,8)]);s.hands[0]=[c(0,9)];assert(!G.claimable(s,0,0));s.discard=[c(0,6),c(0,9)];assert(G.claimable(s,0,0));});
test('百变者、间谍、盾卫自动赋值；可以重复普通牌属性',()=>{assert.deepEqual(G.best([c(0,7),c(0,8),tac('joker')],3).score,[5,24]);assert.deepEqual(G.best([c(3,5),c(3,6),tac('spy')],3).score,[5,18]);assert.deepEqual(G.best([c(4,4),c(4,5),tac('shield')],3).score,[5,12]);assert.deepEqual(G.best([c(0,7),c(1,7),tac('spy')],3).score,[4,21]);});
test('每回合一张、战术累计至多领先一张、每人一张百变者',()=>{let s=fixture();give(s,tac('joker'));assert(G.play(s,54,0));assert(!G.play(s,54,0));give(s,tac('spy'));assert(!G.play(s,tac('spy').id,1));s.used[1]=1;assert(G.play(s,tac('spy').id,1));s.used[1]=2;give(s,G.tactics()[1]);assert(!G.play(s,55,2));});
test('迷雾只计总和；泥战要求四张并重置完成时刻',()=>{const s=fixture();put(s,0,0,[c(0,1),c(0,2),c(0,3)]);put(s,0,1,[c(1,7),c(2,8),c(3,9)],2);assert(G.claimable(s,0,0));give(s,tac('fog'));assert(G.play(s,tac('fog').id,0));assert(G.claimable(s,0,1));s.used[1]=1;give(s,tac('mud'));assert(G.play(s,tac('mud').id,0));assert.equal(G.capacity(s.stones[0]),4);assert.deepEqual(s.stones[0].done,[null,null]);assert(!G.claimable(s,0,1));give(s,c(4,8),1);assert(G.play(s,c(4,8).id,0));assert.notEqual(s.stones[0].done[1],null);});
test('调度者移动/弃置精锐牌，不能移动到原界石或操作已占领牌',()=>{const s=fixture();put(s,0,0,[c(0,1),c(1,2),tac('spy')]);give(s,tac('strategist'));assert(!G.play(s,tac('strategist').id,0,{from:0,card:tac('spy').id}));assert(G.play(s,tac('strategist').id,1,{from:0,card:tac('spy').id}));assert.equal(s.stones[0].done[0],null);assert.equal(s.stones[1].cards[0][0].type,'spy');s.used[1]=1;give(s,tac('strategist'));assert(G.play(s,tac('strategist').id,-1,{from:1,card:tac('spy').id,discard:true}));assert(s.discard.some(c=>c.type==='spy'));});
test('女妖弃置对方精锐；叛徒只转移普通牌且可以转至同一界石己方',()=>{const s=fixture();put(s,0,1,[c(0,9),tac('spy')]);give(s,tac('traitor'));assert(!G.play(s,tac('traitor').id,0,{from:0,card:tac('spy').id}));assert(G.play(s,tac('traitor').id,0,{from:0,card:c(0,9).id}));s.used[1]=1;give(s,tac('banshee'));assert(G.play(s,tac('banshee').id,-1,{from:0,card:tac('spy').id}));assert.equal(s.stones[0].cards[1].length,0);assert(s.discard.some(c=>c.type==='spy'));});
test('招募者混合抽牌、退回顺序、常规补牌不超手牌上限',()=>{const s=fixture(),r=tac('recruiter');const at=s.tactics.findIndex(c=>c.id===r.id);s.tactics.splice(at,1);s.deck.push(s.hands[0].pop());s.hands[0].push(r);assert(G.play(s,r.id,-1));assert.equal(s.phase,'recruitDraw');assert(G.recruitDraw(s,'deck'));assert(G.recruitDraw(s,'tactics'));assert(G.recruitDraw(s,'deck'));assert.equal(s.phase,'recruitReturn');const a=s.hands[0].find(c=>!c.type).id;assert(G.recruitReturn(s,a));const b=s.hands[0].find(c=>!c.type).id;assert(G.recruitReturn(s,b));assert.equal(s.deck[0].id,b);assert.equal(s.deck[1].id,a);assert.equal(s.hands[0].length,7);const remaining=s.deck.length;assert(G.end(s));assert.equal(s.deck.length,remaining);conservation(s);});
test('招募者牌堆不足时抽完剩余，再退两张',()=>{const s=fixture();give(s,tac('recruiter'));s.hands[0].push(c(0,1),c(0,2));s.deck=[c(0,3)];s.tactics=[];assert(G.play(s,tac('recruiter').id,-1));assert(G.recruitDraw(s,'deck'));assert.equal(s.phase,'recruitReturn');assert(G.recruitReturn(s,c(0,1).id));assert(G.recruitReturn(s,c(0,2).id));assert.equal(s.phase,'claim');});
test('专家只在回合开始占领；常规只在出牌后占领',()=>{for(const expert of [true,false]){const s=fixture({expert});put(s,0,0,[c(0,7),c(0,8),c(0,9)]);assert.equal(G.claim(s,0),expert);if(expert){assert(G.beginPlay(s));assert(!G.claim(s,1));}assert(G.play(s,s.hands[0][0].id,1));assert.equal(s.phase,expert?'draw':'claim');if(!expert)assert(G.claim(s,0));assert(G.end(s));assert.equal(s.phase,expert?'preclaim':'play');}});
test('无合法氏族牌可跳过，有合法牌不能跳过；跳过不补牌',()=>{const s=fixture();assert(!G.pass(s));give(s,tac('spy'));assert(G.pass(s));const n=s.deck.length;assert(G.end(s));assert.equal(s.deck.length,n);});
test('空牌堆、选择补战术、禁止满员或已占领界石',()=>{const s=fixture();assert(G.play(s,s.hands[0][0].id,0));const n=s.tactics.length;assert(G.end(s,'tactics'));assert.equal(s.tactics.length,n-1);assert(s.hands[0].at(-1).type);s.stones[1].owner=0;assert(!G.play(s,s.hands[1][0].id,1));s.deck=[];s.tactics=[];assert(G.play(s,s.hands[1][0].id,2));assert(G.end(s));});
test('三连/五块获胜立即计分，多局保留积分',()=>{const s=fixture({rounds:2});s.stones[0].owner=0;s.stones[1].owner=0;s.stones[7].owner=1;put(s,2,0,[c(0,7),c(0,8),c(0,9)]);s.phase='claim';assert(G.claim(s,2));assert.equal(s.winner,0);assert.deepEqual(s.scores,[5,1]);assert(!G.end(s));const next=G.nextRound(s,1);assert.equal(next.round,2);assert.equal(next.player,1);assert.deepEqual(next.scores,[5,1]);next.stones.forEach((t,i)=>{if(i%2===0)t.owner=1;});assert(G.winner(next,1));});
test('僵局需双方确认、不加分、不重复结算、可继续下一局',()=>{const s=G.create({tactics:true,rounds:2});assert(!G.stalemate(s));assert(!G.agreeDraw(s));s.hands=[[],[]];s.deck=[];s.tactics=[];assert(G.stalemate(s));assert(G.pass(s));assert(G.end(s));assert(!s.stalled);assert(G.pass(s));assert(G.end(s));assert(s.stalled);assert(G.agreeDraw(s));assert(!G.agreeDraw(s));assert.deepEqual(s.scores,[0,0]);assert(!G.pass(s));assert(G.nextRound(s,0));});
// Cross-check optimized formation search against exhaustive natural completions.
test('优化阵型搜索与穷举对照（含精锐、泥战、迷雾）',()=>{for(let z=0;z<120;z++){const size=z%2?3:4,all=G.deck().sort(()=>Math.random()-.5),base=all.slice(0,size-1),pool=all.slice(size, size+6),fog=z%5===0;if(z%3===0)base[0]=tac('shield');if(z%7===0)base[0]=tac('spy');if(z%11===0)base[0]=tac('joker');let score=null;for(const add of pool){const full=[...base,add];function visit(i,res){if(i===full.length){const r=G.rank(res,fog);if(!score||r[0]>score[0]||(r[0]===score[0]&&r[1]>score[1]))score=r;return;}const card=full[i];if(!card.type)visit(i+1,[...res,card]);else for(let color=0;color<6;color++)for(let n=1;n<=9;n++)if(card.type==='joker'||(card.type==='spy'&&n===7)||(card.type==='shield'&&n<=3))visit(i+1,[...res,{...card,c:color,n}]);}visit(0,[]);}assert.deepEqual(G.best(base,size,pool,fog).score,score);}});
test('50 局基础版完整对战与牌数守恒',()=>{for(let n=0;n<50;n++){const s=G.create({expert:n%2===1});let count=0;while(s.winner===null&&count++<150){if(s.phase==='preclaim'){for(let i=0;i<9&&s.winner===null;i++)G.claim(s,i);if(s.winner!==null)break;G.beginPlay(s);}if(G.canPlay(s,s.player)){const choices=s.stones.map((t,i)=>({t,i})).filter(({t})=>t.owner===null&&t.cards[s.player].length<G.capacity(t));assert(G.play(s,s.hands[s.player][0].id,choices[Math.floor(Math.random()*choices.length)].i));}else assert(G.pass(s));for(let i=0;i<9&&s.winner===null;i++)G.claim(s,i);if(s.winner===null)assert(G.end(s));conservation(s);}assert.notEqual(s.winner,null,'game must finish');}});
test('40 局战术版/专家版对战，覆盖全部战术及合法僵局处理',()=>{
 const seen=new Set();for(let game=0;game<40;game++){
  const s=G.create({tactics:true,expert:game%2===0});let turns=0;
  while(s.winner===null&&turns++<180){
   if(s.phase==='preclaim'){for(let i=0;i<9&&s.winner===null;i++)G.claim(s,i);if(s.winner!==null)break;G.beginPlay(s);}
   let played=false;
   const hand=[...s.hands[s.player]].sort((a,b)=>Number(!!b.type)-Number(!!a.type));
   for(const card of hand){
    if(['strategist','banshee','traitor'].includes(card.type)){
     const side=card.type==='strategist'?s.player:1-s.player;
     outer:for(let from=0;from<9;from++)for(const target of [...s.stones[from].cards[side]])for(let dest=-1;dest<9;dest++){
      if(G.play(s,card.id,dest,{from,card:target.id,discard:dest===-1})){played=true;break outer;}
     }
    }else{for(let i=-1;i<9;i++)if(G.play(s,card.id,i)){played=true;break;}}
    if(played){if(card.type)seen.add(card.type);break;}
   }
   if(!played)assert(G.pass(s));
   while(s.phase==='recruitDraw')assert(G.recruitDraw(s,s.tactics.length?'tactics':'deck'));
   while(s.phase==='recruitReturn')assert(G.recruitReturn(s,s.hands[s.player][0].id));
   for(let i=0;i<9&&s.winner===null;i++)G.claim(s,i);
   if(s.winner===null)assert(G.end(s,s.tactics.length?'tactics':'deck'));
   if(s.stalled){assert(G.stalemate(s));assert(G.agreeDraw(s));conservation(s);break;}
   conservation(s);
  }
  assert(G.finished(s),'tactical game must finish or reach an agreed stalemate');
 }
 assert.equal(seen.size,9);
});
console.log(`All ${tests} suites passed.`);
