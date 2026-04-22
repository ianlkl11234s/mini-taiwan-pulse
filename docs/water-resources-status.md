# Water Resources — Session Status

> **目的**：中斷 session 回來可以 5 分鐘內接上。
> **最後更新**：2026-04-22 (Phase 1 + Phase 2 + 蓄水率分母修正 + 水位計顏色修正)
> **分支**：`feat/water-resources`

---

## TL;DR — 一段話接回來

水循環骨架已打完：**降水（雨量站）→ 集水（watershed polygon）→ 儲水（3D 水位計）→ 輸水（河川水位站）** 都已上線。
今日（2026-04-22）另外修掉兩個 bug：
1. **蓄水率分母**改用「現行有效容量」（扣除淤積）對齊水利署官網 — migration 056
2. **警示顏色 key 語言不一致** — view 回英文但前端 dict keyed 中文，導致顏色一直沒生效；同時加入 critical/warning/normal/high 四色分級。

**下一個 ROI 最高的方向**：Phase 2.3 **timeline 回放** — 讓滑 timeline 時雨量/水庫/河川一起動（把 Mini Taiwan Pulse「時間軸」招牌補齊到水循環）。

---

## 1. 後端完成清單（已驗證存在）

### DB Migrations（`../gis-platform/migrations/`）

| Migration | 建立物件 | 用途 |
|---|---|---|
| `047_reservoir_rpc.sql` | `get_reservoir_status_latest` / `get_reservoir_status_day` / `get_reservoir_timeseries` | 水庫狀態 / 當日時序 / 單庫歷史 |
| `048_reservoir_geometry_authoritative.sql` | `reference.reservoir_geometry`（98 筆權威屬性）| 取代硬編碼座標（修澄清湖錯位）|
| `049_reservoir_watershed.sql` | `reference.reservoir_watershed`（80 筆 polygon, 12,774 km²）| 集水區空間資料 |
| `050_reservoir_sediment.sql` | `reservoir_geometry` 擴欄（`latest_measured_capacity` / `latest_sediment` / `latest_measured_at`）| 淤積資料 |
| `051_reservoir_daily_ops.sql` | `realtime.reservoir_daily_ops` | 每日營運時序 |
| `052_reservoir_context_rpc.sql` | `get_reservoir_context(id)` ★ | 一站式 JSON：水庫+狀態+集水區+流域+下游河川 |
| `053_reservoir_watershed_rivers_rpc.sql` | `get_reservoir_watershed_rivers(compare_id)` | 集水區內完整河網（ST_Intersection）|
| `054_rain_gauge_rpc.sql` | `get_rain_gauge_latest` / `get_rain_gauge_timeseries` | 雨量站（1,304 站 / 160ms）|
| `055_river_water_level_rpc.sql` | `get_river_water_level_latest` / `get_river_water_level_timeseries` | 河川水位（332 站 / 64ms）|
| `056_fix_storage_ratio_denominator.sql` | 重建 `reservoir_situation_v` / `get_reservoir_status_day` / `get_reservoir_timeseries` | 蓄水率分母改用 `current_capacity_wan`（扣淤積）對齊 WRA 官網 |

### Collectors（`../data-collectors/collectors/`）

| 檔案 | 狀態 | 備註 |
|---|---|---|
| `water_reservoir.py` | ✅ 改寫完成 | 移除 `RESERVOIR_COORDS` 硬編碼字典，改 JOIN `reference.reservoir_geometry` |
| `water_reservoir_daily_ops.py` | ✅ 新增 | 每日 WRA 41568，Zeabur 已跑 |

### Seed 腳本（`../data-collectors/scripts/`）

| 檔案 | 何時重跑 |
|---|---|
| `seed_reservoir_watershed.py` | WRA 約 3 年更新一次（建議每季檢查）|
| `seed_reservoir_sediment.py` | 年度測量，每年重跑 |

### 相關但已存在（更早的 migration）

- `043_water_rivers_basins.sql` — 河川/流域基礎
- `044_water_flood_protection.sql` — 淹水潛勢
- `045_rain_gauge_realtime.sql` — `realtime.rain_gauge_readings`（**無 RPC**）
- `046_groundwater_level_realtime.sql` — `realtime.groundwater_readings`（**無 RPC**）
- `022_water_system.sql` — `realtime.river_water_level`（**無 RPC**）

---

## 2. 前端現狀

### 已接（靜態 GeoJSON，`public/geo/`）

```
water_basins.geojson          流域 polygon
water_rivers.geojson          河川 line
water_river_polygons.geojson  寬河道 polygon
water_canals.geojson          灌溉渠道
water_dams.geojson            壩體點位
water_reservoirs.geojson      水庫蓄水範圍 polygon
water_reservoir_pillars.geojson  3D 柱（柱高=靜態容量，非動態）
water_facilities.geojson      水利設施
water_monitor_stations.geojson  監測站
water_flood_extreme.geojson   650mm/24h 淹水潛勢
```

`LayerSidebar` 已有 `WATER` 群組 7 個 toggle：
`waterBasins` / `waterRivers` / `waterCanals` / `waterReservoirs` / `waterFacilities` / `waterMonitorStations` / `waterFloodExtreme`

### FeatureInfoPanel 已有 panel

- `WaterFacilityPanel`
- `WaterMonitorPanel`
- `WaterDamPanel`
- `WaterReservoirPolyPanel`

（皆讀**靜態 properties**，沒接 RPC）

### 未接（0%）

| 項目 | 檔案（預計）|
|---|---|
| Context 互動 loader | `src/data/reservoirContextLoader.ts` ❌ |
| Context 疊層 hook | `src/hooks/useReservoirContextLayer.ts` ❌ |
| 動態 pillar（柱高 = 即時蓄水率）| 目前還是讀靜態 GeoJSON |
| Panel 擴充（蓄水率 / 燈號 / 淤積 / 迷你曲線）| `FeatureInfoPanel.tsx` 未改 |
| timeline 聯動動態水庫 | 未接 |

---

## 3. 水循環全景（缺口一覽）

| 階段 | 資料狀態 | 前端狀態 |
|---|---|---|
| ① 降水 | DB 有 `rain_gauge_readings` | 無 RPC、無前端 |
| ② 集水 | `reference.reservoir_watershed` ready | 未接（在 `get_reservoir_context` 中）|
| ③ 儲水 | RPC 全齊 | **只差前端**（Phase 1）|
| ④ 輸水 | DB 有 `river_water_level` | 無 RPC、前端只有靜態線 |
| ⑤ 供/防洪 | 靜態 GeoJSON | 已顯示（無動態）|
| ⑥ 地下水 | DB 有 `groundwater_readings` | 無 RPC、無前端 |

> 水庫是目前**唯一**完整到「只差前端」的鏈路，其他三組 realtime 要做都要先補 RPC migration。

---

## 4. 下一步（按 ROI 排序）

### Phase 1 — 水庫 context 互動（1-2 天）★ 進行中

後端 100% ready，純前端工作：

**Step 0 — 基礎資料（完成 2026-04-21）** ✅
- [x] 修改 `scripts/export/export-water-static.sh` 加 `compare_id`
  - `water_reservoirs.geojson`（polygon）：LEFT JOIN `reference.reservoir_geometry` by `res_name`；48/129 有 compare_id
  - `water_dams.geojson`：dams 用 `cht_map` → `res_name` 雙 JOIN；reservoir points 用 `id::integer`；75/111 有 compare_id
  - `NULLIF(compare_id, 0)` 過濾「未編號堰壩」條目（青潭堰等）
  - 本地 `public/geo/` 已重跑更新，**尚未上 S3**
- [x] 驗證 `get_reservoir_context(10201)` 石門水庫回傳完整 JSON（reservoir/basin/watershed/nearest_river）

**Step 1a — 前端 click context 互動（完成 2026-04-21）** ✅
- [x] `src/data/reservoirContextLoader.ts` — fetch + cache + inflight dedup
- [x] `src/hooks/useReservoirContextLayer.ts` — watershed fill + watershed outline + river glow + river line（4 layers + 3 sources）
- [x] `src/components/FeatureInfoPanel.tsx` — `WaterReservoirContextPanel`：
  - 蓄水率大字 + 警示燈號 badge
  - 蓄水量 / 水位 / 入流 / 出流 / 集水區雨量 / 更新時間
  - 淤積率（> 30% 變橘色警示）
  - 空間關聯：集水區面積 + 所在流域 + 最近河川 + 距離
  - 基本屬性：縣市 / 管理 / 壩高 / 狀態
  - fallback：compare_id 缺或 context 還 loading 時退回原 `WaterDamPanel` / `WaterReservoirPolyPanel`
- [x] `src/App.tsx` — 從 `featureInfo` 解析 `activeReservoirId` → 接 hook → context 傳 panel
- [x] `npx tsc -b` 通過

**Step 1b — 集水區內完整河網（完成 2026-04-22）** ✅
- [x] `gis-platform/migrations/053_reservoir_watershed_rivers_rpc.sql`
  - `get_reservoir_watershed_rivers(compare_id)` 回 FeatureCollection
  - `ST_Intersection(rl.geom, w.geom)` 剪 watershed 內河段，Simplify 放最後（10-20x 提速）
  - 石門/翡翠/高屏溪實測 1.5~2s
  - 已部署到 Supabase ✅
- [x] `reservoirContextLoader.ts` 加 `fetchReservoirWatershedRivers` + cache + inflight dedup
- [x] `useReservoirContextLayer.ts` 加 `SRC_NETWORK` + 2 個 line layer（glow + fine）
- [x] context `nearest_river` 停畫（避開 river_lines 的 2,445 km outlier MultiLineString）
- [x] `npx tsc -b` 通過

> 發現並記錄：`public.river_lines` 有一筆 **2,445 km 的巨型 MultiLineString**（把大量河川段聚合成一個 feature 且 name/type/code 全空），導致原本 KNN nearest_river 對石門/翡翠/寶山會「全台亮」。新 RPC 用 ST_Intersection 剪裁繞過此 bug。下游河流連動做不到（river_lines metadata 缺失），退回「集水區內完整」。

**Step 1c — 3D 水位計 cylinder（完成 2026-04-22）** ✅
- [x] `gis-platform/migrations/047_reservoir_rpc.sql`（已存在） - `get_reservoir_status_latest` 回 40/40 每庫最新水情
- [x] `src/data/reservoirStatusLoader.ts` - RPC wrapper + `ALERT_COLOR_HEX` + `compareIdFromReservoirId`
- [x] `src/three/ReservoirScene.ts` - 雙 InstancedMesh（外殼空心 cylinder + 內水實心 cylinder）
  - 基座半徑 ∝ cbrt(effective_capacity_wan)（500-8000m）
  - 外殼高度固定 8000m，內水高度 = 蓄水率 × 外殼高
  - 警示燈號顏色：正常青 / 輕黃 / 中橘 / 重紅
  - `pickReservoir(x,y,w,h)` 螢幕距離方式 pick
- [x] `src/map/reservoirCustomLayer.ts` - Mapbox custom WebGL layer bridge
- [x] `src/hooks/useReservoirStatusLayer.ts` - 管 scene + 定期 refresh（5 min）
- [x] `src/hooks/useMapInteraction.ts` - 加 reservoir picking（在 GIS layer 查詢前先試 3D）
- [x] `src/map/overlayRegistry.ts` - 砍 ② 光球 + ③ 靜態 pillar（保留 ① poly + ④ 壩體節點）
- [x] 刪 `public/geo/water_reservoir_pillars.geojson`（檔頭有 `SET\n` bug）
- [x] App.tsx 接線：scene ref + statuses ref + useReservoirStatusLayer + picking ref 傳 useMapInteraction
- [x] `npx tsc -b` 通過

**Step 2 — 瀏覽器實測 + S3 上傳**
- [ ] `npm run dev` 點石門水庫（compare_id=10201）驗證 3 疊層 + context panel 顯示
- [ ] `bash scripts/deploy/upload-deploy-assets.sh` 上傳更新的 water_*.geojson（若 S3 需要）

### Phase 2 — 雨量 + 河川水位（完成 2026-04-22）✅

- [x] `gis-platform/migrations/054_rain_gauge_rpc.sql` — `get_rain_gauge_latest` (1,304 站 / 160ms) + `get_rain_gauge_timeseries`
- [x] `gis-platform/migrations/055_river_water_level_rpc.sql` — `get_river_water_level_latest` (332 站 / 64ms) + `get_river_water_level_timeseries`
- [x] `src/data/rainGaugeLoader.ts` + `src/hooks/useRainGaugeLayer.ts`：雨量站 Mapbox circle，半徑 ∝ 10min 雨量，顏色依 CWA 1hr 分級
- [x] `src/data/riverLevelLoader.ts` + `src/hooks/useRiverLevelLayer.ts`：河川水位 circle，check_result=0 異常紅
- [x] `FeatureInfoPanel` 新 `RainGaugePanel` + `RiverLevelPanel`
- [x] LayerSidebar / IconRailSidebar / types / useLayerVisibility / useMapInteraction 接線
- [x] `npx tsc -b` 通過

### Phase 1.5 — 蓄水率分母 + 顏色修正（完成 2026-04-22）✅

發現點擊水庫時數字與 `fhy.wra.gov.tw` 官網差距極大（曾文 12% vs 17%、霧社 12% vs 73.87%）。

- [x] **根因 1**：view 分母用設計有效容量 `effective_capacity_wan`（未扣淤積），水利署用現行有效容量 `current_capacity_wan`（扣淤積）。霧社淤積率 81%，分母用錯百分比會失真成 12%。
- [x] **migration 056**：重建 `reservoir_situation_v` + `get_reservoir_status_day` + `get_reservoir_timeseries`，分母改 `current_capacity_wan`。
- [x] **根因 2**：view 輸出 `alert_level` 是英文（`critical/warning/normal/high`），但 `ALERT_COLOR_HEX`（3D）與 `ALERT_COLORS`（Panel）皆 keyed 中文（`正常/輕度/中度/重度/嚴重`），顏色從未生效，全部 fallback 到預設青色。
- [x] 改寫兩處 dict 對齊英文 key，顏色分級：critical=紅 / warning=橘 / normal=青 / high=綠；同時加 `ALERT_LABELS` 提供中文顯示標籤（嚴重/偏低/正常/滿水）。
- [x] Commits：gis-platform `609a4b3`、mini-taiwan-pulse `4bee226`

**驗證（2026-04-22 13:00 snapshot）**：
- 曾文 16.3% 橘 / 霧社 65.9% 青 / 翡翠 100.7% 綠 / 全台 37/40 有即時資料，分佈 critical 3 / warning 8 / high 2 / normal 24。
- 霧社還差官網 ~8% 是 snapshot 時間差 + WRA 持續淤積測量。

### Phase 2.3 — Timeline 回放（下一步，高 ROI）⏳

讓 timeline 滑動時水循環**同步**回放：
- [ ] `gis-platform/migrations/057_water_day_rpc.sql`（暫定）
  - `get_rain_gauge_day(target_date)` 仿 `get_reservoir_status_day` 回每小時/每 10 min
  - `get_river_water_level_day(target_date)`
- [ ] `src/data/rainGaugeLoader.ts` 加 `fetchRainGaugeDay`
- [ ] `src/hooks/useRainGaugeLayer.ts` 切換 `timeStore.subscribeDate` + `subscribeThrottled`（走 external time store，遵守 CLAUDE.md 規則 6）
- [ ] 同套路搬到 river level
- [ ] 水庫已有 `get_reservoir_status_day`，但 `useReservoirStatusLayer` 目前只 fetch latest，要改 timeline 驅動
- [ ] 評估是否需要 pre-aggregate（rain_gauge 1,304 站 × 144 筆/日 = 188k rows/day，若 > 1s 就走 matview）

> 這一步完成後，整條水循環才真正「會動」，對齊 Mini Taiwan Pulse 的定位。

### Phase 3（選配）

- [ ] 警戒水位視覺化：`public.river_stations` 目前無資料，警戒三級水位無法套 badge/顏色。需上游 seed river_stations 後回 RPC 加欄位。
- [ ] 地下水 RPC + 前端（migration 046 有表，缺 RPC）
- [ ] 枯旱燈號 36695
- [ ] 洩洪訊息 58343
- [ ] 集水區敏感區 129475 / 129476

---

## 5. 已知坑點

| 坑 | 備註 |
|---|---|
| `water_reservoir_pillars.geojson` 檔頭有 `SET\n` 前綴 | 非合法 JSON，換動態 source 時順手處理（已刪）|
| 淤積資料只有北區 15 筆 | WRA 公告中/南區後重跑 `seed_reservoir_sediment.py` |
| `public.river_lines` 有 2,445 km outlier MultiLineString | name/type/code 全空，KNN nearest_river 會全台亮；Phase 1b 已用 ST_Intersection 繞過 |
| 蓄水率分母必須用 `current_capacity_wan`（非 `effective_capacity_wan`）| 淤積大的水庫差異可達 5x（霧社）；migration 056 已修 |
| `alert_level` 是**英文** key（`critical/warning/normal/high`）| 前端 dict 要用英文 key，中文只做 display label |
| `current_capacity_wan` 啟動時 sync 一次 | WRA 真正的現行容量會隨測量更新，我方 DB 會慢一點（< 1% 誤差）|
| Supabase pooler 2min timeout | RPC 回傳 > 1s 要套 pre-aggregate pattern（見 `supabase-optimization.md`）|
| 動態圖層 currentTime 不可入 deps | 強制走 `timeStore`（CLAUDE.md 規則 6）|
| 靜態 GeoJSON 走 S3 扁平檔名契約 | 不要改路徑 |

---

## 6. 參考文件

- `docs/water-opendata-catalog.md` — WRA 27 筆開放資料完整盤點
- `docs/development-rules.md` — 開發規則詳細版
- `docs/supabase-optimization.md` — Pre-aggregate pattern（Phase 2 會用到）
- `../gis-platform/migrations/052_reservoir_context_rpc.sql` — 看 `get_reservoir_context` 回傳 schema

---

## 7. 接回來的快速 checklist

```bash
# 確認分支
git status                             # 應該在 feat/water-resources

# 確認後端 RPC 活著（任選一個快速驗）
# 從 src/lib/supabase.ts 拿 client，或在 Supabase dashboard SQL editor：
# SELECT * FROM public.get_reservoir_status_latest() LIMIT 3;
# SELECT public.get_reservoir_context(10401);   -- 石門

# 起前端
npm run dev                            # port 3721

# 跑型別檢查（commit 前必跑）
npx tsc -b
```

下一個動作：**Phase 2.3 — Timeline 回放**（`get_rain_gauge_day` + `get_river_water_level_day` + 前端切換到 `timeStore.subscribeDate`）。

若要驗證今日修正是否生效，瀏覽器打開後點任一水庫：
- 曾文應顯示約 16%（橘）、霧社約 66%（青）、翡翠約 100%（綠）、石門約 69%（青）
- 3D 水柱顏色依 critical/warning/normal/high 四色，外殼維持半透明
