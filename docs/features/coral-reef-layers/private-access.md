# 珊瑚礁私人帳號存取

2026-09-08 使用者明確授權將全球 PMTiles 移至遠端私人研究環境，限定既有本人帳號，不開放所有會員。這不是取得公開再散布授權。UNEP-WCMC v4.1（2021-03）、geometry、coverage、null、整筆來源 feature area 等契約沿用 handoff。

## 儲存與權限

- 只上傳全球 PMTiles，133,400,197 bytes；SHA-256 `b6b0dba6ee6923add86d86312f81131d2b25fd6cb566732f84375ab301467ea3`。
- 私人 S3：`migu-gis-data-collector`，`ap-southeast-2`，`private-research/coral-reef/v4.1/<sha256>/coral_reef_distribution_global.pmtiles`；無自動刪除設定。
- 2026-09-08 已完成不覆寫上傳、AES256、private/no-store、完整 GET 回讀 byte count/hash、匿名 HEAD 403。bucket 公開政策僅涵蓋 `flight-arc/*`，不涵蓋此私人前綴。
- 不含臺灣 GeoJSON、raw ZIP、公開 deploy-assets、repo data 或 screenshots。
- backend 固定 owner UUID（沿用 platform migration 275，已 live getUserById 核對本人帳號），每次 Bearer request 都經 Supabase getUser 遠端驗證。不能由會員 tier、query user ID 或 client gate 授權。

## 執行架構

`/api/private-research/coral` → nginx exact route → loopback Node sidecar → Supabase 驗證 → private S3 Range stream。GET 必须單一有界 Range（最多 8 MiB）；HEAD 回 metadata；`?access=1` 只回權限結果；缺設定 503、無登入 401、其他帳號 403。S3 checksum/size/ETag/Range 都需吻合。

每次回應 private/no-store，無公開或簽名 URL；CORS 精確 origin allowlist。sidecar僅127.0.0.1:8789，server credentials不進前端build。CORAL_PRIVATE_BUCKET/KEY/REGION/ORIGINS為server-only設定；S3_ACCESS_KEY/SECRET_KEY 與 SUPABASE_URL/ANON_KEY（或 VITE 同名fallback）沿用既有環境。

專用 mapbox-pmtiles adapter逐次附加當前Bearer，獨立cache、timeout/abort；登出/切換帳號時hook移除source、layer與listener。前端固定本人權限probe失敗即上鎖，不受動態會員tier規則放寬；私人layer不進分享URL。

## 驗收界線

- 本地 TypeScript 通過；前端155個測試檔、1328 passed、3 skipped；backend10項授權/範圍/integrity/cleanup tests通過。
- Docker daemon本地未啟動，container build以部署平台結果為準。
- 正式站未登入/本人/其他帳號與browser視角驗收，依本輪實際後續記錄；尚未有登入本人帳號的 production browser 證據。
- 原本九個地區與手機viewport截圖是前一輪本地資料驗收，不等同此次私人production transport驗收。

## 本機開發

私人模式須同時啟動 backend 與 Vite；單獨 `npm run dev` 無法解鎖。先在shell配置上述 CORAL_PRIVATE_* 值，origin使用實際loopback前端網址（例如 http://127.0.0.1:3732）。既有環境檔只由dotenv載入，不複製到public或build：

```sh
npm ci --prefix server/coral-private
DOTENV_CONFIG_PATH=/absolute/path/to/existing/.env node --import dotenv/config server/coral-private/coral-private-server.mjs
# 另一個terminal
npm run dev -- --host 127.0.0.1 --port 3732
```

本輪本機真實未登入與偽Bearer皆401、其他path404、POST405，全部private/no-store；未替使用者產生登入token。
