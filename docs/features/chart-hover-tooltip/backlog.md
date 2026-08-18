# backlog — 圖表 hover tooltip 套用清單

盤點日 2026-08-18。全站監看模式共 **35 個圖表實例**（以「一個 render 位置 = 一項」計，
比口頭說的「27 張圖」細，因為同一個 `.map()` 產生的多張小圖與同檔多個 bar 元件分開列）。
**已完成 5 項、待套用 30 項。**

套用方式看 [`README.md`](./README.md)。SVG 圖用 `tip.show()`、div 柱狀條用 `tip.bind()`。

## ⚠️ 平行套用的分工規則

- **一個 agent 認領一個檔案**，不要兩個 agent 同時改同一檔。
- **不要改 `src/components/ChartHoverTooltip.tsx`**（共用基礎設施）。需要新功能 → 回報需求，由主 agent 統一改。
- **不要改 `TimeseriesSparkline.tsx`**（見下方「暫不處理」）。
- 改完各自跑 `npx tsc -b` + `npm test`。

## ✅ 已完成（5）

| 檔案 | 圖 | 做法 |
|---|---|---|
| `AirportPaxCard.tsx:101` | 入境 24h 折線 | `showTooltip` + `seriesLabel` |
| `AirportPaxCard.tsx:102` | 出境 24h 折線 | `showTooltip` + `seriesLabel` |
| `ERCard.tsx:230` | 全台 14D 等床趨勢 | `showTooltip` |
| `PowerCard.tsx:296` | 備轉容量率 30D | `showTooltip`（先前已上線） |
| `PowerCard.tsx:344` | 供電能力 vs 尖峰負載 | `showTooltip`（先前已上線） |

## 🔜 待套用（30）

現況 hover 欄：`title=` = 有原生 title 待替換／`none` = 完全沒有／`custom` = 自製一套待收斂。

### div 柱狀條（21）

| 檔案:行 | 圖 | 現況 |
|---|---|---|
| `ERCard.tsx:176-195` | 全台等床嚴重度堆疊條 | `title=` |
| `ERCard.tsx:240-256` | 分區小計迷你比例條 | `title=` |
| `PowerCard.tsx:111-147` | 4 區用電迷你比例條 | `none` |
| `PowerCard.tsx:176-193` | 燃料別堆疊條 | `title=` |
| `PlaBoard.tsx:141` | 規模架次百分位條 | `none` |
| `PlaBoard.tsx:142` | 強度越中線百分位條 | `none` |
| `PlaBoard.tsx:238-262` | TrendRow 120 天架次柱狀圖 | `title=` |
| `PlaBoard.tsx:297-318` | ZoneRow 空域方位橫向長條 | `none` |
| `PlaBoard.tsx:335-360` | KindRow 侵擾方式橫向長條 | `none` |
| `HazardTrendBars.tsx`（共用元件） | 被下列 5 張卡共用，**改這一個檔即可全數生效** | `title=` |
| ↳ `HazardCards.tsx:277` | 颱風 45D 接近程度 | ↳ |
| ↳ `HazardCards.tsx:288` | 颱風 45D 1000km 內數量 | ↳ |
| ↳ `HazardCards.tsx:484` | 地震 14D 次數／規模 | ↳ |
| ↳ `HazardCards.tsx:587` | 輻射 14D 全站平均 | ↳ |
| ↳ `HazardCards.tsx:687` | 落雷 14D 次數／相對多寡 | ↳ |
| `TriageWidget.tsx:100` | DistBar 地理相關 | `title=` |
| `TriageWidget.tsx:101` | DistBar 嚴重程度 | `title=` |
| `TriageWidget.tsx:102-109` | DistBar 事件性質 | `title=` |
| `HourlyHistogramWidget.tsx:94-121` | 24h 事件直方圖堆疊柱 | `title=` |
| `HotspotsWidget.tsx:107-121` | Top5 熱區橫向長條 | `none` |
| `SituationOverview.tsx:101-115` | PressureDrawer 10 訊號權重長條 | `none` |

> `HazardTrendBars.tsx` 是 5 張災害卡的共用元件 —— 改一次全部生效，是投報率最高的一項，
> 建議優先做。（本輪已用它做過暫時性實測並還原，README「已實測驗證過的行為」記的就是它。）

### SVG（7）

| 檔案:行 | 圖 | 現況 |
|---|---|---|
| `ERCard.tsx:144` | HospitalCell 每院 24h 等床迷你折線 | `title=`（在外層 cell，非逐點） |
| `PowerCard.tsx:431` | PlantSparkRow 機組 24h 出力迷你折線 | `none` |
| `FoodPriceBoard.tsx:220-292` | IndexCell 180 天走勢 ×4（VPI/FPI/MPI/EPI） | `none` |
| `PressureRing.tsx:198` | TwseTicker TAIEX 30D 折線 | `title=`（整張圖，非逐點） |
| `SituationCards.tsx:66` | DiseaseCard CDC 疾病趨勢迷你折線 | `none` |
| `alerts/AlertBoard.tsx:23-93` | AlertTrend 24h 全類別 area+line | `none` |
| `alerts/AlertBoard.tsx:96-124` | GroupCard 每類別迷你折線 ×6 | `none` |

### 自製 hover 待收斂（2）

| 檔案:行 | 圖 | 現況 | 備註 |
|---|---|---|---|
| `TimelineDock.tsx:224-262` | 24h 新聞密度堆疊柱 | `custom` | 已有自製浮框（本基礎設施的視覺就是比照它）。**低優先**：現況體驗已達標，收斂純為統一。 |
| `alerts/AlertsTrack.tsx:113-153` | 24h 警報堆疊柱 | `custom` | 值印在標題列而非浮框，體驗較弱，**建議改用基礎設施**。 |

### 非資料圖表，不需要處理

- `PressureRing.tsx:29-49` 戰情指數環：單值 gauge，環本身已印出數值，外層 `title` 是點擊提示不是資料 tooltip。

## 暫不處理：`TimeseriesSparkline` 內建 tooltip 收斂

`TimeseriesSparkline` 有自己一套 SVG 內繪 tooltip，與本基礎設施重複（各有一份邊界翻轉邏輯、
視覺也會隨時間漂移）。**建議收斂但要獨立一輪**：

- 影響面：5 個 `featureInfo/*` 地圖 popup panel + `PowerCard` 兩張剛上線的趨勢圖 + 上表 5 項已完成。
- 風險：popup panel 的寬度／容器條件與監看卡片不同，要一起回歸驗證。
- 收益：刪掉 `TimeseriesSparkline.tsx:474-544` 約 70 行重複的 tooltip 繪製與定位程式碼。
