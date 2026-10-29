# 浏览器引擎来源

- Web-KaTrain：https://github.com/Sir-Teo/web-katrain
- 固定提交：`a6a67d645048a996d606a410c4e4c4b1051ffd43`
- 原始引擎、必要工具模块和参考测试保留在 `katago-src/`，MIT 授权见 `katago-src/LICENSE`。
- 本地测试适配：`test/helpers/engineHarness.ts` 的模型路径指向 `../../../../models/b6.bin.gz`，并使用已安装的 WASM 后端代替 JS CPU。测试断言与参考数据未改动；WASM 避免 JS 长时间运算导致测试进程 RPC 超时。
- 集成入口：`../tools/worker-entry.ts` 将 Chinese 搜索规则改为 positional superko、无让子补偿，与此页面规则一致。
- 构建：esbuild 0.25.12；TensorFlow.js / WASM / WebGPU 后端 4.22.0；pako 2.1.0。精确依赖锁定在 `../tools/package-lock.json`。
- `katago-worker.js` 是本地构建的 ESM Worker，`katago-worker.js.LEGAL.txt` 保留打包器收集的第三方声明。完整 TensorFlow Apache 2.0 和 pako 许可另见同目录文件。
- WASM 文件来自 `@tensorflow/tfjs-backend-wasm@4.22.0/dist/`，未改动。
- KataGo 来源与 MIT 许可： https://github.com/lightvector/KataGo ，`KATAGO-LICENSE.txt`。

未使用上游应用的 React 界面；此目录的搜索实现不是官方 KataGo C++ 引擎。
