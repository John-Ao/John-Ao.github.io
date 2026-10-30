import * as THREE from './vendor/three.module.js';
import { prepareMaterials } from './materials.js';

let indexPromise;
function index() {
  if (!indexPromise) indexPromise = fetch('./research/props.json').then(response => {
    if (!response.ok) throw new Error(`道具目录加载失败（HTTP ${response.status}）`);
    return response.json();
  }).catch(error => { indexPromise = null; throw error; });
  return indexPromise;
}

const aborted = () => new DOMException('Aborted', 'AbortError');
const key = name => THREE.PropertyBinding.sanitizeNodeName(name);
const url = file => `./assets/props/${file}.gz`;

/** Source attachments share the character clock, including scrubbing and loops. */
export class CharacterProps {
  constructor(stage) {
    this.stage = stage;
    this.generation = 0;
    this.playVersion = 0;
    this.items = new Map();
    this.pending = new Map();
  }

  async load(character, signal) {
    this.clear();
    const generation = this.generation;
    const model = this.stage.model;
    const manifest = await index();
    if (signal?.aborted || generation !== this.generation || this.stage.model !== model) return false;
    this.data = manifest[character.sourceId] || { items: [], clips: {}, hide: {} };
    this.model = model;
    return true;
  }

  async play(descriptor, signal) {
    if (!this.data || !this.model) return false;
    const generation = this.generation;
    const version = ++this.playVersion;
    const entries = this.data.clips[descriptor.file] || {};
    for (const item of this.items.values()) this.reset(item);
    // Load all referenced attachments before resolving mounts: some props attach
    // to bones in another prop instead of a bone in the main character rig.
    const definitions = this.data.items.filter(item => entries[item.n]);
    const loaded = await Promise.all(definitions.map(item => this.loadItem(item, signal, generation)));
    if (signal?.aborted || generation !== this.generation || version !== this.playVersion) return false;
    for (const item of loaded) {
      let mount = this.model;
      if (item.definition.mount) {
        const name = key(item.definition.mount);
        mount = this.model.getObjectByName(name);
        if (!mount) {
          for (const other of this.items.values()) {
            if (other !== item && other.nodes.has(name)) { mount = other.nodes.get(name); break; }
          }
        }
        // Keep the exported local transforms intact if no mount was exported.
        mount ||= this.model;
      }
      if (mount !== item.root && !contains(item.root, mount)) mount.add(item.root);
    }
    await Promise.all(loaded.map(async item => {
      const entry = entries[item.definition.n];
      let clip;
      if (entry.file) clip = await this.loadClip(item, entry.file, signal, generation);
      if (signal?.aborted || generation !== this.generation || version !== this.playVersion) return;
      this.reset(item);
      item.entry = entry;
      item.hide = this.data.hide?.[descriptor.file]?.[item.definition.n];
      item.switches = Object.entries(entry.visible || {}).flatMap(([name, points]) => {
        const node = item.nodes.get(key(name));
        return node ? [[node, points]] : [];
      });
      if (clip) {
        item.action = item.mixer.clipAction(clip);
        item.action.reset().setLoop(THREE.LoopOnce, 1);
        item.action.clampWhenFinished = true;
        item.action.play();
      }
    }));
    if (signal?.aborted || generation !== this.generation || version !== this.playVersion) return false;
    this.update(0);
    return true;
  }

  async loadItem(definition, signal, generation) {
    const number = definition.n;
    if (this.items.has(number)) return this.items.get(number);
    const pending = this.pending.get(number);
    if (pending && !pending.signal?.aborted) return pending.promise;
    const promise = (async () => {
      const gltf = await this.stage.fetchGLTF(url(definition.file), signal, '载入角色道具');
      if (signal?.aborted || generation !== this.generation) { dispose(gltf.scene); throw aborted(); }
      try { await prepareMaterials(gltf, this.stage.renderer, this.stage.scene.environment); }
      catch (error) { dispose(gltf.scene); throw error; }
      if (signal?.aborted || generation !== this.generation) { dispose(gltf.scene); throw aborted(); }
      const root = gltf.scene;
      const prefix = `attachment_${number}_`;
      const nodes = new Map(), baseline = new Map();
      root.traverse(node => {
        nodes.set(node.name, node);
        nodes.set(key(node.name), node);
        if (/^lod[1-9]\d*$/i.test(node.name)) node.visible = false;
        baseline.set(node, node.visible);
        node.name = prefix + node.name;
        if (node.isMesh) {
          node.frustumCulled = false;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          node.castShadow = !materials.some(material => material.userData?.endfieldOverlay || material.userData?.endfieldVFX || material.userData?.endfieldOutline || material.userData?.endfieldEyeLayer);
        }
      });
      root.visible = false;
      const item = { definition, prefix, root, nodes, baseline, mixer: new THREE.AnimationMixer(root),
        clips: new Map(), action: null, entry: null, switches: [], hide: null };
      this.items.set(number, item);
      return item;
    })();
    this.pending.set(number, { promise, signal });
    try { return await promise; }
    finally { if (this.pending.get(number)?.promise === promise) this.pending.delete(number); }
  }

  async loadClip(item, file, signal, generation) {
    if (item.clips.has(file)) return item.clips.get(file);
    const gltf = await this.stage.fetchGLTF(url(file), signal, '载入道具动作');
    const original = gltf.animations[0];
    dispose(gltf.scene);
    if (signal?.aborted || generation !== this.generation) throw aborted();
    if (!original) throw new Error('道具动作文件没有骨骼动画。');
    const clip = original.clone();
    for (const track of clip.tracks) track.name = item.prefix + track.name;
    item.clips.set(file, clip);
    return clip;
  }

  update(time) {
    for (const item of this.items.values()) {
      const entry = item.entry;
      if (!entry || entry.shows === false) { item.root.visible = false; continue; }
      const local = Math.max(0, time - (entry.start || 0));
      if (time < (entry.start || 0) || time >= (entry.end ?? Infinity)) { item.root.visible = false; continue; }
      let sample = local;
      if (item.action) {
        const duration = item.action.getClip().duration;
        sample = entry.loop && duration > 0 ? local % duration : Math.min(local, duration);
        item.action.paused = false;
        item.action.time = sample;
        item.mixer.update(0);
      }
      for (const [node, points] of item.switches) node.visible = item.baseline.get(node) !== false && step(points, sample) > 0.5;
      item.root.visible = linear(item.hide, time) < 0.999;
    }
  }

  reset(item) {
    item.mixer.stopAllAction();
    for (const [node, visible] of item.baseline) node.visible = visible;
    item.root.visible = false;
    item.action = null;
    item.entry = null;
    item.hide = null;
    item.switches = [];
  }

  clear() {
    this.generation++;
    this.playVersion++;
    for (const item of this.items.values()) {
      item.mixer.stopAllAction();
      item.mixer.uncacheRoot(item.root);
      item.root.removeFromParent();
    }
    // Detach all roots first so nested attachments are disposed only once.
    for (const item of this.items.values()) dispose(item.root);
    this.items.clear();
    this.pending.clear();
    this.data = null;
    this.model = null;
  }
}

function step(points, time) {
  if (!points?.length) return 1;
  let value = points[0][1];
  for (const point of points) { if (point[0] > time) break; value = point[1]; }
  return value;
}

function linear(points, time) {
  if (!points?.length) return 0;
  if (time <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (time > points[i][0]) continue;
    const [start, before] = points[i - 1], [end, after] = points[i];
    return end > start ? before + (after - before) * (time - start) / (end - start) : after;
  }
  return points.at(-1)[1];
}

function contains(root, candidate) {
  for (let parent = candidate; parent; parent = parent.parent) if (parent === root) return true;
  return false;
}

function dispose(root) {
  const resources = new Set(), images = new Set(), skeletons = new Set();
  root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && !value.userData.endfieldShared) { resources.add(value); if (value.source?.data) images.add(value.source.data); }
    }
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const resource of resources) resource.dispose();
  for (const image of images) image.close?.();
}
