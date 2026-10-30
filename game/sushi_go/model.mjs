export const TYPES = {
  tempura: { name: "天妇罗", count: 14, rule: "每2张 5分", symbol: "◇" },
  sashimi: { name: "刺身", count: 14, rule: "每3张 10分", symbol: "▰" },
  dumpling: { name: "饺子", count: 14, rule: "1/3/6/10/15分", symbol: "◒" },
  maki1: { name: "卷物 ①", count: 6, rule: "卷物图标 ×1", symbol: "◉" },
  maki2: { name: "卷物 ②", count: 12, rule: "卷物图标 ×2", symbol: "◉◉" },
  maki3: { name: "卷物 ③", count: 8, rule: "卷物图标 ×3", symbol: "◉◉◉" },
  salmon: { name: "鲑鱼寿司", count: 10, rule: "2分 · 芥末后6分", symbol: "▱" },
  squid: { name: "鱿鱼寿司", count: 5, rule: "3分 · 芥末后9分", symbol: "▱" },
  egg: { name: "鸡蛋寿司", count: 5, rule: "1分 · 芥末后3分", symbol: "▱" },
  pudding: {
    name: "布丁",
    count: 10,
    rule: "终局最多+6 / 最少−6",
    symbol: "▥",
  },
  wasabi: { name: "芥末", count: 6, rule: "下一张寿司 ×3", symbol: "▲" },
  chopsticks: { name: "筷子", count: 4, rule: "后续回合换取2张", symbol: "〃" },
};
export function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function deck() {
  let id = 0;
  return Object.entries(TYPES).flatMap(([type, v]) =>
    Array.from({ length: v.count }, () => ({ type, id: id++ })),
  );
}
export function fresh(n = 3, rng = Math.random) {
  if (![3, 4, 5].includes(n)) throw Error("人数为3至5");
  let s = {
    n,
    round: 1,
    deck: shuffle(deck(), rng),
    discard: [],
    totals: Array(n).fill(0),
    dessert: Array.from({ length: n }, () => []),
    results: [],
    phase: "pick",
  };
  deal(s);
  return s;
}
function deal(s) {
  s.hands = Array.from({ length: s.n }, () => s.deck.splice(-(12 - s.n)));
  s.table = Array.from({ length: s.n }, () => []);
  s.phase = "pick";
  s.turn = 1;
}
export function baseScore(table) {
  const count = (t) => table.filter((c) => c.type === t).length;
  return (
    Math.floor(count("tempura") / 2) * 5 +
    Math.floor(count("sashimi") / 3) * 10 +
    [0, 1, 3, 6, 10, 15][Math.min(5, count("dumpling"))] +
    table.reduce(
      (v, c) =>
        v + ({ egg: 1, salmon: 2, squid: 3 }[c.type] || 0) * (c.mult || 1),
      0,
    )
  );
}
export function makiScores(values) {
  let out = values.map(() => 0),
    max = Math.max(...values);
  if (!max) return out;
  let first = values.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  for (let i of first) out[i] = Math.floor(6 / first.length);
  if (first.length === 1) {
    let next = Math.max(...values.filter((v) => v < max));
    if (next > 0) {
      let second = values
        .map((v, i) => (v === next ? i : -1))
        .filter((i) => i >= 0);
      for (let i of second) out[i] = Math.floor(3 / second.length);
    }
  }
  return out;
}
export function puddingScores(values) {
  const max = Math.max(...values),
    min = Math.min(...values);
  if (max === min) return values.map(() => 0);
  let hi = values.filter((v) => v === max).length,
    lo = values.filter((v) => v === min).length;
  return values.map((v) =>
    v === max ? Math.floor(6 / hi) : v === min ? -Math.floor(6 / lo) : 0,
  );
}
export function addCard(table, card) {
  card = { ...card };
  if (["egg", "salmon", "squid"].includes(card.type)) {
    let wasabi = table.find((c) => c.type === "wasabi" && !c.used);
    if (wasabi) {
      wasabi.used = true;
      card.mult = 3;
    }
  }
  table.push(card);
}
export function validChoice(s, p, indices) {
  return (
    indices.length >= 1 &&
    indices.length <= 2 &&
    new Set(indices).size === indices.length &&
    indices.every((i) => Number.isInteger(i) && s.hands[p][i]) &&
    (indices.length === 1 || s.table[p].some((c) => c.type === "chopsticks"))
  );
}
export function turn(s, choices) {
  if (
    s.phase !== "pick" ||
    choices.length !== s.n ||
    choices.some((c, p) => !validChoice(s, p, c))
  )
    throw Error("请选择1张；已有筷子时可按顺序选择2张");
  let remaining = [];
  for (let p = 0; p < s.n; p++) {
    const selected = choices[p].map((i) => s.hands[p][i]);
    let hand = s.hands[p].filter((_, i) => !choices[p].includes(i));
    if (selected.length === 2) {
      let index = s.table[p].findIndex((c) => c.type === "chopsticks");
      hand.push(s.table[p].splice(index, 1)[0]);
    }
    selected.forEach((c) => addCard(s.table[p], c));
    remaining.push(hand);
  }
  s.hands = remaining.map((_, p) => remaining[(p + s.n - 1) % s.n]);
  s.turn++;
  if (!s.hands[0].length) finishRound(s);
}
function finishRound(s) {
  let base = s.table.map(baseScore),
    maki = makiScores(
      s.table.map((t) =>
        t.reduce(
          (v, c) => v + (c.type.startsWith("maki") ? Number(c.type.at(-1)) : 0),
          0,
        ),
      ),
    );
  for (let p = 0; p < s.n; p++) {
    s.dessert[p].push(...s.table[p].filter((c) => c.type === "pudding"));
    s.totals[p] += base[p] + maki[p];
  }
  const pudding =
    s.round === 3
      ? puddingScores(s.dessert.map((x) => x.length))
      : Array(s.n).fill(0);
  s.totals = s.totals.map((v, p) => v + pudding[p]);
  s.results.push({
    base,
    maki,
    pudding,
    points: base.map((v, p) => v + maki[p] + pudding[p]),
  });
  s.phase = s.round === 3 ? "end" : "round";
}
export function nextRound(s) {
  if (s.phase !== "round") throw Error("尚未结算");
  s.table.forEach((t) =>
    s.discard.push(...t.filter((c) => c.type !== "pudding")),
  );
  s.round++;
  deal(s);
}
export function winners(s) {
  const max = Math.max(...s.totals),
    ids = s.totals.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0),
    p = Math.max(...ids.map((i) => s.dessert[i].length));
  return ids.filter((i) => s.dessert[i].length === p);
}
export function aiChoice(s, p) {
  const t = s.table[p],
    hand = s.hands[p],
    count = (x) => t.filter((c) => c.type === x).length;
  const value = (c) => {
    const x = c.type;
    if (x === "tempura") return count(x) % 2 ? 5 : 2;
    if (x === "sashimi") return count(x) % 3 === 2 ? 10 : 1.5;
    if (x === "dumpling") return count(x) < 5 ? count(x) + 1 : 0;
    if (x.startsWith("maki")) return Number(x.at(-1)) * 1.2;
    if (x === "wasabi") return hand.length > 3 ? 3 : 0;
    if (x === "chopsticks") return hand.length > 4 && !count(x) ? 2 : 0;
    if (x === "pudding") return 2;
    return (
      ({ egg: 1, salmon: 2, squid: 3 }[x] || 0) *
      (t.some((c) => c.type === "wasabi" && !c.used) ? 3 : 1)
    );
  };
  let ranked = hand
    .map((c, i) => ({ i, v: value(c) }))
    .sort((a, b) => b.v - a.v);
  return count("chopsticks") && hand.length > 1
    ? ranked.slice(0, 2).map((x) => x.i)
    : [ranked[0].i];
}
