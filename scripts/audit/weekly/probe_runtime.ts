/**
 * Weekly Audit — A6「圖層執行期建置」探測器（真的開一個瀏覽器跑正式站）
 *
 * ── 為什麼需要這支（2026-08-22 教訓，見 INCIDENTS 同日 事件1）─────────────
 *
 * 現有 A2/A3/A4 全是靜態或 HTTP 層級的檢查：RPC 名字在不在 DB、資產 URL 回不回 200、
 * 有沒有孤兒檔。2026-08-21 的 regression 完美躲過全部三項 ——
 * 每個資產都回 200、每個 RPC 都存在，但地圖執行時 264 個 source 只建起來 103 個。
 *
 * 成因：有人在 geojson source spec 加了 `attribution: config.attribution`，
 * 而多數 overlay 沒這個欄位 → 傳進去 undefined → Mapbox 的 style 驗證整個拒絕、
 * source 不建立。這個 bug 在正式站活了一整天，是使用者貼 console 錯誤來問才被發現。
 *
 * ── ⚠️ 判準是「期望 source 少了誰」，不是「孤兒層」（實測修正）──────────────
 *
 * 第一版寫成「找 layer 指向不存在的 source」，並認為健康時恆為 0。
 * **注入真 bug 實測後發現這個訊號根本不會亮**：`addSource` 失敗後，後續
 * `addLayer` 也會一起失敗，於是 style 裡是 103 source / 226 layer 的「自洽」狀態，
 * 孤兒層 = 0。看起來完全正常。
 *
 * 真正的訊號是**數量掉了**。但數量需要基準線，而寫死門檻每週都會鏽掉。
 * 所以本支改成從 `OVERLAY_REGISTRY` 直接算出「這個版本應該要有哪些 sourceId」，
 * 再跟瀏覽器裡實際存在的對帳 —— 精確、不需基準線、而且直接指名是哪幾層沒建起來。
 *
 * ── 刻意不做的事 ──────────────────────────────────────────────
 *
 * 1. **不 toggle 任何圖層**。所有 source 在 `addAllOverlays` 時一次建立，與 toggle
 *    狀態無關（這正是那個 bug 在「全部關閉」時就看得出來的原因）。
 *    想改成逐層開啟的人請先讀：headless + SwiftShader 下重 Three.js 場景會凍住
 *    compositor（全域 memory agent-browser-mapbox-verify 第 11 條）。
 * 2. **不碰 local dev server**。巡檢時不保證有 dev server 在跑，從巡檢腳本啟動一個
 *    違反「唯讀巡檢」精神。正式站才是使用者看到的東西。
 *    （`AUDIT_RUNTIME_URL` 可覆寫，供本機驗證守門有沒有效用。）
 *
 * 依賴：全域安裝的 `agent-browser`。不在 PATH 或開不起來 → ok:false + yellow
 * 「探測被擋」，依巡檢契約第 6 條：收集器跑不動就標 blocked，絕不寫「無異常」。
 *
 * 輸出：.claude/.cache/weekly-audit/runtime.json
 * 執行：npx tsx scripts/audit/weekly/probe_runtime.ts
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(ROOT, ".claude/.cache/weekly-audit");
const OUT_FILE = path.join(OUT_DIR, "runtime.json");

// 正式站的 window.__map 只有帶 ?debug 才會掛上（src/map/MapView.tsx）
const URL = process.env.AUDIT_RUNTIME_URL ?? "https://mini-taiwan-pulse.itsmigu.com/?debug";
const SESSION = "weekly-audit-runtime";
// headless 沒有 WebGL 的話 Mapbox 整個黑畫面，這串 args 是實測必需
const BROWSER_ARGS =
  "--enable-unsafe-swiftshader,--use-gl=angle,--use-angle=swiftshader,--ignore-gpu-blocklist,--enable-webgl";
const MAP_WAIT_SEC = Number(process.env.AUDIT_RUNTIME_WAIT ?? 45);

interface Finding { id: string; level: "green" | "yellow" | "red"; title: string; detail: string; evidence: string }
const findings: Finding[] = [];
const errors: { step: string; message: string }[] = [];
let ok = true;
const started = Date.now();

function ab(args: string[], timeoutMs = 60_000): string {
  return execFileSync("agent-browser", ["--session", SESSION, ...args], {
    encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"],
  });
}
function fail(step: string, message: string, title: string, detail: string, evidence: string): never {
  ok = false;
  errors.push({ step, message });
  findings.push({ id: "A6", level: "yellow", title, detail, evidence });
  finish({});
  process.exit(0);
}
function finish(metrics: Record<string, unknown>): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify({
    collector: "runtime",
    collected_at: new Date().toISOString(),
    ok,
    duration_sec: Math.round((Date.now() - started) / 100) / 10,
    metrics, findings, errors,
  }, null, 2));
  console.log(`[probe_runtime] wrote ${OUT_FILE}`);
}
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

async function main(): Promise<void> {
  try {
    execFileSync("command", ["-v", "agent-browser"], { shell: true, stdio: "ignore" });
  } catch {
    fail("preflight", "agent-browser 不在 PATH",
      "A6 圖層執行期探測未執行（缺 agent-browser）",
      "本檢查需要真的開瀏覽器跑地圖；靜態檢查抓不到「source 建不出來」這類問題。安裝方式見全域 CLAUDE.md 的 agent-browser 段。",
      "command -v agent-browser 找不到");
  }

  try {
    ab(["--args", BROWSER_ARGS, "open", URL], 120_000);
  } catch (e) {
    fail("open", String(e).slice(0, 200),
      "A6 圖層執行期探測未執行（瀏覽器開不起來）",
      "daemon 起不來或頁面載入失敗。依契約標 blocked，不視為無異常。", `URL=${URL}`);
  }

  let ready = false;
  for (let i = 0; i < MAP_WAIT_SEC; i++) {
    try {
      const r = ab(["eval", "(() => { const m = window.__map; return !!(m && m.isStyleLoaded && m.isStyleLoaded() && window.__overlaySourceIds); })()"]);
      if (r.trim() === "true") { ready = true; break; }
    } catch { /* daemon 偶發忙碌，下一輪再試 */ }
    sleep(1000);
  }
  if (!ready) {
    fail("wait_map", `等 ${MAP_WAIT_SEC}s 後 window.__map 仍未就緒`,
      "A6 圖層執行期探測未完成（地圖未就緒）",
      "window.__map 沒掛上或 style 沒載完。正式站需帶 ?debug（見 src/map/MapView.tsx）；也可能是 WebGL 在 headless 下失敗。",
      `URL=${URL} 等待上限=${MAP_WAIT_SEC}s`);
  }

  // 期望清單直接跟站台要（見 MapView.tsx 掛 __overlaySourceIds 那段的註解）：
  // registry 在 Node 下 import 不起來，靜態 grep 又會漏掉 factory 產生的 sourceId。
  let raw: {
    expected: string[]; sources: string[]; layers: number;
    orphanLayers: { layer: string; missingSource: string }[];
  };
  try {
    raw = JSON.parse(ab(["eval", `(() => {
      const st = window.__map.getStyle();
      const sources = Object.keys(st.sources || {});
      const layers = st.layers || [];
      return {
        expected: window.__overlaySourceIds || [],
        sources,
        layers: layers.length,
        orphanLayers: layers.filter((l) => l.source && !(st.sources || {})[l.source])
          .map((l) => ({ layer: l.id, missingSource: l.source })).slice(0, 40),
      };
    })()`], 60_000));
  } catch (e) {
    fail("collect", String(e).slice(0, 200),
      "A6 圖層執行期探測未完成（eval 失敗）",
      "瀏覽器回傳的不是合法 JSON，可能是 daemon 中途重啟或頁面被導走。", `URL=${URL}`);
    return;
  }

  const expected = [...raw.expected].sort();
  const actual = new Set(raw.sources);
  const missing = expected.filter((id) => !actual.has(id));

  if (expected.length === 0) {
    fail("collect", "window.__overlaySourceIds 是空的",
      "A6 圖層執行期探測未完成（拿不到期望清單）",
      "站台沒掛 __overlaySourceIds —— 可能是還沒部署到含這段的版本，或 debug handle 沒啟用。" +
        "沒有期望清單就只能比對 source 總數，那需要基準線且會鏽掉，故直接標 blocked 不猜。",
      `URL=${URL} actual_sources=${raw.sources.length}`);
  }

  const metrics = {
    url: URL,
    expected_sources: expected.length,
    actual_sources: raw.sources.length,
    missing_sources: missing.length,
    missing_source_ids: missing.slice(0, 60),
    layers: raw.layers,
    orphan_layers: raw.orphanLayers.length,
  };

  if (missing.length > 0) {
    findings.push({
      id: "A6",
      level: "red",
      title: `${missing.length}/${expected.length} 個 overlay 的 source 在正式站沒建起來`,
      detail:
        "registry 宣告了這些 sourceId，但地圖跑起來後 style.sources 裡沒有 —— " +
        "代表 addSource 在執行期失敗，該 overlay 在站上完全不會出現。\n" +
        "⚠️ 這類故障**靜態檢查一律看不出來**：資產照樣回 200、RPC 照樣存在。\n" +
        "而且不會有孤兒層可查（source 建失敗後 addLayer 也會一起失敗，style 內部是自洽的）。\n" +
        "最常見成因：往 source spec 塞了值為 undefined 的鍵，Mapbox 的 style 驗證會整個拒絕。\n" +
        "到 console 找 `Error: sources.<id>.` 開頭那行，它會直接指出是哪個欄位。\n\n" +
        `沒建起來的：${missing.join(", ")}`,
      evidence: `期望 ${expected.length} / 實際 ${raw.sources.length}（含 base style 自帶的 source）`,
    });
  } else {
    findings.push({
      id: "A6",
      level: "green",
      title: `圖層執行期建置正常（registry ${expected.length} 個 source 全部建起來，共 ${raw.layers} layer）`,
      detail: "正式站實際跑起來的地圖狀態，非靜態推論。",
      evidence: `URL=${URL} actual_sources=${raw.sources.length}`,
    });
  }
  if (raw.orphanLayers.length > 0) {
    findings.push({
      id: "A6",
      level: "yellow",
      title: `${raw.orphanLayers.length} 個 layer 指向不存在的 source`,
      detail: "次要訊號。主要故障型態（addSource 失敗）不會產生孤兒層，所以這裡有東西代表是另一種接線問題。",
      evidence: raw.orphanLayers.slice(0, 6).map((o) => `${o.layer} → ${o.missingSource}`).join("; "),
    });
  }

  console.log(`[probe_runtime] expected=${expected.length} actual=${raw.sources.length} missing=${missing.length} layers=${raw.layers}`);
  finish(metrics);
}

main()
  .catch((e) => {
    ok = false;
    errors.push({ step: "fatal", message: String((e as Error)?.stack ?? e).slice(0, 400) });
    findings.push({
      id: "A6", level: "yellow", title: "A6 圖層執行期探測失敗（未預期例外）",
      detail: "見 errors[]。依契約標 blocked，不視為無異常。", evidence: "",
    });
    finish({});
  })
  .finally(() => {
    try { ab(["close"], 20_000); } catch { /* 關不掉就算了，daemon 會自己回收 */ }
  });
