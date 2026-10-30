# 绝区零角色菜单复刻资料

本页包含安比、妮可、比利的属性、技能、装备和影画展示。角色转身来自可公开访问的游戏实机录像，不是自行编排的动作。当前交付是录像驱动的静态网页，尚未达到完整 1:1，也不包含可自由旋转的实时 3D 角色。

## 原版动作来源

[Ultraclocked 的菜单展示录像](https://www.youtube.com/watch?v=XKa22KaSxJA)展示角色选择、属性、技能、装备页的原始动作。[Bilibili 公开转载](https://www.bilibili.com/video/BV1NrNWz3EkG/)标注了原作者与原始视频地址，发布于 2025 年 6 月 19 日。发布日期不作为录像所用游戏版本的证明。

从转载的公开 720p 视频取得以下片段。输出保留 1280 × 720、30fps 和正常播放速度；去除音轨，避免录制背景音乐自动播放。没有倒放、生成中间动作、改变骨骼姿态或用 CSS 旋转角色。

| 角色 | 原录像起止秒数 | 本地视频 |
| --- | --- | --- |
| 安比 | 3.500–11.250 | `assets/motion/anby.mp4` |
| 比利 | 41.500–49.900 | `assets/motion/billy.mp4` |
| 妮可 | 158.600–166.300 | `assets/motion/nicole.mp4` |

`data.js` 记录了相对片段时间：每页待机范围及 `stats:skills`、`skills:equipment` 两条转换。`stage.js` 正向播放这些区间，随后循环该页的原始待机画面。改变页面时更新原生 HTML 面板。

原录像没有覆盖三名角色的全部返回方向。技能返回属性、装备返回技能等未收录方向直接跳到目标待机；属性直达装备也直接定位到装备待机。缺失方向不会伪装成已经还原的原版动画。短待机片段循环处可能可见跳帧。后续如取得对应录像，可在转换表增加真实片段；如取得原版骨骼动画和状态机，可替换播放层。

## 查找到但未用于转身的资源

| 来源 | 核验结果 | 未采用的原因 |
| --- | --- | --- |
| [m4urlclo0/ZZZ-Assets](https://github.com/m4urlclo0/ZZZ-Assets) | 安比、妮可、比利 FBX 模型及原始贴图；实际解析三个模型的动画数量均为 0 | 静态模型不能提供原版菜单动作 |
| [oOIEririIOo/ZZZDemo](https://github.com/oOIEririIOo/ZZZDemo/tree/main/Assets/Arts) | 可访问的 Unity 工程，包含安比、妮可的 Idle、TurnBack、Attack、SwitchIn 等战斗动画 | 这些名称不证明它们是菜单转换；未用战斗 TurnBack 冒充菜单转身 |
| [Fandom 菜单动图分类](https://zenless-zone-zero.fandom.com/wiki/Category:Agent_Menu_GIFs) | 下载并检查了三人的 Selection Menu 动图，400 × 450，包含角色选择入场动作 | 分辨率低且没有覆盖完整属性、技能、装备切换 |
| [CGJOY 安比全套动作](https://www.cgjoy.com/thread-279969-1-1.html) | 页面声称包含 91 个 MAX 动作 | 附件有访问条件；没有取得、核验文件 |
| [CGJOY 60 帧动作资源](https://www.cgjoy.com/thread-280040-1-1.html) | 提供公开网盘链接 | 网盘站点被浏览器安全策略拦截，未绕过；不能确认具体文件内容 |
| [AnimeStudio Ultimate](https://github.com/LegionInstaller/AnimeStudioUltimate/tree/ultimate) | 项目文档提供 ZZZ ACL 动画、表情与 Animator 图导出方案 | 是工具，不附带所需游戏原始资源；当前环境无本地游戏资源 |

## 图片和界面依据

- [seriaati/ZZZAssets](https://github.com/seriaati/ZZZAssets)提供角色影画与头像。影画对应 ID 为安比 1011、妮可 1031、比利 1081；头像实际核对后使用 `IconRoleCircle01`、`IconRoleCircle12`、`IconRoleCircle10`，不是按角色 ID 顺序猜测。
- 属性数值、影画名称、效果摘要和技能图标依据 [安比 BWIKI](https://wiki.biligame.com/zzz/安比德玛拉)、[妮可 BWIKI](https://wiki.biligame.com/zzz/妮可德玛拉)、[比利 BWIKI](https://wiki.biligame.com/zzz/比利奇德)。数值展示 Lv. 01 未装备基础值，因此可能与录像中装备加成后的数值不同。
- 动态角色、摄像机、胶片背景保留录像画面。右侧面板、角色选择、页面标签、影画按钮、技能详情为 HTML/CSS，可点击且支持键盘。
- 影画使用原始未解锁、局部、完整三张资源。0 阶使用第一张，1–5 阶使用第二张，6 阶使用第三张；不是游戏内逐块解锁遮罩的完整复现。滑块是网页预览状态，不会改变游戏存档。
- 技能和装备页面提供展示和详情，不模拟升级、背包、装备养成或资源消耗。

图片具体地址见 `assets/sources.json`，视频出处和裁切区间见 `assets/motion/provenance.json`。角色美术和游戏画面归其原权利人；录像作者署名及出处保留在网页资料面板与本文件中。没有以开源代码的许可证替代这些素材本身的权利说明。

## 本地运行

这是无构建依赖的静态页面，资源全部位于当前目录。可从仓库根目录启动 HTTP 服务并访问 `/vitrine/zzz/`，或在本目录运行：

```sh
npm run serve
```

随后访问 `http://localhost:5327/`。如端口被占用，改用 `python3 -m http.server 其他端口`。语法检查为 `npm run check`。

键盘：左右方向键切换角色，1/2/3 切换属性、技能、装备，C 打开影画，Esc 返回；原生按钮也可用 Tab 和 Enter 操作。页面按 16:9 等比缩放，窄屏纵向会留黑边，横屏更适合查看。系统偏好减少动态效果时停止视频播放，切页显示原始静帧。

## 重新制作片段

`scripts/prepare-motion.py` 接受已经取得的原始录像路径，使用 FFmpeg 按上述时间点输出三段无声 MP4 与首帧海报。它不会搜索下载链接、访问网盘或生成角色动画。不要对另一版本或不同剪辑的视频直接复用这些时间点。

## 验证结果

- JavaScript 语法检查通过；三个 MP4 的所有播放区间均在对应媒体时长以内，且只有视频流。
- 浏览器实测原版转换从指定时间开始播放，随后进入目标页待机区间；验证了三名角色切换、连续点选、技能详情、影画 0–6 预览及返回。
- 影画打开时暂停背景视频。浏览器错误及警告日志为空。
- 检查了 390 × 844 窄屏，维持原游戏 16:9 布局与黑边；资料弹窗自适应窄屏。纵屏下游戏面板较小，横屏体验更接近原作。
- 为支持不实现 HTTP Range 的静态服务器，先获取短片 Blob，再在本地完整时间轴上定位；避免部分服务器把 seek 重置到片头。
- 27 项运行时媒体具有出处、字节数和 SHA-256 记录。未使用的无动画 FBX 与 Three.js 依赖未放入最终网页。

桌面预览截图见 `preview.jpg`。

## 2026-10-30：全实装角色与非视频资源扩展

已按 BWIKI 角色图鉴逐页核对实装日期，收录 **61 名**。正式服 3.3 数据包含 62 项，但赛维里安属于尚未开放的第二期，因此不直接把数据表全部当作已实装名单。菲欧妮于 2026-10-21 实装，纳入目录。

- 名单、各角色实装时间：https://wiki.biligame.com/zzz/角色图鉴
- 官方 3.3 公告：https://www.hoyoverse.com/en-us/news/166759
- 正式服版本表：https://static.nanoka.cc/manifest.json
- 正式服角色表：https://static.nanoka.cc/zzz/3.3/character.json
- 数据路径依据：https://github.com/seriaati/hakushin-py/blob/main/hakushin/clients/base.py

### 本地收集结果

61 份头像、61 份角色图、183 份影画（三阶段）、61 份阵营图标，全部本地化。属性与影画名称取自正式服 3.3 数据；技能及影画机制只展示可直接解析的文本，含未解析动态公式或术语的条目引导查看来源，不编造数值。原始 lore 文案没有收录。

`roster.json` 保存角色、实装日期、数值及来源；`assets/coverage.json` 列出逐角色覆盖状态；`assets/collection-sources.json`、`assets/nanoka-sources.json` 记录图片来源。角色表更新时需要再次核对实装日期，不应自动纳入测试服或未来角色。

主界面默认静态图；三名老角色录屏变成用户手动选项。本轮未新增任何视频。没有菜单动画的角色不旋转图片、不倒放、不借用其他角色动作。

### 已验证的真实骨骼动画

公开项目 https://github.com/oOIEririIOo/ZZZDemo 提供 `Assets/Arts/玩家模型/安比/Anbi@Idle.FBX` 和 `Anbi@TurnBack.FBX`：

| 文件 | 源 FBX 动画时长 | 源轨道数 | 内容 |
|---|---:|---:|---|
| Anbi@Idle.FBX | 4.016667 秒 | 437 | 战斗待机 |
| Anbi@TurnBack.FBX | 1.15 秒 | 433 | 战斗转身 |

直接用 Three.js FBXLoader 导入存在空 morph channel、坐标系与蒙皮变形问题。使用 Ubuntu 包提供的 **Assimp 5.2.2** 转换成 glTF 2.0 后，浏览器可正常显示蒙皮角色及动画。转换命令：

```sh
assimp export 'Anbi@Idle.FBX' idle.gltf -fgltf2
assimp export 'Anbi@TurnBack.FBX' turn-back.gltf -fgltf2
```

将 glTF 的 TGA 贴图 URI 映射为同名原始 diffuse WebP，动画时长不变。glTF 的节点/轨道结构会发生格式转换（待机变为 429 条轨道），不是逐字节相同的文件；没有手工设计姿势、转身曲线或补帧。`motion-lab.html` 独立验证，不接入属性页切换。源文件对应的游戏构建版本不能确定，也没有证据证明其是菜单动作。渲染仅为简单材质/光照，并非游戏 toon shader 的复刻。

原始 FBX、转换结果均存于 `assets/models/anby/`；来源、哈希、大小记录于 `assets/models/provenance.json`。

### 其他模型/动作线索与结论

| 来源 | 实际可用内容 | 当前限制 |
|---|---|---|
| https://github.com/m4urlclo0/ZZZ-Assets | 多角色带骨骼 FBX、贴图 | 既有安比、妮可、比利模型解析为 0 个动画，模型不等于动作 |
| https://models.spriters-resource.com/pc_computer/zenlesszonezero/ | 多角色导出模型目录，含较新角色 | 目录有模型不代表包含菜单动画，尚未逐一验证全部包 |
| https://github.com/LegionInstaller/AnimeStudioUltimate | ACL 动画与 Animator Controller 导出工具、ZZZ 文档 | 不提供原始游戏 bundles；Windows 原生导出依赖 |
| https://github.com/orilights/hoyo-files | 官方文件清单和分块下载工具 | 仍需定位资源 bundle 与动画映射，未获取全角色菜单资源 |
| https://github.com/Xitree/Ya/tree/dev/Assets/SourceFiles | Unity 雅战斗项目 | 公开 Animation 目录只有测试控制器/平台动画，不能据此声称取得雅动画 |
| https://github.com/ImLaoBJie/RandomPlayToon | Blender shader/角色配置 | 不包含所需模型、原始动作包 |

**仍未解决：61 名角色全套菜单待机、属性/技能/装备切换的双向动画，以及对应镜头和游戏材质。** 本次完成全角色静态素材与数据覆盖，验证了公开 FBX → glTF → 浏览器骨骼动画的可行路径，不代表完成全角色 1:1 动态复刻。

## 继续查找公开解包资源（2026-10-30）

### 已下载、可复查的新增样本

完整检查 [ZZZDemo](https://github.com/oOIEririIOo/ZZZDemo) 的 Git tree（未截断），固定提交 `cbe73cd434292b7943b820b2aafb243f81650cff`。安比 76、可琳 24、妮可 23、星见雅 69，共 **192 个 FBX / Unity .anim 文件条目**；包含模型和重复导出，不能称为 192 段独立动画。目录中另有其他作品角色，已从清单排除。

`research/extracted-assets.json` 保存逐文件固定版本下载 URL、大小、Git blob SHA。新样本保存在 `research/samples/`，同时记录 SHA-256：

| 样本 | 验证结果 | 限制 |
|---|---|---|
| Corin@Idle.FBX | 1 段动画，2.683333 秒，612 条轨道 | 战斗待机；仅解析，未做浏览器视觉验证 |
| Nostradamus@Idle.FBX | 1 段动画，3.35 秒，664 条轨道 | 妮可战斗待机；仅解析，未做浏览器视觉验证 |
| Avatar_Female_Size02_Unagi_Ani_Idle.anim | Unity AnimationClip，60 Hz，0–4.016667 秒；含骨骼旋转关键帧 | 星见雅动画；尚未与模型绑定、转换和视觉验证 |

这些文件不是视频。但游戏构建版本、是否经过项目作者修改、与现行菜单动作的对应关系尚未核实；不能据此替代菜单动画。文件名搜索也未识别出明确的菜单、装备、展示切换动作，这不等于证明资源里绝对没有。

### 官方原始分块：已完成实际下载校验

通过 [hoyo-files](https://github.com/orilights/hoyo-files) 所用公开版本服务，获取 [3.3.0 文件清单](https://autopatch.amarea.cn/pkg_version/nap/3.3.0/pkg_version) 和 [版本路径表](https://autopatch.amarea.cn/pkg_version/nap_versions.json)。清单托管方为第三方；实际文件下载地址指向官方 `autopatchcn.juequling.com`。

清单共 12,892 个文件，其中 Blocks 下 10,496 个 `.blk`，合计 59,961,939,612 字节。已完整下载 `1000280485.blk`（4,199,145 字节），MD5 `869009996a555c246e2a91c4931e06e5` 与清单相符，头部为 `mhy1`。记录见 `research/official-bundles.json`；原始加密样本仅留本地研究缓存，不作为网页运行资源。

**这证明无需本机安装游戏也有可读取的官方原始资源路径，但尚未解包成功。** 数字文件名不包含动画语义；仍缺菜单动画名对应的 AssetMap，以及模型、Avatar、骨骼与动画依赖 CABMap。未批量下载全部约 60 GB 数据。

[AnimeStudioUltimate](https://github.com/LegionInstaller/AnimeStudioUltimate) 的 `docs/zzz-animations.md` 与 `docs/zzz-animator-controllers.md` 说明了 ACL 动画、面部动画及控制器导出支持。工具自身不附带游戏资源；这里尚未验证其对上述 3.3 分块的实际导出。公开搜索找到的其他 AssetStudio 分支主要提供生成索引的工具，未取得可直接用于此版本的完整索引。

### 其他下载线索的真实状态

- [MMDProMotion 的艾莲动作解包 WIP 帖](https://www.patreon.com/MMDProMotion/posts/free-zenless-wip-108151010) 公开给出 [MEGA 文件夹](https://mega.nz/folder/TRN0EQhJ#4Xtg3Bu47wBNAueUrOWU1Q)。本环境访问 MEGA/API 连接超时，未读到文件列表，不能确认是否仍有效或是否含菜单动作。
- [CGJOY 艾莲动作解包帖](https://www.cgjoy.com/thread-280139-1-1.html) 存在登录及积分下载要求，未取得附件，未验证格式。
- `stickalwwe/zzz-assets`、`mispaints/zzz-assets`、`thegitfather/zzz_assets` 的公开树未发现 FBX、Unity .anim、VMD、PMX、BLK 或 AssetMap/CABMap 文件；`MyDearMoon/ZenlessZoneZero-Dump` 本次未取得有效树，不能据此判断内容。

本轮新增的是公开资源目录、三个动画样本和官方分块下载证据。**全角色菜单动作覆盖仍未完成**，界面未接入未经确认的替代动作，也没有新增视频。

## 官方 3.3 分块解包与三角色实时验证（2026-10-30，后续探索）

### 新进展：实际解包，而非仅下载文件

依据 [AnimeStudioUltimate 的 MhyFile 实现](https://github.com/LegionInstaller/AnimeStudioUltimate/blob/ultimate/AnimeStudio/MhyFile.cs)，使用 Python、PyCryptodome 与 pyooz 在 Linux 上验证了 `mhy1` 容器解码。包含 `mhynewec` 签名检查、长度检查和容器迭代；一个 `.blk` 会串接多个容器。Oodle 数据既可能以 `8c` 开始，也可能以 `cc` 开始，后者不能误当成 LZ4。

此前的 `1000280485.blk` 已完整解出 **647 个 CAB 文件**，其对象均为剧情 `SequenceClipBakeData` 相关资源，未包含目标菜单动画。目录和对象记录见 `research/official-sample-containers.json`、`research/official-sample-index.json`。

随后固定随机种子 330，从 100 KB–1.5 MB 档抽取 20 个分块，从 1.5–8 MB 档抽取 12 个分块，共下载 **68,830,136 字节**。全部 32 个样本最终完成容器解码和对象表索引，MD5 与版本清单一致。它们只占完整资源的一小部分，不能代表全角色覆盖。索引、来源、MD5 和对象类型统计见 `research/official-animation-index.json`。

### 找到了正式服角色 AnimationClip 和控制器

32 个抽样分块共识别出 **42 个 AnimationClip 对象、1 个 AnimatorController**。其中 `2646313046.blk` 含有：

- 波可娜（Pulchra）的 **23 个 AnimationClip**，例如 `Avatar_Female_Size03_Pulchra_Ani_MainCity_Idle01_Loop`、`...MainCity_Run_TurnBack`，以及 Galgame Facial Blink 系列。
- `Avatar_Female_Size03_Pulchra_Controller_MainCity` 控制器。
- `Avatar_Female_Size03_Pulchra_LOD3` 网格、一个 SkinnedMeshRenderer、材质、骨骼/场景节点及布料数据。

**不能把 MainCity 的跑步转身称为菜单属性页转身。** 当前完成的是资源解包、对象类型和名称定位；还没有解码这些 AnimationClip 的 ACL 关键帧，没有验证控制器状态机，也没有将该 LOD3 网格与动作完整导出到浏览器。其他抽样动画主要为主城 NPC 动作。

原始 3.3 分块（4,196,333 字节）已保存为 `research/samples/pulchra-3.3-original.blk`，来源与 SHA-256 在索引中。`research/pulchra-object-index.json` 保存对象 pathId、类型、名称、大小、Unity 版本和外部依赖路径，为后续寻找缺失 CAB 提供依据。

### 可复现脚本与限制

研究脚本不参与网页运行：

```sh
python3 -m venv /tmp/zzz-decode-env
/tmp/zzz-decode-env/bin/pip install pycryptodome pyooz lz4 UnityPy
/tmp/zzz-decode-env/bin/python vitrine/zzz/research/decode-mhy1.py \
  vitrine/zzz/research/samples/pulchra-3.3-original.blk /tmp/zzz-pulchra-cabs
/tmp/zzz-decode-env/bin/python vitrine/zzz/research/index-cabs.py \
  /tmp/zzz-pulchra-cabs /tmp/zzz-pulchra-index.json
```

已用保存到仓库的脚本重新解包验证：**29 个容器，45 个 CAB/关联资源文件，23 个动画和 1 个控制器**。脚本仅为针对这些样本的实验实现，不保证处理所有版本或所有压缩格式。移植所依据的上游 C# 源码和 MIT 许可保存在 `research/decoder-source/`。pyooz 为单独安装的 GPL 依赖，不打包到网页。

UnityPy 对部分修改过的游戏类型执行完整 `read()` 时曾触发原生进程崩溃。因此最终索引器只读取对象表、外部依赖和已知的名称字段，不对 Texture2D、AnimationClip 等执行完整类型反序列化。该绕行方式不等于已经解决动画结构和 ACL 解码。

### 网页完善

`motion-lab.html` 已从单角色扩展为安比、可琳、妮可三角色，使用公开工程的实际 FBX 动画和原始 diffuse 贴图：

- 可琳：2.683 秒，转换后 612 条动画轨道。
- 妮可：3.350 秒，转换后 660 条轨道（源 FBX 664 条，格式转换带来结构变化）。
- 安比：保留待机和战斗转身，两段动画不变。

可琳和妮可没有已验证的转身片段，因此选择这两人时禁用转身选项。三角色切换、加载完成、贴图、模型形态已在浏览器检查；未见加载错误。截图为 `preview-motion-corin.png`、`preview-motion-nicole.png`。简单光照和材质仍不等于游戏渲染效果。

资源校验扩展为 4 个骨骼动画的 buffer、贴图及来源 SHA-256，`npm --prefix vitrine/zzz run check` 已通过，既有 61 角色、366 张静态图片校验也通过。

**剩余重点：定位真正的角色菜单控制器和双向切换动画，导出官方 ACL 关键帧，补全模型/Avatar/材质依赖，之后才接入属性页切换。**

## 角色渲染改进（2026-10-30）

### 依据与原始数据

此前实时验证页使用 glTF 默认材质、半球光和方向光，只有 diffuse 颜色贴图，产生通用 PBR 的灰暗面部与塑料质感。本轮为安比、可琳、妮可补齐 **40 个原始纹理/材质文件**，固定来源提交、逐文件 SHA-256 和大小见 `assets/models/shading-sources.json`。来源为 [m4urlclo0/ZZZ-Assets](https://github.com/m4urlclo0/ZZZ-Assets) 中对应角色目录，含 `MAT_*_UI.json`、`*_M`、`*_N`、`Famale_Face_lightmap` 与 MatCap；妮可身体使用与现有 CN diffuse 对应的 `_M_CN` / `_N_CN`。

通道用途对照 [HoyoToon ZZZ shader](https://github.com/Hoyotoon/HoyoToon/blob/main/Shaders/ZenlessZoneZero/HoyoToonZenlessZoneZero.shader) 及其 [着色程序](https://github.com/Hoyotoon/HoyoToon/blob/main/Shaders/ZenlessZoneZero/Include/zzz-program.hlsl)、[公共函数](https://github.com/Hoyotoon/HoyoToon/blob/main/Shaders/ZenlessZoneZero/Include/zzz-common.hlsl) 核实。HoyoToon 是社区重建，不是官方源代码。

- N 图 RG 为压缩切线法线；B 为作者绘制的漫反射阴影偏置，不能直接当法线 Z。旧版 N.A 用于光滑度。
- M.R 分为五个材质区域，M.G 为金属蒙版，M.B 为高光蒙版；这些旧版资源的 M.A 用于发光。
- Face lightmap 的 R 为面部阴影数据；阴影选择随头部骨骼与光源方向变化，不能只靠面部网格的 N·L。
- 数据纹理保持原始 PNG 和线性采样；diffuse 采用 sRGB 解码。没有 AI 生成或手绘替代纹理。

### 已实现

新增 `toon-material.js`，由 `motion-lab.js` 调用：

1. 按 UI 材质的五组 Shadow/Shallow/Specular/Outline 颜色区分皮肤、衣料、金属和头发，加入分层卡通阴影。
2. 使用 RG 法线与屏幕导数重建切线框架，保留模型 UV 接缝及原始骨骼动画。
3. 面部采用随头部朝向变化的 SDF 阴影；2048² 深度图与 3×3 PCF 近似角色自身投影，包含刘海到脸部的投影。
4. 逆壳描边与原角色共享骨骼和 morph 权重。只对描边方向做位置焊接平滑，不改动画关键帧、网格位置或表面着色法线；线宽按屏幕像素计算。
5. 材质蒙版控制头发高光、金属 MatCap、轻微轮廓光和武器发光。描边颜色做 sRGB 到线性转换，避免出现发灰的亮边。
6. 加入原基础材质/角色材质对照、暂停、重播和全身/半身视角。可在同一姿势比较效果，不借助视频或替换动作。

### 验证与复刻边界

安比、可琳、妮可已在浏览器检查；安比转身也使用相同材质流程。编译及加载未发现 WebGL 错误。`npm --prefix vitrine/zzz run check` 覆盖新增模块语法、40 份数据的哈希和 PNG 文件头、材质必要颜色字段，以及既有模型和全角色静态素材。

`preview-toon-nicole.png` 与 `preview-basic-nicole.png` 是同一姿势、同一镜头的新旧渲染截图；用于比较本次改动，并非与官方画面的像素级对照。

**这是基于真实材质数据的 WebGL 重建，不能称为 1:1 官方渲染。** 主光方向、阴影阈值、屏幕描边宽度、MatCap 混合和轮廓光强度仍为近似调校。现有 FBX 转换缺少游戏 shader 所需的部分顶点颜色、UV2/材质位标记；眼部与头发 stencil/透明遮挡、完整面部高光、官方后处理 LUT、原生屏幕空间轮廓光和材质全部分支尚未复原。资源对应的游戏构建版本也未得到完整核实。主角色菜单仍未接入战斗动作；本轮改进作用于已有三角色的实时 3D 验证页。

### 材质与动作观察细化（2026-10-30）

- 高光使用原始材质的 `_HighlightShape`、`_ShapeSoftness` 和 `_Glossiness`，结合 M 贴图蓝通道控制形状；轮廓光按明暗区混合原始 `_RimGlowLightColor` / `_RimGlowShadowColor`。这是对公开社区 shader 逻辑的 WebGL 适配，仍非完整官方渲染管线。
- 镜头可跟随 `Bip001` 的原始位移，可关闭；支持拖动环绕、滚轮缩放、方向键和复位。没有修改动画轨道、姿势或角色位移。
- 增加可拖动时间轴，拖动后暂停，支持准确观察首末帧；重新播放会解除暂停。暂停且视图不变时跳过重复绘制，页面隐藏时跳过渲染。
- 浏览器验证：安比待机首末帧、转身末帧、重播；可琳半身与键盘环绕；妮可半身及镜头复位，控制台无 error。截图：`preview-material-refinement.png`。
- 现阶段实时三维仍只有安比、可琳、妮可，采用已取得的原始战斗动作；不能视为全角色菜单动作或完整 1:1 复刻。

### 全角色选择与主界面模型接入（2026-10-30）

选择界面参照[玩家上传的游戏内“选择代理人”截图](https://forum.gamer.com.tw/Co.php?bsn=74860&sn=23117)，还原黑色圆角卡框、左上评级、底部等级栏、卡外姓名与黄色选中状态。为 61 名角色增加搜索、属性 / 特性 / 阵营组合筛选、空结果重置和顶部快速切换。评级目前用文本排版，属性 / 特性为文字标识，尚非官方图标的逐像素复刻。等级固定 Lv.01，对应本站基础属性展示，不代表玩家账号。

安比、可琳、妮可的既有骨骼模型可在主角色页启用，沿用原始战斗待机与材质渲染；其余角色继续使用独立官方立绘及影画。没有新增或假称全角色三维动画。模型选择通过白名单参数传入独立渲染页。浏览器验证了组合筛选、空结果、可琳 / 妮可模型映射、希格莉德影画、切换同步，未见控制台错误。选择页截图 `preview-agent-selection.png`。

## 本轮补充：17 个骨骼模型、10 段原始动画（2026-10-30）

角色目录仍为 61 位；三维资源未达到全角色覆盖。`assets/models/catalog.json` 是运行时目录，`assets/coverage.json` 逐角色记录缺口，选人窗口可筛选有模型、有动画和待补充模型。

- 安比、可琳、妮可：各含 Idle、Idle_AFK、TurnBack；新增 5 段来自 ZZZDemo 的原始 FBX 动作。属于战斗动作，不是菜单属性切换动作。
- 星见雅：新增模型与 Unity Idle 曲线，4.016667 秒、660 条 transform 通道。`scripts/convert-unity-animation.py` 保留关键帧时间、数值及切线，以 CUBICSPLINE 输出并转换坐标系。40 条面部 blendshape 曲线尚未映射；7 条 RootT/RootQ 浮点曲线未重复导入。
- 新增 13 个仅模型角色：苍角、露西、11号、凯撒、朱鸢、安东、本、比利、莱特、莱卡恩、格莉丝、珂蕾妲、猫又。保留原骨骼及绑定姿势，没有补造待机动作；部分独立武器/饰件仍处于源文件未装配位置。

来源固定为 [ZZZDemo](https://github.com/oOIEririIOo/ZZZDemo/tree/cbe73cd434292b7943b820b2aafb243f81650cff/Assets) 与 [ZZZ-Assets](https://github.com/m4urlclo0/ZZZ-Assets/tree/426db7a2f54c1af1e7b39b14199f89e8f12e48e9/Assets/Characters)。后者是较早期模型合集，不能代表当前版本完整资源。内部代号使用 [角色 ID 对照](https://github.com/donutman07/Zenless-Zone-Zero-ZZZ-Character-IDs) 辅助确认；未把 Lucia 早期原型误认成当前露西娅。所有下载与转换资产记录在 provenance.json 中，包含来源、体积和 SHA-256。

### 转换与已知限制

旧 Assimp 对部分静态 FBX 丢失多材质网格，13 个新增静态模型改用 Three.js r170 FBXLoader + GLTFExporter（`scripts/convert-static-rig.mjs`）。保留几何及骨骼，转换 UV 的 V 方向；源 FBX 缺失材质分组时使用同一原始漫反射图覆盖网格。新增模型当前使用基础材质，虽然已下载对应遮罩/法线等资料，尚未实现各角色的完整官方着色。

星见雅源 FBX 部分武器 cluster 缺少权重。`scripts/repair-miyabi-bindings.py` 按同项目原 Prefab 中的 rootBone 做刚性绑定兜底，并排除 Prefab 原本禁用的 PET 与 Weapon03。此举不是恢复丢失的官方蒙皮权重；具体范围见 `miyabi/binding-repair.json`。转换顺序为原 FBX 导出 glTF → Unity 曲线转换 → binding repair → 贴图 URI 指向 WebP。原始 FBX、Prefab 和动画文件保留，可继续修复。

验证：检查 17 个目录与角色映射、10 段动画的通道和采样器、缓冲区长度和视图边界、贴图路径、391 条来源资产哈希及原有 40 条材质资料哈希。浏览器逐角色检查新增模型；动作支持暂停、时间轴与重播。验证不代表官方渲染、面部动画或菜单动作已完整复刻。

## 发布范围：仅安比与妮可

`roster.json` 和 `assets/models/catalog.json` 为可提交的双角色名单。完整名单及覆盖/来源记录保存在同目录的 `*.local.json`，由 `.gitignore` 排除；所有其他角色模型和图片、原始 FBX、研究样本、预览截图仍保留在本地。

通过 localhost、回环地址或私有局域网 IP 访问时，页面优先读取完整本地名单；公共域名仅读取发布名单，不请求本地清单。地址追加 `?published=1` 可以在本地验证双角色版本，模型 iframe 同步使用该模式。完整本地名单不在新克隆中，需另行保留与备份，不能用 `git clean -fdX` 清理这些资源。

更新本地清单后运行 `npm --prefix vitrine/zzz run prepare:publication` 重新生成发布 JSON 和资源白名单。脚本以现有 `.local.json` 为完整来源，不会覆盖或删除它们。新增角色资源应更新本地名单。`npm --prefix vitrine/zzz run check` 验证发布资源与 Git 忽略结果，`npm --prefix vitrine/zzz run check:local` 验证本地完整版。

部署应从 Git 提交检出构建；直接复制整个工作目录不会应用 `.gitignore`。本次仅配置文件范围，未执行提交、推送或线上部署。
