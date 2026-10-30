"""Trim the documented original menu recording without retiming or synthesizing motion."""
import argparse
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path, help="Original 266.171-second menu recording")
args = parser.parse_args()
if not args.source.is_file():
    parser.error("Source recording does not exist")
out = Path(__file__).resolve().parents[1] / "assets" / "motion"
out.mkdir(parents=True, exist_ok=True)
for name, start, end in [("anby", 3.5, 11.25), ("billy", 41.5, 49.9), ("nicole", 158.6, 166.3)]:
    subprocess.run([
        "ffmpeg", "-v", "error", "-ss", str(start), "-i", str(args.source),
        "-t", str(end - start), "-an", "-c:v", "libx264", "-crf", "19",
        "-preset", "fast", "-pix_fmt", "yuv420p", "-g", "30",
        "-movflags", "+faststart", str(out / f"{name}.mp4"), "-y",
    ], check=True)
    subprocess.run([
        "ffmpeg", "-v", "error", "-ss", str(start + .3), "-i", str(args.source),
        "-frames:v", "1", str(out / f"{name}-poster.webp"), "-y",
    ], check=True)
