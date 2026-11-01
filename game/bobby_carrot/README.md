# Bobby Carrot 网页移植

基于 FDGSoft BobbyCarrot 1.0 原始 JAR：30 关胡萝卜、20 关彩蛋，直接使用原地图、图片和 MIDI。默认进入用户描述的彩蛋模式。详见 [原版来源、核验与适配差异](reference/PROVENANCE.md)。

在仓库根目录运行 `python3 -m http.server 8000`，打开 `/game/bobby_carrot/`。所有运行资源在本目录，无构建步骤、外部 CDN 或服务端依赖；需通过 HTTP 访问。

电脑：方向键、WASD、数字键 2/4/6/8；空格切换全图，R 重玩，Z 撤销。手机：方向按钮（可长按）或在地图上滑动。浏览器本地保存各关进度与完成记录。

规则测试：`node --test game/bobby_carrot/engine.test.mjs`。浏览器测试需安装 Playwright：`node game/bobby_carrot/browser.test.mjs`，默认访问 `http://127.0.0.1:1877/game/bobby_carrot/`，可用 `BOBBY_URL` 覆盖。
