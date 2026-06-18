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

## 3. 已拉但未接 — 完整清單（27 表 / 33 - v1 6 表）

> 2026-06-18 用戶要求：所有已拉資料逐筆評估後接上。先修完 v1（含此次 ST_Centroid bug）→ 再開 v1.5 起跑。
> 群組原則：「即時動態」歸 hazard 群組（v4 改名 v_hazard）。

### v1.1（鐵則對齊，最快補）
- 6 layer 透明度 slider 補進 `useTransportParams`（移除 BASELINE_NO_PARAMS 6 key）
- v1 暫定 opacity 常數：powerPlants 0.85 / regionBars 0.55 / beam 0.7 / substations 0.85 / EV 0.8
- v1 修一波：[fixed 2026-06-18] 213 RPC ST_Centroid for polygon

### v1.5 高壓電網（用戶 priority — power_lines 是 cascade 關聯的關鍵）
| 表 | 筆數 | 視覺 | 為何先做 |
|---|---:|---|---|
| `osm_power_lines` | 2,305 | LineString，按 voltage 分色（345kV 紅 / 161kV 橘 / 69kV 黃） | 1.4MB 直接 GeoJSON、把「電廠→變電所→末端」連起來 |
| `osm_power_towers` | 26,589 | Point zoom-gated（zoom ≥ 13 才顯）或 PMTiles | 高壓電塔（不是 power_poles） |

評估：osm_power_lines 接線 1 個 Phase；power_towers 5.7MB raw 接 GeoJSON 應該也行，先試 zoom-gated 不行再 PMTiles。

### v2 主圖補強（OSM + polygon + 離島，VIEW 已含但無專屬視覺）
| 表 | 筆數 | 視覺 |
|---|---:|---|
| `osm_wind_turbines` | 812 | 獨立 toggle，is_offshore 分色（深 cyan / 淺 cyan）|
| `osm_solar_farms` | 734 | 獨立 toggle |
| `osm_power_plants` | 513 | 獨立 toggle（VIEW 已混進 layer 1） |
| `offshore_wind_zones` | 36 | **Polygon fill**（彰化外海 21）— VIEW 看不到 |
| `island_power_grid` | 14 | POI + **海纜 LineString** — 海纜需獨立接 |
| `fossil_fuel_infrastructure` | 9 | POI（LNG/煉廠/LDC） |
| `geothermal_wells` | 36 | POI（中油地熱井）|
| `geothermal_potential` | 27 | KPI 表（無座標）→ 縣市彙整 panel |
| `renewable_permits_taipei` | 438 | POI（北市再生案場，按 category 分色）|

### v3 加油站 + 補光電
| 表 | 筆數 | 備註 |
|---|---:|---|
| `osm_gas_stations` | 2,212 | **主用**，HANDOFF §⑧#3 不可 UNION 政府版 |
| `gas_stations` | 573 | 對照用 toggle |
| `osm_charging_stations` | 306 | 補社區型，跟 TDX 3,060 不重複 |
| `power_poles` | 2,959,326 | **必走 PMTiles**（1.4GB raw）— 一般低壓電桿非高壓塔 |

### v4 Hazard 群組（即時動態 → 歸 hazard，非 energy 主題）
> 用戶定向：搬出 energy section、改進入既有 hazard / 災害分組（與 disaster_alerts 同層）
| 表 | 來源狀態 |
|---|---|
| `realtime.lightning_events` | RPC 214 已備 — 接時做 cluster + 1h time-window |
| `realtime.nuclear_radiation_stations` 51 | RPC 215 已備 — dose 分色 + is_stale 視覺（區分故障 vs 核災）|
| `realtime.nuclear_radiation_measurements` | 時序 chart（per-station 24h dose 曲線） |

⚠️ 對應 SECTIONS 動作：v4 動工時要把 layerCatalog `ENERGY` 拆兩段或新建 `HAZARD/災害` 群組吸收 lightning / nuclear；
PowerStatusHud + region bars + beam + plants + substations + EV 留在 ENERGY，落雷 + 核安歸 HAZARD。

### v5 KPI panel（非地圖）
- `analytics.solar_daily_generation` 3,992 光電月發電趨勢
- `county_wind_stats` 211 / `county_biomass_stats` 188 / `county_small_hydro_stats` 188
- `analytics.lightning_daily_summary`（明日 02:25 後有資料）→ hazard panel
- `analytics.nuclear_radiation_daily`（明日 02:32 後有資料）→ hazard panel

### 跨點關聯（三 3D skill §5）
- v1.5 之後：電廠 → 變電所 → 充電站 `cascade`（§5.2 層級匯流）— power_lines 連起來後就有 spine
- v2 之後：機組 → 4 區 `arc` 流動（§5.1）— 弧高 ∝ MW，需「機組-區域」對應表（HANDOFF 未提供，可從 power_plants.address 縣市映射推導）

---

## 3a. three-3d-component skill 重評估（新表納入後）

按三 3D skill §一鐵則「拿掉 3D 元件少看懂什麼？」逐一過：

| 新 layer | 推薦 | 原因 |
|---|---|---|
| osm_power_lines 2,305 | **2D LineString**（voltage 分色 + glow）| 線型靜態無語意動作；§一鐵則：純拓撲 → 2D。但若做 cascade（§5.2）可疊 `flowline` 粒子表示「電力流動」方向（需電網拓撲方向資料，目前 OSM 沒有 → 第一輪 2D） |
| osm_power_towers 26,589 | **2D circle zoom-gated** | 數量 > 1000，§一鐵則大量點 → 不用 3D；zoom-out heatmap 也 OK |
| osm_wind_turbines 812 | **3D `pin` 或 `cylinder`**（風機柱型） | 物件有形狀語意（高塔+葉片），3D 能傳達。但 812 個要 InstancedMesh + 可選 toggle 才不爆 fps |
| osm_solar_farms 734 | **2D circle** + 大型場用 polygon fill | 屋頂光電是面、不是 3D 物件 |
| offshore_wind_zones 36 polygon | **3D `polyextrude`** | 海域 polygon 拉高 = 容量/開發進度，§7.4 直接適用 |
| island_power_grid 海纜 | **2D LineString**（虛線 + 動態 dash） | 跟海纜 `submarineCables` 既有圖層同邏輯 |
| fossil_fuel_infrastructure 9 | **3D `cylinder`**（油槽/LNG 罐型） | 9 個物件、語意清楚（巨型儲存設施），3D 增值高 |
| geothermal_wells 36 | **3D `cone` 倒置**（井深向下） | 「井」是垂直語意 — 倒錐 + 動態粒子 |
| renewable_permits_taipei 438 | **2D circle**（type 分色） | 數量中 + 抽象「許可」概念 → 2D |
| 落雷 cluster | **2D + ripple 3D**（瞬發） | §3.1 ripple 短暫動畫，每筆閃 1.5s 後消失 |
| 核安 51 站 | **3D `radar` 掃描**（運轉中視覺）+ dose color | §3.2 radar = 「監測中」語意 |
| 高壓塔→塔 cascade | **3D `arc`**（§5.1）| 若後續做電網潮流；目前資料不夠 |

**Skill 更新觸發**（§八）：
- 新元件類別「polyextrude polygon 拉高」實際用上 → 之後 PR 更新對照表加註「offshore_wind 走過」
- 一旦 osm_power_towers 26,589 用 zoom-gated 證實能 hold，加進 §四 E 性能段「>20k 點 zoom-gate 而不 PMTiles 也可」

---

## 4. 變更紀錄

- 2026-06-18 13:xx 開單 + Phase A~I 完成（9 commit）
- 2026-06-18 15:xx **fix**：213 RPC ST_Centroid for 36 polygon（VIEW 含 offshore_wind_zones MultiPolygon，ST_X 直吃會炸）
- 2026-06-18 15:xx 用戶 review：補 §3 27 表逐筆評估 + §3a skill 重評估 + 即時動態歸 hazard 群組

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
