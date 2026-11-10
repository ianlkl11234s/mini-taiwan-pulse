// node --test scripts/monitor/site-health.test.mjs（npm run check:monitor）
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  LOCK_SAMPLE,
  checkHome,
  checkPmtilesRange,
  evaluateFreshness,
  findMainScript,
  runFreshness,
  runUptime,
} from "./site-health.mjs";

const HTML = '<html><head><title>Mini Taiwan Pulse｜台灣</title><script src="/assets/main-BcX6kBMa.js"></script></head><body><div id="root"></div></body></html>';
const magic = (extra = "") => new TextEncoder().encode(`PMTiles${extra}`);

test("findMainScript／checkHome", () => {
  assert.equal(findMainScript(HTML), "/assets/main-BcX6kBMa.js");
  assert.equal(findMainScript("<html></html>"), null);
  assert.equal(checkHome(200, HTML), null);
  assert.match(checkHome(503, HTML), /HTTP 503/);
  assert.match(checkHome(200, HTML.replace('id="root"', "")), /缺少標記/);
  // Worker 錯誤頁也是 200 但沒有 main bundle
  assert.match(checkHome(200, '<title>Mini Taiwan Pulse</title><div id="root"></div>'), /main-\*\.js/);
});

test("checkPmtilesRange", () => {
  const h = (range) => new Headers(range ? { "content-range": range } : {});
  assert.equal(checkPmtilesRange(206, h(), magic("\x03")), null);
  assert.match(checkPmtilesRange(200, h(), magic()), /預期 206/);
  assert.match(checkPmtilesRange(206, h(), new TextEncoder().encode("<!doctype html>")), /不是 PMTiles/);
  assert.equal(checkPmtilesRange(206, h("bytes 0-15/8290"), magic(), 8290), null);
  assert.match(checkPmtilesRange(206, h("bytes 0-15/9000"), magic(), 8290), /與 lock 8290 不符/);
});

test("evaluateFreshness：門檻 12 小時", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  assert.equal(evaluateFreshness({ generated_at: "2026-11-10T01:00:00Z" }, now).error, null);
  assert.match(evaluateFreshness({ generated_at: "2026-11-09T23:00:00Z" }, now).error, /落後 13\.0 小時/);
  assert.match(evaluateFreshness({}, now).error, /generated_at/);
  assert.match(evaluateFreshness(null, now).error, /generated_at/);
});

test("LOCK_SAMPLE 在 lock 內", () => {
  const lock = JSON.parse(readFileSync(new URL("../../deploy/public-assets.lock.json", import.meta.url), "utf8"));
  assert.ok(lock.entries.some((e) => e.path === LOCK_SAMPLE));
});

/** 依網址回應的假 fetch */
function fakeFetch(routes) {
  return async (url) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected ${url}`);
    const r = routes[key];
    return new Response(r.body, { status: r.status, headers: r.headers ?? {} });
  };
}
const LOCK = { r2_base: "https://data.example/site/", entries: [{ path: LOCK_SAMPLE, bytes: 8290 }] };

test("runUptime：全部正常", async () => {
  const results = await runUptime({
    lock: LOCK,
    fetchImpl: fakeFetch({
      "/?watch=1": { status: 200, body: HTML },
      "/assets/main-": { status: 200, body: "x".repeat(200000) },
      "street_trees": { status: 206, body: magic(), headers: { "x-pulse-src": "r2" } },
      "data.example": { status: 206, body: magic(), headers: { "content-range": "bytes 0-15/8290" } },
    }),
  });
  assert.deepEqual(results.map((r) => r.ok), [true, true, true, true]);
});

test("runUptime：Worker 回 HTML 而不是圖磚、R2 404", async () => {
  const results = await runUptime({
    lock: LOCK,
    fetchImpl: fakeFetch({
      "/?watch=1": { status: 200, body: HTML },
      "/assets/main-": { status: 200, body: "x".repeat(200000) },
      "street_trees": { status: 200, body: "<!doctype html>" },
      "data.example": { status: 404, body: "" },
    }),
  });
  assert.deepEqual(results.map((r) => r.ok), [true, true, false, false]);
});

test("runFreshness", async () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const ok = await runFreshness({ now, fetchImpl: fakeFetch({ "climate": { status: 200, body: '{"generated_at":"2026-11-10T06:00:00Z"}' } }) });
  assert.equal(ok[0].ok, true);
  const stale = await runFreshness({ now, fetchImpl: fakeFetch({ "climate": { status: 200, body: '{"generated_at":"2026-11-09T06:00:00Z"}' } }) });
  assert.equal(stale[0].ok, false);
  const bad = await runFreshness({ now, fetchImpl: fakeFetch({ "climate": { status: 200, body: "<html>" } }) });
  assert.equal(bad[0].ok, false);
});
