# 浏览器基础版

直接打开 index.html 或通过静态 HTTP 服务使用，无构建依赖。规则范围、完整玩法和发行商规则链接在页面「规则」弹窗中。仅包含基础游戏，采用原创 CSS 图形。

进度保存在本机 localStorage；新局通过模式选择弹窗确认替换。隐藏信息游戏不会在轮到对手时绘制其手牌。AI 只使用己方手牌和公开信息，不读取对方手牌或未来牌堆／袋中顺序。

## 验证

- 核心规则、边界计分及完整自动对局：`node game/azul/model.test.mjs`
- 浏览器 1280、390、320 像素交互回归：`PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs GAMES_URL=http://127.0.0.1:18769 node game/azul/browser.test.mjs`
- 可通过 `CHROME_PATH` 指定 Chromium 可执行文件。截图保存至 /tmp。

电脑为轻量启发式对手，无难度承诺。尚未在实体手机硬件上测试；浏览器检查覆盖窄屏布局与点击操作，标准按钮支持 Tab/Enter/Space。
