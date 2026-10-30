export const lines = [
  ...Array.from({ length: 4 }, (_, r) => [0, 1, 2, 3].map((c) => r * 4 + c)),
  ...Array.from({ length: 4 }, (_, c) => [0, 1, 2, 3].map((r) => r * 4 + c)),
  [0, 5, 10, 15],
  [3, 6, 9, 12],
];
export function initial() {
  return {
    board: Array.from({ length: 16 }, (_, i) =>
      [0, 3, 12, 15].includes(i) ? [3, 3] : [],
    ),
    reserve: [0, 8, 8],
    turn: 1,
    winner: 0,
    ended: false,
    moves: 0,
  };
}
export function neighbors(i) {
  const r = Math.floor(i / 4),
    c = i % 4;
  return [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ].flatMap(([dr, dc]) => {
    const y = r + dr,
      x = c + dc;
    return y >= 0 && x >= 0 && y < 4 && x < 4 ? [y * 4 + x] : [];
  });
}
export function starts(s) {
  return s.ended || !s.reserve[s.turn]
    ? []
    : s.board.flatMap((pile, i) => (pile.length ? [i] : []));
}
export function destinations(from, path) {
  const current = path.length ? path.at(-1) : from,
    previous = path.length > 1 ? path.at(-2) : path.length ? from : -1;
  return neighbors(current).filter((i) => i !== previous);
}
export function preview(s, from, path) {
  if (!starts(s).includes(from)) throw Error("请选择非空棋堆");
  const hand = [...s.board[from], s.turn];
  if (path.length > hand.length) throw Error("播撒步数过多");
  const board = s.board.map((p) => [...p]);
  board[from] = [];
  for (let k = 0; k < path.length; k++) {
    if (!destinations(from, path.slice(0, k)).includes(path[k]))
      throw Error("只能正交前进，不能立即折返");
    board[path[k]].push(hand[k]);
  }
  return { board, hand: hand.slice(path.length) };
}
export function winningLine(board, p) {
  return lines.find((line) => line.every((i) => board[i].at(-1) === p)) || [];
}
export function move(s, { from, path }) {
  const { board, hand } = preview(s, from, path);
  if (hand.length) throw Error("必须播完全部棋子");
  const reserve = [...s.reserve];
  reserve[s.turn]--;
  const winner = winningLine(board, s.turn).length
    ? s.turn
    : winningLine(board, 3 - s.turn).length
      ? 3 - s.turn
      : 0;
  return {
    board,
    reserve,
    turn: 3 - s.turn,
    winner,
    ended: !!winner || (!reserve[1] && !reserve[2]),
    moves: s.moves + 1,
  };
}
// Bounded enumeration samples complete legal paths from every eligible pile.
export function legal(s, cap = 1024) {
  const result = [],
    sources = starts(s),
    per = Math.max(1, Math.floor(cap / Math.max(1, sources.length)));
  for (const from of sources) {
    let count = 0;
    const length = s.board[from].length + 1;
    function walk(path) {
      if (count >= per) return;
      if (path.length === length) {
        result.push({ from, path: [...path] });
        count++;
        return;
      }
      for (const i of destinations(from, path)) {
        path.push(i);
        walk(path);
        path.pop();
        if (count >= per) break;
      }
    }
    walk([]);
  }
  return result;
}
function evaluate(s, p) {
  if (s.ended) return s.winner === p ? 10000 : s.winner ? -10000 : 0;
  let score = 0;
  for (const line of lines) {
    let own = 0,
      other = 0;
    for (const i of line) {
      const top = s.board[i].at(-1);
      if (top === p) own++;
      if (top === 3 - p) other++;
    }
    score += own ** 3 - other ** 3 * 1.3;
  }
  return score;
}
export function computer(s) {
  let ranked = legal(s)
    .map((a) => ({ a, s: move(s, a) }))
    .map((x) => ({ ...x, score: evaluate(x.s, s.turn) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  let best = ranked[0].a,
    value = -Infinity;
  for (const x of ranked.slice(0, 8)) {
    let score = x.score;
    if (!x.s.ended) {
      let worst = Infinity;
      for (const reply of legal(x.s, 128))
        worst = Math.min(worst, evaluate(move(x.s, reply), s.turn));
      score = worst;
    }
    if (score > value) {
      value = score;
      best = x.a;
    }
  }
  return best;
}
