# 规则与数据来源

查阅日期：2026-10-20。以基础版双人合作为实现目标。规则来源与实现范围分开记录；下列链接不表示本项目获得官方授权或已完整实现。

## 官方规则与勘误

- [Greater Than Games：Spirit Island](https://shop.greaterthangames.com/products/spirit-island)：发行商产品与规则书入口。
- [Dized：Spirit Island Rules](https://rules.dized.com/game/zuxKPAGpQWaqnMZgld8YBg/spirit-island)：发行商核验的在线规则，用于回合、战斗、恐惧、成长、能力、范围和胜负流程。
- [设计者 FAQ 与勘误](https://querki.net/raw/darker/spirit-island-faq/All-Errata-and-FAQ-Entries)：初始枯萎额外 +1、连锁可回到先前土地、灵迹移动、重复与时机。
- [Drought FAQ](https://querki.net/raw/darker/spirit-island-faq/Drought)：摧毁城镇与建筑伤害的区别；目标要求在能力开始时检查。
- [Setup FAQ](https://querki.net/raw/darker/spirit-island-faq/Setup)：不同拼接方式影响难度。本项目板间连接为自定义，未宣称复刻官方布局。

## 交叉核对资料（社区整理，并非规则裁定来源）

- [Spirit Island Card Katalog](https://github.com/oberien/spirit-island-card-katalog/blob/master/src/db.ts)：基础能力名称、费用、速度、元素、范围、目标和牌面效果。只提取基础版事实数据，中文机械摘要与引擎自行编写，未打包原卡面美术。
- [bfowle/spirit-island 参考资料](https://github.com/bfowle/spirit-island/tree/main/data)：四块基础岛板、精灵面板、普鲁士对手数据。下载了必要 JSON 核对，未克隆仓库或打包完整资料库。
- [maddinpsy/spiritislandweb](https://github.com/maddinpsy/spiritislandweb)：精灵和岛板元数据交叉核对。

完整覆盖清单、已知差异、启动与测试方式见 `README.md`。运行时全部资源在本目录，不会联网读取上述资料。
