#!/usr/bin/env node
/**
 * 圖層總表（ADR-0014 D1）：778 層 × 三層狀態，由 script 產生、不手寫。
 *
 *   L1 可操作：manifest 內的圖層都可被搜尋／開關／描述（自動）。
 *   L2 可分析：spatial（倉庫有幾何表）／statistics（倉庫統計長表）／attribute（倉庫無幾何表）／
 *              browser_reader（只有舊的瀏覽器 reader）／none。
 *   L3 位置精度：倉庫 precision_class（official／address_geocode／google_geocode／village_centroid／proxy／unknown）；
 *              只決定答案的但書，不是關卡。
 *
 * 輸入：layer manifest（upstream.datasets）、舊瀏覽器 reader 註冊、
 *       ../runtime/warehouse/{catalog.json,warehouse-extras.json}（PULSE_WAREHOUSE_DIR 可覆寫）、
 *       docs/features/general-analysis/layer-status-overrides.json（少量人工判斷）、
 *       layer-dataset-aliases.json（manifest upstream id 與倉庫 dataset 名稱不同時的對照）。
 * 輸出：docs/features/general-analysis/layer-status.csv 與 layer-status-summary.md。
 *
 * Run: npx vite-node --script scripts/research/build-layer-status.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../../src/data/layerManifest.ts";
import { ensureStatisticsResearchDatasets, registeredDatasetsForLayer } from "../../src/research/researchDatasets.ts";
import { panelForExplorationLayers } from "../../src/research/explorationNavigation.ts";

// PF-7: statistics-recipe datasets register after their lazily imported details load.
await ensureStatisticsResearchDatasets();

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const docsDir = resolve(root, "docs/features/general-analysis");
const warehouseDir = process.env.PULSE_WAREHOUSE_DIR ?? resolve(root, "../runtime/warehouse");

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : fallback;
}

const catalogRaw = readJson(resolve(warehouseDir, "catalog.json"), null);
if (!catalogRaw) {
  console.error(`warehouse catalog not found under ${warehouseDir}; build the warehouse first (mcp/warehouse/build_warehouse.py).`);
  process.exit(1);
}
const catalog = Array.isArray(catalogRaw) ? catalogRaw : catalogRaw.datasets ?? [];
const extras = readJson(resolve(warehouseDir, "warehouse-extras.json"), { countyCoverage: {}, statsDatasets: {} });
const overrides = readJson(resolve(docsDir, "layer-status-overrides.json"), {});
const aliases = readJson(resolve(docsDir, "layer-dataset-aliases.json"), { byUpstream: {}, byLayer: {} });
// 比較統計（statsComparison*）不在 manifest upstream，而是 recipe 指到倉庫統計長表的 dataset＋indicator。
const comparisonRecipes = new Map(
  readJson(resolve(root, "src/data/comparisonStatisticsRecipes.json"), []).map(recipe => [recipe.layer_key, recipe]),
);

const byDatasetId = new Map();
for (const entry of catalog) {
  const list = byDatasetId.get(entry.dataset_id) ?? [];
  list.push(entry);
  byDatasetId.set(entry.dataset_id, list);
}
const USABLE = new Set(["OK", "WARN"]);
const PANEL_LABEL = { layers: "臺灣圖層", statistics: "統計", world: "世界", japan: "日本" };

function sourceKinds(entry) {
  const sources = Array.isArray(entry.source) ? entry.source : [entry.source];
  return [...new Set(sources.map(source => source?.kind).filter(Boolean))].join("+");
}

function coverageLabel(tables) {
  const counties = new Set();
  for (const table of tables) for (const code of Object.keys(extras.countyCoverage?.[table] ?? {})) counties.add(code);
  if (!tables.length) return "";
  if (counties.size === 0) return "unknown";
  return counties.size >= 20 ? "national" : `${counties.size} counties`;
}

function classify(key) {
  const entry = LAYER_MANIFEST[key];
  const declaredIds = (entry.upstream?.datasets ?? []).map(dataset => dataset.datasetId);
  const upstreamIds = [...new Set([...declaredIds, ...declaredIds.flatMap(id => aliases.byUpstream?.[id] ?? []), ...(aliases.byLayer?.[key] ?? [])])];
  const derivedIds = entry.upstream?.derivedFromDatasets ?? [];
  const warehouseEntries = upstreamIds.flatMap(id => byDatasetId.get(id) ?? []);
  const usable = warehouseEntries.filter(item => USABLE.has(item.status));
  const spatial = usable.filter(item => item.geometry_type && item.geometry_type !== "None" && Number(item.rows) > 0);
  const stats = upstreamIds.filter(id => extras.statsDatasets?.[id]);
  const recipe = comparisonRecipes.get(key);
  if (recipe && extras.statsDatasets?.[recipe.dataset_id]?.indicators?.includes(recipe.indicator_id)) stats.push(recipe.dataset_id);
  const browser = registeredDatasetsForLayer(key);
  const override = overrides[key] ?? {};

  let l2 = "none";
  let via = "";
  if (spatial.length) { l2 = "spatial"; via = "warehouse"; }
  else if (stats.length) { l2 = "statistics"; via = "warehouse"; }
  else if (usable.length) { l2 = "attribute"; via = "warehouse"; }
  else if (browser.length) { l2 = "browser_reader"; via = "browser"; }
  if (via === "warehouse" && browser.length) via = "warehouse+browser";

  let blocker = "";
  if (l2 === "none" || l2 === "browser_reader") {
    const status = entry.upstream?.status;
    if (status === "catalog_missing") blocker = "upstream_catalog_missing";
    else if (status === "pulse_only") blocker = derivedIds.length || entry.upstream?.derivedFromLayers?.length ? "derived_layer" : "pulse_only";
    else if (!upstreamIds.length) blocker = "no_upstream_dataset";
    else if (!warehouseEntries.length) blocker = "dataset_not_in_warehouse";
    else blocker = `warehouse_${[...new Set(warehouseEntries.map(item => item.status))].join("+")}`;
  }
  if (override.l2) { l2 = override.l2; blocker = override.note ? `override: ${override.note}` : "override"; }

  const precision = [...new Set(spatial.map(item => item.precision_class ?? "unknown"))].join("+");
  const geometry = [...new Set(spatial.map(item => String(item.geometry_type)))].join("+");
  const updated = [
    ...usable.map(item => item.last_updated ?? item.fetched_at).filter(Boolean),
    ...stats.map(id => extras.statsDatasets[id].lastPeriod),
  ].sort().at(-1) ?? "";
  const panel = panelForExplorationLayers([key]);
  return {
    layer_key: key,
    label: entry.section === null ? "" : entry.label,
    panel: PANEL_LABEL[panel] ?? panel,
    theme: entry.section?.theme ?? "(orphan)",
    source_kind: sourceKinds(entry),
    upstream_status: entry.upstream?.status ?? "",
    dataset_ids: upstreamIds.join(" "),
    warehouse_tables: [...new Set(usable.map(item => item.table))].join(" "),
    geometry,
    updated: String(updated).slice(0, 10),
    coverage: coverageLabel(spatial.map(item => item.table)),
    l1_operable: "yes",
    l2_analysis: l2,
    l2_via: via,
    l3_precision: l2 === "spatial" ? precision || "unknown" : "",
    owner_only: entry.section && entry.gated ? "yes" : "",
    blocker,
    description: String(entry.description ?? "").replace(/\s+/g, " ").slice(0, 140),
  };
}

const rows = MANIFEST_KEYS.map(classify);
const columns = Object.keys(rows[0]);
const csvCell = value => /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value);
writeFileSync(resolve(docsDir, "layer-status.csv"), [columns.join(","), ...rows.map(row => columns.map(column => csvCell(row[column])).join(","))].join("\n") + "\n");

const count = (list, key) => list.reduce((acc, row) => { acc[row[key]] = (acc[row[key]] ?? 0) + 1; return acc; }, {});
const L2_ORDER = ["spatial", "statistics", "attribute", "browser_reader", "none", "display_only"];
const panels = ["臺灣圖層", "統計", "世界", "日本"];
const table = (headers, body) => [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...body.map(cells => `| ${cells.join(" | ")} |`)].join("\n");
const l2Present = L2_ORDER.filter(l2 => rows.some(row => row.l2_analysis === l2));
const panelRows = panels.map(panel => {
  const subset = rows.filter(row => row.panel === panel);
  const counts = count(subset, "l2_analysis");
  return [panel, subset.length, ...l2Present.map(l2 => counts[l2] ?? 0)];
});
const totals = count(rows, "l2_analysis");
const analysable = rows.filter(row => ["spatial", "statistics", "attribute"].includes(row.l2_analysis)).length;
const blockers = Object.entries(count(rows.filter(row => row.blocker), "blocker")).sort((a, b) => b[1] - a[1]);
const precision = Object.entries(count(rows.filter(row => row.l3_precision), "l3_precision")).sort((a, b) => b[1] - a[1]);
const coverage = Object.entries(count(rows.filter(row => row.coverage), "coverage")).sort((a, b) => b[1] - a[1]).slice(0, 8);

const summary = `# 圖層總表摘要

> 由 \`scripts/research/build-layer-status.mjs\` 產生，請勿手改；逐層明細見 [layer-status.csv](./layer-status.csv)。
> 依據 [ADR-0014](../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md)：L1 可操作、L2 可分析、L3 位置精度（屬性，不是關卡）。

- 圖層總數：**${rows.length}**；L1 可操作：**${rows.length}/${rows.length}**
- L2 倉庫可分析（spatial＋statistics＋attribute）：**${analysable}/${rows.length}**（${(analysable / rows.length * 100).toFixed(1)}%）
- 只有舊瀏覽器 reader：${totals.browser_reader ?? 0}；尚不可分析：${totals.none ?? 0}

## 各面板 L2 狀態

${table(["面板", "圖層數", ...l2Present], panelRows)}

## 尚不可分析的原因

${table(["原因", "圖層數"], blockers)}

- \`upstream_catalog_missing\`：manifest 未對應到 analytics 目錄 dataset（多為前端自建、即時或外部來源）。
- \`dataset_not_in_warehouse\`：有 upstream dataset，但 analytics 沒有可建表的 manifest／檔案。
- \`warehouse_SKIPPED_*\`／\`warehouse_FAILED\`：倉庫建置時略過或失敗，原因見 runtime \`build-report.json\`。
- \`derived_layer\`：由其他圖層或資料衍生（例如等時圈、覆蓋面），需另接衍生流程。

## L3 位置精度（spatial 圖層）

${table(["precision_class", "圖層數"], precision)}

## 空間涵蓋（spatial 圖層）

${table(["涵蓋", "圖層數"], coverage)}

「N counties」代表區域性資料集：跨地比較時，未涵蓋的縣市應標「未涵蓋」而非 0（引擎的 nearby_profile 已自動處理）。
`;
writeFileSync(resolve(docsDir, "layer-status-summary.md"), summary);
console.log(`layers=${rows.length} analysable=${analysable} ${JSON.stringify(totals)}`);
