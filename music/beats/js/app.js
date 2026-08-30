// 主逻辑：状态管理、URL 分享、播放/节拍器调度、校准、控件绑定
window.App = (function () {
  const AU = window.AudioEngine;

  // ---------- 节奏型定义（时值单位：十六分音符，长度约一拍，随机生成时逐段混搭） ----------
  const PATTERNS = [
    { id: 'q', name: '四分平奏', seq: [4] },
    { id: 'e', name: '八分平奏', seq: [2, 2] },
    { id: 's', name: '十六分平奏', seq: [1, 1, 1, 1] },
    { id: 'a816', name: '前八后十六', seq: [2, 1, 1] },
    { id: 'a168', name: '前十六后八', seq: [1, 1, 2] },
    { id: 'syn', name: '切分', seq: [1, 2, 1] },
    { id: 'trip', name: '四分三连音', seq: ['T'] },
    { id: 'dq8', name: '附点四分+八分', seq: [6, 2] },
    { id: 'de16', name: '附点八分+十六分', seq: [3, 1] },
    { id: 'bsyn', name: '大切分', seq: [2, 4, 2] },
    { id: 'rsyn', name: '休止切分', seq: [{ r: 1 }, 2, { r: 1 }] },
    { id: 'dots', name: '连续附点', seq: [3, 3, 3, 1] },
  ];
  const DEFAULT_PATTERNS = ['q', 'e', 'a816', 'a168', 'syn', 'dq8', 'de16', 'trip'];

  // ---------- 状态 ----------
  const state = {
    timeSig: { num: 4, den: 4 },
    measureCount: 8,
    bpm: 90,
    measures: [],
    metOn: false,
    demoOn: true,
    loopStart: 0,
    loopEnd: 7,
    latency: 0,
    patterns: DEFAULT_PATTERNS.slice(),
  };

  // ---------- URL 分享 ----------
  function encodeState() {
    const m = state.measures.map(arr =>
      (arr || []).map(e => `${e.k === 'n' ? '' : e.k}${e.d}${e.tie ? '~' : ''}`).join(',')
    ).join('|');
    const json = JSON.stringify({
      v: 1, t: `${state.timeSig.num}/${state.timeSig.den}`,
      n: state.measureCount, b: state.bpm, l: state.latency, m
    });
    return btoa(unescape(encodeURIComponent(json)));
  }
  function saveURL() {
    const h = '#s=' + encodeState();
    history.replaceState(null, '', h);
  }
  function loadURL() {
    const mHash = location.hash.match(/^#s=(.+)$/);
    if (!mHash) return false;
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(mHash[1]))));
      if (o.v !== 1) return false;
      const [num, den] = o.t.split('/').map(Number);
      state.timeSig = { num, den };
      state.measureCount = o.n;
      state.bpm = o.b;
      state.latency = o.l || 0;
      state.measures = String(o.m).split('|').map(s =>
        s ? s.split(',').map(tok => {
          const tie = tok.endsWith('~');
          if (tie) tok = tok.slice(0, -1);
          const k = 'tr'.includes(tok[0]) ? tok[0] : 'n';
          const d = Number(k === 'n' ? tok : tok.slice(1));
          return { k, d, tie: !!tie };
        }) : []
      );
      while (state.measures.length < state.measureCount) state.measures.push([]);
      state.loopStart = 0; state.loopEnd = state.measureCount - 1;
      return true;
    } catch (e) { return false; }
  }

  const MU = window.MusicUtil;
  function measureSix() { return MU.measureSixteenths(state.timeSig); }
  function beatSix() { return state.timeSig.den === 8 ? 2 : 4; }

  // ---------- 随机生成 ----------
  function randomGenerate() {
    const pats = PATTERNS.filter(p => state.patterns.includes(p.id));
    if (!pats.length) return;
    const ms = measureSix();
    for (let m = 0; m < state.measureCount; m++) {
      const out = [];
      let filled = 0, tries = 0;
      while (filled < ms && tries++ < 100) {
        // 每段随机取一种节奏型，能放多少放多少，放不下即换下一种 —— 小节内节奏混搭
        const pat = pats[Math.floor(Math.random() * pats.length)];
        let progressed = false;
        for (const item of pat.seq) {
          const d = item === 'T' ? 8 : typeof item === 'object' ? item.r : item;
          if (filled + d > ms) break;
          out.push(item === 'T' ? { k: 't', d: 8 }
            : typeof item === 'object' ? { k: 'r', d: item.r } : { k: 'n', d: item });
          filled += d;
          progressed = true;
        }
        if (!progressed && tries >= 20) { // 兜底：剩余空隙放不下任何节奏型，补休止
          out.push({ k: 'r', d: ms - filled });
          filled = ms;
        }
      }
      if (filled < ms) { out.push({ k: 'r', d: ms - filled }); filled = ms; }
      state.measures[m] = out;
    }
    Staff.render();
    updatePracticeRef();
    saveURL();
  }

  // ---------- 播放引擎 ----------
  let playing = false;
  let playT0 = 0, regionSec = 1, regionSix = 1, loopStartSix = 0;
  let events = [];            // {tSec, type:'note'|'click', strong}
  let schedTimer = null, rafId = null;
  let schedAbs = 0, evIdx = 0, playCycle = 0, lastVisCycle = -1;
  let noteOnsetsSec = [];

  // 根据当前谱面/滑块区间刷新练习区参考行（未播放时也保持同步）
  function updatePracticeRef() {
    const ms = measureSix();
    const bs = beatSix();
    const onsets = [];
    for (let m = state.loopStart; m <= state.loopEnd; m++) {
      const arr = state.measures[m] || [];
      for (const evt of MU.expand(arr, 0)) {
        // 延音连到前一音符的元素不产生新拍点
        if ((evt.e.k === 't' || evt.e.k === 'n') && !evt.e.tie) {
          onsets.push(((m - state.loopStart) * ms + evt.onset) * secPerSix());
        }
      }
    }
    const regionSix = (state.loopEnd - state.loopStart + 1) * ms;
    // 网格：小节起点（粗线）与每拍位置（细线）
    const measStarts = [], beatMarks = [];
    for (let s = 0; s < regionSix; s += bs) {
      (s % ms === 0 ? measStarts : beatMarks).push(s * secPerSix());
    }
    Practice.setReference(onsets, regionSix * secPerSix(), measStarts, beatMarks, bs * secPerSix());
    Practice.render();
  }

  function buildEvents() {
    const ms = measureSix();
    const bs = beatSix();
    loopStartSix = state.loopStart * ms;
    regionSix = (state.loopEnd - state.loopStart + 1) * ms;
    events = [];
    noteOnsetsSec = [];
    for (let m = state.loopStart; m <= state.loopEnd; m++) {
      const arr = state.measures[m] || [];
      for (const evt of MU.expand(arr, 0)) {
        const tSec = ((m - state.loopStart) * ms + evt.onset) * secPerSix();
        // 示范开关关闭时不出声，但参考拍点仍保留（练习区参考行不变）
        if ((evt.e.k === 't' || evt.e.k === 'n') && !evt.e.tie) {
          if (state.demoOn) events.push({ tSec, type: 'note' });
          noteOnsetsSec.push(tSec);
        }
      }
    }
    if (state.metOn) {
      for (let s = 0; s < regionSix; s += bs) {
        events.push({ tSec: s * secPerSix(), type: 'click', strong: s % (bs * state.timeSig.num) === 0 });
      }
    }
    events.sort((a, b) => a.tSec - b.tSec);
    regionSec = regionSix * secPerSix();
  }
  function secPerSix() { return 60 / state.bpm / 4; }

  function schedulerTick() {
    const ctx = AU.ctx;
    if (!events.length) return; // 关示范且关节拍器时无事件
    const horizon = ctx.currentTime + 0.15;
    while (true) {
      if (evIdx >= events.length) { evIdx = 0; schedAbs += regionSec; }
      const ev = events[evIdx];
      const at = playT0 + schedAbs + ev.tSec;
      if (at > horizon) break;
      if (at >= ctx.currentTime - 0.02) {
        if (ev.type === 'note') AU.note(at);
        else AU.click(at, ev.strong);
      }
      evIdx++;
    }
  }

  function rafLoop() {
    const ctx = AU.ctx;
    const elapsed = ctx.currentTime - playT0;
    if (elapsed >= 0) {
      const posSec = elapsed % regionSec;
      const cycle = Math.floor(elapsed / regionSec);
      if (cycle !== lastVisCycle) { Practice.newCycle(cycle); lastVisCycle = cycle; }
      Staff.setPlayhead(loopStartSix + posSec / secPerSix());
      Practice.setSweep(posSec / regionSec);
    }
    rafId = requestAnimationFrame(rafLoop);
  }

  function startPlay() {
    AU.ensure();
    stopMetronomeGrid();
    buildEvents();
    playing = true;
    playCycle = 0; lastVisCycle = -1;
    evIdx = 0; schedAbs = 0;
    playT0 = AU.ctx.currentTime + 0.15;
    schedTimer = setInterval(schedulerTick, 25);
    Practice.reset();
    updatePracticeRef();  // 重建参考行+网格（含 measStarts/beatMarks）
    Practice.newCycle(0);
    lastVisCycle = 0;
    rafId = requestAnimationFrame(rafLoop);
    const b = document.getElementById('playBtn');
    b.textContent = '停止'; b.classList.add('playing');
  }
  function stopPlay() {
    if (!playing) return;
    playing = false;
    clearInterval(schedTimer); cancelAnimationFrame(rafId);
    Staff.setPlayhead(null);
    Practice.setSweep(null);
    Practice.finalize();
    const b = document.getElementById('playBtn');
    b.textContent = '播放'; b.classList.remove('playing');
    if (state.metOn) startMetronomeGrid();
  }

  // ---------- 独立节拍器 ----------
  let metTimer = null, metT0 = 0, metNext = 0, metBeat = 0;
  function startMetronomeGrid() {
    AU.ensure();
    metT0 = AU.ctx.currentTime + 0.1;
    metNext = metT0; metBeat = 0;
    clearInterval(metTimer);
    metTimer = setInterval(() => {
      const horizon = AU.ctx.currentTime + 0.15;
      while (metNext < horizon) {
        AU.click(metNext, metBeat % state.timeSig.num === 0);
        metBeat++;
        metNext += beatSix() * secPerSix();
      }
    }, 25);
  }
  function stopMetronomeGrid() {
    clearInterval(metTimer); metTimer = null;
  }

  // ---------- 打拍 ----------
  function registerTap() {
    if (calibMode) { calibTap(); return; }
    if (!playing) return;
    const elapsed = AU.ctx.currentTime - playT0;
    if (elapsed < 0) return;
    const posSec = (elapsed % regionSec) - state.latency / 1000;
    const dev = Practice.nearestDev(posSec);
    // 早于第一拍的点击（相对下一轮循环的拍 0 取模落在区域末尾）折回到起点前的一拍留白区显示
    let disp = posSec;
    if (dev != null && dev < 0 && Math.abs(dev - (posSec - regionSec) * 1000) < 1e-6)
      disp = posSec - regionSec;
    Practice.tap(disp, dev);
  }

  // ---------- 校准 ----------
  let calibMode = false, calibDeltas = [];
  const calibOverlay = document.getElementById('calibOverlay');
  function startCalib() {
    if (playing) stopPlay();
    calibMode = true; calibDeltas = [];
    calibOverlay.hidden = false;
    updateCalibUI();
    if (!state.metOn && !metTimer) startMetronomeGrid();
  }
  function calibTap() {
    if (!metTimer) startMetronomeGrid();
    const beatSec = beatSix() * secPerSix();
    const now = AU.ctx.currentTime;
    const nearest = metT0 + Math.round((now - metT0) / beatSec) * beatSec;
    calibDeltas.push((now - nearest) * 1000);
    updateCalibUI();
  }
  function updateCalibUI() {
    const avg = calibDeltas.length
      ? calibDeltas.reduce((s, d) => s + d, 0) / calibDeltas.length : null;
    document.getElementById('calibAvg').textContent =
      avg == null ? '--' : (avg >= 0 ? '+' : '') + avg.toFixed(1);
    document.getElementById('calibCount').textContent = calibDeltas.length;
  }
  function endCalib(commit) {
    calibMode = false;
    calibOverlay.hidden = true;
    if (commit && calibDeltas.length) {
      const avg = calibDeltas.reduce((s, d) => s + d, 0) / calibDeltas.length;
      state.latency = Math.round(avg);
      document.getElementById('latency').value = state.latency;
      saveURL();
    }
    if (!state.metOn) stopMetronomeGrid();
  }

  // ---------- 拍号 / 小节数 ----------
  function setTimeSig(num, den) {
    if (playing) stopPlay();
    state.timeSig = { num, den };
    Staff.reflow();
    saveURL();
  }

  function setMeasureCount(n) {
    n = Math.min(Math.max(n, 1), 64);
    if (playing) stopPlay();
    state.measureCount = n;
    while (state.measures.length < n) state.measures.push([]);
    state.measures.length = n;
    state.loopEnd = Math.min(state.loopEnd, n - 1);
    state.loopStart = Math.min(state.loopStart, state.loopEnd);
    for (let i = 0; i < n; i++) Staff.fillRests(i);
    syncLoopUI();
    Staff.render();
    updatePracticeRef();
    saveURL();
  }

  // ---------- 控件绑定 ----------
  function syncLoopUI() {
    const s = document.getElementById('loopStart'), e = document.getElementById('loopEnd');
    s.max = e.max = state.measureCount;
    s.value = state.loopStart + 1; e.value = state.loopEnd + 1;
    document.getElementById('loopStartVal').textContent = state.loopStart + 1;
    document.getElementById('loopEndVal').textContent = state.loopEnd + 1;
  }

  function bindControls() {
    const $ = id => document.getElementById(id);

    $('measureCount').addEventListener('change', e => setMeasureCount(+e.target.value || 8));
    $('bpm').addEventListener('change', e => {
      const v = Math.min(Math.max(+e.target.value || 90, 30), 300);
      e.target.value = v; state.bpm = v;
      if (playing) stopPlay();
      if (state.metOn) startMetronomeGrid();
      saveURL();
    });
    $('latency').addEventListener('change', e => {
      state.latency = Math.min(Math.max(+e.target.value || 0, -500), 500);
      e.target.value = state.latency;
      saveURL();
    });

    $('randomBtn').addEventListener('click', randomGenerate);

    $('playBtn').addEventListener('click', () => playing ? stopPlay() : startPlay());

    $('metToggle').addEventListener('change', e => {
      state.metOn = e.target.checked;
      if (state.metOn) { if (!playing) startMetronomeGrid(); }
      else if (!calibMode) stopMetronomeGrid();
    });

    $('demoToggle').addEventListener('change', e => {
      state.demoOn = e.target.checked;
      if (playing) { stopPlay(); startPlay(); }
    });

    $('calibBtn').addEventListener('click', startCalib);

    $('tieBtn').addEventListener('click', e => {
      const on = !Staff.tieMode;
      Staff.setTieMode(on);
      e.currentTarget.classList.toggle('active', on);
    });

    $('loopStart').addEventListener('input', e => {
      state.loopStart = Math.min(+e.target.value - 1, state.loopEnd);
      if (playing) stopPlay();
      syncLoopUI(); Staff.render(); updatePracticeRef(); saveURL();
    });
    $('loopEnd').addEventListener('input', e => {
      state.loopEnd = Math.max(+e.target.value - 1, state.loopStart);
      if (playing) stopPlay();
      syncLoopUI(); Staff.render(); updatePracticeRef(); saveURL();
    });

    // 节奏型多选下拉
    const drop = $('patternDrop'), panel = $('patternPanel'), pbtn = $('patternBtn');
    const patternName = () => {
      const n = state.patterns.length;
      pbtn.textContent = n ? `节奏型(${n}) ▾` : '节奏型 ▾';
    };
    for (const p of PATTERNS) {
      const lab = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = p.id;
      cb.checked = state.patterns.includes(p.id);
      cb.addEventListener('change', () => {
        if (cb.checked) state.patterns.push(p.id);
        else state.patterns = state.patterns.filter(x => x !== p.id);
        patternName();
      });
      lab.appendChild(cb);
      lab.appendChild(Staff.renderPattern(p.seq));
      lab.appendChild(document.createTextNode(' ' + p.name));
      panel.appendChild(lab);
    }
    pbtn.addEventListener('click', e => { e.stopPropagation(); drop.classList.toggle('open'); });
    document.addEventListener('click', e => {
      if (!drop.contains(e.target)) drop.classList.remove('open');
    });
    patternName();

    // 练习区点击 = 打拍
    $('practiceWrap').addEventListener('click', registerTap);

    // 全局键盘
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (calibMode) {
        if (e.key === 'Enter') { endCalib(true); e.preventDefault(); return; }
        if (e.key === 'Escape') { endCalib(false); e.preventDefault(); return; }
        calibTap(); e.preventDefault(); return;
      }
      if (tag === 'button' && e.key === 'Enter') return; // 避免触发按钮
      if (Staff.editing) {
        if (Staff.handleKey(e)) e.preventDefault();
        return;
      }
      if (playing) { registerTap(); e.preventDefault(); }
    });
  }

  // ---------- 启动 ----------
  function init() {
    const fromURL = loadURL();
    if (!fromURL) {
      state.measures = Array.from({ length: state.measureCount }, () => []);
      randomGenerate();
    } else {
      for (let i = 0; i < state.measureCount; i++) Staff.fillRests(i);
    }
    Staff.onEditChange = () => { saveURL(); updatePracticeRef(); };
    bindControls();
    document.getElementById('measureCount').value = state.measureCount;
    document.getElementById('bpm').value = state.bpm;
    document.getElementById('latency').value = state.latency;
    syncLoopUI();
    Staff.render();
    updatePracticeRef();
    Practice.render();
    if (!fromURL) saveURL();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { state, registerTap, setTimeSig, randomGenerate };
})();
