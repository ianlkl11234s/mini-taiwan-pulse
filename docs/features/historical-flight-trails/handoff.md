# 歷史軌跡交接

## 契約

資料契約入口：[analytics handoff](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/docs/handoff/historical-flight-trails.md)。
SSOT位於 `/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/docs/handoff/historical-flight-trails.md`。
來源只讀：plan-art `dist/tracks/airports/{ICAO}/{date}.jsonl`、`public/airport-points.geojson`；不修改原始資料。

版本為historical-flight-trails-v1，前端型別見src/data/historicalFlightTrailsTypes.ts。離線exporter保留全部有效可連線原始點，不抽稀/不round/不平滑；Mapbox tolerance=0。改用3D custom layer：藍白逐點高度漸層；高度倍率預設3、可調。依使用者指示，同航班觀測空白直接連線，原始資料與缺口計數不變；介面註明直線連接不表示有中間觀測資料。

manifest.json 採 session 固定快照，asset 以 `releases/<release_id>` 分開，bytes/hash 驗解碼 UTF-8。`20260918-v1` 已發布到 S3 `deploy-assets/flight-trails`：98 份 immutable GeoJSON 與 manifest 共 99 物件，bytes／SHA-256／Content-Type／Cache-Control readback 已成功；receipt 見 [`evidence/20260919-s3-publication.json`](evidence/20260919-s3-publication.json)。不使用 `current.json`。

本地 fixtures 共129 selector：98 partial有線，31 unavailable沒可畫線；不可把 availableCount 當查詢完整度。一般03/10與03/14僅保留TW桃園／高雄少量資料；TW02/20春節有16/17場，日本只採02/18，涵蓋 `airport-points` 中 country=JP 的78/78場。這78場不等於日本所有登記飛行場，也不代表來源查詢或逐航班完整。恆春保留選項，仍無資料。

## 重現

在此worktree執行：

```sh
python3 scripts/preprocess/export_historical_flight_trails.py \
  --source-root '/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/plan-art/dist/tracks/airports' \
  --output-root public/flight-trails \
  --release-id local-20260918 \
  --airport-points '/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/plan-art/public/airport-points.geojson' \
  --generated-at '2026-09-18T00:00:00Z'
python3 -m unittest scripts/preprocess/test_export_historical_flight_trails.py
./node_modules/.bin/tsc -b
./node_modules/.bin/vitest run
./node_modules/.bin/vite --host 127.0.0.1 --port 3737 --strictPort
```

exporter 必要引數以 `--help` 為準。現有 local artifacts 在 `public/flight-trails`（gitignored），Vite dev 可讀；build 會移除，不會隨 app 發布。前端預設讀同源 `/flight-trails`，可由 `VITE_FLIGHT_TRAILS_CDN_BASE` 覆寫，無自動 Supabase／FR24 fallback。

發布用 `scripts/deploy/publish_historical_flight_trails.py` 固定 concurrency 4，依 manifest allowlist 發布 immutable release，所有 asset readback 成功後才以 conditional write 發布 manifest。`scripts/deploy/pull-deploy-assets.sh` 先同步 `releases/`，再下載至暫存檔並原子替換 manifest；同步或 manifest 下載失敗均保留舊 manifest。nginx 從 `/data/flight-trails` 供應，缺檔 fail-closed 為 404，不可落入 SPA HTML；release cache 為 immutable，manifest 為短快取。

程式尚未 PR／merge／deploy，production HTTP／browser readback 尚未完成；S3 receipt 不能取代這些證據。`license_status=unverified`，不得把現有來源視為公開展示許可；真機效能亦未驗收。

前端一般日不是完整示範，後續補抓需先核對來源查詢與信用額度。原始FR24授權未核對個別合約，本地成果不能當公開發布許可。
