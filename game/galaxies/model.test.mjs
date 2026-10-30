import test from "node:test";
import assert from "node:assert/strict";
import { levels } from "./levels.mjs";
import { edges, inspect, solve, boundaries, coreCells } from "./model.mjs";
import { generate, serialize, canonical } from "./generate.mjs";
import { readFileSync } from "node:fs";
test("60 unique puzzles include nonrectangular regions and all center types", () => {
  assert.equal(levels.length, 60);
  const seen = new Set(),
    types = new Set();
  for (const l of levels) {
    assert.ok(inspect(l, l.solution).solved);
    const p = solve(l);
    assert.ok(p.complete);
    assert.equal(p.count, 1);
    const key = canonical(l);
    assert.ok(!seen.has(key));
    seen.add(key);
    l.centers.forEach((c) => types.add((c.r2 % 2) + (c.c2 % 2)));
    const regions = inspect(l, l.solution).regions;
    assert.ok(
      regions.some((cells) => {
        const rs = cells.map((i) => Math.floor(i / l.n)),
          cs = cells.map((i) => i % l.n);
        return (
          (Math.max(...rs) - Math.min(...rs) + 1) *
            (Math.max(...cs) - Math.min(...cs) + 1) !==
          cells.length
        );
      }),
    );
  }
  assert.deepEqual([...types].sort(), [0, 1, 2]);
  for (const n of [4, 5, 6])
    assert.equal(levels.filter((l) => l.n === n).length, 20);
});
test("edge and intersection centers require all touching cells together", () => {
  assert.deepEqual(coreCells({ r2: 0, c2: 1 }, 2), [0, 1]);
  assert.equal(coreCells({ r2: 1, c2: 1 }, 2).length, 4);
  const l = { n: 2, centers: [{ r2: 1, c2: 1 }] };
  assert.ok(
    inspect(
      l,
      edges(2).map(() => 0),
    ).solved,
  );
  assert.ok(
    !inspect(
      l,
      edges(2).map(() => 1),
    ).solved,
  );
  assert.equal(solve(l).count, 1);
});
test("redundant interior boundaries cannot win", () => {
  const l = { n: 2, centers: [{ r2: 1, c2: 1 }] },
    a = edges(2).map(() => 0);
  a[0] = 1;
  assert.ok(!inspect(l, a).solved);
});
test("exhaustion is explicit and generated dataset is deterministic", () => {
  assert.equal(solve(levels[0], { budget: 0 }).complete, false);
  assert.equal(
    serialize(generate()),
    readFileSync(new URL("./levels.mjs", import.meta.url), "utf8"),
  );
});
