# 圖表 hover tooltip 共用基礎設施 — 套用指南

> 元件：[`src/components/ChartHoverTooltip.tsx`](../../../src/components/ChartHoverTooltip.tsx)
> 單元測試：`src/components/__tests__/chartHoverTooltip.test.ts`
> 套用清單／分工規則：[`backlog.md`](./backlog.md)
> 目的：讓監看模式的圖表用**同一套** hover 顯示數值，取代目前四種各寫各的做法。
> 盤點結果：全站 **35 個圖表實例**，已完成 5、待套用 30（div 柱狀條 21／SVG 7／自製待收斂 2）。

## 一分鐘上手

```tsx
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";

function MyChart({ bars }: { bars: Bar[] }) {
  const tip = useChartTooltip();
  return (
    <div style={{ display: "flex", gap: 2, height: 60 }}>
      {bars.map((b, i) => (
        <div
          key={i}
          {...tip.bind({ title: b.label, rows: [{ dot: COLOR, value: fmtChartValue(b.value, "件") }] })}
          style={{ flex: 1, height: `${(b.value / max) * 100}%`, background: COLOR }}
        />
      ))}
      {tip.node}
    </div>
  );
}
```

三件事：`const tip = useChartTooltip()` → 在 hover 目標上綁事件 → 把 `{tip.node}` 放進回傳值（放哪都行，實際會 portal 出去）。

## API

```ts
function useChartTooltip(): ChartTooltipApi

interface ChartTooltipApi {
  /** 手動顯示。SVG 圖用：自己算出 hover 到第幾筆之後呼叫 */
  show(clientX: number, clientY: number, content: ChartTooltipContent): void;
  hide(): void;
  /** 一行綁定。div 柱狀條用：直接展開到每根柱子上 */
  bind(content: ChartTooltipContent | (() => ChartTooltipContent)): {
    onMouseMove: (e: { clientX: number; clientY: number }) => void;
    onMouseLeave: () => void;
  };
  /** render 在元件回傳值的任一位置（會 portal 到 document.body） */
  node: ReactNode;
  visible: boolean;
}

interface ChartTooltipContent {
  title?: string;              // 標題列，通常是時間／類別（例 "8/16 14:00"、"基隆市"）
  rows: ChartTooltipRow[];     // 數值列，0..n
  note?: string;               // 灰字補充（例 "28 站回報"）
}

interface ChartTooltipRow {
  dot?: string;    // 色點顏色 = 該序列的線色／柱色
  label?: string;  // 序列名稱（雙序列／堆疊條用；單序列圖可省略）
  value: string;   // 已格式化的數值字串
}

/** 數值格式化：四位數以上補千分位、單位前留空格（% 除外）、整數保持整數。便利預設，非強制 */
function fmtChartValue(v: number, unit?: string): string;

/** 落點計算（純函式，已單元測試）。一般不用直接呼叫 */
function computeTooltipPlacement(input: {
  cursorX: number; cursorY: number; boxW: number; boxH: number;
  viewportW: number; viewportH: number; gap?: number; margin?: number;
}): { left: number; top: number };
```

基礎設施負責：定位（跟游標）、**邊界翻轉**（靠右緣往左翻、靠上緣往下翻、翻完仍出界就 clamp）、
樣式（designTokens，深色浮框 + 細邊框 + blur）、**捲動即隱藏**、`pointerEvents:none` 防閃爍。
呼叫端只需要回答兩件事：**hover 到第幾筆**、**那一筆要顯示什麼**。

## 範例一：div 柱狀條（大宗，待套用 21 項）

以 `HazardTrendBars` 的資料形狀為例（**不要改那個檔**，這裡只是示範形狀）：

```tsx
const tip = useChartTooltip();

{bars.map((b) => (
  <div
    key={b.key ?? b.label}
    {...tip.bind(() => ({
      title: b.label,
      rows: [{ dot: levelColors[b.level] ?? COLORS.textDim, value: b.value == null ? "無資料" : fmtChartValue(b.value, "件") }],
      note: b.hint,
    }))}
    style={{ flex: 1, height: `${pct}%`, background: levelColors[b.level] }}
  />
))}
{tip.node}
```

- `bind()` 可傳 lazy function（`() => ({...})`），字串組裝只在真的 hover 時發生。柱子數少時直接傳物件也行。
- **堆疊條**：把 `bind` 綁在**整根柱子的外層 div**（不是每個色段），`rows` 一次列出所有分段：
  ```tsx
  rows: CATEGORIES.filter((c) => d.c[c.key]).map((c) => ({ dot: c.color, label: c.label, value: String(d.c[c.key]) }))
  ```

## 範例二：SVG 圖（待套用 7 項）

SVG 圖通常要「依 X 座標找最近一筆」，所以用 `show()` 不用 `bind()`：

```tsx
const tip = useChartTooltip();

function handleMove(e: React.MouseEvent<SVGSVGElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  if (rect.width === 0) return;
  const xRatio = (e.clientX - rect.left) / rect.width;
  const i = Math.round(xRatio * (points.length - 1));
  const p = points[Math.max(0, Math.min(i, points.length - 1))]!;
  tip.show(e.clientX, e.clientY, {
    title: fmtTime(p.t),
    rows: [{ dot: lineColor, value: fmtChartValue(p.v, "人") }],
  });
}

return (
  <>
    <svg onMouseMove={handleMove} onMouseLeave={tip.hide}>…</svg>
    {tip.node}
  </>
);
```

想同時畫垂直指示線／hover 圓點時，另存一個 `hoverIdx` state 在 SVG 內畫即可 —— tooltip 本體仍交給基礎設施。

## 呼叫端容器要滿足什麼條件

**基本上沒有。** 這是選 portal 路線的主要理由：

| 情境 | 需要做什麼 |
|---|---|
| 卡片是 `overflow: hidden`（如 `LiveWall.tsx:332`） | 不用動 |
| 卡片是 `overflow: auto`（如 `MonitorPanel.tsx:132/905`） | 不用動 |
| 卡片 `fit: "content"` 靠寫死 height 撐高（`HazardTrendBars` / `PlaBoard` / `FoodPriceBoard`） | 不用動 |
| 祖先有 `backdrop-filter` / `transform` | 不用動 |
| 父層沒有 `position: relative` | 不用動（**也不要為了 tooltip 去加**，會踩到百分比高度的雷） |

浮層 portal 到 `document.body` + `position: fixed`，完全脫離卡片的佈局與裁切。

⚠️ 唯一要留意的是**捲動**：浮層是 fixed，卡片捲動時它會停在舊座標。基礎設施已內建
「任何 scroll（capture 階段）就隱藏」，呼叫端不用處理。

⚠️ **hover 目標不能是 `pointer-events: none`**。柱狀圖若柱子之間有間隙，建議把 `bind()` 綁在
**每根柱子的外層佔位 div**（含間隙的那層），而不是有顏色的內層 —— 否則游標落在間隙上 tooltip 會閃爍消失。

## 已實測驗證過的行為

2026-08-18 用 `HazardTrendBars`（地震／落雷 14D 柱狀圖）做過一次**暫時性**接線實測後還原，確認：

- 浮層確實 portal 成 `document.body` 的直接子節點（`parentElement === BODY`）。
- 在 `fit:"content"` + 寫死 height 的災害卡裡，浮層**畫得出卡片邊界之外**、沒有被裁切。
- 落點正確（游標右上）、樣式與站上深色面板一致。
- **捲動即隱藏有效**：hover 出浮層後捲動 Wall 容器，浮層立刻消失（不會停在舊座標變孤兒）。
- 與柱子既有的 `onClick`（選取）並存沒有衝突。

## 常見坑

**1. 計數類不要用預設小數位。** `fmtChartValue(0, "次")` 舊版會給 `0.00 次`（實測踩到，已修）。
現在整數會保持整數。但**固定精度的量要自己格式化** —— 例如輻射 µSv/h 需要 3 位小數，
`fmtChartValue(0.054)` 只會給 `0.05`，該傳 `\`${v.toFixed(3)} µSv/h\`` 進 `value`。

**2. 柱間有 gap 時綁外層。** 見上方「呼叫端容器」段最後一條。

**3. `bind()` 綁在有 `onClick` 的元素上不衝突** —— 兩者事件不同，直接並存即可
（`HazardTrendBars` 的柱子同時是可點選取的，實測沒問題）。

## 與既有 HTML `title=` 的關係

**建議做法：替換，不要並存。**

瀏覽器原生 `title` 是延遲約 1 秒後在游標下方另外冒出的黃框，與本浮層並存會出現
「同一根柱子跳出兩個提示」，而且原生框無法套 designTokens、無法多行對齊。

替換步驟：
1. 把原本 `title={...}` 字串的內容拆成 `{ title, rows, note }` 結構（分隔符號 `·` / `\n` 通常就是列的邊界）。
2. 刪掉 `title` 屬性。
3. **若該元素同時是無障礙資訊的唯一出口**（圖片、純圖形按鈕），保留 `aria-label` 而非 `title` —— 浮層是
   `pointer-events:none` 的視覺層，不進無障礙樹。

**例外：可以保留 `title`** —— 該元素不是圖表資料點，只是輔助說明（例如標題旁的說明小圖示、
圖例色塊）。這類不需要 hover 顯示數值，維持原生 `title` 成本最低。

## 為什麼是 DOM portal 浮層而不是 SVG 內繪

1. **載體有兩種**：站上圖表大宗是 `div + height:X%` 的柱／條，沒有 SVG 座標系可落點。DOM 浮層兩種通吃。
2. **卡片會裁切**：`MonitorPanel.tsx:132/905` 非 `fit:"content"` 的卡是 `overflow:"auto"`、`LiveWall.tsx:332` 是 `overflow:"hidden"`。
3. **祖先有 `backdrop-filter`**：filter/transform 祖先會變成 `position:fixed` 的 containing block，浮層留在卡內時連 `fixed` 都不保險。

三點合起來只有 portal 一個解。代價是脫離捲動流（已用「捲動即隱藏」補），
換來的是**呼叫端容器零條件** —— 這在 30 項由多個 agent 平行套用時是最重要的性質。

## 與 `TimeseriesSparkline` 內建 tooltip 的關係

`TimeseriesSparkline` 有自己一套 SVG 內繪 tooltip（`showTooltip` prop）。

- **已在用 `TimeseriesSparkline` 的圖 → 直接傳 `showTooltip`**，不要改用本基礎設施（本輪 ERCard / AirportPaxCard 就是這樣做的）。
- **其餘 30 項 → 用本基礎設施**（清單見 `backlog.md`）。
- 兩套並存是**已知的暫時狀態**。統一（讓 Sparkline 內部改用本基礎設施）需要單獨一輪處理，
  因為它同時被 5 個 `featureInfo/*` 地圖 popup panel 與 PowerCard 使用，要一起回歸驗證。詳見 `backlog.md`。
