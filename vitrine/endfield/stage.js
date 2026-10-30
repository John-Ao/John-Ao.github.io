import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/controls/OrbitControls.js';
import { prepareMaterials } from './materials.js';
import { CharacterProps } from './props.js';
import { RoomEnvironment } from './vendor/environments/RoomEnvironment.js';

export class CharacterStage {
  constructor(container, onProgress, onFrame) {
    this.container = container;
    this.onProgress = onProgress;
    this.onFrame = onFrame;
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => /\/textures\/[0-9a-f]{16}$/.test(url) ? `${url}.bin` : url);
    this.loader = new GLTFLoader(manager);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '角色实时三维视图；拖动旋转、滚轮缩放、右键平移');
    this.renderer.domElement.setAttribute('role', 'img');
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(environment, 0.04);
    this.environment.texture.userData.endfieldShared = true;
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.45;
    environment.dispose();
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(31, 1, 0.01, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI * 0.94;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xaaa7a7, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(-2, 4, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -4;
    key.shadow.camera.right = key.shadow.camera.top = 4;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.015;
    this.scene.add(key);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.16 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.005;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.grid = new THREE.GridHelper(16, 32, 0xb0b1a6, 0xd1d2c9);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.4;
    this.grid.position.y = -0.008;
    this.grid.visible = false;
    this.scene.add(this.grid);
    this.generation = 0;
    this.speed = 1;
    this.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.loop = true;
    this.clips = new Map();
    this.props = new CharacterProps(this);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
    document.addEventListener('visibilitychange', () => this.clock.getDelta());
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      container.dispatchEvent(new CustomEvent('stage-error', { detail: '图形上下文已丢失，请重新加载角色。' }));
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => container.dispatchEvent(new CustomEvent('stage-restored')));
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.setViewOffset(width, height, width > 700 ? Math.min(150, width * 0.1) : 0, 0, width, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  async fetchGLTF(url, signal, label) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`${label}加载失败（HTTP ${response.status}）`);
    const total = Number(response.headers.get('content-length'));
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); loaded += value.length;
      this.onProgress(label, total ? loaded / total : null, loaded);
    }
    const data = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    let buffer = data.buffer;
    // Static hosting does not need Content-Encoding configuration: gzip is an
    // ordinary asset container, decompressed locally before GLTF parsing.
    if (data[0] === 0x1f && data[1] === 0x8b) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
      buffer = await new Response(stream).arrayBuffer();
    }
    return this.loader.parseAsync(buffer, new URL('.', new URL(url, location.href)).href);
  }

  async load(character) {
    const generation = ++this.generation;
    this.abort?.abort();
    this.clipAbort?.abort();
    this.abort = new AbortController();
    this.clear();
    this.onProgress('载入角色模型', 0, 0);
    const gltf = await this.fetchGLTF(character.model, this.abort.signal, '载入角色模型');
    if (generation !== this.generation) { disposeScene(gltf.scene); return false; }
    this.character = character;
    this.model = gltf.scene;
    this.model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = false;
      object.frustumCulled = false;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material.map) material.map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        material.envMapIntensity = 0.6;
      }
    });
    await prepareMaterials(gltf, this.renderer, this.scene.environment);
    if (generation !== this.generation) { disposeScene(gltf.scene); return false; }
    this.scene.add(this.model);
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    this.height = size.y || 1.8;
    this.model.position.y -= box.min.y;
    this.center = box.getCenter(new THREE.Vector3());
    this.center.y = this.height * 0.5;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.mixer.addEventListener('finished', () => { this.playing = false; });
    for (const clip of gltf.animations) this.clips.set(clip.name, clip);
    await this.props.load(character, this.abort.signal);
    if (generation !== this.generation) return false;
    this.setView('front');
    this.onProgress('准备动作', 1, 0);
    return true;
  }

  async playClip(descriptor) {
    if (!this.model) return false;
    const generation = this.generation;
    this.clipAbort?.abort();
    const abort = this.clipAbort = new AbortController();
    let clip = this.clips.get(descriptor.name);
    if (!clip) {
      const gltf = await this.fetchGLTF(descriptor.url, abort.signal, '载入骨骼动画');
      if (generation !== this.generation || abort.signal.aborted) { disposeScene(gltf.scene); return false; }
      clip = gltf.animations.find(x => x.name === descriptor.name) || gltf.animations[0];
      // Animation-only GLBs carry a reference skeleton, which must not be displayed.
      disposeScene(gltf.scene);
      if (!clip) throw new Error('该文件没有可播放的骨骼动画。');
      this.clips.set(descriptor.name, clip);
    }
    await this.props.play(descriptor, abort.signal);
    if (generation !== this.generation || abort.signal.aborted) return false;
    this.mixer.stopAllAction();
    this.action = this.mixer.clipAction(clip);
    this.action.reset().setLoop(this.loop ? THREE.LoopRepeat : THREE.LoopOnce, this.loop ? Infinity : 1);
    this.action.clampWhenFinished = true;
    this.action.play();
    this.playing = true;
    this.mixer.update(0);
    this.props.update(0);
    return true;
  }

  setView(view) {
    const height = this.height || 1.8;
    const center = this.center || new THREE.Vector3(0, height / 2, 0);
    let distance = height * 2.5;
    if (this.camera.aspect < 0.8) distance *= 1.2;
    const target = center.clone();
    target.y = height * 0.52;
    if (view === 'face') {
      const head = this.model?.getObjectByName('Head_Local') || this.model?.getObjectByName('Head');
      if (head) {
        head.getWorldPosition(target);
        target.y += height * 0.045;
      } else target.y = height * 0.82;
      distance = height * 0.8;
    }
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new THREE.Vector3(0, height * 0.04, view === 'back' ? -distance : distance));
    this.controls.update();
  }

  seek(fraction) {
    if (!this.action) return;
    this.action.enabled = true;
    this.action.paused = false;
    this.action.time = THREE.MathUtils.clamp(fraction, 0, 0.999999) * this.action.getClip().duration;
    this.mixer.update(0);
    this.props.update(this.action.time);
  }

  setLoop(value) {
    this.loop = value;
    this.action?.setLoop(value ? THREE.LoopRepeat : THREE.LoopOnce, value ? Infinity : 1);
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (document.hidden) return;
    if (this.mixer && this.playing) this.mixer.update(dt * this.speed);
    if (this.action) this.props.update(this.action.time);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.action) this.onFrame(this.action.time, this.action.getClip().duration, this.playing);
  }

  screenshot(background) {
    this.renderer.render(this.scene, this.camera);
    const canvas = document.createElement('canvas');
    canvas.width = this.renderer.domElement.width;
    canvas.height = this.renderer.domElement.height;
    const context = canvas.getContext('2d');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(this.renderer.domElement, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  clear() {
    this.props?.clear();
    this.mixer?.stopAllAction();
    if (this.model) { this.mixer?.uncacheRoot(this.model); this.scene.remove(this.model); disposeScene(this.model); }
    this.model = null; this.mixer = null; this.action = null;
    this.clips.clear();
  }
}

function disposeScene(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && !value.userData.endfieldShared) textures.add(value);
    }
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const item of [...geometries, ...materials, ...textures]) item.dispose();
  for (const texture of textures) texture.source?.data?.close?.();
}
