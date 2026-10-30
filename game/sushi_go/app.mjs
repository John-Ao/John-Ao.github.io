import { TYPES, fresh, turn, nextRound, aiChoice, winners } from "./model.mjs";
const $ = (id) => document.getElementById(id),
  foodColors = {
    tempura: "#f0d99b",
    sashimi: "#f3c4bd",
    dumpling: "#e4ddba",
    maki1: "#c6ddca",
    maki2: "#c6ddca",
    maki3: "#c6ddca",
    salmon: "#f1c9b1",
    squid: "#dddbe2",
    egg: "#f5e5a8",
    pudding: "#e5cfb0",
    wasabi: "#cbe1af",
    chopsticks: "#ded2c0",
  };
let s;
try {
  s = JSON.parse(localStorage.getItem("sushi-go-v1"));
} catch {}
if (!s || ![3, 4, 5].includes(s.n) || !Array.isArray(s.hands)) s = fresh();
let selected = [];
const name = (p) => (p ? `电脑 ${p}` : "你");
function save() {
  try {
    localStorage.setItem("sushi-go-v1", JSON.stringify(s));
  } catch {}
}
function render() {
  save();
  const picking = s.phase === "pick";
  $("round").textContent =
    `第 ${s.round} / 3 轮 · ${picking ? "第 " + s.turn + " 次选牌" : "本轮结束"}`;
  $("players").innerHTML = s.table
    .map((t, p) => {
      const grouped = new Map();
      for (let c of t) {
        let key = c.type + (c.mult === 3 ? "×3" : c.used ? "已用" : "");
        if (!grouped.has(key)) grouped.set(key, { card: c, n: 0 });
        grouped.get(key).n++;
      }
      return `<section class="player ${p === 0 ? "you" : ""} ${t.length ? "" : "empty-player"}"><h2><span>${name(p)}</span><span>${s.totals[p]} 分</span></h2><div class="tableau">${[...grouped.values()].map(({ card: c, n }) => `<span class="food" style="--food:${foodColors[c.type]}"><b>${TYPES[c.type].symbol}</b>${TYPES[c.type].name}${c.mult === 3 ? " ×3" : ""}${c.used ? " ✓" : ""} · ${n}</span>`).join("") || '<span class="muted">尚未揭牌</span>'}</div><p class="pudding">保留布丁 ${s.dessert[p].length} 张${picking ? " · 本轮新增 " + t.filter((c) => c.type === "pudding").length + " 张" : ""}</p>${!picking ? `<div class="last-score">本轮：组合 ${s.results.at(-1).base[p]} + 卷物 ${s.results.at(-1).maki[p]}${s.round === 3 ? " + 布丁 " + s.results.at(-1).pudding[p] : ""}</div>` : ""}</section>`;
    })
    .join("");
  $("choose").hidden = !picking;
  $("handCount").textContent = `${s.hands[0].length} 张 · 向左传给电脑 1`;
  $("hand").replaceChildren();
  if (picking)
    s.hands[0].forEach((c, i) => {
      let b = document.createElement("button");
      b.className = "card" + (selected.includes(i) ? " selected" : "");
      b.style.setProperty("--food", foodColors[c.type]);
      b.innerHTML = `<span class="order">${selected.includes(i) ? selected.indexOf(i) + 1 : ""}</span><span class="symbol">${TYPES[c.type].symbol}</span><span class="label">${TYPES[c.type].name}</span><small>${TYPES[c.type].rule}</small>`;
      b.setAttribute(
        "aria-label",
        TYPES[c.type].name +
          (selected.includes(i) ? `，第${selected.indexOf(i) + 1}张` : ""),
      );
      b.setAttribute("aria-pressed", selected.includes(i));
      b.onclick = () => {
        if (selected.includes(i)) selected = selected.filter((x) => x !== i);
        else {
          const max = s.table[0].some((c) => c.type === "chopsticks") ? 2 : 1;
          if (selected.length === max) selected = [];
          selected.push(i);
        }
        render();
      };
      $("hand").append(b);
    });
  $("confirm").disabled = !selected.length;
  $("clear").disabled = !selected.length;
  $("confirm").textContent =
    selected.length === 2 ? "用筷子交换2张并传递" : "确认选牌并传递";
  $("chopHint").textContent = s.table[0].some((c) => c.type === "chopsticks")
    ? "已有筷子，可按顺序选1或2张。"
    : "选择1张牌。";
  $("message").textContent = picking
    ? selected.length
      ? `已选 ${selected.map((i, n) => `${n + 1}. ${TYPES[s.hands[0][i].type].name}`).join(" → ")}`
      : "选择手牌；确认后所有玩家同时揭牌并向左传手牌。"
    : s.phase === "end"
      ? `${winners(s).map(name).join("、")}获胜。总分相同先比较布丁。`
      : "本轮计分已加入累计；布丁留到第三轮结算。";
  $("result").hidden = picking;
  $("next").hidden = s.phase !== "round";
  if (!picking)
    $("resultText").innerHTML =
      "<table><thead><tr><th>轮次</th>" +
      s.totals.map((_, p) => `<th>${name(p)}</th>`).join("") +
      "</tr></thead><tbody>" +
      s.results
        .map(
          (r, i) =>
            `<tr><td>${i + 1}</td>${r.points.map((n) => `<td>${n}</td>`).join("")}</tr>`,
        )
        .join("") +
      "</tbody></table>";
}
$("confirm").onclick = () => {
  const choices = s.hands.map((_, p) =>
    p ? aiChoice(s, p) : selected.slice(),
  );
  turn(s, choices);
  selected = [];
  render();
};
$("clear").onclick = () => {
  selected = [];
  render();
};
$("next").onclick = () => {
  nextRound(s);
  selected = [];
  render();
};
$("rules").onclick = () => $("help").showModal();
$("new").onclick = () => {
  $("count").value = s.n;
  $("setup").showModal();
};
$("cancelNew").onclick = () => $("setup").close();
$("start").onclick = () => {
  s = fresh(Number($("count").value));
  selected = [];
  $("setup").close();
  render();
};
$("reference").innerHTML = Object.entries(TYPES)
  .map(
    ([type, t]) =>
      `<div><strong>${t.name}</strong><br>${t.rule}<br><small>牌库 ${t.count} 张</small></div>`,
  )
  .join("");
render();
