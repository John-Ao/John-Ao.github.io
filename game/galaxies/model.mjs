import { neighbours } from "./util.mjs";
export function coreCells(center, n) {
  const rows = [Math.floor(center.r2 / 2), Math.ceil(center.r2 / 2)],
    cols = [Math.floor(center.c2 / 2), Math.ceil(center.c2 / 2)];
  return [...new Set(rows.flatMap((r) => cols.map((c) => r * n + c)))];
}
export function mirror(i, center, n) {
  const r = center.r2 - Math.floor(i / n),
    c = center.c2 - (i % n);
  return r >= 0 && c >= 0 && r < n && c < n ? r * n + c : -1;
}
export function edges(n) {
  const out = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const a = r * n + c;
      if (c < n - 1) out.push({ a, b: a + 1, h: false, r, c: c + 1 });
      if (r < n - 1) out.push({ a, b: a + n, h: true, r: r + 1, c });
    }
  return out;
}
export function boundaries(level, labels) {
  return edges(level.n).map((e) => +(labels[e.a] !== labels[e.b]));
}
export function inspect(level, state) {
  const { n, centers } = level,
    es = edges(n),
    adj = Array.from({ length: n * n }, () => []);
  es.forEach((e, i) => {
    if (!state[i]) {
      adj[e.a].push(e.b);
      adj[e.b].push(e.a);
    }
  });
  const labels = Array(n * n).fill(-1),
    regions = [];
  for (let i = 0; i < n * n; i++)
    if (labels[i] < 0) {
      const id = regions.length,
        cells = [],
        stack = [i];
      labels[i] = id;
      while (stack.length) {
        const p = stack.pop();
        cells.push(p);
        for (const q of adj[p])
          if (labels[q] < 0) {
            labels[q] = id;
            stack.push(q);
          }
      }
      regions.push(cells);
    }
  const valid = regions.map((cells) => {
    const set = new Set(cells),
      inside = centers.filter((center) =>
        coreCells(center, n).some((i) => set.has(i)),
      );
    return (
      inside.length === 1 &&
      coreCells(inside[0], n).every((i) => set.has(i)) &&
      cells.every((i) => set.has(mirror(i, inside[0], n)))
    );
  });
  const redundant = es.some((e, i) => state[i] && labels[e.a] === labels[e.b]);
  return { regions, labels, valid, solved: valid.every(Boolean) && !redundant };
}
export function solve(level, { limit = 2, budget = 150000 } = {}) {
  const { n, centers } = level,
    bit = (i) => 1n << BigInt(i),
    full = (1n << BigInt(n * n)) - 1n,
    cores = centers.map((c) => coreCells(c, n)),
    candidates = [];
  let work = 0,
    exhausted = false,
    count = 0,
    nodes = 0,
    solution = null;
  for (let k = 0; k < centers.length; k++) {
    const blocked = new Set(
        cores.flatMap((cells, j) => (j === k ? [] : cells)),
      ),
      core = cores[k];
    if (core.some((i) => blocked.has(i)))
      return { count: 0, complete: true, nodes: 0, regions: 0, solution: null };
    const seed = core.reduce((m, i) => m | bit(i), 0n),
      queue = [seed],
      seen = new Set([seed.toString()]);
    for (let index = 0; index < queue.length; index++) {
      if (++work > budget) {
        exhausted = true;
        break;
      }
      const mask = queue[index];
      candidates.push({ center: k, mask });
      const fringe = new Set();
      for (let i = 0; i < n * n; i++)
        if (mask & bit(i))
          for (const j of neighbours(i, n)) if (!(mask & bit(j))) fringe.add(j);
      for (const i of fringe) {
        const j = mirror(i, centers[k], n);
        if (j < 0 || blocked.has(i) || blocked.has(j)) continue;
        const next = mask | bit(i) | bit(j),
          key = next.toString();
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      }
    }
    if (exhausted) break;
  }
  if (exhausted)
    return {
      count: 0,
      complete: false,
      nodes: 0,
      regions: candidates.length,
      solution: null,
    };
  const covering = Array.from({ length: n * n }, (_, i) =>
    candidates.filter((c) => c.mask & bit(i)),
  );
  function visit(used, chosen) {
    if (count >= limit || exhausted) return;
    if (++work > budget) {
      exhausted = true;
      return;
    }
    nodes++;
    if (used === full) {
      count++;
      solution ??= Array.from(
        { length: n * n },
        (_, i) => chosen.find((c) => c.mask & bit(i)).center,
      );
      return;
    }
    let best = null;
    for (let i = 0; i < n * n; i++)
      if (!(used & bit(i))) {
        const possible = covering[i].filter((c) => !(c.mask & used));
        if (!possible.length) return;
        if (!best || possible.length < best.length) best = possible;
        if (best.length === 1) break;
      }
    for (const c of best) visit(used | c.mask, [...chosen, c]);
  }
  visit(0n, []);
  return {
    count,
    complete: !exhausted,
    nodes,
    regions: candidates.length,
    solution,
  };
}
