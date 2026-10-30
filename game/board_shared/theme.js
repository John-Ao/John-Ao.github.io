/* Shared presentation preference; never reads or changes a game's saved state. */
(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'board-game-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const hosts = document.currentScript.dataset.controls;
  let preference;
  try {
    const saved = localStorage.getItem(key);
    preference = saved === 'dark' || saved === 'light' ? saved : null;
  } catch { /* Session-only is still usable. */ }
  function apply() {
    const theme = preference === 'dark' || preference === 'light'
      ? preference : system.matches ? 'dark' : 'light';
    if (root.dataset.theme !== theme) {
      root.classList.add('theme-changing');
      root.dataset.theme = theme;
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-changing')));
    }
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#172126' : '#f3f4ee');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const next = theme === 'dark' ? '浅色' : '深色';
      const label = `${next}主题`;
      if (button.textContent !== label) button.textContent = label;
      button.setAttribute('aria-label', `切换到${label}`);
      button.title = `当前为${theme === 'dark' ? '深色' : '浅色'}主题`;
    });
  }
  apply(); // Run in <head>, before the game is painted.
  system.addEventListener('change', () => { if (!preference) apply(); });
  addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
      apply();
    }
  });
  function mount() {
    document.querySelectorAll(hosts).forEach(host => {
      if (host.querySelector(':scope > [data-theme-toggle]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-toggle';
      button.dataset.themeToggle = '';
      button.addEventListener('click', event => {
        event.stopPropagation();
        preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(key, preference); } catch { /* Keep the preference for this page. */ }
        apply();
      });
      host.insertBefore(button, host.querySelector(':scope > .lastlog'));
    });
    apply();
  }
  addEventListener('DOMContentLoaded', () => {
    mount();
    // Several games rebuild their toolbar after each action.
    new MutationObserver(mount).observe(document.body, {childList: true, subtree: true});
  }, {once: true});
})();
