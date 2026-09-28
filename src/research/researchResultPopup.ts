import { classifyVizNumberKind, formatVizNumber } from "./vizFormat";

export type ResearchResultPopupFact = { label: string; value: string };

const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 4 });
/** Exported for analysisResultOverlay.ts's proportional-symbol label layer, which needs the same
 *  fallback key order as a Mapbox `coalesce` expression (a static list, not a per-feature function). */
export const TITLE_KEYS = ["area_name", "indicator_name", "school_name", "facility_name", "hospital_name", "name", "title", "location", "label", "route_label", "zone_label", "grid_id", "event_id", "record_id"] as const;

const statusLabels: Record<string, string> = {
  observed: "有觀測值",
  missing: "缺資料",
  suppressed: "數值受抑制",
  not_reported: "未報告",
  valid: "可比較",
  baseline_missing: "基準缺資料",
  baseline_suppressed: "基準受抑制",
  baseline_not_reported: "基準未報告",
  baseline_zero: "基準為零，無法計算比值",
  not_requested: "未要求標準化",
  denominator_missing: "分母缺資料",
  denominator_suppressed: "分母受抑制",
  denominator_not_reported: "分母未報告",
  zero_denominator: "分母為零",
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function status(value: unknown): string | null {
  const raw = text(value);
  return raw ? statusLabels[raw] ?? raw : null;
}

/** Popup number display (spec U1): a conservative kind guess from the field's free-text unit (no
 *  ResultStyle field declares an explicit value kind yet) plus the value's own shape — see
 *  classifyVizNumberKind. A "%" unit's own value already embeds the sign, so it is never re-appended. */
function formatted(value: number, unit: string | null): string {
  const kind = classifyVizNumberKind(value, unit);
  const text = formatVizNumber(value, kind);
  return kind === "percent" ? text : `${text}${unit ? ` ${unit}` : ""}`;
}

/** Mapbox properties may contain null; only a finite numeric distance is a measured straight-line distance. */
export function researchResultPopupDistance(value: unknown): string | null {
  const distance = finiteNumber(value);
  return distance === null ? null : `${number.format(Math.round(distance))} 公尺 · 直線`;
}

/** Prefer source labels, while retaining administrative area names over generic identifiers. */
export function researchResultPopupTitle(properties: Record<string, unknown>): string {
  for (const key of TITLE_KEYS) {
    const value = properties[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  // Warehouse results keep source column names (e.g. TDX `StationName`), so fall back to any
  // non-internal field whose name ends in "name" before using the generic label.
  const nameLike = sourceFieldEndingWith(properties, /name$/i);
  if (nameLike) return nameLike;
  return "分析結果";
}

/** First non-empty source field (not `_`-prefixed internal fields) whose key matches `pattern`. */
function sourceFieldEndingWith(properties: Record<string, unknown>, pattern: RegExp): string | null {
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith("_") || !pattern.test(key)) continue;
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
}

export type ResearchResultPopupOverlapFeature = {
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string };
};

function isDisplayScope(feature: ResearchResultPopupOverlapFeature): boolean {
  const datasetId = feature.properties?.datasetId;
  // Defense in depth: analysisResultOverlay already keeps a nearby_profile scope-circle row
  // (_role: "scope") off the interactive layer list entirely, so it should never reach here.
  return datasetId === "derived:analysis-scope-area" || datasetId === "derived:analysis-scope-center" || feature.properties?._role === "scope";
}

/** Retain a bounded, deduplicated set of actual results; display-scope context never hides a real hit. */
export function researchResultPopupOverlaps<T extends ResearchResultPopupOverlapFeature>(features: readonly T[], limit = 8): { features: T[]; total: number; omitted: number } {
  const boundedLimit = Number.isInteger(limit) && limit >= 1 && limit <= 16 ? limit : 8;
  const seen = new Set<string>();
  const unique = features.filter(feature => {
    const resultId = feature.properties?.resultId;
    if ((typeof resultId !== "string" && typeof resultId !== "number") || feature.id === undefined) return true;
    const key = `${resultId}:${feature.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const nonScope = unique.filter(feature => !isDisplayScope(feature));
  const candidates = (nonScope.length ? nonScope : unique).sort((left, right) => Number(right.geometry?.type === "Point") - Number(left.geometry?.type === "Point"));
  return { features: candidates.slice(0, boundedLimit), total: candidates.length, omitted: Math.max(0, candidates.length - boundedLimit) };
}

/** Popup facts deliberately separate source values, normalized values, and comparison calculations. */
export function researchResultPopupFacts(properties: Record<string, unknown>): ResearchResultPopupFact[] {
  const facts: ResearchResultPopupFact[] = [];
  const styleLabel = text(properties.styleFactLabel);
  const styleValue = text(properties.styleFactValue);
  if (styleLabel && styleValue) facts.push({ label: styleLabel, value: styleValue });
  const sourceStatus = text(properties.status);
  const observedValue = finiteNumber(properties.value);
  const unit = text(properties.unit);
  if (sourceStatus === "observed" && observedValue !== null) facts.push({ label: "原始值", value: formatted(observedValue, unit) });
  else if (sourceStatus) facts.push({ label: "原始值狀態", value: status(sourceStatus)! });
  else if (observedValue !== null) facts.push({ label: "原始值", value: formatted(observedValue, unit) });

  const sourceAreaHa = finiteNumber(properties.area_ha);
  if (sourceAreaHa !== null) facts.push({ label: "來源面積", value: formatted(sourceAreaHa, text(properties.sourceAreaUnit) ?? "ha") });

  const occurredAt = text(properties.occurred_at);
  if (occurredAt) facts.push({ label: "發生時間", value: occurredAt });
  const magnitude = finiteNumber(properties.magnitude);
  if (magnitude !== null) facts.push({ label: "規模", value: formatted(magnitude, text(properties.magnitudeUnit)) });
  const depthKm = finiteNumber(properties.depth_km);
  if (depthKm !== null) facts.push({ label: "深度", value: formatted(depthKm, text(properties.depthUnit)) });

  const hasNormalizedValue = Object.prototype.hasOwnProperty.call(properties, "normalizedValue");
  const normalizationStatus = text(properties.normalization_status);
  const normalizedValue = finiteNumber(properties.normalizedValue);
  if (hasNormalizedValue && normalizedValue !== null && (!normalizationStatus || normalizationStatus === "valid")) {
    const normalizedUnit = text(properties.normalizedUnit) ?? text(properties.normalized_unit);
    facts.push({ label: "標準化值", value: formatted(normalizedValue, normalizedUnit) + (normalizedUnit ? "" : "（單位未隨圖徵提供）") });
  }
  if (hasNormalizedValue && normalizationStatus && normalizationStatus !== "valid") facts.push({ label: "標準化狀態", value: status(normalizationStatus)! });

  const comparisonStatus = text(properties.comparison_status);
  if (comparisonStatus) facts.push({ label: "比較基準", value: `本區÷基準；${status(comparisonStatus)!}` });
  const difference = finiteNumber(properties.absoluteDifference);
  const differenceUnit = text(properties.differenceUnit) ?? unit;
  if (comparisonStatus === "valid" && difference !== null) facts.push({ label: "差值（本區－基準）", value: formatted(difference, differenceUnit) });
  const ratio = finiteNumber(properties.ratio);
  if (comparisonStatus === "valid" && ratio !== null) facts.push({ label: "相對基準（本區÷基準）", value: formatVizNumber(ratio, "ratio") });
  return facts;
}

/** Shown instead of an internal identifier when no human-readable dataset name is known. */
export const UNNAMED_DATASET_LABEL = "未命名資料集";

/**
 * Human-readable dataset name for the docked result panel. Internal identifiers
 * (`warehouse:wh-8`, descriptor ids, `a+b` composites) are never shown: the presented
 * result's displayLabel wins unless it merely echoes the id, then the dataset
 * descriptor label, then a neutral placeholder.
 */
export function researchResultDatasetLabel(datasetId: unknown, displayLabel: string | null | undefined, describe: (datasetId: string) => string | null): string {
  const id = typeof datasetId === "string" ? datasetId.trim() : "";
  const shown = typeof displayLabel === "string" ? displayLabel.trim() : "";
  if (shown && shown !== id) return shown;
  if (id) {
    let described: string | null = null;
    try { described = describe(id); } catch { described = null; }
    if (described && described.trim() && described.trim() !== id) return described.trim();
  }
  return UNNAMED_DATASET_LABEL;
}

/** Facts for one hit, in panel order; source values stay separate from derived calculations. */
export function researchResultRecordFacts(properties: Record<string, unknown>, datasetLabel: string): ResearchResultPopupFact[] {
  const facts: ResearchResultPopupFact[] = [];
  if (properties.datasetId) facts.push({ label: "資料集", value: datasetLabel });
  facts.push(...researchResultPopupFacts(properties));
  const address = sourceFieldEndingWith(properties, /address$/i);
  if (address) facts.push({ label: "地址", value: address });
  const distance = researchResultPopupDistance(properties.distanceM ?? properties.dist_m);
  if (distance) facts.push({ label: "距離", value: distance });
  if (properties.source_version) facts.push({ label: "版本", value: String(properties.source_version) });
  if (properties.boundary_version) facts.push({ label: "邊界版本", value: String(properties.boundary_version) });
  if (!facts.length) facts.push({ label: "紀錄", value: "本次分析命中的空間紀錄" });
  return facts;
}

/** P3=W3 popup trend marker: T2 A2's own recent-periods line, index-aligned with `points`.
 *  `markerIndex` is the currently playing/scrubbed period (null when playback has nothing to mark). */
export type AnalysisResultPanelTrend = { points: { label: string; value: number | null }[]; caption: string; markerIndex: number | null };
export type AnalysisResultPanelRecord = { title: string; color: string | null; facts: ResearchResultPopupFact[]; trend?: AnalysisResultPanelTrend };
/** Serializable `FeatureInfo.properties` payload for `layerType: "analysisResult"`. */
export type AnalysisResultPanelProperties = { records: AnalysisResultPanelRecord[]; total: number; omitted: number };

/** Resolve every overlapping hit at click time so the panel stays a pure renderer. `trendFor`, when
 *  given, attaches a T2 A2 recent-periods trend line to a feature belonging to a timed choropleth
 *  (spec P3=W3 「點選區域 popup 內近期趨勢線」) — the caller resolves it from the row store (`_fid`),
 *  never from `properties` itself (a queried Mapbox feature's array-valued properties are not
 *  reliably read back; see MainMapConnection.tsx). */
export function researchResultPanelProperties<T extends ResearchResultPopupOverlapFeature>(
  overlaps: { features: readonly T[]; total: number; omitted: number },
  presentationFor: (resultId: string) => { displayLabel?: string; color?: string } | undefined,
  describe: (datasetId: string) => string | null,
  trendFor?: (resultId: string, properties: Record<string, unknown>) => AnalysisResultPanelTrend | null,
): AnalysisResultPanelProperties {
  return {
    records: overlaps.features.map(feature => {
      const properties = feature.properties ?? {};
      const resultId = typeof properties.resultId === "string" ? properties.resultId : null;
      const presentation = resultId ? presentationFor(resultId) : undefined;
      const trend = resultId && trendFor ? trendFor(resultId, properties) : null;
      return {
        title: researchResultPopupTitle(properties),
        color: presentation?.color ?? null,
        facts: researchResultRecordFacts(properties, researchResultDatasetLabel(properties.datasetId, presentation?.displayLabel, describe)),
        ...(trend ? { trend } : {}),
      };
    }),
    total: overlaps.total,
    omitted: overlaps.omitted,
  };
}
