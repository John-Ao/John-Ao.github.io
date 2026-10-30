export const colors = ["黄沙", "蓝海", "雪山", "绿林", "火山"];
export function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function deck() {
  return colors.flatMap((_, c) =>
    [0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v, i) => ({
      c,
      v,
      id: c * 12 + i,
    })),
  );
}
export function fresh(mode = "ai", rng = Math.random) {
  const s = { mode, round: 1, totals: [0, 0], results: [], player: 0 };
  deal(s, rng);
  return s;
}
function deal(s, rng) {
  s.deck = shuffle(deck(), rng);
  s.hands = [s.deck.splice(-8), s.deck.splice(-8)];
  s.routes = Array.from({ length: 2 }, () =>
    Array.from({ length: 5 }, () => []),
  );
  s.discards = Array.from({ length: 5 }, () => []);
  s.phase = "play";
  s.forbidden = null;
}
export function canPlay(route, card) {
  return !route.length || route.at(-1).v === 0 || card.v > route.at(-1).v;
}
export function play(s, index, discard = false) {
  if (s.phase !== "play" || !s.hands[s.player][index])
    throw Error("请先选择手牌");
  const card = s.hands[s.player][index];
  if (!discard && !canPlay(s.routes[s.player][card.c], card))
    throw Error("数值必须递增；投资只能先于数字");
  s.hands[s.player].splice(index, 1);
  (discard ? s.discards[card.c] : s.routes[s.player][card.c]).push(card);
  s.forbidden = discard ? card.c : null;
  s.phase = "draw";
}
export function routeScore(route) {
  if (!route.length) return 0;
  const wager = route.filter((c) => c.v === 0).length;
  return (
    (route.reduce((n, c) => n + c.v, 0) - 20) * (wager + 1) +
    (route.length >= 8 ? 20 : 0)
  );
}
export function scores(s) {
  return s.routes.map((routes) => routes.map(routeScore));
}
export function draw(s, source = -1) {
  if (s.phase !== "draw" || source === s.forbidden || source < -1 || source > 4)
    throw Error("不能取回刚弃的牌");
  const pile = source === -1 ? s.deck : s.discards[source];
  if (!pile.length) throw Error("此牌堆为空");
  s.hands[s.player].push(pile.pop());
  s.forbidden = null;
  if (!s.deck.length) {
    const columns = scores(s),
      points = columns.map((r) => r.reduce((a, b) => a + b, 0));
    s.results.push({ columns, points });
    s.totals = s.totals.map((n, i) => n + points[i]);
    s.phase = s.round === 3 ? "end" : "round";
  } else {
    s.player = 1 - s.player;
    s.phase = "play";
  }
}
export function nextRound(s, rng = Math.random) {
  if (s.phase !== "round") throw Error("本轮尚未结束");
  s.round++;
  s.player = s.totals[1] > s.totals[0] ? 1 : 0;
  deal(s, rng);
}
export function aiPlay(s) {
  const p = s.player;
  let best = { index: 0, discard: true, value: -Infinity };
  s.hands[p].forEach((card, index) => {
    const route = s.routes[p][card.c],
      same = s.hands[p].filter((c) => c.c === card.c),
      last = route.at(-1)?.v || 0;
    const total =
      same.reduce((a, c) => a + (c.v >= last ? c.v : 0), 0) +
      route.reduce((a, c) => a + c.v, 0);
    let value = card.v === 0 ? (total > 24 ? 8 : -10) : card.v + 1;
    if (!route.length && total < 20) value -= 18;
    if (same.some((c) => c.v < card.v && c.v >= last)) value -= 14;
    if (canPlay(route, card) && value > best.value)
      best = { index, discard: false, value };
    let waste =
      (canPlay(route, card) ? -card.v : -1) +
      (!route.length && total < 20 ? 10 : 0);
    if (waste > best.value) best = { index, discard: true, value: waste };
  });
  return best;
}
export function aiDraw(s) {
  let best = -1,
    value = 0;
  for (let c = 0; c < 5; c++) {
    if (c === s.forbidden || !s.discards[c].length) continue;
    const card = s.discards[c].at(-1),
      route = s.routes[s.player][c];
    if (canPlay(route, card) && route.length && card.v > value) {
      best = c;
      value = card.v;
    }
  }
  return best;
}
