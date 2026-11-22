#!/usr/bin/env python3
"""產生側欄地點搜尋的本地索引 src/data/placeSearchIndex.json（地址搜尋第一階段，RESEARCH D2=A）。

只用專案已公開的靜態資料，不呼叫任何 geocoding 服務：
  - 縣市／鄉鎮市區／村里：統計 CDN（data.itsmigu.com/statistics/v1）的不可變邊界
    COUNTY_MOI_1140318、TOWN_MOI_1140318、VILLAGE_NLSC_1150817（檔名即 SHA-256，下載後驗證）
  - 車站：public/rail/{tra,thsr,trtc,krtc,tmrt,klrt}/stations/*.geojson（只取站名與座標，
    不帶地址、電話等欄位）

每筆輸出：[名稱, 類別, 上層（縣市／鄉鎮或系統名）, lng, lat, (w, s, e, n)]，行政區才有 bbox。
- 代表點：最大多邊形的 representative_point（保證落在面內），不用質心。
- bbox：只納入面積 ≥ 最大塊 5% 的多邊形，避免離島（例：高雄市東沙）把 fitBounds 拉到海上。

用法（repo 根目錄）：
  python3 scripts/preprocess/build-place-search-index.py \
      --rail-root ../public/rail  # 預設 public/rail；worktree 沒有實體檔時指向主 checkout
  可加 --cache-dir 放下載的邊界（預設系統暫存）。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
import urllib.request
from pathlib import Path

from shapely.geometry import shape

CDN = "https://data.itsmigu.com/statistics/v1/geometries/"
COUNTY_SHA = "3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c"  # COUNTY_MOI_1140318
TOWN_SHA = "80749d605be86044650d6d73e0cf36fe48feb9f71ef4192702ced39a29432afd"  # TOWN_MOI_1140318
VILLAGE_SHA = "1f63774669f2d65894a66c2502d1671cf1ae1079ecc80e54b6350eb19d1ff378"  # VILLAGE_NLSC_1150817

# (目錄, 檔名 glob, 系統顯示名) —— 系統名同時當作結果列的副標
RAIL_SOURCES = [
    ("thsr", "stations.geojson", "高鐵"),
    ("tra", "stations.geojson", "台鐵"),
    ("trtc", "red_line_stations.geojson", "台北捷運"),
    ("trtc", "blue_line_stations.geojson", "台北捷運"),
    ("trtc", "green_line_stations.geojson", "台北捷運"),
    ("trtc", "orange_line_stations.geojson", "台北捷運"),
    ("trtc", "brown_line_stations.geojson", "台北捷運"),
    ("trtc", "ntmc_stations.geojson", "新北捷運"),
    ("trtc", "danhai_lrt_stations.geojson", "新北捷運"),
    ("trtc", "ankeng_lrt_stations.geojson", "新北捷運"),
    ("trtc", "tymc_stations.geojson", "桃園捷運"),
    ("trtc", "maokong_stations.geojson", "貓空纜車"),
    ("krtc", "stations.geojson", "高雄捷運"),
    ("klrt", "stations.geojson", "高雄輕軌"),
    ("tmrt", "stations.geojson", "台中捷運"),
]

R = 4  # 小數位（約 10 公尺）


def fetch(sha: str, cache: Path) -> dict:
    path = cache / f"{sha}.geojson"
    if not path.exists():
        with urllib.request.urlopen(f"{CDN}{sha}.geojson", timeout=120) as resp:  # noqa: S310 固定公開網址
            path.write_bytes(resp.read())
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != sha:
        raise SystemExit(f"SHA 不符：{sha}")
    return json.loads(data)


def place_geometry(geom: dict) -> tuple[list[float], list[float]]:
    g = shape(geom)
    parts = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
    largest = max(parts, key=lambda p: p.area)
    keep = [p for p in parts if p.area >= largest.area * 0.05]
    pt = largest.representative_point()
    w = min(p.bounds[0] for p in keep); s = min(p.bounds[1] for p in keep)
    e = max(p.bounds[2] for p in keep); n = max(p.bounds[3] for p in keep)
    return [round(pt.x, R), round(pt.y, R)], [round(w, R), round(s, R), round(e, R), round(n, R)]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rail-root", default="public/rail")
    ap.add_argument("--cache-dir", default=str(Path(tempfile.gettempdir()) / "pulse-place-index"))
    ap.add_argument("--out", default="src/data/placeSearchIndex.json")
    args = ap.parse_args()
    cache = Path(args.cache_dir); cache.mkdir(parents=True, exist_ok=True)

    places: list[list] = []
    county_name: dict[str, str] = {}
    for f in fetch(COUNTY_SHA, cache)["features"]:
        code, name = f["properties"]["area_code"], f["properties"]["area_name"]
        county_name[code] = name
        pt, bbox = place_geometry(f["geometry"])
        places.append([name, "county", "", *pt, *bbox])

    for f in fetch(TOWN_SHA, cache)["features"]:
        code, name = f["properties"]["area_code"], f["properties"]["area_name"]
        county = county_name.get(code[:5])
        if not county:
            raise SystemExit(f"鄉鎮 {code} {name} 對不到縣市")
        pt, bbox = place_geometry(f["geometry"])
        places.append([name, "town", county, *pt, *bbox])

    for f in fetch(VILLAGE_SHA, cache)["features"]:
        p = f["properties"]
        pt, bbox = place_geometry(f["geometry"])
        places.append([p["VILLNAME"], "village", f'{p["COUNTYNAME"]}{p["TOWNNAME"]}', *pt, *bbox])

    rail_root = Path(args.rail_root)
    seen: set[tuple[str, str]] = set()
    rail_hashes: dict[str, str] = {}
    for system_dir, filename, label in RAIL_SOURCES:
        path = rail_root / system_dir / "stations" / filename
        raw = path.read_bytes()
        rail_hashes[f"{system_dir}/stations/{filename}"] = hashlib.sha256(raw).hexdigest()
        for f in json.loads(raw)["features"]:
            prop = f["properties"]
            name = (prop.get("name_zh") or prop.get("name") or "").strip()
            if not name or not f.get("geometry"):
                continue
            # 轉乘站在多個路線檔重複：依「系統＋站名」去重
            if (label, name) in seen:
                continue
            seen.add((label, name))
            lng, lat = f["geometry"]["coordinates"][:2]
            places.append([name, "station", label, round(lng, R), round(lat, R)])

    out = {
        "version": 1,
        "sources": {
            "county": f"statistics/v1 COUNTY_MOI_1140318 {COUNTY_SHA}",
            "town": f"statistics/v1 TOWN_MOI_1140318 {TOWN_SHA}",
            "village": f"statistics/v1 VILLAGE_NLSC_1150817 {VILLAGE_SHA}",
            "station": rail_hashes,
        },
        "fields": ["name", "kind", "parent", "lng", "lat", "w", "s", "e", "n"],
        "places": places,
    }
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    Path(args.out).write_text(text + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for row in places:
        counts[row[1]] = counts.get(row[1], 0) + 1
    print(f"{args.out}: {len(text.encode()):,} bytes; {counts}")


if __name__ == "__main__":
    main()
