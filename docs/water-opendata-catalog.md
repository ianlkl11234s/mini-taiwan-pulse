# 水資源系統文件

> Last updated: 2026-04-21
> 涵蓋：DB schema / Collector / Seed / RPC / 開放資料盤點 / 資料鏈
> 關聯：`gis-platform`（migrations）· `data-collectors`（collectors + scripts）· `mini-taiwan-pulse`（前端 — P2 待做）

---

## 1. 現況總覽（2026-04-21）

| 類別 | 項目 | 筆數 / 頻率 | 資料新鮮度 |
|---|---|---|---|
| **Reference** | `reference.reservoir_geometry` | 98（49 有 compare_id，15 有淤積） | 2023-05 SHP + 2024 淤積 |
| | `reference.reservoir_watershed` | 80（53 有 compare_id） | 2023-05 SHP |
| **Public 靜態** | `public.water_reservoirs` | 40（37 有座標） | collector 啟動時同步 |
| | `public.reservoir_storage` | 129 polygon | 2020 |
| | `public.river_basins` | 116 | — |
| | `public.river_lines` | 2,015（含 GIST 索引） | — |
| **Realtime** | `realtime.reservoir_status` | 1,778 rows / 68 庫 | lag ~1h（每小時）|
| | `realtime.reservoir_daily_ops` | 68 / 68 庫 | lag ~1 day（每日）|
| | `realtime.river_water_level` | 86k / 373 站 | lag ~22m（每 10min）|
| | `realtime.rain_gauge_readings` | 346k / 1,310 站 | lag ~12m（每 10min）|
| | `realtime.groundwater_level_readings` | 133k / 786 站 | lag ~52m（每小時）|
| **RPC** | `get_reservoir_status_latest()` | — | 047 |
| | `get_reservoir_status_day(date)` | — | 047 |
| | `get_reservoir_timeseries(id,from,to)` | — | 047 |
| | `get_reservoir_context(compare_id)` | — | 052（P2 一站式）|

---

## 2. 資料管線全景

```
┌─ 外部資料源（WRA / CWA）────────────────────────────────────┐
│ 25776  水庫堰壩位置圖 SHP（年不定期）                       │
│ 129474 水庫集水區 polygon SHP（年不定期）                   │
│ 32726  水庫基本資料 JSON（年）                              │
│ 32727  水庫淤積量 JSON（年，目前限北區）                    │
│ 45501  水庫水情 JSON（每小時）                              │
│ 41568  水庫每日營運 JSON（每日 09:30）                      │
│ 河川水位 / 雨量 / 地下水（CWA/WRA）                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
    ┌───────────────────┴──────────────────────┐
    │                                          │
    ▼ 一次性 / 不定期                          ▼ 時序 collector
┌─ data-collectors/scripts/ ──────────┐  ┌─ data-collectors/collectors/ ─┐
│ seed_reservoir_watershed.py         │  │ water_reservoir.py（每小時）  │
│ seed_reservoir_sediment.py          │  │ water_reservoir_daily_ops.py  │
│ （可手動觸發，建議每季一次）        │  │ river_water_level.py          │
│                                     │  │ rain_gauge_realtime.py        │
│                                     │  │ groundwater_level.py          │
└───────────────────┬─────────────────┘  └─────────────┬─────────────────┘
                    │                                  │
                    ▼                                  ▼
┌─ Supabase (gis-platform) ───────────────────────────────────────────┐
│  reference.*         靜態權威      │  realtime.*     時序           │
│  ├ reservoir_geometry (98) 座標+淤積  ├ reservoir_status (hourly)    │
│  └ reservoir_watershed (80) polygon   ├ reservoir_daily_ops (daily)  │
│  public.*            既有圖層          ├ river_water_level           │
│  ├ water_reservoirs (40)              ├ rain_gauge_readings         │
│  ├ reservoir_storage (129) 蓄水 polygon  └ groundwater_level_readings│
│  ├ river_basins (116) / river_lines (2015)                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─ public.*  RPC（前端入口）────────────────────────────────────────┐
│  get_reservoir_status_latest()         最新一筆 / 每庫            │
│  get_reservoir_status_day(date)        當日每小時時序             │
│  get_reservoir_timeseries(id,from,to)  單庫歷史                   │
│  get_reservoir_context(compare_id)     ★ 一站式 JSON（P2）        │
│   └─ 含 reservoir + latest_status + watershed + basin + nearest_river │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Migration 時序（水資源相關）

| Migration | 功能 |
|---|---|
| 022 | 核心 schema：`public.water_reservoirs` / `realtime.reservoir_status` / `realtime.river_water_level` / view `reservoir_situation_v` |
| 040 | 水資源 POI + polygon |
| 042 | 水工構造物（水庫/堰壩/防洪設施）|
| 043 | 河川 / 流域 schema（`river_lines` / `river_basins`）|
| 044 | 淹水防護 |
| 045 | `realtime.rain_gauge_readings`（CWA 每 10min）|
| 046 | `realtime.groundwater_level_readings` |
| **047** | `get_reservoir_status_latest / day / timeseries` 三支薄 RPC |
| **048** | `reference.reservoir_geometry` + seed 98 筆 WRA SHP + 修正 `public.water_reservoirs.lat/lng` |
| **049** | `reference.reservoir_watershed` polygon 表 |
| **050** | 擴充 `reservoir_geometry` 三欄淤積資料（淤積量/最新容量/測量日）|
| **051** | `realtime.reservoir_daily_ops` 每日營運時序表 |
| **052** | `get_reservoir_context(compare_id)` 一站式 JSON RPC（P2）|

粗體為 2026-04 新增。

---

## 4. Collector 清單（data-collectors）

| Collector | 來源 | 表 | ENV 變數 | 預設 | 備註 |
|---|---|---|---|---|---|
| `WaterReservoirCollector` | WRA 45501（小時）+ 32726（靜態）| `public.water_reservoirs` + `realtime.reservoir_status` | `WATER_RESERVOIR_ENABLED` / `_INTERVAL` | 60 min | 已跑中 |
| `WaterReservoirDailyOpsCollector` ✨ 本輪新增 | WRA 41568（每日）| `realtime.reservoir_daily_ops` | `WATER_RESERVOIR_DAILY_OPS_ENABLED` / `_INTERVAL` | 1440 min | 已跑中 |
| `RiverWaterLevelCollector` | WRA 河川即時水位 | `realtime.river_water_level` | `RIVER_WATER_LEVEL_ENABLED` / `_INTERVAL` | 10 min | 已跑中 |
| `RainGaugeRealtimeCollector` | CWA O-A0002-001 | `realtime.rain_gauge_readings` | `RAIN_GAUGE_REALTIME_ENABLED`（需 `CWA_API_KEY`）| 10 min | 已跑中 |
| `GroundwaterLevelCollector` | WRA 地下水 | `realtime.groundwater_level_readings` | `GROUNDWATER_LEVEL_ENABLED` / `_INTERVAL` | 60 min | 已跑中 |

**啟用方式**：在 `data-collectors/.env` 設對應 `*_ENABLED=true`，重啟 `main.py` 自動註冊並立即執行一次，之後依 `*_INTERVAL`（分鐘）排程。

---

## 5. Seed 腳本（手動觸發，data-collectors/scripts/）

| 腳本 | 來源 | 目標 | 頻率 | 說明 |
|---|---|---|---|---|
| `seed_reservoir_watershed.py` ✨ | WRA 129474 SHP | `reference.reservoir_watershed` | 建議每季 | 下載 gic.wra.gov.tw ressub.zip → 轉 WGS84 → upsert |
| `seed_reservoir_sediment.py` ✨ | WRA 32727 | `reference.reservoir_geometry` 3 欄位 | 建議每年 | 只覆蓋北區 15 筆（WRA API 未公告全台）|

用法：
```bash
python3 scripts/seed_reservoir_watershed.py         # 下載最新 + upsert
python3 scripts/seed_reservoir_watershed.py --dry   # 只解析不寫
python3 scripts/seed_reservoir_watershed.py --local /path/to/*.shp
python3 scripts/seed_reservoir_sediment.py
```

---

## 6. Public RPC（前端入口）

| RPC | 參數 | 回傳 | 用途 |
|---|---|---|---|
| `get_reservoir_status_latest()` | — | TABLE 40 列 | 全庫最新水位/蓄水率 / 3D pillar |
| `get_reservoir_status_day(target_date)` | `DATE` | TABLE 每庫每小時 | Timeline slider 跨日切換 |
| `get_reservoir_timeseries(p_reservoir_id, p_from, p_to)` | `TEXT, TIMESTAMPTZ, TIMESTAMPTZ` | TABLE | FeatureInfoPanel 歷史曲線 |
| `get_reservoir_context(p_compare_id)` ✨ | `INTEGER` | **JSONB** | P2 一站式：reservoir + latest_status + watershed geojson + basin + nearest_river geojson |

### `get_reservoir_context(compare_id)` 回傳範例

```jsonb
{
  "reservoir":     {res_name, county, lat, lng, dam_height_m, capacity_*, silt_ratio_pct, ...},
  "latest_status": {snapshot_at, water_level_m, storage_ratio_pct, alert_level, inflow_cms, ...},
  "watershed":     {primary_name, class, area_km2, geojson: <MultiPolygon>},
  "basin":         {basin_no, basin_name, area_km2},
  "nearest_river": {river_name, river_type, dist_m, geojson: <LineString>}
}
```

單 call ~219ms。驗證 9 座主要水庫資料鏈皆完整（石門/翡翠/德基/日月潭/白河/烏山頭/曾文/澄清湖/牡丹）。

---

## 7. 已解決 bug：澄清湖座標錯位

| 階段 | 狀態 |
|---|---|
| 原狀 | `public.water_reservoirs` 的 lat/lng 來自 `collectors/water_reservoir.py:RESERVOIR_COORDS` 硬編碼字典；該字典 id 體系與 WRA 官方 ReservoirIdentifier 不一致 → 澄清湖 id=30801 座標被填成雲嘉位置（實為虎頭埤） |
| 修正 | (A) migration 048 seed 25776 SHP 權威座標 → `reference.reservoir_geometry`；UPDATE `public.water_reservoirs.lat/lng` |
| 治本 | (C) collector 移除硬編碼字典 + `supabase_writer._upsert_water_reservoirs` upsert 後自動 JOIN reference 同步 → 重跑不會污染 |
| 驗證 | 澄清湖 (22.665, 120.357) 高雄 ✅；collector 於 2026-04-21 13:05 重跑後座標仍正確 |

---

## 8. 外部開放資料盤點（WRA opendata 27 筆）

> 資料來源：[opendata.wra.gov.tw「水庫與堰壩」分類](https://opendata.wra.gov.tw/datasets?topic_name=%E6%B0%B4%E5%BA%AB%E8%88%87%E5%A0%B0%E5%A3%A9&page=1)
> 爬取日：2026-04-21（agent-browser 3 頁）
> API 根路徑：`https://opendata.wra.gov.tw/api/v2/{UUID}?format=JSON|CSV|XML`

### 已接入（P0，7 筆）

| # | dataset | 名稱 | 格式 | 更新頻率 | 用途 | 現況 |
|---|---|---|---|---|---|---|
| 1 | [25776](https://data.gov.tw/dataset/25776) | 水庫堰壩位置圖 | SHP + metadata JSON | 不定期（2020）| 權威座標 98 筆 | ✅ migration 048 + `reservoir_geometry` |
| 2 | [32726](https://data.gov.tw/dataset/32726) | 水庫基本資料 | JSON/CSV | 年 | 壩高/容量/鄉鎮 | ✅ `water_reservoir.py` collector |
| 3 | [45501](https://data.gov.tw/dataset/45501) | 水庫水情 | JSON | **每小時** | 水位/蓄水率 | ✅ `water_reservoir.py` → `reservoir_status` |
| 4 | [129474](https://data.gov.tw/dataset/129474) | 水庫集水區 | SHP + metadata JSON | 不定期（2023） | 80 筆 polygon | ✅ migration 049 + `seed_reservoir_watershed.py` |
| 5 | [32727](https://data.gov.tw/dataset/32727) | 水庫淤積量 | JSON | 年 | 淤積量/最新容量 | ✅ migration 050 + `seed_reservoir_sediment.py`（15 筆北區）|
| 6 | [41568](https://data.gov.tw/dataset/41568) | 水庫每日營運 | JSON | **每日 09:30** | 日統計（呆水位/滿水位/放流量）| ✅ migration 051 + `water_reservoir_daily_ops.py` |
| 7 | [13795](https://data.gov.tw/dataset/13795) | 水庫蓄水範圍 | SHP/KML + metadata | 不定期 | 129 筆 polygon | ✅ 已在 `public.reservoir_storage`（同源）|

### 跳過原因記錄

| dataset | 原因 |
|---|---|
| [139336](https://data.gov.tw/dataset/139336) 水庫代碼 | 欄位與 `reservoir_geometry` 100% 重複；鄉鎮 0% 覆蓋、行政區碼無對照表 |
| [32728](https://data.gov.tw/dataset/32728) 水庫營運（年度）| 功能被 41568 日營運涵蓋 |
| [32733~32735 / 95806] 單庫即時水情（4 筆）| 45501 已含全庫每小時 |
| [58345~58348] 個別集水區範圍圖（4 筆）| 已含於 129474 整包 |
| [58688 / 58690] 濁度資料 | 偏工程監測，非視覺化需求 |

### P2+ 候選（有需要再接）

| # | dataset | 用途 | 觸發條件 |
|---|---|---|---|
| [129475](https://data.gov.tw/dataset/129475) / [129476](https://data.gov.tw/dataset/129476) | 集水區敏感區內/外 0.5km | 做「環境管制」圖層時 |
| [36695](https://data.gov.tw/dataset/36695) | 枯旱預警燈號 | 做「旱情分布」時 |
| [58343](https://data.gov.tw/dataset/58343) | 洩洪訊息 | 做「事件通告」時 |
| [45495](https://data.gov.tw/dataset/45495) | 水庫警告設施（AED/救生圈） | 做「觀光安全」圖層時 |

### 驗證後的 API UUID

| dataset | UUID |
|---|---|
| 25776 | `4cd3054e-2f5c-44d6-94d9-24e5882a9d47` |
| 32726 | `708a43b0-24dc-40b7-9ed2-fca6a291e7ae` |
| 32727 | `572bda99-0593-4aee-9409-03c82423f8eb` |
| 41568 | `51023e88-4c76-4dbc-bbb9-470da690d539` |
| 45501 | `2be9044c-6e44-4856-aad5-dd108c2e6679` |
| 13795 | `dab16b75-a504-4dd6-a999-b325104389b4` |
| 129474 | `5bc42fbc-21d0-46fd-bc07-fd43d45613b0` |
| 139336 | `f65a2148-9c7a-4e16-acaf-48917a5124e2` |

---

## 9. P2 前端（待做）

RPC `get_reservoir_context` 已備好。前端 P2 實作清單：

1. **`src/data/reservoirContextLoader.ts`** — 包 RPC call + `loadingRegistry`
2. **`src/hooks/useReservoirContextLayer.ts`** — 訂閱 timeStore / 管理臨時疊層（click 時建立、close 時移除）
3. **`FeatureInfoPanel` 擴充** — 點 reservoir feature 時：
   - 抓 `get_reservoir_context(compare_id)` JSON
   - 在地圖動態加三個圖層：
     - `reservoir-watershed-highlight`（MultiPolygon，半透明 fill）
     - `reservoir-basin-highlight`（from `public.river_basins`，次半透明）
     - `reservoir-nearest-river-highlight`（LineString 粗線）
   - Panel 上顯示：容量 / 蓄水率 / 警示等級 / 淤積率 / 歷史曲線（用 `get_reservoir_timeseries`）
4. **關閉面板時清除**：移除上述三圖層 + source

前端動態圖層必須走 `timeStore.subscribe*`（CLAUDE.md 強制規則）。

---

## 10. 關聯 Repo

| Repo | 本輪相關 |
|---|---|
| `gis-platform` | migrations 047/048/049/050/051/052 |
| `data-collectors` | 修 `water_reservoir.py` + 新 `water_reservoir_daily_ops.py` + 2 支 seed 腳本 + `supabase_writer` / `config` / `main` 整合 |
| `mini-taiwan-pulse` | 本文件（docs/water-opendata-catalog.md）；前端 P2 未做 |
