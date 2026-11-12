/**
 * 圖例共用元件（design-system-map-layers §4.2，LG-1–LG-11，2026-09-28 拍板）。
 *
 * 結構：標題 → 內容列 → 註記。色票尺寸只在這裡定義；子圖例不要再手寫 width／height。
 * 文字色一律走 useLegendTheme()（暗／淡由 LegendPanel 的 Provider 決定）。
 */

import { useLocale } from "../../state/localeStore";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { COLORS, FONT_CJK, FONT_DATA, FONT_SIZE, FONT_WEIGHT, LIGHT, RADIUS } from "../../styles/designTokens";
import { MAP_SEAM, MISSING_HATCH, MOVING_POINT, POINT_STROKE, basemapLandColor } from "../../map/mapStyleScale";
import { compositeHex, normalizeColor, parseColor } from "../../map/colorContrast";

// ── 主題 ──────────────────────────────────────────────────
export interface LegendPalette {
  isDark: boolean;
  textStrong: string;
  textDefault: string;
  textMuted: string;
  textDim: string;
  bgSubtle: string;
  border: string;
  /** 面色票描邊：底圖色細縫（F-2）。 */
  seam: string;
  /** 點色票外環：同地圖點描邊（P-2；暗底淺色細環、淡底白）。 */
  pointRing: string;
  /** 移動物件平面點／箭頭的對比描邊（MOVING_POINT，P-2 例外）。 */
  movingStroke: string;
  /** 缺值斜線色（F-3 A／viz-library N1）。 */
  hatch: string;
}
/** 點色票外環＝地圖點描邊：暗底淺色細環（帶透明度），淡底維持白。 */
function compositeRing(isDark: boolean): string {
  if (!isDark) return MAP_SEAM.light;
  const rgb = parseColor(POINT_STROKE.color.dark)!.rgb.map((v) => Math.round(v * 255));
  return `rgba(${rgb.join(",")},${POINT_STROKE.opacity.dark})`;
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
  pointRing: compositeRing(true),
  movingStroke: MOVING_POINT.stroke.color.dark,
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
  pointRing: compositeRing(false),
  movingStroke: MOVING_POINT.stroke.color.light,
  hatch: `rgba(${MISSING_HATCH.rgb.light.join(",")},${MISSING_HATCH.alpha})`,
};
export const LegendThemeCtx = createContext<LegendPalette>(DARK_LEGEND);
export const useLegendTheme = () => useContext(LegendThemeCtx);

/**
 * LG-14：圖層目前的面填色透明度（LegendPanel 依 overlayRegistry 求值、統計圖例依 statisticsFillOpacity）。
 * 有值時 SwatchSquare（未指定 opacity 的實心面）與 SwatchSteps 改畫「色 × 透明度疊在底圖陸地色上」的合成色，
 * 外加 1px 面板邊框，透明度很低時色票位置仍看得到。null＝不知道透明度，維持原色票。
 */
export const LegendFillOpacityCtx = createContext<number | null>(null);

/**
 * C-4：圖層在目前底圖下被提亮過的顏色（darkContrast liftedColorMap，鍵為 normalizeColor 後的原色）。
 * SwatchDot／SwatchLine 查表換成地圖上實際畫的顏色，圖例與地圖同步。沒有對照（hook 自建圖層、未提亮）＝原色。
 */
export const LegendLiftCtx = createContext<ReadonlyMap<string, string> | null>(null);
export function useLegendColorMapper(): (color: string) => string {
  const map = useContext(LegendLiftCtx);
  return (color) => map?.get(normalizeColor(color)) ?? color;
}
export const useLegendColor = (color: string) => useLegendColorMapper()(color);
export const useLegendFillOpacity = () => useContext(LegendFillOpacityCtx);

/** LG-14 合成色：`alpha` 為 null 時回原色。 */
export function legendCompositeColor(color: string, alpha: number | null, isDark: boolean): string {
  return alpha === null ? color : compositeHex(color, basemapLandColor(isDark), alpha);
}

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
/**
 * 圖例標題。`zh` 傳目前語系的標題（`t("legend.<domain>.<id>")`，或用 `localizeLayerName` 借圖層名）；
 * `en` 是中文介面附的英文小字，外文介面主標題已是譯文，不再重複顯示。
 */
export function LegendTitle({ zh, en, style }: { zh: ReactNode; en?: string; style?: CSSProperties }) {
  const t = useLegendTheme();
  const { active } = useLocale();
  if (active !== "zh-TW") en = undefined;
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
export function SwatchDot({ color: rawColor, opacity = 0.9, stroke, strokeWidth = 1, glow }: { color: string; opacity?: number; stroke?: string; strokeWidth?: number; glow?: string }) {
  const t = useLegendTheme();
  const color = useLegendColor(rawColor);
  const d = LEGEND_SWATCH.dot;
  return <span aria-hidden="true" style={{ width: d, height: d, borderRadius: RADIUS.full, background: color, opacity, boxSizing: "border-box", border: stroke ? `${strokeWidth}px solid ${stroke}` : undefined, boxShadow: `${stroke ? "0 0 0 0 transparent" : `0 0 0 1px ${t.pointRing}`}${glow ? `, 0 0 5px ${glow}` : ""}`, flexShrink: 0, display: "inline-block" }} />;
}

/**
 * LG-2 面類別：12×10 方、圓角 2；outline 表示只有外框的面。
 * LG-14：沒指定 `opacity`、又在 LegendFillOpacityCtx 內時，畫合成色（不透明）＋1px 面板邊框。
 */
export function SwatchSquare({ color, outline = false, opacity, stroke }: { color: string; outline?: boolean; opacity?: number; stroke?: string }) {
  const t = useLegendTheme();
  const fillAlpha = useLegendFillOpacity();
  const s = LEGEND_SWATCH.square;
  const composite = !outline && opacity === undefined && fillAlpha !== null;
  return (
    <span
      aria-hidden="true"
      style={{
        width: s.width, height: s.height, borderRadius: s.radius, boxSizing: "border-box", flexShrink: 0, display: "inline-block",
        background: outline ? "transparent" : composite ? legendCompositeColor(color, fillAlpha, t.isDark) : color,
        border: outline ? `2px solid ${color}` : stroke ? `1px solid ${stroke}` : composite ? `1px solid ${t.border}` : "none",
        opacity: composite ? 1 : opacity ?? 0.9,
      }}
    />
  );
}

/**
 * LG-6 icon：方向箭頭（R6 段 3 移動物件平面模式，與地圖 SDF 箭頭同形狀），14px，
 * 描邊＝移動物件對比色（MOVING_POINT，同地圖 halo；P-2 例外）。
 * 尖端朝上＝北；地圖上依行進方向旋轉。
 */
export function SwatchArrow({ color }: { color: string }) {
  const t = useLegendTheme();
  const s = LEGEND_SWATCH.icon;
  return (
    <svg aria-hidden="true" width={s} height={s} viewBox="-1.2 -1.2 2.4 2.4" style={{ flexShrink: 0 }}>
      <polygon points="0,-1 0.8,0.9 0,0.45 -0.8,0.9" fill={color} stroke={t.movingStroke} strokeWidth={0.2} strokeLinejoin="round" />
    </svg>
  );
}

/** LG-4 線型：20px 線段；dash 同地圖 line-dasharray（線寬倍數）。 */
export function SwatchLine({ color: rawColor, width = 2, dash, opacity = 1 }: { color: string; width?: number; dash?: readonly number[]; opacity?: number }) {
  const color = useLegendColor(rawColor);
  const w = Math.max(LEGEND_SWATCH.line.minHeight, width);
  const h = Math.ceil(w) + 2;
  return (
    <svg aria-hidden="true" width={LEGEND_SWATCH.line.width} height={h} style={{ flexShrink: 0, opacity }}>
      <line x1={0} y1={h / 2} x2={LEGEND_SWATCH.line.width} y2={h / 2} stroke={color} strokeWidth={w} strokeDasharray={dash ? dash.map((d) => d * w).join(" ") : undefined} />
    </svg>
  );
}

/** LG-3 分級：等寬方塊列＋下方實際分界。LG-14：在 LegendFillOpacityCtx 內畫合成色，整列加 1px 面板邊框。 */
export function SwatchSteps({ colors, breaks }: { colors: readonly string[]; breaks?: readonly ReactNode[] }) {
  const t = useLegendTheme();
  const fillAlpha = useLegendFillOpacity();
  return (
    <div>
      <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", gap: 1, ...(fillAlpha === null ? {} : { border: `1px solid ${t.border}` }) }}>
        {colors.map((c, i) => <span key={`${c}:${i}`} style={{ height: LEGEND_SWATCH.steps.height, background: legendCompositeColor(c, fillAlpha, t.isDark) }} />)}
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

/**
 * LG-5 大小（三圓套疊）：比例圓（統計「呈現方式」＝比例圓）。三個參考值的圓底邊對齊、由大到小套疊，
 * 每個圓頂端拉一條細線到右側數值；直徑＝地圖實際直徑（固定 px、不隨縮放）。
 * - `fill`：實心（地圖單獨顯示比例圓時），描邊用面板邊框色。
 * - `ring`：空心圈（地圖疊在其他面量圖上時），描邊＝傳入色。
 * 數值由大到小傳入；`value` 是數字（等寬字），`suffix` 是量級與單位（「萬人」，CJK 字型，不包進 FONT_DATA）。
 */
export function LegendNestedCircles({ items, fill, ring }: { items: readonly { r: number; value: string; suffix?: string }[]; fill?: string; ring?: string }) {
  const t = useLegendTheme();
  const fillAlpha = useLegendFillOpacity();
  const max = Math.max(...items.map((x) => x.r), 1);
  const pad = LEGEND_SIZE_RING_WIDTH;
  const size = max * 2 + pad * 2;
  const leader = LEGEND_SWATCH.gap * 2;
  const minGap = 12;
  // 標籤 y＝圓頂；太近時往上推，避免小圓的數字疊在一起
  const tops: number[] = [];
  for (const x of items) {
    const top = size - pad - x.r * 2;
    const prev = tops[tops.length - 1];
    tops.push(prev !== undefined && top - prev < minGap ? prev + minGap : top);
  }
  const color = fill ? legendCompositeColor(fill, fillAlpha, t.isDark) : "transparent";
  return (
    <div style={{ position: "relative", height: Math.max(size, (tops[tops.length - 1] ?? 0) + minGap), marginTop: 4 }}>
      <svg aria-hidden="true" width={size + leader} height={size} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {items.map((x, i) => {
          const cy = size - pad - x.r;
          return (
            <g key={`${x.value}${x.suffix ?? ""}`}>
              <circle cx={pad + max} cy={cy} r={x.r} fill={color} stroke={ring ?? t.border} strokeWidth={ring ? LEGEND_SIZE_RING_WIDTH : 1} />
              <line x1={pad + max} y1={cy - x.r} x2={size + leader} y2={tops[i]!} stroke={t.textDim} strokeWidth={0.75} />
            </g>
          );
        })}
      </svg>
      {items.map((x, i) => (
        <span key={`${x.value}${x.suffix ?? ""}`} style={{ position: "absolute", left: size + leader + 3, top: tops[i]! - 6, fontSize: FONT_SIZE.xs, color: t.textMuted, lineHeight: "12px", whiteSpace: "nowrap" }}>
          <LegendNum>{x.value}</LegendNum>{x.suffix ? ` ${x.suffix}` : ""}
        </span>
      ))}
    </div>
  );
}

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
                  : { background: fill, boxShadow: `0 0 0 1px ${t.pointRing}` }),
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}><LegendNum>{x.label}</LegendNum></span>
          </div>
        ))}
      </div>
    </div>
  );
}
