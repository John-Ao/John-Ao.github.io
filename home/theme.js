(() => {
  'use strict';
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let manual = false;
  let button;
  let transitionTimer;
  function apply(dark) {
    const root = document.documentElement;
    const theme = dark ? 'dark' : 'light';
    if (document.body && root.dataset.theme !== theme) {
      clearTimeout(transitionTimer);
      root.dataset.themeSwitching = '';
      // Establish the shared transition before changing the theme colors.
      getComputedStyle(root).backgroundColor;
      transitionTimer = setTimeout(() => {
        delete root.dataset.themeSwitching;
      }, 450);
    }
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = dark ? '#191b1d' : '#f6f5f2';
    if (button) {
      const label = dark ? '切换至浅色模式' : '切换至深色模式';
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }
  // Run before the stylesheet loads to avoid a light flash on dark systems.
  apply(systemTheme.matches);
  systemTheme.addEventListener('change', event => {
    if (!manual) apply(event.matches);
  });
  document.addEventListener('DOMContentLoaded', () => {
    button = document.getElementById('theme-toggle');
    apply(document.documentElement.dataset.theme === 'dark');
    button.addEventListener('click', () => {
      manual = true;
      apply(document.documentElement.dataset.theme !== 'dark');
    });
  });
})();
