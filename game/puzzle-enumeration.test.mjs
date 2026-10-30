// Independent small-board exhaustive checks; intentionally do not use either game solver.
import test from "node:test";
import assert from "node:assert/strict";
import { levels as nonograms } from "./nonogram/model.mjs";
import { levels as loops } from "./slitherlink/model.mjs";
function runs(a) {
  let r = [],
    n = 0;
  for (let i = 0; i <= a.length; i++) {
    if (a[i]) n++;
    else if (n) {
      r.push(n);
      n = 0;
    }
  }
  return r.join(",") || "0";
}
test("every 5x5 nonogram is unique under independent full row enumeration", () => {
  let checked = 0;
  for (const l of nonograms.filter((l) => l.grid.length === 5)) {
    const rows = l.grid.map(runs),
      cols = Array.from({ length: 5 }, (_, c) => runs(l.grid.map((r) => r[c])));
    const possibilities = rows.map((r) =>
      Array.from({ length: 32 }, (_, m) =>
        Array.from({ length: 5 }, (_, j) => (m >> j) & 1),
      ).filter((a) => runs(a) === r),
    );
    let count = 0;
    function search(board) {
      if (board.length === 5) {
        if (cols.every((c, i) => runs(board.map((r) => r[i])) === c)) count++;
        return;
      }
      for (const row of possibilities[board.length]) search([...board, row]);
    }
    search([]);
    assert.equal(count, 1, l.name);
    checked++;
  }
  console.log(
    "Independent full row-combination enumeration:",
    checked,
    "5x5 nonograms unique",
  );
  assert(checked > 8);
});
test("every 4x4 Slitherlink is unique across all 65536 inside/outside cell masks", () => {
  const allLoops = [];
  for (let mask = 1; mask < 65536; mask++) {
    const bits = Array.from({ length: 16 }, (_, i) => (mask >> i) & 1);
    const adj = Array.from({ length: 25 }, () => []),
      clues = Array(16).fill(0);
    const inside = (r, c) =>
      r >= 0 && r < 4 && c >= 0 && c < 4 ? bits[r * 4 + c] : 0;
    function edge(a, b, cells) {
      adj[a].push(b);
      adj[b].push(a);
      for (const cell of cells) if (cell >= 0) clues[cell]++;
    }
    for (let r = 0; r <= 4; r++)
      for (let c = 0; c < 4; c++)
        if (inside(r - 1, c) !== inside(r, c))
          edge(r * 5 + c, r * 5 + c + 1, [
            r > 0 ? (r - 1) * 4 + c : -1,
            r < 4 ? r * 4 + c : -1,
          ]);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c <= 4; c++)
        if (inside(r, c - 1) !== inside(r, c))
          edge(r * 5 + c, (r + 1) * 5 + c, [
            c > 0 ? r * 4 + c - 1 : -1,
            c < 4 ? r * 4 + c : -1,
          ]);
    if (adj.some((a) => a.length !== 0 && a.length !== 2)) continue;
    const vertices = adj
        .map((a, i) => (a.length ? i : -1))
        .filter((i) => i >= 0),
      seen = new Set(),
      stack = [vertices[0]];
    while (stack.length) {
      let v = stack.pop();
      if (seen.has(v)) continue;
      seen.add(v);
      for (const w of adj[v]) stack.push(w);
    }
    if (seen.size === vertices.length) allLoops.push(clues);
  }
  let checked = 0;
  for (const l of loops.filter((l) => l.n === 4)) {
    const count = allLoops.filter((c) =>
      l.clues.every((v, i) => v === null || v === undefined || v === c[i]),
    ).length;
    assert.equal(count, 1, l.name);
    checked++;
  }
  console.log(
    "Independent enumeration of all 65,536 cell regions:",
    checked,
    "4x4 Slitherlink puzzles unique;",
    allLoops.length,
    "valid simple loops",
  );

  assert(checked > 8);
});
