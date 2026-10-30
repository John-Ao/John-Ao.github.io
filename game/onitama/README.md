# Onitama

纯静态同屏双人游戏，入口 `/game/onitama/`；与其他新棋类共用 `../board_shared/style.css`。

实现基础版全部 16 张走法牌、印记决定先手、红蓝相对方向、跳跃移动、吃子、交换牌、吃师父／师父占领对方寺庙获胜。仅当全部己方棋子都无合法移动时允许停步换牌。支持悔棋、同牌局重玩、随机新牌局、棋盘翻转、本地自动存档和双方议和。没有人机与跨设备联机。

棋子和走法图均为本项目的 CSS／SVG 绘制，牌面图案随棋盘方向一起旋转；边框颜色表示先手印记。默认蓝方在下、红方在上。

规则：https://www.arcanewonders.com/wp-content/uploads/2021/05/Onitama-Rulebook.pdf

测试：`node --experimental-default-type=module --test game/onitama/engine.test.mjs`。浏览器交互测试见 `../board_shared/browser.test.cjs`。
