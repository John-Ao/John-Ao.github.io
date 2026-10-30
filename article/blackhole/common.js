/* Shared reading enhancements. All chapter prose is present in the HTML. */
(() => {
  const skip = document.createElement('a');
  skip.href = '#content'; skip.className = 'skip-link'; skip.textContent = '跳到正文';
  const article = document.querySelector('article');
  if (article) { article.id ||= 'content'; document.body.prepend(skip); }
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
      throwOnError: false, strict: 'ignore', trust: false
    });
  }
  document.querySelectorAll('[data-toc]').forEach(container => {
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = '本章内容';
    const list = document.createElement('ol');
    document.querySelectorAll('article h2[id]').forEach(h => {
      const item = document.createElement('li'), a = document.createElement('a');
      a.href = `#${h.id}`; a.textContent = h.textContent; item.append(a); list.append(item);
    });
    details.append(summary, list); container.append(details);
  });
  const chapters = [
    ['index', '教程目录'], ['foundations', '数学与时空间隔'], ['geometry', '度规与曲率'],
    ['einstein', '爱因斯坦场方程'], ['schwarzschild', 'Schwarzschild 解'], ['kerr', 'Kerr 解'],
    ['raytracing', 'WebGL 光线追踪'], ['merger', '双黑洞合并'],
    ['observations', '引力波观测对比'], ['implementation', '实现与简化技巧']
  ];
  const controls = document.createElement('div');
  controls.className = 'reading-controls';
  const menu = document.createElement('button');
  menu.type = 'button'; menu.className = 'reading-menu'; menu.textContent = '☰ 目录';
  menu.setAttribute('aria-controls', 'reading-directory'); menu.setAttribute('aria-expanded', 'false');
  const theme = document.createElement('button');
  theme.type = 'button'; theme.className = 'reading-theme';
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    theme.textContent = dark ? '☀ 日间' : '☾ 夜间';
    theme.setAttribute('aria-label', dark ? '切换日间模式' : '切换夜间模式');
    theme.setAttribute('aria-pressed', String(dark));
  }
  updateThemeButton();
  theme.addEventListener('click', () => {
    const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem('blackhole-theme', value); } catch {}
    updateThemeButton();
  });
  const panel = document.createElement('nav');
  panel.id = 'reading-directory'; panel.className = 'reading-directory'; panel.hidden = true;
  panel.setAttribute('aria-label', '快捷目录');
  function addLinks(title, entries) {
    const heading = document.createElement('p'); heading.className = 'directory-heading'; heading.textContent = title;
    const list = document.createElement('ol');
    entries.forEach(([href, label, current]) => {
      const item = document.createElement('li'), link = document.createElement('a');
      link.href = href; link.textContent = label;
      if (current) link.setAttribute('aria-current', 'page');
      item.append(link); list.append(item);
    });
    panel.append(heading, list);
  }
  const sections = [...document.querySelectorAll('article h2[id]')];
  if (sections.length) addLinks('本页小节', sections.map(h => [`#${h.id}`, h.textContent]));
  addLinks('全部章节', chapters.map(([page, label]) => [`${page}.html`, label, document.body.dataset.page === page]));
  controls.append(menu, theme); document.body.append(controls, panel);
  const reveal = () => controls.classList.remove('is-hidden');
  function closeMenu(returnFocus = false) {
    panel.hidden = true; menu.setAttribute('aria-expanded', 'false');
    if (returnFocus) menu.focus({ preventScroll: true });
  }
  menu.addEventListener('click', () => {
    panel.hidden = !panel.hidden; menu.setAttribute('aria-expanded', String(!panel.hidden)); reveal();
    if (!panel.hidden) panel.querySelector('a')?.focus({ preventScroll: true });
  });
  panel.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    closeMenu();
    if (link.hash && link.pathname === location.pathname) {
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
    }
  });
  document.addEventListener('click', event => {
    reveal();
    if (!panel.contains(event.target) && !menu.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeMenu(true); reveal(); }
    if (event.key === 'Tab') reveal();
  });
  controls.addEventListener('focusin', reveal);
  let previousY = Math.max(0, window.scrollY), direction = 0, travel = 0;
  window.addEventListener('scroll', () => {
    const y = Math.max(0, window.scrollY), delta = y - previousY;
    previousY = y;
    if (!delta) return;
    const nextDirection = Math.sign(delta);
    travel = nextDirection === direction ? travel + Math.abs(delta) : Math.abs(delta);
    direction = nextDirection;
    if (y < 40 || delta < 0) reveal();
    else if (travel > 12 && panel.hidden && !controls.querySelector(':focus-visible')) controls.classList.add('is-hidden');
  }, { passive: true });
  const search = document.querySelector('[data-glossary-search]');
  if (search) search.addEventListener('input', () => {
    const term = search.value.toLowerCase().trim();
    let count = 0;
    document.querySelectorAll('.glossary-list > div').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(term); if (!row.hidden) count++; });
    document.getElementById('glossary-status').textContent = `显示 ${count} 个术语`;
  });
})();
