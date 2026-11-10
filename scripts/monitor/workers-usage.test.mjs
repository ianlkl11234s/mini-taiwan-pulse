// node --test scripts/monitor/workers-usage.test.mjs（npm run check:monitor）：只用假回應，不呼叫 Cloudflare
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRequest, decide, isOver, parseUsage, run } from "./workers-usage.mjs";

const resp = (...rows) => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: rows.map(([s, n]) => ({ sum: { requests: n }, dimensions: { scriptName: s } })) }] } } });

test("buildRequest：UTC 當日 00:00 起、不篩 scriptName", () => {
  const r = buildRequest("acc", new Date("2026-11-10T05:30:00Z"));
  assert.deepEqual(r.variables, { accountTag: "acc", start: "2026-11-10T00:00:00.000Z", end: "2026-11-10T05:30:00.000Z" });
  assert.match(r.query, /workersInvocationsAdaptive/);
  assert.doesNotMatch(r.query, /scriptName:/);
});

test("parseUsage：加總所有 Worker", () => {
  const u = parseUsage(resp(["mini-tw-pulse", 50000], ["blog", 3000], ["mini-tw-pulse", 1000]));
  assert.equal(u.total, 54000);
  assert.deepEqual(u.byScript, { "mini-tw-pulse": 51000, blog: 3000 });
  assert.equal(parseUsage(resp()).total, 0);
});

test("parseUsage：錯誤與結構不對要丟錯，不可當 0", () => {
  assert.throws(() => parseUsage({ errors: [{ message: "not authorized" }] }), /not authorized/);
  assert.throws(() => parseUsage({ data: { viewer: { accounts: [] } } }), /account/);
  assert.throws(() => parseUsage({ data: { viewer: { accounts: [{}] } } }), /workersInvocationsAdaptive/);
  assert.throws(() => parseUsage({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ sum: {} }] }] } } }), /不是數字/);
});

test("門檻 6 成與每日只通知一次", () => {
  assert.equal(isOver(60000), false);
  assert.equal(isOver(60001), true);
  assert.equal(decide(59000, null), "ok");
  assert.equal(decide(61000, null), "over-new");
  assert.equal(decide(61000, 40000), "over-new");
  assert.equal(decide(70000, 62000), "over-already");
});

test("run：缺 secret 跳過、超過時查上一輪", async () => {
  assert.deepEqual(await run({ token: "", accountId: "a" }), { status: "skipped" });
  const calls = [];
  const fetchImpl = async (_url, init) => {
    const { variables } = JSON.parse(init.body);
    calls.push(variables.end);
    return new Response(JSON.stringify(resp(["w", variables.end.startsWith("2026-11-10T04") ? 62000 : 65000])));
  };
  const now = new Date("2026-11-10T06:00:00Z");
  const r = await run({ token: "t", accountId: "a", now, sinceLast: "2026-11-10T04:00:00Z", fetchImpl });
  assert.equal(r.status, "over-already");
  assert.equal(calls.length, 2);
  // 上一輪是前一天 → 不比，直接 over-new
  calls.length = 0;
  const r2 = await run({ token: "t", accountId: "a", now, sinceLast: "2026-11-09T23:00:00Z", fetchImpl });
  assert.equal(r2.status, "over-new");
  assert.equal(calls.length, 1);
  await assert.rejects(run({ token: "t", accountId: "a", now, fetchImpl: async () => new Response("x", { status: 403 }) }), /HTTP 403/);
});
