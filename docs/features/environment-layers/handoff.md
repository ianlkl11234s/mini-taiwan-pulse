# Handoff — environment-layers（第二波）

上游：
- 靜態 5 層：taipei-gis-analytics worktree `env-wave2-20261002` 的 `data/processed/environment/{sea_water_quality_stations,pm25_manual_stations,dioxin_stations,incinerator_emissions}/*_20261002.geojson` 與 `data/processed/water_resources/river_rpi_segments_tamsui_trial/*_20261002.geojson`；欄位與旗標說明在各 `docs/data-catalog/<theme>/<id>.md`。本 repo 只做 minify 複製到 `public/environment/`（檔名去日期戳；URL 為契約）。
- 即時 4 層：gis-platform migration 419–422（public RPC，anon 可呼叫）；collector 待 Zeabur 啟用（2026-10-02 只有一次寫入）。analytics registry id：`environment.radiation_realtime_nusc`、`environment.effluent_auto_monitoring`、`environment.cems_realtime`、`environment.uv_index_daily_max`（catalog .md 待補 → manifest 暫標 `catalog_missing`）。

前端硬依賴欄位：
- 海域：`water_quality_class`、`is_stale`、`latest_sample_date`、`water_temp_c`、`ph`、`do_ele_mgl`、`ss_mgl`、`nh3_n_mgl` 與對應 `*_flag`（`lt_dl` 時值為偵測極限）。`do_tit_mgl` 全 null，DO 用電極法。
- PM2.5：`mean_12m_ugm3`、`n_valid_12m`、`mean_12m_window`、`is_active`、`location_note`、`sampling_note`。
- 戴奧辛：`latest_teq_pg_m3`、`is_stale`、`sample_address`、`latest_sample_date`、`n_samples`、`location_note`。
- 焚化廠：`nox_ppm`、`sox_ppm`、`hcl_ppm`、`cox_ppm`、`dust_mg_nm3`（null＝未申報）、`opacity_pct`、`dioxin_f1..f4_*`、`dioxin_max_ng_teq_nm3`、`unusual_output`。
- RPI 河段：`class_latest`、`class_12m_mean`、`rpi_latest`、`rpi_12m_mean`、`from_station_name`、`to_station_name`、`to_node`、`length_km`、`tidal`（只有 `yes` 畫虛線）、`caveats`。
- RPC 回傳欄位見 migration；放流水看 `exceed_count`／`abnormal_count`／`is_stale`／`coord_source`，CEMS 看 `items[].code2` 首碼與 `is_exceed`，UV 看 `uv_level` 字面（低量級…危險級）。

MCP／倉庫：
- `layerManifest` upstream datasetId 改為 analytics 正規 id（`wqx_p_01`→`river_rpi_stations`、`gisepa_p_13`→`drinking_water_protection_zones`；新層直接用正規 id），不加 alias。
- `layer-status-overrides.json`：即時 4 層標 `live_only`（解鎖：collector 啟用後以時間窗匯出）。
- 重跑 `build-layer-status.mjs`（用 `.worktrees/runtime/warehouse`，另一個 MCP session 今天 12:21 重建的 catalog）：9 個靜態環境層全部 L2 `spatial`；CSV 另有幾列（Ookla、清運點位、捷運站…）因倉庫重建而更新，非本次改動。

工作分支：`feat/environment-wave2`，worktree `mini-taiwan-pulse/.worktrees/env-wave2-20261002`。未 commit／push。5 個新 GeoJSON 以 `git add -N` 標記（deployContract 依賴 git 追蹤），commit 時正式 add。
