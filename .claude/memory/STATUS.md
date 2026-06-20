# Status

**最後更新**：2026-06-20 早（Energy Phase 8.2 SSOT 25 廠 + 變電所拆層 收尾 — PR #27 merged）
**Master head**：`b3bfd62` on `master`（已 sync origin）
**gis-platform main head**：`c9769c3`（已 sync origin）
**Open branches**：無

## 2026-06-20 Energy Phase 8.2 — SSOT 24h RPC + drill-down + 變電所拆層（PR gis-platform #15 + mini-taiwan-pulse #27 merged）

**用戶定向**：接上輪 PR #26（Phase 8.1 + 6-layer 重構 + Three.js bloom）+ e625fb8 fmtMW fix，
延 brief 三件事 C → A → B 全跑 + 加碼變電所拆兩層。

### 完成清單

| 段 | 內容 | PR |
|---|---|---|
| **Backend** migration 238 | `cross_refs.realtime_facility_alias` schema + 13-row 對應表 + 改寫 `get_ssot_facility_output_24h()` 雙路線 UNION → **14 → 23 廠**（14 台電 + 6 離岸 + 3 離島） | gis-platform [#15](https://github.com/ianlkl11234s/gis-platform/pull/15) |
| migration 239 | `get_ssot_facility_units(facility_id)` 機組 drill-down RPC | 同上 |
| migration 240 | `all_power_plants_v` 改 SSOT alias（保 backward compat）+ DROP 2 個無 caller 的 legacy RPC | 同上 |
| **Frontend** PowerCard/Beam | loader 切 SSOT RPC、加 `facility_id` 欄；hit-test FC 改 `source_table='energy.power_facilities'`；comments 23 廠 | mini-taiwan-pulse [#27](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/27) |
| 機組 drill-down | `UnitDrillDownBlock` lazy fetch — popup 點廠列機組 (unit_name / cap / net_gen / util_rate%) 含負載率配色 | 同上 |
| 變電所拆兩層 | 從 `osmSubstations` 單層 785 → `osmSubstationsEhv` 38（含 halo）+ `osmSubstations` 747；overlayRegistry / Legend / sidebar / params slider / interaction 9 檔同步；命名對齊「發電廠（XXX）」 | 同上 |
| **Audit** Task C | Places API (New) v2：581 廠 Pass 62 / Review 31 / Critical 488（多 GEM 通用名 false positive）。v1 Geocoding fallback 已棄。$20.99 | 同上 |

### 最終驗證

- `npx tsc -b` 0 error
- `pnpm test --run` **155/155 pass** 含 layerConsistency ratchet
- 線上 RPC smoke 過：`get_ssot_facility_output_24h()` 回 23 廠 / `get_ssot_facility_units('t1-gov-台中發電廠')` 回 10 機組 / `all_power_plants_v` 581 廠
- 用戶手動視覺驗收通過（PowerCard sparkline / Beam 立柱 / popup drill-down / 變電所兩層獨立 toggle）

### 1 個重要踩坑（已收 PRINCIPLES）

**Migration 237 嘗試用 `UPDATE energy.power_units SET taipower_unit_code` 補離岸+離島 linkage 時用戶喊停**：
「現在的電廠已經是 SSOT，如果即時有衝突，先不要改現在的電廠，先跟我說」。

我 revert 6 row UPDATE 後改走 `cross_refs.realtime_facility_alias` 獨立 schema 路線（不動 SSOT
`power_units` 欄位）。語意分離：
- `power_units.taipower_unit_code` = 實體機組 ↔ realtime `#N` 編號精確配對（migration 233 設好）
- `cross_refs.realtime_facility_alias` = realtime aggregate label（沃一風/澎湖尖山）↔ facility 整廠粗略配對

**新規則**：碰 SSOT 結構性修改前必先跟用戶確認，不論看起來多「順手」。

### 留底（後續再評）

- 🟡 2 行低信心 mapping（中能風 295MW vs 中能 480MW / 離岸一期 109MW vs 台電離岸 403MW）暫 `is_active=FALSE`，待 GEM datasheet 確認 phase 對應再開啟 → +2 廠 = 25 廠
- 🟡 舊原始 table（power_plants / nuclear_plants / ipp_thermal_plants / osm_power_plants / osm_solar_farms / osm_wind_turbines）未 drop，等下個段落再評
- 🟡 Places audit 488 Critical 中 GEM 小型光電通用名 false positive 占多數；要真 audit 需人工 spot-check sample 或加 county hint 至 first attempt prompt
- 🟢 Phase 8.6 設計文件提到的 PowerCard KPI strip 變動本輪沒動

### 下個 session 入口

```
能源已收尾（Phase 8.1 + 8.2 + 8.6 cleanup + 變電所拆層）。下一個主題：?

候選：
1. 低信心 mapping 釐清 — 查 GEM datasheet 確認 中能風 / 離岸一期 對應哪個 facility phase
2. Places audit Critical 488 廠 spot-check（GEM 小型光電座標可信度）
3. 舊原始 table drop（power_plants/nuclear_plants/...）— 但先確認 mini-taipei-v3 等周邊 repo 不再用
4. Phase 8.6 PowerCard KPI strip 設計（taipei-gis-analytics docs/topic-research/energy/PHASE_8_FRONTEND_HANDOFF_PROMPT.md）

或者切換主題（非能源）— 看 BACKLOG。
```

---

## 2026-06-19 晚 Energy v2 Phase A + B autonomous run（feat/energy-v2-A，5 commits）

**用戶定向**：上次 PR #23 + #10 + #24 Energy MVP 上線（v1 4 layer + popup + sparkline + timeline scrub），
本次接 `docs/energy-v2-plan.md` 6 大塊（A~F）的前兩塊。autonomous「以完成長任務的方式處理」。

| Commit | 主題 |
|---|---|
| `d6a2db3` | **A.1** PowerCard skeleton + MonitorPanel 5min/10min dual poll + powerCardData 純函式 + 7 unit test |
| `857871b` | **B.1+B.2** HAZARD lightning + nuclear loader / Legend / featureInfo / useTransportParams + 17 unit test |
| `b7d6154` | **B.3+B.4** overlayRegistry + useHazardLayer hooks + App.tsx + useMapInteraction GIS_LAYERS |
| `99aee80` | docs(energy-v2-status) A.2 + B 進度 |
| `24026c4` | **A.2** PowerCard KPI strip + timeline isolation contract test（cherry-pick 補回，原 998089f 被踩坑脫鉤）|

**最終狀態**：132 test pass / `npx tsc -b` 0 error / layerConsistency 全綠 / 未 push / 未 merge

### Phase A — Monitor 整合（E-A close）

PowerCard 三層：燈號頂卡（負載 / 備轉 / 預測尖峰）→ KPI strip（24h 尖峰 / fuel mix bar）→ 14 廠 sparkline grid
（按 mw desc，rate 配色）。MonitorPanel `open` 時自動拉 dashboard（5min） + gen24h（10min）兩 cron。
與 App.tsx 的 `energyDashboardActive` 共用 `cachedOnce` cache，不重複 RPC。
timeline scrub 不影響 monitor（`buildPowerCardModel` 不收 time 參數 — contract test 鎖住）。

### Phase B — HAZARD（E-B close）

新增 sidebar HAZARD 分組，2 layer：
- **lightning**：5~360 min slider + 透明度；CG/IC 兩色；halo blur 電光感
- **nuclearRadiation**：51 站；劑量 5 階（normal / watch / warning / alarm / stale）；
  `is_stale` 虛邊框 stroke 區分「離線」與真實警戒；popup is_stale → 灰底警告，alarm → 紅底建議交叉確認 AEC

### Phase B 暫不做（→ BACKLOG E-G）

落雷 cluster + zoom-gate 等雷雨季實測卡再升（OverlayConfig schema 沒 cluster 欄要先擴）。
v1 用「時間窗 5~360min slider」+ 預設 60min 控 payload 量。

### 1 個踩坑（→ INCIDENTS / PRINCIPLES）

SessionStart auto-memory-cherry-pick hook 在 session 中段把 HEAD 切回 master、導致 A.1 commit 跑錯
+ B.1 在 master 改一半 + A.2 從 feat 歷史脫鉤。最終靠 stash + reflog + cherry-pick 補回，沒丟 work
但花 15+ 分鐘。新原則：**commit 前必 `git branch --show-current`**（PRINCIPLES 已寫）。

### 下個 session 入口（Phase C — 高壓電網）

```
繼續 mini-taiwan-pulse energy v2 Phase C（高壓電網）。

當前狀態：
- master 已 wrap-up 完，feat/energy-v2-A 5 commits 等用戶 review
- 132 test pass / tsc -b clean
- docs/energy-v2-status.md 是進度 SSOT

Phase C 工作（已盤點，依序）：
1. ../gis-platform 寫 migration 223：get_osm_power_lines (含 ST_AsGeoJSON
   LineString geom + line_type/voltage/circuits/operator/frequency/location)
   + get_osm_power_towers (含 lon/lat + voltage/operator/material/design/ref)。
   參考 ../gis-platform/migrations/216 寫法。
2. types/SECTIONS: osmPowerLines + osmPowerTowers
3. energyLoader.ts 加 fetcher + parseVoltageKv helper（處理 "161000"
   / "161000;69000" 雙迴路）+ POWER_LINE_VOLTAGE_COLORS
4. overlayRegistry: lines voltage 三色 + glow + line-width interpolate by zoom；
   towers minzoom 13 純色點（26k 點 5.7MB 可接受不需 PMTiles）
5. hooks: useOsmPowerLinesLayer (cachedOnce 60min) + useOsmPowerTowersLayer
6. featureInfo: PowerLinePanel + PowerTowerPanel
7. LegendPanel: PowerLineLegend (345/161/69kV + mixed 灰)
8. App.tsx + useMapInteraction GIS_LAYERS + useTransportParams 鐵則 4 條
9. LAYER_COLORS + IconRailSidebar icon

⚠️ Pitfall：voltage 是 text、"161000;69000" 雙迴路要 split；parseVoltageKv
寫純函式 + 單測
⚠️ commit 前先 git branch --show-current（PRINCIPLES 新規）
⚠️ layerConsistency 全綠才 commit（B 是 B.1+B.2、B.3+B.4 合 commit 才過）
```

---

## 2026-06-19 早 Energy MVP v1.0~v1.3.5（PR #23 + #10 + #24，超大型 session）

## 2026-06-18~19 早 Energy MVP v1.0~v1.3.5（PR #23 + #10 + #24，超大型 session）

**背景**：用戶從 HANDOFF doc 起，要把能源主題接進 mini-taiwan-pulse。本是 v1 6 layer
規劃，過程中 HUD + 區域用電兩個 KPI 性質 layer 搬 monitor（v1.1），只留 4 個地圖
layer + retired flag + popup sparkline + timeline scrub + 4 個 slider。

### 已上線（4 個 sidebar layer）

| Layer | 視覺 | 資料 |
|---|---|---|
| ⚡ **電廠** | 2D circle（fuel 12 色 + capacity quantile 半徑）| 10,665 設施（all_power_plants_v VIEW，含 7 個 retired 核電視覺退色）|
| ⏻ **機組即時出力** | 3D `beam` 蠟燭錐（InstancedMesh max 256，frustumCulled=false）| 14 台電廠 × 144 ts 24h preload，timeline scrub 零 round-trip |
| 🔌 **變電所** | 2D circle 單色紫 | 785 OSM |
| 🔋 **充電站** | 2D circle 單色綠 | 3,060 TDX |

### 已完成

- **gis-platform**：migrations 212~219（8 個 RPC，全 merged 進 main）
- **mini-taiwan-pulse**：26 commit 在 feat/energy-mvp 分支 → PR #23 squash merge
- **v2 規劃**：docs/energy-v2-plan.md → PR #24（437 行完整 SOP，6 大塊 A-F）
- **本地與 origin 同步**：rebase --skip 解一個 INCIDENTS append 衝突，其餘 6 個 commit git 自動拋棄（已在 upstream）
- **pitfall 補強**：第二次踩 isStyleLoaded race 後，
  pitfalls/2026-04-22 加「2026-06-18 第二次踩到」段 + 觸發詞，
  PRINCIPLES 加「寫 CustomLayer 前先 grep pitfall」規則

### 9 phase + 6 微修 commit 軌跡

| 階段 | 內容 |
|---|---|
| Phase A | 4 RPC + migration 212~216（dashboard / plants_with_output / lightning / nuclear / 兩 slim POI）|
| Phase B | LayerVisibility 6 key + energyLoader 4 fetcher（FUEL_COLORS / quantile / REGION_CENTROIDS）|
| Phase C | 2D POI 3 layer overlayRegistry + useEnergyPoiLayer |
| Phase D | PowerRegionBarsScene 3D（v1.1 撤出 sidebar）|
| Phase E | PowerStatusHud + App.tsx 接線（v1.1 撤出 sidebar）|
| Phase F | PowerGenerationBeamScene 3D 14 廠光柱 InstancedMesh |
| Phase G | sidebar ENERGY 分組 + EnergyFuelLegend + EnergyReserveLegend |
| Phase H | 3 popup panel + featureInfo registry + useMapInteraction hit-test |
| Phase I | tsc + vitest 102/102 + status doc |
| v1.1 | sidebar 清理 + retired flag + 移除紅 stroke |
| v1.2 | 217+218 RPC + popup 24h sparkline + timeline scrub |
| v1.3 | 219 24h preload + 蠟燭錐視覺 + 6 sliders 鐵則對齊 |
| v1.3.1 | hit-test source + 3 layer expandable |
| v1.3.2 | bump beam radius（v1.3 改太細在 zoom 5 看不到）|
| v1.3.3 | openEnded cylinder + diag log |
| v1.3.4 | diag log overhaul（console.info → console.log）|
| v1.3.5 | bulletproof mount（try addLayer + idle 重試，修 isStyleLoaded race）|

### HANDOFF 已知 5 處偏差（v1 已修正、PB-20 列）

1. VIEW 數量 2,627 → 10,665（TGOS 已 98.1% geocoded）
2. unit_name JOIN：寫 `SPLIT_PART = plant_name` 錯，真實 `{廠名core}{機型?}#{編號}` → prefix LIKE
3. power_system_status 欄位名：寫 `supply_capacity_mw / reserve_rate_pct` 錯，真實 `fore_maxi_sply_capacity_mw / fore_peak_resv_rate`
4. power_region_demand 欄位：寫 `load_mw / percent_of_total` 錯，真實 `generation_mw / consumption_mw`
5. VIEW 含 36 polygon → ST_X 炸 → ST_Centroid 兼容

### 踩過的 5 大坑（PB-20 失誤點段已列）

1. **isStyleLoaded race**（第 2 次踩到）→ try addLayer + idle retry
2. **InstancedMesh 預先 alloc instanceColor=0 卡 shader define** → setColorAt 自動配置
3. **frustumCulled=true 整 mesh 不畫** → false
4. **CylinderGeometry openEnded=false** zoom 進柱看到黑蓋 → true
5. **視覺 binary search 只看單一 zoom** → 三視角（5/12/19）都要試

### Backlog v2 待接（詳 BACKLOG E-A~E-F）

| ID | 優先級 | 內容 |
|---|---|---|
| E-A | **P1** | Monitor 整合（HUD + 4 區 + 14 廠 sparkline 都搬 monitor PowerCard）|
| E-B | **P1** | HAZARD 群組（閃電 + 核安，用戶要求，RPC 214/215 已備）|
| E-C | P2 | 高壓電網 — power_lines 2,305 + power_towers 26,589 |
| E-D | P2 | OSM 風光電 + offshore polygon + 離島海纜（8 表）|
| E-E | P3 | 加油站 + power_poles PMTiles |
| E-F | P3 | KPI 統計面板（縣市風光生質 + 光電月趨勢）|

### 下個 session 入口

```
1. 並行 session 可能在做 energy v2-A（Monitor 整合）— 確認該 session 動哪些檔案範圍再接其他塊
2. 接其他塊前 grep `.claude/pitfalls/*mapbox*` 確認沒重蹈 v1 踩過的坑
3. docs/energy-v2-plan.md 是 SSOT，6 大塊 A-F 都有後端 RPC 清單 + 前端細節 + pitfall 提醒
4. v2 切新分支 feat/energy-v2-<X>，每 Phase commit 不 push，等用戶 review
```

---

## 過往里程碑

### 2026-06-18 Design System Phase 0-6 上線（PR #22，9 commits）

從用戶問「該不該有設計系統？」起，盤點 60+ 元件、1200+ inline 散落值，建立
`src/styles/designTokens.ts` SSOT + `docs/design-system.md` 規範文件，分 6 phase
逐項收斂。**不引入 CSS 框架**（Tailwind/CSS Modules/styled-components），維持
inline `style={{}}` + token import。**不抽通用元件庫**（業務元件深耦合 Mapbox/timeStore）。

DS-1~7（Z_INDEX scale / transition / 互動狀態色 / Breakpoint / Control sizing /
intelTokens 退役 / LayerSidebar 亮側）刻意延後（沒真實痛點不抽）。

詳細 PB-19（大規模 token migration 6-phase pattern）、INCIDENTS 2026-06-18
（3 個 codex review 教訓）、REFLECTIONS 2026-06-18。

### 2026-06-18 Monitor / News 效能優化（PR #21，6 commits）

PR #18 上線後使用者回報「網頁變慢」，5 step 解：
1. React.memo wrap LiveWall/HazardWatchStrip
2. useWallClock 抽 hook（修 useSyncExternalStore infinite re-render — INCIDENTS 已記）
3. alertSeries24h fetch 30s → 60s + 增量 invalidate（G012 backlog）
4. wallclock pause 在 wall mode（G011 backlog）
5. push timing hotfix

詳細 PB-18（React 元件效能優化 5 step）+ INCIDENTS（useSyncExternalStore 陷阱）。
