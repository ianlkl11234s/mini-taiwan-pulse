# 垃圾車 OSRM Map-matching 設計文件（Phase 3）

> 狀態：**程式碼骨架已完成，待部署 / 回填 / 視覺驗證**（2026-05-07）
> 前提：Phase 1+2 已完成（migration 071 + Catmull-Rom + stop snapping）
> 目標：把垃圾車 GPS 軌跡精確 snap 到實際馬路網，徹底解決「視覺穿牆」感
> 多城市可復用：本設計從第一行就支援 cities []

## 1. 動機與成本

### 為什麼還要做 Phase 3
| 現況（Phase 1+2 已解決） | Phase 3 才能解決 |
|---|---|
| GPS 漂移（stop snapping） | 兩 stop 間 200~500m 的「直線」非真實馬路 |
| 飛越路口（速度過濾） | 路口轉彎弧度 |
| 跨 trip 飛行（trip 切分） | 視覺上「車是貼著路在走」的真實感 |

### 工程成本
- OSRM 服務部署 + 維運（約 0.5~1 天）
- Taiwan OSM 預處理（一次性 30 min CPU）
- Batch matching script + cron（半天）
- 新表 + RPC + 前端對接（半天）
- **總計：1.5~2 工作天**

### 替代方案比較
- ✅ **OSRM**（推薦）：成熟、開源、HMM 演算法、文件齊全、Docker 一鍵部署
- ❌ Valhalla：API 類似但部署複雜
- ❌ GraphHopper：商用授權麻煩
- ❌ Mapbox Map Matching API：要錢、有 quota

## 2. 系統架構

```
┌─────────────────────┐       ┌──────────────────────┐
│ collectors/waste_*  │ 寫    │ spatial.waste_       │
│ 每 2 分鐘 GPS       │──────▶│   positions_realtime │
└─────────────────────┘       └──────────┬───────────┘
                                         │ 7 天 retention
                                         │ (migration 070)
                                         ▼
                              ┌──────────────────────┐
                              │ pg_cron 每 5 分鐘    │
                              │ snap_recent_trails() │
                              └──────────┬───────────┘
                                         │ 對未 match 的 GPS 序列
                                         │ POST /match
                                         ▼
                              ┌──────────────────────┐
                              │  OSRM HTTP Service   │
                              │  (Docker, port 5000) │
                              │  Taiwan OSM PBF      │
                              └──────────┬───────────┘
                                         │ 回 matched polyline
                                         ▼
                              ┌──────────────────────┐
                              │ realtime.waste_      │
                              │ trails_matched_daily │
                              │ (daily matched trips)│
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ get_waste_trails_v2  │ ◀── 前端切到 v2
                              │ 直接回 polyline +    │
                              │ progress 序列        │
                              └──────────────────────┘
```

## 3. 部署 OSRM（Docker）

```bash
# 1. 下載 Taiwan OSM (約 200MB)
mkdir -p ~/osrm-data && cd ~/osrm-data
wget https://download.geofabrik.de/asia/taiwan-latest.osm.pbf

# 2. 預處理（一次性，~30 min on M1）
docker run -t -v $PWD:/data ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/taiwan-latest.osm.pbf
docker run -t -v $PWD:/data ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/taiwan-latest.osrm
docker run -t -v $PWD:/data ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/taiwan-latest.osrm

# 3. 啟動 routing service（背景）
docker run -d --name osrm-taiwan -p 5000:5000 -v $PWD:/data \
  --restart unless-stopped \
  ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/taiwan-latest.osrm

# 4. 健康檢查
curl 'http://localhost:5000/route/v1/driving/120.3,22.6;120.31,22.61?overview=false'
```

**部署位置選擇**：
- 本機 dev：用 Docker Desktop（測試用）
- 雲端：Zeabur/GCP/AWS deploy（production）— 約 1GB RAM、512MB disk

## 4. Map-matching API 用法

```bash
# Match endpoint：餵 GPS 序列，回沿馬路 polyline
curl 'http://localhost:5000/match/v1/driving/120.3,22.6;120.31,22.61;120.32,22.62?\
  geometries=geojson&overview=full&radiuses=50;50;50&\
  timestamps=1778100000;1778100120;1778100240'
```

關鍵參數：
- `radiuses`：每點允許的搜尋半徑（米），垃圾車設 50m
- `timestamps`：每點 unix 秒，HMM 用時間判斷合理性
- `overview=full`：回傳完整 polyline（不簡化）
- `gaps=split`：時間 gap 大時自動切 trip

## 5. Schema：realtime.waste_trails_matched_daily

```sql
CREATE TABLE realtime.waste_trails_matched_daily (
    day             DATE NOT NULL,
    city            TEXT NOT NULL,
    vehicle_no      TEXT NOT NULL,
    route_id        TEXT,
    trip_id         INTEGER NOT NULL,
    segment_seq     INTEGER NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ NOT NULL,
    geometry        GEOMETRY(LINESTRING, 4326) NOT NULL,
    timeline        TEXT NOT NULL,
    point_count     INTEGER NOT NULL,
    confidence      REAL,
    matched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day, city, vehicle_no, trip_id, segment_seq)
);
```

決策：matched trail 是動態時序 pre-aggregate，依專案規則放 `realtime.*`；
前端只打 `public.get_waste_trails_matched_day()`，不直接碰 `realtime` schema。

## 6. Batch Matching Script

放在 `data-collectors/collectors/waste_match.py`：

```python
"""
垃圾車 trail map-matching to road network (via OSRM)

每 5 分鐘跑一次，找未 match 的 trip：
1. SQL: 從 waste_positions_realtime 拉「未在 waste_trails_matched 的 trip」
2. 對每車按 trip_id 分組
3. POST /match 給 OSRM，拿 matched polyline + 每 GPS 點的 progress
4. INSERT 進 waste_trails_matched
"""
import os
import requests
from datetime import datetime, timedelta, timezone

OSRM_URL = os.environ.get("OSRM_URL", "http://localhost:5000")
TIMEOUT_S = 30
BATCH_SINCE_MIN = 60   # 每次跑找近 60 分鐘的未 match trip

def find_unmatched_trips(conn, cities):
    """
    用窗口函數重建 trip_id（同 071 RPC 邏輯：>10min gap = 新 trip）
    然後 EXCEPT 已在 waste_trails_matched 的 (vehicle_no, trip_id, started_at)
    """
    # ... CTE: 重建 trip 切分
    # ... LEFT JOIN matched, WHERE matched IS NULL
    # 回 [(vehicle_no, city, trip_id, [(t, lat, lng), ...])]

def call_osrm_match(coords, timestamps):
    """coords: [(lng, lat), ...], timestamps: [epoch_s, ...]"""
    coords_str = ";".join(f"{lng},{lat}" for lng, lat in coords)
    ts_str = ";".join(str(t) for t in timestamps)
    radii_str = ";".join("50" for _ in coords)  # 垃圾車 50m radius
    url = f"{OSRM_URL}/match/v1/driving/{coords_str}"
    params = {
        "geometries": "geojson",
        "overview": "full",
        "radiuses": radii_str,
        "timestamps": ts_str,
        "annotations": "true",
        "gaps": "split",
    }
    r = requests.get(url, params=params, timeout=TIMEOUT_S)
    r.raise_for_status()
    return r.json()

def insert_matched(conn, vehicle_no, city, trip_id, osrm_response, original_points):
    """寫入 waste_trails_matched，含每 GPS 點的 progress on matched polyline"""
    # 從 osrm_response['tracepoints'] 拿每點對應的 polyline 位置
    # 算 progress = cumulative_distance / total_distance
    # ... INSERT

def main():
    cities = ["高雄市", "臺南市", "新北市"]  # 多城市可復用
    with psycopg2.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        unmatched = find_unmatched_trips(conn, cities)
        for vehicle_no, city, trip_id, points in unmatched:
            if len(points) < 2:
                continue
            try:
                osrm = call_osrm_match(
                    [(p[2], p[1]) for p in points],
                    [int(p[0].timestamp()) for p in points],
                )
                if osrm.get("code") == "Ok":
                    insert_matched(conn, vehicle_no, city, trip_id, osrm, points)
            except Exception as e:
                print(f"[match-fail] {vehicle_no}/{trip_id}: {e}")
```

## 7. RPC v2：get_waste_trails_v2

```sql
CREATE OR REPLACE FUNCTION public.get_waste_trails_v2(
    p_cities TEXT[],
    p_since_minutes INT DEFAULT 60
)
RETURNS TABLE (
    vehicle_no TEXT,
    city TEXT,
    trip_id INT,
    -- polyline coords：[[lng,lat], ...]（前端 progress 用）
    polyline JSONB,
    timeline TEXT,        -- "epoch,progress;..."
    point_count INT,
    confidence REAL
)
LANGUAGE sql STABLE AS $$
  SELECT
    vehicle_no,
    city,
    trip_id,
    -- LineString → JSONB array
    (SELECT jsonb_agg(jsonb_build_array(ST_X(pt), ST_Y(pt)))
     FROM ST_DumpPoints(geometry) AS dp,
          LATERAL (SELECT (dp.geom)::geometry AS pt) g),
    timeline,
    point_count,
    confidence
  FROM spatial.waste_trails_matched
  WHERE city = ANY(p_cities)
    AND started_at > NOW() - (p_since_minutes || ' minutes')::INTERVAL
  ORDER BY vehicle_no, trip_id;
$$;
```

## 8. 前端對接（最小改動）

`wasteLoader.ts`：
- 新增 `fetchWasteTrailsMatched`（v2，回 polyline + progress timeline）
- 新增 type `WasteMatchedTrip`

`useWasteLayer.ts`：
- env flag 切換 v1 / v2：`VITE_WASTE_MATCHED=1` 用 v2
- v2 模式 trailsRef 改存 matched trips

`WasteTruckScene.ts`：
- v2 模式用 progress-based 插值（公車那套 `interpolateOnLineString`）
- 直接複用 `src/engines/railUtils.ts` 的 `interpolateOnLineString(coords, progress)`
- 視覺上垃圾車就會「沿馬路走」，跟公車相同質感

## 9. Cron 排程（pg_cron + 容器）

```sql
-- batch matching：每 5 分鐘
SELECT cron.schedule(
  'waste-match-recent',
  '*/5 * * * *',
  $$SELECT net.http_post('http://internal-job:8080/run-waste-match'::TEXT)$$
);
```

但 pg_cron 不能直接跑 Python，需要：
- 選項 A：放到 data-collectors 的 systemd timer（推薦，跟其他 collectors 同一個機器）
- 選項 B：Zeabur cron job 服務

## 10. Retention（同 070）

```sql
-- 7 天清理
SELECT cron.schedule(
  'waste-matched-cleanup-daily',
  '15 4 * * *',
  $$DELETE FROM spatial.waste_trails_matched
    WHERE started_at < NOW() - INTERVAL '7 days';$$
);
```

## 11. 風險與緩解

| 風險 | 緩解 |
|---|---|
| OSRM service down 整個 layer 退化 | Fallback 到 v1（現在的 RPC），env flag 切換 |
| 垃圾車走小巷弄 OSM 沒收錄 | confidence 太低 (<0.5) 跳過該 trip，留 v1 結果 |
| Match latency 高 | batch（5 分鐘一次）非即時，前端不阻塞 |
| 高雄路網更新滯後 | Geofabrik 月更，每月 cron 自動下載新 PBF + 重新 partition |
| 多縣市資料量爆 | per-city batch + per-city retention，scale linearly |

## 12. 執行 Checklist（從 0 到 production）

- [ ] 部署 OSRM Docker container（本機 or 雲端）
- [ ] 下載 + 預處理 Taiwan OSM PBF
- [x] 寫 migration 074 建 `realtime.waste_trails_matched_daily` 表
- [x] 寫 `data-collectors/collectors/waste_match.py`（含 OSRM 呼叫 + 批次寫入）
- [ ] systemd timer 或 Zeabur cron 排程（每 5 分鐘）
- [x] 寫 `get_waste_trails_matched_day` RPC
- [x] 前端加 `VITE_WASTE_MATCHED_TRAILS` env flag + matched day loader
- [x] WasteTruckScene 加 matched progress-based 模式（複用 `railUtils.interpolateOnLineString`）
- [ ] 跑 migration 074 進 Supabase
- [ ] 啟用 `WASTE_MATCH_ENABLED=true` 並 backfill today/yesterday
- [ ] 跑 7 天驗證（confidence 分布、錯配率、視覺差異）
- [ ] LegendPanel 加「沿路網」說明
- [ ] retention cron + 月度 PBF 更新 cron

## 13. 多城市復用 checklist

每接一個新城市需要：
- [ ] data-collectors 的 collector 加該城市 endpoint
- [ ] `get_waste_current` / `get_waste_trails` 自動支援（cities 參數）
- [ ] OSRM 已有 Taiwan PBF 全島覆蓋，無需額外處理
- [ ] 前端 useWasteLayer 加新 city 到 cities 陣列即可

## 參考

- OSRM 官方文件：https://project-osrm.org/docs/v5.24.0/api/
- Map matching 演算法（HMM）：[Newson & Krumm 2009](https://www.microsoft.com/en-us/research/publication/hidden-markov-map-matching-noise-sparseness/)
- Geofabrik Taiwan：https://download.geofabrik.de/asia/taiwan.html
