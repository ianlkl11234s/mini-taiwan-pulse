# 垃圾清運圖層 — Status

> 最後更新：2026-05-06
> 分支：`feat/historical-mode`（之後可拆 `feat/waste-collection`）
> 主城策略：**高雄**（24h GPS 8,374 筆 / 157 車 / 1,399 路線 / 32,422 停靠點 — 完整度第一）
> 退路：若高雄 RPC 異常，台南 24h GPS 20,627 筆可頂上（但無路線需走 fallback）
> Session 接回來必看：把這份 + `.claude/memory/waste-status-ref.md` 一起讀

---

## 0. 背景與決策

### 為什麼選高雄
| 城市 | 24h GPS | 車數 | 路線 LineString | 停靠點 | 結論 |
|---|---:|---:|---:|---:|---|
| 高雄 | 8,374 | 157 | **1,399 條 / 752 unique** | 32,422 | ✅ 主城 |
| 台南 | 20,627 | 183 | 0 | — | 🟡 GPS 多但無路線 |
| 新北 | 777 | 12 | 649 | 26,672 | 🟡 路線完整但車太少 |
| 台北 | 0 | 0 | 0 | 4,048 | ⏸ 無 GPS |

### 視覺策略：Path A（progress-based）
- 高雄垃圾車 GPS 帶 `route_id` → 套公車 `BusEngine` 的 `snapToRoute()` + `interpolateProgressPath()` 模式
- 取樣間隔 2 分鐘（vs 公車秒級），`MAX_ANOMALY_SPEED_KMH` 從 80 降到 50，內插速度保守
- 狀態三態：`collecting`（停在點上）/`driving`（移動）/`parked`（暗淡）

### 音符特效：方案 B（GPU Billboard）
- **整合在 wasteTruck toggle 內**（不獨立 toggle）
- InstancedMesh + custom vertex shader：spawn 寫進 instance attribute，shader 內 `(t - spawnTime)` 算位置/alpha/rotation
- 只對 `status === 'collecting'` 的 truck 噴音符（每 ~600ms 一個）
- 4 個 sprite atlas（♪ ♫ ♬ ♩）

---

## 1. 任務清單（To-do）

> 同步在 Claude Code TaskList（task IDs #1-#12）；勾選 = 已驗證

### 後端（gis-platform）
- [x] **#2** 寫 migration `069_waste_rpc.sql`：`public.get_waste_current(cities text[])` + `get_waste_routes(city)` + `get_waste_stops(city)` + `get_waste_facilities()`
- [ ] 跑 migration 進 Supabase 驗證（`SELECT * FROM get_waste_current('{高雄市}'::text[]) LIMIT 5;`）⚠️ 待用戶執行
- [ ] 確認 RPC 回應 < 1s（若慢就升級 pre-aggregate pattern → 進 Backlog）

### 前端骨架（mini-taiwan-pulse）
- [x] **#3** `src/types/index.ts` LayerVisibility 加 4 keys
- [x] **#4** `src/data/wasteLoader.ts` 4 個 fetcher + WASTE_STATUS_COLORS / WASTE_FACILITY_COLORS
- [x] **#5** `src/three/WasteTruckScene.ts` InstancedMesh 光球（GPS lerp 平滑，smoothFactor=0.04）
- [x] **#6** `src/three/WasteMusicNoteScene.ts` GPU billboard 音符（THREE.Points + custom shader + canvas atlas）
- [x] **#7** `src/map/wasteTruckCustomLayer.ts` 包裝兩個 sub-scene
- [x] **#8** `src/hooks/useWasteLayer.ts` 30s polling
- [ ] **#9** `src/map/overlayRegistry.ts` 加 wasteRoute/wasteStop/wasteFacility 三靜態 layer ⏸ 推下個迭代
- [x] **#10** `src/components/LayerSidebar.tsx` WASTE section + LAYER_COLORS（含 IconRailSidebar）
- [x] **#11** `src/App.tsx` + `useThreeJsLayers.ts` 接線
- [x] `src/hooks/useLayerVisibility.ts` 預設可見性 = false × 4
- [x] **#12** `npx tsc -b` 驗證 ✅ 通過

### 驗證 ⚠️ 待用戶執行
- [ ] 跑 migration 069 進 Supabase
- [ ] `npm run dev` 開到 `localhost:3721`，toggle 「垃圾車 Truck」確認高雄垃圾車光點顯示
- [ ] 確認 `collecting` 狀態下音符特效從光球飄出（每 ~600ms）
- [ ] LegendPanel 加 WASTE 段（推下個迭代，進 Backlog）

---

## 2. Backlog（之後處理，避免忘記）

| 優先 | 項目 | 觸發條件 | 備註 |
|---|---|---|---|
| **P0** | **Phase 3：OSRM map-matching（沿馬路走）** | 用戶 approved 2026-05-07 | 完整設計：`docs/research/waste-osrm-mapmatching-plan.md`。需 Docker OSRM + Taiwan OSM PBF + batch script + spatial.waste_trails_matched 表 + RPC v2。預估 1.5~2 工作天。多城市無額外成本（Taiwan OSM 已全島覆蓋） |
| P1 | **聲音版本（方案 C）** | 視覺 ship 之後加 | 8-bit 給愛麗絲 1 秒 loop，Web Audio PannerNode 3D 音源，camera < 200m 距離隨距變音量。彩蛋等級。|
| P1 | **wasteFacility geocode** | TGOS 批次完成 | 463 筆焚化爐/掩埋場/轉運站等地址 → 座標。寫進 `spatial.waste_facilities` |
| P1 | **wasteCleaningSquads 隊部圖層** | 等 geocode | 1,106 隊；先做 hover 詳情，圖層 P2 |
| P1 | **wasteRoute / wasteStop / wasteFacility 三靜態 layer** | 骨架 ship 後立即 | Mapbox native (line/circle cluster/symbol)，從 RPC 069 拿；LegendPanel 同步補 |
| P2 | **跨城市切換 UI** | 新北/台南也接上時 | 仿 `useBusLayer` 的 city multi-select。RPC 已支援 cities[]，前端 hook 加 selector |
| P2 | **Pre-aggregate `realtime.waste_trails_hourly`** | RPC 響應 > 1s 時 | 仿 iot_wra migration 063 pattern。目前 105ms 不需要，但車量翻倍時觸發 |
| P3 | **Replay 模式（trails_daily）** | 即時版穩定後 | 仿 `realtime.bus_trails_daily` 做 `realtime.waste_trails_daily` |
| P3 | **狀態色階 toggle** | 用戶要求時 | 顏色按 status / route / vehicle_type 切換（仿 BusColorMode） |
| P3 | **音符 spawn rate 跟車速綁定** | 視覺優化階段 | 慢速更密集（停車收垃圾時音樂響）、快速稀疏 |
| P3 | **狀態 bar 顯示 wasteCount** | 視覺優化 | 仿 `· 123 buses` 在 status bar 加 `· 45 trucks` |

---

## 3. 進度追蹤（執行紀錄）

> 每完成一段就 append 到這裡

### 2026-05-06
- ✅ 完成資料盤點：高雄為主城
- ✅ 第一版骨架（GPS lerp，music note GPU billboard）完成 + tsc 通過
- ✅ migration 069_waste_rpc.sql（4 個基本 RPC）完成 + 跑進 Supabase
- ✅ 前端骨架接線完成（loader / hook / customLayer / Scene / sidebar）

### 2026-05-07
- ✅ 修 3 個視覺 bug：光點 size 太小、音符 uTime epoch ms float32 精度爆、METERS_TO_UNIT 偏小
- ✅ 確認 Supabase 內有完整 trail（高雄 113k 筆 / 3 天 / 325 點/車）
- ✅ migration 070_waste_cleanup_cron.sql：每天 04:00 刪 7 天前 + 04:30 VACUUM（已 active）
- ✅ migration 071_waste_trails_rpc.sql：軌跡 RPC + Layer 1 去噪（速度過濾 + trip 切分）+ Layer 2 stop snapping（80m 半徑命中 55%）
  - 響應 105ms（從 30s 優化，改 geometry KNN 不用 geography 慢路徑）
  - 多城市可復用：cities TEXT[] 參數
- ✅ 前端方案 A 軌跡時間插值上線：
  - `wasteLoader.ts`：加 `fetchWasteTrails` + `parseWasteTimeline`
  - `useWasteLayer.ts`：改抓 trail，60s refresh
  - `WasteTruckScene.ts`：每幀 timeStore 時間插值，Catmull-Rom 4 控制點 spline + 跨 trip / >500m 距離 teleport fade + stale 數據半透明
- ✅ 用戶要求新功能（同日）：
  - 光點大小 slider（0.3~4 倍）+ 音符大小 slider（0.5~3 倍）— wasteTruck 改 expandable 加 controls
  - 音符顏色染琥珀 #fbbf24（匹配 wasteTruck 主視覺，shader uColor uniform）
- ✅ Phase 3 OSRM map-matching 完整設計文件：`docs/research/waste-osrm-mapmatching-plan.md`（approved，跨日工程進 Backlog）
- 🔜 待用戶：強制重整瀏覽器驗證軌跡 + 微調 slider

---

## 4. 已知坑點（更新中）

- `spatial.waste_positions_realtime` 沒有 pre-aggregate，DISTINCT ON 在 Supabase pooler 2min timeout 內若慢 → 直接走 Backlog P2
- 前端禁打 `spatial.*` schema（CLAUDE.md 規則 §2）→ 一律經 `public.*` RPC
- 動態圖層 currentTime 不能進 useEffect deps（CLAUDE.md §6）→ 走 `timeStore`
- LAYER_COLORS 漏 key 會 tsc error（強制順序 §5）

---

## 5. 參考文件

- `docs/bus-layer-design.md` — 公車 progress-based 架構（Path A 抄這個）
- `docs/research/water-layer-cookbook.md` — Layer 群組 + LegendPanel pattern
- `docs/research/iot-wra-integration-study.md` — 細項 toggle + overlayParams 0/1
- `docs/supabase-optimization.md` — 若需 pre-aggregate 看這份
- `../gis-platform/migrations/065_waste_management.sql` — waste schema 起源
- `../gis-platform/migrations/063_iot_wra_pre_aggregate.sql` — pre-aggregate 範本

---

## 6. Session 接回來 checklist

1. 讀本檔 + `.claude/memory/waste-status-ref.md`
2. 跑 `TaskList`（看上次卡哪）
3. 確認 git branch（`feat/historical-mode` 或已切到 `feat/waste-collection`）
4. 高雄 GPS 是否還活著：`SELECT MAX(observed_at) FROM spatial.waste_positions_realtime WHERE city='Kaohsiung';`
