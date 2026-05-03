/**
 * 搜索模块
 * 加载 search_db.json，提供实时搜索并居中定位功能。
 */

const Search = (() => {
    let _aladin = null;
    let _db     = [];

    // 类型标签（中文）
    const TYPE_LABEL = {
        star: '恒星',
        ngc:  '深空天体',
        con:  '星座',
        xg:   '星官',
    };
    const TYPE_COLOR = {
        star: '#a0c8ff',
        ngc:  '#ffe08a',
        con:  '#88ccff',
        xg:   '#ffb888',
    };

    // ── 初始化 ─────────────────────────────────────────────────────────────

    async function init(aladinInstance) {
        _aladin = aladinInstance;
        _db = await fetch('data/search_db.json').then(r => r.json());
        _buildUI();
    }

    // ── 搜索逻辑 ──────────────────────────────────────────────────────────

    /**
     * 在 _db 中搜索，返回最多 max 条结果。
     * 匹配规则（按优先级）：
     *   1. 主名完全匹配（大小写不敏感）
     *   2. 任意名称以 query 开头
     *   3. 任意名称包含 query
     */
    function search(query, max = 30) {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        const exact  = [];
        const prefix = [];
        const contain= [];

        for (const item of _db) {
            let matchLevel = 0;
            for (const name of item.a) {
                const n = name.toLowerCase();
                if (n === q)           { matchLevel = 3; break; }
                if (n.startsWith(q))  { matchLevel = Math.max(matchLevel, 2); }
                else if (n.includes(q)){ matchLevel = Math.max(matchLevel, 1); }
            }
            if      (matchLevel === 3) exact.push(item);
            else if (matchLevel === 2) prefix.push(item);
            else if (matchLevel === 1) contain.push(item);
        }

        // 同等级内按亮度/大小排序
        const sortFn = (a, b) => {
            const va = a.m ?? (a.sz ? -a.sz : 999);
            const vb = b.m ?? (b.sz ? -b.sz : 999);
            return va - vb;
        };
        exact.sort(sortFn);
        prefix.sort(sortFn);
        contain.sort(sortFn);

        return [...exact, ...prefix, ...contain].slice(0, max);
    }

    // ── 跳转逻辑 ──────────────────────────────────────────────────────────

    function gotoItem(item) {
        let fov;
        if (item.t === 'star') {
            fov = 10;
        } else if (item.t === 'ngc') {
            // 使天体角径占画面约 40%
            const minFov = 0.1;
            fov = Math.max(minFov, (item.sz || 1) / 60 / 0.4 * 2);
            fov = Math.min(fov, 20);
        } else {
            fov = 30;
        }
        _aladin.animateToRaDec(item.r, item.d, 0.6);
        _aladin.setFov(fov);
    }

    // ── UI ────────────────────────────────────────────────────────────────

    function _buildUI() {
        // 搜索容器
        const container = document.createElement('div');
        container.id = 'search-container';

        const input = document.createElement('input');
        input.type        = 'text';
        input.id          = 'search-input';
        input.placeholder = '搜索恒星、星座、NGC…';
        input.autocomplete = 'off';

        const results = document.createElement('div');
        results.id = 'search-results';
        results.style.display = 'none';

        container.appendChild(input);
        container.appendChild(results);

        // 插入控制面板顶部（panel-header 之后）
        const header = document.getElementById('panel-header');
        header.after(container);

        // 事件
        let debounceTimer;
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => _updateResults(input.value, results), 120);
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') { _hideResults(results, input); return; }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const first = results.querySelector('.search-item');
                if (first) first.focus();
            }
        });

        // 结果列表键盘导航
        results.addEventListener('keydown', e => {
            const items = [...results.querySelectorAll('.search-item')];
            const idx   = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                items[Math.min(idx + 1, items.length - 1)]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (idx === 0) input.focus();
                else items[idx - 1]?.focus();
            } else if (e.key === 'Escape') {
                _hideResults(results, input);
            }
        });

        // 点击外部关闭
        document.addEventListener('click', e => {
            if (!container.contains(e.target)) _hideResults(results, input);
        });
    }

    function _updateResults(query, resultsEl) {
        const items = search(query);
        resultsEl.innerHTML = '';

        if (!query.trim() || items.length === 0) {
            resultsEl.style.display = 'none';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className  = 'search-item';
            div.tabIndex   = 0;

            const tag = document.createElement('span');
            tag.className   = 'search-tag';
            tag.textContent = TYPE_LABEL[item.t] || item.t;
            tag.style.color = TYPE_COLOR[item.t] || '#ccc';

            const name = document.createElement('span');
            name.className   = 'search-name';
            name.textContent = item.n;

            // 副名（第二个名称，若有）
            if (item.a.length > 1 && item.a[1] !== item.n) {
                const sub = document.createElement('span');
                sub.className   = 'search-sub';
                sub.textContent = item.a[1];
                div.append(tag, name, sub);
            } else {
                div.append(tag, name);
            }

            const select = () => {
                gotoItem(item);
                const inputEl = document.getElementById('search-input');
                inputEl.value = item.n;
                resultsEl.style.display = 'none';
                inputEl.blur();
            };

            div.addEventListener('click',  select);
            div.addEventListener('keydown', e => { if (e.key === 'Enter') select(); });

            resultsEl.appendChild(div);
        });

        resultsEl.style.display = 'block';
    }

    function _hideResults(resultsEl, inputEl) {
        resultsEl.style.display = 'none';
        inputEl.blur();
    }

    return { init };
})();
