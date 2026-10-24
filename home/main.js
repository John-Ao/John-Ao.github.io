(() => {
  'use strict';
  const panels = [...document.querySelectorAll('.panel')];
  const links = [...document.querySelectorAll('.navigation a')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let requested = 0;
  let requestedAxis = 'y';
  let transitioning = false;
  let wheelTotal = 0;
  let lastWheel = 0;
  let gestureConsumed = false;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const hashIndex = () => Math.max(0, panels.findIndex(panel => '#' + panel.id === location.hash));

  async function show(index, updateHistory = true, axis = 'y') {
    requested = Math.max(0, Math.min(panels.length - 1, index));
    requestedAxis = axis;
    if (updateHistory && location.hash !== '#' + panels[requested].id) history.pushState(null, '', '#' + panels[requested].id);
    if (transitioning || requested === current) return;
    transitioning = true;
    while (requested !== current) {
      const previous = panels[current];
      const moveFocus = previous.contains(document.activeElement);
      previous.inert = true;
      previous.classList.remove('is-visible');
      previous.classList.add('is-leaving');
      const direction = Math.sign(requested - current);
      current = requested;
      const next = panels[current];
      // Enter opposite to the swipe: left/up swipes reveal content from right/below.
      next.style.setProperty('--enter-x', requestedAxis === 'x' ? `${direction * 12}px` : '0px');
      next.style.setProperty('--enter-y', requestedAxis === 'y' ? `${direction * 12}px` : '0px');
      next.hidden = false;
      next.inert = false;
      document.body.dataset.page = next.id;
      links.forEach((link, i) => {
        if (i === current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      // Establish the transparent state before starting the entrance transition.
      void next.offsetWidth;
      next.classList.add('is-visible');
      if (moveFocus) links[current].focus({ preventScroll: true });
      // Crossfade without an empty frame between the old and new content.
      if (!reducedMotion.matches) await pause(420);
      previous.hidden = true;
      previous.classList.remove('is-leaving');
    }
    transitioning = false;
  }

  links.forEach((link, index) => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    show(index);
  }));
  window.addEventListener('hashchange', () => show(hashIndex(), false));
  window.addEventListener('popstate', () => show(hashIndex(), false));
  window.addEventListener('wheel', event => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 220) { wheelTotal = 0; gestureConsumed = false; }
    lastWheel = now;
    if (transitioning || gestureConsumed) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) >= 45) {
      gestureConsumed = true;
      show(current + Math.sign(wheelTotal));
    }
  }, { passive: false });
  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
    const targets = { ArrowRight: current + 1, ArrowLeft: current - 1, ArrowDown: current + 1, PageDown: current + 1, ArrowUp: current - 1, PageUp: current - 1, Home: 0, End: panels.length - 1 };
    if (!(event.key in targets)) return;
    event.preventDefault();
    const axis = event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 'x' : 'y';
    if (!transitioning) show(targets[event.key], true, axis);
  });
  let touch = null;
  window.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  window.addEventListener('touchend', event => {
    if (!touch || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touch.x;
    const dy = event.changedTouches[0].clientY - touch.y;
    touch = null;
    if (transitioning) return;
    // Require a clear dominant axis so diagonal gestures do not switch accidentally.
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.3;
    const distance = horizontal ? dx : vertical ? dy : 0;
    if (Math.abs(distance) > 45) show(current - Math.sign(distance), true, horizontal ? 'x' : 'y');
  }, { passive: true });
  window.addEventListener('touchcancel', () => { touch = null; });
  show(hashIndex(), false);
})();
