export function geometry(level) {
  const { islands } = level,
    edges = [];
  for (let a = 0; a < islands.length; a++) {
    for (let b = a + 1; b < islands.length; b++) {
      const x = islands[a],
        y = islands[b];
      if (x.r !== y.r && x.c !== y.c) continue;
      const between = islands.some(
        (p, i) =>
          i !== a &&
          i !== b &&
          ((x.r === y.r &&
            p.r === x.r &&
            p.c > Math.min(x.c, y.c) &&
            p.c < Math.max(x.c, y.c)) ||
            (x.c === y.c &&
              p.c === x.c &&
              p.r > Math.min(x.r, y.r) &&
              p.r < Math.max(x.r, y.r))),
      );
      if (!between) edges.push({ a, b, h: x.r === y.r });
    }
  }
  const crossing = edges.map(() => []);
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i],
        f = edges[j];
      if (e.h === f.h) continue;
      const h = e.h ? e : f,
        v = e.h ? f : e,
        ha = islands[h.a],
        hb = islands[h.b],
        va = islands[v.a],
        vb = islands[v.b];
      if (
        va.c > Math.min(ha.c, hb.c) &&
        va.c < Math.max(ha.c, hb.c) &&
        ha.r > Math.min(va.r, vb.r) &&
        ha.r < Math.max(va.r, vb.r)
      ) {
        crossing[i].push(j);
        crossing[j].push(i);
      }
    }
  const incident = islands.map((_, v) =>
    edges.flatMap((e, i) => (e.a === v || e.b === v ? [i] : [])),
  );
  return { edges, crossing, incident };
}
export function inspect(level, state) {
  const g = geometry(level),
    degrees = g.incident.map((ids) =>
      ids.reduce((sum, i) => sum + state[i], 0),
    ),
    seen = new Set([0]),
    stack = [0];
  while (stack.length) {
    const v = stack.pop();
    for (const i of g.incident[v])
      if (state[i] > 0) {
        const e = g.edges[i],
          u = e.a === v ? e.b : e.a;
        if (!seen.has(u)) {
          seen.add(u);
          stack.push(u);
        }
      }
  }
  const crossed = g.crossing.some(
    (ids, i) => state[i] > 0 && ids.some((j) => state[j] > 0),
  );
  return {
    degrees,
    crossed,
    connected: seen.size === level.islands.length,
    solved:
      !crossed &&
      seen.size === level.islands.length &&
      degrees.every((n, i) => n === level.islands[i].value),
  };
}
export function solve(level, { limit = 2, budget = 100000 } = {}) {
  const g = geometry(level);
  let nodes = 0,
    count = 0,
    exhausted = false,
    solution = null;
  function visit(input) {
    if (count >= limit || exhausted) return;
    if (++nodes > budget) {
      exhausted = true;
      return;
    }
    const a = input.map((x) => x.slice());
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < a.length; i++) {
        if (!a[i].length) return;
        if (a[i].every((v) => v > 0))
          for (const j of g.crossing[i]) {
            const filtered = a[j].filter((v) => v === 0);
            if (!filtered.length) return;
            if (filtered.length !== a[j].length) {
              a[j] = filtered;
              changed = true;
            }
          }
      }
      for (let v = 0; v < g.incident.length; v++) {
        const ids = g.incident[v],
          target = level.islands[v].value,
          min = ids.reduce((s, i) => s + Math.min(...a[i]), 0),
          max = ids.reduce((s, i) => s + Math.max(...a[i]), 0);
        if (min > target || max < target) return;
        for (const i of ids) {
          const restMin = min - Math.min(...a[i]),
            restMax = max - Math.max(...a[i]),
            opts = a[i].filter(
              (x) => x + restMin <= target && x + restMax >= target,
            );
          if (!opts.length) return;
          if (opts.length !== a[i].length) {
            a[i] = opts;
            changed = true;
          }
        }
      }
    }
    const seen = new Set([0]),
      stack = [0];
    while (stack.length) {
      const v = stack.pop();
      for (const i of g.incident[v])
        if (a[i].some((x) => x > 0)) {
          const e = g.edges[i],
            u = e.a === v ? e.b : e.a;
          if (!seen.has(u)) {
            seen.add(u);
            stack.push(u);
          }
        }
    }
    if (seen.size !== level.islands.length) return;
    let best = -1;
    for (let i = 0; i < a.length; i++)
      if (a[i].length > 1 && (best < 0 || a[i].length < a[best].length))
        best = i;
    if (best < 0) {
      const values = a.map((x) => x[0]);
      if (inspect(level, values).solved) {
        count++;
        solution ??= values;
      }
      return;
    }
    for (const value of a[best]) {
      const next = a.map((x) => x.slice());
      next[best] = [value];
      visit(next);
    }
  }
  visit(g.edges.map(() => [0, 1, 2]));
  return { count, complete: !exhausted, nodes, solution };
}
