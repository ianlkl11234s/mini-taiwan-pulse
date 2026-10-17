# Changelog — 日本氣象廳即時圖層

> 逐 PR 變更紀錄。最新在上。

## 2026-10-16 — 盤點關閉

- JMA-5 其餘發布幀產品上圖：2026-10-15 完成 8 層（radar／rasrf／risk_land／risk_inund／uv_anal／sst_him／sea_ice／himawari_b13），自 backlog 移除（state 不可為 done）。

## 2026-10-16 — 警報・注意報顯示種類

- 彈窗「發布中」列、圖例「目前發布中的種類」（種類＋級別色點＋區域數，最多 12 種）、圖層設定「種類」下拉（只畫有該種類的區域，用該種類級別色；選項為 JMA 種別碼靜態表，與 collector KIND_NAMES 同步）
- 區域數以 areas＋cityNameKeys 去重；解除列不計；時間軸往回拉經同一 snapshot 自動適用
- Breaking：無（golden params 只新增 `jmaWarningsKind`）

## 2026-10-15 — 點位與區域圖層時間軸化＋新增 6 層（P4；PR 待併入 develop；尚未部署正式站）

- `jmaAmedas`、`jmaWarnings`、`jmaQuakes` 跟時間軸：現在＝即時 view；往回拉＝`get_jma_amedas_at`／`get_jma_warnings_at`／`get_jma_quakes_at`；涵蓋期外圖例「未涵蓋」、地圖清空。`jmaVolcanoes` 維持快照並在圖例說明
- 新增 `jmaLightning`（落雷，沿用台灣落雷 hook，`p_source='jma'`）、`jmaWbgt`（環境省 WBGT 4 段）、`jmaSnowcap`（山頂初冠雪）、`jmaAutumnLeaves`／`jmaSakura`（生物季節前線，可切現象）、`jmaRainySeason`（梅雨，縣界 choropleth，奄美以市町村切出）
- 共用 `useJmaTimeDriver`：節流＋時間桶（整點／10 分／JST 日）＋per-bucket 快取；往回拉不輪詢
- 以正式 RPC 實資料在瀏覽器逐層驗證（各層現在＋2 個過去時刻、3 筆值與 RPC 一致、涵蓋期外顯示未涵蓋）
- Breaking：無（golden +6 層 1191 → 1197；FeatureInfo 新增 5 個 popup）

## 2026-10-15 — 分析圖 5 層（count_la_v1；PR 待併入 develop；尚未部署正式站）

- 新增 `jmaAnaSnowFirst`、`jmaAnaSnowDays`、`jmaAnaRainDays`、`jmaAnaRiskLandHours`、`jmaAnaRiskInundHours`：日本 tab「氣象防災 › 分析」，預設關，每日一張隨時間軸切日
- 新 encoding `count_la_v1`：0 透明、255 未涵蓋灰；初雪日走日序連續色帶（圖例 10/1…5/1），其餘分級
- 狀態 store 帶出幀 status，partial 時圖例明示「資料自 2026-10-10 起，部分期間缺」
- 以正式 R2／RPC 實資料在瀏覽器驗證 10-11～10-15
- Breaking：無（golden +5 層 1183 → 1188；popup ledger 42 → 47）
## 2026-10-15 — 上游直連 3 層（P5；PR 待併入 develop；尚未部署正式站）

- 新增 `jmaRiskFlood`（洪水キキクル，向量線，只提供即時）、`gibsSnowCover`（NASA GIBS 衛星雪覆蓋，可切 MODIS／VIIRS，可回看歷年）：「氣象防災 › 解析影像」；`jmaKosa`（黃砂預測，圖片面板＋時刻選單）：「氣象防災 › 預報圖」。皆預設關、瀏覽器直連上游
- 洪水キキクル只抓偶數 zoom（每個偶數 zoom 一個 source，奇數 zoom overzoom）；空磚＝無警戒
- GIBS 以時間軸 UTC 日期換磚，範圍外不請求、圖例顯示未涵蓋；圖例明講雲遮處不代表無雪
- Breaking：無（golden 1183 → 1186；popup ledger 42 → 45；params ledger +1 jmaKosa）

## 2026-10-15 — 發布幀影像擴充 8 層（stacked PR，base = feat/jma-imagery-timeline；尚未部署正式站）

- 新增 `jmaRadar`、`jmaRasrf`、`jmaRiskLand`、`jmaRiskInund`、`jmaUvIndex`、`jmaSst`、`jmaSeaIce`、`jmaHimawari`：日本 tab「氣象防災 › 解析影像」，預設關
- 產品登記簿加每產品容忍度與發布時段（UV 06–18 JST、海冰 12–5 月）；時段外顯示「夜間無資料」／「季外」
- 新 encoding：`sst_la_v1` 連續色帶（L=0 海冰另色）、`gray_jpeg_v1`（ひまわり單色 JPEG，raster-color 灰階透明 ramp）
- RPC 依發布頻率分塊（≤ 900 列、≤ 8 天），移除 8 天截斷（原本會截掉最近幾天）
- Host 改用 `makeJmaImageryHost` 工廠；圖例共用 `JmaImageryLegend`
- Breaking：無（golden +8 層 1175 → 1183；popup ledger 34 → 42）

## 2026-10-15 — 解析積雪深＋通用發布幀影像圖層（PR 待併入 develop；尚未部署正式站）

- 新增 `jmaSnowDepth`（解析積雪深）：日本 tab「氣象防災 › 解析影像」，預設關，隨時間軸逐小時播放
- 通用 JMA 發布幀 loader／hook（以 product 參數化）：RPC `get_weather_imagery_manifest` 取幀清單，URL＝`VITE_IMAGERY_CDN_BASE/image_key`
- 上色走 mapbox `raster-color`（image source 可用，瀏覽器以合成 LA PNG 驗證 7 級＋缺測灰）；mix 係數補償 mapbox 色帶取樣誤差（未補償時 L=255 會被畫成透明）
- 沒有可用幀（10-10 前、缺幀、status missing、encoding 不符）→ 隱藏圖層，圖例顯示「未涵蓋」，不畫成 0
- Breaking：無（golden 只新增 `jmaSnowDepth`；popup ledger 33 → 34；layer key 1174 → 1175）

## 2026-10-09 — 首批 4 層（PR 待併入 develop；尚未部署正式站）

- 日本 tab 新增主題「氣象防災」（併入大分類「自然與環境」）：AMeDAS 即時觀測、警報・注意報、地震（近 7 天）、火山警戒
- 警報 choropleth 沿用 `jp_admin_boundaries.pmtiles`，class20 前 5 碼對 admin_code，政令市分區整市著色
- NULL 一律中空點／「無觀測」，積雪模式只畫有積雪計的站
- Breaking：無（golden 只新增 4 key；日本主題數測試 14 → 15）
