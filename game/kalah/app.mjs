import { initial, legal, move, computer } from "./model.mjs";
const $ = (id) => document.getElementById(id),
  key = "kalah-v1";
let s = initial(),
  history = [],
  mode = "ai",
  busy = false,
  timer,
  last = null;
try {
  let x = JSON.parse(localStorage.getItem(key));
  if (x && x.s?.pits?.length === 14) {
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
  let active = legal(s);
  $("board").replaceChildren();
  for (let i = 0; i < 14; i++) {
    let e = document.createElement(i === 6 || i === 13 ? "div" : "button");
    if (i === 6 || i === 13) {
      e.className = "store";
      e.style.gridColumn = i === 13 ? 1 : 8;
      e.innerHTML = `<small>玩家${i === 6 ? "一" : "二"}</small>${s.pits[i]}<small>仓库</small>`;
    } else {
      let owner = i < 6 ? 1 : 2;
      e.style.gridColumn = i < 6 ? i + 2 : 14 - i;
      e.style.gridRow = i < 6 ? 2 : 1;
      e.textContent = s.pits[i];
      e.className = `${active.includes(i) && !busy ? "playable" : ""} ${i === last ? "last" : ""}`;
      e.dataset.index = i;
      e.setAttribute("aria-disabled", String(busy || !active.includes(i)));
      e.setAttribute(
        "aria-label",
        `玩家${owner} 第${i < 6 ? i + 1 : i - 6}坑，${s.pits[i]}颗`,
      );
      e.onclick = () => play(i);
    }
    $("board").append(e);
  }
  if (focused !== undefined)
    $("board")
      .querySelector(`[data-index="${focused}"]`)
      ?.focus({ preventScroll: true });
  $("status").textContent = s.ended
    ? (s.winner ? `玩家${s.winner === 1 ? "一" : "二"}获胜` : "平局") +
      ` · ${s.pits[6]} : ${s.pits[13]}`
    : busy
      ? "玩家二正在思考…"
      : `玩家${s.turn === 1 ? "一" : "二"} · 选择有棋子的坑${s.extra ? "（获得额外回合）" : ""}`;
  $("hint").textContent =
    (s.captured ? `刚捕获 ${s.captured} 颗。` : "") +
    "下方从左向右播撒 → 己仓 → 上方从右向左。";
  $("players").innerHTML =
    `<span class="${s.turn === 2 ? "active" : ""}">上方 · 玩家二${mode === "ai" ? "（电脑）" : ""}</span><span class="${s.turn === 1 ? "active" : ""}">下方 · 玩家一${mode === "ai" ? "（你）" : ""}</span>`;
  $("undo").disabled = !history.length;
}
function play(i) {
  if (busy || !legal(s).includes(i)) return;
  history.push(structuredClone(s));
  s = move(s, i);
  last = i;
  save();
  render();
  startAI();
}
function startAI() {
  if (mode !== "ai" || s.turn !== 2 || s.ended) return;
  busy = true;
  render();
  timer = setTimeout(() => {
    let i = computer(s);
    history.push(structuredClone(s));
    s = move(s, i);
    last = i;
    busy = false;
    save();
    render();
    startAI();
  }, 350);
}
$("undo").onclick = () => {
  clearTimeout(timer);
  busy = false;
  if (history.length) {
    s = history.pop();
    while (mode === "ai" && s.turn === 2 && history.length) s = history.pop();
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
  last = null;
  save();
  render();
}
$("new").onclick = () => reset();
$("mode").onchange = () => reset($("mode").value);
$("rules").onclick = () => $("help").showModal();
$("close").onclick = () => $("help").close();
render();
startAI();
