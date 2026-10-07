# 钢琴静态网页

本目录已可直接部署，无需 Node.js、构建工具或后端。

```text
index.html   页面入口
assets/      当前使用的 JavaScript 和 CSS
sounds/      10 种本地音色及 ATTRIBUTION.txt 授权说明
README.md    部署说明
```

## 本地预览

在本目录的上一级执行：

```sh
python -m http.server --bind 127.0.0.1 --directory music_keyboard
```

访问 http://127.0.0.1:8000/ 。

## 挂载到网站

将 index.html、assets/、sounds/ 保持目录结构一起上传，例如放到网站的 `/music_keyboard/` 下，访问 `/music_keyboard/`（保留末尾斜杠）。所有资源使用相对路径，运行时不依赖外部服务。服务器应正常提供 `.js` 为 JavaScript、`.css` 为 CSS、`.json` 为 JSON，并优先返回实际静态文件。

若嵌入现有页面，可使用：

```html
<iframe src="/music_keyboard/" title="钢琴" allow="autoplay" style="width:100%;height:850px;border:0"></iframe>
```

嵌入时先点击钢琴区域，键盘事件才能进入 iframe；首次演奏自动启用声音。

保留 sounds/ATTRIBUTION.txt 和页面中的音源授权入口。主题和布局偏好保存在访问者本机浏览器。

这是编译后的发布版本。开发源码已另行归档，不需要上传到网站。
