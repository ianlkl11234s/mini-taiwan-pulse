#!/usr/bin/env python3
"""30 天地圖挑戰 Day 6「復古 Vintage」四層 GeoJSON（公開，模擬面板）。

輸入（唯讀）：
- THCTS 探索成品 $THCTS/explore/{1-sw-coast,10-taipei-1932,5-religion,7-lighthouse-weather}/
  （中央研究院《臺灣歷史文化地圖系統》第一版 2003，CC BY-NC-SA 3.0 臺灣版；
  TWD67 → WGS84 用 explore/_lib/thcts_io.py 的七參數轉換，與 explore/4-rail 同一支程式，車站實證中位殘差 49 m）
- OSM natural=coastline（explore/_osm/osm_coast_sw_20261106.json，ODbL，2026-11-06 擷取）
- 內政部地名資料 place_names_moi_20261012.csv（taipei-gis-analytics data/processed/base_map/place_names_moi/）
- Pulse 現行 public/geo/lighthouse.geojson、public/geo/weather_stations.geojson（主 checkout；後者走 S3 deploy-assets、gitignored）

輸出：public/mapchallenge/day06_{coast,taipei_1932,temples_1921,lighthouse_weather}.geojson（座標 6 位小數）。

用法：python3 scripts/preprocess/build-mapchallenge-day06.py [--thcts DIR] [--analytics DIR] [--pulse-public DIR]
"""
import argparse
import csv
import json
import math
import os
import re
import sys

import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point, mapping, shape
from shapely.ops import linemerge, polylabel, unary_union

GIS = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS"
ap = argparse.ArgumentParser()
ap.add_argument("--thcts", default=f"{GIS}/_worktree-backups/2026-11-06/thcts")
ap.add_argument("--analytics", default=f"{GIS}/taipei-gis-analytics")
ap.add_argument("--pulse-public", default=f"{GIS}/mini-taiwan-pulse/public")
args = ap.parse_args()

EXP = os.path.join(args.thcts, "explore")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "mapchallenge")
TO_TM2 = Transformer.from_crs("EPSG:4326", "EPSG:3826", always_xy=True)


def tm2(g):
    return shapely.transform(g, lambda c: np.column_stack(TO_TM2.transform(c[:, 0], c[:, 1])))


def rnd(g):
    """座標四捨五入到 6 位小數（約 0.1 m）。"""
    def r(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return [round(c[0], 6), round(c[1], 6)]
        return [r(x) for x in c]
    return {"type": g["type"], "coordinates": r(g["coordinates"])}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write(name, feats):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{name}: {len(feats)} features, {os.path.getsize(path) / 1024:.0f} KB")


def feat(geom, props):
    return {"type": "Feature", "geometry": rnd(mapping(geom) if not isinstance(geom, dict) else geom), "properties": props}


# ── 1. 臺南海岸線三代 ＋ 當年海岸線以西的今日地名 ─────────────────────────
ERA = {"17-18世紀": 1, "19世紀": 2, "20世紀初": 3}
coast_today = unary_union([
    tm2(LineString([(p["lon"], p["lat"]) for p in e["geometry"]]))
    for e in load(f"{EXP}/_osm/osm_coast_sw_20261106.json")["elements"] if "geometry" in e
])
feats = []
era_counts = {}
for f in load(f"{EXP}/1-sw-coast/coastlines_3eras_wgs84.geojson")["features"]:
    era = ERA[f["properties"]["era"]]
    merged = linemerge(shape(f["geometry"]))  # 探索成品是 unary_union 切碎的小段，先接回連續折線
    for part in getattr(merged, "geoms", [merged]):
        if part.length == 0:
            continue
        mid = tm2(part.interpolate(0.5, normalized=True))
        d_km = round(mid.distance(coast_today) / 1000, 1)
        feats.append(feat(part, {"kind": "coast", "era": era, "d_km": d_km, "len_m": round(tm2(part).length)}))
        era_counts[era] = era_counts.get(era, 0) + 1

sea = {ERA[f["properties"]["era"]]: tm2(shape(f["geometry"])) for f in load(f"{EXP}/1-sw-coast/former_sea_today_land.geojson")["features"]}
for g in sea.values():
    shapely.prepare(g)
PLACE_KW = ("鯤鯓", "塭", "汕")
seen = set()
n_place = 0
pn_csv = f"{args.analytics}/data/processed/base_map/place_names_moi/place_names_moi_20261012.csv"
with open(pn_csv, encoding="utf-8") as fh:
    for r in csv.DictReader(fh):
        if not r["lon"] or r["county"] not in ("臺南市", "嘉義縣", "高雄市", "雲林縣"):
            continue
        kw = next((k for k in PLACE_KW if k in r["name"]), None)
        if not kw:
            continue
        lon, lat = float(r["lon"]), float(r["lat"])
        p = tm2(Point(lon, lat))
        west_of = [e for e in (1, 2, 3) if sea[e].contains(p)]
        if not west_of:
            continue
        key = (r["name"], round(lon, 4), round(lat, 4))
        if key in seen:
            continue
        seen.add(key)
        # 最舊的一代：地名位在該代海岸線以西（上限口徑，同 FINDINGS）
        feats.append(feat(Point(lon, lat), {
            "kind": "place", "name": r["name"], "town": f"{r['county']}{r['town']}", "kw": kw,
            "west_of": ",".join(str(e) for e in west_of),
            "latest": west_of[-1],  # 最晚到哪一代仍在海岸線以西（點依此上色）
        }))
        n_place += 1
write("day06_coast.geojson", feats)
print("  coast parts by era", era_counts, "places", n_place)

# ── 2. 1932 臺北市町界 ───────────────────────────────────────────────────
survival = load(f"{EXP}/10-taipei-1932/q10_name_survival.json")
feats = []
n_surv = 0
for f in load(f"{EXP}/10-taipei-1932/q10_ding_1932_wgs84.geojson")["features"]:
    p = f["properties"]
    name = p["町"]
    vill = survival.get(name, [])
    surv = 1 if vill else 0
    n_surv += surv
    g = shape(f["geometry"])
    props = {
        "kind": "zone", "name": name, "survives": surv, "survive_villages": "、".join(vill),
        "area_km2": p["面積km2"], "district": p["今天區"], "main_villages": p["主要里(占町面積≥20%)"],
        "n_villages": p["涉及里數(≥2%)"],
    }
    feats.append(feat(g, props))
    biggest = max(g.geoms, key=lambda x: x.area) if g.geom_type == "MultiPolygon" else g
    feats.append(feat(polylabel(biggest, tolerance=1e-5), {"kind": "label", "name": name, "survives": surv}))
write("day06_taipei_1932.geojson", feats)
print("  zones", len(feats) // 2, "name survives", n_surv)

# ── 3. 廟不搬家：1921 地形圖祠廟 ─────────────────────────────────────────
hist = [f for f in load(f"{EXP}/5-religion/q5_hist_religion_with_dist_wgs84.geojson")["features"]
        if f["properties"]["layer"].startswith("175 ")]
matches = [m for m in load(f"{EXP}/5-religion/q5_name_match.json") if m["layer"].startswith("175 ")]
named = [f for f in hist if f["properties"]["name"]]
assert len(named) == len(matches), (len(named), len(matches))
same = {}
for f, m in zip(named, matches):
    assert f["properties"]["name"] == m["hist_name"], (f["properties"]["name"], m["hist_name"])
    if m["match"] and m["dist_m"] is not None and m["dist_m"] <= 500:
        same[id(f)] = m
feats = []
n_cont = 0
for f in hist:
    p = f["properties"]
    d = p["d_nearest_m"]
    cont = 1 if d is not None and d <= 100 else 0
    n_cont += cont
    m = same.get(id(f))
    props = {"cont": cont, "d_m": d, "nearest": p["nearest_today"] or "", "name": p["name"] or ""}
    if m:
        props.update({"same": 1, "same_name": m["match"], "same_d_m": m["dist_m"]})
    else:
        props["same"] = 0
    feats.append(feat(f["geometry"], props))
write("day06_temples_1921.geojson", feats)
print(f"  temples {len(feats)} cont≤100m {n_cont} ({100 * n_cont / len(feats):.1f}%) same-name {len(same)}")

# ── 4. 燈塔與測候所今昔 ───────────────────────────────────────────────────
lh_today = {f["properties"]["Name"]: f for f in load(f"{args.pulse_public}/geo/lighthouse.geojson")["features"]}
ws_today = [f for f in load(f"{args.pulse_public}/geo/weather_stations.geojson")["features"]
            if f["properties"].get("station_type") == "署屬有人站"]
NEAR_M = 150
# 人工判讀（FINDINGS.md 7-lighthouse-weather）：改名、改字、數化偏差
REMARK = {
    "北島燈臺": "今名目斗嶼燈塔",
    "查某嶼燈臺": "今名查母嶼燈塔",
    "彭佳嶼燈臺": "歷史點位落在海上（彭佳嶼在北方約 9 km），判為原圖數化偏差，燈塔仍在島上原處",
    "安平燈臺": "原註「建於熱蘭遮城（今安平古堡）」；今天的安平燈塔不在古堡",
    "溫港堆燈臺": "今塭港堆燈塔清單座標疑為概略值，未查改建史，距離僅供參考",
    "淡水燈臺": "",
}
OFFSET = {"彭佳嶼燈臺"}
feats = []
stat = {}
for i, f in enumerate(load(f"{EXP}/7-lighthouse-weather/q7_hist_wgs84.geojson")["features"]):
    p = f["properties"]
    typ = "lighthouse" if p["類別"] == "燈塔" else "station"
    name = p["名稱"] or ""
    # 燈塔：同名優先，改名、改字者用最近一座（≤150 m）；測候所：同名署屬有人站
    today_name = p["同名今日"] or (p["最近今日"] if p["最近距離m"] <= NEAR_M or name == "溫港堆燈臺" else "")
    dist = p["同名距離m"] if p["同名今日"] else (p["最近距離m"] if today_name else None)
    if name in OFFSET:
        status = "same"
    elif not today_name:
        status = "none"
    else:
        status = "same" if dist <= NEAR_M else "moved"
    tf = None
    if today_name:
        if typ == "lighthouse":
            tf = lh_today[today_name]
        else:
            hp = tm2(shape(f["geometry"]))
            cands = [w for w in ws_today if w["properties"]["station_name"] == today_name]
            tf = min(cands, key=lambda w: tm2(shape(w["geometry"])).distance(hp))
    year = p["設置"]
    year = str(year)[:4] if year else ""
    label = name or f"（無名，{p['位置註記']}）"
    remark = REMARK.get(name, "")
    if status == "none":
        remark = f"今日 36 座主要燈塔清單沒有對應（最近 {p['最近今日']} {p['最近距離m'] / 1000:.1f} km）；清單不含港燈，不代表一定消失"
    gid = f"lh{i:02d}"
    common = {"gid": gid, "type": typ, "status": status, "name": label, "year": year, "note": p["位置註記"] or "",
              "today_name": today_name, "d_m": dist, "remark": remark, "offset": 1 if name in OFFSET else 0}
    feats.append(feat(f["geometry"], {**common, "role": "hist"}))
    if tf is not None:
        tg = shape(tf["geometry"])
        feats.append(feat(tg, {**common, "role": "today"}))
        if name not in OFFSET:
            feats.append(feat(LineString([shape(f["geometry"]).coords[0], tg.coords[0]]), {**common, "role": "link"}))
    stat[(typ, status)] = stat.get((typ, status), 0) + 1
write("day06_lighthouse_weather.geojson", feats)
print("  lighthouse/station status", stat)
