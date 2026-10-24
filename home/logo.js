(() => {
  'use strict';
  const canvas = document.querySelector('.home-logo');
  const context = canvas.getContext('2d');
  // Original 200 × 100 outline, with the three cutouts folded into one path.
  // Store vertices so every horizontal/vertical edge can land on a device pixel.
  const paths = [
    [[4, 5], [93.44, 5], [93.44, 94.44], [86.28, 94.44],
      [86.28, 55.09], [48.12, 55.09], [48.12, 94.44], [4, 94.44]],
    [[48.12, 12.16], [86.28, 12.16], [86.28, 47.94], [48.12, 47.94]],
    [[106.56, 5], [196, 5], [196, 94.44], [106.56, 94.44]],
    [[150.68, 12.16], [188.84, 12.16], [188.84, 87.29], [150.68, 87.29]],
  ];

  function draw() {
    // Clear the previous alignment before measuring the current layout.
    canvas.style.translate = 'none';
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    canvas.style.translate = `${Math.round(bounds.left * ratio) / ratio - bounds.left}px ${Math.round(bounds.top * ratio) / ratio - bounds.top}px`;
    const x = value => Math.round(value * canvas.width / 200);
    const y = value => Math.round(value * canvas.height / 100);
    const path = new Path2D();
    for (const vertices of paths) {
      path.moveTo(x(vertices[0][0]), y(vertices[0][1]));
      for (const [px, py] of vertices.slice(1)) path.lineTo(x(px), y(py));
      path.closePath();
    }
    const gradient = context.createLinearGradient(x(4), y(5), x(196), y(94));
    const dark = document.documentElement.dataset.theme === 'dark';
    const colors = dark ? ['#92aaa0', '#a5b8ae', '#b5c3ba'] : ['#49665c', '#58796e', '#809084'];
    [0, .55, 1].forEach((stop, index) => gradient.addColorStop(stop, colors[index]));
    context.fillStyle = gradient;
    context.fill(path, 'evenodd');
  }

  new ResizeObserver(draw).observe(canvas);
  new MutationObserver(draw).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme'],
  });
  // Redraw at the settled position after returning from another panel.
  canvas.closest('h1').addEventListener('animationend', draw);
  window.addEventListener('resize', draw);
  function watchPixelRatio() {
    const resolution = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    resolution.addEventListener('change', () => { draw(); watchPixelRatio(); }, { once: true });
  }
  watchPixelRatio();
  draw();
})();
