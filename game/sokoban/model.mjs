export const directions = { U: [-1, 0], R: [0, 1], D: [1, 0], L: [0, -1] };
export function adjacent(i, dir, n) {
  const [dr, dc] = directions[dir],
    r = Math.floor(i / n) + dr,
    c = (i % n) + dc;
  return r >= 0 && c >= 0 && r < n && c < n ? r * n + c : -1;
}
export function solved(level, state) {
  return (
    state.boxes.length === level.goals.length &&
    state.boxes.every((i) => level.goals.includes(i))
  );
}
export function move(level, state, dir) {
  if (!directions[dir]) return null;
  const next = adjacent(state.player, dir, level.n);
  if (next < 0 || level.walls[next]) return null;
  const boxes = state.boxes.slice(),
    index = boxes.indexOf(next);
  let pushed = 0;
  if (index >= 0) {
    const destination = adjacent(next, dir, level.n);
    if (
      destination < 0 ||
      level.walls[destination] ||
      boxes.includes(destination)
    )
      return null;
    boxes[index] = destination;
    pushed = 1;
  }
  return {
    player: next,
    boxes: boxes.sort((a, b) => a - b),
    moves: (state.moves || 0) + 1,
    pushes: (state.pushes || 0) + pushed,
  };
}
export function reachable(level, state) {
  const found = new Map([[state.player, ""]]),
    queue = [state.player],
    boxes = new Set(state.boxes);
  for (let k = 0; k < queue.length; k++)
    for (const dir of Object.keys(directions)) {
      const next = adjacent(queue[k], dir, level.n);
      if (
        next >= 0 &&
        !level.walls[next] &&
        !boxes.has(next) &&
        !found.has(next)
      ) {
        found.set(next, found.get(queue[k]) + dir);
        queue.push(next);
      }
    }
  return found;
}
export function pull(level, state, dir) {
  const next = adjacent(state.player, dir, level.n),
    opposite = { U: "D", D: "U", L: "R", R: "L" }[dir],
    behind = adjacent(state.player, opposite, level.n);
  if (
    next < 0 ||
    level.walls[next] ||
    state.boxes.includes(next) ||
    !state.boxes.includes(behind)
  )
    return null;
  return {
    player: next,
    boxes: state.boxes
      .map((i) => (i === behind ? state.player : i))
      .sort((a, b) => a - b),
  };
}
export function solve(level, { budget = 60000 } = {}) {
  const start = {
      player: level.player,
      boxes: level.boxes.slice().sort((a, b) => a - b),
    },
    queue = [{ ...start, parent: -1, route: "", pushes: 0 }],
    seen = new Set();
  const key = (s, reach) => s.boxes.join(",") + "|" + Math.min(...reach.keys());
  seen.add(key(start, reachable(level, start)));
  let nodes = 0;
  for (let index = 0; index < queue.length; index++) {
    if (++nodes > budget)
      return {
        solvable: false,
        complete: false,
        nodes,
        minimumPushes: null,
        solution: null,
      };
    const current = queue[index];
    if (solved(level, current)) {
      const parts = [];
      for (let i = index; queue[i].parent >= 0; i = queue[i].parent)
        parts.push(queue[i].route);
      return {
        solvable: true,
        complete: true,
        nodes,
        minimumPushes: current.pushes,
        solution: parts.reverse().join(""),
      };
    }
    const reach = reachable(level, current);
    for (const box of current.boxes)
      for (const dir of Object.keys(directions)) {
        const opposite = { U: "D", D: "U", L: "R", R: "L" }[dir],
          stand = adjacent(box, opposite, level.n);
        if (!reach.has(stand)) continue;
        const next = move(level, { ...current, player: stand }, dir);
        if (!next) continue;
        const destination = adjacent(box, dir, level.n);
        if (!level.goals.includes(destination)) {
          const blocked = (d) => {
            const p = adjacent(destination, d, level.n);
            return p < 0 || level.walls[p];
          };
          if ((blocked("U") || blocked("D")) && (blocked("L") || blocked("R")))
            continue;
        }
        const nextReach = reachable(level, next),
          k = key(next, nextReach);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({
          player: next.player,
          boxes: next.boxes,
          parent: index,
          route: reach.get(stand) + dir,
          pushes: current.pushes + 1,
        });
      }
  }
  return {
    solvable: false,
    complete: true,
    nodes,
    minimumPushes: null,
    solution: null,
  };
}
