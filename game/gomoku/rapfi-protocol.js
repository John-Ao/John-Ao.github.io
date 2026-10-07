/* Rapfi's text protocol translated to the existing board view. */
function createRapfiProtocol(G, moves, rule, emit, options) {
    'use strict';
    options ||= {};
    const state = G.replay(moves, rule);
    let current = null, batch = [], results = [], lastDepth = 0, elapsedMs = 0, nodes = 0;
    const coordinate = text => {
        const m = /^(\d+),(\d+)$/.exec(text.trim());
        if (!m) return null;
        const col = +m[1], row = +m[2];
        return G.inside(col, row) ? row * 15 + col : null;
    };
    function legal(index) {
        return index !== null && G.moveInfo(state.board, index, state.turn, rule).legal;
    }
    function publish(done) {
        emit({ engine: 'Rapfi', results, displayResults: results, depth: lastDepth, elapsedMs, nodes, done });
    }
    function receive(line) {
        line = line.trim();
        if (/^ERROR\b/.test(line) || /failed to (?:load|initialized)|Evaluator .* disabled:/i.test(line)) throw new Error(line);
        const info = /^INFO (\S+)\s*(.*)$/.exec(line);
        if (info) {
            const [, key, value] = info;
            if (key === 'PV') {
                if (value !== 'DONE') {
                    const rank = Number(value);
                    current = Number.isInteger(rank) && rank >= 0 ? { rank, pv: [] } : null;
                    if (rank === 0) batch = [];
                } else if (current) {
                    const item = current; current = null;
                    if (!legal(item.index ?? null) || !Number.isFinite(item.score)) return;
                    batch[item.rank] = item;
                    // Commit complete MultiPV iterations, never mix shallow,
                    // old or half-written candidates with the latest ranking.
                    if (item.rank + 1 === item.count && batch.length === item.count &&
                        Array.from({length:item.count},(_,i)=>batch[i]).every(m=>m && m.depth === item.depth)) {
                        // Rapfi emits each PV before re-sorting its completed
                        // prefix. PV number is search order, not final rank.
                        results = batch.slice().sort((a,b)=>b.score-a.score || a.rank-b.rank)
                            .slice(0,3).map((move,rank)=>({...move,rank}));
                        lastDepth = item.depth; elapsedMs = item.elapsedMs; nodes = item.nodes;
                        publish(false);
                    }
                }
                return;
            }
            if (!current) return;
            if (key === 'NUMPV') current.count = Number(value);
            if (key === 'DEPTH') current.depth = Number(value);
            if (key === 'TOTALTIME') current.elapsedMs = Number(value);
            if (key === 'TOTALNODES') current.nodes = Number(value);
            if (key === 'WINRATE') current.winRate = Number(value);
            if (key === 'EVAL') {
                const mate = /^([+-])M(\d+|\*)$/.exec(value);
                current.score = mate ? (mate[1] === '+' ? 1 : -1) * (1000000 - (Number(mate[2]) || 0)) : /^-?\d+$/.test(value) ? Number(value) : NaN;
                current.proven = !!mate;
                current.label = mate ? (mate[1] === '+' ? 'Rapfi 搜索胜势' : 'Rapfi 搜索败势') : 'Rapfi 估值';
            }
            if (key === 'BESTLINE') {
                current.pv = value.split(/\s+/).map(coordinate).filter(i=>i !== null);
                current.index = current.pv[0];
            }
        } else {
            const index = coordinate(line);
            if (legal(index)) {
                if (!results.length) results = [{index,score:null,proven:false,label:'Rapfi 开局建议',pv:[index],depth:0}];
                publish(true);
            }
        }
    }
    const self = moves.length % 2 + 1;
    // Protocol colours mean self/opponent, not black/white. Preserve move order
    // so Rapfi can identify Black correctly, especially on White's turn.
    const board = moves.map((m,i)=>`${m.col},${m.row},${i%2+1 === self ? 1 : 2}`);
    // Allocate the final thread count before START creates search state; never
    // recreate native threads or resize/clear the hash on ordinary moves.
    const commands = [
        ...(options.initialized ? [] : [
            `INFO THREAD_NUM ${Math.max(1,Math.min(256,Math.floor(options.threads || 1)))}`,
            'START 15', 'YXSHOWINFO',
            'INFO HASH_SIZE 131072', 'INFO SHOW_DETAIL 2']),
        `INFO RULE ${rule === 'renju' ? 4 : 0}`,
        'INFO TIMEOUT_TURN 0', 'INFO TIMEOUT_MATCH 0', 'INFO MAX_NODE 0', 'INFO MAX_DEPTH 100',
        `YXBOARD\n${board.length ? board.join('\n')+'\n' : ''}DONE`, 'YXNBEST 3'
    ];
    return { receive, commands, terminal: !!(state.winner || state.draw) };
}
if (typeof module !== 'undefined') module.exports = createRapfiProtocol;
