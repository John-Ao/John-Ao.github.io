import * as T from './vendor/three.module.js';

// Channel layout verified against HoyoToon's ZZZ shader and the original UI material dumps.
// These are WebGL approximations; this module does not claim to be the game's shader.
const vertexShader = /* glsl */`
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
varying vec2 vTex;
varying vec3 vN;
varying vec3 vPosition;
varying vec4 vShadowCoord;
uniform vec2 viewport;
uniform float outlineWidth;
uniform mat4 shadowMatrix;
uniform float shadowNormalBias;
#ifdef OUTLINE_PASS
attribute vec3 outlineNormal;
#endif
void main() {
 vTex = uv;
 #include <morphinstance_vertex>
 #include <beginnormal_vertex>
 #ifdef OUTLINE_PASS
 objectNormal = outlineNormal;
 #endif
 #include <morphnormal_vertex>
 #include <skinbase_vertex>
 #include <skinnormal_vertex>
 #include <defaultnormal_vertex>
 #include <begin_vertex>
 #include <morphtarget_vertex>
 #include <skinning_vertex>
 #include <project_vertex>
 vN = normalize(transformedNormal);
 vPosition = mvPosition.xyz;
 vec3 worldNormal=normalize(mat3(modelMatrix)*objectNormal);
 vShadowCoord=shadowMatrix*vec4((modelMatrix*vec4(transformed,1.0)).xyz+worldNormal*shadowNormalBias,1.0);
 #ifdef OUTLINE_PASS
 vec2 direction = (projectionMatrix * vec4(-vN, 0.0)).xy;
 float magnitude = length(direction);
 if (magnitude > 0.0001) gl_Position.xy += direction / magnitude * outlineWidth * 2.0 / viewport * gl_Position.w;
 #endif
}`;
const fragmentShader = /* glsl */`
#include <common>
uniform sampler2D colorMap;
uniform sampler2D lightMap;
uniform sampler2D materialMap;
uniform sampler2D matcapMap;
uniform sampler2D shadowMap;
uniform float shadowEnabled;
uniform vec3 lightDirection;
uniform vec3 worldLight;
uniform vec3 headForward;
uniform vec3 headRight;
uniform vec3 shadowColors[5];
uniform vec3 shallowColors[5];
uniform vec3 outlineColors[5];
uniform vec3 specularColors[5];
uniform vec3 rimColors[5];
uniform vec3 rimShadowColors[5];
uniform float highlightShapes[5];
uniform float shapeSoftness[5];
uniform float glossiness;
uniform vec3 emissionColors[5];
uniform float emissionStrength;
uniform float isFace;
uniform float isHair;
uniform float bumpScale;
uniform float specIntensity;
uniform float metallic;
uniform float matcapStrength;
uniform float smoothness;
uniform float alphaCutoff;
varying vec2 vTex;
varying vec3 vN;
varying vec3 vPosition;
varying vec4 vShadowCoord;
int materialIndex(float id) {
 return id < 0.2 ? 4 : id < 0.4 ? 3 : id < 0.6 ? 2 : id < 0.8 ? 1 : 0;
}
vec3 mappedNormal(vec3 n, vec2 packed) {
 // Cotangent frame: FBX exports have no tangent attribute. UV derivatives preserve seams.
 vec3 q0=dFdx(vPosition), q1=dFdy(vPosition);
 vec2 st0=dFdx(vTex), st1=dFdy(vTex);
 vec3 q1p=cross(q1,n), q0p=cross(n,q0);
 vec3 t=q1p*st0.x+q0p*st1.x, b=q1p*st0.y+q0p*st1.y;
 float inv=inversesqrt(max(max(dot(t,t),dot(b,b)),1e-10));
 vec2 xy=(packed*2.0-1.0)*bumpScale;
 // Unity tangent normals use the original N texture RG; B is NOT a normal component.
 vec3 local=vec3(xy,sqrt(max(1.0-dot(xy,xy),0.001)));
 return normalize(mat3(t*inv,b*inv,n)*local);
}
float visibility() {
 if(shadowEnabled<0.5)return 1.0;
 vec3 q=vShadowCoord.xyz/vShadowCoord.w*0.5+0.5;
 if(q.x<0.0||q.x>1.0||q.y<0.0||q.y>1.0||q.z>1.0)return 1.0;
 float result=0.0;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  float depth=texture2D(shadowMap,q.xy+vec2(float(x),float(y))/2048.0).r;
  result+=step(q.z-0.00035,depth);
 }
 return result/9.0;
}
void main() {
 vec4 base=texture2D(colorMap,vTex);
 if (base.a < alphaCutoff) discard;
 vec4 packed=texture2D(materialMap,vTex);
 int id=isFace>0.5 ? 0 : materialIndex(packed.r);
 #ifdef OUTLINE_PASS
 gl_FragColor=vec4(outlineColors[id]*0.68,1.0);
 #else
 vec4 lightData=texture2D(lightMap,vTex);
 vec3 n=normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0);
 if(isFace<0.5) n=mappedNormal(n,lightData.rg);
 vec3 view=normalize(-vPosition), l=normalize(lightDirection);
 float nl=dot(n,l);
 float lighting;
 if(isFace>0.5) {
   vec3 horizontal=normalize(vec3(worldLight.x,0.0,worldLight.z));
   vec3 forward=normalize(vec3(headForward.x,0.0,headForward.z));
   vec3 right=normalize(vec3(headRight.x,0.0,headRight.z));
   vec2 faceUV=vTex;
   if(dot(right,horizontal)<0.0) faceUV.x=1.0-faceUV.x;
   vec4 face=texture2D(lightMap,faceUV);
   float threshold=1.0-(dot(forward,horizontal)*0.5+0.5);
   lighting=smoothstep(threshold-0.08,threshold+0.08,face.r*0.9+0.1);
 } else {
   // Original N.B is the authored diffuse bias / occlusion mask.
   float signal=nl+(lightData.b*2.0-1.0)*2.0;
   lighting=smoothstep(0.333-smoothness,0.333+smoothness,signal);
 }
 lighting*=mix(0.3,1.0,visibility());
 float mid=isFace>0.5 ? lighting : smoothstep(-0.333-smoothness,-0.333+smoothness,nl+(lightData.b*2.0-1.0)*2.0);
 vec3 tint=mix(shadowColors[id],shallowColors[id],mid);
 tint=mix(tint,vec3(1.0),lighting);
 vec3 result=base.rgb*tint;
 if(isFace<0.5) {
   vec3 halfDirection=normalize(l+view);
   float shine=pow(max(dot(n,halfDirection),0.0),mix(24.0,128.0,lightData.a*glossiness));
   // Authored highlight-shape branch: use the packed mask as the boundary,
   // rather than applying the same threshold to every character's hair.
   float shaped=clamp((packed.b-1.0+(dot(n,halfDirection)*0.5+0.5)*clamp(nl*1.5+0.5,0.0,1.0))/max(shapeSoftness[id],0.001),0.0,1.0);
   float spec=mix(shine*packed.b,shaped,step(0.5,highlightShapes[id]));
   result+=specularColors[id]*specIntensity*spec*lighting;
   vec2 matUV=n.xy*0.5+0.5;
   vec3 reflection=texture2D(matcapMap,matUV).rgb;
   result+=reflection*packed.g*metallic*matcapStrength*0.22;
   float rim=smoothstep(0.62,0.92,1.0-max(dot(n,view),0.0));
   float side=smoothstep(-0.1,0.7,dot(n,normalize(vec3(-l.x,0.25,-l.z))));
   result+=mix(rimShadowColors[id],rimColors[id],lighting)*rim*side*0.10;
   result=mix(result,base.rgb*emissionColors[id],packed.a*emissionStrength);
 }
 gl_FragColor=vec4(result,1.0);
 #endif
 #include <colorspace_fragment>
}`;

const textureLoader = new T.TextureLoader();
const profiles = new Map();
const light = new T.Vector3(-0.35, 0.65, 0.85).normalize();
const white = new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;
const black = new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.needsUpdate=true;
const prefixes={anby:'Anbi',corin:'Corin',nicole:'Nostradamus',miyabi:'Unagi'};
async function readJSON(url) {const r=await fetch(url);if(!r.ok)throw new Error(`材质参数 ${r.status}: ${url}`);return r.json();}
async function loadTexture(url) {
 const t=await textureLoader.loadAsync(url);t.flipY=false;t.colorSpace=T.NoColorSpace;
 t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;
}
async function profile(character,part) {
 const key=`${character}/${part}`;
 if(!profiles.has(key)) profiles.set(key,(async()=>{
  const prefix=prefixes[character],dir=`./assets/models/${character}/shading/`;
  const special=character==='anby'&&part==='Weapon'?'Weapon_Fire':character==='nicole'&&part==='Body'?'Body_T':part;
  const config=await readJSON(`${dir}MAT_${prefix}_${special}_UI.json`);
  const face=part==='Face';const suffix=character==='nicole'&&part==='Body'?'_CN':'';
  const [normal,mask]=await Promise.all([
   loadTexture(dir+(face?'Famale_Face_lightmap.png':`${prefix}_${part}_N${suffix}.png`)),
   face?Promise.resolve(white):loadTexture(`${dir}${prefix}_${part}_M${suffix}.png`)
  ]);
  // Only sample a MatCap when a matching source map is present.
  const matcap=part==='Body'?await loadTexture(dir+(character==='nicole'?'Nostradamus_Body_MatCap_Tex.png':'Metal_MatCap.png')):black;
  return {config:config.m_SavedProperties,normal,mask,matcap,face};
 })().catch(e=>{profiles.delete(key);throw e;}));
 return profiles.get(key);
}
function colors(values,name,fallback) {
 return Array.from({length:5},(_,i)=>{const c=values[name+(i?i+1:'')]??values[name]??fallback;const value=new T.Vector3(c.r,c.g,c.b);if(name==='_OutlineColor'){const linear=new T.Color().setRGB(c.r,c.g,c.b,T.SRGBColorSpace);value.set(linear.r,linear.g,linear.b);}return value;});
}
function numbers(values,name,fallback){return Array.from({length:5},(_,i)=>values[name+(i?i+1:'')]??values[name]??fallback);}
function smoothOutlineNormals(geometry) {
 if(geometry.hasAttribute('outlineNormal'))return;
 const p=geometry.attributes.position,n=geometry.attributes.normal,groups=new Map();
 // Weld only the extrusion direction, never positions/UVs/skinning or authored shading normals.
 for(let i=0;i<p.count;i++){
  const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join('/');
  if(!groups.has(k))groups.set(k,{normal:new T.Vector3(),indices:[]});
  const g=groups.get(k);g.normal.add(new T.Vector3().fromBufferAttribute(n,i));g.indices.push(i);
 }
 const result=new Float32Array(p.count*3);
 for(const g of groups.values()){g.normal.normalize();for(const i of g.indices)g.normal.toArray(result,i*3);}
 geometry.setAttribute('outlineNormal',new T.BufferAttribute(result,3));
}

export async function prepareToon(model,character) {
 if(model.userData.toon)return model.userData.toon;
 const meshes=[];model.traverse(node=>{if(node.isMesh)meshes.push(node);});
 const records=await Promise.all(meshes.map(async mesh=>{
  const sourceMaterialName=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).name;
  const materialName=/face|hair|weapon|body/i.test(sourceMaterialName)?sourceMaterialName:mesh.name;
  const part=/face/i.test(materialName)?'Face':/hair/i.test(materialName)?'Hair':/weapon/i.test(materialName)?'Weapon':'Body';
  const p=await profile(character,part),f=p.config.m_Floats,c=p.config.m_Colors;
  const original=mesh.material;const map=(Array.isArray(original)?original[0]:original).map;
  map.colorSpace=T.SRGBColorSpace;
  const uniforms={colorMap:{value:map},lightMap:{value:p.normal},materialMap:{value:p.mask},matcapMap:{value:p.matcap},
   lightDirection:{value:light.clone()},worldLight:{value:light},headForward:{value:new T.Vector3(0,0,1)},headRight:{value:new T.Vector3(1,0,0)},
   shadowColors:{value:colors(c,'_ShadowColor',{r:.65,g:.65,b:.72})},shallowColors:{value:colors(c,'_ShallowColor',{r:.8,g:.8,b:.85})},
   outlineColors:{value:colors(c,'_OutlineColor',{r:.1,g:.1,b:.15})},specularColors:{value:colors(c,'_SpecularColor',{r:1,g:1,b:1})},rimColors:{value:colors(c,'_RimGlowLightColor',{r:.7,g:.8,b:1})},
   highlightShapes:{value:numbers(f,'_HighlightShape',0)},shapeSoftness:{value:numbers(f,'_ShapeSoftness',.1)},glossiness:{value:f._Glossiness??1},rimShadowColors:{value:colors(c,'_RimGlowShadowColor',{r:.6,g:.7,b:.8})},emissionColors:{value:colors(c,'_EmissionColor',{r:1,g:1,b:1})},emissionStrength:{value:f._Emission??0},isFace:{value:p.face?1:0},isHair:{value:part==='Hair'?1:0},bumpScale:{value:f._BumpScale??1},specIntensity:{value:f._SpecIntensity??.1},metallic:{value:f._Metallic??0},
   matcapStrength:{value:f._MatCap??0},smoothness:{value:Math.max(f._AlbedoSmoothness??.1,.04)},alphaCutoff:{value:f._AlphaClip?f._Cutoff:0},
   shadowMap:{value:white},shadowEnabled:{value:0},shadowMatrix:{value:new T.Matrix4()},shadowNormalBias:{value:.002},viewport:{value:new T.Vector2(innerWidth,innerHeight)},outlineWidth:{value:(p.face?.6:1.0)*(f._OutlineWidth??1)}};
  const toon=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,side:T.DoubleSide});toon.name=`ZZZ_${character}_${part}`;
  smoothOutlineNormals(mesh.geometry);
  const ink=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,defines:{OUTLINE_PASS:1},side:T.BackSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const outline=mesh.isSkinnedMesh?new T.SkinnedMesh(mesh.geometry,ink):new T.Mesh(mesh.geometry,ink);
  outline.name=mesh.name+'_outline';outline.position.copy(mesh.position);outline.quaternion.copy(mesh.quaternion);outline.scale.copy(mesh.scale);
  if(mesh.isSkinnedMesh){outline.bindMode=mesh.bindMode;outline.skeleton=mesh.skeleton;outline.bindMatrix.copy(mesh.bindMatrix);outline.bindMatrixInverse.copy(mesh.bindMatrixInverse);}
  outline.morphTargetInfluences=mesh.morphTargetInfluences;outline.morphTargetDictionary=mesh.morphTargetDictionary;
  outline.frustumCulled=false;mesh.frustumCulled=false;mesh.parent.add(outline);
  return {mesh,original,toon,outline,uniforms};
 }));
 const head=model.getObjectByName('Bip001_Head')??model.getObjectByName('Bip001 Head');
 model.updateMatrixWorld(true);
 const initial=head?head.getWorldQuaternion(new T.Quaternion()).invert():new T.Quaternion();
 const delta=new T.Quaternion(),forward=new T.Vector3(),right=new T.Vector3();
 const api={
  setEnabled(enabled){for(const r of records){r.mesh.material=enabled?r.toon:r.original;r.outline.visible=enabled;}},
  setShadow(texture,matrix,bias){for(const r of records){r.uniforms.shadowMap.value=texture;r.uniforms.shadowMatrix.value.copy(matrix);r.uniforms.shadowNormalBias.value=bias;r.uniforms.shadowEnabled.value=1;}},
  setOutlinesVisible(visible){for(const r of records)r.outline.visible=visible;},
  update(camera){
   if(head)delta.copy(head.getWorldQuaternion(new T.Quaternion())).multiply(initial);
   forward.set(0,0,1).applyQuaternion(delta);right.set(1,0,0).applyQuaternion(delta);
   for(const r of records){r.uniforms.headForward.value.copy(forward);r.uniforms.headRight.value.copy(right);r.uniforms.lightDirection.value.copy(light).transformDirection(camera.matrixWorldInverse);r.uniforms.viewport.value.set(innerWidth,innerHeight);}
  }
 };
 model.userData.toon=api;api.setEnabled(true);return api;
}
