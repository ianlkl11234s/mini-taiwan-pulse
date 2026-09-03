import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchMarineObservationHistory } from "../../data/marineObservationLoader";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { Row, formatTaiwanTime } from "./shared";

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
  cwa: { label: "CWA", description: "中央氣象署海洋固定站（上游約每小時更新）", color: "#22d3ee", gapSec: 3 * 3600 },
  isohe: { label: "ISOHE", description: "港區海氣象固定站（上游約每 10 分鐘更新）", color: "#a78bfa", gapSec: 30 * 60 },
} as const;

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

function metricLabel(metricCode: string): string {
  return METRIC_LABELS[metricCode] ?? metricCode.replace(/_/g, " ");
}

function isTideMetric(metricCode: string): boolean {
  return metricCode === "tide_height" || metricCode.startsWith("tide_");
}

export function marineMetricDatumLabel(metricCode: string, verticalDatum: string): string {
  return verticalDatum || (isTideMetric(metricCode) ? "未提供" : "");
}

function formatValue(metric: MarineMetricView): string {
  if (metric.isMissing) return "缺值";
  if (!metric.isValid || metric.valueNumeric == null) return "無效";
  const digits = Math.abs(metric.valueNumeric) >= 100 ? 1 : 3;
  return metric.valueNumeric.toLocaleString("zh-TW", { maximumFractionDigits: digits });
}

function formatAge(seconds: number | null): string {
  if (seconds == null || seconds < 0) return "尚無有效觀測";
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分鐘`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(seconds < 10 * 3600 ? 1 : 0)} 小時`;
  return `${(seconds / 86400).toFixed(1)} 天`;
}

function qualitySummary(metric: MarineMetricView): string {
  if (metric.isMissing) return metric.missingReason ? `缺值：${metric.missingReason}` : "缺值";
  if (!metric.isValid) return metric.missingReason ? `無效：${metric.missingReason}` : "無效";
  const extra = Object.entries(metric.qualityFlags).flatMap(([key, value]) => {
    if (key === "valid" || key === "missing" || value === false || value == null || value === "") return [];
    return [value === true ? key : `${key}: ${String(value)}`];
  });
  return extra.length ? `有效 · ${extra.join(" · ")}` : "有效";
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
  const unit = metric.unitCanonical || metric.unitSource;
  const datumLabel = marineMetricDatumLabel(metric.metricCode, metric.verticalDatum);
  const statusColor = metric.isMissing || !metric.isValid ? "#f97316" : "#22c55e";
  return (
    <div style={{ marginTop: 7, padding: "7px 8px", borderRadius: RADIUS.md, background: t.bgSubtle, border: `1px solid ${selected ? accent : t.border}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ color: t.textStrong, fontSize: FONT_SIZE.base, fontWeight: 700 }}>{metricLabel(metric.metricCode)}</span>
        <span style={{ marginLeft: "auto", color: metric.isMissing || !metric.isValid ? statusColor : accent, fontSize: FONT_SIZE.lg, fontWeight: 700 }}>
          {formatValue(metric)}
        </span>
        {unit && !metric.isMissing && metric.isValid && <span style={{ color: t.textMuted, fontSize: FONT_SIZE.xs }}>{unit}</span>}
      </div>
      <div style={{ marginTop: 3, color: t.textDim, fontSize: FONT_SIZE.xs, lineHeight: 1.45 }}>
        <span>{metric.metricCode}</span>
        <span> · depth {metric.depthKey}</span>
        {datumLabel && <span> · datum {datumLabel}</span>}
        {metric.unitSource && metric.unitCanonical && metric.unitSource !== metric.unitCanonical && (
          <span> · 原始單位 {metric.unitSource}</span>
        )}
      </div>
      <div style={{ marginTop: 2, color: statusColor, fontSize: FONT_SIZE.xs }}>{qualitySummary(metric)}</div>
      {metric.observedAt && <div style={{ marginTop: 2, color: t.textDim, fontSize: FONT_SIZE.xs }}>觀測 {formatTaiwanTime(metric.observedAt).slice(0, 16)}</div>}
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
        {selected ? "已選取趨勢" : "查看 24h 趨勢"}
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
  const stationUid = field(props, "stationUid", "station_uid");
  const sourceNetwork = field(props, "sourceNetwork", "source_network").toLowerCase();
  const network = sourceNetwork === "isohe"
    ? NETWORK_META.isohe
    : sourceNetwork === "cwa"
      ? NETWORK_META.cwa
      : { label: sourceNetwork || "未知來源", description: "來源網路未標示", color: "#94a3b8", gapSec: undefined };
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
  const name = field(props, "nameZh", "name_zh") || field(props, "nameEn", "name_en") || sourceStationId || "海洋觀測站";
  const hasTideMetric = metrics.some((metric) => isTideMetric(metric.metricCode));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: network.color, flexShrink: 0 }} />
        <div style={{ color: t.textStrong, fontSize: FONT_SIZE.lg, fontWeight: 700, lineHeight: 1.25 }}>{name}</div>
        <span style={{ marginLeft: "auto", color: network.color, fontSize: FONT_SIZE.xs, fontWeight: 700 }}>{network.label}</span>
      </div>
      <Row label="測站代碼" value={sourceStationId || stationUid} color={t.textDim} />
      <Row label="來源網路" value={sourceNetwork || network.label.toLowerCase()} color={network.color} />
      <Row label="感測／管理" value={field(props, "originOrg", "origin_org")} />
      <Row label="資料分發" value={field(props, "distributionOrg", "distribution_org")} />
      <Row label="測站類型" value={field(props, "stationType", "station_type")} />
      <Row label="最新觀測" value={latestObservedAt ? formatTaiwanTime(latestObservedAt).slice(0, 16) : "尚無有效觀測"} />
      <Row label="資料年齡" value={formatAge(latestAgeSeconds)} />
      <Row label="Freshness" value={freshnessStatus || "未分類"} />
      <Row label="測站狀態" value={stationSourceStatus || "未標示"} />
      <Row label="觀測狀態" value={latestSourceStatus || "未標示"} />
      <div style={{ marginTop: 7, color: t.textDim, fontSize: FONT_SIZE.xs, lineHeight: 1.45 }}>{network.description}</div>

      <div style={{ marginTop: 10, color: t.textMuted, fontSize: FONT_SIZE.xs, letterSpacing: 0.6 }}>
        最新指標（{metrics.length}）
      </div>
      {metrics.length === 0 ? (
        <div style={{ marginTop: 6, color: t.textDim, fontSize: FONT_SIZE.sm }}>此站目前沒有 freshness 範圍內的有效讀值。</div>
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
          潮位 datum 保留原始定義；datum 未提供或不同的數值不可直接比較或合併。
        </div>
      )}

      {selection && (
        <div style={{ marginTop: 11, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: t.textMuted, fontSize: FONT_SIZE.xs }}>{metricLabel(selection.metricCode)}趨勢</span>
            <span style={{ color: t.textDim, fontSize: FONT_SIZE.xs }}>depth {selection.depthKey}</span>
            {marineMetricDatumLabel(selection.metricCode, selection.verticalDatum) && (
              <span style={{ color: "#f59e0b", fontSize: FONT_SIZE.xs }}>
                datum {marineMetricDatumLabel(selection.metricCode, selection.verticalDatum)}
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button type="button" onClick={() => setRange("24h")} style={rangeButton(range === "24h", network.color, t.border, t.textMuted)}>24h</button>
              <button type="button" onClick={() => setRange("7d")} style={rangeButton(range === "7d", network.color, t.border, t.textMuted)}>7 天</button>
            </div>
          </div>
          {history == null ? (
            <div style={{ padding: "10px 4px", textAlign: "center", color: t.textDim, fontSize: FONT_SIZE.sm }}>載入歷史觀測…</div>
          ) : historyError ? (
            <div style={{ padding: "10px 4px", color: "#f97316", fontSize: FONT_SIZE.sm }}>歷史觀測載入失敗，請稍後再試。</div>
          ) : historyView.datumConflict ? (
            <div style={{ padding: "10px 4px", color: "#f97316", fontSize: FONT_SIZE.sm }}>
              歷史資料含多個 vertical datum（{historyView.datums.join("、")}），為避免錯誤比較，本圖不合併繪製。
            </div>
          ) : historyView.points.length === 0 ? (
            <div style={{ padding: "10px 4px", color: t.textDim, fontSize: FONT_SIZE.sm }}>此時間窗沒有有效數值；missing／invalid 不補 0。</div>
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
              {historyView.excludedCount} 筆 missing／invalid／datum 不符資料未納入曲線，未轉成 0。
            </div>
          )}
        </div>
      )}
    </>
  );
}
