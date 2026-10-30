export function initial() {
  return {
    pits: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0],
    turn: 1,
    winner: 0,
    ended: false,
  };
}
export function legal(s) {
  return s.ended
    ? []
    : Array.from({ length: 6 }, (_, i) => i + (s.turn === 1 ? 0 : 7)).filter(
        (i) => s.pits[i] > 0,
      );
}
export function move(s, pit) {
  if (!legal(s).includes(pit)) throw Error("请选择己方非空棋坑");
  let p = [...s.pits],
    n = p[pit],
    i = pit,
    store = s.turn === 1 ? 6 : 13,
    skip = s.turn === 1 ? 13 : 6;
  p[pit] = 0;
  while (n) {
    i = (i + 1) % 14;
    if (i === skip) continue;
    p[i]++;
    n--;
  }
  let captured = 0;
  if (
    i !== store &&
    Math.floor(i / 7) === s.turn - 1 &&
    p[i] === 1 &&
    p[12 - i] > 0
  ) {
    captured = p[12 - i] + 1;
    p[store] += captured;
    p[i] = p[12 - i] = 0;
  }
  let ended = p.slice(0, 6).every((v) => !v) || p.slice(7, 13).every((v) => !v);
  if (ended) {
    p[6] += p.slice(0, 6).reduce((a, b) => a + b, 0);
    p[13] += p.slice(7, 13).reduce((a, b) => a + b, 0);
    for (let j = 0; j < 14; j++) if (j !== 6 && j !== 13) p[j] = 0;
  }
  return {
    pits: p,
    turn: i === store ? s.turn : 3 - s.turn,
    ended,
    winner: ended ? (p[6] === p[13] ? 0 : p[6] > p[13] ? 1 : 2) : 0,
    captured,
    extra: i === store && !ended,
  };
}
export function computer(s, depth = 6) {
  let who = s.turn;
  function value(a, d) {
    if (!d || a.ended)
      return (
        a.pits[who === 1 ? 6 : 13] -
        a.pits[who === 1 ? 13 : 6] +
        (a.ended ? (a.winner === who ? 100 : a.winner ? -100 : 0) : 0)
      );
    let vals = legal(a).map((i) => value(move(a, i), d - 1));
    return a.turn === who ? Math.max(...vals) : Math.min(...vals);
  }
  return legal(s)
    .map((i) => [i, value(move(s, i), depth - 1)])
    .sort((a, b) => b[1] - a[1])[0]?.[0];
}
