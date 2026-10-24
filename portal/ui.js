import { random, hash } from './shared/protocol.js';
export const $ = id => document.getElementById(id);
export function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
export function kdfConfig() { return { version: 1, algorithm: 'argon2id', salt: random(16), memorySize: 65536, iterations: 3, parallelism: 4 }; }
export function download(settings) {
  const blob = new Blob([JSON.stringify({ publicKey: settings.publicKey, kdf: settings.kdf }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'portal-public-recovery.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function fingerprint(publicKey) { return (await hash(publicKey)).slice(0, 24); }
export async function busy(button, fn) { button.disabled = true; try { await fn(); } catch (e) { status(e.message, true); } finally { button.disabled = false; } }
