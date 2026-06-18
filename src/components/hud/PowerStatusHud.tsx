import { COLORS, FONT_DATA, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import {
  RESERVE_INDICATOR_COLORS,
  RESERVE_INDICATOR_LABELS,
  type PowerDashboard,
} from "../../data/energyLoader";

/**
 * 供電燈號 KPI 卡 (layer 2)
 *
 * 顯示：
 *   - 燈號圓（G/Y/O/R 4 色）+ 文字標籤
 *   - 備轉率（%） big number
 *   - 即時負載 / 供電能力（MW）
 *   - 觀測時間（hh:mm）
 *
 * 由 App.tsx 套用絕對定位（top-left）並 toggle 掛載。
 */

interface Props {
  data: PowerDashboard | null;
  isDark: boolean;
}

function fmtMW(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)} 萬 kW`;
  return `${Math.round(v)} MW`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Number(v).toFixed(1)}%`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function PowerStatusHud({ data, isDark }: Props) {
  const status = data?.status ?? null;
  const ind = (status?.reserve_indicator ?? "").toUpperCase();
  const indColor = RESERVE_INDICATOR_COLORS[ind] ?? "#9ca3af";
  const indLabel = RESERVE_INDICATOR_LABELS[ind] ?? "資料載入中";

  return (
    <div
      style={{
        background: isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: RADIUS.xl,
        padding: "10px 14px",
        fontFamily: FONT_DATA,
        color: isDark ? COLORS.textStrong : "#222",
        minWidth: 200,
        boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.12)",
        border: `1px solid ${indColor}40`,
      }}
    >
      {/* Header: title + 燈號 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: FONT_SIZE.sm,
            color: isDark ? COLORS.textMuted : "#555",
            letterSpacing: 1,
          }}
        >
          全國供電 · 即時
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: indColor,
              boxShadow: `0 0 10px ${indColor}cc`,
              display: "inline-block",
            }}
            aria-label={`indicator ${ind}`}
          />
          <span style={{ fontSize: FONT_SIZE.base, fontWeight: 700, color: indColor }}>
            {indLabel}
          </span>
        </span>
      </div>

      {/* 備轉率 big number */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: indColor,
            lineHeight: 1,
          }}
        >
          {fmtPct(status?.reserve_rate_pct)}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: isDark ? COLORS.textMuted : "#666" }}>
          備轉率
        </span>
      </div>

      {/* 即時負載 / 供電能力 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          fontSize: FONT_SIZE.sm,
          marginBottom: 4,
        }}
      >
        <div>
          <div style={{ color: isDark ? COLORS.textMuted : "#666" }}>即時負載</div>
          <div style={{ fontWeight: 600 }}>{fmtMW(status?.curr_load_mw)}</div>
        </div>
        <div>
          <div style={{ color: isDark ? COLORS.textMuted : "#666" }}>供電能力</div>
          <div style={{ fontWeight: 600 }}>{fmtMW(status?.realtime_supply_capacity_mw ?? status?.supply_capacity_mw)}</div>
        </div>
      </div>

      {/* Footer: 觀測時間 */}
      {status?.observed_at && (
        <div
          style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: `1px dashed ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
            fontSize: FONT_SIZE.sm,
            color: isDark ? COLORS.textMuted : "#888",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>觀測 {fmtTime(status.observed_at)}</span>
          {status.peak_hour_range && <span>尖峰 {status.peak_hour_range}</span>}
        </div>
      )}
    </div>
  );
}
