# N4 PMTiles 同版分析試點：臺北市都市計畫分區

這片將 `urbanZoningTaipei` 的原始完整細部計畫 GeoJSON 轉為 15,518 筆、1,921,082 bytes 的屬性 sidecar，逐筆保留 `feature_id`、`city`、`plan_level`、`zone_code`、`zone_category`。Agent 可依來源代碼或前端輔助分類查詢與計數，也能分頁讀完；**sidecar 沒有 geometry，不能做面積、相交、環域、可及性、地籍或法律判定**。`zone_category` 非法定分區名稱；主計畫不在本資料範圍。

來源：上游 `taipei-gis-analytics/docs/data-catalog/urban_composite/urban_zoning_taipei.md`、`data/processed/urban_composite/urban_zoning_taipei/quality_report.json`。來源資料時點 2026-04-01，授權 OGDL-Taiwan-1.0；15,518 個 MultiPolygon、15,518 個唯一 `feature_id`，0 個被排除。`zone_raw` 的 4 個字面 `nan` 未收入 sidecar，不把它當缺值轉零。固定 SHA：完整 GeoJSON `5d7eb9ae65f6ac83bc77236b9551383156664bf7f85bdb53acd5b0529fd42e12`；展示 PMTiles `319a15cf95d07a2e68bf43f627d209fd173e7a4cb22c98dbd91c61d31e389eae`；sidecar `497bc0abf3fcf81457c867a6439c8131204a3ec5de37c02b35d0ecff94d0b646`。上游同批 PMTiles 與原 checkout 的展示檔 SHA 相同；隔離 worktree 已複製同 SHA 的 ignored PMTiles 供本地驗收，沒有改原 checkout。

重建指令（從 Mini 隔離 worktree 執行；輸入必須是同批上游成品）：

```sh
python3 scripts/research/build-zoning-attribute-sidecar.py \
  --source /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/urban_composite/urban_zoning_taipei/urban_zoning_taipei.geojson \
  --pmtiles /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/urban_composite/urban_zoning_taipei/urban_zoning_taipei.pmtiles \
  --output public/urban/urban_zoning_taipei.analysis.json \
  --expected-count 15518 --data-date 2026-04-01
```

驗證：生成器拒絕錯誤總筆數、非 MultiPolygon、空屬性及重複 ID；runtime 驗固定 sidecar SHA、同版來源／tile SHA、筆數、唯一 ID、類型與大小上限。測試查 `residential` 7,811 筆、`R3` 代碼變體、15,500 offset 的最後 18 筆、bbox 拒絕與 SHA 篡改拒絕。2026-09-25 正常配對的 MCP → Gateway → browser 查詢 `residential` 回傳 7,811 筆，實讀 15,518 列／1,921,082 bytes 與固定 SHA。該配對 Vite 使用另一 checkout 的 `publicDir`，故 `vite.config.ts` 以固定路徑從本 worktree 提供此 sidecar；HTTP HEAD 已確認 `application/json`。這證明屬性查詢，不代表已驗證面 geometry 的地圖呈現。

下一段：用 Parquet/GeoJSON 建 geometry 分片索引，保留官方面精度與多面/洞/無效幾何驗證，再開放相交／環域；新北 34,190 面、約 461 MiB GeoJSON，不能直接載入前台，須按 feature ID 分片並驗其 PMTiles SHA（目前原 checkout SHA 與上游檔不同）。兩者不得由 tile 抽稀形狀推回完整來源數。
