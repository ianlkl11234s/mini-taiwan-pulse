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

## 6. 擴展到全台灣

### 6.1 資料面

目前 `public/bus/` 三個城市：

| 城市 | 檔案 | 大小 | 路線數 |
|------|------|------|--------|
| Taipei | taipei_bus_routes.json | 18 MB | 2293 |
| New Taipei | newtaipei_bus_routes.json | 10 MB | - |
| Taoyuan | taoyuan_bus_routes.json | 5 MB | - |

預估全台灣（加上台中、台南、高雄、基隆、新竹、宜蘭、花蓮等）總量可能達 **60~100 MB**。

### 6.2 必要的工作項目

**路線預處理（`scripts/preprocess/`）**
- 為每個縣市產生 `{city}_bus_routes.json`
- 欄位契約：`{routeUid}_{direction}: { routeUid, routeName, direction, coords, cumDist, totalDist, stopProgress, stopNames }`
- 扁平檔名（不要路徑分層，符合 S3 deploy-assets 契約）

**前端 cities 參數**
- `useBusLayer(enabled, timeRef, timeMode, cities)` 的 `cities: BusCity[]` 需擴充
- 新增 `BusCity` enum 在 `types/index.ts`
- LayerSidebar 提供城市多選 UI（目前預設只有 Taipei）

**DB / 資料收集**
- `data-collectors` 需要支援全台各縣市的 TDX API
- `bus_trails_daily` per-direction GROUP BY 對所有縣市一視同仁
- cron job 記得錯開分鐘（見 `data-collectors/docs/sql/cron_throttle.sql`）

### 6.3 效能考量

目前 Taipei 單城 5650 車輛、2293 路線在 M1 Mac 約 60fps。放大到全台：

| 項目 | 瓶頸 | 緩解 |
|------|------|------|
| 路線 JSON 解析 | 18MB × N 個城市 → 主執行緒 block | Web Worker 解析 / 分批 lazy load 只載當前縣市 |
| `mergedRoutes` Map size | 幾萬條路線 | 沒問題，Map 存指標 |
| `buildProgressPath` | snap 是 O(路線節點數) per 點 → 全台預估 hundreds of ms | 只在 ingestTrails 跑一次，非關鍵路徑 |
| `ensureProgressPaths` | 同上，但要跑 N 次（每城市 addCityRoutes 後一次） | 可限縮只處理該城市的 trail（加 `city` 過濾） |
| InstancedMesh count | 目前 max 5000 | 可能要升到 10000~20000 |
| Per-frame update | `updateReplay` 每輛車 binary search + interpolateOnLineString | 後者 O(路線節點數)；考慮快取 totalLength |

### 6.4 推薦擴展順序

1. **先以縣市為單位 lazy load**：使用者開啟某縣市才 fetch 對應 JSON
2. **觀察延遲**：若某縣市 routes 載入 > 2s 很常 race → 考慮 Worker parse
3. **調整 MAX_INSTANCES**：根據實際車輛數（可能 全台同時 30k+ 車）
4. **考慮區域 culling**：只算/畫螢幕範圍內車輛
5. **壓縮路線 JSON**：只保留 coords / cumDist / totalDist / stopProgress，不存冗餘的座標小數
6. **評估 `ensureProgressPaths` 的 cost**：若全台每城市都跑，考慮只對該城市的 trail 補建

### 6.5 需要改的檔案清單

| 擴充方向 | 檔案 |
|----------|------|
| 新增城市 enum | `src/types/index.ts` (`BusCity`) |
| 載入路線 | `src/data/busLoader.ts` (`loadBusRoutesForCity`) |
| 預處理腳本 | `scripts/preprocess/build_bus_routes.py`（需新建） |
| 前端城市切換 | `src/hooks/useBusLayer.ts`（cities prop）|
| UI 選擇 | `src/components/LayerSidebar.tsx` |
| DB migrations | `gis-platform/migrations/`（RPC 若要 filter city）|
| 資料收集 | `data-collectors/`（TDX 各縣市 key）|

## 7. 檔案導覽

| 檔案 | 行數 | 角色 |
|------|------|------|
| `src/engines/BusEngine.ts` | ~700 | 主邏輯（progressPath / fade / race fix） |
| `src/three/BusScene.ts` | ~300 | 渲染層（InstancedMesh + alpha shader） |
| `src/data/busLoader.ts` | ~160 | Supabase RPC 包裝 |
| `src/hooks/useBusLayer.ts` | ~205 | React hook (Live poll + Replay LRU) |
| `src/map/busCustomLayer.ts` | ~53 | Mapbox custom layer wrapper |
| `src/engines/railUtils.ts` | ~70 | `interpolateOnLineString` 共用工具 |
| `src/types/index.ts` | - | `BusVehicle` / `BusRouteGeometry` / `BusTrail` |

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
