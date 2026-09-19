# 歷史軌跡交接

## 契約

資料契約入口：[analytics handoff](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/docs/handoff/historical-flight-trails.md)。
SSOT位於 `/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/docs/handoff/historical-flight-trails.md`。
來源只讀：plan-art `dist/tracks/airports/{ICAO}/{date}.jsonl`、`public/airport-points.geojson`；不修改原始資料。

版本為historical-flight-trails-v1，前端型別見src/data/historicalFlightTrailsTypes.ts。離線exporter保留全部有效可連線原始點，不抽稀/不round/不平滑；Mapbox tolerance=0。改用3D custom layer：藍白逐點高度漸層；高度倍率預設3、可調。依使用者指示，同航班觀測空白直接連線，原始資料與缺口計數不變；介面註明直線連接不表示有中間觀測資料。

manifest.json採session固定快照，asset以releases/<release_id>分開，bytes/hash驗解碼UTF8。這是規劃的pointer發布前本地實作；正式發布前需指定不可變release及更新發布流程，尚未建current.json。

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

exporter必要引數以--help為準。現有local artifacts在public/flight-trails（gitignored），Vite dev可讀；build會移除，不會隨app發布。production只有設定VITE_FLIGHT_TRAILS_CDN_BASE才可載入，無自動Supabase/FR24 fallback；沒有任何付費補抓或上傳腳本被執行。

前端一般日不是完整示範，後續補抓需先核對來源查詢與信用額度。原始FR24授權未核對個別合約，本地成果不能當公開發布許可。
