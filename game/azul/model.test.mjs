import assert from "node:assert/strict";
import {
  fresh,
  player,
  place,
  moves,
  canPlace,
  tileScore,
  bonuses,
  finishRound,
  nextRound,
  aiMove,
  winners,
} from "./model.mjs";
let p = player();
p.wall[2][2] = true;
assert.equal(tileScore(p.wall, 2, 2), 1);
p.wall[2][1] = true;
p.wall[1][2] = true;
assert.equal(tileScore(p.wall, 2, 2), 4);
p.wall[2][0] = true;
assert.equal(tileScore(p.wall, 2, 2), 5);
p = player();
p.wall[0][0] = true;
assert(!canPlace(p, 0, 0));
p.lines[2] = [1];
assert(!canPlace(p, 2, 2));
assert(canPlace(p, 2, 1));
p.lines[2] = [1, 1, 1];
assert(!canPlace(p, 2, 1));
let s = fresh();
s.factories = [[2, 2, 1, 3], [], [], [], []];
s.center = [0];
place(s, { source: 0, color: 2, row: 0 });
assert.deepEqual(s.center, [0, 1, 3]);
assert.deepEqual(s.players[0].lines[0], [2]);
assert.deepEqual(s.players[0].floor, [2]);
assert.equal(s.phase, "take");
place(s, { source: 5, color: 0, row: 1 });
assert.equal(s.starter, 1);
assert.equal(s.marker, false);
assert.deepEqual(s.players[1].floor, [-1]);
s = fresh();
s.players[0].floor = [0, 0, 0, 0, 0, 0, 0];
s.center = [1];
s.factories = [[], [], [], [], [2]];
place(s, { source: 5, color: 1, row: -1 });
assert.equal(s.starter, 0);
assert.equal(s.players[0].floor.length, 7);
assert(s.discard.includes(1));
s = fresh();
s.players[0].wall[0] = [true, true, true, true, false];
s.players[0].lines[0] = [4];
s.players[1].lines[0] = [0];
s.players[0].score = 0;
s.players[0].floor = [-1, 1, 1, 1, 1, 1, 1];
finishRound(s);
assert.equal(s.phase, "end");
assert(s.players[1].wall[0][0], "both players score before end");
assert.equal(s.players[0].score, 2, "floor clamps to 0 before row bonus");
p = player();
p.wall = Array.from({ length: 5 }, () => Array(5).fill(true));
assert.deepEqual(bonuses(p), { rows: 5, columns: 5, sets: 5, total: 95 });
for (let trial = 0; trial < 10; trial++) {
  s = fresh();
  let steps = 0;
  while (s.phase !== "end") {
    if (s.phase === "round") nextRound(s);
    else place(s, aiMove(s));
    let tiles = [...s.bag, ...s.discard, ...s.center, ...s.factories.flat()];
    s.players.forEach((p) => {
      tiles.push(...p.lines.flat(), ...p.floor.filter((x) => x >= 0));
      p.wall.forEach((r, y) =>
        r.forEach((filled, x) => {
          if (filled) tiles.push((x - y + 5) % 5);
        }),
      );
    });
    assert.equal(tiles.length, 100);
    for (let c = 0; c < 5; c++)
      assert.equal(tiles.filter((x) => x === c).length, 20);
    assert(++steps < 1000);
  }
  assert(winners(s).length >= 1);
}
console.log(
  "PASS Azul placement, marker overflow, wall adjacency, floor clamp, full-round end, 10 full games and 100-tile conservation.",
);
