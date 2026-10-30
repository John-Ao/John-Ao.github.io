# 黑洞：从场方程到仿真

10 个独立静态 HTML 页面：目录、数学与狭义相对论、微分几何、场方程、Schwarzschild、Kerr、WebGL 光线追踪、合并、GW150914 观测、实现指南。

## 运行

在仓库根目录运行：

```sh
python3 -m http.server 8000
```

打开 <http://localhost:8000/article/blackhole/>。可直接部署到 GitHub Pages；无需构建、npm install、后端或 API key。请通过 HTTP 使用 ES modules 和 JSON 数据读取，直接双击 `file://` 不保证交互可用。

公式字体、KaTeX 0.16.22 和 GW150914 数据均保存在本目录，页面运行不依赖外部 CDN。外部链接仅供查阅参考资料。WebGL 2 不可用时显示说明，正文及二维交互仍可使用。

## 模型边界

- `foundations.js`：洛伦兹变换、质量单位换算、球面平行移动和短时潮汐示意。
- `solutions.js`：Schwarzschild 有效势与零测地线 Binet RK4；Kerr 视界、能层与 ISCO。
- `kerr-renderer.js`：独立编写的 outgoing Kerr–Schild Hamilton RK4 光线追踪。局部相机标架、薄盘圆轨道频移、零约束误差与终止分类；固定背景、有限步长、有限远方截止面。不是 GRMHD 辐射转移模拟。
- `merger-physics.mjs` / `merger.js`：最低阶四极矩旋近 + 明示的人工 Hermite 过渡 + 拟合单模态振铃。不是完整 Einstein PDE 演化，不是参数推断可用的 IMR 模板。质量使用探测器系，残骸质量人为设为总质量的 95%。
- `observations.js`：读取 LIGO 官方 Figure 1 已滤波的双站应变、NR 参考和残差；未伪造噪声、未把教学波形充作观测。普通相关系数不等于匹配滤波 SNR。

各章包含中间推导、变量解释、交互操作、局限、练习解答及原始资料链接。全部正文在 HTML 中，无 JavaScript 时仍可阅读 TeX 原文与说明。

## 验证

Node 20+、Python 3，无额外依赖：

```sh
cd article/blackhole
npm test
npm run check
node scripts/test-raytracing.mjs
```

测试覆盖洛伦兹不变量、球面 holonomy、Kerr–Schild 逆度规/标架、独立差分导数、Schwarzschild 临界阴影、RK4 收敛、ISCO 极限、旋近 chirp 率、过渡连续性、真实数据结构和所有 TeX 的 KaTeX 解析。静态检查核对链接、锚点、重复 ID、画布描述及字体文件。CPU 测试不替代 GPU 验证；浏览器实验提供误差模式供进一步检查。

## 数据复现与来源

```sh
python3 scripts/prepare_gw150914.py
```

该脚本下载 [LIGO-G1600204-v6 的 Figure 1 ZIP](https://dcc-llo.ligo.org/LIGO-G1600204-v6/public)，先校验固定 SHA-256，再转换为 `data/gw150914.json`。11 条曲线保留各自起点和 16384 Hz 采样；应变单位 `10^-21`，只作小数位截舍，不再滤波、拟合或逐条归一化。详细来源、处理边界与时间约定在 JSON 和观测章中。可用 `--archive` 指定已下载 ZIP。

实现思路参考 [kyleyhw/black_hole](https://github.com/kyleyhw/black_hole)，源码核查固定于 `96a6835f2624bc6425682f723a050f397893cb6d`（2026-10-30）。该仓库与任务描述吻合，但历史对话链接未获确认。该仓库未明确提供源码许可证，因此没有复制其源码；教学实现根据公开标准公式独立编写。

第三方依赖 KaTeX 使用 MIT 许可，见 `vendor/KATEX-LICENSE.txt`。LIGO 数据署名与出处保留在 JSON 中；不将其纳入本站原创代码的许可声明。
