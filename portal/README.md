# Portal：静态前端与 Cloudflare 通信服务

Portal 为同站点游戏提供登录、房间、一次性邀请、WebSocket 消息转发和重连重放。

将其他游戏改造为联网版，参见 [游戏接入与界面设计指南](howto.md)。

**游戏规则仅在浏览器执行。** Worker 和 Durable Objects 不包含 Quoridor 规则，不判断回合、棋步或胜负，也不修改棋盘。服务端只校验身份、房间权限、消息大小和序号。若对方发送非法游戏操作，Quoridor 本地提示并暂停应用后续消息。

## 部署结构

- `index.html`：管理后台。未登录时只展示登录。
- `setup.html`：在浏览器离线派生公钥，导出公开恢复配置。
- `login.html`：游戏统一授权页面。
- `config.js`：公开的 Worker 地址和可选的前端导航目录。
- `sdk/`：登录、邀请、身份存储、WebSocket 与重连。
- `crypto/`、`vendor/`：本地 Argon2id WASM 与 Web Crypto 密钥处理。
- `shared/`：协议与常量。
- `worker/`：单独部署到 Cloudflare 的服务端源码。
- `tests/`：规则协议测试、真实 workerd/SQLite DO 集成测试、Chrome 双端联调。

整个仓库仍可直接部署到 GitHub Pages；浏览器端无需构建，也不依赖第三方 CDN。Worker 源码在 Pages 上仅是静态文件，需要另行部署。开发依赖 `node_modules`、本地配置 `.dev.vars`、模拟器数据及测试截图不应进入 Pages 发布目录。

## 首次部署：需要你操作的步骤

### 1. 在本地生成管理员公钥

先从仓库根目录启动静态服务：

```sh
python3 -m http.server 18765 --bind 127.0.0.1
```

访问 `http://127.0.0.1:18765/portal/setup.html`，输入高强度 master password，生成公钥并下载 `portal-public-recovery.json`。不要将密码发给任何人。

这里不需要已部署的 Worker。需要支持 Ed25519 Web Crypto 的现代浏览器；HTTPS 和 localhost 都支持安全上下文。生成结果包括：

- `ADMIN_PUBLIC_KEY`：base64url 格式 Ed25519 公钥。
- `KDF_CONFIG`：Argon2id 的 salt、参数和版本组成的 JSON。

两项均为公开信息。**保存恢复 JSON：只有密码相同、salt 和派生参数也相同，才能恢复相同身份。** setup 每次生成新的 salt，不要为了恢复旧身份重新随机生成。

### 2. 准备 Worker 配置

打开 `worker/wrangler.jsonc`：

- `name`：按需修改为你的 Worker 名称。
- `ALLOWED_ORIGINS`：生产站点的 origin，例如 `https://john-ao.github.io`。多个 origin 用逗号分隔，不带路径或尾部斜杠。生产环境不要保留无须使用的 localhost 来源。
- `ADMIN_PUBLIC_KEY`：填入生成的公钥。
- `KDF_CONFIG`：填入生成的 JSON **字符串**，注意转义内部引号。

公钥与 KDF 配置可以安全提交；密码和私钥不能写进这些文件。也可以在 Cloudflare 控制台的 Worker Settings → Variables and Secrets 中配置这两个值，但后续 Wrangler 部署会以文件配置为准：请让两边保持一致。

### 3. 部署到 Workers Free

在 Cloudflare 控制台确认账号使用 **Workers Free**，不必升级付费计划。然后在自己的终端操作：

```sh
cd portal
npm ci
npx wrangler login
npm run check:deploy
npm run deploy
```

开发与部署工具已在 lockfile 固定版本；当前工具链兼容 Node.js 20.17+。`wrangler login` 会打开你自己的浏览器授权，不需要将 Cloudflare API Token 放进仓库。

配置文件会创建两个 **SQLite** Durable Object 类与绑定：

| 绑定 | 类 | 职责 |
| --- | --- | --- |
| `REGISTRY` | `PortalRegistry` | 会话、challenge、授权码、房间索引 |
| `ROOMS` | `GameRoom` | 每房间一个对象，转发、记录、去重、邀请 |

`migrations` 使用 `new_sqlite_classes`，不要改成旧 KV 后端的 `new_classes`。首次成功部署后保留已有 migration，未来结构变更添加新 migration，不要反复重命名现有类。

Worker 包含多个模块和 DO 类，推荐通过上述 Wrangler 流程部署；只在控制台粘贴入口 `index.js` 并不足以部署完整服务。

### 4. 连接 GitHub Pages 前端

将部署输出的 HTTPS Worker 地址填入 `portal/config.js`：

```js
export const config = Object.freeze({
  apiBase: 'https://你的-worker.你的子域.workers.dev',
  games: { quoridor: '/game/quoridor/' }
});
```

然后按仓库原有方式发布 GitHub Pages。第一次打开 `/portal/` 应显示“服务可用，请登录”。

这一步不需要配置自定义域名、D1、KV、R2、TURN、Cron 或付费产品。所有过期清理由 DO alarms 处理。

### 5. 验收

1. 打开 `/portal/`，使用 master password 登录。
2. 打开 `/game/quoridor/` → 联网 → 创建房间，经 Portal 授权后返回游戏。
3. 再点“联网”→“生成邀请”→“复制链接”。
4. 用另一个浏览器或设备打开链接，点击“加入邀请对局”。
5. 走棋、放墙，检查双方同步；刷新访客页面，检查原席位与局面恢复。
6. 请求悔棋或新一局，对方同意后生效。
7. 在管理后台关闭房间，双方应断开。

本仓库的本地测试不等同于线上部署验证；完成 Cloudflare 与 Pages 配置后仍需做上述真实网络验收。

## 本地开发与测试

```sh
cd portal
npm ci
npm test
npm run check:deploy
node ../game/quoridor/engine.test.js
npm run test:browser
```

浏览器联调默认使用 `/usr/bin/google-chrome`。可通过 `CHROME_PATH=/path/to/chrome npm run test:browser` 指定 Chrome/Chromium。测试会启动临时静态服务器和真实 workerd 模拟器，使用临时测试口令，不连接 Cloudflare 账号，也不修改生产 `config.js`。截图写入忽略的 `test-results/`。

### 本地页面连接已部署的 Worker

保持 `config.js` 指向线上 Worker。在 Worker 的 `ALLOWED_ORIGINS` 中同时允许生产站点和本地页面来源：

```text
https://john-ao.github.io,http://127.0.0.1:18765,http://localhost:18765
```

仓库中的 `worker/wrangler.jsonc` 已包含这三个来源。修改后从 `portal/` 运行 `npm run deploy`，或在 Cloudflare 控制台修改同名变量并部署使其生效。仅修改本地配置、未重新部署，不会改变线上 CORS 行为。

从仓库根目录运行 `python3 -m http.server 18765 --bind 127.0.0.1`，然后访问 `http://127.0.0.1:18765/portal/` 或 `/game/quoridor/`。不要双击 HTML 使用 `file://`。协议、主机和端口都必须与白名单一致；使用其他端口时需同步更新。不要将 `ALLOWED_ORIGINS` 改为 `*`。

该方式使用线上真实房间与数据。本地页面及 GitHub Pages 的浏览器存储相互独立，因此需分别登录。结束本地测试后，可移除不再需要的本地来源并重新部署。

### 本地页面连接本地 Worker

手动调试时，在 `worker/.dev.vars` 中设置本地公钥、KDF JSON 和 `ALLOWED_ORIGINS="http://127.0.0.1:18765"`，运行 `npm run dev`。临时将 `config.js` 指向本地 Worker（通常 `http://127.0.0.1:8787`）；部署前恢复生产地址。`.dev.vars` 不提交。

Quoridor 本地同屏模式仍可通过 `file://` 打开；联网功能及 Portal 需要 HTTPS 或 localhost HTTP。

## 游戏密钥管理

权限分为三层，服务端分别校验，不能通过修改页面按钮提升权限：

| 身份 | 创建游戏房间 | 加入邀请房间 | Portal 管理 |
| --- | --- | --- | --- |
| 管理员（master password） | 可以 | 可以 | 可以 |
| 已注册普通密钥 | 游戏授权后可以 | 可以 | 不可以 |
| 房间邀请访客 | 不可以 | 仅指定房间 | 不可以 |

房间邀请与密钥注册链接是两种不同凭证。Quoridor 从房间邀请进入时只显示加入入口，不显示创建房间或房主登录入口，即使该浏览器曾经保存过创建者会话也一样。想以普通密钥创建新房间，应从游戏普通入口进入。

管理员登录 `/portal/` 后，在“游戏密钥”中填写别名并创建分享链接。链接打开 `/portal/key.html#id=...&secret=...`，自签发起 **5 分钟**内可登记一个公钥；成功后不能被另一个人复用，管理员也可提前撤销链接。服务端只保存随机注册码的哈希。时间期限以服务端为准，私钥派生尚未完成也不会延长有效期。

持有人自行设置至少 16 字符的密钥密码。浏览器使用 Argon2id 和独立的 HKDF 用途 `portal/member-ed25519/v1` 派生个人 Ed25519 密钥，密码与私钥均不上传。登记时还必须签名证明拥有该私钥。创建成功后，非导出的 CryptoKey 保存到当前浏览器的 IndexedDB，之后可以直接点击“使用此浏览器的游戏密钥登录”。

请下载“密钥恢复文件”并保管个人密钥密码。恢复文件只包含公钥、公开 KDF 参数、密钥 ID 和服务地址，**不含密码或私钥**；在其他浏览器的游戏登录页，导入文件并输入个人密码即可恢复密钥。恢复密钥不等于恢复旧设备的游戏客户端席位：新设备可以创建新房间，但不会自动接管另一设备的既有席位。每个浏览器 origin 当前保存一个活动个人密钥，可通过恢复文件切换。

如果注册已经提交但响应丢失，页面会保留本地派生结果；刷新后通过密钥登录确认注册结果，避免浪费一次性链接。私钥本身没有 5 分钟期限，5 分钟仅限制注册；游戏会话仍有 8 小时有效期，管理员撤销密钥后不能再登录。

后台显示密钥别名、指纹、创建时间、最近鉴权时间、成功密钥登录次数、成功创建房间总数、当前房间/会话数量。使用情况来自服务端，不把它标作 Cloudflare 计费数据；WebSocket 棋步不会更新“最近鉴权”。别名可随时修改。撤销会立即阻止新授权，撤销待兑换授权码及已有会话，并关闭该密钥创建的房间。

普通密钥登录得到 `member` 会话，只能申请客户端建房授权；兑换后得到带 `keyId` 的 `creator` 会话。两者都不能访问管理接口。房间所有权同时检查游戏客户端公钥和所属普通密钥，避免同一浏览器切换个人密钥后继承旧密钥的房间。

更新此功能需要重新部署 Worker，再发布静态文件；现有 DO 数据会自动补充新字段，不需要新建命名空间或追加类 migration。管理员更换 master password 会清除会话、房间及未使用注册链接，但保留普通密钥记录与撤销状态。普通密钥无需重新注册。

## 身份、授权和恢复

派生链：

```text
UTF-8 master password
  → Argon2id v1.3（64 MiB、t=3、p=4、16 字节随机 salt、32 字节输出）
  → HKDF-SHA-256（info = portal/master-ed25519/v1）
  → 32 字节 Ed25519 seed
  → 管理员签名密钥
```

密码按原始输入处理，不做 trim 或 Unicode 归一化。服务端仅保存公钥和公开派生配置。Argon2id 在本地 Web Worker 中运行，WASM 已随仓库分发。主私钥不写入浏览器存储，只用于一次性 challenge 的签名。

管理员会话绑定新生成的临时 Ed25519 公钥；每次 HTTP 管理操作签署固定格式的 method、path、audience、body、timestamp、nonce、session ID。服务端拒绝过期或重复 nonce。challenge 60 秒有效、只能使用一次；会话 8 小时有效。

管理员会话仅存在当前管理页面内存中；刷新后重新登录。游戏授权使用短时一次性 code + PKCE，授权码绑定游戏客户端公钥。游戏拿到的会话没有后台权限。游戏页面不接收主私钥或 master password。

游戏/访客使用的私钥为不可导出的 `CryptoKey`，在 IndexedDB 保存，以支持刷新恢复。会话 ID 不是独立的 bearer token，必须配合对应私钥签名。管理员主私钥和密码不持久化。不可导出不意味着能防御同源恶意脚本代签。

创建者过期后可通过同一浏览器身份重新登录，继续访问房间。换浏览器或清除 IndexedDB 后，原房主客户端身份丢失，管理员仍能在后台关闭房间、重置访客或创建新房间，但不会自动冒用原房主席位。

### 邀请

- 32 字节随机密钥，通过 `#room=...&invite=...` 分享。
- 页面读取后清理地址栏，只通过 HTTPS 请求体兑换，不把密钥放进 API 查询参数。
- 邀请在点击“加入”时消费，生成后 24 小时有效，一个访客席位。
- DO 仅保存邀请哈希；并发认领原子化，同一客户端在首次认领后两分钟内可安全重试；之后使用保存的会话重连，不能再次用旧邀请续期。
- 访客在连续 8 小时无有效操作后失去权限；有效的主动读取、同步连接及写入从操作时间重新计算 8 小时。心跳、被动收到推送、失败请求均不续期。到期自动释放访客席位并使旧链接失效，房主可直接生成新链接；清除浏览器数据或换设备时，仍有效的席位须先由房主重置。
- 重置访客保留原消息记录，新的访客可接续同一席位；只撤销邀请不会踢出已经加入的访客。
- 邀请链接属于持有者凭证，转发后由先认领的人加入。

WebSocket 使用短时、一次性的连接票据（30 秒），不在连接 URL 放长期会话或邀请密钥。票据从 Registry 经签名请求取得，在 Room 中原子消费。默认关闭 Worker observability，避免保存请求 URL；若自行开启日志，应过滤票据和敏感请求体。

### 密码轮换与遗忘恢复

后台“轮换 master password”要求再次输入当前密码，关闭全部房间、清除全部会话，下载新公开恢复配置。轮换结果持久化在 Registry DO 中；建议立即同步更新 Wrangler/Cloudflare 中的两项信任配置，再创建新房间。

忘记密码时，通过你自己的 Cloudflare 账号替换 `ADMIN_PUBLIC_KEY` 和 `KDF_CONFIG`。Registry 检测到基础配置变化时会清除旧会话并关闭旧房间。若更新过程中有网络错误，下一次请求会重试，不静默保留旧授权连接。

安全边界：密码派生的公钥可被用于离线猜测密码，Argon2id 仅提高猜测成本。请使用高强度随机口令。`/portal/` 与 `/game/` 同属 GitHub Pages origin，路径不是隔离边界；仓库内脚本必须可信。若将来运行不可信游戏，应把认证页面迁至独立 origin。

## 通信协议与游戏接入

```js
import { createPortal } from '/portal/sdk/client.js';
const portal = createPortal({ gameId: 'your-game' });
await portal.completeLogin(); // 处理授权码返回
// 未登录时 await portal.login()，会跳转到统一认证页。
const room = await portal.createRoom();
room.on('sync', ({ events, seat }) => replayLocally(events, seat));
room.on('event', event => validateAndApplyLocally(event));
room.on('presence', ({ joined, online }) => showPresence(joined, online));
room.on('status', status => showConnection(status));
room.on('error', error => showError(error.message));
await room.connect();
const invite = await portal.createInvite(room.id);
await room.send({ /* 游戏自定义 JSON */ });
```

接入新游戏或其他静态工具只需调用 SDK 并在客户端解释消息，无需登记服务端游戏 ID 或路径，也无需为此部署 Worker。`createPortal({ gameId })` 的 `gameId` 仅是浏览器凭证命名空间和登录页显示名称，不上传给 Worker。SDK 默认返回当前页面（将尾部 `index.html` 规范化为目录），也可指定同源、无查询参数或 fragment 的 `returnPath`。`config.games` 仅是密钥注册完成页的可选导航目录，不参与准入检查。

服务端将房间视为以 `roomId` 命名的有序读写区域，只保存身份、公钥、授权代次、活动时间和消息记录，不保存或解释游戏 ID。客户端通过 payload 内的协议版本识别自身数据。管理后台按房间 ID 管理，完整分享链接由知道页面地址的客户端生成。

房间每条消息附带 `id`、`expectedSeq` 和不透明 `payload`；服务端附加不可由客户端冒充的 `seat` 与递增 `seq`。在存储事务中提交日志和去重结果后才广播。相同 ID、相同发送身份、相同 payload 的重试不重复追加；同一 ID 更换内容会被拒绝。

首次连接/重连发送完整有序日志，游戏从初始化消息重放。浏览器 sessionStorage 保存尚未确认的单条操作，重连后根据日志判断其是否已提交。版本冲突时重新同步，**不自动把旧棋步应用到新局面**。

同一席位只允许一个可操作连接，新连接接管旧连接。使用 Hibernation WebSocket API 和自动 ping/pong 应答，不靠 DO 定时器保活。会话到期、房间到期、退出登录或后台撤销会关闭相关连接。

Quoridor 的 `online-protocol.mjs` 定义初始化、行动、悔棋/新局提案、回复和认输。房主在浏览器生成初始先手；接收方检查游戏版本、当前局 ID、本地状态版本、发送者回合和规则。遇到非法消息，局面保留在最后一个合法状态，显示原因并暂停操作。重新同步会重新校验同一份日志，不能自动修复其中的非法消息；必要时双方新建房间。

## 额度与限制

初版主动限制：最多 50 个房间、64 个有效会话、128 个普通密钥记录和 32 个有效密钥注册链接；每条 payload 最多 4 KiB；每房间最多 2048 条消息或 512 KiB 日志；单连接每 10 秒最多 30 条业务消息。超出日志上限需要创建新房间。

房间连续 7 天无有效读取、写入或房间管理操作后清理，删除日志、邀请和成员。访客的 8 小时空闲期限独立计算，房主活动不会延长访客权限。内部元数据检查、后台列表轮询、失败请求、被动消息推送与 ping/pong 不延长这些期限；管理员或创建者的登录会话仍为 8 小时固定有效期。

访客期限以 Room 内授权记录为准。Registry 会话和浏览器保存的 `expires` 只是快照；SDK 不根据旧快照拒绝访客重连，而由服务端检查当前授权。重发邀请会产生新的授权代次，旧会话即使使用同一公钥也不能继承新权限。

本次升级需要部署一次 Worker 并同时发布 SDK/游戏静态文件；以后新增客户端不再需要更新游戏白名单。现有房间日志保留，旧游戏元数据在读取时移除。旧访客首次迁移按房间原最后活动时间加 8 小时初始化期限；若已超时，请房主重新分享。无需重置管理员或更改 DO migration。

Cloudflare Free 当前支持 SQLite DO。官方额度包括 Worker 100,000 请求/天，DO 100,000 请求/天、13,000 GB-s/天，SQLite 500 万行读/天、10 万行写/天、合计 5 GB。免费额度超限会失败，不能保证面对恶意流量仍保持可用。这里不自动升级付费套餐，不伪造准确计费数据；真实用量在 Cloudflare 控制台查看。

参考：

- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://www.rfc-editor.org/rfc/rfc9106.html
- `vendor/README.txt`：固定版本、许可证与 SHA-256 校验值。

## 备用访问线路

`config.apiBase` 始终是原 Worker 的地址：它用于签名 audience、浏览器凭证、恢复文件和待确认消息的命名空间。不要将它改为代理 IP。`config.routes` 只配置访问入口；当前提供 Cloudflare 直连和 `https://45.76.9.45` 美国服务器备用线路，两者访问同一套房间数据。

在通信管理页、游戏登录页或密钥注册页选择“通信线路”。选择保存在当前站点的浏览器 localStorage 中，同浏览器未采用邀请指定线路的标签页会同步；对应游戏会重新连接并重放消息。邀请指定线路优先于浏览器默认偏好；如需手动覆盖，可在该游戏标签页前往 `/portal/` 选择线路，再返回游戏，不需要管理员登录。注册页若初始化失败，切换后刷新页面重试。默认直连，不自动跨线路重试写操作；API 请求最长等待 15 秒。邀请参数使用 `p1.<线路标识>.<邀请凭证>` 格式。访客点击加入时自动采用房主生成链接时的线路，选择只保存在当前标签页的 sessionStorage 中，刷新后仍生效，不覆盖浏览器长期偏好。房主后续切换不会改变已发出的邀请。仅接受配置中的线路标识，不允许任意代理地址；旧格式邀请不再支持，需要房主重新生成。

代理必须固定回源到 Worker，保留 Origin，并将回源 Host/SNI 设置为 Worker 主机。无需修改 Worker 或迁移房间数据。服务器故障与 Cloudflare 后端故障不是同一种故障：所有入口仍依赖同一个 Worker。当前 Worker 的来源 IP 限流会将代理用户合并计数；代理入口适用于小规模备用，增加人数前需设计可信代理身份传递，不能直接信任客户端提供的 IP 头。
