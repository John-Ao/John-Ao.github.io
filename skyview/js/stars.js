/**
 * 恒星星名显示模块
 *
 * 显示条件（满足其一即显示）：
 *   (是星座连线恒星 && showConstStarNames) || (showStarNames && mag <= magThreshold)
 *
 * 古代模式：连线恒星使用中国古代星名（chinese_star_names.json）
 * 现代模式：使用 BSC5/HYG 星名（stars.json）
 */

const Stars = (() => {
    let allStars      = [];    // stars.json 全部恒星
    let chineseStars  = [];    // chinese_star_names.json（古代星名，带 hip）
    let catalog       = null;
    let _aladin       = null;

    let showConstStarNames = false;
    let showStarNames      = false;
    let magThreshold       = 2.0;
    let currentLang        = 'zh';
    let chineseMode        = false;

    // 连线恒星 HIP Set（由 Constellations 设置）
    let constHips = new Set();

    // HIP -> star 快查表（现代模式）
    let hipIndex = new Map();
    // HIP -> {zh, en, ra, dec} 快查表（古代模式）
    let chineseHipIndex = new Map();

    // ── 初始化 ─────────────────────────────────────────────────────────────

    async function init(aladinInstance) {
        _aladin = aladinInstance;

        [allStars, chineseStars] = await Promise.all([
            fetch('data/stars.json').then(r => r.json()),
            fetch('data/chinese_star_names.json').then(r => r.json()),
        ]);

        for (const s of allStars) {
            if (s.hip) hipIndex.set(s.hip, s);
        }
        for (const s of chineseStars) {
            if (s.hip) chineseHipIndex.set(s.hip, s);
        }

        catalog = A.catalog({
            name:         'star-names',
            displayLabel: false,
            sourceSize:   0,
            shape: function(source, ctx) {
                const label = source.data.label;
                if (!label || !source.x || !source.y) return;
                ctx.save();
                ctx.font         = '11px "PingFang SC","Microsoft YaHei",sans-serif';
                ctx.textAlign    = 'left';
                ctx.textBaseline = 'middle';
                ctx.lineWidth    = 2.5;
                ctx.strokeStyle  = 'rgba(0,0,0,0.85)';
                ctx.lineJoin     = 'round';
                ctx.strokeText(label, source.x + 5, source.y);
                ctx.fillStyle    = '#d0e0ff';
                ctx.fillText(label, source.x + 5, source.y);
                ctx.restore();
            },
        });
        _aladin.addCatalog(catalog);
        catalog.isShowing = false;
        catalog.reportChange();

        // 返回 hipIndex 供 Constellations 使用（查连线恒星坐标）
        return hipIndex;
    }

    // ── 外部设置接口 ───────────────────────────────────────────────────────

    function setConstStarHips(hipSet) {
        constHips = hipSet;
        _refresh();
    }

    function setChineseStarMode(on) {
        chineseMode = on;
        _refresh();
    }

    function setLang(lang) {
        currentLang = lang;
        _refresh();
    }

    function setShowConstStarNames(on) {
        showConstStarNames = on;
        _refresh();
    }

    function setShowStarNames(on) {
        showStarNames = on;
        _refresh();
    }

    function setMagThreshold(mag) {
        magThreshold = mag;
        _refresh();
    }

    // ── 刷新 ───────────────────────────────────────────────────────────────

    function _refresh() {
        if (!catalog) return;

        const anyVisible = showConstStarNames || showStarNames;
        let sources = [];

        if (anyVisible) {
            if (chineseMode) {
                // 古代模式：连线恒星从 chineseHipIndex 取名，其余从 allStars 取
                const seenHips = new Set();
                if (showConstStarNames) {
                    for (const hip of constHips) {
                        const s = chineseHipIndex.get(hip);
                        if (!s) continue;
                        const label = currentLang === 'zh'
                            ? (s.zh || s.en || '') : (s.en || s.zh || '');
                        if (!label) continue;
                        sources.push(A.source(s.ra, s.dec, { label }));
                        seenHips.add(hip);
                    }
                }
                if (showStarNames) {
                    for (const s of allStars) {
                        if (s.mag > magThreshold) continue;
                        if (s.hip && seenHips.has(s.hip)) continue;
                        const chStar = s.hip ? chineseHipIndex.get(s.hip) : null;
                        let label;
                        if (chStar) {
                            label = currentLang === 'zh'
                                ? (chStar.zh || chStar.en || '')
                                : (chStar.en || chStar.zh || '');
                        } else {
                            label = currentLang === 'zh'
                                ? (s.zh || s.name || '') : (s.name || s.zh || '');
                        }
                        if (!label) continue;
                        sources.push(A.source(s.ra, s.dec, { label }));
                    }
                }
            } else {
                // 现代模式：直接用 HIP Set 判断是否连线恒星
                for (const s of allStars) {
                    const isConst = s.hip && constHips.has(s.hip);
                    const show = (isConst && showConstStarNames) ||
                                 (showStarNames && s.mag <= magThreshold);
                    if (!show) continue;
                    const label = currentLang === 'zh'
                        ? (s.zh || s.name || '') : (s.name || s.zh || '');
                    if (!label) continue;
                    sources.push(A.source(s.ra, s.dec, { label }));
                }
            }
        }

        catalog.isShowing = false;
        catalog.removeAll();
        catalog.addSources(sources);
        catalog.isShowing = anyVisible && sources.length > 0;
        catalog.reportChange();
    }

    return {
        init,
        setConstStarHips,
        setChineseStarMode,
        setLang,
        setShowConstStarNames,
        setShowStarNames,
        setMagThreshold,
    };
})();
