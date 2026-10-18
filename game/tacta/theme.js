'use strict';
// Apply before the stylesheet loads to avoid a light flash in night mode.
window.TactaTheme = {
  apply(theme) {
    document.documentElement.dataset.theme=theme;
    document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#181818':'#f2f2f2';
  }
};
let initialTheme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
try {
  const saved=localStorage.getItem('tacta-theme-v1');
  if(saved==='light'||saved==='dark')initialTheme=saved;
} catch {}
window.TactaTheme.apply(initialTheme);
