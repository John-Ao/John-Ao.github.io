# Radlands

双人同屏、轮流操作的静态网页游戏。无需安装依赖、账号或后端。

## 打开

直接用浏览器打开 `index.html`。也可以在此目录运行：

```sh
python -m http.server 8037
```

然后访问 `http://localhost:8037`。触屏设备可访问该电脑的局域网 IP 加端口，例如 `http://192.168.1.10:8037`（请替换为实际 IP）。本地模式两人共用一台设备；跨设备使用下文的 Portal 联网或面对面扫码配对。

## 操作

- 双方各从六座营地中选三座；先手随机决定。
- 默认对坐模式，上方玩家区域旋转 180°。中间的方向按钮可切换同向模式。
- 当前玩家点击“查看手牌”，点手牌选择打出或弃用；点场上卡牌选择技能。
- 目标、位置、牺牲和弃牌均通过大按钮选择，不要求拖拽、悬停或右键。
- 需要防守方作决定时自动交接，例如突袭、佣兵营、先锋反击等。
- 玩家交接、刷新和切换到后台时隐藏手牌。看到本方手牌仍需对手避看；同屏不能提供物理保密。
- 对局状态自动保存在当前浏览器的 localStorage，刷新后恢复，包括未完成的效果选择。浏览器禁止存储时会提示。清理浏览器数据会删除存档。
- “新对局”会先确认，避免误触覆盖存档。

## 实现与规则版本

参照 Roxley 当前官方规则 v2.1（2026）实现基础玩法及 Cult of Chrome 扩展。共享牌堆含 46 张人员牌（26 种）和 20 张事件牌（10 种）；双方另有储水塔和突袭者。

新对局提供四种配置：

- 完整牌池：34 座修订后营地 + 32 座扩展营地，共 66 座。
- 修订基础版：34 座营地，其中 10 座使用官方替换版本。
- 原版基础版：保留最初 34 座营地能力，核心流程仍采用当前规则。
- 官方入门配置：街机厅、图腾、修订佣兵营，对车库、轨道炮、仓库的固定组合。

扩展规则包括营地前后人员位置、移除废墟后容纳三人、朋克翻面、跨阵营人员移动、死亡后免费发动技能、额外胜利条件、事件费用调整和突袭触发效果。牌池选择不重复加入被替换的营地。旧版存档继续使用原版牌池。

卡牌能力采用中文功能性转述，使用 HTML/CSS 卡面，未使用原版插画。中文名称为本项目译名。“规则 → 查看本局牌表”可查阅所选牌池。

规则来源（获取于 2026-10-20）：

- [Roxley 当前官方规则 PDF](https://roxley.com/radlands-rulebook)，本地副本：`reference/rules.pdf`，包含最新核心规则与扩展 FAQ。
- [Roxley Cult of Chrome 官方介绍](https://roxley.com/products/radlands-cult-of-chrome)：32 座新增营地、10 座替换营地及官方卡牌图片。本地保留 `reference/chrome-official.jpg` 和 `reference/chrome-guillotine-gas.jpg`。
- [设计师的 Field Hospital 规则讨论](https://boardgamegeek.com/thread/3325507/radlands-cult-of-chrome-preview-19-field-hospital)。
- [University of Radlands 的 Power Plant 卡牌解说](https://youtu.be/r1qtVqpXkg4)、[Ridgetop 解说](https://youtu.be/SDmP3O7ijNw)、[Lobotomizer 解说](https://youtu.be/wqauMpZve-I)，辅助核对卡面与互动。
- [实体替换营地照片](https://elvisdontteachyouplayingboardgames.blogspot.com/2025/07/radlands-cult-of-chrome-expansion-review.html)，用于核对费用与初始抽牌数。
- [原版 v1.15 规则](https://gamers-hq.de/media/pdf/75/9b/7d/Radlands_-_Rulebook_-_Booklet_-_v1-15_-_2022-02-14.pdf)及[基础牌表整理](https://www.scribd.com/document/538499212/RADLANDS)，用于旧版兼容比对。

已为全部营地与共享牌编写能力，但未穷举全部卡牌组合，不宣称与实体游戏百分之百一致。模仿者菜单省略递归复制模仿者，可直接选最终技能。降落伞部署会预留最低技能费用，因此极少数依靠入场效果临时获得水的组合可能无法选择。部分扩展数值依据公开卡面图片转录，尚未逐张与实体牌复核。

## 文件

- `index.html` / `style.css` / `app.js`：触屏界面、手牌交接、本地存档。
- `cards.js`：三个牌池的卡牌数据与中文效果。
- `engine.js` / `chrome.js`：不依赖 DOM 的规则引擎、扩展能力与可序列化效果队列。
- `test.cjs` / `test-chrome.cjs`：规则回归测试与随机合法操作模拟。
- `reference/rules.pdf`：本次下载的官方规则，供查阅。

## 验证

```sh
node test.cjs
node test-chrome.cjs
```

测试包含牌数、首回合用水、保护、受伤人员与营地、部署就绪、非当前玩家权限、储水塔、朋克回牌堆、突袭防守方选目标、事件时序、禁止自我修复、维拉额外使用、自毁即时判负、待决选择存档、满场部署、平局、所有技能的可执行性，以及随机对局的卡牌守恒与资源不变量。

新增 38 组扩展测试，覆盖营地位置、翻面、免费复制、立即胜利、事件时序及存档。基础回归包含 120 局固定种子随机模拟，轮换三个牌池。

浏览器验证覆盖双方选营地、手牌显隐、部署、回合交接、刷新恢复，以及平板与手机尺寸的布局。随机模拟不等于所有卡牌组合的规则正确性证明。

本次扩展界面已检查平板布局、选牌、攻击和交接；最终手机及刷新复测因本地预览连接中断未完成。


## 联网与面对面扫码对战

通过 HTTPS 或 localhost 打开页面，点击「联网」：
- 「创建房间」经 Portal 登录后生成邀请链接，对方打开并加入。支持刷新恢复、自动重连、手动同步、重置访客席位及关闭房间。
- 「面对面扫码配对」无需 Portal 登录。两台设备连接同一 Wi-Fi／热点，房主展示二维码，对方扫描后展示应答码，再由房主扫描。也可导入二维码图片。通过 WebRTC 直连，无 STUN/TURN 或服务器中转。

房主为玩家 1，访客为玩家 2；开局使用房主当前玩法配置重新发牌。只有当前行动席位可以操作，秘密手牌／选项不会展示给另一席位。操作须经传输确认后才改变局面。断线、等待确认或协商期间不能行动。

联网菜单支持双方协商悔棋、重开及认输；多局游戏的下一局也需双方同意。悔棋撤回最近一个已确认操作（可能是出牌、抽牌或效果选择中的一步）。返回本地对局会恢复连接前的本地状态，联网状态不会写入本地游戏存档。

面对面连接刷新或关闭页面后不能恢复，需要重新配对开新局；网络隔离、浏览器本地网络权限及锁屏可能阻断直连。尚需实体 Android / iPhone 及手机热点验证。

与 Tacta 一样，共享操作日志可重建完整牌局，按席位隐藏只提供正常界面下的保密，不防开发者工具窥牌，适用于诚信对战。当前原版规则与组件覆盖限制仍见上文。

共用协议与房间界面：`../board_shared/online-protocol.mjs`、`../board_shared/network.mjs`；玩法适配器在 `../board_shared/adapters.mjs`（失落的城市为本目录 `online-adapter.mjs`）。

仓库根目录验证：
```
node --test game/board_shared/online.test.mjs
node portal/tests/boards-nearby-browser.mjs
node portal/tests/boards-portal-browser.mjs
```
