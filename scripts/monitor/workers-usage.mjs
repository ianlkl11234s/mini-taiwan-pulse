#!/usr/bin/env node
/**
 * Cloudflare Workers 當日（UTC）請求數告警（CFW-1）。由 .github/workflows/workers-usage.yml 每 2 小時呼叫。
 *
 * 使用者 2026-11-10 決定：不升級付費、不改圖磚直連；只在當日請求數超過免費額度 10 萬的 6 成時發 Telegram。
 * 額度是帳號層級（同帳號所有 Worker 合計，包含 13 個靜態站），所以不篩 scriptName，加總全部。
 * 主站 run_worker_first，靜態資產請求也會進 Worker、算在 invocations 裡（以 Cloudflare 後台 Metrics 對帳為準）。
 *
 * 環境變數：CF_ANALYTICS_API_TOKEN（Account Analytics: Read）、CLOUDFLARE_ACCOUNT_ID。
 * 缺任一個 → 印 ::warning:: 並在 summary 寫「未設定、已跳過」，exit 0（不是假裝有在看：summary 與 annotation 會明寫）。
 *
 *   node scripts/monitor/workers-usage.mjs [--since-last <ISO 時間>]
 *     --since-last：同一 UTC 日上一次成功執行的時間。超過門檻時再查一次「當時」的累計，
 *                   當時已超過就代表那一輪已經通知過 → 不重送（每個 UTC 日只通知一次，不需另存狀態）。
 * 輸出（GITHUB_OUTPUT）：status=ok|over-new|over-already|skipped、total、pct、message。查詢失敗 exit 1。
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
export const DAILY_LIMIT = 100000; // Workers Free：每日 10 萬請求，UTC 00:00 重置
export const ALERT_RATIO = 0.6;

const QUERY = `query WorkersDaily($accountTag: string, $start: string, $end: string) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      workersInvocationsAdaptive(limit: 1000, filter: {datetime_geq: $start, datetime_leq: $end}) {
        sum { requests }
        dimensions { scriptName }
      }
    }
  }
}`;

/** UTC 當日 00:00 到 now 的查詢本體（欄位依 Cloudflare 文件 querying-workers-metrics 範例） */
export function buildRequest(accountId, now, end = now) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  return { query: QUERY, variables: { accountTag: accountId, start, end: end.toISOString() } };
}

/** GraphQL 回應 → {total, byScript}；有 errors 或結構不對就丟錯（不可當成 0） */
export function parseUsage(json) {
  if (json?.errors?.length) throw new Error(`GraphQL errors：${json.errors.map((e) => e.message).join("；")}`);
  const accounts = json?.data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length !== 1) throw new Error("回應沒有剛好一個 account（account id 或 token 權限不對？）");
  const rows = accounts[0].workersInvocationsAdaptive;
  if (!Array.isArray(rows)) throw new Error("回應沒有 workersInvocationsAdaptive");
  const byScript = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r?.sum?.requests);
    if (!Number.isFinite(n)) throw new Error(`requests 不是數字：${JSON.stringify(r)}`);
    const name = r?.dimensions?.scriptName ?? "(unknown)";
    byScript[name] = (byScript[name] ?? 0) + n;
    total += n;
  }
  return { total, byScript };
}

export function isOver(total, limit = DAILY_LIMIT, ratio = ALERT_RATIO) {
  return total > limit * ratio;
}

/** 判定是否要送：現在超過、而上一次成功執行時（同 UTC 日）還沒超過 → over-new */
export function decide(totalNow, totalAtLastRun) {
  if (!isOver(totalNow)) return "ok";
  return totalAtLastRun != null && isOver(totalAtLastRun) ? "over-already" : "over-new";
}

async function queryTotal(token, accountId, now, end, fetchImpl) {
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildRequest(accountId, now, end)),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Cloudflare GraphQL HTTP ${res.status}`);
  return parseUsage(await res.json());
}

export async function run({ token, accountId, now = new Date(), sinceLast, fetchImpl = fetch }) {
  if (!token || !accountId) return { status: "skipped" };
  const { total, byScript } = await queryTotal(token, accountId, now, now, fetchImpl);
  let atLast = null;
  const last = sinceLast ? new Date(sinceLast) : null;
  const sameDay = last && Number.isFinite(last.getTime()) && last.toISOString().slice(0, 10) === now.toISOString().slice(0, 10) && last < now;
  if (isOver(total) && sameDay) atLast = (await queryTotal(token, accountId, now, last, fetchImpl)).total;
  return { status: decide(total, atLast), total, byScript, pct: (total / DAILY_LIMIT) * 100 };
}

function out(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

async function main() {
  const i = process.argv.indexOf("--since-last");
  const sinceLast = i >= 0 ? process.argv[i + 1] : undefined;
  const summary = process.env.GITHUB_STEP_SUMMARY;
  const r = await run({ token: process.env.CF_ANALYTICS_API_TOKEN, accountId: process.env.CLOUDFLARE_ACCOUNT_ID, sinceLast });
  out("status", r.status);
  if (r.status === "skipped") {
    const msg = "CF_ANALYTICS_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID 未設定：Workers 用量告警未運作、本次已跳過";
    console.log(`::warning::${msg}`);
    if (summary) appendFileSync(summary, `### Workers 用量\n\n⚠️ ${msg}\n`);
    return 0;
  }
  const pct = r.pct.toFixed(1);
  const top = Object.entries(r.byScript).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join("、");
  const message = `Cloudflare Workers 今日（UTC）請求 ${r.total.toLocaleString("en-US")}／${DAILY_LIMIT.toLocaleString("en-US")}（${pct}%，門檻 ${ALERT_RATIO * 100}%）；前幾名：${top || "-"}`;
  console.log(`${r.status}：${message}`);
  if (r.status !== "ok") console.log(`::warning::${message}`);
  out("total", r.total);
  out("pct", pct);
  out("message", message.replace(/\n/g, " "));
  if (summary) appendFileSync(summary, `### Workers 用量\n\n${r.status === "ok" ? "✅" : "⚠️"} ${message}（判定 ${r.status}）\n`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exitCode = await main();
  } catch (err) {
    console.log(`::error::Workers 用量查詢失敗：${err.message}`);
    process.exitCode = 1;
  }
}
