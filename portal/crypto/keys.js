import { b64, unb64, utf8 } from '../shared/protocol.js';
export async function newIdentity() {
  const pair = await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
  return { privateKey: pair.privateKey, publicKey: b64(await crypto.subtle.exportKey('raw', pair.publicKey)) };
}
export async function sign(key, text) { return b64(await crypto.subtle.sign('Ed25519', key, utf8.encode(text))); }
export async function fromSeed(seed) {
  const prefix = new Uint8Array([48,46,2,1,0,48,5,6,3,43,101,112,4,34,4,32]);
  const encoded = new Uint8Array(48); encoded.set(prefix); encoded.set(seed, 16);
  try {
    const temporary = await crypto.subtle.importKey('pkcs8', encoded, 'Ed25519', true, ['sign']);
    const jwk = await crypto.subtle.exportKey('jwk', temporary);
    const privateKey = await crypto.subtle.importKey('pkcs8', encoded, 'Ed25519', false, ['sign']);
    return { privateKey, publicKey: jwk.x };
  } finally { encoded.fill(0); }
}
export function validateKdf(kdf) {
  if (kdf?.version !== 1 || kdf.algorithm !== 'argon2id' || kdf.memorySize !== 65536 || kdf.iterations !== 3 || kdf.parallelism !== 4 || unb64(kdf.salt).length !== 16) throw new Error('不支持的密钥派生配置');
  return kdf;
}
export function deriveMaster(password, kdf, purpose = 'master') {
  if (!['master', 'member'].includes(purpose)) throw new Error('未知密钥用途');
  validateKdf(kdf);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./argon2-worker.js?v=2', import.meta.url));
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('密钥派生超时，请使用内存充足的现代浏览器')); }, 120000);
    worker.onmessage = async ({ data }) => {
      clearTimeout(timer); worker.terminate();
      if (data.error) { reject(new Error(data.error)); return; }
      const seed = new Uint8Array(data.seed);
      try { resolve(await fromSeed(seed)); } catch (e) { reject(new Error('浏览器需支持 Ed25519 Web Crypto：' + e.message)); } finally { seed.fill(0); }
    };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error('无法加载本地 Argon2 组件')); };
    worker.postMessage({ password, kdf, purpose });
  });
}
