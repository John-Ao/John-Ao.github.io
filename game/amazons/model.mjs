export const directions = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
export function initial() {
  let b = Array(100).fill(0);
  [60, 93, 96, 69].forEach((i) => (b[i] = 1));
  [30, 3, 6, 39].forEach((i) => (b[i] = 2));
  return { board: b, turn: 1, winner: 0 };
}
export function rays(b, i) {
  let out = [];
  for (let [dy, dx] of directions) {
    let y = Math.floor(i / 10) + dy,
      x = (i % 10) + dx;
    while (y >= 0 && y < 10 && x >= 0 && x < 10 && !b[y * 10 + x]) {
      out.push(y * 10 + x);
      y += dy;
      x += dx;
    }
  }
  return out;
}
export function mobility(b, p) {
  return b.reduce((n, v, i) => n + (v === p ? rays(b, i).length : 0), 0);
}
export function move(s, from, to, arrow) {
  if (s.winner || s.board[from] !== s.turn || !rays(s.board, from).includes(to))
    throw Error("非法移动");
  let b = [...s.board];
  b[from] = 0;
  b[to] = s.turn;
  if (!rays(b, to).includes(arrow)) throw Error("非法射箭");
  b[arrow] = 3;
  let next = 3 - s.turn;
  return { board: b, turn: next, winner: mobility(b, next) ? 0 : s.turn };
}
export function computer(s) {
  let best = null,
    score = -Infinity;
  for (let from = 0; from < 100; from++)
    if (s.board[from] === s.turn) {
      let targets = rays(s.board, from);
      for (let to of targets) {
        let b = [...s.board];
        b[from] = 0;
        b[to] = s.turn;
        let arrows = rays(b, to);
        for (let arrow of arrows) {
          b[arrow] = 3;
          let value =
            mobility(b, s.turn) - mobility(b, 3 - s.turn) + Math.random() * 0.2;
          b[arrow] = 0;
          if (value > score) {
            score = value;
            best = { from, to, arrow };
          }
        }
      }
    }
  return best;
}
