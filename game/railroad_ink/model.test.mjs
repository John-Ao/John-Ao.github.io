import assert from "node:assert/strict";
import { fresh, orient, legal, score, placements, exitType } from "./model.mjs";
let b = fresh().board;
assert(legal(b, 1, orient(1)));
assert(!legal(b, 1, orient(4)));
assert(!legal(b, 24, orient(1)));
b[1] = orient(1);
assert(legal(b, 8, orient(1)));
b[8] = orient(1);
assert.equal(score(b).highway, 2);
assert.equal(score(b).errors, 1);
b = fresh().board;
for (let i = 0; i < 7; i++) b[i * 7 + 1] = orient(1);
let z = score(b);
assert.equal(z.network, 4);
assert.equal(z.highway, 7);
assert.equal(z.errors, 0);
b = fresh().board;
b[24] = orient(8);
z = score(b);
assert.equal(z.center, 1);
assert.equal(z.errors, 4);
assert.equal(z.highway, 1);
assert.equal(z.railway, 1);
assert(placements(fresh().board, 7).length);
assert.deepEqual(orient(7, 1).e, [0, 1, 2, 0]);
console.log("Railroad Ink model: passed");
// A crossing splits two networks; the equivalent station joins all four exits.
b = fresh().board;
for (let i = 0; i < 7; i++) {
  b[3 * 7 + i] = orient(1, 1);
  b[i * 7 + 3] = orient(4);
}
b[24] = orient(8, 1);
assert.equal(score(b).network, 8);
b[24] = orient(14, 1);
assert.equal(score(b).network, 12);
// All twelve exits in one connected station network earn the special 45.
b = Array.from({ length: 49 }, () => orient(11));
for (let i = 0; i < 49; i++)
  for (let d = 0; d < 4; d++) {
    if (exitType(i, d) === 2) {
      b[i] = { ...b[i], e: [...b[i].e], station: true };
      b[i].e[d] = 2;
    }
  }
// Dense graph longest path is expensive; remove routes outside an edge ring.
for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) b[y * 7 + x] = null;
assert.equal(score(b).network, 45);
b = fresh().board;
b[0] = orient(1);
assert.equal(score(b).errors, 1); // non-exit north edge is free
b[7] = orient(1, 1);
assert.equal(score(b).errors, 2); // north endpoint meets a blank edge
console.log("Railroad Ink edge and network regression tests: passed");
