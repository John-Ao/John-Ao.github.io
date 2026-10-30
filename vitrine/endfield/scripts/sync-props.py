#!/usr/bin/env python3
"""Mirror props referenced by the selected character animations, preserving bytes."""
import concurrent.futures
import gzip
import hashlib
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://assets.warfarin.wiki/studio/c0727135872664fd4c33eabd73c925dd'
CACHE = pathlib.Path('/tmp/endfield-research-assets/playable-data')


def fetch(path):
    return subprocess.check_output([
        'curl', '-4', '--compressed', '--fail', '--silent', '--show-error', '--location',
        '--connect-timeout', '15', '--max-time', '120',
        '-H', 'Origin: https://studio.warfarin.wiki',
        '-H', 'Referer: https://studio.warfarin.wiki/', f'{BASE}/{path}',
    ])


def main():
    local = (ROOT / 'catalog.local.json').exists()
    catalog = json.loads((ROOT / ('catalog.local.json' if local else 'catalog.json')).read_text())
    assets = json.loads((ROOT / 'research/asset-catalog.json').read_text())
    index, jobs, sources = {}, {}, []
    for character in catalog['operators']:
        source_id = character['sourceId']
        filename = assets['models'][source_id].get('deco')
        if not filename:
            index[source_id] = {'items': [], 'clips': {}, 'hide': {}}
            continue
        cached = CACHE / filename
        raw = cached.read_bytes() if cached.exists() else fetch(f'data/{filename}')
        data = json.loads(raw)
        sources.append({'sourceId': source_id, 'source': f'{BASE}/data/{filename}',
                        'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
        files = {clip['file'] for clip in character['animations']}
        clips = {key: value for key, value in data['clips'].items() if key in files}
        numbers = {int(number) for entries in clips.values() for number in entries}
        items = [item for item in data['items'] if item['n'] in numbers]
        hide = {key: value for key, value in data.get('hide', {}).items() if key in files}
        index[source_id] = {'items': items, 'clips': clips, 'hide': hide}

        def queue(kind, name):
            local = f'assets/textures/{name}' if kind == 'textures' else f'assets/props/{name}.gz'
            jobs[f'{kind}/{name}'] = {'path': local, 'source': f'{BASE}/{kind}/{name}',
                                      'bytes': data['bytes'][name]}

        for item in items:
            queue('props', item['file'])
            for name in data.get('images', {}).get(item['file'], []):
                queue('textures', name)
        for entries in clips.values():
            for entry in entries.values():
                if entry.get('file'):
                    queue('clips', entry['file'])

    def download(pair):
        source, record = pair
        target = ROOT / record['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        data = None
        if target.exists():
            data = gzip.decompress(target.read_bytes()) if target.suffix == '.gz' else target.read_bytes()
        valid_local = data is not None and len(data) == record['bytes']
        for attempt in range(3):
            try:
                if data is None or len(data) != record['bytes']:
                    data = fetch(source)
                if len(data) != record['bytes']:
                    raise ValueError(f'{source}: expected {record["bytes"]}, got {len(data)}')
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
        if not valid_local:
            stored = gzip.compress(data, compresslevel=9, mtime=0) if target.suffix == '.gz' else data
            temporary = target.with_suffix(target.suffix + '.props-part')
            temporary.write_bytes(stored)
            temporary.replace(target)
        record['sha256'] = hashlib.sha256(data).hexdigest()
        record['storedBytes'] = target.stat().st_size
        return record

    print(f'Selected {sum(len(value["items"]) for value in index.values())} props; verifying {len(jobs)} files', flush=True)
    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        for future in concurrent.futures.as_completed([executor.submit(download, item) for item in jobs.items()]):
            records.append(future.result())
            if len(records) % 50 == 0:
                print(f'{len(records)}/{len(jobs)} files verified', flush=True)
    (ROOT / ('research/props.local.json' if local else 'research/props.json')).write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n')
    manifest = {'sourceBase': BASE, 'retrievedAt': '2026-10-30', 'indices': sources,
                'files': sorted(records, key=lambda record: record['path'])}
    (ROOT / 'research/prop-sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Complete: {len(records)} files, {sum(record["storedBytes"] for record in records) / 1e6:.1f} MB', flush=True)


if __name__ == '__main__':
    main()
