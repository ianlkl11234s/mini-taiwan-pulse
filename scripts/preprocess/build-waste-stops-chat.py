#!/usr/bin/env python3
"""
build-waste-stops-chat.py — PF-14

把 public/geo/waste_stops_static.geojson（22 MB、73,060 Point）轉成 AI 聊天工具
（src/chat/tools/datasets.ts 的 wasteStopsStatic）用的精簡 columnar JSON。

- 只留查詢描述提到的欄位：city、district、vehicle_type、routes_count（順序固定，
  geojsonQuery 的 availableFields 取自首筆欄位順序）。
- 座標四捨五入到小數 5 位（約 1 m）。
- 字串欄位做字典編碼（dict 依首次出現順序，輸出可重現）；routes_count 保持數值。
- 格式 "pulse-columnar-points/v1"，由 src/chat/tools/geojsonQuery.ts decodeColumnarPoints 解碼。

地圖圖層走 waste_stops_static_20260930.pmtiles，不受本檔影響；原 GeoJSON 保留在 repo
當 PMTiles／本檔的轉檔輸入，但不進 image（.dockerignore）。

用法：
  python3 scripts/preprocess/build-waste-stops-chat.py
  python3 scripts/preprocess/build-waste-stops-chat.py --out public/geo/waste_stops_chat_YYYYMMDD.json
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public/geo/waste_stops_static.geojson"
DEFAULT_OUT = ROOT / "public/geo/waste_stops_chat_20261001.json"

DICT_FIELDS = ["city", "district", "vehicle_type"]
NUM_FIELDS = ["routes_count"]
FIELD_ORDER = ["city", "district", "vehicle_type", "routes_count"]


def dict_encode(values):
    table = list(dict.fromkeys(values))
    index = {v: i for i, v in enumerate(table)}
    return {"dict": table, "codes": [index[v] for v in values]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=SRC)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    features = json.loads(args.src.read_text(encoding="utf-8"))["features"]
    lng, lat = [], []
    cols = {k: [] for k in FIELD_ORDER}
    for f in features:
        g = f.get("geometry") or {}
        if g.get("type") != "Point":
            raise SystemExit(f"non-Point geometry: {g.get('type')}")
        x, y = g["coordinates"][:2]
        lng.append(round(float(x), 5))
        lat.append(round(float(y), 5))
        props = f.get("properties") or {}
        for k in FIELD_ORDER:
            if k not in props:
                raise SystemExit(f"missing property {k}")
            cols[k].append(props[k])

    properties = {}
    for k in FIELD_ORDER:
        properties[k] = dict_encode(cols[k]) if k in DICT_FIELDS else cols[k]

    out = {
        "format": "pulse-columnar-points/v1",
        "source": "public/geo/waste_stops_static.geojson",
        "count": len(features),
        "coordinatePrecision": 5,
        "lng": lng,
        "lat": lat,
        "properties": properties,
    }
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    args.out.write_text(text + "\n", encoding="utf-8")
    print(f"wrote {args.out.relative_to(ROOT)}: {len(features)} points, {len(text.encode()):,} bytes")


if __name__ == "__main__":
    main()
