/**
 * 星座功能模块：连线、星座名称、星座图画
 * 支持现代（IAU 88星座）和古代（中国星官）两种模式。
 * 恒星名标注统一由 Stars 模块管理。
 */

const Constellations = (() => {
    let _aladin      = null;
    let linesOverlay = null;
    let namesOverlay = null;
    let artCatalog   = null;

    // 现代模式数据
    let modernLines = null;
    let modernNames = null;
    let artData     = null;
    let artImages   = {};

    // 古代模式数据
    let chineseLines = null;
    let chineseNames = null;

    // 当前模式：'modern' | 'chinese'
    let currentMode = 'modern';
    let currentLang = 'zh';
    const wantVisible = { lines: true, names: true, art: false };

    // 星座 ID -> polyline 数组（高亮用）
    const conPolylines = {};
    let hoveredId = null;

    // ── 初始化 ─────────────────────────────────────────────────────────────

    async function init(aladinInstance) {
        _aladin = aladinInstance;

        // 并行加载所有数据
        const [ml, mn, art, cl, cn] = await Promise.all([
            fetch('data/constellation_lines.json').then(r => r.json()),
            fetch('data/constellation_names.json').then(r => r.json()),
            fetch('data/constellation_art.json').then(r => r.json()),
            fetch('data/chinese_constellation_lines.json').then(r => r.json()),
            fetch('data/chinese_constellation_names.json').then(r => r.json()),
        ]);
        modernLines  = ml;
        modernNames  = mn;
        artData      = art;
        chineseLines = cl;
        chineseNames = cn;

        // 预加载星座图画
        for (const c of artData) {
            const img = new Image();
            img.onload = () => {
                const oc  = new OffscreenCanvas(img.width, img.height);
                const ctx = oc.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const id = ctx.getImageData(0, 0, img.width, img.height);
                const d  = id.data;
                for (let i = 0; i < d.length; i += 4) {
                    const lum = d[i];
                    d[i] = 200; d[i+1] = 216; d[i+2] = 240; d[i+3] = lum;
                }
                ctx.putImageData(id, 0, 0);
                artImages[c.id] = oc;
            };
            img.src = `images/constellations/${c.file}`;
        }

        _buildLinesOverlay();
        _buildNamesOverlay();
        _registerHoverHandlers();
        _updateConstStarCoords();
    }

    // ── 模式切换 ──────────────────────────────────────────────────────────

    function setMode(mode) {
        if (mode === currentMode) return;
        currentMode = mode;

        // 重建连线和名称
        _rebuildLines();
        _rebuildNames();
        _updateConstStarCoords();

        // 艺术图只在现代模式有效
        if (currentMode === 'chinese' && wantVisible.art && artCatalog) {
            artCatalog.isShowing = false;
            artCatalog.reportChange();
        }
    }

    // 获取当前模式数据
    function _lines() { return currentMode === 'modern' ? modernLines : chineseLines; }
    function _names() { return currentMode === 'modern' ? modernNames : chineseNames; }

    // ── 语言切换 ──────────────────────────────────────────────────────────

    function setLang(lang) {
        currentLang = lang;
        if (namesOverlay) namesOverlay.reportChange();
    }

    function setStarsData(data) {}

    // ── 更新连线恒星坐标集（传给 Stars 模块）─────────────────────────────

    function _updateConstStarCoords() {
        const coordSet = new Set();
        for (const c of _lines()) {
            for (const seg of c.segments) {
                for (const pt of seg) {
                    coordSet.add(`${Math.round(pt[0]*100)},${Math.round(pt[1]*100)}`);
                }
            }
        }
        Stars.setConstStarCoords(coordSet);
        // 通知 Stars 模块当前模式的星名数据
        Stars.setChineseStarMode(currentMode === 'chinese');
    }

    // ── 连线（GraphicOverlay） ────────────────────────────────────────────

    function _buildLinesOverlay() {
        linesOverlay = A.graphicOverlay({ name: 'constellation-lines', color: '#ffffff', lineWidth: 1 });
        _aladin.addOverlay(linesOverlay);
        _fillLines();
    }

    function _fillLines() {
        for (const c of _lines()) {
            conPolylines[c.id] = [];
            for (const seg of c.segments) {
                if (seg.length >= 2) {
                    const poly = A.polyline(seg, { opacity: 0.8 });
                    poly.isInStroke = () => false;
                    linesOverlay.add(poly);
                    conPolylines[c.id].push(poly);
                }
            }
        }
    }

    function _rebuildLines() {
        // 清空旧线条
        linesOverlay.removeAll();
        for (const k of Object.keys(conPolylines)) delete conPolylines[k];
        if (hoveredId) { hoveredId = null; }
        _fillLines();
        if (!wantVisible.lines) linesOverlay.hide();
    }

    // ── 星座名称（渲染层 graphicOverlay + hover 检测层 hoverCatalog）──────

    function _buildNamesOverlay() {
        namesOverlay = A.graphicOverlay({ name: 'constellation-names-render' });
        _aladin.addOverlay(namesOverlay);

        const view     = _aladin.view;
        const origDraw = namesOverlay.draw.bind(namesOverlay);
        namesOverlay.draw = function(ctx) {
            origDraw(ctx);
            if (namesOverlay.isShowing) _drawNameLabels(ctx);
        };
    }

    function _drawNameLabels(ctx) {
        if (!_names()) return;
        const view = _aladin.view;
        for (const c of _names()) {
            const pt = _aladin.world2pix(c.ra, c.dec);
            if (!pt) continue;
            const [x, y] = pt;
            if (x < -50 || x > view.width+50 || y < -50 || y > view.height+50) continue;
            const label = currentLang === 'zh' ? c.zh : c.en;
            if (!label) continue;
            ctx.save();
            ctx.font         = 'bold 16px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth    = 3;
            ctx.strokeStyle  = 'rgba(0,0,0,0.85)';
            ctx.lineJoin     = 'round';
            ctx.strokeText(label, x, y);
            ctx.fillStyle    = '#7090d0';
            ctx.fillText(label, x, y);
            ctx.restore();
        }
    }

    function _rebuildNames() {
        if (namesOverlay) namesOverlay.reportChange();
    }

    // ── 星座图画（仅现代模式）────────────────────────────────────────────

    function _buildArtCatalog() {
        artCatalog = A.catalog({ name: 'constellation-art', displayLabel: false, sourceSize: 0,
            shape: (source, ctx) => _drawArt(source, ctx) });
        const sources = artData.map(c => {
            const a0 = c.anchors[0];
            return A.source(a0.ra, a0.dec, { artId: c.id });
        });
        artCatalog.addSources(sources);
        _aladin.addCatalog(artCatalog);
        if (!wantVisible.art) { artCatalog.isShowing = false; artCatalog.reportChange(); }
    }

    function _drawArt(source, ctx) {
        const img = artImages[source.data.artId];
        if (!img) return;
        const c = artData.find(x => x.id === source.data.artId);
        if (!c || c.anchors.length < 2) return;
        const sa = c.anchors.map(a => {
            const pt = _aladin.world2pix(a.ra, a.dec);
            return pt ? { px: a.px, py: a.py, sx: pt[0], sy: pt[1] } : null;
        }).filter(Boolean);
        if (sa.length < 2) return;
        const [a0, a1] = sa;
        const dpx = a1.px-a0.px, dpy = a1.py-a0.py;
        const dsx = a1.sx-a0.sx, dsy = a1.sy-a0.sy;
        const pLen = Math.sqrt(dpx*dpx+dpy*dpy);
        if (pLen < 1) return;
        const scale = Math.sqrt(dsx*dsx+dsy*dsy) / pLen;
        const rot   = Math.atan2(dsy,dsx) - Math.atan2(dpy,dpx);
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.translate(a0.sx, a0.sy);
        ctx.rotate(rot);
        ctx.scale(scale, scale);
        ctx.translate(-a0.px, -a0.py);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
    }

    // ── Hover 高亮 ────────────────────────────────────────────────────────

    function _setHighlight(id, on) {
        const polys = conPolylines[id];
        if (!polys) return;
        for (const poly of polys) {
            if (on) { poly.setLineWidth(3); poly.opacity = 1.0; }
            else    { poly.setLineWidth(1); poly.opacity = 0.8; }
        }
        linesOverlay.reportChange();
    }

    function _registerHoverHandlers() {
        const DEG = Math.PI / 180;
        _aladin.on('mouseMove', pos => {
            if (!wantVisible.lines || !wantVisible.names) return;
            if (!pos || pos.ra == null) return;
            const fov      = _aladin.getFov()[0];
            const threshDeg = 48 / (_aladin.view.width / fov);
            const dec0 = pos.dec * DEG;
            let nearest = null, nearestDist = threshDeg;
            for (const c of _names()) {
                const dra  = (c.ra  - pos.ra)  * DEG * Math.cos(dec0);
                const ddec = (c.dec - pos.dec) * DEG;
                const dist = Math.sqrt(dra*dra + ddec*ddec) / DEG;
                if (dist < nearestDist) { nearestDist = dist; nearest = c.id; }
            }
            if (nearest === hoveredId) return;
            if (hoveredId) _setHighlight(hoveredId, false);
            hoveredId = nearest;
            if (hoveredId) _setHighlight(hoveredId, true);
        });
    }

    // ── 公开开关 ──────────────────────────────────────────────────────────

    function showLines(on) {
        wantVisible.lines = on;
        if (!linesOverlay) return;
        on ? linesOverlay.show() : linesOverlay.hide();
    }

    function showNames(on) {
        wantVisible.names = on;
        if (!namesOverlay) return;
        on ? namesOverlay.show() : namesOverlay.hide();
        if (!on && hoveredId) { _setHighlight(hoveredId, false); hoveredId = null; }
    }

    function showArt(on) {
        wantVisible.art = on;
        if (currentMode === 'chinese') return;  // 古代模式无图画
        if (on && !artCatalog) {
            _buildArtCatalog();
        } else if (artCatalog) {
            artCatalog.isShowing = on;
            artCatalog.reportChange();
        }
    }

    return { init, setMode, setLang, setStarsData, showLines, showNames, showArt };
})();
