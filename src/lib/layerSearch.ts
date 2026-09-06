import { LAYER_MANIFEST, MANIFEST_KEYS, type ManifestKey } from "../data/layerManifest";

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
};

export interface LayerSearchResult {
  key: ManifestKey;
  label: string;
  description: string;
  topics: readonly string[];
  aliases: readonly string[];
  theme: string | null;
  group: string | null;
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

function sourceText(key: ManifestKey): string {
  const upstream = LAYER_MANIFEST[key].upstream;
  const datasets = upstream.datasets.map((dataset) => dataset.datasetId).join(" ");
  const source = Array.isArray(LAYER_MANIFEST[key].source)
    ? LAYER_MANIFEST[key].source
    : [LAYER_MANIFEST[key].source];
  const sourceDetails = source.map((item) => {
    if (item.kind === "custom") return item.note;
    return "url" in item ? item.url : item.fallbackUrl;
  }).join(" ");
  const note = "note" in upstream ? upstream.note ?? "" : "";
  const processing = "processing" in upstream ? upstream.processing ?? "" : "";
  return [upstream.status, datasets, note, processing, sourceDetails].join(" ");
}

/** 使用者端只顯示資料詳情入口；provider 由既有 DataSourceModal 的 catalog RPC 解析。 */
function sourceHint(key: ManifestKey): string {
  switch (LAYER_MANIFEST[key].upstream.status) {
    case "pulse_only": return "本站衍生資料 · 來源詳情";
    case "catalog_missing": return "來源資訊待補";
    default: return "來源詳情";
  }
}

/** 建立一次即可重用的 deterministic manifest 搜尋索引。 */
export function buildLayerSearchIndex(): readonly SearchDocument[] {
  // Orphan registrations have no supported sidebar action; do not expose them as selectable results.
  return MANIFEST_KEYS.filter((key) => LAYER_MANIFEST[key].section !== null).map((key) => {
    const entry = LAYER_MANIFEST[key];
    const aliases = LAYER_SEARCH_ALIASES[key] ?? [];
    const theme = entry.section?.theme ?? null;
    const group = entry.section?.group ?? null;
    const source = sourceText(key);
    return {
      key,
      label: entry.section === null ? key : entry.label,
      description: entry.description,
      topics: entry.topics,
      aliases,
      theme,
      group,
      source: sourceHint(key),
      score: 0,
      normalized: {
        key: normalize(key),
        label: normalize(entry.section === null ? key : entry.label),
        aliases: normalize(aliases.join(" ")),
        description: normalize(entry.description),
        topics: normalize(entry.topics.join(" ")),
        source: normalize(source),
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
  options: { limit?: number; favoriteKeys?: ReadonlySet<string> } = {},
): LayerSearchResult[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const limit = options.limit ?? Number.MAX_SAFE_INTEGER;
  return LAYER_SEARCH_INDEX
    .map((doc) => {
      const scores = terms.map((term) => scoreTerm(doc, term));
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
