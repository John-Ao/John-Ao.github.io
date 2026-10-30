import test from "node:test";
import assert from "node:assert/strict";
import { levels } from "./levels.mjs";
import { geometry, inspect, solve } from "./model.mjs";
import { canonicalRows } from "./util.mjs";
import { generate, serialize } from "./generate.mjs";
import { readFileSync } from "node:fs";
test("60 unique, non-crossing, connected, strictly unique puzzles", () => {
  assert.equal(levels.length, 60);
  const seen = new Set();
  for (const l of levels) {
    const g = geometry(l);
    assert.equal(l.solution.length, g.edges.length);
    assert.ok(inspect(l, l.solution).solved);
    assert.ok(l.solution.includes(2));
    const proof = solve(l);
    assert.ok(proof.complete);
    assert.equal(proof.count, 1);
    const rows = Array.from({ length: l.n }, () => Array(l.n).fill("."));
    l.islands.forEach((p) => (rows[p.r][p.c] = p.value));
    const key = canonicalRows(rows);
    assert.ok(!seen.has(key));
    seen.add(key);
  }
  for (const n of [5, 7, 9])
    assert.equal(levels.filter((l) => l.n === n).length, 20);
});
test("crossings and disconnected islands cannot win", () => {
  const l = {
    n: 5,
    islands: [
      { r: 0, c: 2, value: 1 },
      { r: 2, c: 0, value: 1 },
      { r: 2, c: 4, value: 1 },
      { r: 4, c: 2, value: 1 },
    ],
  };
  assert.ok(inspect(l, [1, 1]).crossed);
  assert.ok(!inspect(l, [1, 1]).solved);
  const d = {
    n: 3,
    islands: [
      { r: 0, c: 0, value: 1 },
      { r: 0, c: 2, value: 1 },
      { r: 2, c: 0, value: 1 },
      { r: 2, c: 2, value: 1 },
    ],
  };
  assert.equal(solve(d).count, 0);
});
test("budget exhaustion is not proof of uniqueness", () => {
  const result = solve(levels[0], { budget: 0 });
  assert.equal(result.complete, false);
  assert.equal(result.count, 0);
});
test("offline generation exactly reproduces committed data", () =>
  assert.equal(
    serialize(generate()),
    readFileSync(new URL("./levels.mjs", import.meta.url), "utf8"),
  ));
