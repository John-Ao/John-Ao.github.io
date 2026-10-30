// Playback is exclusively of recorded in-game motion. Missing transitions are cuts,
// never time-reversed footage, CSS rotation, procedural poses or interpolated bones.
export class RecordedStage {
  constructor(video, onLoading, onError) {
    this.video = video;
    this.onLoading = onLoading;
    this.onError = onError;
    this.generation = 0;
    this.sources = new Map();
    this.frame = this.frame.bind(this);
    this.video.addEventListener('error', () => { this.onLoading(false); this.onError(true); });
    this.video.addEventListener('playing', () => this.onLoading(false));
    this.video.addEventListener('waiting', () => this.onLoading(true));
    this.video.addEventListener('canplay', () => this.onLoading(false));
    this.video.addEventListener('seeked', () => { this.seeking = false; });
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced.addEventListener('change', () => this.show(this.tab || 'stats'));
    document.addEventListener('visibilitychange', () => this.updatePlayback());
    requestAnimationFrame(this.frame);
  }
  async load(agent, tab = 'stats') {
    const version = ++this.generation;
    this.agent = agent;
    this.tab = tab;
    this.loaded = false;
    this.range = null;
    this.onLoading(true);
    this.onError(false);
    this.video.pause();
    this.video.poster = `./assets/motion/${agent.id}-poster.webp`;
    this.video.removeAttribute('src');
    this.video.load();
    try {
      // A Blob URL has a fully seekable timeline, even on static servers that do
      // not implement HTTP Range requests. Cache only the three short clips.
      if (!this.sources.has(agent.id)) {
        this.sources.set(agent.id, fetch(`./assets/motion/${agent.id}.mp4`).then(response => {
          if (!response.ok) throw new Error(`Video HTTP ${response.status}`);
          return response.blob();
        }).then(blob => URL.createObjectURL(blob)));
      }
      const source = await this.sources.get(agent.id);
      if (version !== this.generation) return;
      const metadata = new Promise(resolve => this.video.addEventListener('loadedmetadata', resolve, { once: true }));
      this.video.src = source;
      this.video.dataset.agent = agent.id;
      this.video.load();
      await metadata;
      if (version !== this.generation) return;
      this.loaded = true;
      this.show(this.tab);
    } catch {
      this.sources.delete(agent.id);
      if (version !== this.generation) return;
      this.onLoading(false);
      this.onError(true);
    }
  }
  show(tab) {
    if (!this.agent || !this.loaded) { this.tab = tab; return; }
    const previous = this.tab;
    this.tab = tab;
    this.idle = this.agent.motion[tab];
    const transition = this.agent.motion.transitions[`${previous}:${tab}`];
    this.transition = !!transition && !this.reduced.matches;
    this.range = this.transition ? transition : this.idle;
    this.seek(this.range[0]);
    this.updatePlayback();
  }
  seek(time) {
    this.seeking = true;
    this.video.currentTime = time;
  }
  updatePlayback() {
    if (document.hidden || this.hidden || this.reduced.matches) this.video.pause();
    else this.video.play().catch(() => this.onLoading(false));
  }
  setHidden(value) { this.hidden = value; this.updatePlayback(); }
  frame() {
    if (this.range && !this.seeking && !this.video.paused && this.video.currentTime >= this.range[1] - 0.02) {
      if (this.transition) {
        this.transition = false;
        this.range = this.idle;
      }
      this.seek(this.range[0]);
    }
    requestAnimationFrame(this.frame);
  }
}
