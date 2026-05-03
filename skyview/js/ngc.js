/**
 * NGC 深空天体模块
 * - 圆圈标注：圈出位置，显示编号和中文名
 * - 点击标注：弹出可缩放的高清大图浮层
 */

const NGC = (() => {
    let _aladin  = null;
    let _data    = [];

    let _circleOverlay = null;
    let _labelCatalog  = null;
    let _currentLang   = 'zh';
    let _wantVisible   = false;

    // 对象类型颜色
    const TYPE_COLOR = {
        'G':    '#ffcc44',
        'GCl':  '#ffaa00',
        'OCl':  '#44ff88',
        'Cl+N': '#44ffcc',
        'PN':   '#44ccff',
        'HII':  '#ff6688',
        'Neb':  '#aaddff',
        'RfN':  '#aaddff',
        'SNR':  '#ff8844',
    };
    const DEFAULT_COLOR = '#cccccc';

    // 类型中文描述
    const TYPE_ZH = {
        'G': '星系', 'GCl': '球状星团', 'OCl': '疏散星团',
        'Cl+N': '星团+星云', 'PN': '行星状星云', 'HII': 'HII区',
        'Neb': '星云', 'RfN': '反射星云', 'SNR': '超新星遗迹',
        '*': '恒星', '**': '双星', '*Ass': '星协', 'Other': '其他',
    };

    // ── 初始化 ─────────────────────────────────────────────────────────────

    async function init(aladinInstance) {
        _aladin = aladinInstance;
        _data   = await fetch('data/ngc.json').then(r => r.json());
    }

    // ── 语言 ──────────────────────────────────────────────────────────────

    function setLang(lang) {
        _currentLang = lang;
        if (_labelCatalog) {
            _labelCatalog.removeAll();
            _labelCatalog.addSources(_makeSources(lang));
        }
    }

    // ── 标注开关 ──────────────────────────────────────────────────────────

    function showMarkers(on) {
        _wantVisible = on;
        if (on && !_circleOverlay) {
            _buildCircles();
            _buildLabels();
        } else {
            if (_circleOverlay) on ? _circleOverlay.show() : _circleOverlay.hide();
            if (_labelCatalog) {
                _labelCatalog.isShowing = on;
                _labelCatalog.reportChange();
            }
        }
    }

    // ── 圆圈 ──────────────────────────────────────────────────────────────

    function _buildCircles() {
        _circleOverlay = A.graphicOverlay({ name: 'ngc-circles', lineWidth: 1.5 });
        _aladin.addOverlay(_circleOverlay);
        for (const obj of _data) {
            const r     = Math.max(0.08, obj.majax / 2 / 60);
            const color = TYPE_COLOR[obj.type] || DEFAULT_COLOR;
            _circleOverlay.add(A.circle(obj.ra, obj.dec, r, { color, opacity: 0.8 }));
        }
    }

    // ── 标签 catalog（含点击回调）────────────────────────────────────────

    function _buildLabels() {
        // 建立 ngc_id → obj 快查表
        const byNgc = new Map(_data.map(o => [o.ngc, o]));

        _labelCatalog = A.catalog({
            name:         'ngc-labels',
            displayLabel: false,
            sourceSize:   12,
            shape: function(source, ctx) {
                if (!source.x || !source.y) return;
                const label = source.data.label;
                if (!label) return;
                ctx.save();
                ctx.font          = '11px "PingFang SC","Microsoft YaHei",sans-serif';
                ctx.textAlign     = 'left';
                ctx.textBaseline  = 'middle';
                ctx.lineWidth     = 2.5;
                ctx.strokeStyle   = 'rgba(0,0,0,0.85)';
                ctx.lineJoin      = 'round';
                ctx.strokeText(label, source.x + 8, source.y);
                ctx.fillStyle     = '#ffe08a';
                ctx.fillText(label, source.x + 8, source.y);
                ctx.restore();
                // 保留 onClick：shape 函数不影响点击检测，onClick 仍然有效
            },
        });
        _labelCatalog.addSources(_makeSources(_currentLang));
        _aladin.addCatalog(_labelCatalog);
        if (!_wantVisible) {
            _labelCatalog.isShowing = false;
            _labelCatalog.reportChange();
        }
    }

    // 语言切换时不再需要 _rebuildLabels，直接 removeAll+addSources

    function _makeSources(lang) {
        return _data.map(obj => {
            let id = obj.m ? `M${obj.m} NGC${obj.ngc}` : `NGC${obj.ngc}`;
            const name = lang === 'zh' ? (obj.zh || obj.en || '') : (obj.en || obj.zh || '');
            const label = name ? `${id} ${name}` : id;
            return A.source(obj.ra, obj.dec, { label, ngcId: obj.ngc });
        });
    }


    return { init, setLang, showMarkers };
})();
