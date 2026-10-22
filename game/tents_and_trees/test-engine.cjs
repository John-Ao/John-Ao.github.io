const assert = require('node:assert/strict');
const E = require('./engine.js').Tents;

for (const n of [5, 6, 8, 10, 12]) {
  for (let i = 0; i < 20; i++) {
    const puzzle = E.generate(n);
    assert.equal(E.inspect(puzzle, puzzle.solution).solved, true);
    assert.equal(E.inspect(puzzle, []).solved, false);
    const result = E.solve(puzzle, 2, 200000);
    assert.equal(result.exhausted, false);
    assert.equal(result.solutions.length, 1);
    assert.deepEqual(E.validate(JSON.parse(JSON.stringify(puzzle))), puzzle);
    const { solution, ...shared } = puzzle;
    assert.equal(E.inspect(shared, E.validate(shared).solution).solved, true);
    assert.equal(E.validTents(puzzle, [puzzle.trees[0]]), false);
    assert.equal(E.validTents(puzzle, [solution[0], solution[0]]), false);
  }
}
const puzzle = { n: 5, trees: [0, 4], rows: [0, 2, 0, 0, 0], cols: [1, 0, 0, 0, 1] };
assert.equal(E.inspect(puzzle, [5, 9]).solved, true);
const bad = E.inspect(puzzle, [5, 6]);
assert(bad.bad.has(5) && bad.bad.has(6));
assert(bad.badCols.includes(1));
assert(E.inspect(puzzle, [5, 11]).bad.has(5)); // Diagonal adjacency.
assert(E.inspect(puzzle, [12]).bad.has(12)); // No adjacent tree.
const contested = {n:5, trees:[6,24], rows:[1,0,1,0,0], cols:[0,2,0,0,0]};
assert.equal(E.inspect(contested,[1,11]).bad.size, 2); // One tree cannot serve two tents.
assert.throws(()=>E.validate({...puzzle,rows:[0]}));
assert.throws(()=>E.validate({...puzzle,trees:[0,0]}));
assert.throws(()=>E.validate({...puzzle,cols:[2,0,0,0,0]}));
console.log('PASS: 100 unique puzzles; shared-puzzle solving; adjacency, matching, counts, invalid inputs.');
