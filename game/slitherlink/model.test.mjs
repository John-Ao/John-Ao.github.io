import test from "node:test";
import assert from "node:assert/strict";
import { geometry, levels, validLoop, countSolutions } from "./model.mjs";
test("each curated level has one connected solution and a unique answer", () => {
  for (const l of levels) {
    assert.equal(validLoop(l.solution, l.n, l.clues), true, l.name);
    assert.equal(countSolutions(l.n, l.clues), 1, l.name);
  }
});
test("empty board, broken loop and a branch are rejected", () => {
  const l = levels[0];
  assert.equal(
    validLoop(
      l.solution.map(() => 0),
      l.n,
      l.clues,
    ),
    false,
  );
  const broken = l.solution.slice();
  broken[broken.indexOf(1)] = 0;
  assert.equal(validLoop(broken, l.n, l.clues), false);
  const branch = l.solution.slice();
  branch[branch.indexOf(0)] = 1;
  assert.equal(validLoop(branch, l.n, l.clues), false);
});
test("matching cell numbers do not permit two disconnected loops", () => {
  const n = 3,
    { cells, edges } = geometry(n),
    a = edges.map(
      (e) =>
        +(
          (e.h && (e.r === 0 || e.r === 1) && e.c === 0) ||
          (!e.h && e.r === 0 && (e.c === 0 || e.c === 1)) ||
          (e.h && (e.r === 2 || e.r === 3) && e.c === 2) ||
          (!e.h && e.r === 2 && (e.c === 2 || e.c === 3))
        ),
    );
  const clue = cells.map((ids) => ids.reduce((s, i) => s + a[i], 0));
  assert.equal(validLoop(a, n, clue), false);
});
test("cross marks never count as lines", () => {
  const l = levels[0];
  assert.equal(
    validLoop(
      l.solution.map((v) => v || 2),
      l.n,
      l.clues,
    ),
    true,
  );
});

import { createHash } from "node:crypto";
import { enumerateSolutions } from "./model.mjs";
import { canonicalLoop } from "./generation.mjs";

test("original eight levels retain exact indices, names, solutions and clues", () => {
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(levels.slice(0, 8)))
      .digest("hex"),
    "2b47bee50c7b999134a0dacb8ff59ca767d08c664a763432f4ab8b4dda37021d",
  );
});

test("104 levels cover all sizes and generated clues contain useful blanks", () => {
  assert.equal(levels.length, 104);
  for (const n of [4, 5, 6])
    assert.equal(levels.slice(8).filter((l) => l.n === n).length, 32);
  for (const l of levels.slice(8)) {
    assert.equal(l.clues.length, l.n * l.n);
    assert(
      l.clues.filter((v) => v == null).length >= Math.ceil(l.n * l.n * 0.2),
    );
    assert(l.clues.some((v) => v != null));
    assert(
      l.clues.every(
        (v) => v == null || (Number.isInteger(v) && v >= 0 && v <= 3),
      ),
    );
    const proof = enumerateSolutions(l.n, l.clues, { budget: 12000 });
    assert.equal(proof.exhausted, false, l.name);
    assert.equal(proof.count, 1, l.name);
  }
});

test("no new loop duplicates any level under rotation or reflection", () => {
  const signatures = levels.map((l) => canonicalLoop(l.n, l.solution));
  assert.equal(new Set(signatures).size, levels.length);
});

test("budget exhaustion cannot certify uniqueness", () => {
  const result = enumerateSolutions(4, Array(16).fill(null), { budget: 0 });
  assert.equal(result.exhausted, true);
  assert.equal(result.count, 0);
  const partial = enumerateSolutions(2, Array(4).fill(null), { budget: 6 });
  assert.equal(partial.count, 1);
  assert.equal(
    partial.exhausted,
    true,
    "one solution before exhaustion is not unique",
  );
  const multiple = enumerateSolutions(2, Array(4).fill(null));
  assert.equal(multiple.exhausted, false);
  assert.equal(multiple.count, 2);
});
