// Rules transcribed from FDGSoft BobbyCarrot 1.0's bytecode.
// Tile IDs and level bytes are unchanged. See reference/PROVENANCE.md.
export const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const BELTS = [0, 1, 2, 3];
export function parseLevel(bytes) {
  if (bytes.length !== 260) throw new Error('关卡文件长度不正确');
  const tiles = Array.from(bytes.slice(4));
  if (tiles.some(t => t > 46) || tiles.filter(t => t === 21).length !== 1 || !tiles.includes(44)) {
    throw new Error('关卡数据不正确');
  }
  const pos = tiles.indexOf(21);
  return { tiles, x: pos % 16, y: Math.floor(pos / 16), keys: [0, 0, 0],
    remaining: tiles.filter(t => t === 19 || t === 45).length,
    facing: 3, carried: false, turns: 0, steps: 0, status: 'playing' };
}
export function rotate(tile) {
  if (tile === 22 || tile === 23 || tile === 28 || tile === 29) return tile ^ 1;
  return tile >= 24 && tile <= 27 ? 24 + (tile - 23) % 4 : tile;
}
// Edges of rotating stones: left, right, top, bottom.
const WALLS = {24: [0, 2], 25: [1, 2], 26: [1, 3], 27: [0, 3], 28: [2, 3], 29: [0, 1]};
export function passable(from, to, dir, keys) {
  if (!Number.isInteger(dir) || dir < 0 || dir > 3 || to < 18 || to > 46 || to === 46) return false;
  if (WALLS[from]?.includes(dir) || WALLS[to]?.includes(dir ^ 1)) return false;
  // A conveyor rejects entry against its arrow, not perpendicular entry.
  if (to >= 40 && to <= 43 && dir === (BELTS[to - 40] ^ 1)) return false;
  if ([33, 35, 37].includes(to) && keys[(to - 33) / 2] === 0) return false;
  return true;
}
export function canMove(s, dir) {
  if (!DIRECTIONS[dir]) return false;
  const [dx, dy] = DIRECTIONS[dir], x = s.x + dx, y = s.y + dy;
  return x >= 0 && x < 16 && y >= 0 && y < 16 && passable(s.tiles[s.y * 16 + s.x], s.tiles[y * 16 + x], dir, s.keys);
}
export function beltDirection(s) {
  const tile = s.tiles[s.y * 16 + s.x];
  return tile >= 40 && tile <= 43 ? BELTS[tile - 40] : null;
}
export function advance(s, requested = null) {
  if (s.status !== 'playing') return null;
  let dir = requested, forced = false;
  const belt = beltDirection(s);
  if (belt !== null && canMove(s, belt)) {
    const sideExit = s.carried && requested !== null && (requested < 2) !== (belt < 2) && canMove(s, requested);
    if (!sideExit) { dir = belt; forced = true; }
  }
  if (dir === null || !canMove(s, dir)) return null;
  const n = { ...s, tiles: s.tiles.slice(), keys: s.keys.slice(), carried: forced,
    facing: dir, steps: s.steps + 1, turns: s.turns + (!forced && dir !== s.facing ? 1 : 0) };
  const old = s.y * 16 + s.x, tile = n.tiles[old];
  if (tile === 45) { n.tiles[old] = 46; --n.remaining; }
  else if (tile === 30) n.tiles[old] = 31;
  else if (tile >= 24 && tile <= 29) n.tiles[old] = rotate(tile);
  n.x += DIRECTIONS[dir][0]; n.y += DIRECTIONS[dir][1];
  const at = n.y * 16 + n.x, entered = n.tiles[at];
  if (entered === 19) { n.tiles[at] = 20; --n.remaining; }
  else if (entered === 22) n.tiles = n.tiles.map(rotate);
  else if (entered === 38) n.tiles = n.tiles.map(t => t >= 38 && t <= 43 ? t ^ 1 : t);
  else if (entered >= 32 && entered <= 37) {
    n.keys[Math.floor((entered - 32) / 2)] += entered % 2 === 0 ? 1 : -1;
    n.tiles[at] = 18;
  } else if (entered === 31) n.status = 'dead';
  else if (entered === 44 && n.remaining === 0) n.status = 'won';
  return n;
}
export function replay(initial, moves) {
  if (!Array.isArray(moves) || moves.length > 50000) throw new Error('无效存档');
  let s = initial;
  for (const d of moves) {
    if (!Number.isInteger(d) || d < 0 || d > 3) throw new Error('无效存档');
    const next = advance(s, d);
    if (!next || next.facing !== d) throw new Error('无效存档');
    s = next;
  }
  return s;
}
