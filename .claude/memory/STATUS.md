# Status

**最後更新**：2026-05-10（晚 — Phase 3 prototype + 視覺打磨 + grouped RPC 收尾）
**分支**：`feat/historical-mode`（本機領先 origin **32 commits**）

## 最新 commit chain（今晚）

```
STATUS rewrite (本次)
c6b330e memory: BACKLOG schedule done
a9e850f memory: DATA_SCOPE 廢棄物更新
d2428fb memory: PLAYBOOKS +PB-13 大集合 RPC SOP
3f9a81d memory: GLOSSARY +Schedule 動畫章節
85acaea memory: REFLECTIONS +1 篇
71ce8a3 memory: PRINCIPLES +grouped JSONB pattern
a435658 memory: INCIDENTS +2
304fcff fix(waste-schedule): 視覺打磨收尾 + grouped RPC + OSRM plan
448bd20 fix(waste): 079 grouped JSONB（gis-platform repo）
d6e9ef2 feat(waste): 表定動畫圖層 wasteSchedule 上線（5 城 + 60x 視覺打磨）
86dd94f docs+memory(waste): Phase 3 prototype 提前
...
```

## 5/10 晚 session 完成（兩階段）

### 階段 A：Phase 3 prototype 上線（commit d6e9ef2 + 2cc67b7）

5 城（高雄/新北/宜蘭/臺北/基隆）77K stops 直接做表定動畫，**不等 TGOS callback**：

- `gis-platform/migrations/079_waste_schedule_rpc.sql` — `get_waste_schedule_day(cities, dow)`
- `src/data/wasteScheduleLoader.ts` + `src/hooks/useWasteScheduleLayer.ts`（dow 驅動，subscribeDate 跟 timeline 連動）
- `src/three/WasteScheduleScene.ts` — InstancedMesh 動畫
- `src/map/wasteScheduleCustomLayer.ts` + `useThreeJsLayers` 整合
- LayerVisibility 加 `wasteSchedule` toggle（淡紫 #a78bfa，跟 GPS 琥珀分色）
- Picking + debug tooltip：點車看 route_id / stop / arrival / departure / gap

### 階段 B：視覺打磨 7 方案 try-error + grouped RPC（commit 304fcff + 448bd20）

7 方案 try-error 後收斂的設計：

| 方案 | 結果 |
|---|---|
| 1. 移除 alpha/size 切換 | ✅ 解眼睛痛 |
| 2. Trip-break detection (gap > 1500s) | ✅ 班次切換 fade out/invisible/fade in |
| 3. 短 dwell 持續移動 / 長 dwell 真停 | ✅ 解 dwell=0 過站不停 |
| 4. Catmull-Rom 平滑 | ❌ 拿掉（spline 對非真實軌跡 overshoot 反向）|
| 5. Distance threshold fade | ❌ 拿掉（切段不解視覺速度問題）|
| 6. TRIP_BREAK_S 600 → 1500 | ✅ 解林口（地廣山坡 stops gap median 600s） |
| 7. **Grouped JSONB RPC** | ✅ **解 PostgREST 20K row cap，林口/北投/高雄全現身** |

### 階段 B 最關鍵教訓：撞 PostgREST 20K cap 第二次

GLOSSARY 早寫了 migration 063 timeline 字串編碼是「避 PostgREST 20K cap」的 pattern，PRINCIPLES 也有 ⚠ P0 章節。**但設計新 RPC 時沒先看**，沿用 flat row 39K stops 設計就撞牆。

修法：grouped per-route，stops 為 JSONB array。39K rows → 1281 rows。

## 5 城 schedule routes 統計（dow=4 週四 active）

| 城 | routes | stops | LineString 覆蓋 |
|---|---|---|---|
| 新北 | 579 | 23,280 | 100%（649 條）|
| 高雄 | 360 | 8,870 | 99.6%（752/755）|
| 臺北 | 187 | 4,010 | **0%**（待 OSRM 補）|
| 宜蘭 | 75 | 1,726 | **0%**|
| 基隆 | 63 | 1,079 | **0%**|
| **合計** | **1,281** | ~39K | 1401/1281 = 109% |

## 視覺設計參數（給 60x 倍速調校）

```ts
TRIP_BREAK_S      = 1500;  // 25min 才算班次切換（板橋 60s vs 林口 600s 差 10x）
DWELL_THRESHOLD_S = 120;   // 2min：短 dwell 整段持續移動 / 長 dwell 真停
FADE_DURATION_S   = 180;   // 60x 下 3 視覺秒 fade
MIN_MOVE_S        = 60;    // gap=0 從 dwell 借時間
ACTIVE_ALPHA      = 1.0;   // 執勤中 alpha + size 不切換
maxInstances      = 20000; // 22 城擴展 buffer
```

## 下次 session 必做

### Track B Phase 1.5：OSRM 整合（BL-17，2.5-3 天）

詳見 [`docs/research/waste-schedule-osrm-plan.md`](../../docs/research/waste-schedule-osrm-plan.md)。

```
Phase 1: 用既有 LineString（高雄 + 新北 1401 routes）
   1a. 新 RPC get_waste_schedule_day_with_geometry（JOIN routes geometry）
   1b. Loader 投影 stops → progress
   1c. Scene 改 progress-based interpolation（仿 GPS matched trail）

Phase 2: OSRM 補北/基/宜（356 routes，~30 min build）
   2a. 新表 spatial.waste_routes_synthesized + build script
   2b. RPC fallback (waste_collection_routes → synthesized → 直線)

Phase 3: 5 城視覺驗收
```

OSRM 整合後車沿馬路走，「穿牆」、「方向突變」、「視覺速度過快」三個 v1 痛點一次解。

### Track A 並行（user / taipei-gis-analytics）

- ⏳ TGOS day_003-007 上傳中
- 🔴 寫 12_unified_callback.py（含 TWD97 → WGS84）
- 🔴 callback 完 stops 77K → 385K（22 城全覆蓋）

### 上線前必跑（BL-18）

22 城擴展前對新城跑 `docs/research/waste-schedule-data-quirks.md` 內 6 個 sanity SQL：
1. weekday_pattern 格式分布
2. arrival_time / departure_time 格式驗證
3. 同 stop 重複
4. 時間倒退
5. 班次切換比例（trip-break）
6. gap=0 瞬移密度

發現新格式（英文 Mon,Tue / 全形數字 / 12 小時 AM/PM 等）就擴展 RPC parser。

## 待 push（32 commits）

```bash
git push origin feat/historical-mode
```

不要忘記 gis-platform 也有 1 個未 push commit（`448bd20`）。
