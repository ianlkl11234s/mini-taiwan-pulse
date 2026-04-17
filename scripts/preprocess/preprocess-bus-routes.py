#!/usr/bin/env python3
"""
preprocess-bus-routes.py
將台北市+新北市公車路線形狀與站序資料合併，產出前端使用的 JSON。

輸入:
  taipei-gis-analytics/data/processed/transportation/bus/bus_shapes_all.geojson
  taipei-gis-analytics/data/processed/transportation/bus/bus_stop_of_route_all.csv

輸出:
  public/bus/taipei_bus_routes.json

Key 格式:
  {RouteUID}_{Direction}                     ← SubRouteName 為空
  {RouteUID}_{SubRouteName}_{Direction}      ← 有具名子路線
"""

import csv
import json
import math
import os
import sys

# ── 路徑設定 ──────────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ANALYTICS_BASE = os.path.join(BASE, "..", "taipei-gis-analytics")

INPUT_SHAPES = os.path.join(
    ANALYTICS_BASE,
    "data/processed/transportation/bus/bus_shapes_all.geojson",
)
INPUT_STOPS = os.path.join(
    ANALYTICS_BASE,
    "data/processed/transportation/bus/bus_stop_of_route_all.csv",
)
INPUT_SCHEDULE = os.path.join(
    ANALYTICS_BASE,
    "data/processed/transportation/bus/bus_schedule_all.csv",
)
OUTPUT_DIR = os.path.join(BASE, "public", "bus")

# 城市設定：命令列傳 --city taoyuan 等，預設台北+新北
# 注意：taipei preset 內含「臺北市 + 新北市」（對應前端雙北 group）
CITY_PRESETS: dict[str, dict] = {
    # 直轄市 / 雙北合併
    "taipei":    {"cities": {"臺北市", "新北市"}, "output": "taipei_bus_routes.json"},
    "newtaipei": {"cities": {"新北市"},           "output": "newtaipei_bus_routes.json"},
    "taoyuan":   {"cities": {"桃園市"},           "output": "taoyuan_bus_routes.json"},
    "taichung":  {"cities": {"臺中市"},           "output": "taichung_bus_routes.json"},
    "tainan":    {"cities": {"臺南市"},           "output": "tainan_bus_routes.json"},
    "kaohsiung": {"cities": {"高雄市"},           "output": "kaohsiung_bus_routes.json"},
    # 省轄市
    "keelung":   {"cities": {"基隆市"},           "output": "keelung_bus_routes.json"},
    "hsinchu":   {"cities": {"新竹市"},           "output": "hsinchu_bus_routes.json"},
    "chiayi":    {"cities": {"嘉義市"},           "output": "chiayi_bus_routes.json"},
    # 縣
    "hsinchucounty":   {"cities": {"新竹縣"}, "output": "hsinchucounty_bus_routes.json"},
    "miaolicounty":    {"cities": {"苗栗縣"}, "output": "miaolicounty_bus_routes.json"},
    "changhuacounty":  {"cities": {"彰化縣"}, "output": "changhuacounty_bus_routes.json"},
    "nantoucounty":    {"cities": {"南投縣"}, "output": "nantoucounty_bus_routes.json"},
    "yunlincounty":    {"cities": {"雲林縣"}, "output": "yunlincounty_bus_routes.json"},
    "chiayicounty":    {"cities": {"嘉義縣"}, "output": "chiayicounty_bus_routes.json"},
    "pingtungcounty":  {"cities": {"屏東縣"}, "output": "pingtungcounty_bus_routes.json"},
    "yilancounty":     {"cities": {"宜蘭縣"}, "output": "yilancounty_bus_routes.json"},
    "hualiencounty":   {"cities": {"花蓮縣"}, "output": "hualiencounty_bus_routes.json"},
    "taitungcounty":   {"cities": {"臺東縣"}, "output": "taitungcounty_bus_routes.json"},
    # 離島
    "penghucounty":    {"cities": {"澎湖縣"}, "output": "penghucounty_bus_routes.json"},
    "kinmencounty":    {"cities": {"金門縣"}, "output": "kinmencounty_bus_routes.json"},
    "lienchiangcounty":{"cities": {"連江縣"}, "output": "lienchiangcounty_bus_routes.json"},
    # 公路客運
    "intercity": {"cities": {"公路客運"},         "output": "intercity_bus_routes.json"},
}

# 解析命令列參數
_preset_key = "taipei"
if len(sys.argv) > 1 and sys.argv[1] == "--city" and len(sys.argv) > 2:
    _preset_key = sys.argv[2]

if _preset_key not in CITY_PRESETS:
    print(f"Unknown city preset: {_preset_key}")
    print(f"Available: {', '.join(CITY_PRESETS.keys())}")
    sys.exit(1)

TARGET_CITIES = CITY_PRESETS[_preset_key]["cities"]
OUTPUT_FILE = os.path.join(OUTPUT_DIR, CITY_PRESETS[_preset_key]["output"])

# ── 幾何工具函式 ───────────────────────────────────────────────────────────────

def euclidean(a, b):
    """二維歐氏距離 (degree 空間，與前端 interpolateOnLineString 一致)"""
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    return math.sqrt(dx * dx + dy * dy)


def compute_cum_dist(coords):
    """回傳累積距離陣列（與 coords 等長，首元素為 0.0）"""
    cum = [0.0]
    for i in range(1, len(coords)):
        cum.append(cum[-1] + euclidean(coords[i - 1], coords[i]))
    return cum


def project_point_to_segment(px, py, ax, ay, bx, by):
    """
    將點 P 投影到線段 AB。
    回傳 (t, proj_x, proj_y, dist_sq)
      t       ∈ [0, 1]，在段上的比例
      proj    投影點座標
      dist_sq 點到投影點距離平方
    """
    dx = bx - ax
    dy = by - ay
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq == 0.0:
        # 退化段（A=B）
        return 0.0, ax, ay, (px - ax) ** 2 + (py - ay) ** 2
    t = ((px - ax) * dx + (py - ay) * dy) / seg_len_sq
    t = max(0.0, min(1.0, t))
    proj_x = ax + t * dx
    proj_y = ay + t * dy
    dist_sq = (px - proj_x) ** 2 + (py - proj_y) ** 2
    return t, proj_x, proj_y, dist_sq


def project_stop_to_line(lng, lat, coords, cum_dist):
    """
    找出停靠站在折線上的 progress [0, 1]。
    以最小垂直距離的線段為準，計算到投影點的累積距離 / 總距離。
    """
    best_dist_sq = float("inf")
    best_progress = 0.0
    total = cum_dist[-1]
    if total == 0.0:
        return 0.0

    for i in range(len(coords) - 1):
        ax, ay = coords[i]
        bx, by = coords[i + 1]
        t, _, _, dist_sq = project_point_to_segment(lng, lat, ax, ay, bx, by)
        if dist_sq < best_dist_sq:
            best_dist_sq = dist_sq
            seg_len = euclidean(coords[i], coords[i + 1])
            proj_cum = cum_dist[i] + t * seg_len
            best_progress = proj_cum / total

    return best_progress


def make_key(route_uid, sub_route_name, direction):
    if sub_route_name:
        return f"{route_uid}_{sub_route_name}_{direction}"
    return f"{route_uid}_{direction}"


# ── 主邏輯 ────────────────────────────────────────────────────────────────────

def main():
    # 1. 讀取並過濾 shapes
    print(f"Reading shapes: {INPUT_SHAPES}")
    with open(INPUT_SHAPES, encoding="utf-8") as f:
        geojson = json.load(f)

    all_features = geojson["features"]
    print(f"  Total shapes: {len(all_features)}")

    filtered_features = [
        feat for feat in all_features
        if feat["properties"].get("City") in TARGET_CITIES
    ]
    print(f"  Taipei+NewTaipei shapes: {len(filtered_features)}")

    # 蒐集有效 RouteUID 集合（供後續 CSV 過濾用）
    valid_route_uids = {feat["properties"]["RouteUID"] for feat in filtered_features}
    print(f"  Unique RouteUIDs: {len(valid_route_uids)}")

    # 2a. 讀取 schedule CSV 算每條路線的 frequency（班次/小時，固定值）
    #     以 (RouteUID, Direction) 為 key，取所有 rows 的 avg headway（分鐘）倒數 × 60
    #     ScheduleType=schedule 型（定點發車）無 headway → fallback 用 fixed_count/op_hours
    print(f"\nReading schedule: {INPUT_SCHEDULE}")
    headway_accum: dict[tuple, list[float]] = {}  # (routeUid, dir) → [avg_headway_mins]
    fixed_count_accum: dict[tuple, int] = {}      # schedule 型：累積 row 數（當作近似班次數）
    fixed_hours_accum: dict[tuple, float] = {}    # schedule 型：營運時數（取最大）

    def parse_hm(s: str) -> float | None:
        try:
            h, m = s.split(":")
            return int(h) + int(m) / 60.0
        except Exception:
            return None

    with open(INPUT_SCHEDULE, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        sched_total = sched_skipped = 0
        for row in reader:
            sched_total += 1
            if row["RouteUID"] not in valid_route_uids:
                sched_skipped += 1
                continue
            try:
                rkey = (row["RouteUID"], int(row["Direction"]))
            except (ValueError, KeyError):
                continue

            sched_type = (row.get("ScheduleType") or "").strip().lower()
            if sched_type == "frequency":
                try:
                    mn = float(row.get("MinHeadwayMins") or 0)
                    mx = float(row.get("MaxHeadwayMins") or 0)
                    avg = (mn + mx) / 2 if (mn > 0 and mx > 0) else (mn or mx)
                    if avg > 0:
                        headway_accum.setdefault(rkey, []).append(avg)
                except ValueError:
                    pass
            else:
                # schedule 型：每 row = 一個班次
                fixed_count_accum[rkey] = fixed_count_accum.get(rkey, 0) + 1
                s, e = parse_hm(row.get("StartTime") or ""), parse_hm(row.get("EndTime") or "")
                if s is not None and e is not None and e > s:
                    hrs = e - s
                    if hrs > fixed_hours_accum.get(rkey, 0):
                        fixed_hours_accum[rkey] = hrs

    print(f"  Total schedule rows: {sched_total}, skipped: {sched_skipped}")
    print(f"  Routes with headway data: {len(headway_accum)}")
    print(f"  Routes with fixed-time schedule: {len(fixed_count_accum)}")

    def calc_frequency(route_uid: str, direction: int) -> float:
        """回傳該路線的班次/小時（固定值）"""
        rkey = (route_uid, direction)
        if rkey in headway_accum:
            avg_mins = sum(headway_accum[rkey]) / len(headway_accum[rkey])
            if avg_mins > 0:
                return 60.0 / avg_mins
        if rkey in fixed_count_accum:
            # 該 direction 的總班次 / 假設營運時數（預設 14 小時）
            hrs = fixed_hours_accum.get(rkey, 0) or 14.0
            return fixed_count_accum[rkey] / hrs
        return 0.5  # 無班表資料：預設低密度（0.5 班/hr）

    # 2. 讀取 stops CSV（utf-8-sig BOM）
    print(f"\nReading stops: {INPUT_STOPS}")
    stops_by_key: dict[str, list[dict]] = {}  # key → sorted stop rows

    with open(INPUT_STOPS, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        total_stop_rows = 0
        skipped_stop_rows = 0
        for row in reader:
            total_stop_rows += 1
            if row["RouteUID"] not in valid_route_uids:
                skipped_stop_rows += 1
                continue
            key = make_key(row["RouteUID"], row["SubRouteName"], int(row["Direction"]))
            stops_by_key.setdefault(key, []).append(row)

    print(f"  Total stop rows: {total_stop_rows}, skipped: {skipped_stop_rows}")
    print(f"  Unique stop keys: {len(stops_by_key)}")

    # 額外建立 (RouteUID, Direction) → 合併站序的索引
    # 用於 shape SubRouteName 為空但 CSV 中有具名子路線的情況
    stops_by_route_dir: dict[tuple, list[dict]] = {}
    with open(INPUT_STOPS, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["RouteUID"] not in valid_route_uids:
                continue
            rkey = (row["RouteUID"], int(row["Direction"]))
            stops_by_route_dir.setdefault(rkey, []).append(row)

    # 排序每個 key 的站序
    for key in stops_by_key:
        stops_by_key[key].sort(key=lambda r: int(r["StopSequence"]))

    # 合併版：同 RouteUID+Direction 的所有子路線 stops 合併後去重（by StopUID），再依 StopSequence 排序
    stops_by_route_dir_merged: dict[tuple, list[dict]] = {}
    for rkey, rows in stops_by_route_dir.items():
        seen_stop = {}
        for row in rows:
            uid = row["StopUID"]
            seq = int(row["StopSequence"])
            # 取序號最小的那筆（通常子路線間序號相同）
            if uid not in seen_stop or seq < int(seen_stop[uid]["StopSequence"]):
                seen_stop[uid] = row
        merged = sorted(seen_stop.values(), key=lambda r: int(r["StopSequence"]))
        stops_by_route_dir_merged[rkey] = merged

    # 3. 處理每條 shape
    print(f"\nProcessing {len(filtered_features)} shapes...")
    output: dict = {}
    shape_count = 0
    total_stops_count = 0
    no_stop_match = 0

    for feat in filtered_features:
        props = feat["properties"]
        route_uid: str = props["RouteUID"]
        route_name: str = props["RouteName"]
        sub_route_name: str = props.get("SubRouteName", "")
        direction: int = int(props["Direction"])
        coords_raw = feat["geometry"]["coordinates"]  # [[lng, lat], ...]

        # 截斷到 5 位小數
        coords = [[round(c[0], 5), round(c[1], 5)] for c in coords_raw]

        if len(coords) < 2:
            print(f"  WARN: {route_uid} dir={direction} has < 2 coords, skipping")
            continue

        # 累積距離
        cum_dist = compute_cum_dist(coords)
        total_dist = cum_dist[-1]

        # key
        key = make_key(route_uid, sub_route_name, direction)

        # 找對應的 stops（三層優先序）：
        #   1. 完全比對 key（RouteUID + SubRouteName + Direction）
        #   2. 若有具名 SubRouteName 但找不到 → fallback 到空 SubRouteName key
        #   3. 若 shape SubRouteName 為空且 CSV 無空 key → 用合併版（所有子路線 stops）
        stop_rows = stops_by_key.get(key)
        if stop_rows is None and sub_route_name:
            fallback_key = make_key(route_uid, "", direction)
            stop_rows = stops_by_key.get(fallback_key)
        if stop_rows is None and not sub_route_name:
            # shape 無具名子路線：取合併版 stops（各子路線去重後）
            rkey = (route_uid, direction)
            stop_rows = stops_by_route_dir_merged.get(rkey)

        stop_progress_list: list[float] = []
        stop_names_list: list[str] = []

        if stop_rows:
            raw_progress: list[float] = []
            for row in stop_rows:
                try:
                    slng = float(row["lng"])
                    slat = float(row["lat"])
                except (ValueError, KeyError):
                    continue
                prog = project_stop_to_line(slng, slat, coords, cum_dist)
                raw_progress.append(prog)
                stop_names_list.append(row["StopName"])

            # 單調遞增強制（clamp）
            mono: list[float] = []
            running_max = 0.0
            for p in raw_progress:
                clamped = max(p, running_max)
                # 允許末端超過 1.0 → 夾至 1.0
                clamped = min(clamped, 1.0)
                mono.append(clamped)
                running_max = clamped

            stop_progress_list = [round(v, 6) for v in mono]
            total_stops_count += len(stop_progress_list)
        else:
            no_stop_match += 1

        # 累積距離 round
        cum_dist_rounded = [round(v, 6) for v in cum_dist]

        frequency = calc_frequency(route_uid, direction)

        output[key] = {
            "routeUid": route_uid,
            "routeName": route_name,
            "direction": direction,
            "coords": coords,
            "cumDist": cum_dist_rounded,
            "totalDist": round(total_dist, 6),
            "stopProgress": stop_progress_list,
            "stopNames": stop_names_list,
            "subRouteName": sub_route_name,
            "frequency": round(frequency, 3),
        }

        shape_count += 1
        if shape_count % 200 == 0:
            print(f"  ... processed {shape_count}/{len(filtered_features)}")

    # 4. 輸出
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"\nWriting {len(output)} entries to {OUTPUT_FILE} ...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    file_size_mb = os.path.getsize(OUTPUT_FILE) / 1024 / 1024

    # 5. 統計
    unique_routes = len({v["routeUid"] for v in output.values()})
    shapes_with_stops = shape_count - no_stop_match
    avg_stops = total_stops_count / shapes_with_stops if shapes_with_stops else 0

    print("\n── Stats ─────────────────────────────────")
    print(f"  Total unique routes  : {unique_routes}")
    print(f"  Total shapes written : {shape_count}")
    print(f"  Shapes with stops    : {shapes_with_stops}")
    print(f"  Shapes without stops : {no_stop_match}")
    print(f"  Average stops/shape  : {avg_stops:.1f}")
    print(f"  Output file size     : {file_size_mb:.2f} MB")
    print(f"  Output path          : {OUTPUT_FILE}")
    print("──────────────────────────────────────────")


if __name__ == "__main__":
    main()
