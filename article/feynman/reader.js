(() => {
  const menu = document.querySelector('#contents');
  const menuButton = document.querySelector('#menu-button');
  const themeButton = document.querySelector('#theme-button');
  const search = document.querySelector('#chapter-search');
  const links = [...document.querySelectorAll('.toc-group a')];
  const lessons = [...document.querySelectorAll('section.lesson')];
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('aria-label', dark ? '切换至日间模式' : '切换至夜间模式');
    themeButton.querySelector('.control-label').textContent = dark ? '日间' : '夜间';
    themeButton.querySelector('.moon').style.display = dark ? 'none' : '';
    themeButton.querySelector('.sun').style.display = dark ? '' : 'none';
  }
  themeButton.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('feynman-theme', theme); } catch {}
    updateThemeButton();
  });
  updateThemeButton();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    let saved; try { saved = localStorage.getItem('feynman-theme'); } catch {}
    if (!saved) { document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'; updateThemeButton(); }
  });
  menuButton.addEventListener('click', () => {
    document.body.classList.remove('controls-hidden');
    menu.showModal(); document.body.style.overflow = 'hidden';
    menuButton.setAttribute('aria-expanded', 'true'); search.focus();
  });
  function closeMenu() { menu.close(); }
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
  });
  document.querySelector('#close-menu').addEventListener('click', closeMenu);
  menu.addEventListener('close', () => { document.body.style.overflow = ''; menuButton.setAttribute('aria-expanded', 'false'); });
  menu.addEventListener('click', event => { if(event.target === menu && event.clientX > menu.getBoundingClientRect().right) closeMenu(); });
  [...links, document.querySelector('#sources-link')].forEach(link => link.addEventListener('click', () => {
    closeMenu();
    const target = document.querySelector(link.hash);
    requestAnimationFrame(() => { target.focus({preventScroll:true}); target.scrollIntoView(); });
  }));
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    links.forEach(link => { link.hidden = !link.textContent.toLowerCase().includes(query); });
    document.querySelectorAll('.toc-group').forEach(group => { group.hidden = ![...group.querySelectorAll('a')].some(link => !link.hidden); });
    document.querySelector('#search-status').textContent = `找到 ${links.filter(link => !link.hidden).length} 个章节`;
  });
  let previousY = scrollY, accumulated = 0, scheduled = false;
  function onScroll() {
    const currentY = Math.max(0,scrollY), delta = currentY - previousY;
    if (Math.sign(delta) !== Math.sign(accumulated)) accumulated = 0;
    accumulated += delta; previousY = currentY;
    if (!menu.open) {
      if (currentY < 80 || accumulated < -12) document.body.classList.remove('controls-hidden');
      else if(accumulated > 18 && !document.querySelector('.reader-control:focus-visible')) document.body.classList.add('controls-hidden');
    }
    let active = lessons[0];
    for (const lesson of lessons) { if(lesson.getBoundingClientRect().top <= 150) active = lesson; else break; }
    links.forEach(link => { if(link.hash === '#' + active.id) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current'); });
    scheduled = false;
  }
  addEventListener('scroll', () => { if(!scheduled) { scheduled = true; requestAnimationFrame(onScroll); } }, {passive:true});
  addEventListener('keydown', event => { if(event.key === 'Tab') document.body.classList.remove('controls-hidden'); });
  if (window.renderMathInElement) renderMathInElement(document.querySelector('article'), {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false});
  onScroll();
})();
