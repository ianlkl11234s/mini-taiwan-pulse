// 圖層入倉狀態（AG-13）：純函式，不含 I/O；規則與 pulse-data scripts/check_layer_coverage.py (d)(e) 相同。
// 規則：圖層上線即入倉；做不到就列進 pulse-data registry/_display_only.yaml（reason＋unlock）。
// 既有沒入倉的層在 registry/_warehouse_baseline.yaml，只減不增。
// 不加 YAML 依賴：只解析登記檔的 pulse_layers（flow／block 兩種寫法）、頂層 warehouse 區塊有沒有 `- table:`、
// _indicator_semantics.yaml 的 `- dataset:`、清單檔的 `- layer:`（與其下的 reason／unlock）。

export const NO_UPSTREAM_FILE = "_no_upstream.yaml";
export const DISPLAY_ONLY_FILE = "_display_only.yaml";
export const BASELINE_FILE = "_warehouse_baseline.yaml";
export const INDICATOR_FILE = "_indicator_semantics.yaml";
/** 由登記簿產生的衍生檔，不算登記 */
export const DERIVED_FILES = new Set(["watchlist.yaml"]);

const unquote = (s) => s.trim().replace(/^['"]|['"]$/g, "");

/** 一個 YAML 檔裡所有 pulse_layers 清單的圖層 key */
export function parsePulseLayers(text) {
  const out = [];
  for (const m of text.matchAll(/^[ \t]+pulse_layers:[ \t]*\[([^\]]*)\]/gm)) {
    out.push(...(m[1] ?? "").split(",").map(unquote).filter(Boolean));
  }
  for (const m of text.matchAll(/^([ \t]+)pulse_layers:[ \t]*(?:#.*)?\n((?:\1[ \t]*- .*(?:\n|$))+)/gm)) {
    for (const line of (m[2] ?? "").split("\n")) {
      const item = line.match(/^[ \t]*- (.+?)\s*(?:#.*)?$/);
      if (item?.[1]) out.push(unquote(item[1]));
    }
  }
  return out;
}

/** 頂層 warehouse 區塊至少有一張表 */
export function hasWarehouseTables(text) {
  return /^warehouse:[ \t]*\n(?:[ \t]*#.*\n)*- table:[ \t]*\S+/m.test(text);
}

/** 頂層 id（沒有就 null） */
export function parseEntryId(text) {
  const m = text.match(/^id:[ \t]*(\S+)/m);
  return m ? unquote(m[1]) : null;
}

/** _indicator_semantics.yaml：stats_observations 收的 dataset */
export function parseIndicatorDatasets(text) {
  return new Set([...text.matchAll(/^[ \t]*- dataset:[ \t]*(\S+)/gm)].map((m) => unquote(m[1])));
}

/** 清單檔（_no_upstream／_display_only／_warehouse_baseline）：layer → {reason, unlock} */
export function parseLayerList(text) {
  const out = new Map();
  const blocks = text.split(/^(?=[ \t]*- layer:)/m).filter((b) => /^[ \t]*- layer:/.test(b));
  for (const block of blocks) {
    const key = unquote(block.match(/- layer:[ \t]*([^\s#]+)/)[1]);
    const field = (name) => unquote(block.match(new RegExp(`^[ \\t]+${name}:[ \\t]*(.*)$`, "m"))?.[1] ?? "");
    out.set(key, { reason: field("reason"), unlock: field("unlock") });
  }
  return out;
}

/**
 * files: [{name, text}]（registry/*.yaml）。回傳分類所需的索引。
 * entries: layer → [{id, hasWarehouse, file}]
 */
export function indexRegistry(files) {
  const entries = new Map();
  let stats = new Set();
  let noUpstream = new Map();
  let displayOnly = new Map();
  let baseline = new Map();
  for (const { name, text } of files) {
    if (name === INDICATOR_FILE) { stats = parseIndicatorDatasets(text); continue; }
    if (name === NO_UPSTREAM_FILE) { noUpstream = parseLayerList(text); continue; }
    if (name === DISPLAY_ONLY_FILE) { displayOnly = parseLayerList(text); continue; }
    if (name === BASELINE_FILE) { baseline = parseLayerList(text); continue; }
    if (name.startsWith("_") || DERIVED_FILES.has(name)) continue;
    const id = parseEntryId(text) ?? name.replace(/\.yaml$/, "");
    const hasWarehouse = hasWarehouseTables(text);
    for (const key of parsePulseLayers(text)) {
      entries.set(key, [...(entries.get(key) ?? []), { id, hasWarehouse, file: name }]);
    }
  }
  return { entries, stats, noUpstream, displayOnly, baseline };
}

/**
 * 一層的入倉狀態：warehouse（登記條目有 warehouse 表）／statistics（dataset 在 stats_observations）／
 * no_upstream（_no_upstream.yaml）／display_only／missing。
 * datasets：manifest upstream.datasets 的 datasetId。
 */
export function warehouseStatus(key, datasets, index) {
  const mine = index.entries.get(key) ?? [];
  if (mine.some((e) => e.hasWarehouse)) return "warehouse";
  if ([...datasets, ...mine.map((e) => e.id)].some((id) => index.stats.has(id))) return "statistics";
  if (index.noUpstream.has(key)) return "no_upstream";
  if (index.displayOnly.has(key)) return "display_only";
  return "missing";
}

/**
 * layers: [{key, country, datasets}]。回傳 {status, violations, staleBaseline, incompleteDisplayOnly}。
 * violations：沒入倉、沒標 DISPLAY_ONLY、也不在基準（新圖層 PR 紅燈）。
 * staleBaseline：基準裡已入倉／已豁免／manifest 已無的列（只減不增）。
 */
export function checkWarehouseGate(layers, index) {
  const status = new Map(layers.map((l) => [l.key, warehouseStatus(l.key, l.datasets, index)]));
  const violations = layers.filter((l) => status.get(l.key) === "missing" && !index.baseline.has(l.key)).map((l) => l.key);
  const staleBaseline = [...index.baseline.keys()].filter((k) => !status.has(k) || status.get(k) !== "missing");
  const incompleteDisplayOnly = [...index.displayOnly].filter(([, v]) => !v.reason || !v.unlock).map(([k]) => k);
  return { status, violations, staleBaseline, incompleteDisplayOnly };
}
