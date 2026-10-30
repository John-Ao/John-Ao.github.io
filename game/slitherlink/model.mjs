import { generatedLevels } from "./generated-levels.mjs";
export function geometry(n) {
  const edges = [];
  for (let r = 0; r <= n; r++)
    for (let c = 0; c < n; c++)
      edges.push({ r, c, h: true, a: r * (n + 1) + c, b: r * (n + 1) + c + 1 });
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= n; c++)
      edges.push({
        r,
        c,
        h: false,
        a: r * (n + 1) + c,
        b: (r + 1) * (n + 1) + c,
      });
  const cells = Array.from({ length: n * n }, (_, i) => {
    const r = Math.floor(i / n),
      c = i % n;
    return [
      r * n + c,
      (r + 1) * n + c,
      n * (n + 1) + r * (n + 1) + c,
      n * (n + 1) + r * (n + 1) + c + 1,
    ];
  });
  const vertices = Array.from({ length: (n + 1) ** 2 }, (_, v) =>
    edges.flatMap((e, i) => (e.a === v || e.b === v ? [i] : [])),
  );
  return { edges, cells, vertices };
}
export function validLoop(values, n, clues) {
  const { edges, cells, vertices } = geometry(n),
    selected = values.flatMap((v, i) => (v === 1 ? [i] : []));
  if (
    !selected.length ||
    cells.some(
      (ids, i) =>
        clues[i] != null &&
        ids.filter((j) => values[j] === 1).length !== clues[i],
    ) ||
    vertices.some(
      (ids) => ![0, 2].includes(ids.filter((j) => values[j] === 1).length),
    )
  )
    return false;
  const seen = new Set(),
    stack = [selected[0]];
  while (stack.length) {
    const i = stack.pop();
    if (seen.has(i)) continue;
    seen.add(i);
    for (const v of [edges[i].a, edges[i].b])
      for (const j of vertices[v])
        if (values[j] === 1 && !seen.has(j)) stack.push(j);
  }
  return seen.size === selected.length;
}
// Enumerate complete edge assignments. Exhaustion is distinct from uniqueness:
// callers must require !exhausted && count === 1 before accepting a puzzle.
export function enumerateSolutions(
  n,
  clues,
  { limit = 2, budget = Infinity } = {},
) {
  const { edges, cells, vertices } = geometry(n);
  const constraints = [
    ...cells.flatMap((ids, i) =>
      clues[i] == null ? [] : [{ ids, target: clues[i] }],
    ),
    ...vertices.map((ids) => ({ ids, target: -2 })),
  ];
  const priorities = Array(edges.length).fill(0);
  for (const { ids, target } of constraints)
    for (const i of ids) priorities[i] += target === -2 ? 1 : 4;
  let count = 0,
    nodes = 0,
    exhausted = false;
  function search(input) {
    if (count >= limit || exhausted) return;
    if (nodes >= budget) {
      exhausted = true;
      return;
    }
    nodes++;
    const a = input.slice();
    let changed = true;
    while (changed) {
      changed = false;
      for (const { ids, target } of constraints) {
        let ones = 0;
        const free = [];
        for (const i of ids) {
          if (a[i] === 1) ones++;
          else if (a[i] === -1) free.push(i);
        }
        let force = null;
        if (target === -2) {
          if (ones > 2 || (ones === 1 && !free.length)) return;
          if (ones === 2 || (ones === 0 && free.length === 1)) force = 0;
          else if (ones === 1 && free.length === 1) force = 1;
        } else {
          if (ones > target || ones + free.length < target) return;
          if (ones === target) force = 0;
          else if (ones + free.length === target) force = 1;
        }
        if (force !== null)
          for (const i of free) {
            a[i] = force;
            changed = true;
          }
      }
    }
    // Once selected edges contain a closed component, no other edge can belong
    // to the answer. This rejects multiple loops early and settles remaining 0s.
    const seen = new Set();
    let selected = 0,
      closedSize = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === 1) selected++;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== 1 || seen.has(i)) continue;
      const stack = [i];
      let closed = true,
        size = 0;
      while (stack.length) {
        const j = stack.pop();
        if (seen.has(j)) continue;
        seen.add(j);
        size++;
        for (const v of [edges[j].a, edges[j].b]) {
          let degree = 0;
          for (const k of vertices[v])
            if (a[k] === 1) {
              degree++;
              if (!seen.has(k)) stack.push(k);
            }
          if (degree !== 2) closed = false;
        }
      }
      if (closed) closedSize = size;
    }
    if (closedSize) {
      if (closedSize !== selected) return;
      if (
        cells.every(
          (ids, i) =>
            clues[i] == null ||
            ids.reduce((sum, j) => sum + (a[j] === 1), 0) === clues[i],
        )
      )
        count++;
      return;
    }
    let choice = -1,
      best = -1;
    for (let i = 0; i < a.length; i++)
      if (a[i] === -1 && priorities[i] > best) {
        best = priorities[i];
        choice = i;
      }
    if (choice < 0) return;
    for (const v of [0, 1]) {
      a[choice] = v;
      search(a);
    }
  }
  search(Array(edges.length).fill(-1));
  return { count, exhausted, nodes };
}
export function countSolutions(n, clues, limit = 2) {
  return enumerateSolutions(n, clues, { limit }).count;
}
const shapes = [
  ["海湾", ["1111", "1000", "1110", "0110"]],
  ["阶台", ["110000", "111000", "111100", "011110", "001110", "000000"]],
  ["曲折", ["111100", "000100", "011100", "010000", "011110", "001100"]],
  ["山谷", ["100001", "110011", "111111", "011110", "001100", "000000"]],
  ["转角", ["1100", "1110", "0110", "0000"]],
  ["阶梯", ["11000", "11100", "01110", "00110", "00000"]],
  ["弯道", ["11110", "10000", "10000", "11110", "00000"]],
  ["半岛", ["01110", "11110", "01100", "01110", "00110"]],
];
const legacyLevels = shapes.map(([name, rows]) => {
  const n = rows.length,
    { edges, cells } = geometry(n);
  const inside = (r, c) =>
    r >= 0 && c >= 0 && r < n && c < n && rows[r][c] === "1";
  const solution = edges.map(
    (e) =>
      +(e.h
        ? inside(e.r - 1, e.c) !== inside(e.r, e.c)
        : inside(e.r, e.c - 1) !== inside(e.r, e.c)),
  );
  return {
    name,
    n,
    solution,
    clues: cells.map((ids) => ids.reduce((s, i) => s + solution[i], 0)),
  };
});

export const levels = [...legacyLevels, ...generatedLevels];
