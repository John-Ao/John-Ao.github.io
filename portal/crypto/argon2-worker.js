importScripts('../vendor/argon2.umd.min.js');
self.onmessage = async ({ data: { password, kdf, purpose } }) => {
  let material;
  try {
    const salt = Uint8Array.from(atob(kdf.salt.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    material = await hashwasm.argon2id({ password, salt, iterations: kdf.iterations, parallelism: kdf.parallelism, memorySize: kdf.memorySize, hashLength: 32, outputType: 'binary' });
    password = '';
    const base = await crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveBits']);
    const seed = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(purpose === 'member' ? 'portal/member-ed25519/v1' : 'portal/master-ed25519/v1') }, base, 256);
    self.postMessage({ seed }, [seed]);
  } catch { self.postMessage({ error: 'Argon2id 派生失败，请检查浏览器内存与配置' }); }
  finally { material?.fill(0); self.close(); }
};
