"""Check static links, fragment IDs, accessibility labels, and bundled assets.

No dependencies. Run from any working directory; only this tutorial is checked.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from collections import Counter
import re

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.ids, self.links, self.controls, self.labels, self.canvases = path, [], [], [], [], []
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        for key in ('src', 'href'):
            if a.get(key):
                self.links.append(a[key])
        if tag == 'label' and a.get('for'):
            self.labels.append(a['for'])
        if tag in ('input', 'select'):
            self.controls.append(a)
        if tag == 'canvas':
            self.canvases.append(a)


pages = {p.resolve(): Page(p) for p in sorted(ROOT.glob('*.html'))}
errors = []
for path, page in pages.items():
    for id_, count in Counter(page.ids).items():
        if count > 1:
            errors.append(f'{path.name}: duplicate id {id_}')
    for link in page.links:
        parts = urlsplit(link)
        if parts.scheme or parts.netloc:
            continue
        target = (path.parent / unquote(parts.path)).resolve() if parts.path else path
        if target.is_dir():
            target = target / 'index.html'
        if not target.exists():
            errors.append(f'{path.name}: missing {link}')
        elif parts.fragment and target in pages and parts.fragment not in pages[target].ids:
            errors.append(f'{path.name}: missing fragment {link}')
    for canvas in page.canvases:
        if not canvas.get('aria-label'):
            errors.append(f'{path.name}: canvas missing accessible description')
    for label in page.labels:
        if label not in page.ids:
            errors.append(f'{path.name}: label points to missing {label}')
    text = path.read_text()
    if '<html lang="zh-CN"' not in text:
        errors.append(f'{path.name}: missing Chinese language metadata')
    print(f'{path.name}: {len(page.ids)} ids, {len(page.links)} links, {len(page.canvases)} canvases')

css = (ROOT / 'vendor/katex.min.css').read_text()
for asset in re.findall(r'url\(([^)]+)\)', css):
    if not (ROOT / 'vendor' / asset.strip('"\'')).exists():
        errors.append(f'KaTeX: missing font {asset}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} static pages, all internal links, IDs, canvas labels and font assets.')
