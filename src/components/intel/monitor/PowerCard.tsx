import { useMemo, useState } from "react";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";
import { FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE, BORDER } from "../../../styles/designTokens";
import { useMonitorV2 } from "./monitorStyle";
import { useMonitorTheme } from "./monitorTheme";
import { fs, MF } from "./monitorFont";
import { useMonitorFreshness, type MonitorFreshness } from "./monitorFreshness";
import { MonitorMetric, MonitorNote, MonitorSub } from "./MonitorMetric";
import { SectionLabel, Sparkline } from "./PressureRing";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import {
  RESERVE_INDICATOR_COLORS,
  RESERVE_INDICATOR_LABELS,
  type PowerDashboard,
  type PowerGenerationDay,
  type PowerDailyTrendRow,
} from "../../../data/energyLoader";
import { fuelColorOf } from "../../../data/energyLoader";
import { useLocale, type LocaleSnapshot } from "../../../state/localeStore";
import { enumLabel } from "../../../i18n/dataText";
import { buildPowerCardModel, fuelLabelZh, groupPlantsByFuel, groupPlantsByRegion, loadRateColor, type PowerRegionGroup, regionLabelZh, summarisePowerKpis, type PowerPlantRow as PowerPlantModelRow } from "./powerCardData";

/**
 * UNIT OUTPUT（機組 24h 出力）資料狀態，與 `day` 分開傳遞。
 * 由呼叫端（MonitorPanel）依 fetchPowerGeneration24h 的 resolve/reject 分類，
 * 不進 buildPowerCardModel（PowerCard 為 timeline-isolated 卡片，見 powerCardData.test.ts）。
 * - loading：尚未回來
 * - ready  ：成功（實際有沒有 plants 由 model.plants.length 決定）
 * - denied ：get_ssot_facility_output_24h 是 owner-gated RPC（PR #60），非 owner 呼叫必然權限不足，正常狀態非故障
 * - error  ：其他失敗（網路 / RPC 掛掉），值得提示「稍後再試」
 */
export type PowerDayStatus = "loading" | "ready" | "denied" | "error";

interface Props {
  dashboard: PowerDashboard | null;
  day: PowerGenerationDay | null;
  /** UNIT OUTPUT 區塊要顯示哪種空狀態文案；預設 "loading" 相容既有呼叫端行為 */
  dayStatus?: PowerDayStatus;
  /** 過去 30 天每日供電趨勢（RPC get_power_daily_trend）；卡片內獨立資料，與 timeline scrub 無關 */
  trend: PowerDailyTrendRow[];
}

/** 一天 = 86400 秒；gapSec 給 1.5 天避免把單日缺快照的空隙誤畫成一路連線 */
const TREND_GAP_SEC = 86400 * 1.5;

/** 燃料／區域的中文標籤（powerCardData 的中文正本）→ 目前語系 */
const fuelText = (fuel: string | null | undefined, i18n: LocaleSnapshot): string => {
  const zh = fuelLabelZh(fuel);
  return enumLabel("monitorPowerFuel", zh, zh, i18n);
};
const regionText = (zh: string, i18n: LocaleSnapshot): string => enumLabel("monitorPowerRegion", zh, zh, i18n);

function fmtMW(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

/**
 * v2 區塊樣式：不畫框／底／內距，只用頂部淡分隔切段（first＝第一段不畫線）。
 * legacy 原樣回傳舊樣式。
 */
function sectionBox(v2: boolean, legacy: React.CSSProperties, gap: number, first = false, borderColor: string = BORDER.soft): React.CSSProperties {
  if (!v2) return legacy;
  return {
    display: "flex", flexDirection: "column", gap, minWidth: 0,
    ...(first ? {} : { borderTop: `1px solid ${borderColor}`, paddingTop: 10 }),
  };
}

export function PowerCard({ dashboard, day, dayStatus = "loading", trend }: Props) {
  const v2 = useMonitorV2();
  const i18n = useLocale();
  const { t } = i18n;
  const model = useMemo(() => buildPowerCardModel(dashboard, day), [dashboard, day]);
  const kpis = useMemo(() => summarisePowerKpis(day), [day]);
  const status = dashboard?.status ?? null;
  const indicator = model.indicator;
  const theme = useMonitorTheme();
  const dotColor = indicator
    ? theme.fill(RESERVE_INDICATOR_COLORS[indicator.toUpperCase()] ?? theme.p.textGhost)
    : theme.p.textGhost;
  const indLabel = indicator
    ? enumLabel("legendEnergyReserve", indicator.toUpperCase(), RESERVE_INDICATOR_LABELS[indicator.toUpperCase()] ?? indicator, i18n)
    : t("monitor.power.updating");
  const { regions, plants } = model;
  const tip = useChartTooltip();
  /** 各廠 24h 原始 [ts, mw] 序列，供 PlantSparkRow 的 sparkline hover 用時間標籤（model.plants.spark 只留 mw，見 powerCardData.ts） */
  const plantPointsByName = useMemo(
    () => new Map((day?.plants ?? []).map((p) => [p.plant_name, p.points])),
    [day],
  );
  const totalRegionMw = regions.reduce((sum, r) => sum + (r.mw ?? 0), 0) || 1;
  // v2：觀測時間送標題列
  const observedMs = status?.observed_at ? Date.parse(status.observed_at) : NaN;
  const fresh = useMonitorFreshness("powerCard", { time: Number.isNaN(observedMs) ? null : observedMs });

  if (v2) {
    // 抽蓄抽水時 mw 為負：長條只畫發電（正值）並以正值合計為分母；負值（|占比|≥0.5%）改寫「用電中」
    const posMix = kpis.fuelMix.filter((sl) => sl.mw > 0);
    const posTotal = posMix.reduce((sum, sl) => sum + sl.mw, 0) || 1;
    const fuelTop = posMix.slice(0, 5).map((sl) => ({ ...sl, label: fuelText(sl.fuel, i18n), pct: sl.mw / posTotal }));
    const fuelPumping = kpis.fuelMix.filter((sl) => sl.mw < 0 && Math.abs(sl.mw) / posTotal >= 0.005);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        {/* 狀態燈號：標題列是共用殼，改成卡內第一行小字（色點＋狀態字） */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: MF.label, color: theme.p.textMuted }}>
          <span
            data-testid="power-indicator-dot"
            style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: dotColor, flexShrink: 0 }}
          />
          <span style={{ fontFamily: FONT_CJK, whiteSpace: "nowrap" }}>{indLabel}</span>
          {status?.peak_hour_range && (
            <span style={{ whiteSpace: "nowrap" }}>· {t("monitor.power.forecastPeak", { range: status.peak_hour_range })}</span>
          )}
        </div>

        <PowerTrendPair trend={trend} status={status} fresh={fresh} />

        {/* 四區用電收成一行 */}
        <MonitorSub
          items={[
            t("monitor.power.regionsLabel"),
            ...regions.map((r) => (
              <span key={r.region} data-testid={`power-region-${r.region}`}>
                {regionText(r.region, i18n)} <span style={{ fontFamily: FONT_DATA, color: theme.p.textDefault }}>{fmtMW(r.mw)}</span>
              </span>
            )),
          ]}
        />

        {/* 24h 尖峰／燃料結構（機組出力登入後才有資料） */}
        {kpis.peakMW > 0 && (
          <div data-testid="power-kpi-strip" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <MonitorSub
              items={[
                <span key="p">{t("monitor.power.peak24h")} <span style={{ fontFamily: FONT_DATA, color: theme.p.textDefault }}>{Math.round(kpis.peakMW).toLocaleString("zh-TW")}</span> MW</span>,
                <span key="l">{t("monitor.power.latestTotal")} <span style={{ fontFamily: FONT_DATA, color: theme.p.textDefault }}>{Math.round(kpis.latestMW).toLocaleString("zh-TW")}</span> MW</span>,
              ]}
            />
            <div
              data-testid="power-fuel-mix"
              style={{ display: "flex", height: 6, borderRadius: RADIUS.sm, overflow: "hidden", background: theme.neutral(0.08) }}
            >
              {posMix.map((sl) => (
                <span
                  key={sl.fuel}
                  {...tip.bind(() => ({
                    title: fuelText(sl.fuel, i18n),
                    rows: [{ dot: theme.fill(fuelColorOf(sl.fuel)), value: `${fmtChartValue(sl.mw, "MW")} · ${((sl.mw / posTotal) * 100).toFixed(1)}%` }],
                  }))}
                  style={{ width: `${(sl.mw / posTotal) * 100}%`, background: theme.fill(fuelColorOf(sl.fuel)) }}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontFamily: FONT_DATA, fontSize: MF.label, color: theme.p.textMuted }}>
              {fuelTop.map((sl) => (
                <span key={sl.fuel} style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                  <span style={{ width: 6, height: 6, borderRadius: RADIUS.full, background: theme.fill(fuelColorOf(sl.fuel)) }} />
                  {sl.label} {(sl.pct * 100).toFixed(0)}%
                </span>
              ))}
              {fuelPumping.map((sl) => (
                <span key={sl.fuel} style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                  <span style={{ width: 6, height: 6, borderRadius: RADIUS.full, background: theme.fill(fuelColorOf(sl.fuel)) }} />
                  {t("monitor.power.pumping", { label: fuelText(sl.fuel, i18n) })}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 機組出力：小倍數列（登入後才有資料；未登入保留一行說明） */}
        {plants.length === 0 ? (
          <MonitorNote>
            {dayStatus === "denied"
              ? t("monitor.power.unitsDenied")
              : dayStatus === "error"
                ? t("monitor.power.unitsError")
                : t("monitor.power.unitsWaiting")}
          </MonitorNote>
        ) : (
          <div data-testid="power-plant-grid" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: MF.label, color: theme.p.textDim }}>{t("monitor.power.unitsHeader", { count: plants.length })}</div>
            <PowerPlantGroups plants={plants} pointsByName={plantPointsByName} />
          </div>
        )}
        {fresh.reason && <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>}
        {tip.node}
      </div>
    );
  }

  return (
    <div style={{ ...(v2 ? { minWidth: 0 } : { gridColumn: "1 / -1" }), display: "flex", flexDirection: "column", gap: 10 }}>
      {!v2 && <SectionLabel color={theme.p.accent}>{t("monitor.power.energyHeader")}</SectionLabel>}

      {/* Header card: 燈號 + 負載 + 備轉 + 預測尖峰 */}
      <div
        style={sectionBox(v2, {
          borderRadius: RADIUS.xl,
          border: `1px solid ${theme.p.panelBorder}`,
          background: "linear-gradient(160deg, rgba(34,197,94,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 11,
        }, 11, true)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            data-testid="power-indicator-dot"
            style={{
              width: 11, height: 11, borderRadius: RADIUS.full, background: dotColor,
              boxShadow: `0 0 7px ${dotColor}`, flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.md), fontWeight: 700, color: theme.p.textStrong }}>
            {indLabel}
          </span>
          <div style={{ flex: 1 }} />
          {!v2 && (
            <span
              style={{
                fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), color: theme.p.textFaint,
                padding: "1px 6px", borderRadius: RADIUS.md, background: "rgba(255,255,255,0.05)",
                whiteSpace: "nowrap",
              }}
            >
              {model.observedHHMM}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <Stat label={t("monitor.power.statLoad")} value={fmtMW(status?.curr_load_mw)} unit="MW" big />
          <Stat
            label={t("monitor.power.statReserve")}
            value={status?.reserve_rate_pct != null ? status.reserve_rate_pct.toFixed(1) : "—"}
            unit="%"
            big
          />
          <Stat label={t("monitor.power.statSupply")} value={fmtMW(status?.supply_capacity_mw)} unit="MW" />
          {status?.peak_hour_range && (
            <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textMuted }}>
              {t("monitor.power.forecastPeak", { range: status.peak_hour_range })}
            </span>
          )}
        </div>

        {/* 4 區用電 mini-bars */}
        <div style={{ display: "grid", gridTemplateColumns: v2 ? "repeat(auto-fit, minmax(110px, 1fr))" : "repeat(4, 1fr)", gap: 8 }}>
          {regions.map(({ region: r, mw: v, pct }) => {
            return (
              <div
                key={r}
                data-testid={`power-region-${r}`}
                {...tip.bind(() => ({
                  title: regionText(r, i18n),
                  rows: [{ dot: theme.p.accent, value: v != null ? fmtChartValue(v, "MW") : "—" }],
                  note: v != null ? t("monitor.power.regionShare", { pct: ((v / totalRegionMw) * 100).toFixed(1) }) : undefined,
                }))}
                style={v2 ? { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 } : {
                  display: "flex", flexDirection: "column", gap: 3,
                  padding: "6px 8px", borderRadius: RADIUS.md,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${theme.p.borderSoft}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), color: theme.p.textMuted }}>{regionText(r, i18n)}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 11), fontWeight: 700, color: theme.p.textDefault }}>
                    {fmtMW(v)}
                  </span>
                </div>
                <div
                  style={{
                    height: 4, borderRadius: RADIUS.sm,
                    background: "rgba(255,255,255,0.06)", overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(pct ?? 0) * 100}%`, height: "100%",
                      background: theme.p.accent, transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI strip：24h peak + fuel mix */}
      {kpis.peakMW > 0 && (
        <div
          data-testid="power-kpi-strip"
          style={v2 ? {
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0,
            borderTop: `1px solid ${theme.neutral(0.06)}`, paddingTop: 10,
          } : {
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            padding: "8px 12px", borderRadius: RADIUS.lg,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${theme.p.borderSoft}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), color: theme.p.textMuted }}>{t("monitor.power.peak24hShort")}</span>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 13), fontWeight: 700, color: theme.isDark ? "#fff" : theme.p.textStrong }}>
              {Math.round(kpis.peakMW).toLocaleString()}
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: theme.p.textFaint }}>MW</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), color: theme.p.textMuted }}>{t("monitor.power.latestTotal")}</span>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 13), fontWeight: 700, color: theme.isDark ? "#fff" : theme.p.textStrong }}>
              {Math.round(kpis.latestMW).toLocaleString()}
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: theme.p.textFaint }}>MW</span>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div
              data-testid="power-fuel-mix"
              style={{
                display: "flex", height: 6, borderRadius: RADIUS.sm, overflow: "hidden",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              {kpis.fuelMix.map((s) => (
                <span
                  key={s.fuel}
                  {...tip.bind(() => ({
                    title: s.fuel,
                    rows: [{ dot: theme.fill(fuelColorOf(s.fuel)), value: `${fmtChartValue(s.mw, "MW")} · ${(s.pct * 100).toFixed(1)}%` }],
                  }))}
                  style={{
                    width: `${s.pct * 100}%`,
                    background: theme.fill(fuelColorOf(s.fuel)),
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 4 }}>
              {kpis.fuelMix.slice(0, 5).map((s) => (
                <span
                  key={s.fuel}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: theme.p.textMuted,
                  }}
                >
                  <span
                    style={{
                      width: 5, height: 5, borderRadius: RADIUS.full,
                      background: theme.fill(fuelColorOf(s.fuel)),
                    }}
                  />
                  {s.fuel} {(s.pct * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 14 廠 sparkline grid */}
      <div
        style={sectionBox(v2, {
          borderRadius: RADIUS.xl,
          border: `1px solid ${theme.p.panelBorder}`,
          background: "rgba(255,255,255,0.02)",
          padding: "11px 14px",
          display: "flex", flexDirection: "column", gap: 9,
        }, 9, false, theme.neutral(0.06))}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {v2 ? (
            <SectionLabel>{t("monitor.power.unitsHeaderShort", { n: day == null && dayStatus !== "ready" ? "—" : plants.length })}</SectionLabel>
          ) : (
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.2px", color: theme.p.textDim }}>
              {t("monitor.power.unitsHeaderEn", { n: day == null && dayStatus !== "ready" ? "—" : plants.length })}
            </span>
          )}
        </div>
        {plants.length === 0 ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textFaint, padding: "8px 0" }}>
            {dayStatus === "denied"
              ? t("monitor.power.unitsDenied")
              : dayStatus === "error"
                ? t("monitor.power.unitsError")
                : t("monitor.power.unitsWaiting")}
          </div>
        ) : (
          <div
            data-testid="power-plant-grid"
            style={{ display: "grid", gridTemplateColumns: v2 ? "repeat(auto-fit, minmax(150px, 1fr))" : "repeat(3, 1fr)", gap: 8 }}
          >
            {plants.map((p) => (
              <PlantSparkRow
                key={p.name}
                name={p.name}
                mw={p.mw}
                rate={p.rate}
                spark={p.spark}
                points={plantPointsByName.get(p.name) ?? []}
              />
            ))}
          </div>
        )}
      </div>

      {/* 30 天供電趨勢：備轉容量率為主圖，null 天濾除 + gapSec 斷線避免假趨勢 */}
      <PowerTrend30d trend={trend} />

      {/* 30 天供電能力 vs 尖峰負載：疊在同一張圖、共用 MW Y 軸，兩線間距即備轉容量 */}
      <PowerCapacityVsLoad30d trend={trend} />
      {tip.node}
    </div>
  );
}

/** v2：兩個主數字並排各配大圖——備轉容量率 30 天｜供電能力 vs 尖峰負載（同單位 MW 疊線） */
function PowerTrendPair({
  trend, status, fresh,
}: {
  trend: PowerDailyTrendRow[];
  status: PowerDashboard["status"] | null;
  fresh: MonitorFreshness;
}) {
  const theme = useMonitorTheme();
  const { t } = useLocale();
  // resv_rate 為 null 的日子濾除；超過 1.5 天沒點就斷線（09/25 前後缺快照不連成假趨勢）
  const reserveSpark = useMemo<SparklinePoint[]>(
    () =>
      trend
        .filter((r): r is PowerDailyTrendRow & { resv_rate: number } => r.resv_rate != null)
        .map((r) => ({ t: r.day_ts, v: r.resv_rate })),
    [trend],
  );
  const supplySpark = useMemo<SparklinePoint[]>(
    () => trend.map((r) => ({ t: r.day_ts, v: r.max_supply_mw })),
    [trend],
  );
  const loadExtra = useMemo(
    () => ({
      data: trend.map((r) => ({ t: r.day_ts, v: r.peak_load_mw })),
      color: theme.p.statusWarn,
      label: t("monitor.power.peakLoad"),
    }),
    [trend, t, theme.p.statusWarn],
  );
  const empty = (
    <div style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textFaint, padding: "8px 0" }}>{t("monitor.power.trendWaiting")}</div>
  );
  const labelStyle = { fontSize: MF.label, color: theme.p.textMuted } as const;
  return (
    <div
      data-testid="power-trend-pair"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px 16px" }}
    >
      <div data-testid="power-trend-30d" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={labelStyle}>{t("monitor.power.reserveTrend")}</span>
        <MonitorMetric
          value={status?.reserve_rate_pct != null ? status.reserve_rate_pct.toFixed(1) : "—"}
          unit={status?.reserve_rate_pct != null ? "%" : undefined}
          muted={fresh.muted}
        />
        {reserveSpark.length === 0 ? empty : (
          <TimeseriesSparkline
            data={reserveSpark} unit="%" heightTier="lg" fillArea lineColor={theme.p.accent}
            gapSec={TREND_GAP_SEC} showTooltip tooltipDateFormat="date" staleUntil={fresh.staleUntil}
          />
        )}
      </div>
      <div data-testid="power-capacity-load-30d" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={labelStyle}>{t("monitor.power.supplyVsLoad")}</span>
        <MonitorMetric
          value={fmtMW(status?.supply_capacity_mw)}
          unit={status?.supply_capacity_mw != null ? "MW" : undefined}
          delta={status?.curr_load_mw != null ? t("monitor.power.loadDelta", { mw: fmtMW(status.curr_load_mw) }) : undefined}
          muted={fresh.muted}
        />
        {supplySpark.length === 0 ? empty : (
          <TimeseriesSparkline
            data={supplySpark} extraSeries={loadExtra} seriesLabel={t("monitor.power.supplyCapacity")} unit="MW"
            heightTier="lg" fillArea={false} lineColor={theme.p.statusLive}
            gapSec={TREND_GAP_SEC} compactYAxis showTooltip tooltipDateFormat="date" staleUntil={fresh.staleUntil}
          />
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: MF.label, color: theme.p.textMuted }}>
          <TrendLegendDot color={theme.p.statusLive} label={t("monitor.power.supplyCapacity")} />
          <TrendLegendDot color={theme.p.statusWarn} label={t("monitor.power.peakLoad")} />
        </div>
      </div>
    </div>
  );
}

/** v2 機組出力小格網格（比照急診醫院小格）：可切依區域（預設）／依發電方式分組，組內依出力由大到小；各格共用同一 24h 時間軸 */
function PowerPlantGroups({
  plants, pointsByName,
}: {
  plants: PowerPlantModelRow[];
  pointsByName: Map<string, [number, number][]>;
}) {
  const theme = useMonitorTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const timeDomain = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const pts of pointsByName.values()) {
      for (const [t] of pts) {
        if (t < lo) lo = t;
        if (t > hi) hi = t;
      }
    }
    return Number.isFinite(lo) && lo < hi ? { from: lo, to: hi } : undefined;
  }, [pointsByName]);
  const [mode, setMode] = useState<"region" | "fuel">("region");
  const groups = useMemo<PowerRegionGroup[]>(
    () => (mode === "region" ? groupPlantsByRegion(plants) : groupPlantsByFuel(plants)),
    [mode, plants],
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div data-testid="power-group-mode" style={{ display: "flex", gap: 4 }}>
        {([["region", t("monitor.power.modeRegion")], ["fuel", t("monitor.power.modeFuel")]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            aria-pressed={mode === k}
            style={{
              fontFamily: FONT_DATA, fontSize: MF.label,
              padding: "2px 7px", borderRadius: RADIUS.sm, cursor: "pointer",
              background: mode === k ? theme.p.accentFaint : "transparent",
              color: mode === k ? theme.p.textStrong : theme.p.textDim,
              border: `1px solid ${mode === k ? theme.p.borderStrong : theme.p.borderSoft}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {groups.map((g) => {
        const groupLabel = mode === "region" ? regionText(g.label, i18n) : enumLabel("monitorPowerFuel", g.label, g.label, i18n);
        return (
        <div key={g.label} data-testid={`power-${mode}-group-${g.label}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: FONT_CJK, fontSize: MF.body, fontWeight: 700, color: theme.p.textDefault, whiteSpace: "nowrap" }}>
              {groupLabel}
            </span>
            {g.plants.length > 0 && (
              <span style={{ fontFamily: FONT_DATA, fontSize: MF.label, color: theme.p.textDim, whiteSpace: "nowrap" }}>
                {t(g.totalMw < 0 ? "monitor.power.groupConsuming" : "monitor.power.groupTotal", { count: g.plants.length, mw: Math.round(Math.abs(g.totalMw)).toLocaleString("zh-TW") })}
              </span>
            )}
            {g.note && (
              <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted, whiteSpace: "nowrap" }}>
                {regionText(g.note, i18n)}
              </span>
            )}
            <div style={{ flex: 1, height: 1, background: theme.p.borderSoft }} />
          </div>
          {g.plants.length === 0 ? (
            <div style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textFaint }}>
              {t("monitor.power.groupEmpty", { label: groupLabel })}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 6 }}>
              {g.plants.map((p) => (
                <PowerPlantCell
                  key={p.name} plant={p} points={pointsByName.get(p.name) ?? []} timeDomain={timeDomain}
                  sub={mode === "region" ? fuelText(p.fuel, i18n) : regionText(regionLabelZh(p.region), i18n)}
                />
              ))}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function PowerPlantCell({
  plant, points, timeDomain, sub,
}: {
  sub?: string;
  plant: PowerPlantModelRow;
  points: [number, number][];
  timeDomain?: { from: number; to: number };
}) {
  const theme = useMonitorTheme();
  const color = loadRateColor(plant.rate);
  const data = useMemo<SparklinePoint[]>(() => points.map(([t, v]) => ({ t, v })), [points]);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6, minWidth: 0,
        padding: "4px 6px", borderRadius: RADIUS.md, background: theme.neutral(0.04),
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span
          title={plant.name}
          style={{
            fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textDefault,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {plant.name}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: MF.body, fontWeight: 700, color: theme.text(color), lineHeight: 1.1 }}>
            {plant.mw != null ? Math.round(plant.mw).toLocaleString("zh-TW") : "—"}
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted }}>
            MW{plant.rate != null ? ` · ${Math.round(plant.rate * 100)}%` : ""}
          </span>
        </div>
        {sub && (
          <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sub}
          </span>
        )}
      </div>
      <div style={{ flex: "0 1 72px", minWidth: 40 }}>
        {data.length >= 2 && (
          <TimeseriesSparkline
            data={data} timeDomain={timeDomain} unit="MW" lineColor={color}
            heightTier="mini" bare fillArea={false} gapSec={3600} showTooltip
          />
        )}
      </div>
    </div>
  );
}

function PowerTrend30d({ trend }: { trend: PowerDailyTrendRow[] }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const { t } = useLocale();
  const spark = useMemo<SparklinePoint[]>(
    () =>
      trend
        .filter((r): r is PowerDailyTrendRow & { resv_rate: number } => r.resv_rate != null)
        .map((r) => ({ t: r.day_ts, v: r.resv_rate })),
    [trend],
  );
  const minRate = spark.length > 0 ? Math.min(...spark.map((p) => p.v)) : null;

  return (
    <div
      data-testid="power-trend-30d"
      style={sectionBox(v2, {
        borderRadius: RADIUS.xl,
        border: `1px solid ${theme.p.panelBorder}`,
        background: "rgba(255,255,255,0.02)",
        padding: "11px 14px",
        display: "flex", flexDirection: "column", gap: 9,
      }, 9, false, theme.neutral(0.06))}
    >
      <SectionLabel color={theme.p.accent}>
        {t("monitor.power.trend30Reserve")}{minRate != null ? t("monitor.power.trend30Min", { min: minRate.toFixed(1) }) : ""}
      </SectionLabel>
      {spark.length === 0 ? (
        <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textFaint, padding: "8px 0" }}>
          {t("monitor.power.trendWaiting")}
        </div>
      ) : (
        <TimeseriesSparkline
          data={spark}
          unit="%"
          height={64}
          fillArea
          lineColor={theme.p.accent}
          gapSec={TREND_GAP_SEC}
          showTooltip
          tooltipDateFormat="date"
        />
      )}
    </div>
  );
}

/** 30 天供電能力 vs 尖峰負載：疊圖共用 MW Y 軸，兩線間距一眼看出哪幾天備轉吃緊 */
function PowerCapacityVsLoad30d({ trend }: { trend: PowerDailyTrendRow[] }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const { t } = useLocale();
  const supplySpark = useMemo<SparklinePoint[]>(
    () => trend.map((r) => ({ t: r.day_ts, v: r.max_supply_mw })),
    [trend],
  );
  const loadSpark = useMemo<SparklinePoint[]>(
    () => trend.map((r) => ({ t: r.day_ts, v: r.peak_load_mw })),
    [trend],
  );

  return (
    <div
      data-testid="power-capacity-load-30d"
      style={sectionBox(v2, {
        borderRadius: RADIUS.xl,
        border: `1px solid ${theme.p.panelBorder}`,
        background: "rgba(255,255,255,0.02)",
        padding: "11px 14px",
        display: "flex", flexDirection: "column", gap: 9,
      }, 9, false, theme.neutral(0.06))}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SectionLabel color={theme.p.accent}>{t("monitor.power.trend30Supply")}</SectionLabel>
        <div style={{ flex: 1 }} />
        <TrendLegendDot color={theme.p.statusLive} label={t("monitor.power.supplyCapacity")} />
        <TrendLegendDot color={theme.p.statusWarn} label={t("monitor.power.peakLoad")} />
      </div>
      {supplySpark.length === 0 ? (
        <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textFaint, padding: "8px 0" }}>
          {t("monitor.power.trendWaiting")}
        </div>
      ) : (
        <TimeseriesSparkline
          data={supplySpark}
          extraSeries={{ data: loadSpark, color: theme.p.statusWarn, label: t("monitor.power.peakLoad") }}
          seriesLabel={t("monitor.power.supplyCapacity")}
          unit="MW"
          height={64}
          fillArea
          lineColor={theme.p.statusLive}
          gapSec={TREND_GAP_SEC}
          compactYAxis
          showTooltip
          tooltipDateFormat="date"
        />
      )}
    </div>
  );
}

function TrendLegendDot({ color, label }: { color: string; label: string }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: theme.p.textMuted,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: RADIUS.full, background: color }} />
      {label}
    </span>
  );
}

function Stat({
  label, value, unit, big,
}: { label: string; value: string; unit: string; big?: boolean }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), color: theme.p.textMuted }}>{label}</span>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: fs(v2, big ? 22 : 14), fontWeight: 700,
          color: theme.isDark ? "#fff" : theme.p.textStrong, lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: theme.p.textFaint }}>{unit}</span>
    </div>
  );
}

function PlantSparkRow({
  name, mw, rate, spark, points,
}: {
  name: string;
  mw: number | null;
  rate: number | null;
  spark: number[];
  /** 對應 `spark` 每一點的原始 [ts_unix, mw]，供 sparkline hover 標時間用（`spark` 本身已被 buildPowerCardModel 剝掉 ts） */
  points: [number, number][];
}) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const rateColor = loadRateColor(rate);
  return (
    <div
      style={v2 ? { display: "flex", alignItems: "center", gap: 6, minWidth: 0 } : {
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 7px", borderRadius: RADIUS.md,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${theme.p.borderSoft}`,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: fs(v2, 10.5), color: theme.p.textDefault,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
          title={name}
        >
          {name}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 10), color: theme.p.textMuted }}>
            {mw != null ? Math.round(mw).toLocaleString() : "—"}
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), color: theme.p.textFaint }}>MW</span>
          {rate != null && (
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), fontWeight: 700, color: rateColor }}>
              {Math.round(rate * 100)}%
            </span>
          )}
        </div>
      </div>
      <Sparkline
        data={spark.length ? spark : [0, 0]}
        color={rateColor}
        w={48}
        h={18}
        showTooltip
        labelAt={(i) => {
          const ts = points[i]?.[0];
          return ts != null
            ? new Date(ts * 1000).toLocaleTimeString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false })
            : "";
        }}
        unit="MW"
      />
    </div>
  );
}
