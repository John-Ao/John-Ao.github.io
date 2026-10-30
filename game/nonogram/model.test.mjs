import test from "node:test";
import assert from "node:assert/strict";
import { runs, clues, solved, levels, countSolutions } from "./model.mjs";
test("run clues retain order, gaps, and empty rows", () => {
  assert.deepEqual(runs([1, 1, 0, 1, 0, 1, 1, 1]), [2, 1, 3]);
  assert.deepEqual(runs([0, 0]), [0]);
  assert.deepEqual(
    clues([
      [1, 0],
      [1, 1],
    ]),
    { rows: [[1], [2]], cols: [[2], [1]] },
  );
});
test("all curated puzzles have exactly one solution", () => {
  for (const l of levels) assert.equal(countSolutions(l.grid), 1, l.name);
});
test("winning depends on filled cells; crosses are optional", () => {
  const g = levels[0].grid;
  assert.equal(solved(g, g), true);
  assert.equal(
    solved(
      g.map((r) => r.map((v) => v || 2)),
      g,
    ),
    true,
  );
  const wrong = g.map((r) => r.slice());
  wrong[0][0] = 1;
  assert.equal(solved(wrong, g), false);
  assert.equal(
    solved(
      g.map((r) => r.map(() => 0)),
      g,
    ),
    false,
  );
});
test("solution counter detects ambiguous puzzles", () => {
  assert.equal(
    countSolutions([
      [1, 0],
      [0, 1],
    ]),
    2,
  );
});

test("128 levels cover three sizes without dihedral duplicates", async () => {
  const { canonicalGrid, analyzeSolutions } = await import("./core.mjs");
  assert.equal(levels.length, 128);
  const keys = levels.map((level) => canonicalGrid(level.grid));
  assert.equal(new Set(keys).size, keys.length);
  for (const size of [5, 7, 10])
    assert.equal(
      levels.slice(8).filter((level) => level.grid.length === size).length,
      40,
    );
  for (const level of levels.slice(8)) {
    const size = level.grid.length,
      filled = level.grid.flat().reduce((sum, v) => sum + v, 0);
    assert.ok(filled >= size * size * 0.32 && filled <= size * size * 0.7);
    const hints = clues(level.grid);
    assert.ok(
      [...hints.rows, ...hints.cols].every(
        (line) => line[0] !== 0 && line[0] !== size,
      ),
    );
    const proof = analyzeSolutions(level.grid);
    assert.deepEqual(level.proof, {
      branches: proof.branches,
      passes: proof.passes,
    });
  }
});
test("original eight levels retain byte-for-byte names, grids and ordering", async () => {
  const { createHash } = await import("node:crypto");
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(levels.slice(0, 8)))
      .digest("hex"),
    "1afabb8c9ef757124a10f646ce8d9aaa0257fa331b2123167ca3b73c5dfa0414",
  );
});
test("generation is reproducible from its fixed seed", async () => {
  const { generateLevels, serializeGenerated } = await import("./generate.mjs");
  const { readFileSync } = await import("node:fs");
  assert.equal(
    serializeGenerated(generateLevels()),
    readFileSync(new URL("./levels.generated.mjs", import.meta.url), "utf8"),
  );
});
test("constraint solver matches exhaustive enumeration for every 3×3 clue set", () => {
  // Independent whole-board enumeration: no propagation or candidate search.
  const counts = new Map(),
    grids = [];
  for (let mask = 0; mask < 512; mask++) {
    const grid = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => (mask >> (r * 3 + c)) & 1),
    );
    const key = JSON.stringify(clues(grid));
    grids.push([grid, key]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [grid, key] of grids)
    assert.equal(countSolutions(grid, 512), counts.get(key));
});
