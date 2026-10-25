# Patchwork

经典版 Patchwork 双人同屏触屏游戏。直接打开 `index.html`，无需安装、构建、联网或后端。也可在本目录运行 `python3 -m http.server 8080` 后访问 `http://localhost:8080`。

点选布片，旋转或翻面，点击棋盘预览，再确认放置。点击位置对应布片外框左上角，允许该角本身为空。双人共用一台手机、平板或电脑；没有跨设备联网功能。手机上当前玩家棋盘自动排到最前。所有操作同样支持鼠标及键盘 Tab/Enter。

包含 33 块经典布片、完整环形市场顺序、落后者行动与同格继续、纽扣经济、九次收入、五块皮革补丁、7×7 奖励和终局平分规则。时间轨展开为 0–53；经过标记的事件归到抵达该标记之后的格子。初始标记在 1×2 布片后，玩家 1 固定先手（代替实体规则“最后使用针的人”）。不采用新版重新平衡的布片参数。

自动存档到浏览器 localStorage，刷新可续玩；浏览器禁用存储时页面显示提示。确认放置前不会扣费。撤回一步可撤回已确认的行动或补丁放置；新对局有二次确认。

## 网上规则来源

- [Lookout / Mayfair 经典版英文规则书（2014）](https://cdn.1j1ju.com/medias/74/af/f2-patchwork-rulebook.pdf)
- [Lookout 出版社官方新版规则书](https://www.lookout-spiele.de/upload/en_patchworkre.html_PWNR_Rulebook_EN_web.pdf)
- [经典版布片参数交叉核对：PatchworkSim / PieceDefinition.cs](https://github.com/danzel/PatchworkSim/blob/master/PatchworkSim/PieceDefinition.cs)
- [时间轨位置核对：PatchworkSim / SimulationState.cs](https://github.com/danzel/PatchworkSim/blob/master/PatchworkSim/SimulationState.cs)
- [布片形状与参数第二来源](https://github.com/adrianosmond/patchwork/blob/master/src/constants/pieces.js)

查阅日期：2026-10-19。`pieces.js` 记录组件的形状、成本、时间、收入事实；游戏逻辑、界面、布片图形独立实现，不使用实体游戏美术。Patchwork 游戏设计为 Uwe Rosenberg，出版方为 Lookout Games。本项目为非官方本地实现。

## 文件与检查

- `index.html` / `style.css` / `app.js`：无依赖静态界面。
- `engine.js`：独立规则引擎，兼容浏览器和 Node。
- `pieces.js`：33 块布片数据。
- `test.js`：规则边界和完整对局模拟；运行 `node test.js`。
