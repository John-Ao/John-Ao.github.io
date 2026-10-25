import { endpointBase, onRouteChange } from './sdk/routes.js';

const button = document.getElementById('testConnection');
const address = document.getElementById('workerAddress');
const status = document.getElementById('connectionStatus');
let activeController;

async function testConnection() {
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = '测试中…';
  status.classList.remove('error');
  status.textContent = '正在连接…';
  const controller = activeController = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const started = performance.now();
  const testedEndpoint = endpointBase();
  try {
    const base = endpointBase();
    address.textContent = base;
    const response = await fetch(base + '/v1/config', {
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    });
    if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}`);
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('服务返回的内容不是有效 JSON，请检查 Worker 地址和部署');
    }
    if (typeof data?.configured !== 'boolean') throw new Error('服务响应不符合 Portal 配置接口，请检查 Worker 地址和部署');
    if (base !== endpointBase()) return;
    const elapsed = Math.round(performance.now() - started);
    status.textContent = `连接成功 · ${elapsed} ms · ${data.configured ? '管理员公钥已配置，可登录' : '管理员公钥尚未配置，请先初始化公钥'}`;
  } catch (error) {
    if (testedEndpoint !== endpointBase()) return;
    status.classList.add('error');
    const reason = controller.signal.aborted ? '连接超时（10 秒），请检查网络或稍后重试'
      : error instanceof TypeError ? '无法连接，请检查网络、Worker 地址及 ALLOWED_ORIGINS 跨域配置'
      : error.message;
    status.textContent = `连接测试失败：${reason}`;
    if (!address.textContent) address.textContent = '未配置有效地址（portal/config.js）';
  } finally {
    clearTimeout(timer);
    button.disabled = false;
    button.textContent = '重新测试';
  }
}

onRouteChange(() => { activeController?.abort(); address.textContent = endpointBase(); status.textContent = '线路已切换，请重新测试连接'; });
button.addEventListener('click', testConnection);
testConnection();
