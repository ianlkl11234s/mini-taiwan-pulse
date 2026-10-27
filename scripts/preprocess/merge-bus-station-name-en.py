#!/usr/bin/env python3
"""
P5 i18n：把公車站英文名（StationNameEn）合併進 public/geo/bus_stations_{city,intercity}.geojson。
只填空的 StationNameEn，其他屬性、順序、座標不動；可重跑（已有非空值不覆寫）。

來源：taipei-gis-analytics 的 bus_stops_all.geojson（每列一個 stop，有 StationID、LocationCityCode、StopNameEn）。
以 (LocationCityCode, StationID) join；站內各 stop 的 StopNameEn（去頭尾空白、略過空字串）取出現最多次者，
同票取字典序最小，確保可重現。查不到英文就維持空字串（顯示層退回中文）。

用法：python3 scripts/preprocess/merge-bus-station-name-en.py [--input a.geojson b.geojson ...] [--source stops.geojson]
之後需重建 PMTiles（tippecanoe 參數見 bus_stations_city.pmtiles metadata generator_options）。
"""
import argparse
import json
import os
from collections import Counter, defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# 資料檔為 gitignored、只在主 checkout；worktree 內執行時請用 --input 指定
DEFAULT_INPUTS = [
    os.path.join(BASE, "public/geo/bus_stations_city.geojson"),
    os.path.join(BASE, "public/geo/bus_stations_intercity.geojson"),
]
DEFAULT_SOURCE = os.path.join(
    BASE, "../taipei-gis-analytics/data/processed/transportation/bus/bus_stops_all.geojson"
)


def build_names(source):
    votes = defaultdict(Counter)
    for f in json.load(open(source, encoding="utf-8"))["features"]:
        p = f["properties"]
        en = (p.get("StopNameEn") or "").strip()
        sid = str(p.get("StationID") or "")
        if en and sid:
            votes[(p.get("LocationCityCode") or "", sid)][en] += 1
    return {k: sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] for k, c in votes.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", nargs="+", default=DEFAULT_INPUTS)
    ap.add_argument("--source", default=DEFAULT_SOURCE)
    args = ap.parse_args()

    names = build_names(args.source)
    print(f"來源 (城市, 站) 有英文名：{len(names)}")
    for path in args.input:
        raw = open(path, encoding="utf-8").read()
        data = json.loads(raw)
        total = filled = kept = 0
        for f in data["features"]:
            p = f["properties"]
            total += 1
            if (p.get("StationNameEn") or "").strip():
                kept += 1
                continue
            en = names.get((p.get("LocationCityCode") or "", str(p.get("StationID") or "")))
            if en:
                p["StationNameEn"] = en
                filled += 1
        # 維持原檔風格：預設 separators；city 原檔為 \\uXXXX 跳脫、intercity 為原字元，依原檔偵測
        ascii_escaped = "\\u" in raw
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=ascii_escaped)
        have = kept + filled
        print(f"{os.path.basename(path)}: {total} 站，原有 {kept}，新填 {filled}，"
              f"覆蓋 {have}/{total} = {have / total:.1%}，仍空 {total - have}")


if __name__ == "__main__":
    main()
