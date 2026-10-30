/* Base-game card mechanics, independently expressed in Chinese. See README.md. */
(function (root) {
  const C = {};
  const a = (cost, effect, text) => ({ cost, effect, text });
  function card(id, name, type, cost, junk, abilities = [], extra = {}) {
    C[id] = { id, name, type, cost, junk, abilities, ...extra };
  }
  const P = (id, name, cost, junk, abilities, extra) =>
    card(id, name, "person", cost, junk, abilities, extra);
  P("looter", "掠夺者", 1, "water", [a(2, "loot", "伤害；命中营地则抽牌")]);
  P("wounded", "负伤士兵", 1, "injure", [a(1, "damage", "伤害")], {
    enter: "wounded",
    trait: "入场：抽 1 张牌，然后自身受伤",
  });
  P("cult", "邪教领袖", 1, "draw", [a(0, "cult", "牺牲己方一人，然后伤害")]);
  P("repair", "维修机器人", 1, "injure", [a(2, "restore", "修复")], {
    enter: "restore",
    trait: "入场：修复",
  });
  P("gunner", "机枪手", 1, "restore", [
    a(2, "strafe", "伤害所有未受保护的敌方人员"),
  ]);
  P("assassin", "刺客", 1, "raid", [
    a(2, "assassinate", "消灭未受保护的敌方人员"),
  ]);
  P("scientist", "科学家", 1, "raid", [
    a(1, "science", "弃掉牌堆顶 3 张，选一个弃牌效果"),
  ]);
  P("mutant", "变异人", 1, "injure", [
    a(0, "mutant", "伤害和／或修复，然后自身受伤"),
  ]);
  P("vigilante", "义警", 1, "raid", [a(1, "injure", "伤害未受保护的敌方人员")]);
  P("rescue", "救援队", 1, "injure", [a(0, "rescue", "将己方一人收回手牌")], {
    trait: "入场即可行动",
    ready: true,
  });
  P("muse", "缪斯", 1, "injure", [a(0, "water", "获得 1 水")]);
  P("mimic", "模仿者", 1, "injure", [
    a(0, "mimic", "复制己方就绪人员或敌方健康人员的技能，支付其费用"),
  ]);
  P("exterminator", "清除者", 1, "draw", [
    a(1, "exterminate", "消灭所有受伤敌方人员"),
  ]);
  P("scout", "侦察兵", 1, "water", [a(1, "raid", "突袭")]);
  P("pyro", "纵火者", 1, "injure", [
    a(1, "campDamage", "伤害未受保护的敌方营地"),
  ]);
  P("holdout", "坚守者", 2, "raid", [a(1, "damage", "伤害")], {
    trait: "部署到已毁营地所在列时免费",
  });
  P(
    "doomsayer",
    "末日预言者",
    1,
    "draw",
    [a(1, "doomDamage", "敌方有排队事件时：伤害")],
    { enter: "delay", trait: "入场：可将敌方所有事件后移一格" },
  );
  P("rabble", "煽动者", 1, "raid", [
    a(1, "punk", "获得 1 名朋克"),
    a(1, "punkDamage", "己方有朋克时：伤害"),
  ]);
  P(
    "vanguard",
    "先锋",
    1,
    "raid",
    [a(1, "vanguard", "伤害，然后对手对你造成伤害")],
    { enter: "punk", trait: "入场：获得 1 名朋克" },
  );
  P("sniper", "狙击手", 1, "restore", [a(2, "anyDamage", "伤害任意敌方卡牌")]);
  P(
    "magnus",
    "马格努斯·卡夫",
    3,
    "punk",
    [a(2, "columnDamage", "伤害敌方一列的所有卡牌")],
    { copies: 1 },
  );
  P("zeto", "泽托·可汗", 3, "punk", [a(1, "zeto", "抽 3 张，然后弃 3 张")], {
    copies: 1,
    trait: "每回合打出的首个事件立即结算",
  });
  P(
    "vera",
    "维拉·沃什",
    3,
    "punk",
    [a(1, "injure", "伤害未受保护的敌方人员")],
    { copies: 1, trait: "己方每张牌每回合首次使用技能后仍就绪" },
  );
  P("karli", "卡莉·布雷兹", 3, "punk", [a(1, "damage", "伤害")], {
    copies: 1,
    trait: "己方所有人员入场即可行动",
  });
  P(
    "molgur",
    "莫古尔·斯唐",
    4,
    "punk",
    [a(1, "destroyCamp", "消灭任意敌方营地")],
    { copies: 1 },
  );
  P("argo", "阿尔戈·耶斯基", 3, "punk", [a(1, "damage", "伤害")], {
    copies: 1,
    enter: "punk",
    trait: "己方所有人员获得「1 水：伤害」；入场获得朋克",
  });
  const E = (id, name, cost, junk, delay, effect, text) =>
    card(id, name, "event", cost, junk, [], { delay, effect, text });
  E(
    "interrogate",
    "审问",
    1,
    "water",
    0,
    "interrogate",
    "抽 4 张，保留其中 1 张",
  );
  E("truce", "休战", 2, "injure", 0, "truce", "所有人员回到各自手牌");
  E("uprising", "起义", 1, "injure", 2, "uprising", "获得 3 名朋克");
  E("radiation", "辐射", 2, "raid", 1, "radiation", "双方所有人员受伤");
  E(
    "famine",
    "饥荒",
    1,
    "injure",
    1,
    "famine",
    "从你开始，双方各保留 1 名人员，消灭其余人员",
  );
  E("napalm", "凝固汽油", 2, "restore", 1, "napalm", "消灭敌方一列的所有人员");
  E("strafe", "扫射", 2, "draw", 0, "strafe", "伤害所有未受保护的敌方人员");
  E(
    "bombardment",
    "轰炸",
    4,
    "restore",
    3,
    "bombardment",
    "伤害所有敌方营地，按其已毁营地数抽牌",
  );
  E(
    "highground",
    "制高点",
    0,
    "water",
    1,
    "highground",
    "重排己方人员；本回合敌方全部卡牌失去保护",
  );
  E("banish", "放逐", 1, "raid", 1, "banish", "消灭任意敌方人员");
  const B = (id, name, draw, abilities, extra) =>
    card(id, name, "camp", 0, null, abilities, { draw, ...extra });
  B("railgun", "轨道炮", 0, [a(2, "damage", "伤害")]);
  B("garden", "原子花园", 1, [a(2, "garden", "修复己方受伤人员，使其就绪")]);
  B("cannon", "加农炮", 1, [a(1, "cannon", "自身受伤，然后伤害")]);
  B("pillbox", "碉堡", 1, [a(3, "damage", "伤害；每座己方已毁营地使费用 −1")]);
  B("scud", "飞毛腿发射架", 0, [a(1, "scud", "对手选择其一张卡牌承受伤害")]);
  B("totem", "胜利图腾", 1, [a(2, "damage", "伤害"), a(2, "raid", "突袭")]);
  B("catapult", "投石机", 0, [
    a(2, "catapult", "伤害任意敌方卡牌，再牺牲己方一人"),
  ]);
  B("spies", "间谍巢穴", 1, [a(1, "spies", "本回合有至少 2 人入场时：伤害")]);
  B("command", "指挥所", 2, [a(3, "damage", "伤害；每名己方朋克使费用 −1")]);
  B("obelisk", "方尖碑", 3, [], { trait: "开局时即被摧毁", dead: true });
  B("mercenary", "佣兵营", 0, [
    a(2, "mercenary", "对手弃 2 张牌，或选择其一张卡牌被消灭"),
  ]);
  B("reactor", "反应堆", 1, [a(2, "reactor", "消灭自身及双方所有人员")]);
  B("octagon", "八角笼", 0, [a(1, "octagon", "牺牲己方一人；对手牺牲一人")]);
  B(
    "juggernaut",
    "攻城战车",
    0,
    [a(1, "juggernaut", "前进一格；第三次前进时归位，对手摧毁一座营地")],
    { trait: "战车前方的人员保护战车，后方人员受战车保护" },
  );
  B("scavenger", "拾荒者营地", 1, [
    a(2, "raid", "突袭"),
    a(1, "raidRestore", "本回合突袭已结算时：修复"),
  ]);
  B("outpost", "前哨站", 1, [a(2, "raid", "突袭"), a(2, "restore", "修复")]);
  B("transplant", "移植实验室", 2, [
    a(1, "transplant", "本回合有至少 2 人入场时：修复"),
  ]);
  B("resonator", "共振器", 1, [
    a(2, "resonate", "消灭未受保护且受伤的敌方卡牌"),
  ]);
  B(
    "bonfire",
    "篝火",
    1,
    [a(0, "bonfire", "自身受伤，再修复任意数量己方卡牌")],
    { trait: "此营地不能被修复" },
  );
  B("cache", "储藏点", 1, [a(0, "cache", "自身受伤，再选择抽牌／修复／朋克")]);
  B("watchtower", "瞭望塔", 0, [a(1, "watch", "本回合有事件结算时：伤害")]);
  B("construction", "建造场", 2, [
    a(1, "construction", "若自身未受伤，重建己方一座已毁营地，然后摧毁自身"),
  ]);
  B("adrenaline", "肾上腺素实验室", 1, [
    a(0, "adrenaline", "支付费用使用己方受伤人员的技能，然后消灭该人员"),
  ]);
  B("mulcher", "粉碎机", 0, [a(0, "mulcher", "牺牲己方一人，抽 1 张牌")]);
  B("bloodbank", "血库", 1, [a(0, "bloodbank", "牺牲己方一人，获得 1 水")]);
  B("arcade", "游乐场", 1, [a(1, "arcade", "己方只有 0 或 1 人时：获得朋克")]);
  B("training", "训练营", 1, [
    a(1, "training", "翻开一名朋克：人员入场；事件弃掉，获得朋克和 1 水"),
  ]);
  B("depot", "补给仓库", 2, [a(2, "depot", "抽 2 张，保留其中 1 张")]);
  B("omen", "预兆钟", 1, [a(1, "omen", "将任一方一个事件向前推进一格")]);
  B("warehouse", "仓库", 1, [
    a(0, "warehouse", "自身受伤，弃至少 1 张牌，再抽弃牌数 +1 张"),
  ]);
  B("garage", "车库", 0, [a(1, "raid", "突袭")]);
  B("oasis", "绿洲", 1, [], { trait: "此列无人员时，部署人员费用 −1" });
  B("parachute", "空降基地", 1, [
    a(0, "parachute", "部署人员并使用其技能（均须支付），然后使其受伤"),
  ]);
  B("labor", "劳工营", 1, [a(0, "labor", "牺牲己方一人，然后修复")]);
  // Cult of Chrome: replacement IDs keep v1 saves and the classic pool intact.
  const classic = Object.values(C)
    .filter((c) => c.type === "camp")
    .map((c) => c.id);
  const replacements = {};
  function R(id, draw, abilities, extra = {}) {
    const next = id + "2";
    B(next, C[id].name, draw, abilities, {
      ...extra,
      edition: "revised",
      original: id,
    });
    replacements[id] = next;
  }
  R("cache", 1, [a(2, "raidPunk", "突袭，然后获得朋克")]);
  R("cannon", 2, [a(2, "healthyDamage", "自身完好时：伤害")], {
    damaged: true,
    trait: "开局时受伤",
  });
  R("command", 1, [a(3, "damage", "伤害；每名己方朋克令费用 −1")]);
  R("construction", 1, [
    a(1, "relocate", "移动任一人员到其所属方的任意空位"),
    a(2, "raid", "突袭"),
  ]);
  R("mercenary", 0, [a(2, "fourCamp", "己方至少四人时：伤害任意敌方营地")]);
  R("obelisk", 1, [], { trait: "牌堆最后一张牌被取走时，你立即获胜" });
  R("resonator", 1, [a(1, "soleDamage", "伤害；本回合只能使用这一次技能")]);
  R("scavenger", 1, [a(0, "scavenge", "弃一张非储水塔手牌，选择朋克或 1 水")]);
  R("training", 2, [a(2, "twoColumn", "本列有两名人员时：伤害")]);
  R("warehouse", 1, [a(1, "openRestore", "敌方有未受保护的营地时：修复")]);
  function N(id, name, draw, abilities, extra = {}) {
    B(id, name, draw, abilities, { ...extra, edition: "chrome" });
  }
  N("armory", "军械库", 1, [a(2, "punk", "获得朋克")], {
    trait: "己方朋克获得：2 水造成伤害",
  });
  N("asylum", "收容所", 1, [
    a(2, "steal", "将任意受伤敌方人员移至己方空位"),
    a(2, "restore", "修复"),
  ]);
  N("bandit", "匪徒营地", 1, [], { trait: "己方突袭者结算时获得 1 水" });
  N("battering", "攻城锤", 0, [
    a(3, "sixCamp", "己方至少六人时：摧毁任意敌方营地"),
  ]);
  N("blackmarket", "黑市", 0, [
    a(1, "blackmarket", "使用本回合入场的己方人员的弃用效果，不弃掉该人员"),
  ]);
  N("boulder", "巨石", 1, [
    a(1, "boulder", "消灭敌方一列所有人员，伤害该列营地，然后摧毁自身"),
  ]);
  N("bounty", "悬赏处", 1, [
    a(1, "bounty", "敌方没有朋克时：伤害任意敌方营地，然后敌方获得朋克"),
  ]);
  N("cannibal", "食人图腾", 1, [
    a(1, "cannibal", "伤害一张己方完好卡牌，然后修复"),
  ]);
  N("culthouse", "邪教会所", 1, [a(1, "cult", "牺牲己方一人，然后伤害")]);
  N("deathray", "死亡射线", 1, [
    a(2, "deathray", "弃五张非储水塔手牌，摧毁任意敌方卡牌"),
  ]);
  N("derby", "撞车竞技场", 1, [a(2, "raid", "突袭")], {
    trait: "己方突袭者结算时，敌方所有事件后退一格",
  });
  N("draftoffice", "征募处", 1, [a(3, "drawTwo", "抽两张牌")]);
  N("hospital", "战地医院", 1, [
    a(1, "hospital", "将己方受伤人员移入本列并修复"),
    a(2, "raid", "突袭"),
  ]);
  N("fortress", "堡垒", 0, [a(3, "uprising", "获得三名朋克")], {
    trait: "从中排开始，身后可容纳一名人员",
  });
  N("freedom", "自由营地", 1, [
    a(1, "openPunk", "敌方有未受保护的营地时：获得朋克"),
  ]);
  N("gas", "加油站", 2, [a(1, "gasRaid", "突袭；新入队的突袭者放在第 3 格")]);
  N("guillotine", "断头台", 0, [
    a(2, "guillotine", "消灭未受保护的敌方人员；对方可免费使用其一项技能"),
  ]);
  N("incinerator", "焚化炉", 0, [
    a(
      1,
      "incinerator",
      "弃两张非储水塔手牌，可任意顺序使用其弃用效果，然后伤害",
    ),
  ]);
  N("laser", "激光塔", 2, [a(2, "laser", "消灭本列所有己方人员，然后伤害")]);
  N("lobotomizer", "脑叶切除所", 1, [
    a(
      1,
      "lobotomizer",
      "修复己方一人；弃牌堆顶三张，若有伤人图标，则将其替换为朋克并获得 1 水",
    ),
  ]);
  N("masquerade", "假面舞会", 0, [a(2, "punk", "获得朋克")], {
    trait: "可查看己方朋克；行动阶段支付人物费用可原地翻面且立即就绪",
  });
  N("memorial", "纪念碑", 1, [
    a(1, "memorial", "本回合己方卡牌曾受伤或被消灭时：修复"),
  ]);
  N("mining", "采矿营地", 1, [
    a(1, "mining", "移除任一已毁营地，使该列可容纳三人，然后伤害"),
    a(2, "raid", "突袭"),
  ]);
  N("motorcycle", "摩托俱乐部", 1, [
    a(1, "motorcycle", "己方有朋克时：选择朋克或突袭"),
  ]);
  N("peaceful", "和平村", 1, [
    a(1, "peaceful", "自身完好时修复；受伤时造成伤害"),
  ]);
  N("powerplant", "发电厂", 1, [
    a(1, "powerplant", "使其他己方营地和完好人员就绪"),
  ]);
  N("recycling", "回收站", 2, [
    a(0, "recycling", "弃三张非储水塔手牌，然后抽两张"),
  ]);
  N("rescuepost", "救援站", 1, [
    a(1, "rescuepost", "收回本回合未入场的己方人员，本回合不能打出同名牌"),
  ]);
  N("ridgetop", "山脊", 1, [a(2, "ridgetop", "本回合双方所有卡牌失去保护")]);
  N("saloon", "酒馆", 1, [
    a(1, "saloon", "双方都有人员时：伤害，然后对方对你造成伤人"),
  ]);
  N("sciencelab", "科学实验室", 0, [
    a(1, "sciencelab", "弃牌堆顶一张，可使用其弃用效果"),
  ]);
  N("warroom", "作战室", 1, [], {
    trait: "己方事件手牌的费用 −1（不影响突袭技能）",
  });
  const pools = {
    classic,
    revised: classic.map((id) => replacements[id] || id),
    complete: [
      ...classic.map((id) => replacements[id] || id),
      ...Object.values(C)
        .filter((c) => c.edition === "chrome")
        .map((c) => c.id),
    ],
  };
  C.raiders = {
    id: "raiders",
    name: "突袭者",
    type: "event",
    delay: 2,
    effect: "raiders",
    text: "对手选择一座自己的营地承受伤害",
    abilities: [],
  };
  C.silo = {
    id: "silo",
    name: "储水塔",
    type: "silo",
    junk: "water",
    abilities: [],
    text: "弃掉以获得 1 水；回到供应区",
  };
  const labels = {
    water: "获得 1 水",
    draw: "抽 1 张牌",
    injure: "伤害未受保护的敌方人员",
    restore: "修复",
    raid: "突袭",
    punk: "获得 1 名朋克",
  };
  const exported = { C, labels, pools };
  if (typeof module !== "undefined") module.exports = exported;
  root.RadCards = exported;
})(globalThis);
