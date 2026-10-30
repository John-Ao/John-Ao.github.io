import { loadCatalog } from './resource-catalog.js';
import * as T from './vendor/three.module.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { prepareToon } from './toon-material.js';

const catalog=await loadCatalog('./assets/models/catalog.json');
document.querySelector('#catalog-summary').textContent=`已接入 ${catalog.length} 位角色模型，其中 ${catalog.filter(c=>c.clips.some(a=>a.animated)).length} 位具有 ${catalog.reduce((n,c)=>n+c.clips.filter(a=>a.animated).length,0)} 段原始骨骼动画。`;
const characterSelect=document.querySelector('#character'),clipSelect=document.querySelector('#clip');
characterSelect.replaceChildren(...catalog.map(c=>new Option(c.name,c.key)));
function setupClips(){const entry=catalog.find(c=>c.key===characterSelect.value);clipSelect.replaceChildren(...entry.clips.map(c=>new Option(c.label,c.id)));}
const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.5),2));
renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#20221e');
const camera=new T.PerspectiveCamera(32,1,.01,100);
scene.add(new T.HemisphereLight(0xffffff,0x777766,2.8));
const key=new T.DirectionalLight(0xffffff,2);key.position.set(3,5,4);scene.add(key);
const loader=new GLTFLoader(),cache=new Map();
const shadowTarget=new T.WebGLRenderTarget(2048,2048);
shadowTarget.depthTexture=new T.DepthTexture(2048,2048,T.UnsignedIntType);
const depthMaterial=new T.MeshDepthMaterial({side:T.FrontSide});
const shadowCamera=new T.OrthographicCamera(-3,3,3,-3,.01,20);
const shadowMatrix=new T.Matrix4();
function renderShadow() {
 if(!object||!toon||document.querySelector('#render-mode').value!=='toon')return;
 const radius=height*.85;
 shadowCamera.left=-radius;shadowCamera.right=radius;shadowCamera.top=radius;shadowCamera.bottom=-radius;
 shadowCamera.near=.01;shadowCamera.far=height*8;
 shadowCamera.position.copy(center).addScaledVector(new T.Vector3(-.35,.65,.85).normalize(),height*3);
 shadowCamera.lookAt(center);shadowCamera.updateProjectionMatrix();shadowCamera.updateMatrixWorld();
 shadowMatrix.multiplyMatrices(shadowCamera.projectionMatrix,shadowCamera.matrixWorldInverse);
 toon.setOutlinesVisible(false);scene.overrideMaterial=depthMaterial;
 renderer.setRenderTarget(shadowTarget);renderer.render(scene,shadowCamera);
 renderer.setRenderTarget(null);scene.overrideMaterial=null;toon.setOutlinesVisible(true);
 toon.setShadow(shadowTarget.depthTexture,shadowMatrix,height*.0012);
}
let object,mixer,action,toon,generation=0,paused=false;
let center=new T.Vector3(),height=2,anchor,rootStart=new T.Vector3(),baseCenter=new T.Vector3();
let yaw=0,pitch=.06,zoom=1,dirty=true;
const timeline=document.querySelector('#timeline'),timeOutput=document.querySelector('#time');
function invalidate(){dirty=true;}
function setPaused(value){paused=value;const button=document.querySelector('#pause');button.textContent=paused?'继续':'暂停';button.setAttribute('aria-pressed',String(paused));invalidate();}
function updateCenter(){
 center.copy(baseCenter);
 if(anchor&&document.querySelector('#follow').checked)center.add(anchor.getWorldPosition(new T.Vector3()).sub(rootStart));
}
function updateTime(){
 const duration=action?.getClip().duration??0,current=Math.min(action?.time??0,duration);
 timeline.value=current;timeline.setAttribute('aria-valuetext',`${current.toFixed(3)} 秒`);
 timeOutput.textContent=`${current.toFixed(3)} / ${duration.toFixed(3)} 秒`;
}
function frame() {
 const portrait=document.querySelector('#framing').value==='portrait';
 const target=center.clone();if(portrait)target.y+=height*.14;
 const distance=height*(portrait?1.02:(!catalog.find(c=>c.key===characterSelect.value).toon?2.4:1.95))*Math.max(1,0.9/camera.aspect)*zoom;
 camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);
 camera.lookAt(target);camera.updateMatrixWorld();
}
async function load() {
 const token=++generation,id=document.querySelector('#clip').value;
 const character=characterSelect.value,entry=catalog.find(c=>c.key===character),clipInfo=entry.clips.find(c=>c.id===id),asset=character+'/'+id;
 status.textContent='载入模型与角色材质…';timeline.disabled=true;
 try {
  if(!cache.has(asset))cache.set(asset,loader.loadAsync(`./assets/models/${asset}.gltf`).catch(error=>{cache.delete(asset);throw error;}));
  const gltf=await cache.get(asset);if(token!==generation)return;
  const model=gltf.scene;
  if(!entry.toon)model.rotation.x=-Math.PI/2;
  if(!entry.toon)model.traverse(node=>{if(node.isMesh)node.frustumCulled=false;if(node.isMesh)for(const mat of (Array.isArray(node.material)?node.material:[node.material])){mat.emissive?.set(0);mat.side=T.DoubleSide;mat.metalness=0;mat.roughness=.85;}});
  // Initialize the animation before calibrating the head's reference orientation.
  const nextMixer=new T.AnimationMixer(model),nextAction=gltf.animations[0]?nextMixer.clipAction(gltf.animations[0]):null;
  if(nextAction){nextAction.setLoop(clipInfo.loop?T.LoopRepeat:T.LoopOnce,Infinity);nextAction.clampWhenFinished=true;nextAction.reset().play();nextMixer.update(0);}
  const nextToon=entry.toon?await prepareToon(model,character):null;
  if(token!==generation){nextMixer.stopAllAction();return;}
  if(object)scene.remove(object);mixer?.stopAllAction();
  object=model;mixer=nextMixer;action=nextAction;toon=nextToon;
  scene.add(object);
  for(const [key,pending] of cache){if(cache.size<=3)break;if(key===asset)continue;cache.delete(key);pending.then(old=>{const geometries=new Set(),materials=new Set(),textures=new Set();old.scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)for(const m of (Array.isArray(n.material)?n.material:[n.material]))materials.add(m);n.skeleton?.boneTexture?.dispose();});for(const m of materials){if(m.map)textures.add(m.map);if(m.uniforms?.colorMap?.value)textures.add(m.uniforms.colorMap.value);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();}).catch(()=>{});}
  toon?.setEnabled(document.querySelector('#render-mode').value==='toon');
  object.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(object);
  baseCenter=box.getCenter(new T.Vector3());height=Math.max(box.getSize(new T.Vector3()).y,2);
  anchor=object.getObjectByName('Bip001');if(anchor)anchor.getWorldPosition(rootStart);
  updateCenter();frame();timeline.max=gltf.animations[0]?.duration??1;timeline.disabled=!nextAction;document.querySelector('#pause').disabled=!nextAction;document.querySelector('#replay').disabled=!nextAction;document.querySelector('#render-mode').disabled=!entry.toon;document.querySelector('#render-mode').value=entry.toon?'toon':'original';toon?.setEnabled(entry.toon);updateTime();invalidate();
  status.textContent=nextAction?`${gltf.animations[0].duration.toFixed(3)} 秒 · ${gltf.animations[0].tracks.length} 条动画轨道 · 原始战斗动作${character==='miyabi'?' · 面部曲线待映射':''}`:'带骨骼模型 · 原始绑定姿势 · 动画待收集 · 基础材质';
 }catch(error){if(token===generation)status.textContent='加载失败：'+error.message;}
}
characterSelect.addEventListener('change',()=>{setupClips();load();});
document.querySelector('#clip').addEventListener('change',load);
document.querySelector('#replay').addEventListener('click',()=>{action?.reset().play();mixer?.update(0);setPaused(false);updateTime();invalidate();});
document.querySelector('#pause').addEventListener('click',()=>setPaused(!paused));
document.querySelector('#render-mode').addEventListener('change',event=>{toon?.setEnabled(event.target.value==='toon');invalidate();});
document.querySelector('#framing').addEventListener('change',invalidate);
document.querySelector('#follow').addEventListener('change',invalidate);
document.querySelector('#reset-view').addEventListener('click',()=>{yaw=0;pitch=.06;zoom=1;invalidate();});
timeline.addEventListener('input',()=>{
 if(!action)return;
 setPaused(true);action.reset().play();action.time=Number(timeline.value);mixer.update(0);updateTime();invalidate();
});
let drag;
canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{
 if(!drag)return;
 yaw-=(event.clientX-drag.x)*.006;pitch=T.MathUtils.clamp(pitch+(event.clientY-drag.y)*.005,-.65,.8);
 drag={x:event.clientX,y:event.clientY};invalidate();
});
canvas.addEventListener('pointerup',()=>drag=null);
canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('lostpointercapture',()=>drag=null);
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=T.MathUtils.clamp(zoom*Math.exp(event.deltaY*.001),.55,2.2);invalidate();},{passive:false});
canvas.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
 event.preventDefault();
 if(event.key==='Home'){yaw=0;pitch=.06;zoom=1;}
 else if(event.key==='ArrowLeft')yaw-=.12;
 else if(event.key==='ArrowRight')yaw+=.12;
 else pitch=T.MathUtils.clamp(pitch+(event.key==='ArrowUp'?.08:-.08),-.65,.8);
 invalidate();
});
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();frame();invalidate();}
addEventListener('resize',resize);resize();
document.addEventListener('visibilitychange',invalidate);
const clock=new T.Clock();
renderer.setAnimationLoop(()=>{
 const dt=Math.min(clock.getDelta(),.05);
 if(document.hidden)return;
 const moving=!paused&&action&&!action.paused;
 if(!moving&&!dirty)return;
 if(moving)mixer.update(dt);
 object?.updateMatrixWorld(true);updateCenter();frame();toon?.update(camera);
 renderShadow();renderer.render(scene,camera);updateTime();dirty=false;
});
const params=new URLSearchParams(location.search);
if(catalog.some(c=>c.key===params.get('character')))document.querySelector('#character').value=params.get('character');
if(params.get('embed')==='1'){
 document.body.classList.add('embedded');zoom=.8;
 const style=document.createElement('style');style.textContent='body.embedded{background:transparent}body.embedded aside{display:none}';document.head.append(style);
}
setupClips();
load();
