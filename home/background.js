(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const random = (min, max) => min + Math.random() * (max - min);
  const point = () => ({ x: random(5, 95), y: random(5, 95) });
  // Catmull–Rom curves share position and velocity across segment boundaries.
  const curve = (a, b, c, d, t) => .5 * ((2 * b) + (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const layers = [...document.querySelectorAll('.ambient-orb')].map(element => ({
    element, animation: null, duration: random(24000, 36000), phase: random(0, Math.PI * 2), segment: 0, points: []
  }));

  function drift(layer) {
    if (reducedMotion.matches) return;
    const [a, b, c, d] = layer.points;
    const frames = Array.from({ length: 81 }, (_, i) => {
      const t = i / 80;
      const x = curve(a.x, b.x, c.x, d.x, t);
      const y = curve(a.y, b.y, c.y, d.y, t);
      const phase = (layer.segment + t) * .9 + layer.phase;
      const sx = 1 + .07 * Math.sin(phase);
      const sy = 1 + .07 * Math.cos(phase);
      return { transform: `translate(${x}vw, ${y}vh) translate(-50%, -50%) scale(${sx}, ${sy})` };
    });
    const previous = layer.animation;
    layer.animation = layer.element.animate(frames, {
      duration: layer.duration, easing: 'linear', fill: 'forwards'
    });
    if (previous) previous.cancel();
    layer.animation.onfinish = () => {
      layer.points = [b, c, d, point()];
      layer.segment++;
      drift(layer);
    };
    if (document.hidden) layer.animation.pause();
  }

  function configure() {
    layers.forEach(layer => {
      if (layer.animation) layer.animation.cancel();
      layer.animation = null;
      layer.segment = 0;
      layer.points = [point(), { x: Number(layer.element.dataset.x), y: Number(layer.element.dataset.y) }, point(), point()];
      if (!reducedMotion.matches) drift(layer);
    });
  }
  reducedMotion.addEventListener('change', configure);
  document.addEventListener('visibilitychange', () => {
    layers.forEach(layer => {
      if (!layer.animation) return;
      if (document.hidden) layer.animation.pause();
      else layer.animation.play();
    });
  });
  configure();
})();
