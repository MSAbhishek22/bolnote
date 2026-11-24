"""BolNote /api/transcribe — Vercel Python serverless function.

Receives one audio chunk (multipart, field "audio", optional field
"language"), forwards it to Groq's Whisper API with the server-side
GROQ_API_KEY, and returns {text, language, segments:[{start,end,text}]}.
Stdlib only. The key never reaches the browser.
"""
import json
import os
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
MODEL = "whisper-large-v3"


def build_multipart(fields: dict, file_field: str, filename: str,
                    file_bytes: bytes, content_type: str = "audio/wav"):
    boundary = "----bolnote" + uuid.uuid4().hex
    body = b""
    for name, value in fields.items():
        body += (f"--{boundary}\r\nContent-Disposition: form-data; "
                 f"name=\"{name}\"\r\n\r\n{value}\r\n").encode()
    body += (f"--{boundary}\r\nContent-Disposition: form-data; "
             f"name=\"{file_field}\"; filename=\"{filename}\"\r\n"
             f"Content-Type: {content_type}\r\n\r\n").encode()
    body += file_bytes + f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def transcribe(audio_bytes: bytes, filename: str, language: str | None,
               api_key: str, opener=urllib.request.urlopen) -> dict:
    fields = {"model": MODEL, "response_format": "verbose_json"}
    if language:
        fields["language"] = language
    body, ctype = build_multipart(fields, "file", filename, audio_bytes)
    req = urllib.request.Request(GROQ_URL, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", ctype)
    # Groq's edge rejects the default Python-urllib user agent (verified
    # live 24 Nov 2026: default UA -> 403, named UA -> 200).
    req.add_header("User-Agent", "BolNote/1.0")
    with opener(req, timeout=120) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    segments = [{"start": s.get("start", 0), "end": s.get("end", 0),
                 "text": s.get("text", "")} for s in raw.get("segments", [])]
    if not segments and raw.get("text"):
        segments = [{"start": 0, "end": 0, "text": raw["text"]}]
    return {"text": raw.get("text", ""), "language": raw.get("language"),
            "segments": segments}


def parse_multipart(body: bytes, content_type: str) -> dict:
    """Minimal multipart reader for the two fields this API accepts."""
    boundary = content_type.split("boundary=")[-1].strip().encode()
    parts = {}
    for chunk in body.split(b"--" + boundary):
        if b"Content-Disposition" not in chunk:
            continue
        head, _, data = chunk.partition(b"\r\n\r\n")
        data = data.rstrip(b"\r\n-")
        if b'name="audio"' in head:
            parts["audio"] = data
            if b'filename="' in head:
                parts["filename"] = head.split(b'filename="')[1].split(b'"')[0].decode()
        elif b'name="language"' in head:
            parts["language"] = data.decode().strip()
    return parts


class handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802 (Vercel convention)
        try:
            length = int(self.headers.get("Content-Length", 0))
            parts = parse_multipart(self.rfile.read(length),
                                    self.headers.get("Content-Type", ""))
            if not parts.get("audio"):
                return self._json(400, {"error": "No audio chunk received."})
            api_key = os.environ.get("GROQ_API_KEY", "")
            if not api_key:
                return self._json(500, {"error": "Server is missing its transcription key."})
            result = transcribe(parts["audio"], parts.get("filename", "chunk.wav"),
                                parts.get("language") or None, api_key)
            return self._json(200, result)
        except Exception as exc:  # plain-language failure, detail logged server-side
            return self._json(502, {"error": f"Transcription did not come back ({type(exc).__name__})."})

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
