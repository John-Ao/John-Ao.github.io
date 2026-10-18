(() => {
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('beads-theme'); } catch {}
  if (!['light', 'dark'].includes(preference)) preference = null;

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#202020' : '#f4f4f4';
    const button = document.querySelector('#theme-toggle');
    if (button) {
      button.textContent = theme === 'dark' ? '日间' : '夜间';
      button.setAttribute('aria-label', theme === 'dark' ? '切换到日间模式' : '切换到夜间模式');
    }
  }

  const current = () => preference || (system.matches ? 'dark' : 'light');
  apply(current());
  system.addEventListener('change', () => { if (!preference) apply(current()); });
  document.addEventListener('DOMContentLoaded', () => {
    apply(current());
    document.querySelector('#theme-toggle').addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('beads-theme', preference); } catch {}
      apply(preference);
    });
  });
})();
