#!/usr/bin/env python3
"""Restore or verify the exact public animation files listed in clip-sources.json.

Requires Python 3 and curl. No game client or extraction software is required.
Original GLB bytes are verified before deterministic gzip compression; keyframes
are preserved. The public asset server expects the source viewer's headers.
"""

import argparse
import concurrent.futures
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "research" / "clip-sources.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify_local(item):
    path = ROOT / item["local"]
    if not path.is_file() or path.stat().st_size != item["gzipBytes"]:
        return False
    encoded = path.read_bytes()
    if digest(encoded) != item["gzipSha256"]:
        return False
    try:
        original = gzip.decompress(encoded)
    except (OSError, EOFError):
        return False
    return (
        len(original) == item["originalBytes"]
        and original[:4] == b"glTF"
        and digest(original) == item["sha256"]
    )


def restore(item, verify_only):
    if verify_local(item):
        return "verified"
    if verify_only:
        raise ValueError(f"Missing or invalid animation: {item['local']}")
    with tempfile.TemporaryDirectory(prefix="endfield-clip-") as scratch:
        raw_path = Path(scratch) / item["file"]
        subprocess.run(
            [
                "curl", "-4", "--compressed", "--location", "--fail",
                "--silent", "--show-error", "--connect-timeout", "10",
                "--retry", "3", "--max-time", "300",
                "--header", "Origin: https://studio.warfarin.wiki",
                "--header", "Referer: https://studio.warfarin.wiki/",
                item["url"], "--output", str(raw_path),
            ],
            check=True,
        )
        raw = raw_path.read_bytes()
        if len(raw) != item["originalBytes"] or digest(raw) != item["sha256"]:
            raise ValueError(f"Source checksum mismatch: {item['file']}")
        compressed = io.BytesIO()
        with gzip.GzipFile(filename="", mode="wb", fileobj=compressed, compresslevel=9, mtime=0) as stream:
            stream.write(raw)
        encoded = compressed.getvalue()
        if len(encoded) != item["gzipBytes"] or digest(encoded) != item["gzipSha256"]:
            raise ValueError(f"Compressed checksum mismatch: {item['file']}")
        destination = ROOT / item["local"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        partial = destination.with_suffix(destination.suffix + ".part")
        partial.write_bytes(encoded)
        partial.replace(destination)
    return "downloaded"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Check local files without network access")
    parser.add_argument("--workers", type=int, default=6, help="Concurrent downloads (default: 6)")
    options = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    files = manifest["files"]
    failures = []
    restored = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, options.workers)) as pool:
        futures = {pool.submit(restore, item, options.verify): item for item in files}
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                restored += future.result() == "downloaded"
            except Exception as error:
                failures.append(f"{futures[future]['file']}: {error}")
            if index % 50 == 0 or index == len(files):
                print(f"Checked {index}/{len(files)}; restored {restored}; failed {len(failures)}", flush=True)
    for failure in failures:
        print(failure)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
