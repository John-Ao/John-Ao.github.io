import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {isLocalHost} from '../resource-catalog.js';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const publicFiles=new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','--','vitrine/zzz'],{cwd:new URL('../../../',import.meta.url),encoding:'utf8'}).trim().split('\n').map(p=>p.replace(/^vitrine\/zzz\//,'')));
assert.deepEqual(read('roster.json').map(a=>a.id).sort(),['anby','nicole']);
assert.deepEqual(read('assets/models/catalog.json').map(a=>a.key).sort(),['anby','nicole']);
for(const p of publicFiles){
 assert(!p.endsWith('.local.json')&&!p.endsWith('.fbx')&&!p.startsWith('research/')&&!p.startsWith('preview'),p);
 if(/^assets\/models\/[^/]+\//.test(p))assert(/^assets\/models\/(anby|nicole)\//.test(p),p);
}
const required=new Set();
for(const a of read('roster.json'))for(const p of [a.portrait,a.splash,a.factionIcon,...a.cinemaImages,`assets/motion/${a.id}.mp4`,`assets/motion/${a.id}-poster.webp`])required.add(p.replace(/^\.\//,''));
for(const e of read('assets/models/catalog.json'))for(const c of e.clips){
 const dir=`assets/models/${e.key}/`,p=dir+c.id+'.gltf';required.add(p);
 for(const ref of [...read(p).buffers,...read(p).images])required.add(dir+ref.uri);
}
for(const p of read('assets/models/shading-sources.json'))required.add(p.file);
for(const p of required)assert(publicFiles.has(p),`Required asset ignored: ${p}`);
for(const h of ['localhost','127.0.0.1','[::1]','192.168.1.2'])assert(isLocalHost(h));
for(const h of ['john-ao.github.io','example.com','localhost.example.com'])assert(!isLocalHost(h));
console.log(`Verified Git publication: only Anby/Nicole; ${required.size} referenced assets included, local files excluded.`);
