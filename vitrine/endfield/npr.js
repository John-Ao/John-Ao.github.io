import * as THREE from './vendor/three.module.js';

// Hybrid character lighting driven by the original material textures. This is
// an independent WebGL implementation, not the game's proprietary shader code.
export async function applyCharacterLighting(material, extras, texture, context) {
  const f = extras.floats || {}, c = extras.colors || {};
  const shader = extras.shader || '';
  const skin = shader.endsWith('_Skin'), hair = shader.endsWith('_Hair'), eye = shader.endsWith('_Eye');
  const maps = {};
  const requests = {
    efRamp: f._UseDiffRampMap !== 0 ? '_DiffRampMap' : null,
    efSpecRamp: f._UseSpecRampMap === 1 ? '_SpecRampMap' : null,
    efShadowLut: f._UseShadowLutTex === 1 ? '_ShadowLutTex' : null,
    efSdf: skin ? '_SDFLightmap' : null,
    efFaceMask: skin ? '_SDFMask' : null,
    efHighlight: skin && f._FaceHighlightMap === 1 ? '_HighlightMap' : null,
    efHairNormal: hair ? '_SplitNormalMap' : null,
    efHairLine: hair && f._SpecularLine === 1 ? '_LineMap' : null,
    efMatcap: f._UseMatcap === 1 ? '_MatcapTex' : null,
  };
  await Promise.all(Object.entries(requests).map(async ([key, name]) => {
    if (!name) return;
    const map = await texture(name, true);
    if (map) { maps[key] = map; material[key] = map; }
  }));
  for (const key of ['efRamp', 'efSpecRamp', 'efShadowLut']) if (maps[key]) {
    maps[key].wrapS = maps[key].wrapT = THREE.ClampToEdgeWrapping;
    maps[key].generateMipmaps = false;
    maps[key].minFilter = maps[key].magFilter = THREE.LinearFilter;
  }
  const face = Boolean(maps.efSdf);
  if (maps.efHairNormal) { material.normalMap = maps.efHairNormal; material.normalScale.set(1, 1); }
  if (face) material.normalScale.set(0.12, 0.12);
  material.envMap = context.environment;
  material.envMapIntensity = skin || eye ? 0 : hair ? 0.04 : 0.35;
  material.userData.endfieldLighting = face ? 'face-sdf' : skin ? 'skin' : hair ? 'hair' : eye ? 'eye' : 'cloth';
  material.userData.endfieldMaps = Object.keys(maps);
  const priorCompile = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey();
  const uniforms = {
    efHeadForward: { value: context.forward }, efHeadRight: { value: context.right },
    efShadowBrightness: { value: f._ShadowColorBrightness ?? 0.5 },
    efShadowSaturation: { value: f._ShadowColorSaturation ?? 1 },
    efSpecular: { value: f._Specular ?? 1 },
    efEyeHighlight: { value: new THREE.Vector3().fromArray(c._EyeHighLightColor || [1, 1, 1]) },
    efEyeScattering: { value: new THREE.Vector3().fromArray(c._EyeScatteringColor || [1, 1, 1]) },
    efMatcapColor: { value: new THREE.Vector4().fromArray(c._MatcapColor || [1, 1, 1, 1]) },
  };
  for (const [key, map] of Object.entries(maps)) uniforms[key] = { value: map };
  const defines = [face && 'EF_FACE', skin && 'EF_SKIN', hair && 'EF_HAIR', eye && 'EF_EYE',
    eye && f._EyeHighLight === 1 && 'EF_IRIS', ...Object.keys(maps).map(k => `HAS_${k}`)].filter(Boolean);
  material.onBeforeCompile = program => {
    priorCompile(program);
    Object.assign(program.uniforms, uniforms);
    program.vertexShader = 'varying vec2 efUv;\n' + program.vertexShader;
    program.vertexShader = program.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nefUv = uv;');
    program.fragmentShader = defines.map(x => `#define ${x}`).join('\n') + '\n' + declarations(maps) + program.fragmentShader;
    program.fragmentShader = program.fragmentShader.replace('void main() {',
      directLighting + '\n#undef RE_Direct\n#define RE_Direct EndfieldDirect\nvoid main() {');
    program.fragmentShader = program.fragmentShader.replace('#include <lights_physical_fragment>', `
      efSpecNormal = normal;
      #ifdef HAS_efHairNormal
        vec2 specXY = texture2D(efHairNormal, efUv).ba * 2.0 - 1.0;
        specXY *= normalScale;
        efSpecNormal = normalize(tbn * vec3(specXY, sqrt(max(1.0 - dot(specXY, specXY), 0.001))));
      #endif
      #include <lights_physical_fragment>
    `);
    program.fragmentShader = program.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      #if !defined(EF_SKIN) && !defined(EF_EYE) && !defined(EF_HAIR)
        reflectedLight.indirectDiffuse *= 0.45;
      #endif
    `);
    program.fragmentShader = program.fragmentShader.replace('#include <opaque_fragment>', `${eyeLighting}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `endfield-hybrid-v2:${priorKey}:${defines.join(',')}`;
  material.needsUpdate = true;
}

function declarations(maps) {
  return `
    varying vec2 efUv;
    uniform vec3 efHeadForward, efHeadRight;
    uniform float efShadowBrightness, efShadowSaturation, efSpecular;
    uniform vec3 efEyeHighlight, efEyeScattering;
    uniform vec4 efMatcapColor;
    vec3 efSpecNormal;
    ${Object.keys(maps).map(k => `uniform sampler2D ${k};`).join('\n')}
    ${shadowColorGLSL}
  `;
}

const directLighting = `
void EndfieldDirect(const in IncidentLight light, const in vec3 position, const in vec3 normal,
  const in vec3 viewDir, const in vec3 clearcoatNormal, const in PhysicalMaterial mat, inout ReflectedLight reflected) {
  vec3 beforeDiffuse = reflected.directDiffuse;
  vec3 beforeSpecular = reflected.directSpecular;
  RE_Direct_Physical(light, position, normal, viewDir, clearcoatNormal, mat, reflected);
  float halfLambert = dot(normal, light.direction) * 0.5 + 0.5;
  float shade = halfLambert;
  #ifdef EF_FACE
    vec3 worldLight = inverseTransformDirection(light.direction, viewMatrix);
    float side = dot(worldLight, efHeadRight);
    float front = dot(worldLight, efHeadForward);
    float threshold = abs(atan(side, front)) / PI;
    vec2 sdfUv = efUv;
    if (side < 0.0) sdfUv.x = 1.0 - sdfUv.x;
    vec4 sdf = texture2D(efSdf, sdfUv);
    float faceLit = smoothstep(threshold - 0.035, threshold + 0.035, (sdf.r + sdf.g) * 0.5);
    shade = faceLit;
    #ifdef HAS_efFaceMask
      vec4 faceMask = texture2D(efFaceMask, efUv);
      float chin = faceMask.g;
      shade = min(shade, mix(1.0, smoothstep(0.2, 0.75, halfLambert), chin));
      shade = min(shade, 1.0 - faceMask.r * 0.3);
    #endif
  #elif defined(EF_EYE)
    shade = 1.0;
  #endif
  vec4 ramp = vec4(vec3(shade), shade);
  #ifdef HAS_efRamp
    ramp = texture2D(efRamp, vec2(clamp(shade, 0.0, 1.0), 0.5));
  #endif
  vec3 shadow = efShadowColor(mat.diffuseColor);
  vec3 diffuse = mix(shadow, mat.diffuseColor, ramp.a);
  diffuse *= mix(vec3(1.0), ramp.rgb, 0.25);
  #ifdef EF_SKIN
    diffuse *= 1.42;
  #elif defined(EF_HAIR)
    diffuse *= 0.72;
  #endif
  #ifdef USE_METALNESSMAP
    vec4 packed = texture2D(metalnessMap, vMetalnessMapUv);
    diffuse *= mix(0.35, 1.0, packed.b);
  #endif
  reflected.directDiffuse = beforeDiffuse + diffuse * light.color * RECIPROCAL_PI;
  #if defined(EF_SKIN) || defined(EF_EYE)
    reflected.directSpecular = beforeSpecular + (reflected.directSpecular - beforeSpecular) * efSpecular;
    #ifdef HAS_efHighlight
      reflected.directSpecular += texture2D(efHighlight, efUv + vec2(dot(viewDir, mat3(viewMatrix) * efHeadRight) * 0.02, 0.0)).rrr * 0.6 * light.color * RECIPROCAL_PI;
    #endif
  #elif defined(EF_HAIR)
    vec3 headUp = normalize(mat3(viewMatrix) * normalize(cross(efHeadForward, efHeadRight)));
    vec3 strand = normalize(headUp - efSpecNormal * dot(headUp, efSpecNormal));
    vec3 h = normalize(light.direction + viewDir);
    float tangentH = dot(strand, h);
    float lobe = pow(sqrt(max(0.0, 1.0 - tangentH * tangentH)), 128.0);
    float mask = 1.0;
    #ifdef USE_METALNESSMAP
      mask = texture2D(metalnessMap, vMetalnessMapUv).g;
    #endif
    #ifdef HAS_efHairLine
      mask *= mix(0.5, 1.0, texture2D(efHairLine, efUv).r);
    #endif
    vec3 spec = vec3(lobe);
    #ifdef HAS_efSpecRamp
      spec = texture2D(efSpecRamp, vec2(lobe * 0.55, 1.0 - clamp(dot(normal, viewDir), 0.0, 1.0))).rgb * lobe;
    #endif
    reflected.directSpecular = beforeSpecular + spec * mask * light.color * 0.28;
  #else
    vec3 spec = (reflected.directSpecular - beforeSpecular) * efSpecular;
    #ifdef HAS_efSpecRamp
      vec3 h = normalize(light.direction + viewDir);
      spec *= texture2D(efSpecRamp, vec2(clamp(dot(normal, h), 0.0, 1.0), 1.0 - mat.roughness)).rgb;
    #endif
    reflected.directSpecular = beforeSpecular + spec;
  #endif
}
`;

const eyeLighting = `
#ifdef EF_IRIS
  float irisMask = 0.0;
  #ifdef USE_MAP
    irisMask = texture2D(map, vMapUv).a;
  #endif
  outgoingLight *= mix(vec3(1.0), efEyeScattering, irisMask);
  outgoingLight += diffuseColor.rgb * efEyeHighlight * irisMask * 0.32;
  #ifdef HAS_efMatcap
    vec3 eyeNormal = normal;
    vec3 viewDirection = normalize(vViewPosition);
    vec3 eyeX = normalize(vec3(viewDirection.z, 0.0, -viewDirection.x));
    vec3 eyeY = cross(viewDirection, eyeX);
    vec2 matcapUv = vec2(dot(eyeX, eyeNormal), dot(eyeY, eyeNormal)) * 0.495 + 0.5;
    vec4 reflection = texture2D(efMatcap, matcapUv);
    outgoingLight += reflection.rgb * efMatcapColor.rgb * efMatcapColor.a;
  #endif
#endif
`;

// Shared with the GPU LUT regression check.
export const shadowColorGLSL = `
    vec3 efLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
    vec3 efGamma(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
    vec3 efShadowColor(vec3 base) {
      #ifdef HAS_efShadowLut
        vec3 p = clamp(efGamma(base), 0.0, 1.0) * 31.0;
        float slice = floor(p.b);
        // Exported LUT rows run from green=1 at the top to green=0 at
        // the bottom. GLTF image uploads use flipY=false; invert only LUT Y.
        vec2 a = vec2((slice * 32.0 + p.r + 0.5) / 1024.0, 1.0 - (p.g + 0.5) / 32.0);
        vec2 b = vec2((min(slice + 1.0, 31.0) * 32.0 + p.r + 0.5) / 1024.0, a.y);
        return efLinear(mix(texture2D(efShadowLut, a).rgb, texture2D(efShadowLut, b).rgb, fract(p.b)));
      #else
        float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
        return max(vec3(0.0), mix(vec3(lum), base, efShadowSaturation)) * efShadowBrightness;
      #endif
    }
`;
