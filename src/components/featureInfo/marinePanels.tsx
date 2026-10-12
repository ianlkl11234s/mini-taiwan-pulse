import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchMarineObservationHistory } from "../../data/marineObservationLoader";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { Row, formatTaiwanMinute } from "./shared";
import { localeStore, useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import type { MessageKey } from "../../i18n/keys";

type I18n = LocaleSnapshot;
/** 匯出的純函式不收 hook；測試與非元件呼叫端不傳就用目前語系。 */
const currentI18n = (): I18n => localeStore.getSnapshot();

type HistoryRange = "24h" | "7d";
type UnknownRecord = Record<string, unknown>;

export interface MarineMetricView {
  metricCode: string;
  depthKey: string;
  valueNumeric: number | null;
  unitSource: string;
  unitCanonical: string;
  verticalDatum: string;
  sourceStatus: string;
  qualityFlags: UnknownRecord;
  observedAt: string;
  receivedAt: string;
  ageSeconds: number | null;
  isMissing: boolean;
  isValid: boolean;
  missingReason: string;
}

export interface MarineHistorySelection {
  stationUid: string;
  metricCode: string;
  depthKey: string;
  verticalDatum: string;
  unit: string;
}

export interface MarineHistoryRequest {
  stationUid: string;
  metricCode: string;
  from: string;
  to: string;
  depthKey: string;
  limit: number;
}

interface NormalizedHistoryRow {
  observedAt: string;
  valueNumeric: number | null;
  unitCanonical: string;
  unitSource: string;
  verticalDatum: string;
  isMissing: boolean;
  isValid: boolean;
  missingReason: string;
  sourceStatus: string;
  qualityFlags: UnknownRecord;
}

const METRIC_LABELS: Record<string, string> = {
  tide_height: "潮位",
  tide_twvd: "潮位",
  tide_cdl: "潮位",
  tide_ref: "潮位",
  wave_height: "示性波高",
  wave_period: "波週期",
  wave_direction_deg: "波向",
  sea_temperature: "海溫",
  station_pressure: "測站氣壓",
  wind_speed: "風速",
  wind_direction_deg: "風向",
  max_wind_speed: "最大風速",
  current_speed: "流速",
  current_direction_deg: "流向",
};

const NETWORK_META = {
  cwa: { label: "CWA", descriptionKey: "popup.marine.networkCwa", color: "#22d3ee", gapSec: 3 * 3600 },
  isohe: { label: "ISOHE", descriptionKey: "popup.marine.networkIsohe", color: "#a78bfa", gapSec: 30 * 60 },
} as const satisfies Record<string, { label: string; descriptionKey: MessageKey; color: string; gapSec: number }>;

function str(value: unknown): string {
  return value == null || value === "" ? "" : String(value);
}

function pick(record: UnknownRecord, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRecord(value: unknown): UnknownRecord {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  if (typeof value === "string" && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as UnknownRecord;
      }
    } catch {
      // Mapbox scalar property that is not JSON.
    }
  }
  return {};
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeMetric(value: unknown): MarineMetricView | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as UnknownRecord;
  const metricCode = str(pick(row, "metricCode", "metric_code"));
  if (!metricCode) return null;
  const qualityFlags = parseRecord(pick(row, "qualityFlags", "quality_flags"));
  const valueNumeric = nullableNumber(pick(row, "valueNumeric", "value_numeric"));
  const isMissing = optionalBoolean(pick(row, "isMissing", "is_missing"))
    ?? optionalBoolean(qualityFlags.missing)
    ?? valueNumeric == null;
  const isValid = optionalBoolean(pick(row, "isValid", "is_valid"))
    ?? optionalBoolean(qualityFlags.valid)
    ?? (!isMissing && valueNumeric != null);
  return {
    metricCode,
    depthKey: str(pick(row, "depthKey", "depth_key")) || "surface",
    valueNumeric,
    unitSource: str(pick(row, "unitSource", "unit_source")),
    unitCanonical: str(pick(row, "unitCanonical", "unit_canonical")),
    verticalDatum: str(pick(row, "verticalDatum", "vertical_datum")),
    sourceStatus: str(pick(row, "sourceStatus", "source_status")),
    qualityFlags,
    observedAt: str(pick(row, "observedAt", "observed_at")),
    receivedAt: str(pick(row, "receivedAt", "received_at")),
    ageSeconds: nullableNumber(pick(row, "ageSeconds", "age_seconds")),
    isMissing,
    isValid,
    missingReason: str(pick(row, "missingReason", "missing_reason")),
  };
}

/** Mapbox may return `metrics` as an array or a JSON string; keep both paths equivalent. */
export function parseMarineMetrics(value: unknown): MarineMetricView[] {
  return parseArray(value)
    .map(normalizeMetric)
    .filter((metric): metric is MarineMetricView => metric != null)
    .sort((a, b) => `${a.metricCode}:${a.depthKey}:${a.verticalDatum}`.localeCompare(`${b.metricCode}:${b.depthKey}:${b.verticalDatum}`));
}

function normalizeHistoryRows(rows: unknown[]): NormalizedHistoryRow[] {
  return rows.flatMap((value) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as UnknownRecord;
    const qualityFlags = parseRecord(pick(row, "qualityFlags", "quality_flags"));
    const valueNumeric = nullableNumber(pick(row, "valueNumeric", "value_numeric"));
    const isMissing = optionalBoolean(pick(row, "isMissing", "is_missing"))
      ?? optionalBoolean(qualityFlags.missing)
      ?? valueNumeric == null;
    const isValid = optionalBoolean(pick(row, "isValid", "is_valid"))
      ?? optionalBoolean(qualityFlags.valid)
      ?? (!isMissing && valueNumeric != null);
    return [{
      observedAt: str(pick(row, "observedAt", "observed_at")),
      valueNumeric,
      unitCanonical: str(pick(row, "unitCanonical", "unit_canonical")),
      unitSource: str(pick(row, "unitSource", "unit_source")),
      verticalDatum: str(pick(row, "verticalDatum", "vertical_datum")),
      isMissing,
      isValid,
      missingReason: str(pick(row, "missingReason", "missing_reason")),
      sourceStatus: str(pick(row, "sourceStatus", "source_status")),
      qualityFlags,
    }];
  });
}

export function buildMarineHistoryRequest(
  stationUid: string,
  selection: MarineHistorySelection | null,
  range: HistoryRange,
  nowMs = Date.now(),
): MarineHistoryRequest | null {
  if (!stationUid || !selection) return null;
  if (selection.stationUid !== stationUid) return null;
  const rangeMs = range === "24h" ? 24 * 3600_000 : 7 * 24 * 3600_000;
  return {
    stationUid,
    metricCode: selection.metricCode,
    from: new Date(nowMs - rangeMs).toISOString(),
    to: new Date(nowMs).toISOString(),
    depthKey: selection.depthKey || "surface",
    limit: 5000,
  };
}

export function marineHistorySeries(rows: unknown[], expectedDatum: string): {
  points: SparklinePoint[];
  excludedCount: number;
  datums: string[];
  datumConflict: boolean;
} {
  const normalized = normalizeHistoryRows(rows);
  const usable = normalized.filter((row) => row.isValid && !row.isMissing && row.valueNumeric != null && Number.isFinite(Date.parse(row.observedAt)));
  const datums = [...new Set(usable.map((row) => row.verticalDatum).filter(Boolean))].sort();
  const datumConflict = datums.length > 1 && !expectedDatum;
  const matching = datumConflict
    ? []
    : usable.filter((row) => !expectedDatum || row.verticalDatum === expectedDatum);
  return {
    points: matching
      .map((row) => ({ t: Date.parse(row.observedAt) / 1000, v: row.valueNumeric! }))
      .sort((a, b) => a.t - b.t),
    excludedCount: normalized.length - matching.length,
    datums,
    datumConflict,
  };
}

function metricLabel(metricCode: string, i18n: I18n): string {
  const zh = METRIC_LABELS[metricCode];
  return zh ? enumLabel("marineMetric", metricCode, zh, i18n) : metricCode.replace(/_/g, " ");
}

function isTideMetric(metricCode: string): boolean {
  return metricCode === "tide_height" || metricCode.startsWith("tide_");
}

export function marineMetricDatumLabel(metricCode: string, verticalDatum: string, i18n: I18n = currentI18n()): string {
  return verticalDatum || (isTideMetric(metricCode) ? i18n.t("popup.marine.notProvided") : "");
}

function formatValue(metric: MarineMetricView, { t, formatNumber }: I18n): string {
  if (metric.isMissing) return t("popup.marine.missing");
  if (!metric.isValid || metric.valueNumeric == null) return t("popup.marine.invalid");
  const digits = Math.abs(metric.valueNumeric) >= 100 ? 1 : 3;
  return formatNumber(metric.valueNumeric, { maximumFractionDigits: digits });
}

function formatAge(seconds: number | null, { t }: I18n): string {
  if (seconds == null || seconds < 0) return t("popup.marine.noValidObs");
  if (seconds < 60) return t("popup.marine.ageSeconds", { value: Math.round(seconds) });
  if (seconds < 3600) return t("popup.marine.ageMinutes", { value: Math.round(seconds / 60) });
  if (seconds < 86400) return t("popup.marine.ageHours", { value: (seconds / 3600).toFixed(seconds < 10 * 3600 ? 1 : 0) });
  return t("popup.marine.ageDays", { value: (seconds / 86400).toFixed(1) });
}

function qualitySummary(metric: MarineMetricView, { t }: I18n): string {
  if (metric.isMissing) return metric.missingReason ? t("popup.marine.missingWithReason", { reason: metric.missingReason }) : t("popup.marine.missing");
  if (!metric.isValid) return metric.missingReason ? t("popup.marine.invalidWithReason", { reason: metric.missingReason }) : t("popup.marine.invalid");
  const extra = Object.entries(metric.qualityFlags).flatMap(([key, value]) => {
    if (key === "valid" || key === "missing" || value === false || value == null || value === "") return [];
    return [value === true ? key : `${key}: ${String(value)}`];
  });
  return extra.length ? t("popup.marine.validWith", { extra: extra.join(" · ") }) : t("popup.marine.valid");
}

function field(props: UnknownRecord, camel: string, snake: string): string {
  return str(pick(props, camel, snake));
}

function MetricCard({
  metric,
  selected,
  accent,
  onSelect,
}: {
  metric: MarineMetricView;
  selected: boolean;
  accent: string;
  onSelect: () => void;
}) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const unit = metric.unitCanonical || metric.unitSource;
  const datumLabel = marineMetricDatumLabel(metric.metricCode, metric.verticalDatum, i18n);
  const statusColor = metric.isMissing || !metric.isValid ? "#f97316" : "#22c55e";
  return (
    <div style={{ marginTop: 7, padding: "7px 8px", borderRadius: RADIUS.md, background: t.bgSubtle, border: `1px solid ${selected ? accent : t.border}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ color: t.textStrong, fontSize: FONT_SIZE.base, fontWeight: 700 }}>{metricLabel(metric.metricCode, i18n)}</span>
        <span style={{ marginLeft: "auto", color: metric.isMissing || !metric.isValid ? statusColor : accent, fontSize: FONT_SIZE.lg, fontWeight: 700 }}>
          {formatValue(metric, i18n)}
        </span>
        {unit && !metric.isMissing && metric.isValid && <span style={{ color: t.textMuted, fontSize: FONT_SIZE.xs }}>{unit}</span>}
      </div>
      <div style={{ marginTop: 3, color: t.textDim, fontSize: FONT_SIZE.xs, lineHeight: 1.45 }}>
        <span>{metric.metricCode}</span>
        <span> · depth {metric.depthKey}</span>
        {datumLabel && <span> · datum {datumLabel}</span>}
        {metric.unitSource && metric.unitCanonical && metric.unitSource !== metric.unitCanonical && (
          <span> · {tr("popup.marine.sourceUnit", { unit: metric.unitSource })}</span>
        )}
      </div>
      <div style={{ marginTop: 2, color: statusColor, fontSize: FONT_SIZE.xs }}>{qualitySummary(metric, i18n)}</div>
      {metric.observedAt && <div style={{ marginTop: 2, color: t.textDim, fontSize: FONT_SIZE.xs }}>{tr("popup.marine.observed", { time: formatTaiwanMinute(metric.observedAt) })}</div>}
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        style={{
          marginTop: 6,
          padding: "3px 8px",
          border: `1px solid ${selected ? accent : t.border}`,
          borderRadius: RADIUS.sm,
          background: selected ? `${accent}22` : "transparent",
          color: selected ? accent : t.textMuted,
          cursor: "pointer",
          fontSize: FONT_SIZE.xs,
        }}
      >
        {selected ? tr("popup.marine.trendSelected") : tr("popup.marine.trendView")}
      </button>
    </div>
  );
}

const rangeButton = (active: boolean, accent: string, border: string, textMuted: string): CSSProperties => ({
  padding: "3px 8px",
  border: `1px solid ${active ? accent : border}`,
  borderRadius: RADIUS.sm,
  background: active ? `${accent}22` : "transparent",
  color: active ? accent : textMuted,
  cursor: "pointer",
  fontSize: FONT_SIZE.xs,
});

/** Shared popup for CWA and ISOHE; the network remains explicit in every rendered panel. */
export function MarineObservationPanel({ props }: { props: UnknownRecord }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const stationUid = field(props, "stationUid", "station_uid");
  const sourceNetwork = field(props, "sourceNetwork", "source_network").toLowerCase();
  const network = sourceNetwork === "isohe"
    ? NETWORK_META.isohe
    : sourceNetwork === "cwa"
      ? NETWORK_META.cwa
      : { label: sourceNetwork || tr("popup.marine.unknownNetwork"), descriptionKey: "popup.marine.networkUnlabeled" as const, color: "#94a3b8", gapSec: undefined };
  const sourceStationId = field(props, "sourceStationId", "source_station_id");
  const metrics = useMemo(() => parseMarineMetrics(props.metrics), [props.metrics]);
  const [selection, setSelection] = useState<MarineHistorySelection | null>(null);
  const [range, setRange] = useState<HistoryRange>("24h");
  const [history, setHistory] = useState<unknown[] | null>(null);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    setSelection(null);
    setRange("24h");
    setHistory(null);
    setHistoryError(false);
  }, [stationUid]);

  useEffect(() => {
    const request = buildMarineHistoryRequest(stationUid, selection, range);
    if (!request) return;
    let cancelled = false;
    setHistory(null);
    setHistoryError(false);
    fetchMarineObservationHistory(request)
      .then((rows) => { if (!cancelled) setHistory(rows as unknown[]); })
      .catch((error: unknown) => {
        console.warn("[MarineObservation] history fetch failed:", error);
        if (!cancelled) {
          setHistory([]);
          setHistoryError(true);
        }
      });
    return () => { cancelled = true; };
  }, [stationUid, selection, range]);

  const historyView = useMemo(
    () => marineHistorySeries(history ?? [], selection?.verticalDatum ?? ""),
    [history, selection?.verticalDatum],
  );
  const latestObservedAt = field(props, "latestObservedAt", "latest_observed_at")
    || metrics.map((metric) => metric.observedAt).filter(Boolean).sort().slice(-1)[0]
    || "";
  const latestAgeSeconds = nullableNumber(pick(props, "latestAgeSeconds", "latest_age_seconds"));
  const latestSourceStatus = field(props, "latestSourceStatus", "latest_source_status");
  const stationSourceStatus = field(props, "sourceStatus", "source_status");
  const freshnessStatus = field(props, "freshnessStatus", "freshness_status");
  const name = field(props, "nameZh", "name_zh") || field(props, "nameEn", "name_en") || sourceStationId || tr("popup.marine.stationFallback");
  const hasTideMetric = metrics.some((metric) => isTideMetric(metric.metricCode));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: network.color, flexShrink: 0 }} />
        <div style={{ color: t.textStrong, fontSize: FONT_SIZE.lg, fontWeight: 700, lineHeight: 1.25 }}>{name}</div>
        <span style={{ marginLeft: "auto", color: network.color, fontSize: FONT_SIZE.xs, fontWeight: 700 }}>{network.label}</span>
      </div>
      <Row label={tr("popup.marine.stationCode")} value={sourceStationId || stationUid} color={t.textDim} />
      <Row label={tr("popup.marine.sourceNetwork")} value={sourceNetwork || network.label.toLowerCase()} color={network.color} />
      <Row label={tr("popup.marine.originOrg")} value={field(props, "originOrg", "origin_org")} />
      <Row label={tr("popup.marine.distributionOrg")} value={field(props, "distributionOrg", "distribution_org")} />
      <Row label={tr("popup.marine.stationType")} value={field(props, "stationType", "station_type")} />
      <Row label={tr("popup.marine.latestObs")} value={latestObservedAt ? formatTaiwanMinute(latestObservedAt) : tr("popup.marine.noValidObs")} />
      <Row label={tr("popup.marine.dataAge")} value={formatAge(latestAgeSeconds, i18n)} />
      <Row label={tr("popup.marine.freshness")} value={freshnessStatus || tr("popup.marine.unclassified")} />
      <Row label={tr("popup.marine.stationStatus")} value={stationSourceStatus || tr("popup.marine.unlabeled")} />
      <Row label={tr("popup.marine.obsStatus")} value={latestSourceStatus || tr("popup.marine.unlabeled")} />
      <div style={{ marginTop: 7, color: t.textDim, fontSize: FONT_SIZE.xs, lineHeight: 1.45 }}>{tr(network.descriptionKey)}</div>

      <div style={{ marginTop: 10, color: t.textMuted, fontSize: FONT_SIZE.xs, letterSpacing: 0.6 }}>
        {tr("popup.marine.latestMetrics", { n: metrics.length })}
      </div>
      {metrics.length === 0 ? (
        <div style={{ marginTop: 6, color: t.textDim, fontSize: FONT_SIZE.sm }}>{tr("popup.marine.noMetrics")}</div>
      ) : metrics.map((metric) => {
        const key = `${metric.metricCode}:${metric.depthKey}:${metric.verticalDatum}`;
        const selectedKey = selection ? `${selection.metricCode}:${selection.depthKey}:${selection.verticalDatum}` : "";
        return (
          <MetricCard
            key={key}
            metric={metric}
            selected={key === selectedKey}
            accent={network.color}
            onSelect={() => {
              setRange("24h");
              setSelection({
                stationUid,
                metricCode: metric.metricCode,
                depthKey: metric.depthKey,
                verticalDatum: metric.verticalDatum,
                unit: metric.unitCanonical || metric.unitSource,
              });
            }}
          />
        );
      })}

      {hasTideMetric && (
        <div style={{ marginTop: 8, color: "#f59e0b", fontSize: FONT_SIZE.xs, lineHeight: 1.45 }}>
          {tr("popup.marine.datumWarning")}
        </div>
      )}

      {selection && (
        <div style={{ marginTop: 11, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: t.textMuted, fontSize: FONT_SIZE.xs }}>{tr("popup.marine.trendTitle", { metric: metricLabel(selection.metricCode, i18n) })}</span>
            <span style={{ color: t.textDim, fontSize: FONT_SIZE.xs }}>depth {selection.depthKey}</span>
            {marineMetricDatumLabel(selection.metricCode, selection.verticalDatum, i18n) && (
              <span style={{ color: "#f59e0b", fontSize: FONT_SIZE.xs }}>
                datum {marineMetricDatumLabel(selection.metricCode, selection.verticalDatum, i18n)}
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button type="button" onClick={() => setRange("24h")} style={rangeButton(range === "24h", network.color, t.border, t.textMuted)}>24h</button>
              <button type="button" onClick={() => setRange("7d")} style={rangeButton(range === "7d", network.color, t.border, t.textMuted)}>{tr("popup.marine.days7")}</button>
            </div>
          </div>
          {history == null ? (
            <div style={{ padding: "10px 4px", textAlign: "center", color: t.textDim, fontSize: FONT_SIZE.sm }}>{tr("popup.marine.historyLoading")}</div>
          ) : historyError ? (
            <div style={{ padding: "10px 4px", color: "#f97316", fontSize: FONT_SIZE.sm }}>{tr("popup.marine.historyError")}</div>
          ) : historyView.datumConflict ? (
            <div style={{ padding: "10px 4px", color: "#f97316", fontSize: FONT_SIZE.sm }}>
              {tr("popup.marine.datumConflict", { datums: historyView.datums.join(tr("popup.marine.listSep")) })}
            </div>
          ) : historyView.points.length === 0 ? (
            <div style={{ padding: "10px 4px", color: t.textDim, fontSize: FONT_SIZE.sm }}>{tr("popup.marine.noWindowData")}</div>
          ) : (
            <TimeseriesSparkline
              data={historyView.points}
              unit={selection.unit}
              lineColor={network.color}
              height={120}
              gapSec={network.gapSec}
              showTooltip
            />
          )}
          {history != null && historyView.excludedCount > 0 && !historyError && (
            <div style={{ marginTop: 3, color: t.textDim, fontSize: FONT_SIZE.xs }}>
              {tr("popup.marine.excluded", { n: historyView.excludedCount })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
