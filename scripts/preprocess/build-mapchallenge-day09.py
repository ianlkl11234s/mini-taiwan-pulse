#!/usr/bin/env python3
"""30 天地圖挑戰 Day 9「城鄉 Urban-rural」鄉鎮彙總 GeoJSON（公開，模擬面板）。

輸入（唯讀）：
- 計數：taipei-gis-analytics docs/topic-research/mapchallenge_2026_day09_urban_rural/build/town_counts.csv
  （368 鄉鎮 × 9 類設施；pop＝2026-08-31 戶籍人口、area＝km²；口徑正本同資料夾 THREADS_SOURCE.md）
- 鄉鎮界：Pulse public/statistics/township-reference.geojson（area_code、area_name）

輸出：public/mapchallenge/day09_urban_rural.geojson（幾何簡化、座標 5 位小數）。
每個鄉鎮：code、name、pop、area、density、q（0–4，依密度由低到高排序 q=floor(i*5/368)）、
9 類計數 c_<key>、log2(該鄉鎮每萬人數／全國每萬人數) r_<key>（計數 0 時為 null）。

驗算（THREADS_SOURCE §5）：Q1 派出所每萬人 5.37、補習班 0.82；Q5 派出所 0.34、補習班 9.10；
超商 Q1 4.43、Q5 6.18；Q1 74 鄉鎮。對不上就以非 0 結束。

用法：python3 scripts/preprocess/build-mapchallenge-day09.py [--analytics DIR] [--pulse-public DIR]
"""
import argparse
import csv
import json
import math
import os
import sys

from shapely.geometry import mapping, shape

GIS = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS"
ap = argparse.ArgumentParser()
ap.add_argument("--analytics", default=f"{GIS}/taipei-gis-analytics")
ap.add_argument("--pulse-public", default=f"{GIS}/mini-taiwan-pulse/public")
ap.add_argument("--tolerance", type=float, default=0.0015, help="Douglas-Peucker 容差（度）")
args = ap.parse_args()

CSV = os.path.join(args.analytics, "docs/topic-research/mapchallenge_2026_day09_urban_rural/build/town_counts.csv")
TOWNS = os.path.join(args.pulse_public, "statistics/township-reference.geojson")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "mapchallenge", "day09_urban_rural.geojson")

# 9 類設施（順序＝select 選項順序：公共、市場、例外）
KEYS = ["elem", "police", "post", "hc", "cram", "clinic", "pharm", "bank", "cvs"]

rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
assert len(rows) == 368, len(rows)
for r in rows:
    r["pop"] = int(r["pop"])
    r["area"] = float(r["area"])
    for k in KEYS:
        r[k] = int(r[k])
    r["density"] = r["pop"] / r["area"]

rows.sort(key=lambda r: (r["density"], r["code"]))
n = len(rows)
for i, r in enumerate(rows):
    r["q"] = i * 5 // n

total_pop = sum(r["pop"] for r in rows)
national = {k: sum(r[k] for r in rows) / total_pop * 1e4 for k in KEYS}

# ── 驗算 ──
def group_rate(q, k):
    g = [r for r in rows if r["q"] == q]
    return sum(r[k] for r in g) / sum(r["pop"] for r in g) * 1e4

checks = [
    (0, "police", 5.37), (0, "cram", 0.82), (4, "police", 0.34), (4, "cram", 9.10), (0, "cvs", 4.43), (4, "cvs", 6.18),
]
ok = True
for q, k, want in checks:
    got = group_rate(q, k)
    flag = "OK" if round(got, 2) == want else "MISMATCH"
    ok &= flag == "OK"
    print(f"Q{q + 1} {k:7s} 每萬人 {got:.2f}（預期 {want}）{flag}")
q1n = sum(1 for r in rows if r["q"] == 0)
print(f"Q1 鄉鎮數 {q1n}（預期 74）", "OK" if q1n == 74 else "MISMATCH")
ok &= q1n == 74
if not ok:
    sys.exit("驗算對不上，停止輸出")

# ── 幾何 ──
by_code = {r["code"]: r for r in rows}
src = json.load(open(TOWNS, encoding="utf-8"))
assert len(src["features"]) == 368


def rnd(o):
    if isinstance(o, float):
        return round(o, 5)
    if isinstance(o, (list, tuple)):
        return [rnd(x) for x in o]
    return o


feats = []
for f in src["features"]:
    code = f["properties"]["area_code"]
    r = by_code.pop(code)
    g = shape(f["geometry"]).simplify(args.tolerance, preserve_topology=True)
    props = {
        "code": code, "name": f["properties"]["area_name"], "pop": r["pop"], "area": round(r["area"], 2),
        "density": round(r["density"], 1), "q": r["q"],
    }
    for k in KEYS:
        c = r[k]
        props[f"c_{k}"] = c
        props[f"r_{k}"] = round(math.log2(c / r["pop"] * 1e4 / national[k]), 3) if c > 0 else None
    gm = mapping(g)
    feats.append({"type": "Feature", "properties": props, "geometry": {"type": gm["type"], "coordinates": rnd(gm["coordinates"])}})
assert not by_code, f"CSV 有鄉鎮沒對到界線：{list(by_code)[:5]}"

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump({"type": "FeatureCollection", "features": feats}, fh, ensure_ascii=False, separators=(",", ":"))
print(f"全國每萬人：" + "、".join(f"{k} {v:.2f}" for k, v in national.items()))
print(f"寫出 {os.path.normpath(OUT)}：{len(feats)} 鄉鎮，{os.path.getsize(OUT) / 1e6:.2f} MB")
