import { useMemo } from "react";
import { COLORS, FONT_DATA } from "../intelTokens";
import { RADIUS } from "../../../styles/designTokens";

/**
 * 災害四卡共用的迷你趨勢柱狀圖 —— **柱高 = 量、柱色 = 強度**。
 *
 * 視覺公式借自共機卡的 `TrendRow`（`PlaBoard.tsx:184-277`），是站上唯一同時編碼
 * 「量」與「強度」兩個維度的樣式。折線類只能表現一個維度，規模／強度得另外標。
 *
 * ⚠️ 為什麼寫死 `height` 而不是 `flex: 1`（PlaBoard 踩過的坑，同一個雷）：
 * 柱高是 `height: X%`，百分比只認**父層的確定高度**。四張災害卡都是
 * `fit: "content"`（整條鏈沒有固定高），寫成 flex 的話百分比解不出來 → 柱子全塌成 0。
 */

/** 一根柱子。四個主題的 loader 都轉成這個形狀，元件不認識任何主題語意 */
export interface HazardBar {
  /** x 軸標籤（顯示用，兩端會印出來）。**不保證唯一** —— 唯一性看 `key` */
  label: string;
  /**
   * React key。省略則退回用 `label`。
   * 標籤粒度比資料粗時必須給（例如颱風同一小時可能有兩個觀測點，
   * 標籤都是 `08/13 12`，共用 label 當 key 會撞、React 會重用或掉節點）。
   */
  key?: string;
  /** 柱高的量。`null` = 該格無資料（畫成灰樁，與「真的是 0」區分開） */
  value: number | null;
  /** 強度分級，對應 `levelColors` 的 index。超出範圍取最後一色 */
  level: number;
  /** tooltip 補充（例如「最大 M5.2」「28 站回報」） */
  note?: string;
}

interface Props {
  bars: HazardBar[];
  /** 分級色盤，`index = level`。至少一色 */
  levelColors: string[];
  /** 圖區高度 px。四卡在 split 只有約 200px 寬，44 是不搶版面又看得出形狀的值 */
  height?: number;
  /** 標題列，例如「14D · 次數（柱）／規模（色）」 */
  caption: string;
  /** 中央補充，例如「最高 12 次」。省略則只顯示兩端日期 */
  footer?: string;
  /** 量的單位，進 tooltip 用（例如「次」「µSv/h」） */
  unit?: string;
}

export function HazardTrendBars({
  bars, levelColors, height = 44, caption, footer, unit = "",
}: Props) {
  const max = useMemo(() => {
    const vals = bars.map((b) => b.value).filter((v): v is number => v !== null);
    // 比例尺用「本區間最大值」：跨主題共用元件，沒有全域基準可依。
    // 代價是換資料就換 y 軸尺度 → 所以 footer 一定要印出實際最大值。
    //
    // ⚠️ 不可寫成 `Math.max(...vals, 1)` —— 那個 1 會變成小數單位的樓地板：
    // 輻射是 µSv/h（自然背景 0.039–0.072），尺度被撐成 1 之後每根柱都算出
    // 5–7% 高、全部塌成等高殘渣，正好毀掉「有沒有離開自然背景」這個唯一看點。
    // 1 只在「全部是 0」時需要（避免除以 0）。
    if (!vals.length) return 1;
    const m = Math.max(...vals);
    return m > 0 ? m : 1;
  }, [bars]);

  if (!bars.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: 8.5, letterSpacing: "0.6px",
          color: COLORS.textFaint, whiteSpace: "nowrap", overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {caption}
      </span>
      {/* flex: "none" + 確定 height：見檔頭說明，改成 flex:1 柱子會全塌 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height, flex: "none" }}>
        {bars.map((b) => {
          if (b.value === null) {
            return (
              <div
                key={b.key ?? b.label}
                title={`${b.label} 無資料`}
                style={{
                  flex: 1, minWidth: 0, height: "100%",
                  background: "rgba(255,255,255,0.06)", borderRadius: 1,
                }}
              />
            );
          }
          const pct = (b.value / max) * 100;
          const color = levelColors[Math.min(b.level, levelColors.length - 1)] ?? levelColors[0]!;
          return (
            <div
              key={b.key ?? b.label}
              title={`${b.label}｜${b.value}${unit}${b.note ? `｜${b.note}` : ""}`}
              style={{
                flex: 1, minWidth: 0, height: "100%",
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
              }}
            >
              {/* 0 也要看得見（1.5% 的底線），否則「當天零次」與「沒資料」在圖上長一樣 */}
              <div
                style={{
                  height: `${Math.max(pct, b.value === 0 ? 1.5 : 3)}%`,
                  background: color,
                  borderRadius: `${RADIUS.sm}px ${RADIUS.sm}px 0 0`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex", justifyContent: "space-between", gap: 4,
          fontFamily: FONT_DATA, fontSize: 8, color: COLORS.textFaint,
        }}
      >
        <span>{bars[0]?.label}</span>
        {footer && <span style={{ textAlign: "center" }}>{footer}</span>}
        <span>{bars[bars.length - 1]?.label}</span>
      </div>
    </div>
  );
}
