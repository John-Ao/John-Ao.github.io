import {
  tiles,
  orient,
  legal,
  placements,
  exitType,
  fresh,
  dice,
  score,
} from "./model.mjs";
const $ = (id) => document.getElementById(id);
let s;
try {
  s = JSON.parse(localStorage.getItem("railroad-ink-v1"));
} catch {}
if (
  !s ||
  !Array.isArray(s.board) ||
  s.board.length !== 49 ||
  !Array.isArray(s.dice)
)
  s = fresh();
let selection = null,
  rotation = 0,
  flipped = false,
  preview = null,
  history = [];
function svg(t) {
  if (!t) return "";
  let paths = "";
  t.e.forEach((v, d) => {
    if (!v) return;
    let end = [
      [50, 0],
      [100, 50],
      [50, 100],
      [0, 50],
    ][d];
    paths += `<path d="M50 50 L${end.join(" ")}" stroke="${v === 1 ? "#316e88" : "#554b45"}" stroke-width="${v === 1 ? 12 : 6}"/>`;
    if (v === 1)
      paths += `<path d="M50 50 L${end.join(" ")}" stroke="#fff" stroke-width="2" stroke-dasharray="5 5"/>`;
    else {
      for (let k = 12; k < 49; k += 9) {
        let x = 50 + ((end[0] - 50) * k) / 50,
          y = 50 + ((end[1] - 50) * k) / 50;
        paths += `<path d="M${x - (d % 2 ? 0 : 7)} ${y - (d % 2 ? 7 : 0)} L${x + (d % 2 ? 0 : 7)} ${y + (d % 2 ? 7 : 0)}" stroke="#554b45" stroke-width="3"/>`;
      }
    }
  });
  if (t.bridge)
    paths += `<rect x="39" y="39" width="22" height="22" fill="#fbfcf8"/><path d="${t.e[0] === 1 ? "M50 37 V63" : "M37 50 H63"}" stroke="#316e88" stroke-width="12"/><path d="${t.e[0] === 1 ? "M50 37 V63" : "M37 50 H63"}" stroke="white" stroke-width="2" stroke-dasharray="5 5"/>`;
  if (t.station)
    paths +=
      '<rect x="40" y="40" width="20" height="20" fill="#263e3c" stroke="white" stroke-width="2"/>';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${paths}</svg>`;
}
function selected() {
  return selection ? orient(selection.id, rotation, flipped) : null;
}
function clear() {
  selection = null;
  preview = null;
  rotation = 0;
  flipped = false;
}
function message(t) {
  $("message").textContent = t;
}
function tileButton(id, sel, disabled) {
  let b = document.createElement("button");
  b.className = "tile" + (selection?.key === sel.key ? " selected" : "");
  b.disabled = disabled;
  b.innerHTML =
    svg(
      orient(
        id,
        selection?.key === sel.key ? rotation : 0,
        selection?.key === sel.key ? flipped : false,
      ),
    ) + tiles[id].name;
  b.setAttribute("aria-label", tiles[id].name);
  b.onclick = () => {
    selection = { ...sel, id };
    rotation = 0;
    flipped = false;
    preview = null;
    message("点击绿色虚线格预览；可先旋转或翻面。");
    render();
  };
  return b;
}
function render() {
  try {
    localStorage.setItem("railroad-ink-v1", JSON.stringify(s));
  } catch {}
  $("round").textContent = s.done ? "七轮完成" : `第 ${s.round} / 7 轮`;
  $("board").replaceChildren();
  let t = selected();
  s.board.forEach((cell, i) => {
    let b = document.createElement("button");
    b.className =
      "cell" +
      (i % 7 >= 2 &&
      i % 7 <= 4 &&
      Math.floor(i / 7) >= 2 &&
      Math.floor(i / 7) <= 4
        ? " central"
        : "") +
      (t && !s.done && legal(s.board, i, t) ? " legal" : "") +
      (preview === i ? (legal(s.board, i, t) ? " preview" : " invalid") : "");
    b.setAttribute(
      "aria-label",
      `${Math.floor(i / 7) + 1} 行 ${(i % 7) + 1} 列，${cell ? cell.name : "空格"}${t && legal(s.board, i, t) ? "，可放置" : ""}`,
    );
    b.innerHTML =
      svg(preview === i && !cell ? t : cell) +
      (cell ? `<span class="roundmark">${cell.round}</span>` : "");
    for (let d = 0; d < 4; d++) {
      let e = exitType(i, d);
      if (e)
        b.innerHTML += `<span class="exit ${"nesw"[d]}">${e === 1 ? "公" : "铁"}</span>`;
    }
    b.onclick = () => {
      if (s.done) return;
      if (!t) {
        message("先选择一颗骰子或特殊路线。");
        return;
      }
      preview = i;
      message(
        legal(s.board, i, t)
          ? "预览有效，确认放置或继续调整方向。"
          : "不能放置：格子已占用、路线类型冲突或尚未连接路线／出口。",
      );
      render();
      $("board").children[i].focus();
    };
    b.onkeydown = (e) => {
      let delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
        e.key
      ];
      if (delta) {
        e.preventDefault();
        $("board").children[Math.max(0, Math.min(48, i + delta))].focus();
      }
    };
    $("board").append(b);
  });
  $("dice").replaceChildren();
  s.dice.forEach((id, i) => {
    if (id !== null)
      $("dice").append(
        tileButton(id, { key: "d" + i, index: i, special: false }, s.done),
      );
  });
  $("special").replaceChildren();
  for (let id = 9; id < 15; id++)
    $("special").append(
      tileButton(
        id,
        { key: "s" + id, special: true },
        s.done || s.specialRound || s.used.length === 3 || s.used.includes(id),
      ),
    );
  $("specialCount").textContent =
    `已用 ${s.used.length} / 3${s.specialRound ? " · 本轮已用" : ""}`;
  $("place").disabled =
    s.done || preview === null || !t || !legal(s.board, preview, t);
  $("rotate").disabled = $("flip").disabled = !t || s.done;
  $("cancel").disabled = preview === null;
  $("undo").disabled = !history.length || s.done;
  $("next").disabled =
    s.done ||
    s.dice.some((id) => id !== null && placements(s.board, id).length);
  $("next").textContent = s.round === 7 ? "完成并计分" : "结束本轮";
  if (s.done) {
    let z = score(s.board);
    $("score").innerHTML =
      `<strong>总分 ${z.total}</strong><br>出口网络 ${z.network} · 最长公路 ${z.highway} · 最长铁路 ${z.railway}<br>中央格 ${z.center} · 未连接端点 −${z.errors}`;
  } else
    $("score").textContent = "必须放置仍有合法位置的骰子后，才可结束本轮。";
}
$("rotate").onclick = () => {
  rotation = (rotation + 1) % 4;
  render();
};
$("flip").onclick = () => {
  flipped = !flipped;
  render();
};
$("cancel").onclick = () => {
  preview = null;
  render();
};
$("place").onclick = () => {
  let t = selected();
  if (!t || preview === null || !legal(s.board, preview, t)) return;
  history.push(structuredClone(s));
  s.board[preview] = { ...t, round: s.round };
  if (selection.special) {
    s.used.push(selection.id);
    s.specialRound = true;
  } else s.dice[selection.index] = null;
  clear();
  message("已放置。继续选择路线，或在没有可放骰子时结束本轮。");
  render();
};
$("undo").onclick = () => {
  if (history.length) {
    s = history.pop();
    clear();
    message("已撤销上一次放置。");
    render();
  }
};
$("next").onclick = () => {
  if (s.dice.some((id) => id !== null && placements(s.board, id).length))
    return;
  history = [];
  clear();
  if (s.round === 7) {
    s.done = true;
    message("本局完成，计分如下。");
  } else {
    s.round++;
    s.dice = dice();
    s.specialRound = false;
    message("新一轮：选择路线并连接到棋盘。");
  }
  render();
};
$("new").onclick = () => {
  if (confirm("开始新局并替换当前进度？")) {
    s = fresh();
    history = [];
    clear();
    message("选择骰子路线，再点击棋盘预览。");
    render();
  }
};
$("rules").onclick = () => $("help").showModal();
document.addEventListener("keydown", (e) => {
  if ($("help").open) return;
  if (e.key.toLowerCase() === "r" && selection) {
    e.preventDefault();
    $("rotate").click();
  }
  if (e.key.toLowerCase() === "f" && selection) {
    e.preventDefault();
    $("flip").click();
  }
  if (e.key === "Escape") {
    preview = null;
    render();
  }
});
render();
