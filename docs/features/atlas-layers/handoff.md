# Handoff — atlas-layers（下游視角）

> **上游 SSOT**：taipei-gis-analytics `data/processed/<theme>/<dataset>/_manifest.json`、`docs/topic-research/atlas-batch-2026-10/release-evidence-layers.md`（Supabase reference schema mig 446–450）與各軌 `layer-plan.md`（indigenous_rural、road_facilities、landslide、rain-impact、marine、gazetteer、water_facilities）。

## 上游產物 → 前端交付

`python3 scripts/preprocess/build-atlas-public.py --src <analytics>/data/processed`（`--only <layer_key>` 可單層重產）。輸入 26 個 dataset 的 processed GeoJSON，輸出見 README 圖層表。

## 硬依賴欄位（改一定爆）

- 共通：`id`（各 dataset 主鍵）、`source_org`／`source_url`／`license`／`fetched_at`／`vintage`、`precision_note`。
- 分色／篩選：`ethnic_group`、`in_current_approved_list`、`cause_combo`（前處理組出）、`community_type`、`sign_series`、`sign_group`（前處理組出）、`facility_type`、`sensi_level`（數字）、`monitor_series`、`in_latest_list`、`info_source`、`event_year`（數字）、`photo_category`、`animal_status`、`species_zh`、`coord_status`、`latest_water_level_code`、`surface_mean_total_per_m3`、`case_level`、`category`（地名）、`grade`（數字）、`gate_kind`、`structure_category`、`status`、`species_count`。
- GeoJSON 欄型由 `staticDataContract.test.ts` 釘住；分類完整性由 `classificationCoverage.test.ts` 守（部落族別、海龜物種的其他值刻意落灰）。

## 倉庫對應

layerManifest upstream datasetId 全部用倉庫 bare id（`wh_catalog.dataset_id`），`research:layer-status` 26 層皆對到 `ds_<theme>_<id>`，不需 alias、無 hold。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 新年度／新快照 | 重跑前處理（PMTiles 會重新逐 zoom 稽核），檔名不變；擱淺年份選單 `STRANDING_YEARS`、淹水 `FLOOD_YEARS` 要跟改 |
| 新類別值 | `atlasLayerTypes.ts` 對應 `*_OPTIONS`（classificationCoverage 會紅） |
| 欄位改名 | 前處理對應 `build_*` 函式與 popup |
| 擱淺／海污座標補齊 | 圖例與 manifest note 的「無座標」筆數 |
