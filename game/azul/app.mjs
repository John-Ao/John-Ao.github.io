import {
  colors,
  symbols,
  penalties,
  wallColor,
  fresh,
  canPlace,
  place,
  nextRound,
  aiMove,
  winners,
} from "./model.mjs";
const $ = (id) => document.getElementById(id);
let s;
try {
  s = JSON.parse(localStorage.getItem("azul-v1"));
} catch {}
if (!s || !Array.isArray(s.players) || !Array.isArray(s.factories)) s = fresh();
let selection = null,
  timer = null;
const name = (p) => (s.mode === "ai" ? (p ? "电脑" : "你") : `玩家 ${p + 1}`);
const tile = (color, ghost = false) =>
  `<span class="tile t${color}${ghost ? " ghost" : ""}" aria-hidden="true">${symbols[color]}</span>`;
function save() {
  try {
    localStorage.setItem("azul-v1", JSON.stringify(s));
  } catch {}
}
function market(pile, source) {
  const wrap = document.createElement("div");
  wrap.className = "market";
  for (let color of [...new Set(pile)].sort()) {
    let b = document.createElement("button"),
      count = pile.filter((x) => x === color).length;
    b.className =
      selection?.source === source && selection.color === color
        ? "selected-source"
        : "";
    b.innerHTML = tile(color) + `<span>×${count}</span>`;
    b.setAttribute(
      "aria-label",
      `${source === 5 ? "中央" : "工厂" + (source + 1)}，${colors[color]}色 ${count} 块`,
    );
    b.disabled = s.phase !== "take" || (s.mode === "ai" && s.player === 1);
    b.onclick = () => {
      selection = { source, color };
      render();
    };
    wrap.append(b);
  }
  return wrap;
}
function render() {
  save();
  const human = !(s.mode === "ai" && s.player === 1),
    active = s.phase === "take";
  $("round").textContent =
    `第 ${s.round} 轮 · ${active ? name(s.player) + "选砖" : s.phase === "end" ? "对局结束" : "本轮结算"}`;
  $("factories").replaceChildren();
  s.factories.forEach((f, i) => {
    let div = document.createElement("section");
    div.className = "factory";
    div.innerHTML = `<small>工厂 ${i + 1}</small>`;
    div.append(market(f, i));
    $("factories").append(div);
  });
  $("center").replaceChildren(...market(s.center, 5).children);
  $("marker").textContent = s.marker
    ? "① 先手标记在中央"
    : `① 下轮先手：${name(s.starter)}`;
  $("cancel").disabled = !selection;
  $("next").hidden = s.phase !== "round";
  let amount = selection
    ? (selection.source === 5
        ? s.center
        : s.factories[selection.source]
      ).filter((c) => c === selection.color).length
    : 0;
  $("message").textContent = !active
    ? s.phase === "end"
      ? `${winners(s).map(name).join("、")}获胜。`
      : "本轮已铺墙并扣除落砖；未完成图案行保留。"
    : !human
      ? "电脑正在选砖…"
      : selection
        ? `已选 ${colors[selection.color]}色 ${amount} 块：点击自己可用的图案行，或全部放地板。`
        : "从任一工厂或中央选择一种颜色，取该色全部瓷砖。";
  $("boards").replaceChildren();
  s.players.forEach((p, index) => {
    const section = document.createElement("section");
    section.className =
      "player-board" + (active && s.player === index ? " active" : "");
    section.innerHTML = `<h2><span>${name(index)}</span><span>${p.score} 分</span></h2><div class="board-labels"><span>图案行 →</span><span>墙 · 淡色为空位</span></div>`;
    for (let r = 0; r < 5; r++) {
      let row = document.createElement("div");
      row.className = "row";
      let b = document.createElement("button"),
        valid =
          active &&
          human &&
          s.player === index &&
          selection &&
          canPlace(p, r, selection.color);
      b.className = "pattern" + (valid ? " legal" : "");
      b.disabled = !valid;
      const line = p.lines[r];
      b.innerHTML = Array.from({ length: r + 1 }, (_, i) =>
        i < r + 1 - line.length
          ? `<span class="tile empty">${r + 1}</span>`
          : tile(line[0]),
      ).join("");
      b.setAttribute(
        "aria-label",
        `${name(index)}图案行${r + 1}，已有${line.length}块${line.length ? colors[line[0]] + "色" : ""}${valid ? "，可放置" : ""}`,
      );
      b.onclick = () => commit(r);
      row.append(b);
      const wall = document.createElement("div");
      wall.className = "wall";
      wall.setAttribute(
        "aria-label",
        `墙第${r + 1}行，已放${p.wall[r].filter(Boolean).length}块`,
      );
      wall.innerHTML = p.wall[r]
        .map((filled, c) => tile(wallColor(r, c), !filled))
        .join("");
      row.append(wall);
      section.append(row);
    }
    let floor = document.createElement("div");
    floor.className = "floor";
    floor.innerHTML =
      "<small>地板</small>" +
      penalties
        .map(
          (pen, i) =>
            `<span class="floor-slot"><span>−${pen}</span>${p.floor[i] === -1 ? '<span class="tile">①</span>' : p.floor[i] !== undefined ? tile(p.floor[i]) : '<span class="tile empty"></span>'}</span>`,
        )
        .join("");
    section.append(floor);
    let drop = document.createElement("button");
    drop.className = "floor-action";
    drop.textContent = "全部放到地板";
    drop.disabled = !active || !human || s.player !== index || !selection;
    drop.onclick = () => commit(-1);
    section.append(drop);
    $("boards").append(section);
  });
  $("result").innerHTML = !active
    ? `<div class="round-result">${s.history
        .at(-1)
        .map(
          (r, p) =>
            `${name(p)}：铺墙 +${r.gained}，地板 −${r.loss}${r.bonus ? `，终局奖励 +${r.bonus.total}（横排${r.bonus.rows} / 竖列${r.bonus.columns} / 同色${r.bonus.sets}）` : ""}`,
        )
        .join("<br>")}</div>`
    : "";
  if (active && !human && !timer) {
    timer = setTimeout(() => {
      timer = null;
      if (s.mode === "ai" && s.player === 1 && s.phase === "take") {
        place(s, aiMove(s));
        render();
      }
    }, 350);
  }
}
function commit(row) {
  place(s, { ...selection, row });
  selection = null;
  render();
}
$("cancel").onclick = () => {
  selection = null;
  render();
};
$("next").onclick = () => {
  nextRound(s);
  selection = null;
  render();
};
$("rules").onclick = () => $("help").showModal();
$("new").onclick = () => {
  $("mode").value = s.mode;
  $("setup").showModal();
};
$("cancelNew").onclick = () => $("setup").close();
$("start").onclick = () => {
  clearTimeout(timer);
  timer = null;
  s = fresh($("mode").value);
  selection = null;
  $("setup").close();
  render();
};
render();
