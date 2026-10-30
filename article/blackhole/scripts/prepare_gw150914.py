#!/usr/bin/env python3
"""Reproduce the tutorial's GW150914 data from LIGO's published Figure 1.

Python 3 standard library only. No strain filtering, interpolation, fitting or
amplitude normalization is performed here: these are the published *filtered*
figure data, not raw detector samples. Run from any directory:

    python article/blackhole/scripts/prepare_gw150914.py

To use an already downloaded archive:

    python article/blackhole/scripts/prepare_gw150914.py --archive Fig1_Data.zip

The SHA-256 pins the exact upstream release. A changed archive fails closed.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

URL = "https://dcc-llo.ligo.org/public/0123/G1600204/006/Fig1_Data.zip"
SHA256 = "18784c137497d2b0ad2f95394d4c6f8217ebee7eff6fa45dfc78a42906d560e1"
ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "observed_h1": "fig1-observed-H.txt",
    "observed_l1": "fig1-observed-L.txt",
    "aligned_h1": "fig1-observed-shifted-inverted-H.txt",
    "nr_h1": "fig1-waveform-H.txt",
    "nr_l1": "fig1-waveform-L.txt",
    "residual_h1": "fig1-residual-H.txt",
    "residual_l1": "fig1-residual-L.txt",
    "template_h1": "fig1-template-reconstruction-H.txt",
    "template_l1": "fig1-template-reconstruction-L.txt",
    "wavelet_h1": "fig1-wavelet-reconstruction-H.txt",
    "wavelet_l1": "fig1-wavelet-reconstruction-L.txt",
}


def convert(raw: bytes) -> dict:
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SHA256:
        raise ValueError(f"Unexpected upstream archive SHA-256: {digest}")
    series = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        for key, filename in FILES.items():
            rows = [[float(x) for x in line.split()] for line in
                    archive.read("Fig1_Data/" + filename).decode("ascii").splitlines()]
            t0, dt = rows[0][0], rows[1][0] - rows[0][0]
            assert all(abs(r[0] - (t0 + i * dt)) < 1e-10
                       for i, r in enumerate(rows)), "Nonuniform sample spacing"
            assert abs(dt - 1 / 16384) < 1e-10
            item = {"source_file": filename, "t0": t0, "dt": dt, "n": len(rows)}
            if len(rows[0]) == 2:
                item["y"] = [round(row[1], 8) for row in rows]
            else:
                assert all(row[1] <= row[2] for row in rows)
                item["low"] = [round(row[1], 8) for row in rows]
                item["high"] = [round(row[2], 8) for row in rows]
            series[key] = item
    return {
        "schema": "blackhole-tutorial-gw150914-v1",
        "event": "GW150914",
        "source": {
            "title": "LIGO-G1600204-v6: P150914 Figure 1",
            "authors": "LIGO Scientific Collaboration and Virgo Collaboration",
            "page": "https://dcc-llo.ligo.org/LIGO-G1600204-v6/public",
            "archive": URL,
            "archive_sha256": SHA256,
            "event_page": "https://gwosc.org/events/GW150914/",
            "event_doi": "https://doi.org/10.7935/K5MW2F23",
            "paper": "https://doi.org/10.1103/PhysRevLett.116.061102",
        },
        "time": {
            "unit": "s",
            "reference": "Figure 1 time origin; 2015-09-14 09:50:45 UTC as labeled in the original publication",
            "sample_rate_hz": 16384,
            "domain": [0.25, 0.46],
            "construction": "Each series uses its own original t0: t[i] = t0 + i*dt; arrays need not share t0 or n.",
        },
        "strain": {"unit": "1e-21", "physical_strain": "h = y * 1e-21"},
        "processing": {
            "upstream": "Published Figure 1: 35–350 Hz band-pass plus band-reject filters for instrumental spectral lines. These are filtered detector strain, not raw strain and not whitened data.",
            "local": "Parse published ASCII; retain all samples and individual time origins; round strain values to 8 decimal places in units of 1e-21. No local filtering, resampling, fitting or per-series normalization.",
            "aligned_h1": "Use the upstream shifted-and-inverted H1 curve verbatim. The published Figure 1 ASCII curve advances H1 by exactly 7.0 ms and inverts its sign, verified by matching the overlapping original samples. The reported inferred arrival delay is about 6.9 (+0.5/-0.4) ms; distinguish that inference from the rounded display transformation. This projection is specific to this event and detector orientations.",
            "nr": "Numerical-relativity waveforms projected onto each detector; parameters consistent with inferred GW150914 ranges. The original release explicitly says the waveform was not tuned to precisely remove the signal.",
            "bands": "Template/wavelet low and high arrays are the published 90% credible regions, not raw measurement error bars.",
            "residual": "Published detector strain minus filtered NR waveform. Small signal may remain; residuals are not proof of noise-only data.",
        },
        "series": series,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "gw150914.json")
    args = parser.parse_args()
    if args.archive:
        raw = args.archive.read_bytes()
    else:
        request = urllib.request.Request(URL, headers={"User-Agent": "BlackholeTutorial/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
    data = convert(raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    args.output.write_text(payload, encoding="utf-8")
    print(f"Wrote {args.output}: {len(payload.encode('utf-8')):,} bytes; "
          f"{len(data['series'])} published series; SHA-256 verified.")


if __name__ == "__main__":
    main()
