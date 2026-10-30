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
  const search = document.querySelector('[data-glossary-search]');
  if (search) search.addEventListener('input', () => {
    const term = search.value.toLowerCase().trim();
    let count = 0;
    document.querySelectorAll('.glossary-list > div').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(term); if (!row.hidden) count++; });
    document.getElementById('glossary-status').textContent = `显示 ${count} 个术语`;
  });
})();
