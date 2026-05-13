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

- [x] 部署 OSRM Docker container（Zeabur，2026-05-08）
- [x] 下載 + 預處理 Taiwan OSM PBF（內建在 Dockerfile multi-stage build）
- [x] 寫 migration 074 建 `realtime.waste_trails_matched_daily` 表
- [x] 寫 `data-collectors/collectors/waste_match.py`（含 OSRM 呼叫 + 批次寫入）
- [x] 寫 `get_waste_trails_matched_day` RPC
- [x] 前端加 `VITE_WASTE_MATCHED_TRAILS` env flag + matched day loader
- [x] WasteTruckScene 加 matched progress-based 模式（複用 `railUtils.interpolateOnLineString`）
- [x] 跑 migration 074 進 Supabase（2026-05-08，cron job id=53）
- [ ] **將 waste_match collector 部署到實際跑垃圾車的 collector 專案（見 §14）**
- [ ] 啟用 `WASTE_MATCH_ENABLED=true` 並 backfill today/yesterday
- [ ] 跑 7 天驗證（confidence 分布、錯配率、視覺差異）
- [ ] LegendPanel 加「沿路網」說明
- [ ] 月度 PBF 更新 cron（Zeabur GitHub auto-redeploy 已能處理，只要 push commit 即可）

## 14. 2026-05-08 / 05-09 部署實戰紀錄

### 最終架構（跨 project + Bearer token gateway）

```
gis-data-collectors                 osrm-proxy                osrm-taiwan
(ship-only project,                 (gomn project,             (gomn project,
 IP 通政府 API)        ─https+token─▶ nginx 8080,    ─internal─▶ osrm-routed
 service-id:                          Bearer auth)              8080, MLD)
   6940282e03ed383c19b036f5          69fe18685aa21e4719e6a9c9  69fe0ec75aa21e4719e6a80c
                                      osrm-proxy-gis.zeabur.app
```

切兩個 project 的原因：
- 政府 API（高雄/台南 GPS、ship_ais）擋 AWS Lightsail / 雲端 IP，但 ship-only project 上的 collector IP 通
- Akamai dedicated server (agent_test, gomn project) 跑 OSRM 沒問題但 IP 被擋政府 API
- → collector 必須留在 ship-only project，OSRM 留 gomn project，跨 project 用 Bearer token gateway 串

### 已完成（兩 session 累積）

**OSRM service**：
- repo: `github.com/ianlkl11234s/osrm-taiwan`（private）
- 本機: `GIS/osrm-taiwan/`
- Dockerfile 三階段：alpine 抓 Geofabrik PBF → osrm-backend extract/partition/customize → 啟動 osrm-routed
- Zeabur project: `data-collectors-gomn`、service id `69fe0ec75aa21e4719e6a80c`
- Tokyo dedicated server `agent_test` (4 核 8 GB) - Akamai/Linode
- Build ~6 分鐘（cache hit 後，多階段只重 layer 2）
- Image 549 MB，runtime RAM ~1 GB
- **listening on 8080**（與 Zeabur PREBUILT_V2 K8s service port 對齊，不是預設 OSRM 5000）
- 內網 hostname：`osrm-taiwan.zeabur.internal:8080`（無 public domain）

**OSRM proxy（Bearer token gateway）**：
- repo: `github.com/ianlkl11234s/osrm-proxy`（private）
- 本機: `GIS/osrm-proxy/`
- nginx:1.25-alpine + envsubst template，listen 8080，proxy_pass 到 osrm-taiwan internal
- Zeabur project: `data-collectors-gomn`，service id `69fe18685aa21e4719e6a9c9`
- Public domain: `https://osrm-proxy-gis.zeabur.app`
- Image ~50 MB，build < 1 分鐘
- Bearer token 驗證 `/health` 之外的所有路徑
- env vars:
  ```
  OSRM_TOKEN=58e6bb61a676dfc6bb24847467f5f28cbbdbab46ef0546c8a2489feb0dfec784
  OSRM_UPSTREAM=osrm-taiwan.zeabur.internal:8080
  ```

**Supabase**：
- migration 074 已套用（table + 3 indexes + cleanup function + RPC + 04:18 daily cleanup cron）
- 用 `psql` 直接灌（idempotent），cron job id=53

**Collector（ship-only project）env vars**：
```
OSRM_URL=https://osrm-proxy-gis.zeabur.app
OSRM_TOKEN=58e6bb61a676dfc6bb24847467f5f28cbbdbab46ef0546c8a2489feb0dfec784
WASTE_MATCH_ENABLED=true
WASTE_MATCH_INTERVAL=5
WASTE_MATCH_TARGET_DAYS=7    # 涵蓋 GPS 7 天 retention，自動 backfill
```

**data-collectors push 紀錄**（5/9 凌晨）：
- `ab60c5d feat(waste_match): 新增垃圾車 OSRM map-matching collector`（5 檔，含 waste_match.py 532 行 + Authorization header）
- `e26436c docs(README): note OSRM map-matching pipeline activation date`（trivial change 觸發 redeploy 帶入 TARGET_DAYS=7）

**驗證證據**（5/9 凌晨 01:30 台灣時間）：
- pipeline 端到端 curl 通：external → osrm-proxy → osrm-taiwan → 真實台北路徑回應
- waste_match collector 啟動正常，第一輪找到 today 2 + yesterday 80 unmatched trips
- DB 寫入：`realtime.waste_trails_matched_daily` 5/8 有 58 rows / 38 vehicles / avg confidence 0.730

### 已踩過的坑（給未來 session 參考）

1. **OSRM image 是 distroless**：沒 apt-get / wget。要在外面用 alpine COPY PBF 進來
2. **Zeabur PREBUILT_V2 K8s service 預設 port 8080**（不看 EXPOSE / PORT env var）：
   - osrm-taiwan 原本 listen 5000 → 內網 connection refused
   - 修法：`osrm-routed --port 8080` + EXPOSE 8080
3. **Cobra CSV parser 不能可靠處理含 `${}` 的 env value**：用 hard-coded service ID 形式取代 `${OSRM_TAIWAN_HOST}`
4. **Empty git commit Zeabur 不會 trigger redeploy**：要實質檔案變動才會 webhook 觸發
5. **Zeabur restart API 偶爾 transient 503**：用 `git push` trivial commit 替代
6. **跨 Zeabur project 內網 hostname 不通**：跨 project 必須走 public domain + auth gateway
7. **AWS Lightsail / GCP / Azure 等公雲 IP 多會被台灣政府 API 擋**：垃圾車 GPS、ship_ais 等收集必須用「IP 通的 collector instance」（這次是 ship-only project 的那台）

### 早上接回來看什麼（5/9 早上）

```sql
-- 看 backfill 7 天歷史是否完整覆蓋
SELECT day, COUNT(*) AS rows, COUNT(DISTINCT vehicle_no) AS vehicles,
       ROUND(AVG(confidence)::numeric, 3) AS avg_conf,
       MIN(matched_at) AS first, MAX(matched_at) AS last
FROM realtime.waste_trails_matched_daily
GROUP BY day ORDER BY day DESC;

-- 期望：5/3 ~ 5/9 共 7 天都有 rows
-- 早上垃圾車活動高峰，5/9 rows 應該大幅成長
```

```bash
# 看 collector log 確認 waste_match 持續運作
npx zeabur@latest deployment log --service-id 6940282e03ed383c19b036f5 -t runtime -i=false 2>&1 | grep -iE "waste_match|matched" | tail -20
```

前端視覺驗證：
- `npm run dev` 開 localhost:3721
- 強制重整、toggle 垃圾車 layer
- 拉 timeline 到 5/8 或 5/9 早上，看垃圾車是不是沿馬路走（不再穿牆）
- 環境變數 `VITE_WASTE_MATCHED_TRAILS=1`（預設）優先讀 matched，沒有的話 fallback v1 GPS trail

### 還沒做的事（早上接手）

- [x] 確認 backfill 完整（5/4-5/9 都有 matched rows）
- [x] 早上垃圾車活動高峰時看 collector log 是否健康
- [ ] 前端視覺驗證沿路網效果
- [ ] LegendPanel 加「沿路網」說明
- [ ] 月度 PBF 更新自動化（GitHub Actions cron 每月 1 號 push 觸發 redeploy）
- [ ] 評估是否刪除 `data-collectors-ship-only-aws` project（Lightsail Tokyo 機器，IP 被擋沒用）— 月費 $X 可省
- [ ] 評估是否關掉 osrm-taiwan service 的 ARC（如果 OSRM 流量穩定可考慮 scale-to-zero，但要確認 cold start 時間）
- [ ] 跑 7 天驗證 confidence 分布、錯配率

### 補充：5/9 上午 attempt marker 機制根本修

啟用後（commit `0fe4a21`）發現 collector 卡在「retry 死循環」：原本只用 NOT EXISTS in
`matched_daily` 篩 unmatched，但 OSRM NoMatch / low-confidence 的 trip 不寫入該表 →
下輪又被當 unmatched → 永遠 retry，scheduler 連續 skip 警告。

**根本修**（migration 075 + waste_match.py）：
- 新增 `realtime.waste_match_attempts (day, city, vehicle_no, trip_id, success, reason)`
- waste_match.py 每 trip OSRM 嘗試後寫 marker（不論成功 / 失敗）
- `_find_unmatched_trips` SQL 加 `NOT EXISTS in waste_match_attempts`
- 月度 PBF 更新若想 force re-match：`TRUNCATE realtime.waste_match_attempts;`

**Drain 結果**（暫時 `WASTE_MATCH_MAX_TRIPS=500` 一次清完，事後改回 80）：
- 3,280 trip attempted：1,510 success（46%）/ 1,770 fail（54%）
- fail trip 特徵：parked 比例 37%（success 19%）、平均點數少 30%、收運中比例低
- 結論：fail 是「資料本質難 map-match」（停運點靜止居多），不是系統 bug
- 前端 fallback：fail 的車仍走 v1 GPS 直線，**沒有任何車消失**

DB 最終資料（5/9 上午 10:35）：
| day | matched_rows | vehicles | avg_conf |
|---|---|---|---|
| 5/4 | 392 | 235 | 0.735 |
| 5/5 | 528 | 274 | 0.769 |
| 5/6 |  76 |  46 | 0.743（GPS 量本身少）|
| 5/7 | 490 | 260 | 0.741 |
| 5/8 | 503 | 266 | 0.745 |
| 5/9 |  20 |  20 | 0.799（早高峰起步）|

## 15. 擴展其他縣市

當高雄 production 視覺穩定 1 週後考慮擴展。優先序：

| 縣市 | GPS 資料品質 | 預期 success rate | 工程成本 |
|---|---|---|---|
| 台南 | 20,627 GPS / 24h、183 車 | 應接近高雄（資料密度類似）| 改 1 個 env var：`WASTE_MATCH_CITIES=高雄市,臺南市` |
| 新北 | 凍結式更新（每日整批）| 較低，trip 邊界不清 | 同上 + 可能要調 trip-gap 閾值 |
| 台北 | 純靜態路線、無 GPS | 不適用 | 無 |

### 接新縣市的 checklist

- [ ] data-collectors 的 `WASTE_POSITIONS_CITIES` env 加新城市
- [ ] 確認 `spatial.waste_positions_realtime` 有寫入新城市資料（city 欄位用中文全名「臺南市」/「新北市」）
- [ ] data-collectors 的 `WASTE_MATCH_CITIES` env 加新城市
- [ ] 等 collector 1-2 輪後看 `realtime.waste_match_attempts` 該城市 success rate
- [ ] 若 < 30% success rate → 該城市資料本身有問題，往上游查（GPS 採樣間隔、status 欄位是否都填、trip 切分閾值是否合適）
- [ ] 前端 `useWasteLayer.ts` 加新 city 到 cities 陣列
- [ ] `LayerSidebar` 加切換 UI（仿 BusGroup 模式）

### 預期挑戰

1. **新北凍結式**：GPS 不是即時 push，是每日整批，trip 切分（10 min gap）對它不適用 → 可能整天的點會被 cut 成超多短 trip → 全部 fail map-match。要不要為新北關 `WASTE_MATCH`？或調整 trip-gap = 60 min？需要實測資料樣本決定。
2. **多城市並發**：若 5 城同開，OSRM 每輪要處理 3-5 倍 trip → 評估 4 核機器是否扛得住
3. **不同城市 confidence 分布**：可能某些城市 GPS 品質差導致 confidence 普遍 < 0.35 → 要不要 per-city threshold？

### 往「stop-to-stop OSRM /route」演化（長期）

現有 HMM /match 對「停運點靜止居多」的 trip 處理不好（54% fail）。長期可改架構：
- 從 GPS + stop snapping 還原該車當天的 stop sequence
- 對相鄰兩 stop 呼叫 OSRM `/route` 拿真實道路最短路徑
- 拼接多 leg 成完整 route polyline

優點：對 GPS 雜訊免疫、不需要 HMM、success rate 預期 > 90%。
前提：要先解決 `waste_collection_stops` 沒 stop_sequence 欄位的問題（用 arrival_time 推或從 GPS 反推）。
工程成本：1-2 天，等高雄穩定 + 多城市需求穩定後再評估。

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
