import assert from "node:assert/strict";
import {
  fresh,
  deck,
  canPlay,
  routeScore,
  play,
  draw,
  nextRound,
  aiPlay,
  aiDraw,
} from "./model.mjs";
const cards = (values) => values.map((v) => ({ v, c: 0 }));
assert.equal(deck().length, 60);
assert.equal(new Set(deck().map((c) => c.id)).size, 60);
assert.equal(routeScore([]), 0);
assert.equal(routeScore(cards([0])), -40);
assert.equal(routeScore(cards([0, 0, 0])), -80);
assert.equal(
  routeScore(cards([0, 2, 3, 4, 5, 6, 7, 8])),
  50,
  "8-card bonus is not multiplied",
);
assert(canPlay(cards([0, 0]), { v: 0 }));
assert(!canPlay(cards([2]), { v: 0 }));
assert(!canPlay(cards([8]), { v: 7 }));
assert(canPlay(cards([8]), { v: 9 }));
let s = fresh();
const c = s.hands[0][0].c;
play(s, 0, true);
assert.throws(() => draw(s, c));
assert.equal(s.hands[0].length, 7);
draw(s);
assert.equal(s.hands[0].length, 8);
s = fresh();
s.deck = s.deck.slice(0, 1);
play(s, 0, true);
draw(s);
assert.equal(s.phase, "round");
assert.equal(s.results.length, 1);
for (let trial = 0; trial < 10; trial++) {
  s = fresh();
  let turns = 0;
  while (s.phase !== "end") {
    if (s.phase === "round") {
      nextRound(s);
      continue;
    }
    const m = aiPlay(s);
    play(s, m.index, m.discard);
    draw(s, aiDraw(s));
    const all = [
      ...s.deck,
      ...s.hands.flat(),
      ...s.routes.flat(2),
      ...s.discards.flat(),
    ];
    assert.equal(all.length, 60);
    assert.equal(new Set(all.map((c) => c.id)).size, 60);
    assert(++turns < 2000, "AI must finish");
  }
  assert.equal(s.results.length, 3);
  assert.deepEqual(
    s.totals,
    [0, 1].map((p) => s.results.reduce((v, r) => v + r.points[p], 0)),
  );
}
console.log(
  "PASS Lost Cities scoring, order, prohibited pickup, final draw, 10 complete matches and deck conservation.",
);
