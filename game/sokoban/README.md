# 推箱子

静态 HTTP 服务打开 `index.html` 即可游玩。只使用 David W. Skinner 的经典关卡精选，共 94 关：Microban 56 关、Microban II 37 关、Sasquatch 1 关，保留原始编号；最少推动次数为 18–68 次。原来的 60 个随机生成练习关卡及其生成器已经删除。

方向键或 W/A/S/D、屏幕方向按钮、点击人物相邻格移动。支持撤销、重开确认、下一关、关卡组选关、放大与自动保存。游戏不需要访问外部题库。

## 题库与来源

[作者页面及署名分发许可](https://www.onlinespiele-sammlung.de/sokoban/sokobangames/skinner/)。原始题库、下载链接与许可说明在 `sources/`。作者允许保留署名后自由分发，游戏规则弹窗中亦保留署名与来源链接。

`import-levels.mjs` 从本地原始题库筛选关卡：地图边长最多 16 格，3–6 个箱子，所有目标与箱子位于人物所在区域；正向 BFS 在 20,000 次状态扩展以内证明可解，且最少需要 18 次推动。组内按最少推动次数排序；推数不等同于人的解题难度。未能在预算内证明可解的题目不收录，不将预算耗尽视为无解。

`classic-levels.mjs` 保存原始地图、关卡编号、合法答案和最少推动次数。地图外围空白填墙以适配正方形棋盘，不改变可达地面与谜题布局。

```sh
node game/sokoban/import-levels.mjs
node game/sokoban/import-levels.mjs --check
node --test game/sokoban/model.test.mjs game/sokoban/classic.test.mjs
GAMES_URL=http://127.0.0.1:18769 node game/sokoban/browser.test.mjs
```

`--check` 重新求解并比较生成文件，不写入。模型测试逐关比对原始地图、回放答案并独立重算最少推数，另覆盖规则边界及存档迁移。浏览器测试覆盖 1280、390、320 像素宽度，每组完整通关、触屏/键盘、撤销、重开、刷新、下一关边界、放大、页面溢出及旧存档迁移。可通过 `PLAYWRIGHT_MODULE` 和 `CHROME_PATH` 指定 Playwright 与 Chrome。

## 存档

新存档键为 `sokoban-v2`，用稳定的关卡 ID（如 `microban-79`）保存，不依赖排列顺序。首次载入会从 `sokoban-v1` 迁移先前 24 个 Microban 关卡的进度；原练习关卡的进度不再载入。旧存储键不主动删除。撤销记录不跨刷新保存。
