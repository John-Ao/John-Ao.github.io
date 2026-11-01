import test from "node:test";
import assert from "node:assert/strict";
import { move } from "./model.mjs";
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
