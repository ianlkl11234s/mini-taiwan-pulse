# changelog — 圖表 hover tooltip

> 套用進度請改看 `backlog.md`；這裡只記基礎設施本身的變更。

## 2026-08-18 — 套用清單全面收斂（七組平行 agent，未 PR）

承基礎設施，七組平行 agent（一人認領一個檔案避免衝突）把 hover tooltip 套用到監看模式
其餘 29 個圖表實例（`ca60346` 28 個 + `a4860c5` AlertsTrack 1 個；待套用清單原本 30 項，
`TimelineDock` 24h 新聞密度堆疊柱刻意略過未動，理由見 `backlog.md`），並在驗收階段抓到並
修掉 3 個顯示問題。細節與逐項狀態見 `backlog.md`；此處只記重點變更與驗收過程。

- `ca60346` — div 柱狀條：`HazardTrendBars`（共用元件，颱風 ×2／地震／輻射／落雷 5 張卡一次
  生效）、`PlaBoard` AxisBar ×2／TrendRow／ZoneRow／KindRow、`TriageWidget` DistBar ×3、
  `HotspotsWidget` Top5、`SituationOverview` 10 訊號權重條、`HourlyHistogramWidget`、
  `PowerCard` 四區條＋燃料別堆疊條、`ERCard` 全台嚴重度堆疊條＋分區小計條。
  SVG：`AlertBoard` AlertTrend＋GroupCard 迷你折線 ×6、`FoodPriceBoard` 180 天走勢 ×4、
  `PressureRing` 共用 `Sparkline` 加 opt-in hover 能力（`showTooltip`/`labelAt`/`unit`/
  `formatValue`，不傳完全維持原行為，含地圖 popup 呼叫端）並接上 TAIEX 30D、`ERCard`
  HospitalCell、`PowerCard` PlantSparkRow、`SituationCards` DiseaseCard。
  順手修掉 `SituationOverview` 一個 Rules of Hooks 違規（`useChartTooltip` 原本寫在
  `signals.length === 0` 的 early return 之後）。
- `a4860c5` — `AlertsTrack` 24h 警報柱從「值印在標題列」收斂到共用基礎設施，改用
  `tip.show`/`tip.hide`；與既有拖曳 scrub（`onMouseDown`/`onMouseUp` 的 `draggingRef` 判斷）
  用 if/else 分開職責維持互斥，未動拖曳啟停邏輯本身。瀏覽器實測拖曳播放頭追蹤精準
  （游標 x=880 對播放頭 x=879）、拖曳中浮層正確隱藏、放開後 hover 恢復正常。
- 驗收抓到並修掉的 3 個問題：
  1. **`per_signal` 非陣列讓整個 App 當機**（`057b9fd`）：點戰情概覽「指數組成」抽屜會讓
     整個 React root 清空、全頁變黑，100% 可重現。根因是 `get_pressure_index_now` 實際回的
     `per_signal` 是扁平物件 `{"er":75.7,...}` 而非型別宣告的陣列，`intelLoaders.ts` 原本是
     純型別斷言沒有 runtime 檢查，`PressureDrawer` 的 `signals.length === 0` 早退判斷又因
     `{}.length === undefined` 失效，直接對非陣列展開就炸。修法：`intelLoaders.ts` 全檔 8 處
     同類寫法統一加 `asArray<T>()` 防呆、`PressureDrawer` 自己也守一次退化成「無資料」。
     **此 commit 明確留下待決註記，本批未解**：防當機後 `per_signal` 的形狀契約問題仍在，
     10 條訊號權重條當時只用「正確形狀的 mock payload」實測過，正式環境會顯示空狀態
     （詳見 `backlog.md`「待決事項」）。
  2. **`HazardTrendBars` 千分位格式不一致**（`7f2b71b`）：數值走原始樣板字串沒過
     `fmtChartValue`，落雷卡顯示「2985 次」而同一浮層的 note 卻是「雲地 2,148」，同一個
     tooltip 內兩種格式並存。改為僅對整數套 `fmtChartValue`，非整數走原路徑，避免
     `toFixed(2)` 把輻射的 0.058 µSv/h 捨進成 0.06。
  3. **`PlaBoard` KindRow 雙提示疊加**（`7f2b71b`）：整列綁了 `tip.bind()` 之後，右側
     「N 天 *」的 span 還留著舊的 `title=`，hover 時自訂浮層與瀏覽器原生黃框同時跳出。
     改為把 `title` 全文併入 tooltip 的 `note` 後移除該屬性。
- 三次提交（`ca60346`／`057b9fd`／`7f2b71b`／`a4860c5`）皆為 `tsc -b` 綠、617 tests 綠；
  `7f2b71b` 額外有瀏覽器實測記錄：落雷「1,370 次」千分位正確、輻射「0.055 µSv/h」小數未被
  破壞、`PlaBoard` 機型長條不再雙跳。

## 2026-08-18 — 基礎設施上線（未 PR）

- 新增 `src/components/ChartHoverTooltip.tsx`：`useChartTooltip()` hook + `fmtChartValue()` +
  `computeTooltipPlacement()`（純函式）。DOM portal 浮層路線，理由見 README「為什麼是 DOM portal 浮層」。
- 新增 `src/components/__tests__/chartHoverTooltip.test.ts`：10 個純函式測試
  （邊界翻轉 4 種情境 + 視窗掃描 + 數值格式化）。
- 示範套用（用 `TimeseriesSparkline` 既有的 `showTooltip`，**沒有動 Sparkline 本身**）：
  - `ERCard.tsx` `ErWaitTrend14d` — 14 天等床趨勢（每小時粒度，用預設 `datetime` 格式）
  - `AirportPaxCard.tsx` — 入境／出境兩張圖，另加 `seriesLabel` 區分
- `fmtChartValue` 整數保持整數（實測 `0.00 次` 違和後修）。
