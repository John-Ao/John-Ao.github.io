import { loadGameMetadata } from '/game/catalog.js';

(() => {
  'use strict';
  const list = document.getElementById('game-list');
  const previous = document.getElementById('games-prev');
  const next = document.getElementById('games-next');
  const label = document.getElementById('games-page');
  const count = document.getElementById('game-count');
  const pageButtons = document.getElementById('games-pages');
  const panel = document.getElementById('game');
  const heading = document.getElementById('game-title');
  const pager = panel.querySelector('.game-pagination');
  let pageSize = 8;
  let page = 0;
  function paginate() {
    const cards = [...list.children];
    const total = Math.max(1, Math.ceil(cards.length / pageSize));
    const pagerHadFocus = pager.contains(document.activeElement);
    pager.hidden = total === 1;
    page = Math.max(0, Math.min(page, total - 1));
    cards.forEach((card, i) => { card.hidden = i < page * pageSize || i >= (page + 1) * pageSize; });
    previous.disabled = page === 0;
    next.disabled = page === total - 1;
    label.textContent = `第 ${page + 1} 页，共 ${total} 页`;
    if (pageButtons.children.length !== total) {
      const restoreFocus = pageButtons.contains(document.activeElement);
      pageButtons.replaceChildren();
      for (let i = 0; i < total; i++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'game-page-dot';
        button.setAttribute('aria-label', `第 ${i + 1} 页`);
        button.addEventListener('click', () => { page = i; paginate(); });
        pageButtons.append(button);
      }
      if (restoreFocus) pageButtons.children[page].focus({ preventScroll: true });
    }
    [...pageButtons.children].forEach((button, i) => {
      if (i === page) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (pager.hidden && pagerHadFocus && cards[0]) cards[0].focus({ preventScroll: true });
    count.textContent = String(cards.length).padStart(2, '0');
  }
  function resizePages() {
    if (panel.hidden || !panel.clientHeight || !list.children.length) return;
    const cards = [...list.children];
    const focused = cards.findIndex(card => card.contains(document.activeElement));
    const anchor = focused >= 0 ? focused : page * pageSize;
    const gridStyle = getComputedStyle(list);
    const columns = gridStyle.gridTemplateColumns.split(/\s+/).length;
    const gap = parseFloat(gridStyle.rowGap) || 0;
    // Measure every title, including wrapped names, before assigning equal rows.
    list.style.gridAutoRows = 'auto';
    cards.forEach(card => { card.hidden = false; });
    const cardHeight = Math.ceil(Math.max(...cards.map(card => card.offsetHeight)));
    list.style.gridAutoRows = `${cardHeight}px`;
    const outerHeight = element => {
      const style = getComputedStyle(element);
      return element.offsetHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
    };
    // Try the full grid without controls first so hidden controls reclaim space.
    const fullRows = Math.ceil(cards.length / columns);
    if (fullRows * cardHeight + (fullRows - 1) * gap <= panel.clientHeight - outerHeight(heading)) {
      pageSize = cards.length;
      page = 0;
      paginate();
      return;
    }
    pager.hidden = false;
    // Recheck after pagination wraps: more dots may consume another line.
    for (let pass = 0; pass < 4; pass++) {
      const available = panel.clientHeight - outerHeight(heading) - outerHeight(pager);
      const rows = Math.max(1, Math.floor((available + gap) / (cardHeight + gap)));
      const size = Math.min(cards.length, columns * rows);
      const unchanged = size === pageSize;
      pageSize = size;
      page = Math.floor(anchor / pageSize);
      paginate();
      if (unchanged) break;
    }
  }
  let resizeFrame;
  function scheduleResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resizePages);
  }
  new ResizeObserver(scheduleResize).observe(panel);
  // Measure on entry before rendering the first frame of its entrance animation.
  new MutationObserver(() => { if (!panel.hidden) resizePages(); }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('resize', scheduleResize);
  if (document.fonts) document.fonts.ready.then(scheduleResize);
  previous.addEventListener('click', () => { page--; paginate(); if (previous.disabled) next.focus(); });
  next.addEventListener('click', () => { page++; paginate(); if (next.disabled) previous.focus(); });
  paginate();
  resizePages();

  const status = document.getElementById('games-status');
  const retry = document.getElementById('games-retry');
  async function refresh() {
    retry.hidden = true;
    status.hidden = false;
    status.textContent = '正在加载游戏…';
    try {
      const games = await loadGameMetadata();
      const cards = games.map((game, i) => {
        const card = document.createElement('a');
        card.className = 'card game-card';
        card.href = game.url;
        const number = document.createElement('span');
        number.className = 'game-number';
        number.textContent = String(i + 1).padStart(2, '0');
        const title = document.createElement('span');
        title.className = 'card-name';
        title.textContent = game.title;
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.setAttribute('aria-hidden', 'true');
        card.append(number, title);
        if (game.description) {
          const description = document.createElement('span');
          description.className = 'card-description';
          description.textContent = game.description;
          card.append(description);
        }
        card.append(arrow);
        return card;
      });
      list.replaceChildren(...cards);
      status.hidden = games.length > 0;
      status.textContent = games.length ? '' : '暂无游戏';
      paginate();
      resizePages();
    } catch {
      status.textContent = '游戏列表加载失败，请重试';
      retry.hidden = false;
      pager.hidden = true;
    }
  }
  retry.addEventListener('click', refresh);
  refresh();
})();
