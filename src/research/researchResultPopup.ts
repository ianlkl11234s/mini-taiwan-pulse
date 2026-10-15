import type { MessageKey } from "../i18n/keys";
import { localeStore, type LocaleSnapshot } from "../state/localeStore";
import { classifyVizNumberKind, formatVizNumber } from "./vizFormat";

export type ResearchResultPopupFact = { label: string; value: string };

/** Exported for analysisResultOverlay.ts's proportional-symbol label layer, which needs the same
 *  fallback key order as a Mapbox `coalesce` expression (a static list, not a per-feature function). */
export const TITLE_KEYS = ["area_name", "indicator_name", "school_name", "facility_name", "hospital_name", "name", "title", "location", "label", "route_label", "zone_label", "grid_id", "event_id", "record_id"] as const;

/** 狀態代碼 → 翻譯 key（key 必須寫成完整字面量，供「沒人用的 key」測試掃描）。 */
export const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  observed: "researchResult.status.observed",
  missing: "researchResult.status.missing",
  suppressed: "researchResult.status.suppressed",
  not_reported: "researchResult.status.not_reported",
  valid: "researchResult.status.valid",
  baseline_missing: "researchResult.status.baseline_missing",
  baseline_suppressed: "researchResult.status.baseline_suppressed",
  baseline_not_reported: "researchResult.status.baseline_not_reported",
  baseline_zero: "researchResult.status.baselineZero",
  not_requested: "researchResult.status.not_requested",
  denominator_missing: "researchResult.status.denominator_missing",
  denominator_suppressed: "researchResult.status.denominator_suppressed",
  denominator_not_reported: "researchResult.status.denominator_not_reported",
  zero_denominator: "researchResult.status.zero_denominator",
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function status(value: unknown, i18n: LocaleSnapshot): string | null {
  const raw = text(value);
  if (!raw) return null;
  const key = STATUS_LABEL_KEYS[raw];
  return key ? i18n.t(key) : raw;
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
export function researchResultPopupDistance(value: unknown, i18n: LocaleSnapshot = localeStore.getSnapshot()): string | null {
  const distance = finiteNumber(value);
  return distance === null ? null : i18n.t("researchResult.fact.distanceValue", { value: i18n.formatNumber(Math.round(distance), { maximumFractionDigits: 4 }) });
}

/** Prefer source labels, while retaining administrative area names over generic identifiers. */
export function researchResultPopupTitle(properties: Record<string, unknown>, i18n: LocaleSnapshot = localeStore.getSnapshot()): string {
  for (const key of TITLE_KEYS) {
    const value = properties[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  // Warehouse results keep source column names (e.g. TDX `StationName`), so fall back to any
  // non-internal field whose name ends in "name" before using the generic label.
  const nameLike = sourceFieldEndingWith(properties, /name$/i);
  if (nameLike) return nameLike;
  return i18n.t("researchResult.fact.titleFallback");
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
export function researchResultPopupFacts(properties: Record<string, unknown>, i18n: LocaleSnapshot = localeStore.getSnapshot()): ResearchResultPopupFact[] {
  const { t } = i18n;
  const facts: ResearchResultPopupFact[] = [];
  const styleLabel = text(properties.styleFactLabel);
  const styleValue = text(properties.styleFactValue);
  if (styleLabel && styleValue) facts.push({ label: styleLabel, value: styleValue });
  const sourceStatus = text(properties.status);
  const observedValue = finiteNumber(properties.value);
  const unit = text(properties.unit);
  if (sourceStatus === "observed" && observedValue !== null) facts.push({ label: t("researchResult.fact.rawValue"), value: formatted(observedValue, unit) });
  else if (sourceStatus) facts.push({ label: t("researchResult.fact.rawStatus"), value: status(sourceStatus, i18n)! });
  else if (observedValue !== null) facts.push({ label: t("researchResult.fact.rawValue"), value: formatted(observedValue, unit) });

  const sourceAreaHa = finiteNumber(properties.area_ha);
  if (sourceAreaHa !== null) facts.push({ label: t("researchResult.fact.sourceArea"), value: formatted(sourceAreaHa, text(properties.sourceAreaUnit) ?? "ha") });

  const occurredAt = text(properties.occurred_at);
  if (occurredAt) facts.push({ label: t("popup.field.occurredAt"), value: occurredAt });
  const magnitude = finiteNumber(properties.magnitude);
  if (magnitude !== null) facts.push({ label: t("researchResult.fact.magnitude"), value: formatted(magnitude, text(properties.magnitudeUnit)) });
  const depthKm = finiteNumber(properties.depth_km);
  if (depthKm !== null) facts.push({ label: t("researchResult.fact.depth"), value: formatted(depthKm, text(properties.depthUnit)) });

  const hasNormalizedValue = Object.prototype.hasOwnProperty.call(properties, "normalizedValue");
  const normalizationStatus = text(properties.normalization_status);
  const normalizedValue = finiteNumber(properties.normalizedValue);
  if (hasNormalizedValue && normalizedValue !== null && (!normalizationStatus || normalizationStatus === "valid")) {
    const normalizedUnit = text(properties.normalizedUnit) ?? text(properties.normalized_unit);
    facts.push({ label: t("researchResult.fact.normalized"), value: formatted(normalizedValue, normalizedUnit) + (normalizedUnit ? "" : t("researchResult.fact.unitMissing")) });
  }
  if (hasNormalizedValue && normalizationStatus && normalizationStatus !== "valid") facts.push({ label: t("researchResult.fact.normalizedStatus"), value: status(normalizationStatus, i18n)! });

  const comparisonStatus = text(properties.comparison_status);
  if (comparisonStatus) facts.push({ label: t("researchResult.fact.baseline"), value: t("researchResult.fact.baselineValue", { status: status(comparisonStatus, i18n)! }) });
  const difference = finiteNumber(properties.absoluteDifference);
  const differenceUnit = text(properties.differenceUnit) ?? unit;
  if (comparisonStatus === "valid" && difference !== null) facts.push({ label: t("researchResult.fact.difference"), value: formatted(difference, differenceUnit) });
  const ratio = finiteNumber(properties.ratio);
  if (comparisonStatus === "valid" && ratio !== null) facts.push({ label: t("researchResult.fact.ratio"), value: formatVizNumber(ratio, "ratio") });
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
export function researchResultRecordFacts(properties: Record<string, unknown>, datasetLabel: string, i18n: LocaleSnapshot = localeStore.getSnapshot()): ResearchResultPopupFact[] {
  const { t } = i18n;
  const facts: ResearchResultPopupFact[] = [];
  if (properties.datasetId) facts.push({ label: t("researchResult.fact.dataset"), value: datasetLabel === UNNAMED_DATASET_LABEL ? t("researchResult.fact.unnamedDataset") : datasetLabel });
  facts.push(...researchResultPopupFacts(properties, i18n));
  const address = sourceFieldEndingWith(properties, /address$/i);
  if (address) facts.push({ label: t("popup.field.address"), value: address });
  const distance = researchResultPopupDistance(properties.distanceM ?? properties.dist_m, i18n);
  if (distance) facts.push({ label: t("researchResult.fact.distance"), value: distance });
  if (properties.source_version) facts.push({ label: t("researchResult.fact.version"), value: String(properties.source_version) });
  if (properties.boundary_version) facts.push({ label: t("researchResult.fact.boundaryVersion"), value: String(properties.boundary_version) });
  if (!facts.length) facts.push({ label: t("popup.analysisResult.recordLabel"), value: t("popup.analysisResult.recordValue") });
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
  i18n: LocaleSnapshot = localeStore.getSnapshot(),
): AnalysisResultPanelProperties {
  return {
    records: overlaps.features.map(feature => {
      const properties = feature.properties ?? {};
      const resultId = typeof properties.resultId === "string" ? properties.resultId : null;
      const presentation = resultId ? presentationFor(resultId) : undefined;
      const trend = resultId && trendFor ? trendFor(resultId, properties) : null;
      return {
        title: researchResultPopupTitle(properties, i18n),
        color: presentation?.color ?? null,
        facts: researchResultRecordFacts(properties, researchResultDatasetLabel(properties.datasetId, presentation?.displayLabel, describe), i18n),
        ...(trend ? { trend } : {}),
      };
    }),
    total: overlaps.total,
    omitted: overlaps.omitted,
  };
}
