export function initial(n = 7) {
  if (![7, 9, 11].includes(n)) throw Error("棋盘尺寸无效");
  return {
    n,
    board: Array(n * n).fill(0),
    turn: 1,
    owners: [0, 1, 2],
    moves: 0,
    swapped: false,
    winner: 0,
  };
}
export function neighbors(i, n) {
  const r = Math.floor(i / n),
    c = i % n;
  return [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ].flatMap(([dr, dc]) => {
    const y = r + dr,
      x = c + dc;
    return y >= 0 && x >= 0 && y < n && x < n ? [y * n + x] : [];
  });
}
export function connection(board, n, color) {
  const queue = [],
    seen = new Set(),
    parent = new Map();
  for (let k = 0; k < n; k++) {
    const i = color === 1 ? k : k * n;
    if (board[i] === color) {
      queue.push(i);
      seen.add(i);
    }
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    if (color === 1 ? Math.floor(i / n) === n - 1 : i % n === n - 1) {
      const path = [i];
      while (parent.has(path.at(-1))) path.push(parent.get(path.at(-1)));
      return path;
    }
    for (const j of neighbors(i, n))
      if (board[j] === color && !seen.has(j)) {
        seen.add(j);
        parent.set(j, i);
        queue.push(j);
      }
  }
  return [];
}
export function canSwap(s) {
  return !s.winner && s.moves === 1 && !s.swapped && s.turn === 2;
}
export function legal(s) {
  return s.winner
    ? []
    : [
        ...s.board.flatMap((v, i) => (v ? [] : [i])),
        ...(canSwap(s) ? ["swap"] : []),
      ];
}
export function move(s, action) {
  if (!legal(s).includes(action)) throw Error("非法行动");
  if (action === "swap")
    return { ...s, owners: [0, 2, 1], turn: 1, moves: 2, swapped: true };
  const board = [...s.board],
    color = s.owners.indexOf(s.turn);
  board[action] = color;
  const won = connection(board, s.n, color).length > 0;
  return {
    ...s,
    board,
    turn: 3 - s.turn,
    moves: s.moves + 1,
    winner: won ? s.turn : 0,
  };
}
function distance(board, n, color) {
  const d = Array(n * n).fill(1000),
    used = Array(n * n).fill(false);
  for (let k = 0; k < n; k++) {
    const i = color === 1 ? k : k * n;
    d[i] = board[i] === color ? 0 : board[i] === 0 ? 1 : 1000;
  }
  for (let step = 0; step < n * n; step++) {
    let at = -1;
    for (let i = 0; i < d.length; i++)
      if (!used[i] && (at < 0 || d[i] < d[at])) at = i;
    if (at < 0 || d[at] >= 1000) return 1000;
    if (color === 1 ? Math.floor(at / n) === n - 1 : at % n === n - 1)
      return d[at];
    used[at] = true;
    for (const j of neighbors(at, n))
      if (board[j] !== 3 - color)
        d[j] = Math.min(d[j], d[at] + (board[j] === color ? 0 : 1));
  }
  return 1000;
}
export function computer(s) {
  if (s.winner) return null;
  if (canSwap(s)) {
    const i = s.board.indexOf(1),
      mid = (s.n - 1) / 2;
    if (
      Math.abs(Math.floor(i / s.n) - mid) + Math.abs((i % s.n) - mid) <=
      s.n / 3
    )
      return "swap";
  }
  const color = s.owners.indexOf(s.turn);
  let best = null,
    value = -Infinity;
  for (const i of legal(s)) {
    if (i === "swap") continue;
    const b = [...s.board];
    b[i] = color;
    if (connection(b, s.n, color).length) return i;
    let score = -distance(b, s.n, color) * 8 + distance(b, s.n, 3 - color) * 6;
    b[i] = 3 - color;
    if (connection(b, s.n, 3 - color).length) score += 10000;
    score -=
      Math.abs(Math.floor(i / s.n) - (s.n - 1) / 2) * 0.01 +
      Math.abs((i % s.n) - (s.n - 1) / 2) * 0.01;
    if (score > value) {
      value = score;
      best = i;
    }
  }
  return best;
}
