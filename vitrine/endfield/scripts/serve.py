"""Serve this directory; use ignored full manifests for local preview by default."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        result = Path(super().translate_path(path))
        if not self.server.public:
            for name in ('catalog.json', 'research/props.json'):
                original = ROOT / name
                local = original.with_name(original.stem + '.local.json')
                if result == original and local.is_file():
                    return str(local)
        return str(result)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', action='store_true', help='Preview committed selected-character manifests')
    parser.add_argument('--port', type=int, default=5338)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT)))
    server.public = args.public
    print(f'http://127.0.0.1:{args.port}/ ({"public" if args.public else "local"} preview)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
