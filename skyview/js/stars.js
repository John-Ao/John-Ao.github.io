/**
 * 恒星星名显示模块（统一）
 *
 * 显示条件（满足其一即显示）：
 *   (是星座连线恒星 && showConstStarNames) || (showStarNames && mag <= magThreshold)
 *
 * 古代模式：连线恒星使用中国古代星名（chinese_star_names.json）
 * 现代模式：使用 BSC5/HYG 星名（stars.json）
 */

const Stars = (() => {
    let allStars      = [];    // stars.json（现代恒星名）
    let chineseStars  = [];    // chinese_star_names.json（古代恒星名）
    let catalog       = null;
    let _aladin       = null;

    let showConstStarNames = false;
    let showStarNames      = false;
    let magThreshold       = 2.0;
    let currentLang        = 'zh';
    let chineseMode        = false;   // 是否使用古代模式

    // 连线恒星坐标集（由 Constellations 设置，随模式切换更新）
    let constStarCoords = new Set();
    // 古代模式：连线恒星的 HIP->名字 快查表
    let chineseStarMap  = new Map();  // key = "ra,dec" -> {zh, en}

    // ── 初始化 ─────────────────────────────────────────────────────────────

    async function init(aladinInstance) {
        _aladin = aladinInstance;

        [allStars, chineseStars] = await Promise.all([
            fetch('data/stars.json').then(r => r.json()),
            fetch('data/chinese_star_names.json').then(r => r.json()),
        ]);

        // 建立古代星名坐标快查表
        for (const s of chineseStars) {
            chineseStarMap.set(`${Math.round(s.ra*100)},${Math.round(s.dec*100)}`, s);
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

        return allStars;
    }

    // ── 外部设置接口 ───────────────────────────────────────────────────────

    function setConstStarCoords(coordSet) {
        constStarCoords = coordSet;
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
                // 古代模式：使用 chinese_star_names.json
                // 连线恒星名：从 chineseStarMap 查坐标键
                const seen = new Set();
                if (showConstStarNames) {
                    for (const [key, s] of chineseStarMap) {
                        if (!constStarCoords.has(key)) continue;
                        const label = currentLang === 'zh'
                            ? (s.zh || s.en || '') : (s.en || s.zh || '');
                        if (!label) continue;
                        sources.push(A.source(s.ra, s.dec, { label }));
                        seen.add(key);
                    }
                }
                // 星等阈值恒星：在古代模式下仍用 allStars，但排除已显示的连线恒星
                if (showStarNames) {
                    for (const s of allStars) {
                        if (s.mag > magThreshold) continue;
                        const key = `${Math.round(s.ra*100)},${Math.round(s.dec*100)}`;
                        if (seen.has(key)) continue;
                        // 优先显示古代名，没有则用现代名
                        const chStar = chineseStarMap.get(key);
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
                // 现代模式：使用 allStars
                sources = allStars.flatMap(s => {
                    const key = `${Math.round(s.ra*100)},${Math.round(s.dec*100)}`;
                    const isConst = constStarCoords.has(key);
                    const show = (isConst && showConstStarNames) ||
                                 (showStarNames && s.mag <= magThreshold);
                    if (!show) return [];
                    const label = currentLang === 'zh'
                        ? (s.zh || s.name || '') : (s.name || s.zh || '');
                    if (!label) return [];
                    return [A.source(s.ra, s.dec, { label })];
                });
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
        setConstStarCoords,
        setChineseStarMode,
        setLang,
        setShowConstStarNames,
        setShowStarNames,
        setMagThreshold,
    };
})();
