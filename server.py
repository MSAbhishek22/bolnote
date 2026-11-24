#!/usr/bin/env python3
"""BolNote local dev server (VM testing only — production is Vercel).

Serves the static app and implements /api/transcribe + /api/summarize
by forwarding to the local Groq proxy on 127.0.0.1:8793, which injects
the API key. This makes the local end-to-end smoke a REAL run against
Groq, not a mock. Run: python3 server.py [port]
"""
import json
import sys
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "api"))
import transcribe as transcribe_mod  # noqa: E402
import summarize as summarize_mod  # noqa: E402

PROXY = "http://127.0.0.1:8793"


def proxy_opener(req, timeout=120):
    """Rewrite a Groq API request to the local key-injecting proxy."""
    url = req.full_url.replace("https://api.groq.com", PROXY)
    new_req = urllib.request.Request(url, data=req.data, method=req.get_method())
    for key, value in req.header_items():
        if key.lower() != "authorization":
            new_req.add_header(key, value)
    return urllib.request.urlopen(new_req, timeout=timeout)


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            if self.path == "/api/transcribe":
                parts = transcribe_mod.parse_multipart(
                    body, self.headers.get("Content-Type", ""))
                if not parts.get("audio"):
                    return self._json(400, {"error": "No audio chunk received."})
                result = transcribe_mod.transcribe(
                    parts["audio"], parts.get("filename", "chunk.wav"),
                    parts.get("language") or None, "proxy", opener=proxy_opener)
                return self._json(200, result)
            if self.path == "/api/summarize":
                data = json.loads(body or b"{}")
                segments = data.get("segments") or []
                if not segments:
                    return self._json(400, {"error": "Nothing to summarise yet."})
                return self._json(200, summarize_mod.summarize(
                    segments, "proxy", opener=proxy_opener))
            return self._json(404, {"error": "Unknown route."})
        except Exception as exc:
            return self._json(502, {"error": f"Did not come back ({type(exc).__name__}: {exc})."})

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8795
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
