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
  const valid = values
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (!valid.length) return null;
  const midpoint = Math.floor(valid.length / 2);
  return valid.length % 2 === 1
    ? valid[midpoint]!
    : (valid[midpoint - 1]! + valid[midpoint]!) / 2;
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

const MEDIAN_DIRECTION_COLOR: Record<IsrMedianDirection, string> = {
  higher: "#c4b5fd",
  lower: "#93c5fd",
  equal: COLORS.textMuted,
  unknown: COLORS.textFaint,
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
  const bars = useMemo(
    () => buildIsrPassBars(
      windowRows,
      report?.scopeCoverageComplete ?? null,
      report?.latestValidDay ?? null,
    ),
    [report?.latestValidDay, report?.scopeCoverageComplete, windowRows],
  );
  const countedBars = useMemo(
    () => bars.filter((bar): bar is HazardBar & { value: number } => bar.value !== null),
    [bars],
  );
  const peak = countedBars.length ? Math.max(...countedBars.map((bar) => bar.value)) : null;
  const medianPassCount = useMemo(
    () => medianOfIsrPassCounts(bars.map((bar) => bar.value)),
    [bars],
  );
  const medianComparison = compareLatestToMedian(
    latest.kind === "ready" ? latest.passCount : null,
    medianPassCount,
  );

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
          <span style={{ color: MEDIAN_DIRECTION_COLOR[medianComparison.direction] }}>
            {medianComparison.direction === "unknown"
              ? "最新日比較 —"
              : `最新 ${MEDIAN_DIRECTION_LABEL[medianComparison.direction]} · 差 ${formatMetric(medianComparison.difference)} 次`}
          </span>
        </div>

        {bars.length > 0 && (
          <HazardTrendBars
            bars={bars}
            levelColors={["#8b5cf6"]}
            height={74}
            unit="次"
            caption={`${windowDays}D · 過境事件（柱）／不重複衛星（tooltip）`}
            footer={`可呈現日 ${countedBars.length}/${windowDays} · 缺日不補 0${peak === null ? "" : ` · 單日最高 ${peak} 次`}`}
          />
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
