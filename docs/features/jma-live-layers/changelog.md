# Changelog — 日本氣象廳即時圖層

> 逐 PR 變更紀錄。最新在上。

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
