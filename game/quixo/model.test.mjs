import test from "node:test";
import assert from "node:assert/strict";
import * as m from "./model.mjs";
test("only border neutral/own cubes; corner two ends, edge three; no same port", () => {
  const s = m.initial();
  assert.equal(m.ends(s, 0).length, 2);
  assert.equal(m.ends(s, 2).length, 3);
  assert.deepEqual(m.ends(s, 12), []);
  s.board[0] = 2;
  assert.deepEqual(m.ends(s, 0), []);
  assert.throws(() => m.move(s, { from: 2, to: 2 }));
});
test("row and column shift the intermediate blocks and own mark enters at end", () => {
  let s = m.initial();
  s.board[1] = 2;
  s.board[2] = 1;
  const n = m.move(s, { from: 0, to: 4 });
  assert.deepEqual(n.board.slice(0, 5), [2, 1, 0, 0, 1]);
  assert.equal(s.board[0], 0);
  const c = m.move(m.initial(), { from: 20, to: 0 });
  assert.equal(c.board[0], 1);
});
test("simultaneous lines award the opponent and terminate", () => {
  const s = m.initial();
  for (const i of [1, 2, 3, 4]) s.board[i] = 1;
  for (const i of [6, 7, 8, 9]) s.board[i] = 2;
  s.board[5] = 1;
  s.board[10] = 2;
  assert(!m.winningLine(s.board, 1).length);
  assert(!m.winningLine(s.board, 2).length);
  const n = m.move(s, { from: 0, to: 20 });
  assert(m.winningLine(n.board, 1).length);
  assert(m.winningLine(n.board, 2).length);
  assert.equal(n.winner, 2);
  assert.deepEqual(m.legal(n), []);
});
test("own five wins, repetition does not invent an automatic draw", () => {
  const s = m.initial();
  s.board.splice(0, 4, 1, 1, 1, 1);
  assert.equal(m.move(s, { from: 4, to: 0 }).winner, 1);
  const n = m.move(m.initial(), { from: 0, to: 4 });
  assert.equal(n.winner, 0);
});
test("AI self-play completes legally with repetition avoidance", () => {
  let s = m.initial();
  for (let i = 0; i < 300 && !s.winner; i++) {
    const a = m.computer(s);
    assert(m.ends(s, a.from).includes(a.to));
    s = m.move(s, a);
  }
  assert(s.winner);
  assert(m.winningLine(s.board, s.winner).length);
});
