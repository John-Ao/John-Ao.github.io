"""Seeded candidate sampling plus exact BFS verification; not a full-space enumeration.

Run from any directory: python3 game/space_rescue/generate_levels.py
Published levels 1–12 are immutable in legacy_levels.json. Search is bounded per
candidate; rejected/capped candidates are never described as unsolvable.
"""
import argparse
import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEED = 20261030
DIRECTIONS = [(0, -1), (1, 0), (0, 1), (-1, 0)]


def move(state, piece, direction):
    x, y = state[piece] % 7, state[piece] // 7
    dx, dy = DIRECTIONS[direction]
    hits = []
    for j, position in enumerate(state):
        if j == piece:
            continue
        a, b = position % 7 - x, position // 7 - y
        if (dx == 0 and a == 0 and b * dy > 0) or (dy == 0 and b == 0 and a * dx > 0):
            hits.append(abs(a) + abs(b))
    if not hits or min(hits) == 1:
        return None
    result = list(state)
    distance = min(hits) - 1
    result[piece] = x + dx * distance + 7 * (y + dy * distance)
    return tuple(result)


def key(state):
    # Robots have identical movement; retain actual labels in BFS path nodes.
    return (state[0], *sorted(state[1:]))


def signature(state):
    forms = []
    for flip in (False, True):
        points = [(6 - p % 7 if flip else p % 7, p // 7) for p in state]
        for _ in range(4):
            forms.append(key(tuple(x + 7 * y for x, y in points)))
            points = [(6 - y, x) for x, y in points]
    return min(forms)


def solve(start, budget=90000):
    nodes = [(tuple(start), -1, None)]
    seen = {key(start)}
    for head, (state, parent, action) in enumerate(nodes):
        if state[0] == 24:
            path = []
            while nodes[head][1] != -1:
                path.append(nodes[head][2])
                head = nodes[head][1]
            return path[::-1], len(nodes)
        if len(nodes) > budget:
            return None, len(nodes)
        for piece in range(5):
            for direction in range(4):
                result = move(state, piece, direction)
                if result is not None and key(result) not in seen:
                    seen.add(key(result))
                    nodes.append((result, head, [piece, direction]))
    return None, len(nodes)


def generate(check=False):
    rng = random.Random(SEED)
    levels = json.loads((ROOT / 'legacy_levels.json').read_text())
    seen = {signature(level['pieces']) for level in levels}
    # Six new puzzles at each exact minimum distance, grouped from easy to hard.
    buckets = {distance: [] for distance in range(2, 10)}
    attempts = 0
    while any(len(bucket) < 6 for bucket in buckets.values()):
        attempts += 1
        if attempts > 12000:
            raise RuntimeError('Candidate budget exhausted; published levels unchanged')
        state = tuple(rng.sample([p for p in range(49) if p != 24], 5))
        sig = signature(state)
        if sig in seen:
            continue
        path, visited = solve(state)
        if path is None or len(path) not in buckets or len(buckets[len(path)]) >= 6:
            continue
        seen.add(sig)
        buckets[len(path)].append({'pieces': list(state), 'solution': path, 'par': len(path)})
        print(f'Candidate {attempts}: distance {len(path)}, visited {visited}', flush=True)
    for bucket in buckets.values():
        levels.extend(bucket)
    output = 'const LEVELS = ' + json.dumps(levels, separators=(',', ':')) + ';\n'
    output += 'if (typeof module !== "undefined") module.exports = LEVELS;\n'
    if check:
        if (ROOT / 'levels.js').read_text() != output:
            raise SystemExit('FAIL: levels.js differs from deterministic regeneration')
        print('PASS: read-only deterministic regeneration matches levels.js')
    else:
        (ROOT / 'levels.js').write_text(output)
    print(f'{len(levels)} levels; {attempts} candidates; distances {dict(sorted(Counter(l["par"] for l in levels).items()))}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='regenerate in memory and compare without writing')
    generate(check=parser.parse_args().check)
