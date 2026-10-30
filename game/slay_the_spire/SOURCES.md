# 来源与还原记录

核对日期：2026-10-20。规则以桌游为准，未使用电子游戏数值表。

## 官方依据

- [官方发行商提供的规则书 v2.30](https://cdn.svc.asmodee.net/production-asmodeeca/uploads/2025/12/Slay_the_Spire_-_Rulebook_v2.30_Reprint_Web.pdf)
- [Contention Games 官方规则书](https://contentiongames.com/_images/STS_KS_Rulebook.pdf)
- [官方桌游介绍](https://contentiongames.com/games/slay/)

第 7–8 页：能量上限、牌型、有限奖励牌堆、金券、药水上限、交易、升级/移除/变化。

第 9–13 页：地图节点、营火、商店、首次遭遇、每人一行、精英/召唤布置、首领在所有行、共享回合、抽弃牌、骰子、结算顺序、即时战斗结束与全队失败。

第 14–17、24 页：多段攻击、一行群攻、模式、力量、中毒、小刀、保留、虚无、晕眩、状态、虚弱/易伤抵消与标记上限。

已目视核对第 5 页地图/静默猎手版面、第 11 页精英和首领布置。第 11 页地精大块头牌面明确列出 14/28/42/56 生命，双人采用 28；哨卫说明召唤至每位玩家对应 3 个敌人。

## 具体内容数据参考

[LuaViper / StSBoardGameMod](https://github.com/LuaViper/StSBoardGameMod) 是 MIT 许可的社区桌游改编项目，**不是官方卡牌数据库**。本版重新实现 JavaScript 游戏逻辑，参考其数值、升级效果、敌人行为和地图拓扑。地图数据按其 `BGExordium.java` 转录，许可证保留在 `THIRD_PARTY_LICENSES.txt`。

| 内容 | 参考位置 |
| --- | --- |
| 铁甲战士卡牌 | `src/main/java/BoardGame/cards/BGRed/` 各同名卡牌及其 `upgrade()` |
| 静默猎手卡牌 | `src/main/java/BoardGame/cards/BGGreen/` 各同名卡牌及其 `upgrade()` |
| 初始生命、牌组、金币 | `characters/BGIronclad.java`、`characters/BGSilent.java`、`neow/BGNeowEvent.java` |
| 首次/普通遭遇组合 | `BoardGame.java` 中各遭遇注册和 `dungeons/BGExordium.java` |
| 遭遇金币与物品奖励 | `monsters/MonsterGroupRewardsList.java` |
| 怪物、首领、精英行为 | `monsters/bgexordium/`，交叉检查 `localization/eng/Bestiary-Monsters.json` |
| 地图与随机标记 | `dungeons/BGExordium.java` 的两套 `quickmap` 与 `connections` |
| 涅奥祝福 | `neow/BGNeowEvent.java` 的祝福组合，`BGNeowReward.java` 的费用与收益 |
| 商店价格 | `cards/AbstractBGCard.java`、`shop/BGShopScreen.java` 和物品 `getPrice()` |
| 遗物与药水 | `relics/`、`potions/` 下各同名定义 |
| 事件 | `events/BGLivingWall.java`、`BGCleric.java`、`BGUpgradeShrine.java`、`BGPurificationShrine.java` |

使用的玩家牌：打击、防御、痛击、生存者、中和、顺劈斩、剑柄打击、铁斩波、燃烧、耸肩无视、重刃、祭品、双重打击、战斗专注、岿然不动、重锤、致命毒药、匕首投掷、斗篷与匕首、后空翻、灵动步法、扫腿、冲刺、肾上腺素、刀刃之舞、杂技、匕首雨、准备、毒刺、死吧死吧死吧。

## 仍需核实或未覆盖

1. 乐加维林、守护者、六火亡魂、史莱姆老大的多人生命按社区单人值乘人数：双人分别为 44、80、72、44。尚未取得对应官方多人牌面逐张核验；不将这些数值标为已官方确认。
2. 只有 30 种玩家牌和部分遭遇/物品/事件；这改变了概率与平衡。普通遭遇缺少两组地精和抢劫者。无第二至第四幕、其余两个角色、升阶、解锁和首领遗物。
3. 药水子集每种放两份，未逐张核对官方药水牌堆的各品种张数。遗物子集每种一份。遗物堆耗尽时跳过，不虚构复制遗物。
4. 召唤同名怪物的骰子行为使用循环随机变体池；未严格实现所有实体召唤牌的物理数量限制。状态牌、金币和通用标记没有完整的全盒总数量限制。规则明确的个人上限与全场 30 中毒已实现。
5. 回合末可自由决定的触发顺序固定为先中毒，再手牌灼伤，再弃牌；开始回合遗物触发也使用固定顺序。未提供完整的任意触发顺序编辑器。
6. 奖励已提前揭示并可查看，但按“选牌 → 药水 → 遗物”的固定顺序领取；未提供任意领取顺序。第一幕首领稀有牌奖励后结束游戏，不继续首领遗物/下一幕。
7. UI 为适配触屏的中文重排，未复用官方插图、Logo、卡面图或官方中文翻译。地图节点连接参考社区转录，第一套地图与官方规则书第 5 页展示结构交叉比对。
8. 当前“结束行动”支持撤回，路线采用双人共识按钮，是数字界面辅助，不是额外桌游规则。没有跨设备联机。

## 相比第一版纠正

移除自定幸运石和回复 3 的统一治疗药水；去除初始赠送药水；不再统一使用敌人“低骰防御、高骰攻击”行为；不再每战统一奖励 2 金币；不再对所有升级机械地加一；不再将中毒衰减或跨所有行群攻混入桌游规则。
