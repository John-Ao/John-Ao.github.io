import { geometry, validLoop, levels } from "./model.mjs";
const KEY = "slitherlink-v1";
const $ = (id) => document.getElementById(id);
let store = {};
try {
  store = JSON.parse(localStorage.getItem(KEY)) || {};
} catch {}
if (!store || typeof store !== "object" || Array.isArray(store)) store = {};
let level =
  Number.isInteger(store.level) &&
  store.level >= 0 &&
  store.level < levels.length
    ? store.level
    : 0;
let history = [],
  state,
  won = false;
const groups = [
  { value: "legacy", label: "原精选 · 8 关", matches: (_, i) => i < 8 },
  ...[4, 5, 6].map((n) => ({
    value: String(n),
    label: `${n}×${n} · 32 关`,
    matches: (l, i) => i >= 8 && l.n === n,
  })),
];
$("group").innerHTML = groups
  .map((g) => `<option value="${g.value}">${g.label}</option>`)
  .join("");
function selectGroupForLevel() {
  const group = groups.find((g) => g.matches(levels[level], level));
  $("group").value = group.value;
  $("level").innerHTML = levels
    .map((l, i) =>
      group.matches(l, i)
        ? `<option value="${i}">${i < 8 ? `${i + 1} · ${l.name}` : `第 ${i + 1} 题`}</option>`
        : "",
    )
    .join("");
  $("level").value = level;
}
selectGroupForLevel();
$("group").onchange = () => {
  const group = groups.find((g) => g.value === $("group").value);
  level = levels.findIndex(group.matches);
  selectGroupForLevel();
  load();
};
function save() {
  store.level = level;
  store[level] = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
}
function load() {
  const saved = store[level];
  state = validState(saved) ? saved.slice() : blank();
  history = [];
  render();
  save();
}
function commit(next) {
  if (won || JSON.stringify(next) === JSON.stringify(state)) return;
  history.push(state.slice());
  state = next;
  render();
  save();
}
function updateStatus() {
  won = isSolved();
  $("status").textContent = won ? "已完成 ✓ 可以选择下一关" : progress();
  $("undo").disabled = !history.length;
}
$("level").onchange = () => {
  level = +$("level").value;
  load();
};
$("undo").onclick = () => {
  if (!history.length) return;
  state = history.pop();
  render();
  save();
};
$("reset").onclick = () => $("confirm").showModal();
$("cancel-reset").onclick = () => $("confirm").close();
$("confirm-reset").onclick = () => {
  state = blank();
  history = [];
  render();
  save();
  $("confirm").close();
};
$("help").onclick = () => $("rules").showModal();
document.querySelector("[data-close]").onclick = () => $("rules").close();
document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === "z" &&
    !document.querySelector("dialog[open]")
  ) {
    e.preventDefault();
    $("undo").click();
  }
});
function blank() {
  return Array(geometry(levels[level].n).edges.length).fill(0);
}
function validState(v) {
  return (
    Array.isArray(v) &&
    v.length === blank().length &&
    v.every((x) => [0, 1, 2].includes(x))
  );
}
function isSolved() {
  const l = levels[level];
  return validLoop(state, l.n, l.clues);
}
function progress() {
  return `连成一个闭环 · 已画 ${state.filter((x) => x === 1).length} 条边`;
}
function render() {
  const l = levels[level],
    { edges, cells } = geometry(l.n),
    step = 70,
    off = 30,
    size = step * l.n + 2 * off,
    active = document.activeElement?.dataset.edge;
  let s = `<svg viewBox="0 0 ${size} ${size}" role="group" aria-label="数回棋盘">`;
  s += l.clues
    .map((v, i) => {
      if (v == null) return "";
      const count = cells[i].filter((j) => state[j] === 1).length;
      return `<text class="clue ${count > v ? "bad" : ""}" x="${off + ((i % l.n) + 0.5) * step}" y="${off + (Math.floor(i / l.n) + 0.5) * step}">${v}</text>`;
    })
    .join("");
  s += edges
    .map((e, i) => {
      const x = off + e.c * step,
        y = off + e.r * step,
        x2 = x + (e.h ? step : 0),
        y2 = y + (e.h ? 0 : step),
        cx = (x + x2) / 2,
        cy = (y + y2) / 2;
      return `<g class="edge ${state[i] === 1 ? "on" : ""}" role="button" tabindex="0" data-edge="${i}" aria-label="${e.h ? "横" : "竖"}边，第${e.r + 1}行第${e.c + 1}列：${["空白", "已画线", "排除"][state[i]]}" aria-pressed="${state[i] === 1}"><rect class="hit" x="${x + (e.h ? 10 : -16)}" y="${y + (e.h ? -16 : 10)}" width="${e.h ? step - 20 : 32}" height="${e.h ? 32 : step - 20}"/><line class="line" x1="${x}" y1="${y}" x2="${x2}" y2="${y2}"/>${state[i] === 2 ? `<path class="cross" d="M${cx - 5},${cy - 5}l10,10m0,-10l-10,10"/>` : ""}</g>`;
    })
    .join("");
  for (let r = 0; r <= l.n; r++)
    for (let c = 0; c <= l.n; c++)
      s += `<circle class="dot" cx="${off + c * step}" cy="${off + r * step}" r="3.5"/>`;
  $("board").innerHTML = s + "</svg>";
  updateStatus();
  if (active != null)
    $("board")
      .querySelector(`[data-edge="${active}"]`)
      ?.focus({ preventScroll: true });
}
function act(target, value) {
  const el = target.closest("[data-edge]");
  if (!el) return;
  const i = +el.dataset.edge,
    next = state.slice();
  next[i] = value ?? (next[i] + 1) % 3;
  commit(next);
}
$("board").onclick = (e) => act(e.target);
$("board").oncontextmenu = (e) => {
  e.preventDefault();
  act(e.target, 2);
};
$("board").onkeydown = (e) => {
  if ([" ", "Enter", "x", "X", "Delete", "Backspace"].includes(e.key)) {
    e.preventDefault();
    act(
      e.target,
      ["x", "X"].includes(e.key)
        ? 2
        : ["Delete", "Backspace"].includes(e.key)
          ? 0
          : undefined,
    );
  }
};
load();
