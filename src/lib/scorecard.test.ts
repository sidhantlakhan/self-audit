import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLANK_DETAILS, bandFor, computeScores, firstIncompletePillar, gapPillars, gaugeOffset, maskMobile,
  routeFor, sanitiseAnswers, validateDetails, type Answer,
} from "./scorecard.ts";
import { SAMPLE_ANSWERS } from "./sample.ts";

test("Kavya sample answers score 9, 7, 5, 8, 9 = 38, Foundation first, Data weakest", () => {
  const s = computeScores(SAMPLE_ANSWERS);
  assert.deepEqual(s.pillars, [9, 7, 5, 8, 9]);
  assert.equal(s.total, 38);
  assert.equal(s.band, "foundation");
  assert.equal(s.weakest, 2);
});

test("gaps are the three lowest pillars, lowest first, ties by order", () => {
  assert.deepEqual(gapPillars([9, 7, 5, 8, 9]), [2, 1, 3]);
  assert.deepEqual(gapPillars([4, 4, 4, 10, 2]), [4, 0, 1]);
});

test("band boundaries follow 0–40, 41–70, 71–100", () => {
  assert.equal(bandFor(0).key, "foundation");
  assert.equal(bandFor(40).key, "foundation");
  assert.equal(bandFor(41).key, "getting-ready");
  assert.equal(bandFor(70).key, "getting-ready");
  assert.equal(bandFor(71).key, "ai-ready");
  assert.equal(bandFor(100).key, "ai-ready");
});

test("scoring refuses incomplete answers", () => {
  const a: Answer[] = SAMPLE_ANSWERS.slice();
  a[12] = null;
  assert.throws(() => computeScores(a));
  assert.equal(firstIncompletePillar(a), 2);
});

test("sanitiseAnswers keeps 0–4 integers only and always returns 25", () => {
  const a = sanitiseAnswers([0, 4, 5, -1, "3", 2.5, null, 3]);
  assert.equal(a.length, 25);
  assert.deepEqual(a.slice(0, 8), [0, 4, null, null, null, null, null, 3]);
});

test("turnover routing", () => {
  assert.equal(routeFor("Under ₹1 crore"), "low");
  assert.equal(routeFor("₹1–3 crore"), "mid");
  assert.equal(routeFor("₹3–10 crore"), "mid");
  assert.equal(routeFor("₹10–25 crore"), "high");
  assert.equal(routeFor("Above ₹25 crore"), "high");
});

test("mobile mask matches the design", () => {
  assert.equal(maskMobile("9876543210"), "+91 98••• ••210");
  assert.equal(maskMobile("+91 98765 43210"), "+91 98••• ••210");
});

test("gauge offset for 38 matches the design arc", () => {
  assert.equal(gaugeOffset(38), 175.3);
  assert.equal(gaugeOffset(100), 0);
});

test("details validation", () => {
  const e = validateDetails({ ...BLANK_DETAILS, name: "Kiran", wa: "98765", email: "kiran@kavya" });
  assert.deepEqual(Object.keys(e).sort(), ["biz", "city", "consent", "email", "industry", "team", "turnover", "wa"]);
  const ok = validateDetails({
    name: "Kiran Mehta", biz: "Kavya Industrial Supplies", industry: "Trading", city: "Rajkot",
    turnover: "₹3–10 crore", team: "8–20", wa: "98765 43210", email: "kiran@kavya.in", consent: true,
  });
  assert.deepEqual(ok, {});
});
