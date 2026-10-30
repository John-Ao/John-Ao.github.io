/* Numerical mechanics transcribed from Gloomhaven (2017) cards. No original artwork. */
(function (root) {
  const a = (type, n, extra = {}) => ({ type, n, ...extra });
  const half = (ops, extra = {}) => ({ ops, ...extra });
  const atk = (n, range = 1, extra = {}) => a("attack", n, { range, ...extra });
  const mv = (n, extra = {}) => a("move", n, extra);
  const heal = (n, range) => a("heal", n, { range });
  const cards = {};
  function c(id, name, en, init, level, top, bottom) {
    cards[id] = { id, name, en, init, level, top, bottom };
  }
  c(
    "b01",
    "践踏",
    "Trample",
    72,
    1,
    half([atk(3, 1, { pierce: 2 })]),
    half([mv(4, { jump: true }), a("trample", 2)], { loss: true, xp: 2 }),
  );
  c(
    "b02",
    "以眼还眼",
    "Eye for an Eye",
    18,
    1,
    half([a("retaliate", 2, { xpHit: 1 })]),
    half([heal(2, 1)], { infuse: "earth" }),
  );
  c(
    "b03",
    "横扫",
    "Sweeping Blow",
    64,
    1,
    half([atk(2, 1, { shape: "fan3" })]),
    half([mv(3), a("push", 1, { all: true, range: 1 })]),
  );
  c(
    "b04",
    "挑衅怒吼",
    "Provoking Roar",
    10,
    1,
    half([atk(2, 1, { condition: "disarm" })]),
    half([a("redirect", 1)]),
  );
  c(
    "b05",
    "压倒性攻势",
    "Overwhelming Assault",
    61,
    1,
    half([atk(6)], { loss: true, xp: 2 }),
    half([mv(3), a("push", 2, { range: 1 })]),
  );
  c(
    "b06",
    "盾击",
    "Shield Bash",
    15,
    1,
    half([atk(4, 1, { condition: "stun" })], { loss: true, xp: 2 }),
    half([a("shield", 1)]),
  );
  c(
    "b07",
    "防护之力",
    "Warding Strength",
    32,
    1,
    half([atk(3, 1, { push: 2 })]),
    half(
      [
        a("persistent", 1, {
          effect: "shield",
          charges: 6,
          xpSlots: [2, 4, 6],
        }),
      ],
      { loss: true },
    ),
  );
  c("b08", "攫取", "Grab and Go", 87, 1, half([a("loot", 1)]), half([mv(4)]));
  c(
    "b09",
    "腾跃劈斩",
    "Leaping Cleave",
    54,
    1,
    half([atk(3, 1, { shape: "fan2" })], { xp: 1 }),
    half([mv(3, { jump: true })], { infuse: "air" }),
  );
  c(
    "b10",
    "备用匕首",
    "Spare Dagger",
    27,
    1,
    half([atk(3, 3)], { xp: 1 }),
    half([atk(2)]),
  );
  c(
    "b11",
    "穿刺",
    "Skewer",
    35,
    "X",
    half([atk(3, 1, { shape: "line2" })], {
      xp: 1,
      consume: { element: "air", attack: 1, pierce: 1 },
    }),
    half([mv(6)], { xp: 1, loss: true }),
  );
  c(
    "b12",
    "均衡衡量",
    "Balanced Measure",
    77,
    "X",
    half([atk("moved")], { xp: 1 }),
    half([mv("damage")]),
  );
  c(
    "b13",
    "末日之墙",
    "Wall of Doom",
    20,
    "X",
    half([a("retaliate", 2), a("shield", 2)], { xp: 2, loss: true }),
    half([a("attackBonus", 1)]),
  );
  c(
    "b14",
    "致命推进",
    "Fatal Advance",
    40,
    2,
    half([a("kill", 1, { range: 1 })], { xp: 2, loss: true }),
    half([mv(4)]),
  );
  c(
    "b15",
    "势不可挡",
    "Juggernaut",
    34,
    2,
    half([mv(2), atk(2)]),
    half(
      [
        a("persistent", 0, {
          effect: "negate",
          charges: 3,
          xpSlots: [1, 2, 3],
        }),
      ],
      { loss: true },
    ),
  );
  c(
    "s01",
    "火焰宝珠",
    "Fire Orbs",
    69,
    1,
    half([atk(3, 3, { targets: 3, xpTarget: 1 })], {
      loss: true,
      infuse: "fire",
    }),
    half([mv(3)]),
  );
  c(
    "s02",
    "穿刺喷发",
    "Impaling Eruption",
    70,
    1,
    half([atk(3, 4, { shape: "path", xpTarget: 1 })], {
      loss: true,
      infuse: "earth",
    }),
    half([mv(4)]),
  );
  c(
    "s03",
    "复苏以太",
    "Reviving Ether",
    80,
    1,
    half([a("recover", 0)], { loss: true, permanent: true, infuse: "dark" }),
    half([mv(4, { jump: true })]),
  );
  c(
    "s04",
    "冰霜新星",
    "Freezing Nova",
    21,
    1,
    half([atk(2, 1, { all: true, condition: "immobilize" })], {
      consume: { element: "ice", attack: 1 },
    }),
    half([heal(4, 4)], { loss: true, infuse: "light" }),
  );
  c(
    "s05",
    "法力箭",
    "Mana Bolt",
    7,
    1,
    half([atk(2, 3)], { consume: { element: "any", attack: 1, xp: 1 } }),
    half([heal(3, 1)]),
  );
  c(
    "s06",
    "寒霜护甲",
    "Frost Armor",
    20,
    1,
    half([atk(2, 3)], { consume: { element: "ice", attack: 1, xp: 1 } }),
    half(
      [a("persistent", 0, { effect: "negate", charges: 2, xpSlots: [1, 2] })],
      { loss: true, infuse: "ice" },
    ),
  );
  c(
    "s07",
    "烈焰打击",
    "Flame Strike",
    36,
    1,
    half([atk(3, 2)], { consume: { element: "fire", condition: "wound" } }),
    half([atk(2, 2)]),
  );
  c(
    "s08",
    "乘风",
    "Ride the Wind",
    83,
    1,
    half([a("loot", 1)]),
    half([mv(8, { jump: true })], { loss: true, infuse: "air" }),
  );
  c(
    "s09",
    "爆裂气流",
    "Crackling Air",
    25,
    "X",
    half(
      [a("persistent", 1, { effect: "attack", charges: 4, xpSlots: [2, 4] })],
      { loss: true, consume: { element: "air", persistent: 1 } },
    ),
    half([mv(3)], { consume: { element: "fire", retaliate: 2 } }),
  );
  c(
    "s10",
    "硬化尖刺",
    "Hardened Spikes",
    26,
    "X",
    half([a("retaliate", 2, { allies: true })], {
      loss: true,
      xp: 2,
      consume: { element: "earth", retaliateBonus: 1 },
    }),
    half([mv(3)], { consume: { element: "ice", shield: 2 } }),
  );
  c(
    "s11",
    "以太援助",
    "Aid from the Ether",
    91,
    "X",
    half([heal(3, 3)]),
    half([a("summon", 1, { hp: 2, move: 2, attack: 3, range: 2 })], {
      loss: true,
      xp: 2,
    }),
  );
  c(
    "s12",
    "闪光爆发",
    "Flashing Burst",
    26,
    2,
    half([atk(3, 3)], { infuse: "light" }),
    half([mv(4)]),
  );
  c(
    "s13",
    "冰爆",
    "Icy Blast",
    66,
    2,
    half([atk(2, 3, { shape: "burst", condition: "muddle" })], {
      loss: true,
      xp: 2,
      infuse: "ice",
    }),
    half([heal(6, 2)], { loss: true }),
  );
  const classes = {
    brute: {
      name: "蛮族",
      en: "Brute",
      hp: [10, 12],
      limit: 10,
      prefix: "b",
      description: "近战、防护、推挤；10 张手牌",
    },
    spellweaver: {
      name: "织法者",
      en: "Spellweaver",
      hp: [6, 7],
      limit: 8,
      prefix: "s",
      description: "远程、元素、召唤、损失牌回收；8 张手牌",
    },
  };
  const items = {
    boots: {
      name: "疾行靴",
      price: 20,
      slot: "feet",
      uses: "spent",
      text: "一次移动 +2；长休息恢复",
    },
    cloak: {
      name: "隐形斗篷",
      price: 20,
      slot: "body",
      uses: "consumed",
      text: "自己的回合获得隐形，至下一回合结束",
    },
    goggles: {
      name: "鹰眼镜",
      price: 30,
      slot: "head",
      uses: "spent",
      text: "当前攻击行动获得优势；长休息恢复",
    },
    heal: {
      name: "小型治疗药水",
      price: 10,
      slot: "small",
      uses: "consumed",
      text: "自己的回合治疗自身 3",
    },
    stamina: {
      name: "小型耐力药水",
      price: 10,
      slot: "small",
      uses: "consumed",
      text: "取回最多 2 张弃牌（2017 原版数值）",
    },
    power: {
      name: "小型力量药水",
      price: 10,
      slot: "small",
      uses: "consumed",
      text: "当前攻击行动的所有攻击 +1",
    },
  };
  const perks = {
    brute: [
      { id: "removeNeg", name: "移除两张 −1", max: 1 },
      { id: "replaceNeg", name: "一张 −1 替换为 +1", max: 1 },
      { id: "addOnes", name: "加入两张 +1", max: 2 },
      { id: "addThree", name: "加入一张 +3", max: 1 },
    ],
    spellweaver: [
      { id: "removeZeros", name: "移除四张 +0", max: 1 },
      { id: "replaceNeg", name: "一张 −1 替换为 +1", max: 2 },
      { id: "addOnes", name: "加入两张 +1", max: 2 },
    ],
  };
  const conditions = {
    poison: "中毒",
    wound: "创伤",
    immobilize: "定身",
    disarm: "缴械",
    stun: "眩晕",
    muddle: "困惑",
    invisible: "隐形",
    strengthen: "强化",
  };
  const elements = {
    fire: "火",
    ice: "冰",
    air: "风",
    earth: "土",
    light: "光",
    dark: "暗",
  };
  // Eight official ability cards per monster type, represented as mechanical data.
  const monsters = {
    guard: { name: "强盗守卫", deck: "Guard" },
    archer: { name: "强盗弓手", deck: "Archer" },
    bones: { name: "活骷髅", deck: "Living Bones" },
  };
  const monsterDecks = {
    guard: [
      { init: 15, shuffle: true, shield: 1, retaliate: 2 },
      { init: 30, move: 1, attack: -1 },
      { init: 35, move: -1, attack: 0, range: 2 },
      { init: 50, move: 0, attack: 0 },
      { init: 50, move: 0, attack: 0 },
      { init: 70, move: -1, attack: 1 },
      { init: 55, move: -1, attack: 0, strengthen: true },
      { init: 15, shuffle: true, shield: 1, attack: 0, condition: "poison" },
    ],
    archer: [
      { init: 16, move: 1, attack: -1 },
      { init: 31, move: 0, attack: 0 },
      { init: 32, move: 0, attack: 1, rangeMod: -1 },
      { init: 44, move: -1, attack: 1 },
      { init: 56, attack: -1, targets: 2 },
      { init: 68, attack: 1, rangeMod: 1, shuffle: true },
      { init: 14, move: -1, attack: -1, trap: 3 },
      {
        init: 29,
        move: 0,
        attack: -1,
        rangeMod: 1,
        condition: "immobilize",
        shuffle: true,
      },
    ],
    bones: [
      { init: 64, move: -1, attack: 1 },
      { init: 20, move: -2, attack: 0, heal: 2, shuffle: true },
      { init: 25, move: 1, attack: -1 },
      { init: 45, move: 0, attack: 0 },
      { init: 45, move: 0, attack: 0 },
      { init: 81, attack: 2 },
      { init: 74, move: 0, attack: 0, sameTarget: true },
      { init: 12, shield: 1, heal: 2, shuffle: true },
    ],
  };
  const scenarios = [
    {
      id: 0,
      name: "合作练习 · 三室清剿",
      goal: "kill",
      text: "打开全部房门，消灭所有敌人。自建教学地图，非官方场景 1。",
      rooms: 3,
      foes: [
        ["guard", 1, 2, 0, false],
        ["guard", 3, 1, 0, false],
        ["archer", 6, 1, 1, false],
        ["guard", 7, 3, 1, false],
        ["bones", 11, 1, 2, false],
        ["bones", 12, 3, 2, true],
      ],
      rocks: [
        [1, 4],
        [6, 0],
        [11, 4],
      ],
      traps: [
        [5, 2],
        [10, 3],
      ],
      chests: [[13, 1]],
      difficult: [
        [2, 3],
        [7, 1],
      ],
    },
    {
      id: 1,
      name: "合作练习 · 宝箱撤离",
      goal: "escape",
      text: "打开宝箱；两名角色均未耗尽且抵达出口。自建场景。",
      rooms: 3,
      foes: [
        ["bones", 2, 1, 0, false],
        ["bones", 3, 3, 0, false],
        ["guard", 6, 1, 1, true],
        ["archer", 7, 3, 1, false],
        ["guard", 11, 2, 2, false],
        ["archer", 13, 1, 2, false],
      ],
      rocks: [
        [2, 4],
        [6, 3],
        [12, 0],
      ],
      traps: [
        [5, 2],
        [11, 1],
      ],
      chests: [[12, 3]],
      difficult: [[7, 1]],
      exit: [
        [13, 3],
        [13, 4],
      ],
    },
    {
      id: 2,
      name: "合作练习 · 坚守",
      goal: "survive",
      rounds: 10,
      text: "坚守至第 10 轮结束；至少一名角色未耗尽。第 3、5、7 轮增援。自建场景。",
      rooms: 2,
      foes: [
        ["guard", 3, 1, 0, false],
        ["archer", 6, 3, 1, false],
      ],
      rocks: [
        [2, 4],
        [6, 0],
      ],
      traps: [[5, 2]],
      chests: [[8, 4]],
      difficult: [
        [2, 2],
        [7, 3],
      ],
    },
  ];
  const DATA = {
    cards,
    classes,
    items,
    perks,
    conditions,
    elements,
    monsters,
    monsterDecks,
    scenarios,
  };
  if (typeof module !== "undefined") module.exports = DATA;
  root.GH_DATA = DATA;
})(typeof globalThis !== "undefined" ? globalThis : this);
