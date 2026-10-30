# 材质修复记录

## 对照与原因

以 [官方佩丽卡待机视频](https://web.hycdn.cn/endfield/official-v4/_next/static/media/video/idle.f95544.mp4) 第 1 秒作为视觉参照。它是官网的左右并排 RGB / alpha 视频；只用于对照，没有替换页面中的实时模型。角色模型、动画、贴图的校验值不变。

旧版只将多数材质映射成标准 PBR，忽略了资源内已经存在的色阶、SDF、阴影 LUT、分离法线和眼部专用贴图。多个强方向光进一步加重了鼻子、嘴部的普通几何阴影。旧法线 Y 翻转、普通透明混合的脸部阴影面片，也不符合当前 GLB 数据的用法。

## 实现

- `materials.js`：按原材质族解码；RG 法线重建 Z，保持当前导出切线方向；阴影面片改为乘色，保留毛发卡片的独立 R 遮罩。
- `npr.js`：读取 `_DiffRampMap` / `_SpecRampMap` / `_ShadowLutTex`；脸部 SDF 使用头部相对绑定姿态的朝向与源面部遮罩；头发 RG 与 BA 分别驱动漫反射和高光法线，G 高光遮罩及发丝纹理控制各向异性亮带；虹膜恢复高光遮罩、散射色和 MatCap。服装保留 GGX 反射、打包金属度／光滑度和遮蔽。
- `eye-layer.js`：只在 stencil 标记为头发、且眼部深度更远的像素上绘制眼眉补充层；根据正面视角淡出，避免后脑透出眼睛。
- `outlines.js`：按源材质开关与宽度绘制像素尺度反向轮廓；共享骨骼和形态键，保留 alpha 裁剪。
- `stage.js`：单一主光与柔和环境光；使用 Three.js 的 RoomEnvironment 生成本地反射环境。皮肤、头发和服装的环境响应分别控制，服装与头发接收自身阴影。
- 环境贴图属于整个展示场景，切换角色时不会被角色的资源清理误释放。附加绘制层不投射阴影，也不改变动画轨道名称。

运行时没有新增第三方网络请求。新增着色代码是独立 WebGL 实现；参考了 [Endfield Character Rendering](https://github.com/congyuxiaoyoudao/Endfield_Character_Rendering) 对面部、皮肤、头发、服装的分组与贴图语义，未移植其 Unity 工程。RoomEnvironment 来自 [Three.js r170](https://github.com/mrdoob/three.js/blob/r170/examples/jsm/environments/RoomEnvironment.js)，沿用 `vendor/LICENSE.three`。

## 限制

公开贴图不包含完整官方渲染管线和展示场景的全部灯光／后处理配置。目前的灯光强度、漫反射与高光混合、眼眉层透明度均为网页展示适配，而非声称找回了官方常量。仍未实现完整毛发壳层、屏幕空间边缘光、游戏后处理、复杂动态粒子与布料物理。

## 验证

使用 `scripts/check-rendering.mjs` 对 34 个角色逐一加载、实际编译绘制并检查资源回收。报告与代表性截图见 `rendering/`。修复前后佩丽卡截图使用同一浏览器视口、同一动作、第 1 秒和相同镜头；官方视频的镜头与姿态存在差异，只作材质参考，不能视为逐像素误差测试。

本轮结果：34 个角色形态均通过实际 WebGL 编译与绘制，控制台错误为 0。每次卸载角色后均恢复为 1 个场景几何体、2 张场景共享纹理，没有随角色切换累积。佩丽卡与诀的动作重播、快速切换和 PNG 导出检查通过。详见 `rendering/verification.json`。

## 阴影 LUT 纵向采样修复（2026-10-30）

陈千语、庄方宜等角色的深色服装出现绿色，是因为 1024×32 阴影 LUT 的行方向被读反：导出图像顶行为最大绿色输入，底行为零绿色输入，而原采样公式把零绿色定位在顶行。在 `flipY=false` 的上传约定下，只需对 LUT 的采样 Y 使用 `1 - (g * 31 + 0.5) / 32`。保留原贴图、普通模型 UV、灯光和色调设置不变。

`npm run check:color` 使用实际材质绑定的 LUT，在 GPU 上运行与页面共用的采样函数，对黑、红、绿、蓝、白五个输入与导出图像对应像素进行核对。修复版 20 个样本通过；通过浏览器路由临时恢复旧公式后，黑色输入的预期线性 RGB `[0,0,0]` 变为 `[7,84,6]`，测试能检测到偏绿问题。运行方式与 `check:render` 相同，可设置 `VIEWER_URL`、`PLAYWRIGHT_MODULE`、`CHROME_EXECUTABLE`。

修复后 34 个外观均通过 WebGL 编译和绘制检查，控制台错误为 0，逐次清理后 GPU 资源数量稳定。报告见 `shadow-lut-verification.json`；本地完整 982 段动作及模型、贴图完整性校验通过。
