// Independent exhaustive small-board verification, without calling game solvers.
import test from "node:test";
import assert from "node:assert/strict";
import { levels as bridges } from "./hashi/levels.mjs";
import { levels as lights } from "./akari/levels.mjs";
import { levels as galaxies } from "./galaxies/levels.mjs";

const neighbors = (i, n) =>
  [
    i % n ? i - 1 : -1,
    i % n < n - 1 ? i + 1 : -1,
    i >= n ? i - n : -1,
    i < n * (n - 1) ? i + n : -1,
  ].filter((i) => i >= 0);
function connected(mask, n) {
  const first = 31 - Math.clz32(mask & -mask),
    stack = [first];
  let seen = 0;
  while (stack.length) {
    const i = stack.pop();
    if (seen & (1 << i)) continue;
    seen |= 1 << i;
    for (const j of neighbors(i, n)) if (mask & (1 << j)) stack.push(j);
  }
  return seen === mask;
}

test("all 5x5 Hashi puzzles are unique over every ternary bridge assignment", () => {
  for (const level of bridges.filter((l) => l.n === 5)) {
    const islands = level.islands,
      edges = [];
    for (let a = 0; a < islands.length; a++)
      for (let b = a + 1; b < islands.length; b++) {
        const x = islands[a],
          y = islands[b];
        if (x.r !== y.r && x.c !== y.c) continue;
        if (
          islands.some(
            (z, i) =>
              i !== a &&
              i !== b &&
              ((x.r === y.r &&
                z.r === x.r &&
                z.c > Math.min(x.c, y.c) &&
                z.c < Math.max(x.c, y.c)) ||
                (x.c === y.c &&
                  z.c === x.c &&
                  z.r > Math.min(x.r, y.r) &&
                  z.r < Math.max(x.r, y.r))),
          )
        )
          continue;
        edges.push([a, b]);
      }
    const crosses = [];
    edges.forEach(([a, b], i) =>
      edges.forEach(([c, d], j) => {
        if (i >= j) return;
        let x = islands[a],
          y = islands[b],
          u = islands[c],
          v = islands[d];
        if (x.r !== y.r) [x, y, u, v] = [u, v, x, y];
        if (
          x.r === y.r &&
          u.c === v.c &&
          u.c > Math.min(x.c, y.c) &&
          u.c < Math.max(x.c, y.c) &&
          x.r > Math.min(u.r, v.r) &&
          x.r < Math.max(u.r, v.r)
        )
          crosses.push([i, j]);
      }),
    );
    let count = 0;
    for (let code = 0; code < 3 ** edges.length; code++) {
      let number = code;
      const values = [],
        degrees = Array(islands.length).fill(0);
      edges.forEach(([a, b]) => {
        const value = number % 3;
        number = Math.floor(number / 3);
        values.push(value);
        degrees[a] += value;
        degrees[b] += value;
      });
      if (
        degrees.some((v, i) => v !== islands[i].value) ||
        crosses.some(([i, j]) => values[i] && values[j])
      )
        continue;
      const seen = new Set([0]),
        stack = [0];
      while (stack.length) {
        const i = stack.pop();
        edges.forEach(([a, b], k) => {
          const j = a === i ? b : b === i ? a : -1;
          if (values[k] && j >= 0 && !seen.has(j)) {
            seen.add(j);
            stack.push(j);
          }
        });
      }
      if (seen.size === islands.length) count++;
    }
    assert.equal(count, 1, level.name);
  }
});

test("small Akari puzzles are unique over all lamp subsets", () => {
  let checked = 0;
  for (const level of lights.filter(
    (l) => l.n === 5 && l.cells.filter((v) => v === -2).length <= 18,
  )) {
    const { n, cells } = level,
      white = cells.flatMap((v, i) => (v === -2 ? [i] : [])),
      index = new Map(white.map((v, i) => [v, i]));
    const sight = white.map((i, k) => {
      let mask = 1 << k;
      const r = Math.floor(i / n),
        c = i % n;
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        for (
          let y = r + dr, x = c + dc;
          y >= 0 && x >= 0 && y < n && x < n && cells[y * n + x] === -2;
          y += dr, x += dc
        )
          mask |= 1 << index.get(y * n + x);
      return mask;
    });
    const walls = cells.flatMap((v, i) =>
      v >= 0
        ? [
            {
              value: v,
              around: neighbors(i, n)
                .filter((j) => index.has(j))
                .map((j) => index.get(j)),
            },
          ]
        : [],
    );
    const full = (1 << white.length) - 1;
    let count = 0;
    for (let mask = 0; mask <= full; mask++) {
      if (
        walls.some(
          (w) =>
            w.around.reduce((sum, k) => sum + ((mask >> k) & 1), 0) !== w.value,
        )
      )
        continue;
      let coverage = 0,
        conflict = false;
      for (let i = 0; i < white.length; i++)
        if (mask & (1 << i)) {
          if ((mask & sight[i]) !== 1 << i) {
            conflict = true;
            break;
          }
          coverage |= sight[i];
        }
      if (!conflict && coverage === full) count++;
    }
    assert.equal(count, 1, level.name);
    checked++;
  }
  assert(checked >= 10);
});

test("all 4x4 Galaxies puzzles are unique via exhaustive cell-subset partitions", () => {
  for (const level of galaxies.filter((l) => l.n === 4)) {
    const { n, centers } = level,
      full = (1 << (n * n)) - 1;
    const cores = centers.map((c) => {
      let mask = 0;
      for (const r of [Math.floor(c.r2 / 2), Math.ceil(c.r2 / 2)])
        for (const x of [Math.floor(c.c2 / 2), Math.ceil(c.c2 / 2)])
          mask |= 1 << (r * n + x);
      return mask;
    });
    const candidates = [];
    for (let mask = 1; mask <= full; mask++) {
      const touching = cores.flatMap((core, k) => (mask & core ? [k] : []));
      if (touching.length !== 1) continue;
      const k = touching[0],
        c = centers[k];
      if ((mask & cores[k]) !== cores[k]) continue;
      let symmetric = true;
      for (let i = 0; i < n * n; i++)
        if (mask & (1 << i)) {
          const r = c.r2 - Math.floor(i / n),
            x = c.c2 - (i % n);
          if (
            r < 0 ||
            x < 0 ||
            r >= n ||
            x >= n ||
            !(mask & (1 << (r * n + x)))
          ) {
            symmetric = false;
            break;
          }
        }
      if (symmetric && connected(mask, n)) candidates.push(mask);
    }
    let count = 0;
    function cover(used) {
      if (used === full) {
        count++;
        return;
      }
      const empty = ~used & full,
        bit = empty & -empty;
      for (const region of candidates)
        if (region & bit && !(region & used)) cover(used | region);
    }
    cover(0);
    assert.equal(count, 1, level.name);
  }
});

test("Sokoban solutions replay independently; 6x6 minimum pushes match full-state 0–1 BFS", async () => {
  const { levels } = await import("./sokoban/levels.mjs");
  const deltas = { U: [-1, 0], R: [0, 1], D: [1, 0], L: [0, -1] };
  const key = (s) => s.p + "|" + s.b.join(",");
  for (const level of levels) {
    const { n, walls, goals } = level;
    function step(s, dir) {
      const [dr, dc] = deltas[dir];
      const r = Math.floor(s.p / n) + dr,
        c = (s.p % n) + dc;
      if (r < 0 || c < 0 || r >= n || c >= n || walls[r * n + c]) return null;
      const p = r * n + c,
        b = s.b.slice(),
        k = b.indexOf(p);
      let pushed = 0;
      if (k >= 0) {
        const y = r + dr,
          x = c + dc,
          q = y * n + x;
        if (y < 0 || x < 0 || y >= n || x >= n || walls[q] || b.includes(q))
          return null;
        b[k] = q;
        b.sort((a, b) => a - b);
        pushed = 1;
      }
      return { p, b, d: s.d + pushed };
    }
    const start = {
      p: level.player,
      b: level.boxes.slice().sort((a, b) => a - b),
      d: 0,
    };
    let replay = start;
    for (const dir of level.solution) {
      replay = step(replay, dir);
      assert(replay, `${level.name}: invalid recorded step`);
    }
    assert(
      replay.b.every((i) => goals.includes(i)),
      `${level.name}: unsolved recorded route`,
    );
    assert.equal(replay.d, level.proof.minimumPushes);
    if (n !== 6) continue;
    const distances = new Map([[key(start), 0]]),
      queue = new Map([[0, start]]);
    let head = 0,
      tail = 1,
      best = null;
    while (head < tail) {
      const s = queue.get(head);
      queue.delete(head++);
      if (distances.get(key(s)) !== s.d) continue;
      if (s.b.every((i) => goals.includes(i))) {
        best = s.d;
        break;
      }
      for (const dir of Object.keys(deltas)) {
        const t = step(s, dir);
        if (!t) continue;
        const k = key(t);
        if ((distances.get(k) ?? Infinity) <= t.d) continue;
        distances.set(k, t.d);
        if (t.d === s.d) queue.set(--head, t);
        else queue.set(tail++, t);
      }
    }
    assert.equal(best, level.proof.minimumPushes, level.name);
  }
});
