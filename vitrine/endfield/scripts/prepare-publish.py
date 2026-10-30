"""Refresh the selected public manifests and Git asset allowlist in place."""
import gzip
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare():
    catalog_path = ROOT / 'catalog.local.json'
    if not catalog_path.exists():
        catalog_path = ROOT / 'catalog.json'
    catalog = json.loads(catalog_path.read_text())
    ids = json.loads((ROOT / 'publish.json').read_text())['characters']
    by_id = {o['id']: o for o in catalog['operators']}
    if not ids or len(ids) != len(set(ids)):
        raise ValueError('Publication requires distinct character IDs')
    characters = [by_id[id] for id in ids]
    props_path = ROOT / 'research/props.local.json'
    if not props_path.exists():
        props_path = ROOT / 'research/props.json'
    all_props = json.loads(props_path.read_text())
    selected_props = {c['sourceId']: all_props[c['sourceId']] for c in characters}
    assets = set()

    def include(path, glb=False):
        path = path.resolve()
        relative = path.relative_to(ROOT)
        if path in assets:
            return
        if not path.is_file():
            raise FileNotFoundError(relative)
        assets.add(path)
        if not glb:
            return
        data = path.read_bytes()
        if path.suffix == '.gz':
            data = gzip.decompress(data)
        assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 8)[0] == len(data), relative
        length, kind = struct.unpack_from('<II', data, 12)
        assert kind == 0x4e4f534a, relative
        document = json.loads(data[20:20 + length])
        for entry in document.get('buffers', []) + document.get('images', []):
            uri = entry.get('uri', '')
            if not uri or uri.startswith('data:'):
                continue
            if re.search(r'/textures/[0-9a-f]{16}$', uri):
                uri += '.bin'
            include(path.parent / uri)

    for character in characters:
        props = selected_props[character['sourceId']]
        include(ROOT / character['portrait'])
        include(ROOT / character['model'], True)
        for clip in character['animations']:
            include(ROOT / clip['url'], True)
        for item in props['items']:
            include(ROOT / 'assets/props' / (item['file'] + '.gz'), True)
        for entries in props['clips'].values():
            for entry in entries.values():
                if entry.get('file'):
                    include(ROOT / 'assets/props' / (entry['file'] + '.gz'), True)
    catalog.update(operators=characters, operatorCount=len({c['sourceId'] for c in characters}),
                   appearanceCount=len(characters),
                   selectedAnimationCount=sum(len(c['animations']) for c in characters),
                   sourceAnimationCount=sum(c['sourceClipCount'] for c in characters),
                   countNote='线上展示' + '、'.join(c['name'] for c in characters) + '；本地完整预览保留全部角色。')
    (ROOT / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'research/props.json').write_text(json.dumps(selected_props, ensure_ascii=False) + '\n')
    start = '# BEGIN generated published assets'
    end = '# END generated published assets'
    rules = [start, '/catalog.local.json', '/research/props.local.json',
             '__pycache__/', '/research/rendering/*.png', '/assets/*']
    for folder in sorted({path.relative_to(ROOT).parts[1] for path in assets}):
        rules.extend([f'!/assets/{folder}/', f'/assets/{folder}/*'])
        rules.extend('!/' + path.relative_to(ROOT).as_posix()
                     for path in sorted(assets) if path.relative_to(ROOT).parts[1] == folder)
    rules.append(end)
    ignore = ROOT / '.gitignore'
    previous = ignore.read_text() if ignore.exists() else ''
    previous = previous.replace('# BEGIN generated Rossi assets', start).replace('# END generated Rossi assets', end)
    block = '\n'.join(rules) + '\n'
    if start in previous and end in previous:
        before, tail = previous.split(start, 1)
        _, after = tail.split(end, 1)
        ignore.write_text(before + block.rstrip('\n') + after)
    else:
        ignore.write_text(previous + ('\n' if previous and not previous.endswith('\n') else '') + block)
    size = sum(p.stat().st_size for p in assets)
    print(f'{len(characters)} characters, {catalog["selectedAnimationCount"]} animations, {len(assets)} allowed assets, {size / 2**20:.2f} MiB')
    print('Updated catalog.json, research/props.json and .gitignore; local assets retained.')


if __name__ == '__main__':
    prepare()
