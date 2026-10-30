import { levels } from "./levels.mjs";
import * as model from "./model.mjs";
const $ = (id) => document.getElementById(id),
  KEY = "akari" + "-v1";
let store = {};
try {
  store = JSON.parse(localStorage.getItem(KEY)) || {};
} catch {}
if (typeof store !== "object" || Array.isArray(store)) store = {};
let current =
  Number.isInteger(store.current) &&
  store.current >= 0 &&
  store.current < levels.length
    ? store.current
    : 0;
let state,
  history = [],
  won = false,
  mode = 1;
const groups = [...new Set(levels.map((l) => l.n))];
$("group").innerHTML = groups
  .map((n) => `<option value="${n}">${n}×${n} · 20 题</option>`)
  .join("");
function picker() {
  const n = levels[current].n;
  $("group").value = n;
  $("level").innerHTML = levels
    .flatMap((l, i) =>
      l.n === n ? [`<option value="${i}">第 ${(i % 20) + 1} 题</option>`] : [],
    )
    .join("");
  $("level").value = current;
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function save() {
  store.current = current;
  store[current] = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
}
function load() {
  history = [];
  state = validState(store[current]) ? clone(store[current]) : blank();
  render();
  save();
}
function commit(next) {
  if (won || JSON.stringify(next) === JSON.stringify(state)) return;
  history.push(clone(state));
  state = next;
  render();
  save();
}
function updateStatus(text, complete) {
  won = complete;
  $("status").textContent = won ? "已完成 ✓ 可以选择下一关" : text;
  $("undo").disabled = !history.length;
}
function announce(text) {
  $("status").textContent = text;
}
$("group").onchange = () => {
  current = levels.findIndex((l) => l.n === +$("group").value);
  picker();
  load();
};
$("level").onchange = () => {
  current = +$("level").value;
  load();
};
$("undo").onclick = () => {
  if (history.length) {
    state = history.pop();
    render();
    save();
  }
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
$("close-rules").onclick = () => $("rules").close();
$("zoom").onclick = () => {
  const on = $("board").classList.toggle("enlarged");
  $("zoom").textContent = on ? "适应屏幕" : "放大";
  $("zoom").setAttribute("aria-pressed", String(on));
};
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
function restoreFocus(key) {
  if (key != null)
    $("board")
      .querySelector(`[data-index="${key}"]`)
      ?.focus({ preventScroll: true });
}
function keyboardGrid(e) {
  const el = e.target.closest("[data-index]");
  if (!el) return false;
  const i = +el.dataset.index,
    n = levels[current].n,
    delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n }[e.key];
  if (delta) {
    e.preventDefault();
    const j = i + delta;
    if (
      j >= 0 &&
      j < n * n &&
      (!(e.key === "ArrowLeft" || e.key === "ArrowRight") ||
        Math.floor(i / n) === Math.floor(j / n))
    )
      $("board").querySelector(`[data-index="${j}"]`)?.focus();
    return true;
  }
  return false;
}
function blank() {
  return levels[current].cells.map(() => 0);
}
function validState(value) {
  return (
    Array.isArray(value) &&
    value.length === blank().length &&
    value.every(
      (v, i) =>
        [0, 1, 2].includes(v) && (levels[current].cells[i] === -2 || v === 0),
    )
  );
}
function render() {
  const level = levels[current],
    g = model.geometry(level),
    result = model.inspect(level, state),
    active = document.activeElement?.dataset.index;
  let html = `<div class="cells" style="--n:${level.n}" role="group" aria-label="照明棋盘">`;
  html += level.cells
    .map((v, i) => {
      const label = `第${Math.floor(i / level.n) + 1}行第${(i % level.n) + 1}列`;
      if (v !== -2)
        return `<button class="cell wall ${v >= 0 && (result.wallCounts[i] > v || (result.lit.length === g.white.length && result.badWalls.includes(i))) ? "bad" : ""}" data-index="${i}" aria-disabled="true" aria-label="${label}，${v < 0 ? "黑格" : v + "盏相邻灯"}">${v < 0 ? "" : v}</button>`;
      return `<button class="cell ${result.lit.includes(i) ? "lit" : ""} ${result.conflicts.includes(i) ? "bad" : ""}" data-index="${i}" aria-label="${label}，${state[i] === 1 ? "有灯" : state[i] === 2 ? "已排除" : result.lit.includes(i) ? "已照亮" : "未照亮"}" aria-pressed="${state[i] === 1}">${state[i] === 1 ? '<span class="lamp"></span>' : state[i] === 2 ? '<span class="mark">×</span>' : ""}</button>`;
    })
    .join("");
  $("board").innerHTML = html + "</div>";
  const excess = level.cells.some((v, i) => v >= 0 && result.wallCounts[i] > v);
  updateStatus(
    result.conflicts.length
      ? "灯互相照射，请移除冲突的灯"
      : excess
        ? "数字黑格旁的灯过多"
        : `已照亮 ${result.lit.length} / ${g.white.length} 格`,
    result.solved,
  );
  restoreFocus(active);
}
for (const [id, value] of [
  ["lamp-mode", 1],
  ["mark-mode", 2],
  ["erase-mode", 0],
])
  $(id).onclick = () => {
    mode = value;
    for (const [other, v] of [
      ["lamp-mode", 1],
      ["mark-mode", 2],
      ["erase-mode", 0],
    ])
      $(other).setAttribute("aria-pressed", String(v === mode));
  };
function action(target, value) {
  const el = target.closest("[data-index]");
  if (!el) return;
  const i = +el.dataset.index;
  if (levels[current].cells[i] !== -2) return;
  const next = state.slice(),
    v = value ?? mode;
  next[i] = next[i] === v ? 0 : v;
  commit(next);
}
$("board").onclick = (e) => action(e.target);
$("board").onkeydown = (e) => {
  if (keyboardGrid(e)) return;
  if ([" ", "Enter", "x", "X", "Delete", "Backspace"].includes(e.key)) {
    e.preventDefault();
    action(
      e.target,
      ["x", "X"].includes(e.key)
        ? 2
        : ["Delete", "Backspace"].includes(e.key)
          ? 0
          : undefined,
    );
  }
};
picker();
load();
