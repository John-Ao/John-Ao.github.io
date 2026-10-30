import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const local = !process.argv.includes('--public') && existsSync(resolve(root, 'catalog.local.json'));
const catalog = await json(local ? 'catalog.local.json' : 'catalog.json');
const official = await json('research/official-roster.json');
const published = (await json('publish.json')).characters;
assert.equal(catalog.operatorCount, local ? 33 : published.length);
assert.equal(catalog.operators.length, local ? 34 : published.length);
assert.deepEqual(new Set(catalog.operators.map(x => x.id)), new Set(local ? official.operators.map(x => x.id) : published));
const requiredModelAssets = new Set();
assert(!catalog.operators.some(x => x.id === 'minghe'), 'Unreleased operator included');
let modelCount = 0, animationCount = 0, channels = 0;

async function glb(path) {
  const stored = await readFile(resolve(root, path));
  const bytes = path.endsWith('.gz') ? gunzipSync(stored) : stored;
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${path}: invalid GLB header`);
  assert.equal(bytes.readUInt32LE(4), 2, `${path}: unsupported GLB version`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${path}: truncated GLB`);
  return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
}

for (const operator of catalog.operators) {
  assert((await stat(resolve(root, operator.portrait))).size > 0);
  const model = await glb(operator.model);
  requiredModelAssets.add(resolve(root, operator.model));
  assert(model.skins?.length && model.meshes?.length, `${operator.id}: missing rig or geometry`);
  const nodeNames = new Set(model.nodes.map(node => node.name));
  for (const buffer of model.buffers) {
    if (!buffer.uri) continue;
    const name = buffer.uri + (/\/textures\/[0-9a-f]{16}$/.test(buffer.uri) ? '.bin' : '');
    const path = resolve(root, dirname(operator.model), name);
    requiredModelAssets.add(path);
    assert.equal((await stat(path)).size, buffer.byteLength, `${path}: texture payload length mismatch`);
  }
  assert(operator.animations.length >= 20, `${operator.id}: incomplete showcase selection`);
  for (const category of ['idle', 'combat', 'movement', 'interaction']) assert(operator.animations.some(x => x.category === category), `${operator.id}: missing ${category}`);
  for (const clip of operator.animations) {
    const animation = await glb(clip.url);
    assert.equal(animation.animations?.length, 1, `${clip.name}: expected original animation clip`);
    assert(animation.animations[0].channels.length > 0, `${clip.name}: empty animation`);
    for (const channel of animation.animations[0].channels) {
      const name = animation.nodes[channel.target.node]?.name;
      assert(nodeNames.has(name), `${operator.id}/${clip.name}: animation target ${name} not in skeleton`);
    }
    channels += animation.animations[0].channels.length;
    animationCount++;
  }
  modelCount++;
}
assert.equal(animationCount, catalog.selectedAnimationCount);

// Verify every pinned original asset through its lossless storage wrapper.
const modelSources = await json('research/model-sources.json');
const records = modelSources.files.filter(record => local || requiredModelAssets.has(resolve(root, record.path)));
for (const record of records) {
  const stored = await readFile(resolve(root, record.path));
  const bytes = record.path.endsWith('.gz') ? gunzipSync(stored) : stored;
  assert.equal(bytes.length, record.bytes, record.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, `${record.path}: integrity mismatch`);
}
console.log(`Verified ${modelCount} rigged models, ${animationCount} original clips, ${channels.toLocaleString()} animation channels, and ${records.length} model/texture files.`);
