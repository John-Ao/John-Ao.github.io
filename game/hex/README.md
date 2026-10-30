# 六角棋

静态页面，无运行时外部资源。支持 7×7、9×9、11×11、同屏双人及基础人机。红色连上下边，蓝色连左右边；六方向共边连通即获胜。棋盘可放大并内部滚动。

换边采用 [HexWiki 的交换颜色方式](https://www.hexwiki.net/index.php/Swap_rule)：第二位玩家在首子之后可交换玩家与颜色的对应关系；首子的位置、颜色和棋盘目标边不变，原先手随后执蓝落子。界面显示玩家身份及当前持有颜色。

支持撤销、确认新局、自动保存恢复、Tab / 方向键 / Enter / 空格及重绘焦点恢复。AI 检查一步胜负并比较最短连通距离，只作为休闲对手。

```sh
node --test game/hex/model.test.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs GAMES_URL=http://127.0.0.1:18769 node game/hex/browser.test.mjs
```

浏览器测试支持 `CHROME_PATH`，覆盖 1280×800、390×844、320×844、844×390，含键盘落子、换边归属、尺寸、放大、存档、撤销、规则、新局取消、AI 和实际获胜/恢复。模型测试覆盖全部尺寸完整 AI 对局。
