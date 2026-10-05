# Warehouse coverage — 2026-10-05

本地 L2 **777/982（79.1%）→795/982（81.0%），+18 層**；不是正式發布的覆蓋率。手交的 660/864 是舊快照，本次基準採 develop 的 982 層與最新 demographics 本地 store。來源限制與 UNKNOWN 精度不改成 actual。

## 修改

- Pulse：`build-layer-status.mjs:107` 解除成功入倉 snapshot 的永久 none；`:136` 輸出衍生來源與原 override 備註。`layer-dataset-aliases.json:4` 修同源國家公園別名；新增逐層分診產生器。
- MCP：`warehouse/build_warehouse.py:323` 支援 gzip 向量、純屬性 Parquet/JSONL、保留來源語意；大小寫衝突保留兩值與 rename mapping。`src/warehouse/datasetLabels.json` 由最終 CSV 重生。
- Analytics：9 份 manifest 補指紋/幾何/provenance；KSJ 三 SHA 校正保留舊值。GEBCO/NoiseCapture 接同版 native sidecar，未反解 PMTiles。

## 本地重建清單

store 版本 `20261005T051814Z`；以下是 `--only` safe_id（非不含 theme 的 dataset_id）：

| safe_id | rows |
|---|---:|
| world_jp_airports | 108 |
| world_jp_schools | 56807 |
| world_jp_railways | 21933 |
| world_jp_admin_boundaries | 1952 |
| world_jp_population_mesh_1km | 176896 |
| world_jp_stations | 9046 |
| world_jp_water_ksj | 604279 |
| world_jp_water_hydro | 131876 |
| world_jp_water_quality | 9831 |
| world_jp_water_local | 205283 |
| agriculture_fishery_stats | 632 |
| demographics_county_indicators_yearly | 22 |
| base_map_gebco_isobath | 2409 |
| environment_noise_capture_grid | 5 |

日本車站是站場 centroid proxy；人口網格的遮罩 0、缺值/歷史狀態不改寫。KSJ 51/51 檔完整入倉，保留 1 NULL geometry 與 15 筆原無效幾何的修復紀錄。GEBCO 是 simplify 0.002 的衍生產品、排除 102 退化線；NoiseCapture 僅 5 格，rolling-365、稀疏、provisional、非監管數值，不含 raw tracks。

## 驗收

- MCP `npm test -- --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000`：25 files、537 PASS/1 SKIP；`npm run typecheck` PASS。
- Python `python3 -m unittest discover -s warehouse/tests -v`：55 PASS；Pulse `npx tsc -b` PASS；三 worktree `git diff --check` PASS。
- 真實 MCP InMemoryTransport → `pulse_sql` → 本地 DuckDB：14/14 PASS。獨立來源/store 驗證 14/14 PASS、80 來源檔、230 完整幾何樣本；核對 SHA、逐檔/合併 rows、NULL geometry、實際 geometry types，沒有缺少的來源檔。明細見 `source-store-parity.json`。
- Analytics `audit.py --check-all-v2` exit 1：fatal 38→37（新增 0），warnings 438；9 份修改 manifest schema PASS。不能宣稱全 catalog 綠燈。

## 未解鎖與發布

[逐層分診](./warehouse-coverage-decisions-20261005.json) 覆蓋原 205 層：A18/B13/C89/D85；剩餘 187/187 皆有理由與解鎖條件。7 個 FAILED 圖層的來源檔實際缺失，不能用 fixture 替代；derived 9 層保留來源連結，live-only 需 UTC 時間窗匯出。未找到可用的其他同名移置向量。

`upload-store.mts plan --offline`：382 objects、4,698,759,234 bytes。bucket `PRIVATE_BUCKET_TO_CONFIRM` 是占位符；remote existence/server-copy eligibility 未驗證。待使用者確認既有私有 bucket/prefix、審閱線上 plan，再自行 execute；既有授權 HOLD 不因本地可分析而解禁。

未 commit、push、merge、部署、寫 DB/migration 或上傳；未做 browser/production 驗收。

## 接手路徑

- Pulse 分支：`codex/warehouse-coverage-pulse-20261005`，本報告所在 worktree。
- MCP：`../warehouse-coverage-mcp-20261005`，分支 `feat/warehouse-coverage-20261005`。store/所有長 log、查詢與來源 receipts、upload plan 位於 `_warehouse-rebuild/coverage-20261005/`。
- Analytics：`taipei-gis-analytics/.worktrees/warehouse-coverage-20261005`，分支 `codex/warehouse-coverage-20261005`；來源手交 `docs/handoff/warehouse-coverage-20261005.md`，audit 長輸出 `output/warehouse-coverage-20261005/`。
