# 终末地角色模型展示

不需要构建或后端的静态网页。HTML、Three.js、角色模型、贴图和动作均在本目录内，运行时不请求第三方资源。

## 运行

在本目录执行 `npm run serve`，访问 `http://127.0.0.1:5338/`，预览本地全部角色。服务直接使用现有资源，只将目录数据映射到被 Git 忽略的 `catalog.local.json` 与 `research/props.local.json`。若没有本地完整数据，则自动使用公开版本。

执行 `npm run serve:public` 可在同一目录预览线上三角色版本；两个服务不能同时使用相同端口，可追加 `-- --port 5339`。普通静态服务器（例如在仓库根目录运行 `python3 -m http.server`）也会显示公开的三角色版本。

请使用 HTTP 服务，不要直接以 `file://` 打开。浏览器需支持 WebGL 2、ES modules、import maps 和 DecompressionStream。

## Git 与 GitHub Pages

无需单独发布目录或构建步骤。`catalog.json` 与 `research/props.json` 只包含洛茜（Rossi）、陈千语（Chen Qianyu）、洁尔佩塔（Gilberta）；`.gitignore` 默认忽略资源文件，再逐项放行所选三位角色的模型、全部已收录动作、头像、道具及依赖贴图。其他角色的文件继续留在本地，不会通过普通 `git add` 提交。本地完整目录数据与调研截图也被忽略。

发布名单在 `publish.json` 中维护。更新名单或相关资源后，在本目录运行：

```sh
npm run prepare:publish
npm run check:public
```

第一条命令直接更新公开目录数据与 `.gitignore` 资源白名单，不复制资源、不创建发布目录，也不删除本地文件。发布仍使用仓库现有路径 `vitrine/endfield/`。不要强制添加被忽略的本地文件；新克隆默认只有这三位角色，本地完整目录数据没有纳入 Git。

`npm run check` 优先校验本地全部 34 个外观；`npm run check:public` 只校验公开版本。同步道具脚本在本地完整数据存在时更新本地道具清单，之后需再次运行 `npm run prepare:publish` 更新公开清单。

## 收录范围

- 截至 **2026-10-30**，1.6 版本的 **33 名已实装干员、34 个外观**。管理员男女分别展示。
- 每个外观有 **26–33 段动作，共 982 段**：日常待机、入场、总览/装备/技能展示、特殊待机、行走/奔跑/冲刺、普攻/技能/终结技、合影/礼物/坐姿/握手等，具体以各角色源文件为准。
- 65 个关联道具模型、274 段道具动画，保留骨骼挂点与显隐时间轴。
- 完整可获取源目录有 11,184 个动作文件（约 8.6 GB 原始数据）。本页面收录上述展示用途的选集，并未宣称包含全部游戏动作。
- 明河于 2026-11-05 开放获取，未提前算作已实装角色。

全部模型网格、骨骼与动画关键帧来自公开游戏资源，没有用程序摆动、替代模型或录屏冒充实时 3D。模型和动画用 gzip **无损封装**；运行时解压后交给 GLTFLoader，不依赖服务器的 Content-Encoding 设置。贴图保留原始 WebP 数据。

## 操作

拖动旋转，滚轮/双指缩放，右键/双指平移。角色可按名称、英文名、属性或职业搜索。动作可以搜索和按类别筛选，支持暂停、进度跳转、倍速和循环。

`←` / `→` 切换角色，`Space` 播放/暂停，`R` 重置镜头，`H` 隐藏/显示界面。手机上通过右下方动作按钮展开动作列表。支持正面、背面、面部镜头、背景色、地面网格、截图和全屏。

URL 的 `character` 与 `clip` 参数保留当前角色和动作，可复制链接分享。切换角色会中止旧请求并释放旧模型和贴图；动作按需加载，当前角色已读取的动作缓存在内存中。

## 还原边界

材质已按部位拆分为混合 NPR/PBR 渲染：读取原始漫反射／高光色阶、阴影颜色 LUT；脸部用随头部旋转的 SDF 与面部遮罩；头发使用 RG/BA 分离法线、发丝遮罩与条带高光；虹膜使用原始高光遮罩与 MatCap。刘海下眼眉通过深度与 stencil 限定的单独绘制层处理，轮廓线与原骨骼、形态键共用姿态。衣物保留金属度、光滑度、法线、遮蔽、自阴影及环境反射。毛发卡片、透明发梢与附带特效遮罩继续使用源资源。

这是根据公开材质数据独立实现的 WebGL 管线，并以官方展示视频校准。光照、环境反射与色调映射仍是展示场景的适配，不能声称与游戏逐像素一致；未复刻原引擎完整后处理、毛发壳层、特效扭曲、动态混合和软粒子。具体实现、对照与验证见 [材质修复记录](research/rendering-notes.md)。

保留原骨骼动作和有资源的关联道具，但没有复刻粒子技能特效、完整战斗装备系统、技能镜头、语音、动态布料/头发物理和游戏场景。因此战斗动作是模型动作预览，不等同于完整战斗演出。

## 来源与复现

- [官方干员列表](https://endfield.hypergryph.com/operator)：中英文名、职业、属性、星级及头像。
- [官方 1.6 版本公告](https://endfield.gryphline.com/en-us/news/9560)：实装日期和明河开放时间。
- [Warfarin Studio](https://studio.warfarin.wiki/)：公开 GLB 模型、原版骨骼动画、材质元数据和道具关系。资源版本固定为 `c0727135872664fd4c33eabd73c925dd`，来源 URL 和 SHA-256 记录在 `research/*-sources.json`。
- [Three.js r170](https://github.com/mrdoob/three.js/tree/r170)：本地运行库及加载器，MIT 许可保存在 `vendor/LICENSE.three`。

`research/official-roster.json` 保存官方名单、核对日期、排除的预告角色和官方展示视频 URL；官方视频只作为调研记录，没有作为本页面 3D 内容使用。`research/animation-catalogs.json` 保留完整原始动作目录，`research/animation-selection.json` 记录当前选集。

重新获取或校验资源：

```sh
python3 scripts/sync-models.py
python3 scripts/sync-clips.py
python3 scripts/sync-props.py
python3 scripts/sync-clips.py --verify
npm run check
```

这些同步脚本仅在开发时使用；网页部署只需静态文件。目前本地资源约 **1.57 GB**，页面按所选角色和动作加载，首轮载入取决于静态服务器带宽。选择托管服务时需核对其站点容量限制。源资源的公开可访问性不等于其版权转让；资源原归属和公开提供方已在页面资料弹窗及上述清单中注明。

## 验证

`npm run check` 检查 34 套模型、982 段动作、599,771 条动画通道，以及模型、骨骼和贴图引用的完整性。`research/browser-qa.json` 记录 34 个角色的真实浏览器加载、默认动作播放、快速切换和显存释放检查；没有将结构校验表述成逐段播放全部动作。

材质回归可用 `npm run check:render`：需另行安装 Playwright 与 Chromium，并先启动本目录的静态服务。它检查全部角色的实际 WebGL 编译、材质贴图绑定、stencil 可用性、清理后 GPU 资源数量，并保存代表性截图。可通过 `VIEWER_URL`、`CHROME_EXECUTABLE`、`PLAYWRIGHT_MODULE`、`RENDER_OUTPUT` 指定服务地址、Chrome 路径、已安装的 Playwright 模块和输出目录；默认输出在系统临时目录，不参与网页运行。

颜色回归检查：`npm run check:color`。它使用真实 GPU 采样核对阴影 LUT 的颜色坐标，防止深色材质因查找表纵向倒置而发绿；环境变量与 `check:render` 相同。
