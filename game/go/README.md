# 围棋（Go）

纯静态网页，入口 `/game/go/`。HTML、JavaScript、WASM 与模型均随目录提供；不需要 KataGo 服务端、API Key、CDN 或构建步骤。通过 HTTP(S) 访问，不能直接双击 `file://` 页面。与其他游戏共用 `../board_shared/style.css`。

## 功能与规则

- 9、13、19 路快捷选择，以及 5–19 路任意整数路数；白方贴目可调。
- 同屏双人、人机执黑／执白、AI 单步代走；悔棋、重开、自动存档、SGF 导出。
- 提子、自杀禁手、位置全局同形（positional superko）。数子法：活子及围地计面积，白加贴目，不额外计算提子分。
- 双方连续停一手进入数子，点击整块棋子标记／撤销死子，双方确认结果。争议时继续对局；继续对局撤回最后两次停手。
- 人机终局也由用户确认死子。AI 形势图不是终局裁判，不自动移除死子。未处理的死子或未下完的争议会影响结果。
- 悔棋会暂停 AI，防止刚撤销就自动重走。点击「AI 落一手」或重新选择对弈模式可恢复。

## 浏览器内分析

使用 Web-KaTrain 的 MIT 浏览器移植，运行真实 KataGo 神经网络与树搜索。不是官方 KataGo C++ 二进制，不声称搜索结果或棋力与桌面版完全一致。

- 默认 b6：`g170-b6c96-s175395328-d26788732`，3,827,339 字节（约 3.65 MiB）。早期小网络，适合轻量休闲对弈，复杂局面分析有限。
- 可选 b10：`g170e-b10c128-s1141046784-d204142634`，11,138,361 字节（约 10.62 MiB）。按需加载，计算开销更高。
- 可选 b18：`kata1-b18c384nbt-s9996604416-d4316597426`，97,898,094 字节（约 93.36 MiB／98 MB）。强力分析档，按需加载，推荐 WebGPU；WASM 或手机上的计算耗时与内存占用更高。模型许可见 `models/KATAGO-NETWORK-LICENSE.txt`。
- Worker JS 约 1.4 MiB，WASM 运行时合计约 1.2 MiB；浏览器只请求适用的 WASM 文件。打开棋盘不会加载引擎，首次开启分析或人机时才加载。
- 优先 WebGPU；不支持时回退 WASM，再回退 JS CPU。普通静态托管不需要 COOP/COEP：未隔离时 WASM 单线程运行。WebGPU 需要 HTTPS 或 localhost。
- 提供黑／白胜率、黑方视角统一换算的预计目差、十个候选点、候选变化（悬停）、搜索次数与形势估计。候选点和候选行的胜率、目差统一为当前落子方视角；棋盘上三行依次显示胜率、目差、搜索次数。颜色采用 KaTrain 默认损失点数阈值（0.5、1.5、3、6、12）与配色，首选为蓝框。
- AI 分析持续在同一棵树上搜索并推送结果，直到停止或局面改变；AI 落子仍采用 32／100／300 次、约 3／8／20 秒的有限预算。初始化与慢设备的首次计算可能更久，连续 120 秒无响应会报错并释放 Worker。
- 浏览器引擎本地增加 continuous 请求字段和持续搜索循环，移除累计 50,000 visits 限制；每个时间片仍可取消。配色参考 https://github.com/sanderland/katrain/blob/main/katrain/gui/theme.py 。
- 计算在 Worker 内完成。取消请求及局面版本检查防止悔棋、新局和模式切换后应用过期落子；停止按钮直接释放 Worker。
- 所有运行文件同源，测试时无外部网络请求。浏览器按服务器的缓存策略复用文件；未实现离线 Service Worker。

搜索的规则定义通过 `tools/worker-entry.ts` 适配为与棋盘一致的数子法、位置全局同形、禁自杀。完整局面历史传给搜索，用于劫争与神经网络历史特征。

## 验证

从仓库根目录运行：

```sh
node --experimental-default-type=module --test game/go/engine.test.mjs game/onitama/engine.test.mjs game/quarto/engine.test.mjs
python -m http.server 18769 --bind 127.0.0.1
# 另一个终端；需要 Playwright 与 Chrome，可用环境变量指定路径
PLAYWRIGHT_MODULE=/path/to/playwright node game/board_shared/browser.test.cjs
```

浏览器测试使用真实模型：无 COOP/COEP、无 GPU 情况下的自动 WASM 回退；9 路 b6 人机落子、6／13 路 b6、19 路 b10 分析；存档、数子、悔棋、取消、手机布局。另包含上游参考测试，检查与 KataGo 记录的原始神经网络输出一致性、颜色视角、贴目方向、目差与形势关系。

b18 专项浏览器检查：`PLAYWRIGHT_MODULE=/path/to/playwright node game/go/b18.browser.test.cjs`，验证按需加载、19 路真实分析与落子、悔棋及切回 b6，分别覆盖 WASM 和 WebGPU（SwiftShader）路径。

## 重建引擎（仅维护时需要）

```sh
npm ci --prefix game/go/tools
npm run build --prefix game/go/tools
game/go/tools/node_modules/.bin/vitest run --config game/go/tools/vitest.config.mjs
```

打包产物已生成并保存在目录中，部署时直接随网站发布即可。上游来源、固定提交与改动见 `vendor/SOURCES.md`；模型下载来源与校验和见 `models/SOURCES.txt`。

已验证 WebGPU（Chrome SwiftShader 适配器）与无 GPU 时的 WASM 回退。未验证所有实体手机或真实 GPU 驱动；浏览器计算性能依设备而异。
