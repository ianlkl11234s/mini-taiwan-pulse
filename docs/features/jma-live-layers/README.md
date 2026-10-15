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
| `jmaHimawari` 向日葵紅外雲圖 | 同上（`himawari_b13`，gray_jpeg_v1 單色 JPEG；raster-color 灰階透明 ramp） | `['himawari_b13']` → R2 `…/himawari_b13/…jpg` | 每小時；90／180 分 | 🟡 回補中；以上游真實磚拼成的 JPEG 驗證（JMA-7） |

| `jmaRiskFlood` 洪水キキクル | vector line（上游直連，**不經 DB／R2**）；source-layer `flood`、依 `level` 上色 | 瀏覽器直連 `bosai/jmatile/data/risk/targetTimes.json` → `…/{bt}/{member}/{vt}/surf/flood/{z}/{x}/{y}.pbf` | targetTimes 每 2 分重取；上游約 10 分一幀、保留約 6 小時 | ✅ 瀏覽器實測（2026-10-15 全國無警戒：空磚＝無線、無錯誤；有警戒時的上色待雨天抽驗，JMA-10） |
| `gibsSnowCover` 衛星雪覆蓋（NASA GIBS） | XYZ raster（上游直連，上游已上色） | `gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`；Layer 可切 MODIS Terra（2000-02-24 起）／VIIRS NOAA-20（2018-01-05 起） | 時間軸換 UTC 日時 `setTiles` | ✅ 瀏覽器實測（含回看 2025-02-10） |
| `jmaKosa` 黃砂預測 | **圖片面板**（非地圖疊加；App 右下浮動堆疊 `JmaKosaPanel`） | `env/kosa/fcst/list_js/s_jpjp_list.js`（regex 取時刻，不 eval）→ `img/surf/jp/{YYYYMMDDHHmm}_kosafcst-s_jp_jp.png` | 清單每 30 分重取；上游只有最新一報（約 3 天） | ✅ 瀏覽器實測 |

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
- encoding 分派：`level_la_v1`（step 離散）、`sst_la_v1`（interpolate 連續）、`gray_jpeg_v1`（灰階 interpolate、無缺測等級）；manifest 的 encoding 與登記簿不符 → 未涵蓋。

出典：気象庁（公共データ利用規約1.0）— 圖例、popup、source attribution 三處都有。

## 關鍵檔案

- 色票／分級 SSOT：`src/data/jmaTypes.ts`（含發布幀影像 `JMA_IMAGERY_PRODUCTS`／`JMA_IMAGERY_LAYERS`）
- 發布幀影像（通用）：`src/data/jmaImageryLoader.ts`（manifest／選幀／狀態 store）、`src/hooks/useJmaImageryLayer.ts`、`src/map/jmaImageryLayer.ts`；契約 taipei-gis-analytics `docs/topic-research/japan_opendata/jma-frontend-contract.md`
- Loader＋狀態 store：`src/data/jmaLiveLoaders.ts`
- Hook：`src/hooks/useJmaLiveLayer.ts`（3 點層）、`src/hooks/useJmaWarningsLayer.ts`（警報 choropleth）
- Host：`src/layers/hosts/jmaHosts.tsx`
- Overlay：`src/map/overlayRegistry.ts`（jmaAmedas／jmaQuakes／jmaVolcanoes，dynamicData）
- Legend：`src/components/legend/jmaLegends.tsx`；Popup：`src/components/featureInfo/jmaPanels.tsx`
- 上游直連（P5）：`src/data/jmaUpstreamLoaders.ts`（targetTimes／黃砂清單解析與選幀）、`src/data/gibsSnowTypes.ts`（GIBS 常數，零 import）、`src/hooks/useJmaRiskFloodLayer.ts`、`src/hooks/useGibsSnowCoverLayer.ts`、`src/components/JmaKosaPanel.tsx`
- 測試：`src/data/__tests__/jmaLive.test.ts`、`src/data/__tests__/jmaImagery.test.ts`、`src/data/__tests__/jmaUpstream.test.ts`

## 資料契約摘要

看 [handoff.md](./handoff.md)。

## 相關 backlog / 歷次改動

[backlog.md](./backlog.md)、[changelog.md](./changelog.md)
