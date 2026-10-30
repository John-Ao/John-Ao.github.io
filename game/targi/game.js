'use strict';
const E=Targi,D=TargiCards,$=id=>document.getElementById(id);
const names=['蓝方','赭方'],res=['椰枣','盐','胡椒','黄金','分'],icons=['◉','♞','♧','◇','△'];
const KEY='targi.base.v2';
let s,history=[],selected=null,payment=0,moveFrom=null,notice='';
const ct=a=>a.map((n,i)=>n?`${n} ${res[i]}`:'').filter(Boolean).join(' · ')||'免费';
const costText=c=>c.costs.map(ct).join(' 或 ');
function effect(c){switch(c.effect){
  case'discount':return `之后建造${D.types[c.arg]}少付 1 个自选货物。`;
  case'storedGold':return '入场存放 1 黄金，只能用于之后建造部落；不计入持有上限。';
  case'robber':return '可在强盗所在边界放置族人；其他落子限制仍适用。';
  case'pairs':return `终局每有 2 张${D.types[c.arg]}，额外获得 1 分。`;
  case'freeHand':return '每轮一次，行动阶段无需贵族即可打出手牌，额外支付 1 个该牌要求种类的货物。';
  case'builtGoods':return '入场时，已建部落每 2 张领取 1 个自选货物（含此牌）。';
  case'emptyGoods':return '入场时，每 2 个尚未填入部落的空位领取 1 个自选货物。';
  case'majority':return '终局部落张数比对手多，额外获得 1 分。';
  case'rightmost':return '终局位于完整一行的最右侧，额外获得 2 分。';
  case'production':return `每回合从货物牌获得${res[c.arg]}时，额外获得 1 ${res[c.arg]}，每回合一次。`;
  case'raidImmune':return '袭击时可以免付货物、黄金与分数。';
  case'rearrange':return '入场时可重排至多 2 张已建部落；完成后每行左侧不得留空。';
  case'noGoods':return '本回合未从货物牌取得货物时，在行动结束时领取 1 个自选货物。';
  case'diversity':return '终局四类不同的完整行从 2 分提高至 4 分，最多奖励两行。';
  case'raidReward':return '每次实际支付袭击代价后，获得 1 分；免付不触发。';
  case'choiceBonus':return '入场选择领取：3 个自选货物、1 黄金或 1 分。';
  case'trade':return '商人的货物兑换比例变为 1 换 1；换黄金仍需 3 个同类货物。';
  case'ten':return '终局建成至少 10 张部落，额外获得 1 分。';
  case'block':return '对手仅在下一个回合只能放置 2 个族人。';
  case'nobleDiscount':return '通过贵族打出手牌时，额外少付 1 个自选货物。';
  default:return '无特殊能力。';
}}
const shortEffects={discount:'同类建造减费',storedGold:'存放建造黄金',robber:'允许强盗同格',pairs:'同类数量计分',freeHand:'额外打出手牌',builtGoods:'按已建数取货',emptyGoods:'按空位数取货',majority:'部落多数计分',rightmost:'行末奖励',production:'每回合增产',raidImmune:'免袭击',rearrange:'重排两张部落',noGoods:'无货物补偿',diversity:'异类行加分',raidReward:'支付袭击返分',choiceBonus:'自选入场奖励',trade:'商人一换一',ten:'十张部落奖励',block:'对手下轮少一人',nobleDiscount:'贵族打牌减费',none:'无特殊能力'};
function cardText(c){return c.kind==='tribe'?`${icons[c.type]} ${D.types[c.type]} · ${c.vp} 分`:c.gain.length?c.gain.map(([i,n])=>`${res[i]} +${n}`).join(' ＋ '):'任选 1 个货物';}
function save(){try{localStorage.setItem(KEY,JSON.stringify({state:s,history}));}catch{notice='浏览器无法保存进度；当前对局仍可继续。';}}
function start(first=0){s=E.create(first);history=[];selected=null;payment=0;moveFrom=null;notice='';render();}
function send(action){try{const next=E.dispatch(s,action);history.push(s);history=history.slice(-40);s=next;selected=null;moveFrom=null;payment=0;notice='';render();}catch(e){notice=e.message;render();}}
function btn(label,fn,disabled=false,cls='',parent=$('control')){const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.className=cls;b.onclick=fn;parent.append(b);return b;}
function note(t){const p=document.createElement('p');p.textContent=t;$('control').append(p);}
function show(html){$('dialogContent').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
function inspect(c){show(`<h3>${c.id} · ${cardText(c)}</h3><p>费用：${costText(c)}</p><p>${effect(c)}</p>`);}
function cellClick(i){
  if(s.phase==='place'&&E.legal(s,i)){send({type:'place',cell:i});return;}
  if(s.phase==='action'&&!s.pending&&s.actions[s.turn].includes(i)){selected=i;render();return;}
  const c=s.board[i];if(c?.kind==='tribe')inspect(c);
}
function scoreTable(){return `<table class="scoretable"><tr><th>得分项</th><th>蓝方</th><th>赭方</th></tr>${[['分数筹码','tokens'],['部落牌面','printed'],['部落能力','abilities'],['三行奖励','rowPoints'],['总分','total']].map(([t,k])=>`<tr><td>${t}</td><td>${E.score(s,0)[k]}</td><td>${E.score(s,1)[k]}</td></tr>`).join('')}</table>`;}
function controls(){
  $('control').replaceChildren();if(notice)note(notice);
  const p=s.players[s.turn],q=s.pending;
  if(s.phase==='end'){const win=E.winner(s);note(`对局结束 · ${E.score(s,0).total} : ${E.score(s,1).total} · ${win===null?'平局':names[win]+'获胜'}`);const d=document.createElement('div');d.className='wide';d.innerHTML=scoreTable();$('control').append(d);note('同分依次比较持有黄金、货物；部落牌上的专用黄金不计入。');return;}
  if(q?.kind==='goods'||q?.kind==='bonusGoods'||q?.kind==='raidGoods'){
    note(q.kind==='goods'?'货物牌：选择领取 1 个货物':q.kind==='raidGoods'?`袭击：还需支付 ${q.left} 个货物`:`部落能力：还可领取 ${q.left} 个自选货物`);
    res.slice(0,3).forEach((r,i)=>btn(r,()=>send({type:'good',resource:i}),q.kind==='raidGoods'&&!p.r[i]));return;
  }
  if(s.phase==='limit'){note(`回合末货物 ${E.goodsCount(p)}/10：选择退回的货物。`);res.slice(0,3).forEach((r,i)=>btn(`退回 1 ${r}`,()=>send({type:'limit',resource:i}),!p.r[i]));return;}
  if(s.phase==='raid'){const c=E.raidCost(s),options=E.raidOptions(s);note(`第 ${s.robber/4} 次袭击：支付 ${c.gold?'1 黄金':c.goods+' 个货物'}，或 ${c.vp} 分。`);for(const option of options){btn({immune:'发动免袭击',vp:`支付 ${c.vp} 分`,resources:`支付 ${c.gold?'1 黄金':c.goods+' 个货物'}`,unable:`无力支付：对手获得 ${c.vp} 分`}[option],()=>send({type:'raid',choice:option}));}if(E.has(p,'raidReward'))note('实际支付后返还 1 分；选择免袭击不会返分。');return;}
  if(s.phase==='place'){note(`点击金边放置族人 ${s.placed[s.turn].length+1}/${E.quota(s,s.turn)}；点中央部落可查看详情。`);if(E.quota(s,s.turn)===2)note('受营地能力影响，本回合仅放置 2 个族人。');return;}
  if(q?.kind==='tribe'){
    note(`${q.card.id} · ${cardText(q.card)} · ${effect(q.card)}`);
    note(`印刷费用：${costText(q.card)}${q.source==='freeHand'?'；额外手牌行动需加付 1 货物。':''}`);
    const plans=E.payments(s,q.card,q.source),mayBuild=E.mayBuild(s);
    if(plans.length&&mayBuild){note('选择支付方案，再选择建造行：');plans.forEach((v,i)=>btn(ct(v.pay)+(v.stored?' ＋ 牌上黄金':''),()=>{payment=i;render();},false,payment===i?'primary':''));
      const rowdiv=document.createElement('div');rowdiv.className='wide choices';$('control').append(rowdiv);p.rows.forEach((r,i)=>btn(`第 ${i+1} 行（${r.length}/4）`,()=>send({type:'build',row:i,payment}),r.length>=4,'',rowdiv));
    }else note(mayBuild?'当前资源不足，或部落区已满。':'本回合刚保留的牌，不能立即通过贵族建造。');
    if(!['noble','freeHand'].includes(q.source))btn('保留为手牌',()=>send({type:'tribe',choice:'hold'}),!!p.hand);
    if(q.source!=='freeHand')btn('弃掉此牌',()=>send({type:'tribe',choice:'discard'}));
    if(['noble','freeHand'].includes(q.source))btn(q.source==='noble'?'保留手牌并结束贵族行动':'返回，不打出',()=>send({type:'tribe',choice:'cancel'}));return;
  }
  if(q?.kind==='choiceBonus'){note('入场奖励三选一：');for(const [choice,label] of [['goods','3 个自选货物'],['gold','1 黄金'],['vp','1 分']])btn(label,()=>send({type:'bonus',choice}));return;}
  if(q?.kind==='rearrange'){
    note(`重排部落：已选 ${q.moved.length}/2 张。点击牌将其提起，再点击空位放回。可以先提起两张以交换位置。`);
    if(q.held.length)note(`下一张待放回：${q.held[0].id} ${D.types[q.held[0].type]}；手中 ${q.held.length} 张。`);
    const grid=document.createElement('div');grid.className='rearrange wide';$('control').append(grid);
    q.grid.forEach((row,r)=>row.forEach((c,col)=>btn(c?`${c.id} ${D.types[c.type]}`:`${r+1} 行 ${col+1} 列`,()=>send({type:'rearrange',op:c?'lift':'drop',row:r,col}),c?(!q.moved.includes(c.id)&&q.moved.length===2):!q.held.length,c?'filled':'',grid)));
    const gap=q.grid.some(row=>row.some((c,i)=>c&&row.slice(0,i).includes(null)));
    btn('完成重排',()=>send({type:'rearrange',op:'done'}),q.held.length>0||gap,'primary');btn('重新选择位置',()=>send({type:'rearrange',op:'reset'}));btn('不重排',()=>send({type:'rearrange',op:'cancel'}));if(gap)note('请先填补行内空位，不能留下左侧缺口。');return;
  }
  if(q?.kind==='trade'||q?.kind==='silver'){
    note(q.kind==='trade'?'商人：可连续兑换，完成后结束此行动。':'银匠：只能进行一次兑换。');const options=E.exchanges(s);
    options.forEach((v,i)=>btn(`${v.n} ${res[v.i]} → ${v.m} ${res[v.j]}`,()=>send({type:'exchange',index:i})));
    if(!options.length)note('没有可支付的兑换方案。');btn('结束此行动',()=>send({type:'finish'}));return;
  }
  if(q?.kind==='move'){
    const from=s.actions[s.turn].filter(i=>E.centers.includes(i));note(moveFrom===null?'选择一个尚未使用的己方交点：':'选择一个无人占用的明牌目的地：');
    if(moveFrom===null)from.forEach(i=>btn(`${Math.floor(i/5)}行${i%5}列 · ${cardText(s.board[i])}`,()=>{moveFrom=i;render();}));
    else E.moveTargets(s).forEach(i=>btn(`${Math.floor(i/5)}行${i%5}列 · ${cardText(s.board[i])}`,()=>send({type:'move',from:moveFrom,to:i})));
    if(moveFrom!==null)btn('重选交点',()=>{moveFrom=null;render();});if(!from.length)note('没有可移动的交点。');btn('不移动，结束行动',()=>send({type:'finish'}));return;
  }
  if(selected!==null){const c=s.board[selected],b=E.border[E.ring.indexOf(selected)+1];note(c?`${cardText(c)}${c.kind==='tribe'?' · '+costText(c)+' · '+effect(c):''}`:b[1]);btn('执行此行动',()=>send({type:'activate',cell:selected}),false,'primary');btn('放弃此行动',()=>send({type:'skip',cell:selected}));}
  else note(s.actions[s.turn].length?`点选自己的族人或交点，尚有 ${s.actions[s.turn].length} 个行动。`:'棋盘行动已完成。可发动手牌能力，或结束本方行动。');
  if(p.hand&&E.has(p,'freeHand'))btn('能力：额外打出手牌',()=>send({type:'freeHand'}),!E.payments(s,p.hand,'freeHand').length);
  if(!s.actions[s.turn].length)btn('结束本方行动',()=>send({type:'endTurn'}),false,'primary');
}
function render(){
  save();$('undo').disabled=!history.length;
  for(let k=0;k<2;k++){
    const p=s.players[k];$('p'+k).className=`player ${k?'red ':''}${s.turn===k&&s.phase!=='end'?'active':''}`;
    $('p'+k).innerHTML=`<div class="resources"><strong>${names[k]}${s.first===k?' · 先手':''}</strong>${p.r.map((v,i)=>`<span>${res[i]} <b>${v}</b></span>`).join('')}<button class="score" data-score="${k}">总分 ${E.score(s,k).total}</button></div><div class="tableau">${p.rows.map((row,r)=>`<div class="triberow">${Array.from({length:4},(_,i)=>row[i]?`<button class="slot filled" data-player="${k}" data-row="${r}" data-card="${i}">${icons[row[i].type]} ${D.types[row[i].type]}<br>${row[i].id} · ${row[i].vp}分</button>`:`<span class="slot">${r+1} · ${i+1}</span>`).join('')}</div>`).join('')}</div><div class="hand">${p.hand?`<button data-hand="${k}">手牌：${cardText(p.hand)}</button>`:'手牌：无'} · 部落 ${E.cards(p).length}/12${p.storedGold?' · 牌上黄金 '+p.storedGold:''}${p.blockedRound>=s.round?' · 第 '+p.blockedRound+' 回合少放 1 人':''}</div>`;
  }
  document.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>inspect(s.players[b.dataset.player].rows[b.dataset.row][b.dataset.card]));
  document.querySelectorAll('[data-hand]').forEach(b=>b.onclick=()=>inspect(s.players[b.dataset.hand].hand));
  document.querySelectorAll('[data-score]').forEach(b=>b.onclick=()=>show('<h3>当前计分</h3>'+scoreTable()+'<p>条件奖励按当前部落排列预估，终局重新计算。</p>'));
  $('status').innerHTML=`<span>${s.phase==='end'?'最终结算':names[s.turn]+' · '+({place:'放置族人',action:'执行行动',raid:'处理袭击',limit:'整理货物'}[s.phase])}</span><small>回合 ${s.round}/12 · 强盗 ${s.robber}/16</small>`;
  $('board').replaceChildren();
  for(let i=0;i<25;i++){
    const n=E.ring.indexOf(i)+1,c=s.board[i],corner=n&&n%4===0;
    const own=(s.phase==='place'?s.placed:s.actions).findIndex(a=>a.includes(i));
    const b=document.createElement('button');b.className='cell '+(c?c.kind:corner?'corner':'border')+(own>=0?' '+(own?'red':'blue'):'')+(selected===i?' chosen':'')+(s.phase==='place'&&E.legal(s,i)?' legal':'')+(s.phase==='place'&&n&&!corner&&!E.legal(s,i)?' blocked':'');
    b.innerHTML=`${n?`<span class="number">${String(n).padStart(2,'0')}</span>`:''}<span class="title">${c?(c.kind==='back'?'背面牌':cardText(c)):corner?'袭击':E.border[n][0]}</span><small>${c?(c.kind==='tribe'?costText(c)+'<br>'+shortEffects[c.effect]:c.kind==='back'?'回合结束翻开':'货物牌'):corner?(n===16?'1 黄金 / 3 分':`${n/4} 货物 / ${n===12?2:1} 分`):E.border[n][1]}</small>${own>=0?`<span class="badge">${names[own]} ${c?'◆':'●'}${n===s.robber?' / 强盗':''}</span>`:n===s.robber?'<span class="badge robber">强盗</span>':''}`;
    b.onclick=()=>cellClick(i);b.setAttribute('aria-label',`${n?'边界 '+n:Math.floor(i/5)+' 行 '+i%5+' 列'} ${b.textContent}`);$('board').append(b);
  }
  controls();$('log').replaceChildren();for(const t of s.log){const d=document.createElement('div');d.textContent=t;$('log').append(d);}
}
function rules(){show(`<h2>Targi · 基础版</h2><p>同屏双人轮流操作。金边是当前合法落点；蓝色和赭色标记表示所属玩家。点击中央牌、已建部落或手牌查看完整能力。每步自动保存，可撤销。</p><ol><li>每人起始三类货物各 2 个、黄金 1 个、分数 4 分。先手交替，每人依次放置 3 个族人；系统自动标记横纵交点。</li><li>禁止四角、已占格、对方族人的正对格；强盗格须有专属能力才能放置。某张营地只让对手在下回合少放 1 人。</li><li>先手完成所有行动后后手行动，顺序自选。放弃行动时中央牌留在原位；执行并取走或弃掉中央牌后立即补入另一类型的背面牌，回合末翻开。海市蜃楼只能前往无人占用的明牌。</li><li>部落付费后放入三行之一，每行从左向右最多 4 张。只能持有一张手牌，不能随意替换。贵族可弃手牌，或在后续回合支付费用建造；水井能力每轮一次，允许加付货物额外打出手牌。</li><li>费用列出可负担的全部支付方案，含可选黄金支付、货物减免、牌上黄金。先选方案，再选行。每张牌的能力在建成后立即生效。</li><li>商人：2 同类货物换 1 其他货物，或 3 同类货物换 1 黄金，可多次。银匠每次仅兑换一次：2/4 同类货物换 1/3 分，1/2 黄金换 2/4 分。</li><li>每回合生产奖励仅触发一次，且只针对货物牌（含商队），不包括边界领取。新建生产卡也检查本回合此前取得的货物。</li><li>强盗遇四角触发袭击。资源和分数均不足时，对手获得该次袭击要求的分数。免袭击和支付后返分不能同时触发。</li><li>回合末最多保留 10 个货物、3 黄金。部落上的专用黄金不占上限，也不能付袭击、兑换或参与平分判定。</li><li>任一玩家建满 12 张后仍完成双方本回合行动；或第 4 次袭击后立即结束。总分由筹码、部落牌面、能力、行奖励组成。同类满行 +4，四类满行 +2；同分依次比较黄金、货物。</li></ol><p>牌组：45 张原版部落（五类各九张）、19 张货物。全部基础版能力已实现。本模式不混入大型扩展、水、沙丘、行动代币、替换边界或单人规则。</p><p>原设计 Andreas Steiger；非官方网页实现。<a href="https://upload.snakesandlattes.com/rules/t/Targi.pdf" target="_blank" rel="noopener">英文规则书</a> · <a href="https://en.doc.boardgamearena.com/Gamehelptargi" target="_blank" rel="noopener">BGA 规则</a> · <a href="https://homeofmark.com/targi-card-game-review/" target="_blank" rel="noopener">卡牌实物与逐张资料</a>。校核说明见项目 RULES.md。</p>`);}
$('rules').onclick=rules;
$('catalog').onclick=()=>show(`<h2>基础版部落牌 · 45 张</h2>${D.types.map((t,i)=>`<h3>${icons[i]} ${t}</h3>${D.tribes.filter(c=>c.type===i).map(c=>`<article class="catalogcard"><b>${c.id} · ${c.vp} 分</b><div>${costText(c)}</div><div>${effect(c)}</div></article>`).join('')}`).join('')}`);
$('close').onclick=()=>$('modal').close();
$('undo').onclick=()=>{if(history.length){s=history.pop();selected=null;moveFrom=null;payment=0;notice='';render();}};
$('rotate').onclick=()=>{document.body.classList.toggle('opposite');$('rotate').textContent='对坐：'+(document.body.classList.contains('opposite')?'开':'关');};
$('reset').onclick=()=>{show('<h3>新对局</h3><p>开始后会替换当前基础版对局。选择先手：</p><div id="firstChoice"></div>');for(let i=0;i<2;i++)btn(names[i]+'先手',()=>{$('modal').close();start(i);},false,'',$('firstChoice'));};
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.state?.version===2){s=saved.state;history=saved.history||[];render();}else{const old=localStorage.getItem('targi.local.v1');start();if(old){notice='已升级为基础版牌组。旧改编版存档保留在浏览器中，新版单独保存。';render();}}}catch{start();}
