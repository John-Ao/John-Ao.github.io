'use strict';
const $=id=>document.getElementById(id),colors=['#ba4948','#b96124','#927819','#36805d','#3975a2','#8a58a2'],symbols=['●','◆','★','♣','▲','✦'],names=['红','橙','黄','绿','蓝','紫'],ranks=['','散牌','顺子','同花','同点数组','同花顺'],key='schotten-totten-v2';
let s,selected=null,source=null,hidden=true,opposed=false,fresh=false;
try{s=JSON.parse(localStorage.getItem(key));if(!s||s.version!==2||s.stones.length!==9)throw Error();}catch{s=Game.create({tactics:true});fresh=true;}
function save(){try{localStorage.setItem(key,JSON.stringify(s));}catch{$('message').textContent='浏览器无法保存进度，请勿关闭页面。';}}
const cardName=c=>c.type?Game.INFO[c.type][0]+(c.n?'（'+names[c.c]+' '+c.n+'）':''):names[c.c]+' '+c.n;
function mini(c,attrs=''){return `<button class="mini ${c.type?'elite':''}" ${attrs} style="--color:${c.type?'#63566f':colors[c.c]}" aria-label="${cardName(c)}"><span>${c.type?Game.INFO[c.type][0]:symbols[c.c]+' '+names[c.c]}</span>${c.type?(c.n?`${symbols[c.c]}${c.n}`:c.type==='spy'?'7':c.type==='shield'?'1–3':'1–9'):c.n}</button>`;}
function selectedCard(){return s.hands[s.player].find(c=>c.id===selected);}
function commit(){save();render();}
function message(text){$('message').textContent=text;}
function render(){
 document.body.classList.toggle('opposed',opposed);document.body.classList.toggle('face2',opposed&&s.player===1);$('rotate').setAttribute('aria-pressed',String(opposed));$('rotate').textContent=opposed?'同向模式':'对坐模式';
 $('edition').textContent=`${s.options.tactics?'战术版':'基础版'}${s.options.expert?' · 专家时机':''} · 第 ${s.round} / ${s.options.rounds} 局`;
 $('deck').textContent=`氏族 ${s.deck.length} · 战术 ${s.tactics.length} · 回合 ${s.turn}`;
 for(let p=0;p<2;p++)$('score'+(p+1)).textContent=s.stones.filter(t=>t.owner===p).length;
 $('match').textContent=`累计积分 ${s.scores[0]} : ${s.scores[1]}${s.options.tactics?`　已用战术 ${s.used[0]} : ${s.used[1]}`:''}`;
 const chosen=selectedCard(),claimPhase=['claim','preclaim'].includes(s.phase);
 $('board').innerHTML=s.stones.map((t,i)=>{const size=Game.capacity(t),fog=t.modes.some(c=>c.type==='fog'),claim=!hidden&&claimPhase&&!Game.finished(s)&&Game.claimable(s,i,s.player),legal=!hidden&&s.phase==='play'&&chosen&&t.owner===null&&(!chosen.type||s.used[s.player]<=s.used[1-s.player])&&(['fog','mud'].includes(chosen.type)?!t.modes.some(m=>m.type===chosen.type):!['banshee','recruiter'].includes(chosen.type)&&(!['strategist','traitor'].includes(chosen.type)||source)&&t.cards[s.player].length<size&&(chosen.type!=='strategist'||source?.from!==i)&&(chosen.type!=='joker'||!s.jokerUsed[s.player]));
  const f=p=>{const full=t.cards[p].length===size,b=full?Game.best(t.cards[p],size,[],fog):null;return `<div class="formation ${p===1?'top':''} ${s.player===p&&t.owner===null?'active':''}">${t.cards[p].map(c=>mini(c,`data-board-card="${c.id}" data-lane="${i}" data-side="${p}" ${source?.card===c.id?'data-source="true"':''} ${!hidden&&s.phase==='play'&&['strategist','banshee','traitor'].includes(chosen?.type)&&t.owner===null&&p===(chosen.type==='strategist'?s.player:1-s.player)&&(chosen.type!=='traitor'||!c.type)?'data-target="true"':''}`)).join('')}<span class="formation-label">${full?(fog?'总点数':ranks[b.score[0]])+' · '+b.score[1]:t.cards[p].length+' / '+size}</span></div>`;};
  return `<div class="lane">${f(1)}<button class="stone ${t.owner!==null?'owned'+t.owner:''} ${claim?'claimable':''} ${legal?'legal':''}" data-stone="${i}" aria-label="界石 ${i+1}${claim?'，可占领':''}">${i+1}<small>${t.owner!==null?'玩家 '+(t.owner+1)+' 已占领':claim?'点击占领':legal?'选择界石':'界石'}</small><small>${t.modes.map(c=>Game.INFO[c.type][0]).join(' · ')}</small></button>${f(0)}</div>`;
 }).join('');
 $('turn').textContent=Game.finished(s)?(s.draw?'本局双方同意和局':`玩家 ${s.winner+1} 赢得本局`):`玩家 ${s.player+1} 的回合`;
 let help=s.phase==='play'?(chosen?(Game.INFO[chosen.type]?.[1]??'点击界石放牌；再点手牌可取消。'):'选择手牌，再点击目标界石。'):s.phase==='preclaim'?'回合开始：先占领，再进入出牌；出牌后不能占领。':s.phase==='claim'?'点击高亮界石占领，然后选择牌堆补牌。':s.phase==='draw'?'请选择牌堆补牌，然后交接。':s.phase==='recruitDraw'?`招募者：已抽 ${s.recruit.drawn} / 3 张，请选择牌堆。`:`招募者：已退 ${s.recruit?.returned??0} / 2 张，点击手牌退到对应牌堆底。`;
 if(source)help+=chosen?.type==='strategist'?' 已选中目标牌；请选择目的界石，或弃置。':' 已选中目标牌；请选择己方目的界石。';
 if(!source&&chosen&&['strategist','banshee','traitor'].includes(chosen.type))help+=' 点击棋盘上高亮的目标牌。';
 if(Game.finished(s)){help=`本局得分 ${s.results.at(-1).earned.join(' : ')}。`;if(s.round===s.options.rounds)help+=s.scores[0]===s.scores[1]?'系列赛积分相同，平局。':`玩家 ${s.scores[0]>s.scores[1]?1:2} 赢得系列赛。`;}
 $('instruction').textContent=help;
 $('hand').innerHTML=hidden||Game.finished(s)?'':s.hands[s.player].map(c=>`<button class="card ${c.type?'tactic':''} ${selected===c.id?'selected':''}" data-card="${c.id}" style="--color:${c.type?'#63516c':colors[c.c]}" aria-label="${cardName(c)}" aria-pressed="${selected===c.id}" ${!['play','recruitReturn'].includes(s.phase)?'disabled':''}>${c.type?`<span class="tactic-name">${Game.INFO[c.type][0]}</span><small>${Game.elite(c)?'精锐部队':['fog','mud'].includes(c.type)?'战斗模式':'计谋'}</small>`:`<span class="suit">${symbols[c.c]}</span><span class="number">${c.n}</span><small>${names[c.c]}</small>`}</button>`).join('');
 $('finish').hidden=true;$('draw-clan').hidden=true;$('draw-tactic').hidden=true;$('pass').hidden=true;$('activate').hidden=true;$('discard-selected').hidden=true;$('next').hidden=true;$('agree-draw').hidden=true;
 if(!hidden&&!Game.finished(s)){
  $('agree-draw').hidden=!s.stalled;if(s.stalled)$('instruction').textContent='双方均无合法行动或占领。规则书未规定此僵局的结算；可双方同意和局（不计分）。';
  if(s.phase==='preclaim'){$('finish').hidden=false;$('finish').textContent='进入出牌';}
  if(s.phase==='play'){$('pass').hidden=Game.canPlay(s,s.player);$('activate').hidden=chosen?.type!=='recruiter';$('discard-selected').hidden=!(chosen?.type==='strategist'&&source);}
  if(['claim','draw','recruitDraw'].includes(s.phase)){const need=s.phase==='recruitDraw'||(!s.passed&&s.hands[s.player].length<(s.options.tactics?7:6)&&(s.deck.length+s.tactics.length)>0);if(need){$('draw-clan').hidden=false;$('draw-clan').disabled=!s.deck.length;$('draw-tactic').hidden=!s.options.tactics;$('draw-tactic').disabled=!s.tactics.length;}else{$('finish').hidden=false;$('finish').textContent='交接回合';}}
 }
 if(Game.finished(s)&&s.round<s.options.rounds)$('next').hidden=false;
 $('log').innerHTML=s.log.slice(0,100).map(x=>`<li>${x}</li>`).join('');$('discard').innerHTML=s.discard.map(c=>mini(c,'disabled')).join('')||'<span>暂无弃牌</span>';
 $('curtain').hidden=!hidden||Game.finished(s);$('handoff-title').textContent=`请玩家 ${s.player+1} 接手`;
}
function perform(i,arg={}){if(!Game.play(s,selected,i,arg)){message('无法出牌：检查目标、容量、战术使用次数，以及是否已用过百变者。');return;}selected=null;source=null;message('');commit();}
$('reveal').onclick=()=>{hidden=false;render();};
$('hand').onclick=e=>{const b=e.target.closest('[data-card]');if(!b||hidden||Game.finished(s))return;const id=Number(b.dataset.card);if(s.phase==='recruitReturn'){if(Game.recruitReturn(s,id)){message('');commit();}return;}if(s.phase!=='play')return;selected=selected===id?null:id;source=null;const c=selectedCard();message(c?.type&&s.used[s.player]>s.used[1-s.player]?'你的战术牌使用次数已领先一张；暂时不能再打战术牌。':'');render();};
$('board').onclick=e=>{if(hidden||Game.finished(s))return;const cb=e.target.closest('[data-board-card]'),stone=e.target.closest('[data-stone]'),c=selectedCard();
 if(cb&&s.phase==='play'&&c&&['strategist','banshee','traitor'].includes(c.type)){const from=Number(cb.dataset.lane),side=Number(cb.dataset.side),id=Number(cb.dataset.boardCard),q=c.type==='strategist'?s.player:1-s.player,target=s.stones[from].cards[side].find(x=>x.id===id);if(side!==q||s.stones[from].owner!==null||(c.type==='traitor'&&target.type)){message('请选择正确一侧未占领界石上的牌；叛徒只能转移普通氏族牌。');return;}source={from,card:id};if(c.type==='banshee')perform(-1,source);else{message('');render();}return;}
 if(!stone)return;const i=Number(stone.dataset.stone);if(s.phase==='play'){if(!c){message('请先选择一张手牌。');return;}if(['strategist','banshee','traitor'].includes(c.type)&&!source){message('先点击阵型中要移动或弃置的那张牌。');return;}if(c.type==='recruiter'){message('点击“发动招募者”，然后选择牌堆。');return;}perform(i,source??{});}else if(['claim','preclaim'].includes(s.phase)){const info=Game.claimInfo(s,i,s.player);if(!Game.claim(s,i)){message(info.reason+(info.other?' 对方可能阵型：'+info.other.cards.map(cardName).join('、')+'。':''));return;}message('');commit();}};
function draw(sourceName){if(hidden)return;if(s.phase==='recruitDraw'){if(Game.recruitDraw(s,sourceName))commit();return;}if(Game.end(s,sourceName)){hidden=true;selected=null;source=null;message('');commit();}}
$('draw-clan').onclick=()=>draw('deck');$('draw-tactic').onclick=()=>draw('tactics');
$('finish').onclick=()=>{if(hidden)return;if(s.phase==='preclaim'){if(Game.beginPlay(s))commit();}else draw('deck');};
$('pass').onclick=()=>{if(Game.pass(s)){selected=null;source=null;commit();}};
$('activate').onclick=()=>perform(-1);$('discard-selected').onclick=()=>perform(-1,{...source,discard:true});
$('agree-draw').onclick=()=>$('draw-dialog').showModal();$('confirm-draw').onclick=()=>{if(Game.agreeDraw(s)){$('draw-dialog').close();commit();}};
$('rules').onclick=()=>$('rules-dialog').showModal();$('rotate').onclick=()=>{opposed=!opposed;render();};
$('restart').onclick=()=>{$('opt-tactics').checked=s.options.tactics;$('opt-expert').checked=s.options.expert;$('opt-rounds').value=s.options.rounds;$('opt-first').value=s.options.first;$('new-dialog').showModal();};
$('confirm-new').onclick=()=>{const rounds=Number($('opt-rounds').value);if(!Number.isInteger(rounds)||rounds<1||rounds>99){$('opt-rounds').reportValidity();return;}s=Game.create({tactics:$('opt-tactics').checked,expert:$('opt-expert').checked,rounds,first:Number($('opt-first').value)});hidden=true;selected=null;source=null;$('new-dialog').close();message('');commit();};
$('next').onclick=()=>$('round-dialog').showModal();$('confirm-round').onclick=()=>{const next=Game.nextRound(s,Number($('round-first').value));if(next){s=next;hidden=true;selected=null;source=null;$('round-dialog').close();message('');commit();}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!Game.finished(s)){hidden=true;selected=null;source=null;render();}});save();render();if(fresh)$('new-dialog').showModal();
