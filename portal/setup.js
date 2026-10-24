import { deriveMaster } from './crypto/keys.js';
import { $, status, kdfConfig, download, busy } from './ui.js';
let settings;
$('setup').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => {
  if ($('password').value !== $('repeat').value) throw new Error('两次密码不一致');
  status('正在派生密钥…'); const kdf = kdfConfig();
  const key = await deriveMaster($('password').value, kdf);
  $('setup').reset(); settings = { publicKey: key.publicKey, kdf };
  $('publicKey').value = settings.publicKey; $('kdf').value = JSON.stringify(kdf); $('result').hidden = false;
  status('公钥已生成。请下载公开恢复配置并完成 Cloudflare 配置。');
}); };
$('download').onclick = () => download(settings);
