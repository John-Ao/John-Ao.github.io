/* Apply the saved appearance before the first paint. Storage may be unavailable. */
(() => {
  let theme;
  try { theme = localStorage.getItem('blackhole-theme'); } catch {}
  document.documentElement.dataset.theme = theme === 'dark' || theme === 'light'
    ? theme : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
})();
