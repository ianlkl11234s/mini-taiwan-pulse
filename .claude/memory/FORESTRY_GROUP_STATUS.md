# 🌲 FORESTRY Layer Group — 接線 STATUS

**啟動**：2026-06-07
**任務發起**：主對話 (Opus 4.7 [1m])
**負責 agents**：3 個 tmux session 平行
**驗證者**：主對話

---

## 📋 全工作清單（agent 完成後勾選）

### 階段 A：資料就緒（taipei-gis-analytics 已備）

12 個原始 GeoJSON 已部署到 `mini-taiwan-pulse/public/forestry/`。3 個大檔需先轉 pmtiles：

| layer | GeoJSON 路徑 | 大小 | 處理 |
|-------|--------------|------|------|
| forestCompartments | `public/forestry/national_forest_compartments.geojson` | 219 MB | 🔴 **pmtiles 必做** |
| forestReserve | `public/forestry/forest_reserve.geojson` | 45 MB | 🔴 **pmtiles 必做** |
| forestRoads | `public/forestry/forest_roads.geojson` | 16 MB | 🟡 **pmtiles 建議** |
| forestRecreation | `public/forestry/forest_recreation_areas.geojson` | 2.4 MB | 🟢 直用 |
| forestTreatmentWorks | `public/forestry/forestry_treatment_works.geojson` | 2.0 MB | 🟢 直用 |
| forestTrailSigns | `public/forestry/mountain_trail_signs.geojson` | 1.2 MB | 🟢 直用 |
| forestSignalPoints | `public/forestry/mountain_signal_points.geojson` | 629 KB | 🟢 直用 |
| forestWildlife | `public/forestry/wildlife_distribution_3rd.geojson` | 275 KB | 🟢 直用 |
| forestDamLakes | `public/forestry/dam_lakes_in_forest.geojson` | 17 KB | 🟢 直用 |
| forestAlishanRail | `public/forestry/wildlife_distribution_3rd_alt.geojson` | 7 KB | 🟢 直用 |
| forestFlatParks | `public/forestry/flat_forest_parks.geojson` | 4 KB | 🟢 直用 |
| forestEducationCenters | `public/forestry/forest_education_centers.geojson` | 3 KB | 🟢 直用 |

---

### 階段 B：pmtiles 轉檔 ✅ 完成（session `forestry-pmtiles`）

**結果**：5 個 pmtiles 都已在 `mini-taiwan-pulse/public/forestry/`
- forest_reserve.pmtiles 1.9 MB (45→1.9, -95.8%)
- forest_roads.pmtiles 1.2 MB (16→1.2, -92.5%)
- national_forest_compartments.pmtiles 5.5 MB (219→5.5, -97.5%)
- signal_gap.pmtiles 3.8 MB (68→3.8, -94.4%)
- trail_coverage.pmtiles 4.4 MB (219→4.4, -98%)

- [x] B1. `which tippecanoe` 確認或 `brew install tippecanoe`
- [x] B2. 轉 `national_forest_compartments.pmtiles`（預期 5-15 MB）
- [x] B3. 轉 `forest_reserve.pmtiles`（預期 2-5 MB）
- [x] B4. 轉 `forest_roads.pmtiles`（預期 3-8 MB）
- [x] B5. 五個（+ signal_gap, trail_coverage） pmtiles 各驗證可正確讀取
- [x] B6. 寫入 `mini-taiwan-pulse/public/forestry/*.pmtiles`
- [x] B7. 大 GeoJSON 不刪（保留作 SSOT，前端只用 pmtiles）

---

### 階段 C：前端 SOP 接線（session `forestry-frontend`）

依專案 `.claude/commands/new-layer.md` 與 STATUS.md 提到的 **3 張 exhaustive Record**：

#### C1. `src/types/index.ts`
- [ ] LayerVisibility 加 15 key（12 layer + 3 衍生）
- [ ] ExpandableLayerKey 加對應
- [ ] FeatureInfo.layerType 加 forestry 類型

#### C2. `src/hooks/useLayerVisibility.ts`
- [ ] 15 key 預設 `false`

#### C3. `src/components/sidebar/layerCatalog.ts`
- [ ] LAYER_COLORS Record 補 15 個（缺一 TS2739）
- [ ] SECTIONS 加 `"FORESTRY"` group（12 layer + 3 衍生）
- [ ] 配色按本 STATUS 規格

#### C4. `src/hooks/useTransportParams.ts`
- [ ] 每 layer opacity slider state
- [ ] polygon 加 outline width + show outline boolean
- [ ] point 加 scale + Z
- [ ] line 加 width
- [ ] 衍生 H3 加 metric switcher state
- [ ] 全部塞進 overlayParams 物件 + deps array

#### C5. `src/map/overlayRegistry.ts`
- [ ] 3 polygon layer 走 registry（compartments/reserve/recreation）
- [ ] 走 pmtiles source 的（compartments/reserve/roads）型別 vector 而非 geojson
- [ ] 其他 polygon/point 走 geojson

#### C6. `src/components/LegendPanel.tsx`
- [ ] FORESTRY 分類圖例

#### C7. `src/hooks/useMapInteraction.ts`
- [ ] GIS_LAYERS 加 forestry layer popup

#### C8. `src/components/FeatureInfoPanel.tsx`
- [ ] case forestry-* sub-panel
- [ ] HEADER_LABELS Record 補 15 個（exhaustive）

#### C9. `src/components/IconRailSidebar.tsx`
- [ ] LAYER_ICONS Record 補 15 個（exhaustive）

#### C10. `scripts/deploy/upload-deploy-assets.sh`
- [ ] FOREST_FILES 陣列加 12 + 3 個檔

---

### 階段 D：衍生分析 ETL（session `forestry-etl`，taipei-gis-analytics 內）

#### D1. 野生動物熱點密度（H3 res 7） ✅ 2026-06-07
- [x] `pipelines/forestry/wildlife_density_h3/01_h3_aggregate.py`（h3-py 4.5.0）
- [x] 結果：691 hex，max count=13，hex avg area=5.16 km²
- [x] 部署 pulse `wildlife_density_h3.geojson` (337 KB)
- [x] catalog `docs/data-catalog/forestry/wildlife_density_h3.md`
- ⚠️ 註：上游 wildlife parquet 欄位只有 `WILDLIFE_/RECORDNO/PERIMETER`，**無物種欄位**，只算 `count` + `density`（非「物種數+個體數」）

#### D2. 山區通訊死角推估 ✅ 2026-06-07
- [x] `pipelines/forestry/signal_gap_analysis/01_buffer_diff.py`
- [x] 林班 unary_union − 通訊點 1km buffer (EPSG:3826)，min area_ha 0.1
- [x] 結果：600 polygon，死角面積 = 林班 **94.96%**（高山林班大量無 1km 內通訊點）
- [x] 部署 pulse `signal_gap.geojson` (71 MB)
- [x] catalog `docs/data-catalog/forestry/signal_gap_analysis.md`
- ⚠️ **Known issue**：71 MB 前端讀取會卡 → 建議 B 階段加做 `signal_gap.pmtiles`

#### D3. 步道密度 vs 林班覆蓋 ✅ 2026-06-07
- [x] `pipelines/forestry/trail_coverage/01_spatial_join.py`
- [x] sjoin within（路標 → 林班），加 `trail_count` + `trail_density = count/area_ha`
- [x] 結果：3700 polygon、**197 個有路標**；統計見 `_verification.json`
- [x] 部署 pulse `trail_coverage_per_compartment.geojson` (229 MB)
- [x] catalog `docs/data-catalog/forestry/trail_coverage.md`
- 🔴 **Known issue**：229 MB（林班 polygon 細，本體就 219 MB）→ 前端**必走 pmtiles**，建議 reuse `national_forest_compartments.pmtiles` 屬性 join，或另產 `trail_coverage.pmtiles`

---

### 階段 E：主控驗證（主對話）

- [ ] E1. `cd mini-taiwan-pulse && npx tsc -b` 0 error
- [ ] E2. `npm run dev` 啟動，瀏覽器開 `localhost:5173`
- [ ] E3. 點亮 FORESTRY group 每個 layer，確認顯示
- [ ] E4. 點 polygon/point 跳 FeatureInfoPanel 正確
- [ ] E5. 衍生 layer 三個 hex/buffer/choropleth 視覺正確
- [ ] E6. Legend 圖例顯示
- [ ] E7. 截圖收進 `.claude/screenshots/forestry-group-2026-06-07/`

---

## 配色 SSOT（C3 對應）

```ts
// FORESTRY 12 base
forestCompartments: "#15803D",         // 森林深綠 — 林班骨幹
forestReserve: "#0F766E",              // 青苔綠 — 保安林
forestRecreation: "#65A30D",           // 萊姆綠 — 遊樂區
forestRoads: "#A16207",                // 木褐 — 林道
forestTreatmentWorks: "#F59E0B",       // 警示橘 — 治理工程
forestTrailSigns: "#84CC16",           // 嫩綠 — 步道路標
forestSignalPoints: "#22C55E",         // 訊號綠 — 通訊點
forestEducationCenters: "#0EA5E9",     // 教育藍 — 自然教育
forestWildlife: "#A855F7",             // 生態紫 — 野生動物
forestDamLakes: "#06B6D4",             // 水青 — 堰塞湖
forestFlatParks: "#A3E635",            // 草綠 — 平地森林
forestAlishanRail: "#92400E",          // 鐵道棕 — 阿里山鐵路

// FORESTRY 3 衍生分析
forestWildlifeDensity: "#7E22CE",      // 紫漸層 main
forestSignalGap: "#DC2626",            // 警示紅 死角
forestTrailCoverage: "#14532D",        // 深綠 choropleth max
```

## icon SSOT (lucide-react)

```ts
forestCompartments: Trees,
forestReserve: Shield,                  // 法定保安
forestRecreation: TreePine,
forestRoads: Route,
forestTreatmentWorks: Hammer,
forestTrailSigns: MapPin,
forestSignalPoints: Signal,
forestEducationCenters: GraduationCap,
forestWildlife: PawPrint,
forestDamLakes: Waves,
forestFlatParks: Sprout,
forestAlishanRail: TrainFront,
forestWildlifeDensity: Hexagon,         // H3
forestSignalGap: AlertTriangle,
forestTrailCoverage: LayoutGrid,        // choropleth
```

---

## tmux dispatch 對照

| session | 涵蓋 | 約耗時 |
|---------|------|--------|
| `forestry-pmtiles` | 階段 B（B1-B7） | 5-15 min |
| `forestry-frontend` | 階段 C（C1-C10） | 20-40 min |
| `forestry-etl` | 階段 D（D1-D3） | 10-20 min |
