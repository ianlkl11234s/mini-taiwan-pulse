#!/usr/bin/env python3
"""1944 水域（臺北盆地）：顏色抽取的水域面 → public/geo/historical_water_1944_taipei.geojson。

來源：中研院人社中心 GIS 專題中心「臺灣百年歷史地圖」1944 美軍地形圖（AM25K_1944A，CC BY-NC）
以顏色抽出的臺北盆地水域面（474 面，WGS84；抽取流程與腳本在
GIS/_worktree-backups/2026-11-06/water1944/scripts/）。本腳本依今日河道切分幾何並瘦身：

  - 每個 1944 面在 TWD97（EPSG:3826）切成兩部分：與今日河川面
    （public/geo/water_river_polygons.geojson，外擴 50 m）的交集 → status=still（今日仍是河道），
    差集 → status=gone（今日已非河道）；拆成單一 Polygon，丟掉 < 500 m² 的碎片（切線邊緣的細條）。
    src_id＝原始 1944 面編號（同一面切出的片可追溯）；area_m2＝該片面積。
    不保留原始面的重疊比例：切開後每片非 0% 即 100%，原始面的比例在大面（整條淡水河／基隆河
    是同一面）上沒有意義，放在 popup 反而誤導。
  - town：與該片交集面積最大的鄉鎮市區（public/statistics/township-reference.geojson）；
    沒有交集的片為 null（不猜）。
  - 每筆補 popup 來源 footer 欄位（SOURCE_PROPS）。
  - 座標取 6 位小數；原始 perimeter_m、lon、lat 前端用不到，不輸出。

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
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

warnings.filterwarnings("ignore")

BUFFER_M = 50
# popup 來源 footer（SourceFooter 讀 source_org／source_url／license／fetched_at）
SOURCE_PROPS = {
    "source_org": "中研院人社中心 GIS 專題中心 臺灣百年歷史地圖 1944 美軍地形圖（AM25K_1944A）衍生",
    "source_url": "https://gis.sinica.edu.tw/tileserver/wmts",
    "license": "原圖 CC BY-NC，本層為衍生資料",
    "fetched_at": "2026-11-06",
}
MIN_PIECE_M2 = 500

TO_TWD97 = pyproj.Transformer.from_crs(4326, 3826, always_xy=True).transform
TO_WGS84 = pyproj.Transformer.from_crs(3826, 4326, always_xy=True).transform


def polygon_parts(geom):
    """交集／差集可能是 GeometryCollection、MultiPolygon；只留面，拆成單一 Polygon。"""
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    out = []
    for g in getattr(geom, "geoms", []):
        out.extend(polygon_parts(g))
    return out


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
    dropped = [0, 0.0]
    no_town = 0
    for i, g in enumerate(olds, start=1):
        gp = transform(TO_TWD97, g.buffer(0))
        for status, piece in (("still", gp.intersection(modern)), ("gone", gp.difference(modern))):
            for part in polygon_parts(piece):
                if part.area < MIN_PIECE_M2:
                    dropped[0] += 1
                    dropped[1] += part.area
                    continue
                best, best_area = None, 0.0
                for idx in tree.query(part):
                    a = part.intersection(towns[idx][1]).area
                    if a > best_area:
                        best, best_area = towns[idx][0], a
                if best is None:
                    no_town += 1
                stats[status][0] += 1
                stats[status][1] += part.area
                geom = mapping(transform(TO_WGS84, part))
                feats.append({
                    "type": "Feature",
                    "geometry": {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])},
                    "properties": {
                        "id": f"w1944-{i}-{len(feats) + 1}",
                        "src_id": f"w1944-{i}",
                        "status": status,
                        "town": best,
                        "area_m2": round(part.area),
                        **SOURCE_PROPS,
                    },
                })

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB, {len(feats)} features, no town: {no_town})")
    print(f"  dropped < {MIN_PIECE_M2} m²: {dropped[0]} 片, {dropped[1] / 1e4:.2f} ha")
    for k, (c, a) in stats.items():
        print(f"  {k}: {c} 面, {a / 1e6:.2f} km²")


if __name__ == "__main__":
    main()
