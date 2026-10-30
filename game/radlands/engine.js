(function (root) {
  "use strict";
  const { C, pools } =
    typeof module !== "undefined" ? require("./cards.js") : root.RadCards;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  class Game {
    constructor(saved, mode = "complete", setup = "draft") {
      this.s = saved || this.create(mode);
      this.s.mode ||= "classic";
      this.s.resolving ||= [];
      for (const x of this.s.players) {
        x.abilityCount ??= 0;
        x.sole ??= false;
        x.hurt ??= false;
        x.banned ||= [];
      }
      if (!saved && setup === "starter") {
        const ids = [
          ["arcade", "totem", mode === "classic" ? "mercenary" : "mercenary2"],
          ["garage", "railgun", "depot"],
        ];
        for (let p = 0; p < 2; p++)
          this.p(p).offer = ids[p].map((id) => this.unit(id));
        this.draft(this.p(0).offer.map((c) => c.uid));
        this.draft(this.p(1).offer.map((c) => c.uid));
      }
    }
    create(mode) {
      this.uid = 0;
      const unit = (id) => ({
        uid: ++this.uid,
        id,
        hp: 2,
        used: 0,
        tired: false,
      });
      const camps = this.shuffle(
        (pools[mode] || pools.complete).map((id) => unit(id)),
      );
      const deck = this.shuffle(
        Object.values(C)
          .filter(
            (c) => ["person", "event"].includes(c.type) && c.id !== "raiders",
          )
          .flatMap((c) =>
            Array.from({ length: c.copies || 2 }, () => unit(c.id)),
          ),
      );
      return {
        v: 2,
        mode,
        uid: this.uid,
        phase: "draft",
        draft: 0,
        turn: 0,
        active: Math.random() < 0.5 ? 0 : 1,
        players: [0, 1].map((p) => ({
          hand: [],
          camps: [],
          cols: [[], [], []],
          events: [null, null, null],
          offer: camps.splice(0, 6),
          water: 0,
          entered: 0,
          eventCount: 0,
          resolved: 0,
          raided: false,
          high: false,
        })),
        deck,
        discard: [],
        shuffles: 0,
        tasks: [],
        choice: null,
        log: ["选择三座营地；按所选顺序从左到右布置。"],
        winner: null,
      };
    }
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    p(i = this.s.active) {
      return this.s.players[i];
    }
    note(t) {
      this.s.log.unshift(t);
      this.s.log = this.s.log.slice(0, 70);
    }
    unit(id) {
      return { id, uid: ++this.s.uid, hp: 2, used: 0, tired: false };
    }
    people(p) {
      return this.p(p).cols.flat();
    }
    cards(p) {
      return [...this.p(p).camps.filter((c) => c.hp > 0), ...this.people(p)];
    }
    has(p, id) {
      return this.people(p).some((c) => !c.punk && c.id === id && c.hp === 2);
    }
    campHas(p, id) {
      return this.p(p).camps.some((c) => c.id === id && c.hp > 0);
    }
    capacity(p, col) {
      return this.p(p).camps[col]?.removed ? 3 : 2;
    }
    full(p) {
      return this.p(p).cols.every((cs, i) => cs.length >= this.capacity(p, i));
    }
    eventPrice(p, c) {
      return Math.max(0, C[c.id].cost - (this.campHas(p, "warroom") ? 1 : 0));
    }
    entered(c, p) {
      c.enteredTurn = this.s.turn;
      this.p(p).entered++;
    }
    useMark(p, c) {
      this.p(p).abilityCount = (this.p(p).abilityCount || 0) + 1;
      c.used++;
      c.tired = !(this.has(p, "vera") && c.used === 1);
    }
    finish(winner, reason) {
      if (this.s.winner !== null) return;
      this.s.winner = winner;
      this.s.phase = "over";
      this.s.reason = reason;
      this.s.tasks = [];
      this.s.choice = null;
      this.note(reason);
    }
    find(uid) {
      for (let p = 0; p < 2; p++) {
        const x = this.p(p);
        for (let col = 0; col < 3; col++) {
          if (x.camps[col]?.uid === uid)
            return { c: x.camps[col], p, col, camp: true };
          const n = x.cols[col].findIndex((c) => c.uid === uid);
          if (n >= 0) return { c: x.cols[col][n], p, col, n, camp: false };
        }
      }
      return null;
    }
    title(c) {
      return c.punk ? "朋克" : C[c.id].name;
    }
    canAct(p) {
      return (
        this.s.phase === "play" &&
        this.s.winner === null &&
        !this.s.choice &&
        !this.s.tasks.length &&
        this.s.active === p
      );
    }
    ready(c) {
      return c.hp > 0 && !c.tired && (C[c.id].type === "camp" || c.hp === 2);
    }
    abilities(p, c) {
      if (c.punk)
        return [
          ...(this.has(p, "argo")
            ? [{ cost: 1, effect: "damage", text: "伤害（阿尔戈）" }]
            : []),
          ...(this.campHas(p, "armory")
            ? [{ cost: 2, effect: "damage", text: "伤害（军械库）" }]
            : []),
        ];
      let aa = C[c.id].abilities || [];
      if (C[c.id].type === "person" && c.id !== "argo" && this.has(p, "argo"))
        aa = [...aa, { cost: 1, effect: "damage", text: "伤害（阿尔戈）" }];
      return aa;
    }
    price(p, c, a) {
      let n = a.cost;
      if (c.id === "pillbox")
        n -= this.p(p).camps.filter((c) => !c.hp && !c.removed).length;
      if (["command", "command2"].includes(c.id))
        n -= this.people(p).filter((c) => c.punk).length;
      return Math.max(0, n);
    }
    playPrice(p, c, col) {
      let n = C[c.id].cost;
      if (
        c.id === "holdout" &&
        !this.p(p).camps[col].hp &&
        !this.p(p).camps[col].removed
      )
        n = 0;
      const b = this.p(p).camps[col];
      if (b.id === "oasis" && b.hp > 0 && !this.p(p).cols[col].length) n--;
      return Math.max(0, n);
    }
    exposed(f) {
      const x = this.p(f.p),
        col = x.cols[f.col],
        b = x.camps[f.col];
      if (this.p(1 - f.p).high || this.s.allExposed) return true;
      const behind = this.behindCount(f.p, f.col);
      const front = this.campFront(f.p, f.col);
      if (f.camp) return front === 0;
      return f.n === 0 && front > 0;
    }
    behindCount(p, col) {
      const b = this.p(p).camps[col];
      if (!b?.hp) return 0;
      if (b.id === "fortress") return 1;
      if (b.id === "juggernaut") return Math.min(2, b.moves || 0);
      return 0;
    }

    campFront(p, col) {
      const b = this.p(p).camps[col],
        len = this.p(p).cols[col].length,
        behind = this.behindCount(p, col);
      return behind
        ? Math.max(0, Math.min(len, b.front ?? Math.max(0, len - behind)))
        : len;
    }
    insertAt(p, col, at, c, behindCamp = false) {
      const x = this.p(p),
        b = x.camps[col],
        front = this.campFront(p, col),
        behind = this.behindCount(p, col);
      x.cols[col].splice(at, 0, c);
      if (behind) {
        const wanted =
            front + (at < front || (at === front && !behindCamp) ? 1 : 0),
          len = x.cols[col].length;
        b.front = Math.max(len - behind, Math.min(wanted, 2 - behind, len));
      }
    }
    detach(uid) {
      const f = this.find(uid);
      if (!f || f.camp) return null;
      const b = this.p(f.p).camps[f.col],
        front = this.campFront(f.p, f.col);
      this.p(f.p).cols[f.col].splice(f.n, 1);
      if (this.behindCount(f.p, f.col))
        b.front = Math.max(0, front - (f.n < front ? 1 : 0));
      return f.c;
    }
    destroy(uid) {
      const f = this.find(uid);
      if (!f || !f.c.hp) return;
      const c = f.c;
      if (f.p === this.s.active) this.p(f.p).hurt = true;
      this.note(`${this.title(c)}被消灭`);
      if (f.camp) {
        c.hp = 0;
        c.front = undefined;
        c.moves = 0;
        this.checkWin();
      } else {
        this.p(f.p).cols[f.col].splice(f.n, 1);
        const b = this.p(f.p).camps[f.col];
        if (b.front !== undefined && f.n < b.front) b.front--;
        if (c.punk) {
          delete c.punk;
          this.s.deck.push(this.clean(c));
        } else this.s.discard.push(this.clean(c));
      }
    }
    clean(c) {
      return { id: c.id, uid: c.uid, hp: 2, used: 0, tired: false };
    }
    damage(uid) {
      const f = this.find(uid);
      if (!f || !f.c.hp) return;
      if (f.p === this.s.active) this.p(f.p).hurt = true;
      if (f.c.punk || f.c.hp === 1) this.destroy(uid);
      else {
        f.c.hp = 1;
        this.note(`${this.title(f.c)}受伤`);
      }
    }
    checkWin() {
      for (let p = 0; p < 2; p++)
        if (
          this.p(p).camps.length === 3 &&
          this.p(p).camps.every((c) => c.hp === 0)
        ) {
          this.s.winner = 1 - p;
          this.s.phase = "over";
          this.note(`玩家 ${2 - p} 获胜`);
          this.s.tasks = [];
          this.s.choice = null;
          return;
        }
    }
    emptyDeck() {
      if (this.s.deck.length || this.s.winner !== null) return;
      const owner = [0, 1].find((p) => this.campHas(p, "obelisk2"));
      if (owner !== undefined) {
        this.finish(owner, `玩家 ${owner + 1} 的方尖碑触发：牌堆耗尽，获胜`);
        return;
      }
      if (this.s.shuffles >= 1 || !this.s.discard.length) {
        this.finish("draw", "牌堆耗尽，对局平局");
        return;
      }
      this.s.deck = this.shuffle(this.s.discard.splice(0));
      this.s.shuffles++;
      this.note("弃牌堆重新洗牌（最后一轮牌堆）");
    }
    take() {
      if (!this.s.deck.length) this.emptyDeck();
      if (this.s.winner !== null) return null;
      return this.s.deck.pop() || null;
    }
    draw(p, n = 1) {
      const got = [];
      for (let i = 0; i < n && this.s.winner === null; i++) {
        const c = this.take();
        if (c) {
          this.p(p).hand.push(this.clean(c));
          got.push(c.uid);
          this.emptyDeck();
        }
      }
      return got;
    }
    push(...tasks) {
      this.s.tasks.unshift(...tasks.filter(Boolean));
    }
    effect(e, p = this.s.active, src = null, extra = {}) {
      return { e, p, src, ...extra };
    }
    ask(title, p, options, optional = false) {
      if (this.s.winner !== null) return;
      if (!options.length) return;
      this.s.choice = { title, p, options, optional };
    }
    choose(index) {
      const ch = this.s.choice;
      if (!ch) return false;
      if (index === -1) {
        if (!ch.optional) return false;
        this.s.choice = null;
      } else {
        const opt = ch.options[index];
        if (!opt) return false;
        this.s.choice = null;
        this.push(...(opt.tasks || []));
      }
      this.run();
      return true;
    }
    target(t, title, cards, action, optional = false) {
      this.ask(
        title,
        t.p,
        cards.map((c) => ({
          label: this.title(c),
          uid: c.uid,
          tasks: [{ ...t, e: action, target: c.uid }],
        })),
        optional,
      );
    }
    draft(ids) {
      if (
        this.s.phase !== "draft" ||
        ids.length !== 3 ||
        new Set(ids).size !== 3
      )
        return false;
      const p = this.p(this.s.draft);
      if (ids.some((id) => !p.offer.some((c) => c.uid === id))) return false;
      p.camps = ids.map((id) => p.offer.find((c) => c.uid === id));
      for (const c of p.camps) {
        if (C[c.id].dead) c.hp = 0;
        if (C[c.id].damaged) c.hp = 1;
      }
      p.offer = [];
      this.s.draft++;
      if (this.s.draft === 2) {
        for (let i = 0; i < 2; i++)
          this.draw(
            i,
            this.p(i).camps.reduce((sum, c) => sum + C[c.id].draw, 0),
          );
        this.s.phase = "play";
        this.begin();
      }
      return true;
    }
    begin() {
      const p = this.s.active,
        x = this.p(p);
      this.s.turn++;
      x.entered = 0;
      x.eventCount = 0;
      x.resolved = 0;
      x.raided = false;
      x.high = false;
      x.abilityCount = 0;
      x.sole = false;
      x.hurt = false;
      x.banned = [];
      for (const c of this.cards(p)) {
        c.tired = false;
        c.used = 0;
      }
      this.note(`第 ${this.s.turn} 回合 · 玩家 ${p + 1}`);
      const event = x.events[0];
      x.events[0] = null;
      if (event)
        this.push(this.effect("resolve", p, event.uid, { card: event }));
      this.s.tasks.push(
        this.effect("shiftEvents", p),
        this.effect("replenish", p),
      );
      this.run();
    }
    end(p) {
      if (!this.canAct(p)) return false;
      this.p(p).water = 0;
      for (const player of this.s.players) player.high = false;
      this.s.allExposed = false;
      // Readiness is tied to each player's turn, including off-turn Mimic/Guillotine.
      for (const c of this.cards(p)) {
        c.tired = false;
        c.used = 0;
      }
      this.s.active = 1 - p;
      this.begin();
      return true;
    }
    buy(p, what) {
      if (!this.canAct(p)) return false;
      let x = this.p(p);
      if (what === "draw" && x.water >= 2) {
        x.water -= 2;
        this.draw(p);
        this.note(`玩家 ${p + 1} 花 2 水抽牌`);
        return true;
      }
      if (
        what === "silo" &&
        x.water >= 1 &&
        !x.hand.some((c) => c.id === "silo")
      ) {
        x.water--;
        x.hand.push(this.unit("silo"));
        this.note(`玩家 ${p + 1} 收取储水塔`);
        return true;
      }
      return false;
    }
    junk(p, uid) {
      if (!this.canAct(p)) return false;
      const x = this.p(p),
        i = x.hand.findIndex((c) => c.uid === uid);
      if (i < 0) return false;
      const c = x.hand.splice(i, 1)[0];
      if (c.id !== "silo") this.s.discard.push(c);
      this.note(`玩家 ${p + 1} 弃用${C[c.id].name}`);
      this.push(this.effect(C[c.id].junk, p));
      this.run();
      return true;
    }
    eventSlot(p, c) {
      if (
        (this.has(p, "zeto") && this.p(p).eventCount === 0) ||
        C[c.id].delay === 0
      )
        return -1;
      for (let n = C[c.id].delay - 1; n < 3; n++)
        if (!this.p(p).events[n]) return n;
      return -2;
    }
    canDeploy(p, c) {
      const x = this.p(p),
        full = this.full(p);
      if ((x.banned || []).includes(c.id)) return false;
      return x.cols.some(
        (col, i) =>
          (col.length < this.capacity(p, i) || full) &&
          x.water >= this.playPrice(p, c, i),
      );
    }
    play(p, uid) {
      if (!this.canAct(p)) return false;
      const c = this.p(p).hand.find((c) => c.uid === uid);
      if (!c || c.id === "silo") return false;
      if (C[c.id].type === "event") {
        const slot = this.eventSlot(p, c);
        if (slot === -2 || this.p(p).water < this.eventPrice(p, c))
          return false;
        this.p(p).water -= this.eventPrice(p, c);
        this.p(p).hand = this.p(p).hand.filter((v) => v.uid !== uid);
        this.p(p).eventCount++;
        this.note(`玩家 ${p + 1} 打出${C[c.id].name}`);
        if (slot === -1) this.push(this.effect("resolve", p, uid, { card: c }));
        else this.p(p).events[slot] = c;
        this.run();
        return true;
      }
      if (!this.canDeploy(p, c)) return false;
      this.push(this.effect("place", p, null, { card: c, fromHand: true }));
      this.run();
      return true;
    }
    conditions(p, c, a) {
      const x = this.p(p),
        e = a.effect;
      if (x.sole || !this.chromeConditions(p, c, a)) return false;
      return !(
        ([
          "cult",
          "catapult",
          "octagon",
          "mulcher",
          "bloodbank",
          "labor",
        ].includes(e) &&
          !this.people(p).length) ||
        (["spies", "transplant"].includes(e) && x.entered < 2) ||
        (e === "watch" && !x.resolved) ||
        (e === "raidRestore" && !x.raided) ||
        (e === "doomDamage" && !this.p(1 - p).events.some(Boolean)) ||
        (e === "punkDamage" && !this.people(p).some((c) => c.punk)) ||
        (e === "arcade" && this.people(p).length > 1) ||
        (e === "construction" && (c.hp !== 2 || !x.camps.some((c) => !c.hp))) ||
        (e === "training" && !this.people(p).some((c) => c.punk)) ||
        (e === "warehouse" && !x.hand.some((c) => c.id !== "silo"))
      );
    }
    use(p, uid, index) {
      if (!this.canAct(p)) return false;
      const f = this.find(uid);
      if (!f || f.p !== p || !this.ready(f.c)) return false;
      const a = this.abilities(p, f.c)[index];
      if (
        !a ||
        !this.conditions(p, f.c, a) ||
        this.price(p, f.c, a) > this.p(p).water
      )
        return false;
      this.p(p).water -= this.price(p, f.c, a);
      this.useMark(p, f.c);
      if (a.effect === "soleDamage") this.p(p).sole = true;
      this.note(`${this.title(f.c)}使用技能`);
      this.push(this.effect(a.effect, p, uid));
      this.run();
      return true;
    }
    run() {
      let n = 0;
      while (!this.s.choice && this.s.tasks.length && this.s.winner === null) {
        if (++n > 300) throw new Error("Effect loop");
        const t = this.s.tasks.shift();
        this.step(t);
      }
    }
    step(t) {
      const p = t.p,
        x = this.p(p),
        enemy = 1 - p,
        opp = this.p(enemy),
        src = this.find(t.src)?.c || t.ghost;
      const own = this.cards(p),
        foes = this.cards(enemy),
        unprotected = foes.filter((c) => this.exposed(this.find(c.uid)));
      const eff = (e, extra = {}) => this.effect(e, p, t.src, extra);
      const target = (title, cards, e, optional = false) =>
        this.target(t, title, cards, e, optional);
      switch (t.e) {
        case "shiftEvents":
          for (let i = 1; i < 3; i++)
            if (x.events[i] && !x.events[i - 1]) {
              x.events[i - 1] = x.events[i];
              x.events[i] = null;
            }
          break;
        case "replenish":
          this.draw(p);
          x.water += this.s.turn === 1 ? 1 : 3;
          break;
        case "draw":
          this.draw(p);
          break;
        case "water":
          x.water++;
          break;
        case "damage":
          target("选择未受保护的敌方卡牌", unprotected, "hit");
          break;
        case "loot":
          this.target(
            { ...t, drawIfCamp: true },
            "选择未受保护的敌方卡牌",
            unprotected,
            "hit",
          );
          break;
        case "injure":
          target(
            "选择未受保护的敌方人员",
            unprotected.filter((c) => C[c.id].type !== "camp"),
            "hit",
          );
          break;
        case "anyDamage":
          target("选择任意敌方卡牌", foes, "hit");
          break;
        case "campDamage":
          target(
            "选择未受保护的敌方营地",
            unprotected.filter((c) => C[c.id].type === "camp"),
            "hit",
          );
          break;
        case "hit": {
          const f = this.find(t.target);
          if (!f) break;
          const camp = f.camp;
          this.damage(t.target);
          if (t.drawIfCamp && camp && this.s.winner === null) this.draw(p);
          break;
        }
        case "destroyCamp":
          target(
            "选择要消灭的敌方营地",
            opp.camps.filter((c) => c.hp),
            "kill",
          );
          break;
        case "banish":
          target("选择任意敌方人员", this.people(enemy), "kill");
          break;
        case "assassinate":
          target(
            "选择未受保护的敌方人员",
            unprotected.filter((c) => C[c.id].type !== "camp"),
            "kill",
          );
          break;
        case "resonate":
          target(
            "选择未受保护且受伤的敌方卡牌",
            unprotected.filter((c) => c.hp === 1),
            "kill",
          );
          break;
        case "kill":
          this.destroy(t.target);
          break;
        case "selfDamage":
          if (src) this.damage(src.uid);
          break;
        case "restore":
        case "garden": {
          const cards = own.filter(
            (c) =>
              c.hp === 1 &&
              c.id !== "bonfire" &&
              c.uid !== t.src &&
              (t.e !== "garden" || C[c.id].type !== "camp"),
          );
          target(
            "选择要修复的己方卡牌",
            cards,
            t.e === "garden" ? "healReady" : "heal",
            true,
          );
          break;
        }
        case "heal":
        case "healReady": {
          const f = this.find(t.target);
          if (f && f.c.hp === 1) {
            f.c.hp = 2;
            if (!f.camp) f.c.tired = t.e !== "healReady";
            this.note(`${this.title(f.c)}恢复完好`);
          }
          break;
        }
        case "gasRaid":
        case "raid": {
          let i = x.events.findIndex((c) => c?.id === "raiders");
          if (i >= 0) this.push(eff("advance", { owner: p, slot: i }));
          else {
            const c = this.unit("raiders"),
              slot =
                t.e === "gasRaid" &&
                !(this.has(p, "zeto") && x.eventCount === 0)
                  ? x.events[2]
                    ? -2
                    : 2
                  : this.eventSlot(p, c);
            if (slot !== -2) {
              x.eventCount++;
              if (slot === -1) this.push(eff("resolve", { card: c }));
              else x.events[slot] = c;
            }
          }
          break;
        }
        case "advance": {
          const owner = this.p(t.owner),
            i = t.slot;
          if (!owner.events[i] || (i > 0 && owner.events[i - 1])) break;
          const c = owner.events[i];
          owner.events[i] = null;
          if (i === 0)
            this.push(this.effect("resolve", t.owner, c.uid, { card: c }));
          else owner.events[i - 1] = c;
          break;
        }
        case "resolve":
          this.s.resolving.push(t.card);
          x.resolved++;
          if (t.card.id === "raiders") x.raided = true;
          this.note(`${C[t.card.id].name}结算`);
          this.push(
            this.effect(C[t.card.id].effect, p, t.card.uid),
            eff("resolvedCard", { card: t.card }),
          );
          break;
        case "resolvedCard":
          this.s.resolving = this.s.resolving.filter(
            (c) => c.uid !== t.card.uid,
          );
          if (t.card.id !== "raiders") this.s.discard.push(this.clean(t.card));
          else {
            if (this.campHas(p, "bandit")) x.water++;
            if (this.campHas(p, "derby")) this.push(eff("delayAll"));
          }
          break;
        case "raiders":
          this.target(
            { ...t, p: enemy },
            `玩家 ${enemy + 1}：选择承受突袭的营地`,
            opp.camps.filter((c) => c.hp),
            "hit",
          );
          break;
        case "place": {
          const c = t.card,
            full = this.full(p);
          let options = [];
          for (let col = 0; col < 3; col++) {
            if (x.cols[col].length >= this.capacity(p, col)) continue;
            const cost = t.fromHand ? this.playPrice(p, c, col) : 0;
            if (x.water < cost + (t.reserve || 0)) continue;
            const len = x.cols[col].length;
            for (let at = 0; at <= len; at++) {
              options.push({
                label: `第 ${col + 1} 列 · ${at === 0 ? "最前排" : "后排"}${t.fromHand ? ` · ${cost} 水` : ""}`,
                tasks: [{ ...t, e: "deploy", col, at, cost }],
              });
              if (this.behindCount(p, col) && at === this.campFront(p, col))
                options.push({
                  label: `第 ${col + 1} 列 · 营地后方${t.fromHand ? ` · ${cost} 水` : ""}`,
                  tasks: [
                    { ...t, e: "deploy", col, at, cost, behindCamp: true },
                  ],
                });
            }
          }
          if (full) {
            const affordable =
              !t.fromHand ||
              x.cols.some(
                (_, col) =>
                  x.water >= this.playPrice(p, c, col) + (t.reserve || 0),
              );
            if (affordable)
              options = this.people(p).map((v) => ({
                label: `牺牲${this.title(v)}腾出空位`,
                uid: v.uid,
                tasks: [eff("kill", { target: v.uid }), { ...t, forced: true }],
              }));
          }
          this.ask(
            t.fromHand ? "选择部署位置" : "选择朋克部署位置",
            p,
            options,
            !t.forced,
          );
          break;
        }
        case "deploy": {
          const c = t.card;
          if (t.fromHand) {
            if (!x.hand.some((v) => v.uid === c.uid)) break;
            x.hand = x.hand.filter((v) => v.uid !== c.uid);
            x.water -= t.cost;
          } else if (t.punkDraw) {
            const actual = this.take();
            if (!actual) break;
            t.card = { ...this.clean(actual), punk: true };
          }
          const v = t.card;
          v.tired = !(
            this.has(p, "karli") ||
            (!v.punk && (v.id === "karli" || C[v.id].ready))
          );
          v.used = 0;
          this.insertAt(p, t.col, t.at, v, t.behindCamp);
          this.entered(v, p);
          if (t.punkDraw) this.emptyDeck();
          this.note(`玩家 ${p + 1} 部署${this.title(v)}`);
          if (!v.punk && C[v.id].enter)
            this.push(this.effect(C[v.id].enter, p, v.uid));
          break;
        }
        case "punk":
          this.push(
            eff("place", {
              card: { id: "looter", punk: true },
              punkDraw: true,
            }),
          );
          break;
        case "uprising":
          this.push(eff("punk"), eff("punk"), eff("punk"));
          break;
        case "wounded":
          this.draw(p);
          this.push(eff("selfDamage"));
          break;
        case "delay":
          this.ask("是否将对手事件后移一格？", p, [
            { label: "后移事件", tasks: [eff("delayAll")] },
            { label: "保持不动", tasks: [] },
          ]);
          break;
        case "delayAll":
          for (let i = 1; i >= 0; i--)
            if (opp.events[i] && !opp.events[i + 1]) {
              opp.events[i + 1] = opp.events[i];
              opp.events[i] = null;
            }
          break;
        case "strafe":
          for (const c of unprotected.filter((c) => C[c.id].type !== "camp"))
            this.damage(c.uid);
          break;
        case "exterminate":
          for (const c of this.people(enemy).filter((c) => c.hp === 1))
            this.destroy(c.uid);
          break;
        case "radiation":
          for (const c of [...this.people(p), ...this.people(enemy)])
            this.damage(c.uid);
          break;
        case "bombardment":
          for (const c of opp.camps.filter((c) => c.hp)) this.damage(c.uid);
          if (this.s.winner === null)
            this.draw(p, opp.camps.filter((c) => !c.hp && !c.removed).length);
          break;
        case "columnDamage":
        case "napalm":
          this.ask(
            "选择敌方一列",
            p,
            [0, 1, 2].map((col) => ({
              label: `第 ${col + 1} 列`,
              tasks: [
                eff(t.e === "napalm" ? "burnColumn" : "hitColumn", { col }),
              ],
            })),
          );
          break;
        case "burnColumn":
          for (const c of [...opp.cols[t.col]]) this.destroy(c.uid);
          break;
        case "hitColumn": {
          const cards = [...opp.cols[t.col], opp.camps[t.col]];
          for (const c of cards) this.damage(c.uid);
          break;
        }
        case "cult":
        case "mulcher":
        case "bloodbank":
        case "labor":
        case "octagon": {
          const next = {
            cult: "damage",
            mulcher: "draw",
            bloodbank: "water",
            labor: "restore",
            octagon: "enemySacrifice",
          }[t.e];
          this.ask(
            "选择牺牲一名己方人员",
            p,
            this.people(p).map((c) => ({
              label: this.title(c),
              uid: c.uid,
              tasks: [eff("kill", { target: c.uid }), eff(next)],
            })),
          );
          break;
        }
        case "enemySacrifice":
          this.target(
            { ...t, p: enemy },
            "对手：牺牲一名人员",
            this.people(enemy),
            "kill",
          );
          break;
        case "catapult":
          this.push(eff("anyDamage"), eff("sacrifice"));
          break;
        case "sacrifice":
          target("选择牺牲一名己方人员", this.people(p), "kill");
          break;
        case "mutant":
          this.push(eff("optionalDamage"), eff("restore"), eff("selfDamage"));
          break;
        case "optionalDamage":
          target("可选择造成伤害", unprotected, "hit", true);
          break;
        case "vanguard":
          this.push(eff("damage"), this.effect("damage", enemy));
          break;
        case "cannon":
          this.push(eff("selfDamage"), eff("damage"));
          break;
        case "scud":
          this.target(
            { ...t, p: enemy },
            "对手：选择承受伤害的卡牌",
            foes,
            "hit",
          );
          break;
        case "spies":
        case "watch":
        case "doomDamage":
        case "punkDamage":
          this.push(eff("damage"));
          break;
        case "transplant":
        case "raidRestore":
          this.push(eff("restore"));
          break;
        case "arcade":
          this.push(eff("punk"));
          break;
        case "reactor":
          if (src) this.destroy(src.uid);
          if (this.s.winner === null)
            for (const c of [...this.people(p), ...this.people(enemy)])
              this.destroy(c.uid);
          break;
        case "bonfire":
          this.push(eff("selfDamage"), eff("healAll"));
          break;
        case "healAll":
          this.ask(
            "选择要修复的卡牌，可连续选择",
            p,
            own
              .filter(
                (c) => c.hp === 1 && c.id !== "bonfire" && c.uid !== t.src,
              )
              .map((c) => ({
                label: this.title(c),
                uid: c.uid,
                tasks: [eff("heal", { target: c.uid }), eff("healAll")],
              })),
            true,
          );
          break;
        case "cache":
          this.push(eff("selfDamage"), eff("cacheChoice"));
          break;
        case "cacheChoice":
          this.ask(
            "选择效果",
            p,
            ["draw", "restore", "punk"].map((e) => ({
              label: { draw: "抽牌", restore: "修复", punk: "朋克" }[e],
              tasks: [eff(e)],
            })),
          );
          break;
        case "construction":
          target(
            "选择重建的已毁营地",
            x.camps.filter((c) => !c.hp),
            "rebuild",
          );
          break;
        case "rebuild": {
          const f = this.find(t.target);
          if (f) {
            f.c.hp = 2;
            f.c.used = 0;
            f.c.tired = false;
            f.c.front = undefined;
            this.destroy(t.src);
          }
          break;
        }
        case "rescue":
          target("选择收回手牌的己方人员", this.people(p), "return");
          break;
        case "return": {
          const f = this.find(t.target);
          if (f && !f.camp) {
            const b = this.p(f.p).camps[f.col];
            if (b.front !== undefined && f.n < b.front) b.front--;
            this.p(f.p).cols[f.col].splice(f.n, 1);
            this.p(f.p).hand.push(this.clean(f.c));
          }
          break;
        }
        case "truce":
          for (let i = 0; i < 2; i++)
            for (const c of [...this.people(i)])
              this.push(this.effect("return", i, null, { target: c.uid }));
          break;
        case "science": {
          const cards = [];
          for (let i = 0; i < 3 && this.s.winner === null; i++) {
            const c = this.take();
            if (c) {
              cards.push(c);
              this.s.discard.push(c);
              this.emptyDeck();
            }
          }
          this.ask(
            "选择一个弃牌效果",
            p,
            cards.map((c) => ({
              label: `${C[c.id].name} · ${root.RadCards?.labels[C[c.id].junk] || C[c.id].junk}`,
              card: c,
              tasks: [eff(C[c.id].junk)],
            })),
            true,
          );
          break;
        }
        case "interrogate":
        case "depot": {
          const ids = this.draw(p, t.e === "depot" ? 2 : 4);
          this.ask(
            "选择保留的牌，其余弃掉",
            p,
            ids.map((uid) => ({
              label: C[x.hand.find((c) => c.uid === uid).id].name,
              card: x.hand.find((c) => c.uid === uid),
              tasks: [eff("discardIds", { ids: ids.filter((i) => i !== uid) })],
            })),
          );
          break;
        }
        case "discardIds":
          for (const uid of t.ids) {
            const i = x.hand.findIndex((c) => c.uid === uid);
            if (i >= 0) this.s.discard.push(x.hand.splice(i, 1)[0]);
          }
          break;
        case "zeto":
          this.draw(p, 3);
          this.push(eff("discardN", { n: 3 }));
          break;
        case "discardN":
          if (t.n > 0)
            this.ask(
              `选择弃牌（还需 ${t.n} 张）`,
              p,
              x.hand
                .filter((c) => c.id !== "silo")
                .map((c) => ({
                  label: C[c.id].name,
                  card: c,
                  tasks: [
                    eff("discardIds", { ids: [c.uid] }),
                    eff("discardN", { n: t.n - 1 }),
                  ],
                })),
            );
          break;
        case "warehouse":
          this.push(eff("selfDamage"), eff("warehousePick", { count: 0 }));
          break;
        case "warehousePick": {
          let options = x.hand
            .filter((c) => c.id !== "silo")
            .map((c) => ({
              label: `弃掉 ${C[c.id].name}`,
              card: c,
              tasks: [
                eff("discardIds", { ids: [c.uid] }),
                eff("warehousePick", { count: t.count + 1 }),
              ],
            }));
          if (t.count)
            options.unshift({
              label: `完成：抽 ${t.count + 1} 张`,
              tasks: [eff("drawN", { n: t.count + 1 })],
            });
          this.ask("选择要交换的手牌", p, options);
          break;
        }
        case "drawN":
          this.draw(p, t.n);
          break;
        case "famine":
          this.push(eff("keepOne"), this.effect("keepOne", enemy));
          break;
        case "keepOne":
          if (this.people(p).length > 1)
            target("选择唯一保留的人员", this.people(p), "keep");
          break;
        case "keep":
          for (const c of [...this.people(p)])
            if (c.uid !== t.target) this.destroy(c.uid);
          break;
        case "mercenary": {
          const options = [
            {
              label: "选择一张自己的卡牌被消灭",
              tasks: [this.effect("mercKill", enemy)],
            },
          ];
          if (opp.hand.filter((c) => c.id !== "silo").length >= 2)
            options.push({
              label: "弃掉 2 张手牌",
              tasks: [this.effect("discardN", enemy, null, { n: 2 })],
            });
          this.ask("对手：选择佣兵营的代价", enemy, options);
          break;
        }
        case "mercKill":
          target("选择被消灭的己方卡牌", own, "kill");
          break;
        case "omen": {
          const opts = [];
          for (let owner = 0; owner < 2; owner++)
            this.p(owner).events.forEach((c, slot) => {
              if (c && (slot === 0 || !this.p(owner).events[slot - 1]))
                opts.push({
                  label: `玩家 ${owner + 1} · ${C[c.id].name} · ${slot + 1}`,
                  tasks: [eff("advance", { owner, slot })],
                });
            });
          this.ask("选择推进的事件", p, opts);
          break;
        }
        case "training":
          target(
            "选择翻面的朋克",
            this.people(p).filter((c) => c.punk),
            "train",
          );
          break;
        case "train": {
          const f = this.find(t.target);
          if (!f) break;
          delete f.c.punk;
          if (C[f.c.id].type === "person") {
            f.c.hp = 2;
            f.c.used = 0;
            f.c.tired = !(this.has(p, "karli") || C[f.c.id].ready);
            this.entered(f.c, p);
            if (C[f.c.id].enter)
              this.push(this.effect(C[f.c.id].enter, p, f.c.uid));
          } else {
            this.destroy(f.c.uid);
            this.push(eff("punk"), eff("water"));
          }
          break;
        }
        case "juggernaut":
          if (src) {
            src.moves = (src.moves || 0) + 1;
            const f = this.find(src.uid);
            if (src.moves >= 3) {
              src.moves = 0;
              src.front = undefined;
              this.target(
                { ...t, p: enemy },
                "对手：选择被战车摧毁的营地",
                opp.camps.filter((c) => c.hp),
                "kill",
              );
            } else
              src.front = Math.max(0, (src.front ?? x.cols[f.col].length) - 1);
          }
          break;
        case "highground":
          x.high = true;
          this.push(eff("rearrange"));
          break;
        case "rearrange": {
          const opts = this.people(p).map((c) => ({
            label: `移动 ${this.title(c)}`,
            uid: c.uid,
            tasks: [eff("moveChoice", { target: c.uid })],
          }));
          opts.unshift({ label: "完成重排", tasks: [] });
          this.ask("重排人员：可移动多次", p, opts);
          break;
        }
        case "moveChoice": {
          const f = this.find(t.target);
          if (!f) break;
          const opts = [];
          for (let col = 0; col < 3; col++) {
            const len = x.cols[col].length - (col === f.col ? 1 : 0);
            if (len >= this.capacity(p, col)) continue;
            for (let at = 0; at <= len; at++) {
              opts.push({
                label: `第 ${col + 1} 列 · 位置 ${at + 1}`,
                tasks: [
                  eff("move", { target: t.target, col, at }),
                  eff("rearrange"),
                ],
              });
              if (this.behindCount(p, col))
                opts.push({
                  label: `第 ${col + 1} 列 · 位置 ${at + 1} · 优先营地后方`,
                  tasks: [
                    eff("move", {
                      target: t.target,
                      col,
                      at,
                      behindCamp: true,
                    }),
                    eff("rearrange"),
                  ],
                });
            }
          }
          for (const other of this.people(p).filter((c) => c.uid !== t.target))
            opts.push({
              label: `与${this.title(other)}交换位置（第 ${this.find(other.uid).col + 1} 列）`,
              tasks: [
                eff("swap", { target: t.target, other: other.uid }),
                eff("rearrange"),
              ],
            });
          this.ask("选择新位置", p, opts);
          break;
        }
        case "swap": {
          const a = this.find(t.target),
            b = this.find(t.other);
          if (a && b) {
            x.cols[a.col][a.n] = b.c;
            x.cols[b.col][b.n] = a.c;
          }
          break;
        }
        case "move": {
          const f = this.find(t.target);
          if (!f) break;
          this.detach(t.target);
          this.insertAt(p, t.col, t.at, f.c, t.behindCamp);
          break;
        }
        case "mimic":
        case "adrenaline": {
          const mim = t.e === "mimic";
          let candidates = mim
            ? [
                ...this.people(p).filter(
                  (c) => c.uid !== t.src && this.ready(c),
                ),
                ...this.people(enemy).filter((c) => c.hp === 2),
              ]
            : this.people(p).filter((c) => c.hp === 1);
          let opts = [];
          for (const c of candidates) {
            const owner = this.find(c.uid).p;
            this.abilities(owner, c).forEach((a) => {
              if (
                ["mimic", "adrenaline"].includes(a.effect) ||
                (!t.freeCopy && this.p(p).water < a.cost) ||
                !this.conditions(p, mim ? src : c, a)
              )
                return;
              opts.push({
                label: `${this.title(c)} · ${a.cost} 水 · ${a.text}`,
                uid: c.uid,
                tasks: [
                  eff("pay", { n: t.freeCopy ? 0 : a.cost }),
                  this.effect(a.effect, p, mim ? t.src : c.uid, {
                    ghost: t.ghost,
                  }),
                  ...(!mim ? [eff("kill", { target: c.uid })] : []),
                ],
              });
            });
          }
          this.ask(mim ? "选择复制的技能" : "选择受伤人员的技能", p, opts);
          break;
        }
        case "pay":
          x.water -= t.n;
          break;
        case "parachute": {
          const opts = [];
          for (const c of x.hand.filter(
            (c) => C[c.id].type === "person" && this.canDeploy(p, c),
          )) {
            const abilities = this.abilities(p, c);
            if (!abilities.length) continue;
            const reserve = Math.min(...abilities.map((a) => a.cost));
            if (
              !x.cols.some(
                (cs, col) =>
                  (cs.length < this.capacity(p, col) || this.full(p)) &&
                  x.water >= this.playPrice(p, c, col) + reserve,
              )
            )
              continue;
            opts.push({
              label: C[c.id].name,
              card: c,
              tasks: [
                eff("place", {
                  card: c,
                  fromHand: true,
                  reserve,
                  forced: true,
                }),
                eff("parachutePick", { target: c.uid }),
              ],
            });
          }
          this.ask("选择空降人员；入场效果结算后选择其技能", p, opts);
          break;
        }
        case "parachutePick": {
          const f = this.find(t.target);
          if (!f || f.camp) break;
          const opts = this.abilities(p, f.c)
            .filter((a) => a.cost <= x.water && this.conditions(p, f.c, a))
            .map((a) => ({
              label: `${a.cost} 水 · ${a.text}`,
              tasks: [eff("parachuteAbility", { target: f.c.uid, ability: a })],
            }));
          if (opts.length) this.ask("选择空降人员的技能", p, opts);
          else this.push(this.effect("selfDamage", p, f.c.uid));
          break;
        }
        case "parachuteAbility": {
          const f = this.find(t.target);
          if (!f || f.camp) break;
          const a = t.ability;
          if (a && a.cost <= x.water) {
            x.water -= a.cost;
            this.useMark(p, f.c);
            this.push(
              this.effect(a.effect, p, f.c.uid),
              this.effect("selfDamage", p, f.c.uid),
            );
          }
          break;
        }
        default:
          if (!this.chromeStep(t)) throw new Error("Unknown effect " + t.e);
      }
    }
  }
  const chrome =
    typeof module !== "undefined" ? require("./chrome.js") : root.RadChrome;
  chrome.install(Game, C);
  if (typeof module !== "undefined") module.exports = { Game };
  root.RadGame = { Game };
})(globalThis);
