// 五线谱：SVG 渲染、编辑模式、延音编辑、播放竖线
window.MusicUtil = (function () {
  // 时值单位：十六分音符 = 1
  function measureSixteenths(ts) { return ts.num * (ts.den === 8 ? 2 : 4); }
  function elemDur(e) { return e.d; }

  // 时值分解为标准记号（如 5 = 四分 + 十六分，自动用延音线连接）
  const SYMBOLS = [[16], [12], [8], [6], [4], [3], [2], [1]];
  function decompose(d) {
    const out = [];
    for (const [s] of SYMBOLS) { if (s <= d) { out.push(s); d -= s; } }
    return out;
  }

  function isDotted(d) { return [3, 6, 12].includes(d); }
  function isRest(e) { return e.k === 'r'; }

  // 展开元素为时间事件（onset/dur 单位：十六分音符），tuplet 拆为 3 个子音符
  function expand(elems, startSix) {
    const evts = [];
    let pos = startSix;
    for (const e of elems) {
      if (e.k === 't') {
        const sub = e.d / 3;
        for (let i = 0; i < 3; i++) evts.push({ e, sub: i, onset: pos + i * sub, dur: sub });
      } else {
        evts.push({ e, sub: -1, onset: pos, dur: e.d });
      }
      pos += e.d;
    }
    return evts;
  }

  return { measureSixteenths, elemDur, decompose, isDotted, isRest, expand };
})();

window.Staff = (function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LINE_GAP = 10;        // 线间距
  const STAFF_H = LINE_GAP * 4;
  const LINE_BLOCK = 100;     // 每行五线谱占高
  const TOP_PAD = 48;
  const SVG_W = 1040;
  const LEAD_FIRST = 78;      // 首行左侧（谱号+拍号）
  const LEAD_CONT = 52;       // 续行左侧（谱号）
  const MEAS_PAD = 26;        // 小节前后留白
  const SLOT_BASE = 12, SLOT_UNIT = 7;

  const svg = document.getElementById('staffWrap');
  const wrapSection = document.getElementById('staffSection');
  const keypad = document.getElementById('keypad');
  const tsPanel = document.getElementById('timeSigPanel');

  const state = () => App.state;
  let edit = null;          // {mIdx, overwritten}
  let tieMode = false;
  let layout = null;        // 渲染元数据
  let playlineEl = null, highlightGrp = null;
  let onEditChange = null;  // 由 app 注入：状态变化后回调（保存 URL 等）

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(x, y, str, cls, parent) {
    const t = el('text', { x, y, class: cls || '', 'text-anchor': 'middle' }, parent);
    t.textContent = str;
    return t;
  }

  function slotW(d) { return SLOT_BASE + d * SLOT_UNIT; }

  // ---------- 记号绘制 ----------
  function drawNotehead(g, x, y, hollow, wide) {
    // wide=true 为全音符：更宽更平的空心椭圆
    const rx = wide ? 9.2 : 6.5, ry = wide ? 5.2 : 4.8, rot = wide ? -10 : -18;
    const attrs = { cx: x, cy: y, rx, ry, transform: `rotate(${rot} ${x} ${y})`, class: 'notehead' };
    if (hollow) Object.assign(attrs, { fill: 'none', stroke: '#2b2f36', 'stroke-width': 1.6 });
    el('ellipse', attrs, g);
  }

  function drawFlag(g, x, yTop, count) {
    for (let i = 0; i < count; i++) {
      const y = yTop + i * 7;
      el('path', {
        d: `M ${x} ${y} c 7 3 9 8 7 15 c 5 -7 3 -12 -7 -15`,
        class: 'flag'
      }, g);
    }
  }

  // 音符记号（符头在 y 中线上，符干从符头右侧向上）
  function drawNote(g, x, y, d, opts) {
    const hollow = d >= 8;
    drawNotehead(g, x, y, hollow, d === 16);
    if (d < 16) {
      const stemEnd = opts && opts.beamed ? opts.stemEnd : y - 30;
      el('line', { x1: x + 5.5, y1: y - 2, x2: x + 5.5, y2: stemEnd, class: 'stem' }, g);
      if (!(opts && opts.beamed)) {
        if (d === 1) drawFlag(g, x + 5.5, y - 30, 2);
        else if (d === 2 || d === 3) drawFlag(g, x + 5.5, y - 30, 1);
      }
    }
    // 附点放在符头右上方的线间（略上移避开谱线）
    if (MusicUtil.isDotted(d)) el('circle', { cx: x + 12, cy: y - 3.5, r: 1.8, class: 'notehead' }, g);
  }

  function drawRest(g, x, y0, d) {
    const mid = y0 + 2 * LINE_GAP;
    if (d === 16) {
      el('rect', { x: x - 7, y: y0 + LINE_GAP, width: 14, height: 6, class: 'rest' }, g);
    } else if (d === 12 || d === 8) {
      el('rect', { x: x - 7, y: mid - 6, width: 14, height: 6, class: 'rest' }, g);
    } else if (d >= 4) {
      // 四分/附点四分休止符：折线
      el('path', {
        d:
          `M ${x} ${y0 + 6} L ${x - 4} ${y0 + 14} L ${x + 4} ${y0 + 20} L ${x - 3} ${y0 + 27} ` +
          `L ${x + 3} ${y0 + 33} L ${x - 2} ${y0 + 35}`,
        class: 'flag', fill: 'none'
      }, g);
    } else {
      // 八分/十六分休止符：斜杆 + 圆点
      const dots = d === 1 ? 2 : 1;
      el('line', {
        x1: x + 3, y1: y0 + 8, x2: x - 2, y2: y0 + 14 + dots * 7,
        class: 'stem'
      }, g);
      for (let i = 0; i < dots; i++)
        el('circle', { cx: x - 4.5, cy: y0 + 12 + i * 7, r: 2.6, class: 'rest' }, g);
    }
    if (MusicUtil.isDotted(d)) el('circle', { cx: x + 11, cy: mid - 3.5, r: 1.8, class: 'rest' }, g);
  }

  // 延音线：弧线在符干/符尾上方，两端对齐符干位置，两头细中间粗
  function drawTie(g, x1, x2, y) {
    const yt = y - 46 + LINE_GAP; // 符尾上方一行高处
    const mx = (x1 + x2) / 2, peak = yt - 13;
    // 外弧与内弧形成闭合月牙，内弧比外弧浅 5px，两端收尖
    el('path', {
      d:
        `M ${x1} ${yt} Q ${mx} ${peak} ${x2} ${yt} ` +
        `Q ${mx} ${peak + 5} ${x1} ${yt}`,
      class: 'tie'
    }, g);
  }

  // ---------- 小节与全谱渲染 ----------
  function render() {
    const st = state();
    const ms = MusicUtil.measureSixteenths(st.timeSig);
    svg.innerHTML = '';
    const root = el('svg', { width: SVG_W, height: 10, viewBox: `0 0 ${SVG_W} 10` }, null);
    svg.appendChild(root);

    const measuresMeta = [];
    let lineIdx = 0, x = LEAD_FIRST, y = TOP_PAD;
    let lineFirstMeasure = true;
    drawStaffLines(root, 0, y);
    drawClef(root, 8, y);

    for (let m = 0; m < st.measureCount; m++) {
      const width = measureWidth(st.measures[m] || []);
      if (x + width > SVG_W - 10 && !lineFirstMeasure) {
        drawFinalBarline(root, x, y);
        lineIdx++; x = LEAD_CONT; y = TOP_PAD + lineIdx * LINE_BLOCK;
        drawStaffLines(root, x - LEAD_CONT, y);
        drawClef(root, x - LEAD_CONT + 8, y);
        lineFirstMeasure = true;
      }
      if (lineFirstMeasure) {
        if (lineIdx === 0) drawTimeSig(root, x - LEAD_FIRST + 44, y);
        lineFirstMeasure = false;
      }
      const meta = drawMeasure(root, m, x, y, width, ms);
      measuresMeta.push(meta);
      x += width;
    }
    drawFinalBarline(root, x, y, true);

    const totalH = y + STAFF_H + 26;
    root.setAttribute('height', totalH);
    root.setAttribute('viewBox', `0 0 ${SVG_W} ${totalH}`);
    layout = { root, measures: measuresMeta, totalH };

    playlineEl = el('line', { class: 'playline', visibility: 'hidden' }, root);
    if (tieMode) root.classList.add('tiemode');
    if (edit) {
      const meta = measuresMeta[edit.mIdx];
      if (meta) meta.box.classList.add('editing');
    }
  }

  function drawStaffLines(root, x0, y) {
    for (let i = 0; i < 5; i++)
      el('line', {
        x1: x0, y1: y + i * LINE_GAP, x2: SVG_W - 6, y2: y + i * LINE_GAP,
        class: 'staff-line'
      }, root);
  }

  function drawClef(root, x, y) {
    // 外部 GClef.svg：原始 15.186 × 40.768，缩放到约 2.4 倍谱表高，居中于 G 线（y+30）
    const h = 55, w = h * (15.186 / 40.768);
    const cy = y + 30 + LINE_GAP / 2; // G 线下方半行
    el('image', {
      href: 'images/GClef.svg', x: x + 18 - w, y: cy - h * 0.66,
      width: w, height: h
    }, root);
  }

  function drawTimeSig(root, x, y) {
    const st = state();
    const g = el('g', { class: 'timesig-box' }, root);
    text(x, y + 2 * LINE_GAP - 3, st.timeSig.num, 'timesig', g);
    text(x, y + 4 * LINE_GAP - 1, st.timeSig.den, 'timesig', g);
    el('rect', {
      x: x - 14, y: y - 2, width: 28, height: STAFF_H + 6,
      fill: 'transparent'
    }, g);
    g.addEventListener('click', (ev) => { ev.stopPropagation(); showTimeSigPanel(ev, x, y); });
  }

  function drawFinalBarline(root, x, y, isLast) {
    if (isLast) {
      el('line', { x1: x, y1: y, x2: x, y2: y + STAFF_H, class: 'barline' }, root);
      el('line', { x1: x + 5, y1: y, x2: x + 5, y2: y + STAFF_H, class: 'barline-final' }, root);
    } else {
      el('line', { x1: x, y1: y, x2: x, y2: y + STAFF_H, class: 'barline' }, root);
    }
  }

  function measureWidth(elems) {
    if (!elems.length) return 90;
    let w = MEAS_PAD;
    for (const e of elems) {
      if (e.k === 't') w += 3 * slotW(e.d === 8 ? 4 : 2) + 8;
      else w += MusicUtil.decompose(e.d).reduce((s, d) => s + slotW(d), 0);
    }
    return Math.max(w + MEAS_PAD, 72);
  }

  function drawMeasure(root, mIdx, x, y, width, ms) {
    const st = state();
    const g = el('g', {}, root);
    const meta = { idx: mIdx, x, y, width, stops: [], elemGroups: [] };

    // 循环区域外的小节置灰
    const outOfLoop = mIdx < st.loopStart || mIdx > st.loopEnd;
    if (outOfLoop)
      el('rect', { x, y: y - 12, width, height: STAFF_H + 24, fill: '#f3f4f6' }, g);

    el('line', { x1: x, y1: y, x2: x, y2: y + STAFF_H, class: 'barline' }, g);

    // 小节点击框（先创建，保证在音符之下、不遮挡延音点击）
    const box = el('rect', { x, y: y - 12, width, height: STAFF_H + 24, class: 'measure-box' }, g);
    meta.box = box;
    if (edit && edit.mIdx === mIdx) box.classList.add('editing');
    box.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (tieMode) return;
      beginEdit(mIdx);
    });

    const elems = st.measures[mIdx] || [];
    const midY = y + 3 * LINE_GAP; // 符头基线：从上往下第 4 线（B4 音高位置）

    if (!elems.length) {
      // 空小节：全小节休止
      const gg = el('g', { class: 'notegrp restgrp' }, g);
      drawRest(gg, x + width / 2, y, Math.min(ms, 16));
      meta.elemGroups.push({ e: null, grp: gg, onset: 0, dur: ms });
      meta.stops.push({ s: 0, x: x + MEAS_PAD / 2 });
      meta.stops.push({ s: ms, x: x + width - MEAS_PAD / 2 });
      return meta;
    }

    // Phase A: 展开为符号序列（三连音拆 3 个子音符，其余按标准时值分解）
    const glyphs = [];
    let pos = 0;
    for (const e of elems) {
      if (e.k === 't') {
        const sub = e.d / 3;
        // 四分三连音用四分音符（无 beam，上方括号），八分三连音用八分音符（带 beam）
        const gd = e.d === 8 ? 4 : 2;
        for (let i = 0; i < 3; i++) {
          glyphs.push({ d: gd, rest: false, elem: e, dur: sub, onset: pos });
          pos += sub;
        }
      } else {
        MusicUtil.decompose(e.d).forEach((d, i) => {
          glyphs.push({ d, rest: e.k === 'r', elem: e, dur: d, onset: pos });
          pos += d;
        });
      }
    }

    // Phase B: x 布局
    let cx = x + MEAS_PAD / 2 + 2;
    for (let i = 0; i < glyphs.length; i++) {
      const gl = glyphs[i];
      gl.w = slotW(gl.d);
      gl.x = cx + gl.w / 2;
      cx += gl.w;
      if (gl.elem.k === 't' && i + 1 < glyphs.length && glyphs[i + 1].elem !== gl.elem) cx += 8;
    }
    meta.stops.push({ s: 0, x: glyphs[0].x - glyphs[0].w / 2 });
    for (const gl of glyphs) meta.stops.push({ s: gl.onset + gl.dur, x: gl.x + gl.w / 2 });

    // Phase C: 按拍对短音符分组（beam 组），标记 beamed/flags/stemEnd
    const beamGroups = computeBeams(glyphs, midY);

    // Phase D: 按元素绘制
    const tieDrawn = new Set(); // 已被合并大延音线覆盖的元素
    for (let ei = 0; ei < elems.length; ei++) {
      const e = elems[ei];
      const mg = glyphs.filter(gl => gl.elem === e);
      // 延音编辑的命中区在音符组之前插入，CSS 相邻选择器才能高亮本音符组
      let hit = null;
      if (e.k !== 'r' && tieMode) {
        const hx1 = mg[0].x - mg[0].w / 2;
        const hx2 = mg[mg.length - 1].x + mg[mg.length - 1].w / 2;
        hit = el('rect', {
          x: hx1, y: y - 14, width: hx2 - hx1,
          height: STAFF_H + 28, class: 'note-hit'
        }, g);
      }
      const gg = el('g', { class: e.k === 'r' ? 'notegrp restgrp' : 'notegrp' }, g);
      gg.dataset.mIdx = mIdx;
      for (const gl of mg) {
        if (gl.rest) drawRest(gg, gl.x, y, gl.d);
        else drawNote(gg, gl.x, midY, gl.d, gl.beamed ? { beamed: true, stemEnd: gl.stemEnd } : null);
      }
      // 分解产生的内部延音线（端点为符干 x）；三连音子音符之间不连线
      if (e.k !== 't')
        for (let i = 0; i < mg.length - 1; i++) drawTie(gg, mg[i].x + 5.5, mg[i + 1].x + 5.5, midY);
      // 三连音：八分三连音在 beam 上写 3（对齐中间符干）；
      // 四分三连音无 beam，上方画细括号（旋转 90° 的中括号），中间断开写 3
      if (e.k === 't') {
        if (e.d === 8) {
          const x1 = mg[0].x + 5.5 - 3, x2 = mg[2].x + 5.5 + 3;
          const yb = midY - 40, mx = (x1 + x2) / 2, gap = 7;
          el('path', { d: `M ${x1} ${yb + 7} L ${x1} ${yb} L ${mx - gap} ${yb}`, class: 'tuplet-bracket' }, gg);
          el('path', { d: `M ${mx + gap} ${yb} L ${x2} ${yb} L ${x2} ${yb + 7}`, class: 'tuplet-bracket' }, gg);
          text(mx, yb + 4.5, '3', 'tuplet-num', gg);
        } else {
          const ty = (mg[0].beamed ? mg[0].stemEnd : midY - 30) - 6;
          text(mg[1].x + 5.5, ty, '3', 'tuplet-num', gg);
        }
      }
      // 与上一元素的延音线（手动/跨小节自动），端点对齐符干 x；
      // 连续多个延音合并为一条大弧线（起点到链尾末音符）
      if (e.tie && meta.elemGroups.length > 0 && !tieDrawn.has(e)) {
        let endElem = e;
        for (let ej = ei + 1; ej < elems.length; ej++) {
          if (!elems[ej].tie || elems[ej].k === 'r') break;
          endElem = elems[ej];
          tieDrawn.add(elems[ej]);
        }
        let nx;
        if (endElem === e) nx = mg[0].x + 5.5;
        else {
          const eg = glyphs.filter(gl => gl.elem === endElem);
          nx = eg[eg.length - 1].x + 5.5;
        }
        const prev = meta.elemGroups[meta.elemGroups.length - 1];
        const px = prev.noteX + 5.5;  // 上一元素末音符符干 x
        if (prev.mIdx === mIdx) drawTie(g, px, nx, midY);
        else drawTie(g, x - MEAS_PAD + 6, nx, midY); // 跨小节：画在本小节开头
      }

      if (hit) {
        if (e.tie) gg.classList.add('tied');
        hit.addEventListener('click', (ev) => {
          ev.stopPropagation();
          e.tie = !e.tie;
          if (onEditChange) onEditChange();
          render();
        });
      }

      meta.elemGroups.push({ e, grp: gg, onset: mg[0].onset, dur: e.d, mIdx, noteX: mg[mg.length - 1].x });
    }

    // Phase E: beam（画在最上层，不拦截鼠标）
    drawBeams(el('g', { class: 'beams' }, g), beamGroups);

    // 编辑光标
    if (edit && edit.mIdx === mIdx) {
      el('line', {
        x1: cx + 4, y1: y - 8, x2: cx + 4, y2: y + STAFF_H + 8,
        class: 'edit-cursor'
      }, g);
    }

    // 记录小节末位置
    if (meta.stops[meta.stops.length - 1].s < ms)
      meta.stops.push({ s: ms, x: x + width - MEAS_PAD / 2 });
    return meta;
  }

  // ---------- 符干连结（beam） ----------
  // 将小节内连续的短音符（八分/十六分/附点八分）按拍分组；休止符和较长音符断组
  function computeBeams(glyphs, midY) {
    const st = state();
    const beat = st.timeSig.den === 8 ? 6 : 4; // den=8 按附点四分（6 个十六分）分组
    const groups = [];
    let cur = null;
    for (const gl of glyphs) {
      // 八分三连音子音符：同一三连音元素强制成组（四分三连音不 beam，走下方常规逻辑）
      if (gl.elem && gl.elem.k === 't' && gl.d < 4) {
        if (cur && cur[0].elem === gl.elem) cur.push(gl);
        else { cur = [gl]; groups.push(cur); }
        continue;
      }
      if (gl.rest || gl.d >= 4) { cur = null; continue; }
      if (cur && Math.floor(gl.onset / beat) === Math.floor(cur[cur.length - 1].onset / beat)) {
        cur.push(gl);
      } else {
        cur = [gl];
        groups.push(cur);
      }
    }
    for (const grp of groups) {
      if (grp.length < 2) continue; // 单个短音符保留符尾
      for (const gl of grp) {
        gl.beamed = true;
        gl.flags = gl.d === 1 ? 2 : 1; // 十六分 2 层，八分/附点八分 1 层
        gl.stemEnd = midY - 34 + LINE_GAP / 2;
      }
    }
    return groups;
  }

  function drawBeams(parent, groups) {
    const beamSeg = (x1, x2, y) =>
      el('line', { x1, y1: y, x2, y2: y, class: 'beam' }, parent);
    for (const grp of groups) {
      if (grp.length < 2) continue;
      const sx = gl => gl.x + 5.5;
      const yb0 = grp[0].stemEnd;
      const maxFlags = Math.max(...grp.map(gl => gl.flags));
      // 第一层 beam：整组连通
      beamSeg(sx(grp[0]), sx(grp[grp.length - 1]), yb0);
      // 次层 beam：只在相邻两个音符层数相同时连通，孤立的画短杠
      for (let j = 1; j < maxFlags; j++) {
        const yj = yb0 + j * 7;
        for (let i = 0; i < grp.length - 1; i++) {
          if (grp[i].flags > j && grp[i + 1].flags > j)
            beamSeg(sx(grp[i]), sx(grp[i + 1]), yj);
        }
        for (let i = 0; i < grp.length; i++) {
          if (grp[i].flags <= j) continue;
          const leftShared = i > 0 && grp[i - 1].flags > j;
          const rightShared = i < grp.length - 1 && grp[i + 1].flags > j;
          if (leftShared || rightShared) continue;
          if (i < grp.length - 1) beamSeg(sx(grp[i]), sx(grp[i]) + 9, yj);
          else beamSeg(sx(grp[i]) - 9, sx(grp[i]), yj);
        }
      }
    }
  }

  function lastSymbolX(gm) { const b = gm.grp.getBBox(); return b.x + b.width; }

  // ---------- 节奏型迷你图案（复用 drawMeasure 的渲染管线，不画五线谱） ----------
  // seq 元素：'T'=四分三连音，{r:n}=休止，{k,d}=音符/三连音元素，数字=音符时值
  function renderPattern(seq, compact) {
    const elems = seq.map(it =>
      it === 'T' ? { k: 't', d: 8 }
        : typeof it === 'object' ? (it.k ? it : { k: 'r', d: it.r })
          : { k: 'n', d: it });

    // Phase A: 展开为符号
    const glyphs = [];
    let pos = 0;
    for (const e of elems) {
      if (e.k === 't') {
        const sub = e.d / 3;
        const gd = e.d === 8 ? 4 : 2;
        for (let i = 0; i < 3; i++) {
          glyphs.push({ d: gd, rest: false, elem: e, dur: sub, onset: pos });
          pos += sub;
        }
      } else {
        MusicUtil.decompose(e.d).forEach(d => {
          glyphs.push({ d, rest: e.k === 'r', elem: e, dur: d, onset: pos });
          pos += d;
        });
      }
    }

    // Phase B: 布局（compact：符头间距压缩，供悬浮键盘等小图放大显示）
    let cx = 4;
    for (let i = 0; i < glyphs.length; i++) {
      const gl = glyphs[i];
      gl.w = compact ? Math.max(slotW(gl.d) - 14, 16) : slotW(gl.d);
      gl.x = cx + gl.w / 2;
      cx += gl.w;
      if (gl.elem.k === 't' && i + 1 < glyphs.length && glyphs[i + 1].elem !== gl.elem)
        cx += compact ? 3 : 8;
    }
    const w = cx + (compact ? 5 : 8), h = 78;
    const root = el('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'pat-glyph' }, null);

    // Phase C+D+D': 按元素绘制（复用 drawMeasure 的绘制段）
    const midY = 56;
    // 先算 beam 分组，beamed 音符不画符尾
    const beamGroups = computeBeams(glyphs, midY);
    for (const e of elems) {
      const mg = glyphs.filter(gl => gl.elem === e);
      const gg = el('g', { class: e.k === 'r' ? 'notegrp restgrp' : 'notegrp' }, root);
      for (const gl of mg) {
        if (gl.rest) drawRest(gg, gl.x, midY - 30, gl.d);
        else drawNote(gg, gl.x, midY, gl.d, gl.beamed ? { beamed: true, stemEnd: gl.stemEnd } : null);
      }
      if (e.k !== 't')
        for (let i = 0; i < mg.length - 1; i++) drawTie(gg, mg[i].x + 5.5, mg[i + 1].x + 5.5, midY);
      if (e.k === 't') {
        if (e.d === 8) {
          const x1 = mg[0].x + 5.5 - 3, x2 = mg[2].x + 5.5 + 3;
          const yb = midY - 40, mx = (x1 + x2) / 2, gap = 7;
          el('path', { d: `M ${x1} ${yb + 7} L ${x1} ${yb} L ${mx - gap} ${yb}`, class: 'tuplet-bracket' }, gg);
          el('path', { d: `M ${mx + gap} ${yb} L ${x2} ${yb} L ${x2} ${yb + 7}`, class: 'tuplet-bracket' }, gg);
          text(mx, yb + 4.5, '3', 'tuplet-num', gg);
        } else {
          const ty = (mg[0].beamed ? mg[0].stemEnd : midY - 30) - 6;
          text(mg[1].x + 5.5, ty, '3', 'tuplet-num', gg);
        }
      }
    }
    // Phase E: beam
    drawBeams(el('g', { class: 'beams' }, root), beamGroups);

    return root;
  }

  // ---------- 播放竖线与高亮 ----------
  function setPlayhead(posSix) {
    if (!layout || posSix == null) {
      if (playlineEl) playlineEl.setAttribute('visibility', 'hidden');
      setHighlight(null);
      return;
    }
    const st = state();
    const ms = MusicUtil.measureSixteenths(st.timeSig);
    const mIdx = Math.min(Math.floor(posSix / ms), st.measureCount - 1);
    const meta = layout.measures[mIdx];
    if (!meta) return;
    const inMeas = posSix - mIdx * ms;
    let x = meta.x + 6;
    for (let i = 0; i < meta.stops.length - 1; i++) {
      const a = meta.stops[i], b = meta.stops[i + 1];
      if (inMeas >= a.s && inMeas <= b.s) {
        const t = b.s === a.s ? 0 : (inMeas - a.s) / (b.s - a.s);
        x = a.x + t * (b.x - a.x);
        break;
      }
    }
    playlineEl.setAttribute('x1', x); playlineEl.setAttribute('x2', x);
    playlineEl.setAttribute('y1', meta.y - 12);
    playlineEl.setAttribute('y2', meta.y + STAFF_H + 12);
    playlineEl.setAttribute('visibility', 'visible');

    // 高亮当前元素
    let cur = null;
    for (const gm of meta.elemGroups) {
      const onset = mIdx * ms + gm.onset;
      if (posSix >= onset - 1e-9 && posSix < onset + gm.dur) { cur = gm; break; }
    }
    setHighlight(cur ? cur.grp : null);
  }

  function setHighlight(grp) {
    if (highlightGrp === grp) return;
    if (highlightGrp) highlightGrp.classList.remove('highlight');
    highlightGrp = grp;
    if (grp) grp.classList.add('highlight');
  }

  // ---------- 编辑模式 ----------
  function beginEdit(mIdx) {
    exitEdit();
    edit = { mIdx, overwritten: false };
    render();
    showKeypad();
    if (onEditChange) onEditChange();
  }

  function exitEdit() {
    if (!edit) return;
    fillRests(edit.mIdx);
    edit = null;
    keypad.hidden = true;
    render();
    if (onEditChange) onEditChange();
  }

  function fillRests(mIdx) {
    const st = state();
    const ms = MusicUtil.measureSixteenths(st.timeSig);
    const arr = st.measures[mIdx] = st.measures[mIdx] || [];
    let used = arr.reduce((s, e) => s + e.d, 0);
    if (used > ms) { // 超填保护
      const keep = [];
      let acc = 0;
      for (const e of arr) { if (acc + e.d > ms) break; keep.push(e); acc += e.d; }
      st.measures[mIdx] = keep; used = acc;
    }
    if (used < ms) arr.push({ k: 'r', d: ms - used });
  }

  function advanceEdit(m) {
    const st = state();
    if (m >= st.measureCount) { exitEdit(); return; }
    fillRests(edit.mIdx);
    edit = { mIdx: m, overwritten: false };
    render();
    showKeypad();
  }

  // 插入音符（含跨小节自动切分 + 延音线）；isRest 时插入休止符（不跨小节）
  function insertNote(d, isRest) {
    if (!edit) return;
    const st = state();
    const ms = MusicUtil.measureSixteenths(st.timeSig);
    const m = edit.mIdx;
    if (!edit.overwritten) { st.measures[m] = []; edit.overwritten = true; }
    let arr = st.measures[m];
    let used = arr.reduce((s, e) => s + e.d, 0);
    let rem = ms - used;

    if (isRest) {
      if (d > rem) return; // 休止符放不下，忽略
      arr.push({ k: 'r', d });
      if (d === rem) advanceEdit(m + 1);
      else { render(); showKeypad(); }
      if (onEditChange) onEditChange();
      return;
    }

    if (d <= rem) {
      st.measures[m].push({ k: 'n', d });
      if (d === rem) advanceEdit(m + 1);
      else { render(); showKeypad(); }
    } else if (rem > 0) {
      // 跨小节切分
      st.measures[m].push({ k: 'n', d: rem });
      let left = d - rem, mi = m + 1;
      while (left > 0 && mi < st.measureCount) {
        const p = Math.min(left, ms);
        st.measures[mi] = [{ k: 'n', d: p, tie: true }];
        left -= p; mi++;
      }
      if (mi > m + 1) fillRests(mi - 1); // 末段小节可能未填满
      fillRests(m);
      if (mi < st.measureCount) {
        edit = { mIdx: mi, overwritten: false };
        render(); showKeypad();
      } else exitEdit();
    } else {
      advanceEdit(m + 1);
      if (edit) insertNote(d);
    }
    if (onEditChange) onEditChange();
  }

  function insertTriplet(d) {
    if (!edit) return;
    const st = state();
    const ms = MusicUtil.measureSixteenths(st.timeSig);
    const m = edit.mIdx;
    if (!edit.overwritten) { st.measures[m] = []; edit.overwritten = true; }
    const arr = st.measures[m];
    const used = arr.reduce((s, e) => s + e.d, 0);
    const rem = ms - used;
    if (rem < d) return; // 放不下，忽略
    arr.push({ k: 't', d });
    if (rem === d) advanceEdit(m + 1);
    else { render(); showKeypad(); }
    if (onEditChange) onEditChange();
  }

  function backspace() {
    if (!edit) return;
    const m = edit.mIdx;
    if ((state().measures[m] || []).length === 0) {
      if (m === 0) return;
      edit = { mIdx: m - 1, overwritten: true };
      state().measures[m - 1].pop();
    } else {
      state().measures[m].pop();
      edit.overwritten = true;
    }
    render(); showKeypad();
    if (onEditChange) onEditChange();
  }

  // 为当前小节最后一个音符/休止符附点（时值 ×1.5）
  function dotLast() {
    if (!edit) return;
    const st = state();
    const arr = st.measures[edit.mIdx] || [];
    const last = arr[arr.length - 1];
    if (!last || last.k === 't') return; // 无元素或三连音不可附点
    const nd = last.d * 3 / 2;
    if (!Number.isInteger(nd) || MusicUtil.isDotted(last.d)) return; // 非整数时值或已附点
    const ms = MusicUtil.measureSixteenths(st.timeSig);
    const used = arr.reduce((s, e) => s + e.d, 0);
    if (used - last.d + nd > ms) return; // 附点后超小节容量，忽略
    last.d = nd;
    render(); showKeypad();
    if (onEditChange) onEditChange();
  }

  function moveEdit(dir) {
    if (!edit) return;
    const st = state();
    fillRests(edit.mIdx);
    const nm = Math.min(Math.max(edit.mIdx + dir, 0), st.measureCount - 1);
    edit = { mIdx: nm, overwritten: false };
    render(); showKeypad();
    if (onEditChange) onEditChange();
  }

  function handleKey(e) {
    if (!edit) return false;
    // Shift+数字/` = 对应时值的休止符
    if (e.shiftKey) {
      if (e.key >= '1' && e.key <= '8') { insertNote(parseInt(e.key) * 2, true); return true; }
      if (e.key === '`' || e.key === '~') { insertNote(1, true); return true; }
      return false;
    }
    if (e.key >= '1' && e.key <= '8') { insertNote(parseInt(e.key) * 2); return true; }
    if (e.key === '9') { insertTriplet(4); return true; }
    if (e.key === '0') { insertTriplet(8); return true; }
    if (e.key === '`') { insertNote(1); return true; }
    if (e.key === '.') { dotLast(); return true; }
    if (e.key === 'Backspace') { backspace(); return true; }
    if (e.key === 'ArrowLeft') { moveEdit(-1); return true; }
    if (e.key === 'ArrowRight') { moveEdit(1); return true; }
    if (e.key === 'Enter') { exitEdit(); return true; }
    return false;
  }

  // ---------- 悬浮键盘 ----------
  const KP_KEYS = [
    { key: '`', dur: 1 }, { key: '1', dur: 2 }, { key: '2', dur: 4 },
    { key: '3', dur: 6 }, { key: '4', dur: 8 }, { key: '5', dur: 10 },
    { key: '6', dur: 12 }, { key: '7', dur: 14 }, { key: '8', dur: 16 },
    { key: '9', dur: -2 }, { key: '0', dur: -1 },
  ];

  function buildKeypad() {
    keypad.innerHTML = '';
    const mkFn = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kp-key kp-fn'; b.textContent = label;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
      return b;
    };
    const noteRow = document.createElement('div');
    noteRow.className = 'kp-row';
    noteRow.appendChild(mkFn('←', () => moveEdit(-1)));
    noteRow.appendChild(mkFn('→', () => moveEdit(1)));
    noteRow.appendChild(mkFn('⌫', backspace));
    for (const k of KP_KEYS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kp-key';
      // 用节奏型渲染器生成图案，等比缩放到按键高度
      const seq = k.dur === -1 ? [{ k: 't', d: 8 }]
        : k.dur === -2 ? [{ k: 't', d: 4 }]
          : [k.dur];
      const svgEl = renderPattern(seq, true);
      const vb = svgEl.viewBox.baseVal;
      const h = 46, w = vb.width * h / vb.height;
      svgEl.setAttribute('width', w);
      svgEl.setAttribute('height', h);
      b.appendChild(svgEl);
      const dspan = document.createElement('span');
      dspan.className = 'kp-digit'; dspan.textContent = k.key;
      b.appendChild(dspan);
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (k.dur === -1) insertTriplet(8);
        else if (k.dur === -2) insertTriplet(4);
        else insertNote(k.dur);
      });
      noteRow.appendChild(b);
    }
    keypad.appendChild(noteRow);
    // 休止符行（Shift+数字/`）
    const restRow = document.createElement('div');
    restRow.className = 'kp-row';
    const restLabel = document.createElement('span');
    restLabel.className = 'kp-rowlabel'; restLabel.textContent = '休';
    restRow.appendChild(restLabel);
    for (const k of KP_KEYS) {
      if (k.dur < 0) continue; // 三连音无休止形态
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kp-key';
      const svgEl = renderPattern([{ r: k.dur }], true);
      const vb = svgEl.viewBox.baseVal;
      const h = 46, w = vb.width * h / vb.height;
      svgEl.setAttribute('width', w);
      svgEl.setAttribute('height', h);
      b.appendChild(svgEl);
      const dspan = document.createElement('span');
      dspan.className = 'kp-digit'; dspan.textContent = k.key;
      b.appendChild(dspan);
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        insertNote(k.dur, true);
      });
      restRow.appendChild(b);
    }
    keypad.appendChild(restRow);
  }

  function showKeypad() {
    if (!edit || !layout) return;
    buildKeypad();
    keypad.hidden = false;
    const meta = layout.measures[edit.mIdx];
    if (meta) {
      const r = meta.box.getBoundingClientRect();
      const kw = keypad.offsetWidth || 560, kh = keypad.offsetHeight || 70;
      let left = Math.min(Math.max(8, r.left), window.innerWidth - kw - 8);
      let top = r.bottom + 6;
      if (top + kh > window.innerHeight - 8) top = r.top - kh - 6;
      keypad.style.left = left + 'px';
      keypad.style.top = top + 'px';
    }
  }

  // ---------- 拍号面板 ----------
  const TIME_SIGS = [[2, 4], [3, 4], [4, 4], [5, 4], [3, 8], [6, 8], [9, 8], [12, 8]];
  function showTimeSigPanel(ev, x, y) {
    tsPanel.innerHTML = '';
    for (const [n, d] of TIME_SIGS) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = `${n}/${d}`;
      b.addEventListener('click', (ev2) => {
        ev2.stopPropagation();
        App.setTimeSig(n, d);
        hideTimeSigPanel();
      });
      tsPanel.appendChild(b);
    }
    const wrapRect = wrapSection.getBoundingClientRect();
    tsPanel.style.left = (ev.clientX - wrapRect.left) + 'px';
    tsPanel.style.top = (ev.clientY - wrapRect.top + 10) + 'px';
    tsPanel.hidden = false;
  }
  function hideTimeSigPanel() { tsPanel.hidden = true; }
  tsPanel.addEventListener('click', (e) => e.stopPropagation());

  // ---------- 延音编辑模式 ----------
  function setTieMode(on) {
    tieMode = on;
    if (on) exitEdit();
    render();
  }

  // 拍号变化后重排所有小节
  function reflow() {
    const st = state();
    const ms = MusicUtil.measureSixteenths(st.timeSig);
    const flat = [];
    for (const arr of st.measures) for (const e of (arr || [])) flat.push(e);
    const out = [];
    let cur = [], used = 0;
    for (const e of flat) {
      if (e.d > ms) continue; // 新拍号放不下（如三连音组进 3/8）
      if (used + e.d > ms) {
        while (used < ms) { const r = Math.min(ms - used, 16); cur.push({ k: 'r', d: r }); used += r; }
        out.push(cur); cur = []; used = 0;
      }
      cur.push(e); used += e.d;
      if (used === ms) { out.push(cur); cur = []; used = 0; }
    }
    while (out.length < st.measureCount) out.push([]);
    st.measures = out.slice(0, st.measureCount).map(a => a || []);
    st.loopStart = Math.min(st.loopStart, st.measureCount - 1);
    st.loopEnd = Math.min(st.loopEnd, st.measureCount - 1);
    for (let i = 0; i < st.measureCount; i++) if (!st.measures[i].length) fillRests(i);
    render();
  }

  document.addEventListener('click', (e) => {
    if (!tsPanel.hidden && !tsPanel.contains(e.target)) hideTimeSigPanel();
    if (edit && !keypad.contains(e.target)) exitEdit();
  });

  return {
    render, setPlayhead, handleKey, beginEdit, exitEdit,
    setTieMode, get tieMode() { return tieMode; },
    reflow, fillRests, get editing() { return !!edit; },
    set onEditChange(fn) { onEditChange = fn; },
    notify() { if (onEditChange) onEditChange(); },
    showKeypad, renderPattern
  };
})();
