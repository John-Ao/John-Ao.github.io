export function randomSource(seed) {
  let v = seed >>> 0;
  return () => {
    v = (Math.imul(v, 1664525) + 1013904223) >>> 0;
    return v / 4294967296;
  };
}
export function shuffle(items, random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function canonicalRows(rows) {
  const keys = [];
  let a = rows.map((r) => [...r]);
  for (let t = 0; t < 4; t++) {
    keys.push(a.map((r) => r.join("")).join("/"));
    keys.push(a.map((r) => r.slice().reverse().join("")).join("/"));
    a = a[0].map((_, c) => a.map((r) => r[c]).reverse());
  }
  return keys.sort()[0];
}
export function neighbours(i, n) {
  const r = Math.floor(i / n),
    c = i % n;
  return [
    r ? i - n : -1,
    c < n - 1 ? i + 1 : -1,
    r < n - 1 ? i + n : -1,
    c ? i - 1 : -1,
  ].filter((i) => i >= 0);
}
