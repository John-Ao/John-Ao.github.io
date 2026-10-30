"use strict";
const { C, labels, pools } = RadCards,
  { Game } = RadGame,
  KEY = "radlands-save-v1";
let saved = null,
  storageOK = true;
try {
  saved = JSON.parse(localStorage.getItem(KEY));
  if (![1, 2].includes(saved?.v)) saved = null;
} catch {}
let game = new Game(saved),
  revealed = [false, false],
  opposed = true,
  modal = saved ? null : { kind: "new", fresh: true },
  gate = true,
  selected = [],
  lastActor = null;
try {
  opposed = localStorage.getItem("radlands-opposed") !== "false";
} catch {}
function modeName(mode) {
  return (
    {
      classic: "原版 34 营地",
      revised: "修订版 34 营地",
      complete: "基础＋Cult of Chrome · 66 营地",
    }[mode] || "原版 34 营地"
  );
}
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(game.s));
  } catch {
    storageOK = false;
  }
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => ($("#toast").style.display = "none"),
    2600,
  );
}
function actor() {
  return game.s.phase === "draft"
    ? Math.min(game.s.draft, 1)
    : (game.s.choice?.p ?? game.s.active);
}
function changed() {
  save();
  if (actor() !== lastActor) {
    gate = true;
    revealed = [false, false];
  }
  render();
}
function button(label, act, disabled = false, cls = "") {
  return `<button data-act="${act}" ${disabled ? "disabled" : ""} class="${cls}">${label}</button>`;
}
function stateLabel(c) {
  if (c.removed) return "已移除 · 本列可放三人";
  if (!c.hp) return "已摧毁";
  if (c.hp === 1)
    return C[c.id].type === "camp"
      ? "受伤 · 仍可使用技能"
      : "受伤 · 无法使用技能";
  return c.tired ? "未就绪" : "完好";
}
function desc(c) {
  if (c.punk) return "背面朝上 · 一次伤害即消灭";
  const d = C[c.id];
  return (
    d.text ||
    d.abilities.map((a) => `${a.cost} 水 · ${a.text}`).join(" / ") ||
    d.trait ||
    ""
  );
}
function cardHTML(c, act, compact = false) {
  const d = C[c.id],
    title = game.title(c);
  return `<button class="card ${c.punk ? "punk" : d.type} ${c.hp === 1 ? "damaged" : ""} ${!c.hp ? "dead" : ""} ${c.tired ? "tired" : ""}" data-act="${act}" aria-label="${esc(title + " " + stateLabel(c))}"><span class="name">${esc(title)}${!compact && d.cost !== undefined && d.type === "person" && !c.punk ? ` <small>◈ ${d.cost}</small>` : ""}</span><span class="desc">${esc(desc(c))}</span>${compact ? `<span class="status">${stateLabel(c)}${c.id === "juggernaut" && c.moves ? ` · 前进 ${c.moves}/3` : ""}</span>` : `<small>${d.junk ? "弃用：" + labels[d.junk] : ""}</small>`}</button>`;
}
function playerHTML(p) {
  const x = game.p(p),
    active = game.s.phase === "play" && game.s.active === p,
    allowed = game.canAct(p),
    live = x.camps.filter((c) => c.hp).length;
  return `<section class="player ${active ? "active" : ""}" data-p="${p}" aria-label="玩家 ${p + 1} 对战区"><div class="playerbar"><strong>玩家 ${p + 1}</strong><span class="turn">${active ? "当前回合" : game.s.phase === "draft" ? "选择营地" : "等待回合"}</span><small>营地 ${live}/3</small><span class="water">◈ ${x.water} <small>水</small></span></div><div class="board"><div class="queue">${[0, 1, 2].map((i) => `<div class="eventslot ${x.events[i] ? "filled" : ""}"><b>${i + 1}</b><span>${x.events[i] ? esc(C[x.events[i].id].name) : "事件空位"}</span></div>`).join("")}</div><div class="lanes">${[
    0, 1, 2,
  ]
    .map((col) => {
      const people = x.cols[col];
      let rows = people.map((c) => cardHTML(c, `board:${c.uid}`, true));
      const camp = x.camps[col],
        campHTML =
          camp && game.s.phase === "draft"
            ? '<div class="empty">已选营地 · 待双方揭晓</div>'
            : camp
              ? cardHTML(camp, `board:${camp.uid}`, true)
              : '<div class="empty">待选营地</div>';
      const behind = game.behindCount(p, col);
      if (behind) {
        while (rows.length < 2)
          rows.unshift('<div class="empty">人员空位</div>');
        rows.splice(2 - people.length + game.campFront(p, col), 0, campHTML);
      } else if (camp?.removed) {
        while (rows.length < 3)
          rows.unshift('<div class="empty">人员空位 · 营地已移除</div>');
      } else {
        while (rows.length < 2)
          rows.unshift('<div class="empty">人员空位</div>');
        rows.push(campHTML);
      }
      return `<div class="lane">${rows.join("")}</div>`;
    })
    .join(
      "",
    )}</div></div><div class="handrow">${button(revealed[p] ? "隐藏<br>手牌" : `查看<br>${x.hand.length} 张`, "reveal:" + p, !active)}<div class="hand">${revealed[p] ? x.hand.map((c) => cardHTML(c, `hand:${p}:${c.uid}`)).join("") : `<div class="hiddenhand">${Array.from({ length: Math.min(x.hand.length, 6) }, () => '<div class="handback" style="height:59px"></div>').join("")}<span>${x.hand.length ? x.hand.length + " 张手牌已隐藏" : "暂无手牌"}</span></div>`}</div></div><div class="controls">${button("抽牌 · 2 水", `buy:${p}:draw`, !allowed || x.water < 2)}${button("储水塔 · 1 水", `buy:${p}:silo`, !allowed || x.water < 1 || x.hand.some((c) => c.id === "silo"))}${button("结束回合", `end:${p}`, !allowed, "primary")}</div></section>`;
}
function render() {
  const handScroll = [...document.querySelectorAll(".player")].map(el => [el.dataset.p, el.querySelector(".hand")?.scrollLeft || 0]);
  document.body.classList.toggle("opposed", opposed);
  const s = game.s;
  $("#app").innerHTML =
    playerHTML(1) +
    `<div class="tablebar"><strong>Radlands</strong><span>第 ${s.turn} 回合 · 牌堆 ${s.deck.length} · 弃牌 ${s.discard.length}</span>${button("规则", "rules")}${button("记录", "log")}${button(opposed ? "对坐 ⇄" : "同向 ⇈", "orientation")}${button("新对局", "new")}<div class="lastlog" aria-live="polite">${esc(s.log[0] || "")}${!storageOK ? " · 浏览器未允许保存，请勿关闭页面" : ""}</div></div>` +
    playerHTML(0);
  for (const [player, left] of handScroll) {
    const hand = document.querySelector(`.player[data-p="${player}"] .hand`);
    if (hand) hand.scrollLeft = left;
  }
  renderOverlay();
}
let dialogReturnAction = null;
function dialog(content, p = null) {
  const focusedAction = document.activeElement?.dataset.act;
  if (!$("#overlay .dialog")) dialogReturnAction = focusedAction || null;
  $("#app").inert = true;
  $("#overlay").innerHTML =
    `<div class="shade"><div class="dialog ${p === 1 && opposed ? "flip" : ""}" role="dialog" aria-modal="true" aria-labelledby="overlay-title" tabindex="-1">${content}</div></div>`;
  const panel = $("#overlay .dialog");
  const heading = panel.querySelector("h1,h2");
  if (heading) heading.id = "overlay-title";
  const previous = [...panel.querySelectorAll("[data-act]")].find(el => el.dataset.act === focusedAction && !el.disabled);
  (previous || panel.querySelector("button:not(:disabled)") || panel).focus({preventScroll: true});
}
function closeButton() {
  return `<div class="actions">${button("返回对局", "close", false, "primary")}</div>`;
}
function renderOverlay() {
  const s = game.s,
    p = actor();
  if (modal) {
    showModal();
    return;
  }
  if (s.phase === "over") {
    dialog(
      `<div class="gate"><h1>${s.winner === "draw" ? "平局" : `玩家 ${s.winner + 1} 获胜`}</h1><p>${esc(s.reason || (s.winner === "draw" ? "牌堆耗尽。" : "对手的三座营地已被摧毁。"))} 共 ${s.turn} 回合。</p><div class="actions">${button("查看记录", "log")}${button("再来一局", "new", false, "primary")}</div></div>`,
    );
    return;
  }
  if (gate) {
    dialog(
      `<div class="gate"><h1>玩家 ${p + 1}</h1><p>${s.phase === "draft" ? "选择你的三座营地" : s.choice ? "轮到你作出选择" : `第 ${s.turn} 回合 · 轮到你行动`}</p><p>请对手移开视线，再查看手牌。</p>${s.turn === 0 ? `<p class="hint">${modeName(s.mode)} · 两人同屏轮流操作</p>` : ""}<div class="actions">${button("规则", "rules")}${button("准备好了", "ready", false, "primary")}</div></div>`,
      p,
    );
    return;
  }
  if (s.phase === "draft") {
    const x = game.p(p);
    dialog(
      `<h2>玩家 ${p + 1} · 选择营地 ${selected.length}/3</h2><p>所选营地的起手牌数量相加，决定你的初始手牌。</p><div class="options">${x.offer.map((c) => `<button data-act="draft:${c.uid}" class="${selected.includes(c.uid) ? "selected" : ""}"><b>${esc(C[c.id].name)}</b> <small>起手 +${C[c.id].draw}</small><span class="sub">${esc(desc(c))}</span>${C[c.id].trait ? `<span class="sub">${esc(C[c.id].trait)}</span>` : ""}</button>`).join("")}</div><div class="actions">${button(`确认 · 起手 ${selected.reduce((n, id) => n + C[x.offer.find((c) => c.uid === id).id].draw, 0)} 张`, "confirmDraft", selected.length !== 3, "primary")}</div>`,
      p,
    );
    return;
  }
  if (s.choice) {
    const ch = s.choice;
    dialog(
      `<h2>玩家 ${ch.p + 1} · ${esc(ch.title)}</h2><div class="options">${ch.options
        .map((o, i) => {
          const f = o.uid ? game.find(o.uid) : null;
          return `<button data-act="choose:${i}"><b>${esc(o.label)}</b>${f ? `<span class="sub">玩家 ${f.p + 1} · 第 ${f.col + 1} 列 · ${f.camp ? "营地" : f.n === 0 ? "前排" : "后排"} · ${stateLabel(f.c)}</span>` : ""}${o.card ? `<span class="sub">${esc(desc(o.card))}</span>` : ""}</button>`;
        })
        .join(
          "",
        )}</div>${ch.optional ? `<div class="actions">${button("跳过／取消", "choose:-1")}</div>` : ""}`,
      ch.p,
    );
    return;
  }
  $("#overlay").innerHTML = "";
  $("#app").inert = false;
  if (dialogReturnAction) {
    [...document.querySelectorAll("#app [data-act]")].find(el => el.dataset.act === dialogReturnAction)?.focus({preventScroll: true});
    dialogReturnAction = null;
  }
}
function showModal() {
  const m = modal,
    s = game.s;
  if (m.kind === "rules") {
    dialog(
      `<h2>Radlands · 规则</h2><ul class="rulelist"><li>目标：摧毁对手全部三座营地。人员与营地通常先受伤，再被消灭；朋克一次伤害即被消灭。</li><li>每回合：结算第 1 格事件 → 剩余事件前进 → 抽 1 张牌 → 获得 3 水。先手首回合仅 1 水。</li><li>可反复执行：部署手牌、弃用手牌获得即时效果、使用就绪卡牌技能、花 2 水抽牌、花 1 水取得储水塔。</li><li>每列通常最多两名人员；采矿营地移除已毁营地后，该列可容纳三人。前方卡牌保护后方卡牌；普通伤害只能选择未受保护的敌方卡牌。「任意」「全部」效果可穿透保护。</li><li>人员入场、修复或使用技能后通常未就绪。受伤人员不能行动；受伤营地仍可使用技能。每张牌通常每回合使用一次技能。</li><li>事件放在其倒计时格；该格被占用则向后放置。储水塔可留在手中跨回合储水，弃用时获得 1 水。</li><li>突袭使突袭者进入第 2 格或向前一格。结算时由防守方选择一座营地受伤，忽略保护。</li><li>牌堆首次耗尽时重洗弃牌，第二次耗尽时平局。手牌无上限。</li></ul><p class="hint">实现范围：${modeName(s.mode)}，共用 46 张人员、20 张事件。扩展新增 32 座营地并替换 10 座原营地，提供人员夺取、移位、三人列、朋克翻面、方尖碑胜利等效果。人员满场可牺牲人员腾位，卡牌不能修复自身。</p><p>触屏：点手牌选择「打出／弃用」，点场上卡牌使用技能。双方需要选择时自动交接。手牌仅在本人回合主动查看；同屏显示时仍需对手自觉避看。</p><p><a href="reference/rules.pdf" target="_blank" rel="noopener">本地官方规则 v2.1 PDF</a> · <a href="https://roxley.com/radlands-rulebook" target="_blank" rel="noopener">Roxley 最新规则</a></p>${button("查看本局牌表", "catalog")}${closeButton()}`,
      actor(),
    );
  } else if (m.kind === "log")
    dialog(
      `<h2>对局记录</h2>${s.log.map((t) => `<div class="logitem">${esc(t)}</div>`).join("")}${closeButton()}`,
      actor(),
    );
  else if (m.kind === "catalog")
    dialog(
      `<h2>${modeName(s.mode)}</h2><div class="catalog">${[
        ...pools[s.mode || "classic"],
        ...Object.values(C)
          .filter(
            (c) => ["person", "event"].includes(c.type) && c.id !== "raiders",
          )
          .map((c) => c.id),
      ]
        .map(
          (id) =>
            `<article><b>${esc(C[id].name)}</b><small>${C[id].type === "camp" ? "起手 +" + C[id].draw : "费用 " + C[id].cost + " 水"}</small><p>${esc(desc({ id }))}</p>${C[id].trait ? `<p class="hint">${esc(C[id].trait)}</p>` : ""}</article>`,
        )
        .join("")}</div>${closeButton()}`,
      actor(),
    );
  else if (m.kind === "new")
    dialog(
      `<h2>${m.fresh ? "选择牌库" : "开始新对局"}</h2>${m.fresh ? "" : "<p>选择后将替换当前浏览器中的对局。</p>"}<div class="options">${button("基础＋Cult of Chrome · 66 营地", "restart:complete:draft", false, "primary")}${button("修订版基础 · 34 营地", "restart:revised:draft")}${button("原版营地 · 34 营地", "restart:classic:draft")}${button("官方入门布局 · 修订营地", "restart:revised:starter")}</div><p class="hint">普通对局各抽六选三。入门布局：玩家 1 使用游乐场、胜利图腾、佣兵营；玩家 2 使用车库、轨道炮、补给仓库。先手随机。</p>${m.fresh ? "" : closeButton()}`,
    );
  else if (m.kind === "hand") {
    const c = game.p(m.p).hand.find((c) => c.uid === m.uid);
    if (!c) {
      modal = null;
      renderOverlay();
      return;
    }
    const d = C[c.id],
      can = game.canAct(m.p);
    let playable = can && c.id !== "silo";
    if (d.type === "person") playable = playable && game.canDeploy(m.p, c);
    if (d.type === "event")
      playable =
        playable &&
        game.p(m.p).water >= game.eventPrice(m.p, c) &&
        game.eventSlot(m.p, c) !== -2;
    dialog(
      `<h2>${esc(d.name)}</h2><span class="badge">${d.type === "event" ? "事件" : d.type === "silo" ? "储水" : "人员"}</span>${d.cost !== undefined ? `<span class="badge">部署 ${d.type === "event" ? game.eventPrice(m.p, c) : d.cost} 水</span>` : ""}${d.delay !== undefined ? `<span class="badge">倒计时 ${d.delay}</span>` : ""}<p>${esc(desc(c))}</p>${d.trait ? `<p class="hint">${esc(d.trait)}</p>` : ""}<p>弃用：${labels[d.junk]}</p><div class="actions">${button("返回", "close")}${c.id !== "silo" ? button("打出", `play:${m.p}:${c.uid}`, !playable, "primary") : ""}${button("弃用", `junk:${m.p}:${c.uid}`, !can)}</div>`,
      m.p,
    );
  } else if (m.kind === "board") {
    const f = game.find(m.uid);
    if (!f) {
      modal = null;
      renderOverlay();
      return;
    }
    const c = f.c,
      d = C[c.id];
    dialog(
      `<h2>${esc(game.title(c))}</h2><p>玩家 ${f.p + 1} · 第 ${f.col + 1} 列 · ${stateLabel(c)} · ${game.exposed(f) ? "未受保护" : "受保护"}</p>${!c.punk && d.trait ? `<p class="hint">${esc(d.trait)}</p>` : ""}<div class="options">${game
        .abilities(f.p, c)
        .map((a, i) =>
          button(
            `${game.price(f.p, c, a)} 水 · ${esc(a.text)}`,
            `use:${f.p}:${c.uid}:${i}`,
            !game.canAct(f.p) ||
              !game.ready(c) ||
              game.price(f.p, c, a) > game.p(f.p).water ||
              !game.conditions(f.p, c, a),
          ),
        )
        .join(
          "",
        )}</div>${c.punk && game.campHas(f.p, "masquerade") && game.canAct(f.p) ? (m.peek ? `<p>朋克正面：${esc(d.name)} · ${d.type === "person" ? d.cost + " 水" : "事件牌不能翻面入场"}</p><p>${esc(d.text || d.abilities.map((a) => a.text).join(" / "))}</p>${button("支付费用，原地翻面", `flip:${f.p}:${c.uid}`, !game.canFlip(f.p, c))}` : button("私下查看朋克正面", `peek:${c.uid}`)) : ""}${closeButton()}`,
      game.s.active,
    );
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const [act, ...args] = b.dataset.act.split(":");
  const n = args.map(Number);
  let ok = true;
  switch (act) {
    case "ready":
      gate = false;
      lastActor = actor();
      render();
      return;
    case "reveal":
      revealed[n[0]] = !revealed[n[0]];
      render();
      return;
    case "orientation":
      opposed = !opposed;
      try {
        localStorage.setItem("radlands-opposed", String(opposed));
      } catch {}
      render();
      return;
    case "rules":
    case "log":
    case "new":
    case "catalog":
      modal = { kind: act };
      renderOverlay();
      return;
    case "close":
      modal = null;
      renderOverlay();
      return;
    case "restart":
      game = new Game(null, args[0] || "complete", args[1] || "draft");
      revealed = [false, false];
      gate = true;
      selected = [];
      lastActor = null;
      modal = null;
      changed();
      return;
    case "peek":
      modal = { kind: "board", uid: n[0], peek: true };
      renderOverlay();
      return;
    case "flip":
      ok = game.flip(n[0], n[1]);
      modal = null;
      break;
    case "draft":
      if (selected.includes(n[0]))
        selected = selected.filter((v) => v !== n[0]);
      else if (selected.length < 3) selected.push(n[0]);
      renderOverlay();
      return;
    case "confirmDraft":
      ok = game.draft(selected);
      selected = [];
      gate = true;
      break;
    case "choose":
      ok = game.choose(n[0]);
      break;
    case "hand":
      modal = { kind: "hand", p: n[0], uid: n[1] };
      renderOverlay();
      return;
    case "board":
      modal = { kind: "board", uid: n[0] };
      renderOverlay();
      return;
    case "buy":
      ok = game.buy(n[0], args[1]);
      break;
    case "end":
      ok = game.end(n[0]);
      gate = true;
      revealed = [false, false];
      break;
    case "play":
      ok = game.play(n[0], n[1]);
      modal = null;
      break;
    case "junk":
      ok = game.junk(n[0], n[1]);
      modal = null;
      break;
    case "use":
      ok = game.use(n[0], n[1], n[2]);
      modal = null;
      break;
  }
  if (!ok) toast("当前不能执行此操作，请检查水量和卡牌状态。");
  changed();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    revealed = [false, false];
    gate = true;
    modal = null;
    save();
    render();
  }
});
window.addEventListener("keydown", (e) => {
  const panel = $("#overlay .dialog");
  if (e.key === "Tab" && panel) {
    const focusable = [...panel.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex='0']")].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { e.preventDefault(); panel.focus(); }
    else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (e.key === "Escape" && modal) {
    modal = null;
    renderOverlay();
  }
});
render();
