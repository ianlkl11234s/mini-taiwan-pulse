import { useState } from "react";
import { IntelIcon, ICON } from "../IntelIcon";
import {
  COLORS, FONT_CJK, FONT_DATA, PRESSURE_LEVELS, pressureLevel,
} from "../intelTokens";
import { PressureRing, CompareLine, Widget } from "./PressureRing";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import type {
  PressureIndexNow, PressureSignal, SourceHealthSummary,
} from "../../../data/intelLoaders";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";

function MiniStat({
  label, en, value, color,
}: { label: string; en: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: 8.5, letterSpacing: "1.2px", color: COLORS.textDim,
        }}
      >
        {en}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xxl, fontWeight: 700, lineHeight: 1,
            color: color ?? "#fff",
          }}
        >
          {value}
        </span>
        <span
          style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, whiteSpace: "nowrap" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/** 10 軌 signal 抽屜 — 按貢獻排序 */
function PressureDrawer({ signals: signalsProp }: { signals: PressureSignal[] }) {
  const tip = useChartTooltip();
  // 防禦：上游若給了非陣列髒資料（型別宣告蓋不住 runtime），這裡收斂成 []
  // 退化成「無資料」提示，不讓 [...signals] 對不可疊代物件炸掉整個 React root。
  const signals = Array.isArray(signalsProp) ? signalsProp : [];
  if (signals.length === 0) {
    return (
      <div
        style={{
          marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${COLORS.borderMid}`,
          fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: COLORS.textFaint,
          animation: "drawerOpen .32s cubic-bezier(.22,1,.36,1)",
        }}
      >
        ⚠ 尚無 signal 細節（後端未回 per_signal）
      </div>
    );
  }
  const sorted = [...signals].sort((a, b) => b.contribution - a.contribution);
  const maxC = Math.max(...sorted.map((s) => s.contribution)) || 1;
  return (
    <div
      style={{
        marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${COLORS.borderMid}`,
        animation: "drawerOpen .32s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textDefault,
          }}
        >
          指數組成 · SIGNAL BREAKDOWN
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
          權重「災害重」· 5min EMA
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 22px" }}>
        {sorted.map((s) => {
          const lvl = pressureLevel(s.raw);
          return (
            <div
              key={s.id}
              {...tip.bind(() => ({
                title: s.label,
                rows: [
                  { dot: lvl.color, label: "貢獻分數", value: fmtChartValue(Math.round(s.raw)) },
                  { label: "權重", value: `×${s.weight.toFixed(2)}` },
                ],
                note: s.note ?? undefined,
              }))}
              style={{ display: "flex", alignItems: "center", gap: 9 }}
            >
              <span style={{ width: 56, flexShrink: 0, display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{
                    fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: COLORS.textDefault, whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </span>
              </span>
              <span
                style={{
                  fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint,
                  width: 30, flexShrink: 0,
                }}
              >
                ×{s.weight.toFixed(2)}
              </span>
              <div
                style={{
                  flex: 1, height: 7, borderRadius: RADIUS.md, background: "rgba(255,255,255,0.05)",
                  overflow: "hidden", minWidth: 26,
                }}
              >
                <span
                  style={{
                    display: "block", height: "100%",
                    width: `${(s.contribution / maxC) * 100}%`,
                    background: lvl.color, borderRadius: RADIUS.md, opacity: 0.9,
                    transition: "width .5s cubic-bezier(.22,1,.36,1)",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontWeight: 700,
                  color: lvl.color, width: 30, textAlign: "right", flexShrink: 0,
                }}
              >
                {Math.round(s.raw)}
              </span>
            </div>
          );
        })}
      </div>
      {tip.node}
      {/* 4-檔戰情等級 legend */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "5px 14px",
          marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.borderSoft}`,
        }}
      >
        {PRESSURE_LEVELS.map((l) => (
          <span
            key={l.key}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: FONT_CJK, fontSize: 9.5, color: COLORS.textMuted,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: l.color }} />
            {l.label}{" "}
            <span style={{ fontFamily: FONT_DATA, color: COLORS.textFaint }}>
              {l.min}–{l.max}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  pressure: PressureIndexNow;
  smoothedScore: number;
  sourceHealth: SourceHealthSummary;
  totalEvents: number;
  severeCount: number;
}

export function SituationOverview({
  pressure, smoothedScore, sourceHealth, totalEvents, severeCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const level = pressureLevel(smoothedScore);

  return (
    <Widget
      style={{
        gridColumn: "1 / -1", padding: 15, position: "relative",
        background: `linear-gradient(150deg, ${level.soft}, rgba(255,255,255,0.012) 46%)`,
        borderColor: open ? `${level.color}66` : COLORS.panelBorder,
        transition: "border-color .3s",
      }}
    >
      {level.key === "emergency" && (
        <span
          style={{
            position: "absolute", inset: 0, borderRadius: RADIUS.xl, pointerEvents: "none",
            boxShadow: `inset 0 0 30px ${level.glow}`,
            animation: "presPulse 1s ease-in-out infinite",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
        <span style={{ width: 3, height: 12, borderRadius: RADIUS.sm, background: level.color }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, letterSpacing: "1.5px", color: COLORS.textDefault,
          }}
        >
          戰情概覽 · PRESSURE INDEX
        </span>
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint, whiteSpace: "nowrap",
          }}
        >
          10 訊號加權 0–100
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          title="點環看指數組成"
          style={{
            border: "none", background: "transparent", padding: 0,
            cursor: "pointer", position: "relative", lineHeight: 0,
          }}
        >
          <PressureRing score={smoothedScore} level={level} />
          <span
            style={{
              position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
              display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px",
              borderRadius: RADIUS.xl, background: "rgba(0,0,0,0.45)",
              border: `1px solid ${COLORS.borderSoft}`,
              fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textMuted, whiteSpace: "nowrap",
            }}
          >
            {open ? "收合" : "組成"}
            <span
              style={{
                display: "inline-block",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform .3s",
              }}
            >
              <IntelIcon d={ICON.chevDown} size={9} color={COLORS.textMuted} />
            </span>
          </span>
        </button>

        {/* TAIEX 2026-08-10 拆成獨立 widget 後這裡多出橫向空間 → 讓本欄吃滿，不留右側空洞 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1, minWidth: 150 }}>
          <CompareLine delta={pressure.vs_baseline} label="vs 平常週日同時段" />
          <CompareLine delta={pressure.vs_1h_ago} label="vs 1 小時前" />
          <div style={{ height: 1, background: COLORS.borderSoft, margin: "1px 0" }} />
          <div style={{ display: "flex", gap: 18, justifyContent: "space-between", maxWidth: 420 }}>
            <MiniStat en="EVENTS" label="事件" value={totalEvents} />
            <MiniStat
              en="SEVERE ≥3" label="嚴重" value={severeCount}
              color={severeCount > 0 ? COLORS.statusWarn : "#fff"}
            />
            <MiniStat
              en="SOURCES" label="來源"
              value={`${sourceHealth.ok}/${sourceHealth.total}`}
            />
          </div>
        </div>
      </div>

      {open && <PressureDrawer signals={pressure.per_signal} />}
    </Widget>
  );
}
