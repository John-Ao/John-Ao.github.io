export const lines = [
  ...Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => r * 5 + c),
  ),
  ...Array.from({ length: 5 }, (_, c) =>
    Array.from({ length: 5 }, (_, r) => r * 5 + c),
  ),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];
export function initial() {
  return { board: Array(25).fill(0), turn: 1, winner: 0, moves: 0, recent: [] };
}
export function ends(s, from) {
  if (
    s.winner ||
    !Number.isInteger(from) ||
    from < 0 ||
    from >= 25 ||
    s.board[from] === 3 - s.turn
  )
    return [];
  const r = Math.floor(from / 5),
    c = from % 5;
  if (r !== 0 && r !== 4 && c !== 0 && c !== 4) return [];
  return [...new Set([r * 5, r * 5 + 4, c, 20 + c])].filter((i) => i !== from);
}
export function legal(s) {
  return s.board.flatMap((_, from) =>
    ends(s, from).map((to) => ({ from, to })),
  );
}
export function winningLine(board, p) {
  return lines.find((line) => line.every((i) => board[i] === p)) || [];
}
export function move(s, { from, to }) {
  if (!ends(s, from).includes(to))
    throw Error("只能取外围空块或己块，从另一端推入");
  const b = [...s.board],
    step =
      Math.floor(from / 5) === Math.floor(to / 5)
        ? Math.sign(to - from)
        : Math.sign(to - from) * 5;
  for (let i = from; i !== to; i += step) b[i] = b[i + step];
  b[to] = s.turn;
  const opponent = 3 - s.turn,
    winner = winningLine(b, opponent).length
      ? opponent
      : winningLine(b, s.turn).length
        ? s.turn
        : 0;
  return {
    board: b,
    turn: opponent,
    winner,
    moves: s.moves + 1,
    recent: [...s.recent, s.board.join("")].slice(-20),
  };
}
function evaluate(s, p) {
  if (s.winner) return s.winner === p ? 100000 : -100000;
  let score = 0;
  for (const line of lines) {
    let own = 0,
      other = 0;
    for (const i of line) {
      if (s.board[i] === p) own++;
      if (s.board[i] === 3 - p) other++;
    }
    if (!other) score += 3 ** own;
    if (!own) score -= 3 ** other * 1.2;
  }
  return score;
}
export function computer(s) {
  let best = null,
    value = -Infinity,
    index = 0;
  for (const a of legal(s)) {
    const next = move(s, a);
    let score = evaluate(next, s.turn);
    if (!next.winner) {
      score = Infinity;
      for (const reply of legal(next))
        score = Math.min(score, evaluate(move(next, reply), s.turn));
    }
    score -= s.recent.filter((b) => b === next.board.join("")).length * 80;
    score +=
      (((Math.imul(s.moves + 1, 1103515245) ^
        Math.imul(++index, 2654435761)) >>>
        0) /
        4294967296) *
      0.01;
    if (score > value) {
      best = a;
      value = score;
    }
  }
  return best;
}
