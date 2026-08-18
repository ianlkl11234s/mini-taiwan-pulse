import { useMemo } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
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
import { buildPowerCardModel, loadRateColor, summarisePowerKpis } from "./powerCardData";

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

function fmtMW(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

export function PowerCard({ dashboard, day, dayStatus = "loading", trend }: Props) {
  const model = useMemo(() => buildPowerCardModel(dashboard, day), [dashboard, day]);
  const kpis = useMemo(() => summarisePowerKpis(day), [day]);
  const status = dashboard?.status ?? null;
  const indicator = model.indicator;
  const dotColor = indicator
    ? (RESERVE_INDICATOR_COLORS[indicator.toUpperCase()] ?? COLORS.textGhost)
    : COLORS.textGhost;
  const indLabel = indicator
    ? (RESERVE_INDICATOR_LABELS[indicator.toUpperCase()] ?? indicator)
    : "資料更新中";
  const { regions, plants } = model;

  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color={COLORS.accent}>能源 · POWER GRID</SectionLabel>

      {/* Header card: 燈號 + 負載 + 備轉 + 預測尖峰 */}
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(34,197,94,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 11,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            data-testid="power-indicator-dot"
            style={{
              width: 11, height: 11, borderRadius: RADIUS.full, background: dotColor,
              boxShadow: `0 0 7px ${dotColor}`, flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, fontWeight: 700, color: COLORS.textStrong }}>
            {indLabel}
          </span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textFaint,
              padding: "1px 6px", borderRadius: RADIUS.md, background: "rgba(255,255,255,0.05)",
              whiteSpace: "nowrap",
            }}
          >
            {model.observedHHMM}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <Stat label="負載" value={fmtMW(status?.curr_load_mw)} unit="MW" big />
          <Stat
            label="備轉"
            value={status?.reserve_rate_pct != null ? status.reserve_rate_pct.toFixed(1) : "—"}
            unit="%"
            big
          />
          <Stat label="供電能力" value={fmtMW(status?.supply_capacity_mw)} unit="MW" />
          {status?.peak_hour_range && (
            <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
              預測尖峰 {status.peak_hour_range}
            </span>
          )}
        </div>

        {/* 4 區用電 mini-bars */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {regions.map(({ region: r, mw: v, pct }) => {
            return (
              <div
                key={r}
                data-testid={`power-region-${r}`}
                style={{
                  display: "flex", flexDirection: "column", gap: 3,
                  padding: "6px 8px", borderRadius: RADIUS.md,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${COLORS.borderSoft}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textMuted }}>{r}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: FONT_DATA, fontSize: 11, fontWeight: 700, color: COLORS.textDefault }}>
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
                      width: `${pct * 100}%`, height: "100%",
                      background: COLORS.accent, transition: "width 0.4s ease",
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
          style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            padding: "8px 12px", borderRadius: RADIUS.lg,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${COLORS.borderSoft}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textMuted }}>24h 尖峰</span>
            <span style={{ fontFamily: FONT_DATA, fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {Math.round(kpis.peakMW).toLocaleString()}
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>MW</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textMuted }}>當前合計</span>
            <span style={{ fontFamily: FONT_DATA, fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {Math.round(kpis.latestMW).toLocaleString()}
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>MW</span>
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
                  title={`${s.fuel} · ${Math.round(s.mw)} MW · ${(s.pct * 100).toFixed(1)}%`}
                  style={{
                    width: `${s.pct * 100}%`,
                    background: fuelColorOf(s.fuel),
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
                    fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textMuted,
                  }}
                >
                  <span
                    style={{
                      width: 5, height: 5, borderRadius: RADIUS.full,
                      background: fuelColorOf(s.fuel),
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
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "rgba(255,255,255,0.02)",
          padding: "11px 14px",
          display: "flex", flexDirection: "column", gap: 9,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.2px", color: COLORS.textDim }}>
            UNIT OUTPUT · {plants.length} 廠 24h
          </span>
        </div>
        {plants.length === 0 ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "8px 0" }}>
            {dayStatus === "denied"
              ? "機組出力需登入後檢視"
              : dayStatus === "error"
                ? "機組出力資料暫時無法取得 · 下次輪詢會再試"
                : "等待機組出力資料…"}
          </div>
        ) : (
          <div
            data-testid="power-plant-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}
          >
            {plants.map((p) => (
              <PlantSparkRow
                key={p.name}
                name={p.name}
                mw={p.mw}
                rate={p.rate}
                spark={p.spark}
              />
            ))}
          </div>
        )}
      </div>

      {/* 30 天供電趨勢：備轉容量率為主圖，null 天濾除 + gapSec 斷線避免假趨勢 */}
      <PowerTrend30d trend={trend} />

      {/* 30 天供電能力 vs 尖峰負載：疊在同一張圖、共用 MW Y 軸，兩線間距即備轉容量 */}
      <PowerCapacityVsLoad30d trend={trend} />
    </div>
  );
}

function PowerTrend30d({ trend }: { trend: PowerDailyTrendRow[] }) {
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
      style={{
        borderRadius: RADIUS.xl,
        border: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(255,255,255,0.02)",
        padding: "11px 14px",
        display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <SectionLabel color={COLORS.accent}>
        30 天趨勢 · 備轉容量率{minRate != null ? ` · 區間最低 ${minRate.toFixed(1)}%` : ""}
      </SectionLabel>
      {spark.length === 0 ? (
        <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "8px 0" }}>
          等待每日趨勢資料…
        </div>
      ) : (
        <TimeseriesSparkline
          data={spark}
          unit="%"
          height={64}
          fillArea
          lineColor={COLORS.accent}
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
      style={{
        borderRadius: RADIUS.xl,
        border: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(255,255,255,0.02)",
        padding: "11px 14px",
        display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SectionLabel color={COLORS.accent}>30 天趨勢 · 供電能力 vs 尖峰負載</SectionLabel>
        <div style={{ flex: 1 }} />
        <TrendLegendDot color={COLORS.statusLive} label="供電能力" />
        <TrendLegendDot color={COLORS.statusWarn} label="尖峰負載" />
      </div>
      {supplySpark.length === 0 ? (
        <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "8px 0" }}>
          等待每日趨勢資料…
        </div>
      ) : (
        <TimeseriesSparkline
          data={supplySpark}
          extraSeries={{ data: loadSpark, color: COLORS.statusWarn, label: "尖峰負載" }}
          seriesLabel="供電能力"
          unit="MW"
          height={64}
          fillArea
          lineColor={COLORS.statusLive}
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
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textMuted,
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
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textMuted }}>{label}</span>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: big ? 22 : 14, fontWeight: 700,
          color: "#fff", lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>{unit}</span>
    </div>
  );
}

function PlantSparkRow({
  name, mw, rate, spark,
}: { name: string; mw: number | null; rate: number | null; spark: number[] }) {
  const rateColor = loadRateColor(rate);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 7px", borderRadius: RADIUS.md,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${COLORS.borderSoft}`,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: 10.5, color: COLORS.textDefault,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
          title={name}
        >
          {name}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textMuted }}>
            {mw != null ? Math.round(mw).toLocaleString() : "—"}
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textFaint }}>MW</span>
          {rate != null && (
            <span style={{ fontFamily: FONT_DATA, fontSize: 9, fontWeight: 700, color: rateColor }}>
              {Math.round(rate * 100)}%
            </span>
          )}
        </div>
      </div>
      <Sparkline data={spark.length ? spark : [0, 0]} color={rateColor} w={48} h={18} />
    </div>
  );
}
