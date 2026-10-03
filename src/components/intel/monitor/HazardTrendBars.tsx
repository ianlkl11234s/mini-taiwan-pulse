import { useMemo } from "react";
import { fs } from "./monitorFont";
import { useMonitorV2 } from "./monitorStyle";
import { MON_CHART_H, type MonChartTier } from "./monitorChart";
import { COLORS, FONT_DATA } from "../intelTokens";
import { RADIUS } from "../../../styles/designTokens";
import { useMonitorTheme } from "./monitorTheme";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";

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
  /**
   * 子量（選填）：疊在柱子底部、用 `partColor` 實心畫，其餘段維持 level 色
   * （例：共機柱＝總架次，part＝越中線架次）。`null`／省略＝不畫。
   */
  part?: number | null;
}

interface Props {
  bars: HazardBar[];
  /** 分級色盤，`index = level`。至少一色 */
  levelColors: string[];
  /** 圖區高度 px。四卡在 split 只有約 200px 寬，44 是不搶版面又看得出形狀的值 */
  height?: number;
  /** 監看圖高三階（spec §5.35 B1）：有給時圖區高度＝`MON_CHART_H[tier]`，`height` 被忽略 */
  heightTier?: MonChartTier;
  /** 標題列，例如「14D · 次數（柱）／規模（色）」。v2 `bare` 時不畫 */
  caption?: string;
  /** 中央補充，例如「最高 12 次」。省略則只顯示兩端日期 */
  footer?: string;
  /** 量的單位，進 tooltip 用（例如「次」「µSv/h」） */
  unit?: string;
  /**
   * 點柱回呼。有給才會出現 pointer 游標與 hover 反白 —— 沒有互動的圖不該假裝可點。
   * 再點同一根由呼叫端決定是否取消（元件不管選取狀態，只回報點到誰）。
   */
  onSelectBar?: (bar: HazardBar) => void;
  /** 目前選中的 `key ?? label`，會給該柱一塊反白底 */
  selectedKey?: string | null;
  /** 小倍數列用（spec §5.35 F3，只在監看新版生效）：不畫 caption、footer 與首尾日期 */
  bare?: boolean;
  /** 比例尺上限（同一把尺用）；不傳＝本區間最大值 */
  maxValue?: number | null;
  /** 子量（`HazardBar.part`）的顏色，傳 token 值 */
  partColor?: string;
  /** 子量在 tooltip 的名稱，例如「越中線」 */
  partLabel?: string;
}

/**
 * 選中標記用外框不用填底 —— 填底會整格罩上一層灰，把柱子本身的分級色蓋掉，
 * 看起來就像「無資料灰樁」，正好與它要表達的意思相反。
 */
const SELECTED_OUTLINE = (picked: boolean, selectedOutline: string) =>
  picked
    ? { outline: `1px solid ${selectedOutline}`, outlineOffset: -1, borderRadius: 2 }
    : null;

const NOWRAP = { whiteSpace: "nowrap" } as const;

export function HazardTrendBars({
  bars, levelColors, height: heightProp = 44, heightTier, caption, footer, unit = "",
  onSelectBar, selectedKey = null, bare: bareProp = false, maxValue = null, partColor: partColorProp = COLORS.accent, partLabel = "",
}: Props) {
  const v2 = useMonitorV2();
  // P5 主題：暗色值與改版前相同；淡色時資料色加深（D2）、灰樁換極性（X1）
  const theme = useMonitorTheme();
  const partColor = theme.fill(partColorProp);
  // bare 只在監看新版生效（舊版畫面不可變）
  const bare = v2 && bareProp;
  // 只在監看新版生效（舊版維持原 height）
  const height = v2 && heightTier ? MON_CHART_H[heightTier] : heightProp;
  const tip = useChartTooltip();
  const autoMax = useMemo(() => {
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
  // maxValue：小倍數列要「同一把尺」時由呼叫端傳共同上限（各列取所有列的最大值）
  const max = maxValue != null && maxValue > 0 ? maxValue : autoMax;

  if (!bars.length) return null;

  return (
    // bare：上下各留 2px，與 TimeseriesSparkline bare 同高（mini 總高 28），小倍數列混用折線與柱時列高一致
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: bare ? "2px 0" : undefined }}>
      {!bare && caption != null && <span
        style={{
          fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), letterSpacing: "0.6px",
          color: theme.p.textFaint, whiteSpace: v2 ? "normal" : "nowrap", overflow: "hidden",
          textOverflow: v2 ? "clip" : "ellipsis",
        }}
      >
        {caption}
      </span>}
      {/* flex: "none" + 確定 height：見檔頭說明，改成 flex:1 柱子會全塌 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height, flex: "none" }}>
        {bars.map((b) => {
          const barKey = b.key ?? b.label;
          const picked = selectedKey != null && selectedKey === barKey;
          // 有 onSelectBar 才掛點擊與 pointer 游標：沒有互動的圖不該假裝可點
          const onClick = onSelectBar ? () => onSelectBar(b) : undefined;
          if (b.value === null) {
            return (
              <div
                key={barKey}
                {...tip.bind(() => ({ title: b.label, rows: [{ value: "無資料" }], note: b.note }))}
                onClick={onClick}
                style={{
                  flex: 1, minWidth: 0, height: "100%",
                  background: theme.chart.stub,
                  borderRadius: 1,
                  cursor: onClick ? "pointer" : undefined,
                  ...SELECTED_OUTLINE(picked, theme.chart.selected),
                }}
              />
            );
          }
          const pct = (b.value / max) * 100;
          const color = theme.fill(levelColors[Math.min(b.level, levelColors.length - 1)] ?? levelColors[0]!);
          const value = b.value;
          // 子量：截在 [0, value]。part > value 只可能是上游資料不一致（子集合不會大於總數），
          // 畫出來會讓子段衝出柱頂、看起來比總量還高，所以截到 value，tooltip 仍印截後的值。
          const part = b.part == null || !Number.isFinite(b.part) ? null : Math.min(Math.max(b.part, 0), value);
          return (
            <div
              key={barKey}
              {...tip.bind(() => ({
                title: b.label,
                // 整數才走 fmtChartValue 補千分位（落雷/地震/颱風計數類）。
                // 非整數維持原樣字串接 unit —— 避免 fmtChartValue 對 <10 的值
                // 強制 toFixed(2) 把輻射卡的 3 位小數（例如 0.058）壓成 2 位。
                rows: [{
                  dot: color,
                  value: Number.isInteger(value)
                    ? fmtChartValue(value, unit.trim())
                    : `${value}${unit}`,
                }, ...(part != null ? [{
                  dot: partColor,
                  value: `${partLabel ? `${partLabel} ` : ""}${Number.isInteger(part) ? fmtChartValue(part, unit.trim()) : `${part}${unit}`}`,
                }] : [])],
                note: b.note,
              }))}
              onClick={onClick}
              style={{
                flex: 1, minWidth: 0, height: "100%",
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
                cursor: onClick ? "pointer" : undefined,
                ...SELECTED_OUTLINE(picked, theme.chart.selected),
              }}
            >
              {/* 0 也要看得見（1.5% 的底線），否則「當天零次」與「沒資料」在圖上長一樣 */}
              {part == null ? (
                <div
                  style={{
                    height: `${Math.max(pct, b.value === 0 ? 1.5 : 3)}%`,
                    background: color,
                    borderRadius: `${RADIUS.sm}px ${RADIUS.sm}px 0 0`,
                  }}
                />
              ) : (() => {
                // 子段高度＝part / max（與總柱同一比例尺）；level 段補足到總柱高
                const total = Math.max(pct, b.value === 0 ? 1.5 : 3);
                const partPct = (part / max) * 100;
                const restPct = Math.max(0, total - partPct);
                const topRadius = `${RADIUS.sm}px ${RADIUS.sm}px 0 0`;
                return (
                  <>
                    {restPct > 0 && <div style={{ height: `${restPct}%`, background: color, borderRadius: topRadius }} />}
                    {partPct > 0 && (
                      <div
                        data-testid="hazard-bar-part"
                        style={{ height: `${partPct}%`, background: partColor, borderRadius: restPct > 0 ? 0 : topRadius }}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          );
        })}
      </div>
      {!bare && <div
        style={{
          display: "flex", justifyContent: "space-between", gap: 4,
          fontFamily: FONT_DATA, fontSize: fs(v2, 8), color: theme.p.textFaint,
          // v2：窄格放不下時整項換行，日期與 footer 本身不斷行
          ...(v2 ? { flexWrap: "wrap" as const, rowGap: 2 } : null),
        }}
      >
        <span style={v2 ? NOWRAP : undefined}>{bars[0]?.label}</span>
        {footer && <span style={v2 ? { ...NOWRAP, textAlign: "center" } : { textAlign: "center" }}>{footer}</span>}
        <span style={v2 ? NOWRAP : undefined}>{bars[bars.length - 1]?.label}</span>
      </div>}
      {tip.node}
    </div>
  );
}
