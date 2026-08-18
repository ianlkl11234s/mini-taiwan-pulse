import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BORDER,
  COLORS,
  ELEVATION,
  FONT_DATA,
  FONT_SIZE,
  FONT_WEIGHT,
  RADIUS,
  SPACING,
  SURFACE,
} from "../styles/designTokens";

/**
 * 圖表 hover tooltip 共用基礎設施（監看模式 35 個圖表實例共用）
 *
 * 套用指南（含 SVG／div 柱狀條兩種範例）：`docs/features/chart-hover-tooltip/README.md`
 * 套用清單與分工規則：`docs/features/chart-hover-tooltip/backlog.md`
 *
 * ## 為什麼是「DOM portal 浮層」而不是「SVG 內繪」
 *
 * 1. **載體有兩種**：站上圖表半數以上是 `div + height:X%` 的柱／條（`HazardTrendBars`、
 *    `PlaBoard` 的 TrendRow…），沒有 SVG 座標系可用；SVG 內繪的做法（`TimeseriesSparkline`
 *    既有那套）在這些圖上根本無從落點。DOM 浮層兩種載體通吃。
 * 2. **卡片會裁切**：`MonitorPanel.tsx:132/905` 非 `fit:"content"` 的卡是 `overflow:"auto"`、
 *    `LiveWall.tsx:332` 是 `overflow:"hidden"`。浮層若留在卡片 DOM 內必被裁掉。
 * 3. **祖先有 `backdrop-filter`**：filter/transform 祖先會變成 `position:fixed` 的 containing
 *    block，浮層留在卡內時 `fixed` 也不保險。
 *
 * → 三點合起來只有一個解：**portal 到 `document.body` + `position:fixed`**。
 *    代價是浮層脫離捲動流，所以本檔內建「捲動即隱藏」（見 `useChartTooltip` 的 scroll listener）。
 *    好處是**呼叫端容器零條件**：不必加 `position:relative`、不必解 `overflow:hidden`。
 */

/** tooltip 的一列：`● 標籤 數值`。dot / label 皆可省略（單序列圖常只有數值） */
export interface ChartTooltipRow {
  /** 色點顏色（對應該序列的線色／柱色）；不傳 = 不畫點 */
  dot?: string;
  /** 序列名稱（雙序列圖、堆疊條用來區分）；不傳 = 只顯示數值 */
  label?: string;
  /** 已格式化好的數值字串（可用本檔 `fmtChartValue`） */
  value: string;
}

/** tooltip 內容：標題列（通常是時間／類別）+ 0..n 個數值列 */
export interface ChartTooltipContent {
  /** 標題（例：`8/16 14:00`、`基隆市`）；不傳 = 不畫標題列 */
  title?: string;
  rows: ChartTooltipRow[];
  /** 補充說明（灰字小行，例：「28 站回報」）；不傳 = 不畫 */
  note?: string;
}

/** `bind()` 回傳的事件 props，直接展開到 SVG／div 上 */
export interface ChartTooltipHandlers {
  onMouseMove: (e: { clientX: number; clientY: number }) => void;
  onMouseLeave: () => void;
}

export interface ChartTooltipApi {
  /** 手動顯示（SVG 圖：自己算出 hover 到第幾筆之後呼叫） */
  show: (clientX: number, clientY: number, content: ChartTooltipContent) => void;
  hide: () => void;
  /** 一行綁定（div 柱狀條：直接展開到每根柱子上）。content 可傳 lazy function 省掉每次 render 的字串組裝 */
  bind: (content: ChartTooltipContent | (() => ChartTooltipContent)) => ChartTooltipHandlers;
  /** 把它 render 在元件回傳值的任一位置（實際會 portal 到 document.body） */
  node: ReactNode;
  visible: boolean;
}

/** 浮層 z-index：站上最高的是 AdminPanel 10001，浮層必須壓在所有面板之上 */
const TOOLTIP_Z = 10050;
/** 游標與浮層的間距 */
const CURSOR_GAP = 12;
/** 浮層與視窗邊緣的最小留白 */
const VIEWPORT_MARGIN = 6;

/**
 * 浮層落點計算（純函式，可單元測試）。
 *
 * 預設落在游標**右上**；靠近右緣往左翻、靠近上緣往下翻，最後再 clamp 進視窗，
 * 確保極窄視窗（浮層比視窗還寬）也不會跑出畫面外。
 */
export function computeTooltipPlacement(input: {
  cursorX: number;
  cursorY: number;
  boxW: number;
  boxH: number;
  viewportW: number;
  viewportH: number;
  gap?: number;
  margin?: number;
}): { left: number; top: number } {
  const { cursorX, cursorY, boxW, boxH, viewportW, viewportH } = input;
  const gap = input.gap ?? CURSOR_GAP;
  const margin = input.margin ?? VIEWPORT_MARGIN;

  // 右緣翻轉
  let left = cursorX + gap;
  if (left + boxW > viewportW - margin) left = cursorX - gap - boxW;
  // 上緣翻轉
  let top = cursorY - gap - boxH;
  if (top < margin) top = cursorY + gap;

  // 翻轉後仍出界（浮層大於可用空間）→ clamp
  left = Math.max(margin, Math.min(left, viewportW - margin - boxW));
  top = Math.max(margin, Math.min(top, viewportH - margin - boxH));
  return { left, top };
}

/**
 * 圖表數值格式化（比照 `TimeseriesSparkline` 的 tooltip）：
 * 四位數以上補千分位、單位前留空格（`%` 除外）、其餘依量級決定小數位。
 *
 * ⚠️ **整數保持整數**：站上大宗是計數類（次／件／人），`0` 顯示成 `0.00 次` 很違和。
 * 需要固定小數位的量（例如輻射 µSv/h 要 3 位）請呼叫端自己 `toFixed(3)` 後傳字串，
 * 本函式是便利預設不是強制。
 */
export function fmtChartValue(v: number, unit = ""): string {
  const abs = Math.abs(v);
  const num = Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : abs >= 1000
      ? Math.round(v).toLocaleString("en-US")
      : abs >= 100
        ? v.toFixed(0)
        : abs >= 10
          ? v.toFixed(1)
          : v.toFixed(2);
  if (!unit) return num;
  return unit === "%" ? `${num}${unit}` : `${num} ${unit}`;
}

interface TipState {
  x: number;
  y: number;
  content: ChartTooltipContent;
}

/**
 * 圖表 hover tooltip hook。
 *
 * ```tsx
 * const tip = useChartTooltip();
 * return (
 *   <div>
 *     {bars.map((b, i) => (
 *       <div key={i} {...tip.bind({ title: b.label, rows: [{ dot: c, value: fmtChartValue(b.v, "件") }] })} />
 *     ))}
 *     {tip.node}
 *   </div>
 * );
 * ```
 */
export function useChartTooltip(): ChartTooltipApi {
  const [state, setState] = useState<TipState | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const show = useCallback((clientX: number, clientY: number, content: ChartTooltipContent) => {
    setState({ x: clientX, y: clientY, content });
  }, []);

  const hide = useCallback(() => {
    setState(null);
    setSize(null);
  }, []);

  const bind = useCallback(
    (content: ChartTooltipContent | (() => ChartTooltipContent)): ChartTooltipHandlers => ({
      onMouseMove: (e) => show(e.clientX, e.clientY, typeof content === "function" ? content() : content),
      onMouseLeave: hide,
    }),
    [show, hide],
  );

  // 量到實際尺寸才定位（避免像舊 SVG tooltip 用字元寬度估算，中英混排會估錯）
  useLayoutEffect(() => {
    if (!state) return;
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize((prev) => (prev && prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
  }, [state]);

  /**
   * 捲動即隱藏：浮層是 `position:fixed`，卡片容器（`overflow:auto`）在游標不動時捲動，
   * 浮層會停在舊座標變成孤兒。capture 階段才聽得到內層容器的 scroll（scroll 不冒泡）。
   */
  useEffect(() => {
    if (!state) return;
    const onScroll = () => hide();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [state, hide]);

  let node: ReactNode = null;
  if (state && typeof document !== "undefined") {
    const pos =
      size != null
        ? computeTooltipPlacement({
            cursorX: state.x,
            cursorY: state.y,
            boxW: size.w,
            boxH: size.h,
            viewportW: window.innerWidth,
            viewportH: window.innerHeight,
          })
        : { left: state.x + CURSOR_GAP, top: state.y };

    node = createPortal(
      <div
        ref={boxRef}
        data-testid="chart-hover-tooltip"
        style={{
          position: "fixed",
          left: pos.left,
          top: pos.top,
          zIndex: TOOLTIP_Z,
          pointerEvents: "none",
          // 量到尺寸前先藏起來，避免第一幀閃在錯的位置
          visibility: size ? "visible" : "hidden",
          background: SURFACE.strong,
          border: `1px solid ${BORDER.mid}`,
          borderRadius: RADIUS.lg,
          boxShadow: ELEVATION.sm,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          padding: "7px 9px",
          maxWidth: 260,
          display: "flex",
          flexDirection: "column",
          gap: SPACING.xs,
        }}
      >
        {state.content.title && (
          <div
            style={{
              fontFamily: FONT_DATA,
              fontSize: FONT_SIZE.sm,
              fontWeight: FONT_WEIGHT.bold,
              color: COLORS.textStrong,
              whiteSpace: "nowrap",
            }}
          >
            {state.content.title}
          </div>
        )}
        {state.content.rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACING.sm,
              fontFamily: FONT_DATA,
              fontSize: FONT_SIZE.sm,
              color: COLORS.textDefault,
              whiteSpace: "nowrap",
            }}
          >
            {row.dot && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: RADIUS.full,
                  background: row.dot,
                  flexShrink: 0,
                }}
              />
            )}
            {row.label && <span style={{ color: COLORS.textMuted }}>{row.label}</span>}
            <span style={{ marginLeft: "auto", fontWeight: FONT_WEIGHT.semibold }}>{row.value}</span>
          </div>
        ))}
        {state.content.note && (
          <div style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
            {state.content.note}
          </div>
        )}
      </div>,
      document.body,
    );
  }

  return { show, hide, bind, node, visible: state != null };
}
