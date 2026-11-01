# 浏览器基础版

直接打开 index.html 或通过静态 HTTP 服务使用，无构建依赖。规则范围、完整玩法和发行商规则链接在页面「规则」弹窗中。仅包含基础游戏，采用原创 CSS 图形。

进度保存在本机 localStorage；新局通过模式选择弹窗确认替换。隐藏信息游戏不会在轮到对手时绘制其手牌。AI 只使用己方手牌和公开信息，不读取对方手牌或未来牌堆／袋中顺序。

## 验证

- 核心规则、边界计分及完整自动对局：`node game/lost_cities/model.test.mjs`
- 浏览器 1280、390、320 像素交互回归：`PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs GAMES_URL=http://127.0.0.1:18769 node game/lost_cities/browser.test.mjs`
- 可通过 `CHROME_PATH` 指定 Chromium 可执行文件。截图保存至 /tmp。

电脑为轻量启发式对手，无难度承诺。尚未在实体手机硬件上测试；浏览器检查覆盖窄屏布局与点击操作，标准按钮支持 Tab/Enter/Space。


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
