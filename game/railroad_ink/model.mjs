// Directions: north, east, south, west. 1 highway, 2 railway.
export const tiles = [
  { name: "公路弯道", e: [1, 1, 0, 0] },
  { name: "公路直道", e: [1, 0, 1, 0] },
  { name: "公路岔道", e: [1, 1, 1, 0] },
  { name: "铁路弯道", e: [2, 2, 0, 0] },
  { name: "铁路直道", e: [2, 0, 2, 0] },
  { name: "铁路岔道", e: [2, 2, 2, 0] },
  { name: "直线车站", e: [1, 0, 2, 0], station: true },
  { name: "转角车站", e: [1, 2, 0, 0], station: true },
  { name: "立交桥", e: [1, 2, 1, 2], bridge: true },
  { name: "三公一铁车站", e: [1, 1, 2, 1], station: true },
  { name: "一公三铁车站", e: [1, 2, 2, 2], station: true },
  { name: "公路十字", e: [1, 1, 1, 1] },
  { name: "铁路十字", e: [2, 2, 2, 2] },
  { name: "相邻双线车站", e: [1, 1, 2, 2], station: true },
  { name: "交叉双线车站", e: [1, 2, 1, 2], station: true },
];
export function orient(id, r = 0, flip = false) {
  let t = tiles[id],
    e = [...t.e];
  if (flip) [e[1], e[3]] = [e[3], e[1]];
  while (r-- > 0) e = [e[3], ...e.slice(0, 3)];
  return { ...t, id, e };
}
export function neighbor(i, d) {
  let x = i % 7,
    y = Math.floor(i / 7),
    nx = x + [0, 1, 0, -1][d],
    ny = y + [-1, 0, 1, 0][d];
  return nx < 0 || nx > 6 || ny < 0 || ny > 6 ? -1 : ny * 7 + nx;
}
export function exitType(i, d) {
  if (neighbor(i, d) !== -1) return 0;
  let k = d % 2 === 0 ? i % 7 : Math.floor(i / 7);
  return [1, 3, 5].includes(k)
    ? d % 2 === 0
      ? k === 3
        ? 2
        : 1
      : k === 3
        ? 1
        : 2
    : 0;
}
export function legal(board, i, t) {
  if (board[i]) return false;
  let connected = false;
  for (let d = 0; d < 4; d++) {
    let n = neighbor(i, d),
      a = t.e[d],
      b = n < 0 ? exitType(i, d) : board[n]?.e[(d + 2) % 4] || 0;
    if (a && b && a !== b) return false;
    if (a && a === b) connected = true;
  }
  return connected;
}
export function placements(board, id) {
  let out = [];
  for (let r = 0; r < 4; r++)
    for (let f of [false, true]) {
      let t = orient(id, r, f);
      for (let i = 0; i < 49; i++) if (legal(board, i, t)) out.push({ i, t });
    }
  return out;
}
export function dice() {
  return [0, 0, 0]
    .map(() => Math.floor(Math.random() * 6))
    .concat(6 + Math.floor(Math.random() * 3));
}
export const fresh = () => ({
  board: Array(49).fill(null),
  round: 1,
  dice: dice(),
  used: [],
  specialRound: false,
  done: false,
});
export function score(board) {
  let errors = 0,
    center = 0;
  const nodes = new Map(),
    adj = new Map(),
    exits = new Map();
  function node(i, d) {
    return `${i}:${board[i].bridge ? board[i].e[d] : 0}`;
  }
  function add(a, b) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (b) adj.get(a).add(b);
  }
  board.forEach((t, i) => {
    if (!t) return;
    if (
      i % 7 >= 2 &&
      i % 7 <= 4 &&
      Math.floor(i / 7) >= 2 &&
      Math.floor(i / 7) <= 4
    )
      center++;
    t.e.forEach((v, d) => {
      if (!v) return;
      let a = node(i, d);
      nodes.set(a, i);
      add(a);
      let n = neighbor(i, d);
      if (n < 0) {
        if (exitType(i, d) === v) exits.set(a, (exits.get(a) || 0) + 1);
      } else if (board[n]?.e[(d + 2) % 4] === v) add(a, node(n, (d + 2) % 4));
      else errors++;
    });
  });
  let seen = new Set(),
    network = 0;
  for (let a of nodes.keys()) {
    if (seen.has(a)) continue;
    let stack = [a],
      n = 0;
    seen.add(a);
    while (stack.length) {
      let q = stack.pop();
      n += exits.get(q) || 0;
      for (let b of adj.get(q)) {
        if (!seen.has(b)) {
          seen.add(b);
          stack.push(b);
        }
      }
    }
    network += n === 12 ? 45 : Math.max(0, (n - 1) * 4);
  }
  function longest(type) {
    const graph = new Map();
    board.forEach((t, i) => {
      if (!t || !t.e.includes(type)) return;
      graph.set(i, []);
      t.e.forEach((v, d) => {
        let n = neighbor(i, d);
        if (v === type && n >= 0 && board[n]?.e[(d + 2) % 4] === type)
          graph.get(i).push(n);
      });
    });
    let best = 0;
    function dfs(i, vis, len) {
      best = Math.max(best, len);
      for (let n of graph.get(i))
        if (!vis.has(n)) {
          vis.add(n);
          dfs(n, vis, len + 1);
          vis.delete(n);
        }
    }
    for (let i of graph.keys()) dfs(i, new Set([i]), 1);
    return best;
  }
  let highway = longest(1),
    railway = longest(2);
  return {
    network,
    highway,
    railway,
    center,
    errors,
    total: network + highway + railway + center - errors,
  };
}
