# 減害服務 Harm Reduction

> **Slug**：`harm-reduction`（與 taipei-gis-analytics handoff 一致）
> **狀態**：staging
> **Owner**：@migu
> **上線日期**：2026-10-06（develop）
> **相關 PR**：#548（develop，第一批）；#552（第二批）；第三輪 `feat/harm-reduction-round3`（中文標籤、清海醫院）
> **接手**：[`handoff.md`](./handoff.md)
> **區域統計**：成癮與減害 choropleth（HIV／執法／行為調查／服務據點計數）見 [`../addiction-statistics/README.md`](../addiction-statistics/README.md)

## 一句話說明

在醫療主題下新增「減害服務」群組：清潔針具據點（衛教諮詢站／自動服務機／回收桶）、替代療法與藥癮戒治、愛滋自我篩檢通路、愛滋篩檢與指定醫療、毒品危害防制中心，讓使用者看到全國減害資源分布。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 筆數 | 狀態 |
|---|---|---|---:|---|
| harmReductionNeedle | point | GeoJSON `public/harm_reduction/needle_points.geojson` | 990 | ✅ |
| harmReductionTreatment | point | GeoJSON `drug_treatment_facilities.geojson` | 227（第三輪 +清海醫院） | ✅ |
| harmReductionHivSelftest | point | GeoJSON `hiv_selftest_outlets.geojson` | 681 | ✅ |
| harmReductionHivTesting | point | GeoJSON `hiv_testing_sites.geojson` | 694 | ✅ |
| harmReductionPreventionCenters | point | GeoJSON `drug_prevention_centers.geojson` | 23 | ✅ |
| harmReductionAlcohol | point | GeoJSON `alcohol_treatment_facilities.geojson` | 135 | ✅ 第二批 |
| harmReductionSmokingCessation | point | GeoJSON `smoking_cessation_providers.geojson` | 2,277 | ✅ 第二批 |
| harmReductionInternetAddiction | point | GeoJSON `internet_addiction_services.geojson` | 455 | ✅ 第二批（不含連江） |
| harmReductionPrep | point | GeoJSON `prep_service_sites.geojson` | 178（1 筆無地址未畫） | ✅ 第二批 |
| harmReductionCondomOutlets | point | GeoJSON `condom_outlets.geojson` | 74 | ✅ 第二批（僅高雄、新竹市、屏東、嘉義市） |
| harmReductionAntiDrugPharmacies | point | GeoJSON `anti_drug_pharmacies.geojson` | 436 | ✅ 第二批（僅新北、高雄） |
| harmReductionTherapeuticCommunities | point | GeoJSON `therapeutic_communities.geojson` | 17（2 筆查無位置未畫） | ✅ 第二批（座標＝辦公處） |
| harmReductionAftercare | point | GeoJSON `offender_aftercare_offices.geojson` | 22 | ✅ 第二批（2023-06 版） |
| harmReductionDuiCrashes | point（PMTiles z5–12，z10 以下熱區） | `dui_crash_points.pmtiles`（13.0MB） | 36,814（3 筆無座標未畫） | ✅ 第二批；側欄在「執法治安 › 治安態勢」 |

第二批另把「藥癮維持治療執行進度表」（衛福部月報 2026-01–08）以 `entity_id` 併進 `drug_treatment_facilities.geojson`：132/227 點有 `maintenance_month`、美沙冬／丁基原啡因最新月與期間平均服藥人數；其餘為 null（無月報，不是 0）。第三輪起由 processed 月報長表自行彙總（不讀 analytics 中繼 summary；結果與中繼 summary 逐筆相同）。

第三輪（2026-10-06）：public 檔保留上游中文標籤欄 `<欄>_label`（`category_label`、`facility_type_label`、`channel_label`、`outlet_type_label`、`machine_type_label`、`subtype_label`、`service_type_label`、`services_label`、`office_type_label`、`accident_class_label`、`dui_cause_basis_label`），popup 直接顯示；前端刪除自寫的英文代碼對照表（院所類型、場所類型、機台型式、更生保護會單位）。對照表 SSOT 在 analytics 各 pipeline `config.yaml labels`。

## 關鍵檔案

- 類型／色票／篩選：`src/data/harmReductionTypes.ts`
- Manifest：`src/data/layerManifest.ts`（五筆 harmReduction*）
- Popup：`src/components/featureInfo/harmReductionPanels.tsx`
- Legend：`src/components/legend/harmReductionLegends.tsx`
- 前處理：`scripts/preprocess/build-harm-reduction-public.py`（從 analytics processed 產 public 檔，濾 null geometry、去 provenance／庫存、保留 `_label`）

## 資料契約摘要

上游 SSOT：`taipei-gis-analytics/docs/handoff/harm-reduction.md`。Supabase 對應表：`reference.*`（gis-platform migration 427）。

## 注意

- 座標多為地址 geocode；3 點（綠島鄉衛生所、連江縣衛生局、林森育安藥局）地址 geocode 失敗，改依機構名稱以 Google Places 查得並人工核對（analytics `manual_geocode_overrides.yaml`）；popup 對推估精度（approximate／interpolated）顯示「位置為推估」。
- 疾管署／衛福部名單頁未標示授權，正式站發布前需確認。
- 自我篩檢通路為 2026-10-06 快照，不含庫存。
- **酒駕肇事事故交付方式**：精簡欄位後 GeoJSON 仍 15.7MB（第三輪加兩個中文標籤欄後重切，13.0MB），超過 dataClass A 約 5MB 上限 → PMTiles（`-r1 -pf -pk` 不抽稀不丟點，前處理腳本逐 zoom 解碼點數＝36,814）；maxzoom 12 靠 overzoom（z14 會到 18MB）。檔案 git 管理走 dist（同 religion temples 前例），S3 不上傳，契約見 `scripts/deploy/test_harm_reduction_deploy_assets.py`。
- **酒駕事故放「執法治安 › 治安態勢」**：既有交通事故層（A1 年度、北市事故、A1 即時）都在那裡；manifest 一層只能有一個 section，減害群組的對照說明寫在圖層描述與圖例。`year_roc` 在切片內為字串（多選篩選以字串比對）。
- 戒菸服務機構、治療性社區、PrEP、酒癮、網路成癮、月報來源頁皆未標示授權，popup 顯示「來源頁未標示授權」。
