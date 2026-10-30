"use strict";
const { Game, D, dirs, distance, key, eq, add } = GH;
const $ = (s) => document.querySelector(s),
  STORE = "gloomhaven-coop-v2";
let game,
  fit = window.matchMedia("(min-width: 1100px)").matches,
  selectedDamage = [],
  campScene = 0,
  difficulty = 0;
try {
  let saved = JSON.parse(localStorage.getItem(STORE));
  if (saved?.version === 2) game = new Game(saved);
} catch {}
if (!game) game = new Game();
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(game.s));
  } catch {
    $("#notice").textContent = "浏览器无法写入存档，请使用“导出存档”保存进度。";
  }
}
function run(fn) {
  try {
    fn();
    render();
  } catch (e) {
    $("#notice").textContent = "操作未完成：" + e.message;
    console.error(e);
  }
}
function btn(text, fn, cls = "", disabled = false) {
  let b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.disabled = disabled;
  b.onclick = () => run(fn);
  return b;
}
function modal(html) {
  $("#modalContent").innerHTML = html;
  $("#modal").showModal();
}
function tags(f) {
  return Object.keys(f.conditions)
    .map((c) => `<span class="tag">${D.conditions[c]}</span>`)
    .join("");
}
function desc(a) {
  let n =
    a.n === "moved"
      ? "本回合移动格数"
      : a.n === "damage"
        ? "本回合已造成伤害"
        : a.n;
  switch (a.type) {
    case "attack":
      return `攻击 ${n}${a.range > 1 ? " · 射程 " + a.range : ""}${a.targets ? " · " + a.targets + " 个目标" : ""}${a.all ? " · 所有相邻敌人" : ""}${a.shape ? " · " + { fan2: "相邻扇形 2 格", fan3: "相邻扇形 3 格", line2: "直线 2 格", path: "直达主目标路径上的敌人", burst: "七格范围" }[a.shape] : ""}${a.pierce ? " · 穿透 " + a.pierce : ""}${a.condition ? " · " + D.conditions[a.condition] : ""}${a.push ? " · 推 " + a.push : ""}${a.xpTarget ? " · 每目标 +1 经验" : ""}`;
    case "move":
      return `移动 ${n}${a.jump ? " · 跳跃" : ""}`;
    case "heal":
      return `治疗 ${n} · 射程 ${a.range}（含自身）`;
    case "loot":
      return "拾取 " + n;
    case "push":
      return `推 ${n} · ${a.all ? "所有" : "一个"}相邻敌人`;
    case "shield":
      return "护盾 " + n + " · 本轮";
    case "retaliate":
      return (
        "反击 " +
        n +
        (a.allies ? " · 自己及相邻盟友" : " · 自己") +
        " · 本轮" +
        (a.xpHit ? " · 每次 +1 经验" : "")
      );
    case "attackBonus":
      return "本轮所有攻击 +" + n;
    case "redirect":
      return "本轮相邻盟友受到的攻击转移给自己";
    case "persistent":
      return {
        shield: "接下来 " + a.charges + " 次受攻击获得护盾 " + n,
        negate: "接下来 " + a.charges + " 次伤害变为 0",
        attack: "接下来 " + a.charges + " 次攻击 +" + n,
      }[a.effect];
    case "recover":
      return "回收所有损失牌（不含不可回收牌）";
    case "summon":
      return `召唤神秘盟友 · 生命 ${a.hp} / 移动 ${a.move} / 攻击 ${a.attack} / 射程 ${a.range}`;
    case "trample":
      return "攻击 2 · 本次行动移动穿越的所有敌人";
    case "kill":
      return "击杀一个相邻普通敌人";
    default:
      return a.type;
  }
}
function halfText(h) {
  let c = h.consume;
  return (
    h.ops.map(desc).join("<br>") +
    (c
      ? `<div class="meta">可消耗${c.element === "any" ? "任意" : D.elements[c.element]}元素：${c.attack ? "攻击 +" + c.attack + " " : ""}${c.pierce ? "穿透 +" + c.pierce + " " : ""}${c.condition ? D.conditions[c.condition] + " " : ""}${c.xp ? "经验 +" + c.xp + " " : ""}${c.persistent ? "持续攻击加成变为 +2" : ""}${c.shield ? "本轮护盾 " + c.shield : ""}${c.retaliate ? "本轮反击 " + c.retaliate : ""}${c.retaliateBonus ? "反击 +1" : ""}</div>`
      : "") +
    `<div class="meta">${h.xp ? "经验 +" + h.xp + " · " : ""}${h.infuse ? "回合末生成" + D.elements[h.infuse] + " · " : ""}${h.loss ? "损失" : "弃置"}${h.permanent ? " · 不可回收" : ""}</div>`
  );
}
function cardNode(id, select, chosen = false) {
  let c = D.cards[id],
    el = document.createElement(select ? "button" : "div");
  el.className =
    "card " +
    (id[0] === "s" ? "s " : "") +
    (select ? "selectable " : "") +
    (chosen ? "chosen" : "");
  el.innerHTML = `<div class="card-head"><b>${c.name}<small>${c.en} · Lv.${c.level}</small></b><em>${String(c.init).padStart(2, "0")}</em></div><div class="half">上 · ${halfText(c.top)}</div><div class="half">下 · ${halfText(c.bottom)}</div>`;
  if (select) {
    el.setAttribute("aria-pressed", String(chosen));
    el.onclick = () => run(() => select(id));
  }
  return el;
}
function showPile(i, pile) {
  let h = game.hero(i),
    ids = pile === "active" ? h.active.map((a) => a.card) : h[pile];
  modal(
    `<h2>${h.name} · ${{ hand: "手牌", discard: "弃牌", lost: "损失牌", active: "持续牌" }[pile]}</h2><div class="cards" id="pileCards"></div>`,
  );
  for (let id of ids) {
    let node = cardNode(id);
    if (pile === "active") {
      let a = h.active.find((a) => a.card === id);
      node.append(
        btn(
          "结束效果 → " + (a.effect === "round" && !a.loss ? "弃牌" : "损失"),
          () => {
            game.removeActive(h, id);
            $("#modal").close();
          },
        ),
      );
      if (a.charges !== undefined)
        node.append(document.createTextNode("剩余次数：" + a.charges));
    }
    $("#pileCards").append(node);
  }
}
function camp() {
  let s = game.s,
    root = $("#camp");
  root.replaceChildren();
  let lead = document.createElement("section");
  lead.className = "panel";
  lead.innerHTML =
    '<h1>队伍准备</h1><p class="subtle">两名玩家在同一触屏设备合作。选好携带卡牌与装备后进入场景。现支持两个职业至 2 级；场景为自建练习地图。</p>';
  let row = document.createElement("div");
  row.className = "scenario-row";
  let scene = document.createElement("select");
  scene.setAttribute("aria-label", "选择场景");
  scene.innerHTML = D.scenarios
    .map(
      (c) =>
        `<option value="${c.id}" ${campScene === c.id ? "selected" : ""} ${c.id > s.campaign.unlocked ? "disabled" : ""}>${c.name}${c.id > s.campaign.unlocked ? "（通关前一关解锁）" : ""}</option>`,
    )
    .join("");
  scene.onchange = () => {
    campScene = +scene.value;
    render();
  };
  let diff = document.createElement("select");
  diff.setAttribute("aria-label", "难度");
  diff.innerHTML = [
    [-1, "简单"],
    [0, "普通"],
    [1, "困难"],
    [2, "极难"],
  ]
    .map(
      ([n, t]) =>
        `<option value="${n}" ${difficulty === n ? "selected" : ""}>${t}（等级修正 ${n >= 0 ? "+" : ""}${n}）</option>`,
    )
    .join("");
  diff.onchange = () => (difficulty = +diff.value);
  row.append(
    scene,
    diff,
    btn(
      "开始合作场景",
      () => game.start(campScene, difficulty),
      "primary",
      !s.campaign.roster.every(
        (h) => h.loadout.length === D.classes[h.classId].limit,
      ),
    ),
  );
  lead.append(row);
  root.append(lead);
  let grid = document.createElement("div");
  grid.className = "camp-grid";
  root.append(grid);
  for (let [i, h] of s.campaign.roster.entries()) {
    let panel = document.createElement("section");
    panel.className = "panel";
    panel.innerHTML = `<div class="camp-title"><h2>玩家 ${i + 1} · ${D.classes[h.classId].name}</h2><span>Lv.${h.level}</span></div><p class="subtle">生命 ${D.classes[h.classId].hp[h.level - 1]} · 经验 ${h.xp}${h.level === 1 ? " / 45" : ""} · 金币 ${h.gold} · 战斗目标勾选 ${h.checks}</p>`;
    if (h.level === 1 && h.xp >= 45) {
      let box = document.createElement("div");
      box.innerHTML = "<p>选择一张 2 级牌解锁（不可同时取得两张）：</p>";
      for (let c of Object.values(D.cards).filter(
        (c) => c.level === 2 && c.id.startsWith(D.classes[h.classId].prefix),
      ))
        box.append(btn(c.name, () => game.upgrade(i, c.id)));
      panel.append(box);
    }
    let goals = document.createElement("div");
    goals.className = "goal-select";
    let goal = h.goal || ["healthy", "hoarder"][i];
    for (let [id, name] of [
      ["healthy", "战斗目标：满血结束"],
      ["hoarder", "战斗目标：拾取 ≥5 金币标记"],
    ])
      goals.append(
        btn(name, () => (h.goal = id), goal === id ? "selected" : ""),
      );
    panel.append(goals);
    let perkBox = document.createElement("div");
    let chosen = Array.isArray(h.perks) ? h.perks : [];
    let points = h.level - 1 + Math.floor(h.checks / 3) - chosen.length;
    perkBox.innerHTML = `<h3>修正牌专长 · 可选 ${points} 点</h3><p class="subtle">升级或每完成三次战斗目标获得一点。当前支持不含滚动符号的数值专长。</p>`;
    for (let p of D.perks[h.classId])
      perkBox.append(
        btn(
          p.name +
            " (" +
            chosen.filter((x) => x === p.id).length +
            "/" +
            p.max +
            ")",
          () => game.perk(i, p.id),
          "",
          points <= 0 || chosen.filter((x) => x === p.id).length >= p.max,
        ),
      );
    panel.append(perkBox);
    let load = document.createElement("div");
    load.innerHTML = `<h3>携带牌 ${h.loadout.length} / ${D.classes[h.classId].limit}</h3><p class="subtle">点击替换 1 / X 级牌；再次点击已选牌将其移除。</p>`;
    let list = document.createElement("div");
    list.className = "loadout";
    for (let c of Object.values(D.cards).filter(
      (c) =>
        c.id.startsWith(D.classes[h.classId].prefix) &&
        (c.level !== 2 || h.unlock === c.id),
    ))
      list.append(
        btn(
          c.name + " " + c.init,
          () => game.toggleLoadout(i, c.id),
          h.loadout.includes(c.id) ? "selected" : "",
        ),
      );
    load.append(
      list,
      btn("查看职业牌详情", () => {
        modal(
          "<h2>" +
            D.classes[h.classId].name +
            ' · 能力牌</h2><div class="cards" id="classCards"></div>',
        );
        for (let c of Object.values(D.cards).filter((c) =>
          c.id.startsWith(D.classes[h.classId].prefix),
        ))
          $("#classCards").append(cardNode(c.id));
      }),
    );
    panel.append(load);
    let shop = document.createElement("div");
    shop.innerHTML =
      '<h3 style="margin-top:20px">商店与装备</h3><p class="subtle">每个装备栏 1 件；小型物品数量为等级 / 2 向上取整。药水每场景重置。</p>';
    let items = document.createElement("div");
    items.className = "shop";
    for (let [id, item] of Object.entries(D.items)) {
      let owned = h.items.includes(id);
      let blocked =
        !owned &&
        (h.gold < item.price ||
          h.items.some((x) => D.items[x].slot === item.slot));
      let b = btn(
        "",
        () => (owned ? game.sell(i, id) : game.buy(i, id)),
        owned ? "selected" : "",
        blocked,
      );
      b.innerHTML = `${item.name} · ${owned ? "出售 " + Math.floor(item.price / 2) : item.price + " 金"}<small>${item.text}</small>`;
      items.append(b);
    }
    shop.append(items);
    panel.append(shop);
    grid.append(panel);
  }
  let limits = document.createElement("p");
  limits.className = "subtle";
  limits.textContent =
    "成长保留实际经验和金币；目前升级内容止于 2 级。完整官方战役、其余职业、事件、退休与强化系统尚未实现，详情见“规则与实现范围”。";
  root.append(limits);
}
function stats() {
  let root = $("#stats");
  root.replaceChildren();
  for (let [i, h] of game.s.heroes.entries()) {
    let el = document.createElement("div");
    el.className = `hero p${i} ${game.s.current === h.id ? "active" : ""} ${h.dead ? "dead" : ""}`;
    el.innerHTML = `<div class="hero-title"><span>${h.name}</span><span class="hp">♥ ${h.hp} / ${h.maxHp}${h.dead ? " · 耗尽" : ""}</span></div><div class="bar"><i style="width:${(h.hp / h.maxHp) * 100}%"></i></div><small>本场经验 ${h.xp} · 金币标记 ${h.coins} · 护盾 ${h.roundShield} · 反击 ${h.roundRetaliate}</small><div class="tags">${tags(h)}</div>`;
    let piles = document.createElement("div");
    piles.className = "piles";
    for (let [k, name] of [
      ["hand", "手牌"],
      ["discard", "弃牌"],
      ["lost", "损失"],
      ["active", "持续"],
    ])
      piles.append(btn(name + " " + h[k].length, () => showPile(i, k)));
    el.append(piles);
    root.append(el);
  }
}
function board() {
  let s = game.s,
    m = s.mode,
    h = game.active(),
    svg = $("#board"),
    cells = s.cells;
  let xy = (p) => [60 + 49 * (p[0] + p[1] / 2), 50 + 42.45 * p[1]];
  let width = Math.max(...cells.map((c) => xy(c.p)[0])) + 60;
  svg.setAttribute("viewBox", `0 0 ${width} 300`);
  svg.style.minWidth = fit ? "0" : width + "px";
  svg.classList.toggle("fit", fit);
  let push = game.pushOptions();
  let result = "";
  for (let c of cells) {
    let [x, y] = xy(c.p),
      visible = game.visible(c.p),
      reachable = false,
      area = false;
    if (m && !m.askElement && !s.pending && h && s.phase === "act") {
      if (m.current?.type === "move" && distance(h.pos, c.p) === 1 && visible) {
        let occ = game.occupant(c.p, h.id),
          cost =
            c.terrain === "difficult" && (!m.current.jump || m.remaining === 1)
              ? 2
              : 1;
        reachable =
          m.remaining >= cost &&
          (m.current.jump || c.terrain !== "rock") &&
          (!occ || m.current.jump || occ.team === h.team) &&
          !(m.remaining === cost && (occ || c.terrain === "rock"));
      }
      if (m.current?.type === "summon")
        reachable =
          distance(h.pos, c.p) === 1 &&
          game.floor(c.p) &&
          !game.occupant(c.p) &&
          c.terrain === "floor" &&
          !c.coins;
      if (m.current?.type === "attack" && (m.current.shape || m.current.all))
        area = game.areaTargets(h, m.current, c.p).length > 0;
    }
    let pts = Array.from({ length: 6 }, (_, i) => {
      let a = ((60 * i - 30) * Math.PI) / 180;
      return `${x + 28 * Math.cos(a)},${y + 28 * Math.sin(a)}`;
    }).join(" ");
    let label = !visible
      ? ""
      : c.door && !c.open
        ? "▥"
        : { rock: "⬟", trap: "△", difficult: "≈", chest: "◆", exit: "↗" }[
            c.terrain
          ] || (c.coins ? "●" + c.coins : "");
    let cls = !visible ? "unknown" : c.door && !c.open ? "door" : c.terrain;
    result += `<g data-cell="${key(c.p)}" role="button" tabindex="0" aria-label="格 ${key(c.p)} ${label}"><polygon class="hex ${cls} ${reachable ? "reachable" : ""} ${area ? "area" : ""} ${push.some((p) => eq(p, c.p)) ? "push" : ""}" points="${pts}"/><text class="tile-label" x="${x}" y="${y}">${label}</text></g>`;
  }
  for (let f of game.figures()) {
    let [x, y] = xy(f.pos),
      target = false;
    if (m?.current && !m.askElement && !s.pending && h) {
      let a = m.current;
      target =
        a.type === "attack"
          ? !a.shape &&
            !a.all &&
            !m.hit.includes(f.id) &&
            game.canTarget(h, f, a)
          : a.type === "heal"
            ? f.team === h.team &&
              distance(h.pos, f.pos) <= a.range &&
              game.line(h.pos, f.pos)
            : ["push", "kill"].includes(a.type)
              ? f.team !== h.team &&
                distance(h.pos, f.pos) <= 1 &&
                !f.conditions.invisible
              : false;
    }
    let label = f.hand ? f.index + 1 : f.summonCard ? "召" : f.number;
    result += `<g data-figure="${f.id}" role="button" tabindex="0" aria-label="${f.name} 生命 ${f.hp}"><circle class="pawn ${f.hand ? "p" + f.index : f.summonCard ? "summon" : "monster"} ${f.elite ? "elite" : ""} ${target ? "target" : ""}" cx="${x}" cy="${y - 2}" r="19"/><text class="pawn-label" x="${x}" y="${y - 3}">${label}</text><rect x="${x - 20}" y="${y + 13}" width="40" height="14" rx="4" fill="#16232a"/><text class="pawn-hp" x="${x}" y="${y + 24}">${f.hp}/${f.maxHp}</text>${Object.keys(f.conditions).length ? `<circle cx="${x + 17}" cy="${y - 18}" r="5" fill="#e5be68"/>` : ""}</g>`;
  }
  svg.innerHTML = result;
  svg.querySelectorAll("[data-cell]").forEach((el) => {
    let activate = () =>
      run(() => {
        let p = el.dataset.cell.split(",").map(Number);
        if (s.pending?.kind === "push") game.push(p);
        else if (m?.current?.type === "move") game.moveStep(p);
        else if (m?.current?.type === "summon") game.summon(p);
        else if (m?.current?.type === "attack") game.area(p);
      });
    el.onclick = activate;
    el.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    };
  });
  svg.querySelectorAll("[data-figure]").forEach((el) => {
    let activate = () =>
      run(() => {
        let f = game.figure(el.dataset.figure);
        if (m?.current?.type === "move") game.moveStep(f.pos);
        else if (m) game.target(f.id);
        else
          modal(
            `<h2>${f.name}</h2><p>生命 ${f.hp} / ${f.maxHp} · 护盾 ${(f.shield || 0) + f.roundShield} · 反击 ${f.roundRetaliate}</p><div class="tags">${tags(f)}</div>`,
          );
      });
    el.onclick = activate;
    el.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    };
  });
}
function showPending() {
  let p = game.s.pending,
    root = $("#pending");
  root.replaceChildren();
  if (!p) return false;
  let box = document.createElement("div");
  box.className = "pending";
  root.append(box);
  if (p.kind === "damage") {
    let h = game.figure(p.target);
    box.innerHTML = `<h3>${h.name} 即将受到 ${p.n} 点伤害</h3><p>来源：${p.source}。可损失 1 张手牌或 2 张弃牌抵消；附加状态仍会生效。</p>`;
    box.append(
      btn(
        "承受 " + p.n + " 伤害",
        () => {
          selectedDamage = [];
          game.resolveDamage("take");
        },
        "danger",
      ),
    );
    for (let id of h.hand)
      box.append(
        btn("损失手牌 · " + D.cards[id].name, () => {
          selectedDamage = [];
          game.resolveDamage("hand", [id]);
        }),
      );
    if (h.discard.length >= 2) {
      let d = document.createElement("div");
      d.innerHTML = "<p>或选择两张弃牌：</p>";
      for (let id of h.discard)
        d.append(
          btn(
            D.cards[id].name,
            () => {
              selectedDamage = selectedDamage.includes(id)
                ? selectedDamage.filter((x) => x !== id)
                : selectedDamage.length < 2
                  ? [...selectedDamage, id]
                  : selectedDamage;
            },
            selectedDamage.includes(id) ? "selected" : "",
          ),
        );
      d.append(
        btn(
          "损失选中的两张弃牌",
          () => {
            let ids = selectedDamage.slice();
            selectedDamage = [];
            game.resolveDamage("discard", ids);
          },
          "primary",
          selectedDamage.length !== 2,
        ),
      );
      box.append(d);
    }
  } else if (p.kind === "shortrest") {
    box.innerHTML = `<h3>短休息 · 玩家 ${p.hero + 1}</h3><p>随机损失：${D.cards[p.card].name}</p>`;
    box.append(
      btn("接受损失并取回其余弃牌", () => game.acceptShort(), "primary"),
      btn(
        "承受 1 伤害，重抽一次",
        () => game.acceptShort(true),
        "",
        p.rerolled,
      ),
    );
  } else if (p.kind === "push") {
    box.innerHTML = `<h3>推挤 ${game.figure(p.target).name} · 剩余 ${p.left} 格</h3><p>点选金色格；每一步必须远离施力者。可提前停止。</p>`;
    box.append(btn("结束推挤", () => game.push(null), "primary"));
  } else if (p.kind === "stamina") {
    let h = game.hero(p.hero);
    box.innerHTML = "<h3>耐力药水：选择最多两张弃牌</h3>";
    for (let id of h.discard)
      box.append(
        btn(
          D.cards[id].name,
          () => {
            p.selected = p.selected.includes(id)
              ? p.selected.filter((x) => x !== id)
              : p.selected.length < 2
                ? [...p.selected, id]
                : p.selected;
          },
          p.selected.includes(id) ? "selected" : "",
        ),
      );
    box.append(
      btn(
        "回收选中的牌",
        () => game.recoverDiscard(p.selected),
        "primary",
        !p.selected.length,
      ),
      btn("取消", () => (game.s.pending = null)),
    );
  }
  return true;
}
function controls() {
  let s = game.s,
    actions = $("#actions"),
    cards = $("#cards"),
    inventory = $("#inventory");
  actions.replaceChildren();
  cards.replaceChildren();
  inventory.replaceChildren();
  $("#phase").textContent =
    {
      plan: "选牌",
      reveal: "揭示",
      act: "角色行动",
      monster: "怪物行动",
      longrest: "长休息",
      between: "行动交接",
      cleanup: "轮末",
      over: "结算",
    }[s.phase] || "";
  let prompt = (t) => ($("#prompt").textContent = t),
    hint = (t) => ($("#hint").textContent = t);
  let pending = showPending();
  if (pending) {
    prompt("等待玩家决定");
    hint("本次结算完成后继续当前行动。");
    return;
  }
  if (s.phase === "plan") {
    let i = s.planner,
      h = game.hero(i);
    prompt(`${h.name} · 选择两张牌`);
    hint(
      h.rest
        ? "长休息先攻为 99；行动时选一张弃牌损失，治疗 2 并刷新已使用的装备。"
        : "先选的牌决定先攻。合作可讨论战术；锁定后向另一位玩家交接，双方锁定才揭示。",
    );
    for (let [j, p] of s.heroes.entries())
      actions.append(
        btn(
          `玩家 ${j + 1}${p.locked ? " · 已锁定" : p.dead ? " · 耗尽" : ""}`,
          () => (s.planner = j),
          j === i ? "selected" : "",
          p.locked || p.dead,
        ),
      );
    actions.append(
      btn(
        "锁定选择",
        () => game.lock(i),
        "primary",
        h.locked || (!h.rest && h.selection.length !== 2),
      ),
      btn(
        h.rest ? "取消长休息" : "长休息",
        () => game.setRest(i),
        "",
        h.discard.length < 2,
      ),
    );
    for (let id of h.hand) {
      let c = cardNode(id, () => game.select(i, id), h.selection.includes(id));
      if (h.selection.includes(id)) {
        let e = document.createElement("div");
        e.className = "badge";
        e.textContent = h.selection[0] === id ? "① 先攻牌" : "② 第二张";
        c.append(e);
      }
      cards.append(c);
    }
  } else if (s.phase === "reveal") {
    prompt("双方选牌已揭示");
    hint("按下方先攻顺序行动。怪物只执行能力牌上列出的动作。");
    actions.append(btn("开始本轮", () => game.beginTurn(), "primary"));
    for (let h of s.heroes) for (let id of h.chosen) cards.append(cardNode(id));
  } else if (s.phase === "between") {
    let next = s.order[s.turn];
    prompt("本次行动结束");
    hint(
      next
        ? `接下来：${game.figure(next.id).name} · 先攻 ${next.init}`
        : "本轮结束",
    );
    actions.append(btn("继续下一位", () => game.beginTurn(), "primary"));
  } else if (s.phase === "monster") {
    let f = game.active(),
      c = game.monsterCard(f.type);
    prompt(f.name + " · 自动行动");
    hint(monsterText(c));
    actions.append(btn("执行怪物行动", () => game.monsterAct(), "primary"));
  } else if (s.phase === "longrest") {
    let h = game.active();
    prompt(h.name + " · 长休息");
    hint(
      "选择损失一张弃牌，取回其余弃牌；治疗 2，并刷新已使用（非消耗）的装备。",
    );
    for (let id of h.discard)
      actions.append(btn("损失 " + D.cards[id].name, () => game.longRest(id)));
  } else if (s.phase === "cleanup") {
    prompt("本轮结束 · 可选短休息");
    hint(
      "至少两张弃牌可短休息：随机损失一张，取回其余。可以承受 1 点伤害重抽一次。下一轮无牌可出且不能休息的角色将耗尽。",
    );
    for (let [i, h] of s.heroes.entries())
      actions.append(
        btn(
          `玩家 ${i + 1} 短休息`,
          () => game.shortRest(i),
          "",
          h.dead || h.discard.length < 2 || h.shortRested,
        ),
      );
    actions.append(
      btn("进入第 " + (s.round + 1) + " 轮", () => game.nextRound(), "primary"),
    );
  } else if (s.phase === "over") {
    prompt(s.win ? "合作场景胜利" : "合作场景失败");
    hint(
      s.heroes
        .map(
          (h, i) =>
            `玩家 ${i + 1}：经验 +${s.rewards[i].xp} / 金币 +${s.rewards[i].gold}${s.rewards[i].goal ? " / 战斗目标完成" : ""}`,
        )
        .join("；"),
    );
    actions.append(
      btn("返回城镇整备", () => game.camp(), "primary"),
      btn("再次挑战", () =>
        game.start(
          s.scene,
          s.level -
            Math.ceil(s.campaign.roster.reduce((n, h) => n + h.level, 0) / 4),
        ),
      ),
    );
  } else if (s.phase === "act") {
    let h = game.active(),
      m = s.mode;
    prompt(`${h.name} · 已用 ${h.used.length} / 2 个半区`);
    if (m) {
      let a = m.current;
      if (m.askElement) {
        hint("选择消耗已有元素，或不使用增强。新生成元素在回合结束时才可用。");
        let e = m.data.consume.element;
        for (let id of Object.keys(D.elements).filter(
          (id) => (e === "any" || id === e) && s.elements[id] > 0,
        ))
          actions.append(
            btn("消耗" + D.elements[id], () => game.consume(id), "primary"),
          );
        actions.append(btn("不消耗元素", () => game.consume(null)));
      } else {
        hint(
          a?.type === "move"
            ? `移动剩余 ${m.remaining} 点${a.jump ? "（跳跃）" : ""}：逐格点击绿色格，可穿过盟友，不能停在被占格。`
            : a?.type === "attack"
              ? a.shape || a.all
                ? "点击橙色范围格选择攻击朝向 / 区域；每个目标单独翻修正牌。"
                : "点击金边敌人攻击；远程攻击相邻敌人有劣势。"
              : "点击对应角色或格子执行：" + desc(a),
        );
        let canStop = !(
          a?.type === "move" &&
          (game.occupant(h.pos, h.id) || game.cell(h.pos).terrain === "rock")
        );
        actions.append(
          btn(
            a?.type === "move" ? "结束移动" : "跳过此能力 / 结束选目标",
            () => game.skipOp(),
            "",
            !canStop,
          ),
        );
      }
      if (!m.started)
        actions.append(btn("取消半区选择", () => game.cancelAction()));
    } else {
      hint(
        "使用一张牌的上半区和另一张的下半区，顺序任选。能力可跳过；基础行动不会触发原能力的损失与经验。",
      );
      actions.append(
        btn(
          h.used.length === 2 ? "结束角色回合" : "跳过剩余半区并结束",
          () => game.finishHero(),
          "primary",
        ),
      );
    }
    for (let item of h.items)
      inventory.append(
        btn(
          D.items[item.id].name +
            (item.state === "spent"
              ? " · 已使用"
              : item.state === "consumed"
                ? " · 已消耗"
                : ""),
          () => game.useItem(h.index, item.id),
          "",
          item.state !== "ready" || !!h.conditions.stun,
        ),
      );
    for (let id of h.chosen) {
      let c = D.cards[id],
        node = document.createElement("div");
      node.className = "card " + (id[0] === "s" ? "s" : "");
      node.innerHTML = `<div class="card-head"><b>${c.name}<small>${c.en}</small></b><em>${c.init}</em></div>`;
      for (let half = 0; half < 2; half++) {
        let el = document.createElement("div");
        el.className = "half";
        el.innerHTML = halfText(c[half === 0 ? "top" : "bottom"]);
        el.append(
          btn(
            half === 0 ? "使用上半区" : "使用下半区",
            () => game.beginAction(id, half),
            "",
            !!m || !game.available(id, half),
          ),
          btn(
            half === 0 ? "基础攻击 2" : "基础移动 2",
            () => game.beginAction(id, half, true),
            "basic",
            !!m || !game.available(id, half),
          ),
        );
        node.append(el);
      }
      cards.append(node);
    }
  }
}
function monsterText(c) {
  if (!c) return "未揭示能力";
  return (
    `先攻 ${c.init} · ` +
    [
      c.shield ? "护盾 " + c.shield : null,
      c.retaliate ? "反击 " + c.retaliate : null,
      c.move !== undefined ? "移动 " + (c.move >= 0 ? "+" : "") + c.move : null,
      c.attack !== undefined
        ? "攻击 " + (c.attack >= 0 ? "+" : "") + c.attack
        : null,
      c.range ? "固定射程 " + c.range : null,
      c.rangeMod ? "射程 " + (c.rangeMod >= 0 ? "+" : "") + c.rangeMod : null,
      c.targets ? "目标 " + c.targets : null,
      c.sameTarget ? "全部攻击同一目标" : null,
      c.condition ? D.conditions[c.condition] : null,
      c.heal ? "治疗自身 " + c.heal : null,
      c.strengthen ? "强化自身" : null,
      c.trap ? "放置 " + c.trap + " 伤害陷阱" : null,
      c.shuffle ? "轮末洗牌" : null,
    ]
      .filter(Boolean)
      .join(" · ")
  );
}
function render() {
  save();
  let s = game.s,
    isCamp = s.phase === "camp";
  $("#camp").hidden = !isCamp;
  $("#play").hidden = isCamp;
  $("#restart").hidden = isCamp;
  $("#retreat").hidden = isCamp || s.phase === "over";
  if (isCamp) {
    camp();
    return;
  }
  stats();
  let scene = D.scenarios[s.scene];
  $("#sceneName").textContent = scene.name;
  $("#objective").textContent = scene.text;
  $("#round").textContent = `第 ${s.round} 轮 · 难度 ${s.level}`;
  $("#elements").innerHTML = Object.entries(s.elements)
    .map(
      ([id, n]) =>
        `<span class="element ${n === 2 ? "strong" : n === 1 ? "waning" : ""}">${D.elements[id]} · ${["无", "衰减", "强盛"][n]}</span>`,
    )
    .join("");
  board();
  controls();
  $("#order").innerHTML = s.order
    .map(
      (e, i) =>
        `<span class="order ${i === s.turn ? "current" : ""} ${i < s.turn ? "done" : ""}">${String(e.init).padStart(2, "0")} · ${game.figure(e.id).name}</span>`,
    )
    .join("");
  $("#monsters").innerHTML = Object.keys(s.monsterDecks)
    .filter((type) =>
      s.monsters.some((m) => m.type === type && !m.dead && game.visible(m.pos)),
    )
    .map(
      (type) =>
        `<div class="monster-card"><b>${D.monsters[type].name}</b><p>${monsterText(game.monsterCard(type))}</p>${s.monsters
          .filter((m) => m.type === type && !m.dead && game.visible(m.pos))
          .map(
            (m) =>
              `<div>${m.name}：♥ ${m.hp}/${m.maxHp} · 移 ${m.move} / 攻 ${m.attack} / 射 ${m.range} / 盾 ${m.shield} ${tags(m)}</div>`,
          )
          .join("")}</div>`,
    )
    .join("");
  $("#log").innerHTML = s.log.map((t) => `<li>${t}</li>`).join("");
  let a = s.lastAttack;
  $("#lastAttack").textContent = a
    ? `${a.actor} → ${a.target}：${a.base} 攻击，修正 [${a.mods.join(" / ")}]，扣除 ${a.shield} 护盾，${a.damage} 伤害。`
    : "";
}
const RULES = `<h2>Gloomhaven · 双人合作</h2><p>依据 2017 原版规则制作的非官方静态实现。两个玩家控制不同角色合作对抗怪物；不是完整官方数字版。本地单设备轮流操作，无联网同步。</p><h3>已实现</h3><ul><li>蛮族 10 张 1 级牌、3 张 X 牌、2 张 2 级候选牌；织法者 8 张 1 级牌、3 张 X 牌、2 张 2 级候选牌。升级时二选一，出征前按手牌上限构筑。</li><li>双卡上下半区、基本行动、先攻（相同看第二张；角色优先于怪物）、弃牌与损失牌、持续效果及次数、短休息随机损失 / 重抽、长休息、耗尽、手牌或弃牌抵消伤害。</li><li>守卫、弓手、活骷髅的 8 张能力牌、0–3 级普通 / 精英属性；共用怪物修正牌堆、独立角色修正牌、优势 / 劣势、护盾、穿透、反击、金币掉落与回合末拾取。</li><li>移动、跳跃、困难地形、路径陷阱、房门 / 隐藏房间、视线检测、范围攻击、多目标、推挤、召唤物自动行动、怪物聚焦 / 避陷阱 / 远程拉开距离。</li><li>中毒、创伤、定身、缴械、眩晕、困惑、强化、隐形；六元素的回合末生成、消耗与轮末衰减；引擎支持祝福 / 诅咒修正牌。</li><li>六种基础装备、商店、实际拾取金币与能力经验结算、45 经验升 2 级、可选数值修正牌专长、持久存档、JSON 导入 / 导出。</li></ul><h3>如何操作</h3><ol><li>城镇选携带牌和装备；两个职业生命不同，先规划治疗与前排。普通难度按角色平均等级的一半向上取整。</li><li>两名玩家依次选择两张牌，第一张是先攻牌。双方锁定后揭示本轮怪物牌。</li><li>点击使用上 / 下半区，再点地图目标。移动按邻格逐步进行；“结束移动”可保留未用移动点。橙色格用于范围攻击选方向。</li><li>怪物行动点击执行；受到伤害时，选择承受或损失卡牌抵消。抵伤不免疫攻击附带的状态。</li><li>能力可以跳过；损失牌在场景结束前不会因休息取回。织法者“复苏以太”可回收损失牌，但不能回收它自己。</li><li>一名角色耗尽后，另一名可以继续；全队耗尽才失败。清剿目标达成后仍执行完本轮，未拾取金币不自动获得。</li></ol><h3>明确的实现边界</h3><table><tr><th>内容</th><th>当前状态</th></tr><tr><td>官方战役与地图</td><td>未收录 95 个官方场景及剧情。三个地图为自建清剿 / 宝箱撤离 / 坚守练习，宝箱奖励和关卡解锁为本地规则。</td></tr><tr><td>职业与成长</td><td>仅蛮族、织法者至 2 级；其余职业、3–9 级卡、完整专长树、个人任务和退休尚未实现。战斗目标可选满血结束 / 拾取五枚金币；未实现完整战斗目标牌堆和随机抽二选一。</td></tr><tr><td>战役系统</td><td>城市 / 道路事件、声望、繁荣、成就、捐赠、卡牌强化、完整商店与物品、隐藏内容未实现。</td></tr><tr><td>几何及并列选择</td><td>视线采用六角顶点采样，极端擦边情况可能不同于桌游裁定；怪物等效路线采用稳定顺序选择。穿刺喷发同长路径自动选取一条。未实现飞行、传送、拉拽、怪物召唤或首领特殊规则。</td></tr><tr><td>当前简化</td><td>行动中不提供所有可选效果的逐项开关。等级 2 后仍记录经验，但不虚构更高等级牌。</td></tr></table><h3>规则来源与核对</h3><p><a href="https://cephalofair.com/pages/gloomhaven" target="_blank" rel="noopener">Cephalofair 官方规则入口</a> · <a href="https://online.flippingbook.com/view/598058/" target="_blank" rel="noopener">2017 原版规则书</a>（重点：17–32 页战斗、33 页结算、42–47 页成长）。卡牌数值对照 <a href="https://github.com/any2cards/worldhaven" target="_blank" rel="noopener">Worldhaven 原卡参考</a>；怪物数值交叉核对 <a href="https://github.com/johreh/gloomycompanion" target="_blank" rel="noopener">Gloomy Companion 数据</a>。查阅日期：2026-10-20。网页不包含原版插画或剧情文本。</p>`;
$("#rules").onclick = () => modal(RULES);
$("#close").onclick = () => $("#modal").close();
$("#fit").onclick = () => {
  fit = !fit;
  board();
};
$("#center").onclick = () => {
  let h = game.active() || game.hero(game.s.planner || 0);
  $("#mapScroll").scrollLeft = Math.max(
    0,
    60 + 49 * (h.pos[0] + h.pos[1] / 2) - $("#mapScroll").clientWidth / 2,
  );
};
$("#restart").onclick = () => {
  modal(
    "<h2>重新开始当前场景？</h2><p>未结算的场景经验和金币将丢失，城镇记录保持不变。</p>",
  );
  $("#modalContent").append(
    btn(
      "确认重开",
      () => {
        let s = game.s;
        game.start(
          s.scene,
          s.level -
            Math.ceil(s.campaign.roster.reduce((n, h) => n + h.level, 0) / 4),
        );
        $("#modal").close();
      },
      "danger",
    ),
  );
};
$("#save").onclick = () => {
  let blob = new Blob([JSON.stringify(game.s, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "Gloomhaven-coop-save.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#load").onclick = () => $("#file").click();
$("#file").onchange = async () => {
  let file = $("#file").files[0];
  if (!file) return;
  try {
    if (file.size > 2000000) throw Error("存档过大");
    let s = JSON.parse(await file.text());
    validateSave(s);
    modal("<h2>导入合作存档？</h2><p>验证通过。导入将替换当前本地进度。</p>");
    $("#modalContent").append(
      btn(
        "确认导入",
        () => {
          game = new Game(s);
          selectedDamage = [];
          $("#modal").close();
        },
        "primary",
      ),
    );
  } catch (e) {
    $("#notice").textContent = "导入失败：" + e.message;
  }
  $("#file").value = "";
};
function validateSave(s) {
  if (
    s?.version !== 2 ||
    ![
      "camp",
      "plan",
      "reveal",
      "act",
      "monster",
      "longrest",
      "between",
      "cleanup",
      "over",
    ].includes(s.phase) ||
    !Array.isArray(s.campaign?.roster) ||
    s.campaign.roster.length !== 2
  )
    throw Error("不是有效的双人合作存档");
  if (JSON.stringify(s).includes("<") || JSON.stringify(s).includes(">"))
    throw Error("存档包含无效文本");
  for (let h of s.campaign.roster) {
    if (
      !D.classes[h.classId] ||
      ![1, 2].includes(h.level) ||
      !Array.isArray(h.loadout) ||
      !h.loadout.every((c) => D.cards[c]) ||
      !Array.isArray(h.items) ||
      !h.items.every((i) => D.items[i])
    )
      throw Error("角色数据无效");
  }
  if (
    s.phase !== "camp" &&
    (!Array.isArray(s.heroes) ||
      s.heroes.length !== 2 ||
      !Array.isArray(s.cells) ||
      !D.scenarios[s.scene])
  )
    throw Error("场景数据缺失");
}
render();

$("#retreat").onclick = () => {
  modal(
    "<h2>全队撤退？</h2><p>按失败结算本场已取得的经验与金币，然后返回城镇。</p>",
  );
  $("#modalContent").append(
    btn(
      "确认撤退",
      () => {
        game.complete(false);
        game.camp();
        $("#modal").close();
      },
      "danger",
    ),
  );
};
