export type ResearchResultPopupFact = { label: string; value: string };

const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 4 });
const TITLE_KEYS = ["area_name", "indicator_name", "school_name", "facility_name", "hospital_name", "name", "title", "location", "label", "route_label", "zone_label", "grid_id", "event_id", "record_id"] as const;

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

function formatted(value: number, unit: string | null): string {
  return `${number.format(value)}${unit ? ` ${unit}` : ""}`;
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
  return "分析結果";
}

export type ResearchResultPopupOverlapFeature = {
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string };
};

function isDisplayScope(feature: ResearchResultPopupOverlapFeature): boolean {
  const datasetId = feature.properties?.datasetId;
  return datasetId === "derived:analysis-scope-area" || datasetId === "derived:analysis-scope-center";
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
  if (comparisonStatus === "valid" && ratio !== null) facts.push({ label: "相對基準（本區÷基準）", value: number.format(ratio) });
  return facts;
}
