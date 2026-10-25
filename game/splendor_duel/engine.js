(function(root){
'use strict';
const CARDS=typeof module!=='undefined'&&module.exports?require('./cards.js'):root.DUEL_CARDS;
const COLORS=['蓝','白','绿','黑','红','珍珠','黄金'];
const SPIRAL=[12,13,18,17,16,11,6,7,8,9,14,19,24,23,22,21,20,15,10,5,0,1,2,3,4];
const clone=x=>JSON.parse(JSON.stringify(x));
function shuffle(a,rng=Math.random){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function player(){return {tokens:Array(7).fill(0),cards:[],reserved:[],royals:[],privileges:0};}
function newGame(rng=Math.random){
 const s={version:1,players:[player(),player()],active:Math.floor(rng()*2),turn:1,phase:'action',refilled:false,extra:0,queue:[],board:Array(25).fill(null),bag:[],market:[],decks:[],royals:[{id:'r1',points:2,ability:5},{id:'r2',points:2,ability:1},{id:'r3',points:2,ability:4},{id:'r4',points:3,ability:0}],log:[],winner:null};
 s.players[1-s.active].privileges=1;
 for(let l=1;l<=3;l++){let d=shuffle(clone(CARDS.filter(c=>c.level===l)),rng);s.market.push(d.splice(0,6-l));s.decks.push(d);}
 s.bag=shuffle([0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,6,6,6],rng);
 SPIRAL.forEach(i=>s.board[i]=s.bag.pop());
 log(s,`玩家 ${s.active+1} 先手；玩家 ${2-s.active} 获得 1 个特权`);return s;
}
function stats(p){const bonuses=Array(6).fill(0),colorPoints=Array(5).fill(0);let points=0,crowns=0;for(const c of p.cards){if(c.color<5){bonuses[c.color]+=c.bonus;colorPoints[c.color]+=c.points;}points+=c.points;crowns+=c.crowns;}points+=p.royals.reduce((n,c)=>n+c.points,0);return {bonuses,colorPoints,points,crowns};}
function total(p){return p.tokens.reduce((a,b)=>a+b,0);}
function needs(p,c){const b=stats(p).bonuses;return c.cost.map((n,i)=>Math.max(0,n-b[i]));}
function payment(p,c){const need=needs(p,c),pay=Array(7).fill(0);need.forEach((n,i)=>{pay[i]=Math.min(n,p.tokens[i]);pay[6]+=n-pay[i];});return pay;}
function affordable(p,c){return !(c.color===5&&!p.cards.some(x=>x.bonus>0&&x.color<5))&&payment(p,c)[6]<=p.tokens[6];}
// All mandatory action availability comes from the same rules as execution.
function legalActions(s){
 const p=s.players[s.active],active=s.phase==='action'&&!s.winner;
 const take=active?s.board.flatMap((c,i)=>c!==null&&c!==6?[i]:[]):[];
 const buy=active?[...s.market.flat(),...p.reserved].filter(c=>affordable(p,c)).map(c=>c.id):[];
 const gold=active&&p.reserved.length<3?s.board.flatMap((c,i)=>c===6?[i]:[]):[];
 const reserveCards=gold.length?s.market.flat().map(c=>c.id):[];
 const reserveDecks=gold.length?s.decks.flatMap((d,i)=>d.length?[i]:[]):[];
 const reserve=gold.length>0&&(reserveCards.length>0||reserveDecks.length>0);
 const refill=active&&!s.refilled&&s.bag.length>0;
 return {take,buy,gold,reserveCards,reserveDecks,reserve,refill,
  forcedRefill:refill&&!take.length&&!buy.length&&!reserve};
}
function victory(p){const st=stats(p),reasons=[];if(st.points>=20)reasons.push('达到 20 声望');if(st.crowns>=10)reasons.push('达到 10 王冠');st.colorPoints.forEach((n,i)=>{if(n>=10)reasons.push(COLORS[i]+'色达到 10 声望');});return reasons;}
function validLine(board,indices){
 if(!Array.isArray(indices)||indices.length<1||indices.length>3||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>24||board[i]===null||board[i]===6))return false;
 if(indices.length===1)return true;
 const a=[...indices].sort((a,b)=>a-b),dx=a[1]%5-a[0]%5,dy=Math.floor(a[1]/5)-Math.floor(a[0]/5);
 if(Math.abs(dx)>1||Math.abs(dy)>1||(!dx&&!dy))return false;
 return a.every((n,k)=>n%5===a[0]%5+dx*k&&Math.floor(n/5)===Math.floor(a[0]/5)+dy*k);
}
function log(s,msg){s.log.unshift(`第 ${s.turn} 回合 · ${msg}`);s.log=s.log.slice(0,40);}
function privilege(s,who){const p=s.players[who],o=s.players[1-who];if(p.privileges===3)return;if(p.privileges+o.privileges===3)o.privileges--;p.privileges++;}
function getCard(s,id){for(let l=0;l<3;l++){const index=s.market[l].findIndex(c=>c.id===id);if(index>=0)return {card:s.market[l][index],zone:'market',l,index};}const index=s.players[s.active].reserved.findIndex(c=>c.id===id);return index<0?null:{card:s.players[s.active].reserved[index],zone:'reserved',index};}
function removeCard(s,loc){if(loc.zone==='reserved')s.players[s.active].reserved.splice(loc.index,1);else {if(s.decks[loc.l].length)s.market[loc.l][loc.index]=s.decks[loc.l].pop();else s.market[loc.l].splice(loc.index,1);}}
function check(ok,msg){if(!ok)throw Error(msg);}
function takeAt(s,i){const p=s.players[s.active];check(Number.isInteger(i)&&i>=0&&i<25&&s.board[i]!==null,'请选择棋盘上的宝石');p.tokens[s.board[i]]++;s.board[i]=null;}
function effect(s,ability,color){if(ability===1)s.extra++;if(ability===3)s.queue.push({kind:'gem',color});if(ability===4)privilege(s,s.active);if(ability===5)s.queue.push({kind:'steal'});}
function resolve(s){
 const p=s.players[s.active],o=s.players[1-s.active];
 while(s.queue.length){const e=s.queue[0];if(e.kind==='gem'&&!s.board.includes(e.color)){log(s,'棋盘没有同色宝石，略过取宝石能力');s.queue.shift();continue;}if(e.kind==='steal'&&!o.tokens.slice(0,6).some(Boolean)){log(s,'对手没有非黄金宝石，略过拿取能力');s.queue.shift();continue;}s.phase='effect';return;}
 const st=stats(p),due=Number(st.crowns>=3)+Number(st.crowns>=6);
 if(p.royals.length<due&&s.royals.length){s.phase='royal';return;}
 if(total(p)>10){s.phase='discard';return;}
 const reasons=victory(p),reason=reasons.join('；');
 if(reasons.length){s.winner={player:s.active,reason,reasons};s.phase='over';log(s,`玩家 ${s.active+1} 获胜：${reason}`);return;}
 const again=s.extra>0;if(again)s.extra--;else s.active=1-s.active;
 s.turn++;s.phase='action';s.refilled=false;log(s,`玩家 ${s.active+1} ${again?'获得额外回合':'开始回合'}`);
}
function perform(state,a,rng=Math.random){
 const s=clone(state),p=s.players[s.active],o=s.players[1-s.active];check(!s.winner,'对局已经结束');
 if(a.type==='privilege'){
 check(s.phase==='action'&&!s.refilled,'特权须在补充棋盘之前使用');
 const indices=a.indices===undefined?[a.index]:a.indices;
 check(Array.isArray(indices)&&indices.length>0&&indices.length<=p.privileges,'每枚宝石需要一个特权');
 check(new Set(indices).size===indices.length,'不能重复选择同一枚宝石');
 check(indices.every(i=>Number.isInteger(i)&&i>=0&&i<25&&s.board[i]!==null&&s.board[i]!==6),'特权只能拿取棋盘上的非黄金宝石');
 const colors=indices.map(i=>COLORS[s.board[i]]);indices.forEach(i=>takeAt(s,i));p.privileges-=indices.length;
 log(s,`玩家 ${s.active+1} 使用 ${indices.length} 个特权，拿取 ${colors.join('、')}`);
 }else if(a.type==='refill'){
 check(s.phase==='action'&&!s.refilled,'本回合不能再次补充');check(s.bag.length>0,'袋中没有宝石');shuffle(s.bag,rng);for(const i of SPIRAL)if(s.board[i]===null&&s.bag.length)s.board[i]=s.bag.pop();privilege(s,1-s.active);s.refilled=true;log(s,'补充棋盘，对手获得 1 个特权');
 }else if(a.type==='take'){
 check(s.phase==='action','请先完成当前步骤');check(validLine(s.board,a.indices),'选择 1–3 枚连续直线上的非黄金宝石');const cs=a.indices.map(i=>s.board[i]);a.indices.forEach(i=>takeAt(s,i));if((cs.length===3&&cs.every(c=>c===cs[0]))||cs.filter(c=>c===5).length===2)privilege(s,1-s.active);log(s,`玩家 ${s.active+1} 拿取 ${cs.map(c=>COLORS[c]).join('、')}`);resolve(s);
 }else if(a.type==='reserve'){
 check(s.phase==='action','请先完成当前步骤');check(p.reserved.length<3,'最多预留 3 张牌');check(s.board[a.gold]===6,'必须选择一枚棋盘上的黄金');
 let loc=null,c;if(a.deck!==undefined){check(Number.isInteger(a.deck)&&a.deck>=0&&a.deck<3&&s.decks[a.deck].length,'该牌堆已空');c=s.decks[a.deck].pop();}else{loc=getCard(s,a.id);check(loc&&loc.zone==='market','只能预留展示区或牌堆中的牌');c=loc.card;removeCard(s,loc);}
 takeAt(s,a.gold);p.reserved.push(c);log(s,`玩家 ${s.active+1} 获得黄金并预留一张 ${c.level} 级牌`);resolve(s);
 }else if(a.type==='buy'){
 check(s.phase==='action','请先完成当前步骤');const loc=getCard(s,a.id);check(loc,'找不到该牌');const c=clone(loc.card);check(affordable(p,c),'宝石不足，或尚无可叠加的颜色');
 if(c.color===5){check(Number.isInteger(a.color)&&a.color>=0&&a.color<5&&stats(p).bonuses[a.color]>0,'选择一个已经拥有的加成颜色');c.color=a.color;}
 const need=needs(p,c),pay=a.payment||payment(p,c);check(Array.isArray(pay)&&pay.length===7&&pay.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=p.tokens[i]),'支付数量无效');check(need.every((n,i)=>pay[i]<=n)&&pay[6]===need.reduce((n,v,i)=>n+v-pay[i],0),'黄金必须恰好补足剩余费用');
 pay.forEach((n,i)=>{p.tokens[i]-=n;for(let j=0;j<n;j++)s.bag.push(i);});removeCard(s,loc);p.cards.push(c);log(s,`玩家 ${s.active+1} 购买 ${c.color<5?COLORS[c.color]:'无色'}牌（${c.points} 声望）`);effect(s,c.ability,c.color);resolve(s);
 }else if(a.type==='effect'){
 check(s.phase==='effect','没有待结算能力');const e=s.queue[0];if(e.kind==='gem'){check(s.board[a.index]===e.color,'请选择该牌同色的棋盘宝石');takeAt(s,a.index);log(s,`能力：拿取一枚${COLORS[e.color]}宝石`);}else{check(Number.isInteger(a.color)&&a.color>=0&&a.color<6&&o.tokens[a.color]>0,'请选择对手的非黄金宝石');o.tokens[a.color]--;p.tokens[a.color]++;log(s,`能力：从对手处拿取一枚${COLORS[a.color]}宝石`);}s.queue.shift();resolve(s);
 }else if(a.type==='royal'){
 check(s.phase==='royal','尚未触发皇室奖励');const i=s.royals.findIndex(c=>c.id===a.id);check(i>=0,'请选择可用皇室牌');const c=s.royals.splice(i,1)[0];p.royals.push(c);log(s,`玩家 ${s.active+1} 获得皇室牌（${c.points} 声望）`);effect(s,c.ability);resolve(s);
 }else if(a.type==='discard'){
 check(s.phase==='discard','无需弃回宝石');check(Number.isInteger(a.color)&&a.color>=0&&a.color<7&&p.tokens[a.color]>0,'请选择持有的宝石');p.tokens[a.color]--;s.bag.push(a.color);log(s,`玩家 ${s.active+1} 弃回一枚${COLORS[a.color]}宝石`);resolve(s);
 }else throw Error('未知操作');return s;
}
function invariant(s){const tokens=Array(7).fill(0);s.board.filter(c=>c!==null).forEach(c=>tokens[c]++);s.bag.forEach(c=>tokens[c]++);s.players.forEach(p=>p.tokens.forEach((n,i)=>tokens[i]+=n));check(JSON.stringify(tokens)==='[4,4,4,4,4,2,3]','宝石守恒失败');const cards=[...s.decks.flat(),...s.market.flat(),...s.players.flatMap(p=>[...p.cards,...p.reserved])];check(cards.length===67&&new Set(cards.map(c=>c.id)).size===67,'牌库守恒失败');check(s.players.every(p=>p.privileges>=0&&p.reserved.length<=3)&&s.players.reduce((n,p)=>n+p.privileges,0)<=3,'特权或预留数量无效');return true;}
const api={CARDS,COLORS,SPIRAL,newGame,stats,total,needs,payment,affordable,legalActions,victory,validLine,perform,invariant,getCard};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Duel=api;
})(globalThis);
