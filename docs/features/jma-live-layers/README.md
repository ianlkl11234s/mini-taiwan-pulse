# 日本氣象廳即時圖層（JMA live layers）

> **Slug**：`jma-live-layers`（上游：taipei-gis-analytics `docs/topic-research/japan_opendata/jma-collectors-plan.md`）
> **狀態**：dev（PR 待併入 develop；未部署正式站）
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：見 changelog

## 一句話說明

日本 tab 新增「氣象防災」主題：AMeDAS 即時觀測、警報・注意報（市町村 choropleth）、近 7 天地震、火山噴火警戒，四層皆預設關、當下快照輪詢。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 輪詢 | 狀態 |
|---|---|---|---|---|
| `jmaAmedas` | point（可切 氣溫／前 1 小時雨量／積雪深／風速） | `public.jma_amedas_current` | 10 分 | ✅ |
| `jmaWarnings` | polygon choropleth（既有 `jp_admin_boundaries.pmtiles`） | `public.jma_warnings_current` | 5 分 | ✅ |
| `jmaQuakes` | point（半徑＝規模、顏色＝最大震度） | `public.jma_quake_latest`（近 7 天） | 2 分 | ✅ |
| `jmaVolcanoes` | point（噴火警戒レベル） | `public.jma_volcano_current` | 10 分 | ✅ |
| `jmaSnowDepth` | time-axis raster（JMA 發布幀 LA PNG，image source＋raster-color；接 timeStore） | RPC `get_weather_imagery_manifest('jma', ['snow_depth'])` → R2 `imagery/jma/snow_depth/…png` | 即時 5 分重取 manifest；每 60 分一幀 | 🟡 前端完成，待 RPC／R2 幀上線後實資料驗證（JMA-4） |
| `jmaRadar` 雨雲雷達 | 同上（`radar`，level_la_v1，8 級） | 同上 `['radar']` | 每 5 分一幀；容忍 回放 15／即時 30 分 | ✅ 實資料驗證（10-10～10-14 回補幀、10-15 即時幀） |
| `jmaRasrf` 解析雨量 | 同上（`rasrf`，8 級） | `['rasrf']` | 每 30 分；60／90 分 | ✅ 即時幀驗證（10-15 16:30Z）；回補待完成 |
| `jmaRiskLand` 土砂キキクル | 同上（`risk_land`，2–5 級；level 1 透明） | `['risk_land']` | 每 30 分；60／90 分 | 🟡 尚無發布幀；以合成 PNG 驗證上色（JMA-7） |
| `jmaRiskInund` 浸水キキクル | 同上（`risk_inund`） | `['risk_inund']` | 每 30 分；60／90 分 | 🟡 同上（JMA-7） |
| `jmaUvIndex` 紫外線指數 | 同上（`uv_anal`，14 級，level＝UVI＋1） | `['uv_anal']` | 06–18 JST 每小時；90／180 分；夜間顯示「夜間無資料」 | 🟡 尚無發布幀；夜間狀態已驗證（JMA-7） |
| `jmaSst` 日別海面水溫 | 同上（`sst_him`，sst_la_v1 連續色帶；L=0 海冰另色） | `['sst_him']` | 每日（valid_time＝該日 00:00 JST）；36／48 小時 | 🟡 尚無發布幀；以合成 PNG 驗證（JMA-7） |
| `jmaSeaIce` 鄂霍次克海海冰 | 同上（`sea_ice`，密接度 2–5；0 開水面透明） | `['sea_ice']` | 每日（12–5 月）；36／48 小時；季外顯示「季外」 | 🟡 色票暫定（JMA-8）；季外狀態已驗證 |
| `jmaAnaSnowFirst` 初雪日 | 同上（`ana_snow_first`，count_la_v1；L＝積雪季日序 10/1＝1，連續色帶，圖例以日期標示） | `['ana_snow_first']` | 每日一張（valid_time＝當日 00:00 JST）；36／48 小時 | ✅ 實資料驗證（10-15 大雪山 28 px；10-13 透明） |
| `jmaAnaSnowDays` 積雪日數 | 同上（`ana_snow_days`，分級 1／2–7／8–14／15–30／31–60／61–90／≥91 日） | `['ana_snow_days']` | 同上 | ✅ 實資料驗證（10-15 大雪山 1 日） |
| `jmaAnaRainDays` 雨日數（當月） | 同上（`ana_rain_days`，分級 1／2–3／4–6／7–10／11–15／16–20／≥21 日） | `['ana_rain_days']` | 同上 | ✅ 實資料驗證（10-11 → 10-15 逐日擴大） |
| `jmaAnaRiskLandHours`／`jmaAnaRiskInundHours` 土砂／浸水警戒時數（當月） | 同上（分級 1／3／6／12／24／48+ 小時） | `['ana_risk_land_hours']`／`['ana_risk_inund_hours']` | 同上 | 🟡 10 月至今全為 0（透明）；上色以單元測試驗證，待有警戒時實資料核對 |
| `jmaLightning` 日本落雷（LIDEN） | point（沿用台灣落雷 halo＋core 樣式；對地／雲放電分色，無電流強度） | `get_lightning_day(date_key, p_source='jma')`（台北日預載，時間軸淡入淡出） | 60 秒重抓當日 | ✅ 瀏覽器實測（10-13／10-14 與 RPC 筆數、時刻、座標一致；10-09 未涵蓋） |
| `jmaWbgt` 暑熱指數 WBGT（環境省） | point（日常生活指針 4 段 25／28／31，綠黃橙紅） | `get_env_jp_wbgt_at(t)`（整點） | 10 分 | ✅ 實測（現在／10-12／10-07 三站值一致；10-03 未涵蓋） |
| `jmaSnowcap` 山頂初冠雪 | point（已觀測白點、未觀測中空、已過平年粗框；標籤＝觀測日 與平年差／括號平年日） | `get_jma_snowcap_asof(JST 日期)` | 30 分 | ✅ 實測（今天／2025-11-15／2024-12-01；2020-06 未涵蓋） |
| `jmaAutumnLeaves` 紅葉・黃葉前線 | point（現象可切：楓紅葉／銀杏黃葉／楓落葉／銀杏落葉；已觀測依與平年差發散色） | `get_jma_phenology_asof(JST 日期)`（全部現象一天一次，與櫻花共用快取） | 30 分 | ✅ 實測（今天／2025-11-25／2024-12-01） |
| `jmaSakura` 櫻花前線 | point（現象可切：開花／満開） | 同上 | 30 分 | ✅ 實測（今天／2026-04-01／2025-03-25） |
| `jmaRainySeason` 梅雨入梅・出梅 | polygon choropleth（共用警報層市区町村界 PMTiles；12 地方→縣碼，奄美以 12 市町村切出；北海道不著色） | `get_jma_rainy_season_asof(JST 日期)` | 30 分 | ✅ 實測（2026-05-20 奄美梅雨中／鹿児島未入梅、06-20、07-25、今天；2025 未涵蓋） |
| `jmaHimawari` 向日葵紅外雲圖 | 同上（`himawari_b13`，gray_jpeg_v1 單色 JPEG；raster-color 灰階透明 ramp） | `['himawari_b13']` → R2 `…/himawari_b13/…jpg` | 每小時；90／180 分 | 🟡 回補中；以上游真實磚拼成的 JPEG 驗證（JMA-7） |

| `jmaRiskFlood` 洪水キキクル | vector line（上游直連，**不經 DB／R2**）；source-layer `flood`、依 `level` 上色 | 瀏覽器直連 `bosai/jmatile/data/risk/targetTimes.json` → `…/{bt}/{member}/{vt}/surf/flood/{z}/{x}/{y}.pbf` | targetTimes 每 2 分重取；上游約 10 分一幀、保留約 6 小時 | ✅ 瀏覽器實測（2026-10-15 全國無警戒：空磚＝無線、無錯誤；有警戒時的上色待雨天抽驗，JMA-10） |
| `gibsSnowCover` 衛星雪覆蓋（NASA GIBS） | XYZ raster（上游直連，上游已上色） | `gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`；Layer 可切 MODIS Terra（2000-02-24 起）／VIIRS NOAA-20（2018-01-05 起） | 時間軸換 UTC 日時 `setTiles` | ✅ 瀏覽器實測（含回看 2025-02-10） |
| `jmaKosa` 黃砂預測 | **圖片面板**（非地圖疊加；App 右下浮動堆疊 `JmaKosaPanel`） | `env/kosa/fcst/list_js/s_jpjp_list.js`（regex 取時刻，不 eval）→ `img/surf/jp/{YYYYMMDDHHmm}_kosafcst-s_jp_jp.png` | 清單每 30 分重取；上游只有最新一報（約 3 天） | ✅ 瀏覽器實測 |

### 點位與區域圖層的時間軸（P4，2026-10-15）

RPC 契約：gis-platform `docs/jma-time-rpcs.md`（migration 463／464）。共用驅動 `src/hooks/useJmaTimeDriver.ts`：

- **現在 vs 往回拉**：時間軸與現在相差 ≤ 60 秒（同 `isHistoryMode`）＝現在，AMeDAS／警報／地震照舊讀即時 view（AMeDAS 10 分更新）；往回拉改呼叫 `get_*_at(t)`。注意 Pulse 開站時時間軸預設在「現在 − 1 小時」，所以剛打開時就是往回拉模式（AMeDAS 看整點）。
- **時間桶與快取**：AMeDAS／WBGT 整點桶、警報／地震 10 分桶、季節類（物候／初冠雪／梅雨）日本日期桶（`jmaJstDateKey`，不可用台北日）；`subscribeThrottled(400)`＋同桶不重查＋loader 端 per-bucket LRU（`cachedByKey`）。往回拉時不輪詢。
- **未涵蓋**：往回拉先查 `get_jma_time_coverage()`（5 分快取）；t 早於 `coverage_from` 或在未來 → 不打圖層 RPC、清空地圖、圖例寫「未涵蓋：此時刻早於資料保存起點（…）」／「時間軸在未來」。不拿 `coverage_to` 擋（AMeDAS 最新整點之後 30 分仍該查）。RPC 在涵蓋期內回 0 列：AMeDAS 歷史、WBGT、季節類視為未涵蓋（季外或收集中斷）；地震、警報、落雷 0 筆是真的沒有。
- **地震**：往回拉是「該時刻前 7 天內發生、且當時已發布的最新一報」；`window_complete=false` 時圖例紅字提醒窗內可能不全。即時 view 仍以 report_time 篩近 7 天，兩者口徑差一點（震源時刻 vs 發報時刻）。
- **火山**：沒有歷史 RPC，維持當下快照；圖例明講「時間軸往回拉仍顯示現況」。
- **積雪站（AMeDAS 積雪模式）**：歷史列帶 `has_snow_gauge`，無積雪計的站不畫；有積雪計但無值＝中空、0＝灰、>0＝色階（10 月 336 站全為中空，JMA-2）。
- **落雷**：`LightningSource` 加 `jma`，沿用 `useLightningLayer`（台北日預載＋淡入淡出），日界是台北日（日本 01:00）；`useJmaLightningCoverage` 只負責圖例的涵蓋狀態（7 天熱層外＝未涵蓋）。LIDEN 無電流強度，popup 共用 `lightningStrike`（強度顯示「—」）。
- **WBGT 出典**：環境省、非公共データ利用規約；source attribution、圖例、popup 都標環境省。顏色是 Pulse 的綠黃橙紅，環境省網站「注意」是水色。
- **季節類標籤**：已觀測「10/3 +2」（+＝較平年晚）；未觀測「(10/3)」＝平年日。未觀測且 as-of 已過平年日畫粗框。與平年差分組（±2 日內平年並、3–6、≥7）是 Pulse 的視覺分段，不是氣象廳用語門檻。
- **初冠雪判定方法**：2026 寒候年以前目視、2027 起解析積雪深，popup 顯示方法並提醒不可直接比較早晚。
- **pointSpec 注意**：`withPointSpec` 會把 case／match 的 fallback 換成標準描邊；資料編碼（未觀測描邊色、已過平年粗框）要寫在條件分支，fallback 給「已觀測」。

### 上游直連 3 層（P5，2026-10-15）

- 三個上游 CORS 都是 `*`，瀏覽器直接讀；不入我們的 DB、R2、分析倉庫（`DISPLAY_ONLY`）。
- **洪水キキクル只有偶數 zoom**：JMA 自家 viewer 設定（`bosai/risk/table/risk.properties*.xml`）是 `imageType flood type="pbf" zoomUse="even"`、minZoom 4、maxZoom 14。上游對任何 zoom 都回 200（無警戒時是 0 bytes），所以奇數 zoom 拿到的空磚**分不出「無警戒」還是「本來就沒有這層」**——不能讓 mapbox 去抓奇數 zoom。做法：每個偶數 zoom 一個 vector source（`minzoom = maxzoom = z`），對應 line layer 只在 `[z, z+2)` 顯示，奇數 zoom 由前一個偶數層 overzoom；mapbox 只為當下 zoom 有可見 layer 的 source 抓磚。線寬照 JMA viewer（z≥10 為 zoom−7，否則 2）；JMA viewer 另在 z≥11 隱藏 `type=nation` 的線（改由 designated_river 層畫），我們沒有載 designated_river，所以保留。
- 洪水選幀：即時＝最晚的 ≤ now；回放時刻在上游保留範圍內照樣選幀，更早 → 隱藏＋圖例「只提供即時」；即時但最新一幀超過 60 分 → 未涵蓋（上游停更不當現況）。
- GIBS：`{Time}`＝時間軸時刻的 **UTC 日期**（即時＝今天 UTC）。日期超出範圍（layer 起始日前、未來）上游回 404 → 前端先擋，不發請求，圖例顯示「此日期未涵蓋」。z9 以上回 400 → source `maxzoom 8`，再放大 overzoom。時間軸日期輸入沒有下限，可直接選 2025-02-10 回看歷年冬季，不另做日期選單。色表 `MODIS_NDSI_Snow_Cover`（兩個 layer 共用）：NDSI 1–100 由淡黃到紅，0 與 200–255 旗標（缺測、無判定、夜間、內陸水、海洋、雲、飽和）全透明 → 圖例明講「雲遮處不代表無雪」。致謝文照 NASA 規定原文（source attribution＋圖例）。
- 黃砂：上游是 800×580 不透明 PNG（底圖、圖例燒在圖裡、等距圓柱投影），不貼地圖。面板預設跟隨時間軸（選最接近的預報時刻），手選後停止跟隨，可按「跟隨時間軸」恢復；時間軸超出這一報的範圍時註明「只提供最新一報」。
- 出典：洪水 `出典：気象庁（加工）`（只重新上色）、黃砂 `出典：気象庁`（原圖照登）、GIBS 致謝原文。

### 發布幀影像共通規則

- 產品登記簿 `JMA_IMAGERY_PRODUCTS`（`src/data/jmaTypes.ts`）每產品一筆：encoding、色票版本、發布間隔、回放／即時容忍度（`maxStaleMin`／`liveMaxStaleMin`）、上游發布時段（`active.hoursJst`／`active.monthsJst`）。圖層 key ↔ product 對照在 `JMA_IMAGERY_LAYERS`。
- 色票來源：radar／rasrf／risk_*／uv_anal 抄 data-collectors `config/decode_tables/jma/*.yaml`（版本號同 yaml）；sst_him 取自氣象廳「日別海面水温」圖色條（逐 1 ℃ 取色）；sea_ice 暫定（官方圖例季外下架）；himawari 只調透明度（85 以下透明）。
- 時段外（UV 夜間、海冰 6–11 月）不是缺資料：圖例顯示「夜間無資料」／「季外」，不叫「未涵蓋」。
- RPC 分塊：依發布頻率把時間窗切成每塊 ≤ 900 列且 ≤ 8 天（RPC 是 `[since, until)` 半開區間；邊界重複列去重）。不再在 `jmaImageryWindowFor` 截 8 天（截掉的會是最近的日子）。
- encoding 分派：`level_la_v1`（step 離散）、`sst_la_v1`（interpolate 連續）、`gray_jpeg_v1`（灰階 interpolate、無缺測等級）、`count_la_v1`（分析圖：L＝計數，0 透明、255＝覆蓋率不足「未涵蓋」；分級 step 或日序 interpolate）；manifest 的 encoding 與登記簿不符 → 未涵蓋。
- 分析圖（「氣象防災 › 分析」，契約 §8）：每日一張、內容含當日；圖例顯示「統計至 YYYY/M/D」、門檻（積雪 ≥5 cm；雨 1 小時解析雨量 ≥1 mm；キキクル警戒以上）與覆蓋率規則；manifest status＝partial 時加註「資料自 2026-10-10 起，部分期間缺」，不隱藏。

出典：気象庁（公共データ利用規約1.0）— 圖例、popup、source attribution 三處都有。

## 關鍵檔案

- 色票／分級 SSOT：`src/data/jmaTypes.ts`（含發布幀影像 `JMA_IMAGERY_PRODUCTS`／`JMA_IMAGERY_LAYERS`）
- 發布幀影像（通用）：`src/data/jmaImageryLoader.ts`（manifest／選幀／狀態 store）、`src/hooks/useJmaImageryLayer.ts`、`src/map/jmaImageryLayer.ts`；契約 taipei-gis-analytics `docs/topic-research/japan_opendata/jma-frontend-contract.md`
- Loader＋狀態 store：`src/data/jmaLiveLoaders.ts`
- Hook：`src/hooks/useJmaLiveLayer.ts`（JMA／環境省點層）、`src/hooks/useJmaWarningsLayer.ts`（警報 choropleth）、`src/hooks/useJmaRainySeasonLayer.ts`（梅雨 choropleth）、`src/hooks/useJmaTimeDriver.ts`（時間軸驅動）、`src/hooks/useJmaLightningCoverage.ts`
- P4 色票／時間桶 SSOT：`src/data/jmaPointTypes.ts`；Host：`src/layers/hosts/jmaPointHosts.tsx`；圖例 `src/components/legend/jmaPointLegends.tsx`；Popup `src/components/featureInfo/jmaPointPanels.tsx`；i18n `legend.jmaTime`／`popup.jmaTime`／`enums.jmaTime`
- Host：`src/layers/hosts/jmaHosts.tsx`
- Overlay：`src/map/overlayRegistry.ts`（jmaAmedas／jmaQuakes／jmaVolcanoes，dynamicData）
- Legend：`src/components/legend/jmaLegends.tsx`；Popup：`src/components/featureInfo/jmaPanels.tsx`
- 上游直連（P5）：`src/data/jmaUpstreamLoaders.ts`（targetTimes／黃砂清單解析與選幀）、`src/data/gibsSnowTypes.ts`（GIBS 常數，零 import）、`src/hooks/useJmaRiskFloodLayer.ts`、`src/hooks/useGibsSnowCoverLayer.ts`、`src/components/JmaKosaPanel.tsx`
- 測試：`src/data/__tests__/jmaTimeAxis.test.ts`（時間桶、涵蓋、季節狀態、梅雨對照）、`src/data/__tests__/jmaLive.test.ts`、`src/data/__tests__/jmaImagery.test.ts`、`src/data/__tests__/jmaUpstream.test.ts`

## 資料契約摘要

看 [handoff.md](./handoff.md)。

## 相關 backlog / 歷次改動

[backlog.md](./backlog.md)、[changelog.md](./changelog.md)
