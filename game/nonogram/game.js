import { clues, runs, solved, levels } from "./model.mjs";
const KEY = "nonogram-v1";
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
  { label: "精选 · 8 题", indices: Array.from({ length: 8 }, (_, i) => i) },
];
for (const size of [5, 7, 10]) {
  const indices = levels.flatMap((entry, i) =>
    i >= 8 && entry.grid.length === size ? [i] : [],
  );
  for (let start = 0; start < indices.length; start += 20) {
    groups.push({
      label: `${size}×${size} · ${start + 1}–${Math.min(start + 20, indices.length)}`,
      indices: indices.slice(start, start + 20),
    });
  }
}
$("group").innerHTML = groups
  .map((group, i) => `<option value="${i}">${group.label}</option>`)
  .join("");
function updatePicker() {
  const groupIndex = groups.findIndex((group) => group.indices.includes(level));
  $("group").value = groupIndex;
  $("level").innerHTML = groups[groupIndex].indices
    .map(
      (i) =>
        `<option value="${i}">${i < 8 ? `${i + 1} · ${levels[i].name}` : `第 ${((i - 8) % 40) + 1} 题`}</option>`,
    )
    .join("");
  $("level").value = level;
}
$("group").onchange = () => {
  level = groups[+$("group").value].indices[0];
  updatePicker();
  load();
};
updatePicker();
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
let mode = 1,
  drag = null;
$("zoom").onclick = () => {
  const enlarged = $("board").classList.toggle("enlarged");
  $("zoom").setAttribute("aria-pressed", String(enlarged));
  $("zoom").textContent = enlarged ? "适应屏幕" : "放大";
  document.querySelector(".note").textContent = enlarged
    ? "点击或拖动格子；在数字区域左右滑动棋盘。"
    : "选择涂色或标叉，点击或拖动格子。";
};
function blank() {
  const g = levels[level].grid;
  return Array(g.length * g[0].length).fill(0);
}
function validState(v) {
  return (
    Array.isArray(v) &&
    v.length === blank().length &&
    v.every((x) => [0, 1, 2].includes(x))
  );
}
function matrix() {
  const g = levels[level].grid,
    w = g[0].length;
  return g.map((_, r) => state.slice(r * w, (r + 1) * w));
}
function isSolved() {
  return solved(matrix(), levels[level].grid);
}
function progress() {
  const { rows, cols } = clues(levels[level].grid),
    current = clues(matrix().map((r) => r.map((v) => +(v === 1))));
  const done = [...rows, ...cols].filter(
    (v, i) =>
      JSON.stringify(v) ===
      JSON.stringify([...current.rows, ...current.cols][i]),
  ).length;
  return `按数字涂色 · ${done} / ${rows.length + cols.length} 行列符合`;
}
function render() {
  const g = levels[level].grid,
    w = g[0].length,
    { rows, cols } = clues(g),
    b = matrix(),
    active = document.activeElement?.dataset.cell;
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let s =
    '<table class="nonogram" aria-label="数织棋盘"><colgroup><col style="width:20%">' +
    g[0].map(() => "<col>").join("") +
    '</colgroup><thead><tr><th aria-label="行列线索"></th>' +
    cols
      .map(
        (c, i) =>
          `<th class="column ${equal(runs(b.map((r) => +(r[i] === 1))), c) ? "done" : ""}" scope="col" aria-label="第${i + 1}列：${c.join("，")}">${c.join("<br>")}</th>`,
      )
      .join("") +
    "</tr></thead><tbody>";
  s += g
    .map(
      (row, r) =>
        `<tr class="${(r + 1) % 5 === 0 ? "block" : ""}"><th scope="row">${rows[r].join(" ")}</th>` +
        row
          .map((_, c) => {
            const i = r * w + c;
            return `<td class="${(c + 1) % 5 === 0 ? "block" : ""}"><button class="cell ${["", "fill", "mark"][state[i]]}" data-cell="${i}" aria-label="第${r + 1}行第${c + 1}列：${["空白", "涂色", "排除"][state[i]]}" aria-pressed="${state[i] === 1}">${state[i] === 2 ? "×" : ""}</button></td>`;
          })
          .join("") +
        "</tr>",
    )
    .join("");
  $("board").innerHTML = s + "</tbody></table>";
  updateStatus();
  if (active != null)
    $("board")
      .querySelector(`[data-cell="${active}"]`)
      ?.focus({ preventScroll: true });
}
for (const [id, v] of [
  ["fill", 1],
  ["mark", 2],
  ["erase", 0],
])
  $(id).onclick = () => {
    mode = v;
    for (const [other, value] of [
      ["fill", 1],
      ["mark", 2],
      ["erase", 0],
    ])
      $(other).setAttribute("aria-pressed", String(mode === value));
  };
function change(i, v) {
  const next = state.slice();
  next[i] = v;
  commit(next);
}
$("board").onpointerdown = (e) => {
  const el = e.target.closest("[data-cell]");
  if (!el || won || e.button > 0) return;
  e.preventDefault();
  const i = +el.dataset.cell;
  el.focus({ preventScroll: true });
  drag = {
    before: state.slice(),
    value: state[i] === mode ? 0 : mode,
    seen: new Set([i]),
    count: 0,
  };
  const next = state.slice();
  next[i] = drag.value;
  if (next[i] !== state[i]) {
    history.push(state.slice());
    drag.count++;
    state = next;
    render();
    save();
  }
};
$("board").onpointermove = (e) => {
  if (!drag || won) return;
  const el = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest("[data-cell]");
  if (!el) return;
  const i = +el.dataset.cell;
  if (drag.seen.has(i)) return;
  drag.seen.add(i);
  if (state[i] === drag.value) return;
  if (!drag.count) {
    history.push(drag.before);
    drag.count++;
  }
  state[i] = drag.value;
  render();
  save();
};
function endDrag() {
  drag = null;
}
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);
$("board").onkeydown = (e) => {
  const el = e.target.closest("[data-cell]");
  if (!el) return;
  const i = +el.dataset.cell,
    w = levels[level].grid[0].length;
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -w, ArrowDown: w };
  if (e.key in moves) {
    e.preventDefault();
    const j = i + moves[e.key];
    if (j >= 0 && j < state.length)
      $("board").querySelector(`[data-cell="${j}"]`)?.focus();
  } else if ([" ", "Enter", "x", "X", "Delete", "Backspace"].includes(e.key)) {
    e.preventDefault();
    change(
      i,
      ["x", "X"].includes(e.key)
        ? 2
        : ["Delete", "Backspace"].includes(e.key)
          ? 0
          : state[i] === mode
            ? 0
            : mode,
    );
  }
};
// Keyboard and assistive-technology generated clicks have no pointer event.
$("board").onclick = (e) => {
  if (e.detail !== 0) return;
  const el = e.target.closest("[data-cell]");
  if (el) {
    const i = +el.dataset.cell;
    change(i, state[i] === mode ? 0 : mode);
  }
};
load();
