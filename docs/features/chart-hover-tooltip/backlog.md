# backlog — 圖表 hover tooltip 套用清單

> 盤點日 2026-08-18；驗收更新 2026-08-18（七組平行 agent 套用完成後逐項回頭核對程式碼，非照原計畫表照抄）。

全站監看模式共 **35 個圖表實例**。原計畫「已完成 5、待套用 30」，
**本輪 30 項套用工作已執行完畢，核對結果：26 項套用完成且可驗證、
3 項套用完成但資料受阻無法在瀏覽器驗證、1 項刻意略過**。
加計此前已完成的 5 項，**累計 31 項確認可用**。

commit：`d367a42`（基礎設施）、`ca60346`（28 個實例套用）、`057b9fd`（修 per_signal 當機）、
`7f2b71b`（修千分位／雙提示疊加）、`a4860c5`（AlertsTrack 收斂）。

套用方式看 [`README.md`](./README.md)（README 的統計數字尚未同步這次更新，實際狀態以本檔為準）。

## ✅ 已套用（31）

### 此前已完成，本輪重新核對仍正確（5）

| 檔案 | 圖 | 做法 |
|---|---|---|
| `AirportPaxCard.tsx:101` | 入境 24h 折線 | `TimeseriesSparkline showTooltip` |
| `AirportPaxCard.tsx:102` | 出境 24h 折線 | `TimeseriesSparkline showTooltip` |
| `ERCard.tsx:272`（原記行號 230，程式碼變動後位移） | 全台 14D 等床趨勢 | `showTooltip` |
| `PowerCard.tsx:321`（原記行號 296） | 備轉容量率 30D | `showTooltip` |
| `PowerCard.tsx:372`（原記行號 344） | 供電能力 vs 尖峰負載 | `showTooltip` |

### 本輪新套用（26）

**div 柱狀條**

| 檔案:行 | 圖 | 做法 |
|---|---|---|
| `ERCard.tsx:227` | 全台等床嚴重度堆疊條 | `tip.bind` |
| `ERCard.tsx:296` | 分區小計迷你比例條 | `tip.bind` |
| `PowerCard.tsx:125` | 4 區用電迷你比例條（補「占四區合計 %」） | `tip.bind`（資料源 `dashboard.regions`，與下方 owner-gated 的 UNIT OUTPUT 是不同資料源，不受權限限制，可正常驗證） |
| `PlaBoard.tsx:163` | AxisBar 規模架次／強度越中線百分位條 ×2 | `tip.bind` |
| `PlaBoard.tsx:256,267` | TrendRow 120 天架次柱狀圖 | `tip.bind` |
| `PlaBoard.tsx:333` | ZoneRow 空域方位橫向長條 | `tip.bind` |
| `PlaBoard.tsx:387` | KindRow 侵擾方式橫向長條 | `tip.bind`（本輪驗收另修掉與舊 `title=` 疊加雙跳的問題，見 changelog） |
| `HazardTrendBars.tsx:108,126`（共用元件，`tip.node` 於 169 行） | 被下列 5 張卡共用，改一次全數生效 | `tip.bind` |
| ↳ `HazardCards.tsx:277` | 颱風 45D 接近程度 | ↳ |
| ↳ `HazardCards.tsx:288` | 颱風 45D 1000km 內數量 | ↳ |
| ↳ `HazardCards.tsx:484` | 地震 14D 次數／規模 | ↳ |
| ↳ `HazardCards.tsx:587` | 輻射 14D 全站平均 | ↳ |
| ↳ `HazardCards.tsx:687` | 落雷 14D 次數／相對多寡 | ↳ |
| `TriageWidget.tsx:28`（`tip.node` 81 行，3 個呼叫點 129/136/137） | DistBar 地理相關／嚴重程度／事件性質 | `tip.bind` |
| `HourlyHistogramWidget.tsx:101`（`tip.node` 144 行） | 24h 事件直方圖堆疊柱 | `tip.bind` |
| `HotspotsWidget.tsx:60`（`tip.node` 166 行） | Top5 熱區橫向長條 | `tip.bind` |

**SVG**

| 檔案:行 | 圖 | 做法 |
|---|---|---|
| `ERCard.tsx:177` | HospitalCell 每院 24h 等床迷你折線 | `Sparkline showTooltip`＋`labelAt` |
| `FoodPriceBoard.tsx:242,395` | IndexCell 180 天走勢 ×4（VPI/FPI/MPI/EPI） | `tip.show`（逐點含日期／指數／偏離%／異常註記） |
| `PressureRing.tsx:199` | TwseTicker TAIEX 30D | `Sparkline showTooltip`＋`labelAt`＋`unit="點"` |
| `SituationCards.tsx:66` | DiseaseCard CDC 疾病趨勢迷你折線 | `Sparkline showTooltip`＋`labelAt`＋`unit` |
| `alerts/AlertBoard.tsx:29` | AlertTrend 24h 全類別 area+line | `tip.show`/`tip.hide` |
| `alerts/AlertBoard.tsx:117` | GroupCard 每類別迷你折線 ×6 | `tip.show`/`tip.hide`（同檔內另一個本地 `Sparkline` 函式，與 `PressureRing.tsx` 的共用 `Sparkline` 同名但是不同元件，不要混淆） |

**自製 hover 收斂**

| 檔案:行 | 圖 | 做法 |
|---|---|---|
| `alerts/AlertsTrack.tsx:94-113` | 24h 警報堆疊柱 | 改用 `tip.show`/`tip.hide`（不是 `tip.bind`，因為需要先算游標落在第幾個 hour bucket 才知道內容）。與既有拖曳 scrub 用 `draggingRef` 互斥共存：`onMouseDown` 進入拖曳模式並 `tip.hide()`，拖曳中只呼叫 `onScrubFrac`（不顯示浮層，避免擋視線），放開才恢復 hover 顯示 tooltip。commit message 記錄瀏覽器實測「拖曳播放頭追蹤精準（游標 x=880 對播放頭 x=879）、拖曳中浮層正確隱藏、放開後 hover 恢復」。 |

**共用元件 `Sparkline`**（`PressureRing.tsx` 約 235-320 行）：內建 `useChartTooltip`，`showTooltip`/`labelAt`/`unit`/`formatValue` 皆 opt-in（預設 `false`）。5 個呼叫端中 `TwseTicker`／`ERCard` HospitalCell／`PowerCard` PlantSparkRow／`SituationCards` DiseaseCard 已傳新 prop；`featureInfo/energyPanels.tsx`（地圖 popup）維持不傳，行為未變。

## Verifying（已套用，但資料受阻，瀏覽器無法驗證；3）

這 3 項**程式碼已寫好、`tsc -b` 與單元測試皆綠燈**，但正式環境目前沒有資料可以實際 hover
看到浮框，不能算「驗證通過」，如實記錄，不要跟上面 31 項混為一談：

| 項目 | 阻塞原因 |
|---|---|
| `PowerCard.tsx:461` PlantSparkRow（UNIT OUTPUT 機組 24h 出力迷你折線） | 資料來自 `get_ssot_facility_output_24h`（`src/data/energyLoader.ts:148`），這支 RPC **owner-gated**（PR #60 刻意鎖，見 `PowerCard.tsx:23` 註解）。匿名 session 呼叫得到 42501 權限拒絕，`MonitorPanel.tsx:328-342` 的 `isAccessDenied()` 把它分流成 `dayStatus="denied"`，`PowerCard` 因 `plants.length===0` 直接顯示「機組出力需登入後檢視」，整個 sparkline grid 不會渲染，無從 hover 驗證。 |
| `PowerCard.tsx:199` 燃料別堆疊條（KPI strip 內） | 與上一項**吃同一支 owner-gated RPC**：`kpis.fuelMix` 由 `summarisePowerKpis(day)` 算出（`powerCardData.ts:101-102`：`day?.plants` 為空即回傳 `EMPTY_KPI`，`peakMW=0`），而 `PowerCard.tsx:159` 整條 KPI strip 是 `kpis.peakMW > 0` 才渲染。資料被擋時，含 tooltip 的燃料堆疊條連同整條 KPI strip 都不會出現在畫面上。 |
| `SituationOverview.tsx:90` PressureDrawer 10 訊號權重長條 | `tip.bind` 程式碼已接好（`tip.node` 144 行），但目前只用「形狀正確的 mock payload」驗證過渲染邏輯（commit `057b9fd` 訊息明載：「以正確形狀的 mock payload 實測 10 條權重條與其 hover 均正常」）。正式環境下 `get_pressure_index_now` 回的 `per_signal` 實際是扁平分數 dict，經 `asArray()` 防呆後被收斂成空陣列，元件恆定顯示「⚠ 尚無 signal 細節」空狀態，10 條長條目前完全不會渲染，自然也無法 hover。細節見下方「待決事項」。 |

## Explicitly not planned（刻意略過；1）

| 項目 | 理由 |
|---|---|
| `TimelineDock.tsx:224-310` 24h 新聞密度堆疊柱 | 已有自製浮框（本基礎設施的視覺設計本就是比照它），現況體驗已達標。收斂純為統一寫法，不值得冒動到時間軸元件的風險，本輪刻意不動。已核對現況：確實仍是獨立的 `hovered &&` 條件渲染浮框，未 import `useChartTooltip`，沒有被誤觸碰或誤套用。 |

## 📐 驗證覆蓋範圍註記：靠近上緣的翻轉

`computeTooltipPlacement`（`src/components/ChartHoverTooltip.tsx`）的邊界翻轉邏輯裡，**靠近
上緣往下翻**這個情境**有**純函式單元測試涵蓋（`chartHoverTooltip.test.ts` 的 `cursorY: 10`
案例；目前 11 個測試全綠），不是完全沒測，這點跟原始描述「未實測」不完全一致，這裡訂正。

但**瀏覽器層級沒有實測過**：監看模式目前沒有圖表剛好貼近視窗上緣（浮層預設往右上冒出，
卡片內容一般離上緣有安全距離），所以沒有機會用真實圖表手動驗證這條翻轉路徑。這段邏輯與
已經在瀏覽器實測過的靠右緣翻轉（見 `7f2b71b`／`ca60346` 的驗收紀錄）共用同一支純函式，
架構上風險低，但如實記錄：**只有單元測試覆蓋，沒有瀏覽器互動驗證**。

## Decision needed：`get_pressure_index_now` 的 `per_signal` 資料契約

**現況**：`per_signal` 實際回傳是扁平分數 dict，例如 `{"er":75.7,"aqi":28.7,...}`
（`docs/proposal/alerts-pressure-signal.sql:24-25` 有實測捕捉到的真實範例：
`{"alert": 80.0, "er": 45.0, "flight": 50.0, "road": 39.0, ...}`）。但前端型別
`PressureSignal`（`src/data/intelLoaders.ts:122-130`）宣告的是結構化陣列，每筆要有
`id/label/en/weight/raw/contribution/note`。兩者不符，`asArray()` 防呆（commit `057b9fd`
為了擋當機而加，全檔 8 處同類寫法一起補）目前把非陣列的 `per_signal` 一律降級成 `[]`，
所以 `SituationOverview` 的 10 訊號權重長條在正式環境恆定顯示空狀態。

**為什麼純前端修不了**：`per_signal` 裡目前只有扁平分數，沒有 `weight`／`contribution`。
已知權重是後端算的——例如 disaster alert 的權重 `0.20` 就寫死在 gis-platform migration 207
的 `realtime.compute_signal_levels()` SQL 常數裡，不同訊號的權重不是固定值。而且據回報，
**權重集合本身會隨情境切換**：驗收階段直接呼叫線上 RPC 實測，觀察到回應帶
`weight_mode: "disaster"` 欄位（此為使用者驗收時的實測觀察，非本次文件核對重新呼叫）。
本次文件核對只做到 grep 本 repo 原始碼（`.ts/.tsx/.sql/.md/.py`）與已知的 gis-platform
migration 207 內容，`weight_mode` 零命中，所以這個欄位的存在與計算機制**無法用本 repo
現有原始碼獨立佐證**，待之後直接讀 gis-platform 該 RPC function 的定義才能確認完整機制。
也就是說，就算前端把
扁平 dict 硬套進 `PressureSignal[]` 的殼子，`weight`／`contribution` 這兩欄永遠沒有正確
資料來源可填，最多只能拿 `raw` 分數做排序顯示，做不出「這條訊號在整體戰情指數裡占多少
權重」的正確資訊。

**真正的修法**：在寫入端（compute-pressure-index，gis-platform 側）把 `per_signal` 改成回傳
結構化陣列（含 `weight`/`contribution`），或至少把 `weight_mode` 對應的權重表一併回傳讓
前端能自己算 `contribution`。純前端改法（例如硬解析 dict key 對應中英文標籤）只能做出
`raw` 排序這個次佳方案，不建議先做，以免之後跟後端修復的資料格式打架。

## Conditional / triggered later：`TimeseriesSparkline` 內建 tooltip 收斂

`TimeseriesSparkline` 有自己一套 SVG 內繪 tooltip，與本基礎設施重複（各有一份邊界翻轉邏輯、
視覺也會隨時間漂移）。**建議收斂但要獨立一輪**，不在本次批次範圍內：

- 影響面：5 個 `featureInfo/*` 地圖 popup panel + `PowerCard` 兩張已上線的趨勢圖 + 上表 5 項已完成。
- 風險：popup panel 的寬度／容器條件與監看卡片不同，要一起回歸驗證。
- 收益：刪掉 `TimeseriesSparkline.tsx` 約 70 行重複的 tooltip 繪製與定位程式碼。
