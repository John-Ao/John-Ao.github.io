const $ = selector => document.querySelector(selector);
const requestedVersion = new URLSearchParams(location.search).get('version');
const version = ['1', '2', '3'].includes(requestedVersion) ? Number(requestedVersion) : 1;
const titles = ['Q版泡泡堂', 'Q版泡泡堂2中文版', 'Q版泡泡堂3升级版'];
document.title = titles[version - 1];
$('#game').setAttribute('aria-label', document.title);
$('#version').value = String(version);
let pendingVersion = version;
$('#version').addEventListener('change', () => {
  pendingVersion = Number($('#version').value);
  $('#version').value = String(version);
  if (pendingVersion !== version) showDialog($('#confirm-version'));
});
$('#two-player').textContent = version === 1
  ? '双人：1P 方向键移动、回车放炸弹；2P WASD 移动、空格放炸弹。'
  : '双人：1P WASD 移动、空格放炸弹；2P 方向键移动、回车放炸弹。';
let player;
let paused = false;
let muted = false;
let dialogWasPaused = false;
const held = new Map();
const keys = { ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39], Space: [' ', 32] };
function keyEvent(code, type) {
  const [key, keyCode] = keys[code];
  const target = player?.shadowRoot?.querySelector('canvas') || player;
  target?.dispatchEvent(new KeyboardEvent(type, { key, code, keyCode, which: keyCode, bubbles: true, composed: true, cancelable: true }));
}
function releaseKeys() {
  for (const code of held.values()) keyEvent(code, 'keyup');
  held.clear();
  document.querySelectorAll('.held').forEach(button => button.classList.remove('held'));
}
function setPaused(value) {
  if (!player) return;
  releaseKeys(); paused = value;
  if (paused) player.ruffle().suspend(); else player.ruffle().resume();
  $('#pause').textContent = paused ? '继续' : '暂停';
}
function focusGame() { player?.focus(); }
$('#pause').onclick = () => { setPaused(!paused); focusGame(); };
$('#sound').onclick = () => {
  muted = !muted; player.ruffle().volume = muted ? 0 : 1;
  $('#sound').textContent = muted ? '开启声音' : '静音';
  $('#sound').setAttribute('aria-pressed', String(muted)); focusGame();
};
$('#fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('#game').requestFullscreen(); }
  catch { $('#fullscreen').textContent = '暂不支持全屏'; }
  focusGame();
};
document.addEventListener('fullscreenchange', () => { $('#fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
function showDialog(dialog) { dialogWasPaused = paused; setPaused(true); dialog.showModal(); }
$('#help').onclick = () => showDialog($('#instructions'));
$('#restart').onclick = () => showDialog($('#confirm-restart'));
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'switch') {
    const url = new URL(location.href);
    url.searchParams.set('version', String(pendingVersion));
    location.assign(url);
  } else if (dialog.returnValue === 'restart') location.reload();
  else { setPaused(dialogWasPaused); focusGame(); }
});
for (const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); if (!player || paused) return;
    button.setPointerCapture(event.pointerId); held.set(event.pointerId, button.dataset.key);
    focusGame(); keyEvent(button.dataset.key, 'keydown'); button.classList.add('held');
  });
  const release = event => {
    const code = held.get(event.pointerId); if (!code) return;
    held.delete(event.pointerId); keyEvent(code, 'keyup'); button.classList.remove('held');
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
window.addEventListener('blur', releaseKeys);
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
try {
  if (!window.RufflePlayer?.newest) throw new Error('播放器文件未加载');
  player = window.RufflePlayer.newest().createPlayer();
  player.tabIndex = 0;
  player.addEventListener('click', () => {
    if (paused && player.ruffle().isPlaying) {
      paused = false;
      $('#pause').textContent = '暂停';
    }
  });
  $('#player').append(player);
  const response = await fetch(`./assets/bomb${version}.swf`);
  if (!response.ok) throw new Error(`游戏资源 HTTP ${response.status}`);
  const data = await response.arrayBuffer();
  let loadTimer;
  const ready = new Promise((resolve, reject) => {
    player.addEventListener('loadeddata', resolve, { once: true });
    loadTimer = setTimeout(() => reject(new Error('加载超时')), 45000);
  });
  try {
    await Promise.all([ready, player.ruffle().load({ data, swfFileName: `bomb${version}.swf`, autoplay: 'on', splashScreen: false, unmuteOverlay: 'hidden',
      allowScriptAccess: false, allowNetworking: 'none', openUrlMode: 'deny', contextMenu: 'off',
      scale: 'showAll', forceScale: true, letterbox: 'on', logLevel: 'error' })]);
  } finally { clearTimeout(loadTimer); }
  const metadata = player.ruffle().metadata;
  if (metadata) $('#stage').style.setProperty('--ratio', metadata.width / metadata.height);
  $('#status').hidden = true;
  $('#pause').disabled = false; $('#sound').disabled = false;
  focusGame();
} catch (error) {
  console.error(error);
  $('#status').textContent = '游戏加载失败，请刷新重试。请通过 HTTP / HTTPS 打开本页。';
}
