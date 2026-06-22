#!/usr/bin/env python3
"""
{POI 名} 最近站路網距離 pipeline (Mode A) — accessibility-analysis SKILL 範本.

USAGE (copy 此檔到 taipei-gis-analytics/scripts/road_isochrone/ 改下列項):
  1. SQL：改成你的 POI table / RPC
  2. PRIVATE_NAME_RE / buckets_of()：改你的品牌 / 分類邏輯
  3. OUT_DIR：改 topic 名
  4. tippecanoe `--layer` 名：要對齊 PMTiles 命名契約 coverage_{bucket}

每 commit 一個新 POI 時必開:
  ☐ §1 決定 Mode A/B/C
  ☐ §6 改 SQL + bucket
  ☐ §7 命名契約對齊
  ☐ §8 frontend 11 處 SOP
"""
import os, sys, json, time, subprocess, re
from collections import defaultdict
from pathlib import Path
import osmnx as ox
import networkx as nx
from pyproj import Transformer

# ── settings ─────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("[ERR] need DATABASE_URL env", file=sys.stderr); sys.exit(1)

# Overpass mirror — 環境變數覆寫，預設 overpass-api.de
if os.environ.get("OVERPASS_URL"):
    ox.settings.overpass_url = os.environ["OVERPASS_URL"]
ox.settings.requests_timeout = 600
ox.settings.use_cache = True

# 主島 bbox
TW_MAIN_BBOX = (120.00, 21.85, 122.05, 25.35)

# OSM highway filter — 預設 motorway-tertiary（量級可控 ~75K edges）
# 若要加密改為 +unclassified（深山 + 鎮內次要街道，量級 ~150K edges 但 Overpass 卡風險高）
CUSTOM_FILTER = '["highway"~"motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link"]'

# 5 級色階對應的距離 band (m)
DIST_BANDS = [
    (5000,  "0-5km"),
    (10000, "5-10km"),
    (20000, "10-20km"),
    (30000, "20-30km"),
]
OVER_BAND = "over-30km"

# 輸出位置
TOPIC = "gas"   # ★ 改：gas / ev / fire / medical / police / school / ...
SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = SCRIPT_DIR / ".." / ".." / "data" / "processed" / "road_isochrone" / f"taiwan_{TOPIC}_nearest"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── 1. 抓 OSM 路網 + 投影 ─────────────────────────────
print(f"[1/5] osmnx 抓主島路網 bbox={TW_MAIN_BBOX} ...")
t0 = time.time()
G = ox.graph_from_bbox(bbox=TW_MAIN_BBOX, custom_filter=CUSTOM_FILTER, simplify=True)
print(f"     {G.number_of_nodes()} nodes / {G.number_of_edges()} edges ({time.time()-t0:.0f}s)")
G = ox.project_graph(G, to_crs="EPSG:3826")  # TWD97 m

# ── 2. 拉 POI stations ───────────────────────────────
# ★ 改 SQL：你的 POI 來源（含 name / brand / lng / lat）
def psql_json(sql):
    out = subprocess.run(
        ["psql", DATABASE_URL, "-A", "-t", "-c", f"SELECT json_agg(row_to_json(t)) FROM ({sql}) t"],
        capture_output=True, text=True, check=True
    ).stdout.strip()
    return json.loads(out) if out and out != "" else []

print(f"[2/5] 拉 POI ...")
poi = psql_json("""
SELECT id, name, brand,
  ST_X(geom) AS lng, ST_Y(geom) AS lat
FROM energy.gas_stations
""")
# 過濾主島
def in_main(r):
    return TW_MAIN_BBOX[0] <= r["lng"] <= TW_MAIN_BBOX[2] and TW_MAIN_BBOX[1] <= r["lat"] <= TW_MAIN_BBOX[3]
poi = [r for r in poi if in_main(r)]

# ★ Whitelist regex — 篩掉 41455 false positive（依 POI 類型調整）
PRIVATE_NAME_RE = re.compile(r"山隆|速邁樂|台亞|西歐|統一精工|Smile|7-?Eleven|加油站|加油")

# ★ Multi-bucket 歸屬 — 雙品牌站同進多 bucket（重要：避開 SQL CASE 短路求值）
def buckets_of(brand_arr, name):
    bs = []
    if "中油" in (brand_arr or []): bs.append("cpc")
    if "台塑" in (brand_arr or []) or "Formosa" in (brand_arr or []): bs.append("fpcc")
    if "台糖" in (brand_arr or []): bs.append("taisugar")
    if not bs and name and PRIVATE_NAME_RE.search(name): bs.append("other")
    return bs

for r in poi:
    r["_buckets"] = buckets_of(r.get("brand"), r.get("name"))
poi = [r for r in poi if r["_buckets"]]   # 過 false positive
print(f"     POI 過濾後 {len(poi)} 站")
bc = defaultdict(int)
for r in poi:
    for b in r["_buckets"]: bc[b] += 1
print(f"     {dict(bc)}")

# ── 3. nearest_node + multi-source dijkstra ─────────
print(f"[3/5] nearest_nodes + dijkstra ...")
to_tm2 = Transformer.from_crs("EPSG:4326", "EPSG:3826", always_xy=True)
xs, ys = zip(*[to_tm2.transform(r["lng"], r["lat"]) for r in poi])
nn = list(ox.distance.nearest_nodes(G, list(xs), list(ys)))

buckets = defaultdict(list)
for n, r in zip(nn, poi):
    for b in r["_buckets"]:
        buckets[b].append(n)
buckets["all"] = nn
buckets = dict(buckets)

node_dist = {}
for bucket, sources in buckets.items():
    if not sources:
        node_dist[bucket] = {}; continue
    dist = nx.multi_source_dijkstra_path_length(G, set(sources), cutoff=DIST_BANDS[-1][0], weight="length")
    node_dist[bucket] = dist
    print(f"     [{bucket}] {len(sources)} sources → {len(dist)}/{G.number_of_nodes()} reachable")

# ── 4. edge band → ndjson streaming ──────────────────
print(f"[4/5] edge band → ndjson ...")
G_wgs = ox.project_graph(G, to_crs="EPSG:4326")

def band_for(d):
    if d is None: return OVER_BAND
    for limit, label in DIST_BANDS:
        if d <= limit: return label
    return OVER_BAND

edges_cache = []
for u, v, data in G_wgs.edges(data=True):
    if "geometry" in data and data["geometry"] is not None:
        coords = [[c[0], c[1]] for c in data["geometry"].coords]
    else:
        coords = [[G_wgs.nodes[u]["x"], G_wgs.nodes[u]["y"]],
                  [G_wgs.nodes[v]["x"], G_wgs.nodes[v]["y"]]]
    edges_cache.append((u, v, coords))

for bucket, dists in node_dist.items():
    out_p = OUT_DIR / f"taiwan_{TOPIC}_{bucket}_nearest.ndjson"
    with open(out_p, "w", encoding="utf-8") as f:
        for u, v, coords in edges_cache:
            du = dists.get(u); dv = dists.get(v)
            edge_d = None if (du is None and dv is None) else (du or dv) if (du is None or dv is None) else min(du, dv)
            feat = {
                "type": "Feature",
                "properties": {"band": band_for(edge_d), "dist_m": int(edge_d) if edge_d is not None else None},
                "geometry": {"type": "LineString", "coordinates": coords},
            }
            f.write(json.dumps(feat, ensure_ascii=False) + "\n")
    print(f"     {out_p.name}  ({out_p.stat().st_size/1024/1024:.1f} MB)")

# ── 5. tippecanoe → PMTiles ──────────────────────────
print(f"[5/5] tippecanoe → PMTiles ...")
for bucket in node_dist.keys():
    ndjson_p = OUT_DIR / f"taiwan_{TOPIC}_{bucket}_nearest.ndjson"
    pmtiles_p = OUT_DIR / f"taiwan_{TOPIC}_{bucket}_nearest.pmtiles"
    cmd = [
        "tippecanoe", "-o", str(pmtiles_p), "--force",
        "--layer", f"coverage_{bucket}",     # ★ 命名契約：coverage_{bucket}
        "--minimum-zoom=6", "--maximum-zoom=12",
        "--no-feature-limit", "--no-tile-size-limit",
        "--drop-densest-as-needed", "--simplification=8",
        str(ndjson_p),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"     [ERR] {bucket}: {r.stderr[:300]}")
    else:
        print(f"     {pmtiles_p.name}  ({pmtiles_p.stat().st_size/1024/1024:.1f} MB)")

print(f"\n✅ done ({time.time()-t0:.0f}s)")
