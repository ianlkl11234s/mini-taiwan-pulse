# 減害服務 Harm Reduction

> **Slug**：`harm-reduction`（與 taipei-gis-analytics handoff 一致）
> **狀態**：staging
> **Owner**：@migu
> **上線日期**：2026-10-06（develop）
> **相關 PR**：見 [changelog.md](./changelog.md)

## 一句話說明

在醫療主題下新增「減害服務」群組：清潔針具據點（衛教諮詢站／自動服務機／回收桶）、替代療法與藥癮戒治、愛滋自我篩檢通路、愛滋篩檢與指定醫療、毒品危害防制中心，讓使用者看到全國減害資源分布。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 筆數 | 狀態 |
|---|---|---|---:|---|
| harmReductionNeedle | point | GeoJSON `public/harm_reduction/needle_points.geojson` | 988 | ✅ |
| harmReductionTreatment | point | GeoJSON `drug_treatment_facilities.geojson` | 226 | ✅ |
| harmReductionHivSelftest | point | GeoJSON `hiv_selftest_outlets.geojson` | 680 | ✅ |
| harmReductionHivTesting | point | GeoJSON `hiv_testing_sites.geojson` | 694 | ✅ |
| harmReductionPreventionCenters | point | GeoJSON `drug_prevention_centers.geojson` | 23 | ✅ |

## 關鍵檔案

- 類型／色票／篩選：`src/data/harmReductionTypes.ts`
- Manifest：`src/data/layerManifest.ts`（五筆 harmReduction*）
- Popup：`src/components/featureInfo/harmReductionPanels.tsx`
- Legend：`src/components/legend/harmReductionLegends.tsx`
- 前處理：`scripts/preprocess/build-harm-reduction-public.py`（從 analytics processed 產 public 檔，濾 null geometry、去 provenance／庫存）

## 資料契約摘要

上游 SSOT：`taipei-gis-analytics/docs/handoff/harm-reduction.md`。Supabase 對應表：`reference.*`（gis-platform migration 427）。

## 注意

- 座標多為地址 geocode；popup 對推估精度（approximate／interpolated）顯示「位置為推估」。
- 疾管署／衛福部名單頁未標示授權，正式站發布前需確認。
- 自我篩檢通路為 2026-10-06 快照，不含庫存。
