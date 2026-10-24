import { copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const source = new URL('../node_modules/hash-wasm/dist/argon2.umd.min.js', import.meta.url);
const target = new URL('../vendor/argon2.umd.min.js', import.meta.url);
await copyFile(source, target);
await copyFile(new URL('../node_modules/hash-wasm/LICENSE', import.meta.url), new URL('../vendor/hash-wasm.LICENSE', import.meta.url));
await writeFile(new URL('../vendor/README.txt', import.meta.url), `hash-wasm 4.12.0, MIT, https://github.com/Daninet/hash-wasm\nargon2.umd.min.js includes the WASM binary.\nSHA-256: ${createHash('sha256').update(await readFile(target)).digest('hex')}\nRebuild: npm ci && npm run vendor (from portal/).\n`);
