# MEDICAL — 醫療圖層分類計畫

> 2026-06-03 建立 ｜ mini-taiwan-pulse 第 14 個圖層分類
> 資料來源：taipei-gis-analytics 醫療 project + data-collectors

## 一句話

把台灣醫療資源從「點位 → 可及性 → 即時壓力」三層拆成 8 個獨立 toggle，
讓使用者從「哪裡有醫院」到「救護車幾分鐘到」到「現在哪裡塞床」一圖看完。

## 圖層總覽

| # | Layer Key | 中文名 | 英文標籤 | 類型 | 資料狀態 | 前端狀態 |
|---|---|---|---|---|---|---|
| 1 | `medicalHospitals` | 醫院（醫學中心/區域/地區） | Hospitals | PMTiles circle | ✅ S3 ready | ✅ 接線完成 |
| 2 | `medicalClinics` | 診所+其他醫事 | Clinics | PMTiles circle | ✅ S3 ready | ✅ 接線完成 |
| 3 | `medicalPharmacies` | 藥局 | Pharmacies | PMTiles circle | ✅ S3 ready | ✅ 接線完成 |
| 4 | `medicalAED` | AED 自動除顫器 | AED | PMTiles circle | ✅ S3 ready | ✅ 接線完成 |
| 5 | `medicalLongCare` | 長照據點 | Long-term Care | PMTiles circle | ✅ S3 ready | ✅ 接線完成 |
| 6 | `medicalIsochrone` | 醫療等時圈（大醫院可及性） | Hospital Access | PMTiles fill | ✅ S3 ready | ⏳ 待接線 |
| 7 | `medicalDesert` | 醫療沙漠（>15 min） | Medical Desert | 同 isochrone filter | ✅ 同上 | ⏳ 待接線 |
| 8 | `medicalICUBeds` | 急重症床位壓力 | ICU Bed Pressure | Supabase RPC realtime | ⏳ collector 已修待部署 | ⏳ 待建 |

> Layer 1-5 共用一個 PMTiles source（`medical_poi.pmtiles`, 77,857 點, 7.5MB），用 `med_cat` 屬性 filter。
> Layer 6-7 共用一個 PMTiles source（`medical_isochrone.pmtiles`, 36,852 格, 6.7MB），用 `level` 屬性 filter。

## 三層架構

```
┌─────────────────────────────────────────────────┐
│  Layer 8: 急重症床位壓力（即時）                    │  Supabase RPC
│  → 59 家急救責任醫院 ICU/加護床等待數               │  15 min refresh
├─────────────────────────────────────────────────┤
│  Layer 6-7: 醫療可及性（靜態分析）                  │  PMTiles fill
│  → 全台 1km 網格，開車到最近大醫院幾分鐘            │  OSRM routing
│  → 分級：≤5 / ≤10 / ≤15 / >15 min（沙漠）        │
├─────────────────────────────────────────────────┤
│  Layer 1-5: 基礎點位（靜態）                       │  PMTiles circle
│  → 醫院 451 / 診所 21,765 / 藥局 7,680            │  全程可見
│  → AED 15,490 / 長照 30,764                      │
└─────────────────────────────────────────────────┘
```

## 配色方案

| Layer | 色碼 | 視覺邏輯 |
|---|---|---|
| medicalHospitals | `#e53935` | 紅十字/急救 — 最醒目 |
| medicalClinics | `#ef9a9a` | 淺紅 — 醫院的延伸 |
| medicalPharmacies | `#7c4dff` | 紫色 — 藥局傳統色 |
| medicalAED | `#ffd700` | 金黃 — 國際 AED 標誌色 |
| medicalLongCare | `#00897b` | 青綠 — 照護/安心 |
| medicalIsochrone | 分級漸層 | 綠(≤5)→黃(≤10)→橙(≤15)→紅(>15) |
| medicalDesert | `#b71c1c` 半透明 | 深紅警示 — 醫療沙漠 |
| medicalICUBeds | `#ff1744` 脈動 | 亮紅 — 動態壓力指標 |

## Section 定義（layerCatalog.ts）

```
MEDICAL section:
├── 醫院 Hospitals          ← expandable (size/opacity)
├── 診所 Clinics            ← expandable
├── 藥局 Pharmacies         ← expandable
├── AED                     ← expandable
├── 長照 Long-term Care     ← expandable
├── 醫療等時圈 Access        ← expandable (opacity)
├── 醫療沙漠 Desert          ← toggle only
└── 急重症床位 ICU Beds      ← expandable (size/opacity)
```

## 資料 Pipeline

### PMTiles（靜態，S3 deploy-assets/medical/）
| 檔案 | 大小 | source-layer | 來源 |
|---|---|---|---|
| `medical_poi.pmtiles` | 7.5 MB | `medical_poi` | NHI 31,603 + AED 15,490 + 長照 30,764 |
| `medical_isochrone.pmtiles` | 6.7 MB | `isochrone` | OSRM grid 36,852 格 × 451 大醫院 |

### Supabase RPC（動態）
| RPC | 來源 | 頻率 |
|---|---|---|
| `get_er_hospital_current` | data-collectors er_hospital transformer | 15 min |

## 實作順序

### Phase 1 — 基礎點位上線 ✅ (BL-7 done)
- [x] merge_medical_poi.py → PMTiles → S3
- [x] medicalPOILayerFactory.ts + 5 layer (13 檔)
- [x] deploy scripts (nginx/pull/upload) 加 medical 支援
- [x] push medical/poi-layers 分支
- [ ] **merge PR + 部署** ← user 進行中

### Phase 2 — 等時圈接線 (BL-8 data done, 前端 TODO)
- [x] grid_accessibility.py --all-taiwan → 36,852 格
- [x] tippecanoe → medical_isochrone.pmtiles → S3
- [ ] `medicalIsochroneLayerFactory.ts` — fill layer + 分級色
- [ ] `medicalDesert` toggle — filter level="over15"
- [ ] LegendPanel 等時圈圖例
- [ ] 縣市 setFilter（比照 fireIsochrone）

### Phase 3 — 急重症床位（BL-6, collector 已修）
- [ ] merge collector-fix → 部署 data-collectors
- [ ] 驗證 `realtime.er_hospital_current` 有資料
- [ ] gis-platform 建 `get_er_hospital_current` RPC
- [ ] pulse 接 realtime layer（circle/pillar, timeStore 訂閱）

### Phase 4 — 擴充（backlog）
- [ ] 等時圈 group 2：醫院+診所（22,216 設施）
- [ ] 等時圈 group 3：藥局（7,680 設施）
- [ ] 健保母體 142 表 push/apply（Supabase 查詢用）
- [ ] CDC 傳染病動態 collector
- [ ] 統計圖層（病床數/護病比 → mini-taiwan-info）

## 需要改的檔案（Phase 2 接線）

| 檔案 | 改動 |
|---|---|
| `src/types/index.ts` | +3 keys to LayerVisibility + ExpandableLayerKey |
| `src/components/sidebar/layerCatalog.ts` | +3 LAYER_COLORS + SECTIONS 新增 entries |
| `src/map/medicalIsochroneLayerFactory.ts` | 新建：fill layer factory（仿 fireIsochroneLayerFactory） |
| `src/map/MapView.tsx` | import + ensureMedicalIsochroneLayers |
| `src/components/LegendPanel.tsx` | 等時圈分級圖例 |
| `src/components/FeatureInfoPanel.tsx` | 等時圈格點 popup（最近醫院名/分鐘數） |
| `src/hooks/useMapInteraction.ts` | 加 isochrone layer 的 click queryRenderedFeatures |

## 與其他分類的關係

- **FIRE & RESCUE**：消防等時圈是「消防分隊到你家」，醫療等時圈是「你到醫院」— 互補
- **WASTE FACILITY**：`wfMedical`（醫療廢棄物處理場）留在 WASTE 分類，不搬
- **FACILITY**：schools/convenienceStores 是通用設施；醫療獨立成類因為子層多且有分析層
