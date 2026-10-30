import test from "node:test";
import assert from "node:assert/strict";
import { initial, rays, move, computer } from "./model.mjs";
test("standard positions and blocked rays", () => {
  let s = initial();
  assert.equal(s.board.filter((v) => v === 1).length, 4);
  assert.equal(s.board.filter((v) => v === 2).length, 4);
  assert(!rays(s.board, 60).includes(30));
  assert.throws(() => move(s, 60, 30, 40));
});
test("arrow can land on vacated source", () => {
  let s = move(initial(), 60, 50, 60);
  assert.equal(s.board[60], 3);
  assert.equal(s.board[50], 1);
  assert.equal(s.turn, 2);
});
test("no movement loses immediately", () => {
  let b = Array(100).fill(3);
  b[0] = 1;
  b[1] = b[2] = 0;
  b[99] = 2;
  let s = move({ board: b, turn: 1, winner: 0 }, 0, 1, 0);
  assert.equal(s.winner, 1);
  assert.throws(() => move(s, 99, 98, 99));
});
test("AI returns legal complete move", () => {
  let s = initial(),
    m = computer(s);
  assert.doesNotThrow(() => move(s, m.from, m.to, m.arrow));
});
