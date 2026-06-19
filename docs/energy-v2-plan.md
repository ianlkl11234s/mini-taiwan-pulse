# Energy v2 規劃 — 下一波完整工作清單

> 最後更新：2026-06-19
> 上一波：v1.0~v1.3.5 已 merge（PR #23 + #10），master = `922d191`、main = `ae71eab`
> 已 merge 的：4 sidebar layer（電廠/機組即時出力/變電所/充電站）+ popup + 24h sparkline + timeline scrub + sliders + retired 標記
> SSOT：本檔；另見 [`energy-mvp-status.md`](./energy-mvp-status.md) §3 完整 27 表清單
> handoff 來源：`../taipei-gis-analytics/docs/topic-research/energy/MINI_TAIWAN_PULSE_HANDOFF.md`

---

## TL;DR — 下一波 6 大塊（建議拆 6 個 PR，可平行）

| # | 工作塊 | 重點 | 預估 PR |
|---|---|---|---|
| **A** | **Monitor 整合**（HUD + 區域用電 + 14 廠出力 sparkline）| KPI 性質歸 monitor 面板 | gis-platform x 1 + mini-taiwan-pulse x 1 |
| **B** | **HAZARD：閃電 + 核安** | RPC 214/215 已備、前端沒接，獨立分組 | mini-taiwan-pulse x 1 |
| **C** | **高壓電網**（osm_power_lines 2,305 + osm_power_towers 26,589）| voltage 分色 + zoom-gate | mini-taiwan-pulse x 1 |
| **D** | **OSM 風光電 + 離岸 polygon + 離島海纜** | 9 表，VIEW 已含但無專屬視覺 | mini-taiwan-pulse x 1 |
| **E** | **加油站 + power_poles PMTiles** | 4 表，含 2.96M PMTiles 大坑 | data-collectors + mini-taiwan-pulse x 1 |
| **F** | **KPI 統計面板**（縣市風光生質 + 光電月趨勢）| 非地圖，可放 monitor 額外 tab | mini-taiwan-pulse x 1 |

**強烈建議順序**：A（最容易做完看到效果） → B（用戶要求） → C（拉電網 spine） → D/E/F 可彈性

---

## A — Monitor 整合（HUD + 區域用電 + 14 廠出力）

### 用戶定向
- 全國供電燈號 HUD 已從 sidebar 移除（v1.1）
- 區域用電 3D bars 已從 sidebar 移除（v1.1）
- 機組即時出力 14 廠 sparklines 也應該在 monitor 有一份（地圖保留 3D beam）

### 後端（gis-platform）

#### 1. Monitor 用 RPC
都已備：
- `get_power_dashboard()` (212) — 三本柱 + 4 區
- `get_power_generation_24h()` (219) — 14 廠 × 144 ts
- `get_power_plant_output_24h(name)` (217) — per 廠 24h

**新增 1 個**（可選）：
- `get_power_generation_kpi_24h()` — 計算全國 24h max/min/avg load_rate / fuel mix 變化 / 各時段燃氣燃煤水力比例 → 給 monitor 卡片用

### 前端（mini-taiwan-pulse）

#### 2. MonitorPanel 新增 PowerCard
位置：`src/components/intel/monitor/`
參考已有的 `SituationCards.tsx`（PlaCard / DiseaseCard pattern）。

新增：
- `src/components/intel/monitor/PowerCard.tsx` — 一張長卡，內容：
  ```
  ┌─────────────────────────────────────────┐
  │ 🟢 全國供電  19.4% 備轉  37,198 MW 負載 │  ← 大字
  │ 預測尖峰 13:00-16:00                    │
  ├─────────────────────────────────────────┤
  │  4 區用電 bars + 24h trend mini-chart   │  ← 用 SVG 自繪
  │  北 13,331 ▰▰▰▰▱ 中 10,710 ▰▰▰▰▱     │
  │  南 12,656 ▰▰▰▰▱ 東   501 ▰▱▱▱▱      │
  ├─────────────────────────────────────────┤
  │  14 廠出力 sparklines（3×5 grid）        │  ← 每廠 sparkline
  │  大潭 6108MW 122% ╭╮___                  │
  │  台中 4393MW 76%  __╮_╯                  │
  │  ... 14 廠                              │
  └─────────────────────────────────────────┘
  ```

#### 3. 接線
- `MonitorPanel.tsx` 加 `<PowerCard data={powerDashboardData} day={powerGenerationDay} />`
- 共用 `usePowerDashboard` 和 `fetchPowerGeneration24h`（已有，不重複拉）
- 每 5 min refresh

#### 4. 同時保留地圖端
- 地圖 3D beam (powerGenerationUnit) **不動**
- Sidebar 不需要動

### Test 要點
- 開 monitor 面板 → PowerCard 顯示燈號 + 4 區 + 14 廠 sparkline
- 拖 timeline → 不影響 monitor（monitor 顯示最新 + 24h），但**影響 map beam**
- 5 min 後資料自動 refresh

### Pitfall 提醒
- **不要重複 fetch**：monitor 跟 map beam 共用 `fetchPowerGeneration24h()` 的 `cachedOnce 10min TTL`
- `usePowerDashboard(active=true)` 一旦 monitor 開了就 active，跟舊 `energyDashboardActive` 邏輯接起來

---

## B — HAZARD 群組（閃電 + 核安）

### 用戶定向：「閃電也要接上去」
- 改用 **HAZARD** 群組（與 `disasterAlerts` 同層），不是 ENERGY
- monitor 也應該有「過去 1h 閃電數」「核安異常站數」KPI

### 後端（已備）
- `get_lightning_recent(minutes int)` (214) — clamp 1~720min，LIMIT 50000
- `get_nuclear_radiation_status()` (215) — 51 站 + is_stale

**新增**（可選）：
- `get_lightning_hourly_density()` — 過去 24h 每小時 count + 區域分佈，給 monitor KPI 用
- `get_nuclear_radiation_24h_for(station_id)` — 單站 24h 劑量曲線（從 measurements 表），給 popup sparkline

### 前端

#### 1. types/index.ts
```ts
// 加進 LayerVisibility:
lightning: boolean;        // 落雷即時（過去 1h cluster）
nuclearRadiation: boolean; // 核安 51 站
// 加進 ExpandableLayerKey:
| "lightning" | "nuclearRadiation"
// 加進 FeatureInfo layerType:
| "lightningStrike" | "nuclearStation"
```

#### 2. SECTIONS 新增 HAZARD 分組（layerCatalog.ts）
```ts
{
  title: "HAZARD · 災害",
  layers: [
    { key: "lightning", label: "落雷", expandable: true },
    { key: "nuclearRadiation", label: "核安輻射", expandable: true },
    // 未來：地震、颱風、火災（部分已存在獨立分組可整合）
  ],
}
```
注意：既有 `lifelineAlerts/floodAlerts/...` 5 群 alerts 在 INTEL 分組，可考慮一併重組（看 layerCatalog 現況決定）。

#### 3. data/lightningLoader.ts + nuclearLoader.ts
```ts
// lightning
fetchLightningRecent(minutes = 60) // cachedByKey by minutes
LIGHTNING_TYPE_COLORS: { 0: 雲對地, 1: 雲中 }
// nuclear
fetchNuclearStatus() // cachedOnce 5min
NUCLEAR_DOSE_THRESHOLDS: { normal_max: 0.072, warning: 0.5, alarm: 5 }
```

#### 4. overlayRegistry 加 2 entry
**落雷**：
- sourceId `hazard-lightning`
- 兩 layer：cluster halo（zoom < 10）+ point dot
- properties: strike_type、intensity_ka、strike_ts
- cluster 必走 Mapbox `cluster: true`（不能 N 點直接畫）

**核安站**：
- sourceId `hazard-nuclear-stations`
- circle + halo
- color expression by dose level
- 視覺：is_stale=true 加灰色 stroke 區分「故障」vs「異常高劑量」

#### 5. useLightningLayer + useNuclearLayer hooks
參考 useEnergyPoiLayer pattern：
- visible 時 fetch + 5min poll
- 落雷有 timeline：subscribeThrottled 訂閱 timeStore，scrub 時 fetch 對應 time-window 1h

#### 6. featureInfo/hazardPanels.tsx
- LightningStrikePanel: 時間 / 強度 (kA) / 雲對地 vs 雲中
- NuclearStationPanel: 站名 / 即時劑量 / is_stale / 24h sparkline（用 `get_nuclear_radiation_24h_for`）+ 警示「is_stale + 高劑量 ≠ 核災」

#### 7. LegendPanel
- LightningLegend: 雲對地 / 雲中 兩色
- NuclearLegend: G/Y/O/R dose 4 階 + stale 標記說明

#### 8. Monitor 加 HazardCard（可選）
- 過去 1h 閃電數
- 過去 24h 雷雨地圖（mini）
- 核安異常站數 / 全站平均 dose

### Pitfall 提醒
- **落雷頻寫**：cron 每 1 分鐘、雷雨季每分鐘 50-500 events。前端**必走 cluster + zoom-gate**（zoom < 9 強制 cluster，zoom >= 12 散點）
- **核安誤判**：`is_stale=true` + dose 高 ≠ 核災（感測器離線）→ panel 必須強調
- **時序窗**：`get_lightning_recent(60)` 預設 1h；timeline 模式應拿「以 currentTime 為中心 ±30min」
- **payload**：1h 雷雨季可能 30,000 events × 30 bytes ≈ 900KB，可考慮 server-side cluster RPC（v2.1）

---

## C — 高壓電網（power_lines 2,305 + power_towers 26,589）

### 用戶定向：「之前盤點漏掉很多東西」中最重要的一塊，把電網 spine 連起來

### 後端
資料已在 Supabase，不需新 RPC（量小直接 SELECT 即可，或加 slim RPC）：
- `osm_power_lines` 2,305 LineString
- `osm_power_towers` 26,589 Point

可選新增：
- `get_osm_power_lines()` — slim RPC（line_type / voltage / operator + GeoJSON LineString）
- `get_osm_power_towers_zoomed(bbox)` — bbox-filtered tower（避免一次拉 26k 點）

### 前端

#### 1. types/index.ts
```ts
osmPowerLines: boolean;
osmPowerTowers: boolean;
```
+ ExpandableLayerKey + FeatureInfo layerType (powerLine / powerTower)

#### 2. SECTIONS 加進 ENERGY 分組
```ts
{ key: "osmPowerLines", label: "高壓線路", expandable: true },
{ key: "osmPowerTowers", label: "高壓電塔", expandable: true },
```

#### 3. data/energyLoader.ts 加 fetcher
```ts
fetchOsmPowerLines() // cachedOnce 60min
fetchOsmPowerTowersInBBox(bbox) // cachedByKey by bbox
POWER_LINE_VOLTAGE_COLORS: {
  '345000': '#dc2626',  // 紅 (345kV)
  '161000': '#f97316',  // 橘 (161kV)
  '69000':  '#facc15',  // 黃 (69kV)
  'mixed':  '#a3a3a3',  // 灰（含 ';'）
}
```

#### 4. overlayRegistry
**Lines**：
- LineString，按 voltage 分色 + glow，line-width interpolate by zoom
- 透明度 slider

**Towers**：
- **zoom-gated**：`minzoom: 13`（only show when 近距離）
- 純色小點（圈內 cluster）
- 或考慮預處理成 PMTiles（5.7MB raw，邊界 case）

#### 5. hooks
- useOsmPowerLinesLayer — 拉一次，static
- useOsmPowerTowersLayer — bbox-aware（map.on('moveend') → 更新 bbox → 重抓）

#### 6. featureInfo
- PowerLinePanel: voltage / operator / circuits / frequency / location
- PowerTowerPanel: voltage / structure type / operator

#### 7. LegendPanel
- PowerLineLegend: 345/161/69kV 3 色 + mixed

### 跨點關聯（三 3D skill §5.2 cascade）
**v2 之後**：電廠 → 變電所 → 充電站 cascade
- 有了 power_lines 後可疊「電力流動」`flowline` 粒子（§三 3D skill §6.1）
- 需要電網拓撲方向，但 OSM 沒有「from→to」端點資訊 → 走「中段往兩端散」假設即可

### Pitfall 提醒
- voltage 欄位實際格式：`"161000"`、`"161000;69000"`、`"161000;161000"`（雙迴路）
  → match 表達式要處理 `";"` 分隔
- 26k tower 直接 GeoJSON 5.7MB **可接受**（< 10MB），不需要 PMTiles
- 不要跟 `power_poles` 2.96M 搞混（那是低壓電桿，v3 才碰）

---

## D — OSM 風光電 + Polygon + 離島

### 用戶定向：「盤點漏掉很多東西」的剩餘 8 表
HANDOFF §⑤ + §⑥ 第二波：

| 表 | 筆數 | 視覺 |
|---|---:|---|
| `osm_wind_turbines` | 812 | 獨立 toggle（VIEW 已含）；3D pin/cylinder 或 2D circle，is_offshore 分色 |
| `osm_solar_farms` | 734 | 獨立 toggle；2D circle（屋頂光電是面、不是 3D 物件）|
| `osm_power_plants` | 513 | 獨立 toggle（VIEW 已混 layer 1）；2D circle |
| `offshore_wind_zones` | 36 | **Polygon fill** — VIEW 看不到；考慮 3D `polyextrude` 拉高 ∝ 容量 |
| `island_power_grid` | 14 | POI + **海纜 LineString**（同 submarineCables 風格虛線+dash）|
| `fossil_fuel_infrastructure` | 9 | POI；3D `cylinder` 油槽/LNG 罐型語意（語意強值得 3D） |
| `geothermal_wells` | 36 | POI；3D `cone` 倒置（井深向下語意）|
| `renewable_permits_taipei` | 438 | POI，category 分色（學校/國有/機關/焚化/沼氣/水力）|
| `geothermal_potential` | 27 | 無座標 → 縣市彙整 panel（v5 KPI）|

### 後端
都已在 public，slim RPC 即可：
- `get_osm_wind_turbines_slim()`
- `get_osm_solar_farms_slim()`
- `get_offshore_wind_zones_geojson()` — polygon 直接吐 ST_AsGeoJSON

### 前端
照 v1 SOP 一個一個加。每個 layer 該過鐵則：透明度 + 圖例（多色）+ click popup + scale（POI 才需）。

### Pitfall 提醒
- `offshore_wind_zones` 是 polygon，**已修過 213 用 ST_Centroid** 帶進 VIEW，但這層要看到 polygon 本身需獨立 layer
- `island_power_grid` 14 筆是混合 POI + LineString，schema 要看一下
- 風機 812 + 光電 734 + 電廠 513 = 2059 個 OSM POI，若同時開可能略卡 zoom 5

---

## E — 加油站 + power_poles PMTiles

### 後端
- `osm_gas_stations` 2,212（**主用**）
- `gas_stations` 573（對照用，⚠️ **不可 UNION** OSM 跟政府 — HANDOFF §⑧#3 99% 中油重複）
- `osm_charging_stations` 306（補社區型，與 TDX ev_charging 3,060 不重複）
- `power_poles` 2,959,326 ⚠️ **必走 PMTiles**

### 前端
1. 加油站 3 toggle（OSM 主、政府對照、OSM EV 補）
2. power_poles 走 PMTiles
   - 預處理：`tippecanoe -zg --drop-densest-as-needed --maximum-zoom=18 --minimum-zoom=12 power_poles.geojson -o power_poles.pmtiles`
   - 上傳 R2/S3
   - overlayRegistry pmtiles entry，minzoom 12（zoom 12 以下不顯示）

### Pitfall 提醒
- power_poles 1.4GB raw → 處理機器要 >= 16GB 記憶體
- tippecanoe `--maximum-zoom=18` 可能太大，先試 16
- PMTiles 上線後**每月看 storage cost**

---

## F — KPI 統計面板（非地圖）

### 表
- `analytics.solar_daily_generation` 3,992（光電月發電 2016+）
- `county_wind_stats` 211（全國年度，HANDOFF 命名誤導）
- `county_biomass_stats` 188
- `county_small_hydro_stats` 188
- `geothermal_potential` 27（縣市彙整）
- `analytics.lightning_daily_summary` —— 永久聚合
- `analytics.nuclear_radiation_daily` —— 永久聚合

### 前端
建一個 `EnergyStatsPanel` 進 monitor，包：
- 光電月趨勢（line chart）
- 縣市風光生質 pie/bar
- 全國裝置容量總覽（核能 0 / 燃氣 X / 燃煤 Y / 水力 Z / 風光 W）

可放在 monitor PowerCard 旁邊或單獨 tab。

---

## 共用注意事項（不踩 v1 踩過的坑）

### 1. CustomLayer mount 永遠用 try addLayer + idle 重試
**參考 `.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md`**（已在 PR #23 補上 SOP 段）
- **禁** `if (isStyleLoaded()) mount; else map.on("style.load", mount)` — 經典 race，v1.3.5 才修
- 任何新 3D layer 開工前**先 grep `.claude/pitfalls/*mapbox*`**

### 2. JOIN 公式注意 unit_name 格式
HANDOFF §3.2 寫錯，真實是 `{廠名core}{機型?}#{編號}`，用 prefix LIKE 比對（v1 已修，213/217/218/219 都對齊）

### 3. Schema 跟 HANDOFF 不一致
- power_system_status 欄位名：HANDOFF 寫 `supply_capacity_mw / instant_load_mw / reserve_rate_pct`，實際 `fore_maxi_sply_capacity_mw / curr_load_mw / fore_peak_resv_rate`（v1 已對照重命名）
- power_region_demand：實際只有 `generation_mw / consumption_mw`（v1 已用 consumption_mw 正規化）

### 4. 鐵則對齊（CLAUDE.md §5a）
任何新 layer 都該過：
- 透明度 slider（useTransportParams + ref）
- 分類 ≥ 2 → LegendPanel 加 sub-component
- 可點選 → useMapInteraction GIS_LAYERS + featureInfo registry
- Options ≥ 4 → native `<select>`

### 5. CachedOnce / CachedByKey TTL 慣例
- 靜態/慢變：15~60 min
- *Latest 即時值：5 min
- per-day / per-key 時序：10 min
- 24h preload：10 min（cron 寫入頻率）

### 6. layerConsistency ratchet 測試
新 layer 漏接會 fail，已接好還在 baseline 也 fail。新增 layer 都要：
- LAYER_COLORS 加 key
- SECTIONS 加 row
- LegendPanel LEGEND_REGISTRY 加行（或 BASELINE_NO_LEGEND）
- useTransportParams 加 case（或 BASELINE_NO_PARAMS）
- featureInfo PANEL_REGISTRY + HEADER_LABELS 加行（或 baseline）

---

## 已存在的 RPC（可直接吃，不要重做）

### Monitor 用
- `get_power_dashboard()` — 燈號 + 4 區
- `get_power_generation_24h()` — 14 廠 × 144 ts
- `get_power_plant_output_24h(name)` — per 廠 24h sparkline

### Map layer 用
- `get_power_plants_with_output()` — 10,665 POI（含 retired）
- `get_power_generation_at(ts)` — slim 14 廠 timeline
- `get_osm_substations()` / `get_ev_charging_stations()` — POI

### Hazard 用（前端沒接）
- `get_lightning_recent(min)` — 落雷
- `get_nuclear_radiation_status()` — 核安

---

## 工作順序建議

1. **A** Monitor 整合（最容易做完就有「KPI dashboard」感覺）
2. **B** HAZARD 閃電 + 核安（用戶要求；RPC 已備）
3. **C** 高壓電網（spine 連起來）
4. **D** OSM 風光電 polygon 離島（量大但每個小）
5. **E** 加油站 + power_poles PMTiles
6. **F** KPI 統計面板

A + B 可平行（不同檔案）。C/D/E/F 互不依賴可彈性。

---

## Prompt for 下個 session

```
（給 fresh Claude session 的開頭）

我要繼續 mini-taiwan-pulse 能源視覺化 v2。上一波 v1.0~v1.3.5 已 merge：
- PR https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/23
- PR https://github.com/ianlkl11234s/gis-platform/pull/10
- 已上線 4 layer：電廠 / 機組即時出力（3D beam）/ 變電所 / 充電站

下一波完整規劃請讀 docs/energy-v2-plan.md（本檔），重點：

1. Monitor 整合（用戶 priority A）
   - 全國供電燈號 HUD + 4 區用電 bars + 14 廠出力 sparklines 都搬 monitor
   - 用 fetchPowerGeneration24h（已有）+ usePowerDashboard（已有）
   - 新 component MonitorPanel/PowerCard.tsx

2. HAZARD 群組（用戶 priority B）
   - 閃電 lightning + 核安 nuclear_radiation
   - RPC 214/215 已備在 gis-platform
   - 新 SECTIONS HAZARD（與 disasterAlerts 同層）
   - 落雷必做 cluster + zoom-gate（雷雨季每分鐘 50-500 events）
   - 核安「is_stale + 高劑量 ≠ 核災」popup 必強調

3. 高壓電網（用戶 priority C：「之前盤點漏的最重要」）
   - osm_power_lines 2,305 + osm_power_towers 26,589
   - voltage 345/161/69 kV 分色
   - tower 走 minzoom 13 zoom-gate

接著還有 D 風光電/離岸/離島、E 加油站 power_poles、F KPI 統計（詳見本檔 §D~F）

⚠️ 開新 3D / CustomLayer hook 前必讀
`.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md`
（isStyleLoaded race 已踩過 2 次）

⚠️ HANDOFF 已知三處不對齊（v1 修過）：
- unit_name JOIN 公式：用 prefix LIKE，不要 SPLIT_PART
- power_system_status 欄位名實際不同
- VIEW 含 36 polygon → ST_Centroid

切新分支 `feat/energy-v2-A`（A 是 monitor），照 v1 SOP 一個 phase 一個 commit、不 push。
status doc 接續寫 docs/energy-v2-status.md。
```
