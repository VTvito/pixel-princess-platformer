#!/usr/bin/env python3
"""Tiny static dev server with correct MIME types for ES modules.

Python's built-in `python -m http.server` reads MIME types from the Windows registry,
which often maps `.js` to `text/plain`. Browsers enforce strict MIME checking for ES
module scripts and refuse to run them, so the game silently fails to load. This server
forces the JavaScript/CSS/wasm types so `import` works everywhere.

Usage:  python tools/serve.py [port]   (default 8080)
Then open http://localhost:<port>
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Serve the project root (parent of this tools/ dir), regardless of where it's launched.
ROOT = Path(__file__).resolve().parent.parent


class Handler(SimpleHTTPRequestHandler):
    # Override the registry-derived types that break module loading on Windows.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        # No caching during development so edits show up on reload.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    httpd = ThreadingHTTPServer(("", port), partial(Handler, directory=str(ROOT)))
    print(f"Serving {ROOT} at http://localhost:{port}  (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
