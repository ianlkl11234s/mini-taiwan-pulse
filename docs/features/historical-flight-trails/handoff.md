# 歷史軌跡交接

## 契約

資料契約入口：[analytics handoff](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/docs/handoff/historical-flight-trails.md)。
SSOT位於 `/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/docs/handoff/historical-flight-trails.md`。
來源只讀：plan-art `dist/tracks/airports/{ICAO}/{date}.jsonl`、`public/airport-points.geojson`；不修改原始資料。

版本為historical-flight-trails-v1，前端型別見src/data/historicalFlightTrailsTypes.ts。離線exporter保留全部有效可連線原始點，不抽稀/不round/不平滑；Mapbox tolerance=0。改用3D custom layer：藍白逐點高度漸層；高度倍率預設3、可調。依使用者指示，同航班觀測空白直接連線，原始資料與缺口計數不變；介面註明直線連接不表示有中間觀測資料。

manifest.json 採 session 固定快照，asset 以 `releases/<release_id>` 分開，bytes/hash 驗解碼 UTF-8。目前 pointer 為 `20260919-v2`：124 份 immutable GeoJSON 與 manifest 共125物件，完整 S3 readback 已成功；receipt 見 [`evidence/20260919-v2-s3-publication.json`](evidence/20260919-v2-s3-publication.json)。舊 `20260918-v1` 保留，不使用 `current.json`。

`20260919-v2` 共129 selector：124 partial有線，5 unavailable沒可畫線；不可把 availableCount 當查詢完整度。TW02/20春節為16/17場、02/24一般週二為16/17場，皆缺恆春；TW02/18春節為14/17場，缺望安、蘭嶼、恆春。日本只採02/18，涵蓋 `airport-points` 中 country=JP 的78/78場。這78場不等於日本所有登記飛行場，也不代表來源查詢或逐航班完整。

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

舊 `20260918-v1` 已隨 PR #313 的一般 merge commit `becb3e9e` 整合；Zeabur deployment `6aae2d9c` 完成並為 `RUNNING`。該版 Production manifest、桃園 2/20 與羽田 2/18 資產的 HTTP bytes／SHA／MIME／cache readback 通過，桌面 browser 可顯示台灣全部機場預設 2/20 的 3D 航跡且 console 無 error／warn；證據見 `evidence/20260919-production-*.json`。新 `20260919-v2` 尚待本次 merge/deploy 後補 production 證據。`license_status=unverified`，不得把現有來源視為公開展示許可；真機效能亦未驗收。

前端一般日不是完整示範，後續補抓需先核對來源查詢與信用額度。原始FR24授權未核對個別合約，本地成果不能當公開發布許可。
