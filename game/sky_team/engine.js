(function(root){
'use strict';
const D=typeof module!=='undefined'?require('./scenarios.js'):root.SkyData;
const roll=()=>1+Math.floor(Math.random()*6),trafficRoll=()=>[2,3,3,4,4,5][Math.floor(Math.random()*6)];
const clone=x=>JSON.parse(JSON.stringify(x));
const has=(s,m)=>s.config.modules.includes(m),ability=(s,a)=>s.abilities.includes(a);
const endPos=s=>s.traffic.length-1,altitude=s=>6000-s.round*1000;
const windRing=[3,3,2,2,1,0,-1,-2,-2,-3,-3,-3,-2,-2,-1,0,1,2,2,3];
const wind=s=>has(s,'wind')?windRing[((s.windPos+(has(s,'headwind')?10:0))%20+20)%20]:0;
const brakePower=s=>has(s,'ice')?(s.ice?1+s.ice:0):s.brake.filter(Boolean).length*2;
const alarmDefs=[{kind:'coffee',p:null,v:1,label:'专注'},{kind:'brake',p:1,v:2,label:'刹车'},{kind:'gear',p:1,v:3,label:'起落架'},{kind:'flap',p:0,v:4,label:'襟翼'},{kind:'radio0',p:1,v:5,label:'机长无线电'},{kind:'radio1',p:0,v:6,label:'副驾驶无线电'}];
const baseSlots=[...['axis','engine'].flatMap(kind=>[0,1].map(p=>({id:kind+p,kind,p,label:kind==='axis'?'轴线':'引擎'}))),{id:'radio0',kind:'radio',p:0,label:'无线电'},{id:'radio1',kind:'radio',p:1,label:'无线电 ①'},{id:'radio2',kind:'radio',p:1,label:'无线电 ②'},...[0,1,2].map(i=>({id:'gear'+i,kind:'gear',p:0,i,values:[i*2+1,i*2+2],label:'起落架'})),...[0,1,2,3].map(i=>({id:'flap'+i,kind:'flap',p:1,i,values:[[1,2],[2,3],[4,5],[5,6]][i],label:'襟翼 '+(i+1)})),...[0,1,2].map(i=>({id:'brake'+i,kind:'brake',p:0,i,values:[2+i*2],label:'刹车 '+(i+1)})),...[0,1,2].map(i=>({id:'coffee'+i,kind:'coffee',p:null,label:'专注'}))];
function slots(s){let a=baseSlots.filter(a=>!(has(s,'ice')&&a.kind==='brake')&&!(has(s,'glide')&&a.kind==='engine')&&!(has(s,'stuckGear')&&a.kind==='gear'));
if(has(s,'fuel')&&!has(s,'leak'))a.push({id:'fuel',kind:'fuel',p:null,label:'燃油管理'});
if(has(s,'intern'))a.push(...[0,1].map(p=>({id:'intern'+p,kind:'intern',p,label:'培训实习生'})));
if(has(s,'ice'))for(let i=0;i<4;i++)for(let row=0;row<2;row++)a.push({id:`ice${i}_${row}`,kind:'ice',p:row===0?0:null,i,row,values:[i+2],label:`冰刹 ${i+2} · ${row===0?'机长':'共享'}`});
s.alarms.forEach((status,i)=>{if(status===1){const d=alarmDefs[i];a.push({id:'alarm'+i,kind:'alarm',i,p:d.p,values:[d.v],label:'修复'+d.label});}});return a;}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function fresh(config=D.presets[0],abilities=[]){config=clone(config);const start=config.start??6000;return {version:2,config,abilities:abilities.slice(0,config.abilityCount),round:(6000-start)/1000,pos:0,traffic:config.route.map(c=>c.planes),axis:0,gear:[false,false,false],flap:[false,false,false,false],brake:[false,false,false],ice:0,coffee:0,rerolls:0,phase:'brief',prepared:false,turn:0,dice:[[],[]],placed:{},log:[config.name+' · 双人合作'],result:null,speed:null,fuel:20,windPos:0,intern:has({config},'intern')?shuffle([1,2,3,4,5,6]):[],alarms:alarmDefs.map((a,i)=>has({config},'stuckGear')&&![0,3,5].includes(i)?2:0),alarmOrder:shuffle([0,1,2,3,4,5]),pending:null,used:[0,0],reserve:[0,0],adapted:[false,false],swapUsed:false,anticipationUsed:false,syncUsed:false,deadline:null,silent:false};}
function log(s,t){s.log.unshift(t);s.log=s.log.slice(0,160);}
function lose(s,msg){s.phase='over';s.result=msg;s.pending=null;s.deadline=null;log(s,'着陆失败：'+msg);return s;}
function prepare(s){if(s.phase!=='brief'||s.prepared)return;let c=s.config.route[s.pos];for(let i=0;i<c.traffic;i++){if(s.traffic.reduce((a,b)=>a+b,0)>=12)break;let v=trafficRoll(),target=Math.min(endPos(s),s.pos+v-1);s.traffic[target]++;log(s,`交通骰 ${v}：第 ${target+1} 格增加飞机`);}if(has(s,'alarms')&&c.alarm){let i=s.alarmOrder.find(i=>s.alarms[i]===0);if(i!==undefined){s.alarms[i]=1;log(s,`警报：${alarmDefs[i].label}失效`);}}s.prepared=true;}
function weather(s){return s.config.weather[altitude(s)]||'';}
function start(s,now=Date.now()){if(s.phase!=='brief')return false;prepare(s);s.phase='play';s.turn=s.round%2;s.first=s.turn;s.placed={};s.used=[0,0];s.pending=null;s.speed=null;s.engineSafe=null;s.syncUsed=false;s.swapUsed=false;s.anticipationUsed=false;s.reserve=weather(s).includes('V')?[2,2]:[0,0];s.dice=[Array.from({length:s.reserve[0]?2:4},roll),Array.from({length:s.reserve[1]?2:4},roll)];if(s.config.rerollAt.includes(altitude(s)))s.rerolls++;s.deadline=has(s,'realtime')?now+60000:null;log(s,`${altitude(s)} 英尺 · ${s.turn?'副驾驶':'机长'}先手`);return true;}
function blocked(s,a){return s.alarms.some((n,i)=>n===1&&(alarmDefs[i].kind===a.kind||(a.kind==='ice'&&alarmDefs[i].kind==='brake')||(a.kind==='radio'&&alarmDefs[i].kind==='radio'+a.p)));}
function tokenValue(s){return s.pending?.v;}
function validValue(s,a,v,p,mode='normal'){
if(!a||s.placed[a.id]||v<1||v>6)return false;if(mode!=='sync'&&a.p!==null&&a.p!==p)return false;
if(a.values&&!a.values.includes(v))return false;
if(['flap','brake'].includes(a.kind)&&a.i>0&&!s[a.kind][a.i-1])return false;
if(a.kind==='ice'&&a.i!==s.ice)return false;
if(a.kind==='intern'){if(mode!=='normal'||!s.intern.length)return false;let t=p?s.intern.at(-1):s.intern[0];if(t===v)return false;}
if(mode==='intern'&&['coffee','intern'].includes(a.kind))return false;
if(mode==='sync'&&['intern','fuel','alarm'].includes(a.kind))return false;
return true;}
function valid(s,id,index,delta=0){if(s.phase!=='play'||!Number.isInteger(delta))return false;let mode=s.pending?.kind||'normal',v=s.pending?s.pending.v:s.dice[s.turn][index];if(!v||Math.abs(delta)>s.coffee||mode==='intern'&&delta!==0)return false;return validValue(s,slots(s).find(a=>a.id===id),v+delta,s.turn,mode);}
function burn(s,n){s.fuel-=n;log(s,`消耗燃油 ${n}，剩余 ${s.fuel}`);if(s.fuel<=0)lose(s,'燃油耗尽。');}
function advance(s,n){while(n-->0&&s.phase==='play'){const c=s.config.route[s.pos];if(s.traffic[s.pos])return lose(s,'离开有飞机的航路格，发生碰撞。');if(s.pos===endPos(s))return lose(s,'飞越机场。');if(c.turns&&!c.turns.includes(s.axis))return lose(s,`第 ${s.pos+1} 格要求轴线 ${c.turns.join('/')}，实际为 ${s.axis}。`);s.pos++;}}
function effect(s,a,v,p){if(a.kind==='alarm'){s.alarms[a.i]=2;delete s.placed[a.id];log(s,'已修复'+alarmDefs[a.i].label);return;}
if(blocked(s,a)){log(s,a.label+'被警报禁用，本次放置无效');return;}
if(['gear','flap','brake'].includes(a.kind))s[a.kind][a.i]=true;
if(a.kind==='coffee')s.coffee=Math.min(3,s.coffee+1);
if(a.kind==='fuel')burn(s,v);
if(a.kind==='radio'){let i=s.pos+v-1;if(s.traffic[i]>0){s.traffic[i]--;log(s,`第 ${i+1} 格移除一架飞机`);}}
if(a.kind==='ice'&&s.placed[`ice${a.i}_0`]&&s.placed[`ice${a.i}_1`]){s.ice++;log(s,`冰面刹车完成 ${s.ice}/4`);}
if(a.kind==='axis'&&s.placed.axis0&&s.placed.axis1){let x=s.placed.axis0.v,y=s.placed.axis1.v;s.axis+=y-x;if(Math.abs(s.axis)>=3){lose(s,'机身倾斜达到失控范围。');return;}if(has(s,'wind'))s.windPos=(s.windPos+s.axis+20)%20;if(ability(s,'control')&&x===y)s.coffee=Math.min(3,s.coffee+1);}
if(a.kind==='engine'&&s.placed.engine0&&s.placed.engine1){let x=s.placed.engine0.v,y=s.placed.engine1.v;s.speed=x+y+wind(s);if(ability(s,'mastery')&&x===y){let reserved=s.config.rerollAt.filter(h=>h<altitude(s)).length;if(s.rerolls+reserved<3){s.rerolls++;log(s,'精通：获得重掷标记');}}if(has(s,'leak'))burn(s,Math.abs(x-y)+1);if(s.phase==='over')return;
if(s.round===6){s.engineSafe=s.speed<=brakePower(s);if(!has(s,'ice')&&!s.engineSafe)lose(s,'接地速度超过放置引擎时的刹车能力。');}else{let low=4+s.gear.filter(Boolean).length,high=8+s.flap.filter(Boolean).length;advance(s,s.speed<=low?0:s.speed<=high?1:2);}}
}
function finishRound(s){if(s.phase!=='play')return;const required=has(s,'glide')?['axis0','axis1']:['axis0','axis1','engine0','engine1'];if(!required.every(k=>s.placed[k]))return lose(s,'本轮未完成必需的轴线或引擎操作。');if(has(s,'fuel')&&!has(s,'leak')&&!s.placed.fuel)burn(s,6);if(s.phase==='over')return;if(has(s,'glide')&&s.round<6)advance(s,1);if(s.phase==='over')return;
if(s.round===6){const missing=[];if(s.axis!==0)missing.push('机身未水平');if(s.traffic.some(Boolean))missing.push('航路仍有飞机');if(!has(s,'stuckGear')&&!s.gear.every(Boolean))missing.push('起落架未全部展开');if(!s.flap.every(Boolean))missing.push('襟翼未全部展开');if(has(s,'intern')&&s.intern.length)missing.push('实习生培训未完成');if(has(s,'ice')&&(s.ice!==4||(!has(s,'glide')&&s.speed>brakePower(s))))missing.push('冰面刹车或接地速度不合格');if(missing.length)return lose(s,missing.join('；')+'。');s.phase='over';s.result='成功着陆';s.deadline=null;log(s,'成功着陆！');return;}
s.round++;s.deadline=null;s.pending=null;s.dice=[[],[]];s.reserve=[0,0];if(s.round===6&&s.pos!==endPos(s))return lose(s,'高度耗尽前未到达机场。');s.silent=!!s.config.route[s.pos].silent;s.phase='brief';s.prepared=false;prepare(s);}
function afterAction(s,p){if(s.phase==='over')return;const goal=has(s,'glide')?3:4;
if(s.used.every(n=>n>=goal)){finishRound(s);return;}s.turn=s.used[1-p]<goal?1-p:p;}
function maybeSync(s,returnPlayer){if(!ability(s,'synchronisation')||s.syncUsed||!Object.keys(s.placed).some(k=>k.startsWith('gear'))||!Object.keys(s.placed).some(k=>k.startsWith('flap')))return false;s.syncUsed=true;s.pending={kind:'sync',v:trafficRoll(),returnPlayer};s.turn=1;log(s,'同步：副驾驶放置额外交通骰');return true;}
function place(s,id,index,delta=0,now=Date.now()){if(expire(s,now)||!valid(s,id,index,delta))return false;let a=slots(s).find(a=>a.id===id),p=s.turn,pending=s.pending,mode=pending?.kind||'normal',v=(pending?pending.v:s.dice[p][index])+delta;
s.coffee-=Math.abs(delta);s.placed[id]={v,p,kind:mode};log(s,`${p?'副驾驶':'机长'} · ${a.label} ${v}${mode!=='normal'?'（'+(mode==='sync'?'同步':'实习生')+'）':''}`);
if(mode==='normal'){s.dice[p][index]=null;s.used[p]++;if(s.reserve[p]){s.dice[p][index]=roll();s.reserve[p]--;}if(weather(s).includes('T'))s.dice[p]=s.dice[p].map(v=>v?roll():null);}
if(a.kind==='intern'){let v=p?s.intern.pop():s.intern.shift();s.pending={kind:'intern',v,returnPlayer:p};return true;}
s.pending=null;effect(s,a,v,p);if(s.phase==='over')return true;
let returnPlayer=pending?.returnPlayer??p;
if(maybeSync(s,returnPlayer))return true;
afterAction(s,returnPlayer);return true;}
function discardPending(s,now=Date.now()){if(expire(s,now)||!s.pending)return false;const p=s.pending.returnPlayer;log(s,'放弃'+(s.pending.kind==='intern'?'实习生标记':'同步骰'));s.pending=null;if(maybeSync(s,p))return true;afterAction(s,p);return true;}
function expire(s,now=Date.now()){if(s.phase==='play'&&s.deadline&&now>=s.deadline){log(s,'60 秒已到，未放置骰子作废');s.pending=null;s.dice=[[],[]];finishRound(s);return true;}return false;}
function useAbility(s,kind,index,otherIndex,now=Date.now()){if(expire(s,now)||s.phase!=='play'||s.pending||!ability(s,kind)||!s.dice[s.turn][index])return false;let p=s.turn;if(kind==='adaptation'){if(s.adapted[p])return false;s.dice[p][index]=7-s.dice[p][index];s.adapted[p]=true;}else if(kind==='anticipation'){if(s.anticipationUsed||s.used.some(Boolean)||p!==s.first)return false;s.dice[p][index]=roll();s.anticipationUsed=true;}else if(kind==='workingTogether'){if(s.swapUsed||!s.dice[1-p][otherIndex])return false;[s.dice[p][index],s.dice[1-p][otherIndex]]=[s.dice[1-p][otherIndex],s.dice[p][index]];s.swapUsed=true;}else return false;log(s,'使用能力：'+D.abilities[kind][0]);return true;}
function reroll(s,choices,now=Date.now()){if(expire(s,now)||s.phase!=='play'||s.pending||s.rerolls<1||!choices.flat().length)return false;for(let p=0;p<2;p++)if(choices[p].some(i=>!s.dice[p][i])||new Set(choices[p]).size!==choices[p].length)return false;s.rerolls--;for(let p=0;p<2;p++)for(let i of choices[p])s.dice[p][i]=roll();log(s,'双方使用 1 枚重掷标记');return true;}
function validateConfig(c){if(!c||!Array.isArray(c.route)||c.route.length<2||c.route.length>13)throw Error('航路需要 2–13 格。');if(![5000,6000].includes(c.start))throw Error('初始高度须为 5000 或 6000。');if(!Array.isArray(c.modules)||c.modules.some(k=>!D.modules[k]))throw Error('包含未知模块。');if(has({config:c},'glide')&&(has({config:c},'fuel')||has({config:c},'leak')))throw Error('无动力滑翔不能与燃油管理或漏油同时启用。');if(has({config:c},'headwind')&&!has({config:c},'wind'))throw Error('逆风需要启用风向。');if(!Number.isInteger(c.abilityCount)||c.abilityCount<0||c.abilityCount>6)throw Error('能力数量须为 0–6。');if(!Array.isArray(c.rerollAt)||c.rerollAt.length>3||new Set(c.rerollAt).size!==c.rerollAt.length||c.rerollAt.some(h=>![0,1000,2000,3000,4000,5000,6000].includes(h)))throw Error('重掷高度配置无效。');if(!c.weather||typeof c.weather!=='object'||Object.entries(c.weather).some(([h,v])=>![0,1000,2000,3000,4000,5000,6000].includes(+h)||!['','T','V','TV'].includes(v)))throw Error('天气配置无效。');for(const x of c.route){if(!Number.isInteger(x.planes)||x.planes<0||x.planes>12||!Number.isInteger(x.traffic)||x.traffic<0||x.traffic>6||x.turns&&(!Array.isArray(x.turns)||!x.turns.length||x.turns.some(v=>!Number.isInteger(v)||Math.abs(v)>2)))throw Error('航路格数据无效。');}if(c.route.reduce((n,x)=>n+x.planes,0)>12)throw Error('初始飞机总数不能超过 12。');return true;}
const api={slots,baseSlots,fresh,start,prepare,valid,place,roll,trafficRoll,wind,windRing,brakePower,has,ability,altitude,endPos,weather,blocked,alarmDefs,finishRound,expire,useAbility,reroll,discardPending,validateConfig};root.Sky=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
