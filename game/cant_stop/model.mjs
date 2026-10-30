export const heights = [3, 5, 7, 9, 11, 13, 11, 9, 7, 5, 3];
export const fresh = () => ({
  player: 0,
  pos: [Array(11).fill(0), Array(11).fill(0)],
  claimed: Array(11).fill(-1),
  temp: {},
  dice: [],
  phase: "roll",
  winner: null,
  message: "掷出四颗骰子开始。",
});
export function options(s) {
  const d = s.dice,
    out = [];
  for (const pairs of [
    [
      [0, 1],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 3],
    ],
    [
      [0, 3],
      [1, 2],
    ],
  ]) {
    const sums = pairs.map(([a, b]) => d[a] + d[b]);
    for (const seq of [sums, [...sums].reverse()]) {
      const t = { ...s.temp },
        moves = [];
      for (const n of seq) {
        let i = n - 2;
        if (s.claimed[i] !== -1) continue;
        if (t[i] === undefined && Object.keys(t).length === 3) continue;
        let p = t[i] ?? s.pos[s.player][i];
        if (p >= heights[i]) continue;
        t[i] = p + 1;
        moves.push(n);
      }
      if (
        moves.length &&
        !out.some((x) => JSON.stringify(x.temp) === JSON.stringify(t))
      )
        out.push({ sums, moves, temp: t });
    }
  }
  return out;
}
export function roll(s, dice) {
  s.dice = dice;
  s.phase = "choose";
  if (!options(s).length) {
    s.temp = {};
    s.player = 1 - s.player;
    s.phase = "roll";
    s.message = "爆掉了！本回合临时进度丢失，交给下一位。";
  } else s.message = "选择一组配对；可走的点数必须使用。";
  return s;
}
export function stop(s) {
  for (const [k, v] of Object.entries(s.temp)) {
    s.pos[s.player][k] = v;
    if (v === heights[k]) s.claimed[k] = s.player;
  }
  if (s.claimed.filter((x) => x === s.player).length >= 3) {
    s.winner = s.player;
    s.phase = "end";
    s.message = "率先占领三列，获胜！";
  } else {
    s.player = 1 - s.player;
    s.phase = "roll";
    s.message = "进度已保存，下一位掷骰。";
  }
  s.temp = {};
  s.dice = [];
  return s;
}
