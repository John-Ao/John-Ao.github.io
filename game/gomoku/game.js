/* Shared rules for the page, AI and tests. Renju option applies black fouls,
   not tournament opening/swap procedures. */
function createGomoku() {
    'use strict';
    const SIZE = 15, COLS = 'ABCDEFGHIJKLMNO', dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    const inside = (c, r) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0 && c < SIZE && r < SIZE;
    function lines(board, col, row) {
        const player = board[row * SIZE + col]; if (!player) return [];
        return dirs.map(([dx, dy]) => {
            const cells = [{ col, row }];
            for (const sign of [-1, 1]) for (let k = 1; k < SIZE; k++) {
                const c = col + dx * k * sign, r = row + dy * k * sign;
                if (!inside(c, r) || board[r * SIZE + c] !== player) break;
                cells.push({ col: c, row: r });
            }
            return cells.sort((a, b) => a.col - b.col || a.row - b.row);
        });
    }
    function line(board, col, row, rule = 'freestyle') {
        return lines(board, col, row).find(cells => rule === 'renju' && board[row * SIZE + col] === 1 ? cells.length === 5 : cells.length >= 5) || null;
    }
    // Return legal/winning status for an EMPTY point, restoring board on exit.
    // RIF 9.2: an exact five takes precedence over simultaneous fouls.
    function moveInfo(board, index, player, rule = 'freestyle', memo = new Map(), check = () => {}) {
        check();
        if (!Number.isInteger(index) || index < 0 || index >= 225 || board[index]) return { legal: false, reason: '该点不可落子', win: false };
        const key = rule === 'renju' && player === 1 ? board.join('') + ':' + index : null;
        if (key && memo.has(key)) return memo.get(key);
        board[index] = player;
        let answer;
        try {
            const col = index % SIZE, row = Math.floor(index / SIZE), runs = lines(board, col, row);
            const winLine = runs.find(cells => rule === 'renju' && player === 1 ? cells.length === 5 : cells.length >= 5);
            if (winLine) answer = { legal: true, win: true, winLine };
            else if (rule !== 'renju' || player !== 1) answer = { legal: true, win: false };
            else if (runs.some(cells => cells.length >= 6)) answer = { legal: false, reason: '长连禁手', win: false };
            else {
                const fours = new Set(), threes = new Map();
                for (let d = 0; d < 4; d++) {
                    const [dx, dy] = dirs[d];
                    const point = k => inside(col + dx * k, row + dy * k) ? (row + dy * k) * SIZE + col + dx * k : -1;
                    const value = k => point(k) < 0 ? 2 : board[point(k)];
                    // Count distinct sets of FOUR stones, not completion ends.
                    // This catches same-direction double fours and does not
                    // misclassify a single straight four with two winning ends.
                    for (let start = -4; start <= 0; start++) {
                        const stones = []; let empty = 0, blocked = false;
                        for (let k = start; k < start + 5; k++) {
                            const v = value(k); if (v === 1) stones.push(point(k)); else if (!v) empty++; else blocked = true;
                        }
                        if (!blocked && stones.length === 4 && empty === 1 && value(start - 1) !== 1 && value(start + 5) !== 1) fours.add(stones.sort((a, b) => a - b).join(','));
                    }
                    // A genuine three must extend LEGALLY into a straight four.
                    // Gather geometry first, then recursively reject extensions
                    // that are themselves forbidden double-threes (RIF 9.3).
                    for (let start = -3; start <= 0; start++) {
                        if (value(start - 1) !== 0 || value(start + 4) !== 0 || value(start - 2) === 1 || value(start + 5) === 1) continue;
                        const stones = []; let extension = -1, empty = 0, blocked = false;
                        for (let k = start; k < start + 4; k++) {
                            const v = value(k); if (v === 1) stones.push(point(k)); else if (!v) { extension = point(k); empty++; } else blocked = true;
                        }
                        if (!blocked && stones.length === 3 && empty === 1) {
                            const group = stones.sort((a, b) => a - b).join(',');
                            if (!threes.has(group)) threes.set(group, []);
                            threes.get(group).push(extension);
                        }
                    }
                }
                if (fours.size >= 2) answer = { legal: false, reason: '四四禁手', win: false };
                else {
                    let genuine = 0;
                    if (threes.size >= 2) for (const extensions of threes.values()) {
                        const valid = extensions.some(next => {
                            const info = moveInfo(board, next, 1, rule, memo, check);
                            return info.legal && !info.win;
                        });
                        if (valid && ++genuine >= 2) break;
                    }
                    answer = genuine >= 2 ? { legal: false, reason: '三三禁手', win: false } : { legal: true, win: false };
                }
            }
        } finally { board[index] = 0; }
        if (key) { if (memo.size >= 20000) memo.clear(); memo.set(key, answer); }
        return answer;
    }
    function replay(input, rule = 'freestyle') {
        const state = { board: new Int8Array(SIZE * SIZE), moves: [], winner: null, winLine: null, turn: 1, draw: false, rule };
        const memo = new Map();
        for (const m of input) {
            if (state.winner || state.draw || !inside(m.col, m.row) || state.board[m.row * SIZE + m.col]) throw Error('无效棋谱');
            const info = moveInfo(state.board, m.row * SIZE + m.col, state.turn, rule, memo);
            if (!info.legal) throw Error(`第 ${state.moves.length + 1} 手：${info.reason}`);
            state.board[m.row * SIZE + m.col] = state.turn;
            state.moves.push({ col: m.col, row: m.row, color: state.turn === 1 ? 'black' : 'white' });
            state.winLine = info.winLine || null;
            if (info.win) state.winner = state.turn === 1 ? 'black' : 'white';
            state.turn = 3 - state.turn;
            state.draw = !state.winner && state.moves.length === SIZE * SIZE;
        }
        return state;
    }
    function parse(text, rule = 'freestyle') {
        if (!text) return replay([], rule);
        return replay(text.split(',').map(t => {
            if (!/^[A-O](?:[1-9]|1[0-5])$/.test(t)) throw Error('无效坐标');
            return { col: COLS.indexOf(t[0]), row: Number(t.slice(1)) - 1 };
        }), rule);
    }
    const serialize = moves => moves.map(m => COLS[m.col] + (m.row + 1)).join(',');
    return { SIZE, COLS, dirs, inside, line, moveInfo, replay, parse, serialize };
}
const Gomoku = createGomoku();
if (typeof module !== 'undefined') module.exports = Gomoku;
