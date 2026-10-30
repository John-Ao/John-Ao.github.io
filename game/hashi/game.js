import { levels } from "./levels.mjs";
import * as model from "./model.mjs";
const $ = (id) => document.getElementById(id),
  KEY = "hashi" + "-v1";
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
  return model.geometry(levels[current]).edges.map(() => 0);
}
function validState(value) {
  return (
    Array.isArray(value) &&
    value.length === blank().length &&
    value.every((v) => [0, 1, 2].includes(v))
  );
}
function render() {
  const level = levels[current],
    g = model.geometry(level),
    result = model.inspect(level, state),
    active = document.activeElement?.dataset.index,
    step = 50,
    off = 30,
    size = (level.n - 1) * step + off * 2;
  let svg = `<svg viewBox="0 0 ${size} ${size}" role="group" aria-label="桥梁棋盘">`;
  svg += g.edges
    .map((e, i) => {
      const a = level.islands[e.a],
        b = level.islands[e.b],
        x1 = a.c * step + off,
        y1 = a.r * step + off,
        x2 = b.c * step + off,
        y2 = b.r * step + off,
        minX = Math.min(x1, x2),
        minY = Math.min(y1, y2),
        length = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      const lines = state[i] === 2 ? [-5, 5] : [0];
      return `<g class="target" role="button" tabindex="0" data-index="${i}" aria-label="第${e.a + 1}岛至第${e.b + 1}岛：${state[i]}座桥" aria-pressed="${state[i] > 0}"><rect class="hit" x="${e.h ? minX + 22 : minX - 23}" y="${e.h ? minY - 23 : minY + 22}" width="${e.h ? length - 44 : 46}" height="${e.h ? 46 : length - 44}"/>${state[i] === 0 ? `<line class="guide" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` : lines.map((d) => `<line class="bridge" x1="${x1 + (e.h ? 0 : d)}" y1="${y1 + (e.h ? d : 0)}" x2="${x2 + (e.h ? 0 : d)}" y2="${y2 + (e.h ? d : 0)}"/>`).join("")}</g>`;
    })
    .join("");
  svg += level.islands
    .map(
      (p, i) =>
        `<circle class="island ${result.degrees[i] === p.value ? "done" : result.degrees[i] > p.value ? "bad" : ""}" cx="${p.c * step + off}" cy="${p.r * step + off}" r="19"/><text class="number" x="${p.c * step + off}" y="${p.r * step + off}">${p.value}</text>`,
    )
    .join("");
  $("board").innerHTML = svg + "</svg>";
  const completed = result.degrees.filter(
    (v, i) => v === level.islands[i].value,
  ).length;
  updateStatus(
    result.crossed
      ? "桥梁相交，请移除交叉的桥"
      : result.degrees.some((v, i) => v > level.islands[i].value)
        ? "有岛屿桥数过多，请减少桥"
        : completed === level.islands.length && !result.connected
          ? "桥数符合，但岛屿尚未全部连通"
          : `桥数符合 ${completed} / ${level.islands.length} 岛`,
    result.solved,
  );
  restoreFocus(active);
}
function action(target, value) {
  const el = target.closest("[data-index]");
  if (!el) return;
  const i = +el.dataset.index,
    next = state.slice();
  next[i] = value ?? (next[i] + 1) % 3;
  commit(next);
}
$("board").onclick = (e) => action(e.target);
$("board").onkeydown = (e) => {
  if ([" ", "Enter", "0", "1", "2", "Delete", "Backspace"].includes(e.key)) {
    e.preventDefault();
    action(
      e.target,
      ["0", "1", "2"].includes(e.key)
        ? +e.key
        : ["Delete", "Backspace"].includes(e.key)
          ? 0
          : undefined,
    );
  }
};
picker();
load();
