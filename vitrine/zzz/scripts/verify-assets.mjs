import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const local=process.argv.includes('--local');
const manifest=p=>JSON.parse(fs.readFileSync(new URL(local?p.replace(/\.json$/,'.local.json'):p,root)));
const agents=manifest('roster.json');
const coverage=manifest('assets/coverage.json');
assert.equal(agents.length,coverage.releasedCount);
assert.equal(new Set(agents.map(a=>a.gameId)).size,agents.length);
for(const a of agents){
 assert(!coverage.excluded.some(e=>e.gameId===a.gameId));
 assert.equal(a.stats.length,10);assert(!a.stats.includes('—'));
 assert.equal(a.cinema.length,6);assert.equal(a.cinemaImages.length,3);
 for(const path of [a.portrait,a.splash,a.factionIcon,...a.cinemaImages]){
  const b=fs.readFileSync(new URL(path,root));assert.equal(b.toString('ascii',0,4),'RIFF',path);assert.equal(b.toString('ascii',8,12),'WEBP',path);
 }
}
const catalog=manifest('assets/models/catalog.json');
assert.equal(new Set(catalog.map(e=>e.agentId)).size,catalog.length);
let clipCount=0;
for(const entry of catalog){
 assert(agents.some(a=>a.id===entry.agentId));
 for(const clip of entry.clips){
 const dir=new URL(`assets/models/${entry.key}/`,root);
 const gltf=JSON.parse(fs.readFileSync(new URL(`${clip.id}.gltf`,dir)));
 assert(gltf.skins.length>0);assert(gltf.meshes.length>0);
 assert.equal(gltf.animations?.length??0,clip.animated?1:0);
 if(clip.animated){clipCount++;assert(gltf.animations[0].channels.length>400);}
 for(const image of gltf.images??[])assert(fs.existsSync(new URL(image.uri,dir)),image.uri);
 for(const buffer of gltf.buffers)assert.equal(fs.statSync(new URL(buffer.uri,dir)).size,buffer.byteLength);
 for(const view of gltf.bufferViews)assert((view.byteOffset??0)+view.byteLength<=gltf.buffers[view.buffer].byteLength);
 for(const animation of gltf.animations??[])for(const channel of animation.channels){
 assert(gltf.nodes[channel.target.node]);const sampler=animation.samplers[channel.sampler];
 assert.equal(gltf.accessors[sampler.output].count,gltf.accessors[sampler.input].count*(sampler.interpolation==='CUBICSPLINE'?3:1));
 }
 }
}
assert.equal(catalog.length,coverage.riggedModelCount);assert.equal(clipCount,coverage.skeletalClipCount);
for(const entry of manifest('assets/models/provenance.json')){
 const bytes=fs.readFileSync(new URL(entry.file,root));assert.equal(bytes.length,entry.bytes,entry.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.file);
}
console.log(`Verified ${agents.length} catalog agents, ${agents.length*6} local images and ${catalog.length} rigged characters / ${clipCount} skeletal animation assets with provenance hashes.`);

const shading=manifest('assets/models/shading-sources.json');
for(const entry of shading){
 const bytes=fs.readFileSync(new URL(entry.file,root));
 assert.equal(bytes.length,entry.bytes,entry.file);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.file);
 if(entry.file.endsWith('.png'))assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 else {const props=JSON.parse(bytes).m_SavedProperties;assert(props.m_Colors._ShadowColor);assert(props.m_Colors._OutlineColor);}
}
console.log(`Verified ${shading.length} original shading textures and UI material files.`);
