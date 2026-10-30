(function(root){
'use strict';
const TYPES=['joker','joker','spy','shield','fog','mud','recruiter','strategist','banshee','traitor'];
const INFO={joker:['百变者','占领时自动选择最优颜色与 1–9 点；每位玩家整局最多打出一张。'],spy:['间谍','7 点，占领时自动选择最优颜色。'],shield:['盾卫','占领时自动选择最优颜色与 1–3 点。'],fog:['迷雾','此界石只比较总点数，忽略牌型。'],mud:['泥战','此界石双方均须四张成阵。'],recruiter:['招募者','从两个牌堆共抽三张，再依次退回两张到对应牌堆底。'],strategist:['调度者','移动己方未占领界石的一张阵型牌，或将其弃置。'],banshee:['女妖','弃置对方未占领界石的一张阵型牌。'],traitor:['叛徒','将对方未占领界石的一张普通氏族牌转移至己方。']};
const deck=()=>Array.from({length:54},(_,id)=>({id,c:Math.floor(id/9),n:id%9+1}));
const tactics=()=>TYPES.map((type,i)=>({id:54+i,type}));
const elite=c=>['joker','spy','shield'].includes(c.type);
const allowed=(c,n)=>!c.type?c.n===n:c.type==='joker'?n>=1&&n<=9:c.type==='spy'?n===7:c.type==='shield'?n>=1&&n<=3:false;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const cmp=(a,b)=>a[0]-b[0]||a[1]-b[1];
function rank(cards,fog=false){const ns=cards.map(c=>c.n).sort((a,b)=>a-b),same=cards.every(c=>c.c===cards[0].c),run=ns.every((n,i)=>!i||n===ns[i-1]+1);return [fog?1:same&&run?5:ns.every(n=>n===ns[0])?4:same?3:run?2:1,ns.reduce((a,b)=>a+b,0)];}
const compare=(a,b)=>cmp(rank(a),rank(b));
const finished=s=>s.winner!==null||s.draw===true;
const capacity=t=>t.modes.some(c=>c.type==='mud')?4:3;
// Search formation classes, not combinations of hidden hands. The pool contains only
// publicly unplayed clan cards. Wildcards are assigned only when the stone is claimed.
function best(cards,size,pool=[],fog=false){
 const missing=size-cards.length;if(missing<0||pool.length<missing)return null;
 let result=null;
 const keep=(resolved)=>{const score=rank(resolved,fog);if(!result||cmp(score,result.score)>0)result={score,cards:resolved};};
 function run(color,start){const values=Array.from({length:size},(_,i)=>start+i),out=[];
  function visit(k,left){if(k===cards.length){const extras=[];for(const n of left){const c=pool.find(c=>c.n===n&&(color===null||c.c===color));if(!c)return;extras.push(c);}keep([...out,...extras]);return;}
   const c=cards[k];for(let i=0;i<left.length;i++){const n=left[i];if(!allowed(c,n)||(!c.type&&color!==null&&c.c!==color))continue;out.push({...c,n,c:c.type?(color??0):c.c});visit(k+1,left.filter((_,j)=>i!==j));out.pop();}}
  visit(0,values);
 }
 if(!fog){
  for(let color=0;color<6;color++)for(let start=1;start<=10-size;start++)run(color,start);
  if(result?.score[0]===5)return result;
  for(let n=1;n<=9;n++){if(!cards.every(c=>allowed(c,n)))continue;const extra=pool.filter(c=>c.n===n).slice(0,missing);if(extra.length===missing)keep([...cards.map(c=>c.type?{...c,n,c:0}:c),...extra]);}
  if(result?.score[0]===4)return result;
 }
 function high(color){if(cards.some(c=>!c.type&&color!==null&&c.c!==color))return;const extra=pool.filter(c=>color===null||c.c===color).sort((a,b)=>b.n-a.n).slice(0,missing);if(extra.length!==missing)return;keep([...cards.map(c=>c.type?{...c,n:c.type==='spy'?7:c.type==='shield'?3:9,c:color??0}:c),...extra]);}
 if(!fog){for(let color=0;color<6;color++)high(color);if(result?.score[0]>=3)return result;for(let start=1;start<=10-size;start++)run(null,start);if(result?.score[0]>=2)return result;}
 high(null);return result;
}
function create(options={}){const opts={tactics:false,expert:false,rounds:1,first:0,...options},d=shuffle(deck()),n=opts.tactics?7:6;return {version:2,options:opts,deck:d.slice(n*2),tactics:opts.tactics?shuffle(tactics()):[],hands:[d.slice(0,n),d.slice(n,n*2)],stones:Array.from({length:9},()=>({cards:[[],[]],done:[null,null],owner:null,modes:[]})),discard:[],used:[0,0],jokerUsed:[false,false],player:opts.first,phase:opts.expert?'preclaim':'play',turn:1,clock:0,winner:null,log:[],round:1,scores:[0,0],results:[],passed:false};}
function publicPool(s){const used=new Set([...s.stones.flatMap(t=>t.cards.flat()),...s.discard].filter(c=>!c.type).map(c=>c.id));return deck().filter(c=>!used.has(c.id));}
function claimInfo(s,i,p){const t=s.stones[i];if(!t||t.owner!==null||t.cards[p].length!==capacity(t))return {ok:false,reason:'己方阵型尚未完成，或界石已经被占领。'};const size=capacity(t),fog=t.modes.some(c=>c.type==='fog'),own=best(t.cards[p],size,[],fog),other=best(t.cards[1-p],size,publicPool(s),fog);const complete=t.cards[1-p].length===size,diff=other?cmp(own.score,other.score):1;const ok=diff>0||(diff===0&&(!complete||t.done[p]<t.done[1-p]));return {ok,own,other,complete,reason:ok?'可以占领。':'对方已完成的阵型或公开信息允许的补全仍能击败你。'};}
const claimable=(s,i,p)=>claimInfo(s,i,p).ok;
const winner=(s,p)=>s.stones.filter(t=>t.owner===p).length>=5||s.stones.some((t,i)=>i<7&&s.stones.slice(i,i+3).every(x=>x.owner===p));
const canPlay=(s,p)=>s.hands[p].some(c=>!c.type)&&s.stones.some(t=>t.owner===null&&t.cards[p].length<capacity(t));
function sync(s){s.clock++;for(const t of s.stones)for(let p=0;p<2;p++){if(t.cards[p].length===capacity(t)){if(t.done[p]===null)t.done[p]=s.clock;}else t.done[p]=null;}}
const afterPlay=s=>{s.phase=s.options.expert?'draw':'claim';};
function play(s,id,i,arg={}){if(finished(s)||s.phase!=='play')return false;const p=s.player,k=s.hands[p].findIndex(c=>c.id===id);if(k<0)return false;const c=s.hands[p][k],t=s.stones[i];if(c.type&&(!s.options.tactics||s.used[p]>s.used[1-p]))return false;
 if(!c.type||elite(c)){if(!t||t.owner!==null||t.cards[p].length>=capacity(t)||(c.type==='joker'&&s.jokerUsed[p]))return false;t.cards[p].push(c);if(c.type==='joker')s.jokerUsed[p]=true;}
 else if(c.type==='fog'||c.type==='mud'){if(!t||t.owner!==null||t.modes.some(x=>x.type===c.type))return false;t.modes.push(c);}
 else if(c.type==='recruiter'){if(s.deck.length+s.tactics.length===0)return false;}
 else {const src=s.stones[arg.from],q=c.type==='strategist'?p:1-p;if(!src||src.owner!==null)return false;const at=src.cards[q].findIndex(x=>x.id===arg.card);if(at<0)return false;const target=src.cards[q][at];if(c.type==='traitor'&&target.type)return false;const removing=c.type==='banshee'||(c.type==='strategist'&&arg.discard===true);
 if(!removing){if(!t||t.owner!==null||t.cards[p].length>=capacity(t)||(c.type==='strategist'&&i===arg.from))return false;}
 src.cards[q].splice(at,1);if(removing)s.discard.push(target);else t.cards[p].push(target);s.discard.push(c);}
 s.hands[p].splice(k,1);if(c.type)s.used[p]++;s.passed=false;sync(s);s.log.unshift(`玩家 ${p+1} 使用${c.type?INFO[c.type][0]:['红','橙','黄','绿','蓝','紫'][c.c]+' '+c.n}${t?' → 界石 '+(i+1):''}`);
 if(c.type==='recruiter'){s.discard.push(c);s.recruit={drawn:0,returned:0};s.phase='recruitDraw';}else afterPlay(s);return true;
}
function recruitDraw(s,source){if(s.phase!=='recruitDraw'||!['deck','tactics'].includes(source)||!s[source].length)return false;s.hands[s.player].push(s[source].pop());s.recruit.drawn++;if(s.recruit.drawn===3||s.deck.length+s.tactics.length===0)s.phase='recruitReturn';return true;}
function recruitReturn(s,id){if(s.phase!=='recruitReturn')return false;const h=s.hands[s.player],k=h.findIndex(c=>c.id===id);if(k<0)return false;const c=h.splice(k,1)[0];s[c.type?'tactics':'deck'].unshift(c);s.recruit.returned++;if(s.recruit.returned===2||h.length===0){delete s.recruit;afterPlay(s);}return true;}
function claim(s,i){if(finished(s)||!['claim','preclaim'].includes(s.phase))return false;const info=claimInfo(s,i,s.player);if(!info.ok)return false;const t=s.stones[i];t.owner=s.player;t.cards[s.player]=info.own.cards;if(info.complete)t.cards[1-s.player]=info.other.cards;s.log.unshift(`玩家 ${s.player+1} 占领界石 ${i+1}`);if(winner(s,s.player)){s.winner=s.player;const earned=[0,0];earned[s.player]=5;earned[1-s.player]=s.stones.filter(t=>t.owner===1-s.player).length;s.scores=s.scores.map((n,p)=>n+earned[p]);s.results.push({winner:s.player,earned});}return true;}
function beginPlay(s){if(s.phase!=='preclaim'||finished(s))return false;s.phase='play';return true;}
function pass(s){if(s.phase!=='play'||finished(s)||canPlay(s,s.player))return false;s.passed=true;afterPlay(s);return true;}
function end(s,source='deck'){if(finished(s)||!['claim','draw'].includes(s.phase))return false;const max=s.options.tactics?7:6;if(!s.passed&&s.hands[s.player].length<max&&(s.deck.length||s.tactics.length)){if(!['deck','tactics'].includes(source)||!s[source].length)return false;s.hands[s.player].push(s[source].pop());}s.passStreak=s.passed?(s.passStreak??0)+1:0;s.player=1-s.player;s.turn++;s.phase=s.options.expert?'preclaim':'play';s.passed=false;s.stalled=s.passStreak>=2&&stalemate(s);return true;}
function hasAction(s,p){
 if(canPlay(s,p))return true;
 if(s.used[p]>s.used[1-p])return false;
 const open=s.stones.filter(t=>t.owner===null),room=open.some(t=>t.cards[p].length<capacity(t));
 for(const c of s.hands[p]){
  if(!c.type)continue;
  if(elite(c)&&room&&(c.type!=='joker'||!s.jokerUsed[p]))return true;
  if(['fog','mud'].includes(c.type)&&open.some(t=>!t.modes.some(m=>m.type===c.type)))return true;
  if(c.type==='recruiter'&&s.deck.length+s.tactics.length>0)return true;
  if(c.type==='strategist'&&open.some(t=>t.cards[p].length>0))return true;
  if(c.type==='banshee'&&open.some(t=>t.cards[1-p].length>0))return true;
  if(c.type==='traitor'&&room&&open.some(t=>t.cards[1-p].some(x=>!x.type)))return true;
 }
 return false;
}
function stalemate(s){return !hasAction(s,0)&&!hasAction(s,1)&&!s.stones.some((_,i)=>claimable(s,i,0)||claimable(s,i,1));}
// Optional agreed settlement, explicitly separate from the official victory rules.
function agreeDraw(s){if(finished(s)||!s.stalled||!stalemate(s))return false;s.draw=true;s.results.push({winner:null,earned:[0,0],draw:true});s.log.unshift('双方同意和局，本局不计分');return true;}
function nextRound(s,first){if(!finished(s)||s.round>=s.options.rounds)return null;const next=create({...s.options,first});next.round=s.round+1;next.scores=[...s.scores];next.results=[...s.results];return next;}
const api={finished,hasAction,stalemate,agreeDraw,INFO,elite,deck,tactics,rank,compare,best,capacity,create,publicPool,claimInfo,claimable,winner,canPlay,play,claim,end,pass,beginPlay,recruitDraw,recruitReturn,nextRound};if(typeof module!=='undefined')module.exports=api;else root.Game=api;
})(globalThis);
