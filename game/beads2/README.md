# 匈牙利环

直接打开 `index.html`，或在本目录运行 `python3 -m http.server 8080`。

沿任一圆环拖动珠子，整圈随之转动，松手后对齐位置；交点的珠子由两环共享。目标是让每种颜色的全部珠子在某一圆环上连成一段。支持鼠标和触屏，键盘左右键选择圆环、上下键转动。

打乱通过合法转动生成可还原局面；重置回到初始有序局面。横竖屏按钮旋转棋盘布局，不依赖浏览器锁定设备方向。棋盘默认根据窗口方向选择布局，并随可用空间缩放。

样式和规则参考：[Jaap's Puzzle Page — Hungarian Rings](https://www.jaapsch.net/puzzles/rings.htm)，[实物图片](https://www.jaapsch.net/puzzles/images/hungring.jpg)。每环 20 个位置、两个共享交点、38 颗珠子；黄/蓝各 9 颗，红/绿各 10 颗。页面参考 `beads` 的柔和四色、细线轨道和四角灰度按钮，采用无高光、无阴影的平面绘制。
