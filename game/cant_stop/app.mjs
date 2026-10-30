import { fresh, heights, options, roll, stop } from "./model.mjs";
const $ = (id) => document.getElementById(id);
let s,
  undo = null;
try {
  s = JSON.parse(localStorage.getItem("cant-stop-v1"));
} catch {}
if (
  !s ||
  !Array.isArray(s.pos) ||
  s.pos.length !== 2 ||
  !Array.isArray(s.claimed)
)
  s = fresh();
function render() {
  try {
    localStorage.setItem("cant-stop-v1", JSON.stringify(s));
  } catch {}
  $("players").innerHTML = [0, 1]
    .map(
      (p) =>
        `<div class="${s.player === p ? "active" : ""}"><b class="${p ? "two" : "one"}">${p ? "②" : "①"} 玩家 ${p + 1}</b> · 占领 ${s.claimed.filter((x) => x === p).length} / 3 ${s.player === p ? (s.winner !== null ? "· 获胜" : "· 当前回合") : ""}</div>`,
    )
    .join("");
  $("board").innerHTML = heights
    .map(
      (h, i) =>
        `<div class="column"><div class="steps">${Array.from({ length: h }, (_, j) => `<div class="step ${s.claimed[i] >= 0 ? "claimed" : ""}">${s.pos[0][i] === j + 1 ? '<span class="one">①</span>' : ""}${s.pos[1][i] === j + 1 ? '<span class="two">②</span>' : ""}${s.temp[i] === j + 1 ? '<span class="temp">▲</span>' : ""}</div>`).join("")}</div><b>${i + 2}</b></div>`,
    )
    .join("");
  $("message").textContent = s.message;
  $("dice").textContent = s.dice.map((x) => "⚀⚁⚂⚃⚄⚅"[x - 1]).join(" ");
  $("choices").replaceChildren();
  if (s.phase === "choose")
    options(s).forEach((o) => {
      let b = document.createElement("button");
      b.textContent = `${o.sums.join(" + ")} → 推进 ${o.moves.join("、")}`;
      b.onclick = () => {
        undo = structuredClone(s);
        s.temp = o.temp;
        s.phase = "decide";
        s.message = "继续掷骰，还是收手保留进度？";
        render();
      };
      $("choices").append(b);
    });
  $("roll").disabled = !["roll", "decide"].includes(s.phase);
  $("stop").disabled = s.phase !== "decide";
  $("undo").disabled = !undo;
}
$("roll").onclick = () => {
  undo = null;
  roll(
    s,
    Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1),
  );
  render();
};
$("stop").onclick = () => {
  undo = null;
  stop(s);
  render();
};
$("undo").onclick = () => {
  s = undo;
  undo = null;
  render();
};
$("new").onclick = () => {
  if (confirm("开始新局并替换当前进度？")) {
    s = fresh();
    undo = null;
    render();
  }
};
$("rules").onclick = () => $("help").showModal();
render();
