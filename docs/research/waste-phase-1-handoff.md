# Phase 1 + 3 Handoff — Track B（mini-taiwan-pulse 端）

> 寫於 2026-05-10（5/10 晚再更新：day_001+002 TGOS 結果到、5 城 stops 完整、Phase 3 prototype 提前）
> 對象：下個 session
> 預估：2-3 週、4 個 sub-task（Phase 3 prototype + Track B）

---

## Two Tracks 並行

```
Track A：TGOS 流程              ← user 端 / taipei-gis-analytics
   ├─ ✅ day_001+002 上傳完成（result/v2 已有結果）
   ├─ ⏳ user 持續上傳 day_003-007
   ├─ 🔴 寫 12_unified_callback.py（含 TWD97 → WGS84 transform）
   └─ 🔴 callback 跑完灌 DB（22 縣市 stops 從 77K → 385K）

Track B：mini-taiwan-pulse      ← 新 session 工作
   ├─ 1. Phase 3 prototype（時刻表動畫，5 城既有資料）  ← 先做
   ├─ 2. 接台中 GPS collector
   ├─ 3. 新北 OSRM 接 map-matching
   └─ 4. 5/9-5/10 OSRM 收尾（BL-9 / BL-14）
```

---

## Session 起手三步

```
1. 讀本檔
2. 讀 .claude/memory/STATUS.md（5/10 結束點）
3. 讀 docs/research/waste-multi-city-progress.md（22 縣市現況 + 5 城時刻表 ready）
```

---

## Track B 主目標

```
2-3 週內：
  Week 1: Phase 3 prototype（5 城時刻表動畫看得到）
  Week 2: 接台中 GPS + BL-9/14 收尾
  Week 3: 等 Track A callback 完 → Phase 2 OSRM 擴展（22 城都跑得起）
```

---

## Sub-task 1 — Phase 3 prototype 時刻表動畫（1 週）

### 為什麼可以先做

DB 內 **5 城共 77K stops 100% 完整**（5/10 驗證）：

| 縣市 | stops | 時刻表 | 星期 | route LineString |
|---|---|---|---|---|
| 高雄 | 32,422 | ✅ | ✅ | ✅ 1,399 條 |
| 新北 | 26,672 | ✅ | ✅ | ✅ 649 條 |
| 宜蘭 | 12,071 | ✅ | ✅ | ❌ |
| 台北 | 4,048 | ✅ | ✅ | ❌ |
| 基隆 | 1,912 | ✅ | ✅ | ❌ |

不必等 TGOS callback。

### 實作步驟

**Step 1：建 RPC 撈時刻表資料（0.5 天）**

```sql
-- gis-platform/migrations/0XX_waste_schedule_rpc.sql
CREATE OR REPLACE FUNCTION public.get_waste_schedule_day(
  p_cities TEXT[],
  p_dow INT  -- 0=Sunday, 1=Mon, ..., 6=Sat
)
RETURNS TABLE (
  city TEXT, route_id TEXT, stop_seq INT,
  stop_name TEXT, lng FLOAT, lat FLOAT,
  arrival_time TIME, departure_time TIME,
  weekday_pattern TEXT
)
AS $$
  SELECT s.city, s.route_id, ROW_NUMBER() OVER (PARTITION BY s.city, s.route_id ORDER BY s.arrival_time)::INT,
    s.name, ST_X(s.geometry), ST_Y(s.geometry),
    s.arrival_time, s.departure_time, s.weekday_pattern
  FROM spatial.waste_collection_stops s
  WHERE s.city = ANY(p_cities)
    AND CASE p_dow
      WHEN 0 THEN weekday_pattern LIKE '%Sun%'
      WHEN 1 THEN weekday_pattern LIKE '%Mon%'
      ...
    END
  ORDER BY s.city, s.route_id, s.arrival_time;
$$ LANGUAGE sql STABLE;
```

(weekday_pattern 實際格式要先 SELECT DISTINCT 看一下、可能是 boolean flag 不是 LIKE 字串)

**Step 2：寫 loader + hook（0.5 天）**

```typescript
// src/data/wasteScheduleLoader.ts
export async function fetchWasteSchedule(cities: string[], dow: number)

// src/hooks/useWasteScheduleLayer.ts
// 仿 useWasteLayer.ts、但用 schedule 不用 GPS trail
```

**Step 3：3D scene 動畫（2-3 天）**

```typescript
// src/three/WasteScheduleScene.ts（仿 WasteTruckScene）
// 對每條 route：
//   1. 拿到該 route 所有 stops（含 arrival_time / departure_time）
//   2. 高雄 / 新北：用 route LineString 當路徑
//   3. 台北 / 基隆 / 宜蘭：用 OSRM /route 從 stop A → B 預算
//   4. 按 timeline 推進、車按表跑
```

**Step 4：前端整合 + 視覺驗證（1-2 天）**

- 加進 LayerSidebar / IconRailSidebar 一個 toggle「垃圾車表定」（跟「垃圾車 GPS」獨立）
- LegendPanel 加說明
- App.tsx 接 useWasteScheduleLayer
- 跨日 timeline 推進測試

### 驗收條件

- 5 城都能切到看見「車按時刻表跑」動畫
- 高雄 / 新北跟既有 GPS 軌跡能疊加（看誤差雛形）
- 跨日 timeline 推進不破

### Design 決策（先決定再動）

```
A. 視覺呈現
   選 1：「車到 X 站」靜態 marker（簡單）
   選 2：動畫車按表跑（捷運式，更酷）  ← 建議
   選 3：路線整段 pulse（有運氣）

B. 時間驅動
   選 1：跟 timeline 連動（跟既有架構一致）  ← 建議
   選 2：跟 wall clock 連動

C. GPS 城處理
   選 1：表定 + GPS 兩條疊加，顏色區分     ← 建議
   選 2：GPS 完全取代表定
```

---

## Sub-task 2 — 接台中 GPS collector（0.5-1 天）

### Endpoint（5/10 16:14 實打 200 OK / 1300+ vehicles）

```
URL: https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc
採樣: 每 10 min
Token: 無
備援 (CSV 版): https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=f6dda80e-7380-4223-9bda-97d82a541ad9
```

### 測試指令（先確認 endpoint 還活著）

```bash
curl -sS -m 30 -A "Mozilla/5.0 (compatible; TaipeiGISBot/1.0)" \
  "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), d[0])"
```

### Response 範例

```json
[{"lineid":"24908","car":"KED-1385","time":"20260510T160411",
  "location":"龍井區清潔隊回收廠","X":"120.540557","Y":"24.192597",
  "SpeedValue":"0","OverSpeed":"N"}, ...]
```

### vs 高雄/台南 SOA 三個差異

```
1. 欄位名稱不同：lineid（多 e）、X/Y 大寫
2. 無 SOA wrapper：直接是 array、不是 {success, data: [...]}
3. Time format：'%Y%m%dT%H%M%S'（緊湊式）
```

### 實作步驟（`data-collectors/collectors/waste_positions.py`）

```python
# 1. ENDPOINTS['Taichung'] = '...'
# 2. CITY_NAMES['Taichung'] = '臺中市'
# 3. TIME_FORMATS 加 '%Y%m%dT%H%M%S'（放最前面）
# 4. 寫 _normalize_taichung（不要直接 reuse _normalize_soa）
#    - 不檢查 success wrapper
#    - 欄位 case map: lineid → linid / X→x / Y→y
# 5. 寫 _fetch_taichung
# 6. FETCHERS['Taichung'] = '_fetch_taichung'
```

### 部署驗證

```sql
SELECT city, COUNT(*) AS rows, COUNT(DISTINCT vehicle_no) AS vehicles, MAX(observed_at) AS latest
FROM spatial.waste_positions_realtime
WHERE city = '臺中市' AND observed_at > NOW() - INTERVAL '1 hour'
GROUP BY city;
-- 期望：> 100 vehicles，最近 < 15 分鐘
```

---

## Sub-task 3 — 新北 OSRM 接 map-matching（0.5 天）

```bash
# 1. CLI 加新北
npx zeabur@latest variable update --id 6940282e03ed383c19b036f5 \
  -k "WASTE_MATCH_CITIES=高雄市,臺南市,新北市" -y -i=false

# 2. 改 README trigger redeploy
cd ~/.../data-collectors
echo "# YYYY-MM-DD: extend WASTE_MATCH_CITIES to 新北市" >> README.md
git -c commit.gpgsign=false commit -am "chore: extend OSRM map-matching to NewTaipei"
git push origin main

# 3. 等 deploy + 一輪、查 attempt 表
psql "$SUPABASE_DB_URL" -c "SELECT day, city, COUNT(*) AS attempts, SUM((success)::int) AS success, ROUND(100.0*SUM((success)::int)::numeric/COUNT(*), 1) AS pct FROM realtime.waste_match_attempts WHERE day >= CURRENT_DATE - 1 GROUP BY day, city ORDER BY day DESC, city;"
```

預期：新北採樣 2 min 跟高雄一樣 → success rate ~50-60%。

---

## Sub-task 4 — BL-9 / BL-14 收尾（0.5 天）

### BL-9：5/9-5/10 高雄 + 台南 OSRM 觀察 3 天

連 3 天 query 一次（5/10 / 5/11 / 5/12 早上各跑），結果穩定後 BACKLOG BL-9 標 done、寫 retro。

### BL-14：高雄 5/9 落差查證

```sql
-- 對比 5/8 同時段 13:00-18:00 高雄 success rate
WITH s AS (
  SELECT day, success,
    a.created_at::time AS attempt_time
  FROM realtime.waste_match_attempts a
  WHERE city='高雄市' AND day IN (CURRENT_DATE - 1, CURRENT_DATE - 2)
)
SELECT day,
  COUNT(*) FILTER (WHERE attempt_time BETWEEN '13:00' AND '18:00') AS attempts_pm,
  SUM(success::int) FILTER (WHERE attempt_time BETWEEN '13:00' AND '18:00') AS success_pm,
  ROUND(100.0 * SUM(success::int) FILTER (WHERE attempt_time BETWEEN '13:00' AND '18:00')::numeric
        / NULLIF(COUNT(*) FILTER (WHERE attempt_time BETWEEN '13:00' AND '18:00'), 0), 1) AS pct
FROM s GROUP BY day ORDER BY day;
```

判讀：兩天同時段 rate 差不多 → daily variance / 差很大 → trip-gap 副作用 → per-city dict。

---

## 已知坑（5/9-5/10 累積，新 session 必看）

| 坑 | 觸發 | 正確做法 |
|---|---|---|
| Zeabur empty commit 不 trigger redeploy | 改 env var 想觸發 redeploy | 改檔（README 加一行）+ push |
| Cobra CLI `${}` 雷 | 設跨 service env var ref | 用 dashboard 設、不用 CLI |
| Cobra CSV 逗號值 OK | 設 `WASTE_MATCH_CITIES=A,B,C` | 純逗號值可走 CLI（5/10 驗證）|
| psycopg2 `%` placeholder | SQL 註解寫 `1%` `8%` | escape `%%` 或改 `pct` 字 |
| OSRM HMM 拒收同時間戳點 | DB row 重複寫 | SQL `DISTINCT ON` 或 ETL UNIQUE |
| trip-gap 600s 對台南太緊 | 5 min 採樣 + 短停 | 改 900s（已部署）|
| 跨 Zeabur project 內網不通 | gomn ↔ ship-only | 走 osrm-proxy public + Bearer |
| TGOS 結果是 TWD97 不是 WGS84 | callback 拿到結果 | pyproj `EPSG:3826` → `4326` 轉 |

---

## Phase 1 + 3 Track B 結束時要產出

### Code

- `gis-platform/migrations/0XX_waste_schedule_rpc.sql`（時刻表 RPC）
- `mini-taiwan-pulse/src/data/wasteScheduleLoader.ts`
- `mini-taiwan-pulse/src/hooks/useWasteScheduleLayer.ts`
- `mini-taiwan-pulse/src/three/WasteScheduleScene.ts`
- `data-collectors/collectors/waste_positions.py` 加台中 fetch / normalize
- `WASTE_MATCH_CITIES` env var 加新北

### Data

- DB 內 spatial.waste_positions_realtime 加 city='臺中市' GPS（採樣 10 min）
- realtime.waste_match_attempts 加新北 attempts

### Docs

- 更新 STATUS / progress.md 收尾
- 寫 retro

---

## 起手第一個 5 分鐘的具體動作

```bash
# 1. 看 5 城 stops 完整度確認 ready
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse
set -a; source .env; set +a
psql "$SUPABASE_DB_URL" -c "SELECT city, COUNT(*) AS stops, COUNT(*) FILTER (WHERE arrival_time IS NOT NULL) AS has_time FROM spatial.waste_collection_stops GROUP BY city ORDER BY stops DESC;"

# 2. 看 weekday_pattern 實際格式
psql "$SUPABASE_DB_URL" -c "SELECT DISTINCT weekday_pattern FROM spatial.waste_collection_stops WHERE city='高雄市' LIMIT 10;"

# 3. 確認台中 endpoint 還活著
curl -sS -m 30 -A "Mozilla/5.0 (compatible; TaipeiGISBot/1.0)" \
  "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), d[0])"
```

跑完前 3 個指令就有 context 動手。

---

## Q & A

**Q: Phase 3 prototype 為何能 5 城先做？**
A: 5 城 77K stops 已 100% 完整（時刻表 + 星期 + 路線都齊）。等 TGOS callback 是為了補完剩 17 城，但 5 城已經夠 demo 視覺。

**Q: 表定動畫跟 GPS 動畫怎麼疊加？**
A: 兩個獨立 toggle，可同時開。表定車用一個顏色（建議淡），GPS 車用另一個（亮琥珀）。視覺差距就是「表定 vs 實際誤差」。

**Q: TGOS day_003-007 還沒上傳，會卡住嗎？**
A: **不會**。Phase 3 prototype 用 5 城既有資料、跟 TGOS 並行不卡。等 callback 跑完再擴展到 22 城。

**Q: 中途暫停可以嗎？**
A: 可以。Sub-task 1（Phase 3 prototype）內部 4 個 step 都可暫停。完成 step 1+2（RPC + loader）就有可動的雛形。
