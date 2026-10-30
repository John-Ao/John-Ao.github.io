"use strict";
const assert = require("node:assert/strict");
const { Game, D, distance, modifierDeck } = require("./engine.js");
let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS " + name);
    passed++;
  } catch (e) {
    console.error("FAIL " + name);
    throw e;
  }
}
function fresh() {
  let g = new Game();
  g.start(0, 0);
  return g;
}
function act(g, ids = ["b10", "b08"]) {
  let h = g.hero(0);
  h.hand = h.hand.filter((id) => !ids.includes(id));
  h.chosen = ids;
  h.used = [];
  h.cardUse = {};
  h.init = D.cards[ids[0]].init;
  g.s.order = [{ id: h.id, init: h.init }];
  g.s.turn = 0;
  g.s.current = h.id;
  g.s.phase = "act";
  return h;
}
function resolve(g) {
  let guard = 0;
  while (g.s.pending && guard++ < 20) {
    if (g.s.pending.kind === "damage") g.resolveDamage("take");
    else if (g.s.pending.kind === "push") g.push(null);
    else break;
  }
}
test("official starting hands and health", () => {
  let g = fresh();
  assert.equal(g.hero(0).hand.length, 10);
  assert.equal(g.hero(1).hand.length, 8);
  assert.equal(g.hero(0).hp, 10);
  assert.equal(g.hero(1).hp, 6);
  assert.equal(Object.keys(D.cards).length, 28);
});
test("standard 20-card modifier deck", () => {
  let d = modifierDeck();
  assert.equal(d.draw.length, 20);
  assert.equal(d.draw.filter((x) => x === 0).length, 6);
});
test("locked cards excluded from hand; reveal after both", () => {
  let g = fresh();
  g.select(0, "b10");
  g.select(0, "b08");
  g.lock(0);
  assert.equal(g.s.phase, "plan");
  assert.equal(g.hero(0).hand.length, 8);
  g.select(1, "s01");
  g.select(1, "s02");
  g.lock(1);
  assert.equal(g.s.phase, "reveal");
  assert(g.s.order.length >= 4);
});
test("separate card and half restrictions; immediate discard", () => {
  let g = fresh(),
    h = act(g);
  g.beginAction("b08", 1, true);
  g.moveStep([0, 2]);
  g.skipOp();
  assert(h.discard.includes("b08"));
  assert(!g.available("b08", 0));
  assert(!g.available("b10", 1));
  assert(g.available("b10", 0));
});
test("normal movement blocked by enemies", () => {
  let g = fresh(),
    h = act(g);
  g.s.monsters[0].pos = [1, 1];
  g.beginAction("b08", 1);
  assert.equal(g.moveStep([1, 1]), false);
});
test("traps trigger along path and can be resisted", () => {
  let g = fresh(),
    h = act(g);
  let c = g.cell([0, 2]);
  c.terrain = "trap";
  c.damage = 3;
  g.beginAction("b08", 1);
  g.moveStep([0, 2]);
  assert.equal(g.s.pending.n, 3);
  let id = h.hand[0];
  g.resolveDamage("hand", [id]);
  assert.equal(h.hp, 10);
  assert(h.lost.includes(id));
  assert.equal(c.terrain, "floor");
});
test("jump bypasses intermediate trap", () => {
  let g = fresh(),
    h = act(g, ["b09", "b10"]);
  g.cell([0, 2]).terrain = "trap";
  g.beginAction("b09", 1);
  g.moveStep([0, 2]);
  assert.equal(g.s.pending, null);
  g.moveStep([1, 2]);
  g.skipOp();
  assert.equal(g.cell([0, 2]).terrain, "trap");
});
test("doors reveal new monsters and insert initiative", () => {
  let g = fresh(),
    h = act(g);
  h.pos = [3, 2];
  g.beginAction("b08", 1);
  g.moveStep([4, 2]);
  assert(g.s.rooms.includes(1));
  assert.equal(g.s.order.filter((x) => x.id[0] === "m").length, 2);
});
test("poison prevents healing and clears wound", () => {
  let g = fresh(),
    h = g.hero(0);
  h.hp = 4;
  g.condition(h, "poison");
  g.condition(h, "wound");
  g.heal(h, 3);
  assert.equal(h.hp, 4);
  assert(!h.conditions.poison && !h.conditions.wound);
});
test("status expires at end of next turn", () => {
  let g = fresh(),
    h = act(g);
  h.turns = 1;
  g.condition(h, "strengthen");
  g.endTurn();
  assert(h.conditions.strengthen);
  h.turns = 2;
  g.s.current = h.id;
  g.s.order = [{ id: h.id }];
  g.s.turn = 0;
  g.endTurn();
  assert(!h.conditions.strengthen);
});
test("shield and pierce modify attack", () => {
  let g = fresh(),
    h = act(g),
    m = g.s.monsters[0];
  h.pos = [0, 1];
  m.pos = [1, 1];
  m.shield = 2;
  h.deck.draw = [0];
  let hp = m.hp;
  g.s.jobs = [
    {
      type: "attack",
      actor: h.id,
      target: m.id,
      ability: { n: 3, range: 1, pierce: 1 },
    },
  ];
  g.pump();
  assert.equal(m.hp, hp - 2);
});
test("ranged adjacent disadvantage draws twice", () => {
  let g = fresh(),
    h = act(g),
    m = g.s.monsters[0];
  m.pos = [1, 1];
  h.deck.draw = [2, -1];
  let hp = m.hp;
  g.s.jobs = [
    { type: "attack", actor: h.id, target: m.id, ability: { n: 3, range: 3 } },
  ];
  g.pump();
  assert.equal(m.hp, hp - 2);
  assert.equal(h.deck.discard.length, 2);
});
test("advantage cancels disadvantage", () => {
  let g = fresh(),
    h = act(g),
    m = g.s.monsters[0];
  m.pos = [1, 1];
  g.condition(h, "strengthen");
  h.deck.draw = [2, 0];
  g.s.jobs = [
    { type: "attack", actor: h.id, target: m.id, ability: { n: 2, range: 3 } },
  ];
  g.pump();
  assert.equal(h.deck.discard.length, 1);
});
test("retaliation survives blocked damage and does not trigger on kill", () => {
  let g = fresh(),
    h = act(g),
    m = g.s.monsters[0];
  m.pos = [1, 1];
  m.roundRetaliate = 2;
  h.deck.draw = ["null"];
  g.s.jobs = [
    { type: "attack", actor: h.id, target: m.id, ability: { n: 3, range: 1 } },
  ];
  g.pump();
  assert.equal(g.s.pending.n, 2);
  g.resolveDamage("take");
  assert.equal(h.hp, 8);
  m.hp = 1;
  h.deck.draw = [0];
  g.s.jobs = [
    { type: "attack", actor: h.id, target: m.id, ability: { n: 3, range: 1 } },
  ];
  g.pump();
  assert.equal(g.s.pending, null);
  assert.equal(h.hp, 8);
});
test("damage can be prevented with two discard cards", () => {
  let g = fresh(),
    h = g.hero(0);
  h.discard = h.hand.splice(0, 2);
  g.takeDamage(h, 99, "test");
  g.resolveDamage("discard", h.discard.slice());
  assert.equal(h.hp, 10);
  assert.equal(h.lost.length, 2);
});
test("one exhausted hero does not end cooperative scenario", () => {
  let g = fresh();
  g.hero(0).hp = 0;
  g.exhaust(g.hero(0));
  assert.notEqual(g.s.phase, "over");
  g.hero(1).hp = 0;
  g.exhaust(g.hero(1));
  g.pump();
  assert.equal(g.s.phase, "over");
  assert.equal(g.s.win, false);
});
test("long rest chooses lost card, heals and refreshes spent items", () => {
  let g = fresh(),
    h = act(g);
  h.discard = ["b01", "b02", "b03"];
  h.hp = 4;
  h.items = [
    { id: "boots", state: "spent" },
    { id: "heal", state: "consumed" },
  ];
  g.s.phase = "longrest";
  g.longRest("b01");
  assert(h.lost.includes("b01"));
  assert.equal(h.hp, 6);
  assert.equal(h.items[0].state, "ready");
  assert.equal(h.items[1].state, "consumed");
});
test("short rest allows one reroll, different loss", () => {
  let g = fresh(),
    h = g.hero(0);
  h.discard = h.hand.splice(0, 3);
  g.s.phase = "cleanup";
  g.shortRest(0);
  let first = g.s.pending.card;
  g.acceptShort(true);
  g.resolveDamage("take");
  assert.notEqual(g.s.pending.card, first);
  assert.equal(h.hp, 9);
  g.acceptShort();
  assert.equal(h.discard.length, 0);
  assert.equal(h.lost.length, 1);
});
test("elements appear at turn end and wane at round end", () => {
  let g = fresh(),
    h = act(g, ["b09", "b08"]);
  g.beginAction("b09", 1);
  g.moveStep([0, 2]);
  g.skipOp();
  assert.equal(g.s.elements.air, 0);
  g.s.order.push({ id: "h1", init: 90 });
  g.finishHero();
  assert.equal(g.s.elements.air, 2);
  g.endRound();
  assert.equal(g.s.elements.air, 1);
});
test("no same-turn consumption of newly generated element", () => {
  let g = fresh();
  let h = g.hero(1);
  g.s.current = h.id;
  g.s.phase = "act";
  h.chosen = ["s01", "s07"];
  h.used = [];
  h.cardUse = {};
  h.infusions = ["fire"];
  assert.equal(g.s.elements.fire, 0);
  g.beginAction("s07", 0);
  g.consume("fire");
  assert(g.s.mode.askElement);
});
test("persistent frost armor consumes charges then loses card", () => {
  let g = fresh(),
    h = g.hero(1);
  g.s.current = h.id;
  g.s.phase = "act";
  h.chosen = ["s06", "s08"];
  h.used = [];
  h.cardUse = {};
  g.beginAction("s06", 1);
  assert.equal(h.active.length, 1);
  g.takeDamage(h, 10, "test");
  assert.equal(h.hp, 6);
  g.takeDamage(h, 10, "test");
  assert.equal(h.active.length, 0);
  assert(h.lost.includes("s06"));
  assert.equal(h.xp, 2);
});
test("reviving ether excludes itself", () => {
  let g = fresh(),
    h = g.hero(1);
  g.s.current = h.id;
  g.s.phase = "act";
  h.chosen = ["s03", "s08"];
  h.used = [];
  h.cardUse = {};
  h.lost = ["s01", "s02"];
  g.beginAction("s03", 0);
  assert(h.hand.includes("s01"));
  assert(h.lost.includes("s03"));
  assert(h.permanent.includes("s03"));
});
test("invisible heroes cannot be focused", () => {
  let g = fresh(),
    m = g.s.monsters[0];
  g.condition(g.hero(0), "invisible");
  let p = g.aiPlan(m, { range: 1, move: 2 });
  assert.equal(p.target, "h1");
});
test("monster AI completes actions before changing turns", () => {
  let g = fresh(),
    m = g.s.monsters[0];
  m.pos = [1, 1];
  g.s.order = [
    { id: m.id, init: 50 },
    { id: "h0", init: 70 },
  ];
  g.s.turn = 0;
  g.s.current = m.id;
  g.s.phase = "monster";
  g.s.monsterDecks.guard = { card: 3, draw: [1], discard: [3] };
  g.s.monsterModifier.draw = [0];
  g.monsterAct();
  assert.equal(g.s.current, m.id);
  assert(g.s.pending);
  g.resolveDamage("take");
  assert.equal(g.s.phase, "between");
  assert.equal(g.s.turn, 1);
});
test("monster no-attack card never performs base attack", () => {
  let g = fresh(),
    m = g.s.monsters[0];
  m.pos = [1, 1];
  g.s.order = [
    { id: m.id, init: 15 },
    { id: "h0", init: 70 },
  ];
  g.s.current = m.id;
  g.s.phase = "monster";
  g.s.monsterDecks.guard = { card: 0, draw: [1], discard: [0] };
  g.monsterAct();
  assert.equal(g.s.pending, null);
  assert.equal(g.hero(0).hp, 10);
  assert.equal(m.roundShield, 1);
});
test("summons do not act on summon round", () => {
  let g = fresh(),
    h = g.hero(1);
  g.s.current = h.id;
  g.s.phase = "act";
  h.chosen = ["s11", "s08"];
  h.used = [];
  h.cardUse = {};
  g.beginAction("s11", 1);
  g.summon([1, 3]);
  assert.equal(g.s.summons.length, 1);
  assert.equal(g.s.summons[0].born, 1);
});
test("scenario win only after round cleanup; reward once", () => {
  let g = fresh();
  for (let m of g.s.monsters) m.dead = true;
  g.checkGoal();
  assert(g.s.goalReached);
  assert.notEqual(g.s.phase, "over");
  g.endRound();
  assert.equal(g.s.phase, "over");
  assert.equal(g.s.win, true);
  let xp = g.s.campaign.roster[0].xp;
  g.complete(true);
  assert.equal(g.s.campaign.roster[0].xp, xp);
});
test("equipment slots, purchases and leveling", () => {
  let g = new Game();
  assert(g.buy(0, "heal"));
  assert(!g.buy(0, "stamina"));
  assert.equal(g.s.campaign.roster[0].gold, 20);
  g.s.campaign.roster[0].xp = 45;
  g.upgrade(0, "b14");
  assert.equal(g.s.campaign.roster[0].level, 2);
  assert.equal(g.s.campaign.roster[0].unlock, "b14");
});
test("JSON roundtrip retains damage prompt and gameplay", () => {
  let g = fresh();
  g.takeDamage(g.hero(0), 2, "test");
  let copy = new Game(JSON.parse(JSON.stringify(g.s)));
  copy.resolveDamage("take");
  assert.equal(copy.hero(0).hp, 8);
});
test("round shield card remains active until cleanup", () => {
  let g = fresh(),
    h = act(g, ["b06", "b08"]);
  g.beginAction("b06", 1);
  assert.equal(h.roundShield, 1);
  assert(h.active.some((a) => a.card === "b06"));
  assert(!h.discard.includes("b06"));
  g.s.order.push({ id: "h1", init: 99 });
  g.finishHero();
  g.endRound();
  assert.equal(h.roundShield, 0);
  assert(h.discard.includes("b06"));
  assert.equal(h.active.length, 0);
});
test("removing round active card removes its bonus", () => {
  let g = fresh(),
    h = act(g, ["b06", "b08"]);
  g.beginAction("b06", 1);
  g.removeActive(h, "b06");
  assert.equal(h.roundShield, 0);
  assert(h.discard.includes("b06"));
  assert(!h.lost.includes("b06"));
});
test("jump final difficult terrain consumes additional point", () => {
  let g = fresh(),
    h = act(g, ["b09", "b08"]);
  g.cell([0, 2]).terrain = "difficult";
  g.beginAction("b09", 1);
  g.moveStep([0, 2]);
  assert.equal(g.s.mode.remaining, 2);
  g.skipOp();
  assert.equal(g.s.mode, null);
  assert.equal(h.pos.join(","), "0,2");
});
test("short-rest reroll damage can be prevented", () => {
  let g = fresh(),
    h = g.hero(0);
  h.discard = h.hand.splice(0, 3);
  h.hp = 1;
  g.s.phase = "cleanup";
  g.shortRest(0);
  g.acceptShort(true);
  assert.equal(g.s.pending.kind, "damage");
  g.resolveDamage("hand", [h.hand[0]]);
  assert.equal(h.hp, 1);
  assert.equal(g.s.pending.kind, "shortrest");
  g.acceptShort();
  assert.equal(h.lost.length, 2);
});
test("class-specific numerical perks apply only when selected", () => {
  let g = new Game(),
    r = g.s.campaign.roster[1];
  r.xp = 45;
  g.upgrade(1, "s12");
  assert.equal(r.perks.length, 0);
  g.perk(1, "removeZeros");
  g.start();
  assert.equal(g.hero(1).deck.draw.filter((x) => x === 0).length, 2);
  assert.equal(g.hero(1).deck.draw.length, 16);
});
test("multiple targets draw independent attack modifiers", () => {
  let g = fresh(),
    h = g.hero(1);
  h.pos = [0, 2];
  h.chosen = ["s01", "s08"];
  g.s.current = h.id;
  g.s.phase = "act";
  g.s.monsters[0].pos = [2, 1];
  g.s.monsters[1].pos = [2, 2];
  h.deck.draw = [0, 1];
  g.beginAction("s01", 0);
  g.target("m0");
  g.target("m1");
  g.skipOp();
  assert.equal(h.xp, 2);
  assert.equal(h.deck.discard.length, 2);
  assert(h.lost.includes("s01"));
});
test("spellweaver summon receives next-round autonomous turn", () => {
  let g = fresh(),
    h = g.hero(1);
  g.s.current = h.id;
  g.s.phase = "act";
  h.chosen = ["s11", "s08"];
  g.beginAction("s11", 1);
  g.summon([1, 3]);
  let u = g.s.summons[0];
  g.s.round = 2;
  g.s.order = [{ id: h.id, init: 80 }];
  g.s.turn = 0;
  h.chosen = ["s07", "s08"];
  h.deck.draw = [0, 0];
  g.beginTurn();
  assert.equal(u.turns, 1);
  assert(g.s.log.some((l) => l.includes("神秘盟友 聚焦")));
});
test("closed doors block sight and obstacles do not", () => {
  let g = fresh();
  assert(g.line([0, 1], [2, 1]));
  g.cell([1, 1]).terrain = "rock";
  assert(g.line([0, 1], [2, 1]));
  assert(!g.line([3, 2], [5, 2]));
  g.cell([4, 2]).open = true;
  g.s.rooms.push(1);
  assert(g.line([3, 2], [5, 2]));
});
console.log(`${passed} checks passed`);
