import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL(process.env.VIEWER_URL || 'http://127.0.0.1:5338/');
  url.searchParams.set('character', 'chen');
  await page.goto(url.href);
  await page.evaluate(async () => { window.qa = await import('./app.js'); });
  await page.waitForFunction(() => qa.stage?.action && document.querySelector('#loading').hidden, null, { timeout: 90000 });
  const results = await page.evaluate(async () => {
    const THREE = await import('./vendor/three.module.js');
    const { shadowColorGLSL } = await import('./npr.js');
    const stage = qa.stage, maps = new Set();
    stage.model.traverse(object => {
      for (const material of object.material ? [].concat(object.material) : []) {
        if (material.efShadowLut) maps.add(material.efShadowLut);
      }
    });
    const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: { efShadowLut: { value: null }, sampleColor: { value: new THREE.Vector3() } },
      vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
      fragmentShader: `#define HAS_efShadowLut\nuniform sampler2D efShadowLut;\nuniform vec3 sampleColor;\n${shadowColorGLSL}\nvoid main() { gl_FragColor = vec4(efShadowColor(efLinear(sampleColor)), 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera(), pixel = new Uint8Array(4), output = [];
    const linear = byte => { const c = byte / 255; return Math.round(255 * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); };
    const previous = stage.renderer.getRenderTarget();
    try {
      for (const map of maps) {
        const image = map.image;
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, image.width, image.height).data;
        material.uniforms.efShadowLut.value = map;
        for (const rgb of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]]) {
          // Independent file-layout reference: top row is maximum green.
          const x = rgb[2] * 992 + rgb[0] * 31, y = (1 - rgb[1]) * 31;
          const i = (y * image.width + x) * 4;
          const expected = Array.from(data.slice(i, i + 3), linear);
          material.uniforms.sampleColor.value.fromArray(rgb);
          stage.renderer.setRenderTarget(target); stage.renderer.render(scene, camera);
          stage.renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
          output.push({ rgb, expected, actual: Array.from(pixel.slice(0, 3)) });
        }
      }
    } finally {
      stage.renderer.setRenderTarget(previous);
      geometry.dispose(); material.dispose(); target.dispose();
    }
    return output;
  });
  assert(results.length >= 5, 'No shadow LUT was tested');
  for (const result of results) assert(result.actual.every((v, i) => Math.abs(v - result.expected[i]) <= 2), JSON.stringify(result));
  assert.deepEqual(errors, []);
  console.log(`PASS: ${results.length} GPU shadow-LUT color samples match exported texture coordinates.`);
} finally { await browser.close(); }
