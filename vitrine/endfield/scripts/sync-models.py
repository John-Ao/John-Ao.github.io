#!/usr/bin/env python3
"""Fetch the pinned public game assets; preserve original bytes in gzip containers.

Run from any directory. No package install or local backend is required by the site.
"""
import concurrent.futures
import gzip
import hashlib
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://assets.warfarin.wiki/studio/c0727135872664fd4c33eabd73c925dd'
HEADERS = {'Origin': 'https://studio.warfarin.wiki', 'Referer': 'https://studio.warfarin.wiki/'}


def fetch(path):
    # Force IPv4: some local environments resolve an unusable IPv6 route.
    command = ['curl', '-4', '--fail', '--silent', '--show-error', '--location',
               '--connect-timeout', '15', '--max-time', '180']
    for key, value in HEADERS.items():
        command.extend(['-H', f'{key}: {value}'])
    return subprocess.check_output(command + [f'{BASE}/{path}'])


def main():
    catalog_path = ROOT / 'research' / 'asset-catalog.json'
    if catalog_path.exists():
        catalog = json.loads(catalog_path.read_text())
    else:
        catalog = json.loads(fetch('data/catalog.json'))
        catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    jobs = {}
    for name, record in catalog['models'].items():
        if not name.startswith('chr_'):
            continue
        model = record['model']
        for filename, size in model['bytes'].items():
            kind = 'models' if filename == model['glb'] else 'textures'
            source = f'{kind}/{filename}'
            jobs[source] = {'path': f'assets/{source}' + ('.gz' if kind == 'models' else ''), 'source': f'{BASE}/{source}', 'bytes': size}

    def download(item):
        source, record = item
        target = ROOT / record['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            data = gzip.decompress(target.read_bytes()) if target.suffix == '.gz' else target.read_bytes()
        else:
            sample = pathlib.Path('/tmp/endfield-research-assets/sample') / source
            data = sample.read_bytes() if sample.exists() else None
            for attempt in range(3):
                try:
                    if data is None or len(data) != record['bytes']:
                        data = fetch(source)
                    if len(data) != record['bytes']:
                        raise ValueError(f'{source}: expected {record["bytes"]}, got {len(data)} bytes')
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)
            compressed = gzip.compress(data, compresslevel=9, mtime=0) if target.suffix == '.gz' else data
            temporary = target.with_suffix(target.suffix + '.part')
            temporary.write_bytes(compressed)
            temporary.replace(target)
        if len(data) != record['bytes']:
            raise ValueError(f'Local asset has unexpected size: {target}')
        record['sha256'] = hashlib.sha256(data).hexdigest()
        record['storedBytes'] = target.stat().st_size
        return record

    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(download, item) for item in jobs.items()]
        for future in concurrent.futures.as_completed(futures):
            records.append(future.result())
            if len(records) % 50 == 0:
                print(f'{len(records)}/{len(jobs)} model/texture files verified', flush=True)
    records.sort(key=lambda x: x['path'])
    manifest = {'sourceBase': BASE, 'retrievedAt': '2026-10-30', 'files': records}
    (ROOT / 'research' / 'model-sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Complete: {len(records)} files, {sum(x["storedBytes"] for x in records) / 1e6:.1f} MB', flush=True)


if __name__ == '__main__':
    main()
