import test from "node:test";
import assert from "node:assert/strict";
import * as m from "./model.mjs";
test("swap changes owners and next actor, not the board or target colors", () => {
  let s = m.move(m.initial(), 24);
  assert(m.canSwap(s));
  const before = [...s.board];
  s = m.move(s, "swap");
  assert.deepEqual(s.board, before);
  assert.deepEqual(s.owners, [0, 2, 1]);
  assert.equal(s.turn, 1);
  assert(!m.canSwap(s));
  s = m.move(s, 0);
  assert.equal(s.board[0], 2);
  assert.throws(() => m.move(s, "swap"));
});
test("red vertical and blue horizontal win including swapped ownership", () => {
  let s = m.initial();
  for (let r = 0; r < 6; r++) s.board[r * 7] = 1;
  s = m.move(s, 42);
  assert.equal(s.winner, 1);
  s = m.initial();
  s.owners = [0, 2, 1];
  for (let c = 0; c < 6; c++) s.board[c] = 2;
  s = m.move(s, 6);
  assert.equal(s.winner, 1);
});
test("six neighbors and occupied cells", () => {
  assert.equal(m.neighbors(24, 7).length, 6);
  assert.deepEqual(m.neighbors(0, 7), [1, 7]);
  const s = m.move(m.initial(), 0);
  assert.throws(() => m.move(s, 0));
});
test("AI completes legal full games at every supported size", () => {
  for (const n of [7, 9, 11]) {
    let s = m.initial(n);
    for (let i = 0; i < n * n + 1 && !s.winner; i++) {
      const action = m.computer(s);
      assert(m.legal(s).includes(action));
      s = m.move(s, action);
    }
    assert(s.winner);
    assert(m.connection(s.board, n, s.owners.indexOf(s.winner)).length);
  }
});
