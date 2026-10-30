import assert from "node:assert/strict";
import {
  fresh,
  deck,
  baseScore,
  makiScores,
  puddingScores,
  addCard,
  turn,
  nextRound,
  aiChoice,
  winners,
} from "./model.mjs";
const c = (type) => ({ type });
assert.equal(deck().length, 108);
assert.equal(new Set(deck().map((c) => c.id)).size, 108);
assert.equal(baseScore([c("tempura"), c("tempura"), c("tempura")]), 5);
assert.equal(baseScore(Array.from({ length: 6 }, () => c("sashimi"))), 20);
assert.equal(baseScore(Array.from({ length: 7 }, () => c("dumpling"))), 15);
assert.deepEqual(makiScores([4, 4, 2]), [3, 3, 0]);
assert.deepEqual(makiScores([5, 3, 3, 0]), [6, 1, 1, 0]);
assert.deepEqual(makiScores([1, 0, 0]), [6, 0, 0]);
assert.deepEqual(makiScores([0, 0, 0]), [0, 0, 0]);
assert.deepEqual(puddingScores([4, 1, 0, 0]), [6, 0, -3, -3]);
assert.deepEqual(puddingScores([0, 0, 0]), [0, 0, 0]);
assert.deepEqual(puddingScores([2, 2, 0]), [3, 3, -6]);
let table = [];
addCard(table, c("wasabi"));
addCard(table, c("squid"));
assert.equal(baseScore(table), 9);
addCard(table, c("egg"));
assert.equal(baseScore(table), 10);
table = [];
addCard(table, c("squid"));
addCard(table, c("wasabi"));
assert.equal(baseScore(table), 3);
let s = fresh();
s.table[0] = [c("chopsticks")];
s.hands[0] = [c("wasabi"), c("squid"), c("egg")];
s.hands[1] = [c("egg"), c("egg"), c("egg")];
s.hands[2] = [c("egg"), c("egg"), c("egg")];
turn(s, [[0, 1], [0], [0]]);
assert.equal(baseScore(s.table[0]), 9);
assert(s.hands[1].some((c) => c.type === "chopsticks"));
assert.equal(s.hands[0].length, 2);
s = fresh();
assert.throws(
  () => turn(s, [[0, 1], [0], [0]]),
  "new chopsticks cannot be used immediately",
);
for (const n of [3, 4, 5])
  for (let trial = 0; trial < 5; trial++) {
    s = fresh(n);
    const initialDeck = s.deck.length;
    let steps = 0;
    while (s.phase !== "end") {
      if (s.phase === "round") {
        nextRound(s);
        continue;
      }
      turn(
        s,
        s.hands.map((_, p) => aiChoice(s, p)),
      );
      assert(++steps <= 27);
      const all = [
        ...s.deck,
        ...s.discard,
        ...s.hands.flat(),
        ...s.table.flat(),
        ...s.dessert.flat(),
      ];
      // At round summaries the displayed pudding cards also exist in the dessert reserve.
      assert.equal(new Set(all.map((c) => c.id)).size, 108);
    }
    assert.equal(s.results.length, 3);
    assert.equal(s.deck.length, 108 - 3 * n * (12 - n));
    assert(winners(s).length >= 1);
  }
s = fresh();
s.totals = [20, 20, 5];
s.dessert = [[c("pudding")], [c("pudding"), c("pudding")], []];
assert.deepEqual(winners(s), [1]);
console.log(
  "PASS Sushi Go deck, combos, ties, pudding, ordered wasabi, chopsticks, 15 complete matches.",
);
