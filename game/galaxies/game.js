import { levels } from "./levels.mjs";
import * as model from "./model.mjs";
const $ = (id) => document.getElementById(id),
  KEY = "galaxies" + "-v1";
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
  return model.edges(levels[current].n).map(() => 0);
}
function validState(value) {
  return (
    Array.isArray(value) &&
    value.length === blank().length &&
    value.every((v) => [0, 1].includes(v))
  );
}
function render() {
  const level = levels[current],
    n = level.n,
    es = model.edges(n),
    result = model.inspect(level, state),
    active = document.activeElement?.dataset.index,
    step = 60,
    off = 20,
    size = n * step + off * 2;
  let svg = `<svg viewBox="0 0 ${size} ${size}" role="group" aria-label="星系棋盘">`;
  for (let i = 0; i < n * n; i++)
    if (result.valid[result.labels[i]])
      svg += `<rect class="valid-region" x="${off + (i % n) * step}" y="${off + Math.floor(i / n) * step}" width="${step}" height="${step}"/>`;
  svg += es
    .map((e, i) => {
      const x = off + e.c * step,
        y = off + e.r * step;
      return `<g class="target" role="button" tabindex="0" data-index="${i}" aria-label="${e.h ? "横" : "竖"}边，第${e.r + 1}行第${e.c + 1}列：${state[i] ? "有边界" : "无边界"}" aria-pressed="${!!state[i]}"><rect class="hit" x="${x + (e.h ? 8 : -18)}" y="${y + (e.h ? -18 : 8)}" width="${e.h ? step - 16 : 36}" height="${e.h ? 36 : step - 16}"/><line class="${state[i] ? "boundary" : "gridline"}" x1="${x}" y1="${y}" x2="${x + (e.h ? step : 0)}" y2="${y + (e.h ? 0 : step)}"/></g>`;
    })
    .join("");
  svg += `<rect x="${off}" y="${off}" width="${n * step}" height="${n * step}" fill="none" stroke="#526f61" stroke-width="3" pointer-events="none"/>`;
  svg += level.centers
    .map(
      (c) =>
        `<circle class="center" cx="${off + (c.c2 / 2 + 0.5) * step}" cy="${off + (c.r2 / 2 + 0.5) * step}" r="7"/>`,
    )
    .join("");
  $("board").innerHTML = svg + "</svg>";
  updateStatus(
    `已确认 ${result.valid.filter(Boolean).length} / ${level.centers.length} 个星系`,
    result.solved,
  );
  restoreFocus(active);
}
function action(target, value) {
  const el = target.closest("[data-index]");
  if (!el) return;
  const i = +el.dataset.index,
    next = state.slice();
  next[i] = value ?? 1 - next[i];
  commit(next);
}
$("board").onclick = (e) => action(e.target);
$("board").onkeydown = (e) => {
  if ([" ", "Enter", "Delete", "Backspace"].includes(e.key)) {
    e.preventDefault();
    action(e.target, ["Delete", "Backspace"].includes(e.key) ? 0 : undefined);
  }
};
picker();
load();
