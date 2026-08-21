/**
 * Weekly Audit — A 組「圖層資料活性」探測器（A2 / A3 / A4 / A5）
 *
 * 直接 import layerManifest.ts 的 LAYER_MANIFEST（不 grep 硬解析，見
 * docs/proposal/weekly-audit-2026-08-21/README.md §2 A 組）。
 *
 *   A2 RPC 死鏈（零風險版，v1 不實際呼叫 RPC）：
 *     比對 src/ 內 `.rpc(...)` 呼叫名 vs DB `public` schema 現存 function/procedure 名。
 *     ⚠️ 純字面比對會把「程式碼註解裡示範用的 RPC 名」也算進去（例如
 *     src/data/staticRpc.ts 的 `supabase.rpc("get_x")` 範例）——這種名字在 DB 找不到，
 *     但不是真死鏈。逐一檢查每個「找不到」的名字是否全部出現在 `//` 註解裡，
 *     只有「不是純註解」的才算進 rpc_dead_links / 觸發 red，純註解的另外列出但不算數
 *     （教訓見 README §首波發現 1：「任何慢查詢/怪訊號都要先查是誰在打再定嚴重度」）。
 *
 *   A3 靜態資產線上活性 + A4 PMTiles 遠端存在性（合併成一次 HEAD 掃描）：
 *     manifest 的 `source.kind === 'geojson' | 'pmtiles'` 的 url，加上
 *     `kind === 'supabase'` 的 fallbackUrl（後者多筆共享 `./geo/_empty.geojson`，
 *     去重後只驗一次）。一律 HEAD、絕不 GET（站上有 46MB 級檔案）。
 *
 *   A5 孤兒資產：
 *     掃 public/ 下所有 .geojson/.pmtiles 實體檔，比對 manifest「所有」引用欄位
 *     （url / fallbackUrl / companionAssets / custom.staticAssets，比 A3/A4 的檢查
 *     範圍更寬——這裡要的是「有沒有被引用過」，不是「有沒有被線上驗過」）。
 *     ⚠️ 已知盲區：`dataClass: D` 的 `kind: "custom"` 層若沒填 `staticAssets`
 *     （例如 rail：Three.js RailScene 自己 fetch 一批 public/rail/** 檔案，manifest
 *     刻意不登記），底下的檔案會全部被判成「孤兒」——這是 manifest 本身尚未涵蓋
 *     的已知盲區，不是本腳本的 bug，寫進 finding detail 提醒判讀者。
 *
 * 輸出：.claude/.cache/weekly-audit/layers.json（不進版控）
 * 執行：npx tsx scripts/audit/weekly/probe_layers.ts
 *
 * 硬約束：正式 DB 唯讀（本檔只 SELECT）；絕不印出 SUPABASE_DB_URL 本身；
 *         大檔一律 HEAD 不 GET；任何子檢查失敗進 errors[] 但不中斷整支。
 *         重查詢（DB + 200 個 HEAD）建議避開台灣 10:00–20:00 餐期尖峰，
 *         固定排在週日晚上或週一早上跑（腳本不強制擋，僅為排程建議）。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

import { LAYER_MANIFEST, type LayerSource } from "../../../src/data/layerManifest";

// ── 路徑 ──────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, ".claude/.cache/weekly-audit");
const OUT_FILE = path.join(OUT_DIR, "layers.json");

const PROD_BASE = "https://mini-taiwan-pulse.itsmigu.com";
const HEAD_CONCURRENCY = 8;
const HEAD_TIMEOUT_MS = 15_000;
const HEAD_RETRIES = 1; // 失敗後再試一次

loadDotenv({ path: path.join(ROOT, ".env"), quiet: true });

// ── 型別 ──────────────────────────────────────────────────────────
type Level = "green" | "yellow" | "red";
interface Finding {
  id: string;
  level: Level;
  title: string;
  detail: string;
  evidence: string;
}
interface ErrorEntry {
  step: string;
  message: string;
}

// ── 小工具 ────────────────────────────────────────────────────────

/** 防呆用：任何要進 JSON 的字串都過一次，濾掉可能誤入的連線字串／JWT／API key。 */
function redact(s: string): string {
  return s
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "<REDACTED>")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<REDACTED>")
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "<REDACTED>")
    .replace(/password\s*=\s*\S+/gi, "password=<REDACTED>");
}

function deepRedact<T>(value: T): T {
  if (typeof value === "string") return redact(value) as unknown as T;
  if (Array.isArray(value)) return value.map(deepRedact) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deepRedact(v);
    return out as T;
  }
  return value;
}

function normalizeAssetPath(url: string): string {
  return url.replace(/^\.\//, "");
}

/** 簡易併發池，避免額外裝 p-limit。 */
async function pMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function isGitIgnored(relPathFromRoot: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", relPathFromRoot], { cwd: ROOT });
    return true; // exit 0 = ignored
  } catch {
    return false; // exit 1（未被忽略）或其他錯誤都當作「非忽略」處理
  }
}

function walkAssetFiles(dir: string, exts: string[], acc: { relPath: string; size: number }[] = []) {
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAssetFiles(full, exts, acc);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      const size = statSync(full).size;
      acc.push({ relPath: path.relative(PUBLIC_DIR, full), size });
    }
  }
  return acc;
}

// ── A2：RPC 死鏈 ──────────────────────────────────────────────────
interface RpcOccurrence {
  file: string;
  line: number;
  isComment: boolean;
}

function collectFrontendRpcCalls(errors: ErrorEntry[]): Map<string, RpcOccurrence[]> {
  const byName = new Map<string, RpcOccurrence[]>();
  try {
    // -a：src/data/layerParamsSpec.ts 含非文字位元組會被 BSD grep 判成 binary
    //     而靜默回傳空結果（見 README §3.1 陷阱 1），一律加 -a 防這個坑。
    const out = execFileSync(
      "grep",
      ["-arnE", String.raw`\.rpc\(\s*['"][a-z0-9_]+`, "src/"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    for (const line of out.split("\n")) {
      if (!line.trim()) continue;
      const m = line.match(/^([^:]+):(\d+):(.*)$/);
      if (!m) continue;
      const [, file, lineNoStr, content] = m;
      const nameMatch = content!.match(/\.rpc\(\s*['"]([a-z0-9_]+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1]!;
      const rpcIdx = content!.indexOf(".rpc(");
      const before = rpcIdx >= 0 ? content!.slice(0, rpcIdx) : "";
      const isComment = before.includes("//");
      const list = byName.get(name) ?? [];
      list.push({ file: file!, line: Number(lineNoStr), isComment });
      byName.set(name, list);
    }
  } catch (e) {
    errors.push({ step: "A2:grep_frontend_rpc", message: redact(String((e as Error).message ?? e)) });
  }
  return byName;
}

function collectDbFunctionNames(errors: ErrorEntry[]): Set<string> {
  const names = new Set<string>();
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    errors.push({ step: "A2:db_functions", message: "SUPABASE_DB_URL 未設定，略過 DB 端比對" });
    return names;
  }
  try {
    const query =
      "SELECT DISTINCT p.proname FROM pg_proc p " +
      "JOIN pg_namespace n ON n.oid = p.pronamespace " +
      "WHERE n.nspname = 'public' AND p.prokind IN ('f','p') ORDER BY 1;";
    const out = execFileSync(
      "psql",
      [dbUrl, "-At", "-v", "ON_ERROR_STOP=1", "-c", "SET statement_timeout='30s'", "-c", query],
      { encoding: "utf8", timeout: 30_000 },
    );
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) names.add(trimmed);
    }
  } catch (e) {
    errors.push({ step: "A2:db_functions", message: redact(String((e as Error).message ?? e)) });
  }
  return names;
}

// ── 主流程 ────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  const errors: ErrorEntry[] = [];
  const findings: Finding[] = [];

  const entries = Object.values(LAYER_MANIFEST) as Array<{
    dataClass: "A" | "B" | "C" | "D";
    source: LayerSource | LayerSource[];
  }>;
  const layerCount = entries.length;
  const byDataClass: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const e of entries) byDataClass[e.dataClass] = (byDataClass[e.dataClass] ?? 0) + 1;

  // 抽出 A3/A4 要驗的「線上活性」清單（narrow）跟 A5 要比對的「引用」清單（broad）
  const checkUrls = new Set<string>(); // geojson.url / pmtiles.url / supabase.fallbackUrl
  const referencedAssets = new Set<string>(); // 上面 + companionAssets + custom.staticAssets（僅 .geojson/.pmtiles）

  const addRef = (u: string | undefined) => {
    if (!u) return;
    referencedAssets.add(normalizeAssetPath(u));
  };

  for (const entry of entries) {
    const sources: LayerSource[] = Array.isArray(entry.source) ? entry.source : [entry.source];
    for (const s of sources) {
      if (s.kind === "geojson" || s.kind === "pmtiles") {
        checkUrls.add(normalizeAssetPath(s.url));
        addRef(s.url);
        if (s.kind === "pmtiles" && s.companionAssets) {
          for (const c of s.companionAssets) addRef(c);
        }
      } else if (s.kind === "supabase") {
        checkUrls.add(normalizeAssetPath(s.fallbackUrl));
        addRef(s.fallbackUrl);
      } else if (s.kind === "custom") {
        if (s.staticAssets) for (const c of s.staticAssets) addRef(c);
      }
    }
  }
  const referencedAssetsFiltered = new Set(
    [...referencedAssets].filter((p) => p.endsWith(".geojson") || p.endsWith(".pmtiles")),
  );

  // ── A2 ──
  const feRpcMap = collectFrontendRpcCalls(errors);
  const dbFnNames = collectDbFunctionNames(errors);
  const dbQueryOk = dbFnNames.size > 0;

  const realDeadLinks: { name: string; occurrences: RpcOccurrence[] }[] = [];
  const commentOnlyArtifacts: { name: string; occurrences: RpcOccurrence[] }[] = [];
  if (dbQueryOk) {
    for (const [name, occurrences] of feRpcMap) {
      if (dbFnNames.has(name)) continue;
      if (occurrences.every((o) => o.isComment)) {
        commentOnlyArtifacts.push({ name, occurrences });
      } else {
        realDeadLinks.push({ name, occurrences });
      }
    }
  }

  if (!dbQueryOk) {
    findings.push({
      id: "A2",
      level: "yellow",
      title: "RPC 死鏈檢查未執行（DB 查詢失敗）",
      detail: "無法取得 DB public schema function 清單，本週跳過死鏈比對，見 errors[]。",
      evidence: `frontend RPC 呼叫名共 ${feRpcMap.size} 個（已擷取，只是沒有 DB 端可比對）`,
    });
  } else if (realDeadLinks.length > 0) {
    findings.push({
      id: "A2",
      level: "red",
      title: `RPC 死鏈 ${realDeadLinks.length} 個（前端會呼叫但 DB 不存在）`,
      detail: realDeadLinks
        .map((d) => `${d.name} ← ${d.occurrences.map((o) => `${o.file}:${o.line}`).join(", ")}`)
        .join("\n"),
      evidence: "這種圖層必定空白且不報錯（供 RPC 呼叫者直接對照 src/ 位置）",
    });
  } else {
    const note =
      commentOnlyArtifacts.length > 0
        ? `另有 ${commentOnlyArtifacts.length} 個名字只出現在註解範例裡（非真實呼叫，已排除，不計入紅燈）：${commentOnlyArtifacts
            .map((d) => `${d.name}(${d.occurrences.map((o) => `${o.file}:${o.line}`).join(",")})`)
            .join("; ")}`
        : "全部比對通過";
    findings.push({
      id: "A2",
      level: "green",
      title: "RPC 死鏈：0 個",
      detail: note,
      evidence: `frontend ${feRpcMap.size} 個 RPC 名 vs DB ${dbFnNames.size} 個 public function/procedure`,
    });
  }

  // ── A3 / A4：線上活性（HEAD） ──
  interface AssetCheckResult {
    assetPath: string;
    prodUrl: string;
    status: number | null;
    contentLength: number | null;
    error?: string;
    localExists: boolean;
    localSize: number | null;
    localGitIgnored: boolean;
    sizeMismatch: boolean;
  }

  async function headWithRetry(url: string): Promise<{ status: number | null; contentLength: number | null; error?: string }> {
    for (let attempt = 0; attempt <= HEAD_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
      try {
        const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
        clearTimeout(timer);
        const cl = res.headers.get("content-length");
        return { status: res.status, contentLength: cl ? Number(cl) : null };
      } catch (e) {
        clearTimeout(timer);
        if (attempt === HEAD_RETRIES) {
          return { status: null, contentLength: null, error: String((e as Error).message ?? e) };
        }
      }
    }
    return { status: null, contentLength: null, error: "unreachable" };
  }

  const checkUrlList = [...checkUrls];
  let assetResults: AssetCheckResult[] = [];
  try {
    assetResults = await pMap(checkUrlList, HEAD_CONCURRENCY, async (assetPath) => {
      const prodUrl = `${PROD_BASE}/${assetPath}`;
      const { status, contentLength, error } = await headWithRetry(prodUrl);

      const localFull = path.join(PUBLIC_DIR, assetPath);
      const localExists = existsSync(localFull);
      const localSize = localExists ? statSync(localFull).size : null;
      const localGitIgnored = !localExists ? isGitIgnored(path.join("public", assetPath)) : false;

      let sizeMismatch = false;
      if (status === 200) {
        if (localExists && contentLength != null) {
          sizeMismatch = localSize !== contentLength;
        } else if (!localExists && !localGitIgnored) {
          // 非 gitignore 管理（不是 S3 專管的大型目錄）但本機沒有 → 視為不同步
          sizeMismatch = true;
        }
      }

      return { assetPath, prodUrl, status, contentLength, error, localExists, localSize, localGitIgnored, sizeMismatch };
    });
  } catch (e) {
    errors.push({ step: "A3_A4:head_check", message: redact(String((e as Error).message ?? e)) });
  }

  const assets404 = assetResults.filter((r) => r.status !== 200);
  const assetsSizeMismatch = assetResults.filter((r) => r.status === 200 && r.sizeMismatch);

  if (assets404.length > 0) {
    findings.push({
      id: "A3",
      level: "red",
      title: `線上死檔 ${assets404.length} 個（HEAD 非 200）`,
      detail: assets404
        .slice(0, 30)
        .map((r) => `${r.assetPath} → status=${r.status ?? "ERR"}${r.error ? ` (${r.error})` : ""}`)
        .join("\n"),
      evidence: `共檢查 ${assetResults.length} 個 url（geojson/pmtiles url + supabase fallbackUrl 去重後）`,
    });
  } else {
    findings.push({
      id: "A3",
      level: "green",
      title: "線上死檔：0 個",
      detail: `${assetResults.length} 個靜態資產（geojson/pmtiles/supabase fallback）全部 HEAD 200`,
      evidence: `PROD_BASE=${PROD_BASE}`,
    });
  }

  if (assetsSizeMismatch.length > 0) {
    findings.push({
      id: "A4",
      level: "yellow",
      title: `本機與線上不同步 ${assetsSizeMismatch.length} 個`,
      detail: assetsSizeMismatch
        .slice(0, 30)
        .map(
          (r) =>
            `${r.assetPath} → 遠端 ${r.contentLength ?? "?"}B / 本機 ${
              r.localExists ? `${r.localSize}B` : "不存在"
            }`,
        )
        .join("\n"),
      evidence: "size 不一致或本機缺檔（已排除 .gitignore 標明由 S3 deploy-assets 管理的目錄）",
    });
  } else {
    findings.push({
      id: "A4",
      level: "green",
      title: "本機與線上同步：無落差",
      detail: "所有可比對的資產本機／線上 size 一致",
      evidence: "",
    });
  }

  // ── A5：孤兒資產 ──
  // ⚠️ 已知盲區：dataClass D 的 kind:'custom' 層若未填 staticAssets（例如 rail：
  // Three.js RailScene 自己 fetch public/rail/** 一整批軌道 geojson，manifest 刻意不逐檔登記
  // ——見上方檔頭註解），底下所有檔案都會被判成孤兒。實測這個已知盲區佔了孤兒清單 9 成
  // （425/466），會把真正有意義的訊號（例如 283MB 的孤兒底圖）淹沒，所以拆成兩桶：
  // metrics 仍誠實回報「全部」孤兒數（true 現況，供跨週差分），但 finding／details 只列
  // 「可行動」清單（排除 rail/），rail/ 的量體另外記一筆 known-blindspot 數字，不丟失也不洗版。
  const KNOWN_BLINDSPOT_PREFIXES = ["rail/"];
  const diskAssets = walkAssetFiles(PUBLIC_DIR, [".geojson", ".pmtiles"]);
  const allOrphans = diskAssets
    .filter((f) => !referencedAssetsFiltered.has(f.relPath))
    .sort((a, b) => b.size - a.size);
  const isKnownBlindspot = (relPath: string) => KNOWN_BLINDSPOT_PREFIXES.some((p) => relPath.startsWith(p));
  const orphanAssets = allOrphans.filter((f) => !isKnownBlindspot(f.relPath));
  const blindspotOrphans = allOrphans.filter((f) => isKnownBlindspot(f.relPath));
  const orphanBytes = allOrphans.reduce((sum, f) => sum + f.size, 0);
  const actionableBytes = orphanAssets.reduce((sum, f) => sum + f.size, 0);
  const blindspotBytes = blindspotOrphans.reduce((sum, f) => sum + f.size, 0);

  if (orphanAssets.length > 0) {
    findings.push({
      id: "A5",
      level: "yellow",
      title: `可行動孤兒資產 ${orphanAssets.length} 個（共 ${(actionableBytes / 1024 / 1024).toFixed(1)} MB）`,
      detail:
        orphanAssets
          .slice(0, 20)
          .map((f) => `${f.relPath} (${(f.size / 1024 / 1024).toFixed(2)} MB)`)
          .join("\n") + (orphanAssets.length > 20 ? `\n…另 ${orphanAssets.length - 20} 個，見 details.orphanAssets` : ""),
      evidence:
        `已排除已知盲區 rail/（${blindspotOrphans.length} 個、${(blindspotBytes / 1024 / 1024).toFixed(1)} MB，` +
        "custom kind 未填 staticAssets，manifest 尚未涵蓋，見 metrics.orphan_assets_blindspot_*）；以上為可行動清單",
    });
  } else {
    findings.push({
      id: "A5",
      level: "green",
      title: "可行動孤兒資產：0 個",
      detail:
        blindspotOrphans.length > 0
          ? `public/ 下可比對範圍內都有引用；另有 ${blindspotOrphans.length} 個 rail/ 已知盲區檔案未列入（manifest 未登記，非孤兒判定範圍）`
          : "public/ 下所有 .geojson/.pmtiles 都能在 manifest 找到引用",
      evidence: "",
    });
  }

  // ── 收攏輸出 ──
  const durationSec = (Date.now() - startedAt) / 1000;
  const output = {
    collector: "layers",
    collected_at: new Date().toISOString(),
    ok: true,
    duration_sec: Math.round(durationSec * 10) / 10,
    metrics: {
      layer_count: layerCount,
      by_data_class: byDataClass,
      asset_urls_checked: assetResults.length,
      assets_404: assets404.length,
      assets_size_mismatch: assetsSizeMismatch.length,
      orphan_assets_count: allOrphans.length,
      orphan_assets_bytes: orphanBytes,
      orphan_assets_actionable_count: orphanAssets.length,
      orphan_assets_actionable_bytes: actionableBytes,
      orphan_assets_blindspot_count: blindspotOrphans.length,
      orphan_assets_blindspot_bytes: blindspotBytes,
      rpc_frontend_count: feRpcMap.size,
      rpc_dead_links: dbQueryOk ? realDeadLinks.length : null,
    },
    findings,
    errors,
    // 補充資料：給 skill 層判讀用的完整清單（超出最小契約，但同屬「收集」範疇）
    details: {
      rpcDeadLinks: realDeadLinks.map((d) => ({
        name: d.name,
        occurrences: d.occurrences.map((o) => `${o.file}:${o.line}`),
      })),
      rpcCommentOnlyArtifacts: commentOnlyArtifacts.map((d) => d.name),
      assets404: assets404.map((r) => ({ path: r.assetPath, status: r.status, error: r.error })),
      assetsSizeMismatch: assetsSizeMismatch.map((r) => ({
        path: r.assetPath,
        remoteBytes: r.contentLength,
        localBytes: r.localSize,
        localExists: r.localExists,
      })),
      orphanAssets: orphanAssets.map((f) => ({ path: f.relPath, bytes: f.size })),
      orphanAssetsBlindspot: {
        note: "rail/ 已知盲區：custom kind 未填 staticAssets，manifest 尚未涵蓋，不代表真的沒人用",
        count: blindspotOrphans.length,
        bytes: blindspotBytes,
      },
    },
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(deepRedact(output), null, 2));

  console.log(`[probe_layers] wrote ${OUT_FILE}`);
  console.log(
    `[probe_layers] layers=${layerCount} urls_checked=${assetResults.length} 404=${assets404.length} ` +
      `size_mismatch=${assetsSizeMismatch.length} orphans_actionable=${orphanAssets.length}(${(actionableBytes / 1024 / 1024).toFixed(1)}MB) ` +
      `orphans_blindspot=${blindspotOrphans.length}(${(blindspotBytes / 1024 / 1024).toFixed(1)}MB) ` +
      `rpc_dead=${dbQueryOk ? realDeadLinks.length : "N/A"} duration=${output.duration_sec}s`,
  );
}

main().catch((e) => {
  // 任何未預期的頂層例外：仍嘗試寫出一份「失敗但誠實」的 JSON，不讓整支炸裂到沒有輸出。
  const message = redact(String((e as Error)?.stack ?? e));
  console.error("[probe_layers] fatal:", message);
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      OUT_FILE,
      JSON.stringify(
        {
          collector: "layers",
          collected_at: new Date().toISOString(),
          ok: false,
          duration_sec: 0,
          metrics: {},
          findings: [],
          errors: [{ step: "fatal", message }],
        },
        null,
        2,
      ),
    );
  } catch {
    // 連寫檔都失敗就真的沒辦法了，靠 exit code 之外的手段人工介入
  }
  process.exit(0); // 依契約：探測器失敗不中斷排程，靠 ok:false + errors[] 表達
});
