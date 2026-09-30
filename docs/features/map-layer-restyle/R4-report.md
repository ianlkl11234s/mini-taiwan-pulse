# R4 圖例對齊與識別色：驗收報告

> 本檔記錄**本地** worktree 證據，未推送、未開 PR、未部署。靜態 HTML DOM readback 不構成 Mapbox／Three runtime 或 browser 驗收。

程式 commit：`dd5db005`（`feat(legend): align map legend shapes and theme colors`）。本報告與 HTML 另以 docs commit 交付；scratch 腳本／logs 留本機、不提交。

## 1. 驗收結果

| §7 項目 | 結果 | 證據／待辦 |
|---|---|---|
| 1. `npx tsc -b` | 通過 | `scratch/r4-legend/tsc-final.log` 為空、exit 0。 |
| 2. `npx vitest run` | 通過（逾時重跑） | 預設併行：426 files passed／6 failed／6 skipped（皆資料查詢 timeout）；單 worker 全套：431 passed／1 failed／6 skipped、2719 tests passed／1 failed／26 skipped，僅 `pollutionPenaltiesDataset` timeout，獨立重跑 1 file／3 tests 通過（1.59s）。`legendKit`、`legendAlignment`、`layerConsistency`、`designSystemGuard` 全過。 |
| 3. golden fixture diff | 通過 | `執行後 `git diff --stat src/data/__tests__/__fixtures__/` 為空（`golden-final.log` 記錄執行、`golden-diff.log` 為空），fixture 未保留變更。 |
| 4. `design:audit-layers` | 28 → 3 | 剩 `facPrimary`、`parkingOnstreet`、`powerPlants`；都是 property／interpolate paint，audit 無法比較 runtime 輸入。待 browser 確認與 Claude 接受，不宣稱 0。 |
| 5. 暗／淡 HTML render | 通過靜態 render | `r4-legend-after.html` 已 render 28 × 2；腳本為未提交的 `scratch/r4-legend/render-legends.tsx`。 |
| 6. browser（選做） | pending | 僅有靜態 HTML DOM readback，未驗證地圖 runtime。 |

### Inventory 的既有漂移

重產後與版控 inventory 比較，8 層數值欄有差異：`lightning`、`lightningCwa`、`nuclearRadiation`、`pollutionFacility`、`pollutionPenaltyGeneral`、`powerPlants`、`welfareElderlyHomes`、`welfareNursingHomes`。差異是 radius／stroke opacity；本次未修改這些 paint，且 golden 零差異。故不能宣稱整個 `layers` JSON diff 為空：此為版控 inventory 未同步現有 paint，交 Claude 統一重產。所有 sublayer 色值比較無變化；metadata 的 legendType／證據行號隨本輪變動。

### 重產暗淡 HTML

腳本完整路徑：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/map-r4-legend/scratch/r4-legend/render-legends.tsx`（scratch 不提交）。在 master checkout 內執行同一支腳本，指定 `R4_OUTPUT=/absolute/path/r4-legend-before.html npx vite-node /absolute/path/render-legends.tsx`。預設所有群組成員開啟，overlayParams 使用 legend fallback；不是所有參數組合，也不是 runtime map 驗證。

驗收 logs：`scratch/r4-legend/vitest-final.log`、`vitest-serial.log`、`pollution-standalone-final.log`。沒有提高 timeout 或調整 design guard 基準。

## 2. 28 個圖例逐項對照

`medHospital` 同時屬 B、D，故以下共 28 個唯一 id。A 類已改形狀、B/C/D 已改對齊色票；表內「待 browser」僅指 runtime／audit 仍待驗，不是本地程式未修改。

| 圖例 id | 類別 | 本輪改動 | 常數／檔案 | 狀態 |
|---|---|---|---|---|
| `buildingsGba` | A | 面圖例圓點改 `SwatchSquare` | `BUILDING_HEIGHT_BANDS` | 靜態完成 |
| `urbanFormGrid` | A | 面圖例圓點改 `SwatchSquare` | `URBAN_FORM_GRID_MODES` | 靜態完成 |
| `propertyValueGrid` | A | 0 值改第一 band + `.04` opacity，不是缺值 | `scale.bands`／`propertyValueGridOpacityExpr` | 靜態完成 |
| `fireHydrants` | A | 方塊改 `SwatchDot` | `FIRE_HYDRANT_CATS` | 靜態完成 |
| `govServiceOffices` | A | 方塊改 `SwatchDot` | `GOV_SERVICE_PAINT_COLORS` | 靜態完成 |
| `noiseEnforcementEvents` | A | 方塊改 `SwatchDot` | `NOISE_ENFORCEMENT_COLOR_EXPR` | 靜態完成 |
| `soundCameraLocations` | A | 方塊改 `SwatchDot` | `SOUND_CAMERA_PRECISION_META` | 靜態完成 |
| `osmBridgeCarriers` | A | 改 `SwatchLine` | `CARRIER_KINDS` | 靜態完成 |
| `osmRoadDrive` | A | 改 `SwatchLine`、保留 dash | `ROAD_DRIVE_PAINT_COLORS` | 靜態完成 |
| `medHospital` | B、D | 五個醫療色票隨 `isDark` 切換 | `medicalPoiColor`（`medicalPOITypes.ts:60`） | 靜態完成 |
| `officialNoiseMonitoring` | B | dB 漸層同 paint；歷史低透明、missing 中空 | `OFFICIAL_NOISE_COLOR_EXPR`／`OFFICIAL_NOISE_FRESHNESS` | 靜態完成 |
| `facPrimary` | C | facility property 分色；歷史維持灰色 | `FACILITY_FUEL_COLORS`／`FACILITY_STATUS_PAINT_COLORS` | 待 browser |
| `gasStationCpc` | C | 對齊 registry 的 14 層各自 paint 色與線／面形狀 | `FOSSIL_PAINT_COLORS`（`layerPaintColors.ts:3`） | 靜態完成 |
| `livestockFarmPig` | C | light→dark ramp，保留「越多越深」 | `FARM_COLOR_RAMP`／`OTHER_SPECIES_COLOR_RAMP` | 靜態完成 |
| `parkingOnstreet` | C | on-/off-street 空位率與容量 expression | `parkingAvailabilityColor`／`PARKING_NEUTRAL_STOPS` | 待 browser |
| `pollutionPenaltyCritical` | C | 嚴重度只留文字；介質色票、mobile 綠色 | `PENALTY_MEDIUM_COLOR_EXPR`／`PENALTY_SEVERITY_COLORS.mobile` | 靜態完成 |
| `powerPlants` | C | `FUEL_COLORS` 的 2D property 與 3D beam；hit layer 透明 | `FUEL_COLORS`／`fuelColorOf` | 待 browser |
| `companyCapitalGrid` | D | 色票依 `isDark` 切換 outline | `THEMED_PAINT_COLORS.companyGridOutline` | 靜態完成 |
| `ecoNetworkZones` | D | 色票依 `isDark` 切換 outline | `THEMED_PAINT_COLORS.ecoNetworkOutline` | 靜態完成 |
| `forestCompartments` | D | 色票依 `isDark` 切換 outline | `FORESTRY_PAINT_COLORS`／`HIKING_TRAIL_PAINT_COLORS`／`THEMED_PAINT_COLORS.forest*Outline` | 靜態完成 |
| `industrialParkBoundaries` | D | 色票依 `isDark` 切換 outline | `THEMED_PAINT_COLORS.industrialParkOutline` | 靜態完成 |
| `industrialParkComparison` | D | 色票依 `isDark` 切換 outline | `THEMED_PAINT_COLORS.industrialComparisonOutline` | 靜態完成 |
| `jpAccommodationDensity` | D | 色票依 `isDark` 切換 outline | `THEMED_PAINT_COLORS.jpAccommodationOutline` | 靜態完成 |
| `newsEvents` | D | 分類色不變、glow 依主題 | `THEMED_PAINT_COLORS.newsGlow` | 靜態完成 |
| `ooklaPerformanceGrid` | D | 色帶依 `isDark` 切換 outline | `THEMED_PAINT_COLORS.ooklaGlobalOutline`／`ooklaTaiwanOutline` | 靜態完成 |
| `realEstateRentalGrid` | D | 漸層依 `isDark` 切換 outline | `THEMED_PAINT_COLORS.realEstateOutline` | 靜態完成 |
| `schools` | D | 總覽色依主題、學制保留分類色 | `THEMED_PAINT_COLORS.school`／`SCHOOL_LEVEL_COLORS` | 靜態完成 |
| `waterCanals` | D | 三條線依主題切換 | `THEMED_PAINT_COLORS.canal*` | 靜態完成 |

常數來源：

- `BUILDING_HEIGHT_BANDS` → `src/data/buildingsGbaTypes.ts:25`
- `URBAN_FORM_GRID_MODES` → `src/data/urbanFormGridTypes.ts:109`
- `FIRE_HYDRANT_CATS` → `src/data/fireTypes.ts:22`
- `CARRIER_KINDS` → `src/data/networkStructuresTypes.ts:15`
- `NOISE_ENFORCEMENT_COLOR_EXPR` → `src/data/noiseTypes.ts:55`
- `SOUND_CAMERA_PRECISION_META` → `src/data/noiseTypes.ts:32`
- `OFFICIAL_NOISE_COLOR_EXPR` → `src/data/noiseTypes.ts:91`
- `FACILITY_FUEL_COLORS` → `src/data/energyLoader.ts:329`
- `FARM_COLOR_RAMP` → `src/data/livestockTypes.ts:26`
- `parkingAvailabilityColor` → `src/data/parkingLoader.ts:49`
- `PENALTY_MEDIUM_COLOR_EXPR` → `src/data/pollutionTypes.ts:66`
- `FUEL_COLORS` → `src/data/energyLoader.ts:832`

其餘新增色表皆在 `src/map/layerPaintColors.ts`；醫療在 `src/data/medicalPOITypes.ts`；property grid 在 `src/data/propertyValueTypes.ts`。

## 3. C 類 hook／runtime 判讀

| 圖例 id | 實際畫面取色 | 程式證據 | 判讀結論 | 是否已改 |
|---|---|---|---|---|
| `facPrimary` | `facPrimary`、`facPlanned`、`facSecondary`、`facOsmSupplement` 畫 `properties.color`；其值由 `facilityFuelColor(fuel_type)` 建立。`facHistorical` 則固定 `#525252`，不採該屬性。 | [`useEnergyPoiLayer.ts`](../../../src/hooks/useEnergyPoiLayer.ts:755) 於 766 建 `color`；[`overlayRegistry.ts`](../../../src/map/overlayRegistry.ts:7054)／7149／7234／7265 讀取它；[`overlayRegistry.ts`](../../../src/map/overlayRegistry.ts:7195) 固定歷史灰。 | 可靜態判定；仍屬 audit／browser pending。 | 已改／待 browser |
| `gasStationCpc` | `useFossilFuelLayers` 僅將各資料集 `setData` 至既有 source；顏色仍由 registry 各 layer paint 決定。 | [`useFossilFuelLayers.ts`](../../../src/hooks/useFossilFuelLayers.ts:81)–88 只 `setData`；[`overlayRegistry.ts`](../../../src/map/overlayRegistry.ts:7285) 起為各 registry paint。 | 可確定對齊 registry；不需把 hook 當顏色覆寫。 | 已改 |
| `livestockFarmPig` | hook 僅將 owner-gated GeoJSON 餵入共用 source；畫面用 registry 的物種／數量 color ramp。 | [`useLivestockLayers.ts`](../../../src/hooks/useLivestockLayers.ts:93)–100 只 `setData`；[`overlayRegistry.ts`](../../../src/map/overlayRegistry.ts:547)–603 以 `FARM_COLOR_RAMP`、`farmColorRamp` 建色。 | 可確定對齊 registry expression。 | 已改 |
| `parkingOnstreet` | hook 在 replay 寫入 `availability_rate` 並餵 source；on-street polygon 用中性容量 expression，point／off-street 用空位率 expression。 | [`useParkingLayer.ts`](../../../src/hooks/useParkingLayer.ts:92) 起重算 feature 值；[`overlayRegistry.ts`](../../../src/map/overlayRegistry.ts:6929) 與 6944 使用兩種 expression。 | 可確定顏色由 registry expression 解析；仍應 browser 核對混合 geometry 的呈現。 | 保留既有正確主色；待 browser |
| `pollutionPenaltyCritical` | hook 只套 filter；重大／一般層採 `PENALTY_MEDIUM_COLOR_EXPR`，移動污染採 `PENALTY_SEVERITY_COLORS.mobile`。 | [`usePollutionLayers.ts`](../../../src/hooks/usePollutionLayers.ts:103)–119 只 `setFilter`；[`overlayRegistry.ts`](../../../src/map/overlayRegistry.ts:9294)、9350、9384 為 paint。 | 可確定對齊 registry／資料常數。 | 已改 |
| `powerPlants` | legacy 2D 層讀 feature `color`；其資料轉換以 `fuelColorOf`（退役則 `RETIRED_COLOR`）建立。3D beam 亦以 `fuelColorOf`；`powerGenerationUnit` 的 2D 層為全透明 hit-test。 | [`useEnergyPoiLayer.ts`](../../../src/hooks/useEnergyPoiLayer.ts:100)–105；[`overlayRegistry.ts`](../../../src/map/overlayRegistry.ts:5873)／5909；[`PowerGenerationBeamScene.ts`](../../../src/three/PowerGenerationBeamScene.ts:113)；[`overlayRegistry.ts`](../../../src/map/overlayRegistry.ts:5923) 起。 | 可確定 fuel 色的 runtime SSOT 為 `FUEL_COLORS`／`fuelColorOf`；3D 實畫仍待 browser readback。 | 保留既有正確主色；待 browser |

## 4. K-1 單色圖層

以 baseline inventory 的 main 子圖層篩選：所有主色皆為單一常數，且同一圖層只有一個暗色主色，再與 `LAYER_COLORS` 比較。得到 13 筆（9 點、4 線／面），與規格舊估計「10 點」不同；未把 match／step／interpolate 的識別色列入。

本輪識別色未改：`layerCatalog.ts:68–71` 由 `manifestColors()` 派生；`layerManifest.test.ts:89–90` 強制相等。以下修改需動禁改的 `layerManifest.ts`，全部列為 **需要 Claude 處理**。醫療圖例／paint 的共享常數已可先獨立修正，不代表 manifest 識別色已更新。

| 圖層 | 幾何 | LAYER_COLORS 舊值 → 建議新值（未套用） | 地圖淡色 |
|---|---|---|---|
| `facHistorical` | point | `#8C5D42` → `#525252` | `#525252` |
| `farmRoads` | line | `#7a8670` → `#a4b494` | `#7a8670` |
| `landingStations` | point | `#26c6da` → `#ffb74d` | `#ffb74d` |
| `medAED` | point | `#fbc02d` → `#fdd835` | `#f9a825` |
| `medClinic` | point | `#1976d2` → `#42a5f5` | `#1565c0` |
| `medHospital` | point | `#d32f2f` → `#e53935` | `#c62828` |
| `medLTC` | point | `#8e24aa` → `#ab47bc` | `#7b1fa2` |
| `medPharmacy` | point | `#388e3c` → `#66bb6a` | `#2e7d32` |
| `submarineCables` | line | `#2196F3` → `#26c6da` | `#26c6da` |
| `taxiStand` | point | `#f9a825` → `#ffd54f` | `#f9a825` |
| `tourHotSpringZones` | line,polygon | `#880e4f` → `#c2185b` | `#880e4f` |
| `tourScenicAreas` | line,polygon | `#00695c` → `#26a69a` | `#00695c` |
| `wasteStopsStatic` | point | `#d97706` → `#fbbf24` | `#d97706` |

## 5. 新增或抽出的常數

只將原色值換為常數；golden 重產零差異。

| 常數名 | 檔案 | overlayRegistry.ts 取代行 |
|---|---|---|
| `FOSSIL_PAINT_COLORS` | `src/map/layerPaintColors.ts` | 7304, 7335, 7366, 7397, 7428, 7459, 7490, 7521, 7538, 7563, 7587, 7615, 7629, 7641, 7654, 7681, 7695, 7707, 7720, 7747, 7761, 7773, 7786, 7816, 7833 |
| `GOV_SERVICE_PAINT_COLORS` | `src/map/layerPaintColors.ts` | 2705, 2706, 2707, 2708, 2727, 2728, 2729, 2730 |
| `ROAD_DRIVE_PAINT_COLORS` | `src/map/layerPaintColors.ts` | 8186, 8187, 8188, 8189, 8190, 8191 |
| `THEMED_PAINT_COLORS` | `src/map/layerPaintColors.ts` | 184, 229, 854, 2396, 2433, 2462, 2477, 2478, 3243, 3264, 3535, 3536, 3537, 3550, 3551, 3552, 4219, 4242, 5432, 5469, 5497, 5524 |
| `FACILITY_STATUS_PAINT_COLORS` | `src/map/layerPaintColors.ts` | 7054, 7149, 7161, 7162, 7163, 7164, 7195, 7205, 7234, 7265 |
| `FORESTRY_PAINT_COLORS` | `src/map/layerPaintColors.ts` | 5461, 5489, 5516, 5546, 5570, 5679, 5705, 5731, 5755, 5779, 5831, 5855 |
| `HIKING_TRAIL_PAINT_COLORS` | `src/map/layerPaintColors.ts` | 5365, 5366, 5367, 5368, 5369, 5370, 5390, 5391, 5392, 5393, 5394, 5395 |
| `medicalPoiColor` | `src/data/medicalPOITypes.ts` | 2994, 3010, 3042, 3058, 3090, 3106, 3138, 3154, 3186, 3202 |

## 6. 手寫色票收斂

| 指標 | 結果 |
|---|---|
| 修改前 | 90 處 `LegendPanel.tsx` 手寫 `width: N, height: N` 色票（handoff 基準） |
| 修改後 | 6；`legendKit.test.ts` 上限已下調。 |
| 尚未收斂的項目 | 下表逐一列出；另有動態尺寸色票屬 LG-5，不在此 literal 尺寸 regex 計數內。 |

| LegendPanel.tsx 行 | 保留原因 |
|---|---|
| 2070、2071 | 表演場館 6px／16px 大小對照，LG-5 不在本輪。 |
| 5100、5101 | 航空空域 14×10 虛線空框／實心面條件分支，kit 無矩形虛線外框。 |
| 5239 | 電網 1.5px 細線；SwatchLine 最小 2px，§5 要求保留既有線寬。 |
| 5478 | 離岸風電 24×8 特殊圖樣／外框，kit 無對應複合色票。 |

## 7. 限制與需 Claude 處理事項

1. K-1 的 13 層（9 點、4 線／面）需改 manifest 才能維持 `LAYER_COLORS === manifest.color` 的既有契約；本 R4 worktree 不可修改 manifest。
2. `parkingOnstreet` 同時含 polygon／point，且 replay 依時間重寫 `availability_rate`；靜態 render 只能驗 legend markup，不能證明 map 實畫，建議 browser readback。
3. `powerPlants` 的 3D beam 與透明 hit layer不是同一種 Mapbox paint；需 browser readback 才能確認圖例與 3D 視覺的最終相符性。
4. `schools` 總覽與學制同開時，同列保留兩種色票；單開 Ookla 台灣時使用 `.45` outline。已加 render regression tests。D 類不少暗淡差異實際在 outline／glow，故修正描邊／光暈，不把固定 fill 換成邊框色。
5. 不新增退役機組圖例列（handoff 禁止新增圖例／改文字）；2D retired 特色已列 C 類證據，Claude 可另案決定如何補語意。
6. 依使用者最新指示僅本地 commit，不 push、開 PR、merge 或部署。未獲准刷新遠端，因此未確認最新 R3 merge 狀態、未 rebase；Claude 整合時依 handoff §8 處理。
