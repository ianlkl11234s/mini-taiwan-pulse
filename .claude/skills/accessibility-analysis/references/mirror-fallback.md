# Overpass Mirror 救援表

> SKILL §5 的展開。Mirror 全卡時按此優先順序試。

## 路徑優先順序

### 5.1 預設 mirror retry — `overpass-api.de`

```python
# 不設 OVERPASS_URL 環境變數即可（osmnx 預設）
ox.settings.requests_timeout = 600
ox.settings.use_cache = True
```

**通常 cooldown 24-72h 後自然解除**。亞洲時段晚上 21:00 後跑命中率高。

### 5.2 切其他 mirror

```bash
# kumi
export OVERPASS_URL="https://overpass.kumi.systems/api"
# osm.fr（whitelist only，403 多）
export OVERPASS_URL="https://overpass.openstreetmap.fr/api"
```

**注意**：`OVERPASS_URL` 是 osmnx 的 base URL（不含 `/interpreter`），osmnx 內部會拼。

### 5.3 本機 PBF + osmium 預過濾（推薦正解）

```bash
# 1. 裝 osmium-tool（一次性）
brew install osmium-tool

# 2. 抓 Geofabrik PBF（一次性，月更）
wget -O taiwan-latest.osm.pbf https://download.geofabrik.de/asia/taiwan-latest.osm.pbf

# 3. 過濾留 motorway-unclassified（避開 residential 量大）
osmium tags-filter \
  taiwan-latest.osm.pbf \
  w/highway=motorway,trunk,primary,secondary,tertiary,unclassified,motorway_link,trunk_link,primary_link,secondary_link,tertiary_link \
  -o taiwan-roads-filtered.osm.pbf
# → 約 309 MB 過濾後 60-80 MB

# 4. 改 pipeline 用 pyrosm 讀
```

```python
# pipeline 改
from pyrosm import OSM
osm = OSM("data/raw/osm/taiwan-roads-filtered.osm.pbf")
nodes_gdf, edges_gdf = osm.get_network(network_type="driving", nodes=True)
G = osm.to_graph(nodes_gdf, edges_gdf, graph_type="networkx", retain_all=False)
# 之後跟 osmnx 路線相同（KDTree nearest_nodes + multi_source_dijkstra）
```

**注意**：過濾後 RAM 用量 ~10 GB（vs 不過濾 ~50 GB）。仍需磁碟 ≥ 20 GB free。

### 5.4 既有 osrm-taiwan zeabur service（雲端，不吃本機 RAM）

```python
# 設定（雲林 POC 用過）
OSRM_BASE = "https://osrm-proxy-gis.zeabur.app"
OSRM_TOKEN = os.environ["OSRM_TOKEN"]   # 在 taipei-gis-analytics/.env

# Grid sample 法（不是 multi-source dijkstra）
def osrm_table_reachable(src, dests):
    """1 source × N dests → 回 dests 中 distance<=30000m 的點"""
    coord = f"{src[0]},{src[1]};" + ";".join(f"{x[0]},{x[1]}" for x in dests)
    url = f"{OSRM_BASE}/table/v1/driving/{coord}?sources=0&annotations=distance"
    r = requests.get(url, headers={"Authorization": f"Bearer {OSRM_TOKEN}"}, timeout=60)
    dists = r.json()["distances"][0]
    return [dests[i-1] for i in range(1, len(dists)) if dists[i] is not None and dists[i] <= 30000]

# 對每站算 grid → concave_hull → polygon
# 5,000 站 × ~5 batch call = 25,000 call @ ~10 req/s = 40 min
```

**注意**：osrm-proxy 對 destinations 參數有 nginx escape bug（雲林 POC 學到）— 只能用 `sources=0`，destinations 全給。詳見 `yunlin_nearest_distance.py:60-75`。

### 5.5 PostGIS pgr_drivingDistance（長期正解）

```sql
-- gis-platform 灌 OSM 進 PostgreSQL（一次性投入）
CREATE EXTENSION pgrouting;

-- osm2pgrouting / osm2pgsql 灌 ways 表
-- 然後 RPC
CREATE OR REPLACE FUNCTION coverage.nearest_dist_to_pois(...)
RETURNS TABLE(edge_id bigint, dist_m numeric, band text) AS $$
  SELECT ...
  FROM pgr_drivingDistance(
    'SELECT id, source, target, length AS cost FROM osm_ways',
    (SELECT array_agg(nearest_vertex_id) FROM ...pois...),
    30000,
    directed := false
  )
  ...
$$ LANGUAGE sql STABLE;
```

**最穩** — 但工程量大（osm2pgrouting 需要 24 GB+ RAM 跑、Supabase 不一定支援 pgrouting extension）。**只有跑頻繁時值得**。

---

## Mirror 健康度測試（跑前先測）

```bash
# 用 curl 5 秒內回 = 健康
for mirror in \
  "https://overpass-api.de/api/interpreter" \
  "https://overpass.kumi.systems/api/interpreter" \
  "https://overpass.openstreetmap.fr/api/interpreter" \
; do
  echo "=== $mirror ==="
  curl -sS --max-time 5 -X POST "$mirror" --data-urlencode "data=[out:json];node(25.03,121.5,25.04,121.51);out 1;" \
    2>&1 | head -c 100
  echo
done
```

回 `{"version":0.6,...}` = OK，回 `<html>` 或 timeout = down。

---

## 決策樹

```
mirror 健康度測試 → 有任何一個回 200?
├─ 是 → 用那個 mirror 跑 (5.1 / 5.2)
└─ 否
    ├─ 本機磁碟 ≥ 50 GB free?
    │   ├─ 是 → 走 5.3 本機 PBF + osmium
    │   └─ 否 → 走 5.4 osrm zeabur
    └─ 預算允許 PostGIS 灌資料? → 走 5.5 長期正解
```
