#!/usr/bin/env node
/**
 * 正式站外部檢查（UPT-1）與輪替資料新鮮度（SYNCR-1）。由 .github/workflows/site-watch.yml、rotating-freshness.yml 排程呼叫；
 * 任何一項失敗 exit 1，通知交給 schedule-watch.yml（連續失敗 N 次發 🔴、恢復發 ✅）。零相依，本機可直接跑：
 *
 *   node scripts/monitor/site-health.mjs                    # uptime：首頁、main-*.js、主站 PMTiles Range、R2 lock 資產 Range
 *   node scripts/monitor/site-health.mjs --mode freshness   # climate 輪替資料 generated_at 距今幾小時
 *
 * 兩個模式分成兩支 workflow：資料長期落後（紅燈持續）不會蓋掉之後真正的站台中斷通知。
 * GFW 小時檔停更是刻意的（collector 等授權），不檢查。
 */
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SITE = "https://mini-taiwan-pulse.itsmigu.com";
// 首頁必須含的標記：React 掛載點、站名 title、主程式 bundle
export const HOME_MARKERS = ['id="root"', "<title>Mini Taiwan Pulse"];
// 經 Worker 轉送 R2 的圖層大檔（同 deploy-workers.yml smoke 的 RANGE_PATHS 第一個）
export const SITE_PMTILES = "/urban/street_trees_national.pmtiles";
// R2 公開網域直連的 lock 內小檔（8 KB）：確認 data.itsmigu.com 與 lock 契約都還在
export const LOCK_SAMPLE = "public/agriculture/eco_network_zones_points.pmtiles";
export const CLIMATE_MANIFEST = "https://data.itsmigu.com/site/climate/frames/manifest.json";
// climate_bake 每 6 小時出一版（DATA_SCOPE.md「climate_bake 每 6h」），sync-rotating 每小時搬到 R2：
// 正常最大落後 ≈ 6h（等下一版）＋1h（等同步）。門檻取 12h＝連續漏掉兩版才響，排程偶爾延遲不會誤報。
export const CLIMATE_MAX_AGE_HOURS = 12;
// R2 公開網域會擋部分自動化 User-Agent（同 scripts/deploy/check-assets.mjs）
const HEADERS = { "User-Agent": "curl/8.7.1 (pulse site-health)" };
const PMTILES_MAGIC = "PMTiles";

/** index.html 引用的 /assets/main-<hash>.js；沒有回傳 null */
export function findMainScript(html) {
  return html.match(/\/assets\/main-[A-Za-z0-9_-]+\.js/)?.[0] ?? null;
}

/** 首頁判定：回傳錯誤訊息或 null */
export function checkHome(status, html) {
  if (status !== 200) return `首頁 HTTP ${status}`;
  const missing = HOME_MARKERS.filter((m) => !html.includes(m));
  if (missing.length) return `首頁缺少標記：${missing.join("、")}`;
  if (!findMainScript(html)) return "首頁沒有引用 /assets/main-*.js";
  return null;
}

/** Range 回應判定：要 206、內容開頭是 PMTiles magic；expectTotal 有給時比對 Content-Range 的總長 */
export function checkPmtilesRange(status, headers, body, expectTotal) {
  if (status !== 206) return `Range 回 HTTP ${status}（預期 206）`;
  const head = Buffer.from(body).subarray(0, PMTILES_MAGIC.length).toString("latin1");
  if (head !== PMTILES_MAGIC) return `內容開頭不是 PMTiles（${JSON.stringify(head)}）`;
  if (expectTotal != null) {
    const total = Number(headers.get("content-range")?.split("/")[1]);
    if (total !== expectTotal) return `檔案大小 ${total} 與 lock ${expectTotal} 不符`;
  }
  return null;
}

/** climate manifest 新鮮度：回傳 {ageHours, error} */
export function evaluateFreshness(manifest, now, maxAgeHours = CLIMATE_MAX_AGE_HOURS) {
  const t = Date.parse(manifest?.generated_at ?? "");
  if (!Number.isFinite(t)) return { ageHours: null, error: "manifest 沒有可解析的 generated_at" };
  const ageHours = (now.getTime() - t) / 3600000;
  if (ageHours > maxAgeHours) {
    return { ageHours, error: `climate generated_at ${manifest.generated_at} 已落後 ${ageHours.toFixed(1)} 小時（門檻 ${maxAgeHours}）` };
  }
  return { ageHours, error: null };
}

async function request(url, init = {}, fetchImpl = fetch) {
  // 只重試一次：偶發的連線錯誤不算當機；真的壞掉時下一輪排程還會再紅（schedule-watch 要連續 2 次才通知）
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetchImpl(url, { ...init, headers: { ...HEADERS, ...init.headers }, signal: AbortSignal.timeout(30000) });
      const body = new Uint8Array(await res.arrayBuffer());
      return { status: res.status, headers: res.headers, body };
    } catch (err) {
      if (attempt >= 2) return { status: 0, headers: new Headers(), body: new Uint8Array(), error: err.message };
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

const text = (body) => new TextDecoder().decode(body);

export async function runUptime({ fetchImpl = fetch, lock } = {}) {
  const results = [];
  const add = (name, error, detail = "") => results.push({ name, ok: !error, detail: error ?? detail });

  const home = await request(`${SITE}/?watch=1`, {}, fetchImpl);
  const homeHtml = text(home.body);
  add("首頁 200＋標記", home.error ?? checkHome(home.status, homeHtml), `HTTP ${home.status}`);

  const main = findMainScript(homeHtml);
  if (main) {
    const js = await request(`${SITE}${main}`, {}, fetchImpl);
    const err = js.error ?? (js.status !== 200 ? `HTTP ${js.status}` : js.body.length < 100000 ? `只有 ${js.body.length} bytes` : null);
    add(`main bundle ${main}`, err, `HTTP ${js.status}、${js.body.length} bytes`);
  } else add("main bundle", "首頁沒有 main-*.js，無法檢查");

  const pm = await request(`${SITE}${SITE_PMTILES}`, { headers: { Range: "bytes=0-15" } }, fetchImpl);
  add(`主站 PMTiles Range ${SITE_PMTILES}`, pm.error ?? checkPmtilesRange(pm.status, pm.headers, pm.body), `HTTP ${pm.status}、x-pulse-src ${pm.headers.get("x-pulse-src") ?? "-"}`);

  const entry = lock.entries.find((e) => e.path === LOCK_SAMPLE);
  if (!entry) add(`R2 lock 資產 ${LOCK_SAMPLE}`, "lock 沒有這個檔（請改 LOCK_SAMPLE）");
  else {
    const url = lock.r2_base + entry.path.slice("public/".length);
    const r2 = await request(url, { headers: { Range: "bytes=0-15" } }, fetchImpl);
    add(`R2 lock 資產 ${LOCK_SAMPLE}`, r2.error ?? checkPmtilesRange(r2.status, r2.headers, r2.body, entry.bytes), `HTTP ${r2.status}、總長 ${r2.headers.get("content-range")?.split("/")[1] ?? "-"}`);
  }
  return results;
}

export async function runFreshness({ fetchImpl = fetch, now = new Date() } = {}) {
  const res = await request(CLIMATE_MANIFEST, {}, fetchImpl);
  if (res.error || res.status !== 200) return [{ name: "climate manifest", ok: false, detail: res.error ?? `HTTP ${res.status}` }];
  let manifest;
  try {
    manifest = JSON.parse(text(res.body));
  } catch {
    return [{ name: "climate manifest", ok: false, detail: "不是合法 JSON" }];
  }
  const { ageHours, error } = evaluateFreshness(manifest, now);
  const lm = res.headers.get("last-modified") ?? "-";
  return [{
    name: `climate 輪替資料新鮮度（門檻 ${CLIMATE_MAX_AGE_HOURS} 小時）`,
    ok: !error,
    detail: error ?? `generated_at ${manifest.generated_at}（${ageHours.toFixed(1)} 小時前）；R2 last-modified ${lm}`,
  }];
}

export function report(title, results, summaryFile) {
  const lines = results.map((r) => `${r.ok ? "✓" : "✗"} ${r.name}：${r.detail}`);
  console.log(`${title}\n${lines.join("\n")}`);
  for (const r of results) if (!r.ok) console.log(`::error::${r.name}：${r.detail}`);
  if (summaryFile) {
    const md = [`### ${title}`, "", "| | 檢查 | 結果 |", "|---|---|---|", ...results.map((r) => `| ${r.ok ? "✅" : "❌"} | ${r.name} | ${r.detail} |`), ""];
    appendFileSync(summaryFile, md.join("\n") + "\n");
  }
  return results.every((r) => r.ok) ? 0 : 1;
}

async function main() {
  const i = process.argv.indexOf("--mode");
  const mode = i >= 0 ? process.argv[i + 1] : "uptime";
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (mode === "freshness") return report("輪替資料新鮮度", await runFreshness(), summary);
  if (mode !== "uptime") throw new Error(`未知模式 ${mode}（uptime｜freshness）`);
  const lock = JSON.parse(readFileSync(new URL("../../deploy/public-assets.lock.json", import.meta.url), "utf8"));
  return report(`正式站外部檢查 ${SITE}`, await runUptime({ lock }), summary);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main();
