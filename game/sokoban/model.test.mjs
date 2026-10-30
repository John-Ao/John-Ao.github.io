import test from "node:test";
import assert from "node:assert/strict";
import { levels } from "./levels.mjs";
import { move, pull, solved, solve } from "./model.mjs";
import { canonicalRows } from "./util.mjs";
import { generate, serialize, canonical } from "./generate.mjs";
import { readFileSync } from "node:fs";
test("60 varied double/triple-box puzzles have independently verified minimum pushes", () => {
  assert.equal(levels.length, 60);
  const seen = new Set(),
    walls = new Set(),
    counts = new Set();
  for (const l of levels) {
    const key = canonical(l);
    assert.ok(!seen.has(key));
    seen.add(key);
    walls.add(
      canonicalRows(
        Array.from({ length: l.n }, (_, r) =>
          l.walls.slice(r * l.n, (r + 1) * l.n),
        ),
      ),
    );
    counts.add(l.boxes.length);
    let state = {
      player: l.player,
      boxes: l.boxes.slice(),
      moves: 0,
      pushes: 0,
    };
    for (const dir of l.solution) {
      state = move(l, state, dir);
      assert.ok(state);
    }
    assert.ok(solved(l, state));
    assert.equal(state.pushes, l.proof.minimumPushes);
    const p = solve(l);
    assert.ok(p.complete && p.solvable);
    assert.equal(p.minimumPushes, l.proof.minimumPushes);
  }
  assert.equal(walls.size, 60);
  assert.deepEqual([...counts].sort(), [2, 3]);
});
test("reverse construction replays exactly from solved goals", () => {
  for (const l of levels) {
    let state = { player: l.construction.goalPlayer, boxes: l.goals.slice() };
    for (const action of l.construction.reverse) {
      for (const dir of action.walk) {
        const next = move(l, state, dir);
        assert.ok(next);
        assert.deepEqual(next.boxes, state.boxes);
        state = next;
      }
      state = pull(l, state, action.pull);
      assert.ok(state);
    }
    assert.equal(state.player, l.player);
    assert.deepEqual(state.boxes, l.boxes);
  }
});
test("walls and double-box pushes are blocked, no wraparound", () => {
  const l = {
    n: 4,
    walls: [1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1],
    goals: [9, 10],
  };
  assert.equal(move(l, { player: 5, boxes: [6, 10] }, "U"), null);
  assert.equal(move(l, { player: 5, boxes: [6, 10] }, "R"), null);
  assert.equal(move(l, { player: 5, boxes: [9, 10] }, "L"), null);
});
test("two adjacent boxes cannot be pushed together", () => {
  const level = { n: 5, walls: Array(25).fill(0), goals: [13, 14] };
  assert.equal(move(level, { player: 11, boxes: [12, 13] }, "R"), null);
});
test("budget exhaustion is explicit and generation is deterministic", () => {
  assert.equal(solve(levels[0], { budget: 0 }).complete, false);
  assert.equal(
    serialize(generate()),
    readFileSync(new URL("./levels.mjs", import.meta.url), "utf8"),
  );
});
