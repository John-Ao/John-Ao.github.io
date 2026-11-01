import { levels, groups, defaultLevel } from "./catalog.mjs";
import * as model from "./model.mjs";
import { STORAGE_KEY, readStore } from "./storage.mjs";
const $ = (id) => document.getElementById(id), KEY = STORAGE_KEY;
const store = readStore(localStorage);
const savedIndex = levels.findIndex(l => l.id === store.current);
let current = savedIndex >= 0 ? savedIndex : defaultLevel;
let state,
  history = [],
  won = false;
$("group").innerHTML = groups
  .map((group) => `<option value="${group}">${group} · ${levels.filter((l) => l.group === group).length} 题</option>`)
  .join("");
function picker() {
  const group = levels[current].group;
  $("group").value = group;
  $("level").innerHTML = levels
    .flatMap((l, i) =>
      l.group === group ? [`<option value="${i}">第 ${l.sourceNumber} 关</option>`] : [],
    )
    .join("");
  $("level").value = current;
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function save() {
  store.current = levels[current].id;
  store[levels[current].id] = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
}
function load() {
  history = [];
  state = validState(store[levels[current].id]) ? clone(store[levels[current].id]) : blank();
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
  $("status").textContent = won ? "已完成 ✓ 可选择其他关卡" : text;
  $("undo").disabled = !history.length;
}
function announce(text) {
  $("status").textContent = text;
}
$("group").onchange = () => {
  current = levels.findIndex((l) => l.group === $("group").value);
  picker();
  load();
};
$("next").onclick = () => {
  const next = levels.findIndex((l, i) => i > current && l.group === levels[current].group);
  if (next < 0) return;
  current = next;
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
  const l = levels[current];
  return { player: l.player, boxes: l.boxes.slice(), moves: 0, pushes: 0 };
}
function validState(value) {
  const l = levels[current];
  return (
    value &&
    typeof value === "object" &&
    Number.isInteger(value.player) &&
    value.player >= 0 &&
    value.player < l.n * l.n &&
    !l.walls[value.player] &&
    Array.isArray(value.boxes) &&
    value.boxes.length === l.boxes.length &&
    new Set(value.boxes).size === value.boxes.length &&
    value.boxes.every(
      (i) =>
        Number.isInteger(i) &&
        i >= 0 &&
        i < l.n * l.n &&
        !l.walls[i] &&
        i !== value.player,
    ) &&
    Number.isInteger(value.moves) &&
    value.moves >= 0 &&
    Number.isInteger(value.pushes) &&
    value.pushes >= 0 &&
    value.pushes <= value.moves
  );
}
function render() {
  const l = levels[current],
    active = document.activeElement?.dataset.index;
  let html = `<div class="cells" style="--n:${l.n}" role="group" aria-label="推箱子棋盘">`;
  html += l.walls
    .slice(0, l.rows.length * l.n)
    .map((wall, i) => {
      const box = state.boxes.includes(i),
        goal = l.goals.includes(i),
        player = state.player === i;
      return `<button class="cell ${wall ? "wall" : "floor"}" data-index="${i}" aria-disabled="${!!wall}" aria-label="第${Math.floor(i / l.n) + 1}行第${(i % l.n) + 1}列，${wall ? "墙" : player ? "人物" : box ? (goal ? "目标上的箱子" : "箱子") : goal ? "目标" : "地面"}">${!wall && goal ? '<span class="goal"></span>' : ""}${box ? `<span class="box ${goal ? "on-goal" : ""}">${goal ? "✓" : ""}</span>` : ""}${player ? '<span class="player"></span>' : ""}</button>`;
    })
    .join("");
  $("board").innerHTML = html + "</div>";
  updateStatus(
    `${state.moves} 步 · ${state.pushes} 次推动 · 已归位 ${state.boxes.filter((i) => l.goals.includes(i)).length} / ${l.goals.length}`,
    model.solved(l, state),
  );
  $("next").disabled = !levels.some((other, i) => i > current && other.group === l.group);
  restoreFocus(active);
}
function act(dir) {
  if (won) return;
  const next = model.move(levels[current], state, dir);
  if (next) commit(next);
  else announce("前方被挡住，可换个方向或撤销");
}
for (const button of document.querySelectorAll("[data-dir]"))
  button.onclick = () => act(button.dataset.dir);
$("board").onclick = (e) => {
  const el = e.target.closest("[data-index]");
  if (!el) return;
  const dest = +el.dataset.index;
  for (const dir of Object.keys(model.directions))
    if (model.adjacent(state.player, dir, levels[current].n) === dest) {
      act(dir);
      return;
    }
};
document.addEventListener("keydown", (e) => {
  if (
    document.querySelector("dialog[open]") ||
    ["SELECT", "INPUT"].includes(document.activeElement.tagName) ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  const dir = {
    ArrowUp: "U",
    ArrowRight: "R",
    ArrowDown: "D",
    ArrowLeft: "L",
    w: "U",
    d: "R",
    s: "D",
    a: "L",
  }[e.key];
  if (dir) {
    e.preventDefault();
    act(dir);
  }
});
picker();
load();
