import { initial, rays, move, computer } from "./model.mjs";
const $ = (id) => document.getElementById(id),
  key = "amazons-v1";
let s = initial(),
  history = [],
  mode = "ai",
  from = null,
  to = null,
  busy = false,
  timer,
  last = null;
try {
  let x = JSON.parse(localStorage.getItem(key));
  if (x && x.s?.board?.length === 100) {
    s = x.s;
    history = x.history || [];
    mode = x.mode || "ai";
  }
} catch {}
$("mode").value = mode;
function save() {
  try {
    localStorage.setItem(key, JSON.stringify({ s, history, mode }));
  } catch {}
}
function render() {
  const focused = document.activeElement?.dataset.index;
  let b = [...s.board];
  if (to !== null) {
    b[from] = 0;
    b[to] = s.turn;
  }
  let legal = from === null ? [] : rays(b, to ?? from);
  $("board").replaceChildren();
  b.forEach((v, i) => {
    let e = document.createElement("button");
    e.dataset.index = i;
    e.tabIndex = i === Number(focused ?? 60) ? 0 : -1;
    e.textContent = v === 1 ? "●" : v === 2 ? "●" : v === 3 ? "×" : "";
    e.className = [
      (Math.floor(i / 10) + (i % 10)) % 2 ? "dark" : "",
      v === 1 ? "white" : v === 2 ? "black" : v === 3 ? "arrow" : "",
      i === (to ?? from) ? "selected" : "",
      legal.includes(i) ? "legal" : "",
      i === last ? "last" : "",
    ].join(" ");
    e.setAttribute(
      "aria-label",
      `${String.fromCharCode(65 + (i % 10))}${10 - Math.floor(i / 10)} ${v === 1 ? "白棋" : v === 2 ? "黑棋" : v === 3 ? "箭" : legal.includes(i) ? "可选位置" : "空格"}`,
    );
    e.onclick = () => click(i);
    $("board").append(e);
  });
  if (focused !== undefined)
    $("board")
      .querySelector(`[data-index="${focused}"]`)
      ?.focus({ preventScroll: true });
  $("status").textContent = s.winner
    ? `${s.winner === 1 ? "白方" : "黑方"}获胜 · 对方无路可走`
    : busy
      ? "黑方正在思考…"
      : `${s.turn === 1 ? "白方" : "黑方"} · ${from === null ? "选择棋子" : to === null ? "选择移动位置" : "选择射箭位置"}`;
  $("hint").textContent =
    to !== null
      ? "点圆点位置射箭；按 Esc 或撤销取消本次移动。"
      : from !== null
        ? "圆点为可移动位置；再点已选棋子可取消。"
        : "● 白方在下，黑方在上；× 为封锁格。";
  $("undo").disabled = !history.length && from === null;
  $("players").innerHTML =
    `<span class="${s.turn === 1 ? "active" : ""}">白方${mode === "ai" ? " · 你" : ""}</span><span class="${s.turn === 2 ? "active" : ""}">黑方${mode === "ai" ? " · 电脑" : ""}</span>`;
}
function click(i) {
  if (busy || s.winner) return;
  if (from === null) {
    if (s.board[i] === s.turn) from = i;
  } else if (to === null) {
    if (i === from) from = null;
    else if (s.board[i] === s.turn) from = i;
    else if (rays(s.board, from).includes(i)) to = i;
  } else {
    let b = [...s.board];
    b[from] = 0;
    b[to] = s.turn;
    if (rays(b, to).includes(i)) {
      history.push(structuredClone(s));
      s = move(s, from, to, i);
      last = i;
      from = to = null;
      save();
      startAI();
    }
  }
  render();
}
function startAI() {
  if (mode !== "ai" || s.turn !== 2 || s.winner) return;
  busy = true;
  render();
  timer = setTimeout(() => {
    let m = computer(s);
    if (m) {
      history.push(structuredClone(s));
      s = move(s, m.from, m.to, m.arrow);
      last = m.arrow;
    }
    busy = false;
    save();
    render();
  }, 100);
}
$("undo").onclick = () => {
  clearTimeout(timer);
  busy = false;
  if (from !== null) {
    from = to = null;
  } else if (history.length) {
    s = history.pop();
    if (mode === "ai" && s.turn === 2 && history.length) s = history.pop();
  }
  last = null;
  save();
  render();
};
function reset(next = mode) {
  if (!confirm("开始新局将替换当前进度，确定吗？")) {
    $("mode").value = mode;
    return;
  }
  clearTimeout(timer);
  busy = false;
  mode = next;
  s = initial();
  history = [];
  from = to = last = null;
  save();
  render();
}
$("new").onclick = () => reset();
$("mode").onchange = () => reset($("mode").value);
$("rules").onclick = () => $("help").showModal();
$("close").onclick = () => $("help").close();
$("board").addEventListener("keydown", (e) => {
  const index = Number(e.target.dataset.index);
  if (!Number.isInteger(index)) return;
  let row = Math.floor(index / 10),
    col = index % 10;
  if (e.key === "ArrowLeft") col = Math.max(0, col - 1);
  else if (e.key === "ArrowRight") col = Math.min(9, col + 1);
  else if (e.key === "ArrowUp") row = Math.max(0, row - 1);
  else if (e.key === "ArrowDown") row = Math.min(9, row + 1);
  else return;
  e.preventDefault();
  e.target.tabIndex = -1;
  const next = $("board").querySelector(`[data-index="${row * 10 + col}"]`);
  next.tabIndex = 0;
  next.focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("help").open && from !== null) {
    from = to = null;
    render();
  }
});
render();
startAI();
