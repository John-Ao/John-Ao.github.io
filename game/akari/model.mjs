import { neighbours } from "./util.mjs";
export function geometry(level) {
  const { n, cells } = level,
    white = cells.flatMap((v, i) => (v === -2 ? [i] : [])),
    visible = Array.from({ length: n * n }, () => []),
    segments = [];
  for (const i of white) {
    const r = Math.floor(i / n),
      c = i % n;
    visible[i] = [i];
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      for (
        let rr = r + dr, cc = c + dc;
        rr >= 0 && cc >= 0 && rr < n && cc < n && cells[rr * n + cc] === -2;
        rr += dr, cc += dc
      )
        visible[i].push(rr * n + cc);
  }
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (cells[i] !== -2) continue;
      if (c === 0 || cells[i - 1] !== -2) {
        const row = [];
        for (let cc = c; cc < n && cells[r * n + cc] === -2; cc++)
          row.push(r * n + cc);
        segments.push(row);
      }
      if (r === 0 || cells[i - n] !== -2) {
        const col = [];
        for (let rr = r; rr < n && cells[rr * n + c] === -2; rr++)
          col.push(rr * n + c);
        segments.push(col);
      }
    }
  return { white, visible, segments };
}
export function inspect(level, state) {
  const g = geometry(level),
    lit = g.white.filter((i) => g.visible[i].some((j) => state[j] === 1)),
    conflicts = g.white.filter(
      (i) =>
        state[i] === 1 && g.visible[i].some((j) => j !== i && state[j] === 1),
    ),
    wallCounts = level.cells.map((v, i) =>
      v >= 0 ? neighbours(i, level.n).filter((j) => state[j] === 1).length : 0,
    ),
    badWalls = level.cells.flatMap((v, i) =>
      v >= 0 && wallCounts[i] !== v ? [i] : [],
    );
  return {
    lit,
    conflicts,
    badWalls,
    wallCounts,
    solved:
      lit.length === g.white.length && !conflicts.length && !badWalls.length,
  };
}
export function solve(level, { limit = 2, budget = 200000 } = {}) {
  const g = geometry(level),
    constraints = [
      ...g.segments.map((ids) => ({ ids, min: 0, max: 1 })),
      ...g.white.map((i) => ({
        ids: g.visible[i],
        min: 1,
        max: g.visible[i].length,
      })),
      ...level.cells.flatMap((v, i) =>
        v >= 0
          ? [
              {
                ids: neighbours(i, level.n).filter(
                  (j) => level.cells[j] === -2,
                ),
                min: v,
                max: v,
              },
            ]
          : [],
      ),
    ];
  let count = 0,
    nodes = 0,
    exhausted = false,
    solution = null;
  function visit(input) {
    if (count >= limit || exhausted) return;
    if (++nodes > budget) {
      exhausted = true;
      return;
    }
    const a = input.slice();
    let changed = true;
    while (changed) {
      changed = false;
      for (const { ids, min, max } of constraints) {
        const ones = ids.filter((i) => a[i] === 1).length,
          free = ids.filter((i) => a[i] === -1);
        if (ones > max || ones + free.length < min) return;
        let force = null;
        if (ones === max) force = 0;
        else if (ones + free.length === min) force = 1;
        if (force !== null)
          for (const i of free) {
            a[i] = force;
            changed = true;
          }
      }
    }
    let best = -1,
      score = -1;
    for (const i of g.white)
      if (a[i] === -1) {
        const s = constraints.reduce(
          (sum, c) =>
            sum +
            (c.ids.includes(i)
              ? 1 / c.ids.filter((j) => a[j] === -1).length
              : 0),
          0,
        );
        if (s > score) {
          best = i;
          score = s;
        }
      }
    if (best < 0) {
      if (inspect(level, a).solved) {
        count++;
        solution ??= a.map((v) => +(v === 1));
      }
      return;
    }
    for (const value of [1, 0]) {
      a[best] = value;
      visit(a);
    }
  }
  visit(level.cells.map((v) => (v === -2 ? -1 : 0)));
  return { count, complete: !exhausted, nodes, solution };
}
