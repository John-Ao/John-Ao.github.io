import { loadCatalog } from './resource-catalog.js';
import { agents as legacyAgents, statNames, skillNames, skillIcons } from './data.js';
import { RecordedStage } from './stage.js';

const agents = (await loadCatalog('./roster.json')).map(a => {
  const old = legacyAgents.find(b => b.id === a.id);
  return old ? {...a, motion: old.motion, cinema: old.cinema, skills: old.skills, descriptions: old.descriptions} : a;
});
const $ = selector => document.querySelector(selector);
const screen = $('#screen');
let agentIndex = 0;
let tab = 'stats';
let cinemaOpen = false;
const cinemaLevels = Object.fromEntries(agents.map(a => [a.id, 0]));
const stage = new RecordedStage($('#motion'), loading => $('#loading').hidden = !loading, error => $('#media-error').hidden = !error);
const current = () => agents[agentIndex];

function resize() {
  const scale = Math.min(innerWidth / 1280, innerHeight / 720);
  screen.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
addEventListener('resize', resize);
resize();

const modelCatalog=await loadCatalog('./assets/models/catalog.json');
$('#roster-summary').textContent=`当前收录 ${agents.length} 位代理人。默认使用原版立绘，缺少素材的项目明确标注。`;
$('#model-summary').textContent=`${modelCatalog.length} 位角色：实时模型与骨骼动画 ↗`;
const modelEntries=new Map(modelCatalog.map(m=>[m.agentId,m]));
const modelIds=new Set(modelEntries.keys());
for (const [field,key] of [['attribute','attribute'],['specialty','specialty'],['faction','faction']]) {
 const select = $('#filter-'+field);
 for(const value of new Set(agents.map(a=>a[key]))) select.add(new Option(value,value));
 select.addEventListener('change',renderRoster);
}
$('#filter-model').addEventListener('change',renderRoster);
function renderRoster() {
 const availability=$('#filter-model').value;
 const query=$('#agent-search').value.trim().toLowerCase();
 const filtered=agents.map((a,i)=>({a,i})).filter(({a})=>
 (!availability||(availability==='model'?modelEntries.has(a.id):availability==='animated'?modelEntries.get(a.id)?.clips.some(c=>c.animated):!modelEntries.has(a.id)))&&
 `${a.name} ${a.short} ${a.en} ${a.attribute} ${a.specialty} ${a.faction}`.toLowerCase().includes(query)&&
 ['attribute','specialty','faction'].every(key=>!$('#filter-'+key).value||a[key]===$('#filter-'+key).value));
 $('#roster-count').textContent=`${filtered.length} / ${agents.length}`;
 $('#roster-empty').hidden=filtered.length>0;
 $('#roster').innerHTML=filtered.map(({a,i})=>`<button data-agent="${i}" class="agent-card ${i===agentIndex?'selected':''}" aria-label="选择${a.name}" aria-pressed="${i===agentIndex}"><span class="card-frame"><img loading="lazy" src="${a.portrait}" alt=""><b class="rank rank-${a.rarity}">${a.rarity}<small>RANK</small></b><span class="card-types"><span>${a.attribute}</span><span>${a.specialty}</span></span><span class="card-level">Lv.01</span>${modelEntries.has(a.id)?'<span class="model-badge">'+(modelEntries.get(a.id).clips.some(c=>c.animated)?'3D 动作':'3D 模型')+'</span>':''}${i===agentIndex?'<i class="card-check">✓</i>':''}</span><span class="card-name">${a.short}</span></button>`).join('');
 $('#roster').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{selectAgent(Number(button.dataset.agent));$('#agent-picker').close();}));
 $('#picker-current').textContent=current().short;
 $('#quick-roster').innerHTML=Array.from({length:Math.min(5,agents.length)},(_,n)=>(agentIndex+n-Math.floor(Math.min(5,agents.length)/2)+agents.length)%agents.length).map(i=>`<button data-agent="${i}" aria-label="切换至${agents[i].name}" aria-pressed="${i===agentIndex}" class="${i===agentIndex?'selected':''}"><img src="${agents[i].portrait}" alt=""></button>`).join('')+'<button id="quick-all" aria-label="选择全部代理人">▦</button>';
 $('#quick-roster').querySelectorAll('[data-agent]').forEach(b=>b.addEventListener('click',()=>selectAgent(Number(b.dataset.agent))));
 $('#quick-all').addEventListener('click',openPicker);
}
function openPicker(){renderRoster();$('#agent-picker').showModal();}
$('#agent-search').addEventListener('input',renderRoster);
$('#clear-filters').addEventListener('click',()=>{$('#agent-search').value='';['attribute','specialty','faction','model'].forEach(k=>$('#filter-'+k).value='');renderRoster();});
$('#picker-open').addEventListener('click',openPicker);
function renderStage() {
  const a = current();
  const entry=modelEntries.get(a.id),animated=entry?.clips.some(c=>c.animated);
  const model = $('#model-mode').checked && !!entry;
  $('#model-label').textContent=animated?'实时模型 · 原始战斗待机':'实时骨骼模型 · 动画待收集';
  screen.classList.toggle('has-model',model);
  $('#model-option').hidden = !modelIds.has(a.id);
  $('#model-stage').hidden = !model || cinemaOpen;
  if(model && $('#model-stage').dataset.agent!==a.id){$('#model-stage').src=`./motion-lab.html?character=${modelEntries.get(a.id).key}&embed=1&published=${new URLSearchParams(location.search).get('published')==='1'?'1':'0'}`;$('#model-stage').dataset.agent=a.id;}
  if(!model) {$('#model-stage').removeAttribute('src');delete $('#model-stage').dataset.agent;}
  const recorded = !model && $('#recorded-mode').checked && !!a.motion;
  $('#motion').hidden = !recorded;
  $('#character-art').hidden = model || recorded || !a.splash;
  if (a.splash) $('#character-art').src = a.splash;
  else $('#character-art').removeAttribute('src');
  $('#stage-note').textContent = model ? (animated?'原始战斗待机 · 非菜单动作':'原始绑定姿势 · 无动画 · 基础材质') : recorded ? '原版菜单录屏' : a.splash ? '原版立绘 · 菜单骨骼动作待收集' : '角色立绘与菜单骨骼动作待收集';
  $('#recorded-option').hidden = model || !a.motion;
  if (recorded) stage.load(a, tab);
  else { stage.generation++; stage.loaded = false; stage.range = null; stage.video.pause(); stage.setHidden(true); $('#loading').hidden = true; $('#media-error').hidden = true; }
  if (recorded) stage.setHidden(cinemaOpen);
}
$('#recorded-mode').addEventListener('change',()=>{$('#model-mode').checked=false;renderStage();});
$('#model-mode').addEventListener('change',renderStage);

function statsPanel(a) {
  return `<div class="identity"><span class="faction-name"><i>${a.rarity}</i> ${a.faction}</span><h1>${a.name}</h1><span class="roman-name">${a.en}</span>${a.factionIcon ? `<img class="faction-logo" src="${a.factionIcon}" alt="${a.faction}">` : ''}</div>
    <div class="level-line"><span class="level">Lv. <strong>01</strong><em>/ 10</em><span>»</span></span><div class="types"><span class="element">${a.attribute === '电' ? '<img src="./assets/ui/electric.png" alt="">' : ''}${a.attribute}</span><span>${a.specialty === '击破' ? '<img src="./assets/ui/stun.png" alt="">' : ''}${a.specialty}</span></div></div>
    <dl class="stats">${statNames.map((name, i) => `<div class="${i === 3 ? 'emphasis' : ''}"><dt>${name}</dt><dd>${a.stats[i]}</dd></div>`).join('')}</dl><span class="data-caption">基础属性 · Lv. 01 · 未装备 · <a href="${a.source}" target="_blank" rel="noreferrer">角色资料 ↗</a></span>`;
}

function skillsPanel() {
  return `<div class="core-tree" aria-label="核心技强化">${'ABCDEF'.split('').map((name, i) => `<button data-core="${i}" class="core-node ${i === 0 ? 'selected' : ''}" aria-label="核心技强化 ${name}"><span>${name}</span><img src="./assets/ui/core.png" alt=""></button>`).join('')}</div>
    <div class="skill-list">${skillNames.slice(0, 5).map((name, i) => `<button class="skill" data-skill="${i}"><span class="skill-icon"><img src="./assets/ui/${skillIcons[i]}.png" alt=""></span><span>${name}</span><b>01<span> / 12</span></b></button>`).join('')}</div><button class="core-description" data-skill="5"><img src="./assets/ui/core.png" alt="">核心技<span>查看详情 ›</span></button>`;
}

function equipmentPanel() {
  return `<div class="equipment-wheel"><button class="engine" data-slot="音擎" aria-label="查看音擎"><span class="engine-inner">＋</span><b>音擎</b></button>${[1, 2, 3, 4, 5, 6].map((n, i) => `<button class="disc disc-${i}" data-slot="驱动盘 ${n}" aria-label="查看驱动盘 ${n}"><span>${n}</span></button>`).join('')}</div><div class="equipment-caption">驱动盘 <span>0 / 6</span></div>`;
}

function renderPanel() {
  const a = current();
  const panel = $('#agent-panel');
  panel.className = `agent-panel view-${tab}`;
  panel.innerHTML = tab === 'stats' ? statsPanel(a) : tab === 'skills' ? skillsPanel() : equipmentPanel();
  panel.querySelectorAll('[data-skill]').forEach(b => b.addEventListener('click', () => skillDetail(Number(b.dataset.skill))));
  panel.querySelectorAll('[data-core]').forEach(b => b.addEventListener('click', () => {
    panel.querySelectorAll('[data-core]').forEach(n => n.classList.toggle('selected', n === b));
    skillDetail(5, `核心技强化 ${'ABCDEF'[Number(b.dataset.core)]}`);
  }));
  panel.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => openDetail(b.dataset.slot, '未装备', '当前展示角色的基础状态。')));
  $('#tabs').querySelectorAll('button').forEach(b => {
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    b.tabIndex = b.dataset.tab === tab ? 0 : -1;
  });
}

function selectAgent(index) {
  agentIndex = (index + agents.length) % agents.length;
  screen.style.setProperty('--agent-color', current().color);
  renderRoster();
  renderPanel();
  renderStage();
  if (cinemaOpen) renderCinema();
  updateCinemaCount();
  $('#announcement').textContent = `已选择${current().name}`;
}

function selectTab(next) {
  if (cinemaOpen) toggleCinema(false);
  if (tab === next) return;
  tab = next;
  renderPanel();
  stage.show(tab);
}
$('#tabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
$('#tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  const tabs = ['stats', 'skills', 'equipment'];
  selectTab(tabs[(tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3]);
  $('#tabs [aria-selected="true"]').focus();
});

function updateCinemaCount() { $('#cinema-count').textContent = `${cinemaLevels[current().id]}/6`; }

function renderCinema() {
  const a = current(), level = cinemaLevels[a.id];
  $('#cinema-name').textContent = a.name;
  $('#cinema-source').href = a.source;
  const image = $('#cinema-image');
  const art = a.cinemaImages[level === 0 ? 0 : level === 6 ? 2 : 1];
  image.hidden = !art;
  if (art) image.src = art; else image.removeAttribute('src');
  $('#cinema-missing').hidden = !!art;
  image.alt = `${a.name} · ${level === 0 ? '未解锁' : level === 6 ? '完整' : '局部'}影画`;
  $('#cinema-nodes').innerHTML = a.cinema.map(([name], i) => `<button class="cinema-node ${i < level ? 'unlocked' : ''} ${i + 1 === level ? 'selected' : ''}" data-level="${i + 1}" aria-pressed="${level === i + 1}"><span>${String(i + 1).padStart(2, '0')}</span><b>${name}</b><i>${i < level ? '◆' : '◇'}</i></button>`).join('');
  $('#cinema-nodes').querySelectorAll('button').forEach(b => b.addEventListener('click', () => setCinemaLevel(Number(b.dataset.level))));
  $('#cinema-number').textContent = level === 0 ? 'MINDSCAPE CINEMA' : `${String(level).padStart(2, '0')} / 06`;
  $('#cinema-title').textContent = level === 0 ? '影画' : a.cinema[level - 1][0];
  $('#cinema-description').textContent = level === 0 ? '选择影画查看效果' : a.cinema[level - 1][1];
  $('#cinema-level').value = level;
  $('#cinema-output').value = `${level} / 6`;
  updateCinemaCount();
}
function setCinemaLevel(level) { cinemaLevels[current().id] = level; renderCinema(); }
$('#cinema-level').addEventListener('input', e => setCinemaLevel(Number(e.target.value)));

function toggleCinema(value) {
  cinemaOpen = value;
  $('#cinema').hidden = !value;
  screen.classList.toggle('cinema-visible', value);
  $('#model-stage').hidden = value || !$('#model-mode').checked || !modelIds.has(current().id);
  stage.setHidden(value || !$('#recorded-mode').checked || !current().motion);
  if (value) { renderCinema(); $('#cinema-nodes button').focus(); }
  else $('#cinema-open').focus();
  $('#back').setAttribute('aria-label', value ? '返回角色展示' : '返回属性');
}
$('#cinema-open').addEventListener('click', () => toggleCinema(true));
$('#back').addEventListener('click', () => cinemaOpen ? toggleCinema(false) : selectTab('stats'));
$('#retry').addEventListener('click', () => stage.load(current(), tab));

function openDetail(kicker, title, text) {
  $('#detail-body').innerHTML = `<span class="detail-kicker"></span><h2></h2><p></p>`;
  $('#detail-body .detail-kicker').textContent = kicker;
  $('#detail-body h2').textContent = title;
  $('#detail-body p').textContent = text;
  $('#detail').showModal();
}
function skillDetail(i, kicker = skillNames[i]) { openDetail(kicker, current().skills[i] || '技能资料待整理', current().descriptions[i] || '已收集角色资料来源，尚未核实此项游戏内文案。'); }
$('#sources-open').addEventListener('click', () => $('#sources').showModal());
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
});
addEventListener('keydown', e => {
  if ($('dialog[open]') || e.target.matches('input, textarea')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); selectAgent(agentIndex + (e.key === 'ArrowRight' ? 1 : -1)); }
  if (['1', '2', '3'].includes(e.key)) selectTab(['stats', 'skills', 'equipment'][Number(e.key) - 1]);
  if (e.key.toLowerCase() === 'c') toggleCinema(!cinemaOpen);
  if (e.key === 'Escape') cinemaOpen ? toggleCinema(false) : selectTab('stats');
});
selectAgent(0);
openPicker();
