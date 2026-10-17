# Handoff — harm-reduction（下游視角）

> **上游 SSOT**：`taipei-gis-analytics/docs/handoff/harm-reduction.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：analytics `data/processed/poi/<dataset_id>/<dataset_id>_YYYYMMDD.geojson`（14 層點位）＋`drug_treatment_monthly_patients_YYYYMMDD.csv`（月報長表，非空間）
- 前端交付：`scripts/preprocess/build-harm-reduction-public.py --src <analytics>/data/processed/poi --date YYYYMMDD` → `public/harm_reduction/*.geojson`＋`dui_crash_points.pmtiles`（git 管理、dist 供檔，S3 不上傳）
- 更新頻率：名冊快照（不定期）；月報每月；酒駕事故年度
- 座標系統：WGS84（四捨五入 6 位小數）
- 資料量（2026-10-06 第三輪）：13 層 GeoJSON 合計約 4.9 MB；酒駕 PMTiles 12.97 MB（36,814 點，z5–z12）

## 前端接線位置

- 前處理：`scripts/preprocess/build-harm-reduction-public.py`
- 類型／色票／篩選：`src/data/harmReductionTypes.ts`
- Manifest：`src/data/layerManifest.ts`（`harmReduction*`）
- Overlay：`src/map/overlayRegistry.ts`（`publicLifePointOverlay`）；點擊：`src/map/gisClickRegistry.ts`
- Popup：`src/components/featureInfo/harmReductionPanels.tsx`；Legend：`src/components/legend/harmReductionLegends.tsx`
- 部署契約：`scripts/deploy/test_harm_reduction_deploy_assets.py`

## 硬依賴欄位（改一定爆）

- `entity_id`／`site_id` → public `id`；`drug_treatment_facilities` 以 `entity_id` join 月報
- 篩選與分色值：`category`、`channel`、`facility_type`、`service_type`、`outlet_type`、清潔針具 `has_*`／`*_is_24h`、酒癮 `is_*`、PrEP `public_funded`／`self_paid`、酒駕 `accident_class`／`year_roc`（切片內轉字串）／`dui_cause_basis`
- 中文標籤 `<欄>_label`（第三輪起）：popup 直接顯示，前端不再自建英文代碼對照；對照表 SSOT 在 analytics 各 pipeline `config.yaml labels`
- 月報長表 `entity_id, month, drug_type, patients`：腳本自行彙總最新月／首月／期間平均（不讀 analytics `data/intermediate/` 的 summary，中繼檔不是消費契約）
- `source`／`source_ids`：腳本依此映射 `source_org`／`license`／`vintage`；**上游新增來源組合時腳本會 KeyError**，要在對應 `*_SOURCES` 補一列

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 新來源組合（`source` 值） | 腳本 `*_SOURCES` 補機關名／URL／授權／資料日期 |
| 新分類值 | `harmReductionTypes.ts` 的 `*_OPTIONS`（篩選＋色票）；popup 文字自動跟 `_label` |
| 新 `_label` 欄 | 腳本 `keep` 加欄、popup 改讀 |
| 酒駕事故欄位變動 | 腳本 `DUI_KEEP`，重切 PMTiles（`-r1 -pf -pk`，逐 zoom 稽核點數＝輸入點數） |
| 月報長表欄名／PK 變動 | `maintenance_summary()` |

## 已知不對稱

- `drug_treatment_facilities` 類別：popup 用上游 `category_label`（例「藥癮治療指定機構（無替代治療）」），圖例與篩選仍用前端短名（「指定藥癮戒治」）。
- 清海醫院（第三輪新增）不在衛福部指定名單，依替代治療月報＋133353 保留；`source`＝`mohw_maintenance_monthly_115|datagov_133353`。
- 區域統計的服務據點計數（`addiction_service_points`）由同一批點位在 analytics 端計數，見 [`../addiction-statistics/handoff.md`](../addiction-statistics/handoff.md)。
