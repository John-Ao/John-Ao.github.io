import test from "node:test";
import assert from "node:assert/strict";
import { initial, move, legal, computer } from "./model.mjs";
test("initial move reaches own store and repeats", () => {
  let s = move(initial(), 2);
  assert.equal(s.pits[6], 1);
  assert.equal(s.turn, 1);
  assert(s.extra);
  assert.equal(
    s.pits.reduce((a, b) => a + b),
    48,
  );
});
test("capture opposite and final stone", () => {
  let s = initial();
  s.pits[0] = 1;
  s.pits[1] = 0;
  s.pits[11] = 5;
  let n = move(s, 0);
  assert.equal(n.captured, 6);
  assert.equal(n.pits[6], 6);
  assert.equal(n.pits[1], 0);
  assert.equal(n.pits[11], 0);
});
test("skip opponent store during long sow", () => {
  let s = initial();
  s.pits[5] = 15;
  let n = move(s, 5);
  assert.equal(n.pits[13], 0);
  assert.equal(
    n.pits.reduce((a, b) => a + b),
    59,
  );
});
test("collect remaining pits at end", () => {
  let s = initial();
  s.pits = [0, 0, 0, 0, 0, 1, 20, 1, 2, 3, 4, 5, 6, 6];
  let n = move(s, 5);
  assert(n.ended);
  assert.equal(n.pits[6], 21);
  assert.equal(n.pits[13], 27);
  assert.equal(n.winner, 2);
  assert.deepEqual(legal(n), []);
});
test("AI and illegal player selection", () => {
  let s = initial();
  assert.throws(() => move(s, 7));
  assert(legal(s).includes(computer(s)));
});
test("full legal game conserves seeds", () => {
  let s = initial();
  for (let i = 0; i < 500 && !s.ended; i++) {
    let a = legal(s);
    s = move(s, a[i % a.length]);
    assert.equal(
      s.pits.reduce((a, b) => a + b),
      48,
    );
  }
  assert(s.ended);
});

test("empty opposite pit does not capture and player two repeats at own store", () => {
  const s = initial();
  s.pits[0] = 1;
  s.pits[1] = s.pits[11] = 0;
  const n = move(s, 0);
  assert.equal(n.captured, 0);
  assert.equal(n.pits[1], 1);
  const p2 = initial();
  p2.turn = 2;
  const n2 = move(p2, 9);
  assert.equal(n2.pits[13], 1);
  assert.equal(n2.turn, 2);
});

test("equal final stores produce a draw", () => {
  const s = initial();
  s.pits = [0, 0, 0, 0, 0, 1, 23, 0, 0, 0, 0, 0, 1, 23];
  const n = move(s, 5);
  assert(n.ended);
  assert.equal(n.winner, 0);
  assert.equal(n.pits[6], 24);
  assert.equal(n.pits[13], 24);
});
