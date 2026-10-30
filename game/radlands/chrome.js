/* Cult of Chrome mechanics. All pending decisions are plain, serializable data. */
(function (root) {
  function install(Game, C) {
    const G = Game.prototype;
    G.chromeConditions = function (p, c, a) {
      const x = this.p(p),
        foe = this.p(1 - p),
        e = a.effect,
        f = this.find(c.uid);
      const open = foe.camps.some(
        (b) => b.hp && this.exposed(this.find(b.uid)),
      );
      const hand = x.hand.filter((c) => c.id !== "silo").length;
      const needs = { deathray: 5, incinerator: 2, recycling: 3, scavenge: 1 };
      if (needs[e] && hand < needs[e]) return false;
      switch (e) {
        case "soleDamage":
          return !x.abilityCount;
        case "healthyDamage":
          return c.hp === 2;
        case "twoColumn":
          return !!f && x.cols[f.col].length >= 2;
        case "fourCamp":
          return this.people(p).length >= 4;
        case "sixCamp":
          return this.people(p).length >= 6;
        case "openPunk":
        case "openRestore":
          return open;
        case "bounty":
          return !this.people(1 - p).some((c) => c.punk);
        case "blackmarket":
          return this.people(p).some(
            (c) => !c.punk && c.enteredTurn === this.s.turn,
          );
        case "cannibal":
          return this.cards(p).some((c) => c.hp === 2);
        case "memorial":
          return !!x.hurt;
        case "motorcycle":
          return this.people(p).some((c) => c.punk);
        case "saloon":
          return this.people(p).length > 0 && this.people(1 - p).length > 0;
        case "mining":
          return [...x.camps, ...foe.camps].some((c) => !c.hp && !c.removed);
        case "steal":
          return !this.full(p) && this.people(1 - p).some((c) => c.hp === 1);
        case "hospital":
          return (
            !!f &&
            this.people(p).some(
              (c) =>
                c.hp === 1 &&
                (this.find(c.uid).col === f.col ||
                  x.cols[f.col].length < this.capacity(p, f.col)),
            )
          );
        case "rescuepost":
          return this.people(p).some((c) => c.enteredTurn !== this.s.turn);
        case "guillotine":
          return this.people(1 - p).some((c) => this.exposed(this.find(c.uid)));
        default:
          return true;
      }
    };
    G.canFlip = function (p, c) {
      return (
        this.canAct(p) &&
        c.punk &&
        this.find(c.uid)?.p === p &&
        this.campHas(p, "masquerade") &&
        C[c.id].type === "person" &&
        this.p(p).water >= C[c.id].cost &&
        !this.p(p).banned.includes(c.id)
      );
    };
    G.flip = function (p, uid) {
      const c = this.find(uid)?.c;
      if (!c || !this.canFlip(p, c)) return false;
      this.p(p).water -= C[c.id].cost;
      delete c.punk;
      c.hp = 2;
      c.tired = false;
      c.used = 0;
      this.entered(c, p);
      this.note(`玩家 ${p + 1} 翻开${C[c.id].name}`);
      if (C[c.id].enter) this.push(this.effect(C[c.id].enter, p, c.uid));
      this.run();
      return true;
    };
    G.moveOptions = function (t, owner, onlyCol) {
      const f = this.find(t.target);
      if (!f || f.camp) return [];
      const x = this.p(owner),
        options = [];
      for (let col = 0; col < 3; col++) {
        if (onlyCol !== undefined && col !== onlyCol) continue;
        const len =
          x.cols[col].length - (owner === f.p && col === f.col ? 1 : 0);
        if (len >= this.capacity(owner, col)) continue;
        for (let at = 0; at <= len; at++) {
          options.push({
            label: `玩家 ${owner + 1} · 第 ${col + 1} 列 · 位置 ${at + 1}`,
            tasks: [{ ...t, e: "transfer", owner, col, at }],
          });
          if (this.behindCount(owner, col))
            options.push({
              label: `玩家 ${owner + 1} · 第 ${col + 1} 列 · 位置 ${at + 1} · 优先营地后方`,
              tasks: [
                { ...t, e: "transfer", owner, col, at, behindCamp: true },
              ],
            });
        }
      }
      return options;
    };
    G.chromeStep = function (t) {
      const p = t.p,
        x = this.p(p),
        enemy = 1 - p,
        opp = this.p(enemy),
        f = this.find(t.src),
        src = f?.c;
      const eff = (e, extra = {}) => this.effect(e, p, t.src, extra);
      const target = (title, cards, e, optional = false) =>
        this.target(t, title, cards, e, optional);
      const discardThen = (n, next) =>
        this.push(eff("discardN", { n }), ...next);
      switch (t.e) {
        case "healthyDamage":
        case "soleDamage":
        case "twoColumn":
          this.push(eff("damage"));
          break;
        case "openPunk":
          this.push(eff("punk"));
          break;
        case "openRestore":
        case "memorial":
          this.push(eff("restore"));
          break;
        case "raidPunk":
          this.push(eff("raid"), eff("punk"));
          break;
        case "fourCamp":
        case "bounty":
          target(
            "选择任意敌方营地",
            opp.camps.filter((c) => c.hp),
            "hit",
          );
          if (t.e === "bounty")
            this.s.tasks.unshift(this.effect("punk", enemy));
          // Target choice resolves before the pending punk, since choose() prepends hit.
          break;
        case "sixCamp":
          this.push(eff("destroyCamp"));
          break;
        case "drawTwo":
          this.draw(p, 2);
          break;
        case "boulder":
          this.ask(
            "选择巨石滚落的敌方列",
            p,
            [0, 1, 2].map((col) => ({
              label: `第 ${col + 1} 列`,
              tasks: [
                eff("burnColumn", { col }),
                eff("hit", { target: opp.camps[col].uid }),
                eff("kill", { target: t.src }),
              ],
            })),
          );
          break;
        case "laser":
          if (f) {
            for (const c of [...x.cols[f.col]]) this.destroy(c.uid);
            this.push(eff("damage"));
          }
          break;
        case "deathray":
          discardThen(5, [eff("destroyAny")]);
          break;
        case "destroyAny":
          target("选择要摧毁的任意敌方卡牌", this.cards(enemy), "kill");
          break;
        case "recycling":
          discardThen(3, [eff("drawN", { n: 2 })]);
          break;
        case "scavenge":
          discardThen(1, [eff("scavengeChoice")]);
          break;
        case "scavengeChoice":
        case "motorcycle":
          this.ask("选择效果", p, [
            { label: "获得朋克", tasks: [eff("punk")] },
            {
              label: t.e === "motorcycle" ? "突袭" : "获得 1 水",
              tasks: [eff(t.e === "motorcycle" ? "raid" : "water")],
            },
          ]);
          break;
        case "cannibal":
          this.ask(
            "选择受伤的己方完好卡牌",
            p,
            this.cards(p)
              .filter((c) => c.hp === 2)
              .map((c) => ({
                label: this.title(c),
                uid: c.uid,
                tasks: [eff("hit", { target: c.uid }), eff("restore")],
              })),
          );
          break;
        case "peaceful":
          this.push(eff(src?.hp === 1 ? "damage" : "restore"));
          break;
        case "ridgetop":
          this.s.allExposed = true;
          break;
        case "saloon":
          this.push(eff("damage"), this.effect("injure", enemy));
          break;
        case "powerplant":
          for (const c of this.cards(p))
            if (c.uid !== t.src && (C[c.id].type === "camp" || c.hp === 2))
              c.tired = false;
          break;
        case "blackmarket":
          this.ask(
            "选择本回合入场人员的弃用效果",
            p,
            this.people(p)
              .filter((c) => !c.punk && c.enteredTurn === this.s.turn)
              .map((c) => ({
                label: C[c.id].name,
                uid: c.uid,
                tasks: [eff(C[c.id].junk)],
              })),
          );
          break;
        case "sciencelab": {
          const c = this.take();
          if (!c) break;
          this.s.discard.push(this.clean(c));
          this.emptyDeck();
          this.ask(
            "是否使用翻出的弃用效果？",
            p,
            [{ label: C[c.id].name, card: c, tasks: [eff(C[c.id].junk)] }],
            true,
          );
          break;
        }
        case "mining":
          target(
            "移除任一已毁营地",
            [...x.camps, ...opp.camps].filter((c) => !c.hp && !c.removed),
            "removeCamp",
          );
          break;
        case "removeCamp": {
          const b = this.find(t.target)?.c;
          if (!b || b.hp || b.removed) break;
          b.removed = true;
          this.note(`${C[b.id].name}被移出对局，该列可容纳三人`);
          this.push(eff("damage"));
          break;
        }
        case "relocate":
          target(
            "选择移动的任一人员",
            [...this.people(p), ...this.people(enemy)],
            "relocateSpace",
          );
          break;
        case "steal":
          target(
            "选择夺取的受伤敌方人员",
            this.people(enemy).filter((c) => c.hp === 1),
            "stealSpace",
          );
          break;
        case "hospital":
          if (f)
            target(
              "选择移入医院列的受伤人员",
              this.people(p).filter(
                (c) =>
                  c.hp === 1 &&
                  (this.find(c.uid).col === f.col ||
                    x.cols[f.col].length < this.capacity(p, f.col)),
              ),
              "hospitalSpace",
            );
          break;
        case "relocateSpace":
        case "stealSpace":
        case "hospitalSpace": {
          const picked = this.find(t.target);
          if (!picked) break;
          const owner = t.e === "relocateSpace" ? picked.p : p;
          const opts = this.moveOptions(
            { ...t, heal: t.e === "hospitalSpace" },
            owner,
            t.e === "hospitalSpace" ? f?.col : undefined,
          );
          this.ask("选择移动位置（不重新触发入场）", p, opts);
          break;
        }
        case "transfer": {
          const picked = this.find(t.target);
          if (!picked || picked.camp) break;
          const to = this.p(t.owner),
            len =
              to.cols[t.col].length -
              (picked.p === t.owner && picked.col === t.col ? 1 : 0);
          if (len >= this.capacity(t.owner, t.col)) break;
          this.detach(t.target);
          this.insertAt(t.owner, t.col, t.at, picked.c, t.behindCamp);
          if (t.heal) this.push(eff("heal", { target: picked.c.uid }));
          break;
        }
        case "rescuepost":
          target(
            "选择本回合未入场的己方人员",
            this.people(p).filter((c) => c.enteredTurn !== this.s.turn),
            "rescueBan",
          );
          break;
        case "rescueBan": {
          const picked = this.find(t.target);
          if (!picked) break;
          x.banned.push(picked.c.id);
          this.push(eff("return", { target: t.target }));
          break;
        }
        case "lobotomizer":
          // Restore is optional, but subsequent deck discard still occurs.
          this.ask("选择修复的己方人员", p, [
            ...this.people(p)
              .filter((c) => c.hp === 1 && c.uid !== t.src)
              .map((c) => ({
                label: this.title(c),
                uid: c.uid,
                tasks: [
                  eff("heal", { target: c.uid }),
                  eff("loboDiscard", { target: c.uid }),
                ],
              })),
            { label: "不修复，继续弃牌", tasks: [eff("loboDiscard")] },
          ]);
          break;
        case "loboDiscard": {
          let injure = false;
          for (let i = 0; i < 3 && this.s.winner === null; i++) {
            const c = this.take();
            if (!c) break;
            this.s.discard.push(this.clean(c));
            injure ||= C[c.id].junk === "injure";
            this.emptyDeck();
          }
          if (injure && this.s.winner === null) {
            const picked = this.find(t.target);
            if (picked && !picked.camp) {
              const col = picked.col,
                at = picked.n,
                behindCamp = at >= this.campFront(p, col);
              this.destroy(t.target);
              this.push(
                eff("deploy", {
                  col,
                  at,
                  behindCamp,
                  punkDraw: true,
                  card: { id: "looter", punk: true },
                }),
                eff("water"),
              );
            }
          }
          break;
        }
        case "incinerator":
          this.push(eff("incineratorPick", { cards: [] }));
          break;
        case "incineratorPick":
          if (t.cards.length === 2)
            this.push(
              eff("incineratorJunks", { cards: t.cards }),
              eff("damage"),
            );
          else
            this.ask(
              `选择焚化手牌（${t.cards.length}/2）`,
              p,
              x.hand
                .filter((c) => c.id !== "silo")
                .map((c) => ({
                  label: C[c.id].name,
                  card: c,
                  tasks: [
                    eff("discardIds", { ids: [c.uid] }),
                    eff("incineratorPick", { cards: [...t.cards, c] }),
                  ],
                })),
            );
          break;
        case "incineratorJunks":
          this.ask(
            "选择下一项弃用效果，可跳过剩余效果",
            p,
            t.cards.map((c) => ({
              label: C[c.id].name,
              card: c,
              tasks: [
                eff(C[c.id].junk),
                eff("incineratorJunks", {
                  cards: t.cards.filter((v) => v.uid !== c.uid),
                }),
              ],
            })),
            true,
          );
          break;
        case "guillotine":
          target(
            "选择未受保护的敌方人员",
            this.people(enemy).filter((c) => this.exposed(this.find(c.uid))),
            "execute",
          );
          break;
        case "execute": {
          const picked = this.find(t.target);
          if (!picked || picked.camp) break;
          const c = { ...picked.c },
            abilities = this.abilities(picked.p, picked.c);
          this.destroy(c.uid);
          this.push(
            this.effect("lastAbility", enemy, c.uid, { card: c, abilities }),
          );
          break;
        }
        case "lastAbility":
          this.ask(
            "可免费使用被消灭人员的一项技能",
            p,
            t.abilities
              .filter(
                (a) =>
                  this.chromeConditions(p, t.card, a) &&
                  !(a.effect === "cult" && !this.people(p).length),
              )
              .map((a) => ({
                label: a.text,
                tasks: [
                  eff(a.effect, {
                    ghost: t.card,
                    freeCopy: a.effect === "mimic",
                  }),
                ],
              })),
            true,
          );
          break;
        default:
          return false;
      }
      return true;
    };
  }
  const api = { install };
  if (typeof module !== "undefined") module.exports = api;
  root.RadChrome = api;
})(globalThis);
