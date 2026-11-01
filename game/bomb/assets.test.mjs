import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
const manifest = JSON.parse(await readFile(new URL('./sources.json', import.meta.url)));
for (const [i, entry] of manifest.games.entries()) {
  test(`${entry.game}: correct complete original game and local dependencies`, async () => {
    const file = await readFile(new URL(`./assets/${entry.game}.swf`, import.meta.url));
    assert.equal(file.length, entry.localBytes);
    assert.equal(createHash('sha256').update(file).digest('hex'), entry.localSHA256);
    assert.equal(file.subarray(0, 3).toString(), 'CWS');
    assert.equal(inflateSync(file.subarray(8)).length + 8, file.readUInt32LE(4));
    const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
    assert.match(html, new RegExp(`<option value="${i + 1}">`));
    for (const [, path] of html.matchAll(/(?:src|href)="(\.[^"]+)"/g)) {
      await access(new URL(path, import.meta.url));
    }
    assert.doesNotMatch(html, /<(?:object|embed)\b|https?:\/\/.*\.(?:js|css)/);
  });
}
test('pinned Ruffle distribution retains both WebAssembly variants and licenses', async () => {
  const base = new URL('./vendor/ruffle/', import.meta.url);
  const pkg = JSON.parse(await readFile(new URL('package.json', base)));
  assert.equal(pkg.version, manifest.ruffle.version);
  const js = await readFile(new URL('ruffle.js', base), 'utf8');
  for (const name of ['LICENSE_MIT', 'LICENSE_APACHE']) await access(new URL(name, base));
  for (const name of ['172de42e6619eac8f371.wasm', '878d548199cddef07035.wasm']) {
    assert.equal((await readFile(new URL(name, base))).subarray(0, 4).toString(), '\0asm');
  }
  assert.match(js, /createPlayer/);
});
