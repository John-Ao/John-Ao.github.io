import test from "node:test";
import assert from "node:assert/strict";
import * as m from "./model.mjs";
test("four neutral corner pairs; bottom-first sowing preserves order", () => {
  const s = m.initial();
  assert.equal(s.board.flat().length, 8);
  const next = m.move(s, { from: 0, path: [1, 2, 3] });
  assert.deepEqual(next.board[0], []);
  assert.deepEqual(next.board[1], [3]);
  assert.deepEqual(next.board[2], [3]);
  assert.deepEqual(next.board[3], [3, 3, 1]);
  assert.equal(next.reserve[1], 7);
  assert.equal(s.board[0].length, 2);
});
test("empty source, diagonal, backtrack and incomplete paths rejected", () => {
  const s = m.initial();
  assert.throws(() => m.move(s, { from: 1, path: [2] }));
  assert.throws(() => m.move(s, { from: 0, path: [5, 6, 7] }));
  assert.throws(() => m.move(s, { from: 0, path: [1, 0, 4] }));
  assert.throws(() => m.move(s, { from: 0, path: [1] }));
});
test("circling back to starting square is allowed; preview never mutates game", () => {
  const s = m.initial();
  s.board[0] = [3, 2, 3];
  const before = structuredClone(s);
  const preview = m.preview(s, 0, [1, 5]);
  assert.equal(preview.hand.length, 2);
  assert.deepEqual(s, before);
  const next = m.move(s, { from: 0, path: [1, 5, 4, 0] });
  assert.deepEqual(next.board[0], [1]);
});
test("only visible tops count and simultaneous lines use declared mover priority", () => {
  const s = m.initial();
  s.board = Array.from({ length: 16 }, () => []);
  s.board[0] = [2];
  for (const i of [5, 9, 13]) s.board[i] = [2];
  for (const i of [6, 10, 14]) s.board[i] = [1];
  const next = m.move(s, { from: 0, path: [1, 2] });
  assert.equal(next.winner, 1);
  assert(m.winningLine(next.board, 2).length);
  s.board[14] = [1, 3];
  assert.equal(m.move(s, { from: 0, path: [1, 2] }).winner, 2);
});
test("AI full game conserves all colors and ends in at most sixteen moves", () => {
  let s = m.initial();
  for (let k = 0; k < 16 && !s.ended; k++) {
    const a = m.computer(s);
    assert(a);
    s = m.move(s, a);
    for (const p of [1, 2])
      assert.equal(
        s.board.flat().filter((v) => v === p).length + s.reserve[p],
        8,
      );
    assert.equal(s.board.flat().filter((v) => v === 3).length, 8);
  }
  assert(s.ended);
  if (!s.winner) assert.deepEqual(s.reserve, [0, 0, 0]);
});
test("large-pile AI search stays bounded and returns a complete legal path", () => {
  let s = m.initial();
  s.board = Array.from({ length: 16 }, () => []);
  s.board[0] = Array(20).fill(3);
  const actions = m.legal(s, 32);
  assert.equal(actions.length, 32);
  for (const a of actions) assert.equal(a.path.length, 21);
  assert.doesNotThrow(() => m.move(s, m.computer(s)));
});
