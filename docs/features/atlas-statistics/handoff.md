# Handoff — atlas-statistics（下游視角）

> **上游 SSOT**：taipei-gis-analytics `docs/handoff/atlas-statistics-recipes.json`（66 recipe、2,278 option，與 R2 current 一致）與各軌 `docs/topic-research/{medical,socioeconomic,indigenous_rural,landslide,rain-impact,marine}/layer-plan.md`（體育在 indigenous_rural）。

## 上游產物

| 產物 | analytics 路徑 | 前端交付 |
|---|---|---|
| 22 dataset release bundles | 各 option 的 `bundle_path`（`data/processed/<theme>/<dataset>/releases/*.json`） | R2 `statistics/v1`（manifest `5070788a…`，2,278/2,278 selector 對上，單位／邊界／層級一致）→ `build_atlas_statistics_recipes.py` |

## 硬依賴欄位（改一定爆）

- release_id／period_start／period_end／boundary_version（`COUNTY_MOI_1140318`、`TOWN_MOI_1140318`）／dimensions 為 exact whitelist。
- dataset_id／indicator_id／unit（與 R2 catalog 的 unit 必須相同，loader 會比對）。
- 維度值代碼：sex（all／male／female）、site、vaccine、disease、bed_type、industry（中文原值）、sub_indicator（si01–si38）。
- bundle `release.provenance.processing.parameters.dimension_labels`（維度中文）與 `sub_indicator_meta.vulnerability_sign`（子指標方向）。
