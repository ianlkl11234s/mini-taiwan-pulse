# 公車圖層設計 — Progress-based 時間軸

> 2026-04-14 重構版。核心：**狀態變數從「位置」換成「route progress」**，位置永遠由 LineString 插值產生，幾何上保證沿路線。
>
> 本文件同時作為全台灣擴展的參考。

## 1. 為什麼不用「直接用 GPS 座標」

原本（舊版）的 Replay 做法：GPS trail → Catmull-Rom 時間插值 → 每幀 snap 到路線 → LineString 插值。

看起來合理，但實務上會看到三類異常：

| 現象 | 根因 |
|------|------|
| 座標跳回起點 | `snapToRoute` 是「LineString 最近點投影」，GPS 漂時可能投影到路線起點附近 |
| 瞬間位移幾百公尺~公里 | 距離式 GPS jump 偵測擋不住 300~500m 的漂移，snap 後 progress 照樣跳 |
| 轉彎切過去 | 兩 GPS 點之間直接 lerp → 直線跨過街廓，特別是 direction 切換、折返、或 route 無法配對的車 |

根本問題：**「位置」這個狀態變數被 GPS 誤差直接污染**，每次抖動都放大到視覺。

## 2. 新架構：Progress-based Timeline

### 2.1 核心概念

把每條 trail 預先投影到路線 progress 空間：

```
TrailPoint[]  (lat, lng, 0, ts)
  ├─ snapToRoute  ─→  每點取得 progress ∈ [0, 1]
  └─ build        ─→  ProgressPoint[] = (ts, progress, tripId)
```

播放時：
1. Binary search 找時間 ts 對應的 `progress1..progress2`
2. **Lerp progress**（1D 純量）
3. `interpolateOnLineString(route.coords, progress)` → 位置

位置永遠在 LineString 上，**幾何上不可能切角或跳出路線**。

### 2.2 Trip Segmentation

公車一天會跑多趟（去→回→去→回）。若 progress 從 0.9 直接 lerp 到 0.1，車會沿路線倒著飛回去。

`buildProgressPath` 偵測 trip 邊界並遞增 `tripId`：

| 條件 | 意義 |
|------|------|
| `dt > TRIP_GAP_SECONDS` (900s) | 時間斷層 → 新趟次 |
| `dp <= -TRIP_BACKWARD_THRESHOLD` (-0.3) | progress 倒退 >30% → 折返/回程 |

跨 tripId 時 `interpolateProgressPath` 不 lerp，改用 fade（見第 3 節）。

### 2.3 GPS 異常點處理

雖然 snap 壓抑了小幅 GPS 漂移，但偶爾會遇到：
- 短暫跳到路線另一段（progress 瞬間大幅改變）
- 小幅倒退（GPS 誤差）

`buildProgressPath` 的 anomaly 規則：

```
maxForward = max(MAX_ANOMALY_SPEED_KMH × dt / 3600 / totalKm × 1.5,  0.1)
isAnomaly  = dp > maxForward
           OR (MIN_BACKWARD_TOLERANCE < -dp < TRIP_BACKWARD_THRESHOLD)

連續 MAX_CONSECUTIVE_REJECTS (3) 次異常 → 強制接受，開新 trip
```

常數（`BusEngine.ts` 頂部）：

```ts
const TRIP_GAP_SECONDS = 900;
const TRIP_BACKWARD_THRESHOLD = 0.3;
const MIN_BACKWARD_TOLERANCE = 0.02;
const MAX_ANOMALY_SPEED_KMH = 80;
const MAX_CONSECUTIVE_REJECTS = 3;
const FADE_SECONDS = 60;
```

### 2.4 Live 模式

Live 沒有 trail，用 `SnappedBus` 一筆 state：

```
snap progress → 比對預期 progress (= prev.progress + rate × elapsed)
  偏離 > 3×expected 或倒退 > 3%  → 判為異常
    rejectStreak < 3                → 跳過此 poll 保留 prev
    rejectStreak == 3                → 接受（可能司機繞路/換線）
```

每幀：`progress += progressRate × elapsed`，純粹沿路線推進。

## 3. 淡入淡出（Fade）

**目的**：消除車輛「突兀出現／消失」的視覺突兀感。

### 3.1 三類 Fade 情境

| 情境 | 位置 | Alpha |
|------|------|-------|
| Trail 頭部（ts ∈ [start-60, start]) | `progressPath[0].progress` | 從 0 線性升到 1 |
| Trail 尾部（ts ∈ [end, end+60]) | `progressPath[last].progress` | 從 1 線性降到 0 |
| 跨 trip（p1.tripId ≠ p2.tripId） | 前半停 p1，後半停 p2 | outAlpha / inAlpha 分段 |
| 同 trip | lerp(p1, p2) | 1 |
| Live 新車 | 正常推進 | `min(age/60, 1)` |

### 3.2 跨 trip 的具體規則

```
elapsed   = ts - p1.ts
remaining = p2.ts - ts
outAlpha  = max(0, 1 - elapsed   / FADE)   // 停在 p1 逐漸淡出
inAlpha   = max(0, 1 - remaining / FADE)   // 朝 p2 逐漸淡入
if outAlpha >= inAlpha : {progress: p1, alpha: outAlpha}
else                   : {progress: p2, alpha: inAlpha}
if 兩者都 0             : 隱藏
```

效果：終點站停一會兒（淡出），中段完全不見，靠近新趟次發車時間再在起點站淡入。

### 3.3 Shader 實作

`BusScene.ts` 用 `MeshBasicMaterial` + `onBeforeCompile` 注入 per-instance alpha：

```ts
// init()
this.alphaAttribute = new THREE.InstancedBufferAttribute(
  new Float32Array(maxInstances).fill(1), 1
);
this.alphaAttribute.setUsage(THREE.DynamicDrawUsage);
geo.setAttribute("aAlpha", this.alphaAttribute);

mat.onBeforeCompile = (shader) => {
  shader.vertexShader = "attribute float aAlpha;\nvarying float vAlpha;\n"
    + shader.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/, "void main() {\nvAlpha = aAlpha;");
  shader.fragmentShader = "varying float vAlpha;\n"
    + shader.fragmentShader.replace(/\}\s*$/, "gl_FragColor.a *= vAlpha;\n}");
};

// update() 每 instance
this.alphaAttribute.setX(count, bus.fadeAlpha ?? 1);
this.alphaAttribute.needsUpdate = true;
```

兩主題通用：
- Dark (`AdditiveBlending`)：color × alpha 自然淡到背景
- Light (`NormalBlending`)：alpha 正常控制透明度

## 4. 資料流總覽

```
┌─────────────────────────────────────────────────────────────┐
│ useBusLayer (hook)                                          │
│  ┌─ useEffect：loadBusRoutesForCity × cities → addCityRoutes│
│  ├─ useEffect：Live poll → engine.ingestPoll                │
│  └─ loadDay callback：fetchBusTrails → engine.ingestTrails  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ BusEngine                                                   │
│                                                             │
│  addCityRoutes(city, data)                                  │
│    ├─ 把路線塞進 mergedRoutes / mergedIndex                 │
│    └─ ensureProgressPaths()      ← 修復 race                │
│                                                             │
│  ingestTrails(trails)            ← Replay                   │
│    ├─ filterTrailAnomalies       (90 km/h 跳躍過濾)         │
│    ├─ resolveRouteKey            (config routeKey)          │
│    └─ buildProgressPath          (pre-compute progress)     │
│                                                             │
│  ingestPoll(positions, now)      ← Live                     │
│    └─ snap + progress-jump 偵測 + rejectStreak              │
│                                                             │
│  update(ts) → BusVehicle[]                                  │
│    ├─ updateReplay (progressPath lerp + fade)               │
│    └─ updateLive   (progressRate 推進 + 新車淡入)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ BusScene (Three.js)                                         │
│  InstancedMesh + aAlpha attribute + custom shader injection │
└─────────────────────────────────────────────────────────────┘
```

## 5. 已踩過的坑 ⚠️

### 5.1 路線載入 race

**症狀**：重新整理後 console 出現 `(0 with progressPath)`，車輛直接穿越河面/建築。

**根因**：`loadBusRoutesForCity` 解析 18MB JSON 需時，`fetchBusTrails` 的 Supabase RPC 更快 → `ingestTrails` 執行時 `mergedRoutes` 還空 → `resolveRouteKey` 全部回 null → `progressPath` 全未建 → Path B (Catmull-Rom fallback) 觸發。

**修法**：`addCityRoutes` 尾部呼叫 `ensureProgressPaths()`：
- 對 `routeKey = null` 的 trail 重跑 `resolveRouteKey`
- 對有 routeKey 但沒 progressPath 的 trail，build

**驗證 log**：
```
[Bus] ingestTrails: 5650 → 5650 (0 with progressPath), ...
[Bus] Loaded 2293 route shapes for Taipei
[Bus] ensureProgressPaths: resolved 5XXX routeKey, built 5XXX progressPath
```

**關鍵教訓**：**一次性 pre-compute 一定要處理依賴資料晚到的情況**，不要依賴呼叫順序。

### 5.2 snap + position lerp 的互斥

Replay 每幀重新 snap（舊版），和 pre-computed progress lerp（新版）是互斥的兩種策略。若混用會出現：
- 舊版：每幀位置會震動（GPS 誤差透過 snap 傳回）
- 新版：位置平滑，但必須處理 race condition

新版只要 race 處理好，視覺更穩定。

### 5.3 折返 trail 的 direction 分離

**前提**：DB (`gis-platform/migrations/033_bus_trails_per_direction.sql`) 已按 `(plate_numb, direction)` 分 trail，同車不同方向是獨立 row。

若哪天 DB schema 改變，直接把同車去回程塞到同一條 path，`buildProgressPath` 仍會用 `progress <= -0.3` 偵測折返切 trip，但可靠性下降（若去回程路線差別大，snap 會更亂）。**盡量保持 per-direction 分離**。

### 5.4 `rejectStreak` 防卡住

Live 模式若 progress 偵測太嚴，車會永遠不更新。必須有 `MAX_CONSECUTIVE_REJECTS` 機制：連續 3 次異常就接受新 GPS（可能真的換線/繞路）。

## 6. 全台六都 + 公路客運（2026-04-14 擴展）

### 6.1 支援範圍

**市區公車**（6 城市、5 個 UI group）：

| 城市 | BusCity | UI Group | 檔案 | 大小 | 路線數 |
|------|---------|----------|------|------|--------|
| 台北 | `Taipei` | `TaipeiMetro`（雙北合併） | `taipei_bus_routes.json` | 18 MB | 2293 |
| 新北 | `NewTaipei` | `TaipeiMetro` | `newtaipei_bus_routes.json` | 10 MB | - |
| 桃園 | `Taoyuan` | `Taoyuan` | `taoyuan_bus_routes.json` | 5 MB | - |
| 台中 | `Taichung` | `Taichung` | `taichung_bus_routes.json` | 5.9 MB | 392 |
| 台南 | `Tainan` | `Tainan` | `tainan_bus_routes.json` | 3.6 MB | 157 |
| 高雄 | `Kaohsiung` | `Kaohsiung` | `kaohsiung_bus_routes.json` | 7.2 MB | 318 |

**公路客運**（全國單一資料源，無 city 切換）：

| 項目 | 值 |
|------|-----|
| 路線檔 | `intercity_bus_routes.json` (~87 MB / 1780 shapes / 492 routes) |
| Layer key | `busIntercityLive` |
| Supabase 表 | `realtime.bus_intercity_positions` / `realtime.bus_intercity_trails_daily` |
| Live RPC | `get_bus_intercity_current(sub_authorities text[])` |
| Replay RPC | `get_bus_intercity_trails(date, sub_authorities text[])` / `get_bus_intercity_dates()` |
| city 欄位 | 存 SubAuthorityID（業者代號，數字字串如 "45"） |

### 6.2 UI 設計：雙北合併 group

`BusGroup` 抽象層把 UI toggle 與底層 RPC cities 解耦：

```typescript
export type BusGroup = "TaipeiMetro" | "Taoyuan" | "Taichung" | "Tainan" | "Kaohsiung";
export const BUS_GROUP_CITIES: Record<BusGroup, BusCity[]> = {
  TaipeiMetro: ["Taipei", "NewTaipei"],
  Taoyuan:    ["Taoyuan"],
  // ...
};
```

- `useTransportParams` 管 `busGroups: Record<BusGroup, boolean>`
- `enabledBusCities` 是 computed 展開值，丟給 RPC
- 雙北只會一起開/關，減少使用者點擊負擔

### 6.3 渲染共用：同一個 BusScene

`useBusIntercityLayer` 獨立 hook，但共用 `BusEngine` 類別 + 同一個 Three.js `BusScene`：

```typescript
// useThreeJsLayers.ts
createBusLayer({
  getBuses: () => cityBuses.concat(intercityBuses),   // 串接兩組 activeBuses
  getIsVisible: () => busLive || busIntercityLive,    // 任一開啟即渲染
  getOrbScale: () => paramRefs.busOrbScale.current,   // 完全共用 color/scale/Z
  ...
});
```

所有顯示參數（`busOrbScale` / `busColorMode` / `busAltOffset`）兩者共享，無需重複 UI。

### 6.4 Supabase 後端（migration `037_bus_intercity_trails_daily.sql`）

完全沿用 `bus_trails_daily` 模式（pre-aggregate + pg_cron）：

```sql
-- 索引對齊 DISTINCT ON 排序
CREATE INDEX idx_bus_intercity_plate_time ON realtime.bus_intercity_positions (plate_numb, collected_at);

-- Refresh function: work_mem 64MB + advisory_xact_lock + MAX() 聚合
CREATE FUNCTION public.refresh_bus_intercity_trails_daily(target_day date) ...

-- cron 錯開 bus 的 :02/:17/:32/:47
SELECT cron.schedule('refresh-bus-intercity-trails', '7,22,37,52 * * * *', ...);
SELECT cron.schedule('cleanup-bus-intercity-trails', '7 3 * * *', ...);  -- 03:07 錯開 bus 03:02
```

dry-run 實測：今日 1,836 台 / 35,241 rows / 1.4 MB / 耗時 <1s（遠低於 bus 的 30-60s）。

### 6.5 效能與費用守則

| 風險 | 防線 |
|------|------|
| refresh OOM | `work_mem 64MB` + 5 分鐘降采樣 + `MAX()` 取代 `mode()` + 索引對齊 |
| refresh 重複 | `pg_advisory_xact_lock(hashtext(date))` |
| Pooler 2min timeout | refresh 走 pg_cron 繞過；對外 RPC 設 30-60s |
| IO 尖峰 | cron 錯開分鐘（bus :02/:17/:32/:47 vs intercity :07/:22/:37/:52）|
| 存量爆炸 | cleanup 保留 3 天 |
| 前端狂 poll | 25s debounce + LRU 3 天 cache |
| Response 4MB 上限 | intercity 1.8k 台，單趟 response <1MB，無需分片 |
| 大路線 JSON | `intercity_bus_routes.json` 87 MB 走 S3 deploy-assets（不進 git）|

### 6.6 部署：大檔走 S3

路線 JSON 部署模式（大小閾值約 10 MB）：

| 檔案 | 模式 |
|------|------|
| newtaipei / taoyuan / taichung / tainan / kaohsiung (<10MB) | 直接 commit 到 git |
| **taipei (18MB) / intercity (87MB)** | 透過 S3 deploy-assets 流程，本地 / volume 內存在但不進 git |

`.gitignore` 已排除 taipei & intercity；`scripts/deploy/upload-deploy-assets.sh` 與 `pull-deploy-assets.sh` 處理 tar.gz 打包。

## 7. 檔案導覽

| 檔案 | 角色 |
|------|------|
| `src/engines/BusEngine.ts` | 主邏輯（progressPath / fade / race fix），city 型別為 `string` 共用 city + intercity |
| `src/three/BusScene.ts` | 渲染層（InstancedMesh + alpha shader） |
| `src/data/busLoader.ts` | Supabase RPC 包裝（市區公車 + 公路客運 8 支函式）|
| `src/hooks/useBusLayer.ts` | 市區公車 hook（Live poll + Replay LRU + 多 city）|
| `src/hooks/useBusIntercityLayer.ts` | 公路客運 hook（無 city 切換，全國單一資料源）|
| `src/map/busCustomLayer.ts` | Mapbox custom layer wrapper |
| `src/engines/railUtils.ts` | `interpolateOnLineString` 共用工具 |
| `src/types/index.ts` | `BusCity` / `BusGroup` / `BUS_GROUP_CITIES` / `BUS_INTERCITY_ROUTES_JSON` |
| `gis-platform/migrations/037_bus_intercity_trails_daily.sql` | 公路客運 replay SQL migration |

## 8. 關聯文件

- [`docs/development-rules.md`](./development-rules.md) — Layer 新增順序
- [`docs/supabase-optimization.md`](./supabase-optimization.md) — RPC pre-aggregate pattern
- [`docs/known-issues.md`](./known-issues.md) — 歷史 bug
- `gis-platform/migrations/033_bus_trails_per_direction.sql` — per-direction 切分
- `data-collectors/docs/sql/cron_throttle.sql` — cron 排程錯開

## 9. Commit 追蹤

| Commit | 內容 |
|--------|------|
| `b3bef73` | `feat(bus): 改為 progress-based 時間軸，抑制 GPS 跳躍與切角` |
| `bc4b3e9` | `feat(bus): 淡入淡出 + 修復路線載入 race` |
| `c19c9bf` | `feat(bus): 市區公車擴展六都（雙北合併）+ 新增公路客運 live/replay` |
