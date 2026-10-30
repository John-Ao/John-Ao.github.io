(function (root) {
  "use strict";
  const D = typeof module !== "undefined" ? require("./data.js") : root.GH_DATA;
  const ST =
    typeof module !== "undefined"
      ? require("./monster-stats.js")
      : root.GH_MONSTER_STATS;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const key = (p) => p.join(","),
    eq = (a, b) => key(a) === key(b);
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const distance = (a, b) =>
    Math.max(
      Math.abs(a[0] - b[0]),
      Math.abs(a[1] - b[1]),
      Math.abs(a[0] + a[1] - b[0] - b[1]),
    );
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function modifierDeck(perks = []) {
    let a = [
      0,
      0,
      0,
      0,
      0,
      0,
      -1,
      -1,
      -1,
      -1,
      -1,
      1,
      1,
      1,
      1,
      1,
      -2,
      2,
      "null",
      "double",
    ];
    const remove = (v, n) => {
      for (let i = 0; i < n; i++) {
        let at = a.indexOf(v);
        if (at >= 0) a.splice(at, 1);
      }
    };
    for (let perk of Array.isArray(perks) ? perks : []) {
      if (perk === "removeNeg") remove(-1, 2);
      if (perk === "removeZeros") remove(0, 4);
      if (perk === "replaceNeg") {
        remove(-1, 1);
        a.push(1);
      }
      if (perk === "addOnes") a.push(1, 1);
      if (perk === "addThree") a.push(3);
    }
    return { draw: shuffle(a), discard: [], reshuffle: false };
  }

  function baseFigure(id, name, team, pos, hp) {
    return {
      id,
      name,
      team,
      pos,
      hp,
      maxHp: hp,
      conditions: {},
      turns: 0,
      roundShield: 0,
      roundRetaliate: 0,
      roundAttack: 0,
      retaliateXP: 0,
      dead: false,
    };
  }
  class Game {
    constructor(state) {
      this.s = state || {
        version: 2,
        phase: "camp",
        campaign: {
          roster: ["brute", "spellweaver"].map((classId) => ({
            classId,
            level: 1,
            xp: 0,
            gold: 30,
            checks: 0,
            perks: [],
            unlock: null,
            items: [],
            loadout: Object.values(D.cards)
              .filter(
                (c) =>
                  c.id.startsWith(D.classes[classId].prefix) && c.level === 1,
              )
              .map((c) => c.id),
          })),
          completed: [],
          unlocked: 0,
        },
        log: [],
      };
    }
    log(t) {
      this.s.log.unshift(t);
      this.s.log = this.s.log.slice(0, 150);
    }
    hero(i) {
      return this.s.heroes[i];
    }
    figure(id) {
      return [
        ...(this.s.heroes || []),
        ...(this.s.monsters || []),
        ...(this.s.summons || []),
      ].find((f) => f.id === id);
    }
    figures() {
      return [...this.s.heroes, ...this.s.monsters, ...this.s.summons].filter(
        (f) => !f.dead && this.visible(f.pos),
      );
    }
    active() {
      return this.figure(this.s.current);
    }
    cell(p) {
      return this.s.cells.find((c) => eq(c.p, p));
    }
    visible(p) {
      let c = this.cell(p);
      return !!c && (c.room === -1 || this.s.rooms.includes(c.room));
    }
    floor(p) {
      let c = this.cell(p);
      return this.visible(p) && c.terrain !== "rock" && !(c.door && !c.open);
    }
    occupant(p, except) {
      return this.figures().find((f) => f.id !== except && eq(f.pos, p));
    }
    enemies(f) {
      return this.figures().filter(
        (t) => t.team !== f.team && !t.conditions.invisible,
      );
    }
    allies(f) {
      return this.figures().filter((t) => t.team === f.team);
    }
    start(scene = 0, difficulty = 0) {
      const campaign = this.s.campaign,
        def = D.scenarios[scene];
      let level = Math.min(
        3,
        Math.max(
          0,
          Math.ceil(campaign.roster.reduce((n, h) => n + h.level, 0) / 4) +
            difficulty,
        ),
      );
      this.s = {
        version: 2,
        campaign,
        phase: "plan",
        scene,
        level,
        round: 1,
        rooms: [0],
        cells: [],
        heroes: [],
        monsters: [],
        summons: [],
        elements: Object.fromEntries(
          Object.keys(D.elements).map((k) => [k, 0]),
        ),
        monsterDecks: {},
        monsterModifier: modifierDeck(),
        order: [],
        turn: 0,
        current: null,
        planner: 0,
        mode: null,
        jobs: [],
        pending: null,
        log: [],
        goalReached: false,
        chests: 0,
        ended: false,
      };
      for (let room = 0; room < def.rooms; room++) {
        for (let q = room * 5; q < room * 5 + 4; q++)
          for (let r = 0; r < 5; r++)
            this.s.cells.push({ p: [q, r], room, terrain: "floor", coins: 0 });
        if (room < def.rooms - 1)
          this.s.cells.push({
            p: [room * 5 + 4, 2],
            room: -1,
            terrain: "floor",
            door: true,
            open: false,
            nextRoom: room + 1,
            coins: 0,
          });
      }
      for (let [prop, type] of [
        ["rocks", "rock"],
        ["traps", "trap"],
        ["difficult", "difficult"],
        ["chests", "chest"],
        ["exit", "exit"],
      ])
        for (let p of def[prop] || []) {
          let c = this.cell(p);
          c.terrain = type;
          if (type === "trap") c.damage = 2 + level;
        }
      this.s.heroes = campaign.roster.map((h, i) => ({
        ...baseFigure(
          "h" + i,
          `玩家 ${i + 1} · ${D.classes[h.classId].name}`,
          "hero",
          [0, i ? 3 : 1],
          D.classes[h.classId].hp[h.level - 1],
        ),
        classId: h.classId,
        index: i,
        hand: h.loadout.slice(),
        discard: [],
        lost: [],
        permanent: [],
        active: [],
        chosen: [],
        selection: [],
        locked: false,
        rest: false,
        xp: 0,
        coins: 0,
        kills: 0,
        goal: h.goal || ["healthy", "hoarder"][i],
        deck: modifierDeck(h.perks),
        items: h.items.map((id) => ({ id, state: "ready" })),
        used: [],
        cardUse: {},
        infusions: [],
        moved: 0,
        damageDealt: 0,
        passed: [],
      }));
      for (let [type, q, r, room, elite] of def.foes)
        this.spawn(type, [q, r], room, elite, false);
      if (def.goal === "survive") this.s.rooms = [0, 1];
      this.log(`合作场景开始：${def.name}。场景等级 ${level}。`);
      this.log("按房门格进入新房间；怪物只在揭示后参与行动。");
    }
    spawn(type, pos, room, elite = false, summoned = false) {
      let stats = ST[type][this.s.level][elite ? "elite" : "normal"];
      let id = "m" + this.s.monsters.length;
      let m = {
        ...baseFigure(
          id,
          D.monsters[type].name +
            (elite ? " ★" : "") +
            " " +
            (this.s.monsters.length + 1),
          "monster",
          pos,
          stats.health,
        ),
        type,
        room,
        elite,
        summoned,
        number: this.s.monsters.length + 1,
        move: stats.move,
        attack: stats.attack,
        range: stats.range || 1,
        shield: 0,
        targets: 1,
        attributes: stats.attributes,
      };
      for (let st of stats.attributes || []) {
        if (/shield/i.test(st)) m.shield = Number(st.match(/\d+/)?.[0] || 1);
        if (/target/i.test(st)) m.targets = Number(st.match(/\d+/)?.[0] || 2);
      }
      this.s.monsters.push(m);
      return m;
    }
    // Visibility uses corner-to-corner lines; obstacles don't block sight, walls and closed doors do.
    line(a, b) {
      if (eq(a, b)) return true;
      const xy = (p) => [Math.sqrt(3) * (p[0] + p[1] / 2), 1.5 * p[1]];
      const vertices = (p) => {
        let [x, y] = xy(p);
        return [
          [x, y],
          ...dirs.map((_, i) => {
            let t = ((60 * i - 30) * Math.PI) / 180;
            return [x + 0.985 * Math.cos(t), y + 0.985 * Math.sin(t)];
          }),
        ];
      };
      const round = (q, r) => {
        let x = q,
          z = r,
          y = -x - z,
          rx = Math.round(x),
          ry = Math.round(y),
          rz = Math.round(z);
        let dx = Math.abs(rx - x),
          dy = Math.abs(ry - y),
          dz = Math.abs(rz - z);
        if (dx > dy && dx > dz) rx = -ry - rz;
        else if (dy > dz) ry = -rx - rz;
        else rz = -rx - ry;
        return [rx, rz];
      };
      for (let p of vertices(a))
        for (let v of vertices(b)) {
          let steps = Math.ceil(Math.hypot(v[0] - p[0], v[1] - p[1]) * 9);
          let ok = true;
          for (let i = 1; i < steps; i++) {
            let x = p[0] + ((v[0] - p[0]) * i) / steps,
              y = p[1] + ((v[1] - p[1]) * i) / steps;
            let c = this.cell(round(x / Math.sqrt(3) - y / 3, (2 * y) / 3));
            if (!c || !this.visible(c.p) || (c.door && !c.open)) {
              ok = false;
              break;
            }
          }
          if (ok) return true;
        }
      return false;
    }
    condition(f, type) {
      if (type === "curse" || type === "bless") {
        let deck =
          f.team === "monster"
            ? this.s.monsterModifier
            : f.deck || this.hero(f.owner).deck;
        let marker = type === "curse" ? "curse" : "bless";
        const decks =
          type === "curse" && f.team === "monster"
            ? [this.s.monsterModifier]
            : type === "curse"
              ? this.s.heroes.map((h) => h.deck)
              : [this.s.monsterModifier, ...this.s.heroes.map((h) => h.deck)];
        if (
          decks.reduce(
            (n, d) => n + d.draw.filter((v) => v === marker).length,
            0,
          ) < 10
        )
          deck.draw = shuffle([...deck.draw, marker]);
        return;
      }
      f.conditions[type] = ["poison", "wound"].includes(type)
        ? -1
        : f.turns + 1;
    }
    heal(f, n) {
      const poisoned = !!f.conditions.poison;
      delete f.conditions.poison;
      delete f.conditions.wound;
      if (!poisoned) f.hp = Math.min(f.maxHp, f.hp + n);
      this.log(
        `${f.name} ${poisoned ? "清除中毒，未恢复生命" : "治疗 " + n}。`,
      );
    }
    exhaust(f) {
      f.dead = true;
      this.log(`${f.name}${f.team === "hero" ? "耗尽" : "倒下"}。`);
      if (f.hand) {
        for (let a of f.active.filter((a) => a.effect === "round").slice())
          this.removeActive(f, a.card);
        f.lost = [
          ...new Set([
            ...f.lost,
            ...f.hand,
            ...f.discard,
            ...f.chosen,
            ...f.active.map((x) => x.card),
          ]),
        ];
        f.hand = [];
        f.discard = [];
        f.chosen = [];
        f.active = [];
        for (let u of this.s.summons.filter((x) => x.owner === f.index))
          u.dead = true;
      } else if (f.team === "monster" && !f.summoned) this.cell(f.pos).coins++;
      if (f.summonCard) {
        let h = this.hero(f.owner);
        this.removeActive(h, f.summonCard);
      }
      this.checkGoal();
    }
    removeActive(h, id) {
      let a = h.active.find((a) => a.card === id);
      if (!a) return;
      h.active = h.active.filter((a) => a.card !== id);
      if (a.effect === "round")
        for (let b of a.bonuses) {
          let target = this.figure(b.target);
          if (target) {
            if (b.prop === "redirect") target.redirect = false;
            else target[b.prop] -= b.n;
          }
        }
      let pile = a.effect === "round" && !a.loss ? h.discard : h.lost;
      if (!pile.includes(id)) pile.push(id);
      if (h.cardUse?.[id]) h.cardUse[id].settled = true;
      for (let f of this.s.summons.filter(
        (f) => f.summonCard === id && f.owner === h.index,
      ))
        f.dead = true;
    }
    roundBonus(h, prop, n, target = h) {
      let m = this.s.mode,
        entry = h.active.find((a) => a.card === m.id);
      if (!entry) {
        entry = {
          card: m.id,
          effect: "round",
          loss: !!m.data.loss,
          bonuses: [],
        };
        h.active.push(entry);
      }
      entry.bonuses.push({ target: target.id, prop, n });
      if (prop === "redirect") target.redirect = true;
      else target[prop] += n;
    }

    charge(h, entry) {
      entry.used = (entry.used || 0) + 1;
      if (entry.xpSlots?.includes(entry.used)) h.xp++;
      entry.charges--;
      if (entry.charges <= 0) this.removeActive(h, entry.card);
    }
    takeDamage(f, n, source, attack = false) {
      if (n <= 0 || f.dead) return;
      let negate = f.active?.find((a) => a.effect === "negate");
      if (negate) {
        this.charge(f, negate);
        this.log(`${f.name} 的持续防护抵消 ${n} 伤害。`);
        return;
      }
      if (f.hand) {
        this.s.pending = {
          kind: "damage",
          target: f.id,
          n,
          source,
          selected: [],
        };
        return;
      }
      f.hp = Math.max(0, f.hp - n);
      this.log(`${f.name} 受到 ${n} 伤害。`);
      if (!f.hp) this.exhaust(f);
    }
    resolveDamage(kind, ids = []) {
      let p = this.s.pending;
      if (p?.kind !== "damage") return;
      let h = this.figure(p.target);
      if (kind === "hand") {
        if (ids.length !== 1 || !h.hand.includes(ids[0])) return;
        h.hand = h.hand.filter((x) => !ids.includes(x));
        h.lost.push(...ids);
        this.log(`${h.name} 损失 1 张手牌抵消伤害。`);
      } else if (kind === "discard") {
        if (
          ids.length !== 2 ||
          new Set(ids).size !== 2 ||
          !ids.every((x) => h.discard.includes(x))
        )
          return;
        h.discard = h.discard.filter((x) => !ids.includes(x));
        h.lost.push(...ids);
        this.log(`${h.name} 损失 2 张弃牌抵消伤害。`);
      } else {
        h.hp = Math.max(0, h.hp - p.n);
        this.log(`${h.name} 承受 ${p.n} 伤害。`);
        if (!h.hp) this.exhaust(h);
      }
      this.s.pending = null;
      this.pump();
    }
    select(i, id) {
      let h = this.hero(i);
      if (this.s.phase !== "plan" || h.locked || h.dead || !h.hand.includes(id))
        return;
      if (h.selection.includes(id))
        h.selection = h.selection.filter((c) => c !== id);
      else if (h.selection.length < 2) h.selection.push(id);
      h.rest = false;
    }
    setRest(i) {
      let h = this.hero(i);
      if (h.locked || h.discard.length < 2) return;
      h.rest = !h.rest;
      h.selection = [];
    }
    lock(i) {
      let h = this.hero(i);
      if (h.dead || h.locked || (!h.rest && h.selection.length !== 2)) return;
      h.locked = true;
      h.chosen = h.selection.slice();
      h.selection = [];
      h.hand = h.hand.filter((id) => !h.chosen.includes(id));
      h.init = h.rest ? 99 : D.cards[h.chosen[0]].init;
      if (this.s.heroes.every((h) => h.locked || h.dead)) this.reveal();
      else
        this.s.planner = this.s.heroes.findIndex((h) => !h.locked && !h.dead);
    }
    drawMonster(type) {
      if (!this.s.monsterDecks[type])
        this.s.monsterDecks[type] = {
          draw: shuffle(D.monsterDecks[type].map((_, i) => i)),
          discard: [],
          card: null,
        };
      let d = this.s.monsterDecks[type];
      if (!d.draw.length) {
        d.draw = shuffle(d.discard);
        d.discard = [];
      }
      d.card = d.draw.pop();
      d.discard.push(d.card);
      return D.monsterDecks[type][d.card];
    }
    monsterCard(type) {
      return D.monsterDecks[type][this.s.monsterDecks[type]?.card];
    }
    reveal() {
      this.s.order = [];
      for (let h of this.s.heroes.filter((h) => !h.dead))
        this.s.order.push({
          id: h.id,
          init: h.init,
          tie: D.cards[h.chosen[1]]?.init || 99,
        });
      for (let type of new Set(
        this.s.monsters
          .filter((m) => !m.dead && this.visible(m.pos))
          .map((m) => m.type),
      )) {
        let c = this.drawMonster(type);
        for (let m of this.s.monsters.filter(
          (m) => m.type === type && !m.dead && this.visible(m.pos),
        ))
          this.s.order.push({
            id: m.id,
            init: c.init,
            elite: m.elite,
            num: m.number,
          });
      }
      this.sortOrder(this.s.order);
      this.s.turn = 0;
      this.s.phase = "reveal";
      this.log("双方已锁定：先攻顺序与怪物能力已公开。");
    }
    sortOrder(a) {
      a.sort(
        (x, y) =>
          x.init - y.init ||
          Number(x.id[0] !== "h") - Number(y.id[0] !== "h") ||
          (x.id[0] === "h"
            ? x.tie - y.tie || x.id.localeCompare(y.id)
            : Number(y.elite) - Number(x.elite) || x.num - y.num),
      );
    }
    beginTurn() {
      if (this.s.pending || this.s.phase === "over") return;
      let entry = this.s.order[this.s.turn];
      if (!entry) {
        this.endRound();
        return;
      }
      let f = this.figure(entry.id);
      if (!f || f.dead) {
        this.s.turn++;
        this.beginTurn();
        return;
      }
      this.s.current = f.id;
      f.turns++;
      this.s.phase = f.hand ? "act" : "monster";
      this.s.mode = null;
      if (f.hand) {
        f.used = [];
        f.cardUse = {};
        f.infusions = [];
        f.moved = 0;
        f.damageDealt = 0;
        f.passed = [];
        f.turnStart = f.pos.slice();
        f.attackItem = 0;
        f.attackAdv = false;
        this.s.jobs.push({ type: "summonTurns", hero: f.id });
      }
      if (f.conditions.wound)
        this.s.jobs.unshift({
          type: "damage",
          target: f.id,
          n: 1,
          source: "创伤",
        });
      this.s.jobs.push({ type: "ready", id: f.id });
      this.pump();
    }
    ready(f) {
      if (f.dead) {
        this.endTurn();
        return;
      }
      if (f.hand) {
        if (f.rest) {
          this.s.phase = "longrest";
        } else if (f.conditions.stun) {
          this.log(`${f.name} 眩晕，本回合两张牌弃置。`);
          this.finishHero();
        } else this.s.phase = "act";
      } else this.s.phase = "monster";
    }
    endTurn() {
      let f = this.active();
      if (f) {
        for (let [c, v] of Object.entries(f.conditions))
          if (v > 0 && v <= f.turns) delete f.conditions[c];
        for (let e of f.infusions || []) this.s.elements[e] = 2;
        if (f.hand && !f.dead) this.loot(f, 0);
      }
      this.s.mode = null;
      this.s.turn++;
      this.s.phase = "between";
      this.checkGoal();
      if (this.s.turn >= this.s.order.length) this.endRound();
    }
    finishHero() {
      let h = this.active();
      if (!h?.hand || this.s.mode || this.s.pending) return;
      for (let id of h.chosen) {
        let use = h.cardUse[id];
        if (h.active.some((a) => a.card === id)) continue;
        if (use?.settled) continue;
        if (use?.loss) {
          h.lost.push(id);
          if (use.permanent) h.permanent.push(id);
        } else h.discard.push(id);
      }
      h.chosen = [];
      this.endTurn();
    }
    longRest(id) {
      let h = this.active();
      if (this.s.phase !== "longrest" || !h.discard.includes(id)) return;
      h.lost.push(id);
      h.hand.push(...h.discard.filter((x) => x !== id));
      h.discard = [];
      this.heal(h, 2);
      for (let item of h.items)
        if (item.state === "spent") item.state = "ready";
      this.log(`${h.name} 长休息，损失「${D.cards[id].name}」。`);
      this.endTurn();
    }
    shortRest(i) {
      let h = this.hero(i);
      if (
        this.s.phase !== "cleanup" ||
        h.dead ||
        h.discard.length < 2 ||
        h.shortRested
      )
        return;
      this.s.pending = {
        kind: "shortrest",
        hero: i,
        card: shuffle(h.discard.slice())[0],
        rerolled: false,
      };
    }
    acceptShort(reroll = false) {
      let p = this.s.pending;
      if (p?.kind !== "shortrest") return;
      let h = this.hero(p.hero);
      if (reroll) {
        if (p.rerolled) return;
        p.card = shuffle(h.discard.filter((c) => c !== p.card))[0];
        p.rerolled = true;
        this.s.pending = null;
        this.s.jobs.unshift({ type: "resumeShort", pending: p });
        this.takeDamage(h, 1, "短休息重抽");
        this.pump();
        return;
      }
      h.lost.push(p.card);
      h.hand.push(...h.discard.filter((c) => c !== p.card));
      h.discard = [];
      h.shortRested = true;
      this.log(`${h.name} 短休息，随机损失「${D.cards[p.card].name}」。`);
      this.s.pending = null;
    }
    endRound() {
      for (let h of this.s.heroes)
        for (let a of h.active.filter((a) => a.effect === "round").slice())
          this.removeActive(h, a.card);
      for (let f of this.figures()) {
        f.roundShield = 0;
        f.roundRetaliate = 0;
        f.roundAttack = 0;
        f.redirect = false;
        f.retaliateXP = 0;
        if (f.hand) f.shortRested = false;
      }
      for (let e in this.s.elements)
        this.s.elements[e] = Math.max(0, this.s.elements[e] - 1);
      for (let d of [
        ...this.s.heroes.map((h) => h.deck),
        this.s.monsterModifier,
      ])
        if (d.reshuffle) {
          d.draw = shuffle([...d.draw, ...d.discard]);
          d.discard = [];
          d.reshuffle = false;
        }
      for (let [type, d] of Object.entries(this.s.monsterDecks))
        if (D.monsterDecks[type][d.card]?.shuffle) {
          d.draw = shuffle([...d.draw, ...d.discard]);
          d.discard = [];
        }
      this.checkGoal();
      if (this.s.heroes.every((h) => h.dead)) this.complete(false);
      else if (this.s.goalReached) this.complete(true);
      else {
        this.s.phase = "cleanup";
        this.s.current = null;
      }
    }
    nextRound() {
      if (this.s.phase !== "cleanup" || this.s.pending) return;
      this.s.round++;
      if (
        D.scenarios[this.s.scene].goal === "survive" &&
        [3, 5, 7].includes(this.s.round)
      ) {
        for (let pos of [
          [3, 0],
          [8, 4],
        ])
          if (!this.occupant(pos))
            this.spawn(
              "guard",
              pos,
              pos[0] < 4 ? 0 : 1,
              this.s.round === 7,
              true,
            );
        this.log("增援进入战场。");
      }
      for (let h of this.s.heroes) {
        h.locked = false;
        h.rest = false;
        h.selection = [];
        h.chosen = [];
        if (!h.dead && h.hand.length < 2 && h.discard.length < 2)
          this.exhaust(h);
      }
      if (this.s.heroes.every((h) => h.dead)) {
        this.complete(false);
        return;
      }
      this.s.planner = this.s.heroes.findIndex((h) => !h.dead);
      this.s.phase = "plan";
    }
    checkGoal() {
      let def = D.scenarios[this.s.scene];
      if (!def) return;
      if (def.goal === "kill")
        this.s.goalReached = this.s.monsters.every((m) => m.dead);
      if (def.goal === "escape")
        this.s.goalReached =
          this.s.chests >= def.chests.length &&
          this.s.heroes.every(
            (h) => !h.dead && this.cell(h.pos).terrain === "exit",
          );
      if (def.goal === "survive")
        this.s.goalReached =
          this.s.round >= def.rounds && this.s.heroes.some((h) => !h.dead);
    }
    complete(win) {
      if (this.s.ended) return;
      this.s.ended = true;
      this.s.phase = "over";
      this.s.win = win;
      this.s.pending = null;
      this.s.jobs = [];
      this.s.mode = null;
      let gold = [2, 2, 3, 3][this.s.level],
        bonus = win ? 4 + 2 * this.s.level : 0;
      this.s.rewards = this.s.heroes.map((h, i) => {
        let goal =
          win && (h.goal === "healthy" ? h.hp === h.maxHp : h.coins >= 5);
        let r = this.s.campaign.roster[i];
        r.xp += h.xp + bonus;
        r.gold += h.coins * gold;
        if (goal) r.checks++;
        return { xp: h.xp + bonus, gold: h.coins * gold, goal };
      });
      if (win && !this.s.campaign.completed.includes(this.s.scene)) {
        this.s.campaign.completed.push(this.s.scene);
        this.s.campaign.unlocked = Math.min(
          2,
          Math.max(this.s.campaign.unlocked, this.s.scene + 1),
        );
      }
      this.log(
        win
          ? "场景胜利。按实际拾取结算金币，结算能力经验与场景经验。"
          : "场景失败。仍保留已取得的金币与能力经验。",
      );
    }
    camp() {
      if (this.s.phase === "over") this.s.phase = "camp";
    }
    buy(i, id) {
      let h = this.s.campaign.roster[i],
        item = D.items[id];
      if (
        this.s.phase !== "camp" ||
        !item ||
        h.items.includes(id) ||
        h.gold < item.price
      )
        return false;
      if (
        h.items.filter((x) => D.items[x].slot === item.slot).length >=
        (item.slot === "small" ? Math.ceil(h.level / 2) : 1)
      )
        return false;
      if (
        this.s.campaign.roster.reduce(
          (n, h) => n + h.items.filter((x) => x === id).length,
          0,
        ) >= 2
      )
        return false;
      h.gold -= item.price;
      h.items.push(id);
      return true;
    }
    sell(i, id) {
      let h = this.s.campaign.roster[i];
      if (this.s.phase !== "camp" || !h.items.includes(id)) return;
      h.items = h.items.filter((x) => x !== id);
      h.gold += Math.floor(D.items[id].price / 2);
    }
    upgrade(i, id) {
      let h = this.s.campaign.roster[i];
      if (
        h.level !== 1 ||
        h.xp < 45 ||
        D.cards[id]?.level !== 2 ||
        !id.startsWith(D.classes[h.classId].prefix)
      )
        return;
      h.level = 2;
      h.unlock = id;
    }
    perk(i, id) {
      let h = this.s.campaign.roster[i];
      if (!Array.isArray(h.perks)) h.perks = [];
      let p = D.perks[h.classId].find((p) => p.id === id);
      if (
        this.s.phase !== "camp" ||
        !p ||
        h.level - 1 + Math.floor(h.checks / 3) <= h.perks.length ||
        h.perks.filter((x) => x === id).length >= p.max
      )
        return;
      h.perks.push(id);
    }
    toggleLoadout(i, id) {
      let h = this.s.campaign.roster[i],
        c = D.cards[id];
      if (
        !c ||
        !id.startsWith(D.classes[h.classId].prefix) ||
        (c.level === 2 && h.unlock !== id)
      )
        return;
      if (h.loadout.includes(id)) h.loadout = h.loadout.filter((c) => c !== id);
      else if (h.loadout.length < D.classes[h.classId].limit)
        h.loadout.push(id);
    }
    paths(
      f,
      {
        jump = false,
        avoid = false,
        cautious = false,
        max = 999,
        from = f.pos,
      } = {},
    ) {
      let seen = new Map([[key(from), { cost: 0, path: [], hazards: 0 }]]),
        queue = [from];
      while (queue.length) {
        queue.sort(
          (a, b) =>
            (cautious
              ? seen.get(key(a)).hazards - seen.get(key(b)).hazards
              : 0) || seen.get(key(a)).cost - seen.get(key(b)).cost,
        );
        let p = queue.shift(),
          entry = seen.get(key(p));
        for (let d of dirs) {
          let n = add(p, d),
            c = this.cell(n);
          if (
            !c ||
            !this.visible(n) ||
            (c.door && !c.open) ||
            (!jump && c.terrain === "rock")
          )
            continue;
          let occ = this.occupant(n, f.id);
          if (occ && !jump && occ.team !== f.team) continue;
          if (avoid && c.terrain === "trap") continue;
          let cost = entry.cost + (!jump && c.terrain === "difficult" ? 2 : 1);
          if (cost > max) continue;
          let prev = seen.get(key(n));
          let hazards = entry.hazards + (c.terrain === "trap" ? 1 : 0);
          if (
            prev &&
            ((cautious && prev.hazards < hazards) ||
              ((!cautious || prev.hazards === hazards) && prev.cost <= cost))
          )
            continue;
          seen.set(key(n), { cost, path: [...entry.path, n], hazards });
          queue.push(n);
        }
      }
      return seen;
    }
    canTarget(f, t, a) {
      return (
        !t.dead &&
        t.team !== f.team &&
        !t.conditions.invisible &&
        this.visible(t.pos) &&
        distance(f.pos, t.pos) <= a.range &&
        this.line(f.pos, t.pos)
      );
    }
    openDoor(c) {
      if (!c.door || c.open) return;
      c.open = true;
      this.s.rooms.push(c.nextRoom);
      this.log(`房门开启，揭示第 ${c.nextRoom + 1} 个房间。`);
      let incoming = [];
      for (let m of this.s.monsters.filter(
        (m) => m.room === c.nextRoom && !m.dead,
      )) {
        if (this.s.monsterDecks[m.type]?.card == null) this.drawMonster(m.type);
        let card = this.monsterCard(m.type);
        incoming.push({
          id: m.id,
          init: card.init,
          elite: m.elite,
          num: m.number,
        });
      }
      let done = this.s.order.slice(0, this.s.turn + 1),
        remaining = this.s.order.slice(this.s.turn + 1);
      let earlier = incoming.filter((x) => x.init <= this.active().init);
      this.sortOrder(earlier);
      remaining.push(...incoming.filter((x) => x.init > this.active().init));
      this.sortOrder(remaining);
      this.s.order = [...done, ...earlier, ...remaining];
    }
    loot(h, range) {
      for (let c of this.s.cells.filter(
        (c) =>
          this.visible(c.p) &&
          distance(h.pos, c.p) <= range &&
          this.line(h.pos, c.p),
      )) {
        if (c.coins) {
          h.coins += c.coins;
          this.log(`${h.name} 拾取 ${c.coins} 枚金币标记。`);
          c.coins = 0;
        }
        if (c.terrain === "chest") {
          c.terrain = "floor";
          this.s.chests++;
          h.coins += 3;
          this.log(`${h.name} 打开练习宝箱，取得 3 枚金币标记。`);
        }
      }
      this.checkGoal();
    }
    available(id, half) {
      let h = this.active();
      return (
        h?.chosen?.includes(id) &&
        !h.used.some((u) => u.id === id || u.half === half)
      );
    }
    beginAction(id, half, basic = false) {
      let h = this.active();
      if (
        this.s.phase !== "act" ||
        this.s.mode ||
        this.s.pending ||
        !this.available(id, half)
      )
        return;
      let data = basic
        ? {
            ops: [
              half === 0
                ? { type: "attack", n: 2, range: 1 }
                : { type: "move", n: 2 },
            ],
          }
        : clone(D.cards[id][half === 0 ? "top" : "bottom"]);
      this.s.mode = {
        id,
        half,
        data,
        ops: data.ops,
        op: 0,
        started: false,
        hit: [],
        remaining: null,
        consumed: false,
      };
      if (data.consume) this.s.mode.askElement = true;
      this.prepareOp();
    }
    consume(element) {
      let m = this.s.mode;
      if (!m?.askElement) return;
      if (element) {
        let c = m.data.consume;
        if (
          this.s.elements[element] <= 0 ||
          (c.element !== "any" && c.element !== element)
        )
          return;
        this.s.elements[element] = 0;
        m.consumed = true;
        m.boost = clone(c);
        this.log(`消耗${D.elements[element]}元素。`);
      }
      m.askElement = false;
      this.prepareOp();
    }
    mark() {
      let m = this.s.mode,
        h = this.active();
      if (m.started) return;
      m.started = true;
      h.used.push({ id: m.id, half: m.half });
      h.cardUse[m.id] = { loss: !!m.data.loss, permanent: !!m.data.permanent };
      h.xp += m.data.xp || 0;
      if (m.data.infuse) h.infusions.push(m.data.infuse);
      if (m.boost?.xp) h.xp += m.boost.xp;
      if (m.boost?.shield) this.roundBonus(h, "roundShield", m.boost.shield);
      if (m.boost?.retaliate)
        this.roundBonus(h, "roundRetaliate", m.boost.retaliate);
    }
    prepareOp() {
      let m = this.s.mode;
      if (!m || m.askElement) return;
      let h = this.active();
      if (!h || h.dead) {
        this.s.mode = null;
        return;
      }
      let op = m.ops[m.op];
      if (!op) {
        this.endAction();
        return;
      }
      m.current = clone(op);
      if (op.n === "moved") m.current.n = h.moved;
      if (op.n === "damage") m.current.n = h.damageDealt;
      m.hit = [];
      m.remaining = m.current.n;
      if (op.type === "attack" && h.conditions.disarm) {
        this.log("缴械：跳过攻击。");
        this.nextOp();
        return;
      }
      if (op.type === "move" && h.conditions.immobilize) {
        this.log("定身：跳过移动。");
        this.nextOp();
        return;
      }
      if (
        [
          "shield",
          "retaliate",
          "attackBonus",
          "redirect",
          "persistent",
          "recover",
          "loot",
        ].includes(op.type)
      ) {
        this.mark();
        if (op.type === "shield") this.roundBonus(h, "roundShield", op.n);
        if (op.type === "retaliate") {
          for (let t of op.allies
            ? this.allies(h).filter((t) => distance(h.pos, t.pos) <= 1)
            : [h])
            this.roundBonus(
              h,
              "roundRetaliate",
              op.n + (m.boost?.retaliateBonus || 0),
              t,
            );
          if (op.xpHit) this.roundBonus(h, "retaliateXP", op.xpHit);
        }
        if (op.type === "attackBonus") this.roundBonus(h, "roundAttack", op.n);
        if (op.type === "redirect") this.roundBonus(h, "redirect", 1);
        if (op.type === "persistent") {
          h.active.push({
            card: m.id,
            effect: op.effect,
            n: op.n + (m.boost?.persistent || 0),
            charges: op.charges,
            xpSlots: op.xpSlots,
            used: 0,
          });
        }
        if (op.type === "recover") {
          h.hand.push(...h.lost.filter((id) => !h.permanent.includes(id)));
          h.lost = h.lost.filter((id) => h.permanent.includes(id));
          this.log("复苏以太：回收全部可回收的损失牌。");
        }
        if (op.type === "loot") this.loot(h, op.n);
        this.nextOp();
        return;
      }
      if (op.type === "trample") {
        this.mark();
        let targets = [...new Set(h.passed)]
          .map((id) => this.figure(id))
          .filter((t) => t && !t.dead);
        for (let t of targets)
          this.s.jobs.push({
            type: "attack",
            actor: h.id,
            target: t.id,
            ability: { n: 2, range: 1, ignoreRange: true },
            card: m.id,
          });
        this.s.jobs.push({ type: "nextOp" });
        this.pump();
      }
    }
    nextOp() {
      let m = this.s.mode;
      if (!m) return;
      m.op++;
      m.hit = [];
      m.remaining = null;
      this.prepareOp();
    }
    endAction() {
      let m = this.s.mode;
      if (!m) return;
      if (!m.started) {
        this.active().used.push({ id: m.id, half: m.half });
        this.active().cardUse[m.id] = { loss: false };
      }
      let h = this.active(),
        use = h.cardUse[m.id];
      if (use && !h.active.some((a) => a.card === m.id)) {
        (use.loss ? h.lost : h.discard).push(m.id);
        if (use.permanent) h.permanent.push(m.id);
        use.settled = true;
      }
      h.attackItem = 0;
      h.attackAdv = false;
      this.s.mode = null;
      this.checkGoal();
    }
    cancelAction() {
      if (this.s.mode && !this.s.mode.started) {
        this.s.mode = null;
      }
    }
    skipOp() {
      if (!this.s.mode || this.s.pending) return;
      let m = this.s.mode;
      if (m.current?.type === "move") {
        let h = this.active();
        if (this.occupant(h.pos, h.id) || this.cell(h.pos)?.terrain === "rock")
          return;
        if (m.current.jump) {
          if (this.cell(h.pos).terrain === "difficult") {
            if (m.remaining < 1) return;
            m.remaining--;
          }
          this.land(h);
        }
      }
      this.nextOp();
      this.pump();
    }
    land(f) {
      let c = this.cell(f.pos);
      if (c?.terrain === "trap") {
        c.terrain = "floor";
        this.s.jobs.push({
          type: "damage",
          target: f.id,
          n: c.damage || 2 + this.s.level,
          source: "陷阱",
        });
      }
    }
    moveStep(p) {
      let m = this.s.mode,
        h = this.active();
      if (
        !m ||
        m.askElement ||
        m.current.type !== "move" ||
        this.s.pending ||
        distance(h.pos, p) !== 1
      )
        return false;
      let c = this.cell(p),
        jump = m.current.jump;
      let cost =
        c?.terrain === "difficult" && (!jump || m.remaining === 1) ? 2 : 1;
      if (
        !c ||
        !this.visible(p) ||
        m.remaining < cost ||
        (!jump && c.terrain === "rock")
      )
        return false;
      let occ = this.occupant(p, h.id);
      if (occ && !jump && occ.team !== h.team) return false;
      if (m.remaining === cost && (occ || c.terrain === "rock")) return false;
      this.mark();
      if (c.door && !c.open) this.openDoor(c);
      h.pos = p.slice();
      h.moved++;
      if (occ && occ.team !== h.team) h.passed.push(occ.id);
      m.remaining -= cost;
      if (!jump) this.land(h);
      this.checkGoal();
      if (m.remaining === 0 && !occ && c.terrain !== "rock") {
        if (jump) this.land(h);
        this.s.jobs.push({ type: "nextOp" });
      }
      this.pump();
      return true;
    }
    attackValue(h, m) {
      let a = clone(m.current);
      a.n += m.boost?.attack || 0;
      a.pierce = (a.pierce || 0) + (m.boost?.pierce || 0);
      if (m.boost?.condition) a.condition = m.boost.condition;
      return a;
    }
    areaTargets(h, a, anchor) {
      let all = this.enemies(h);
      if (a.all)
        return all.filter(
          (t) => distance(h.pos, t.pos) <= 1 && this.line(h.pos, t.pos),
        );
      if (["fan2", "fan3", "line2"].includes(a.shape)) {
        let d = dirs.findIndex((d) => eq(add(h.pos, d), anchor));
        if (d < 0) return [];
        let positions =
          a.shape === "line2"
            ? [add(h.pos, dirs[d]), add(add(h.pos, dirs[d]), dirs[d])]
            : Array.from({ length: a.shape === "fan2" ? 2 : 3 }, (_, i) =>
                add(h.pos, dirs[(d + i) % 6]),
              );
        return all.filter(
          (t) => positions.some((p) => eq(p, t.pos)) && this.line(h.pos, t.pos),
        );
      }
      if (a.shape === "burst") {
        if (distance(h.pos, anchor) > a.range + 1) return [];
        let circle = [anchor, ...dirs.map((d) => add(anchor, d))];
        if (
          !circle.some((p) => this.visible(p) && distance(h.pos, p) <= a.range)
        )
          return [];
        return all.filter(
          (t) => distance(anchor, t.pos) <= 1 && this.line(h.pos, t.pos),
        );
      }
      if (a.shape === "path") {
        if (distance(h.pos, anchor) > a.range || !this.line(h.pos, anchor))
          return [];
        let length = distance(h.pos, anchor),
          path = [h.pos];
        for (let n = 0; n < length; n++) {
          let next = dirs
            .map((d) => add(path.at(-1), d))
            .filter(
              (p) =>
                this.visible(p) &&
                distance(p, anchor) < distance(path.at(-1), anchor),
            )
            .sort((p, q) => key(p).localeCompare(key(q)))[0];
          if (!next) return [];
          path.push(next);
        }
        return all.filter(
          (t) => path.some((p) => eq(p, t.pos)) && this.line(h.pos, t.pos),
        );
      }
      return [];
    }
    target(id) {
      let m = this.s.mode,
        h = this.active(),
        t = this.figure(id);
      if (!m || m.askElement || this.s.pending || !t || t.dead) return;
      let a = m.current;
      if (a.type === "attack") {
        if (a.shape || a.all) {
          this.area(t.pos);
          return;
        }
        let attack = this.attackValue(h, m);
        if (m.hit.includes(id) || !this.canTarget(h, t, attack)) return;
        this.mark();
        m.hit.push(id);
        this.s.jobs.push({
          type: "attack",
          actor: h.id,
          target: id,
          ability: attack,
          card: m.id,
        });
        if (m.hit.length >= (a.targets || 1))
          this.s.jobs.push({ type: "nextOp" });
        this.pump();
      } else if (a.type === "heal") {
        if (
          t.team !== h.team ||
          distance(h.pos, t.pos) > a.range ||
          !this.line(h.pos, t.pos)
        )
          return;
        this.mark();
        this.heal(t, a.n);
        this.nextOp();
      } else if (a.type === "kill") {
        if (
          t.team === h.team ||
          t.elite ||
          distance(h.pos, t.pos) > 1 ||
          t.conditions.invisible
        )
          return;
        this.mark();
        this.exhaust(t);
        h.kills++;
        this.nextOp();
      } else if (a.type === "push") {
        if (
          t.team === h.team ||
          distance(h.pos, t.pos) > a.range ||
          m.hit.includes(id) ||
          t.conditions.invisible
        )
          return;
        this.mark();
        m.hit.push(id);
        this.s.pending = {
          kind: "push",
          actor: h.id,
          target: id,
          left: a.n,
          returnOp: !a.all,
        };
      }
    }
    area(p) {
      let m = this.s.mode,
        h = this.active();
      if (!m || m.current.type !== "attack" || this.s.pending) return;
      let a = this.attackValue(h, m),
        targets = this.areaTargets(h, a, p);
      if (!targets.length) return;
      this.mark();
      for (let t of targets)
        this.s.jobs.push({
          type: "attack",
          actor: h.id,
          target: t.id,
          ability: { ...a, ignoreRange: true },
          card: m.id,
        });
      this.s.jobs.push({ type: "nextOp" });
      this.pump();
    }
    summon(p) {
      let h = this.active(),
        m = this.s.mode;
      if (
        m?.current.type !== "summon" ||
        distance(h.pos, p) !== 1 ||
        !this.floor(p) ||
        this.occupant(p) ||
        this.cell(p).terrain !== "floor" ||
        this.cell(p).coins
      )
        return;
      this.mark();
      let a = m.current,
        f = {
          ...baseFigure(
            "u" + this.s.summons.length,
            "神秘盟友",
            "hero",
            p.slice(),
            a.hp,
          ),
          move: a.move,
          attack: a.attack,
          range: a.range,
          owner: h.index,
          summonCard: m.id,
          born: this.s.round,
          init: h.init - 0.1,
        };
      this.s.summons.push(f);
      h.active.push({ card: m.id, effect: "summon" });
      this.nextOp();
    }
    pushOptions() {
      let p = this.s.pending;
      if (p?.kind !== "push") return [];
      let actor = this.figure(p.actor),
        target = this.figure(p.target);
      return dirs
        .map((d) => add(target.pos, d))
        .filter(
          (n) =>
            this.floor(n) &&
            !this.occupant(n) &&
            distance(actor.pos, n) > distance(actor.pos, target.pos),
        );
    }
    push(p) {
      let pending = this.s.pending;
      if (pending?.kind !== "push") return;
      if (p === null || !pending.left || !this.pushOptions().length) {
        let next = pending.returnOp;
        this.s.pending = null;
        if (next) this.nextOp();
        this.pump();
        return;
      }
      if (!this.pushOptions().some((n) => eq(n, p))) return;
      let target = this.figure(pending.target);
      target.pos = p.slice();
      pending.left--;
      let cell = this.cell(p);
      if (cell.terrain === "trap") {
        cell.terrain = "floor";
        let n = cell.damage || 2 + this.s.level;
        if (target.hand) {
          this.s.jobs.unshift({ type: "resumePush", pending: clone(pending) });
          this.s.pending = null;
          this.takeDamage(target, n, "推入陷阱");
          return;
        } else {
          target.hp = Math.max(0, target.hp - n);
          this.log(`${target.name} 被推入陷阱，受到 ${n} 伤害。`);
          if (!target.hp) this.exhaust(target);
        }
      }
      if (!pending.left || target.dead || !this.pushOptions().length)
        this.push(null);
    }
    drawModifier(deck) {
      if (!deck.draw.length) {
        deck.draw = shuffle(deck.discard);
        deck.discard = [];
      }
      let v = deck.draw.pop();
      if (v !== "curse" && v !== "bless") deck.discard.push(v);
      if (v === "null" || v === "double") deck.reshuffle = true;
      return v ?? 0;
    }
    attack(actor, target, a) {
      let f = this.figure(actor),
        t = this.figure(target);
      if (
        !f ||
        f.dead ||
        !t ||
        t.dead ||
        f.conditions.disarm ||
        f.conditions.stun ||
        (!a.ignoreRange && !this.canTarget(f, t, a))
      )
        return;
      if (t.team === "hero") {
        let redirect = this.s.heroes.find(
          (h) =>
            !h.dead &&
            h.redirect &&
            h.id !== t.id &&
            distance(h.pos, t.pos) <= 1 &&
            !h.conditions.invisible,
        );
        if (redirect) {
          t = redirect;
          this.log("挑衅怒吼将攻击转移至蛮族。");
        }
      }
      if (f.hand && this.s.mode) this.s.mode.attacked = true;
      let n = Math.max(
        0,
        a.n +
          f.roundAttack +
          (f.attackItem || 0) +
          (t.conditions.poison ? 1 : 0),
      );
      let boost = f.active?.find((e) => e.effect === "attack");
      if (boost) {
        n += boost.n;
        this.charge(f, boost);
      }
      let shield = t.shield || 0;
      shield += t.roundShield;
      let ward = t.active?.find((e) => e.effect === "shield");
      if (ward) {
        shield += ward.n;
        this.charge(t, ward);
      }
      shield = Math.max(0, shield - (a.pierce || 0));
      let advantage = !!(f.conditions.strengthen || f.attackAdv),
        disadvantage = !!(
          f.conditions.muddle ||
          (a.range > 1 && distance(f.pos, t.pos) === 1)
        );
      let deck =
        f.team === "monster"
          ? this.s.monsterModifier
          : f.deck || this.hero(f.owner).deck;
      let vals = [this.drawModifier(deck)];
      let value = (v) =>
        ["null", "curse"].includes(v)
          ? 0
          : ["double", "bless"].includes(v)
            ? 2 * n
            : Math.max(0, n + v);
      let mod = vals[0];
      if (advantage !== disadvantage) {
        vals.push(this.drawModifier(deck));
        mod = (
          advantage
            ? value(vals[0]) >= value(vals[1])
            : value(vals[0]) <= value(vals[1])
        )
          ? vals[0]
          : vals[1];
      }
      let dmg = Math.max(0, value(mod) - shield);
      if (f.hand) {
        f.xp += a.xpTarget || 0;
        f.damageDealt += Math.min(dmg, t.hp);
      }
      this.s.lastAttack = {
        actor: f.name,
        target: t.name,
        base: n,
        mods: vals,
        shield,
        damage: dmg,
      };
      this.log(
        `${f.name} → ${t.name}：攻击 ${n}，修正 ${vals.join(" / ")}，护盾 ${shield}，伤害 ${dmg}。`,
      );
      this.s.jobs.unshift({
        type: "afterAttack",
        actor: f.id,
        target: t.id,
        ability: a,
      });
      if (dmg > 0)
        this.s.jobs.unshift({
          type: "damage",
          target: t.id,
          n: dmg,
          source: f.name,
          attack: true,
        });
    }
    afterAttack(f, t, a) {
      if (!f || !t) return;
      if (t.dead) {
        if (f.hand) f.kills++;
        return;
      }
      if (a.condition) this.condition(t, a.condition);
      if (a.push && f.hand) {
        this.s.pending = {
          kind: "push",
          actor: f.id,
          target: t.id,
          left: a.push,
          returnOp: false,
        };
        this.s.jobs.unshift({ type: "retaliate", actor: f.id, target: t.id });
        return;
      }
      this.retaliate(f, t);
    }
    retaliate(f, t) {
      if (!f || !t || f.dead || t.dead || distance(f.pos, t.pos) > 1) return;
      let n = t.roundRetaliate || 0;
      if (n) {
        if (t.hand) t.xp += t.retaliateXP || 0;
        this.s.jobs.unshift({
          type: "damage",
          target: f.id,
          n,
          source: "反击",
        });
      }
    }
    // Monster focus: minimum path to an attack hex; proximity, initiative, summons break ties.
    aiPlan(f, a) {
      const range = a.range || f.range || 1;
      let enemies = this.enemies(f);
      let scan = (avoid) => {
        let paths = this.paths(f, { avoid, cautious: !avoid });
        let candidates = [];
        for (let t of enemies) {
          let cells = [...paths.entries()]
            .map(([k, e]) => ({ pos: k.split(",").map(Number), ...e }))
            .filter(
              (e) =>
                !this.occupant(e.pos, f.id) &&
                this.cell(e.pos).terrain !== "rock" &&
                distance(e.pos, t.pos) <= range &&
                this.line(e.pos, t.pos),
            );
          if (!cells.length) continue;
          cells.sort((a, b) => a.hazards - b.hazards || a.cost - b.cost);
          let best = cells[0];
          candidates.push({
            target: t,
            cost: best.cost,
            hazards: best.hazards,
            cells,
            paths,
          });
        }
        candidates.sort(
          (a, b) =>
            a.hazards - b.hazards ||
            a.cost - b.cost ||
            distance(f.pos, a.target.pos) - distance(f.pos, b.target.pos) ||
            (a.target.init ?? 99) - (b.target.init ?? 99) ||
            Number(!!b.target.summonCard) - Number(!!a.target.summonCard) ||
            a.target.id.localeCompare(b.target.id),
        );
        return candidates[0];
      };
      let pick = scan(true) || scan(false);
      if (!pick) return null;
      let move = Math.max(0, a.move || 0);
      if (f.conditions.immobilize) move = 0;
      let { target, cells, paths } = pick;
      let reachable = cells.filter(
        (c) => c.cost <= move && c.hazards === pick.hazards,
      );
      let desired;
      if (reachable.length) {
        reachable.sort(
          (p, q) =>
            Number(range > 1 && distance(p.pos, target.pos) === 1) -
              Number(range > 1 && distance(q.pos, target.pos) === 1) ||
            (a.targets > 1
              ? enemies.filter(
                  (t) =>
                    distance(q.pos, t.pos) <= range && this.line(q.pos, t.pos),
                ).length -
                enemies.filter(
                  (t) =>
                    distance(p.pos, t.pos) <= range && this.line(p.pos, t.pos),
                ).length
              : 0) ||
            p.cost - q.cost ||
            key(p.pos).localeCompare(key(q.pos)),
        );
        desired = reachable[0];
      } else {
        cells.sort(
          (p, q) =>
            p.hazards - q.hazards ||
            p.cost - q.cost ||
            key(p.pos).localeCompare(key(q.pos)),
        );
        let goal = cells[0],
          path = goal.path;
        let legal = path.filter(
          (p) => paths.get(key(p)).cost <= move && !this.occupant(p, f.id),
        );
        let pos = legal.at(-1) || f.pos;
        desired = { pos, path: paths.get(key(pos)).path };
      }
      return { target: target.id, path: desired.path || [], pos: desired.pos };
    }
    monsterAct() {
      let f = this.active();
      if (this.s.phase !== "monster" || !f || f.dead || this.s.pending) return;
      if (f.conditions.stun) {
        this.log(`${f.name} 眩晕，跳过行动。`);
        this.endTurn();
        return;
      }
      let card = this.monsterCard(f.type);
      this.s.jobs.push({ type: "ai", id: f.id, card });
      this.s.jobs.push({ type: "endTurn" });
      this.pump();
    }
    ai(f, card, isSummon = false) {
      if (!f || f.dead || f.conditions.stun) return;
      let attack = card.attack !== undefined;
      let a = {
        n: Math.max(0, f.attack + (card.attack || 0)),
        range: attack
          ? card.range || Math.max(1, (f.range || 1) + (card.rangeMod || 0))
          : 1,
        move: card.move === undefined ? 0 : Math.max(0, f.move + card.move),
        targets: card.targets || f.targets || 1,
        condition: card.condition,
      };
      f.roundShield += card.shield || 0;
      f.roundRetaliate += card.retaliate || 0;
      let plan = this.aiPlan(f, a);
      if (plan) {
        this.log(`${f.name} 聚焦 ${this.figure(plan.target).name}。`);
        for (let p of plan.path) {
          this.s.jobs.push({ type: "aiStep", id: f.id, p });
        }
        this.s.jobs.push({
          type: "aiAttack",
          id: f.id,
          focus: plan.target,
          a,
          enabled: attack,
          sameTarget: card.sameTarget,
        });
      }
      if (card.heal) this.s.jobs.push({ type: "heal", id: f.id, n: card.heal });
      if (card.strengthen)
        this.s.jobs.push({
          type: "condition",
          id: f.id,
          condition: "strengthen",
        });
      if (card.trap) this.s.jobs.push({ type: "trap", id: f.id, n: card.trap });
      if (isSummon) this.s.jobs.push({ type: "summonEnd", id: f.id });
    }
    aiAttack(f, job) {
      if (f.dead || !job.enabled || f.conditions.disarm || f.conditions.stun)
        return;
      let a = job.a,
        focus = this.figure(job.focus);
      if (!focus || !this.canTarget(f, focus, a)) return;
      let targets = [
        focus,
        ...this.enemies(f)
          .filter((t) => t.id !== focus.id && this.canTarget(f, t, a))
          .sort(
            (x, y) =>
              distance(f.pos, x.pos) - distance(f.pos, y.pos) ||
              (x.init ?? 99) - (y.init ?? 99),
          ),
      ];
      if (job.sameTarget) targets = Array(a.targets).fill(focus);
      for (let t of targets.slice(0, a.targets).reverse())
        this.s.jobs.unshift({
          type: "attack",
          actor: f.id,
          target: t.id,
          ability: a,
        });
    }
    useItem(i, id) {
      let h = this.hero(i),
        item = h.items.find((x) => x.id === id);
      if (
        this.active()?.id !== h.id ||
        !["act", "longrest"].includes(this.s.phase) ||
        this.s.pending ||
        h.conditions.stun ||
        item?.state !== "ready"
      )
        return;
      let m = this.s.mode;
      if (id === "boots") {
        if (m?.current?.type !== "move") return;
        m.remaining += 2;
      } else if (id === "goggles" || id === "power") {
        if (m?.current?.type !== "attack" || m.hit.length || m.attacked) return;
        if (id === "goggles") h.attackAdv = true;
        else h.attackItem = 1;
      } else if (id === "heal") this.heal(h, 3);
      else if (id === "cloak") this.condition(h, "invisible");
      else if (id === "stamina") {
        if (!h.discard.length) return;
        this.s.pending = { kind: "stamina", hero: i, selected: [] };
        return;
      }
      item.state = D.items[id].uses;
    }
    recoverDiscard(ids) {
      let p = this.s.pending;
      if (
        p?.kind !== "stamina" ||
        !ids.length ||
        ids.length > 2 ||
        new Set(ids).size !== ids.length
      )
        return;
      let h = this.hero(p.hero);
      if (!ids.every((x) => h.discard.includes(x))) return;
      h.discard = h.discard.filter((x) => !ids.includes(x));
      h.hand.push(...ids);
      h.items.find((i) => i.id === "stamina").state = "consumed";
      this.s.pending = null;
    }
    pump() {
      let guard = 0;
      while (
        this.s.jobs.length &&
        !this.s.pending &&
        this.s.phase !== "over" &&
        guard++ < 500
      ) {
        let job = this.s.jobs.shift(),
          f = this.figure(job.id || job.target);
        switch (job.type) {
          case "damage":
            this.takeDamage(f, job.n, job.source, job.attack);
            break;
          case "attack":
            this.attack(job.actor, job.target, job.ability);
            break;
          case "afterAttack":
            this.afterAttack(this.figure(job.actor), f, job.ability);
            break;
          case "retaliate":
            this.retaliate(this.figure(job.actor), f);
            break;
          case "nextOp":
            this.nextOp();
            break;
          case "ready":
            this.ready(f);
            break;
          case "endTurn":
            this.endTurn();
            break;
          case "heal":
            if (!f.dead) this.heal(f, job.n);
            break;
          case "condition":
            if (!f.dead) this.condition(f, job.condition);
            break;
          case "ai": {
            let old = this.s.jobs;
            this.s.jobs = [];
            this.ai(f, job.card);
            this.s.jobs.push(...old);
            break;
          }
          case "aiAttack":
            this.aiAttack(f, job);
            break;
          case "aiStep":
            if (!f.dead) {
              f.pos = job.p;
              let c = this.cell(f.pos);
              if (c.terrain === "trap") {
                c.terrain = "floor";
                this.s.jobs.unshift({
                  type: "damage",
                  target: f.id,
                  n: c.damage || 2 + this.s.level,
                  source: "陷阱",
                });
              }
            }
            break;
          case "trap":
            if (!f.dead) {
              let p = dirs
                .map((d) => add(f.pos, d))
                .filter(
                  (p) =>
                    this.floor(p) &&
                    !this.occupant(p) &&
                    this.cell(p).terrain === "floor" &&
                    !this.cell(p).coins,
                )
                .sort(
                  (a, b) =>
                    Math.min(
                      ...this.enemies(f).map((t) => distance(a, t.pos)),
                    ) -
                    Math.min(...this.enemies(f).map((t) => distance(b, t.pos))),
                )[0];
              if (p) {
                this.cell(p).terrain = "trap";
                this.cell(p).damage = job.n;
              }
            }
            break;
          case "resumeShort":
            if (!this.hero(job.pending.hero).dead) this.s.pending = job.pending;
            break;
          case "resumePush":
            if (!this.figure(job.pending.target).dead)
              this.s.pending = job.pending;
            break;
          case "summonTurns": {
            let h = this.figure(job.hero),
              units = this.s.summons.filter(
                (u) =>
                  !h.dead &&
                  !u.dead &&
                  u.owner === h.index &&
                  u.born < this.s.round,
              );
            let old = this.s.jobs;
            this.s.jobs = [];
            for (let u of units) {
              u.init = h.init - 0.1;
              u.turns++;
              if (u.conditions.wound)
                this.s.jobs.push({
                  type: "damage",
                  target: u.id,
                  n: 1,
                  source: "创伤",
                });
              this.s.jobs.push({ type: "summonAI", id: u.id });
            }
            this.s.jobs.push(...old);
            break;
          }
          case "summonAI": {
            let old = this.s.jobs;
            this.s.jobs = [];
            this.ai(f, { move: 0, attack: 0 }, true);
            this.s.jobs.push(...old);
            break;
          }
          case "summonEnd":
            for (let [c, v] of Object.entries(f.conditions))
              if (v > 0 && v <= f.turns) delete f.conditions[c];
            break;
        }
      }
      if (this.s.heroes.every((h) => h.dead) && this.s.phase !== "over")
        this.complete(false);
      else if (
        this.s.phase === "act" &&
        this.active()?.dead &&
        !this.s.pending &&
        !this.s.jobs.length
      ) {
        this.s.mode = null;
        this.endTurn();
      }
    }
  }
  const API = { Game, D, dirs, distance, key, eq, add, shuffle, modifierDeck };
  if (typeof module !== "undefined") module.exports = API;
  root.GH = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
