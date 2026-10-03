import { useState } from "react";
import { IntelIcon, ICON } from "../IntelIcon";
import {
  COLORS, FONT_CJK, FONT_DATA, PRESSURE_LEVELS, pressureLevel, type PressureLevelDef,
} from "../intelTokens";
import { PressureRing, CompareLine, Widget } from "./PressureRing";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import type {
  PressureIndexNow, PressureSignal, SourceHealthSummary,
} from "../../../data/intelLoaders";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";
import type { IntelQueryStatus } from "../../../hooks/useIntelPollingQuery";
import { useMonitorV2 } from "./monitorStyle";
import { fs } from "./monitorFont";
import { useMonitorFreshness } from "./monitorFreshness";
import { MonitorNote, MonitorRows } from "./MonitorMetric";
import { useMonitorTheme } from "./monitorTheme";

/** 未就緒（讀取中／中斷／受限）時的中性等級：不可用預設分數去決定等級色 */
const NEUTRAL_LEVEL: PressureLevelDef = {
  ...PRESSURE_LEVELS[0]!, label: "—", color: COLORS.textMuted,
  soft: "rgba(255,255,255,0.04)", glow: "rgba(255,255,255,0)", anim: "none", period: 0,
};

function MiniStat({
  label, en, zh, value, color,
}: { label: string; en: string; /** v2 中文小標（取代英文 eyebrow 與右側 label） */ zh: string; value: string | number; color?: string }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span
        style={v2 ? {
          fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim, whiteSpace: "nowrap",
        } : {
          fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), letterSpacing: "1.2px", color: theme.p.textDim,
        }}
      >
        {v2 ? zh : en}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xxl), fontWeight: 700, lineHeight: 1,
            color: color ?? (theme.isDark ? "#fff" : theme.p.textStrong),
          }}
        >
          {value}
        </span>
        {!v2 && (
          <span
            style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textMuted, whiteSpace: "nowrap" }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/** 10 軌 signal 抽屜 — 按貢獻排序 */
function PressureDrawer({ signals: signalsProp }: { signals: PressureSignal[] }) {
  const tip = useChartTooltip();
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  // 防禦：上游若給了非陣列髒資料（型別宣告蓋不住 runtime），這裡收斂成 []
  // 退化成「無資料」提示，不讓 [...signals] 對不可疊代物件炸掉整個 React root。
  const signals = Array.isArray(signalsProp) ? signalsProp : [];
  if (signals.length === 0) {
    return (
      <div
        style={{
          marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${theme.p.borderMid}`,
          fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base), color: theme.p.textFaint,
          animation: "drawerOpen .32s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {v2 ? "尚無指數組成細節" : "⚠ 尚無 signal 細節（後端未回 per_signal）"}
      </div>
    );
  }
  // 只有各訊號子分數（0–100）；權重不在前端複製，排序與長條都用子分數
  const sorted = [...signals].sort((a, b) => b.score - a.score);
  const maxC = Math.max(...sorted.map((s) => s.score)) || 1;
  return (
    <div
      style={{
        marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${theme.p.borderMid}`,
        animation: "drawerOpen .32s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={v2 ? {
            fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), fontWeight: 600, color: theme.p.textMuted,
          } : {
            fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.5px", color: theme.p.textDefault,
          }}
        >
          {v2 ? "指數組成" : "指數組成 · SIGNAL BREAKDOWN"}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>
          {v2 ? "各訊號子分數 0–100 · 總分 5 分鐘平滑" : "權重「災害重」· 5min EMA"}
        </span>
      </div>
      {v2 ? (
        <MonitorRows
          rows={sorted.map((s) => {
            const lvl = pressureLevel(s.score);
            return {
              label: s.label,
              title: `${s.label} 子分數 ${Math.round(s.score)}`,
              chart: (
                <div style={{ height: 7, borderRadius: RADIUS.md, background: theme.neutral(0.05), overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.max(0, Math.min(100, s.score))}%`, background: theme.fill(lvl.color), borderRadius: RADIUS.md, opacity: 0.9 }} />
                </div>
              ),
              value: Math.round(s.score),
            };
          })}
        />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 22px" }}>
        {sorted.map((s) => {
          const lvl = pressureLevel(s.score);
          return (
            <div
              key={s.id}
              {...tip.bind(() => ({
                title: s.label,
                rows: [
                  { dot: theme.fill(lvl.color), label: "子分數", value: fmtChartValue(Math.round(s.score)) },
                ],
              }))}
              style={{ display: "flex", alignItems: "center", gap: 9 }}
            >
              <span style={{ ...(v2 ? { minWidth: 56 } : { width: 56 }), flexShrink: 0, display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{
                    fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base), color: theme.p.textDefault, whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </span>
              </span>
              <span
                style={{
                  fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint,
                  ...(v2 ? { minWidth: 38 } : { width: 30 }), flexShrink: 0,
                }}
              >
                {/* 後端不回權重：留空欄位維持舊版排版 */}
              </span>
              <div
                style={{
                  flex: 1, height: 7, borderRadius: RADIUS.md, background: theme.neutral(0.05),
                  overflow: "hidden", minWidth: 26,
                }}
              >
                <span
                  style={{
                    display: "block", height: "100%",
                    width: `${(s.score / maxC) * 100}%`,
                    background: theme.fill(lvl.color), borderRadius: RADIUS.md, opacity: 0.9,
                    transition: "width .5s cubic-bezier(.22,1,.36,1)",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.base), fontWeight: 700,
                  color: theme.text(lvl.color), ...(v2 ? { minWidth: 32 } : { width: 30 }), textAlign: "right", flexShrink: 0,
                }}
              >
                {Math.round(s.score)}
              </span>
            </div>
          );
        })}
      </div>
      )}
      {tip.node}
      {/* 4-檔戰情等級 legend */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "5px 14px",
          marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.p.borderSoft}`,
        }}
      >
        {PRESSURE_LEVELS.map((l) => (
          <span
            key={l.key}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: FONT_CJK, fontSize: fs(v2, 9.5), color: theme.p.textMuted,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: theme.fill(l.color) }} />
            {l.label}{" "}
            <span style={{ fontFamily: FONT_DATA, color: theme.p.textFaint }}>
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
  status: IntelQueryStatus;
  lastSuccessAt: number | null;
  sourceHealth: SourceHealthSummary;
  sourceHealthAvailable?: boolean;
  totalEvents: number | null;
  severeCount: number | null;
}

export function SituationOverview({
  pressure, smoothedScore, status, lastSuccessAt, sourceHealth, sourceHealthAvailable = true, totalEvents, severeCount,
}: Props) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const [open, setOpen] = useState(false);
  const stale = status === "error" && lastSuccessAt !== null;
  // v2：壓力指數資料時間（RPC updated_at）與新鮮度送標題列（stream 60 分）
  const asofMs = pressure.asof ? Date.parse(pressure.asof) : NaN;
  const fresh = useMonitorFreshness("situationOverview", {
    time: Number.isNaN(asofMs) ? null : asofMs,
  });
  // 未就緒時用中性等級，不拿預設分數上色
  const level = status === "ready" ? pressureLevel(smoothedScore) : NEUTRAL_LEVEL;
  const availability = status === "denied"
    ? "壓力指數無權限讀取"
    : status === "error"
      ? `壓力指數更新中斷${lastSuccessAt ? ` · 最後成功 ${new Date(lastSuccessAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}` : ""}`
      : status === "unknown" ? "壓力指數讀取中" : null;

  return (
    <Widget
      style={v2 ? { position: "relative" } : {
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: v2 ? 8 : 13 }}>
        {!v2 && <span style={{ width: 3, height: 12, borderRadius: RADIUS.sm, background: level.color }} />}
        {!v2 && (
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), letterSpacing: "1.5px", color: theme.p.textDefault,
            }}
          >
            戰情概覽 · PRESSURE INDEX
          </span>
        )}
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint, whiteSpace: "nowrap",
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
          <PressureRing score={smoothedScore} level={level} status={status} stale={stale || (v2 && status === "ready" && fresh.muted)} />
          <span
            style={{
              position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
              display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px",
              borderRadius: RADIUS.xl, background: theme.isDark ? "rgba(0,0,0,0.45)" : theme.neutral(0.06),
              border: `1px solid ${theme.p.borderSoft}`,
              fontFamily: FONT_CJK, fontSize: fs(v2, 8.5), color: theme.p.textMuted, whiteSpace: "nowrap",
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
              <IntelIcon d={ICON.chevDown} size={9} color={theme.p.textMuted} />
            </span>
          </span>
        </button>

        {/* TAIEX 2026-08-10 拆成獨立 widget 後這裡多出橫向空間 → 讓本欄吃滿，不留右側空洞 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1, minWidth: 150 }}>
          {status === "ready" || stale ? <>
            <CompareLine delta={pressure.vs_baseline} muted={stale} label={stale ? "最後成功值 · vs 基準" : "vs 平常週日同時段"} />
            <CompareLine delta={pressure.vs_1h_ago} muted={stale} label={stale ? "最後成功值 · vs 1 小時前" : "vs 1 小時前"} />
          </> : (
            <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textMuted }}>{availability}</span>
          )}
          <div style={{ height: 1, background: theme.p.borderSoft, margin: "1px 0" }} />
          <div style={{ display: "flex", gap: 18, justifyContent: "space-between", maxWidth: 420 }}>
            <MiniStat en="EVENTS" label="事件" zh="事件數" value={totalEvents ?? "—"} />
            <MiniStat
              en="SEVERE ≥3" label="嚴重" zh="嚴重（3 級以上）" value={severeCount ?? "—"}
              color={(severeCount ?? 0) > 0 ? theme.p.statusWarn : theme.isDark ? "#fff" : theme.p.textStrong}
            />
            <MiniStat
              en="SOURCES" label="來源" zh="資料來源"
              value={sourceHealthAvailable ? `${sourceHealth.ok}/${sourceHealth.total}` : "—"}
            />
          </div>
        </div>
      </div>

      {v2 && status === "ready" && fresh.reason && (
        <div style={{ marginTop: 8 }}>
          <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
        </div>
      )}
      {open && status === "ready" && <PressureDrawer signals={pressure.per_signal} />}
    </Widget>
  );
}
