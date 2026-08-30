// 练习区：参考行 + 用户打拍历史行（新在上），竖线扫描与偏差统计
window.Practice = (function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const W = 1000, L_PAD = 70, R_PAD = 100, ROW_H = 26, TOP = 8;
  const PLOT_W = W - L_PAD - R_PAD;
  const MAX_ROWS = 8;

  const wrap = document.getElementById('practiceWrap');
  const statsEl = document.getElementById('practiceStats');

  let refOnsets = [];      // 参考拍点（秒，区域内）
  let measStarts = [];     // 各小节起点（秒，区域内）
  let beatMarks = [];      // 各拍位置（秒，区域内）
  let regionDur = 1;       // 区域时长（秒）
  let leadSec = 0;         // 起点前预留时长（一拍），用于显示早于第一拍的点击
  let rows = [];           // {cycle, taps:[{pos,dev}]}，新在上
  let curRow = null;
  let sweepEl = null, svgRoot = null;

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function setReference(onsetsSec, regionDurSec, measStartsSec, beatMarksSec, beatSec) {
    refOnsets = onsetsSec.slice().sort((a, b) => a - b);
    measStarts = measStartsSec || [];
    beatMarks = beatMarksSec || [];
    regionDur = Math.max(regionDurSec, 0.001);
    leadSec = Math.min(beatSec || 0, regionDur);
  }

  // pos → x：起点左侧预留一拍（lead 区，上限 60px），pos 允许为负（早于第一拍）
  const LEAD_MAX = 60;
  function leadW() { return Math.min(leadSec / regionDur * PLOT_W, LEAD_MAX); }
  function xOf(s) { return L_PAD + leadW() + (s / regionDur) * PLOT_W; }

  function reset() {
    rows = [];
    curRow = null;
    render();
  }

  // 播放进入新一轮循环：结算当前行（空行丢弃），开新行
  function newCycle(cycleIndex) {
    if (curRow && curRow.taps.length) rows.unshift(curRow);
    else if (curRow) rows.unshift(null); // 占位，渲染时跳过
    curRow = { cycle: cycleIndex, taps: [] };
    rows = rows.filter(r => r === null || r.taps.length).slice(0, MAX_ROWS);
    render();
  }

  // 最近参考拍点偏差（含循环边界回绕），单位 ms
  function nearestDev(posSec) {
    if (!refOnsets.length) return null;
    let best = Infinity;
    for (const o of refOnsets) {
      for (const off of [-regionDur, 0, regionDur]) {
        const d = posSec - (o + off);
        if (Math.abs(d) < Math.abs(best)) best = d;
      }
    }
    return best * 1000;
  }

  function tap(posSec, devMs) {
    if (!curRow) curRow = { cycle: 0, taps: [] };
    const pos = Math.max(Math.min(posSec, regionDur), -leadSec);
    curRow.taps.push({ pos, dev: devMs });
    render();
  }

  // 一行结束（停止播放时）也要结算
  function finalize() {
    if (curRow && curRow.taps.length) { rows.unshift(curRow); }
    curRow = null;
    rows = rows.filter(r => r && r.taps.length).slice(0, MAX_ROWS);
    render();
  }

  function xMark(g, x, y, cls) {
    el('line', { x1: x - 4, y1: y - 4, x2: x + 4, y2: y + 4, class: cls || 'prac-x' }, g);
    el('line', { x1: x - 4, y1: y + 4, x2: x + 4, y2: y - 4, class: cls || 'prac-x' }, g);
  }

  function render() {
    wrap.innerHTML = '';
    const shown = rows.filter(r => r && r.taps.length);
    const totalRows = 1 + (curRow && curRow.taps.length ? 1 : 0) + shown.length;
    const h = Math.max(TOP * 2 + 2 * ROW_H, TOP * 2 + totalRows * ROW_H);
    svgRoot = el('svg', { width: W, height: h, viewBox: `0 0 ${W} ${h}` }, null);
    wrap.appendChild(svgRoot);

    // 参考行
    const refY = TOP + ROW_H / 2;
    const rowX2 = xOf(regionDur);
    el('line', { x1: L_PAD, y1: refY, x2: rowX2, y2: refY, class: 'prac-row-line' }, svgRoot);
    // 网格竖线贯穿所有行：每拍细线，小节起点粗线
    const gridLine = (s, cls) => {
      const x = xOf(s);
      el('line', { x1: x, y1: TOP, x2: x, y2: h - TOP, class: cls }, svgRoot);
    };
    for (const s of beatMarks) { if (s > 0 && s < regionDur) gridLine(s, 'prac-beat'); }
    // 首尾小节线：起点整条粗线，终点只画半段（扫描线右侧留白）
    gridLine(0, 'prac-meas');
    if (regionDur > 0) {
      const ex = xOf(regionDur);
      el('line', { x1: ex, y1: TOP, x2: ex, y2: h - TOP, class: 'prac-meas' }, svgRoot);
    }
    for (const s of measStarts) { if (s > 0 && s < regionDur) gridLine(s, 'prac-meas'); }
    const refG = el('g', { class: 'prac-ref' }, svgRoot);
    for (const o of refOnsets) xMark(refG, xOf(o), refY, 'prac-x');
    const lbl = el('text', { x: L_PAD - 10, y: refY + 4, 'text-anchor': 'end', class: 'prac-label' }, svgRoot);
    lbl.textContent = '参考';

    // 历史行 + 当前行（新在上）
    let y = refY + ROW_H;
    const drawRow = (row, label, isCur) => {
      el('line', { x1: L_PAD, y1: y, x2: rowX2, y2: y, class: 'prac-row-line' }, svgRoot);
      const g = el('g', {}, svgRoot);
      let sum = 0, n = 0;
      for (const t of row.taps) {
        const cls = Math.abs(t.dev) <= 60 ? 'prac-x' : (t.dev < 0 ? 'prac-x early' : 'prac-x late');
        xMark(g, xOf(t.pos), y, cls);
        sum += t.dev; n++;
      }
      const l = el('text', { x: L_PAD - 10, y: y + 4, 'text-anchor': 'end', class: 'prac-label' }, svgRoot);
      l.textContent = label;
      if (n && !isCur) {
        const avg = sum / n;
        const d = el('text', { x: rowX2 + 10, y: y + 4, class: 'prac-dev' }, svgRoot);
        const sign = avg >= 0 ? '+' : '';
        d.textContent = `${sign}${avg.toFixed(0)}ms`;
        d.setAttribute('fill', Math.abs(avg) <= 60 ? '#16a34a' : (avg < 0 ? '#0284c7' : '#dc2626'));
      } else if (n && isCur) {
        const avg = sum / n;
        const d = el('text', { x: rowX2 + 10, y: y + 4, class: 'prac-dev' }, svgRoot);
        d.textContent = `${avg >= 0 ? '+' : ''}${avg.toFixed(0)}ms…`;
      }
      y += ROW_H;
    };
    if (curRow && curRow.taps.length) drawRow(curRow, `第${curRow.cycle + 1}轮`, true);
    for (const r of shown) drawRow(r, `第${r.cycle + 1}轮`, false);

    // 扫描竖线
    sweepEl = el('line', { class: 'prac-sweep', x1: L_PAD, y1: TOP, x2: L_PAD, y2: h - TOP, visibility: 'hidden' }, svgRoot);

    // 会话统计
    if (shown.length) {
      const r = shown[0];
      const avg = r.taps.reduce((s, t) => s + t.dev, 0) / r.taps.length;
      statsEl.textContent = `最近一轮：平均 ${avg >= 0 ? '+' : ''}${avg.toFixed(0)}ms（含 ${r.taps.length} 拍，已按延时校正）`;
    } else {
      statsEl.textContent = curRow && curRow.taps.length
        ? '打拍中…' : '播放后点击此处或按任意键打拍子';
    }
  }

  function setSweep(frac) {
    if (!sweepEl) return;
    if (frac == null) { sweepEl.setAttribute('visibility', 'hidden'); return; }
    const x = xOf(Math.min(Math.max(frac, 0), 1) * regionDur);
    sweepEl.setAttribute('x1', x); sweepEl.setAttribute('x2', x);
    sweepEl.setAttribute('visibility', 'visible');
  }

  return { setReference, reset, newCycle, tap, finalize, setSweep, render, nearestDev };
})();
