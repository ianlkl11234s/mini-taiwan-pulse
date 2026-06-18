# Energy MVP — Status

> 最後更新：2026-06-18（Phase A~I 全部 commit 完，待 browser 手測）
> 分支：`feat/energy-mvp`（mini-taiwan-pulse + gis-platform 同名）
> 來源 handoff：`../taipei-gis-analytics/docs/topic-research/energy/MINI_TAIWAN_PULSE_HANDOFF.md`
> 三 3D skill 審核：見本 session 對話 §「6 圖層視覺化策略 Skill 審核」

---

## 0. 背景與決策

### 第一波 MVP 6 圖層 + 視覺策略（已過 three-3d-component skill 審核）

| # | Layer | 表 / RPC | 視覺 | 預設 toggle |
|---|---|---|---|---|
| 1 | 電廠總圖 | `all_power_plants_v` (10,665) | **2D circle**：fuel_type 分色、capacity_mw 4 階 quantile 半徑 | OFF |
| 2 | 供電燈號 KPI | `get_power_dashboard()` RPC | **2D HUD**：top-left 卡片（燈號 + 備轉率 + 即時負載） | OFF |
| 3 | 區域用電 | `get_power_dashboard()` RPC（共用） | **3D `bars`**：4 區質心柱，高 ∝ consumption_mw、色 = reserve_indicator | OFF |
| 4 | 機組即時出力 | `get_power_plants_with_output()` RPC | **3D `beam` 光柱（InstancedMesh max 256）**：高 ∝ output_load_rate、色按 fuel_type | OFF |
| 5 | 變電所 | `get_osm_substations()` RPC (785) | **2D circle**（單色紫） | OFF |
| 6 | 充電站 | `get_ev_charging_stations()` RPC (3,060) | **2D circle**（單色綠） | OFF |

### 與 HANDOFF 偏差（已落地）
1. **VIEW 數量**：HANDOFF 寫 2,627，現況 10,665（renewable_permits TGOS 98.1% 已完成）
2. **JOIN 公式**：HANDOFF §3.2 寫 `SPLIT_PART(unit_name, '#', 1) = plant_name` **錯誤**。
   真實 unit_name 格式 `{廠名core}{機型?}#{編號}`（例 `大潭CC#1`，不是 `大潭發電廠#1`）。
   實作改用：unit_prefix（切#前 + 拿掉 `(註X)` + 拿掉末尾 `CC|GT|IGCC|新`）LIKE plant_core（去 `發電廠`）|| `%`
   → 14/22 台電廠對到 output，未對到者多為大甲溪流域分廠 (谷關/德基/青山/天輪) 與外部購電聚合
3. **realtime.power_system_status 欄位名**：HANDOFF 寫 `supply_capacity_mw / instant_load_mw / reserve_rate_pct`，實際是 `fore_maxi_sply_capacity_mw / curr_load_mw / fore_peak_resv_rate`。RPC 已對照重命名
4. **realtime.power_region_demand 欄位**：HANDOFF 寫 `load_mw / percent_of_total`，實際只有 `generation_mw / consumption_mw`，bar 用 consumption_mw 正規化
5. **size 分級門檻**：HANDOFF 寫 `>=1000 / 100-1000 / <100`，實測 quantile p50=13 / p80=44 / p95=88 / p99=120 MW，改用實測門檻

### 已知踩雷（一定不踩）
- `power_generation_unit.unit_name` 解析坑 → 已記錄在 213 SQL 註解
- `power_poles` 2.96M 不碰（第三波 PMTiles）
- TDX `ev_charging_stations.ConnectorLiveStatus` 不可信 → 只做靜態 POI
- `nuclear.is_stale=true` + 高劑量 ≠ 核災 → 第四波 panel 必須區分
- 落雷 1 min cron 寫入頻繁 → 必加 time-window（本波不接，留第四波）

---

## 1. 任務清單

> ✅ = 已驗證 + commit；⚠️ = 待用戶確認

### Phase A — gis-platform RPC（migrations 212~216）
- [x] **#1** `212_power_dashboard_rpc.sql`：70ms ✅
- [x] **#2** `213_power_plants_with_output_rpc.sql`：JOIN 公式自行修正（unit_prefix LIKE plant_core）；14/22 對到；cold 2.2s / 熱 94ms（5min cache 內 acceptable）
- [x] **#3** `214_lightning_recent_rpc.sql`（第四波保留，5,468 events/h）
- [x] **#4** `215_nuclear_radiation_status_rpc.sql`（第四波保留，51 站 1 stale）
- [x] **#5** Apply + 全部驗證 < 150ms（熱呼叫）
- [x] **bonus** `216_energy_static_pois_rpc.sql`：osm_substations + ev_charging slim POI RPC

### Phase B — 型別與骨架
- [x] **#6** `LayerVisibility` 加 6 keys（types/index.ts）
- [x] **#7** `src/data/energyLoader.ts`：4 fetcher + cachedOnce（5min realtime / 60min static）+ FUEL_COLORS 12 entries（中英別名）+ RESERVE_INDICATOR_COLORS + REGION_CENTROIDS + radiusForCapacity quantile + fuelColorExpression helper
- [x] LAYER_COLORS + IconRailSidebar LAYER_ICONS 補 6 key（Zap/Activity/BarChart3/Power/Cable/PlugZap）

### Phase C — 2D POI（layer 1, 5, 6）
- [x] **#8** `overlayRegistry`：3 dynamic source (powerPlants halo+circle / osmSubstations / evChargingStations) + `public/geo/_empty.geojson` fallback
- [x] **#9** `useEnergyPoiLayer`：3 source setData，plants 5min poll，subs/EV one-shot
- [x] **#10** quantile 寫入 `radiusForCapacity()` const

### Phase D — 3D Region Bars（layer 3）
- [x] **#11** `PowerRegionBarsScene`：InstancedMesh × 4 BoxGeometry，高度 + 色雙 lerp（factor 0.05），blending 還原 + dispose
- [x] **#12** `powerRegionBarsCustomLayer`：moving 時 triggerRepaint
- [x] **#13** `usePowerDashboard`（HUD/bars 共用 5min poll）+ `usePowerRegionBarsLayer`（掛 CustomLayer + style.load 重掛）

### Phase E — KPI HUD（layer 2）
- [x] **#14** `PowerStatusHud.tsx`：燈號圓 + 備轉率 big number + 即時負載/供電能力 grid + footer
- [x] **#15** App.tsx 接線（top-left，sidebarWidth 自適應，visible 時掛載）

### Phase F — 3D Beam（layer 4）
- [x] **#16** `PowerGenerationBeamScene`：InstancedMesh max 256，高度 lerp（factor 0.06），setColorAt fuel_type，位置匹配保留 currentHeight（不從 0 蹦上來）
- [x] **#17** `powerGenerationBeamCustomLayer`
- [x] **#18** `usePowerGenerationBeamLayer`：共用 cachedOnce fetchPowerPlants（無重複網路）

### Phase G — Sidebar 接線
- [x] **#19** SECTIONS 新增「ENERGY · 能源」（6 layer，桌機/手機共用）
- [x] **#20** `LegendPanel`：EnergyFuelLegend (9 fuel 色票 + 4 階 capacity 半徑) + EnergyReserveLegend (G/Y/O/R)；LEGEND_REGISTRY 補 2 行
- [x] **#21** Icon mapping 自動派生

### Phase H — 互動
- [x] **#22** `useMapInteraction` GIS_LAYERS 加 3 entry（layer id = `${sourceId}-${suffix}`）+ `energyPanels.tsx` 3 panel + `registry.tsx` PANEL_REGISTRY/HEADER_LABELS

### Phase I — 驗證
- [x] **#23** `npx tsc -b` ✅
- [x] **#24** `npx vitest run` 102/102 ✅
  - layerConsistency ratchet：6 key 加 BASELINE_NO_PARAMS（v2 補 sliders，conscious decision，記入 §3 backlog）
  - 2 key (osmSubstations / evChargingStations) 加 BASELINE_NO_LEGEND（單色 POI，鐵則 2 只要求分類 ≥ 2 才寫）
- [ ] **#25** ⚠️ 待用戶 browser 手測：
  - toggle 6 layer 都看到圖層
  - 3D bars 4 根質心柱顯示，色 = G/Y/O/R
  - 3D beam 14 根光柱在台電廠位置
  - HUD top-left 顯示燈號 + 備轉率
  - 點 plant / substation / EV → popup 顯示正確資料
  - 切換 dark/light theme 不爆色
  - 切城市 / pause 不 leak

---

## 2. 開發守則（本波專用）

1. **每完成一個 task 立刻 `npx tsc -b`** — 全 8 phase 都做到 ✅
2. **每 Phase commit 一次** — 8 commit + 1 status doc commit
3. **不 push** — 用戶最終 review
4. **3D 元件**走三 3D skill §3.3 骨架，blending 還原 + dispose
5. **不碰**：第二波 / 第三波 / 第四波視覺化（雖然第四波 RPC 先寫好）

## 3. 第二版 backlog

### v1.1（鐵則對齊）
- 6 layer 透明度 slider 補進 `useTransportParams`（移除 BASELINE_NO_PARAMS 6 key）
- v1 暫定 opacity 常數：powerPlants 0.85 / regionBars 0.55 / beam 0.7 / substations 0.85 / EV 0.8

### v2（第二波）
- OSM 風機 812（is_offshore 分色）/ 光電 734 / 離岸風 polygon 36
- 化石燃料基礎設施 9 / IPP 9 / 離島電網 14 + 海纜
- 地熱井 36 / 地熱潛能彙整

### v3（第三波）
- power_poles 2.96M PMTiles
- osm_power_towers 26,589（zoom-gated）
- osm_power_lines 2,305（voltage 分色）

### v4（即時 + 安全）
- 落雷 `realtime.lightning_events`（cluster + 1h time-window）— RPC 214 已備
- 核安 `realtime.nuclear_radiation_*` 51 站 + dose 分色 + stale 視覺 — RPC 215 已備

### v5（KPI 卡）
- 縣市風力/生質能/小水力 + 光電月趨勢 + 共生 pie

### 跨點關聯（三 3D skill §5）
- 機組 → 4 區 `arc` 流動：弧高 ∝ MW，需「機組-區域」對應表（HANDOFF 未提供）
- 電廠 → 變電所 → 充電站 `cascade`：資料不全（power_lines 2,305 < 變電所 785 × 4 平均度）

---

## 4. 變更紀錄

- 2026-06-18 開單 + 全部 Phase A~I 完成（9 commit、未 push）
  - gis-platform: 4 commit（212+213+214+215+216 + 213 修正）
  - mini-taiwan-pulse: 9 commit（status doc + Phase B/C/D/E/F/G/H/I）

## 5. 檔案清單（quick ref）

### gis-platform
- `migrations/212_power_dashboard_rpc.sql`
- `migrations/213_power_plants_with_output_rpc.sql`
- `migrations/214_lightning_recent_rpc.sql`
- `migrations/215_nuclear_radiation_status_rpc.sql`
- `migrations/216_energy_static_pois_rpc.sql`

### mini-taiwan-pulse
- `src/data/energyLoader.ts` — 4 fetcher + color/quantile const
- `src/hooks/useEnergyPoiLayer.ts` — layer 1/5/6 setData
- `src/hooks/usePowerDashboard.ts` — layer 2/3 共用 poll
- `src/hooks/usePowerRegionBarsLayer.ts` — layer 3 mount
- `src/hooks/usePowerGenerationBeamLayer.ts` — layer 4 mount + 5min poll
- `src/three/PowerRegionBarsScene.ts` — layer 3 InstancedMesh × 4
- `src/three/PowerGenerationBeamScene.ts` — layer 4 InstancedMesh max 256
- `src/map/powerRegionBarsCustomLayer.ts`
- `src/map/powerGenerationBeamCustomLayer.ts`
- `src/components/hud/PowerStatusHud.tsx` — layer 2 KPI 卡
- `src/components/featureInfo/energyPanels.tsx` — 3 popup panel
- `src/map/overlayRegistry.ts`（追加 3 dynamic source）
- `src/components/LegendPanel.tsx`（追加 2 sub-component）
- `src/components/sidebar/layerCatalog.ts`（追加 6 LAYER_COLORS + 1 SECTIONS）
- `src/components/IconRailSidebar.tsx`（追加 6 LAYER_ICONS）
- `src/types/index.ts`（追加 6 LayerVisibility + 3 FeatureInfo.layerType）
- `src/App.tsx`（接線 4 hook + HUD render）
- `src/hooks/useMapInteraction.ts`（追加 3 hit-test）
- `src/components/featureInfo/registry.tsx`（追加 3 PANEL + 3 HEADER）
- `src/components/sidebar/__tests__/layerConsistency.test.ts`（baseline +8）
- `public/geo/_empty.geojson`（共用 fallback）
