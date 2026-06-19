import { useMemo } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel, Sparkline } from "./PressureRing";
import {
  RESERVE_INDICATOR_COLORS,
  RESERVE_INDICATOR_LABELS,
  type PowerDashboard,
  type PowerGenerationDay,
} from "../../../data/energyLoader";
import { fuelColorOf } from "../../../data/energyLoader";
import { buildPowerCardModel, loadRateColor, summarisePowerKpis } from "./powerCardData";

interface Props {
  dashboard: PowerDashboard | null;
  day: PowerGenerationDay | null;
}

function fmtMW(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

export function PowerCard({ dashboard, day }: Props) {
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
            等待機組出力資料…
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
    </div>
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
