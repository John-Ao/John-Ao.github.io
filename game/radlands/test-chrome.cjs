const assert = require("node:assert/strict");
const { C, pools } = require("./cards.js");
const { Game } = require("./engine.js");
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS", name);
}
function base(camp = "railgun") {
  const g = new Game(null, "revised", "starter");
  g.s.active = 0;
  g.s.turn = 3;
  for (let p = 0; p < 2; p++) {
    Object.assign(g.p(p), {
      camps: [camp, "garage", "outpost"].map((id) => g.unit(id)),
      cols: [[], [], []],
      hand: [],
      events: [null, null, null],
      water: 20,
      abilityCount: 0,
      sole: false,
      entered: 0,
      banned: [],
      hurt: false,
    });
  }
  g.p(1).camps[0] = g.unit("railgun");
  return g;
}
function person(g, id = "scout", p = 0, col = 0, extra = {}) {
  const c = Object.assign(g.unit(id), extra);
  g.p(p).cols[col].push(c);
  return c;
}
function pick(g, predicate) {
  assert(g.s.choice, "expected choice");
  const i = g.s.choice.options.findIndex(predicate);
  assert(i >= 0, "missing choice " + g.s.choice.title);
  g.choose(i);
}
function chooseTarget(g, c) {
  pick(g, (o) => o.uid === c.uid);
}
function settle(g) {
  for (let n = 0; g.s.choice && n < 100; n++) {
    const ch = g.s.choice;
    const done = ch.options.findIndex(
      (o) => o.label === "完成重排" || o.label.startsWith("完成："),
    );
    g.choose(done >= 0 ? done : ch.optional ? -1 : 0);
  }
  assert(!g.s.choice);
}
function use(g, index = 0) {
  assert(g.use(0, g.p().camps[0].uid, index));
}

test("34 classic, 34 revised and 66 complete camps; no duplicate replacement", () => {
  assert.equal(pools.classic.length, 34);
  assert.equal(pools.revised.length, 34);
  assert.equal(pools.complete.length, 66);
  assert.equal(new Set(pools.complete).size, 66);
  assert.equal(
    Object.values(C).filter((c) => c.edition === "revised").length,
    10,
  );
  assert.equal(
    Object.values(C).filter((c) => c.edition === "chrome").length,
    32,
  );
  for (const mode of Object.keys(pools)) {
    const g = new Game(null, mode);
    assert.equal(g.s.deck.length, 66);
    for (const p of g.s.players)
      assert(p.offer.every((c) => pools[mode].includes(c.id)));
  }
});
test("Revised Cannon starts damaged; official starter camps are exact", () => {
  const g = new Game(null, "revised");
  g.p(0).offer = ["cannon2", "railgun", "garage"].map((id) => g.unit(id));
  g.draft(g.p(0).offer.map((c) => c.uid));
  assert.equal(g.p(0).camps[0].hp, 1);
  const h = new Game(null, "revised", "starter");
  assert.deepEqual(
    h.p(0).camps.map((c) => c.id),
    ["arcade", "totem", "mercenary2"],
  );
  assert.deepEqual(
    h.p(1).camps.map((c) => c.id),
    ["garage", "railgun", "depot"],
  );
});
test("Revised Cannon, Training and Mercenary enforce prerequisites", () => {
  const g = base("cannon2");
  g.p().camps[0].hp = 1;
  assert(!g.use(0, g.p().camps[0].uid, 0));
  g.p().camps[0].hp = 2;
  use(g);
  settle(g);
  const t = base("training2");
  person(t);
  assert(!t.use(0, t.p().camps[0].uid, 0));
  person(t);
  use(t);
  settle(t);
  const m = base("mercenary2");
  for (let i = 0; i < 3; i++) person(m, "scout", 0, i);
  assert(!m.use(0, m.p().camps[0].uid, 0));
  person(m);
  person(m, "scout", 1, 0);
  use(m);
  chooseTarget(m, m.p(1).camps[0]);
  assert.equal(m.p(1).camps[0].hp, 1);
});
test("Resonator only ability this turn, including Vera; junk still allowed", () => {
  const g = base("resonator2");
  person(g, "vera");
  use(g);
  settle(g);
  assert(g.p().sole);
  assert(!g.use(0, g.p().camps[0].uid, 0));
  assert(!g.use(0, g.p().camps[1].uid, 0));
  const c = g.unit("looter");
  g.p().hand.push(c);
  assert(g.junk(0, c.uid));
  const h = base("resonator2"),
    m = person(h, "muse");
  assert(h.use(0, m.uid, 0));
  assert(!h.use(0, h.p().camps[0].uid, 0));
});
test("Scavenger discards without junk and gives chosen water", () => {
  const g = base("scavenger2"),
    c = g.unit("vanguard");
  g.p().hand.push(c);
  use(g);
  pick(g, (o) => o.card?.uid === c.uid);
  pick(g, (o) => o.label === "获得 1 水");
  assert.equal(g.p().water, 21);
  assert(g.s.discard.some((v) => v.uid === c.uid));
  assert.equal(g.people(0).length, 0);
});
test("Armory grants puncture to punks only while camp survives", () => {
  const g = base("armory"),
    c = person(g, "radiation", 0, 0, { punk: true });
  assert.equal(g.abilities(0, c)[0].cost, 2);
  g.p().camps[0].hp = 1;
  assert.equal(g.abilities(0, c).length, 1);
  g.destroy(g.p().camps[0].uid);
  assert.equal(g.abilities(0, c).length, 0);
});
test("Asylum takes protected injured person without enter triggers", () => {
  const g = base("asylum");
  person(g, "scout", 1);
  const c = person(g, "wounded", 1, 0, { hp: 1 });
  const n = g.s.deck.length;
  use(g);
  chooseTarget(g, c);
  g.choose(0);
  assert.equal(g.find(c.uid).p, 0);
  assert.equal(c.hp, 1);
  assert.equal(g.p().entered, 0);
  assert.equal(g.s.deck.length, n);
});
test("Construction moves protected enemy on same side only", () => {
  const g = base("construction2");
  person(g, "scout", 1);
  const c = person(g, "muse", 1);
  use(g);
  chooseTarget(g, c);
  assert(g.s.choice.options.every((o) => o.tasks[0].owner === 1));
  pick(g, (o) => o.tasks[0].col === 1);
  assert.equal(g.find(c.uid).p, 1);
  assert.equal(g.find(c.uid).col, 1);
  assert.equal(g.p(1).entered, 0);
});
test("Field Hospital restores after movement and never readies person", () => {
  const g = base("hospital"),
    c = person(g, "scout", 0, 1, { hp: 1 });
  use(g);
  chooseTarget(g, c);
  g.choose(0);
  assert.equal(g.find(c.uid).col, 0);
  assert.equal(c.hp, 2);
  assert(c.tired);
  assert.equal(g.p().entered, 0);
});
test("Fortress protects one person behind, then returns to back when destroyed", () => {
  const g = base("fortress"),
    b = g.p().camps[0],
    c = g.unit("scout");
  g.insertAt(0, 0, 0, c, true);
  assert(g.exposed(g.find(b.uid)));
  assert(!g.exposed(g.find(c.uid)));
  const d = g.unit("muse");
  g.insertAt(0, 0, 0, d);
  assert(g.exposed(g.find(d.uid)));
  assert(!g.exposed(g.find(b.uid)));
  assert(!g.exposed(g.find(c.uid)));
  g.destroy(d.uid);
  assert(g.exposed(g.find(b.uid)));
  g.destroy(b.uid);
  assert(g.exposed(g.find(c.uid)));
  assert.equal(g.capacity(0, 0), 2);
});
test("Fortress deployment choices allow front or behind without a third person", () => {
  const g = base("fortress"),
    c = g.unit("scout");
  g.p().hand.push(c);
  assert(g.play(0, c.uid));
  pick(g, (o) => o.tasks[0].col === 0 && o.tasks[0].behindCamp);
  assert(!g.exposed(g.find(c.uid)));
  const d = g.unit("muse");
  g.p().hand.push(d);
  assert(g.play(0, d.uid));
  pick(g, (o) => o.tasks[0].col === 0 && !o.tasks[0].behindCamp);
  assert(g.exposed(g.find(d.uid)));
  assert.equal(g.campFront(0, 0), 1);
});
test("Mining removes enemy camp, allows third person, stops destroyed-camp discounts", () => {
  const g = base("mining"),
    b = g.p(1).camps[0];
  b.hp = 0;
  use(g);
  chooseTarget(g, b);
  settle(g);
  assert(b.removed);
  assert.equal(g.capacity(1, 0), 3);
  assert.equal(g.playPrice(1, g.unit("holdout"), 0), 2);
  g.p(1).camps[1] = g.unit("pillbox");
  assert.equal(g.price(1, g.p(1).camps[1], C.pillbox.abilities[0]), 3);
  g.s.active = 1;
  person(g, "scout", 1);
  person(g, "muse", 1);
  const c = g.unit("scout");
  g.p(1).hand.push(c);
  assert(g.play(1, c.uid));
  pick(g, (o) => o.tasks[0].col === 0);
  assert.equal(g.p(1).cols[0].length, 3);
});
test("Battering Ram accepts more than six people", () => {
  const g = base("battering");
  for (let i = 0; i < 6; i++) person(g, "scout", 0, Math.floor(i / 2));
  person(g, "muse", 0, 1);
  g.p().camps[1].hp = 0;
  g.p().camps[1].removed = true;
  use(g);
  chooseTarget(g, g.p(1).camps[0]);
  assert.equal(g.p(1).camps[0].hp, 0);
});
test("Boulder victory precedes own last-camp destruction", () => {
  const g = base("boulder");
  g.p().camps[1].hp = g.p().camps[2].hp = 0;
  g.p(1).camps[1].hp = g.p(1).camps[2].hp = 0;
  g.p(1).camps[0].hp = 1;
  person(g, "scout", 1);
  use(g);
  g.choose(0);
  assert.equal(g.s.winner, 0);
  assert.equal(g.p().camps[0].hp, 2);
});
test("Bounty forbids enemy punk; damage resolves before opponent punk", () => {
  const g = base("bounty");
  person(g, "scout", 1);
  use(g);
  chooseTarget(g, g.p(1).camps[0]);
  assert.equal(g.p(1).camps[0].hp, 1);
  assert.equal(g.s.choice.p, 1);
  g.choose(0);
  assert(g.people(1).some((c) => c.punk));
  g.p().camps[0].tired = false;
  assert(!g.use(0, g.p().camps[0].uid, 0));
});
test("Cannibal can damage itself but cannot restore itself", () => {
  const g = base("cannibal"),
    c = person(g, "scout", 0, 1, { hp: 1 });
  use(g);
  chooseTarget(g, g.p().camps[0]);
  assert(g.s.choice.options.every((o) => o.uid !== g.p().camps[0].uid));
  chooseTarget(g, c);
  assert.equal(g.p().camps[0].hp, 1);
  assert.equal(c.hp, 2);
});
test("Death Ray requires five non-silo discards and ignores protection", () => {
  const g = base("deathray");
  g.p().hand = Array.from({ length: 4 }, () => g.unit("looter"));
  g.p().hand.push(g.unit("silo"));
  assert(!g.use(0, g.p().camps[0].uid, 0));
  g.p().hand.push(g.unit("scout"));
  person(g, "scout", 1);
  use(g);
  for (let i = 0; i < 5; i++) g.choose(0);
  chooseTarget(g, g.p(1).camps[0]);
  assert.equal(g.p(1).camps[0].hp, 0);
  assert.deepEqual(
    g.p().hand.map((c) => c.id),
    ["silo"],
  );
});
test("Bandit and Derby trigger on Raiders, including event phase bonus water", () => {
  const g = base("bandit");
  g.p().camps[1] = g.unit("derby");
  g.p().events[0] = g.unit("raiders");
  g.p().water = 0;
  const a = g.unit("banish"),
    b = g.unit("famine");
  g.p(1).events = [a, b, null];
  g.begin();
  assert.equal(g.s.choice.p, 1);
  g.choose(0);
  assert.equal(g.p().water, 4);
  assert.equal(g.p(1).events[1].uid, a.uid);
  assert.equal(g.p(1).events[2].uid, b.uid);
});
test("Gas Station starts at 3, respects occupied slot, and Zeto resolves first", () => {
  const g = base("gas");
  use(g);
  assert.equal(g.p().events[2].id, "raiders");
  g.p().camps[0].tired = false;
  use(g);
  assert.equal(g.p().events[1].id, "raiders");
  const h = base("gas");
  person(h, "zeto");
  h.p().eventCount = 0;
  use(h);
  assert.equal(h.s.choice.p, 1);
  h.choose(0);
  assert(h.p().events.every((c) => !c));
});
test("Guillotine kills first; Muse bonus is retained through replenishment", () => {
  const g = base("guillotine"),
    m = person(g, "muse", 1);
  g.p(1).water = 0;
  use(g);
  chooseTarget(g, m);
  assert(!g.find(m.uid));
  assert.equal(g.s.choice.p, 1);
  g.choose(0);
  assert.equal(g.p(1).water, 1);
  g.end(0);
  assert.equal(g.p(1).water, 4);
});
test("Guillotine Rescue cannot retrieve itself; Cult cannot sacrifice itself", () => {
  const g = base("guillotine"),
    c = person(g, "rescue", 1);
  use(g);
  chooseTarget(g, c);
  g.choose(0);
  assert.equal(g.p(1).hand.length, 0);
  assert(!g.find(c.uid));
  const h = base("guillotine"),
    cult = person(h, "cult", 1);
  use(h);
  chooseTarget(h, cult);
  assert.equal(h.s.choice, null);
  assert(!h.find(cult.uid));
});
test("Guillotine Mimic uses surviving abilities with vanished source", () => {
  const g = base("guillotine"),
    m = person(g, "mimic", 1);
  person(g, "muse", 0, 1);
  g.p(1).water = 0;
  use(g);
  chooseTarget(g, m);
  g.choose(0);
  pick(g, (o) => o.label.includes("缪斯"));
  assert.equal(g.p(1).water, 1);
});
test("Incinerator discards before chosen junk order and does not apply skipped junk", () => {
  const g = base("incinerator"),
    a = g.unit("looter"),
    b = g.unit("repair");
  g.p().hand = [a, b];
  use(g);
  g.choose(0);
  g.choose(0);
  assert.equal(g.p().hand.length, 0);
  assert(g.s.discard.some((c) => c.uid === a.uid));
  assert.equal(g.s.choice.options.length, 2);
  pick(g, (o) => o.card.uid === a.uid);
  assert.equal(g.p().water, 20);
  g.choose(-1);
  chooseTarget(g, g.p(1).camps[0]);
  assert.equal(g.p(1).camps[0].hp, 1);
});
test("Lobotomizer replaces exact slot and counts new punk entry", () => {
  const g = base("lobotomizer"),
    c = person(g, "scout", 0, 1, { hp: 1 });
  person(g, "muse", 0, 1);
  g.s.deck.push(g.unit("repair"), g.unit("looter"), g.unit("muse"));
  use(g);
  chooseTarget(g, c);
  assert(!g.find(c.uid));
  assert(g.p().cols[1][0].punk);
  assert.equal(g.p().cols[1].length, 2);
  assert.equal(g.p().entered, 1);
  assert.equal(g.p().water, 20);
});
test("Masquerade flips person ready, triggers entry, cannot flip event", () => {
  const g = base("masquerade"),
    c = person(g, "vanguard", 0, 0, { punk: true, tired: true });
  assert(g.flip(0, c.uid));
  assert(!c.punk);
  assert(!c.tired);
  assert.equal(g.p().water, 19);
  settle(g);
  assert.equal(g.p().entered, 1); // punk was optional and skipped
  const e = person(g, "radiation", 0, 1, { punk: true });
  assert(!g.flip(0, e.uid));
});
test("Memorial only tracks own cards hurt in current own turn", () => {
  const g = base("memorial"),
    c = person(g);
  assert(!g.use(0, g.p().camps[0].uid, 0));
  g.damage(g.p(1).camps[0].uid);
  assert(!g.p().hurt);
  g.damage(c.uid);
  use(g);
  chooseTarget(g, c);
  assert.equal(c.hp, 2);
});
test("Power Plant readies damaged camps and healthy people, not damaged people or itself", () => {
  const g = base("powerplant"),
    a = person(g, "scout", 0, 0, { tired: true }),
    b = person(g, "muse", 0, 1, { hp: 1, tired: true });
  g.p().camps[1].hp = 1;
  g.p().camps[1].tired = true;
  use(g);
  assert(!a.tired);
  assert(b.tired);
  assert(!g.p().camps[1].tired);
  assert(g.p().camps[0].tired);
});
test("Rescue Post prohibits same-name replay but resets next own turn", () => {
  const g = base("rescuepost"),
    c = person(g);
  use(g);
  chooseTarget(g, c);
  assert(!g.canDeploy(0, c));
  assert(!g.play(0, c.uid));
  g.end(0);
  g.end(1);
  assert(g.canDeploy(0, c));
});
test("Ridgetop exposes both sides for Vanguard retaliation; ends with turn", () => {
  const g = base("ridgetop");
  person(g);
  person(g, "scout", 1);
  use(g);
  assert(g.exposed(g.find(g.p().camps[0].uid)));
  assert(g.exposed(g.find(g.p(1).camps[0].uid)));
  g.end(0);
  assert(!g.exposed(g.find(g.p().camps[0].uid)));
});
test("War Room discounts event cards but never camp raid abilities", () => {
  const g = base("warroom"),
    c = g.unit("radiation");
  g.p().hand = [c];
  assert.equal(g.eventPrice(0, c), 1);
  assert(g.play(0, c.uid));
  assert.equal(g.p().water, 19);
  assert.equal(g.price(0, g.p().camps[1], C.garage.abilities[0]), 1);
});
test("Science Lab cannot restore itself", () => {
  const g = base("sciencelab");
  g.p().camps[0].hp = 1;
  g.s.deck.push(g.unit("gunner"));
  use(g);
  g.choose(0);
  assert.equal(g.p().camps[0].hp, 1);
});
test("Obelisk wins on actual last draw, punk draw or mill before shuffle", () => {
  for (const how of ["draw", "punk", "sciencelab"]) {
    const g = base("obelisk2");
    g.s.deck = [g.unit("looter")];
    g.s.discard = [g.unit("scout")];
    if (how === "draw") g.draw(1);
    else {
      g.push(g.effect(how, 1));
      g.run();
      if (g.s.choice) g.choose(0);
    }
    assert.equal(g.s.winner, 0);
    assert.equal(g.s.shuffles, 0);
  }
});
test("Last card immediately reshuffles or draws, no extra empty draw required", () => {
  const g = base();
  g.s.deck = [g.unit("looter")];
  g.s.discard = [g.unit("scout")];
  g.draw(0);
  assert.equal(g.s.shuffles, 1);
  assert.equal(g.s.deck.length, 1);
  g.draw(0);
  assert.equal(g.s.winner, "draw");
});
test("Resolving event is unavailable in discard until its effects finish", () => {
  const g = base();
  const c = g.unit("banish");
  person(g, "scout", 1);
  g.p().events[0] = c;
  g.begin();
  assert(!g.s.discard.some((v) => v.uid === c.uid));
  assert(g.s.resolving.some((v) => v.uid === c.uid));
  g.choose(0);
  assert(g.s.discard.some((v) => v.uid === c.uid));
  assert.equal(g.s.resolving.length, 0);
});
test("Pending Incinerator and Guillotine save restores exact decisions", () => {
  for (const id of ["incinerator", "guillotine"]) {
    const g = base(id);
    g.p().hand = [g.unit("looter"), g.unit("muse")];
    person(g, "muse", 1);
    use(g);
    const h = new Game(JSON.parse(JSON.stringify(g.s)));
    assert.deepEqual(h.s.choice, g.s.choice);
    settle(h);
    assert.equal(h.s.choice, null);
  }
});
test("Parachute resolves entry then offers ability, including sacrifice of new person", () => {
  const g = base("parachute"),
    c = g.unit("cult");
  g.p().hand = [c];
  use(g);
  g.choose(0);
  g.choose(0);
  assert(g.find(c.uid));
  g.choose(0);
  chooseTarget(g, c);
  settle(g);
  assert(!g.find(c.uid));
});
test("Lobotomizer preserves a position behind Fortress", () => {
  const g = base("lobotomizer");
  g.p().camps[1] = g.unit("fortress");
  const c = person(g, "scout", 0, 1, { hp: 1 });
  g.p().camps[1].front = 0;
  g.s.deck.push(g.unit("repair"), g.unit("looter"), g.unit("muse"));
  use(g);
  chooseTarget(g, c);
  assert(g.p().cols[1][0].punk);
  assert.equal(g.campFront(0, 1), 0);
});
test("High Ground effects on either player expire at turn end", () => {
  const g = base();
  g.p(1).high = true;
  g.end(0);
  assert.equal(g.p(1).high, false);
});
console.log(`${count} expansion test groups passed`);
