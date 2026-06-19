# Energy v2 — 進度追蹤

> 接續 `energy-v2-plan.md`。每 phase commit 一次、不 push、不 merge（等用戶 review）。
> Phase A+B 已 merge 進 master（PR #25）；Phase C 開 `feat/energy-v2-C` 從 master 切。

## Phase A — Monitor 整合（in progress）

### A.1 — PowerCard skeleton + MonitorPanel 接線（done）

- [x] 新檔 `src/components/intel/monitor/PowerCard.tsx`
      上：燈號 + 負載 / 備轉 / 供電 + 預測尖峰
      中：4 區 mini-bars（pct 對 local max 正規化）
      下：14 廠 sparkline grid（按 mw desc 排序，rate 配色）
- [x] 新檔 `src/components/intel/monitor/powerCardData.ts`
      純函式 `buildPowerCardModel(dashboard, day)` + `loadRateColor(rate)`
      把 view-model 從 React 元件抽離（純資料層才能在 node 環境跑單元測試）
- [x] `IndicatorPanel` 加 `powerDashboard` / `powerDay` 兩個 prop，
      `<PowerCard>` 接在 `<SituationCards>` 之後、`<LiveWall>` 之前
- [x] `MonitorPanel` 在 `open` 時自動拉：
      - `fetchPowerDashboard()` 每 5 分鐘 poll（與 `usePowerDashboard` 共用 `cachedOnce` cache）
      - `fetchPowerGeneration24h()` 每 10 分鐘 poll
      - 兩者 invalidate→refetch、unmount 取消
- [x] 新檔 `src/components/intel/monitor/__tests__/powerCardData.test.ts`（7 cases）：
      - 空 dashboard / null day → 4 region 仍 render 空槽、indicator/observedHHMM 為 fallback
      - 區域 pct normalisation 用 local max（北部 → 1.0 / 東部 → ~0.038）
      - 14 廠最新值取最後一個 sample、按 mw desc 排序、空 points 廠歸 null
      - 髒資料 rate clamp 到 [0, 1.5]
      - `loadRateColor` 4 段 + 邊界值（0.5/0.85/1.0 落到下一階）
- [x] `npx tsc -b` 0 error
- [x] `npx vitest run` 全 12 檔 / 109 cases 通過

### 沒做的（保留給 A.2 / A.3）

- KPI 數字（24h max/min/avg load_rate / fuel mix 比例）— A.2 再算
- Monitor 開啟自動 share `energyDashboardActive`（目前 MonitorPanel 自己拉、走 `cachedOnce` 共用，
  不需動 App.tsx；待 A.2 觀察是否兩處重複 fetch 浪費 RPC）
- `get_power_generation_kpi_24h()` 新 RPC — A.2 評估後再決定（多數 KPI 前端算就夠）

### A.2 — KPI strip + timeline isolation test（done）

- [x] PowerCard 新 KPI strip：24h 尖峰 / 當前合計 / fuel mix bar + 前 5 項 legend（fuel 走 `fuelColorOf`）
- [x] 6 新測試（共 13 cases）：
      - 空 day → 零值
      - peak 是「各時點全國總和」max（非單廠 max）
      - fuel mix 用最新 ts snapshot 分組、pct normalised、desc sorted
      - `fuel_type: null` 歸 'unknown'
      - **timeline isolation contract**：`buildPowerCardModel` 不收 time 參數、永遠取 array 最後一筆

### A.3 — share dashboard fetch with App.tsx（pending）

兩處跑 5min interval、`cachedOnce` 5min TTL dedup → 不浪費 RPC，
但仍可能 invalidate 互踩。實測前不修。

## Phase B — HAZARD（done，待視覺驗收）

### B.1+B.2 — types + loaders + Legend + featureInfo（合併 commit done）

合併原因：layerConsistency 測試會擋「LegendPanel 漏接」「useTransportParams 漏接」，所以
B.1 資料層必須與 B.2 UI 接線同時送進來才不會 ratchet fail。

- [x] types/index.ts：`LayerVisibility` / `ExpandableLayerKey` / `FeatureInfo.layerType` 各加兩 key
- [x] `lightningLoader.ts`：clampMinutes / lightningTypeColor / toLightningFC + cachedByKey(60s)
- [x] `nuclearLoader.ts`：classifyNuclearDose 5 階（normal/watch/warning/alarm/stale）+ cachedOnce(5min)
      NUCLEAR_DOSE_THRESHOLDS 參考 AEC 0.5 µSv/h 警戒
- [x] sidebar HAZARD section + LAYER_COLORS + IconRailSidebar（CloudLightning / Atom）
- [x] LegendPanel：LightningLegend + NuclearLegend（'is_stale + 高劑量 ≠ 核災' 警語）
- [x] hazardPanels.tsx：LightningStrikePanel + NuclearStationPanel
      （NuclearStationPanel is_stale → 灰底警告，alarm → 紅底建議交叉確認原能會）
- [x] useTransportParams：lightning 加時間窗 5~360 min + 透明度；nuclear 加大小 + 透明度
- [x] 17 新 test (data/__tests__/hazardLoaders.test.ts)

### B.3+B.4 — overlayRegistry + hooks + App.tsx wiring（done）

- [x] overlayRegistry：lightning halo (blur 電光) + core；nuclear halo + core，stale 虛邊框
- [x] `useHazardLayer.ts`：useLightningLayer(map, visible, minutes) + useNuclearLayer(map, visible)
      共用 useSourceFeed helper（style.load 重 feed）
- [x] App.tsx 接 2 hook
- [x] useMapInteraction GIS_LAYERS 兩條
- [x] tsc -b clean / 全套 126 test pass

### B 暫不做（v2 後再加）

- **Cluster + zoom-gate**：plan 預期雷雨季升級項；OverlayConfig 沒 cluster 欄要先擴 schema。
  v1 用時間窗 5~360 min slider 控制 payload，預設 60min 通常 ≤ 數百筆。
- Monitor HazardCard（過去 1h 閃電數 / 核安異常站數 KPI）— 等 B 視覺驗收後再做

## Phase C — 高壓電網兩件套（done，待視覺驗收）

> 範圍校正：substations 已在 Energy MVP 上線（migration 216 + useEnergyPoiLayer），
> Phase C 實際只新增 **lines + towers** 兩件套。substations 留既有色不動。

### C.1 — migration 228 + RPC 驗證

- [x] `../gis-platform/migrations/228_osm_power_grid_rpc.sql`：
      - `get_osm_power_lines()` RETURNS TABLE（osm_id/line_type/voltage/circuits/operator/frequency/location + geom_json）
      - `get_osm_power_towers()` RETURNS TABLE（osm_id/voltage/operator/material/design/ref + lon/lat）
      - 兩 RPC `GRANT EXECUTE TO anon, authenticated`
- [x] psql apply 0 error
- [x] 驗：lines 2,305 rows / 1.69 MB payload；towers 26,589 rows（PostgREST 走 TABLE 不撞 20k JSONB cap）

### C.2 — types + loader + paint + UI 接線（合併 commit）

合併原因：3 個 ratchet（LAYER_COLORS / LEGEND_REGISTRY / useTransportParams cases）會擋拆 commit。

- [x] `types/index.ts`：LayerVisibility 加 `osmPowerLines` / `osmPowerTowers`，FeatureInfo.layerType 加 `osmPowerLine` / `osmPowerTower`
- [x] `OverlayLayerSpec` 擴 `filter?: unknown[]`（同 source 多 layer 各自 sub-filter）+ `overlayManager` spec.filter 優先於 config.filter
- [x] `energyLoader.ts`：
      - `OsmPowerLine` / `OsmPowerTower` interface + `fetchOsmPowerLines` / `fetchOsmPowerTowers`（cachedOnce 60min）
      - 純函式 `parseVoltageKv("161000;69000") → [69, 161]`
      - 純函式 `powerLineTierKv(voltage) → 345 | 161 | 69 | 0`
      - `POWER_LINE_VOLTAGE_COLORS` cyan 系（345=#67e8f9 / 161=#22d3ee / 69=#0ea5e9 / mixed=#475569）
- [x] `useEnergyPoiLayer.ts` 加 showPowerLines / showPowerTowers + powerLinesToGeoJSON / powerTowersToGeoJSON（在 properties 寫 tier）
- [x] `overlayRegistry.ts`：
      - osmPowerLines 3 layer：glow（全吃 line blur）+ core（filter `!= cable`，line/minor_line 走 match width/opacity）+ cable（filter `== cable`，dasharray [2,2]）
      - osmPowerTowers 1 layer：circle minzoom 13，color by tier match
- [x] `layerCatalog.ts`：ENERGY section 加兩條 + LAYER_COLORS 兩色（cyan/sky）
- [x] `IconRailSidebar.tsx`：lucide `Spline`（lines）+ `TowerControl`（towers）
- [x] `useTransportParams.ts`：4 slider（lines opacity/width + towers opacity/size）+ return + deps
- [x] `useMapInteraction.ts` GIS_LAYERS 兩條（lines→osmPowerLine / towers→osmPowerTower）
- [x] `energyPanels.tsx`：`OsmPowerLinePanel` + `OsmPowerTowerPanel`（fmtVoltageKv "161000;69000" → "69 / 161 kV"）
- [x] `registry.tsx` panel + label
- [x] `LegendPanel.tsx`：`PowerGridLegend`（4 tier 色 + 3 線型 + "鐵塔需 zoom ≥ 13" + "約 60% 線未標電壓" 警語）
- [x] `App.tsx` 接 hook
- [x] 新測 `energyLoader.test.ts` 9 cases（parseVoltageKv 6 + powerLineTierKv 3 含邊界 60/150/300 kV）
- [x] `npx tsc -b` 0 error
- [x] `npx vitest run` 全 14 檔 / 155 cases pass（含 layerConsistency）

### C 暫不做（plan 也未列）

- substations operator filter toggle（plan 提的 showNonTaipower）— Energy MVP 既有 layer 未拆，要動會牽連 v1 PR #23，留 v3 評估
- towers 預期 ~26k 點全量載入 5MB+ JSON，前端 setData 一次性 OK；若實測卡頓再考慮 PMTiles（屬 E-E 範疇）

## Phase D.1 — OSM 風光電 3 件套（done，待視覺驗收）

> E-D 8 表分 D.1/D.2/D.3 推進；本批 wind + solar + osm_power_plants 純 POI。

### D.1 — migration 229 + 接線（合併 commit）

- [x] `../gis-platform/migrations/229_osm_renewable_rpc.sql` 3 RPC：
      - `get_osm_wind_turbines()` 812（含 is_offshore / height_m / rotor_diameter_m / capacity_mw）
      - `get_osm_solar_farms()` 734（POI centroid，poly_geom 未填全 NULL）
      - `get_osm_power_plants_static()` 513（OSM 自有，補充 IPP/小型，與 all_power_plants_v 可能重疊）
- [x] psql apply + 3 RPC count 全對
- [x] `types/index.ts`：3 LayerVisibility key + 3 FeatureInfo.layerType
- [x] `energyLoader.ts`：3 interface + 3 fetchXxx（cachedOnce 60min）
- [x] `overlayRegistry.ts` 3 entry：
      - osmWindTurbines：halo + core，色 case is_offshore=true → `#67e8f9` cyan-300 / false → `#2dd4bf` teal-400 / null → 灰
      - osmSolarFarms：halo + core，amber-400 `#fbbf24`
      - osmPowerPlantsStatic：core，paint match plant_source 分色（solar/wind/hydro/coal/gas/nuclear/waste...）
- [x] `useEnergyPoiLayer.ts`：3 source 加 cachedOnce + 3 GeoJSON converter
- [x] `layerCatalog.ts`：ENERGY 加 3 條 + LAYER_COLORS 3 色（cyan-300/amber-400/灰）
- [x] `IconRailSidebar.tsx`：lucide `Wind`（風機）/ `Sun`（光電）/ `Factory`（OSM 電廠）
- [x] `useTransportParams.ts`：6 slider（size + opacity × 3）+ return + deps
- [x] `useMapInteraction.ts` GIS_LAYERS 3 條
- [x] `energyPanels.tsx`：3 panel（OsmWindTurbinePanel offshore label / OsmSolarFarmPanel 含 area_m² / OsmPowerPlantStaticPanel fuel 染色）
- [x] `registry.tsx`：panel + label
- [x] `LegendPanel.tsx`：`RenewablePoiLegend`（依 visibility 條件顯示各 sub-section、含 OSM 電廠 fuel 8 色 + "與 all_power_plants_v 可能重疊" 警語）
- [x] `App.tsx` 接 hook 3 新 prop
- [x] `npx tsc -b` 0 error
- [x] `npx vitest run` 14 檔 / 155 cases pass（含 layerConsistency + registry）

### D.1 暫不做

- 風機 capacity_mw 分大小 — 全島 zoom 7~9 size 差距視覺不明顯，先固定大小 + slider 調整
- solar_farms.poly_geom 全 NULL → 待 OSM scraper 補 polygon 才能上面狀渲染
- osm_power_plants 跟 all_power_plants_v dedup — 兩 layer 獨立 toggle，使用者自己挑

## Phase D.2 + D.3 — 5 表（done，合併 commit，待視覺驗收）

> 合併原因：types 一加多 key、ratchet 必須同 commit 全接。5 layer 一次到底比拆 2 commit 省力且 atomic。

### D.2/D.3 — migration 230 + 5 layer 接線

- [x] `../gis-platform/migrations/230_energy_specialty_rpc.sql` 5 RPC：
      - `get_offshore_wind_zones()` 36 MultiPolygon（含 capacity/depth_min/max/distance/award/cod_year）
      - `get_island_power_grid()` 14（澎湖/金門/馬祖/蘭嶼/綠島/琉球，含 fuel_type）
      - `get_fossil_fuel_infrastructure()` 9（gas_power_plant 3 + lng_terminal 3 + oil_refinery 3）
      - `get_geothermal_wells()` 36（含 report_url / figure_url 外連）
      - `get_renewable_permits_taipei()` 438（學校 164/國有 149/機關 119/焚化 3/沼氣 2/水力 1）
- [x] psql apply + 5 RPC count 全對
- [x] `types/index.ts`：5 LayerVisibility + 5 FeatureInfo.layerType
- [x] `energyLoader.ts`：5 interface + 5 fetch（cachedOnce 60min）+ TAIPEI_RE_CATEGORY_COLORS / FOSSIL_FUEL_COLORS export
- [x] `overlayRegistry.ts` 5 entry：
      - offshoreWindZones：fill + line（cyan-400 半透明 polygon + cyan-300 outline）
      - islandPowerGrid：core circle，fuel_type 6 色 match
      - fossilFuelInfra：core circle，facility_type 3 色（LNG cyan / 煉油黑 / 燃氣灰）
      - geothermalWells：halo + core（red 熱泉語意）
      - renewablePermitsTaipei：core circle，category 6 色 match
- [x] `useEnergyPoiLayer.ts`：5 source + 5 useEffect + offshore 專用 polygon converter + pointRowsToGeoJSON 通用 generic
- [x] `layerCatalog.ts`：ENERGY 加 5 條 + LAYER_COLORS 5 色
- [x] `IconRailSidebar.tsx`：lucide Waves（offshore）/ Anchor（island）/ Container（fossil）/ Sparkles（geothermal）/ Building2（北市再生）
- [x] `useTransportParams.ts`：10 slider（offshore 只 opacity；其餘 size + opacity × 4）+ return + deps
- [x] `useMapInteraction.ts` GIS_LAYERS 5 條（含 offshore fill+line 兩 layer）
- [x] `energyPanels.tsx`：5 panel
      - OffshoreWindZonePanel：含水深 range / 商轉年 / 開發階段
      - IslandPowerFacilityPanel：含 island / 電壓
      - FossilFuelFacilityPanel：3 capacity 欄（噸 / 公秉 / kbpd）擇有顯示
      - GeothermalWellPanel：報告 + 圖件兩個外連 anchor（target="_blank"）
      - RenewablePermitTaipeiPanel：含 capacity_kw / 設置日
- [x] `registry.tsx` 5 panel + 5 label
- [x] `LegendPanel.tsx`：`EnergySpecialtyLegend` 1 個 wrapper 視 visibility 顯示 5 sub-section
- [x] `App.tsx` 接 hook 5 新 prop
- [x] `npx tsc -b` 0 error
- [x] `npx vitest run` 14 檔 / 155 cases pass

### D.2/D.3 暫不做

- offshore polygon 3D fill-extrusion 拉高 ∝ capacity_mw — plan 提的選做項，2D fill 已足夠看分布
- 化石燃料 3D cylinder 油槽 — plan 提的進階視覺，2D circle 對 9 個點足夠
- 地熱井 3D cone 倒置語意 — plan 提的進階視覺，2D + halo 配紅色已表達熱泉
- 北市再生 capacity_kw 分大小 — 438 點 zoom 12+ 才顯，capacity 在 popup 可看

## E-D 全部完成

8 表全部上線：D.1 (wind 812 + solar 734 + osm_power_plants 513) + D.2 (offshore 36 polygon + island 14 + fossil 9) + D.3 (geothermal 36 + 北市再生 438) = 共 8 layer 新增。

## 已知不對齊（追加 plan 對比）

- `docs/energy-v2-plan.md` §B 強調 cluster，B.3 暫用 zoom-gate 著色不做 mapbox cluster。
  雷雨季實測超過 5000 點 / 卡頓再升級。
- §B `is_stale + 高劑量 = 灰色 stroke` 用「虛邊框」實作（plan 寫 stroke，做 stroke-width 1.5 + 灰色）。
