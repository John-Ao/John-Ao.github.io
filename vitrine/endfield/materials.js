import * as THREE from './vendor/three.module.js';
import { applyCharacterLighting } from './npr.js';
import { addOutline } from './outlines.js';
import { addEyeLayer } from './eye-layer.js';

// Source material decoding, with hybrid NPR lighting in npr.js and separate
// outline / under-hair eye passes. The packed textures remain unmodified.
export async function prepareMaterials(gltf, renderer, environment = null) {
  const parser = gltf.parser;
  const definitions = parser?.json?.materials || [];
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const pending = new Map();
  const meshes = [];
  gltf.scene.updateMatrixWorld(true);
  const head = gltf.scene.getObjectByName('Head_Local') || gltf.scene.getObjectByName('Head');
  const bindInverse = head ? head.getWorldQuaternion(new THREE.Quaternion()).invert() : new THREE.Quaternion();
  const context = { environment, forward: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0) };
  const orientation = new THREE.Quaternion();
  let lastFrame = -1;
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    meshes.push(object);
    for (const material of list(object.material)) {
      if (pending.has(material)) continue;
      const index = parser?.associations?.get(material)?.materials;
      const definition = definitions[index] || definitions.find(x => x.name === material.name);
      pending.set(material, adapt(material, definition || {}, parser, anisotropy, context));
    }
  });
  const prepared = new Map();
  await Promise.all([...pending].map(async ([original, promise]) => prepared.set(original, await promise)));
  for (const object of meshes) {
    object.onBeforeRender = () => {
      if (!head || lastFrame === renderer.info.render.frame) return;
      lastFrame = renderer.info.render.frame;
      head.getWorldQuaternion(orientation).multiply(bindInverse);
      context.forward.set(0, 0, 1).applyQuaternion(orientation);
      context.right.set(1, 0, 0).applyQuaternion(orientation);
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(material => prepared.get(material))
      : prepared.get(object.material);
    object.receiveShadow = list(object.material).some(material =>
      ['cloth', 'hair'].includes(material.userData.endfieldLighting) && !material.transparent);
    if (list(object.material).some(material => material.userData.endfieldOverlay)) {
      object.castShadow = false;
      object.renderOrder = 2;
    }
    if (list(object.material).some(material => material.userData.endfieldVFX)) {
      object.castShadow = false;
      object.renderOrder = list(object.material).every(material => !material.colorWrite) ? -1 : 1;
    }
    addOutline(object, renderer);
    addEyeLayer(object);
  }
}

const list = value => Array.isArray(value) ? value : [value];
const clamp = THREE.MathUtils.clamp;
const number = (value, fallback) => Number.isFinite(value) ? value : fallback;

async function adapt(material, definition, parser, anisotropy, context) {
  const extras = definition.extras || material.userData || {};
  if (!extras.shader?.startsWith('HGRP/CharacterNPR') && !extras.vfx) return material;
  const floats = extras.floats || {};
  const colors = extras.colors || {};
  const shader = extras.shader || '';
  const skin = shader.endsWith('_Skin');
  const hair = shader.endsWith('_Hair');
  const eye = shader.endsWith('_Eye');
  material.stencilWrite = true;
  material.stencilWriteMask = 1;
  material.stencilRef = hair ? 1 : 0;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilZPass = THREE.ReplaceStencilOp;

  async function texture(name, forceData = false, namespace = extras) {
    const entry = namespace.textures?.[name];
    const index = typeof entry === 'number' ? entry : entry?.index;
    if (!Number.isInteger(index) || !parser) return null;
    try {
      const source = await parser.getDependency('texture', index);
      if (!source) return null;
      const map = source.clone();
      const srgb = entry?.srgb ?? namespace.srgb?.includes(name) ?? false;
      map.colorSpace = !forceData && srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      map.flipY = false;
      map.anisotropy = anisotropy;
      const st = namespace.st?.[name];
      const scale = entry?.scale || st?.slice(0, 2);
      const offset = entry?.offset || st?.slice(2, 4);
      if (scale) map.repeat.fromArray(scale);
      if (offset) map.offset.fromArray(offset);
      map.needsUpdate = true;
      return map;
    } catch (error) {
      // Auxiliary texture failures should not hide the loaded base model.
      console.warn(`Optional material texture ${name} unavailable`, error);
      return null;
    }
  }

  if (extras.vfx) {
    // Minimal source-driven VFX pass: exported main/mask textures and UV ST.
    // Distortion, screen-space sampling, animated blending, and soft particles
    // require the game's pipeline and are deliberately not synthesized here.
    const source = extras.vfx;
    const mainAsAlpha = floats._UseMainTexAsAlpha === 1;
    const [map, mask] = await Promise.all([
      texture('_MainTex', mainAsAlpha, source),
      floats._UseMask === 1 ? texture('_MaskTex', true, source) : null,
    ]);
    const depthOnly = floats._ColorMask === 0 || /depthonly/i.test(`${shader} ${material.name}`);
    const tint = colors._TintColor || colors._BaseColor || [1, 1, 1, 1];
    const effect = new THREE.MeshBasicMaterial({
      name: material.name,
      map,
      alphaMap: mask,
      color: new THREE.Color().fromArray(tint).multiplyScalar(number(floats._TintColorIntensity, 1)),
      opacity: Math.max(0, number(tint[3], 1) * number(floats._TintColorAlpha, 1)),
      transparent: !depthOnly,
      depthWrite: floats._ZWrite === 1,
      depthTest: floats._DisableZTest !== 1,
      colorWrite: !depthOnly,
      alphaTest: depthOnly ? number(floats._ZWriteAlphaThreshold, 0.5)
        : floats._EnableAlphaTest === 1 ? number(floats._AlphaClipThreshold, 0.5) : 0,
      side: floats._CullMode === 2 ? THREE.FrontSide : floats._CullMode === 1 ? THREE.BackSide : THREE.DoubleSide,
      vertexColors: material.vertexColors && floats._DisableVertColor !== 1,
      toneMapped: floats._IgnorePostExposure !== 1,
    });
    const maskChannel = floats._UseMaskTexAsAlpha === 1
      ? ['r', 'g', 'b', 'a'][clamp(Math.round(number(floats._AlphaMaskChannel, 0)), 0, 3)] : 'a';
    effect.userData = { ...material.userData, endfieldVFX: true, endfieldVFXMode: 'main-mask-static' };
    effect.onBeforeCompile = program => {
      if (mainAsAlpha) {
        program.fragmentShader = program.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            diffuseColor.a *= texture2D(map, vMapUv).r;
          #endif
        `);
      }
      if (mask) {
        program.fragmentShader = program.fragmentShader.replace('#include <alphamap_fragment>', `
          #ifdef USE_ALPHAMAP
            diffuseColor.a *= texture2D(alphaMap, vAlphaMapUv).${maskChannel};
          #endif
        `);
      }
    };
    effect.customProgramCacheKey = () => `endfield-vfx-main-mask-v1:${mainAsAlpha}:${maskChannel}:${Boolean(mask)}`;
    material.dispose();
    return effect;
  }

  if (shader.endsWith('_OverlayShadow')) {
    // These are thin overlay polygons, not cyan/black opaque surfaces. Exported
    // masks store shadow transmittance in R; white means no added shadow.
    const mask = material.map?.clone();
    if (mask) { mask.colorSpace = THREE.NoColorSpace; mask.needsUpdate = true; }
    const overlay = new THREE.MeshBasicMaterial({
      name: material.name,
      color: new THREE.Color().fromArray(colors._BaseColor || [0.65, 0.6, 0.57]),
      alphaMap: mask || null,
      transparent: true,
      opacity: 1,
      blending: THREE.CustomBlending,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    overlay.userData = { ...material.userData, endfieldOverlay: true };
    overlay.onBeforeCompile = program => {
      program.fragmentShader = program.fragmentShader.replace('#include <alphamap_fragment>', `
        #ifdef USE_ALPHAMAP
          float shadowCoverage = 1.0 - texture2D(alphaMap, vAlphaMapUv).r;
          diffuseColor.rgb = mix(vec3(1.0), diffuseColor.rgb, clamp(shadowCoverage, 0.0, 1.0));
          diffuseColor.a = 1.0;
        #endif
      `);
    };
    overlay.customProgramCacheKey = () => 'endfield-overlay-red-transmittance-v1';
    overlay.toneMapped = false;
    material.dispose();
    return overlay;
  }

  if (material.map) {
    material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.anisotropy = anisotropy;
  }
  if (colors._BaseColor) material.color.fromArray(colors._BaseColor);
  if (eye && colors._EyeTintColor) material.color.multiply(new THREE.Color().fromArray(colors._EyeTintColor));
  material.side = floats._Cull === 0 ? THREE.DoubleSide : floats._Cull === 1 ? THREE.BackSide : THREE.FrontSide;
  material.metalness = clamp(number(floats._Metallic, 0), 0, 1);
  material.roughness = clamp(1 - number(floats._Smoothness, 0.35), skin ? 0.65 : eye ? 0.22 : 0.3, 1);
  material.envMapIntensity = hair ? 0.4 : 0.6;

  // Alpha channels also hold non-opacity data in eyes and opaque hair. Follow
  // the material's explicit blend/mask mode instead of inferring from pixels.
  const blended = definition.alphaMode === 'BLEND' || floats._SurfaceType === 1;
  const cutout = definition.alphaMode === 'MASK' || floats._EnableAlphaTest === 1 || floats._AlphaClip === 1;
  material.transparent = blended;
  material.depthWrite = !blended;
  material.opacity = clamp(number(colors._BaseColor?.[3], 1), 0, 1);
  material.alphaTest = cutout ? clamp(number(floats._AlphaClipThreshold, definition.alphaCutoff ?? 0.5), 0, 1) : blended ? 0.01 : 0;
  if (blended && hair) material.forceSinglePass = true;

  const [normalMap, packedMap, emissionMap, extraAlphaMap] = await Promise.all([
    floats._UseBumpMap !== 0 ? texture('_BumpMap', true) : null,
    !skin && !eye && floats._UseMetallicGlossMap !== 0 ? texture('_MetallicGlossMap', true) : null,
    floats._UseEmission === 1 ? texture('_EmissionMap') : null,
    texture('_ExtraAlphaMask', true),
  ]);
  if (normalMap) {
    material.normalMap = normalMap;
    const strength = clamp(number(floats._BumpScale, 1), 0, 2) * (skin ? 0.45 : 0.7);
    material.normalScale.set(strength, strength);
  }
  if (packedMap) {
    material.metalnessMap = packedMap;
    material.roughnessMap = packedMap;
    material.metalness = hair ? 0 : 1;
  }
  if (emissionMap) {
    material.emissiveMap = emissionMap;
    material.emissive.fromArray(colors._EmissionColor || [1, 1, 1]);
    material.emissiveIntensity = clamp(number(floats._EmissionBrightness, 1), 0, 5);
  }
  if (extraAlphaMap) {
    // Fur-card masks pack strand coverage in R (also duplicated in A). G/B
    // contain root/tip gradients and cannot be used as Three's default alpha.
    material.alphaMap = extraAlphaMap;
    if (!material.alphaTest) material.alphaTest = clamp(number(floats._AlphaClipThreshold, 0.45), 0.01, 1);
  }
  const smoothness = clamp(number(floats._Smoothness, 0.5), 0, 1);
  material.onBeforeCompile = program => {
    if (extraAlphaMap) {
      program.fragmentShader = program.fragmentShader.replace('#include <alphamap_fragment>',
        THREE.ShaderChunk.alphamap_fragment.replace('vAlphaMapUv ).g', 'vAlphaMapUv ).r'));
    }
    if (material.normalMap) {
      const normalChunk = THREE.ShaderChunk.normal_fragment_maps.replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        `vec2 packedXY = texture2D(normalMap, vNormalMapUv).rg * 2.0 - 1.0;
         vec3 mapN = vec3(packedXY, sqrt(max(1.0 - dot(packedXY, packedXY), 0.0001)));`
      );
      program.fragmentShader = program.fragmentShader.replace('#include <normal_fragment_maps>', normalChunk);
    }
    if (packedMap) {
      program.uniforms.endfieldSmoothness = { value: smoothness };
      program.fragmentShader = 'uniform float endfieldSmoothness;\n' + program.fragmentShader;
      program.fragmentShader = program.fragmentShader
        .replace('#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment.replace('texelMetalness.b', 'texelMetalness.r'))
        .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('roughnessFactor *= texelRoughness.g;', 'roughnessFactor = clamp(1.0 - texelRoughness.a * endfieldSmoothness, 0.3, 1.0);'));
    }
  };
  material.customProgramCacheKey = () => `endfield-pbr-v2:${Boolean(normalMap)}:${Boolean(packedMap)}:${Boolean(extraAlphaMap)}`;
  await applyCharacterLighting(material, extras, texture, context);
  material.needsUpdate = true;
  return material;
}
