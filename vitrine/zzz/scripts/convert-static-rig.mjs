// Three.js 0.170 FBX -> glTF preserves multi-material polygons omitted by Assimp 5.2.2.
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {FBXLoader} from '../vendor/loaders/FBXLoader.js';
import {GLTFExporter} from '../vendor/exporters/GLTFExporter.js';
class FileReader {readAsArrayBuffer(blob){blob.arrayBuffer().then(x=>{this.result=x;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(x=>{this.result=`data:${blob.type};base64,${Buffer.from(x).toString('base64')}`;this.onloadend?.();});}}
globalThis.FileReader=FileReader;
T.TextureLoader.prototype.load=()=>new T.Texture();
for(const dir of process.argv.slice(2)){
 const old=JSON.parse(fs.readFileSync(dir+'/model.gltf'));const b=fs.readFileSync(dir+'/source.fbx');const model=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 model.traverse(n=>{if(n.isMesh){const uv=n.geometry.attributes.uv;if(uv)for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));n.material=(Array.isArray(n.material)?n.material:[n.material]).map(m=>{const x=new T.MeshStandardMaterial();x.name=m.name;return x;});if(n.material.length===1||n.geometry.groups.length===0)n.material=n.material[0];}});
 const g=await new GLTFExporter().parseAsync(model,{onlyVisible:false});
 g.images=old.images;g.textures=old.textures;g.samplers=old.samplers;
 g.materials=g.materials.map(m=>{let src=old.materials.find(s=>s.name===m.name);if(!src){const candidates=old.images.map((im,i)=>({i,base:im.uri.split('_D')[0].replace(/_Map(\d+)/,'_$1')})).filter(im=>m.name.replace('MAT_','').startsWith(im.base)).sort((a,b)=>b.base.length-a.base.length);if(!candidates.length)throw new Error(m.name);const index=old.textures.findIndex(t=>t.source===candidates[0].i);src={name:m.name,pbrMetallicRoughness:{baseColorTexture:{index},metallicFactor:0,roughnessFactor:.85},extras:{materialFallback:'Shared original diffuse; missing source material groups'}};}const mat={...src};delete mat.extensions;delete mat.emissiveFactor;mat.doubleSided=true;return mat;});
 const binary=Buffer.from(g.buffers[0].uri.split(',')[1],'base64');g.buffers[0].uri='model.bin';
 fs.writeFileSync(dir+'/model.bin',binary);fs.writeFileSync(dir+'/model.gltf',JSON.stringify(g));
 console.log(dir,g.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+g.accessors[p.attributes.POSITION].count,0),0),'vertices',g.skins.length,'skins');
}
