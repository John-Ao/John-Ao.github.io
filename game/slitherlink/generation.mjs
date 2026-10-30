import { geometry } from "./model.mjs";

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
export function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function boundary(n, region) {
  const inside = (r, c) =>
    r >= 0 && c >= 0 && r < n && c < n && region.has(r * n + c);
  return geometry(n).edges.map(
    (e) =>
      +(e.h
        ? inside(e.r - 1, e.c) !== inside(e.r, e.c)
        : inside(e.r, e.c - 1) !== inside(e.r, e.c)),
  );
}
// A loop signature under all eight dihedral transforms. Comparing the solved
// loop is stricter than comparing the clue mask: remasking a loop is not new.
export function canonicalLoop(n, solution) {
  const { edges } = geometry(n);
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const indices = new Map(edges.map((e, i) => [key(e.a, e.b), i]));
  const signatures = [];
  for (let mirror = 0; mirror < 2; mirror++)
    for (let rotation = 0; rotation < 4; rotation++) {
      const transform = (v) => {
        let r = Math.floor(v / (n + 1)),
          c = v % (n + 1);
        if (mirror) c = n - c;
        for (let k = 0; k < rotation; k++) [r, c] = [c, n - r];
        return r * (n + 1) + c;
      };
      const bits = Array(edges.length).fill(0);
      edges.forEach((e, i) => {
        if (solution[i])
          bits[indices.get(key(transform(e.a), transform(e.b)))] = 1;
      });
      signatures.push(bits.join(""));
    }
  return `${n}:${signatures.sort()[0]}`;
}
