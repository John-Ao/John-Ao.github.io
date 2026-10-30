# Sky Team

双人同屏触控合作游戏。用浏览器打开 `index.html` 即可，离线可玩，无安装、构建或外部依赖。也可在本目录运行 `python3 -m http.server 8080`，用平板访问电脑的局域网地址。两人轮流使用同一设备，不支持两台设备联网同步。

## 内容

- 35 个预设：本体 21 个场景（2023 版）和官方 Print & Play 的 14 个场景；按难度选择并记录通关。
- 基础落地流程、航路转弯、交通骰、燃油、漏油、实习生、风向、逆风、冰面刹车、实时 60 秒、系统警报、湍流、低能见度、静默、无动力滑翔、起落架卡死。
- 六种特殊能力，包括双方换骰、提前放骰、翻面与同步额外行动。
- 自定义航路、飞机、交通骰、转弯要求、故障、静默、逐高度天气、重掷补给与模块组合。
- 私人手牌交接、咖啡调点、双方重掷、合法操作提示、判负原因、操作记录及本地自动存档。

## 操作

选择航班和规定数量的特殊能力。简报结束后掷骰，拿到设备的人点击确认查看自己的骰子。点击骰子，再点亮起的操作格；落骰后自动遮屏交给另一位玩家。实习生和同步能力产生的额外行动也会提示交接。

放置阶段按原作要求保持安静，另一位玩家查看手牌时请移开视线。可随时隐藏手牌，切出页面也会自动隐藏。实时模块从掷骰起计时，打开规则、交接、切出页面及刷新均不暂停。咖啡可逐点加减；重掷由双方各自秘密选择。

存档和通关记录保存在当前浏览器。不要同时用多个标签页操作同一局。自定义场景不计入官方通关记录。

## 覆盖边界

已实现上述本体与 Turbulence 扩展机制，但不是全部官方出版物的完整数字移植。Turbulence 专属机场板面及 A–D 高度轨、Ready to Play 的组合场景尚未完整预设；可通过自定义编辑器手工配置。羽田使用明确标注的 2023 版，尚未替换为后续平衡调整板。免费场景与扩展的同名机场可能有不同航路。

界面采用原创 HTML/CSS，没有复制原作图像。用于规则演练，非官方产品。

## 规则与数据来源

查阅日期：2026-10-20。网页内“规则”也提供链接。

- [出版商游戏页](https://www.scorpionmasque.com/en/sky-team)
- [Landing Procedure 基础规则](https://www.scorpionmasque.com/sites/scorpionmasque.com/files/st_rules01_en_06jun2023.pdf)
- [Flight Log 本体模块与场景](https://www.scorpionmasque.com/sites/scorpionmasque.com/files/st_rules02_en_06jun2023.pdf)
- [Turbulence 扩展规则](https://www.scorpionmasque.com/sites/scorpionmasque.com/files/st-ex_rules_en_21aug2024.pdf)
- [官方免费 Print & Play 场景板](https://www.scorpionmasque.com/Skyteam/documents/ST_Print%26Play_EN.pdf)
- [Dized 交互规则](https://rules.dized.com/game/HPLDQm89RB-4e9yi2MQQGw/sky-team)
- [公开板面图像镜像](https://github.com/Zehaa04/skyteam-boardgame/tree/HEAD/assets/skins)：用于核对本体航路、风向刻度与高度轨；未在网页中嵌入这些素材。

## 验证

运行 `node test.cjs`。32 项规则测试覆盖预设配置、基本落地、碰撞、轴线、燃油、天气、风向、实习生、冰刹、警报、特殊能力、计时与滑翔等边界。另检查了浏览器内的场景选择、隐私交接与额外行动。

文件：`scenarios.js` 场景数据，`engine.js` 独立规则引擎，`app.js` 驾驶舱交互，`setup.js` 配置编辑器，`style.css` 响应式触屏样式。
