# 等值帶（Q-G 方案 2）技術調查與設計：溫度先做，溫度以外怎麼做

> **狀態：使用者 2026-11-11 決定先不做（含溫度）；本文件保留調查結論供日後重啟。** §3 的三題待決題維持未決，重啟時再請使用者決定。
> **行號基準**：路徑與行號以調查當時 mini `origin/develop` @ `dda9caa0`（2026-11-11）為準，重啟時請先用 `git show dda9caa0:<path>` 對照現況。

> 2026-11-11 唯讀調查。mini 程式碼以 **`origin/develop` @ dda9caa0** 為準（主 checkout 落後 36 個 commit）；data-collectors 以 `origin/main`、gis-platform 以 `origin/main` 為準。沒查到的事寫「沒查到」。效能數字凡未量測者都標「估計」。
> 「呈現方式」選單與 `pm=` 參數由另一個 worker 實作（`feat/viz-presentation-circles`（PR #1008），交稿前已有未提交實作，交集見 §4a）。

---

## 0. 結論先講

- **溫度可以直接做**：站上「溫度網格」讀的就是氣象署官方格點 O-A0038-003（67×120、0.03°、每小時），前端已有完整格點陣列與時間插值；用 repo 已有的 `d3-contour` 切成**互不重疊**的 10 個等值帶（沿用現有 10 級色階），海上與無資料格自然留空。成本：小～中。
- **溫度以外**最值得做的是**雨量**：氣象署有一份同規格的官方格點「日累積雨量觀測分析格點資料」**O-A0040-004**（官方文件只寫 67×120 矩陣，與溫度格數相同；原點與解析度是否相同未確認），但站上還沒有收集器，要跨 repo 新增（data-collectors → 儲存 → mini）。另有 QPESUMS 過去 1 小時 QPE 格點（O-B0045-001，每 10 分），解析度沒查到。
- 空氣品質、紫外線、濕度、氣壓、海象：站上與官方開放資料都只有**測站點**（空品官方「色階圖」是圖片），**不建議**做等值帶。
- 地震震度：站上地震回放已有 NCDR 2.5 km PGA 數值格網，可切成「震度帶」，但收集器目前停用、屬事件型，排後面。
- 日本氣象廳各種解析格點在站上是「每像素存等級」的 PNG，本身已經是分級柵格，轉向量等值帶只有外觀差異，不建議。

---

## 1. 溫度

### 1.1 資料路徑（收集器 → 儲存 → RPC → 前端）

| 段 | 內容 | 出處 |
|---|---|---|
| 來源 | 氣象署 File API `O-A0038-003`「小時溫度觀測分析格點資料」，需 `CWA_API_KEY`；回傳 JSON，`Resource.Content` 為 CSV 矩陣，缺值為 ≤ -900（收集器以 `> -900` 判斷有效）；`GeoInfo` 有左下／右上經緯度 | data-collectors `origin/main:collectors/temperature.py`（docstring：每小時、0.03 度約 3.3 km、全台）、`config.py:661` |
| 官方格式說明 | 氣象署「開放資料平臺資料標準說明文件」v1.05：O-A0038-003 與 O-A0040-004 的 `Content` 為「67 ⨯ 120 矩陣」、以科學符號呈現，左下／右上經緯度到小數 4 位 | https://opendata.cwa.gov.tw/opendatadoc/Observation/O-A0038-003.pdf（12 頁，頁 9–10） |
| 儲存 | `live.temperature_grids`（原 `realtime`，migration 312 搬 schema），每格一列；保留期限登記 21 天（migration 282 `('temperature_grids','partition',21,…)`；另一份 openapi 文件寫 7d，兩者不一致，以 registry 為準待確認） | gis-platform `origin/main:migrations/020_temperature_rpc.sql`、`282_retention_registry_and_coverage.sql:91`、`312_move_realtime_to_live.sql:168` |
| RPC | `get_temperature_dates()`、`get_temperature_grid_info(date)`（陸地格座標）、`get_temperature_frames(date)`（每時刻一列，溫度以逗號串接、依 lat,lng 排序）；後續另有 `temperature_frames_daily` 預聚合表（migration 208／302 等） | 同上 020 |
| 前端 loader | `src/data/temperatureLoader.ts`：常數 `GRID_ROWS 120`、`GRID_COLS 67`、`GRID_BOTTOM_LAT 21.88`、`GRID_BOTTOM_LNG 120.0`、`GRID_RESOLUTION 0.03`（`:29-33`）；只載「≤ 今天、且 ≥10 幀的最近一天」（`:45-59`）；輸出 `{ metadata, landIndices, frames[{time, values(×10 整數)}] }`；10 分鐘 TTL 快取 | `src/data/temperatureLoader.ts` |
| 資料 hook | `useTemperatureData(enabled)`（App.tsx:407），結果經 `deps.temperatureData` 給 Host，也給 3D 溫度波 | `src/hooks/useTemperatureData.ts`、`src/layers/layerHostDeps.ts:89` |
| 畫圖 | `TemperatureGridHost` → `useTemperatureGridLayer(mapRef, data, visible, opacity)`；每個陸地格一個 0.03° 方形 polygon（`temperatureGridToGeoJSON`），顏色用 feature-state `temp` ＋ 10 級 step | `src/layers/hosts/miscHosts.tsx:155-175`、`src/hooks/useTemperatureGridLayer.ts`、`src/map/temperatureGridLayerFactory.ts:46-65,96-125` |
| 換時刻 | 訂 `timeStore.subscribeThrottled(100ms)`；找相鄰兩幀線性插值，插值係數量化成 0.1 一格（`LERP_BUCKETS = 10`），同格不重算；只寫有變的格 | `src/hooks/useTemperatureGridLayer.ts:31-33,98-159,194` |
| 色階 | `TEMPERATURE_GRID_BANDS` 10 級：<0、0–5、5–10、10–15、15–18、18–22、22–26、26–30、30–34、≥34 °C；圖例、popup、地圖三處共用 | `src/data/temperatureGridTypes.ts` |
| 點擊 | `gisClickRegistry` 登記 `temperature-grid-fill` → `temperatureGrid` popup（`TemperatureGridPanel` 顯示該格溫度與凍結時刻） | `src/map/gisClickRegistry.ts:1029`、`src/components/featureInfo/airPanels.tsx:119` |
| 控制項 | 只有透明度滑桿 `tempGridOpacity`（預設 0.7） | `src/data/layerParamsSpec.ts:4898-4903` |

格點規格與限制：
- 67 欄 × 120 列＝8,040 格，格心經度 120.00–121.98、緯度 21.88–25.45。**澎湖（約 119.6°E）、金門、馬祖在格網外**，現行方格圖也一樣沒有。
- 前端只拿得到「陸地格」（`landIndices`）；海上格不存在＝缺值。陸地格數沒查到（要看 `get_temperature_grid_info` 實際回傳）。
- 時間範圍：只載最近一天；時間軸在範圍外時夾在第一或最後一幀（`useTemperatureGridLayer.ts:109-116`）。

### 1.2 官方分析方法與地形

- 查到的：O-A0038-003 的官方「資料標準說明文件」只規範欄位格式（上表），**沒有寫分析方法、有沒有考慮地形**。
- 背景資料（**不是**這個產品的說明）：2009 年氣象局出國報告提到 2008 年導入 STMAS-2D 客觀分析，結合測站與模式背景場，並指出陡峭地形處可靠度較低（https://report.nat.gov.tw/ReportFront/PageSystem/reportFileDownload/C09803665/001，由搜尋摘要得知，未讀全文）。不能據此斷言 O-A0038-003 用了 STMAS 或做了地形修正。
- 結論：**分析方法與地形處理：沒查到**。圖例照提案寫「氣象署分析格點（官方分析產品）」，不加「已考慮地形」之類說法。

### 1.3 等值帶做法

**步驟（每次換時刻、插值格改變時）**：

1. 組格點：`Float64Array(67*120).fill(NaN)`，把該時刻（兩幀依量化後係數插值）的陸地格值填入 `landIndices` 位置。列 0＝最南，與 loader 的 `row*cols+col` 一致。
2. 切等值帶（**互不重疊、無縫**）：d3-contour 回傳的是「v ≥ 門檻」的巢狀區域。直接把 10 層疊著畫，半透明時內層可能疊色變深（未實測；溫度網格預設透明度 0.7），而且點擊會命中多層，所以要轉成互不重疊的帶：
   - 對**同一個場 v** 取全部門檻：`T = [−100, 0, 5, 10, 15, 18, 22, 26, 30, 34]`（最冷帶下界用有限值 −100，不用 −Infinity；d3-contour 的平滑在兩端都無限時會退化），一次 `contours.thresholds(T)(grid)` 得到 10 個 `≥ t_i` 的 MultiPolygon。
   - 第 i 帶 ＝ `≥ t_i` 減去 `≥ t_{i+1}`（最熱帶不減）。兩條邊界出自同一個場、同一次內插，**必然吻合、不會有縫或重疊**。
   - 差集用 `polyclip-ts`：它已經是 `@turf/intersect` 7.2.0 的相依（`package-lock.json` 有 `node_modules/polyclip-ts`，`@turf/intersect` 依賴 `^0.16.8`），直接 import 要在 `package.json` 補上這個相依（不增加下載量，但要寫明）；或新增 `@turf/difference`（同一個底層）。不想加相依的備案：自己做「`≥ t_{i+1}` 的外環掛成 `≥ t_i` 對應外環的洞、`≥ t_{i+1}` 的洞另成新面」的包含測試——程式較長、易錯，不建議。
   - ⚠️ 不要用「輔助場 `min(v − lo, hi − v)` 取門檻 0」的捷徑：d3-contour 是對傳入的場做線性內插（`contours.js:220-224` `smooth1`），帳篷函數的折點會讓相鄰兩帶的邊界錯開。手算例：相鄰兩格 19°C、23°C，18–22 帶邊界落在 50%，22–26 帶邊界落在 75%，中間留 25% 格寬（約 0.8 km）空白；方向相反時則重疊。
3. 可選的等值線：用同一組門檻切 v 得到邊界線，畫成細線圖層（參照站上「等深線」的「分帶填色＋線」做法：`src/data/layerParamsSpec.ts:4887-4896`、`src/map/overlayRegistry.ts:1404-1405`）。
4. 座標轉換：d3-contour 的點座標是格網單位，格心在 `i + 0.5`。經度 `lng = 120.0 + (x − 0.5) × 0.03`、緯度 `lat = 21.88 + (y − 0.5) × 0.03`（現成範例：`src/data/transitReachIsochrones.ts:80`，該檔 y 向下所以是減號，這裡列 0 在南所以是加號）。
5. 寫進一個 GeoJSON source（例 `temperature-isoband-src`），每個 feature 帶 `band`（0–9）、`lo`、`hi`；fill-color 用 `match band` 對 `TEMPERATURE_GRID_BANDS[band].color`，透明度沿用 `tempGridOpacity`。

**海上／無資料遮罩**：d3-contour 4.0.2 把 null／NaN 當作「低於負無限大」（`src/contours.js:209-217`，unpkg d3-contour@4.0.2），平滑時邊界落在「陸地格心與缺值格心的中點」，也就是陸地格的外緣。所以：
- 海上與缺值格自動不上色，海岸線與現行方格圖同一個外框（3.3 km 鋸齒經 marching squares 變成 45° 折角）。
- 不需要額外的海岸線檔。若之後想要貼合真實海岸，要找一份全台陸地面（在 `deploy/public-assets.lock.json` 用關鍵字找不到現成檔；可用統計邊界的縣市面合併），再用已有的 `@turf/intersect` 逐帶裁切——成本與效能另估，**第一版不做**。
- 山區不會有「同心圓」問題：這是官方格點本身的值，不是我們從測站內插。

**邊界平滑**：d3-contour 預設線性插值邊界（`smooth(true)`）已足夠；不做上採樣或曲線平滑（那只改外觀、不增加資訊，反而讓人誤以為解析度更高）。

**效能（估計，未量測）**：
- 一次計算＝10 個帶 × 8,040 格的 marching squares，加 GeoJSON `setData`。8 千格量級預期在個位數毫秒；`setData` 交給 worker 重切，頂點數預估幾千。
- 觸發頻率：沿用現有節流（≥100 ms 且插值係數換格才重算），播放時每段一小時最多重算 10 次。
- 驗收：dev 下用 `performance.now()` 記錄「組格點＋切帶＋setData」耗時，桌機中位數 < 16 ms、60 倍速播放無明顯掉幀；手機實機看一次。量不過就退回「只在整點重算、不插值」。
- `d3-contour` 照 `useTransitReachPlaybackLayer.ts:149-158` 的做法**延遲載入**（`import("d3-contour")`），只在選了等值帶時才下載。

**圖例**：沿用 `TemperatureGridLegend` 的 10 級色票；標題下顯示目前呈現方式「等值帶」；註記一行「氣象署小時溫度觀測分析格點（0.03°）；澎湖、金馬未涵蓋」。

**popup**：點等值帶時顯示
- 大字：點擊位置的溫度（用該時刻格點對點擊經緯度做雙線性取值，周圍有缺值格時退回最近陸地格），一位小數；
- 小字：所屬帶「22–26°C」、時刻（同現行凍結做法）、來源「氣象署分析格點」。
- 實作上需要新的 layer id（例 `temperature-isoband-fill`）登記到 `src/map/gisClickRegistry.ts`，並重生 `src/data/__tests__/__fixtures__/layer-golden.json`——**這兩個是共用登記檔，交由主 agent 接線**。

**與「呈現方式」選單整合**：
- `temperatureGrid` 的呈現選項：`方格`（現行）／`等值帶`；2 個選項，依提案 Q-A 放在同一列「呈現方式」。
- 網址：`pm=temperatureGrid:isoband`（只記非預設；確切格式依另一個 worker 的 `pm=` 編碼）。
- 3D 溫度波關立體時，`resolveTemperatureGridDisplay` 會讓溫度網格 Host 畫平面方格（`miscHosts.tsx:159-166`）；建議那條路徑**維持方格**，呈現方式只作用在「溫度網格」這一層本身，避免兩個圖層互相改畫法。
- manifest `params.kinds` 會多一個控制項，`layerConsistency` 測試要一起更新（共用檔）。

**要改／新增的檔（溫度）**：

| 檔 | 改動 |
|---|---|
| `src/map/temperatureIsobands.ts`（新） | 純函式：`buildFrameGrid(data, t)`、`computeIsobands(grid, bands, contoursFn)`、`sampleAt(grid, lng, lat)`；單元測試用小格網驗證「帶互不重疊」「**無縫**：各帶面積和＝全部有值格的外框（`≥ −100` 那一層）面積，誤差 < 0.1%」「NaN 不出帶」「座標轉換」 |
| `src/hooks/useTemperatureGridLayer.ts` 或新 `useTemperatureIsobandLayer.ts` | 依呈現方式切換：方格路徑不動；等值帶路徑訂同一個 `timeStore` 節流、在插值格改變時重算並 `setData` |
| `src/map/temperatureGridLayerFactory.ts` | 新增等值帶 source／fill／line layer 的 ensure／visible／opacity 函式 |
| `src/layers/hosts/miscHosts.tsx` | `TemperatureGridHost` 讀呈現方式參數 |
| `src/data/layerParamsSpec.ts`／呈現方式規格 | 加 `temperatureGrid` 的呈現選項（與另一個 worker 對齊） |
| `src/components/featureInfo/airPanels.tsx` | popup 支援等值帶（點擊取值＋所屬帶） |
| 共用（主 agent）| `gisClickRegistry.ts`、`layer-golden.json`、manifest `params`、`layerConsistency` |

工作量：**小～中**（約 1 個 PR）。主要風險：插值重算在低階手機的效能（估計，需量測）；與呈現方式 PR 的檔案衝突。

---

## 2. 溫度以外

### 2.1 盤點表

「驗證方式」欄：**程式**＝讀了 loader／hook 程式；**manifest**＝只讀了 `layerManifest.ts` 的描述與 source note；**文件**＝官方文件或 data.gov.tw 頁面。

| 主題 | 站上圖層（key） | 資料型態 | 驗證方式 | 等值帶可行性 | 成本 | 主要風險 | 建議波次 |
|---|---|---|---|---|---|---|---|
| 溫度 | `temperatureGrid`、`temperatureWave` | 官方格點數值 67×120 | 程式＋文件 | **直接切** | 小～中 | 手機效能（估計） | **第 1 波** |
| 雨量（站上現有） | `rainGauge`（雨量站 10 分／1 小時，熱區＋點，RPC `get_rain_gauge_day`） | 測站點（mini `docs/features/water-resources/water-resources-status.md:33` 寫 1,304 站） | manifest＋文件 | 要內插 | 中 | 對流雨極局部，距離內插會出現同心圓與誤導的連續帶 | 不建議 |
| 雨量（站上現有） | `precipRaster`（水利署 IoW 累積雨量柵格 PNG，`/rasterMap/precipitation`）、`cwaRadarImagery`（O-A0058-005 回波 PNG） | 已上色的圖片 | 程式（`src/data/precipRasterLoader.ts`）＋analytics `docs/api-platforms/iow/swagger.json` | 不可行（沒有數值） | — | 反推顏色會失真 | 不做 |
| 雨量（官方格點，站上**沒有**） | — | **O-A0040-004「日累積雨量觀測分析格點資料」**，官方文件寫 67×120 矩陣（與溫度同格網）；更新頻率與「日」的切點**沒查到** | 文件（O-A0038-003.pdf 頁 1、10） | **直接切** | 中（跨 repo：新收集器＋儲存＋前端；前端可大量沿用溫度程式） | 是「日累積」不是即時；需確認發布時刻與缺值碼；要 `CWA_API_KEY`（已有） | **第 2 波** |
| 雨量（官方格點，站上**沒有**） | — | **O-B0045-001** QPESUMS 過去 1 小時定量降水估計格點，每 10 分鐘，政府資料開放授權第 1 版，需授權碼；欄位含 GridResolution、GridDimensionX／Y，**解析度與格數沒查到**（同系統的雷達回波格點 O-A0059-001 是 0.0125°、921×881，但那是回波 dBZ，不能套用） | 文件（https://data.gov.tw/en/datasets/42623、https://data.gov.tw/dataset/76629、CWA 產品說明 3-6-1.pdf） | 直接切（若格數大，建議收集器端先降採樣或烤成數值 PNG 放 R2） | 中～大 | 資料量可能很大（若為 921×881 量級，每幀約 81 萬格，前端切帶成本高）；QPE 是雷達估計、山區與遠距誤差 | 第 3 波（先用金鑰抓一次確認格數） |
| 空氣品質 | `aqiStations`（環境部 77 站，data-collectors `docs/handbook/sources/water-env.md:67`）、`aqiMicroSensors`（LASS 約 456 點）、`aqiImagery`（環境部 airtw 內插色階圖） | 測站點；色階圖是**圖片** | 程式（`src/data/aqiImageryLoader.ts`）＋manifest | 測站要內插；圖片不可行 | 中 | 77 站在山區與東部極稀；LASS 偏都市且非標準儀器；官方已有內插圖，我們再內插會出現兩種說法 | 不建議。官方數值格點或模式輸出：**沒查到** |
| 風、海流 | `windField`（GFS 10 m）、`oceanCurrents`（CMEMS） | 數值格點，PNG 編碼 u/v＋manifest 給 min/max（`src/data/climateFrames.ts` 開頭契約） | 程式 | 可切「風速帶」 | 中 | 與粒子動畫重疊、8 bit 量化；全球格網大小沒查 | 不建議（粒子已表達） |
| 沙塵 | `dustForecast`（CAMS） | **已預烤棕色色階**的 PNG＋alpha（`src/hooks/useDustForecastLayer.ts` 註解） | 程式 | 前端不可行；上游 climate_bake 改輸出數值編碼 PNG 才可行 | 中（跨 repo） | — | 之後再議 |
| 都市熱島 | `urbanHeat`（Landsat 地表溫度 raster PMTiles） | 數值編碼 raster（R=ΔT、G=°C，前端 raster-color 上色，`src/map/overlayRegistry.ts:1350-1354` 註解） | 程式註解 | 不需向量化：把 raster-color 改成 step 就有「分帶」外觀 | 小 | 是暖季合成、不是連續即時場 | 可選（獨立小改） |
| 地震震度 | `earthquakeReplay` 的網格層 `eq-replay-grid-fill` | NCDR EQ1 數值格網 PGA，0.025°、4,377 點（`src/data/earthquakeReplayTypes.ts:84`、analytics `docs/api-platforms/ncdr/endpoints.yaml:14-26`） | 程式＋文件 | **直接切**（帶＝氣象署震度級） | 中 | 收集器 `earthquake_shakemap_grid` 清冊標停用（data-collectors `docs/handbook/sources/cwa-ncdr.md:49-50`），事件檔在 R2；事件型 | 第 3 波 |
| 紫外線 | `cwaUvDaily`（前一日最大值，測站）、`jmaUvIndex`（日本，等級 PNG） | 測站點／等級圖片 | manifest | 不可行／不需要 | — | 台灣測站少 | 不做 |
| 濕度、氣壓 | `weatherStations`（O-A0001-001 測站，點擊看即時）、`jmaAmedas` | 測站點 | manifest＋文件 | 要內插 | 中 | 官方格點**沒查到**（讀到的那份氣象署標準文件只涵蓋 7 個資料系列，其中的分析格點只有 O-A0038-003 與 O-A0040-004；不代表整個目錄沒有） | 不做 |
| 海溫、浪高 | `marineObservationCwa`、`marineObservationIsohe`（測站）、`jmaSst`（日本，等級 PNG） | 測站點／等級圖片 | manifest | 不可行／不需要 | — | — | 不做 |
| 日本氣象廳解析格點 | `jmaRasrf`、`jmaRadar`、`jmaSnowDepth`、`jmaUvIndex`、`jmaSst`、`jmaRisk*`、`jmaAna*` | PNG「只存等級值，顏色在前端」 | manifest（source note） | 已是分級柵格，向量等值帶只改外觀 | 中 | — | 不做 |
| 日本氣溫 | `jmaAmedas`（約 1,300 站） | 測站點 | manifest | 要內插 | — | 氣象廳另有「推計気象分布」類格點產品（**未查證**，站上沒有） | 不做（之後要做先查證來源） |
| 英國／愛爾蘭／加拿大（氣象、空品） | `gbRadiation`（83 站）、`caClimateStations`（站目錄）、`caAqhiStations`（發布地點）等 | 測站點或站目錄 | manifest（關鍵字盤點：格點／網格／raster／溫度／雨／風／浪／濕度／氣壓） | 不可行 | — | manifest 沒有這三國的氣象／空品數值格點圖層 | 不做 |
| 地形、水深（各國） | 台灣 `contourDtm20`（DTM 20 m 推導等高線 PMTiles）、`isobath`（等深線＋分帶填色，站上已有的等值帶先例）；`gbTerrainHillshade`／`gbTerrainRelief`、`caTerrain*`、`jpGsi*`（地理院 hillshade／relief XYZ）、愛爾蘭水深 `useIeBathymetryLayer` | 台灣兩層是**預先產好的向量**等值線／帶；其他是**已上色的影像 raster**（hook 內 `type: "raster"`，GSI 直接用 `hillshademap`／`relief` 圖磚） | 程式（`src/hooks/useGbLandLayers.ts`、`useCaTerrainLayers.ts`、`useJpGsiTerrainLayers.ts:19-30`、`useIeBathymetryLayer.ts:24`）＋manifest | 台灣已有；影像 raster 不可行 | — | 靜態地形不是「隨時間變化的場」，不屬於這次範圍 | 不做 |
| 統計網格類 | `tedsGridEmissions`、`popCount`、實價網格、`noiseCaptureGrid` 等 | 每格彙總值 | manifest | 不適用（不是連續場，同 Q-C 規則） | — | — | 不做 |

盤點方法：用 Python 切 `src/data/layerManifest.ts` 的 756 筆手寫 entry，以名稱與描述關鍵字（溫、雨、雷達、空氣、風、海流、沙塵、海溫、浪、紫外、震度、濕度、氣壓、格點、網格、raster 等）篩出約 70 筆後逐筆看 source note；統計層（程式產生的 recipe）不在範圍內。

### 2.2 雨量的建議做法（第 2 波）

1. data-collectors：仿 `collectors/temperature.py` 新增 `rain_grid_daily`（O-A0040-004），先用金鑰抓一次確認：格網與溫度是否完全相同、缺值碼、`DataTime` 的意義（當日 0 時起累積？發布頻率？）。
2. 儲存：依 ADR-0026（即時、需依時間查詢 → Supabase，保留 ≤ 6 個月並登記期限＋S3 正本）。每日資料量小（8,040 格），也可考慮直接烤成 R2 每日 JSON——**這是要使用者拍板的放置決定**（見 Q2）。
3. mini：新圖層「日累積雨量分析格點」，呈現方式預設「等值帶」（雨量用方格反而不直觀），色階沿用氣象署累積雨量分級；前端切帶程式與溫度共用 `temperatureIsobands.ts` 的泛化版（改名 `gridIsobands.ts`）。
4. 不做測站內插版本（提案 Q-G 方案 1）：1,304 站對 3 km 格網雖不算少，但午後對流雨常只有一兩站有值，距離內插會畫出不存在的雨帶；官方格點出來後就沒有必要。

### 2.3 建議實作順序

1. **溫度等值帶**（本次 Q-G 方案 2；1 個 PR，小～中）。
2. **日累積雨量官方格點**（跨 repo，中）：收集器 → 儲存 → mini 新圖層，預設等值帶。
3. **QPESUMS 1 小時 QPE**（先查格數再決定是否收集器端降採樣）或**地震震度帶**（事件型，需先恢復收集器或改讀 R2 事件檔），二擇一。
4. 可選小改：`urbanHeat` raster-color 改 step 呈分帶外觀（不需要等值帶程式）。
5. 不做：空品、紫外線、濕度、氣壓、海象、日本等級格點、統計網格。

---

## 3. 要使用者決定的題目（3 題）

### Q1　溫度網格的預設呈現方式
- 為什麼要你決定：預設決定訪客第一眼看到方格還是平滑色帶，也決定分享網址什麼時候要帶 `pm=`。
- 選項：(a) 預設維持方格，等值帶為選項；(b) 預設改等值帶，方格為選項。
- 改到什麼：只差呈現規格的 `default` 值與網址；(b) 會讓既有截圖與部落格圖跟新畫面不一樣。
- 建議：**(b)**。溫度是連續場，色帶比 3 km 方格好讀；方格留給想看原始格點的人。
- 不選的後果：預設 (a)，等值帶藏在選單裡，多數訪客不會發現。

### Q2　日累積雨量官方格點（O-A0040-004）要不要收、存哪裡
- 為什麼要你決定：要新增一支收集器（每月 Zeabur／主機與 DB 用量小幅增加），而且依 ADR-0026 要決定放 Supabase 還是 R2、保留多久。
- 選項：(a) 收，存 Supabase（保留 6 個月，S3 留正本），前端走 RPC；(b) 收，收集器直接烤每日 JSON 到 R2，前端讀 CDN；(c) 先不收。
- 改到什麼：(a) data-collectors＋gis-platform migration（要你套用）＋mini；(b) data-collectors＋R2 發布＋mini，不需 migration；(c) 雨量等值帶暫時不做。
- 建議：**(b)**：資料每日一份、不需伺服器端查詢，符合「不常變走 R2」；先抓一次確認格式再開工。
- 不選的後果：(c) 雨量只能看測站點與水利署圖片，沒有可切的官方數值。

### Q3　測站內插類（空品、雨量站）要不要做「內插推估」版本
- 為什麼要你決定：做了畫面會更「連續」，但數值是我們推估的，山區與稀疏區可能誤導；提案 Q-G 方案 1 就是這條路。
- 選項：(a) 不做，只做官方格點；(b) 只做雨量站內插，標「內插推估」並遮掉 10 km 內無站處；(c) 空品與雨量都做。
- 改到什麼：(b)(c) 要寫內插與遮罩、圖例加「推估」標示、每次換時刻重算。
- 建議：**(a)**。空品已有官方內插色階圖，雨量有官方格點可接（Q2）。
- 不選的後果：預設 (a)；若之後要做 (b)，等 Q2 的官方格點上線後再比較兩者差異更有依據。

---

## 4. 沒查到／未實測的事

- O-A0038-003 的分析方法、是否考慮地形（官方標準文件只有格式；STMAS-2D 為 2009 年出國報告背景資料，不能當本產品說明）。
- O-A0038-003 實際陸地格數（要看 RPC 回傳）。
- O-A0040-004 的更新頻率、累積起訖時刻、缺值碼（文件只寫 67×120 矩陣）。
- O-B0045-001（QPE）的格點解析度與維度。
- 環境部空氣品質官方數值格點或模式輸出（搜尋沒找到）。
- 濕度、氣壓的官方分析格點（氣象署標準文件中沒有列出）。
- 所有效能數字（等值帶計算、`setData`、手機）皆為估計，需依 §1.3 驗收方式量測。
- `polyclip-ts` 差集 10 帶 × 每次重算的耗時（未量測；若太慢，退回只在整點重算）。
- 同一 fill 圖層內重疊半透明 feature 是否疊色（未實測；改用差集後不影響做法）。
- `live.temperature_grids` 保留期限：registry 21 天 vs openapi 文件 7 天，不一致未釐清。

## 4a. 交稿前補查：「呈現方式」worker 的進行中改動（未 commit）

交稿前再看 `.worktrees/viz-presentation-1`：已有未提交改動 21 檔＋新檔 `src/data/statisticsPresentation.ts`、`src/data/presentationOverrides.ts`、`src/state/statisticsPresentationStore.ts`、`src/map/statisticsCircles.ts`。對本設計的影響：
- `pm=` 格式已定為 `pm=<layerKey>:<mode>`，項目 regex `^([A-Za-z][A-Za-z0-9]{0,95}):([a-z]{1,16})$`（`src/lib/urlState.ts` diff）→ `pm=temperatureGrid:isoband` 格式相容。
- 但合法性驗證是「對 `statisticsPresentationStore` 推導出的可選清單驗」，store 與推導都以**統計層**為對象。溫度網格要用同一個 `pm=`，需要把 store／推導泛化成「任何圖層可宣告呈現選項」，或另設非統計層的呈現登記——要在那個 PR 合併後、做溫度等值帶時一起決定，避免兩套。
- 那個 PR 也改 `src/data/layerParamsSpec.ts`、`src/map/gisClickRegistry.ts`、`LayerParamControls.tsx`，溫度等值帶 PR 應排在它之後。

## 5. 主要出處

- 氣象署開放資料平臺資料標準說明文件 v1.05（含 O-A0038-003、O-A0040-004）：https://opendata.cwa.gov.tw/opendatadoc/Observation/O-A0038-003.pdf
- 氣象署 QPESUMS 雷達整合回波產品說明：https://www.cwa.gov.tw/Data/data_catalog/3-6-1.pdf
- QPESUMS 1 小時 QPE 格點（O-B0045-001）：https://data.gov.tw/en/datasets/42623
- QPESUMS 雷達整合回波格點（0.0125°、921×881）：https://data.gov.tw/dataset/76629
- 雨量站資料 O-A0002-001：https://data.gov.tw/dataset/9177
- d3-contour 4.0.2 原始碼：https://unpkg.com/d3-contour@4.0.2/src/contours.js
- repo：mini `origin/develop` dda9caa0 — `src/data/temperatureLoader.ts`、`src/hooks/useTemperatureGridLayer.ts`、`src/map/temperatureGridLayerFactory.ts`、`src/data/temperatureGridTypes.ts`、`src/layers/hosts/miscHosts.tsx`、`src/data/transitReachIsochrones.ts`、`src/hooks/useTransitReachPlaybackLayer.ts`、`src/map/gisClickRegistry.ts`、`src/data/layerManifest.ts`、`src/data/climateFrames.ts`、`src/hooks/useDustForecastLayer.ts`、`src/data/precipRasterLoader.ts`、`src/data/aqiImageryLoader.ts`、`src/data/earthquakeReplayTypes.ts`；data-collectors `origin/main` — `collectors/temperature.py`、`config.py`、`docs/handbook/sources/cwa-ncdr.md`、`docs/handbook/sources/water-env.md`；gis-platform `origin/main` — `migrations/020_temperature_rpc.sql`、`282_retention_registry_and_coverage.sql`、`312_move_realtime_to_live.sql`；analytics — `docs/api-platforms/iow/swagger.json`、`docs/api-platforms/ncdr/endpoints.yaml`
