/**
 * 主逻辑：初始化 Aladin Lite，协调各模块
 */

(async () => {
    // UI 状态
    let lang = 'zh';
    const state = {
        showLines: true,
        showConstNames: true,
        showConstArt: false,
        showConstStarNames: false,
        showStarNames: false,
        magThreshold: 2.0,
        showNgcMarkers: false,
        showGrid: false,
    };

    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
        setTimeout(() => loadingOverlay.remove(), 600);
    }

    try {
        // 等待 Aladin WASM 就绪
        loadingText.textContent = '正在初始化星图引擎…';

        // A 在 Aladin Lite 脚本加载完后才存在；若网络失败则 A 未定义
        if (typeof A === 'undefined') {
            throw new Error('Aladin Lite 脚本加载失败，请检查网络连接后刷新页面');
        }

        await A.init;

        loadingText.textContent = '正在加载底图…';
        const mellingerUrl  = 'CDS/P/Mellinger/color';
        const hipsSurveyUrl = mellingerUrl;

        const aladin = A.aladin('#aladin-lite-div', {
            survey: hipsSurveyUrl,
            projection: 'STG',
            fov: 180,
            showZoomControl: true,
            showLayersControl: false,
            showFullscreenControl: true,
            showSimbadPointerControl: false,
            showCooGridControl: false,
            showProjectionControl: true,
            showReticle: true,
            showCooGrid: false,
            cooFrame: 'ICRSd',
        });

        // 初始化恒星数据
        loadingText.textContent = '正在加载恒星数据…';
        await Stars.init(aladin);

        // 初始化星座模块
        loadingText.textContent = '正在加载星座数据…';
        await Constellations.init(aladin);

        // 初始化 NGC 模块
        loadingText.textContent = '正在加载深空天体数据…';
        await NGC.init(aladin);

        // 初始化搜索模块（后台加载，不阻塞）
        Search.init(aladin);

        // 应用初始显示状态
        Constellations.showLines(state.showLines);
        Constellations.showNames(state.showConstNames);
        Constellations.showArt(state.showConstArt);

        Stars.setShowConstStarNames(state.showConstStarNames);
        Stars.setShowStarNames(state.showStarNames);
        Stars.setMagThreshold(state.magThreshold);

        hideLoading();

        // ── 星座模式切换（现代/古代）──
        document.querySelectorAll('#sky-culture-toggle .mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                document.querySelectorAll('#sky-culture-toggle .mode-btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.mode === mode)
                );
                Constellations.setMode(mode);
            });
        });

        // ── 语言切换 ──
        document.querySelectorAll('#lang-toggle .lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                lang = btn.dataset.lang;
                document.querySelectorAll('#lang-toggle .lang-btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.lang === lang)
                );
                Constellations.setLang(lang);
                Stars.setLang(lang);
                NGC.setLang(lang);
            });
        });

        // ── 星座连线开关 ──
        document.getElementById('toggle-lines').addEventListener('change', e => {
            state.showLines = e.target.checked;
            Constellations.showLines(state.showLines);
        });

        // ── 星座名称开关 ──
        document.getElementById('toggle-const-names').addEventListener('change', e => {
            state.showConstNames = e.target.checked;
            Constellations.showNames(state.showConstNames);
        });

        // ── 星座图画开关 ──
        document.getElementById('toggle-const-art').addEventListener('change', e => {
            state.showConstArt = e.target.checked;
            Constellations.showArt(state.showConstArt);
        });

        // ── 星座恒星名开关 ──
        document.getElementById('toggle-const-star-names').addEventListener('change', e => {
            state.showConstStarNames = e.target.checked;
            Stars.setShowConstStarNames(state.showConstStarNames);
        });

        // ── 星名显示开关 ──
        document.getElementById('toggle-star-names').addEventListener('change', e => {
            state.showStarNames = e.target.checked;
            Stars.setShowStarNames(state.showStarNames);
            document.getElementById('mag-section').style.opacity = state.showStarNames ? '1' : '0.4';
        });

        // ── 星等滑块 ──
        const magSlider     = document.getElementById('mag-slider');
        const magValueBadge = document.getElementById('mag-value-badge');

        function updateSliderFill(val) {
            magSlider.style.setProperty('--fill', (val / 6 * 100) + '%');
        }

        magSlider.addEventListener('input', e => {
            const val = parseFloat(e.target.value);
            state.magThreshold = val;
            magValueBadge.textContent = val.toFixed(1);
            updateSliderFill(val);
            Stars.setMagThreshold(val);
        });

        updateSliderFill(state.magThreshold);
        magValueBadge.textContent = state.magThreshold.toFixed(1);

        // ── 数据源切换 ──
        document.getElementById('survey-select').addEventListener('change', e => {
            aladin.setBaseImageLayer(e.target.value);
        });

        // ── 坐标网格开关 ──
        document.getElementById('toggle-grid').addEventListener('change', e => {
            state.showGrid = e.target.checked;
            state.showGrid ? aladin.showCooGrid() : aladin.hideCooGrid();
        });

        // ── NGC 位置标注开关 ──
        document.getElementById('toggle-ngc-markers').addEventListener('change', e => {
            state.showNgcMarkers = e.target.checked;
            NGC.showMarkers(state.showNgcMarkers);
        });

    } catch (err) {
        loadingText.textContent = '加载失败：' + err.message;
        console.error('初始化错误:', err);
    }

})();

// ── 面板宽度调整与收起 ───────────────────────────────────────────────────────
// 独立于 Aladin 初始化，页面加载后立即生效

(function initPanelResize() {
    const panel    = document.getElementById('control-panel');
    const resizer  = document.getElementById('panel-resizer');
    const toggle   = document.getElementById('panel-toggle');
    const MIN_W    = 160;
    const MAX_W    = 420;
    const STORE_KEY = 'skyview_panel_width';

    let collapsed   = false;
    let savedWidth  = parseInt(localStorage.getItem(STORE_KEY)) || 220;

    // 应用宽度（CSS 变量同步给 toggle 按钮定位）
    function applyWidth(w) {
        w = Math.max(MIN_W, Math.min(MAX_W, w));
        savedWidth = w;
        document.documentElement.style.setProperty('--panel-width', w + 'px');
        localStorage.setItem(STORE_KEY, w);
    }

    // 初始化宽度
    applyWidth(savedWidth);

    // ── 收起/展开 ──
    toggle.addEventListener('click', () => {
        collapsed = !collapsed;
        panel.classList.toggle('collapsed', collapsed);
        toggle.classList.toggle('collapsed', collapsed);
        toggle.innerHTML = collapsed ? '&#8250;' : '&#8249;';
        resizer.style.display = collapsed ? 'none' : '';
    });

    // ── 拖拽调宽 ──
    let startX, startW;

    resizer.addEventListener('mousedown', e => {
        if (collapsed) return;
        e.preventDefault();
        startX = e.clientX;
        startW = panel.offsetWidth;
        resizer.classList.add('dragging');

        const onMove = e => {
            const w = startW + (e.clientX - startX);
            applyWidth(w);
            // 实时设置（不走 transition）
            panel.style.transition = 'none';
            panel.style.width = Math.max(MIN_W, Math.min(MAX_W, w)) + 'px';
        };

        const onUp = () => {
            resizer.classList.remove('dragging');
            panel.style.transition = '';
            panel.style.width = '';   // 交还给 CSS 变量
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
    });
}());
