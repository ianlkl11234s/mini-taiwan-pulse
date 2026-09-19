import { GATED_LAYERS } from "../components/sidebar/layerCatalog";
import { LAYER_MANIFEST, MANIFEST_KEYS, type LayerSource, type ManifestKey } from "../data/layerManifest";
import { isDataSourceBrowserVisible } from "../data/statisticsDataSources";
import type { UpstreamStatus } from "../data/upstreamRegistry";

/**
 * 少量使用者常用稱呼；圖層的名稱、說明、主題與來源仍一律由 manifest 派生。
 * 新增 alias 時只補「名稱本身不會自然命中」的同義詞，不在這裡重建 catalog。
 */
export const LAYER_SEARCH_ALIASES: Partial<Record<ManifestKey, readonly string[]>> = {
  medHospital: ["醫療", "急診", "hospital", "emergency", "台灣"],
  typhoonTracks: ["颱風", "typhoon"],
  floodAlerts: ["淹水", "防汛", "flood"],
  airports: ["航空", "airport"],
  jpAirports: ["日本機場", "japan airport"],
  historicalFlightTrails: ["歷史航班", "歷史飛行", "飛行軌跡", "flight trail", "RCTP"],
  jpHistoricalFlightTrails: ["日本歷史航班", "歷史飛行", "飛行軌跡", "flight trail", "RJTT"],
};

export interface LayerSearchResult {
  key: ManifestKey;
  label: string;
  description: string;
  topics: readonly string[];
  aliases: readonly string[];
  theme: string | null;
  group: string | null;
  /** Manifest upstream metadata; this is registration lineage, not a live source check. */
  upstream: { status: UpstreamStatus; datasetIds: readonly string[] };
  /** Manifest source kinds, including every source for multi-source layers. */
  sourceKinds: readonly LayerSource["kind"][];
  /** Manifest source IDs when the loader has one; custom sources intentionally have none. */
  sourceIds: readonly string[];
  source: string;
  score: number;
}

interface SearchDocument extends LayerSearchResult {
  normalized: {
    key: string;
    label: string;
    aliases: string;
    description: string;
    topics: string;
    source: string;
    section: string;
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s_\-/.]+/g, " ")
    .trim();
}

function queryTerms(query: string): string[] {
  return [...new Set(normalize(query).split(" ").filter(Boolean))];
}

function sourceKinds(key: ManifestKey): LayerSource["kind"][] {
  const source = LAYER_MANIFEST[key].source;
  return [...new Set((Array.isArray(source) ? source : [source]).map((item) => item.kind))];
}

function sourceIds(key: ManifestKey): string[] {
  const source = LAYER_MANIFEST[key].source;
  return [...new Set((Array.isArray(source) ? source : [source]).flatMap((item) =>
    item.kind === "custom" ? [] : [item.sourceId],
  ))];
}

function sourceKindLabel(kind: LayerSource["kind"]): string {
  switch (kind) {
    case "geojson": return "GeoJSON 靜態檔";
    case "pmtiles": return "PMTiles 向量切片";
    case "supabase": return "Supabase 動態資料";
    case "custom": return "自訂載入";
  }
}

function sourceStatusLabel(status: UpstreamStatus): string {
  switch (status) {
    case "verified": return "來源登記已核對";
    case "pulse_only": return "本站衍生";
    case "catalog_missing": return "來源目錄待補";
  }
}

function sourceSummary(key: ManifestKey): string {
  const upstream = LAYER_MANIFEST[key].upstream;
  const datasets = upstream.datasets.map((dataset) => dataset.datasetId);
  const kinds = sourceKinds(key).map(sourceKindLabel);
  const ids = sourceIds(key);
  return [
    `上游：${sourceStatusLabel(upstream.status)}`,
    datasets.length ? `資料集：${datasets.join("、")}` : null,
    `載入：${kinds.join("、")}`,
    ids.length ? `來源識別：${ids.join("、")}` : null,
  ].filter(Boolean).join(" · ");
}

/** Search-only implementation metadata. Never return this free-form text to callers. */
function sourceSearchText(key: ManifestKey): string {
  const upstream = LAYER_MANIFEST[key].upstream;
  const source = Array.isArray(LAYER_MANIFEST[key].source)
    ? LAYER_MANIFEST[key].source
    : [LAYER_MANIFEST[key].source];
  const sourceDetails = source.map((item) => {
    if (item.kind === "custom") return item.note;
    return [item.sourceId, "url" in item ? item.url : item.fallbackUrl].join(" ");
  }).join(" ");
  const note = "note" in upstream ? upstream.note ?? "" : "";
  const processing = "processing" in upstream ? upstream.processing ?? "" : "";
  return [sourceSummary(key), upstream.status, note, processing, sourceDetails].join(" ");
}

/** 建立一次即可重用的 deterministic manifest 搜尋索引。 */
export function buildLayerSearchIndex(): readonly SearchDocument[] {
  // Orphans have no supported sidebar action. Local-only comparison recipes stay out of production.
  // Gated entries remain here; callers with an authorized empty lockedKeys set may search them.
  return MANIFEST_KEYS.filter((key) => LAYER_MANIFEST[key].section !== null && isDataSourceBrowserVisible(key)).map((key) => {
    const entry = LAYER_MANIFEST[key];
    const aliases = LAYER_SEARCH_ALIASES[key] ?? [];
    const theme = entry.section?.theme ?? null;
    const group = entry.section?.group ?? null;
    const kinds = sourceKinds(key);
    const ids = sourceIds(key);
    const source = sourceSummary(key);
    return {
      key,
      label: entry.section === null ? key : entry.label,
      description: entry.description,
      topics: entry.topics,
      aliases,
      theme,
      group,
      upstream: { status: entry.upstream.status, datasetIds: entry.upstream.datasets.map((dataset) => dataset.datasetId) },
      sourceKinds: kinds,
      sourceIds: ids,
      source,
      score: 0,
      normalized: {
        key: normalize(key),
        label: normalize(entry.section === null ? key : entry.label),
        aliases: normalize(aliases.join(" ")),
        description: normalize(entry.description),
        topics: normalize(entry.topics.join(" ")),
        source: normalize(sourceSearchText(key)),
        section: normalize([theme, group].filter(Boolean).join(" ")),
      },
    };
  });
}

export const LAYER_SEARCH_INDEX = buildLayerSearchIndex();

function scoreTerm(doc: SearchDocument, term: string): number {
  if (doc.normalized.key === term || doc.normalized.label === term) return 1000;
  if (doc.normalized.aliases.split(" ").includes(term)) return 800;
  if (doc.normalized.key.startsWith(term) || doc.normalized.label.startsWith(term)) return 500;
  if (doc.normalized.key.includes(term) || doc.normalized.label.includes(term)) return 350;
  if (doc.normalized.aliases.includes(term)) return 250;
  if (doc.normalized.topics.includes(term) || doc.normalized.section.includes(term)) return 150;
  if (doc.normalized.description.includes(term)) return 100;
  if (doc.normalized.source.includes(term)) return 50;
  return 0;
}

/**
 * 每個關鍵字都必須命中，排序規則固定：stable key/name > alias > prefix/詞彙 > 描述/來源。
 * 收藏只在完全同分時做偏好，不能蓋過明確查詢意圖。
 */
export function searchLayers(
  query: string,
  options: {
    limit?: number;
    favoriteKeys?: ReadonlySet<string>;
    scopeKeys?: ReadonlySet<string>;
    contextByKey?: ReadonlyMap<string, string>;
    /** Effective caller locks. Omit only when no auth context exists; then static sensitive keys fail closed. */
    lockedKeys?: ReadonlySet<string>;
  } = {},
): LayerSearchResult[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const limit = options.limit ?? Number.MAX_SAFE_INTEGER;
  const lockedKeys = options.lockedKeys ?? GATED_LAYERS;
  return LAYER_SEARCH_INDEX
    .filter((doc) => (!options.scopeKeys || options.scopeKeys.has(doc.key)) && !lockedKeys.has(doc.key))
    .map((doc) => {
      const context = normalize(options.contextByKey?.get(doc.key) ?? "");
      const scores = terms.map((term) => Math.max(scoreTerm(doc, term), context.includes(term) ? 150 : 0));
      if (scores.some((score) => score === 0)) return null;
      return { ...doc, score: scores.reduce((sum, score) => sum + score, 0) };
    })
    .filter((doc): doc is SearchDocument => doc !== null)
    .sort((a, b) =>
      b.score - a.score ||
      Number(options.favoriteKeys?.has(b.key) ?? false) - Number(options.favoriteKeys?.has(a.key) ?? false) ||
      a.key.localeCompare(b.key),
    )
    .slice(0, limit)
    .map(({ normalized: _normalized, ...result }) => result);
}
