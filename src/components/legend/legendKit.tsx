/**
 * 圖例共用元件（design-system-map-layers §4.2，LG-1–LG-11，2026-09-28 拍板）。
 *
 * 結構：標題 → 內容列 → 註記。色票尺寸只在這裡定義；子圖例不要再手寫 width／height。
 * 文字色一律走 useLegendTheme()（暗／淡由 LegendPanel 的 Provider 決定）。
 */

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { COLORS, FONT_CJK, FONT_DATA, FONT_SIZE, FONT_WEIGHT, LIGHT, RADIUS } from "../../styles/designTokens";
import { MAP_SEAM, MISSING_HATCH } from "../../map/mapStyleScale";

// ── 主題 ──────────────────────────────────────────────────
export interface LegendPalette {
  isDark: boolean;
  textStrong: string;
  textDefault: string;
  textMuted: string;
  textDim: string;
  bgSubtle: string;
  border: string;
  /** 色票描邊：同地圖點描邊的底圖色（P-2）。 */
  seam: string;
  /** 缺值斜線色（F-3 A／viz-library N1）。 */
  hatch: string;
}
export const DARK_LEGEND: LegendPalette = {
  isDark: true,
  textStrong: COLORS.textStrong,
  textDefault: COLORS.textDefault,
  textMuted: COLORS.textMuted,
  textDim: COLORS.textDim,
  bgSubtle: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.10)",
  seam: MAP_SEAM.dark,
  hatch: `rgba(${MISSING_HATCH.rgb.dark.join(",")},${MISSING_HATCH.alpha})`,
};
export const LIGHT_LEGEND: LegendPalette = {
  isDark: false,
  textStrong: LIGHT.textStrong,
  textDefault: LIGHT.textDefault,
  textMuted: LIGHT.textMuted,
  textDim: LIGHT.textDim,
  bgSubtle: LIGHT.fillSubtle,
  border: LIGHT.border,
  seam: MAP_SEAM.light,
  hatch: `rgba(${MISSING_HATCH.rgb.light.join(",")},${MISSING_HATCH.alpha})`,
};
export const LegendThemeCtx = createContext<LegendPalette>(DARK_LEGEND);
export const useLegendTheme = () => useContext(LegendThemeCtx);

/** LG-9：停靠 popup 開著時為 true，註記與來源收起，只留標題與色票。 */
export const LegendCompactCtx = createContext(false);
export const useLegendCompact = () => useContext(LegendCompactCtx);

// ── 尺寸（LG-1–LG-8）────────────────────────────────────
export const LEGEND_SWATCH = {
  dot: 10,
  square: { width: 12, height: 10, radius: RADIUS.sm },
  line: { width: 20, minHeight: 2 },
  steps: { height: 8 },
  gradient: { height: 8 },
  hatch: { width: 16, height: 12 },
  icon: 14,
  gap: 6,
} as const;

// ── 標題（LG-11：中文在前、英文小字在後、不轉大寫）─────
export function LegendTitle({ zh, en, style }: { zh: ReactNode; en?: string; style?: CSSProperties }) {
  const t = useLegendTheme();
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap", marginBottom: 4, ...style }}>
      <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: t.textStrong }}>{zh}</span>
      {en && <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 0.3 }}>{en}</span>}
    </div>
  );
}

// ── 列 ────────────────────────────────────────────────────
export function LegendRow({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  const t = useLegendTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: LEGEND_SWATCH.gap }}>
      {swatch}
      <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, lineHeight: 1.35 }}>{children}</span>
    </div>
  );
}

/** 註記、方法、來源（LG-9：compact 時不顯示）。 */
export function LegendNote({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const t = useLegendTheme();
  if (useLegendCompact()) return null;
  return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.4, ...style }}>{children}</div>;
}

/** 數字（分界、計數、單位）：等寬＋tabular-nums。 */
export function LegendNum({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{children}</span>;
}

// ── 色票 ──────────────────────────────────────────────────
/** LG-1 點類別：10×10 圓，1px 底圖色描邊。 */
export function SwatchDot({ color, opacity = 0.9, stroke, strokeWidth = 1, glow }: { color: string; opacity?: number; stroke?: string; strokeWidth?: number; glow?: string }) {
  const t = useLegendTheme();
  const d = LEGEND_SWATCH.dot;
  return <span aria-hidden="true" style={{ width: d, height: d, borderRadius: RADIUS.full, background: color, opacity, boxSizing: "border-box", border: stroke ? `${strokeWidth}px solid ${stroke}` : undefined, boxShadow: `${stroke ? "0 0 0 0 transparent" : `0 0 0 1px ${t.seam}`}${glow ? `, 0 0 5px ${glow}` : ""}`, flexShrink: 0, display: "inline-block" }} />;
}

/** LG-2 面類別：12×10 方、圓角 2；outline 表示只有外框的面。 */
export function SwatchSquare({ color, outline = false, opacity = 0.9, stroke }: { color: string; outline?: boolean; opacity?: number; stroke?: string }) {
  const s = LEGEND_SWATCH.square;
  return (
    <span
      aria-hidden="true"
      style={{
        width: s.width, height: s.height, borderRadius: s.radius, boxSizing: "border-box", flexShrink: 0, display: "inline-block",
        background: outline ? "transparent" : color, border: outline ? `2px solid ${color}` : stroke ? `1px solid ${stroke}` : "none", opacity,
      }}
    />
  );
}

/** LG-4 線型：20px 線段；dash 同地圖 line-dasharray（線寬倍數）。 */
export function SwatchLine({ color, width = 2, dash, opacity = 1 }: { color: string; width?: number; dash?: readonly number[]; opacity?: number }) {
  const w = Math.max(LEGEND_SWATCH.line.minHeight, width);
  const h = Math.ceil(w) + 2;
  return (
    <svg aria-hidden="true" width={LEGEND_SWATCH.line.width} height={h} style={{ flexShrink: 0, opacity }}>
      <line x1={0} y1={h / 2} x2={LEGEND_SWATCH.line.width} y2={h / 2} stroke={color} strokeWidth={w} strokeDasharray={dash ? dash.map((d) => d * w).join(" ") : undefined} />
    </svg>
  );
}

/** LG-3 分級：等寬方塊列＋下方實際分界。 */
export function SwatchSteps({ colors, breaks }: { colors: readonly string[]; breaks?: readonly ReactNode[] }) {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", gap: 1 }}>
        {colors.map((c, i) => <span key={`${c}:${i}`} style={{ height: LEGEND_SWATCH.steps.height, background: c }} />)}
      </div>
      {breaks && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
          {breaks.map((b, i) => <LegendNum key={i}>{b}</LegendNum>)}
        </div>
      )}
    </div>
  );
}

/** LG-8 熱區／影像：漸層條＋兩端（或多點）標籤。 */
export function SwatchGradient({ gradient, labels, stroke }: { gradient: string; labels?: readonly ReactNode[]; stroke?: string }) {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ height: LEGEND_SWATCH.gradient.height, borderRadius: RADIUS.sm, background: gradient, border: stroke ? `1px solid ${stroke}` : undefined }} />
      {labels && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: FONT_SIZE.xs, color: t.textDim }}>
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

/** LG-7 缺值（單向細斜線）／遮蔽（交叉斜線），同地圖 hatch。 */
export function SwatchHatch({ kind = "missing" }: { kind?: "missing" | "suppressed" }) {
  const t = useLegendTheme();
  const s = LEGEND_SWATCH.hatch;
  const one = `repeating-linear-gradient(135deg, ${t.hatch} 0 1px, transparent 1px 5px)`;
  const background = kind === "suppressed" ? `${one}, repeating-linear-gradient(45deg, ${t.hatch} 0 1px, transparent 1px 5px)` : one;
  return <span aria-hidden="true" style={{ width: s.width, height: s.height, boxSizing: "border-box", border: `1px solid ${t.border}`, background, flexShrink: 0, display: "inline-block" }} />;
}

/**
 * LG-5 大小：三個參考值的圓，直徑＝地圖實際直徑（R6 段 2 平面圓點固定 px、不隨縮放，任一縮放都對得上）。
 * - 預設：`fill` 實心＋底圖色細縫（例：機組出力用中性灰，表示大小與燃料色無關）。
 * - `ring`：空心圈，描邊＝傳入色（例：水庫容量用水庫面的水系色）。圖層另有灰色「無資料」類別時用這個，避免大小圈跟無資料撞色。
 */
export const LEGEND_SIZE_RING_WIDTH = 1.5;
export function LegendSizeRow({ title, items, fill, ring }: { title: string; items: readonly { r: number; label: string }[]; fill?: string; ring?: string }) {
  const t = useLegendTheme();
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        {items.map((x) => (
          <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span
              aria-hidden="true"
              style={{
                width: x.r * 2, height: x.r * 2, borderRadius: RADIUS.full, boxSizing: "border-box", flexShrink: 0, display: "inline-block",
                ...(ring
                  ? { background: "transparent", border: `${LEGEND_SIZE_RING_WIDTH}px solid ${ring}` }
                  : { background: fill, boxShadow: `0 0 0 1px ${t.seam}` }),
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}><LegendNum>{x.label}</LegendNum></span>
          </div>
        ))}
      </div>
    </div>
  );
}
