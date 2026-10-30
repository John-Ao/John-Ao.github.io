'use strict';
const Data=typeof module!=='undefined'?require('./data.js'):{CARDS,WONDERS,TOKENS,MYTHS,GODS,DECREES,PLOTS};
const Engine=(()=>{
const {CARDS:C,WONDERS:W,TOKENS:T,GODS:G,DECREES:D,PLOTS:P}=Data;
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const has=(p,n)=>p.tokens.some(i=>T[i].name===n);
const player=()=>({coins:7,protected:0,cards:[],wonders:[],built:[],tokens:[],gods:[],myths:[],offerings:[],plots:[],influence:[0,0,0,0,0,0],buried:{},snake:null});
const count=(p,color)=>color==='wonder'?p.built.length:color==='money'?Math.floor(p.coins/3):p.cards.filter(id=>color==='raw'?['brown','gray'].includes(C[id].color):color==='senator'?C[id].senator:C[id].color===color).length;
const assets=p=>[...p.cards.map(i=>C[i]),...p.built.map(i=>W[i])];
const science=p=>[...p.cards.map(i=>C[i].science),...p.tokens.map(i=>T[i].science),...(p.gods.includes(1)?['⚖']:[]),...(p.snake!==null?[C[p.snake]?.science]:[])].filter(Boolean);
const owner=(s,ch)=>s.players[0].influence[ch]===s.players[1].influence[ch]?null:s.players[0].influence[ch]>s.players[1].influence[ch]?0:1;
const decree=(s,i,key)=>!!s.config.agora&&s.chambers.some((ch,j)=>owner(s,j)===i&&ch.decrees.some(id=>D[id].key===key));
const log=(s,msg)=>s.log.unshift(msg);
const totalMoney=p=>p.coins+p.protected;
function layout(age,agora=false){let rows;if(agora){const counts=age===1?[3,4,5,6,7]:age===2?[7,6,5,4,3]:[2,3,4,5,4,3,2];rows=counts.map(n=>Array.from({length:n},(_,i)=>(7-n)/2+i));}else rows=age===1?[[2,3],[1.5,2.5,3.5],[1,2,3,4],[.5,1.5,2.5,3.5,4.5],[0,1,2,3,4,5]]:age===2?[[0,1,2,3,4,5],[.5,1.5,2.5,3.5,4.5],[1,2,3,4],[1.5,2.5,3.5],[2,3]]:[[2,3],[1.5,2.5,3.5],[1,2,3,4],[1.5,3.5],[1,2,3,4],[1.5,2.5,3.5],[2,3]];return rows.flatMap((xs,y)=>xs.map((x,col)=>({x,y,col,up:y%2===0,gone:false,token:null})));}
const available=(s,i)=>{const n=s.board[i];return !!n&&!n.gone&&!s.board.some(m=>!m.gone&&m.y===n.y+1&&Math.abs(m.x-n.x)<.99);};
const put=(s,type,who=s.turn,args={})=>s.queue.push({type,who,...args});
function create(first=0,config={}){config={pantheon:false,agora:false,preset:false,...config};const tp=shuffle(T.map((t,i)=>i).filter(i=>!T[i].exp||config[T[i].exp]));const wp=shuffle(W.map((w,i)=>i).filter(i=>!W[i].exp||config[W[i].exp])).slice(0,8);const s={version:2,config,age:1,turn:first,first,players:[player(),player()],military:0,minerva:null,raids:[],tokens:tp.slice(0,5),box:tp.slice(5),enki:[],draft:wp,step:0,phase:'draft',board:[],discard:[],removed:[],locked:[],log:[],queue:[],pending:null,replay:false,result:null,flow:null,triggered:false,turnId:1,slots:Array(6).fill(null),mythDecks:Array.from({length:5},(_,m)=>shuffle(G.filter(g=>g.myth===m).map(g=>g.id))),plotDeck:shuffle(P.map(p=>p.id)),sealed:[],chambers:shuffle(D.map(d=>d.id)).slice(0,6).map((id,i)=>({decrees:[id],up:i%2===0})),decks:{}};
const senators=shuffle(C.filter(c=>c.senator).map(c=>c.id));for(let age=1;age<=3;age++){let deck=shuffle(C.filter(c=>c.age===age).map(c=>c.id));s.removed.push(...deck.splice(0,3));if(age===3)deck.push(...shuffle(C.filter(c=>c.age===(config.pantheon?5:4)).map(c=>c.id)).slice(0,3));if(config.agora)deck.push(...senators.splice(0,age===3?3:5));s.decks[age]=shuffle(deck);}deal(s);
if(config.preset&&!config.agora&&!config.pantheon){s.players[first].wonders=[8,4,11,10];s.players[1-first].wonders=[1,7,0,2];s.draft=[];s.step=8;s.phase='play';}return s;}
function deal(s){s.board=layout(s.age,s.config.agora).map((n,i)=>({...n,card:s.decks[s.age][i]}));if(s.config.pantheon&&s.age<3){let positions;if(!s.config.agora)positions=s.age===1?[[1,0],[1,2],[3,0],[3,2],[3,4]]:[[1,0],[1,2],[1,4]];else positions=s.age===1?[[1,0],[1,3],[3,0],[3,2],[3,5]]:[[1,0],[1,2],[1,5]];const tokens=s.age===1?shuffle([0,0,1,1,2,2,3,3,4,4]).slice(0,5):shuffle([2,3,4]);positions.forEach(([y,col],i)=>{const n=s.board.find(n=>n.y===y&&n.col===col);n.token={type:s.age===1?'myth':'offering',value:tokens[i]};});}}
function draft(s,id){if(s.phase!=='draft'||s.pending||s.flow||!s.draft.slice(0,4-s.step%4).includes(id))throw Error('请选择当前展示的奇迹');const p=s.players[s.turn];p.wonders.push(id);s.draft.splice(s.draft.indexOf(id),1);s.flow='draft';log(s,`玩家 ${s.turn+1} 选择「${W[id].name}」`);if(W[id].setup)put(s,W[id].setup);drain(s);}
function quote(s,obj,who=s.turn){const p=s.players[who],o=s.players[1-who];if(obj.senator)return {total:has(p,'腐败')?0:count(p,'senator'),trade:0,chain:false};const chainPlayers=[p,...(decree(s,who,'chain')?[o]:[])];if((obj.chain&&chainPlayers.some(p=>p.cards.some(i=>C[i].name===obj.chain)))||(obj.temple!==undefined&&chainPlayers.some(p=>p.myths.includes(obj.temple))))return {total:0,trade:0,chain:true};const need={};for(const r of (obj.cost||'').replace(/[0-9]/g,''))need[r]=(need[r]||0)+1;for(const a of assets(p))for(const r of a.res||'')need[r]=Math.max(0,(need[r]||0)-1);const flexible=assets(p).filter(a=>a.wild).map(a=>a.wild);if((obj.color==='wonder'&&has(p,'建筑学'))||(obj.color==='blue'&&has(p,'石工术')))flexible.push('wcsgp','wcsgp');if(obj.color==='wonder'&&decree(s,who,'wonder_discount'))flexible.push('wcsgp');const rates={};for(const r of 'wcsgp'){let rate=assets(p).some(a=>a.discount?.includes(r))?1:2+o.cards.filter(i=>['brown','gray'].includes(C[i].color)).reduce((n,i)=>n+[...(C[i].res||'')].filter(x=>x===r).length,0);if(decree(s,who,'wcs'.includes(r)?'trade_raw':'trade_man'))rate=Math.max(1,rate-1);rates[r]=rate;}
function best(n,k){if(k===flexible.length)return Object.entries(n).reduce((v,[r,q])=>v+q*rates[r],0);let v=best(n,k+1);for(const r of flexible[k])if(n[r]>0)v=Math.min(v,best({...n,[r]:n[r]-1},k+1));return v;}
const fixed=Number((obj.cost||'').match(/\d+/)?.[0]||0);let trade=best(need,0),total=trade+fixed;if(decree(s,who,'discount_'+obj.color)){// The printed coin symbol is one whole cost symbol.
let min={total:trade,trade};for(const r of 'wcsgp')if(need[r]>0){const t=best({...need,[r]:need[r]-1},0);if(t+fixed<min.total)min={total:t+fixed,trade:t};}({trade,total}=min);}
if(has(p,'工程学')&&(obj.chain||obj.temple!==undefined)&&total>1)return {total:1,trade:0,chain:false,engineering:true};return {total,trade,chain:false};}
function pay(s,q,who=s.turn,protectedSpend=null){const p=s.players[who];if(totalMoney(p)<q.total)throw Error('金币不足');const a=protectedSpend===null?Math.max(0,q.total-p.coins):Number(protectedSpend);if(!Number.isInteger(a)||a<0||a>p.protected||a>q.total||q.total-a>p.coins)throw Error('受保护金币支付数量无效');p.protected-=a;p.coins-=q.total-a;if(has(s.players[1-who],'经济学'))s.players[1-who].coins+=q.trade||0;if(q.chain&&has(p,'城市规划'))p.coins+=4;}
function score(s,i){const p=s.players[i],distance=s.military*(i===0?1:-1);const fields={建筑:p.cards.reduce((v,id)=>v+(C[id].vp||0),0),奇迹:p.built.reduce((v,id)=>v+(W[id].vp||0),0),进步:p.tokens.reduce((v,id)=>v+(T[id].vp||0),0)+(has(p,'数学')?p.tokens.length*3:0)+(has(p,'神秘主义')?(p.myths.length+p.offerings.length)*2:0),金币:Math.floor(p.coins/3),军事:distance>0?(distance>=6?10:distance>=3?5:2):0,公会:p.cards.reduce((v,id)=>v+(C[id].guild?Math.max(...s.players.map(p=>count(p,C[id].guild)))*(C[id].guild==='wonder'?2:1):0),0),神祇:(p.gods.includes(6)?9:0)+p.protected,大神庙:[0,5,12,21][p.cards.filter(id=>C[id].temple!==undefined).length]||0,议院:s.config.agora?[1,2,3,3,2,1].reduce((n,v,j)=>n+(owner(s,j)===i?v:0),0):0};return {...fields,total:Object.values(fields).reduce((a,b)=>a+b,0)};}
function win(s){if(s.result)return true;const sci=s.players.map(p=>new Set(science(p)).size>=6);if(sci[0]&&sci[1])s.result={winner:null,reason:'双方同时科学霸权'};else if(sci.some(Boolean))s.result={winner:sci[0]?0:1,reason:'科学霸权'};else if(Math.abs(s.military)>=9)s.result={winner:s.military>0?0:1,reason:'军事霸权'};else if(s.config.agora)for(let i=0;i<2;i++)if(s.chambers.every((_,j)=>owner(s,j)===i))s.result={winner:i,reason:'政治霸权'};if(s.result){s.phase='end';s.queue=[];s.pending=null;s.flow=null;return true;}return false;}
function scienceChange(s,before){if(win(s))return;for(const i of [s.turn,1-s.turn]){const now=science(s.players[i]);for(const sym of new Set(now))if(Math.floor(now.filter(x=>x===sym).length/2)>Math.floor(before[i].filter(x=>x===sym).length/2))put(s,'token',i,{pool:'board'});}}
function moneyLoss(s,who,n){s.players[who].coins=Math.max(0,s.players[who].coins-n);}
function raid(s,key,actor){if(s.raids.includes(key))return;s.raids.push(key);if(s.config.agora){if(key.endsWith('3'))put(s,'place',actor);else {put(s,'remove',actor);put(s,'move',actor);}}else moneyLoss(s,1-actor,key.endsWith('3')?2:5);log(s,`玩家 ${actor+1} 触发军事标记 ${key}`);}
function military(s,who,n){const dir=who===0?1:-1;for(let k=0;k<n;k++){const next=s.military+dir;if(s.minerva===next){s.minerva=null;log(s,'密涅瓦阻止剩余军事移动');break;}s.military=Math.max(-9,Math.min(9,next));if(has(s.players[who],'攻城术'))moneyLoss(s,1-who,1);for(const lim of [3,6])if(s.military*dir===lim)raid(s,Math.sign(s.military)+':'+lim,who);if(win(s))break;}}
function senateChange(s,fn){const old=[0,1].map(i=>decree(s,i,'shield'));fn();s.chambers.forEach((ch,i)=>{if(s.players.some(p=>p.influence[i]>0))ch.up=true;});if(win(s))return;const now=[0,1].map(i=>decree(s,i,'shield'));for(let i=0;i<2;i++)if(old[i]&&!now[i])military(s,1-i,1);for(let i=0;i<2;i++)if(!old[i]&&now[i])military(s,i,1);win(s);}
function triggerIncome(s,color){for(let i=0;i<2;i++)if(decree(s,i,'income_'+color))s.players[i].coins+=s.age;}
function build(s,id,who){const p=s.players[who],c=C[id],before=s.players.map(science);p.cards.push(id);p.coins+=c.coins||0;if(c.income)p.coins+=count(p,c.income)*c.rate;if(c.guild&&!['wonder','money'].includes(c.guild))p.coins+=Math.max(...s.players.map(p=>count(p,c.guild)));triggerIncome(s,c.color);scienceChange(s,before);if(s.result)return;if(c.shield)military(s,who,c.shield+(has(p,'战略')?1:0));if(c.senator==='politician'){const n=Math.min(3,1+Math.floor((count(p,'blue')+(decree(s,who,'blue_bonus')?2:0))/2));for(let j=0;j<n;j++)put(s,'senate',who,{section:c.section});}if(c.senator==='conspirator'){put(s,'conspirator',who);if(decree(s,who,'replay'))s.replay=true;}log(s,`玩家 ${who+1} 建造「${c.name}」`);}
function canWonder(s,who,id){const p=s.players[who];return p.wonders.includes(id)&&!p.built.includes(id)&&!s.locked.includes(id)&&s.players.reduce((n,p)=>n+p.built.length,0)<7;}
function wonder(s,id,card,who){const p=s.players[who],w=W[id];p.built.push(id);p.buried[id]=card;p.coins+=w.coins||0;if(w.loss)moneyLoss(s,1-who,w.loss);triggerIncome(s,'wonder');if(w.replay||has(p,'神学'))s.replay=true;if(s.players.reduce((n,p)=>n+p.built.length,0)===7)for(const x of s.players)for(const id of x.wonders)if(!x.built.includes(id)&&!s.locked.includes(id))s.locked.push(id);if(w.shield)military(s,who,w.shield);if(w.destroy)put(s,'destroy',who,{color:w.destroy});if(w.library)put(s,'token',who,{pool:'library'});if(w.revive)put(s,'revive',who);if(w.theater)put(s,'theater',who);if(w.curia)put(s,'curia',who);if(w.knossos){put(s,'place',who);put(s,'move',who);}log(s,`玩家 ${who+1} 建造奇迹「${w.name}」`);}
function tearWonder(s,who,id,permanent){const p=s.players[who],w=W[id];p.built.splice(p.built.indexOf(id),1);if(p.buried[id]!==undefined){s.discard.push(p.buried[id]);delete p.buried[id];}if(permanent){p.wonders.splice(p.wonders.indexOf(id),1);s.locked.push(id);}if(w.shield)military(s,1-who,w.shield);log(s,`${w.name} ${permanent?'永久移除':'拆除，可重新建造'}`);}
function takeBoard(s,index,who,mode){const n=s.board[index];n.gone=true;if(mode==='discard')s.discard.push(n.card);if(n.token)collect(s,n,who);return n.card;}
function collect(s,n,who){const t=n.token;n.token=null;if(t.type==='offering'){s.players[who].offerings.push(t.value);log(s,`玩家 ${who+1} 获得供奉 ${t.value}`);}else {s.players[who].myths.push(t.value);put(s,'myth',who,{myth:t.value});log(s,`玩家 ${who+1} 获得${Data.MYTHS[t.value]}神话标记`);}}
function reveal(s,who){s.board.forEach((n,i)=>{if(!n.up&&available(s,i)){n.up=true;if(n.token)collect(s,n,who);}});}
function checkMain(s){if(s.phase!=='play'||s.pending||s.flow||s.result)throw Error('请先结算当前效果');}
function action(s,index,type,wid,protectedSpend=null){checkMain(s);if(!available(s,index))throw Error('此牌尚未可取');const p=s.players[s.turn],c=C[s.board[index].card];let q;
if(type==='build')q=quote(s,c);else if(type==='wonder'){if(!canWonder(s,s.turn,wid))throw Error('无法建造此奇迹');q=quote(s,W[wid]);}else if(type==='prepare'){if(!p.plots.some(x=>x.id===wid&&!x.ready&&!x.used))throw Error('此阴谋无法准备');}else if(type!=='discard')throw Error('无效操作');if(q)pay(s,q,s.turn,protectedSpend);s.flow='turn';s.replay=false;const cid=takeBoard(s,index,s.turn,type==='discard'?'discard':'take');if(type==='build')build(s,cid,s.turn);if(type==='wonder')wonder(s,wid,cid,s.turn);if(type==='discard'){const n=2+count(p,'yellow')+(decree(s,s.turn,'discard')?2:0);p.coins+=n;log(s,`玩家 ${s.turn+1} 弃置「${c.name}」，获得 ${n} 金币`);}if(type==='prepare'){const plot=p.plots.find(x=>x.id===wid);plot.ready=true;plot.card=cid;log(s,`玩家 ${s.turn+1} 准备了一张阴谋`);}drain(s);}
function godCost(s,slot,offerings=[],who=s.turn){const entry=s.slots[slot];if(!entry)throw Error('此神位为空');const p=s.players[who],base=(who===0?3+slot:8-slot)*(entry.god===15?2:1);const own=[...p.offerings];let reduction=p.built.some(id=>W[id].sanctuary)?2:0;for(const v of offerings){const idx=own.indexOf(v);if(idx<0)throw Error('供奉无效');own.splice(idx,1);reduction+=v;}return {total:Math.max(0,base-reduction),trade:0,base};}
function invoke(s,slot,offerings=[],protectedSpend=null){checkMain(s);if(!s.config.pantheon||s.age<2||!s.slots[slot])throw Error('现在不能召唤');const q=godCost(s,slot,offerings);pay(s,q,s.turn,protectedSpend);for(const v of offerings)s.players[s.turn].offerings.splice(s.players[s.turn].offerings.indexOf(v),1);const g=s.slots[slot].god;s.slots[slot]=null;s.flow='turn';s.replay=false;if(g===15)put(s,'gate');else activateGod(s,g,s.turn);drain(s);}
function enkiReveal(s){if(!s.enki.length){s.box=shuffle(s.box);s.enki=s.box.splice(0,2);}}
function activateGod(s,id,who){const p=s.players[who],g=G[id],before=s.players.map(science);p.gods.push(id);log(s,`玩家 ${who+1} 召唤「${g.name}」`);switch(g.key){case'enki':enkiReveal(s);put(s,'token',who,{pool:'enki'});break;case'ishtar':scienceChange(s,before);break;case'nisaba':put(s,'snake',who);break;case'astarte':p.protected+=7;break;case'baal':put(s,'steal_raw',who);break;case'tanit':p.coins+=12;break;case'hades':put(s,'revive',who);break;case'zeus':put(s,'zeus',who);break;case'anubis':put(s,'anubis',who);break;case'isis':put(s,'isis',who);break;case'ra':put(s,'steal_wonder',who);break;case'mars':military(s,who,2);break;case'minerva':put(s,'minerva',who);break;case'neptune':put(s,'neptune_discard',who);break;}}
function triggerPlot(s,id,who,extra=false){const plot=s.players[who].plots.find(x=>x.id===id);if(!plot||plot.used||(!extra&&!plot.ready))throw Error('此阴谋不能触发');plot.used=true;log(s,`玩家 ${who+1} 触发「${P[id].name}」`);for(const type of P[id].effects)put(s,type,who);}
function trigger(s,id){checkMain(s);if(!s.config.agora||s.triggered)throw Error('每回合开始时最多触发1张阴谋');s.triggered=true;s.flow='pre';triggerPlot(s,id,s.turn);drain(s);}
function finish(s){if(win(s))return;const flow=s.flow;s.flow=null;if(flow==='draft'){s.step++;if(s.step===8){s.phase='play';s.turn=s.first;}else s.turn=([0,1,1,0,1,0,0,1][s.step]+s.first)%2;return;}
if(s.board.every(n=>n.gone)){if(s.age===3){const a=score(s,0).total,b=score(s,1).total,blue=i=>s.players[i].cards.reduce((v,id)=>v+(C[id].color==='blue'?C[id].vp:0),0);s.result={winner:a===b?(blue(0)===blue(1)?null:blue(0)>blue(1)?0:1):a>b?0:1,reason:'文明计分'};s.phase='end';return;}s.turn=s.military===0?s.turn:s.military>0?1:0;s.phase='starter';s.replay=false;return;}
if(flow==='pre')return;if(!s.replay)s.turn=1-s.turn;s.replay=false;s.triggered=false;s.turnId++;}
function starter(s,id){if(s.phase!=='starter'||![0,1].includes(id))throw Error('无效操作');s.age++;s.turn=id;s.turnId++;s.triggered=false;s.phase='play';deal(s);if(s.config.pantheon&&s.age===2){const empty=s.slots.indexOf(null);if(empty>=0)s.slots[empty]={god:15,owner:null};if(s.slots.some(x=>x?.god===0))enkiReveal(s);}}
const opt=(value,label,desc='')=>({value:String(value),label,desc});
const cardOptions=ids=>ids.map(id=>opt(id,C[id].name));
const boardOptions=(s,filter=()=>true)=>s.board.flatMap((n,i)=>!n.gone&&filter(n,i)?[opt(i,n.up?C[n.card].name:`背面${C[n.card].senator?'议员':'时代'}牌（${n.y+1}行 ${n.col+1}列）`)]:[]);
function influenceOptions(s,t,mode){const p=s.players[t.who],o=s.players[1-t.who];const opts=[];if((mode==='place'||mode==='senate')&&p.influence.reduce((a,b)=>a+b,0)<12)for(let ch=0;ch<6;ch++)if(t.section===undefined||Math.floor(ch/2)===t.section)opts.push(opt('p:'+ch,`议院 ${ch+1} 放置1影响力`));if(mode==='move'||mode==='senate')for(let ch=0;ch<6;ch++)if(p.influence[ch]>0)for(const to of [ch-1,ch+1])if(to>=0&&to<6)opts.push(opt(`m:${ch}:${to}`,`影响力 ${ch+1} → ${to+1}`));if(mode==='remove')for(let ch=0;ch<6;ch++)if(o.influence[ch]>0)opts.push(opt('r:'+ch,`移除对手在议院 ${ch+1} 的1影响力`));opts.push(opt('skip','放弃此影响力行动'));return opts;}
function prepareTask(s,t){const p=s.players[t.who],o=s.players[1-t.who];let options=[],title='',secret=false;
if(['place','move','remove','senate'].includes(t.type)){title='议院影响力行动';options=influenceOptions(s,t,t.type);}
else switch(t.type){
case 'token':{title='选择进步标记';let ids;if(t.pool==='board')ids=s.tokens;if(t.pool==='library'){ids=shuffle(s.box).slice(0,3);t.candidates=ids;secret=true;}if(t.pool==='enki')ids=s.enki;options=(ids||[]).map(id=>opt(id,T[id].name,T[id].desc));break;}
case 'destroy':title='选择摧毁的建筑';options=cardOptions(o.cards.filter(id=>C[id].color===t.color));break;
case 'destroy_yellow':case 'destroy_blue':title='选择摧毁的建筑';options=cardOptions(o.cards.filter(id=>C[id].color===t.type.split('_')[1]));break;
case 'steal_raw':title='夺取原料/制品建筑';options=cardOptions(o.cards.filter(id=>['brown','gray'].includes(C[id].color)));break;
case 'revive':title='免费重建弃牌';options=cardOptions(s.discard);break;
case 'treason':title='秘密选取开局移除的建筑';secret=true;options=cardOptions(s.removed.filter(id=>C[id].age<=s.age));break;
case 'espionage':title='秘密选择盒中进步';secret=true;options=s.box.map(id=>opt(id,T[id].name,T[id].desc));break;
case 'myth':title='秘密选择入驻神祇';secret=true;t.drawn=s.mythDecks[t.myth].splice(0,2);options=t.drawn.map(id=>opt(id,G[id].name,G[id].desc));break;
case 'slot':title='选择神位（时代 II 才公开）';secret=true;options=s.slots.flatMap((g,i)=>g===null?[opt(i,`神位 ${i+1} · 玩家1 ${3+i}币 / 玩家2 ${8-i}币`)]:[]);break;
case 'conspirator':title='选择密谋者效果';options=[opt('place','放置1影响力'),opt('conspire','秘密抽取阴谋')];break;
case 'conspire':title='秘密选择阴谋';secret=true;t.drawn=s.plotDeck.splice(0,2);if(has(p,'有组织犯罪')){for(const id of t.drawn)p.plots.push({id,ready:false,used:false});log(s,`玩家 ${t.who+1} 获得 ${t.drawn.length} 张阴谋`);t.drawn=[];}else options=t.drawn.map(id=>opt(id,P[id].name,P[id].desc));break;
case 'return_plot':title='放回未选的阴谋';secret=true;options=[opt('top','放回牌库顶部'),opt('bottom','放回牌库底部')];break;
case 'curia':title='议事厅：可触发1张未准备阴谋';secret=true;options=p.plots.filter(x=>!x.ready&&!x.used).map(x=>opt(x.id,P[x.id].name,P[x.id].desc));options.push(opt('skip','不触发阴谋'));break;
case 'snake':title='复制对手的科学符号';options=cardOptions(o.cards.filter(id=>C[id].color==='green'));break;
case 'zeus':title='宙斯：弃置任意牌并领取标记';options=boardOptions(s);break;
case 'discard_board':title='时局突变：弃置一张可取牌';options=boardOptions(s,(_,i)=>available(s,i));options.push(opt('skip','不再弃牌'));break;
case 'free_board':title='免费建造一张可取建筑';options=boardOptions(s,(n,i)=>available(s,i)&&!C[n.card].senator);break;
case 'steal_wonder':title='夺取对手未建奇迹';options=o.wonders.filter(id=>!o.built.includes(id)&&!s.locked.includes(id)).map(id=>opt(id,W[id].name));break;
case 'anubis':title='拆除一座奇迹（可重建）';options=s.players.flatMap((p,i)=>p.built.map(id=>opt(i+':'+id,`玩家 ${i+1} · ${W[id].name}`)));break;
case 'sabotage':title='永久移除对手已建奇迹';options=o.built.map(id=>opt(id,W[id].name));break;
case 'isis':title='伊西斯：选择弃牌作奇迹垫牌';if(p.wonders.some(id=>canWonder(s,t.who,id)))options=cardOptions(s.discard);break;
case 'free_wonder':title='免费建造奇迹';options=p.wonders.filter(id=>canWonder(s,t.who,id)).map(id=>opt(id,W[id].name));break;
case 'minerva':title='放置密涅瓦阻挡棋子';options=Array.from({length:19},(_,i)=>opt(i-9,`军事格 ${i-9}${i===0?' · 玩家1首都':i===18?' · 玩家2首都':''}`));break;
case 'neptune_discard':case 'neptune_apply':title=t.type==='neptune_discard'?'涅普顿：移除一枚军事标记':'涅普顿：选择一枚军事标记对对手生效';options=['-1:3','-1:6','1:3','1:6'].filter(k=>!s.raids.includes(k)).map(k=>opt(k,`${k.startsWith('-')?'左':'右'}侧 ${k.endsWith('3')?'内':'外'}区军事标记`));break;
case 'gate':title='神门：选择免费召唤的神祇';t.candidates=s.mythDecks.map(d=>d[0]).filter(id=>id!==undefined);if(t.candidates.includes(0))enkiReveal(s);options=t.candidates.map(id=>opt(id,G[id].name,G[id].desc));break;
case 'theater':title='神圣剧院：选择神话牌堆';options=s.mythDecks.flatMap((d,m)=>d.length?[opt(m,Data.MYTHS[m])]:[]);break;
case 'theater_god':title='神圣剧院：选择免费召唤的神祇';t.candidates=[...s.mythDecks[t.myth]];if(t.candidates.includes(0))enkiReveal(s);options=t.candidates.map(id=>opt(id,G[id].name,G[id].desc));break;
case 'reorder_gods':title='决定剩余神祇牌顺序（逐张选取，从顶至底）';secret=true;options=t.remaining.map(id=>opt(id,G[id].name));break;
case 'lock_token':title='蒙昧主义：选择标记来源';options=[opt('board','桌面公开标记'),opt('opponent','对手的标记'),opt('box','秘密查看盒中标记')];break;
case 'lock_select':title='选择永久封存的进步标记';secret=t.pool==='box';options=(t.pool==='board'?s.tokens:t.pool==='opponent'?o.tokens:s.box).map(id=>opt(id,T[id].name,T[id].desc));break;
case 'exchange':title='胁迫：选择交换给对手的蓝/绿建筑';options=cardOptions(p.cards.filter(id=>['blue','green'].includes(C[id].color)&&o.cards.some(cid=>C[cid].color===C[id].color)));break;
case 'exchange_get':title='胁迫：选择对手的同色建筑';options=cardOptions(o.cards.filter(id=>C[id].color===C[t.give].color));break;
case 'decree':title='选择要移动的法令';options=s.chambers.flatMap((ch,i)=>ch.decrees.map(id=>opt(i+':'+id,`议院 ${i+1} · ${ch.up?D[id].name:'未公开法令'}`)));break;
case 'decree_to':title='选择法令目的议院';options=s.chambers.flatMap((ch,i)=>i!==t.from?[opt(i,`议院 ${i+1}`)]:[]);break;
case 'half_coins':{const n=Math.ceil(o.coins/2);o.coins-=n;p.coins+=n;break;}
case 'embezzle':p.coins+=p.influence.reduce((a,b)=>a+b,0);moneyLoss(s,1-t.who,o.influence.reduce((a,b)=>a+b,0));break;
case 'shield2':military(s,t.who,2);break;
default:throw Error('未知结算类型 '+t.type);
}
if(options.length)return {...t,title,secret,options};return null;}
function drain(s){if(win(s))return;while(s.queue.length){const task=s.queue.shift(),tail=s.queue;s.queue=[];const pending=prepareTask(s,task);s.queue.push(...tail);if(win(s))return;if(pending){s.pending=pending;return;}}if(s.flow!=='draft'){reveal(s,s.turn);if(s.queue.length){drain(s);return;}}finish(s);}
function choose(s,value){const t=s.pending;if(!t||!t.options.some(o=>o.value===String(value)))throw Error('无效选择');value=String(value);s.pending=null;const tail=value==='skip'&&t.type==='discard_board'?s.queue.filter(x=>x.type!=='discard_board'):s.queue;s.queue=[];resolve(s,t,value);s.queue.push(...tail);drain(s);}
function resolve(s,t,value){const p=s.players[t.who],o=s.players[1-t.who],id=Number(value);if(value==='skip'){if(t.type==='discard_board')s.queue=s.queue.filter(x=>x.type!=='discard_board');return;}
if(['place','move','remove','senate'].includes(t.type)){const [mode,a,b]=value.split(':');senateChange(s,()=>{if(mode==='p')p.influence[+a]++;if(mode==='m'){p.influence[+a]--;p.influence[+b]++;}if(mode==='r')o.influence[+a]--;});log(s,`玩家 ${t.who+1} ${t.options.find(x=>x.value===value).label}`);return;}
switch(t.type){
case 'token':case 'espionage':{const before=s.players.map(science),pool=t.type==='espionage'||t.pool==='library'?s.box:t.pool==='enki'?s.enki:s.tokens;pool.splice(pool.indexOf(id),1);p.tokens.push(id);p.coins+=T[id].coins||0;if(t.pool==='enki'){s.box.push(...s.enki);s.enki=[];}log(s,`玩家 ${t.who+1} 获得进步「${T[id].name}」`);scienceChange(s,before);break;}
case 'destroy':case 'destroy_yellow':case 'destroy_blue':o.cards.splice(o.cards.indexOf(id),1);s.discard.push(id);log(s,`摧毁「${C[id].name}」`);break;
case 'steal_raw':o.cards.splice(o.cards.indexOf(id),1);p.cards.push(id);log(s,`玩家 ${t.who+1} 夺取「${C[id].name}」`);break;
case 'revive':s.discard.splice(s.discard.indexOf(id),1);build(s,id,t.who);break;
case 'treason':s.removed.splice(s.removed.indexOf(id),1);build(s,id,t.who);break;
case 'myth':{for(const gid of t.drawn)if(gid!==id)s.mythDecks[t.myth].unshift(gid);put(s,'slot',t.who,{god:id});break;}
case 'slot':s.slots[id]={god:t.god,owner:t.who};log(s,`玩家 ${t.who+1} 在神位 ${id+1} 放置一位神祇`);break;
case 'conspirator':put(s,value,t.who);break;
case 'conspire':p.plots.push({id,ready:false,used:false});log(s,`玩家 ${t.who+1} 获得一张阴谋`);for(const other of t.drawn)if(other!==id)put(s,'return_plot',t.who,{id:other});break;
case 'return_plot':if(value==='top')s.plotDeck.unshift(t.id);else s.plotDeck.push(t.id);break;
case 'curia':triggerPlot(s,id,t.who,true);break;
case 'snake':{const before=s.players.map(science);p.snake=id;scienceChange(s,before);break;}
case 'zeus':takeBoard(s,id,t.who,'discard');reveal(s,t.who);break;
case 'discard_board':takeBoard(s,id,t.who,'discard');reveal(s,t.who);break;
case 'free_board':{const cid=takeBoard(s,id,t.who,'take');build(s,cid,t.who);break;}
case 'steal_wonder':o.wonders.splice(o.wonders.indexOf(id),1);p.wonders.push(id);log(s,`玩家 ${t.who+1} 夺取未建奇迹「${W[id].name}」`);break;
case 'anubis':{const [who,wid]=value.split(':').map(Number);tearWonder(s,who,wid,false);break;}
case 'sabotage':tearWonder(s,1-t.who,id,true);break;
case 'isis':put(s,'free_wonder',t.who,{card:id});break;
case 'free_wonder':s.discard.splice(s.discard.indexOf(t.card),1);wonder(s,id,t.card,t.who);break;
case 'minerva':s.minerva=id;break;
case 'neptune_discard':s.raids.push(value);put(s,'neptune_apply',t.who);break;
case 'neptune_apply':raid(s,value,t.who);break;
case 'gate':case 'theater_god':{const deck=s.mythDecks[G[id].myth];deck.splice(deck.indexOf(id),1);if(t.candidates.includes(0)&&id!==0){s.box.push(...s.enki);s.enki=[];}activateGod(s,id,t.who);if(t.type==='theater_god'&&deck.length>1)put(s,'reorder_gods',t.who,{myth:t.myth,remaining:[...deck],ordered:[]});break;}
case 'theater':put(s,'theater_god',t.who,{myth:id});break;
case 'reorder_gods':{const remaining=t.remaining.filter(x=>x!==id),ordered=[...t.ordered,id];if(remaining.length>1)put(s,'reorder_gods',t.who,{myth:t.myth,remaining,ordered});else s.mythDecks[t.myth]=ordered.concat(remaining);break;}
case 'lock_token':put(s,'lock_select',t.who,{pool:value});break;
case 'lock_select':{const pool=t.pool==='board'?s.tokens:t.pool==='opponent'?o.tokens:s.box;pool.splice(pool.indexOf(id),1);s.sealed.push(id);log(s,`玩家 ${t.who+1} 封存${t.pool==='box'?'一枚秘密标记':`「${T[id].name}」`}`);break;}
case 'exchange':put(s,'exchange_get',t.who,{give:id});break;
case 'exchange_get':{const before=s.players.map(science);p.cards.splice(p.cards.indexOf(t.give),1,id);o.cards.splice(o.cards.indexOf(id),1,t.give);if(p.snake===id)p.snake=null;if(o.snake===t.give)o.snake=null;log(s,`交换「${C[t.give].name}」与「${C[id].name}」`);scienceChange(s,before);break;}
case 'decree':{const [from,did]=value.split(':').map(Number);put(s,'decree_to',t.who,{from,id:did});break;}
case 'decree_to':senateChange(s,()=>{s.chambers[t.from].decrees.splice(s.chambers[t.from].decrees.indexOf(t.id),1);s.chambers[id].decrees.push(t.id);if(s.chambers[t.from].up)s.chambers[id].up=true;});break;
default:throw Error('无法处理选项 '+t.type);
}}
return {create,draft,quote,score,action,choose,starter,available,science,count,assets,layout,owner,decree,totalMoney,canWonder,godCost,invoke,trigger,has};
})();
if(typeof module!=='undefined')module.exports=Engine;
