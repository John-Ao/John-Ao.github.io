const assert = require("node:assert/strict");
// Repeatable shuffle/action choices; override with RADLANDS_SEED for diagnosis.
let seed = Number(process.env.RADLANDS_SEED || 20261020);
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const { Game } = require("./engine.js");
const { C, pools } = require("./cards.js");
let tests = 0;
function test(name, fn) {
  fn();
  tests++;
  console.log("PASS", name);
}
function base() {
  const g = new Game();
  g.s.active = 0;
  g.draft(
    g
      .p(0)
      .offer.slice(0, 3)
      .map((c) => c.uid),
  );
  g.draft(
    g
      .p(1)
      .offer.slice(0, 3)
      .map((c) => c.uid),
  );
  for (let p = 0; p < 2; p++) {
    g.p(p).camps = ["railgun", "garage", "outpost"].map((id) => g.unit(id));
    g.p(p).hand = [];
    g.p(p).water = 10;
  }
  return g;
}
function resolve(g, limit = 100) {
  for (let i = 0; g.s.choice && i < limit; i++) {
    const ch = g.s.choice;
    let n = ch.options.findIndex(
      (o) => o.label === "完成重排" || o.label.startsWith("完成："),
    );
    if (n < 0) n = Math.floor(Math.random() * ch.options.length);
    g.choose(n);
  }
  assert(!g.s.choice, "choice loop");
}
test("34 camps and 66 main cards", () => {
  const g = new Game();
  assert.equal(g.s.deck.length, 66);
  assert.equal(pools.classic.length, 34);
});
test("First player 1 water, later player 3", () => {
  const g = new Game();
  g.s.active = 0;
  g.draft(
    g
      .p(0)
      .offer.slice(0, 3)
      .map((c) => c.uid),
  );
  g.draft(
    g
      .p(1)
      .offer.slice(0, 3)
      .map((c) => c.uid),
  );
  assert.equal(g.p(0).water, 1);
  g.end(0);
  assert.equal(g.p(1).water, 3);
});
test("Protection and damaged people", () => {
  const g = base(),
    c = g.unit("scout");
  g.p(1).cols[0] = [c];
  assert(!g.exposed(g.find(g.p(1).camps[0].uid)));
  assert(g.exposed(g.find(c.uid)));
  g.damage(c.uid);
  assert(!g.ready(c));
  g.damage(c.uid);
  assert(g.exposed(g.find(g.p(1).camps[0].uid)));
});
test("Camp remains usable when damaged", () => {
  const g = base(),
    c = g.p(0).camps[0];
  g.damage(c.uid);
  assert(g.ready(c));
});
test("Deployment pays and exhausts person", () => {
  const g = base(),
    c = g.unit("scout");
  g.p().hand = [c];
  g.play(0, c.uid);
  g.choose(0);
  assert.equal(g.p().water, 9);
  assert(!g.ready(c));
  assert.equal(g.people(0).length, 1);
});
test("Enemy cannot act out of turn", () => {
  const g = base();
  assert(!g.buy(1, "draw"));
  assert(!g.end(1));
});
test("Water silo persists and returns to supply", () => {
  const g = base();
  g.buy(0, "silo");
  const c = g.p().hand[0];
  g.end(0);
  g.end(1);
  assert(g.p().hand.some((v) => v.uid === c.uid));
  g.junk(0, c.uid);
  assert.equal(g.p().water, 4);
  assert(!g.s.discard.some((v) => v.id === "silo"));
});
test("Punk returns hidden card to top of deck", () => {
  const g = base();
  g.push(g.effect("punk", 0));
  g.run();
  g.choose(0);
  const c = g.people(0)[0];
  g.damage(c.uid);
  assert.equal(g.s.deck.at(-1).uid, c.uid);
  assert(!g.s.deck.at(-1).punk);
});
test("Raid resolves with defender choice ignoring protection", () => {
  const g = base();
  g.push(g.effect("raid", 0));
  g.run();
  assert.equal(g.p().events[1].id, "raiders");
  g.push(g.effect("raid", 0));
  g.run();
  assert.equal(g.p().events[0].id, "raiders");
  g.push(g.effect("raid", 0));
  g.run();
  assert.equal(g.s.choice.p, 1);
  g.choose(0);
  assert.equal(g.p(1).camps[0].hp, 1);
});
test("Events advance but do not resolve early", () => {
  const g = base();
  g.p(0).events[1] = g.unit("raiders");
  g.end(0);
  g.end(1);
  assert.equal(g.p(0).events[0].id, "raiders");
  assert(!g.s.choice);
  g.end(0);
  g.end(1);
  assert.equal(g.s.choice.p, 1);
  g.choose(0);
  assert.equal(g.p(0).water, 3);
});
test("Self restoration forbidden", () => {
  const g = base();
  const c = g.p().camps[0];
  g.damage(c.uid);
  g.push(g.effect("restore", 0, c.uid));
  g.run();
  assert.equal(g.s.choice, null);
  assert.equal(c.hp, 1);
});
test("Vera grants exactly a second use", () => {
  const g = base();
  const v = g.unit("vera"),
    m = g.unit("muse");
  g.p().cols[0] = [v, m];
  g.use(0, m.uid, 0);
  assert(g.ready(m));
  g.use(0, m.uid, 0);
  assert(!g.ready(m));
  assert(!g.use(0, m.uid, 0));
});
test("Immediate loss on self-destruction", () => {
  const g = base();
  g.p(0).camps[0] = g.unit("cannon");
  const c = g.p().camps[0];
  c.hp = 1;
  g.p().camps[1].hp = g.p().camps[2].hp = 0;
  g.use(0, c.uid, 0);
  assert.equal(g.s.winner, 1);
  assert.equal(g.s.choice, null);
});
test("State roundtrip preserves pending choice", () => {
  const g = base();
  g.push(g.effect("damage", 0));
  g.run();
  const h = new Game(JSON.parse(JSON.stringify(g.s)));
  h.choose(0);
  assert.equal(h.p(1).camps[0].hp, 1);
});
test("Full board offers a sacrifice before deployment", () => {
  const g = base();
  g.p().cols = [0, 1, 2].map(() => [g.unit("scout"), g.unit("scout")]);
  const c = g.unit("muse");
  g.p().hand = [c];
  g.play(0, c.uid);
  assert.equal(g.s.choice.options.length, 6);
  g.choose(0);
  g.choose(0);
  assert.equal(g.people(0).length, 6);
});
test("Second reshuffle ends in draw", () => {
  const g = base();
  g.s.deck = [];
  g.s.discard = [g.unit("scout")];
  g.draw(0);
  assert.equal(g.s.shuffles, 1);
  g.draw(0);
  assert.equal(g.s.winner, "draw");
});
test("All base abilities and events can resolve", () => {
  for (const d of Object.values(C)) {
    for (const ability of d.abilities || []) {
      const g = base();
      let c = g.unit(d.id);
      if (d.type === "camp") g.p().camps[0] = c;
      else g.p().cols[0] = [c];
      g.p().cols[1] = [g.unit("wounded"), { ...g.unit("scout"), punk: true }];
      g.p().cols[1][0].hp = 1;
      g.p(1).cols[0] = [g.unit("scout")];
      g.p(1).cols[1] = [{ ...g.unit("muse"), hp: 1 }];
      g.p().hand = [g.unit("scout"), g.unit("muse"), g.unit("radiation")];
      g.p().events[1] = g.unit("raiders");
      g.p(1).events[1] = g.unit("raiders");
      g.push(g.effect(ability.effect, 0, c.uid));
      g.run();
      resolve(g);
    }
    if (d.type === "event") {
      const g = base();
      g.p().cols[0] = [g.unit("scout")];
      g.p(1).cols[0] = [g.unit("scout")];
      g.push(g.effect(d.effect, 0));
      g.run();
      resolve(g);
    }
  }
});
test("Random legal games preserve card count and nonnegative water", () => {
  for (let round = 0; round < 120; round++) {
    const g = new Game(null, ["classic", "revised", "complete"][round % 3]);
    g.draft(
      g
        .p(0)
        .offer.slice(0, 3)
        .map((c) => c.uid),
    );
    g.draft(
      g
        .p(1)
        .offer.slice(0, 3)
        .map((c) => c.uid),
    );
    for (let step = 0; step < 500 && g.s.winner === null; step++) {
      if (g.s.choice) {
        resolve(g);
        continue;
      }
      const p = g.s.active,
        x = g.p(p);
      const actions = [
        () => g.end(p),
        () => g.buy(p, "draw"),
        () => g.buy(p, "silo"),
      ];
      for (const c of x.hand) {
        actions.push(() => g.junk(p, c.uid));
        if (c.id !== "silo") actions.push(() => g.play(p, c.uid));
      }
      for (const c of g.people(p).filter((c) => c.punk))
        actions.push(() => g.flip(p, c.uid));
      for (const c of g.cards(p))
        g.abilities(p, c).forEach((a, i) =>
          actions.push(() => g.use(p, c.uid, i)),
        );
      actions[Math.floor(Math.random() * actions.length)]();
      for (let i = 0; i < 2; i++) {
        assert(g.p(i).water >= 0);
        assert(g.p(i).cols.every((c, col) => c.length <= g.capacity(i, col)));
      }
      const all = [
        ...g.s.resolving,
        ...g.s.deck,
        ...g.s.discard,
        ...g.p(0).hand,
        ...g.p(1).hand,
        ...g.people(0),
        ...g.people(1),
        ...g.p(0).events.filter(Boolean),
        ...g.p(1).events.filter(Boolean),
      ].filter((c) => !["silo", "raiders"].includes(c.id));
      assert.equal(
        new Set(all.map((c) => c.uid)).size,
        all.length,
        "duplicate uid",
      );
      assert.equal(all.length, 66, "lost main card");
    }
  }
});
test("Unaffordable personnel cannot be played", () => {
  const g = base(),
    c = g.unit("molgur");
  g.p().water = 3;
  g.p().hand = [c];
  assert(!g.canDeploy(0, c));
  assert(!g.play(0, c.uid));
  assert.equal(g.s.choice, null);
});
console.log(`${tests} test groups passed`);
