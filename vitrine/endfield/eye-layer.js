import * as THREE from './vendor/three.module.js';

// The source hair and eyes use separate depth/stencil passes. Re-render only
// the eye pixels occluded by hair, never those hidden by the face, hands, or props.
export function addEyeLayer(mesh) {
  if (Array.isArray(mesh.material) || mesh.material.userData.endfieldLighting !== 'eye') return;
  const source = mesh.material;
  const layer = source.clone();
  layer.name = `${source.name}_under_hair`;
  layer.transparent = true;
  layer.opacity = /brow/i.test(source.name) ? 0.4 : 0.65;
  layer.depthFunc = THREE.GreaterDepth;
  layer.depthWrite = false;
  layer.stencilWrite = true;
  layer.stencilWriteMask = 0;
  layer.stencilFuncMask = 1;
  layer.stencilRef = 1;
  layer.stencilFunc = THREE.EqualStencilFunc;
  layer.stencilZPass = THREE.KeepStencilOp;
  layer.userData.endfieldEyeLayer = true;
  layer.onBeforeCompile = program => {
    source.onBeforeCompile(program);
    program.fragmentShader = program.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 eyeViewWorld = inverseTransformDirection(normalize(vViewPosition), viewMatrix);
      diffuseColor.a *= smoothstep(0.35, 0.8, dot(eyeViewWorld, efHeadForward));
      #include <opaque_fragment>
    `);
  };
  layer.customProgramCacheKey = () => `${source.customProgramCacheKey()}:under-hair-v1`;
  const surface = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, layer) : new THREE.Mesh(mesh.geometry, layer);
  surface.name = `${mesh.name}_under_hair`;
  surface.userData.endfieldEyeLayer = true;
  surface.frustumCulled = false;
  surface.renderOrder = 4;
  if (mesh.isSkinnedMesh) { surface.bind(mesh.skeleton, mesh.bindMatrix); surface.bindMode = mesh.bindMode; }
  if (mesh.morphTargetInfluences) surface.morphTargetInfluences = mesh.morphTargetInfluences;
  mesh.add(surface);
}
