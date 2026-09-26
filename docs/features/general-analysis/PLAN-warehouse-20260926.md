# Agent 分析倉庫計劃（2026-09-26 起的唯一施工入口）

決策依據：[ADR-0014](../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md)（GIS 工作區 `.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md`）。
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
| **A 清場合併** | `public/research/`（343 檔）＋2 個 public 大檔 → `../runtime/research-public/`＋gitignore＋DEV loopback 提供；71 份舊文件歸檔；mini／gateway 合入最新 origin 並解衝突 | mini `tsc -b` 綠、`npm test` 2303 過／5 敗（5 敗在 904da89c 已存在，已實測）；gateway 62 過；DEV 原 URL 200、路徑穿越 404 | ✅ 完成（合併前待決：分支歷史，見下） |
| **B 圖層總表** | `scripts/research/build-layer-status.mjs` → [`layer-status.csv`](./layer-status.csv)＋[摘要](./layer-status-summary.md)；override 檔 `layer-status-overrides.json` | 794 層（合併 master 後）全數有 L1/L2/L3；**倉庫可分析 326 層（41%）**，舊手工映射為 248 | ✅ v1 |
| **C 分析倉庫＋引擎** | `mcp/warehouse/build_warehouse.py`＋`build_coverage.py`；MCP `src/warehouse/engine.ts` | 432 dataset：OK 202／WARN 107／略過 113／失敗 10；統計 30,473 筆 78 指標；縣市／鄉鎮／村里界齊；`wh_coverage` 309 表；python 11、MCP 121 測試綠 | ✅ v1 |
| **D 分析能力** | 7 個倉庫工具＋精選生活機能分類＋敏感設施集合＋瀏覽器匯入 `import_warehouse_result`；問題庫 `npm run question-bank` | 問題庫 PASS 4／PARTIAL 3／GAP 1（見下）；MCP stdio 實呼叫通過；瀏覽器匯入單元測試 4 綠 | 🟡 待瀏覽器配對全鏈 |
| **E 覆蓋與視覺化** | 補入倉缺口、layer→dataset 對照、雙變量圖、多點比較面板 | L2 覆蓋率上升且問題庫不退步 | 長期 |

## 驗收紀錄（2026-09-26）

問題庫（真實倉庫，runtime `question-bank-report.json`）：

| 題 | 狀態 | 耗時 | 結果／缺口 |
|---|---|---|---|
| Q1 點周邊 | PASS | 0.6s | 台北車站 800m 八類皆有結果 |
| Q2 三地比較 | PARTIAL | 1.0s | 可比較；東部臺鐵站缺（`rail_stations` 缺花蓮等站）；區域性資料集以 `notCovered` 標出 |
| Q3 相關 | PARTIAL | 0.7s | 7,602 村里：公車站數 vs 綜合所得中位數 r≈0.02；**房價、全國公司點尚未入倉** |
| Q4 新聞×敏感設施 | GAP | 0.1s | 敏感設施掃描可用；**新聞事件未入倉** |
| Q5 污染盤點 | PARTIAL | 5.6s | 以毒化物列管 7,045 處替代：500m 內有學校 2,280、300m 內有河道線 1,899、兩者皆 513；**污染裁罰未入倉** |
| Q6 路線×學校 | PASS | 0.1s | 台北 671 路 200m 內 42 校居首 |
| Q7 縣市排名 | PASS | 0.01s | 國小師生比（少→多）台北第 15、新北第 20；國中 19／22；高中 16／12 |
| Q8 環域疊合＋呈現 | PASS | 0.1s | 671 路 200m 環域＋43 features 寫出並驗 SHA；地圖 ready 待配對 |

語意修正（本輪發現並修好）：統計排名不再混排不同教育階段；鄉鎮層級 `township` 可查；生活機能改用精選表（原字串比對誤把工業「園區」、停車格算進綠地）；區域性資料集（餐廳僅雙北基隆、公園僅三市、YouBike 僅臺北）改標「未涵蓋」不算 0；投影座標不得直接上地圖。

## 待使用者決定／執行

1. **瀏覽器全鏈驗收**（需本人登入；2026-09-26 嘗試代驗：agent-browser 保存的 Google 登入已失效、本 session 無 Claude in Chrome，停在 Google 帳號輸入頁，未代輸帳密）：服務已在 3734／8794 啟動。瀏覽器開 `http://127.0.0.1:3734` 登入並配對 Codex（`pulse-research` MCP 已指向重建後的 dist），請 Agent 跑「台北 671 路 200 公尺內的學校，畫在地圖上」→ 應見環域面＋學校點，`map_context` 讀回 `wh-N:polygon`／`wh-N:point`。
2. **合併前的歷史問題**：mini 分支歷史仍含 `public/research` 等 765 個已刪檔案版本與大型台帳；依「一般 merge commit」規則合併會永久進入 public repo 歷史。選項：(a) 改寫這條未 push 分支的歷史移除這些檔案；(b) 本次例外改用 squash；(c) 接受。未決前不 push。
3. **資料缺口入倉**（路線 E 優先）：房價（`real_estate` 缺 `_manifest.json`）、新聞事件、污染裁罰（EMS_P_46）、全國公司點；`rail_stations` 缺臺鐵站屬上游資料問題。
4. 磁碟：舊單檔已刪、store 3.3 GB；重建時仍需暫時 15 GB 空間。
5. **Claude Code 也可分析**（2026-09-26）：已用 `claude mcp add --scope user pulse-research` 接上同一個 MCP（dist 路徑同 Codex），`pulse-gis-analyst` skill 以 symlink 提供給 Claude Code（repo `.claude/skills/` 與使用者層 `~/.claude-migu/skills/`；合併後可移除使用者層 symlink，並把 MCP 路徑改指主 checkout）。

## 儲存與部署路線（2026-09-26 決定）

- **現在**：R2 存 GeoParquet 正本（私有 bucket）＋本機按需快取（LRU 上限），引擎仍在本機 MCP。生活機能 36 表原始約 0.31 GB，263 個 dataset 各小於 50 MB；日常快取預估 0.5–2 GB。
  - 已完成（2026-09-26）：`mcp/warehouse/export_store.py` 匯出 315 檔共 3.3 GB（原單檔 15 GB；`geom_3826` 改在 view 內即時計算）；引擎 store 模式（記憶體 DuckDB，只能讀快取目錄）；`store.ts` 的本機目錄／私有 R2 來源、SHA 驗證、LRU 淘汰、離線沿用上一版 manifest；`pulse_wh_status` 工具。問題庫 store 與舊單檔模式 8 題答案一致（Q3 僅浮點末位差），耗時略增（Q2 0.8→1.9s）。舊 15 GB 單檔已刪（可由 `build_warehouse.py` 重建）。
  - 模式選擇：`PULSE_WAREHOUSE_SOURCE=r2://<bucket>/<prefix>`（用 mini `.env` 的 R2_* 金鑰）→ 從 R2 下載到 `runtime/warehouse-cache`（`PULSE_WAREHOUSE_CACHE_GB`，預設 3）；未設定時使用本機 `runtime/warehouse-store`（直接讀、不複製）。
  - 上傳：`npm run warehouse:upload -- plan --bucket <私有 bucket>` 先看計畫，確認後 `execute`；上傳順序為資料→manifest→`latest.json`。既有 `mini-tw-pulse`、`terrain-tiles` 可能公開，不可放 owner-only 資料。
  - **已上線（2026-09-26，使用者授權）**：新建私有 bucket `pulse-warehouse`（Cloudflare API 查得 r2.dev `enabled:false`、無自訂網域），版本 `20260926T0752Z` 共 316 物件 3.48 GB 在 `r2://pulse-warehouse/warehouse`。從 R2 跑問題庫：冷快取 33.8s（首題 19s 含下載）、熱快取 10.5s（與本機相同），8 題只需 44 檔 170 MB 快取。
  - Codex（`~/.codex/config.toml` `[mcp_servers.pulse-research.env]` 新增 `PULSE_WAREHOUSE_SOURCE = "r2://pulse-warehouse/warehouse"`）與 Claude Code（user scope `pulse-research` 同樣加此變數）都已改讀 R2；快取在 `runtime/warehouse-cache`（上限 3 GB）。本機 `runtime/warehouse-store`（3.3 GB）暫留作重新上傳來源，確認穩定後可刪。
  - 重建流程：`build_warehouse.py`（暫時需 ~15 GB）→ `export_store.py` → 可刪單檔 → 上傳。磁碟不足時先清空間。
- **之後**：分析引擎搬上 Zeabur，現況盤點、限制與切換步驟見 [zeabur-cloud-engine-option.md](./zeabur-cloud-engine-option.md)。
- 不採用：Supabase PostGIS（9 月 Disk IO 事故，分析負載會與正式站搶 IO）、AWS S3（每次查詢計流出費）。

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
