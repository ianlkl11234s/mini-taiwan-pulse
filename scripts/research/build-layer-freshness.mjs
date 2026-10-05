#!/usr/bin/env node
/**
 * 圖層 metadata 完整度＋資料新鮮度總表（補 build-layer-status 只回答「能不能分析」的缺口）。
 *
 *   對 manifest 每一層輸出：source / license / coverage / time_fields / refresh_interval 缺哪些、
 *   資料類型、最新資料時間（與其依據）、新鮮度判定。
 *
 *   freshness 判定（未知不能算成正常）：
 *     fresh   有可驗證的最新資料時間 + 數值化的預期間隔，且資料年齡 <= 3 倍間隔
 *     overdue 同上，但年齡 > 3 倍間隔
 *     static  來源明示 lifecycle=static（不預期更新；另列，不與 fresh 混算）
 *     unknown 缺資料時間或缺數值間隔（含 lifecycle=irregular/manual/planned、DB 不可查）
 *
 * 輸入（皆唯讀）：
 *   - src/data/layerManifest.ts 與 *StatisticsRecipes.json
 *   - docs/features/general-analysis/layer-status.csv（layer → 倉庫 dataset／table／coverage）
 *   - ../runtime/warehouse/catalog.json（PULSE_WAREHOUSE_DIR 可覆寫；license／last_updated／lifecycle／columns）
 *   - docs/features/general-analysis/layer-freshness-live-map.json（即時層 → live 表／時間欄／間隔，
 *     間隔抄自 data-collectors/config/realtime_tables.yaml）
 *   - docs/features/general-analysis/layer-freshness-live-snapshot.json（上次線上查詢結果）
 *
 * 模式：
 *   --offline        不連 DB；即時層用 snapshot（以 snapshot 查詢時間為基準判定）。可放 CI、結果可重現。
 *   （預設）online   對 live-map 內的表做 `select max(time_column)`（唯讀、statement_timeout 8s）。
 *                    連線字串只從環境變數 SUPABASE_DB_URL 讀，不印出。大表（reltuples >= 10 萬）若時間欄
 *                    沒有 btree 前導索引就跳過、標未知，不硬掃。結果寫回 snapshot。
 *   --as-of=YYYY-MM-DD   非即時層的判定基準日（預設今天；CI 想要重現就指定）。
 *
 * Run: npx vite-node --script scripts/research/build-layer-freshness.mjs -- --offline
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../../src/data/layerManifest.ts";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const docsDir = resolve(root, "docs/features/general-analysis");
const warehouseDir = process.env.PULSE_WAREHOUSE_DIR ?? resolve(root, "../runtime/warehouse");
const argv = process.argv.slice(2);
const offline = argv.includes("--offline");
const asOfArg = argv.find(arg => arg.startsWith("--as-of="))?.slice("--as-of=".length);
const asOf = asOfArg ? new Date(`${asOfArg}T23:59:59Z`) : new Date();
if (Number.isNaN(asOf.getTime())) { console.error(`invalid --as-of: ${asOfArg}`); process.exit(1); }

const MS_MIN = 60_000;
const OVERDUE_FACTOR = 3;
const BIG_TABLE_ROWS = 100_000;
const LIFECYCLE_DAYS = { daily: 1, weekly: 7, monthly: 31, quarterly: 92, semi_annual: 183, yearly: 366 };
const TIME_COLUMN_RE = /(_at|_date|_time|^date|^time|period|year|month)$/i;

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter(r => r.length === header.length).map(r => Object.fromEntries(header.map((name, i) => [name, r[i]])));
}

// ── 輸入 ────────────────────────────────────────────────────────────
const catalogRaw = readJson(resolve(warehouseDir, "catalog.json"), null);
if (!catalogRaw) {
  console.error(`warehouse catalog not found under ${warehouseDir}; build the warehouse first (same prerequisite as build-layer-status.mjs).`);
  process.exit(1);
}
const catalog = Array.isArray(catalogRaw) ? catalogRaw : catalogRaw.datasets ?? [];
const catalogByTable = new Map(catalog.map(item => [item.table, item]));
const catalogById = new Map();
for (const item of catalog) catalogById.set(item.dataset_id, [...(catalogById.get(item.dataset_id) ?? []), item]);
const statusPath = resolve(docsDir, "layer-status.csv");
if (!existsSync(statusPath)) { console.error("layer-status.csv missing; run build-layer-status.mjs first."); process.exit(1); }
const statusByLayer = new Map(parseCsv(readFileSync(statusPath, "utf8")).map(row => [row.layer_key, row]));
const liveMapDoc = readJson(resolve(docsDir, "layer-freshness-live-map.json"), {});
const liveMap = Object.fromEntries(Object.entries(liveMapDoc).filter(([key]) => !key.startsWith("_")));
const snapshotPath = resolve(docsDir, "layer-freshness-live-snapshot.json");
const snapshotDoc = readJson(snapshotPath, { queried_at: null, tables: {} });

const recipes = new Map();
for (const name of ["agriStatisticsRecipes", "socialStatisticsRecipes", "laborStatisticsRecipes", "environmentStatisticsRecipes", "demographicsStatisticsRecipes", "comparisonStatisticsRecipes"]) {
  const document = readJson(resolve(root, "src/data", `${name}.json`), []);
  for (const recipe of Array.isArray(document) ? document : document.recipes ?? []) recipes.set(recipe.layer_key, recipe);
}

// ── manifest 輔助 ───────────────────────────────────────────────────
const sourcesFor = entry => (Array.isArray(entry.source) ? entry.source : [entry.source]);
const sourceKinds = entry => [...new Set(sourcesFor(entry).map(source => source?.kind).filter(Boolean))];
function staticAssets(entry) {
  return sourcesFor(entry).flatMap(source => {
    if (source?.kind === "geojson" || source?.kind === "pmtiles") return [source.url];
    return source?.kind === "custom" ? source.staticAssets ?? [] : [];
  });
}
function latestRelease(recipe) {
  return [...(recipe?.release_options ?? [])]
    .filter(option => typeof option.period_end === "string")
    .sort((a, b) => b.period_end.localeCompare(a.period_end) || String(b.period_start).localeCompare(String(a.period_start)))[0];
}
function recipeLicense(recipe) {
  const license = recipe?.source?.license ?? recipe?.license;
  if (typeof license === "string" && license.trim()) return license.trim();
  if (license && typeof license === "object") return String(license.name ?? license.label ?? "").trim();
  return ""; // 'unverified' 之類的狀態不是授權
}
function recipeCoverage(recipe) {
  const release = latestRelease(recipe);
  const coverage = release?.coverage ?? recipe?.coverage;
  const status = coverage?.observed?.status ?? coverage?.status;
  const geo = release?.dimensions?.geographic_coverage;
  return [recipe?.level, status, geo].filter(Boolean).join("/");
}
function manifestVersionDate(entry) {
  // 檔案 mtime 是 checkout 事實不是資料時間；只認 URL／note 內明示的 YYYY-MM-DD。
  const text = [...staticAssets(entry), ...sourcesFor(entry).map(source => source?.note ?? "")].join(" ");
  return [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map(match => match[1]).sort().at(-1) ?? "";
}

// ── 即時層：DB 查詢（唯讀、有界）─────────────────────────────────────
function psql(sql) {
  const url = process.env.SUPABASE_DB_URL;
  const result = spawnSync("psql", [url, "-X", "-A", "-t", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", timeout: 20_000, env: { ...process.env, PGCONNECT_TIMEOUT: "10" } });
  if (result.status !== 0) return { error: String(result.stderr || result.error?.message || "psql failed").split("\n")[0].replaceAll(url, "<REDACTED>").slice(0, 160) };
  return { out: result.stdout.trim() };
}
const safeIdent = value => /^[a-z_][a-z0-9_]*$/.test(value);

function queryTable({ schema, table, time_column: column }) {
  if (![schema, table, column].every(safeIdent)) return { status: "skipped", note: "unsafe_identifier" };
  const meta = psql(`select c.relkind::text || '|' || c.reltuples::bigint || '|' || coalesce((select string_agg(regexp_replace(i.indexdef, '^.*USING ', ''), ' ;; ') from pg_indexes i where i.schemaname='${schema}' and i.tablename='${table}'), '') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='${schema}' and c.relname='${table}'`);
  if (meta.error) return { status: "skipped", note: `meta_failed:${meta.error}` };
  if (!meta.out) return { status: "skipped", note: "table_not_found" };
  const [kind, tuples, ...rest] = meta.out.split("|");
  const indexes = rest.join("|");
  const rows = Number(tuples);
  const leading = new RegExp(`btree \\("?${column}"?[ ,)]`).test(indexes);
  if (!leading && (!Number.isFinite(rows) || rows < 0 || rows >= BIG_TABLE_ROWS || kind !== "r")) {
    return { status: "skipped", note: `no_time_index(relkind=${kind},reltuples=${rows})` };
  }
  const result = psql(`set statement_timeout=8000; select to_char(max(${column}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from ${schema}.${table}`);
  if (result.error) return { status: "skipped", note: `query_failed:${result.error}` };
  const value = result.out.split("\n").filter(Boolean).at(-1) ?? "";
  if (!/^20\d{2}-\d{2}-\d{2}T/.test(value)) return { status: "skipped", note: "empty_or_non_timestamp" };
  return { status: "ok", max_time: value, indexed: leading, reltuples: rows };
}

let queriedAt = snapshotDoc.queried_at;
let snapshotTables = snapshotDoc.tables ?? {};
const onlineStats = { mode: offline ? "offline" : "online", tables: 0, ok: 0, skipped: 0 };
if (!offline) {
  if (!process.env.SUPABASE_DB_URL) { console.error("SUPABASE_DB_URL is not set; use --offline or export it from .env."); process.exit(1); }
  const unique = new Map();
  for (const spec of Object.values(liveMap)) unique.set(`${spec.schema}.${spec.table}.${spec.time_column}`, spec);
  snapshotTables = {};
  queriedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  for (const [id, spec] of [...unique].sort(([a], [b]) => a.localeCompare(b))) {
    snapshotTables[id] = queryTable(spec);
    onlineStats.tables += 1;
    snapshotTables[id].status === "ok" ? (onlineStats.ok += 1) : (onlineStats.skipped += 1);
  }
  writeFileSync(snapshotPath, JSON.stringify({ queried_at: queriedAt, tables: snapshotTables }, null, 2) + "\n");
} else {
  for (const result of Object.values(snapshotTables)) { onlineStats.tables += 1; result.status === "ok" ? (onlineStats.ok += 1) : (onlineStats.skipped += 1); }
}

// ── 逐層組裝 ────────────────────────────────────────────────────────
const splitList = value => String(value ?? "").split(/[\s|;]+/).filter(Boolean);

function catalogEntriesFor(status) {
  const byTable = splitList(status?.warehouse_tables).map(table => catalogByTable.get(table)).filter(Boolean);
  const byId = splitList(status?.dataset_ids).flatMap(id => catalogById.get(id) ?? []);
  return [...new Set([...byTable, ...byId])];
}

const toMs = value => {
  const iso = /T/.test(value) ? value : `${value.slice(0, 10)}T00:00:00Z`;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
};

function buildRow(layerKey) {
  const entry = LAYER_MANIFEST[layerKey];
  const recipe = recipes.get(layerKey);
  const status = statusByLayer.get(layerKey);
  const live = liveMap[layerKey];
  const entries = catalogEntriesFor(status);
  const kinds = sourceKinds(entry);
  const dataType = live ? "dynamic_live" : recipe ? "statistics_snapshot" : kinds.includes("supabase") ? "supabase_static" : kinds.includes("geojson") || kinds.includes("pmtiles") || staticAssets(entry).length ? "static_asset" : "custom_or_derived";

  // metadata
  const datasetIds = splitList(status?.dataset_ids);
  const manifestNote = sourcesFor(entry).map(source => source?.note).find(Boolean);
  const source = (live ? `${live.schema}.${live.table}` : "") || datasetIds.join(" ") || recipe?.source?.source_landing_url || (recipe ? recipe.dataset_id : "") || (manifestNote ? String(manifestNote).replace(/\s+/g, " ").slice(0, 120) : "");
  const license = [...new Set([recipeLicense(recipe), ...entries.map(item => item.license)].filter(Boolean))].join(" | ");
  const coverage = recipeCoverage(recipe) || (status?.coverage ?? "") || (entries.some(item => Array.isArray(item.bbox)) ? "bbox_only" : "");
  const timeFields = live ? live.time_column : recipe ? "period_start,period_end" : [...new Set(entries.flatMap(item => (item.columns ?? []).filter(col => TIME_COLUMN_RE.test(col) && !/^_/.test(col))))].slice(0, 4).join(",");

  // 時間／間隔／依據
  const lifecycles = [...new Set(entries.map(item => item.lifecycle).filter(Boolean))];
  let latest = ""; let basis = ""; let intervalMin = null; let intervalText = ""; let queryNote = "";
  if (live) {
    const result = snapshotTables[`${live.schema}.${live.table}.${live.time_column}`];
    intervalMin = Number(live.expected_interval_min); intervalText = `live:${live.expected_interval_min}min`;
    if (result?.status === "ok") { latest = result.max_time; basis = offline ? "db_snapshot" : "db_max"; }
    else queryNote = result ? `unqueried:${result.note}` : "not_in_snapshot";
  }
  // 即時層不得退回 catalog／manifest 日期：那不是 live 表的時間，拿去配 live 間隔會誤判。
  if (!latest && !live && recipe) {
    const period = latestRelease(recipe)?.period_end;
    if (period) { latest = period; basis = "recipe_period_end"; }
  }
  const dated = entries.filter(item => item.last_updated).sort((a, b) => String(b.last_updated).localeCompare(String(a.last_updated)));
  if (!latest && !live && dated[0]) { latest = String(dated[0].last_updated).slice(0, 10); basis = "catalog_last_updated"; }
  if (!latest && !live) { const version = manifestVersionDate(entry); if (version) { latest = version; basis = "manifest_version_date"; } }
  if (!live) {
    const lifecycle = (dated[0] ?? entries[0])?.lifecycle;
    if (lifecycle) { intervalText = lifecycle; intervalMin = LIFECYCLE_DAYS[lifecycle] ? LIFECYCLE_DAYS[lifecycle] * 1440 : null; }
  }

  const missing = [!source && "source", !license && "license", !coverage && "coverage", !timeFields && "time_fields", !intervalText && "refresh_interval"].filter(Boolean);

  // 判定：以資料依據對應的基準時間計算年齡（DB snapshot 以查詢時間為準）
  let freshness = "unknown"; let ageMin = null;
  const refMs = basis.startsWith("db_") ? toMs(offline ? snapshotDoc.queried_at ?? "" : queriedAt ?? "") : asOf.getTime();
  const latestMs = latest ? toMs(latest) : null;
  if (!live && intervalText === "static") freshness = "static";
  else if (latestMs !== null && refMs !== null && Number.isFinite(intervalMin) && intervalMin > 0) {
    ageMin = Math.max(0, Math.floor((refMs - latestMs) / MS_MIN));
    freshness = ageMin > intervalMin * OVERDUE_FACTOR ? "overdue" : "fresh";
  }
  if (live && !queryNote && freshness === "unknown") queryNote = "no_usable_time";

  return {
    layer_key: layerKey,
    label: entry.section === null ? "" : String(entry.label ?? entry.name ?? ""),
    data_type: dataType,
    source, license, coverage,
    time_fields: timeFields,
    live_source: live ? `${live.schema}.${live.table}.${live.time_column} (${live.confidence})` : "",
    refresh_interval: intervalText,
    expected_interval_min: Number.isFinite(intervalMin) ? intervalMin : "",
    latest_data_time: latest,
    latest_time_basis: basis,
    age_days: ageMin === null ? "" : (ageMin / 1440).toFixed(2),
    freshness,
    metadata_missing_count: missing.length,
    missing_metadata: missing.join("|"),
    note: queryNote,
  };
}

const rows = MANIFEST_KEYS.map(buildRow);

// ── 輸出 ────────────────────────────────────────────────────────────
const columns = Object.keys(rows[0]);
const csvCell = value => (/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));
writeFileSync(resolve(docsDir, "layer-freshness.csv"), [columns.join(","), ...rows.map(row => columns.map(column => csvCell(row[column])).join(","))].join("\n") + "\n");

const count = (list, key) => list.reduce((out, row) => { out[row[key]] = (out[row[key]] ?? 0) + 1; return out; }, {});
const table = (headers, body) => [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...body.map(cells => `| ${cells.join(" | ")} |`)].join("\n");
const fresh = count(rows, "freshness");
const missingCounts = ["source", "license", "coverage", "time_fields", "refresh_interval"].map(name => [name, rows.filter(row => row.missing_metadata.split("|").includes(name)).length]);
const missingRank = [...rows].filter(row => row.metadata_missing_count > 0).sort((a, b) => b.metadata_missing_count - a.metadata_missing_count || a.data_type.localeCompare(b.data_type) || a.layer_key.localeCompare(b.layer_key)).slice(0, 20);
const overdueRows = rows.filter(row => row.freshness === "overdue").sort((a, b) => Number(b.age_days) * 1440 / b.expected_interval_min - Number(a.age_days) * 1440 / a.expected_interval_min || a.layer_key.localeCompare(b.layer_key)).slice(0, 20);
const unmapped = Object.entries(liveMapDoc._unmapped ?? {});
const skippedLive = rows.filter(row => row.data_type === "dynamic_live" && row.note);

const summary = `# 圖層 metadata 與資料新鮮度摘要

> 由 \`scripts/research/build-layer-freshness.mjs\` 產生；逐層明細見 [layer-freshness.csv](./layer-freshness.csv)。
> 即時層最新時間${offline ? "取自上次線上查詢 snapshot" : "為本次線上查詢"}（查詢時間 ${queriedAt ?? "—"}）；其餘以 ${asOf.toISOString().slice(0, 10)} 為基準日。
> 「unknown」不是正常：缺資料時間或缺數值化更新間隔時，不推定新鮮。檔案 mtime 不當成資料時間。

- 圖層總數：**${rows.length}**
- metadata 五欄齊全：**${rows.filter(row => row.metadata_missing_count === 0).length}/${rows.length}**
- 新鮮 **${fresh.fresh ?? 0}**／過期（資料年齡 > ${OVERDUE_FACTOR} 倍預期間隔）**${fresh.overdue ?? 0}**／未知 **${fresh.unknown ?? 0}**／靜態（lifecycle=static，不預期更新，另列）**${fresh.static ?? 0}**
- 即時層 DB 查詢：${onlineStats.tables} 張表，成功 ${onlineStats.ok}，跳過 ${onlineStats.skipped}

## 資料類型

${table(["資料類型", "圖層數"], Object.entries(count(rows, "data_type")).sort().map(([type, total]) => [type, total]))}

## 各欄位缺漏圖層數

${table(["欄位", "缺漏圖層數"], missingCounts)}

## metadata 缺漏前 20 名

（同缺漏數時依資料類型、key 排序；缺漏數相同的圖層遠多於 20，完整清單看 CSV。）

${table(["layer_key", "缺漏欄位", "資料類型"], missingRank.map(row => [row.layer_key, row.missing_metadata.replaceAll("|", "、"), row.data_type]))}

## 過期前 20 名（依 年齡／預期間隔 由大到小）

${overdueRows.length ? table(["layer_key", "最新資料時間", "依據", "預期間隔", "年齡（日）"], overdueRows.map(row => [row.layer_key, row.latest_data_time, row.latest_time_basis, row.refresh_interval, row.age_days])) : "沒有過期項目。"}

## 即時層未能取得時間（標未知）

${skippedLive.length ? table(["layer_key", "原因"], skippedLive.map(row => [row.layer_key, row.note])) : "無。"}

## 即時層對照表尚未涵蓋（live-map 的 _unmapped）

${unmapped.length ? table(["layer_key", "原因"], unmapped.map(([key, why]) => [key, String(why).replace(/\|/g, "/")])) : "無。"}

## 判定規則與限制

- 即時層：\`layer-freshness-live-map.json\` 指到 live 表與時間欄，預期間隔抄自 data-collectors \`realtime_tables.yaml\`；查 \`max(time)\`，大表（reltuples >= ${BIG_TABLE_ROWS}）時間欄沒有 btree 前導索引就跳過。事件驅動表（地震、閃電等）的間隔本來就放寬，無事件不代表壞掉。confidence=medium 表示前端實際讀衍生表／view，對照的是同 collector 的底層表，底層新鮮不保證衍生表也更新。
- 統計 snapshot：最新時間 = 配方最新 release 的 \`period_end\`（觀察期末，不是發布日）；預期間隔取自倉庫 catalog 同 dataset 的 lifecycle，沒有就是未知。
- 其他圖層：最新時間 = 倉庫 catalog \`last_updated\`（取同層各 dataset 中最新者）；預期間隔 = 該 dataset 的 lifecycle（daily 1／weekly 7／monthly 31／quarterly 92／semi_annual 183／yearly 366 日）；irregular／manual／planned 沒有數值，維持未知。**catalog last_updated 是倉庫收錄的資料版本日期，不保證等於來源端最新發布日。**
- 純圖層（沒有倉庫 dataset、沒有 manifest 版本日期）沒有任何時間依據 → 未知。
`;
writeFileSync(resolve(docsDir, "layer-freshness-summary.md"), summary);
console.log(`layers=${rows.length} metadata_complete=${rows.filter(row => row.metadata_missing_count === 0).length} freshness=${JSON.stringify(fresh)} live_tables=${JSON.stringify(onlineStats)}`);
