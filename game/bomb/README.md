# Q版泡泡堂静态浏览器移植

统一入口 `/game/bomb/`，在操作区选择版本。URL 的 `version=1/2/3` 保留所选版本，刷新和重开不会跳回初代；切换前可取消以继续当前对局。

- `/game/bomb/?version=1`：Bomb It 初代，中文原版。
- `/game/bomb/?version=2`：Bomb It 2 中文版。
- `/game/bomb/?version=3`：Bomb It 3 升级版（原始资源的界面默认为英文）。

原版 SWF 由仓库内固定版本 Ruffle 0.7.1 的 JavaScript / WebAssembly 运行，不需要 Adobe Flash 插件、浏览器扩展、构建、后端或外部 CDN。此实现是兼容移植，**不是将游戏逻辑重写为 JavaScript**。原画面、地图、AI、音效、单人和同键盘双人模式均来自对应游戏资源。触屏方向键和炸弹键用于单人模式；双人仍需键盘。

在仓库根目录运行 `python3 -m http.server 1886`，访问 `http://localhost:1886/game/bomb/?version=1`，也可直接在页面操作区选择版本。必须通过 HTTP(S) 访问，不能双击 HTML 用 file:// 打开。GitHub Pages 可直接部署这些静态文件；保留整个 `bomb` 目录，WASM 应以 `application/wasm` 提供。

页面附加暂停、静音、全屏、操作说明、确认重开以及触屏控制；切到后台自动暂停。声音在首次用户交互后启用。保留原游戏内菜单，旧网站跳转、在线高分服务及三代需要平台登录解锁的角色不作为本移植的功能。

## 资源与兼容修改

来源 URL、原始与交付文件的 SHA-256 见 `sources.json`。原游戏资源的权利属于原作者/发行方；Ruffle 的 MIT / Apache-2.0 许可证随本地运行时保留。本项目的代码许可不改变第三方游戏资源的许可。

初代资源没有改动。二、三代使用 JPEXS FFDec 26.4.0 替换少量启动适配代码，源文件保存在 `patches/`，游戏规则与关卡没有重写：

- 二代 `documentClass.as`：直接从载入完成进入原版菜单，跳过在 Ruffle 下只显示背景的站点片头；仍执行原版第二帧/第一帧的资源初始化。将片头结束后原来的 1000 fps 改为实际目标 40 fps。
- 二代 `FRateLimiter.as`：去除用 `getTimer()` 空转的忙等待，交由浏览器播放器按 40 fps 调度。
- 三代 `Root.as`：启用原 SDK 已有的 `__SKIP_SPIL_SDK__`，不再初始化旧平台服务和 Google Analytics。
- 三代 `GoogleEvent.as`：将统计初始化与上报改为空操作，避免游戏菜单再次启动远端统计。
- 三代 `SiteInfo.as`：不再等待已失效的网站配置请求，离线完成初始化，不访问宿主页面 ExternalInterface。保留其余本地默认设置与游戏流程。

资源可按以下命令重建（输入原文件先按 `sources.json` 校验；4399 下载需要对应 `sourcePage` 作为 Referer）：

```sh
java -jar /path/to/ffdec.jar -replace /tmp/bomb2-original.swf game/bomb/assets/bomb2.swf documentClass game/bomb/patches/documentClass.as actionSprite.FRateLimiter game/bomb/patches/FRateLimiter.as
java -jar /path/to/ffdec.jar -replace /tmp/bomb3-original.swf game/bomb/assets/bomb3.swf Root game/bomb/patches/Root.as zlong.localization.SiteInfo game/bomb/patches/SiteInfo.as zlong.spilSystemTool.GoogleEvent game/bomb/patches/GoogleEvent.as
```

## 验证

资源一致性：`node --experimental-default-type=module --test game/bomb/assets.test.mjs game/catalog.test.mjs`。
浏览器测试：启动上面的静态服务器后运行 `node game/bomb/browser.test.mjs`。需要 Playwright；可通过 `PLAYWRIGHT_MODULE` 指定其模块路径、`CHROME_PATH` 指定浏览器、`BOMB_URL` 指定站点根 URL。
