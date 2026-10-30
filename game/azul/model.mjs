export const colors = ["蓝", "黄", "红", "黑", "白"],
  symbols = ["◆", "✳", "●", "✦", "✿"],
  penalties = [1, 1, 2, 2, 2, 3, 3];
export function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const wallColor = (r, c) => (c - r + 5) % 5;
export function player() {
  return {
    score: 0,
    wall: Array.from({ length: 5 }, () => Array(5).fill(false)),
    lines: Array.from({ length: 5 }, () => []),
    floor: [],
  };
}
export function fresh(mode = "ai", rng = Math.random) {
  let s = {
    mode,
    round: 0,
    players: [player(), player()],
    bag: shuffle(
      Array.from({ length: 100 }, (_, i) => i % 5),
      rng,
    ),
    discard: [],
    starter: 0,
    player: 0,
    history: [],
    phase: "round",
  };
  nextRound(s, rng);
  return s;
}
export function nextRound(s, rng = Math.random) {
  if (s.phase !== "round") throw Error("本轮尚未结束");
  s.round++;
  s.factories = Array.from({ length: 5 }, () => []);
  for (let f of s.factories)
    for (let i = 0; i < 4; i++) {
      if (!s.bag.length) {
        s.bag = shuffle(s.discard.splice(0), rng);
      }
      if (s.bag.length) f.push(s.bag.pop());
    }
  s.center = [];
  s.marker = true;
  s.player = s.starter;
  s.phase = "take";
}
export function canPlace(p, row, color) {
  return (
    row === -1 ||
    (row >= 0 &&
      row < 5 &&
      p.lines[row].length < row + 1 &&
      (!p.lines[row].length || p.lines[row][0] === color) &&
      !p.wall[row][(color + row) % 5])
  );
}
export function moves(s) {
  if (s.phase !== "take") return [];
  let out = [];
  [...s.factories, s.center].forEach((f, source) => {
    for (let color of new Set(f))
      for (let row = -1; row < 5; row++)
        if (canPlace(s.players[s.player], row, color))
          out.push({ source, color, row });
  });
  return out;
}
function floor(s, p, tile) {
  if (p.floor.length < 7) p.floor.push(tile);
  else if (tile >= 0) s.discard.push(tile);
}
export function place(s, { source, color, row }) {
  if (
    s.phase !== "take" ||
    !Number.isInteger(source) ||
    source < 0 ||
    source > 5 ||
    !canPlace(s.players[s.player], row, color)
  )
    throw Error("选择同色瓷砖和可用图案行");
  const pile = source === 5 ? s.center : s.factories[source],
    picked = pile.filter((x) => x === color);
  if (!picked.length) throw Error("此处没有该色瓷砖");
  let rest = pile.filter((x) => x !== color);
  const p = s.players[s.player];
  if (source === 5) {
    s.center = rest;
    if (s.marker) {
      s.marker = false;
      s.starter = s.player;
      floor(s, p, -1);
    }
  } else {
    s.center.push(...rest);
    s.factories[source] = [];
  }
  for (const tile of picked) {
    if (row >= 0 && p.lines[row].length < row + 1) p.lines[row].push(tile);
    else floor(s, p, tile);
  }
  s.player = 1 - s.player;
  if (!s.factories.some((f) => f.length) && !s.center.length) finishRound(s);
}
export function tileScore(wall, r, c) {
  let horizontal = 1,
    vertical = 1;
  for (const d of [-1, 1]) {
    for (let x = c + d; x >= 0 && x < 5 && wall[r][x]; x += d) horizontal++;
    for (let y = r + d; y >= 0 && y < 5 && wall[y][c]; y += d) vertical++;
  }
  return horizontal === 1 && vertical === 1
    ? 1
    : (horizontal > 1 ? horizontal : 0) + (vertical > 1 ? vertical : 0);
}
export function bonuses(p) {
  const rows = p.wall.filter((r) => r.every(Boolean)).length;
  const columns = Array.from({ length: 5 }, (_, c) =>
    p.wall.every((r) => r[c]),
  ).filter(Boolean).length;
  const sets = Array.from({ length: 5 }, (_, color) =>
    p.wall.every((r, y) => r[(color + y) % 5]),
  ).filter(Boolean).length;
  return { rows, columns, sets, total: rows * 2 + columns * 7 + sets * 10 };
}
export function finishRound(s) {
  const results = [];
  for (let p of s.players) {
    let gained = 0;
    for (let r = 0; r < 5; r++)
      if (p.lines[r].length === r + 1) {
        const color = p.lines[r][0],
          c = (color + r) % 5;
        p.wall[r][c] = true;
        gained += tileScore(p.wall, r, c);
        s.discard.push(...p.lines[r].slice(1));
        p.lines[r] = [];
      }
    const loss = p.floor.reduce((n, _, i) => n + penalties[i], 0);
    s.discard.push(...p.floor.filter((x) => x >= 0));
    p.floor = [];
    p.score = Math.max(0, p.score + gained - loss);
    results.push({ gained, loss });
  }
  s.phase = s.players.some((p) => p.wall.some((r) => r.every(Boolean)))
    ? "end"
    : "round";
  if (s.phase === "end")
    s.players.forEach((p, i) => {
      results[i].bonus = bonuses(p);
      p.score += results[i].bonus.total;
    });
  s.history.push(results);
}
export function winners(s) {
  let best = Math.max(...s.players.map((p) => p.score)),
    ids = [0, 1].filter((i) => s.players[i].score === best),
    rows = Math.max(...ids.map((i) => bonuses(s.players[i]).rows));
  return ids.filter((i) => bonuses(s.players[i]).rows === rows);
}
export function aiMove(s) {
  let best = null,
    value = -Infinity;
  const p = s.players[s.player];
  for (let m of moves(s)) {
    const n = (m.source === 5 ? s.center : s.factories[m.source]).filter(
        (x) => x === m.color,
      ).length,
      space = m.row < 0 ? 0 : m.row + 1 - p.lines[m.row].length,
      take = Math.min(n, space);
    let v = take * 2 - (n - take) * 3;
    if (m.row >= 0 && take === space) {
      const c = (m.color + m.row) % 5;
      v += tileScore(p.wall, m.row, c) * 2 + 4;
      if (p.wall[m.row].filter(Boolean).length === 4) v += 8;
    }
    if (m.source === 5 && s.marker) v -= 1;
    if (v > value) {
      best = m;
      value = v;
    }
  }
  return best;
}
