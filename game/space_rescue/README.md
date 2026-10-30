# Space Rescue

直接用浏览器打开 `index.html`，无需构建、网络资源或依赖。也可在此目录运行 `python3 -m http.server 8080`，访问 `http://localhost:8080`。触屏设备通过同一局域网访问电脑地址（需放行端口）。这是同一设备上的双人合作，不是跨设备联机。

## 规则依据

查阅日期：2026-10-20。

- [IMAGINARY 的 Space Rescue 规则页](https://imaginary.github.io/space-rescue/)
- [公开仓库与作者说明](https://github.com/IMAGINARY/space-rescue)
- [移动规则实现](https://github.com/IMAGINARY/space-rescue/blob/master/app/Space_mouseup.cs)
- [棋盘与目标位置](https://github.com/IMAGINARY/space-rescue/blob/master/app/Space_init.cs)

该版本注明灵感来自 Hiroshi Yamamoto 的游戏。网上存在其他同名作品，本项目采用 IMAGINARY 棋盘解谜版，不宣称是其他同名桌游的官方复刻。

7×7 棋盘，宇航员停在中央格即获胜。每次移动必须有同一直线上的棋子接应；向四个正交方向滑行，停在最近棋子前一格。边缘不能接应，紧邻棋子会阻挡移动。飞船不阻挡移动，经过目标不算胜利。

## 本网页的改编

玩家一控制宇航员，玩家二控制四枚机器人。无回合限制；多指操作按事件完成先后、依据最新局面结算。60 个原创关卡通过广度优先搜索验证最短步数。原有 1–12 关保持内容与顺序不变，13–60 关按最短 2–9 步分组，每组新增 6 关。双人分工、对坐布局、提示、撤销和自动保存是网页新增功能，不属于来源的正式双人规则。未使用来源的代码或美术素材。

- 触摸棋子并向目标方向滑动，或选中棋子后点各自的方向键。
- WASD 控制宇航员；数字 1–4 选择机器人，方向键移动机器人。
- 对坐模式：玩家二控件旋转，方向按玩家二视角解释；直接在棋盘滑动始终按屏幕方向。
- 当前进度存入浏览器 localStorage；禁用存储时仍可玩，但不会保留进度。
- 提示从当前局面搜索，不执行移动；无解时提示撤销或重置。

运行 `node test.cjs` 验证核心规则、关卡及解法。`generate_levels.py` 可用固定种子重新生成关卡数据。

## 验证记录

- `node test.cjs`：全部核心规则与 60 关最短解验证通过。
- 浏览器实际验证：第一关通关、玩家二机器人操作、撤销、刷新恢复、提示、重置。
- 390×844 视口检查：页面无横向溢出；小屏纵向滚动显示双人控制区。
- 尚未在实体触屏硬件上测试同时多指操作。

## 扩充题库（2026-10-30）

`python3 game/space_rescue/generate_levels.py` 可从仓库根目录或其他工作目录复现。固定种子 20261030，抽样 4906 个候选，追加 48 题；不是枚举全部合法局面。每个候选用 BFS 搜索最短路径，访问预算为 90000 个状态，预算不足则跳过，不将其宣称为无解。机器人位置置换合并；最终题目按棋盘八种旋转／镜像变换及机器人置换去重。宇航员身份保留，棋盘中心固定，因此不做平移等价。

`python3 game/space_rescue/generate_levels.py --check` 在内存重生成并逐字比对现有数据，不写文件。

`legacy_levels.json` 固定保存首 12 题，生成时直接复制，旧存档索引与最佳记录不变。全部 60 题最短步数分布为：2/3/8/9 步各 7 题，4/5/6/7 步各 8 题。最短距离是分层依据，不代表人类解题难度的严格排序。

`node test.cjs` 同时验证旧题未变、全题库同构去重、解法合法及独立 JavaScript BFS 最短距离。浏览器回归：`PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs GAMES_URL=http://127.0.0.1:18769 node browser.test.mjs`；可用 `CHROME_PATH` 指定浏览器。
