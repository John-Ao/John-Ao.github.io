(() => {
    'use strict';
    const $ = id => document.getElementById(id), G = Gomoku;
    let state = G.replay([]), enabled = false, rule = 'freestyle';
    let results = [], forbidden = new Map(), analysisStatus = 'idle';
    const ai = createRapfiClient(
        data => { results = data.displayResults || data.results; render(); },
        message => { enabled = false; results = []; analysisStatus = 'idle'; render(); notify(message); },
        status => { analysisStatus = status; render(); }
    );
    const view = createBoardView($('c'), (ctx, pad, cell) => {
        const candidates = results.slice(0, 3);
        candidates.forEach((move, rank) => {
            const x = pad + move.index % 15 * cell, y = pad + Math.floor(move.index / 15) * cell;
            ctx.beginPath();
            ctx.arc(x, y, cell * .36, 0, Math.PI * 2);
            ctx.fillStyle = move.score > 0 ? '#237552' : move.score < 0 ? '#c93c32' : '#77766f';
            ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `bold ${Math.max(9, cell * .35)}px sans-serif`;
            ctx.fillText(rank + 1, x, y);
        });
        for (const index of forbidden.keys()) {
            // White can play a black forbidden point; keep both its candidate
            // number and the black-only X visible in that case.
            const overlap = candidates.some(move => move.index === index);
            const x = pad + index % 15 * cell + (overlap ? cell * .32 : 0);
            const y = pad + Math.floor(index / 15) * cell - (overlap ? cell * .32 : 0);
            const radius = cell * (overlap ? .12 : .2);
            ctx.beginPath();
            ctx.moveTo(x - radius, y - radius); ctx.lineTo(x + radius, y + radius);
            ctx.moveTo(x - radius, y + radius); ctx.lineTo(x + radius, y - radius);
            ctx.strokeStyle = '#fff3db'; ctx.lineWidth = Math.max(4, cell * .13); ctx.stroke();
            ctx.strokeStyle = '#a32926'; ctx.lineWidth = Math.max(2, cell * .07); ctx.stroke();
        }
    });
    function notify(message) {
        clearTimeout(notify.timer);
        $('notice').textContent = message; $('notice').hidden = !message;
        if (message) notify.timer = setTimeout(() => { $('notice').hidden = true; }, 3500);
    }
    function render() {
        view.render(state);
        $('analysis').setAttribute('aria-pressed', String(enabled));
        $('analysis').textContent = enabled && analysisStatus === 'loading' ? '加载 AI…' : 'AI 分析';
        $('renju').setAttribute('aria-pressed', String(rule === 'renju'));
        $('undo').disabled = !state.moves.length;
        $('status').textContent = state.winner ? `${state.winner === 'black' ? '黑' : '白'}方获胜` : state.draw ? '平局' : `${state.turn === 1 ? '黑' : '白'}方落子 · 第 ${state.moves.length + 1} 手`;
    }
    function updateForbidden() {
        forbidden = new Map();
        if (rule !== 'renju' || state.winner || state.draw) return;
        const memo = new Map();
        for (let index = 0; index < 225; index++) if (!state.board[index]) {
            const info = G.moveInfo(state.board, index, 1, rule, memo);
            if (!info.legal) forbidden.set(index, info.reason);
        }
    }
    function stop() {
        ai.stop();
        analysisStatus = 'idle';
        results = [];
    }
    function analyze() {
        stop();
        if (enabled && !state.winner && !state.draw) ai.start(state.moves,rule);
    }
    function save(replace = false) {
        const url = new URL(location.href);
        if (rule === 'renju') url.searchParams.set('rule', 'renju'); else url.searchParams.delete('rule');
        if (state.moves.length) url.searchParams.set('moves', G.serialize(state.moves)); else url.searchParams.delete('moves');
        try { history[replace ? 'replaceState' : 'pushState'](null, '', url); } catch { notify('浏览器未允许更新棋局网址'); }
    }
    function refresh() { $('c').title = ''; updateForbidden(); analyze(); render(); }
    function load() {
        const params = new URLSearchParams(location.search);
        rule = params.get('rule') === 'renju' ? 'renju' : 'freestyle';
        try { state = G.parse(params.get('moves') || '', rule); }
        catch (error) { state = G.replay([], rule); notify('网址中的棋谱无效：' + error.message + '，已重置棋盘'); }
        refresh();
    }
    $('c').onclick = event => {
        if (state.winner || state.draw) return;
        const move = view.point(event);
        if (!G.inside(move.col, move.row) || state.board[move.row * 15 + move.col]) return;
        const info = G.moveInfo(state.board, move.row * 15 + move.col, state.turn, rule);
        if (!info.legal) { notify(info.reason + '，请选择其他落点'); return; }
        notify(''); state = G.replay([...state.moves, move], rule); save(); refresh();
    };
    $('c').onmousemove = event => {
        const move = view.point(event), index = move.row * 15 + move.col;
        if (!G.inside(move.col, move.row)) { $('c').title = ''; return; }
        const candidate = results.slice(0, 3).find(item => item.index === index);
        const hints = [];
        if (forbidden.has(index)) hints.push('黑棋：' + forbidden.get(index) + '（白棋可落子）');
        if (candidate) hints.push(candidate.proven || candidate.score === null ? candidate.label : candidate.score > 0 ? '当前方胜势估计' : candidate.score < 0 ? '当前方负势估计' : '当前方均势估计');
        $('c').title = hints.join('；');
    };
    $('undo').onclick = () => { state = G.replay(state.moves.slice(0, -1), rule); notify(''); save(); refresh(); };
    $('reset').onclick = () => { state = G.replay([], rule); notify(''); save(); refresh(); };
    $('analysis').onclick = () => { enabled = !enabled; refresh(); };
    $('renju').onclick = () => {
        const next = rule === 'renju' ? 'freestyle' : 'renju';
        try { const updated = G.replay(state.moves, next); rule = next; state = updated; notify(''); save(); refresh(); }
        catch (error) { notify('当前棋谱不符合连珠禁手：' + error.message + '。请悔棋或重开后切换。'); }
    };
    $('share').onclick = async () => {
        try { await navigator.clipboard.writeText(location.href); notify('棋局链接已复制到剪贴板'); }
        catch { prompt('复制此链接分享棋局：', location.href); }
    };
    window.addEventListener('popstate', load);
    window.addEventListener('pagehide', () => { stop(); ai.dispose(); });
    window.addEventListener('resize', () => view.resize());
    window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
    new ResizeObserver(() => view.resize()).observe($('wrap'));
    load(); view.resize(); save(true);
})();
