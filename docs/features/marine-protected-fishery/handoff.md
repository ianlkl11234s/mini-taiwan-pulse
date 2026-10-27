# Handoff — marine-protected-fishery（下游視角）

> **上游 SSOT**：taipei-gis-analytics `data/processed/marine/<dataset>/_manifest.json`（G08 資料層，analytics PR #177）。本檔只列前端依賴的 dataset、檔案與欄位；細節以上游 manifest 為準。
> 共通交付流程與其他 atlas 圖層見 [`../atlas-layers/handoff.md`](../atlas-layers/handoff.md)（該檔總覽 26 個 dataset，本主題 7 個在此展開）。

## 交付

`python3 scripts/preprocess/build-atlas-public.py --src <analytics>/data/processed --only <layer_key…>`（`@layer` 定義在該腳本「海域保護與漁業」區段）。輸出在 `public/marine/`（git 追蹤、隨 dist 部署）。

## 7 個上游 dataset

| layer key | 上游 dataset（`data/processed/marine/`） | 輸出檔 | 幾何 |
|---|---|---|---|
| `natureReserves` | `nature_reserves` | `marine/nature_reserves.geojson` | 面 |
| `wildlifeProtectedAreas` | `wildlife_protected_areas` | `marine/wildlife_protected_areas.geojson` | 面 |
| `openFishingLocations` | `open_fishing_locations` | `marine/open_fishing_locations.geojson` | 點 |
| `coastalAreaExtents` | `coastal_area_extents` | `marine/coastal_area_extents.pmtiles`（z5–12） | 面 |
| `artificialReefCenters` | `artificial_reef_areas` | `marine/artificial_reef_areas.geojson` | 點（中心位置，非範圍） |
| `protectedReefCenters` | `protected_reef_areas` | `marine/protected_reef_areas.geojson` | 點（中心位置，非範圍） |
| `setNetFishingAreas` | `set_net_fishing_areas` | `marine/set_net_fishing_areas.geojson` | 面（來源 EPSG:3857，上游已轉 4326） |

## 前處理依賴的上游欄位（改名或改值域前端會爆）

- 兩個保護區：`feature_id`、`name`、`subarea_name`、`manager`、`legal_established_date`、`legal_announced_date`、`source_area_ha`、`source_edition`。
- `open_fishing_locations`：`source_idx`（主鍵）、`county`、`source_xpos`、`source_ypos`。
- `coastal_area_extents`：`source_row`（主鍵）、`county`、`area_type`；來源座標帶 Z=0，前處理只留經緯度；面積 < 1 m² 的退化面不上圖。
- 兩個魚礁 dataset：`feature_id`、`name`、`county`、`announce_date`、`depth_text`、`range_text`、`coordinate_text`、`point_basis`、`point_basis_label`、`geometry_kind`。`range_text` 只當文字說明、不畫範圍；宜蘭保護礁禁漁區 1 筆無座標、不上圖。
- `set_net_fishing_areas`：`feature_id`、`county`、`fishery_name`、`area_name`、`license_no`。
- 共通（前處理補齊）：`source_org`／`source_url`／`license`／`fetched_at`／`vintage`（popup「資料日期」只取 manifest vintage 的第一個日期）。

## 語意提醒

- 魚礁圖層是「中心位置」，不是範圍；定置漁業權區授權為漁業署網站著作權聲明，未見開放授權，照實標示。
- 上游改欄位或筆數時，同步更新 README 圖層表的筆數，並重跑前處理與 `staticDataContract.test.ts`。
