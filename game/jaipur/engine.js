(function(root){
'use strict';
const TYPES=['diamond','gold','silver','cloth','spice','leather'];
const NAMES={diamond:'钻石',gold:'黄金',silver:'白银',cloth:'布料',spice:'香料',leather:'皮革',camel:'骆驼'};
function describeCards(cards){return [...TYPES,'camel'].flatMap(t=>{const n=cards.filter(c=>c===t).length;return n?[`${n} 张${NAMES[t]}`]:[];}).join('、');}
const VALUES={diamond:[7,7,5,5,5],gold:[6,6,5,5,5],silver:[5,5,5,5,5],cloth:[5,3,3,2,2,1,1],spice:[5,3,3,2,2,1,1],leather:[4,3,2,1,1,1,1,1,1]};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function publicStats(p){return p.publicStats;}
function estimateScore(stats){
let low=stats.goodsScore,high=stats.goodsScore,mean=stats.goodsScore;
for(const [kind,min,max,average] of [[3,1,3,2],[4,4,6,5],[5,8,10,9.2]]){const n=stats.bonusCounts[kind];low+=n*min;high+=n*max;mean+=n*average;}
return {low,high,mean:Math.round(mean*10)/10};
}
const clone=value=>JSON.parse(JSON.stringify(value));
// Snapshots deliberately exclude history, so history never nests recursively.
function snapshot(s){const {history,previousRounds,...position}=s;return clone(position);}
function initializeHistory(s){
s.history={version:1,initial:snapshot(s),events:[]};
s.previousRounds=[];
return s;
}
function nextRound(previous){
if(!previous.ended)throw Error('本局尚未结束');
if(previous.wins.some(n=>n>=2))throw Error('本场对战已结束');
const old=previous;
const next=round([...old.wins],old.result.winner<0?1-old.starter:1-old.result.winner,old.number+1);
next.previousRounds=[...old.previousRounds,{number:old.number,history:old.history,final:snapshot(old)}];
return next;
}
function round(wins=[0,0],starter=Math.floor(Math.random()*2),number=1){
const deck=shuffle(Object.entries({diamond:6,gold:6,silver:6,cloth:8,spice:8,leather:10,camel:8}).flatMap(([t,n])=>Array(n).fill(t)));
const players=[0,1].map(()=>{const cards=deck.splice(0,5);return {hand:cards.filter(t=>t!=='camel'),camels:cards.filter(t=>t==='camel').length,goods:[],bonus:[],publicStats:{goodsScore:0,goodsCounts:Object.fromEntries(TYPES.map(t=>[t,0])),bonusCounts:{3:0,4:0,5:0}}};});
const state={version:2,deck,market:['camel','camel','camel',...deck.splice(0,2)],players,tokens:JSON.parse(JSON.stringify(VALUES)),bonuses:{3:shuffle([1,1,2,2,2,3,3]),4:shuffle([4,4,5,5,6,6]),5:shuffle([8,8,9,10,10])},discard:[],wins,turn:starter,starter,number,log:[],ended:false};return initializeHistory(state);}
const sum=a=>a.reduce((a,b)=>a+b,0);
function finish(s,reason){s.ended=true;const [a,b]=s.players;const camel=a.camels===b.camels?-1:a.camels>b.camels?0:1;
const scores=s.players.map((p,i)=>sum(p.goods)+sum(p.bonus)+(camel===i?5:0));let winner=-1;
for(const v of [scores,s.players.map(p=>p.bonus.length),s.players.map(p=>p.goods.length)]){if(v[0]!==v[1]){winner=v[0]>v[1]?0:1;break;}}
if(winner>=0)s.wins[winner]++;s.result={scores,camel,winner,reason};}
function act(original,action){const s=snapshot(original);if(s.ended)throw Error('本局已结束');
// Completed records are immutable; append without repeatedly copying all prior rounds.
s.history={...original.history,events:[...original.history.events]};s.previousRounds=[...original.previousRounds];const actor=s.turn,p=s.players[actor],before=snapshot(s);const goodsTokens=[],bonusTokens=[];
const indices=(xs,arr)=>{if(!Array.isArray(xs)||new Set(xs).size!==xs.length||xs.some(i=>!Number.isInteger(i)||i<0||i>=arr.length))throw Error('请选择有效的卡牌');return xs;};
const mi=indices(action.market||[],s.market),hi=indices(action.hand||[],p.hand);const taken=mi.map(i=>s.market[i]),given=hi.map(i=>p.hand[i]);let message='';
if(action.type==='take'){if(mi.length!==1||taken[0]==='camel')throw Error('选择市场中的一张货物');if(p.hand.length>=7)throw Error('手牌已满 7 张，请交换或出售');p.hand.push(taken[0]);s.market.splice(mi[0],1);message=`拿取了 ${describeCards(taken)}`;}
else if(action.type==='camels'){const n=s.market.filter(t=>t==='camel').length;if(!n)throw Error('市场中没有骆驼');p.camels+=n;s.market=s.market.filter(t=>t!=='camel');message=`拿取了 ${n} 张骆驼`;}
else if(action.type==='exchange'){const c=action.camels||0;if(!Number.isInteger(c)||c<0||c>p.camels)throw Error('骆驼数量无效');if(mi.length<2||taken.includes('camel'))throw Error('选择至少 2 张市场货物，不含骆驼');if(mi.length!==hi.length+c)throw Error('取走和交出的数量必须相等');if(taken.some(t=>given.includes(t)))throw Error('不能交换同一种货物');if(p.hand.length-hi.length+mi.length>7)throw Error('交换后手牌不能超过 7 张');p.hand=p.hand.filter((_,i)=>!hi.includes(i)).concat(taken);p.camels-=c;s.market=s.market.filter((_,i)=>!mi.includes(i)).concat(given,Array(c).fill('camel'));message=`交出 ${describeCards(given.concat(Array(c).fill('camel')))}，换入 ${describeCards(taken)}`;}
else if(action.type==='sell'){if(!hi.length||new Set(given).size!==1)throw Error('请选择一种货物出售');const t=given[0],n=hi.length;if(TYPES.indexOf(t)<3&&n<2)throw Error('钻石、黄金、白银至少出售 2 张');p.hand=p.hand.filter((_,i)=>!hi.includes(i));s.discard.push(...given);const earned=s.tokens[t].splice(0,n);p.goods.push(...earned);goodsTokens.push(...earned.map(value=>({type:t,value})));p.publicStats.goodsScore+=sum(earned);p.publicStats.goodsCounts[t]+=earned.length;if(n>=3){const bonus=s.bonuses[Math.min(n,5)].pop();if(bonus!==undefined){p.bonus.push(bonus);bonusTokens.push({type:Math.min(n,5),value:bonus});p.publicStats.bonusCounts[Math.min(n,5)]++;}}message=`出售了 ${n} 张${NAMES[t]}`;}
else throw Error('未知操作');
s.log.unshift(`玩家 ${s.turn+1}：${message}`);s.log=s.log.slice(0,8);
const refill=[];while(s.market.length<5&&s.deck.length){const card=s.deck.pop();s.market.push(card);refill.push(card);}
if(s.market.length<5)finish(s,'牌库不足以补满市场');else if(TYPES.filter(t=>!s.tokens[t].length).length>=3)finish(s,'三种货物筹码已售罄');else s.turn=1-s.turn;
s.history.events.push({sequence:s.history.events.length+1,round:s.number,player:actor,
action:{type:action.type,market:[...mi],hand:[...hi],camels:action.type==='exchange'?(action.camels||0):0},
public:{message:s.log[0],taken:action.type==='camels'?before.market.filter(t=>t==='camel'):action.type==='take'||action.type==='exchange'?taken:[],returned:action.type==='exchange'?given.concat(Array(action.camels||0).fill('camel')):[],sold:action.type==='sell'?given:[],goodsTokens,bonusTypes:bonusTokens.map(token=>token.type),refill},
private:{bonusTokens},before,after:snapshot(s),result:s.ended?clone(s.result):null});
return s;}
const api={TYPES,VALUES,round,act,sum,publicStats,estimateScore,nextRound};if(typeof module!=='undefined')module.exports=api;else root.Jaipur=api;
})(globalThis);
