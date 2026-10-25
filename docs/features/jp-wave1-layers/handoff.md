# 日本第一波圖層：本機前端接線

日期：2026-10-25。範圍：mini-taiwan-pulse 本機前端（分支 `feat/jp-wave1-layers`，基底 origin/develop `65340219`）；未 push、未開 PR、未上傳 S3。

## 上游契約

SSOT：[analytics handoff](../../../../taipei-gis-analytics/docs/handoff/jp-wave1-layers.md)（analytics worktree `jp-wave1`，HEAD `e2082238aa97004c5ffb324629e8bc5c1fb3cb8f`）；欄位與分類值見 analytics `docs/data-catalog/world/jp_evacuation_sites.md`、`jp_public_offices.md`、`jp_bus_stops.md`。

| dataset_id | 筆數 | 資料時點 | 大小 | SHA-256 |
|---|---:|---|---:|---|
| `jp_evacuation_sites` | 199,346（緊急避難場所 115,913＋指定避難所 83,433） | 檔案 2026-10-19 | 67,256,596 B | `f18d3b3114b8e5c16b1f17a4ab189fe478153010c0b04cd79818d187712d4b87` |
| `jp_public_offices` | 79,532 | 2022-04 | 46,372,286 B | `c5d56c6347adf35b92b4838c8dccba454c11f784a87595558c98176f18194767` |
| `jp_bus_stops` | 278,515 | 2022-08 | 20,218,221 B | `c34f65a20bfda3ebfe133653107345e464f9e5b250c56d86018e2cb4f2312ecc` |

出典（PDL1.0 要求標註加工）：

- 避難場所：出典：国土地理院「指定緊急避難場所・指定避難所データ」を加工して作成
- 役所與公民館：出典：国土数値情報（市町村役場等及び公的集会施設データ）（国土交通省）を加工して作成
- 公車站：出典：国土数値情報（バス停留所データ）（国土交通省）を加工して作成

## 硬依賴欄位（PMTiles 實測）

| 層 | tile 欄位 | 消費 |
|---|---|---|
| 避難場所 | site_type、name、address、prefecture、municipality、site_id、hazard_*（布林，僅 emergency_site）、is_welfare_shelter（布林，僅 shelter）、same_address_as_other_type | 色票、篩選（`["==",["get",欄],true]`）、popup |
| 役所與公民館 | facility_class、facility_class_code、name、address、prefecture、municipality_code、facility_id | 色票、篩選（預設 `!= assembly_facility`）、popup |
| 公車站 | bus_class、stop_name、operator、route_count、pref_code | 色票、popup；縣名由 `pref_code` 對照（`JP_PREFECTURE_NAMES`，tile 沒有縣名欄） |

null 欄位在 tile 內不存在（`get` 回 null，不等於 true）。

## 接線與供應

- 三層沿用 `jpPoliceFacilities` 的觸點：manifest、params spec、hook（含熱區）、host、layerHookRegistry、popup panel、legend、layerCatalog、gisClickRegistry、pointTiers、types、en/ja layers.json、r5HeatmapContract、golden fixture、layer-style-inventory。
- 兩個 >25MB 檔比照 `jp_population_mesh_1km.pmtiles`：`.gitignore` 單一檔名、`scripts/deploy/upload-deploy-assets.sh` 的 world 逐檔清單；`pull-deploy-assets.sh` 已整夾 sync `world/`，nginx `/world/` 先讀 `/data`，不需另改。
- PMTiles URL 帶 `?v=<sha256 前 12 碼>` 避免快取混版。
- **發版當天 develop→master 前，要先把兩個 PMTiles 上傳到 S3 `deploy-assets/world/`**（已寫進 CHANGELOG）。

## 反向連結

analytics handoff：`taipei-gis-analytics/docs/handoff/jp-wave1-layers.md`（第 0 節「下游供應路徑」）。
