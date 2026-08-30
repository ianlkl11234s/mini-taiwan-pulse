import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { FONT_SIZE, RADIUS } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { HazardTrendBars, type HazardBar } from "./HazardTrendBars";
import {
  fetchIsrSatellitePassesDaily,
  ISR_PASSES_DEFAULT_WINDOW_DAYS,
  ISR_PASSES_DEFAULT_REGION,
  ISR_PASSES_DEFAULT_TIER_MODE,
  ISR_PASSES_FETCH_DAYS,
  ISR_PASSES_WINDOW_OPTIONS,
  type IsrPassWindowDays,
  type IsrSatellitePassReport,
} from "../../../data/isrSatellitePassesLoader";

export type LoadState = "loading" | "ready" | "error";

export type IsrLatestDisplayKind =
  | "loading"
  | "error"
  | "empty"
  | "stale"
  | "unknown_freshness"
  | "incomplete"
  | "ready";

export interface IsrLatestDisplay {
  kind: IsrLatestDisplayKind;
  passCount: number | null;
  uniqueSatelliteCount: number | null;
  day: string | null;
}

export type IsrMedianDirection = "higher" | "lower" | "equal" | "unknown";

export interface IsrMedianComparison {
  direction: IsrMedianDirection;
  difference: number | null;
}

export type IsrPassLevel = 0 | 1 | 2 | 3 | 4;

export interface IsrPassThresholds {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export const ISR_PASS_MIN_DISTRIBUTION_DAYS = 8;

export const ISR_PASS_LEVEL_COLORS = [
  "#34d399", "#94a3b8", "#fbbf24", "#fb923c", "#ef4444",
] as const;

export const ISR_PASS_LEVEL_LABELS: Record<IsrPassLevel, string> = {
  0: "基準低段", 1: "基準中段", 2: "相對偏多", 3: "相對高量", 4: "相對高峰",
};

const ISR_PASS_LEVELS = [0, 1, 2, 3, 4] as const satisfies readonly IsrPassLevel[];

/** 頭部只讀 latest_valid_day；全中國 census 不完整不會擋住 v1 scope 內計數。 */
export function deriveIsrLatestDisplay(
  report: IsrSatellitePassReport | null,
  state: LoadState,
): IsrLatestDisplay {
  const empty = { passCount: null, uniqueSatelliteCount: null, day: report?.latestValidDay ?? null };
  if (state === "loading" && !report) return { kind: "loading", ...empty };
  if (state === "error") return { kind: "error", ...empty };
  if (!report || !report.rows.length) return { kind: "empty", ...empty };
  if (report.freshness === "stale") return { kind: "stale", ...empty };
  if (report.freshness === "unknown") return { kind: "unknown_freshness", ...empty };
  const latest = report.rows.find((row) => row.day === report.latestValidDay);
  if (!latest || latest.passCount === null || latest.uniqueSatelliteCount === null) {
    return { kind: "incomplete", ...empty };
  }
  if (latest.passCount === 0 && report.scopeCoverageComplete !== true) {
    return { kind: "incomplete", ...empty };
  }
  return {
    kind: "ready",
    passCount: latest.passCount,
    uniqueSatelliteCount: latest.uniqueSatelliteCount,
    day: latest.day,
  };
}

export function buildIsrPassBars(
  rows: IsrSatellitePassReport["rows"],
  scopeCoverageComplete: boolean | null,
  latestValidDay: string | null,
): HazardBar[] {
  if (!latestValidDay) return [];
  return rows.filter((row) => row.day <= latestValidDay).map((row) => {
    const countIsDisplayable = row.passCount !== null
      && (row.passCount !== 0 || scopeCoverageComplete === true);
    return {
      label: `${row.day.slice(5, 7)}/${row.day.slice(8, 10)}`,
      key: row.day,
      value: countIsDisplayable ? row.passCount : null,
      level: 0,
      note: countIsDisplayable
        ? row.uniqueSatelliteCount !== null
          ? `不重複衛星 ${row.uniqueSatelliteCount} 顆`
          : "過境次數可呈現；不重複衛星數缺失"
        : "過境計數缺失或 scope 不完整，非 0",
    };
  });
}

/**
 * 以 latest_valid_day 為日曆窗終點，而不是取最後 N 筆；缺日不合成列。
 */
export function selectIsrPassWindow(
  rows: IsrSatellitePassReport["rows"],
  latestValidDay: string | null,
  windowDays: IsrPassWindowDays,
): IsrSatellitePassReport["rows"] {
  if (!latestValidDay) return [];
  const anchorMs = Date.parse(`${latestValidDay}T00:00:00Z`);
  if (!Number.isFinite(anchorMs)) return [];
  const firstDay = new Date(anchorMs - (windowDays - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return rows.filter((row) => row.day >= firstDay && row.day <= latestValidDay);
}

/** null 不納入；0 是合法觀測值；偶數筆取兩個中央值平均。 */
export function medianOfIsrPassCounts(values: ReadonlyArray<number | null>): number | null {
  return quantileOfIsrPassCounts(values, 0.5);
}

/** Type-7 線性插值分位數；null 排除，合法 0 保留。 */
export function quantileOfIsrPassCounts(
  values: ReadonlyArray<number | null>,
  quantile: number,
): number | null {
  if (!Number.isFinite(quantile)) return null;
  const valid = values
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (!valid.length) return null;
  const position = Math.min(1, Math.max(0, quantile)) * (valid.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return valid[lower]! + (valid[upper]! - valid[lower]!) * weight;
}

export function deriveIsrPassThresholds(
  values: ReadonlyArray<number | null>,
): IsrPassThresholds | null {
  if (values.filter((value) => value !== null).length < ISR_PASS_MIN_DISTRIBUTION_DAYS) {
    return null;
  }
  const p25 = quantileOfIsrPassCounts(values, 0.25);
  const p50 = quantileOfIsrPassCounts(values, 0.5);
  const p75 = quantileOfIsrPassCounts(values, 0.75);
  const p90 = quantileOfIsrPassCounts(values, 0.9);
  return p25 === null || p50 === null || p75 === null || p90 === null
    ? null
    : { p25, p50, p75, p90 };
}

/** 色階只表達所選期間內的相對量，不是威脅或實際蒐情分級。 */
export function classifyIsrPassLevel(
  value: number | null,
  thresholds: IsrPassThresholds | null,
): IsrPassLevel | null {
  if (value === null || !thresholds) return null;
  if (value <= thresholds.p25) return 0;
  if (value <= thresholds.p50) return 1;
  if (value <= thresholds.p75) return 2;
  if (value <= thresholds.p90) return 3;
  return 4;
}

export function applyIsrPassLevels(
  bars: HazardBar[],
  thresholds: IsrPassThresholds | null,
): HazardBar[] {
  if (!thresholds) {
    return bars.map((bar) => bar.value === null
      ? bar
      : { ...bar, level: 1, note: [bar.note, "樣本不足，暫不做相對分級"].filter(Boolean).join("｜") });
  }
  return bars.map((bar) => {
    const level = classifyIsrPassLevel(bar.value, thresholds);
    if (level === null) return bar;
    return {
      ...bar,
      level,
      note: [
        bar.note,
        `本區間相對位階：${ISR_PASS_LEVEL_LABELS[level]}`,
        "公開軌道推算，非威脅或實際蒐情判定",
      ]
        .filter(Boolean)
        .join("｜"),
    };
  });
}

export function compareLatestToMedian(
  latest: number | null,
  median: number | null,
): IsrMedianComparison {
  if (latest === null || median === null) return { direction: "unknown", difference: null };
  if (latest === median) return { direction: "equal", difference: 0 };
  return {
    direction: latest > median ? "higher" : "lower",
    difference: Math.abs(latest - median),
  };
}

const DISPLAY_LABEL: Record<Exclude<IsrLatestDisplayKind, "ready">, string> = {
  loading: "資料載入中…",
  error: "更新失敗 · 不以 0 代替",
  empty: "尚無可用日資料 · 不以 0 代替",
  stale: "資料過期 · 不以 0 代替",
  unknown_freshness: "新鮮度未知 · 不以 0 代替",
  incomplete: "最近日計數或 v1 scope 完整度不足 · 不以 0 代替",
};

const FRESHNESS_LABEL = { fresh: "新鮮", stale: "過期", unknown: "未知" } as const;

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const MEDIAN_DIRECTION_LABEL: Record<Exclude<IsrMedianDirection, "unknown">, string> = {
  higher: "↑ 高於中位數",
  lower: "↓ 低於中位數",
  equal: "＝ 等於中位數",
};

export function IsrSatellitePassCard({ open = true }: { open?: boolean }) {
  const [report, setReport] = useState<IsrSatellitePassReport | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [windowDays, setWindowDays] = useState<IsrPassWindowDays>(
    ISR_PASSES_DEFAULT_WINDOW_DAYS,
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      setState((current) => (current === "ready" ? current : "loading"));
      fetchIsrSatellitePassesDaily(ISR_PASSES_FETCH_DAYS)
        .then((next) => {
          if (cancelled) return;
          setReport(next);
          setState("ready");
        })
        .catch((error) => {
          if (cancelled) return;
          console.warn("[IsrSatellitePassCard] daily", error);
          setState("error");
        });
    };
    tick();
    const id = window.setInterval(tick, 30 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  const latest = deriveIsrLatestDisplay(report, state);
  const windowRows = useMemo(
    () => selectIsrPassWindow(
      report?.rows ?? [],
      report?.latestValidDay ?? null,
      windowDays,
    ),
    [report, windowDays],
  );
  const baseBars = useMemo(
    () => buildIsrPassBars(
      windowRows,
      report?.scopeCoverageComplete ?? null,
      report?.latestValidDay ?? null,
    ),
    [report?.latestValidDay, report?.scopeCoverageComplete, windowRows],
  );
  const thresholds = useMemo(
    () => deriveIsrPassThresholds(baseBars.map((bar) => bar.value)),
    [baseBars],
  );
  const bars = useMemo(
    () => applyIsrPassLevels(baseBars, thresholds),
    [baseBars, thresholds],
  );
  const countedBars = useMemo(
    () => bars.filter((bar): bar is HazardBar & { value: number } => bar.value !== null),
    [bars],
  );
  const peak = countedBars.length ? Math.max(...countedBars.map((bar) => bar.value)) : null;
  const medianPassCount = medianOfIsrPassCounts(baseBars.map((bar) => bar.value));
  const medianComparison = compareLatestToMedian(
    latest.kind === "ready" ? latest.passCount : null,
    medianPassCount,
  );
  const latestLevel = classifyIsrPassLevel(
    latest.kind === "ready" ? latest.passCount : null,
    thresholds,
  );
  const latestLevelColor = latestLevel === null
    ? COLORS.textFaint
    : ISR_PASS_LEVEL_COLORS[latestLevel];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: FONT_CJK }}>
      <SectionLabel color="#a78bfa">中國 ISR 衛星 · TERRITORIAL PASS MONITOR</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "rgba(255,255,255,0.02)",
          padding: "11px 13px",
          display: "flex", flexDirection: "column", gap: 9,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
          {latest.kind === "ready" ? (
            <>
              <span style={{ fontFamily: FONT_DATA, fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#fff" }}>
                {latest.passCount}
              </span>
              <span style={{ fontSize: FONT_SIZE.base, color: COLORS.textMuted }}>次過境</span>
              <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
                {latest.day} · {latest.uniqueSatelliteCount} 顆不重複衛星
              </span>
            </>
          ) : (
            <span style={{ fontSize: FONT_SIZE.base, color: latest.kind === "error" || latest.kind === "stale" ? COLORS.statusWarn : COLORS.textDim }}>
              {DISPLAY_LABEL[latest.kind]}
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label="過境統計期間"
          style={{ display: "flex", gap: 4 }}
        >
          {ISR_PASSES_WINDOW_OPTIONS.map((option) => {
            const selected = option === windowDays;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setWindowDays(option)}
                aria-pressed={selected}
                title={`顯示 latest_valid_day 往前 ${option} 個日曆日`}
                style={{
                  fontSize: 9,
                  padding: "2px 7px",
                  borderRadius: RADIUS.sm,
                  cursor: "pointer",
                  fontFamily: FONT_DATA,
                  background: selected ? COLORS.accentFaint : "transparent",
                  color: selected ? COLORS.textStrong : COLORS.textDim,
                  border: `1px solid ${selected ? COLORS.borderStrong : COLORS.borderSoft}`,
                }}
              >
                {option}D
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex", alignItems: "center", gap: "4px 10px", flexWrap: "wrap",
            fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textDim,
          }}
        >
          <span>{windowDays}D 中位數 {formatMetric(medianPassCount)} 次／日</span>
          <span>可呈現日 {countedBars.length}/{windowDays} · 缺日不補 0</span>
          <span style={{ color: latestLevelColor }}>
            {medianComparison.direction === "unknown"
              ? "最新日比較 —"
              : `最新 ${MEDIAN_DIRECTION_LABEL[medianComparison.direction]} · 差 ${formatMetric(medianComparison.difference)} 次`}
          </span>
          {latestLevel !== null && (
            <span
              title="依所選期間 p25／p50／p75／p90 分布判定；不是威脅或實際蒐情分級"
              style={{
                padding: "1px 6px", borderRadius: RADIUS.pill,
                color: latestLevelColor, background: `${latestLevelColor}18`,
                border: `1px solid ${latestLevelColor}66`,
              }}
            >
              {latestLevel === 4 ? "⚠ " : ""}最新相對{ISR_PASS_LEVEL_LABELS[latestLevel]}
            </span>
          )}
          {!thresholds && countedBars.length > 0 && (
            <span style={{ color: COLORS.textFaint }}>
              樣本不足（至少 {ISR_PASS_MIN_DISTRIBUTION_DAYS} 個可呈現日），暫不分級
            </span>
          )}
        </div>

        {latest.kind === "ready" && latestLevel === 4 && thresholds && (
          <div
            role="status"
            style={{
              padding: "5px 7px", borderRadius: RADIUS.md,
              color: latestLevelColor, background: `${latestLevelColor}12`,
              border: `1px solid ${latestLevelColor}55`,
              fontSize: 9, lineHeight: 1.5,
            }}
          >
            ⚠ 相對量提醒：最新完整日 {latest.passCount} 次，高於所選 {windowDays}D 的
            p90（{formatMetric(thresholds.p90)}）門檻。
            僅為公開軌道推算的過境量比較，不代表威脅、任務執行或實際蒐情。
          </div>
        )}

        {bars.length > 0 && (
          <HazardTrendBars
            bars={bars}
            levelColors={[...ISR_PASS_LEVEL_COLORS]}
            height={74}
            unit="次"
            caption={`${windowDays}D · 過境事件（柱高）／本區間相對位階（色）`}
            footer={`可呈現日 ${countedBars.length}/${windowDays} · 缺日不補 0${peak === null ? "" : ` · 單日最高 ${peak} 次`}`}
          />
        )}

        {thresholds && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div
              aria-label="ISR 相對過境量色階"
              style={{
                display: "flex", flexWrap: "wrap", gap: "3px 9px",
                fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textDim,
              }}
            >
              {ISR_PASS_LEVELS.map((level) => (
                <span key={level} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: ISR_PASS_LEVEL_COLORS[level] }} />
                  {ISR_PASS_LEVEL_LABELS[level]}
                  {level === 0 && ` ≤${formatMetric(thresholds.p25)}`}
                  {level === 1 && ` >${formatMetric(thresholds.p25)}–${formatMetric(thresholds.p50)}`}
                  {level === 2 && ` >${formatMetric(thresholds.p50)}–${formatMetric(thresholds.p75)}`}
                  {level === 3 && ` >${formatMetric(thresholds.p75)}–${formatMetric(thresholds.p90)}`}
                  {level === 4 && ` >${formatMetric(thresholds.p90)}`}
                </span>
              ))}
            </div>
            <div style={{ fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textFaint }}>
              門檻隨所選期間重算；色階非威脅或實際蒐情判定
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "3px 10px", fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint,
          }}
        >
          <span>latest_valid_day: {report?.latestValidDay ?? "—"}</span>
          <span>computed_at: {formatTimestamp(report?.computedAt ?? null)}</span>
          <span>scope_coverage: {report?.scopeCoverageComplete === true ? "v1 完整" : report?.scopeCoverageComplete === false ? "v1 未完整" : "未知"}</span>
          <span>china_isr_census: {report?.chinaIsrCensusComplete === true ? "完整" : report?.chinaIsrCensusComplete === false ? "非完整" : "未知"}</span>
          <span>coverage_complete: {report?.coverageComplete === true ? "完整" : report?.coverageComplete === false ? "partial" : "未知"}</span>
          <span>freshness: {FRESHNESS_LABEL[report?.freshness ?? "unknown"]}</span>
          <span>registry_reviewed: {formatTimestamp(report?.registryReviewedAt ?? null)}</span>
        </div>

        <div style={{ fontSize: 9, color: COLORS.statusWarn, lineHeight: 1.5 }}>
          v1 YAOGAN／GAOFEN／JILIN 範圍，非全中國 ISR census
        </div>
        <div style={{ fontSize: 9, color: COLORS.textFaint, lineHeight: 1.5 }}>
          {ISR_PASSES_DEFAULT_REGION} · {ISR_PASSES_DEFAULT_TIER_MODE} · 地面投影穿越不等於實際蒐情；
          缺日與 null 不補 0
        </div>
      </div>
    </div>
  );
}

export default IsrSatellitePassCard;
