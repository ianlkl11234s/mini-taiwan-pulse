# Agent 分析倉庫計劃（2026-09-26 起的唯一施工入口）

決策依據：[ADR-0014](../../../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md)（GIS 工作區 `.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md`）。
舊的 P0–P7、Q0–Q6、778 層回補清單已移到 [`archive/2026-09-pre-warehouse/`](./archive/2026-09-pre-warehouse/)，**只作歷史，不再作施工依據**。

## 全貌

```
analytics data-registry + _manifest.json（唯讀）
   │ 路線 C：build_warehouse.py（自動、批次、驗 SHA/筆數/幾何）
   ▼
runtime/warehouse/warehouse.duckdb + catalog.json + build-report.json   ← 不進 git；未來匯出 R2
   │ 路線 C：MCP 內嵌 DuckDB（唯讀、禁外部存取）
   ▼
pulse-research MCP 新工具（路線 D）──結果 GeoJSON──► runtime/warehouse-results/<id>.geojson
   │                                                   │
   └─ Gateway: import_warehouse_result{resultId,sha256} ─► 瀏覽器 loopback 取檔、驗 SHA、登記 session result
                                                         └─► 既有 set_result_collection 呈現、ready、readback
路線 B：build-layer-status → layer-status.csv（778 層 × L1/L2/L3）
```

工作區：`mini-taiwan-pulse/.worktrees/research-streamline/{mini,mcp,gateway}`，共用 `../runtime/`。
三個 repo 分支皆 `codex/research-streamline-20260922`，準備好後**一起**開 PR；push／PR／merge 需使用者批准。

## 五條路線與驗收

| 路線 | 內容 | 驗收（自動優先） | 狀態 |
|---|---|---|---|
| **A 清場合併** | `public/research/` → `../runtime/research-public/`＋gitignore＋DEV loopback 以原 URL 提供；舊文件歸檔；mini／gateway 合入最新 origin 並解衝突 | mini `npx tsc -b`、`npm test`；gateway `node --test`；`git ls-files public/research` 為空；DEV 下原 URL 仍可取檔 | 進行中 |
| **B 圖層總表** | `scripts/research/build-layer-status.mjs` 產生 `layer-status.csv`＋摘要；layer→dataset 對照與人工 override 各一個小檔 | 778 列、無空白 L1/L2/L3；重跑結果穩定 | 待 C 產出 catalog |
| **C 分析倉庫＋引擎** | `mcp/warehouse/build_warehouse.py`；MCP `src/warehouse/` DuckDB 引擎 | build-report：每個 dataset OK/WARN/FAILED 與原因；引擎單元測試（唯讀、SQL 守門、距離正確） | 進行中 |
| **D 分析能力** | 工具：`pulse_wh_search`、`pulse_wh_describe`、`pulse_nearby_profile`、`pulse_sql`、`pulse_region_rank`、`pulse_wh_present`；生活機能分類表、敏感設施集合；問題庫 | 問題庫 8 類題目的自動測試（引擎層）；點／線／面各一次正常 MCP→Gateway→browser | 待 C |
| **E 覆蓋與視覺化** | 全部 manifest 批次入倉、layer→dataset 對照補齊；環域／疊合結果面、雙變量圖、多點比較面板 | L2 覆蓋率上升且問題庫不退步 | 長期 |

## 倉庫契約（C）

- 位置：`research-streamline/runtime/warehouse/`（環境變數 `PULSE_WAREHOUSE_DIR` 可覆寫）。
- `warehouse.duckdb`：每個 dataset 一張表 `ds_<safe_id>`：`_row_id BIGINT`、原屬性欄、`geom GEOMETRY`（EPSG:4326）、Taiwan 範圍另有 `geom_3826`（TWD97 TM2，公尺運算）。
  - `stats_observations(dataset, indicator, release_id, period_start, period_end, area_level, area_code, dimensions JSON, value DOUBLE, status, unit, boundary_version, license, source_sha256)`。
  - `boundaries_<level>`（county／town／village，含 `area_code`、`name`、`boundary_version`）。
  - `wh_catalog`：同 catalog.json 的表格版，供 SQL 查詢。
- `catalog.json` 每筆：`dataset_id, table, theme, title, geometry_type, rows, bbox, columns, source_files[{path, sha256, rows}], license, fetched_at, last_updated, lifecycle, precision_class(L3), visibility(owner|public), status(OK|WARN|FAILED), issues[]`。
- 驗證：manifest SHA／筆數不符 → WARN（仍建表並記錄）；CRS 非 4326 且無法轉 → FAILED；無效幾何計數入 issues。

## 引擎與呈現契約（C/D）

- DuckDB 以 READ_ONLY 開 `warehouse.duckdb`，`SET enable_external_access=false`、`lock_configuration=true`；`pulse_sql` 只接受單一 `SELECT`／`WITH`，最多 1000 列、逾時 20 秒。
- 每個結果 `wh-<序號>`：rows（有上限）、`lineage{datasets[{id, version/sha}], sql?, operation, params}`、`caveats[]`（自動從 L3 生成，例如「到地址參考點的直線距離」）。
- 呈現：`pulse_wh_present(resultId)` 寫 `runtime/warehouse-results/<id>.geojson`（≤5,000 features）→ 送 `import_warehouse_result{resultId, sha256, label}` → 瀏覽器 DEV middleware `/__warehouse-results/<id>.geojson` 取檔、驗 SHA → session result → 既有 `pulse_set_result_collection`。

## 問題庫（D 的主指標）

1. 點或地址 → 周邊情形摘要（nearby_profile）
2. 多點（2–5）生活機能比較
3. 公車站密度 vs 房價 vs 工商登記（網格／村里相關）
4. 新聞事件周邊敏感機構（批次）
5. 污染裁罰周邊保護設施／河川／學校盤點
6. 台北公車路線環域 × 學校，排名
7. 台北 vs 新北統計比較＋全國排名（教育資源、師生比）
8. 進階環域／疊合／視覺化

## 不做／邊界

- 不寫 Supabase／S3／R2；不 push／PR／merge／部署（待批准）；不重啟已暫停的過夜排程。
- analytics 原表唯讀。
- 距離一律說明為「到資料點位的直線距離」；L3 為 geocode／代理時自動加但書。
