# 面对面扫码直连

静态网页共用组件，不调用 Portal 登录或房间 API。双方连接同一 Wi-Fi／热点，在游戏内互扫二维码交换 WebRTC offer/answer 与本地 ICE candidates；`iceServers: []`，没有 STUN、TURN 或服务器信令，也不会自动退回服务器转发。

## 接入

```js
import {pairNearby} from '/portal/nearby/pairing.js';

const room = await pairNearby({gameId: 'tacta'});
if (room) {
  room.on('sync', ({events, seat, seq}) => { /* 校验、重放整个日志 */ });
  room.on('event', event => { /* 校验并应用单条操作 */ });
  room.on('presence', ({joined, online}) => { /* 更新对方状态 */ });
  room.on('status', status => { /* connecting / connected / disconnected / closed */ });
  room.on('error', error => { /* 展示错误 */ });
  room.on('pending', pending => { /* 等待确认时禁用操作 */ });
  room.connect();
  // await room.send(payload); room.reconnect(); room.disconnect();
}
```

`pairNearby` 自带可取消的 dialog、样式与本地 QR 编解码库；取消返回 `null`，数据通道打开后返回 `NearbyRoom`。调用者应先关闭自己的菜单弹窗，再订阅房间事件并调用 `connect()`。不要把此房间 ID 保存为 Portal 的可恢复房间，也不要对它调用 Portal 的邀请、登录或房间管理 API。`room.kind === 'nearby'` 用来选择界面功能；Tacta 的 `network-controller.js` 是完整示例。

房主固定席位 0，对方为 1。房主为两端操作分配序号；可靠、有序的数据通道发送操作、确认和逐条同步日志。`send()` 每端只允许一条未确认操作，重复 ID 去重，过时的 `expectedSeq` 拒绝并同步。游戏规则必须在两端自行校验，组件不提供作弊防护。`reconnect()` 仅尝试在现有通道重新同步；ICE 连接恢复时也会同步，不创建新的 offer 或服务器房间。

二维码携带协议版本、游戏标识、随机房间 ID、10 分钟有效期与 SDP。支持 gzip 压缩和每片 480 字符的分片；1.1 秒轮播，也可手动翻页。接收端支持乱序、重复分片，拒绝混入其他配对批次。开启相机需要用户操作；使用后、取消、超时和重置时释放媒体轨道。没有相机权限时可以导入二维码图片（多片可多选）。二维码仅用于本游戏内配对，不是系统相机可打开的邀请网址。

## 限制与测试

- 页面需 HTTPS 或 localhost。两台手机都要先打开游戏；此功能没有增加 Service Worker，不能保证首次离线打开页面。资源与依赖均同站托管。
- 浏览器本地网络权限、mDNS、访客网络隔离和热点实现会影响直连。失败时提示检查网络，不宣称任意热点都可用。
- 保持页面前台；锁屏／后台可能断连。暂时中断会禁用操作并保留当前局面，可尝试重新同步。刷新、关闭或主动离开后不恢复这次直连，需要重新配对并开始新局。
- 操作确认超时后先同步再判断操作是否已生效，不自动重复落子。房间没有长期持久化或服务器恢复能力。

仓库根目录运行：

```sh
node --test portal/tests/nearby.test.js
node portal/tests/nearby-browser.mjs
```

浏览器测试用两个独立 Chrome 上下文，通过真实二维码图片及模拟相机视频交换 SDP，建立真实 WebRTC 本地候选连接；阻断并记录所有站外请求。覆盖落牌、悔棋、重开、同步、退出、取消、相机权限拒绝、媒体轨道释放及刷新断线。截图输出到 `portal/test-results/`。

上线前还需真机验证 Android ↔ Android、iPhone ↔ iPhone、Android ↔ iPhone，分别覆盖同一路由器及手机热点、相机扫码、网络权限、锁屏返回。自动化结果不能替代这些测试。

## 本地依赖

- `vendor/qrcode.js`：`qrcode-generator@1.4.4` 的 `qrcode.js`，MIT，源码与许可证来自 <https://github.com/kazuhikoarase/qrcode-generator>。
- `vendor/jsQR.js`：`jsqr@1.4.0` 的 `dist/jsQR.js`，Apache-2.0，源码与许可证来自 <https://github.com/cozmo/jsQR>。

文件从对应固定版本的 npm 发布包提取（qrcode 的许可证从上游仓库补充），保留原始源文件及许可证。运行时不访问 CDN。
