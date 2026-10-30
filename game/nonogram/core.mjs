export function runs(row) {
  const out = [];
  let n = 0;
  for (const value of [...row, 0]) {
    if (value) n++;
    else if (n) {
      out.push(n);
      n = 0;
    }
  }
  return out.length ? out : [0];
}
export const clues = (grid) => ({
  rows: grid.map(runs),
  cols: grid[0].map((_, c) => runs(grid.map((row) => row[c]))),
});
export function solved(board, target) {
  return (
    JSON.stringify(
      clues(board.map((row) => row.map((value) => +(value === 1)))),
    ) === JSON.stringify(clues(target))
  );
}
const patternCache = new Map();
export function candidates(n, clue) {
  if (!patternCache.has(n)) {
    const groups = new Map();
    for (let mask = 0; mask < 2 ** n; mask++) {
      const row = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
      const key = runs(row).join(",");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    patternCache.set(n, groups);
  }
  return patternCache.get(n).get(clue.join(",")) || [];
}
// Exhaustive constraint search. Stopping at two proves non-uniqueness;
// a count of one is returned only after every remaining branch is exhausted.
export function analyzeSolutions(grid, limit = 2) {
  const { rows, cols } = clues(grid);
  const n = rows.length,
    m = cols.length;
  let count = 0,
    branches = 0,
    passes = 0;
  function visit(rowOptions, colOptions) {
    if (count >= limit) return;
    let changed = true;
    while (changed) {
      changed = false;
      passes++;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < m; c++) {
          const rowMask = rowOptions[r].reduce(
            (mask, row) => mask | (1 << row[c]),
            0,
          );
          const colMask = colOptions[c].reduce(
            (mask, col) => mask | (1 << col[r]),
            0,
          );
          const common = rowMask & colMask;
          if (!common) return;
          if (common !== rowMask) {
            rowOptions[r] = rowOptions[r].filter(
              (row) => common & (1 << row[c]),
            );
            changed = true;
          }
          if (common !== colMask) {
            colOptions[c] = colOptions[c].filter(
              (col) => common & (1 << col[r]),
            );
            changed = true;
          }
        }
      }
    }
    let best = null;
    for (const [axis, lines] of [
      [0, rowOptions],
      [1, colOptions],
    ]) {
      lines.forEach((options, index) => {
        if (
          options.length > 1 &&
          (!best || options.length < best.options.length)
        )
          best = { axis, index, options };
      });
    }
    if (!best) {
      count++;
      return;
    }
    for (const option of best.options) {
      if (count >= limit) break;
      branches++;
      const nextRows = rowOptions.slice(),
        nextCols = colOptions.slice();
      (best.axis === 0 ? nextRows : nextCols)[best.index] = [option];
      visit(nextRows, nextCols);
    }
  }
  visit(
    rows.map((row) => candidates(m, row)),
    cols.map((col) => candidates(n, col)),
  );
  return { count, branches, passes };
}
export function countSolutions(grid, limit = 2) {
  return analyzeSolutions(grid, limit).count;
}
// A square board has eight dihedral symmetries: four rotations and their mirrors.
export function canonicalGrid(grid) {
  const keys = [];
  let current = grid;
  for (let turn = 0; turn < 4; turn++) {
    keys.push(current.map((row) => row.join("")).join("/"));
    keys.push(current.map((row) => row.slice().reverse().join("")).join("/"));
    current = current[0].map((_, c) => current.map((row) => row[c]).reverse());
  }
  return keys.sort()[0];
}
