# Geocoding Pipeline — 地址 → 點位方法論

> 為 Mini Taiwan Pulse 廢棄物清運 stops 補座標而設計，但抽象成可重用方法論。
> 任何「只有地址要找點位」的需求都套同樣 pipeline。

**狀態**：2026-05-12 起草。Stage 1-3 已實施，Stage 4-6 待做。
**主要約束**：**不打 Google Maps API**（成本考量）。

---

## 1. 背景

`spatial.waste_collection_stops` 共 308,129 hwms stops，其中 **91,361 (30%) 沒對到座標**。

### 91K miss 分類（2026-05-12 統計）

| 類別 | 數量 | 地址形式 | 解法 |
|---|---:|---|---|
| normal | 54,361 | 完整門牌 | Round 4 TGOS normalize |
| intersection | 12,145 | 「○○路與○○巷口」 | 前後 stop 內插 |
| landmark | 10,726 | 「○○國小」「○○公園」 | POI match |
| duplicate_city | 8,817 | 「嘉義市嘉義市環保局XX」 | Round 4 TGOS normalize |
| no_number | 6,829 | 「○○路一段」 | 前後 stop 內插 |
| offshore | 1,618 | 金門 / 連江 | 前後 stop 內插 |
| empty/noise | 66 | 雜訊 | 放棄 |

---

## 2. 核心設計：6 階段 Pipeline

```
原始 hwms address (308K stops)
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 1: TGOS Round 1-3 ✅ done                         │ → 補 102K
│   address as-is → TGOS batch → coord                    │
│   每天上限 10K，需手動上傳                              │
├─────────────────────────────────────────────────────────┤
│ Stage 2: pre_geocoded city match ✅ done                │ → 補 89K
│   hwms 跟既有 5 城同 stop_name 重複 → 抄座標            │
│   限同 city 才用（cross-city normalize 是 false match）│
├─────────────────────────────────────────────────────────┤
│ Stage 3: TGOS Round 4 normalize ⏳ in progress          │ → 預計 8-12K
│   18K normalized addresses 已產出 (day_008 + day_009)   │
│   剝「XX市XX市環保局」重複前綴 + 雜訊符號               │
│   等用戶手動上 TGOS                                     │
├─────────────────────────────────────────────────────────┤
│ Stage 4: POI fuzzy match 🆕 待做                        │ → 預計 6-10K
│   landmark 解法：                                       │
│   - 4a 學校：taiwan_schools_2024.geojson 4,315 所       │
│     fuzzy match (剝「國小/國中」字尾 + city 同)         │
│   - 4b POI：reference.foursquare_poi 420K               │
│     category filter (廟/公園/市場/車站/郵局)            │
│   - 4c Nominatim POI fallback (僅 landmark)             │
│     成功：「彰化縣花壇國小」→ 24.0264, 120.5438         │
├─────────────────────────────────────────────────────────┤
│ Stage 5: ❌ 取消（Nominatim 對台灣門牌無效）            │
│   實測 2026-05-12：                                     │
│   - 路口「○○巷與○○路口」: 0 hit                       │
│   - 離島「金門縣金沙鎮環島東路1段112號」: 0 hit         │
│   - 一般門牌「彰化縣彰化市三民路129號」: 0 hit          │
│   原因：OSM Taiwan 門牌資料不完整                       │
│   結論：intersection / offshore / no_number 都退 Stage 6│
├─────────────────────────────────────────────────────────┤
│ Stage 6: Route-context Interpolation 🆕 待做（主力）    │ → 預計 15-25K
│   對 route 內仍 miss 的 stop，用 seq 排序找前後最近    │
│   有座標的 stop，線性內插                               │
│                                                         │
│   stop[i-2].coord = A (known)                          │
│   stop[i-1].coord = ? (miss, no_number)                │
│   stop[i  ].coord = ? (miss, intersection)             │
│   stop[i+1].coord = B (known)                          │
│                                                         │
│   → 內插 stop[i-1] = A + 1/3 (B-A)                     │
│   → 內插 stop[i  ] = A + 2/3 (B-A)                     │
│                                                         │
│   標記 geocoded_via = 'interpolated_route'              │
│   標記 interp_confidence = (B-A 距離越短越高)           │
├─────────────────────────────────────────────────────────┤
│ Stage 7: Manual Curation (剩餘無解 ~5-10K)              │ → 人工
│   完全孤立 stop / 整條 route 只有 1 stop / 雜訊地址     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 已完成成果

| Stage | 動作 | 補進 |
|---|---|---:|
| 1 | TGOS Round 1-3（v1+v2 共 65K addresses）| 102,945 stops |
| 2 | pre_geocoded city match | 89,364 stops |
| **小計** | | **192,309 stops** |
| 既有座標 | hwms_pending 既有（早期 callback）| 24,459 stops |
| **目前狀態** | | **216,768 / 308,129 = 70%** |

剩 91,361 (30%) 待 Stage 3-6 處理。

---

## 4. 工具盤點

### 內建資料（不用 API）

| 資料 | 量 | 用途 |
|---|---:|---|
| `taiwan_schools_2024.geojson` | 4,315 | Stage 4a 學校 fuzzy match |
| `reference.foursquare_poi` | 420,399 | Stage 4b POI category filter |
| `reference.poi` | 42,915 | Stage 4b 備用 |
| `spatial.waste_collection_stops` | 216K with coord | Stage 6 前後內插的「known stops」 |

### 外部 API（免費）

| API | 限制 | 用途 |
|---|---|---|
| **OSM Nominatim** | 1 req/sec, 必帶 User-Agent | Stage 4c landmark POI fallback |
| **TGOS batch** | 10K/day, 手動上傳 | Stage 3 normalize 重送 |

### 明確排除

| API | 原因 |
|---|---|
| ❌ Google Maps Geocoding | 付費 ($5/1000 calls)、用戶要求不打 |

---

## 5. Stage 4 詳細執行計畫（POI fuzzy match）

### 5.1 學校 match 策略

地址 `extract_school_name(addr)` 規則：

```python
SCHOOL_EXTRACT_PAT = re.compile(r"([一-龥]{2,8}(?:國小|國中|高中|高工|高商|大學|職校|附小|附中))")
```

抓到例：
- 「彰化縣花壇鄉花壇國小南面門口」 → 「花壇國小」
- 「中華大學門口」 → 「中華大學」

**Fuzzy match 算法**：
```python
def fuzzy_match_school(name: str, city: str, schools_idx: dict) -> tuple | None:
    """schools_idx: {(city, school_name): coord}"""
    # 1. 精確 match: (city, name)
    if (city, name) in schools_idx:
        return schools_idx[(city, name)]
    # 2. 剝字尾 fuzzy: 「花壇國小」→「花壇」startswith
    stem = re.sub(r"(國小|國中|高中|高工|高商|大學|職校|附小|附中)$", "", name)
    if not stem: return None
    candidates = [
        (k, v) for k, v in schools_idx.items()
        if k[0] == city and k[1].startswith(stem)
    ]
    if len(candidates) == 1:
        return candidates[0][1]
    # 3. 多 candidate 取最短 name（最相近）
    if candidates:
        candidates.sort(key=lambda x: len(x[0][1]))
        return candidates[0][1]
    return None
```

### 5.2 Foursquare POI category match

```python
LANDMARK_KEYWORDS = {
    "公園": ["park"],
    "廟":   ["religious_site", "temple"],
    "市場": ["market"],
    "車站": ["train_station", "metro_station", "bus_station"],
    "郵局": ["post_office"],
}

def fuzzy_match_poi(addr: str, city: str, conn) -> tuple | None:
    """從 addr 抽出 landmark 名 → SQL ILIKE foursquare_poi.name"""
    # 例：「彰化縣彰化市◎ 景觀公園-」
    for keyword, fsq_cats in LANDMARK_KEYWORDS.items():
        if keyword not in addr: continue
        # 抽 「彰化市◎ 景觀公園」中的「景觀公園」
        m = re.search(rf"([一-龥]{{2,10}}{keyword})", addr)
        if not m: continue
        landmark_name = m.group(1).lstrip("◎ ")
        # SQL ILIKE city + name
        cur = conn.cursor()
        cur.execute("""
            SELECT ST_X(geom), ST_Y(geom), name
            FROM reference.foursquare_poi
            WHERE city = %s AND name ILIKE %s
            ORDER BY date_refreshed DESC NULLS LAST
            LIMIT 1
        """, (city, f"%{landmark_name}%"))
        row = cur.fetchone()
        if row: return (row[0], row[1], "poi_foursquare", row[2])
    return None
```

### 5.3 Nominatim fallback（中斷可續跑）

```python
import requests, time, json
from pathlib import Path

CACHE_PATH = Path("data/intermediate/geocoding/nominatim_cache.jsonl")
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "iChef-GIS-geocoder/1.0 (ianlk11234s@gmail.com)"

def nominatim_geocode(query: str, session: requests.Session, cache: dict) -> tuple | None:
    """rate-limited, cache 過的 query 直接讀，未過的打 API + 寫 cache"""
    if query in cache:
        return cache[query]
    resp = session.get(NOMINATIM_URL, params={
        "q": query, "format": "json", "limit": 1,
        "countrycodes": "tw"
    }, headers={"User-Agent": USER_AGENT}, timeout=15)
    resp.raise_for_status()
    results = resp.json()
    result = None
    if results:
        result = (float(results[0]["lon"]), float(results[0]["lat"]))
    cache[query] = result
    # append-write JSONL（中斷不會丟）
    with open(CACHE_PATH, "a") as f:
        f.write(json.dumps({"q": query, "result": result}) + "\n")
    time.sleep(1.1)  # rate limit 1/sec + buffer
    return result
```

**中斷續跑**：每筆寫進 `nominatim_cache.jsonl`，下次啟動 load 全部 cache，已查過的跳過。

**時間估算**：
- 10,726 landmark miss × 1.1 sec/call ≈ 3.3 hr（最差情況，全部 fallback）
- 但 4a + 4b 已 match 約 70%，實際 ~3K 進 4c → 1 hr

---

## 6. Stage 6 詳細執行計畫（Route-context Interpolation）

### 6.1 演算法

```sql
-- 對每 route，按 seq 排序，找出 missing stops 的前後 known stops
WITH ordered AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY city, route_id ORDER BY seq, id) AS pos
  FROM spatial.waste_collection_stops
),
known AS (
  SELECT city, route_id, pos, seq, geometry
  FROM ordered WHERE geometry IS NOT NULL
),
missing AS (
  SELECT *
  FROM ordered WHERE geometry IS NULL
),
neighbors AS (
  SELECT
    m.id AS miss_id,
    m.city, m.route_id, m.pos AS miss_pos,
    -- 前一個 known
    (SELECT pos FROM known k WHERE k.route_id = m.route_id AND k.pos < m.pos ORDER BY k.pos DESC LIMIT 1) AS prev_pos,
    (SELECT geometry FROM known k WHERE k.route_id = m.route_id AND k.pos < m.pos ORDER BY k.pos DESC LIMIT 1) AS prev_geom,
    -- 後一個 known
    (SELECT pos FROM known k WHERE k.route_id = m.route_id AND k.pos > m.pos ORDER BY k.pos ASC LIMIT 1) AS next_pos,
    (SELECT geometry FROM known k WHERE k.route_id = m.route_id AND k.pos > m.pos ORDER BY k.pos ASC LIMIT 1) AS next_geom
  FROM missing m
)
SELECT
  miss_id, city, route_id,
  -- 線性內插（pos 距離權重）
  ST_LineInterpolatePoint(
    ST_MakeLine(prev_geom, next_geom),
    (miss_pos - prev_pos)::float / (next_pos - prev_pos)
  ) AS interp_geom,
  -- confidence
  CASE
    WHEN ST_Distance(prev_geom::geography, next_geom::geography) < 500 THEN 0.9
    WHEN ST_Distance(prev_geom::geography, next_geom::geography) < 2000 THEN 0.7
    WHEN ST_Distance(prev_geom::geography, next_geom::geography) < 5000 THEN 0.5
    ELSE 0.3
  END AS interp_confidence
FROM neighbors
WHERE prev_geom IS NOT NULL AND next_geom IS NOT NULL;
```

### 6.2 過濾規則

只 apply interpolation 於：
- `prev_geom AND next_geom IS NOT NULL`（兩端都有 known）
- `ST_Distance(prev, next) < 5km`（前後太遠不可靠）
- 內插段距離 < 1km（避免遠端推估錯誤）

剩餘 case（route 開頭/結尾連續多 miss、整條 route 只 1 known）→ Stage 7 manual。

---

## 7. 完成後整合 + 達成率計算

### 7.1 統一 `geocoded_via` 標籤

```
tgos_batch          ← Stage 1-3 (官方 TGOS)
pre_geocoded        ← Stage 2 (同 city 既有)
poi_school          ← Stage 4a 學校
poi_foursquare      ← Stage 4b Foursquare
poi_nominatim       ← Stage 4c OSM Nominatim
interpolated_route  ← Stage 6 前後內插
manual              ← Stage 7
```

### 7.2 達成率報表

```sql
SELECT
  COUNT(*) AS total,
  COUNT(geometry) AS with_coord,
  ROUND(100.0 * COUNT(geometry) / COUNT(*), 1) AS coverage_pct,
  COUNT(*) FILTER (WHERE geocoded_via = 'tgos_batch') AS via_tgos,
  COUNT(*) FILTER (WHERE geocoded_via LIKE 'poi_%') AS via_poi,
  COUNT(*) FILTER (WHERE geocoded_via = 'interpolated_route') AS via_interp,
  COUNT(*) FILTER (WHERE geometry IS NULL) AS still_missing
FROM spatial.waste_collection_stops;
```

**Target**：coverage_pct 從現在 **70%** 提到 **≥ 90%**（補 ~60K stops）。

---

## 8. 不做的事 / 已知限制

| 不做 | 原因 |
|---|---|
| Google Maps Geocoding API | 用戶明示不打 |
| 自建 OSM Taiwan road network 跑 ST_Intersection | 工程過大（>3 天）、收益不確定。Nominatim POI 已可解 landmark |
| 對 intersection / no_number 強行用 Nominatim | 實測 0 hit |
| Reusable lib 整合 | 用戶現階段只要 ad-hoc，文件留給 Agent 之後照做 |

**已知無解（即使做完 Stage 4-6）**：
- 完全孤立 stop（route 只 1 stop、其他全 miss）
- 雜訊地址（empty / 純符號 / 亂碼）
- 部分 offshore（金門連江內島地址）— route 內無相鄰 known stop

預估剩餘 ~5,000-10,000 stops 真正無解。

---

## 9. 未來重用流程（給 Agent 看）

任何「只有地址要找點位」需求都套這個 pipeline：

```
1. 把 addresses 丟進 Stage 1 (TGOS batch) — 10K/day 上限
2. miss 的進 Stage 4 (POI fuzzy match) — 視 landmark 比例決定
3. miss 的進 Stage 6 (前後內插) — 適合 sequential 資料 (route, timeline)
4. miss 的進 Stage 7 (manual)

Stage 5 (Nominatim 非 POI 查詢) 證實對台灣資料無效，跳過。
```

對於非 route-sequential 資料（如獨立地址清單），Stage 6 不適用，改為：
- 同 city 同路名取「平均座標」
- 或退回 Stage 7 manual

---

## 10. 實施階段（時間表）

| 階段 | 工程 | 預計補 stops | 狀態 |
|---|---|---:|---|
| Stage 3 Round 4 TGOS | 0（等用戶上傳）| 8-12K | day_008/009 已產出 |
| Stage 4a 學校 fuzzy match | 半天 | 1-2K | 待做 |
| Stage 4b Foursquare POI | 半天 | 2-3K | 待做 |
| Stage 4c Nominatim POI fallback | 1-2 hr 執行 + 半天 dev | 1-2K | 待做 |
| Stage 6 Route interpolation | 1 天 | 15-25K | 待做 |
| Stage 7 整合 + 達成率報表 | 半天 | - | 待做 |

**合計 3 天工程 + Round 4 等待**。

---

## 11. 相關 commit / 檔案

- Migration `084_waste_route_inferred_segments.sql` — OSRM segment（BL-22）
- Script `compute_waste_inferred_segments.py` — OSRM batch
- Script `31_normalize_pending_to_v2.py` — Round 4 normalize 拆 batch
- BACKLOG: `BL-23` (Round 4 流程)

文件接續：當實作 Stage 4-6 時，更新本檔 + commit。
