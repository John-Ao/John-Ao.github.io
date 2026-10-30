import { CharacterStage } from './stage.js';
import { describeClip, chooseIdle } from './animation.js';

const $ = id => document.getElementById(id);
const playerControls = ['play', 'restart', 'timeline', 'speed', 'loop'];
const elementKeys = { physical: 'physic', heat: 'fire', cryo: 'ice' };
const backgrounds = { light: '#e9e9e3', gray: '#a4a7a4', dark: '#202321' };
let catalog, operators = [], selected, clips = [], activeClip, loading = false, version = 0;
let retryAction, scrub = false;
export let stage;

function reportError(error, retry) {
  if (error?.name === 'AbortError') return;
  console.error(error);
  $('loading').hidden = true;
  $('error').hidden = false;
  $('error-text').textContent = error.message || '加载失败，请检查网络后重试。';
  retryAction = retry;
}

function progress(label, fraction, bytes) {
  $('loading-label').textContent = label + (bytes > 0 ? ` · ${(bytes / 1048576).toFixed(1)} MB` : '');
  if (fraction == null) $('loading-progress').removeAttribute('value');
  else $('loading-progress').value = Math.round(fraction * 100);
}

function setLoading(value) {
  loading = value;
  $('loading').hidden = !value;
  $('loading').setAttribute('aria-busy', String(value));
  if (value) $('error').hidden = true;
  for (const id of playerControls) $(id).disabled = value || !stage?.action;
}

function frame(time, duration, playing) {
  if (!scrub) {
    $('timeline').value = duration ? time / duration : 0;
    $('timeline').style.setProperty('--progress', `${duration ? time / duration * 100 : 0}%`);
  }
  $('time').textContent = `${time.toFixed(1)} / ${duration.toFixed(1)} s`;
  const label = playing ? '暂停' : '播放';
  if ($('play').getAttribute('aria-label') !== label) {
    $('play').setAttribute('aria-label', label);
    $('play').title = `${label}（空格）`;
    $('play').innerHTML = playing
      ? '<span class="pause-icon" aria-hidden="true">Ⅱ</span>'
      : '<svg class="icon" aria-hidden="true"><use href="#i-play" /></svg>';
  }
}

function updateLocation() {
  const url = new URL(location.href);
  url.searchParams.set('character', selected.id);
  if (activeClip) url.searchParams.set('clip', activeClip.name);
  else url.searchParams.delete('clip');
  history.replaceState(null, '', url);
}

function renderRoster() {
  const query = $('search').value.trim().toLowerCase();
  const filter = elementKeys[$('element-filter').value] || $('element-filter').value;
  const filtered = operators.filter(op => (filter === 'all' || op.elementKey === filter)
    && `${op.name} ${op.englishName} ${op.class} ${op.element}`.toLowerCase().includes(query));
  $('roster').replaceChildren();
  for (const op of filtered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'operator-card';
    button.setAttribute('aria-pressed', String(op.id === selected?.id));
    button.dataset.character = op.id;
    const image = new Image();
    image.src = op.portrait; image.alt = ''; image.loading = 'lazy';
    image.width = 303; image.height = 386;
    const info = document.createElement('span'); info.className = 'card-info';
    const name = document.createElement('strong'); name.textContent = op.name;
    const meta = document.createElement('small'); meta.textContent = `${op.rarity}★ · ${op.element} · ${op.class}`;
    info.append(name, meta); button.append(image, info);
    button.addEventListener('click', () => { $('roster-dialog').close(); selectCharacter(op); });
    $('roster').append(button);
  }
  if (!filtered.length) {
    const message = document.createElement('p'); message.className = 'empty-state'; message.textContent = '没有匹配的角色'; $('roster').append(message);
  }
  $('roster-count').textContent = `${catalog.operatorCount} 名干员 · ${operators.length} 个外观 · 当前 ${filtered.length} 个`;
}

function renderClips() {
  const query = $('animation-search').value.trim().toLowerCase();
  const category = $('animation-category').value;
  const filtered = clips.filter(clip => (category === 'all' || clip.category === category)
    && `${clip.name} ${clip.label}`.toLowerCase().includes(query));
  $('animations').replaceChildren();
  $('clip-count').textContent = `${filtered.length} / ${clips.length}`;
  for (const clip of filtered) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'animation-item';
    button.dataset.clip = clip.name;
    button.setAttribute('aria-pressed', String(clip.name === activeClip?.name));
    const title = document.createElement('strong'); title.textContent = clip.label;
    const code = document.createElement('small'); code.textContent = clip.name;
    button.title = clip.name; button.append(title, code);
    button.addEventListener('click', () => { selectClip(clip); document.body.classList.remove('animations-open'); $('toggle-animations').setAttribute('aria-expanded', 'false'); });
    $('animations').append(button);
  }
  if (!filtered.length) {
    const message = document.createElement('p'); message.className = 'empty-state'; message.textContent = '没有匹配的动作'; $('animations').append(message);
  }
}

async function selectCharacter(character, requestedClip) {
  const generation = ++version;
  selected = character;
  activeClip = null;
  clips = (character.animations || []).map(describeClip);
  $('character-name').textContent = character.name;
  $('character-en').textContent = character.englishName;
  $('character-meta').textContent = `${character.rarity}★　${character.element} / ${character.class}`;
  $('character-position').textContent = `${String(operators.indexOf(character) + 1).padStart(2, '0')} / ${operators.length}`;
  $('animation-search').value = '';
  $('animation-category').value = 'all';
  $('time').textContent = '0.0 / 0.0 s';
  $('timeline').value = 0;
  renderClips(); renderRoster(); updateLocation(); setLoading(true);
  try {
    if (!stage) throw new Error('当前浏览器无法启动 WebGL 2，请使用支持硬件加速的浏览器。');
    if (!(await stage.load(character)) || generation !== version) return;
    const clip = clips.find(x => x.name === requestedClip) || chooseIdle(clips);
    if (clip) await selectClip(clip, generation);
    else setLoading(false);
  } catch (error) {
    if (generation === version) reportError(error, () => selectCharacter(character, requestedClip));
  }
}

let clipVersion = 0;
async function selectClip(clip, generation = version) {
  if (!stage?.mixer) return;
  const request = ++clipVersion;
  setLoading(true);
  try {
    if (!(await stage.playClip(clip)) || request !== clipVersion || generation !== version) return;
    activeClip = clip;
    $('toggle-animations').textContent = `${clip.label} ▴`;
    renderClips(); updateLocation(); setLoading(false);
  } catch (error) {
    if (request === clipVersion && generation === version) reportError(error, () => selectClip(clip));
  }
}

function adjacent(direction) {
  if (!operators.length) return;
  selectCharacter(operators[(operators.indexOf(selected) + direction + operators.length) % operators.length]);
}

function toggleUI() {
  const hidden = document.body.classList.toggle('ui-hidden');
  $('hide-ui').setAttribute('aria-pressed', String(hidden));
  $('hide-ui').setAttribute('aria-label', hidden ? '显示界面' : '隐藏界面');
  $('hide-ui').title = hidden ? '显示界面（H）' : '隐藏界面（H）';
}

for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(button.dataset.close).close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
$('choose-character').addEventListener('click', () => { $('roster-dialog').showModal(); $('search').focus(); });
$('source-open').addEventListener('click', () => $('sources-dialog').showModal());
$('search').addEventListener('input', renderRoster);
$('element-filter').addEventListener('change', renderRoster);
$('animation-search').addEventListener('input', renderClips);
$('animation-category').addEventListener('change', renderClips);
$('previous-character').addEventListener('click', () => adjacent(-1));
$('next-character').addEventListener('click', () => adjacent(1));
$('retry').addEventListener('click', () => retryAction?.());
$('play').addEventListener('click', () => { if (stage?.action) { if (stage.action.paused) stage.seek(0); stage.playing = !stage.playing; } });
$('restart').addEventListener('click', () => { stage?.seek(0); if (stage) stage.playing = true; });
$('timeline').addEventListener('pointerdown', () => { scrub = true; });
window.addEventListener('pointerup', () => { scrub = false; });
$('timeline').addEventListener('input', () => stage?.seek(Number($('timeline').value)));
$('speed').addEventListener('change', () => { if (stage) stage.speed = Number($('speed').value); });
$('loop').addEventListener('change', () => stage?.setLoop($('loop').checked));
for (const view of ['front', 'back', 'face']) $(`view-${view}`).addEventListener('click', () => stage?.setView(view));
$('reset-camera').addEventListener('click', () => stage?.setView('front'));
$('auto-rotate').addEventListener('change', () => { if (stage) stage.controls.autoRotate = $('auto-rotate').checked; });
$('show-grid').addEventListener('change', () => { if (stage) stage.grid.visible = $('show-grid').checked; });
$('background').addEventListener('change', () => { document.body.dataset.background = $('background').value; });
$('hide-ui').addEventListener('click', toggleUI);
$('toggle-animations').addEventListener('click', () => {
  const open = document.body.classList.toggle('animations-open');
  $('toggle-animations').setAttribute('aria-expanded', String(open));
});
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { $('fullscreen').title = '此浏览器不支持全屏'; }
});
$('screenshot').addEventListener('click', async () => {
  if (!stage?.model) return;
  const blob = await stage.screenshot(backgrounds[$('background').value]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `${selected.name}-${activeClip?.name || 'model'}.png`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('keydown', event => {
  if (event.target.matches('input,select,textarea,button') || document.querySelector('dialog[open]')) return;
  if (event.code === 'Space') { event.preventDefault(); $('play').click(); }
  if (event.key === 'ArrowLeft') adjacent(-1);
  if (event.key === 'ArrowRight') adjacent(1);
  if (event.key.toLowerCase() === 'h') toggleUI();
  if (event.key.toLowerCase() === 'r') stage?.setView('front');
  if (event.key === 'Escape' && document.body.classList.contains('ui-hidden')) toggleUI();
});
$('viewport').addEventListener('stage-error', event => reportError(new Error(event.detail), () => location.reload()));
$('viewport').addEventListener('stage-restored', () => selected && selectCharacter(selected, activeClip?.name));

async function init() {
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error(`角色目录加载失败（HTTP ${response.status}）`);
    catalog = await response.json();
    operators = catalog.operators;
    $('sources-content').textContent = `收录截至 ${catalog.verifiedAt} 的 ${catalog.operatorCount} 名已实装干员，共 ${operators.length} 个外观。${operators.some(op => op.id === 'endministrator1') && operators.some(op => op.id === 'endministrator2') ? '管理员男女形象分别展示。' : ''}共 ${operators.reduce((sum, op) => sum + op.animations.length, 0).toLocaleString()} 段公开骨骼动作；动作名保留源文件标识。`;
    try { stage = new CharacterStage($('viewport'), progress, frame); }
    catch (error) { console.error(error); }
    const params = new URLSearchParams(location.search);
    const initial = operators.find(op => op.id === params.get('character')) || operators.find(op => op.id === 'perlica') || operators[0];
    await selectCharacter(initial, params.get('clip'));
  } catch (error) { reportError(error, init); }
}
init();
