# Energy MVP — Status

> 最後更新：2026-06-18
> 分支：`feat/energy-mvp`（mini-taiwan-pulse + gis-platform 同名）
> 來源 handoff：`../taipei-gis-analytics/docs/topic-research/energy/MINI_TAIWAN_PULSE_HANDOFF.md`
> 三 3D skill 審核：見本 session 對話 §「6 圖層視覺化策略 Skill 審核」

---

## 0. 背景與決策

### 第一波 MVP 6 圖層 + 視覺策略（已過 three-3d-component skill 審核）

| # | Layer | 表 / RPC | 視覺 | 預設 toggle |
|---|---|---|---|---|
| 1 | 電廠總圖 | `all_power_plants_v` (10,665) | **2D circle**：fuel_type 分色、capacity_mw 分大小（4 階用 quantile） | OFF |
| 2 | 供電燈號 KPI | `power_system_status` (RPC) | **2D HUD**：top-left 卡片（燈號 + 備轉率 + 即時負載） | OFF |
| 3 | 區域用電 | `power_region_demand` (RPC) | **3D `bars`**：4 區質心柱，高 ∝ load_mw、色 = reserve_indicator | OFF |
| 4 | 機組即時出力 | `power_generation_unit × power_plants` (RPC) | **3D `beam` 光柱（InstancedMesh）**：高 ∝ output/capacity 負載率、色按 fuel_type | OFF |
| 5 | 變電所 | `osm_substations` (785) | **2D circle** | OFF |
| 6 | 充電站 | `ev_charging_stations` (3,060) | **2D circle**（zoom-out cluster） | OFF |

### 與 HANDOFF 偏差
- HANDOFF §② 寫 VIEW = 2,627 → **現況 10,665**（TGOS 已完成 98.1% geocode），不算 bug
- HANDOFF §② size 分級 `>=1000/100-1000/<100` 過時，第一波先用 quantile 跑出來再決
- HANDOFF §⑧#2「視覺化先不用 renewable_permits」作廢，VIEW 已自動含

### 已知踩雷（一定不踩）
- `power_generation_unit.unit_name = "{廠名}#{機組編號}"` → 必 `SPLIT_PART(unit_name, '#', 1)` 才能 JOIN `power_plants.plant_name`
- `power_poles` 2.96M 不碰（第三波 PMTiles）
- TDX `ev_charging_stations` ConnectorLiveStatus 不可信 → 只做靜態 POI
- `nuclear.is_stale=true` + 高劑量 ≠ 核災（感測器故障）→ UI 必須區分
- 落雷 1 min cron、寫入頻繁 → 前端必加 time-window（本波先不接，留第四波）

---

## 1. 任務清單

> 與 Claude Code TaskList 同步；勾選 = 已驗證

### Phase A — gis-platform RPC（migrations 212~215）
- [ ] **#1** 寫 `212_power_dashboard_rpc.sql`：`get_power_dashboard()` — 三本柱最新 1 列 + 區域 4 列
- [ ] **#2** 寫 `213_power_plants_with_output_rpc.sql`：`get_power_plants_with_output()` — VIEW + LEFT JOIN 最新 generation_unit output（SPLIT_PART join）+ 全表 / bbox 兩變體
- [ ] **#3** 寫 `214_lightning_recent_rpc.sql`：`get_lightning_recent(minutes int)`（保留給第四波，先寫好但不接前端）
- [ ] **#4** 寫 `215_nuclear_radiation_status_rpc.sql`：`get_nuclear_radiation_status()`（同上，保留）
- [ ] **#5** Apply 212~215 進 Supabase 並 SELECT 驗證 < 1s

### Phase B — mini-taiwan-pulse 型別與骨架
- [ ] **#6** `src/types/index.ts` `LayerVisibility` 加 6 keys：`powerPlants` / `powerStatusHud` / `powerRegionDemand` / `powerGenerationUnit` / `osmSubstations` / `evChargingStations`
- [ ] **#7** `src/data/energyLoader.ts`：4 個 fetcher + 共用 color map（FUEL_COLORS / RESERVE_INDICATOR_COLORS / POWER_SOURCE_COLORS）

### Phase C — 2D 圖層接線（layer 1, 5, 6）
- [ ] **#8** `src/map/overlayRegistry.ts` 加 `power-plants-poi` / `osm-substations-poi` / `ev-charging-poi` 三 GeoJSON source + circle layer（fuel_type expression / 半徑 quantile）
- [ ] **#9** `src/hooks/useEnergyPoiLayer.ts`：拉 power_plants_with_output、osm_substations、ev_charging_stations，餵 overlayRegistry，含 loadingRegistry
- [ ] **#10** 量級門檻：跑 quantile 算出 4 階 capacity_mw 半徑切點，寫進 `energyLoader.ts` const

### Phase D — 3D Region Bars（layer 3）
- [ ] **#11** `src/three/PowerRegionBarsScene.ts`：4 區質心固定座標 + 4 bar mesh，高度 ∝ load_mw，blending 還原、dispose 完整
- [ ] **#12** `src/map/powerRegionBarsCustomLayer.ts`：CustomLayer 包裝 + map.triggerRepaint
- [ ] **#13** `src/hooks/usePowerRegionBarsLayer.ts`：拉 get_power_dashboard()（共用 layer 2 KPI），timeStore.subscribeThrottled(60_000) 平滑 lerp

### Phase E — KPI HUD（layer 2）
- [ ] **#14** `src/components/hud/PowerStatusHud.tsx`：top-left 卡片，燈號圓 + 備轉率 + 即時負載；toggle 時掛載
- [ ] **#15** `src/App.tsx` 接線（visible 時才 render）

### Phase F — 3D Beam（layer 4）
- [ ] **#16** `src/three/PowerGenerationBeamScene.ts`：InstancedMesh（max ~250 instance）+ height attribute 走 lerp 平滑
- [ ] **#17** `src/map/powerGenerationBeamCustomLayer.ts`：CustomLayer 包裝
- [ ] **#18** `src/hooks/usePowerGenerationBeamLayer.ts`：每 5 min 拉 `get_power_plants_with_output()`，feed scene；timeStore.subscribeThrottled(2000) 驅動 lerp

### Phase G — Sidebar 接線
- [ ] **#19** `src/components/sidebar/layerCatalog.ts`：`LAYER_COLORS` 補 6 key + `SECTIONS` 新增「能源 ENERGY」分區
- [ ] **#20** `LegendPanel.tsx` + `LEGEND_REGISTRY`：fuel_type 8 色圖例 / reserve_indicator 4 色圖例
- [ ] **#21** `IconRailSidebar` icon mapping + `LayersSidebar` toggle 自動派生

### Phase H — 互動
- [ ] **#22** `useMapInteraction.ts` + `featureInfo/registry.tsx`：power-plants / osm-substations / ev-charging 三 layer popup（name / fuel_type / capacity_mw / operator）

### Phase I — 驗證
- [ ] **#23** `npx tsc -b`（必過）
- [ ] **#24** `pnpm test`（`layerConsistency` 擋漏接圖例）
- [ ] **#25** ⚠️ 待用戶 browser 手測：toggle 6 layer、確認 3D bars + beam 高度合理、KPI 卡顯示燈號

---

## 2. 開發守則（本波專用）

1. **每完成一個 task 立刻 `npx tsc -b` 跑一次**（避免最後一次失敗難 debug）
2. **每完成一個 Phase commit 一次**，commit 訊息 `energy-mvp(phase X): ...`，**不 push**
3. **Phase A apply migration 時**：先在本機跑 `psql "$DATABASE_URL" -f migrations/2XX_*.sql` → SELECT 驗 < 1s → 再進 task #25
4. **3D 元件**走三 3D skill §3.3 骨架，blending 還原 + dispose；showcase 抄參數截圖待用戶後補
5. **不碰**：第二波（OSM 風機 / 光電 / 離岸風 polygon）、第三波（power_poles PMTiles）、第四波（落雷 / 核安），雖然第四波 RPC 先寫好

## 3. 完成後 backlog（不在本波）

- 落雷 cluster + time-window 圖層接線
- 核安 51 站 dose 分色 + stale 視覺
- OSM gas_stations 2,212 + offshore_wind_zones polygon
- power_poles 2.96M PMTiles
- 第二波想像：機組 → 4 區 `arc` 流動（§5.1）

---

## 4. 變更紀錄

- 2026-06-18 開單，建分支 `feat/energy-mvp`（mini-taiwan-pulse + gis-platform 同名）
