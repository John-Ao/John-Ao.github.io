import * as THREE from './vendor/three.module.js';

// Inverted hulls use the same skeleton, morph targets and alpha cutouts as the
// visible mesh. Width is in screen pixels, so zoom never creates thick ink.
export function addOutline(mesh, renderer) {
  if (Array.isArray(mesh.material)) return;
  const source = mesh.material;
  const f = source.userData.floats || {};
  if (!source.userData.endfieldLighting || f._EnableOutline !== 1 || !mesh.geometry.attributes.normal) return;
  const width = THREE.MathUtils.clamp(f._OutlineWidth ?? 0.5, 0, 1.5);
  if (!width || source.transparent) return;
  const outline = new THREE.MeshBasicMaterial({
    name: `${source.name}_outline`,
    map: source.map,
    alphaMap: source.alphaMap,
    alphaTest: source.alphaTest,
    color: new THREE.Color().copy(source.color).multiplyScalar(f._OutlineColorBrightness ?? 0.35),
    side: THREE.BackSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  outline.userData.endfieldOutline = true;
  const resolution = new THREE.Vector2();
  const uniforms = { efOutlineResolution: { value: resolution }, efOutlineWidth: { value: width } };
  outline.onBeforeCompile = program => {
    Object.assign(program.uniforms, uniforms);
    program.vertexShader = 'uniform vec2 efOutlineResolution;\nuniform float efOutlineWidth;\n' + program.vertexShader;
    program.vertexShader = program.vertexShader.replace('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )', '#if 1');
    program.vertexShader = program.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      vec2 projectedNormal = (projectionMatrix * vec4(transformedNormal, 0.0)).xy;
      float normalLength = length(projectedNormal);
      if (normalLength > 0.0001) gl_Position.xy += projectedNormal / normalLength * (2.0 * efOutlineWidth / efOutlineResolution) * gl_Position.w;
    `);
    if (source.alphaMap) program.fragmentShader = program.fragmentShader.replace('#include <alphamap_fragment>',
      THREE.ShaderChunk.alphamap_fragment.replace('vAlphaMapUv ).g', 'vAlphaMapUv ).r'));
  };
  outline.customProgramCacheKey = () => `endfield-outline-v1:${Boolean(source.alphaMap)}`;
  const shell = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, outline) : new THREE.Mesh(mesh.geometry, outline);
  shell.name = `${mesh.name}_outline`;
  shell.userData.endfieldOutline = true;
  shell.frustumCulled = false;
  if (mesh.isSkinnedMesh) {
    shell.bind(mesh.skeleton, mesh.bindMatrix);
    shell.bindMode = mesh.bindMode;
  }
  if (mesh.morphTargetInfluences) shell.morphTargetInfluences = mesh.morphTargetInfluences;
  shell.onBeforeRender = () => renderer.getDrawingBufferSize(resolution);
  mesh.add(shell);
}
