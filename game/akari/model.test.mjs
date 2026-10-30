import test from "node:test";
import assert from "node:assert/strict";
import { levels } from "./levels.mjs";
import { geometry, inspect, solve } from "./model.mjs";
import { canonicalRows } from "./util.mjs";
import { generate, serialize } from "./generate.mjs";
import { readFileSync } from "node:fs";
test("all 60 puzzles are uniquely solvable and D4-distinct", () => {
  assert.equal(levels.length, 60);
  const seen = new Set();
  for (const l of levels) {
    assert.ok(inspect(l, l.solution).solved);
    const p = solve(l);
    assert.ok(p.complete);
    assert.equal(p.count, 1);
    const key = canonicalRows(
      Array.from({ length: l.n }, (_, r) =>
        l.cells
          .slice(r * l.n, (r + 1) * l.n)
          .map((v) => (v === -2 ? "." : v === -1 ? "#" : String(v))),
      ),
    );
    assert.ok(!seen.has(key));
    seen.add(key);
  }
  for (const n of [5, 6, 7])
    assert.equal(levels.filter((l) => l.n === n).length, 20);
});
test("black cells stop light; facing lamps conflict; marks are not lamps", () => {
  const l = { n: 3, cells: [-2, -1, -2, -1, -1, -1, -1, -1, -1] };
  assert.ok(inspect(l, [1, 0, 1, 0, 0, 0, 0, 0, 0]).solved);
  const open = { n: 2, cells: [-2, -2, -2, -2] };
  assert.ok(inspect(open, [1, 1, 0, 0]).conflicts.length);
  assert.ok(!inspect(open, [2, 0, 0, 2]).solved);
  assert.equal(solve(open).count, 2);
});
test("numbered black cells require exactly orthogonally adjacent lamps", () => {
  const l = { n: 3, cells: [-1, -2, -1, -2, 4, -2, -1, -2, -1] },
    a = [0, 1, 0, 1, 0, 1, 0, 1, 0];
  assert.ok(inspect(l, a).solved);
  a[1] = 0;
  assert.ok(!inspect(l, a).solved);
});
test("budget exhaustion is explicit and offline search is reproducible", () => {
  assert.equal(solve(levels[0], { budget: 0 }).complete, false);
  assert.equal(
    serialize(generate()),
    readFileSync(new URL("./levels.mjs", import.meta.url), "utf8"),
  );
});
