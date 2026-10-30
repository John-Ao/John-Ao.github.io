# 数回

直接用静态 HTTP 服务打开 `index.html`。104 个固定关卡：原 8 题保持名称、线索、答案和索引不变；新增 4×4、5×5、6×6 各 32 题。题组选择器按原精选与尺寸分组，每组内独立选关。数字表示周围线数，空白格不限制线数。判胜同时检查线索、顶点度数与单闭环连通性。

支持画线 / 标叉 / 清空、撤销、重开确认、规则弹窗、键盘操作和逐关自动保存。沿用 `slitherlink-v1` 及数字关卡键，旧存档保持兼容。撤销记录不跨刷新保留。

## 离线生成与验证

```sh
node game/slitherlink/generate.mjs
node game/slitherlink/generate.mjs --check
node --test game/slitherlink/model.test.mjs
GAMES_URL=http://127.0.0.1:18769 node game/slitherlink/browser.test.mjs
```

生成器使用固定种子 `0x534c2026`，随机增长格子区域，每次增长都检查区域边界是否为单个无分叉闭环，拒绝孔洞和对角接触。根据环计算完整线索，然后以固定随机顺序尝试删除线索。每次删除均用约束传播及完整边赋值搜索判唯一；最终再次验证。新增题至少省略 20% 的线索。算法不保证线索数最小，也不将尺寸直接当作推理难度评级。

`enumerateSolutions` 返回 `count`、`nodes`、`exhausted`。每次生成验证最多搜索 12,000 个节点，只有 `count === 1 && !exhausted` 才能保留删减；找到一个解后预算耗尽也不能认定唯一。传播约束包括数字线数、顶点度数及已闭合分量检查，枚举排除多闭环。`countSolutions` 保留原 API，使用无节点上限的枚举。

所有新旧答案在八种旋转 / 镜像变换下取规范形式去重，同一环换线索也不会作为新题。静态 `generated-levels.mjs` 随源码分发，浏览器不运行生成器。`--check` 重新生成并逐字节比较静态数据，不写文件。原 8 题通过 SHA-256 快照保护，测试还覆盖全题唯一性、连通性、对称去重、空白线索和预算耗尽边界。

浏览器测试支持 `PLAYWRIGHT_MODULE`（Playwright 模块路径）和 `CHROME_PATH`。默认使用 `playwright` 包与 `/usr/bin/google-chrome`。测试桌面 1280×850 与手机 390×844、320×844，包含触屏、键盘、撤销、原存档、题组切换、三个尺寸、空线索渲染、重开、规则、4×4 / 6×6 新题完整通关与横向溢出检查。截图输出 `/tmp/slitherlink-{4,5,6}-{mobile,small,desktop}.png`。
