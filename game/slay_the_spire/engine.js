'use strict';
const SAVE_KEY='sts-tabletop-v2';
let S, notify='';
function random(){S.seed=(Math.imul(1664525,S.seed)+1013904223)>>>0;return S.seed/4294967296}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function pick(a){return a[Math.floor(random()*a.length)]}
function makeCard(id,upgraded=false){return {id,upgraded,uid:++S.serial}}
function cardSpec(c){const d=CARD_DATA[c.id];return {...d,...(c.upgraded?d.up:{})}}
function log(t){S.log.unshift(t);S.log.length=Math.min(60,S.log.length)}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S))}catch{notify='无法写入浏览器存档；本次游戏仍可继续。'}}
function emit(){save();if(typeof render==='function')render()}
function newGame(seed=Date.now()>>>0){
 S={version:2,seed,serial:0,phase:'neow',floor:-1,node:null,round:0,die:1,room:null,players:[],enemies:[],log:[],visited:[],boss:'guardian',pendingRoute:[null,null]};
 S.boss=pick(['guardian','hexaghost','slimeBoss']);
 S.relicDeck=shuffle(Object.keys(RELIC_DATA));
 S.potionDeck=shuffle(Object.keys(POTION_DATA).flatMap(id=>[id,id]));
 S.firstDeck=shuffle(Object.keys(ENCOUNTERS).filter(k=>ENCOUNTERS[k].first));
 S.encounterDeck=shuffle(Object.keys(ENCOUNTERS).filter(k=>!ENCOUNTERS[k].first));
 S.eliteDeck=shuffle(['nob','lagavulin','sentries']);
 S.eventDeck=shuffle(['livingWall','cleric','upgradeShrine','purification']);
 S.summons={largeSummon:shuffle(['4SW','SW4','W4S','W4S']),acid:shuffle(['CAL','LCA','ALC','LAC']),green:shuffle(['1W2','21W']),spike:shuffle(['2DV','V2D','DV2','VD2'])};
 S.players=[0,1].map(i=>{
  const deck=[...Array.from({length:5},()=>makeCard('strike')),...Array.from({length:i?5:4},()=>makeCard('defend')),makeCard(i?'survivor':'bash'),...(i?[makeCard('neutral')]:[])];
  const rewards=Object.entries(CARD_DATA).filter(([,c])=>c.owner===i&&['common','uncommon'].includes(c.rarity)).flatMap(([id,c])=>Array(c.rarity==='common'?2:1).fill(id));
  const rares=Object.keys(CARD_DATA).filter(id=>CARD_DATA[id].owner===i&&CARD_DATA[id].rarity==='rare');
  return {id:i,name:i?'静默猎手':'铁甲战士',row:i,hp:i?9:10,max:i?9:10,gold:5,deck,draw:[],hand:[],discard:[],exhaust:[],powers:[],energy:3,block:0,str:0,weak:0,vulnerable:0,dex:0,shiv:0,relics:[],potions:[],rewardDeck:shuffle([...rewards,'ticket','ticket']),rareDeck:shuffle(rares),neow:pick(NEOW_CARDS),tasks:[],offers:[],ready:false,done:false,target:null,targetRow:i};
 });
 const layout=pick(MAP_LAYOUTS);const dark=shuffle(['E','E','E','M','M','M','?','?']),light=shuffle(['M','?','$','$','R','R','R']);
 S.map=[];layout.rows.forEach((row,y)=>[...row].forEach((symbol,x)=>{if(symbol!=='.')S.map.push({id:`${y}-${x}`,x,y,type:symbol==='D'?dark.pop():symbol==='L'?light.pop():symbol})}));S.edges=layout.edges;
 log('双方各获得 5 金币，独立选择涅奥祝福。');notify='';emit();
}
function cycle(deck){const id=deck.shift();if(id!==undefined)deck.push(id);return id}
function popRelic(){return S.relicDeck.shift()}
function addTask(p,task){p.tasks.push(task)}
function revealCards(p,rare=false){
 const offers=[];const deck=rare?p.rareDeck:p.rewardDeck;
 const count=Math.min(3,deck.length);
 for(let k=0;k<count;k++){
  const id=deck.shift();
  if(id==='ticket'){deck.push(id);if(p.rareDeck.length)offers.push({card:makeCard(p.rareDeck.shift()),rare:true})}
  else if(id)offers.push({card:makeCard(id),rare});
 }
 return offers;
}
function returnOffer(p,o){(o.rare?p.rareDeck:p.rewardDeck).push(o.card.id)}
function primeTasks(p){for(const t of p.tasks){if(t.type==='cards'&&!t.offers)t.offers=revealCards(p,t.rare);if(t.type==='relic'&&!t.id)t.id=popRelic();if(t.type==='potion'&&!t.id)t.id=S.potionDeck.shift()}}
function beginTask(p){
 if(p.pending)return;
 const task=p.tasks.shift();
 if(!task){p.done=true;checkDone();return}
 if(task.type==='cards'){const offers=task.offers||revealCards(p,task.rare);if(!offers.length){beginTask(p);return}p.pending={...task,offers};}
 else if(task.type==='relic'){const id=task.id||popRelic();if(id)p.pending={...task,id};else{log('本版本遗物牌堆已空。');beginTask(p)}}
 else if(task.type==='potion'){const id=task.id||S.potionDeck.shift();if(id)p.pending={...task,id};else beginTask(p)}
 else if(['upgrade','remove','transform'].includes(task.type)){
  const eligible=p.deck.filter(c=>task.type==='upgrade'?!!CARD_DATA[c.id].up&&!c.upgraded:task.type==='transform'?CARD_DATA[c.id].type!=='curse':true);
  if(!eligible.length)beginTask(p);else p.pending=task;
 }
 else if(task.type==='randomRare'){const id=p.rareDeck.shift();if(id)p.deck.push(makeCard(id));beginTask(p)}
 else if(task.type==='randomUpgrade'){const candidates=shuffle(p.deck.filter(c=>CARD_DATA[c.id].up&&!c.upgraded));candidates.slice(0,2).forEach(c=>c.upgraded=true);beginTask(p)}
}
function checkDone(){if(S.players.every(p=>p.done)){
 if(S.phase==='neow'){S.phase='map';S.players.forEach(p=>p.done=false)}
 else if(S.phase==='reward'&&S.room==='B'){S.phase='won';log('第一幕首领已击败！')}
 else if(['reward','room'].includes(S.phase)){S.phase='map';S.players.forEach(p=>p.done=false);S.pendingRoute=[null,null]}
}}
function finishPending(p){p.pending=null;beginTask(p)}
function choosePending(i,value){const p=S.players[i],t=p.pending;if(!t||S.phase==='combat')return;
 if(t.type==='cards'){
  const selected=t.offers.find(o=>o.card.uid===Number(value));if(value!=='skip'&&!selected)return;
  for(const o of t.offers){if(o===selected){p.deck.push(o.card);log(`${p.name}获得${cardSpec(o.card).name}。`)}else returnOffer(p,o)}
 }else if(t.type==='relic'){if(value==='take')p.relics.push(t.id);else S.relicDeck.push(t.id)}
 else if(t.type==='potion'){
  const recipient=value==='give'?S.players[1-i]:p;
  if(value==='take'||value==='give'){if(recipient.potions.length>=3){notify='药水上限为 3；可先使用或丢弃已有药水。';emit();return}recipient.potions.push({id:t.id,uid:++S.serial})}else S.potionDeck.push(t.id);
 }else {
  if(value!=='skip'){
   const c=p.deck.find(c=>c.uid===Number(value));if(!c)return;
   if(t.type==='upgrade'){if(c.upgraded||!CARD_DATA[c.id].up)return;c.upgraded=true}
   else if(t.type==='remove')p.deck=p.deck.filter(x=>x!==c);
   else if(t.type==='transform'){if(CARD_DATA[c.id].type==='curse')return;p.deck=p.deck.filter(x=>x!==c);let id=p.rewardDeck.shift();if(id==='ticket'){p.rewardDeck.push(id);id=p.rareDeck.shift()}if(id)p.deck.push(makeCard(id))}
   if(t.shop)p.removed=true;
  }else if(t.shop){p.gold+=t.refundOwn;S.players[1-i].gold+=t.refundOther}
 }
 if(t.shop){p.pending=null;p.done=false}else finishPending(p);notify='';emit();
}
function neow(i,index){const p=S.players[i];if(S.phase!=='neow'||p.done||p.pending||p.chosenNeow)return;const code=p.neow[index];if(!code)return;
 const cost=code[0];if(cost==='G'&&teamGold()<3)return;if(cost==='D'&&p.hp<=2||cost==='3'&&p.hp<=3)return;
 if(cost==='G')pay(p,3);if(cost==='D')p.hp-=2;if(cost==='3')p.hp-=3;p.chosenNeow=code;
 const reward=code[1];const tasks={u:[{type:'upgrade'}],r:[{type:'remove'}],t:[{type:'transform'}],R:[{type:'remove'},{type:'remove'}],T:[{type:'transform'},{type:'transform'}],U:[{type:'randomUpgrade'}],P:Array.from({length:3},()=>({type:'potion'})),'?':[{type:'randomRare'}],c:[{type:'cards'}],'%':[{type:'relic'}]};
 if(reward==='X')p.gold+=10;if(reward==='5')p.gold+=5;p.tasks.push(...(tasks[reward]||[]));beginTask(p);emit();
}
function availableNodes(){return S.node?S.edges.filter(e=>e[0]===S.node).map(e=>e[1]):['0-3']}
function voteRoute(i,id){if(S.phase!=='map'||!availableNodes().includes(id))return;S.pendingRoute[i]=id;if(S.pendingRoute.every(x=>x===id))enterNode(id);else emit()}
function enterNode(id){const node=S.map.find(n=>n.id===id);if(!node)return;S.node=id;S.floor=node.y;S.visited.push(id);S.room=node.type;S.players.forEach(p=>{p.done=false;p.pending=null;p.tasks=[];p.removed=false});notify='';
 if(['M','E','B'].includes(node.type))startCombat();else{
  S.phase='room';
  if(node.type==='T'){S.players.forEach(p=>{p.tasks=[{type:'relic'}];beginTask(p)})}
  if(node.type==='?')S.event=cycle(S.eventDeck);
  if(node.type==='$'){S.shop={relics:S.relicDeck.splice(0,3),potions:S.potionDeck.splice(0,3)};S.players.forEach(p=>p.shopCards=revealCards(p))}
  emit();
 }
}
function swapRows(){if(S.phase!=='map')return;S.players.forEach(p=>p.row=1-p.row);log('双方交换站位。');emit()}
function summon(id,row,behavior){const d=ENEMY_DATA[id];const e={...d,id,uid:++S.serial,row,hp:d.hp,max:d.hp,block:0,str:0,weak:0,vulnerable:0,poison:0,curl:d.curl||0,behavior:behavior||d.behavior,step:0};
 if(S.summons[id]&&!behavior)e.behavior=cycle(S.summons[id]);return e;
}
function startCombat(){
 S.phase='combat';S.round=0;S.spawnWave=false;S.queuedSummons=[];S.enemies=[];S.rewards=[null,null];S.combatDeckIds=[];
 if(S.room==='B'){S.enemies=[summon(S.boss,-1)];S.rewards=S.players.map(()=>({gold:3,rare:true}))}
 else if(S.room==='E'){const id=cycle(S.eliteDeck);S.enemies=id==='sentries'?[summon('sentryA',0),summon('sentryB',0),summon('sentries',0),summon('sentryA',1),summon('sentryB',1),summon('sentryA',1)]:[summon(id,0)];S.rewards=S.players.map(()=>({gold:2,relic:true}))}
 else{
  const deck=S.floor===0?S.firstDeck:S.encounterDeck;
  S.players.forEach(p=>{const id=deck.shift();S.combatDeckIds.push(id);const entry=ENCOUNTERS[id];S.rewards[p.id]={gold:entry.gold,potion:entry.potion};entry.enemies.forEach(([eid,b])=>S.enemies.push(summon(eid,p.row,b)))});
 }
 S.players.forEach(p=>{p.draw=shuffle(p.deck);p.hand=[];p.discard=[];p.exhaust=[];p.powers=[];p.str=0;p.dex=0;p.weak=0;p.vulnerable=0;p.shiv=0;p.pending=null;p.tempStrength=0;p.target=S.enemies.find(e=>e.row===p.row)?.uid||S.enemies[0].uid;p.targetRow=p.row});
 log(`进入${ROOM_NAMES[S.room]}。`);nextRound();
}
function draw(p,n){if(p.noDraw)return;for(let i=0;i<n;i++){if(!p.draw.length){p.draw=shuffle(p.discard);p.discard=[]}if(p.draw.length)p.hand.push(p.draw.pop())}}
function addBlock(p,n){p.block=Math.min(20,p.block+n)}
function addEnergy(p,n){p.energy=Math.min(6,p.energy+n)}
function addToken(entity,key,n){entity[key]=Math.min(key==='str'?8:3,entity[key]+n)}
function addPoison(e,n){const total=S.enemies.reduce((sum,x)=>sum+x.poison,0);e.poison+=Math.max(0,Math.min(n,30-total))}
function nextRound(){if(S.spawnWave){S.spawnWave=false;for(const row of [0,1])for(const id of ['largeSummon','acid','spike'])S.enemies.push(summon(id,row));log('史莱姆老大分裂：每行召唤三只史莱姆。')}for(const q of S.queuedSummons||[])S.enemies.push(summon(q.id,q.row));S.queuedSummons=[];S.round++;S.die=1+Math.floor(random()*6);S.players.forEach(p=>{
 p.ready=false;p.block=0;p.energy=3;p.noDraw=false;p.tempStrength=0;draw(p,5+(p.id===1&&S.round===1?2:0));
 if(S.round===1){if(p.relics.includes('anchor'))addBlock(p,2);if(p.relics.includes('lantern'))addEnergy(p,1);if(p.relics.includes('bloodVial'))p.hp=Math.min(p.max,p.hp+1)}
 if(p.relics.includes('flower')&&[3,4].includes(S.die))addEnergy(p,1);
 if(p.relics.includes('stone')&&S.die===4)addBlock(p,2);
 if(p.relics.includes('vajra')&&S.die===2&&p.str<8){addToken(p,'str',1);p.tempStrength=1}
 });retarget();log(`第 ${S.round} 回合，骰子 ${S.die}。`);emit();}
function retarget(){S.players.forEach(p=>{if(!S.enemies.some(e=>e.uid===p.target&&e.hp>0))p.target=S.enemies.find(e=>e.hp>0)?.uid||null})}
function hurt(entity,n,ignoreBlock=false){const loss=ignoreBlock?n:Math.max(0,n-entity.block);if(!ignoreBlock)entity.block=Math.max(0,entity.block-n);entity.hp=Math.max(0,entity.hp-loss);
 if(entity.id==='slimeBoss'&&entity.hp===0&&!entity.dead)S.spawnWave=true;
 if(entity.id==='fungi'&&entity.hp===0&&!entity.dead){const p=S.players.find(p=>p.row===entity.row);addToken(p,'vulnerable',1)}
 if(entity.max&&entity.hp===0){entity.dead=true;entity.poison=entity.weak=entity.vulnerable=entity.str=entity.block=0;entity.curl=0}
 if(entity.max&&entity.hp>0&&n>0&&!ignoreBlock&&entity.curl){entity.block+=entity.curl;entity.curl=0}
 if(S.players.some(p=>p.hp===0)){S.phase='lost';log('一名角色生命归零，全队失败。')}
 return loss;
}
function attack(attacker,targets,base,hits=1,multiplier=1){const weak=attacker.weak>0;
 for(const target of targets){if(!target.hp)continue;const vuln=target.vulnerable>0;let damage=base+(attacker.str||0)*multiplier;
  if(weak&&!vuln)damage=Math.max(0,damage-1);if(vuln&&!weak)damage*=2;
  for(let h=0;h<hits&&target.hp&&S.phase!=='lost';h++)hurt(target,damage);
  if(vuln&&target.hp)target.vulnerable--;
 }
 if(weak)attacker.weak--;
}
function canAct(p){return S.phase==='combat'&&!p.ready&&!p.pending}
function play(i,uid,mode){const p=S.players[i];if(!canAct(p))return;const c=p.hand.find(c=>c.uid===uid);if(!c)return;let x=cardSpec(c);if(x.cost===null||x.cost>p.energy)return;
 const target=S.enemies.find(e=>e.uid===p.target&&e.hp);if((x.hit||x.weak||x.vulnerable||x.poison)&&!target)return;
 if(x.mode&&!mode){p.pending={type:'mode',uid};emit();return}if(x.mode)x={...x,hit:mode==='attack'?2:1,block:mode==='block'?2:1};
 p.hand=p.hand.filter(q=>q!==c);p.energy-=x.cost; // Card is out of all piles while it resolves.
 const targets=x.area?S.enemies.filter(e=>e.hp&&(e.boss||e.row===p.targetRow)):[target];
 if(x.loseHP)hurt(p,x.loseHP,true);if(S.phase==='lost'){emit();return}
 if(x.hit)attack(p,targets,x.hit,x.hits||1,x.strengthMultiplier||1);
 if(x.block)addBlock(p,x.block+p.dex);
 if(target?.hp){if(x.weak)addToken(target,'weak',x.weak);if(x.vulnerable)addToken(target,'vulnerable',x.vulnerable);if(x.poison)addPoison(target,x.poison)}
 if(x.strength)addToken(p,'str',x.strength);if(x.dexterity)p.dex+=x.dexterity;
 if(x.energy)addEnergy(p,x.energy);if(x.draw)draw(p,x.draw);if(x.noDraw)p.noDraw=true;
 if(x.shiv){const overflow=Math.max(0,p.shiv+x.shiv-5);p.shiv=Math.min(5,p.shiv+x.shiv);if(overflow)p.overflowShivs=(p.overflowShivs||0)+overflow}
 (x.type==='power'?p.powers:x.exhaust?p.exhaust:p.discard).push(c);
 log(`${p.name}打出${x.name}${c.upgraded?'+':''}。`);
 // Post-card triggers run after the chosen discard finishes.
 if(x.discard&&p.hand.length){p.pending={type:'discard',count:Math.min(x.discard,p.hand.length),cardType:x.type}}
 else afterCard(p,x.type);
 retarget();emit();
}
function modeChoice(i,mode){const p=S.players[i],t=p.pending;if(t?.type!=='mode')return;p.pending=null;play(i,t.uid,mode)}
function discardChoice(i,uid){const p=S.players[i],t=p.pending;if(S.phase!=='combat'||t?.type!=='discard')return;const c=p.hand.find(c=>c.uid===uid);if(!c)return;p.hand=p.hand.filter(x=>x!==c);p.discard.push(c);t.count--;if(!t.count||!p.hand.length){p.pending=null;afterCard(p,t.cardType)}emit()}
function afterCard(p,type){for(const e of S.enemies.filter(e=>e.hp)){
 if(e.id==='nob'&&S.round>1&&type==='skill')hurt(p,1);
 if(e.id==='guardian'&&e.step>=2&&type==='attack')hurt(p,1);
 if(S.phase==='lost')return;
 }checkVictory();}
function shiv(i,overflow=false){const p=S.players[i];if(!canAct(p))return;if(overflow?!(p.overflowShivs>0):!p.shiv)return;const t=S.enemies.find(e=>e.uid===p.target&&e.hp);if(!t)return;if(overflow)p.overflowShivs--;else p.shiv--;attack(p,[t],1);log(`${p.name}使用小刀。`);checkVictory();retarget();emit()}
function endTurn(i){const p=S.players[i];if(S.phase!=='combat'||p.pending||p.overflowShivs)return;p.ready=!p.ready;if(!S.players.every(p=>p.ready)){emit();return}
 // All end-of-player-turn poison is resolved before any enemy action.
 for(const e of S.enemies.filter(e=>e.hp&&e.poison))hurt(e,e.poison,true);
 if(checkVictory()){emit();return}
 for(const q of S.players){for(const c of q.hand){const x=cardSpec(c);if(x.burn){hurt(q,x.burn);if(S.phase==='lost'){emit();return}}}
 q.str=Math.max(0,q.str-q.tempStrength);q.tempStrength=0;
 const retained=[];for(const c of q.hand){const x=cardSpec(c);if(x.ethereal)q.exhaust.push(c);else if(x.retain)retained.push(c);else q.discard.push(c)}q.hand=retained;
 }
 // Guardian's mode-shift check observes block BEFORE the mandatory block removal.
 const guardian=S.enemies.find(e=>e.id==='guardian'&&e.hp);if(guardian&&guardian.step===1)guardian.shift=guardian.block===0;
 S.enemies.forEach(e=>e.block=0);
 const order=[...S.enemies].filter(e=>e.hp).sort((a,b)=>(a.boss?100:a.row===1?0:1)-(b.boss?100:b.row===1?0:1));
 for(const e of order){if(!e.hp)continue;executeEnemy(e);if(S.phase==='lost'){emit();return}}
 if(!checkVictory())nextRound();else emit();
}
function enemyAction(e){
 const turn=S.round;
 if(e.id==='guardian'){
  if(e.step===0)return {hit:2,all:true,block:10,next:1};
  if(e.step===1)return e.block===0||e.shift?{shift:true,next:2}:{hit:6,all:true,next:0};
  if(e.step===2)return {hit:2,all:true,next:3};
  return {hit:4,all:true,str:1,next:0};
 }
 if(e.id==='slimeBoss')return [{slimed:3},{hit:3,slimed:2},{hit:6}][(turn-1)%3];
 if(e.id==='large')return [{hit:1,all:true},{hit:4,dazed:1},{summon:'acid'}][(turn-1)%3];
 if(e.id.startsWith('sentr')){const c=e.behavior[S.die<=3?0:1];return c==='D'?{dazed:1}:{hit:Number(c)}}
 if(e.id==='hexaghost')return [{hit:1,burn:1},{hit:2,hits:2,burn:1},{burn:2},{hit:3,block:5},{hit:2,burn:1},{hit:3,hits:2,burn:2,str:1}][(turn-1)%6];
 if(e.id==='nob')return turn===1?{buff:'激怒'}:{hit:3,all:true};
 if(e.id==='lagavulin')return turn===1?{buff:'休眠'}:[{hit:4,all:true},{hit:4,all:true},{weak:2,str:1,all:true}][(turn-2)%3];
 if(e.id==='cultist')return {hit:1,str:1};if(e.id==='spikeSmall')return {hit:1};
 const code=(e.behavior||'')[Math.floor((S.die-1)/2)];
 if(e.id.startsWith('jaw'))return code==='s'?{block:2,str:1}:code==='d'?{hit:2,block:1}:code==='D'?{hit:3,block:1}:code==='A'?{hit:4}:{hit:3};
 if(e.id.startsWith('red')&&e.id!=='redSlaver'||e.id==='green')return code==='S'?{str:1}:code==='W'?{weak:1}:{hit:Number(code)||1};
 if(e.id==='largeSummon')return code==='4'?{hit:4}:code==='S'?{hit:3,slimed:2}:{hit:1,weak:2};
 if(e.id==='acid')return code==='C'?{hit:2,dazed:1}:code==='L'?{weak:1}:{hit:2};
 if(e.id==='spike')return code==='V'?{hit:1,vulnerable:1}:code==='D'?{hit:1,dazed:1}:{hit:2};
 if(e.id==='fungi')return code==='2'?{hit:2}:code==='1'?{hit:1,all:true,str:1}:{str:2};
 if(e.id==='blueSlaver')return code==='W'?{hit:2,weak:1}:code==='D'?{hit:3,dazed:1}:{hit:3};
 if(e.id==='redSlaver')return code==='V'?{hit:2,vulnerable:1}:code==='D'?{hit:2,dazed:1}:{hit:3};
 return {};
}
function executeEnemy(e){let action=enemyAction(e);if(e.id==='guardian'&&e.step===1)action=e.shift?{shift:true,next:2}:{hit:6,all:true,next:0};
 const targets=action.all||e.boss?S.players:S.players.filter(p=>p.row===e.row);
 if(action.hit){attack(e,targets,action.hit,action.hits||1);log(`${e.name}执行攻击。`)}
 if(S.phase==='lost')return;
 for(const p of targets){if(action.weak)addToken(p,'weak',action.weak);if(action.vulnerable)addToken(p,'vulnerable',action.vulnerable);
  for(let j=0;j<(action.dazed||0);j++)p.draw.push(makeCard('dazed'));
  for(let j=0;j<(action.burn||0);j++)p.discard.push(makeCard('burn'));
  for(let j=0;j<(action.slimed||0);j++)p.discard.push(makeCard('slimed'));
 }
 if(action.summon)S.queuedSummons.push({id:action.summon,row:e.row});
 if(action.block)e.block+=action.block;if(action.str)addToken(e,'str',action.str);if(action.next!==undefined)e.step=action.next;e.shift=false;
}
function checkVictory(){if(S.phase==='lost'||S.spawnWave||S.queuedSummons?.length||!S.enemies.length||S.enemies.some(e=>e.hp))return false;
 S.phase='reward';if(S.floor>0)S.encounterDeck.push(...S.combatDeckIds);
 S.players.forEach(p=>{
  p.hp=Math.min(p.max,p.hp+(p.id===0?1:0));p.block=0;p.energy=3;p.str=p.dex=p.weak=p.vulnerable=p.shiv=p.tempStrength=p.overflowShivs=0;
  p.hand=[];p.draw=[];p.discard=[];p.exhaust=[];p.powers=[];p.pending=null;p.ready=false;p.done=false;
  const r=S.rewards[p.id];p.gold+=r.gold;
  p.tasks=[{type:'cards',rare:!!r.rare},...(r.potion?[{type:'potion'}]:[]),...(r.relic?[{type:'relic'}]:[])];primeTasks(p);beginTask(p);
 });log('战斗胜利，按遭遇牌分别领取奖励。');return true;
}
function setTarget(i,uid){const p=S.players[i];if(S.phase!=='combat'||p.ready)return;const e=S.enemies.find(e=>e.uid===uid&&e.hp);if(e){p.target=uid;if(!e.boss)p.targetRow=e.row;emit()}}
function teamGold(){return S.players.reduce((sum,p)=>sum+p.gold,0)}
function pay(p,n){if(teamGold()<n){notify='团队金币不足。';return false}const own=Math.min(p.gold,n);p.gold-=own;S.players[1-p.id].gold-=n-own;return {own,other:n-own}}
function roomChoice(i,action){const p=S.players[i];if(S.phase!=='room'||p.done||p.pending)return;
 if(S.room==='R'){if(action==='rest'){p.hp=Math.min(p.max,p.hp+3);p.done=true}else if(action==='upgrade'){p.tasks=[{type:'upgrade'}];beginTask(p)}else return}
 else if(S.room==='?'){
  if(S.event==='livingWall'&&['remove','transform','upgrade'].includes(action)){p.tasks=[{type:action}];beginTask(p)}
  else if(S.event==='upgradeShrine'&&action==='upgrade'){p.tasks=[{type:'upgrade'}];beginTask(p)}
  else if(S.event==='purification'&&action==='remove'){p.tasks=[{type:'remove'}];beginTask(p)}
  else if(S.event==='cleric'){
   if(action==='heal'&&pay(p,1)){p.hp=Math.min(p.max,p.hp+3);p.done=true}
   else if(action==='upgrade'&&pay(p,2)){p.tasks=[{type:'upgrade'}];beginTask(p)}
   else if(action==='remove'&&pay(p,3)){p.tasks=[{type:'remove'}];beginTask(p)}
   else if(action==='skip')p.done=true;
  }else if(action==='skip')p.done=true;
 }
 checkDone();emit();
}
function buy(i,kind,value){const p=S.players[i];if(S.phase!=='room'||S.room!=='$'||p.done||p.pending)return;
 if(kind==='card'){const o=p.shopCards.find(o=>o.card.uid===Number(value));if(!o||!pay(p,cardPrice(o.card)))return;p.deck.push(o.card);p.shopCards=p.shopCards.filter(x=>x!==o)}
 else if(kind==='relic'){const id=S.shop.relics[value];if(!id||!pay(p,Math.max(0,RELIC_DATA[id].price-(Number(value)===0?1:0))))return;p.relics.push(id);S.shop.relics[value]=null}
 else if(kind==='potion'){const id=S.shop.potions[value];if(!id)return;if(p.potions.length>=3){notify='药水已达上限，请先使用、赠送或丢弃。';emit();return}if(!pay(p,POTION_DATA[id].price))return;p.potions.push({id,uid:++S.serial});S.shop.potions[value]=null}
 else if(kind==='remove'){if(p.removed||!p.deck.length)return;const paid=pay(p,3);if(!paid){emit();return}p.pending={type:'remove',shop:true,refundOwn:paid.own,refundOther:paid.other}}
 emit();
}
function cardPrice(c){return {common:2,uncommon:3,rare:6}[CARD_DATA[c.id].rarity]||2}
function leaveShop(i){const p=S.players[i];if(S.phase!=='room'||S.room!=='$'||p.pending||p.done)return;p.shopCards.forEach(o=>returnOffer(p,o));p.shopCards=[];p.done=true;
 if(S.players.every(p=>p.done)){S.relicDeck.push(...S.shop.relics.filter(Boolean));S.potionDeck.push(...S.shop.potions.filter(Boolean));checkDone()}emit()}
function potion(i,uid,action='use'){const p=S.players[i],item=p.potions.find(x=>x.uid===uid);if(!item)return;const d=POTION_DATA[item.id];
 if(action==='give'){if(S.phase==='combat'||S.players[1-i].potions.length>=3)return;S.players[1-i].potions.push(item)}
 else if(action==='drop')S.potionDeck.push(item.id);
 else{
  if(S.phase==='lost'||S.phase==='won')return;
  if(S.phase==='combat'){if(!canAct(p))return}else if(!d.heal)return;
  const t=S.enemies.find(e=>e.uid===p.target&&e.hp);if((d.damage||d.weak||d.vulnerable)&&!t)return;
  if(d.heal)p.hp=Math.min(p.max,p.hp+d.heal);if(d.block)addBlock(p,d.block);if(d.energy)addEnergy(p,d.energy);if(d.draw)draw(p,d.draw);
  if(d.damage)hurt(t,d.damage);if(d.weak)addToken(t,'weak',d.weak);if(d.vulnerable)addToken(t,'vulnerable',d.vulnerable);S.potionDeck.push(item.id);log(`${p.name}使用${d.name}。`);
 }
 p.potions=p.potions.filter(x=>x!==item);if(S.phase==='combat'){checkVictory();retarget()}emit();
}
