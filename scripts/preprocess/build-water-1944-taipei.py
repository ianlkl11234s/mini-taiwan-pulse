#!/usr/bin/env python3
"""1944 水域（臺北盆地）：顏色抽取的水域面 → public/geo/historical_water_1944_taipei.geojson。

來源：中研院人社中心 GIS 專題中心「臺灣百年歷史地圖」1944 美軍地形圖（AM25K_1944A，CC BY-NC）
以顏色抽出的臺北盆地水域面（474 面，WGS84；抽取流程與腳本在
GIS/_worktree-backups/2026-11-06/water1944/scripts/）。本腳本只做比對與瘦身，不改幾何：

  - modern_overlap_pct：面與現代河川面（public/geo/water_river_polygons.geojson，外擴 50 m）
    重疊的面積比例，0–100 整數；一律在 TWD97（EPSG:3826）計算。
  - status：overlap ≥ 50 → still（今日仍是河道）；< 50 → gone（今日已非河道）。
  - town：與面交集面積最大的鄉鎮市區（public/statistics/township-reference.geojson）；
    沒有交集的面為 null（不猜）。
  - area_m2：原值四捨五入成整數；座標取 6 位小數；perimeter_m、lon、lat 前端用不到，不輸出。

用法：
  python3 scripts/preprocess/build-water-1944-taipei.py \
      --src  ../_worktree-backups/2026-11-06/water1944/out/water_1944_polygons.geojson \
      --rivers public/geo/water_river_polygons.geojson \
      --towns  public/statistics/township-reference.geojson \
      --out    public/geo/historical_water_1944_taipei.geojson
"""
from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

import pyproj
from shapely.geometry import box, mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

warnings.filterwarnings("ignore")

BUFFER_M = 50
STILL_THRESHOLD = 50

TO_TWD97 = pyproj.Transformer.from_crs(4326, 3826, always_xy=True).transform


def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(float(v), 6) for v in obj]
        return [round_coords(v) for v in obj]
    return obj


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--rivers", required=True)
    ap.add_argument("--towns", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    src = json.loads(Path(args.src).read_text())["features"]
    olds = [shape(f["geometry"]) for f in src]
    w, s, e, n = unary_union(olds).bounds
    clip = box(w - 0.02, s - 0.02, e + 0.02, n + 0.02)

    rivers = [shape(f["geometry"]) for f in json.loads(Path(args.rivers).read_text())["features"]]
    rivers = [g.buffer(0) for g in rivers if g is not None and g.intersects(clip)]
    modern = transform(TO_TWD97, unary_union(rivers)).buffer(BUFFER_M)

    towns = []
    for f in json.loads(Path(args.towns).read_text())["features"]:
        g = shape(f["geometry"])
        if g.intersects(clip):
            towns.append((f["properties"]["area_name"], transform(TO_TWD97, g.buffer(0))))
    tree = STRtree([g for _, g in towns])

    feats = []
    stats = {"still": [0, 0.0], "gone": [0, 0.0]}
    no_town = 0
    for i, (f, g) in enumerate(zip(src, olds), start=1):
        gp = transform(TO_TWD97, g.buffer(0))
        area = gp.area
        pct = round(100 * gp.intersection(modern).area / area) if area > 0 else 0
        pct = max(0, min(100, int(pct)))
        status = "still" if pct >= STILL_THRESHOLD else "gone"
        best, best_area = None, 0.0
        for idx in tree.query(gp):
            a = gp.intersection(towns[idx][1]).area
            if a > best_area:
                best, best_area = towns[idx][0], a
        if best is None:
            no_town += 1
        stats[status][0] += 1
        stats[status][1] += area
        feats.append({
            "type": "Feature",
            "geometry": {"type": f["geometry"]["type"], "coordinates": round_coords(f["geometry"]["coordinates"])},
            "properties": {
                "id": f"w1944-{i}",
                "status": status,
                "modern_overlap_pct": pct,
                "town": best,
                "area_m2": round(float(f["properties"]["area_m2"])),
            },
        })

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB, {len(feats)} features, no town: {no_town})")
    for k, (c, a) in stats.items():
        print(f"  {k}: {c} 面, {a / 1e6:.2f} km²")


if __name__ == "__main__":
    main()
