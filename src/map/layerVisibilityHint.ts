/**
 * 視野提示卡的「圖層看不到」判斷（design-system spec §5.42.1、map-layers.md §3.8 V-3）。
 *
 * 兩種原因，只做這兩條（不用 queryRenderedFeatures 判「畫面沒東西」：圖磚載入中必誤報）：
 * - **縮放**：目前縮放低於該層「可見起點」→「放大到 zN 才顯示」＋「放大」。
 * - **資料範圍**：局部資料層（`data/layerCoverage.ts`）視野與資料範圍不相交，或還沒到可見起點
 *   →「資料只有〇〇・放大到 zN」＋「前往〇〇」。同一目的地多層合併一列、一個按鈕。
 *
 * 可見起點＝該層在地圖上「目前開著的」各 style layer 的 max(layer.minzoom, source.minzoom) 取最小值，
 * 所以低縮放有熱區的層拉遠看得到，不算看不到。style layer 由 runtime 地圖內省（hook 自建的層也抓得到），
 * 找不到任何 style layer（還在載入、Three.js 自繪）就不判斷縮放——寧可漏報不誤報。
 *
 * 純函式與 React 分開（`hooks/useLayerVisibilityHint.ts` 接線），單元測試直接打這些函式。
 */
import { LAYER_MANIFEST, type LayerSource } from "../data/layerManifest";
import { KR_DATA_SPECS } from "../data/krDataLayers";
import { COVERAGE_AREAS, layerCoverage, type CoverageAreaId, type CoverageBbox } from "../data/layerCoverage";
import { GIS_LAYERS } from "./gisClickRegistry";
import { registryStyleLayerIds } from "../research/visibleSummary";

export const LAYER_HINT_MAX_LAYERS = 4;

// ── key → style layer 種子 ─────────────────────────────────────────

export interface HintSeeds { ids: ReadonlySet<string>; sources: ReadonlySet<string> }

type ManifestLike = { source?: LayerSource | LayerSource[]; popup?: string | string[] | null };

const seedCache = new Map<string, HintSeeds>();

/**
 * 一個圖層 key 擁有的 style layer id 與 source id（靜態可知的部分）：
 * overlay registry 的 `${sourceId}-${suffix}`、南韓資料層 `layerId`、manifest `popup` 反查點擊登記簿、
 * manifest 的 geojson／pmtiles／supabase `sourceId`。
 */
export function layerHintSeeds(key: string): HintSeeds {
  const cached = seedCache.get(key);
  if (cached) return cached;
  const ids = new Set<string>(registryStyleLayerIds(key) ?? []);
  for (const spec of KR_DATA_SPECS) if (spec.key === key) ids.add(spec.layerId);
  const entry = (LAYER_MANIFEST as Record<string, ManifestLike | undefined>)[key];
  const popups = entry?.popup == null ? [] : Array.isArray(entry.popup) ? entry.popup : [entry.popup];
  // 統計圖層共用同一個 renderer（popup "regionalStatistic"），反查會把所有統計層混在一起，不用
  for (const type of popups) {
    if (type === "regionalStatistic") continue;
    for (const row of GIS_LAYERS) if (row.type === type) row.layers.forEach((id) => ids.add(id));
  }
  const sources = new Set<string>();
  const srcList = entry?.source ? (Array.isArray(entry.source) ? entry.source : [entry.source]) : [];
  for (const src of srcList) if ("sourceId" in src && src.sourceId) sources.add(src.sourceId);
  const seeds = { ids, sources };
  seedCache.set(key, seeds);
  return seeds;
}

// ── runtime style 內省 ─────────────────────────────────────────────

export interface HintStyleLayer {
  id: string;
  type: string;
  source?: unknown;
  minzoom?: number;
  maxzoom?: number;
  layout?: Record<string, unknown>;
}

const PART_SUFFIX = /-(circle|circles|fill|fills|line|lines|outline|stroke|symbol|symbols|label|labels|icon|icons|glow|halo|heat|heatmap|point|points|dot|dots)$/;

/** `kr-bridges-circle` → `kr-bridges`：同一層的熱區、標籤常用同字首。太短的字首不用（避免吃到別層）。 */
export function styleIdBase(id: string): string | null {
  const base = id.replace(PART_SUFFIX, "");
  return base !== id && base.length >= 5 && base.includes("-") ? base : null;
}

/**
 * 從地圖目前的 style layers 找出屬於這個 key 的層：種子 id、用種子 source 的層、同字首的層，
 * 以及和種子同 source 的熱區（熱區通常不可點，不在點擊登記簿裡）。
 */
export function matchStyleLayers(seeds: HintSeeds, styleLayers: readonly HintStyleLayer[]): HintStyleLayer[] {
  const bases = [...seeds.ids].map(styleIdBase).filter((b): b is string => !!b);
  const direct = styleLayers.filter((l) =>
    seeds.ids.has(l.id)
    || (typeof l.source === "string" && seeds.sources.has(l.source))
    || bases.some((b) => l.id.startsWith(`${b}-`)));
  const directSources = new Set(direct.map((l) => l.source).filter((s): s is string => typeof s === "string"));
  const heat = styleLayers.filter((l) => l.type === "heatmap" && typeof l.source === "string" && directSources.has(l.source) && !direct.includes(l));
  return [...direct, ...heat];
}

export interface VisibleRange { start: number; visibleAt: (zoom: number) => boolean }

/**
 * 只看目前開著（visibility ≠ none）的 style layer；每層的區間是
 * [max(layer.minzoom, source.minzoom), layer.maxzoom)。全部都關著或找不到 → null（不判斷）。
 */
export function visibleRange(layers: readonly HintStyleLayer[], sourceMinzoom: (sourceId: string) => number | undefined): VisibleRange | null {
  const spans: [number, number][] = [];
  for (const l of layers) {
    if (l.layout?.visibility === "none") continue;
    const srcMin = typeof l.source === "string" ? sourceMinzoom(l.source) ?? 0 : 0;
    const lo = Math.max(l.minzoom ?? 0, srcMin);
    const hi = l.maxzoom ?? 24;
    if (hi > lo) spans.push([lo, hi]);
  }
  if (!spans.length) return null;
  return {
    start: Math.min(...spans.map(([lo]) => lo)),
    visibleAt: (z) => spans.some(([lo, hi]) => z >= lo && z < hi),
  };
}

// ── 判斷 ──────────────────────────────────────────────────────────

export type ViewBounds = readonly [number, number, number, number];

export function bboxIntersects(a: ViewBounds, b: CoverageBbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export interface HiddenLayer {
  key: string;
  reason: "zoom" | "coverage";
  /** 可見起點；未知（找不到 style layer）為 null */
  start: number | null;
  /** 目前縮放不到可見起點 */
  needZoom: boolean;
  area?: CoverageAreaId;
}

/** 開著的圖層裡，哪些在目前畫面看不到、為什麼。順序沿用 `keys`。 */
export function findHiddenLayers({
  keys,
  zoom,
  bounds,
  rangeFor,
  coverageFor = (key) => layerCoverage(key)?.id ?? null,
}: {
  keys: readonly string[];
  zoom: number;
  bounds: ViewBounds;
  rangeFor: (key: string) => VisibleRange | null;
  coverageFor?: (key: string) => CoverageAreaId | null;
}): HiddenLayer[] {
  const out: HiddenLayer[] = [];
  for (const key of keys) {
    const range = rangeFor(key);
    // 縮放不到：沒有任何一層在目前縮放畫、且還在可見起點之下（區間中間的空檔不算，保守）
    const needZoom = !!range && zoom < range.start && !range.visibleAt(zoom);
    const area = coverageFor(key);
    if (area) {
      const outside = !bboxIntersects(bounds, COVERAGE_AREAS[area].bbox);
      if (outside || needZoom) out.push({ key, reason: "coverage", start: range?.start ?? null, needZoom, area });
    } else if (needZoom) {
      out.push({ key, reason: "zoom", start: range!.start, needZoom, });
    }
  }
  return out;
}

// ── 列（同目的地合併）與上限 ──────────────────────────────────────

export interface HintRow {
  /** zoom:<N> 或 area:<id> */
  id: string;
  kind: "zoom" | "coverage";
  keys: string[];
  /** 文案上的「放大到 zN」；不需要再放大時 null */
  showZoom: number | null;
  /** 按鈕的目標縮放（「前往」時為下限）；未知為 null */
  targetZoom: number | null;
  area?: CoverageAreaId;
}

export function buildHintRows(hidden: readonly HiddenLayer[], max = LAYER_HINT_MAX_LAYERS): { rows: HintRow[]; more: number; total: number } {
  const byId = new Map<string, HintRow>();
  for (const h of hidden) {
    const id = h.reason === "coverage" ? `area:${h.area}` : `zoom:${h.start}`;
    let row = byId.get(id);
    if (!row) {
      row = { id, kind: h.reason, keys: [], showZoom: null, targetZoom: null, ...(h.area ? { area: h.area } : {}) };
      byId.set(id, row);
    }
    row.keys.push(h.key);
    if (h.start !== null) row.targetZoom = Math.max(row.targetZoom ?? -Infinity, h.start);
    if (h.needZoom && h.start !== null) row.showZoom = Math.max(row.showZoom ?? -Infinity, h.start);
  }
  const rows: HintRow[] = [];
  let shown = 0;
  for (const row of byId.values()) {
    if (shown >= max) break;
    const keys = row.keys.slice(0, max - shown);
    shown += keys.length;
    rows.push({ ...row, keys });
  }
  return { rows, more: hidden.length - shown, total: hidden.length };
}

/** z8、z5.5 */
export function formatZoom(z: number): string {
  return Number.isInteger(z) ? String(z) : z.toFixed(1).replace(/\.0$/, "");
}

// ── 「知道了」 ────────────────────────────────────────────────────

/**
 * 「知道了」收起，直到：開關任何圖層（`openSignature` 變了），或某層從看得到變看不到
 * （收起時記下當時看不到的層；之後變看得到就從紀錄移除，再變看不到就不在紀錄裡→重新出現）。
 */
export function createLayerHintDismissal() {
  let dismissed: Set<string> | null = null;
  let signature = "";
  return {
    dismiss(hiddenKeys: readonly string[], openSignature: string) {
      dismissed = new Set(hiddenKeys);
      signature = openSignature;
    },
    /** 每次判斷後呼叫：回傳是否仍收起 */
    update(hiddenKeys: readonly string[], openSignature: string): boolean {
      if (!dismissed) return false;
      if (openSignature !== signature || hiddenKeys.some((k) => !dismissed!.has(k))) {
        dismissed = null;
        return false;
      }
      const now = new Set(hiddenKeys);
      for (const k of dismissed) if (!now.has(k)) dismissed.delete(k);
      return true;
    },
  };
}
export type LayerHintDismissal = ReturnType<typeof createLayerHintDismissal>;
