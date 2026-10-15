# Changelog — 日本氣象廳即時圖層

> 逐 PR 變更紀錄。最新在上。

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
