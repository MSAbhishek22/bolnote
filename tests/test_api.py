"""BolNote API tests — run: python3 -m unittest discover -s tests
No network: the Groq call is faked at the opener seam."""
import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))
import summarize as summarize_mod  # noqa: E402
import transcribe as transcribe_mod  # noqa: E402


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def fake_opener(payload: dict):
    def opener(req, timeout=0):
        opener.seen = req
        return FakeResponse(json.dumps(payload).encode())
    return opener


class TestTranscribe(unittest.TestCase):
    def test_multipart_carries_model_and_file(self):
        body, ctype = transcribe_mod.build_multipart(
            {"model": "whisper-large-v3", "response_format": "verbose_json"},
            "file", "chunk.wav", b"RIFFfake")
        self.assertIn(b"whisper-large-v3", body)
        self.assertIn(b"RIFFfake", body)
        self.assertIn("multipart/form-data", ctype)

    def test_parse_multipart_round_trip(self):
        body, ctype = transcribe_mod.build_multipart(
            {"language": "hi"}, "audio", "a.wav", b"AUDIOBYTES")
        # build_multipart puts the file under field "file"; parse expects "audio"
        body2 = body.replace(b'name="file"', b'name="audio"')
        parts = transcribe_mod.parse_multipart(body2, ctype)
        self.assertEqual(parts["audio"], b"AUDIOBYTES")
        self.assertEqual(parts["language"], "hi")
        self.assertEqual(parts["filename"], "a.wav")

    def test_transcribe_shapes_segments(self):
        opener = fake_opener({
            "text": "namaste duniya", "language": "hindi",
            "segments": [{"start": 0.0, "end": 1.5, "text": " namaste duniya "}]})
        result = transcribe_mod.transcribe(b"wav", "c.wav", "hi", "key", opener=opener)
        self.assertEqual(result["language"], "hindi")
        self.assertEqual(result["segments"][0]["end"], 1.5)
        auth = opener.seen.headers.get("Authorization")
        self.assertEqual(auth, "Bearer key")


class TestSummarize(unittest.TestCase):
    def test_parse_notes_handles_fenced_json(self):
        raw = '```json\n{"summary": [{"text": "point", "at": 2}], "actions": []}\n```'
        notes = summarize_mod.parse_notes(raw)
        self.assertEqual(notes["summary"][0]["at"], 2)
        self.assertEqual(notes["actions"], [])

    def test_parse_notes_drops_malformed_items(self):
        raw = '{"summary": [{"nope": 1}, {"text": "ok", "at": "3"}], "actions": null}'
        notes = summarize_mod.parse_notes(raw)
        self.assertEqual(len(notes["summary"]), 1)
        self.assertEqual(notes["summary"][0]["at"], 3)

    def test_transcript_text_has_segment_numbers_and_stamps(self):
        text = summarize_mod.build_transcript_text(
            [{"start": 61.0, "text": "hello"}, {"start": 5.0, "text": "pehle"}])
        self.assertIn("[0] (01:01) hello", text)
        self.assertIn("[1] (00:05) pehle", text)

    def test_summarize_reads_choice_content(self):
        opener = fake_opener({"choices": [{"message": {
            "content": '{"summary": [{"text": "s", "at": 0}], "actions": [{"text": "a", "at": 0}]}'}}]})
        notes = summarize_mod.summarize([{"start": 0, "text": "x"}], "key", opener=opener)
        self.assertEqual(notes["actions"][0]["text"], "a")


if __name__ == "__main__":
    unittest.main()
