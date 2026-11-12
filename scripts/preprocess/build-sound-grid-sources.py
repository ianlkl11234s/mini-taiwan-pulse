#!/usr/bin/env python3
"""City Sound Atlas W6-3：從本機唯讀原始檔重建「全北北」聲源來源檔（網格與接收點共用同一份 set）。

不需要任何憑證：原始檔由主 agent 唯讀抓到 analytics `data/raw/sound_atlas/`（檔名＝S3 key 的 "/" 換成 "__"）。
解析一律呼叫 build-sound-scenes.py 的同一批函式（設 SOUND_S3_LOCAL_DIR 讓它只讀本機），不另寫一份。

產出（public/sound-atlas/grid/，gitignore；用 build-public-assets-lock.py add 登記）：
  aviation-src-<D>.json   航跡（臺北日 D，含 D±1 檔跨午夜補漏；任一航跡點或相鄰兩點連線碰到北北外擴 23 km 的航班，整條保留）
  rain-gauge-<D>.json     雨量站逐時列（get_rain_gauge_day 同形；北北外擴 6 km 內的站）
  natural-<D>.json        風、浪、河川觀測＋近岸海域面＋河道線（natural 區塊同場景快照 schema pulse-sound-natural-v1）
另產（scratch，不發布）：
  --canopy-out PATH       北北外擴 150 m 的 30 m 樹冠高度格網（int16 little-endian，row 0 在北；-1＝遮罩），
                          交給 scripts/preprocess/sound/build-sound-grid-packs.ts 用 TS kernel 算每格樹冠覆蓋

用法：
  python3 -I scripts/preprocess/build-sound-grid-sources.py --date 2026-11-09 --date 2026-10-24 \\
      [--raw-dir <analytics>/data/raw/sound_atlas] [--canopy-out /tmp/canopy.i16]
"""
from __future__ import annotations

import argparse
import array
import csv
import datetime as dt
import gzip
import importlib.util
import io
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
GRID_SPEC = os.path.join(REPO, "src", "sound", "grid", "gridSpec.json")
OUT_DIR = os.path.join(REPO, "public", "sound-atlas", "grid")

# 航跡篩選外擴：AVIATION.candidateRadiusM 20 km × 1.15（同前端 prefilterAviation 的安全係數）
AVIATION_PAD_KM = 23.0
# 雨量站：RAIN.maxStationDistanceM 5 km，外擴 6 km 保證每格 5 km 內的站都在
RAIN_PAD_KM = 6.0
# 近岸海域與河道的「保證完整範圍」：網格外框外擴 2 km（≥ 海岸 1 km、河道 300 m 判定半徑）
COAST_EXTENT_PAD_KM = 2.0
RIVER_NET_EXTENT_PAD_KM = 1.0
CANOPY_PAD_M = 150.0


def load_scenes_module(raw_s3_dir: str):
    os.environ["SOUND_S3_LOCAL_DIR"] = raw_s3_dir
    spec = importlib.util.spec_from_file_location("build_sound_scenes", os.path.join(HERE, "build-sound-scenes.py"))
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def grid_bbox() -> list[float]:
    with open(GRID_SPEC, encoding="utf-8") as f:
        g = json.load(f)
    south = g["north"] - g["rows"] * g["dLat"]
    east = g["west"] + g["cols"] * g["dLon"]
    return [g["west"], round(south, 6), round(east, 6), g["north"]]


def write_json(path: str, doc: dict) -> int:
    tmp = path + ".part"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)
    return os.path.getsize(path)


def now_iso(sc) -> str:
    return dt.datetime.now(sc.TPE).replace(microsecond=0).isoformat()


# ── 飛機 ──


def make_segment_hit(sc):
    """航跡點落在 bbox，或相鄰兩點的連線外框碰到 bbox（長缺口插值也會掃過）；window 同 hits（任一端點在臺北日內）"""

    def hit(row: dict, bbox: list[float], window=None) -> bool:
        prev = None
        for lat, lng, ts in sc.trail_points(row["trail"]):
            in_win = window is None or window[0] <= ts < window[1]
            if in_win and sc.in_bbox(lng, lat, bbox):
                return True
            if prev is not None:
                plat, plng, pts = prev
                if (in_win or window is None or window[0] <= pts < window[1]) and sc._bbox_hit(
                    [min(plng, lng), min(plat, lat), max(plng, lng), max(plat, lat)], bbox
                ):
                    return True
            prev = (lat, lng, ts)
        return False

    return hit


def build_aviation_src(sc, date: str, gb: list[float]) -> dict:
    notes: list[str] = []
    fb = sc.expand_bbox(gb, AVIATION_PAD_KM)
    block = sc.build_aviation({"date": date, "sources": {"aviation": "s3"}}, fb, notes, hit=make_segment_hit(sc))
    return {
        "schema": "pulse-sound-aviation-src-v1",
        "date_taiwan": date,
        "generated_at": now_iso(sc),
        "origin": block["origin"],
        "health": block["health"],
        "grid_bbox": gb,
        "filter_bbox": fb,
        "filter_rule": f"北北網格外框外擴 {AVIATION_PAD_KM:g} km（候選半徑 20 km×1.15）；任一航跡點或相鄰兩點連線外框碰到即整條保留；D±1 檔只補 D 檔沒有、且在臺北日 D 內飛經的航班",
        "notes_zh": notes,
        "rows": block["rows"],
    }


# ── 雨量站 ──


def _num(v: str):
    if v is None or v == "":
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return x if math.isfinite(x) else None


def _utc_to_tpe_iso(s: str, tz) -> str:
    # CSV 欄位形如 "2026-10-23 16:00:00+00"（UTC）；明確當 UTC 解析再轉臺北
    base = s.strip()
    if base.endswith("+00"):
        base = base[:-3]
    t = dt.datetime.strptime(base, "%Y-%m-%d %H:%M:%S").replace(tzinfo=dt.timezone.utc)
    return t.astimezone(tz).isoformat()


def build_rain_gauge(sc, date: str, gb: list[float], raw_dir: str) -> dict:
    path = os.path.join(raw_dir, "rain_gauge", f"rain_gauge_beibei_{date}.csv.gz")
    sb = sc.expand_bbox(gb, RAIN_PAD_KM)
    start, end = sc.day_window(date)
    rows = []
    total = 0
    per_station: dict[str, int] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            total += 1
            lon, lat = float(r["lng"]), float(r["lat"])
            if not sc.in_bbox(lon, lat, sb):
                continue
            bucket = _utc_to_tpe_iso(r["bucket_at"], sc.TPE)
            tb = int(dt.datetime.fromisoformat(bucket).timestamp())
            if not (start <= tb < end):
                continue
            rows.append({
                "station_id": r["station_id"],
                "station_name": r["station_name"] or None,
                "county": r["county"] or None,
                "town": r["town"] or None,
                "lat": lat,
                "lng": lon,
                "bucket_at": bucket,
                "observed_at": _utc_to_tpe_iso(r["observed_at"], sc.TPE),
                "precipitation_10min": _num(r["precipitation_10min"]),
                "precipitation_1hr": _num(r["precipitation_1hr"]),
                "precipitation_3hr": _num(r["precipitation_3hr"]),
                "precipitation_24hr": _num(r["precipitation_24hr"]),
            })
            per_station[r["station_id"]] = per_station.get(r["station_id"], 0) + 1
    rows.sort(key=lambda x: (x["station_id"], x["bucket_at"]))
    counts = sorted(per_station.values())
    return {
        "schema": "pulse-sound-rain-gauge-v1",
        "date_taiwan": date,
        "generated_at": now_iso(sc),
        "origin": f"rpc:get_rain_gauge_day({date}) 北北外框唯讀匯出（{os.path.basename(path)}）",
        "health": "ok" if rows else "empty",
        "station_extent": gb,
        "notes_zh": [
            f"匯出 {total} 列；收北北外擴 {RAIN_PAD_KM:g} km 內 {len(per_station)} 站、{len(rows)} 列（每站列數 {counts[0] if counts else 0}–{counts[-1] if counts else 0}）。",
            "bucket_at／observed_at 由 UTC 轉臺北時間；precipitation_1hr 是 observed_at 前 60 分的累積。",
        ],
        "rows": rows,
    }


# ── 自然三族（風、浪、河川）＋海岸、河道 ──


def build_natural_full(sc, date: str, gb: list[float], public_dir: str, coast_path: str) -> dict:
    notes: list[str] = []
    nat = {"schema": sc.NATURAL_SCHEMA}
    nat["wind"] = sc.build_wind(date, gb, notes)
    nat["wave"] = sc.build_wave(date, gb, notes)
    nat["river"] = sc.build_river(date, gb, public_dir, notes)
    cb = sc.expand_bbox(gb, COAST_EXTENT_PAD_KM)
    coast = sc.build_coast(cb, coast_path, notes)
    if coast:
        nat["coast"] = coast
    rpath = os.path.join(public_dir, "geo", "water_rivers.geojson")
    if os.path.exists(rpath):
        rb = sc.expand_bbox(gb, RIVER_NET_EXTENT_PAD_KM)
        lines = sc.river_lines_in_bbox(rpath, rb)
        nat["river_network"] = {"origin": "public/geo/water_rivers.geojson", "bbox": rb, "geometry": {"type": "MultiLineString", "coordinates": lines}}
        notes.append(f"河道：public/geo/water_rivers.geojson 中外框碰到北北外擴 {RIVER_NET_EXTENT_PAD_KM + 0.5:g} km 的線整條保留（{len(lines)} 條，DP {sc.SIMPLIFY_RIVER_M:g} m）；不含野溪、瀑布。")
    else:
        notes.append(f"河道：{rpath} 不存在 → 不放 river_network（河川整片無法判斷）。")
    return {"schema": "pulse-sound-natural-grid-v1", "date_taiwan": date, "generated_at": now_iso(sc), "grid_bbox": gb, "notes_zh": notes, "natural": nat}


def build_canopy_fine(sc, gb: list[float], public_dir: str, out_path: str) -> dict:
    path = os.path.join(public_dir, "forestry", "canopy_height_rgb_taiwan.pmtiles")
    lat_mid = (gb[1] + gb[3]) / 2
    pad_lat = CANOPY_PAD_M / 111_195
    pad_lon = CANOPY_PAD_M / (111_195 * math.cos(math.radians(lat_mid)))
    w, s, e, n = gb[0] - pad_lon, gb[1] - pad_lat, gb[2] + pad_lon, gb[3] + pad_lat
    nx = int(math.ceil((e - w) * 111_195 * math.cos(math.radians(lat_mid)) / sc.CANOPY_CELL_M))
    ny = int(math.ceil((n - s) * 111_195 / sc.CANOPY_CELL_M))
    heights = sc.sample_canopy_grid(path, w, s, e, n, nx, ny)
    arr = array.array("h", heights)
    if sys.byteorder != "little":
        arr.byteswap()
    with open(out_path + ".part", "wb") as f:
        arr.tofile(f)
    os.replace(out_path + ".part", out_path)
    meta = {
        "origin": "public/forestry/canopy_height_rgb_taiwan.pmtiles (Meta/WRI 2020)",
        "bbox": [w, s, e, n],
        "nx": nx,
        "ny": ny,
        "cell_m": sc.CANOPY_CELL_M,
        "with_data": sum(1 for v in heights if v >= 0),
        "file": out_path,
    }
    with open(out_path + ".json", "w", encoding="utf-8") as f:
        json.dump(meta, f)
    return meta


def main() -> int:
    gis_root = os.path.abspath(os.path.join(REPO, "..", "..", "..")) if os.path.basename(os.path.dirname(REPO)) == ".worktrees" else os.path.abspath(os.path.join(REPO, ".."))
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--date", action="append", required=True)
    ap.add_argument("--raw-dir", default=os.path.join(gis_root, "taipei-gis-analytics", "data", "raw", "sound_atlas"))
    ap.add_argument("--out", default=OUT_DIR)
    ap.add_argument("--only", choices=["aviation", "rain", "natural"], action="append")
    ap.add_argument("--canopy-out", help="另產全北北 30 m 樹冠格網到這個 scratch 路徑（不發布）")
    args = ap.parse_args()
    sc = load_scenes_module(os.path.join(args.raw_dir, "s3"))
    gb = grid_bbox()
    os.makedirs(args.out, exist_ok=True)
    only = set(args.only or ["aviation", "rain", "natural"])
    for d in args.date:
        if "aviation" in only:
            doc = build_aviation_src(sc, d, gb)
            n = write_json(os.path.join(args.out, f"aviation-src-{d}.json"), doc)
            print(f"{d} aviation-src: {len(doc['rows'])} flights, {n:,} B, health={doc['health']}")
            for x in doc["notes_zh"]:
                print("   ", x)
        if "rain" in only:
            doc = build_rain_gauge(sc, d, gb, args.raw_dir)
            n = write_json(os.path.join(args.out, f"rain-gauge-{d}.json"), doc)
            print(f"{d} rain-gauge: {len(doc['rows'])} rows, {n:,} B")
            for x in doc["notes_zh"]:
                print("   ", x)
        if "natural" in only:
            doc = build_natural_full(sc, d, gb, sc.DEFAULT_PUBLIC, sc.DEFAULT_COAST)
            n = write_json(os.path.join(args.out, f"natural-{d}.json"), doc)
            nat = doc["natural"]
            print(f"{d} natural: wind {len(nat['wind']['stations'])} st/{len(nat['wind']['obs'])} obs, wave {len(nat['wave']['stations'])} st, river {len(nat['river']['stations'])} st, {n:,} B")
            for x in doc["notes_zh"]:
                print("   ", x)
    if args.canopy_out:
        meta = build_canopy_fine(sc, gb, sc.DEFAULT_PUBLIC, args.canopy_out)
        print(f"canopy fine grid {meta['nx']}x{meta['ny']} with_data={meta['with_data']} → {args.canopy_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
