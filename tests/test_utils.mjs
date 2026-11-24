/* BolNote utils tests — run: node tests/test_utils.mjs */
import assert from "node:assert";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const U = require("../utils.js");

let passed = 0;
function t(name, fn) { fn(); passed++; console.log("ok -", name); }

t("planChunks covers the duration exactly", () => {
  const plan = U.planChunks(130, 55);
  assert.deepEqual(plan.map(c => [c.start, c.end]), [[0, 55], [55, 110], [110, 130]]);
  assert.deepEqual(U.planChunks(0), []);
  assert.equal(U.planChunks(55).length, 1);
});

t("mergeSegments applies chunk offsets and sorts", () => {
  const merged = U.mergeSegments([
    { offset: 55, segments: [{ start: 0, end: 4, text: " dusra hissa " }] },
    { offset: 0, segments: [{ start: 1, end: 5, text: "pehla hissa" }, { start: 6, end: 8, text: "  " }] },
  ]);
  assert.equal(merged.length, 2);               // empty text dropped
  assert.equal(merged[0].text, "pehla hissa");  // sorted by absolute start
  assert.equal(merged[1].start, 55);
  assert.equal(merged[1].index, 1);
});

t("detectScript separates Devanagari, Latin and mixed", () => {
  assert.equal(U.detectScript("यह हिंदी है"), "devanagari");
  assert.equal(U.detectScript("this is english"), "latin");
  assert.equal(U.detectScript("यह mixed है ok"), "mixed");
});

t("formatTime and SRT stamps", () => {
  assert.equal(U.formatTime(0), "00:00");
  assert.equal(U.formatTime(75), "01:15");
  assert.equal(U.formatTime(3661), "1:01:01");
  const srt = U.toSRT([{ start: 1.5, end: 3.25, text: "namaste" }]);
  assert.ok(srt.includes("00:00:01,500 --> 00:00:03,250"));
  assert.ok(srt.includes("namaste"));
});

t("plain text export carries timestamps", () => {
  const txt = U.toPlainText([{ start: 61, end: 63, text: "hello" }]);
  assert.equal(txt, "[01:01] hello");
});

console.log(`\n${passed} utils tests passed`);
