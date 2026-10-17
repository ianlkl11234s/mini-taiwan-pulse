import { useCallback, useMemo, useState } from "react";
import { FONT_CJK, FONT_DATA } from "../intelTokens";
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
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { fs } from "./monitorFont";
import { useMonitorTheme } from "./monitorTheme";
import { useMonitorFreshness } from "./monitorFreshness";
import { taipeiDateKeyFromMs } from "../../../lib/taipeiDay";
import { MonitorMetric, MonitorSub, MonitorNote } from "./MonitorMetric";
import { MF } from "./monitorFont";
import { useLocale, localeStore, type LocaleSnapshot } from "../../../state/localeStore";
import type { MessageKey } from "../../../i18n/keys";

/** 純函式用的語系參數：不傳＝目前語系（測試與非元件呼叫端） */
type IsrI18n = Pick<LocaleSnapshot, "t" | "formatDateTime">;

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

export const ISR_PASS_LEVEL_KEYS: Record<IsrPassLevel, MessageKey> = {
  0: "monitor.isr.level0", 1: "monitor.isr.level1", 2: "monitor.isr.level2", 3: "monitor.isr.level3", 4: "monitor.isr.level4",
};

const ISR_PASS_LEVELS = [0, 1, 2, 3, 4] as const satisfies readonly IsrPassLevel[];

/** 頭部只讀 latest_valid_day；全中國 census 不完整不會擋住 v1 scope 內計數。 */
export function deriveIsrLatestDisplay(
  report: IsrSatellitePassReport | null,
  state: LoadState,
): IsrLatestDisplay {
  const empty = { passCount: null, uniqueSatelliteCount: null, day: report?.latestValidDay ?? null };
  if (state === "loading" && !report) return { kind: "loading", ...empty };
  if (state === "error" && !report) return { kind: "error", ...empty };
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
  { t }: IsrI18n = localeStore.getSnapshot(),
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
          ? t("monitor.isr.barUniqueSats", { n: row.uniqueSatelliteCount })
          : t("monitor.isr.barCountOnly")
        : t("monitor.isr.barMissing"),
    };
  });
}

/**
 * v2 停更時：最新有效日之後到「今天（台灣）」每天補一根 null 灰柱（不是 0），總長不超過 windowDays。
 * 沒落後或沒有最新有效日就原樣回傳。
 */
export function padIsrBarsToToday(
  bars: HazardBar[],
  latestValidDay: string | null,
  todayKey: string,
  windowDays: number,
  { t }: IsrI18n = localeStore.getSnapshot(),
): HazardBar[] {
  if (!latestValidDay || bars.length === 0) return bars;
  const lastMs = Date.parse(`${latestValidDay}T00:00:00Z`);
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
  if (!Number.isFinite(lastMs) || !Number.isFinite(todayMs) || todayMs <= lastMs) return bars;
  const gapDays = Math.round((todayMs - lastMs) / 86_400_000);
  const tail: HazardBar[] = [];
  for (let i = 1; i <= Math.min(gapDays, windowDays); i++) {
    const day = new Date(lastMs + i * 86_400_000).toISOString().slice(0, 10);
    tail.push({
      label: `${day.slice(5, 7)}/${day.slice(8, 10)}`, key: day, value: null, level: 0,
      note: t("monitor.isr.padNote"),
    });
  }
  return [...bars, ...tail].slice(-windowDays);
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
  { t }: IsrI18n = localeStore.getSnapshot(),
): HazardBar[] {
  const sep = t("monitor.isr.noteSep");
  if (!thresholds) {
    return bars.map((bar) => bar.value === null
      ? bar
      : { ...bar, level: 1, note: [bar.note, t("monitor.isr.insufficient")].filter(Boolean).join(sep) });
  }
  return bars.map((bar) => {
    const level = classifyIsrPassLevel(bar.value, thresholds);
    if (level === null) return bar;
    return {
      ...bar,
      level,
      note: [
        bar.note,
        t("monitor.isr.barLevel", { level: t(ISR_PASS_LEVEL_KEYS[level]) }),
        t("monitor.isr.barDisclaim"),
      ]
        .filter(Boolean)
        .join(sep),
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

const DISPLAY_LABEL: Record<Exclude<IsrLatestDisplayKind, "ready">, MessageKey> = {
  loading: "monitor.isr.dispLoading",
  error: "monitor.isr.dispError",
  empty: "monitor.isr.dispEmpty",
  stale: "monitor.isr.dispStale",
  unknown_freshness: "monitor.isr.dispUnknownFreshness",
  incomplete: "monitor.isr.dispIncomplete",
};

const FRESHNESS_LABEL: Record<"fresh" | "stale" | "unknown", MessageKey> = {
  fresh: "monitor.isr.freshFresh", stale: "monitor.isr.freshStale", unknown: "monitor.isr.freshUnknown",
};

function formatTimestamp(value: string | null, i18n: IsrI18n): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return i18n.formatDateTime(parsed, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const MEDIAN_DIRECTION_LABEL: Record<Exclude<IsrMedianDirection, "unknown">, MessageKey> = {
  higher: "monitor.isr.medHigher",
  lower: "monitor.isr.medLower",
  equal: "monitor.isr.medEqual",
};

export function IsrSatellitePassCard({ open = true }: { open?: boolean }) {
  const theme = useMonitorTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const [windowDays, setWindowDays] = useState<IsrPassWindowDays>(
    ISR_PASSES_DEFAULT_WINDOW_DAYS,
  );
  const load = useCallback(
    () => fetchIsrSatellitePassesDaily(ISR_PASSES_FETCH_DAYS),
    [],
  );
  const query = useMonitorResource({
    open,
    queryKey: "isr-satellite-passes:daily",
    intervalMs: 30 * 60_000,
    emptyData: null as IsrSatellitePassReport | null,
    load,
  });
  const report = query.data;
  const state: LoadState = query.status === "ready" ? "ready"
    : query.status === "error" || query.status === "denied" ? "error" : "loading";

  const v2 = useMonitorV2();
  // v2：loader 自算的 stale／unknown 不再擋主數字（改由 fresh 降灰＋卡底原因）；incomplete 等其餘判斷照舊。舊版維持原判斷
  const latest = deriveIsrLatestDisplay(
    v2 && report && report.latestValidDay && report.freshness !== "fresh" ? { ...report, freshness: "fresh" } : report,
    state,
  );
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
      i18n,
    ),
    [report?.latestValidDay, report?.scopeCoverageComplete, windowRows, i18n],
  );
  const thresholds = useMemo(
    () => deriveIsrPassThresholds(baseBars.map((bar) => bar.value)),
    [baseBars],
  );
  const bars = useMemo(
    () => applyIsrPassLevels(baseBars, thresholds, i18n),
    [baseBars, thresholds, i18n],
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
    ? theme.p.textFaint
    : ISR_PASS_LEVEL_COLORS[latestLevel];
  const lvFill = theme.fill(latestLevelColor);
  const lvText = theme.text(latestLevelColor);

  // 資料時間＝最新有效日（只有日期）；沒有就是「無資料」，不退回計算時間。新鮮度（日批次，>2 天過期、>7 天停更）由 fresh 判斷
  const latestDayText = report?.latestValidDay ? `${report.latestValidDay.slice(5, 7)}/${report.latestValidDay.slice(8, 10)}` : null;
  const latestDayMs = report?.latestValidDay ? Date.parse(`${report.latestValidDay}T00:00:00+08:00`) : NaN;
  const fresh = useMonitorFreshness("isrSatellitePasses", {
    timeText: latestDayText,
    dataMs: Number.isFinite(latestDayMs) ? latestDayMs : null,
  });
  const barsV2 = useMemo(
    () => (fresh.staleUntil != null
      ? padIsrBarsToToday(bars, report?.latestValidDay ?? null, taipeiDateKeyFromMs(Date.now()), windowDays, i18n)
      : bars),
    [bars, fresh.staleUntil, report?.latestValidDay, windowDays, i18n],
  );

  if (v2) {
    const coverageWarn = report?.scopeCoverageComplete === false || report?.coverageComplete === false || report?.chinaIsrCensusComplete === false;
    const levelThresholdText = (level: IsrPassLevel): string => {
      if (!thresholds) return "";
      const t = thresholds;
      return level === 0 ? `≤${formatMetric(t.p25)}`
        : level === 1 ? `>${formatMetric(t.p25)}–${formatMetric(t.p50)}`
        : level === 2 ? `>${formatMetric(t.p50)}–${formatMetric(t.p75)}`
        : level === 3 ? `>${formatMetric(t.p75)}–${formatMetric(t.p90)}`
        : `>${formatMetric(t.p90)}`;
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: FONT_CJK }}>
        <MonitorDataStatus label={t("monitor.isr.dataStatus")} query={query} />
        {latestLevel !== null && !fresh.muted && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <span
              title={t("monitor.isr.levelTip")}
              style={{
                fontSize: MF.label, padding: "1px 8px", borderRadius: RADIUS.pill, whiteSpace: "nowrap",
                color: lvText, background: `${lvFill}18`, border: `1px solid ${lvFill}66`,
              }}
            >
              {latestLevel === 4 ? "⚠ " : ""}{t("monitor.isr.latestLevel", { level: t(ISR_PASS_LEVEL_KEYS[latestLevel]) })}
            </span>
          </div>
        )}
        {latest.kind === "ready" ? (
          <MonitorMetric
            value={latest.passCount}
            unit={t("monitor.isr.passUnit")}
            color={latestLevel === null ? undefined : latestLevelColor}
            delta={t("monitor.isr.satellites", { n: latest.uniqueSatelliteCount ?? "—" })}
            muted={fresh.muted}
          />
        ) : (
          <MonitorNote tone={latest.kind === "error" || latest.kind === "stale" ? "warn" : "neutral"}>
            {latest.kind === "stale" ? t("monitor.isr.dispStaleLatest") : t(DISPLAY_LABEL[latest.kind])}
          </MonitorNote>
        )}
        {fresh.reason && <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>}
        <div role="group" aria-label={t("monitor.isr.windowAria")} style={{ display: "flex", gap: 4 }}>
          {ISR_PASSES_WINDOW_OPTIONS.map((option) => {
            const selected = option === windowDays;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setWindowDays(option)}
                aria-pressed={selected}
                title={t("monitor.isr.windowTip", { n: option })}
                style={{
                  fontSize: MF.label, padding: "2px 8px", borderRadius: RADIUS.sm, cursor: "pointer", fontFamily: FONT_DATA,
                  background: selected ? theme.p.accentFaint : "transparent",
                  color: selected ? theme.p.textStrong : theme.p.textDim,
                  border: `1px solid ${selected ? theme.p.borderStrong : theme.p.borderSoft}`,
                }}
              >
                {option}D
              </button>
            );
          })}
        </div>
        <MonitorSub
          items={[
            t("monitor.isr.medianLine", { w: windowDays, median: formatMetric(medianPassCount) }),
            medianComparison.direction === "unknown"
              ? t("monitor.isr.cmpNone")
              : t("monitor.isr.cmpLine", { dir: t(MEDIAN_DIRECTION_LABEL[medianComparison.direction]), diff: formatMetric(medianComparison.difference) }),
            t("monitor.isr.shownDays", { shown: countedBars.length, win: windowDays }),
            !thresholds && countedBars.length > 0 ? t("monitor.isr.insufficientV2", { min: ISR_PASS_MIN_DISTRIBUTION_DAYS }) : null,
          ]}
        />
        {latest.kind === "ready" && latestLevel === 4 && thresholds && (
          <MonitorNote tone="warn">
            {t("monitor.isr.p90Warn", { w: windowDays, p90: formatMetric(thresholds.p90) })}
          </MonitorNote>
        )}
        {barsV2.length > 0 && (
          <HazardTrendBars
            bars={barsV2}
            levelColors={[...ISR_PASS_LEVEL_COLORS]}
            heightTier="std"
            unit={t("monitor.isr.unitTimes")}
            caption={t("monitor.isr.capV2", { w: windowDays })}
            footer={peak === null ? undefined : t("monitor.isr.peak", { n: peak })}
          />
        )}
        {thresholds && (
          <div
            aria-label={t("monitor.isr.legendAria")}
            style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: MF.label, color: theme.p.textDim }}
          >
            {ISR_PASS_LEVELS.map((level) => (
              <span key={level} title={levelThresholdText(level)} style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: theme.fill(ISR_PASS_LEVEL_COLORS[level]) }} />
                {t(ISR_PASS_LEVEL_KEYS[level])}
              </span>
            ))}
          </div>
        )}
        <MonitorNote>
          {t("monitor.isr.dataNoteV2", { day: report?.latestValidDay ?? "—", time: formatTimestamp(report?.computedAt ?? null, i18n) })}
          {coverageWarn ? t("monitor.isr.coverWarn") : ""}
        </MonitorNote>
        <MonitorNote>{t("monitor.isr.noteGround")}</MonitorNote>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: FONT_CJK }}>
      <MonitorDataStatus label={t("monitor.isr.dataStatus")} query={query} />
      {!v2 && <SectionLabel color="#a78bfa">{t("monitor.isr.legacyHeader")}</SectionLabel>}
      <div
        style={{
          ...(v2 ? {} : {
            borderRadius: RADIUS.xl,
            border: `1px solid ${theme.p.panelBorder}`,
            background: theme.neutral(0.02),
            padding: "11px 13px",
          }),
          display: "flex", flexDirection: "column", gap: 9,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
          {latest.kind === "ready" ? (
            <>
              <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 28), fontWeight: 700, lineHeight: 1, color: theme.isDark ? "#fff" : theme.p.textStrong }}>
                {latest.passCount}
              </span>
              <span style={{ fontSize: fs(v2, FONT_SIZE.base), color: theme.p.textMuted }}>{t("monitor.isr.passUnit")}</span>
              <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textDim }}>
                {t("monitor.isr.uniqSats", { day: latest.day ?? "—", n: latest.uniqueSatelliteCount ?? "—" })}
              </span>
            </>
          ) : (
            <span style={{ fontSize: fs(v2, FONT_SIZE.base), color: latest.kind === "error" || latest.kind === "stale" ? theme.p.statusWarn : theme.p.textDim }}>
              {v2 && latest.kind === "stale" ? t("monitor.isr.dispStaleLatest") : t(DISPLAY_LABEL[latest.kind])}
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label={t("monitor.isr.windowAria")}
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
                title={v2 ? t("monitor.isr.windowTip", { n: option }) : t("monitor.isr.windowTipLegacy", { n: option })}
                style={{
                  fontSize: fs(v2, 9),
                  padding: "2px 7px",
                  borderRadius: RADIUS.sm,
                  cursor: "pointer",
                  fontFamily: FONT_DATA,
                  background: selected ? theme.p.accentFaint : "transparent",
                  color: selected ? theme.p.textStrong : theme.p.textDim,
                  border: `1px solid ${selected ? theme.p.borderStrong : theme.p.borderSoft}`,
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
            fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: theme.p.textDim,
          }}
        >
          <span>{t("monitor.isr.medianLegacy", { w: windowDays, median: formatMetric(medianPassCount) })}</span>
          <span>{t("monitor.isr.shownLegacy", { shown: countedBars.length, win: windowDays })}</span>
          <span style={{ color: lvText }}>
            {medianComparison.direction === "unknown"
              ? t("monitor.isr.cmpNone")
              : t("monitor.isr.cmpLegacy", { dir: t(MEDIAN_DIRECTION_LABEL[medianComparison.direction]), diff: formatMetric(medianComparison.difference) })}
          </span>
          {latestLevel !== null && (
            <span
              title={t("monitor.isr.levelTip")}
              style={{
                padding: "1px 6px", borderRadius: RADIUS.pill,
                color: lvText, background: `${lvFill}18`,
                border: `1px solid ${lvFill}66`,
              }}
            >
              {latestLevel === 4 ? "⚠ " : ""}{t("monitor.isr.latestLevel", { level: t(ISR_PASS_LEVEL_KEYS[latestLevel]) })}
            </span>
          )}
          {!thresholds && countedBars.length > 0 && (
            <span style={{ color: theme.p.textFaint }}>
              {t("monitor.isr.insufficientLegacy", { min: ISR_PASS_MIN_DISTRIBUTION_DAYS })}
            </span>
          )}
        </div>

        {latest.kind === "ready" && latestLevel === 4 && thresholds && (
          <div
            role="status"
            style={{
              padding: "5px 7px", borderRadius: RADIUS.md,
              color: lvText, background: `${lvFill}12`,
              border: `1px solid ${lvFill}55`,
              fontSize: fs(v2, 9), lineHeight: 1.5,
            }}
          >
            {t("monitor.isr.legacyAlert", { count: latest.passCount ?? "—", w: windowDays, p90: formatMetric(thresholds.p90) })}
          </div>
        )}

        {bars.length > 0 && (
          <HazardTrendBars
            bars={bars}
            levelColors={[...ISR_PASS_LEVEL_COLORS]}
            height={74}
            unit={t("monitor.isr.unitTimes")}
            caption={t("monitor.isr.capLegacy", { w: windowDays })}
            footer={`${t("monitor.isr.footLegacy", { shown: countedBars.length, win: windowDays })}${peak === null ? "" : t("monitor.isr.footLegacyPeak", { n: peak })}`}
          />
        )}

        {thresholds && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div
              aria-label={t("monitor.isr.legendAria")}
              style={{
                display: "flex", flexWrap: "wrap", gap: "3px 9px",
                fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), color: theme.p.textDim,
              }}
            >
              {ISR_PASS_LEVELS.map((level) => (
                <span key={level} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.fill(ISR_PASS_LEVEL_COLORS[level]) }} />
                  {t(ISR_PASS_LEVEL_KEYS[level])}
                  {level === 0 && ` ≤${formatMetric(thresholds.p25)}`}
                  {level === 1 && ` >${formatMetric(thresholds.p25)}–${formatMetric(thresholds.p50)}`}
                  {level === 2 && ` >${formatMetric(thresholds.p50)}–${formatMetric(thresholds.p75)}`}
                  {level === 3 && ` >${formatMetric(thresholds.p75)}–${formatMetric(thresholds.p90)}`}
                  {level === 4 && ` >${formatMetric(thresholds.p90)}`}
                </span>
              ))}
            </div>
            <div style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), color: theme.p.textFaint }}>
              {t("monitor.isr.thresholdNote")}
            </div>
          </div>
        )}

        {v2 ? (
          <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint, lineHeight: 1.5 }}>
            {t("monitor.isr.dataNoteLegacy", { day: report?.latestValidDay ?? "—", time: formatTimestamp(report?.computedAt ?? null, i18n) })}
            {(report?.scopeCoverageComplete === false || report?.coverageComplete === false || report?.chinaIsrCensusComplete === false)
              ? t("monitor.isr.coverWarn") : ""}
          </div>
        ) : (
        <div
          style={{
            display: "grid", gridTemplateColumns: v2 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
            overflowWrap: v2 ? "anywhere" : undefined,
            gap: "3px 10px", fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: theme.p.textFaint,
          }}
        >
          <span>latest_valid_day: {report?.latestValidDay ?? "—"}</span>
          <span>computed_at: {formatTimestamp(report?.computedAt ?? null, i18n)}</span>
          <span>scope_coverage: {report?.scopeCoverageComplete === true ? t("monitor.isr.scopeComplete") : report?.scopeCoverageComplete === false ? t("monitor.isr.scopeIncomplete") : t("monitor.isr.unknown")}</span>
          <span>china_isr_census: {report?.chinaIsrCensusComplete === true ? t("monitor.isr.complete") : report?.chinaIsrCensusComplete === false ? t("monitor.isr.notComplete") : t("monitor.isr.unknown")}</span>
          <span>coverage_complete: {report?.coverageComplete === true ? t("monitor.isr.complete") : report?.coverageComplete === false ? t("monitor.isr.partial") : t("monitor.isr.unknown")}</span>
          <span>freshness: {t(FRESHNESS_LABEL[report?.freshness ?? "unknown"])}</span>
          <span>registry_reviewed: {formatTimestamp(report?.registryReviewedAt ?? null, i18n)}</span>
        </div>
        )}

        <div style={{ fontSize: fs(v2, 9), color: theme.p.statusWarn, lineHeight: 1.5 }}>
          {t("monitor.isr.scopeWarn")}
        </div>
        <div style={{ fontSize: fs(v2, 9), color: theme.p.textFaint, lineHeight: 1.5 }}>
          {v2 ? "" : `${ISR_PASSES_DEFAULT_REGION} · ${ISR_PASSES_DEFAULT_TIER_MODE} · `}{t("monitor.isr.legacyFoot")}
        </div>
      </div>
    </div>
  );
}

export default IsrSatellitePassCard;
