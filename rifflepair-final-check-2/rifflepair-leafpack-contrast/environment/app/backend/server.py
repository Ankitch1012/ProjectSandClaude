#!/usr/bin/env python3

import json
import os
from copy import deepcopy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from analysis import analyze
from fixtures import baseline


PORT = int(os.environ.get("PORT", "5000"))
CURRENT = baseline()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format_string, *args):
        print(f"rifflepair: {format_string % args}")

    def send_json(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 1_000_000:
            raise ValueError("request body is too large")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True, "service": "rifflepair-analysis"})
            return
        if path == "/api/study":
            self.send_json(200, {
                "study": deepcopy(CURRENT),
                "analysis": analyze(CURRENT),
            })
            return
        self.send_json(404, {"error": "route not found"})

    def do_POST(self):
        global CURRENT
        path = urlparse(self.path).path
        try:
            body = self.read_json()
            if path == "/api/test/reset":
                supplied = body.get("study")
                CURRENT = deepcopy(supplied) if isinstance(supplied, dict) else baseline()
                self.send_json(200, {
                    "study": deepcopy(CURRENT),
                    "analysis": analyze(CURRENT),
                })
                return
            if path == "/api/analyze":
                study = deepcopy(body.get("study") or CURRENT)
                self.send_json(200, {
                    "study": study,
                    "analysis": analyze(study),
                })
                return
            self.send_json(404, {"error": "route not found"})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"RifflePair backend listening on {PORT}")
    server.serve_forever()
