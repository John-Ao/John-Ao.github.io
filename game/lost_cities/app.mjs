import {
  colors,
  fresh,
  play,
  draw,
  canPlay,
  scores,
  nextRound,
  aiPlay,
  aiDraw,
} from "./model.mjs";
const $ = (id) => document.getElementById(id),
  palette = ["#ba9834", "#3986aa", "#929ca5", "#438766", "#ba5948"];
let s;
try {
  s = JSON.parse(localStorage.getItem("lost-cities-v1"));
} catch {}
if (!s || !Array.isArray(s.hands) || s.hands.length !== 2) s = fresh();
let selected = null,
  undo = null,
  locked = s.mode === "local",
  timer = null;
const name = (p) => (s.mode === "ai" ? (p ? "电脑" : "你") : `玩家 ${p + 1}`);
const value = (c) => c.v || "投资";
function save() {
  try {
    localStorage.setItem("lost-cities-v1", JSON.stringify(s));
  } catch {}
}
function render() {
  save();
  const human = !(s.mode === "ai" && s.player === 1),
    ended = ["round", "end"].includes(s.phase);
  $("round").textContent =
    `第 ${s.round} / 3 轮 · ${ended ? "本轮结束" : name(s.player) + "行动"}`;
  $("scores").innerHTML = s.totals
    .map(
      (n, p) =>
        `<div class="${s.player === p && !ended ? "active" : ""}"><strong>${name(p)}</strong> · 累计 <b>${n}</b><br><small>本轮远征 ${scores(s)[p].reduce((a, b) => a + b, 0)} 分</small></div>`,
    )
    .join("");
  $("routes").innerHTML = [1, 0]
    .map(
      (p) =>
        `<section class="route-board"><h2>${name(p)}的远征</h2><div class="columns">${colors.map((c, i) => `<div class="column" style="--color:${palette[i]}"><b>${c}</b><div class="chips">${s.routes[p][i].map((c) => `<span class="chip">${value(c)}</span>`).join("") || "—"}</div><small>${scores(s)[p][i]} 分 · ${s.routes[p][i].length} 张</small></div>`).join("")}</div></section>`,
    )
    .join("");
  $("discards").replaceChildren();
  s.discards.forEach((pile, c) => {
    let b = document.createElement("button");
    b.style.setProperty("--color", palette[c]);
    b.innerHTML = `${colors[c]}弃牌<b>${pile.length ? value(pile.at(-1)) : "—"}</b><small>${pile.length} 张</small>`;
    b.disabled =
      s.phase !== "draw" ||
      !human ||
      locked ||
      !pile.length ||
      s.forbidden === c;
    b.onclick = () => take(c);
    $("discards").append(b);
  });
  $("draw").textContent = `从牌堆抽牌 · 剩 ${s.deck.length} 张`;
  $("draw").disabled = s.phase !== "draw" || !human || locked;
  $("message").textContent = ended
    ? s.phase === "end"
      ? s.totals[0] === s.totals[1]
        ? "三轮总分相同，平局。"
        : `${name(s.totals[0] > s.totals[1] ? 0 : 1)}获胜。`
      : "本轮已结算，可查看分项后开始下一轮。"
    : !human
      ? "电脑正在思考…"
      : locked
        ? "请将设备交给当前玩家。"
        : s.phase === "draw"
          ? "已出牌：选择牌堆或可用弃牌堆抽一张。"
          : "选择手牌，再加入远征或弃牌。";
  $("gate").hidden = !locked || ended || !human;
  $("gateText").textContent =
    `轮到${name(s.player)}。确认其他玩家看不到屏幕后再查看。`;
  $("play").hidden = locked || ended || !human;
  $("handTitle").textContent =
    `${name(s.player)}的手牌 · ${s.hands[s.player].length} 张`;
  $("hand").replaceChildren();
  if (!locked && human && !ended)
    s.hands[s.player].forEach((c, index) => {
      let b = document.createElement("button");
      b.className = "card" + (selected === index ? " selected" : "");
      b.style.setProperty("--color", palette[c.c]);
      b.innerHTML = `<span class="suit">${colors[c.c]}</span><b>${value(c)}</b><small>${c.v ? "远征牌" : "倍率 +1"}</small>`;
      b.disabled = s.phase !== "play";
      b.setAttribute("aria-pressed", selected === index);
      b.onclick = () => {
        selected = selected === index ? null : index;
        render();
      };
      $("hand").append(b);
    });
  const card = s.hands[s.player][selected];
  $("expedition").disabled =
    s.phase !== "play" || !card || !canPlay(s.routes[s.player][card.c], card);
  $("discard").disabled = s.phase !== "play" || !card;
  $("undo").disabled = !undo || s.phase !== "draw";
  $("hide").hidden = s.mode !== "local";
  $("result").hidden = !ended;
  $("next").hidden = s.phase !== "round";
  if (ended) {
    $("resultText").innerHTML =
      "<table><thead><tr><th>轮次</th><th>" +
      name(0) +
      "</th><th>" +
      name(1) +
      "</th></tr></thead><tbody>" +
      s.results
        .map(
          (r, i) =>
            `<tr><td>${i + 1}</td><td>${r.points[0]}</td><td>${r.points[1]}</td></tr>`,
        )
        .join("") +
      "</tbody></table>";
  }
  if (!human && !ended && !timer) {
    timer = setTimeout(() => {
      timer = null;
      if (
        s.mode !== "ai" ||
        s.player !== 1 ||
        ["round", "end"].includes(s.phase)
      )
        return;
      if (s.phase === "play") {
        const m = aiPlay(s);
        play(s, m.index, m.discard);
      }
      draw(s, aiDraw(s));
      render();
    }, 350);
  }
}
function commit(discard) {
  undo = structuredClone(s);
  play(s, selected, discard);
  selected = null;
  render();
}
function take(source) {
  draw(s, source);
  undo = null;
  selected = null;
  locked = s.mode === "local";
  render();
}
$("expedition").onclick = () => commit(false);
$("discard").onclick = () => commit(true);
$("draw").onclick = () => take(-1);
$("undo").onclick = () => {
  s = undo;
  undo = null;
  selected = null;
  render();
};
$("hide").onclick = () => {
  locked = true;
  render();
};
$("reveal").onclick = () => {
  locked = false;
  render();
};
$("next").onclick = () => {
  nextRound(s);
  locked = s.mode === "local";
  selected = null;
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
  undo = null;
  selected = null;
  locked = s.mode === "local";
  $("setup").close();
  render();
};
render();
