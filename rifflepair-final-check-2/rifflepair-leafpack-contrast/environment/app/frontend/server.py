#!/usr/bin/env python3

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PORT = int(os.environ.get("PORT", "3000"))
PUBLIC = Path(__file__).resolve().parent / "public"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"RifflePair frontend listening on {PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
