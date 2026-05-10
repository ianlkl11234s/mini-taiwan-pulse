# 垃圾車表定動畫 — OSRM 沿路網整合 Plan (BL-17)

> 寫於 2026-05-10 晚 — Phase 3 prototype v1 視覺打磨用盡後的根治方案
> 詳細失敗嘗試紀錄見 [`waste-schedule-data-quirks.md`](./waste-schedule-data-quirks.md) §視覺打磨歷程

## 為什麼要做（前情摘要）

v1 用 stops 直線插值，60x 倍速下無解：
- **方向問題**：連續 stops Z 字形，每到 stop 「轉方向」感像跳
- **速度問題**：A12 max 859m / 90s = 60x 下 2016 km/h 視覺速度，1 視覺秒飛 1/3 螢幕

v1 試過所有可調 (fade window / threshold / dwell-move 重分配 / Catmull-Rom 平滑) 都不夠。**唯一根治 = OSRM 沿路網**。

## DB 既有資源（5/10 驗證）

| 城 | schedule routes | 有 LineString | 覆蓋率 |
|---|---|---|---|
| 高雄市 | 755 | 752 | **99.6%** |
| 新北市 | 649 | 649 | **100%** |
| 臺北市 | 188 | 0 | 0% |
| 基隆市 | 93 | 0 | 0% |
| 宜蘭縣 | 75 | 0 | 0% |

**共 1,401 routes 已有路徑可直接用，356 routes 要 OSRM 補**。

## 整合架構（仿 GPS layer matched trail）

GPS layer 早就解過「沿路網播」這問題，schedule 只要套同 pattern：

```
stops → 投影到 polyline → 算每 stop 的 progress (0-1)
       ↓
動畫：nowSec → progress timeline interp → polyline progress → lat/lng
```

每幀只要算 progress 在 polyline 上的位置（用 GPS scene 已有的 `interpolateOnLineString`），車自然沿馬路走。

---

## Phase 1: 用既有 LineString（高雄 + 新北 1,401 routes）

### 1a. 新 RPC `get_waste_schedule_day_with_geometry`

讓 schedule RPC 順便 JOIN `spatial.waste_collection_routes` 拿 polyline，避免兩次來回。

```sql
-- migrations/080_waste_schedule_with_geometry.sql
CREATE OR REPLACE FUNCTION public.get_waste_schedule_day(
    p_cities TEXT[] DEFAULT NULL,
    p_dow INT DEFAULT NULL
)
RETURNS TABLE (
    -- 既有欄位
    city TEXT, route_id TEXT, route_name TEXT, vehicle_type TEXT,
    stop_seq INT, stop_id INT, stop_name TEXT,
    lng DOUBLE PRECISION, lat DOUBLE PRECISION,
    arrival_sec INT, departure_sec INT,
    -- 新增：route polyline coords (JSONB array)
    route_coords JSONB
)
```

route_coords：每個 stop row 都帶同 route 的 polyline（重複 N 次但 JSONB ref 共用，傳輸不貴）。

**或者另一個設計**：分兩個 RPC（schedule + geometry），前端 join。但我傾向單一 RPC 省 round trip。

### 1b. Loader 投影 stops → progress

```ts
// src/data/wasteScheduleLoader.ts
function projectStopOnPolyline(stop: WasteScheduleStop, polyline: [lng, lat][]): number {
  // 找 polyline 上離 stop 最近的點
  // 返回 cumulative progress 0..1
}

// 處理流程：
// 1. fetchWasteScheduleDay 拿到 rows 後 group by route
// 2. 對每 route，stops 順序投影到 polyline
// 3. 結果存進 route.stops[i].progress (0-1)
```

新 type:
```ts
interface WasteScheduleStop {
  ...既有...
  /** Stop 在 route polyline 上的 progress (0-1)。沒 polyline 時 undefined */
  progress?: number;
}
interface WasteScheduleRoute {
  ...既有...
  /** Polyline coords (lng, lat)。沒 geometry 時空陣列 → fallback 直線 */
  polyline: [number, number][];
}
```

### 1c. Scene 改 progress-based interpolation

WasteScheduleScene 內：
- 用 `interpolateOnLineString(polyline, progress)` 算位置
- progress 來自 stops 的 progress + linear interp 兩 stops 之間
- Trip-break / dwell threshold 邏輯不變（仍判時間 gap）

```ts
function interpolateRoute(route: WasteScheduleRoute, nowSec: number): ScheduleFrame {
  if (route.polyline.length < 2) {
    // fallback v1 直線插值
    return interpolateRouteFallback(route.stops, nowSec);
  }
  // ... 找 segment idx ...
  const targetProgress = p0.progress + (p1.progress - p0.progress) * localT;
  const [lng, lat] = interpolateOnLineString(route.polyline, targetProgress);
  return { lat, lng, alpha, visible, waiting };
}
```

---

## Phase 2: OSRM 補北/基/宜（356 routes）

### 2a. 新表 + Build script

```sql
-- migrations/081_waste_routes_synthesized.sql
CREATE TABLE spatial.waste_routes_synthesized (
  city TEXT NOT NULL,
  route_id TEXT NOT NULL,
  geometry GEOMETRY(LineString, 4326) NOT NULL,
  built_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  osrm_failures INT NOT NULL DEFAULT 0,  -- 跨 stop 跑 OSRM 失敗的對數
  PRIMARY KEY (city, route_id)
);
```

Build script `data-collectors/scripts/build_waste_route_synthesized.py`：
1. 對每 (city, route_id) 撈 stops 按 arrival_sec 排序
2. 兩兩相鄰打 OSRM `/route` 拿 polyline
3. 串成一條 LineString 寫 DB

### 2b. OSRM 用既有 osrm-proxy

GPS map-matching 已有 osrm-taiwan + osrm-proxy 兩個 service（commit `1d2555a` 之前）。直接打：
```python
GET https://osrm-proxy/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
Authorization: Bearer ${OSRM_BEARER_TOKEN}
```

### 2c. 量化估算

- 356 routes × avg 30 stops = ~11K /route calls
- 5 calls/sec rate limit → 35 分鐘 build 時間
- 10 calls/sec → 18 分鐘
- 一次性 build 完進 DB，schedule RPC fallback 順序：waste_collection_routes → waste_routes_synthesized → 直線

### 2d. RPC fallback 邏輯

```sql
-- get_waste_schedule_day 內
LEFT JOIN spatial.waste_collection_routes r1 ON ...
LEFT JOIN spatial.waste_routes_synthesized r2 ON ...
COALESCE(r1.geometry, r2.geometry) AS route_geometry
```

---

## Phase 3: 視覺整合 + 驗收

- 所有 5 城走 polyline-based 動畫
- 既有 trip-break / dwell-threshold 保留
- LegendPanel 加說明：「沿馬路走（OSRM）」

---

## 工程量估算

| 工項 | 預估 | 備註 |
|---|---|---|
| 1a. RPC 加 geometry JOIN | 0.5 天 | migration + 測試 5 城 query |
| 1b. Loader 投影 + types | 0.5 天 | projectStopOnPolyline 算最近點 |
| 1c. Scene progress-based | 0.5 天 | 借用 GPS scene 的 interpolateOnLineString |
| 2a. 建表 + build script | 0.5 天 | python 寫 OSRM 串 polyline |
| 2b. 跑 build (~30 min) + RPC fallback JOIN | 0.25 天 | |
| 整合測試 + 視覺驗收 | 0.5-1 天 | 5 城都看一遍、調 fade / threshold |

**合計：2.5-3 天**

---

## 注意事項

### 1. Polyline 與 stops 不一致時的 fallback

DB 內 `waste_collection_routes` 的 LineString 是 hwms 來源，可能跟 stops 順序不一致（例如 polyline 是來回路線、stops 只記單向）。投影 stop → progress 時要用「最近點」而非「順序」。

### 2. 高雄重複 stop 問題

之前 RPC dedupe 處理過。投影時對重複 stop 仍會給同一個 progress（因為座標一樣），無問題。

### 3. 投影 corner case

某 stop 距離 polyline 太遠（> 100m），可能因為：
- Polyline 是不同班次（早班 / 晚班）的合併
- Stop 座標錯誤
判斷 distance > threshold 時，warn + 該 stop 仍用直線連接前後 stops（不投影到 polyline）。

### 4. 跨日支援

stops 的 arrival_sec 可能 > 86400（跨日 24:11）。Polyline 進度跟時間無關，只取決於 stop 座標投影，沒問題。

---

## 驗收條件

- 5 城 schedule layer 開啟後，車**明顯沿馬路走**（不再穿牆）
- A12 那種 859m 長距離 hop 變成「沿馬路走 1km+」（時間相同但軌跡可見）
- 不再有「方向突變」感（車轉彎在路口）
- Trip-break / 短 dwell 持續移動 / 長 dwell 真停 等既有規則 **不變**
- 北/基/宜 356 routes 的 OSRM 合成路徑覆蓋率 ≥ 95%（5% allow OSRM 失敗 fallback 直線）
