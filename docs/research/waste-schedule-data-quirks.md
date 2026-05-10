# 垃圾車表定動畫 — Source Data Quirks + 22 城擴展 Checklist

> 寫於 2026-05-10（Phase 3 prototype 完成 + 視覺打磨後）
> 用途：之後 hwms TGOS callback 跑完、擴展到 22 縣市時，必須先用本檔 checklist 驗源資料

## 為什麼要這份檔

5 城（高雄/新北/宜蘭/臺北/基隆）prototype 過程中踩到 **7 種 source data 異常**，每種都讓我們的 RPC / Scene 邏輯在某狀況下跑壞（瞬移 / 折返 / 閃現 / 不顯示）。

22 城 source 都是 hwms.moenv.gov.tw 一個來源，但每個縣市環保局的時刻表錄入格式可能不同 — **新城上線前先跑 sanity check，避免首次部署一堆視覺 bug**。

---

## 5 城已知 quirks 對照表（2026-05-10）

| 縣市 | `weekday_pattern` 格式 | `arrival_time` | `departure_time` | 同 stop 重複 | 時間倒退 | 大 gap (班次切換) | dwell=0 / gap=0 |
|---|---|---|---|---|---|---|---|
| **高雄市** | 中文「、」分隔（一、四） | HH:MM, 含 ≥24:00 跨日 | 多 = arrival | ✅ 完全重複 2 次 | ? | 1.2% | 大量 gap=0 |
| **新北市** | 中文「,」分隔（一,二,四,五,六） | HH:MM | **大多為空字串** → fallback = arrival | ? | ? | 4.4% (10min) / 12.7% (5min) | **大量 dwell=0**（過站不停感）|
| **臺北市** | **全為空字串** | HH:MM | HH:MM | ? | **22 筆「下一站 arrival 早於上一站 departure」** | 9.8% (10min) / 14.1% (5min) | **大量 gap=0** |
| **宜蘭縣** | 中文單字（一） | HH:MM | ? | ? | ? | ? | ? |
| **基隆市** | **數字 ISO 1-7** (1=Mon, 7=Sun) | HH:MM | ? | ? | ? | ? | ? |

---

## 已建立的 7 種防禦邏輯（必須在 22 城延續）

### A. `arrival_time` 跨日格式（高雄發現）

`24:11` 這種 ≥24:00 表跨日。PostgreSQL `::time` cast **不接受**，會跳 `date/time field value out of range`。

✅ 修法：`split_part` 手算秒，不要 cast TIME
```sql
split_part(arrival_time, ':', 1)::INT * 3600 + split_part(arrival_time, ':', 2)::INT * 60
```
位置：`gis-platform/migrations/079_waste_schedule_rpc.sql`

### B. `departure_time` 空字串（新北發現）

新北 source 大多 `departure_time = ''`（停站時間沒記錄）。

✅ 修法：fallback `departure_sec = arrival_sec`（停 0 秒）
```sql
CASE WHEN departure_time ~ '^[0-9]{1,2}:[0-9]{2}$'
     THEN parse_to_seconds(departure_time)
     ELSE parse_to_seconds(arrival_time)
END
```

### C. `weekday_pattern` 多種格式（5 城各異）

格式至少 4 種：
- 中文「、」分隔（高雄）
- 中文「,」分隔（新北）
- 中文單字（宜蘭）
- 數字 ISO「1,2,5」（基隆，1=Mon..7=Sun）
- 全空字串（臺北 — 視為每日跑）

✅ 修法：`regexp_split_to_array(weekday_pattern, '[,，、]')` 同時收三種分隔，過濾後比對中文 + 數字兩套 token。空字串 / `'0'` 視為每日。
```sql
CASE p_dow
    WHEN 0 THEN ARRAY['日', '7']
    WHEN 1 THEN ARRAY['一', '1']
    ...
END
```

### D. 同 stop 完全重複（高雄發現）

高雄一條 route 內每個 stop 在 source 重複 2 筆（同 vehicle_type + 同地址 + 同時間），佔 38%。

✅ 修法：RPC 內 `DISTINCT ON (city, route_id, arrival_sec, lng, lat)` dedupe。

### E. 時間倒退髒資料（臺北 22 筆）

部分 stops 序列「下一站 arrival 早於上一站 departure」→ 線性插值會強制視覺折返。

✅ 修法：Loader 端過濾非單調遞增 stops。
```ts
// src/data/wasteScheduleLoader.ts
let lastArrival = -Infinity;
for (const stop of route.stops) {
  if (stop.arrivalSec >= lastArrival) {
    cleaned.push(stop);
    lastArrival = Math.max(stop.arrivalSec, stop.departureSec);
  }
}
```

### F. 一條 route_id 多班次（臺北最嚴重）

一個 route_id 一天會跑「早班 + 中班 + 晚班」共 2-3 段，每段 4-10 stops，**中間 gap 1-2 小時**。直接全當連續 stops 線性插值會：
- 龜速直線飄 1.5h
- 班次間「飛越」街區（因為中班和晚班可能在不同片區）

範例：臺北「延平-2」(108-G01) 33 stops，stop 11→12 gap = **6300 秒 (1.75 hr)**

✅ 修法：Scene 端 trip-break detection。
```ts
const TRIP_BREAK_S = 600;  // 10 min
if (dt > TRIP_BREAK_S) {
  // fade out @ p0 (180s) → invisible → fade in @ p1 (180s)
}
```
位置：`src/three/WasteScheduleScene.ts`

### G. `departure = arrival` 或 `departure = next.arrival`（dwell=0 / gap=0）

兩種對稱缺漏：
- **gap=0 瞬移**（高雄 / 臺北常見）：stop A departure 19:45 = stop B arrival 19:45，沒記移動時間 → 瞬移到 B
- **dwell=0 過站不停**（新北常見）：stop A arrival = departure（fallback），車「經過站不停」感覺奇怪

✅ 修法：對每個 (p0, p1) **重新分配**時間，目標 dwell 至少 `MIN_DWELL_S`、movement 至少 `MIN_MOVE_S`，超過 total 時按比例壓縮。
```ts
const MIN_DWELL_S = 30;  // 60x 下 0.5 視覺秒「停站收集」
const MIN_MOVE_S  = 60;  // 60x 下 1 視覺秒「直線移動」
const total = p1.arrivalSec - p0.arrivalSec;
const rawDwell = Math.max(0, p0.departureSec - p0.arrivalSec);
const rawGap   = Math.max(0, p1.arrivalSec - p0.departureSec);
let targetDwell = Math.max(rawDwell, MIN_DWELL_S);
let targetMove  = Math.max(rawGap, MIN_MOVE_S);
if (total > 0 && targetDwell + targetMove > total) {
  const ratio = total / (targetDwell + targetMove);
  targetDwell *= ratio;
  targetMove  *= ratio;
}
```

實例：
- 高雄 dwell=5min, gap=0 → 重新分配 dwell=4m10s + move=50s
- 新北 dwell=0, gap=2min → 重新分配 dwell=24s + move=96s
- 60x 下兩種 case 都看得見「停站 + 移動」

---

## 22 城上線前 Sanity Check SQL（必跑）

### 1. weekday_pattern 格式分布

```sql
SELECT city, weekday_pattern, length(weekday_pattern) AS len, COUNT(*) AS n
FROM spatial.waste_collection_stops
WHERE city = '<新城市>'
GROUP BY city, weekday_pattern
ORDER BY n DESC LIMIT 30;
```

**判讀**：
- 看到中文「、」「，」「,」分隔 → 已支援
- 看到數字「,」分隔 → 已支援（基隆模式）
- 看到全空 → 已支援（視為每日跑，臺北模式）
- 看到 **英文「Mon,Tue」/ 全形數字「１，２」/ boolean「Y/N」/ 中文「週一」/「禮拜一」** → 必須擴展 RPC parser

### 2. arrival_time / departure_time 格式

```sql
-- 不合 HH:MM 格式的有多少
SELECT city, COUNT(*) FILTER (WHERE arrival_time !~ '^[0-9]{1,2}:[0-9]{2}$' AND arrival_time IS NOT NULL AND arrival_time != '') AS bad_arrival,
       COUNT(*) FILTER (WHERE departure_time !~ '^[0-9]{1,2}:[0-9]{2}$' AND departure_time IS NOT NULL AND departure_time != '') AS bad_departure,
       COUNT(*) AS total
FROM spatial.waste_collection_stops
WHERE city = '<新城市>'
GROUP BY city;

-- 看實際 sample
SELECT DISTINCT arrival_time
FROM spatial.waste_collection_stops
WHERE city = '<新城市>' AND arrival_time !~ '^[0-9]{1,2}:[0-9]{2}$'
LIMIT 20;
```

**判讀**：
- bad 比例 < 5% → 可接受（filter 掉）
- bad 比例 > 20% → 看實際格式，可能是「08時30分」「上午8:30」「8:30 PM」之類，**必須擴展 parser**

### 3. 同 stop 重複（同 route + arrival_sec + 座標）

```sql
WITH dup AS (
  SELECT route_id, arrival_time, ST_X(geometry) AS lng, ST_Y(geometry) AS lat,
         COUNT(*) AS dup_count
  FROM spatial.waste_collection_stops
  WHERE city = '<新城市>'
  GROUP BY route_id, arrival_time, ST_X(geometry), ST_Y(geometry)
  HAVING COUNT(*) > 1
)
SELECT MAX(dup_count) AS max_dup, COUNT(*) AS dup_groups, SUM(dup_count) AS total_dup_rows
FROM dup;
```

**判讀**：
- 0 → 該城沒重複問題（DISTINCT ON 仍應保留作防禦）
- 大量 → 該城跟高雄一樣，DISTINCT ON 已經處理

### 4. 時間倒退

```sql
-- 在 RPC 結果上跑（dow 任選）
WITH s AS (
  SELECT route_id, stop_seq, arrival_sec, departure_sec,
    LAG(departure_sec) OVER (PARTITION BY route_id ORDER BY stop_seq) AS prev_dep
  FROM public.get_waste_schedule_day(ARRAY['<新城市>'], 1)
)
SELECT COUNT(*) AS reverse_count
FROM s WHERE arrival_sec < prev_dep;
```

**判讀**：
- 0 → 該城沒倒退
- > 0 → Loader 端的 cleaning 邏輯會處理，但**確認沒有 > 5% 比例**（否則 source 嚴重髒）

### 5. 班次切換比例（trip-break）

```sql
WITH pairs AS (
  SELECT b.arrival_sec - a.departure_sec AS gap
  FROM public.get_waste_schedule_day(ARRAY['<新城市>'], 1) a
  JOIN public.get_waste_schedule_day(ARRAY['<新城市>'], 1) b
    ON a.route_id = b.route_id AND b.stop_seq = a.stop_seq + 1
)
SELECT COUNT(*) AS total,
  COUNT(*) FILTER (WHERE gap > 600) AS breaks_10min,
  ROUND(100.0 * COUNT(*) FILTER (WHERE gap > 600) / COUNT(*), 1) AS pct_10min
FROM pairs;
```

**判讀**：
- pct < 5% → 視覺正常（高雄、宜蘭、基隆程度）
- pct 5-15% → 仍可接受，trip-break fade 會處理（新北 4.4%、臺北 9.8%）
- pct > 20% → 該城源 route_id 切割粒度可能異常（一條路被合併太多班次），**先檢查是不是欄位定義問題**

### 6. gap=0（瞬移密度）

```sql
WITH pairs AS (
  SELECT b.arrival_sec - a.departure_sec AS gap
  FROM public.get_waste_schedule_day(ARRAY['<新城市>'], 1) a
  JOIN public.get_waste_schedule_day(ARRAY['<新城市>'], 1) b
    ON a.route_id = b.route_id AND b.stop_seq = a.stop_seq + 1
)
SELECT
  COUNT(*) FILTER (WHERE gap = 0) AS zero_gap,
  COUNT(*) FILTER (WHERE gap < 60) AS sub_60s,
  COUNT(*) AS total
FROM pairs;
```

**判讀**：
- zero_gap / total > 30% → MIN_MOVE_S borrowing 邏輯會頻繁觸發，正常
- 如 dwell 也大量 = 0（即 arrival = departure 自己）→ 沒得借，車仍會瞬移。可能要把 MIN_MOVE_S 改用「下一站 arrival 之前 60s」直接挪用班次起點時間

---

## 已知未解決 / Follow-up

| ID | 項目 | 預估 | 備註 |
|---|---|---|---|
| BL-17 | OSRM 沿路網（取代 stops 直線插值） | 2-3 天 | 高雄/新北已有 1399+649 LineString 可投影；北/基/宜需打 OSRM `/route` 補。視覺上的「穿牆」靠這個解 |
| BL-18 | 22 城上線前先跑本檔 6 個 sanity SQL | 0.5 天 | 加新城前必跑，發現新格式擴展 RPC |
| BL-19 | dwell = 0 且 gap = 0 的 corner case | 0.5 天 | 該 stop 沒得「借」時間，車仍瞬移。改 MIN_MOVE_S 邏輯挪用「下一站 arrival 前 60s」|

---

## 設計參數（給之後調整參考）

`src/three/WasteScheduleScene.ts`:

| 參數 | 值 | 視覺效果 (60x 倍速) | 拉高的影響 |
|---|---|---|---|
| `FADE_DURATION_S` | 180 | 3 秒 fade | 4-5 秒更柔和但 trip-break 中間 invisible 縮短 |
| `TRIP_BREAK_S` | 600 | 10min 才算切換 | 拉高 → 更多 gap 視為班次內 slow movement |
| `MIN_DWELL_S` | 30 | 0.5 秒可見停站 | 拉高 → 停站更明顯但占用移動時間 |
| `MIN_MOVE_S` | 60 | 1 秒可見移動 | 拉高 → 移動更明顯但占用停站時間 |
| `ACTIVE_ALPHA` | 1.0 | 執勤中一致亮 | 不要再加切換 alpha |

`gis-platform/migrations/079_waste_schedule_rpc.sql` 的 dedupe + 跨日 + weekday 邏輯不要動，後加 city 都仰賴它。
