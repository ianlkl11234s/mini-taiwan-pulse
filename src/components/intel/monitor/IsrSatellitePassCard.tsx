import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { FONT_SIZE, RADIUS } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { HazardTrendBars, type HazardBar } from "./HazardTrendBars";
import {
  fetchIsrSatellitePassesDaily,
  ISR_PASSES_DEFAULT_DAYS,
  ISR_PASSES_DEFAULT_REGION,
  ISR_PASSES_DEFAULT_TIER_MODE,
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
  return rows.filter((row) => row.day <= latestValidDay).map((row) => ({
    label: `${row.day.slice(5, 7)}/${row.day.slice(8, 10)}`,
    key: row.day,
    value: row.passCount !== null && (row.passCount !== 0 || scopeCoverageComplete === true)
      ? row.passCount
      : null,
    level: 0,
    note: row.passCount !== null && row.uniqueSatelliteCount !== null
      ? `不重複衛星 ${row.uniqueSatelliteCount} 顆`
      : "計數缺失，非 0",
  }));
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

export function IsrSatellitePassCard({ open = true }: { open?: boolean }) {
  const [report, setReport] = useState<IsrSatellitePassReport | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      setState((current) => (current === "ready" ? current : "loading"));
      fetchIsrSatellitePassesDaily()
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
  const bars = useMemo(
    () => buildIsrPassBars(
      report?.rows ?? [],
      report?.scopeCoverageComplete ?? null,
      report?.latestValidDay ?? null,
    ),
    [report],
  );
  const countedBars = useMemo(
    () => bars.filter((bar): bar is HazardBar & { value: number } => bar.value !== null),
    [bars],
  );
  const peak = countedBars.length ? Math.max(...countedBars.map((bar) => bar.value)) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: FONT_CJK }}>
      <SectionLabel color="#a78bfa">中國 ISR 衛星 · TERRITORIAL PASS MONITOR</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(139,92,246,0.08), rgba(255,255,255,0.012))",
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

        {bars.length > 0 && (
          <HazardTrendBars
            bars={bars}
            levelColors={["#8b5cf6"]}
            height={74}
            unit="次"
            caption={`${ISR_PASSES_DEFAULT_DAYS}D · 過境事件（柱）／不重複衛星（tooltip）`}
            footer={peak === null ? undefined : `可呈現日 ${countedBars.length}/${bars.length} · 單日最高 ${peak} 次`}
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
