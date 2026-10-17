import { useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { useMonitorV2 } from "./monitorStyle";
import { fs, MF } from "./monitorFont";
import { MonitorKpis, MonitorMetric, MonitorNote, MonitorSub } from "./MonitorMetric";
import { useMonitorFreshness } from "./monitorFreshness";
import { useMonitorTheme } from "./monitorTheme";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import { useLocale } from "../../../state/localeStore";

import type { PrisonDay } from "../../../data/prisonLoader";
export type { PrisonDay } from "../../../data/prisonLoader";

/** 趨勢視窗（天）。RPC 一次撈 365 天，切窗純前端 */
const WINDOWS = [90, 365] as const;
type WindowDays = (typeof WINDOWS)[number];
const WINDOW_LABEL: Record<WindowDays, string> = { 90: "90D", 365: "1Y" };

interface Props {
  /** 最新一筆（= rows[0]，RPC 已按日期新到舊排序） */
  latest: PrisonDay | null;
  /**
   * 完整視窗序列（新到舊）。給趨勢圖用。
   *
   * ⚠️ 2026-08-20 起：DB 現況只有 2026-05-15 一筆 —— 上游法務部矯正署
   * `prisonmuseum/today.xml` 自 2026-05-16 起就沒再被重寫過（HTTP Last-Modified 佐證），
   * collector 每天照跑、只是 upsert 同一天。所以這條序列可能只有 1 點，
   * 元件必須自己處理「畫不出趨勢」的情況，不能假設一定有序列。
   */
  series?: PrisonDay[];
}

export function PrisonCard({ latest, series = [] }: Props) {
  const v2 = useMonitorV2();
  const i18n = useLocale();
  const fmt = (v: number | null | undefined): string => (v == null ? "—" : i18n.formatNumber(v));
  const theme = useMonitorTheme();
  const [windowDays, setWindowDays] = useState<WindowDays>(365);
  const total = latest?.total_inmates ?? null;
  const cap = latest?.approved_capacity ?? null;
  const overPct = latest?.over_capacity_pct ?? null;
  const isOver = overPct != null && Number(overPct) > 0;

  /** 資料日期（台灣 00:00）；只有日期、沒有時間 */
  const dataMs = useMemo(() => {
    if (!latest?.observed_date) return null;
    const t = Date.parse(`${latest.observed_date}T00:00:00+08:00`);
    return Number.isNaN(t) ? null : t;
  }, [latest?.observed_date]);

  // v2：資料日期（MM/DD）與新鮮度（週期登記在 monitorCardMeta：日批次，>7 天＝停更）送標題列
  const fresh = useMonitorFreshness("prison", {
    timeText: latest?.observed_date ? latest.observed_date.slice(5).replace("-", "/") : null,
    dataMs,
    reason: dataMs != null ? i18n.t("monitor.prison.staleReason") : undefined,
  });
  // 舊版畫面沿用原判斷（>7 天＝停更）：燈號／說明文字只在舊版使用
  const isStale = fresh.state === "stopped";
  const staleDays = dataMs == null ? null : Math.floor((Date.now() - dataMs) / 86_400_000);

  // 停更時燈號一律轉灰：紅／綠是在講「今天超不超收」，資料三個月沒動還亮綠燈就是說謊
  const dotColor = isStale ? COLORS.textDim : isOver ? "#ef4444" : "#10b981";

  /** 序列裡所有可畫的點（舊→新）。RPC 給的是新到舊，畫圖要反過來 */
  const allPoints: SparklinePoint[] = useMemo(
    () =>
      series
        .filter((d) => d.total_inmates != null)
        .map((d) => ({ t: Date.parse(`${d.observed_date}T00:00:00+08:00`) / 1000, v: Number(d.total_inmates) }))
        .filter((p) => !Number.isNaN(p.t))
        .sort((a, b) => a.t - b.t),
    [series],
  );

  /**
   * 視窗切片。
   *
   * ⚠️ 錨點是**序列最後一天**而不是 `Date.now()` —— 上游停供時（現在就是）
   * 資料最新只到 98 天前，錨在今天的話「90D」會切出空集合，
   * 明明資料庫有東西卻顯示不出來。這正是 RPC 端 migration 367 要修的同一個雷
   * （`get_prison_population_window` 的視窗也錨在 now()），前端不該重犯一次。
   */
  const trend: SparklinePoint[] = useMemo(() => {
    const last = allPoints[allPoints.length - 1];
    if (!last) return [];
    const cutoff = last.t - windowDays * 86_400;
    return allPoints.filter((p) => p.t >= cutoff);
  }, [allPoints, windowDays]);

  if (v2) {
    // 新版：外框已有標題「在監人數」，卡內不重複；停更狀態由標題列＋底部說明表達
    const emptyHint = allPoints.length > 1
      ? i18n.t("monitor.prison.emptyWindow", { date: latest?.observed_date ?? "—" })
      : series.length === 0 ? i18n.t("monitor.prison.noTrend") : i18n.t("monitor.prison.backfill", { count: allPoints.length || series.length });
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        {latest ? (
          <>
            <MonitorMetric value={fmt(total)} unit={i18n.t("monitor.prison.unitPeople")} muted={fresh.muted} />
            <MonitorKpis items={[
              { label: i18n.t("monitor.prison.capacity"), value: fmt(cap) },
              { label: i18n.t("monitor.prison.overRate"), value: overPct == null ? "—" : `${Number(overPct).toFixed(2)}%` },
            ]} />
            <MonitorSub items={[
              i18n.t("monitor.prison.sexSplit", { male: fmt(latest.male_inmates), female: fmt(latest.female_inmates) }),
              i18n.t("monitor.prison.inOut", { in: fmt(latest.new_in_count), out: fmt(latest.new_out_count) }),
            ]} />
          </>
        ) : (
          <MonitorNote>{i18n.t("monitor.prison.loading")}</MonitorNote>
        )}
        {trend.length > 1 ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: MF.label, color: theme.p.textDim, marginRight: "auto" }}>{i18n.t("monitor.prison.trendTitle")}</span>
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  style={{
                    fontFamily: FONT_DATA, fontSize: MF.label,
                    padding: "2px 7px", borderRadius: RADIUS.sm, cursor: "pointer",
                    background: w === windowDays ? theme.p.accentFaint : "transparent",
                    color: w === windowDays ? theme.p.textStrong : theme.p.textDim,
                    border: `1px solid ${w === windowDays ? theme.p.borderStrong : theme.p.borderSoft}`,
                  }}
                >
                  {WINDOW_LABEL[w]}
                </button>
              ))}
            </div>
            <TimeseriesSparkline
              data={trend}
              unit={i18n.t("monitor.prison.unitPeople")}
              lineColor={theme.p.accent}
              heightTier="std"
              gapSec={3 * 86400}
              showTooltip
              tooltipDateFormat="date"
              seriesLabel={i18n.t("monitor.prison.seriesLabel")}
              compactYAxis
              staleUntil={fresh.staleUntil}
            />
          </>
        ) : (
          <MonitorNote>{emptyHint}</MonitorNote>
        )}
        {fresh.reason ? (
          <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
        ) : (
          <MonitorNote>{i18n.t("monitor.prison.source")}</MonitorNote>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!v2 && <SectionLabel color={COLORS.accent}>{i18n.t("monitor.prison.titleLegacy")}</SectionLabel>}
      <div
        style={v2 ? { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 } : {
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(124,58,237,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 11, height: 11, borderRadius: RADIUS.full, background: dotColor,
            boxShadow: `0 0 7px ${dotColor}`, flexShrink: 0,
          }} />
          <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.md), fontWeight: 700, color: COLORS.textStrong }}>
            {latest ? (v2 ? i18n.t("monitor.prison.national") : i18n.t("monitor.prison.nationalDated", { date: latest.observed_date })) : i18n.t("monitor.prison.nationalLoading")}
          </span>
        </div>
        {latest && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xxl), fontWeight: 700, color: COLORS.textStrong }}>
                  {fmt(total)}
                </span>
                <span style={{ fontSize: fs(v2, FONT_SIZE.sm), color: COLORS.textMuted, marginLeft: 4 }}>{i18n.t("monitor.prison.unitPeople")}</span>
              </div>
              <div style={{ fontSize: fs(v2, FONT_SIZE.sm), color: COLORS.textMuted }}>
                {i18n.t("monitor.prison.sexSplit", { male: fmt(latest.male_inmates), female: fmt(latest.female_inmates) })}
              </div>
            </div>
            <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>{i18n.t("monitor.prison.capacityLegacy", { cap: fmt(cap) })}</span>
              <span style={{ color: isOver ? "#fb7185" : COLORS.textMuted }}>
                {i18n.t("monitor.prison.overLegacy", { pct: overPct == null ? "—" : `${Number(overPct).toFixed(2)}%` })}
              </span>
              <span>{i18n.t("monitor.prison.inOut", { in: fmt(latest.new_in_count), out: fmt(latest.new_out_count) })}</span>
            </div>
          </>
        )}
        {/* 趨勢：> 1 點才畫得出線。只有 1 點時直說原因，不要留一塊空圖區裝忙 */}
        {trend.length > 1 ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textDim, marginRight: "auto" }}>
                {i18n.t("monitor.prison.trendTitle")}
              </span>
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  style={{
                    fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs),
                    padding: "2px 7px", borderRadius: RADIUS.sm, cursor: "pointer",
                    background: w === windowDays ? COLORS.accentFaint : "transparent",
                    color: w === windowDays ? COLORS.textStrong : COLORS.textDim,
                    border: `1px solid ${w === windowDays ? COLORS.borderStrong : COLORS.borderSoft}`,
                  }}
                >
                  {WINDOW_LABEL[w]}
                </button>
              ))}
            </div>
            {/* gapSec 3 天：上游本來就有整段缺日（2026-02~03 就斷過 53 天），
                跨過缺口硬連成一條直線會把「沒資料」畫成「數字很平穩」 */}
            <TimeseriesSparkline
              data={trend}
              unit={i18n.t("monitor.prison.unitPeople")}
              lineColor="#a78bfa"
              height={64}
              gapSec={3 * 86400}
              showTooltip
              tooltipDateFormat="date"
              seriesLabel={i18n.t("monitor.prison.seriesLabel")}
              compactYAxis
            />
          </>
        ) : (
          <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textDim }}>
            {/* 兩種「畫不出線」要分清楚：序列本身太短 vs 這個視窗內剛好沒點。
                回補後前者會消失，後者不該再說「資料庫只有 N 天」（那是假話）。 */}
            {allPoints.length > 1
              ? i18n.t("monitor.prison.emptyWindow", { date: latest?.observed_date ?? "—" })
              : series.length === 0 ? i18n.t("monitor.prison.noTrend") : i18n.t("monitor.prison.backfill", { count: allPoints.length || series.length })}
          </div>
        )}
        <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: isStale ? "#fbbf24" : COLORS.textDim }}>
          {v2
            ? (isStale ? i18n.t("monitor.prison.staleStopped") : i18n.t("monitor.prison.source"))
            : isStale
              ? i18n.t("monitor.prison.staleLegacy", { days: staleDays ?? "—" })
              : i18n.t("monitor.prison.sourceLegacy")}
        </div>
      </div>
    </div>
  );
}
