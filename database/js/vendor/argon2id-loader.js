import setupWasm from './argon2id/setup.js';

const instantiate = (url) => async (imports) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法加载 Argon2 模块 (${response.status})`);
  const bytes = await response.arrayBuffer();
  return WebAssembly.instantiate(bytes, imports);
};

export default function loadArgon2id() {
  return setupWasm(
    instantiate(new URL('./argon2id/simd.wasm', import.meta.url)),
    instantiate(new URL('./argon2id/no-simd.wasm', import.meta.url)),
  );
}
