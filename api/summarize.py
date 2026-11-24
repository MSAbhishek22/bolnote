"""BolNote /api/summarize — Vercel Python serverless function.

Input:  {segments: [{start, text}], } (the merged transcript)
Output: {summary: [{text, at}], actions: [{text, at}]}
where "at" is the index of the segment the point came from, so the UI
can link every bullet back to its source moment (the Granola rule:
every claim is one click from its evidence). Stdlib only.
"""
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "qwen/qwen3.8-27b"  # the chat model on the builder's Groq account (verified via /models, 24 Nov 2026)

PROMPT = """You are turning a recording transcript into short, honest notes.
The transcript may mix Hindi (Devanagari or Roman) and English. Write the
notes in the same mix as the transcript leans toward.

Return ONLY a JSON object, no markdown fences:
{"summary": [{"text": "...", "at": <segment number>}],
 "actions": [{"text": "...", "at": <segment number>}]}

Rules:
- 3 to 6 summary points, each one sentence, each tied to ONE segment number.
- Actions are only things someone was actually asked or agreed to do.
  If there are none, return an empty list. Never invent tasks, names,
  dates or numbers that are not in the transcript.
- Keep the speaker's own words for names and figures."""


def build_transcript_text(segments: list[dict]) -> str:
    lines = []
    for i, seg in enumerate(segments):
        start = float(seg.get("start", 0))
        stamp = f"{int(start // 60):02d}:{int(start % 60):02d}"
        lines.append(f"[{i}] ({stamp}) {seg.get('text', '')}")
    return "\n".join(lines)


def parse_notes(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    data = json.loads(text)
    def clean(items):
        out = []
        for item in items or []:
            if isinstance(item, dict) and item.get("text"):
                out.append({"text": str(item["text"]),
                            "at": int(item.get("at", 0))})
        return out
    return {"summary": clean(data.get("summary")), "actions": clean(data.get("actions"))}


def summarize(segments: list[dict], api_key: str, opener=urllib.request.urlopen) -> dict:
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": build_transcript_text(segments)},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(GROQ_CHAT, data=json.dumps(payload).encode(),
                                 method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "BolNote/1.0")  # Groq's edge rejects Python-urllib's default UA
    with opener(req, timeout=120) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    return parse_notes(raw["choices"][0]["message"]["content"])


class handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or b"{}")
            segments = data.get("segments") or []
            if not segments:
                return self._json(400, {"error": "Nothing to summarise yet."})
            api_key = os.environ.get("GROQ_API_KEY", "")
            if not api_key:
                return self._json(500, {"error": "Server is missing its notes key."})
            return self._json(200, summarize(segments, api_key))
        except Exception as exc:
            return self._json(502, {"error": f"Notes did not come back ({type(exc).__name__})."})

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
