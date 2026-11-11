#!/usr/bin/env python3
"""City Sound Atlas — 鐵道站間結構分類表（地下／高架／地面／不明）產生器。

用途：聲景鐵道 adapter 要排除地下段。Pulse 的軌道與車站資料沒有結構屬性，
所以用 OpenStreetMap 的 tunnel／bridge／layer 標記比對每個「相鄰兩站」之間的軌道幾何。

輸入：
  --rail-dir   Pulse 的 public/rail（tracks/*.geojson、station_progress.json；worktree 沒有大檔時指向主 checkout）
  --osm-json   Overpass 回傳（不存在且加 --fetch 時下載）。查詢見 OVERPASS_QUERY。
輸出：
  src/sound/model/railSegmentTable.generated.ts（不要手改；重跑本腳本）

做法（每個系統、每條軌道、每對相鄰站）：
  1. 依該軌道 station_progress 排序，取兩站 progress 之間的軌道折線，每約 SAMPLE_STEP_M 取一點。
  2. 每點找 MATCH_MAX_M 內最近、且種類相符的 OSM 鐵道 way（台鐵配 rail／narrow_gauge 且非高鐵；高鐵配 highspeed／高鐵營運者；
     捷運配 subway／light_rail／monorail），讀它的結構：
       underground：tunnel=yes／culvert、location=underground、或 layer<0 且不是橋
       covered：tunnel=building_passage／covered／avalanche_protector 且 layer≥0（車站棚、明隧道，戶外傳聲不明）
       elevated：bridge=*（非 no）或 layer>0
       at_grade：以上皆無（OSM 慣例：沒標＝地面）
     沒有相符 way → unmatched。
  3. 站間分類（門檻見 RULES）：unmatched 比例 > UNMATCHED_MAX → unknown；地下 ≥ UNDERGROUND_MIN → underground；
     地下＋covered ≤ SURFACE_LEAK_MAX → elevated／at_grade／surface（高架與地面混合）；其餘（含洞口過渡段）→ unknown。
  4. 同一站對在多條軌道算出不同結果 → unknown（conflict）。

授權：OSM 資料 © OpenStreetMap contributors，ODbL 1.0。產出表是 OSM 的衍生資料，引用時要標示。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(REPO, "src", "sound", "model", "railSegmentTable.generated.ts")
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = (
    '[out:json][timeout:180];'
    'way["railway"~"^(rail|subway|light_rail|monorail|narrow_gauge)$"](21.8,119.9,25.4,122.1);'
    'out tags geom;'
)
SYSTEMS = ("trtc", "tra", "thsr", "krtc", "tmrt", "klrt")
EXCLUDED_TRTC_PREFIX = ("MK-",)  # 貓空纜車：railLoader.postProcess 也排除

SAMPLE_STEP_M = 20.0
MATCH_MAX_M = 40.0
UNMATCHED_MAX = 0.2
UNDERGROUND_MIN = 0.95
SURFACE_LEAK_MAX = 0.02
SURFACE_PURE_MIN = 0.8
SKIP_SERVICE = {"yard", "siding", "spur", "crossover"}
CELL_DEG = 0.005


def way_kind(tags: dict) -> str:
    tunnel = tags.get("tunnel")
    bridge = tags.get("bridge")
    loc = tags.get("location")
    try:
        layer = float(tags.get("layer", "0").split(";")[0])
    except ValueError:
        layer = 0.0
    has_bridge = bridge is not None and bridge != "no"
    if tunnel in ("yes", "culvert") or loc == "underground" or (layer < 0 and not has_bridge):
        return "underground"
    if tunnel in ("building_passage", "covered", "avalanche_protector"):
        return "covered"
    if has_bridge or layer > 0:
        return "elevated"
    return "at_grade"


def is_thsr(tags: dict) -> bool:
    return tags.get("highspeed") == "yes" or "高速鐵路" in (tags.get("operator") or "")


def system_accepts(system: str, tags: dict) -> bool:
    rw = tags.get("railway")
    if system == "thsr":
        return rw == "rail" and is_thsr(tags)
    if system == "tra":
        return rw in ("rail", "narrow_gauge") and not is_thsr(tags)
    return rw in ("subway", "light_rail", "monorail")


def local_xy(lon: float, lat: float, lat0: float) -> tuple[float, float]:
    k = 111_195.0
    return lon * k * math.cos(math.radians(lat0)), lat * k


def seg_dist(px, py, ax, ay, bx, by) -> float:
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


class OsmIndex:
    def __init__(self, elements: list[dict]):
        self.ways: list[tuple[dict, str, list[tuple[float, float]]]] = []
        self.grid: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
        for e in elements:
            tags = e.get("tags") or {}
            if tags.get("service") in SKIP_SERVICE:
                continue
            geom = [(g["lon"], g["lat"]) for g in e.get("geometry") or []]
            if len(geom) < 2:
                continue
            wi = len(self.ways)
            self.ways.append((tags, way_kind(tags), geom))
            for si in range(len(geom) - 1):
                (x1, y1), (x2, y2) = geom[si], geom[si + 1]
                for cx in range(int(math.floor(min(x1, x2) / CELL_DEG)), int(math.floor(max(x1, x2) / CELL_DEG)) + 1):
                    for cy in range(int(math.floor(min(y1, y2) / CELL_DEG)), int(math.floor(max(y1, y2) / CELL_DEG)) + 1):
                        self.grid[(cx, cy)].append((wi, si))

    def nearest_kind(self, system: str, lon: float, lat: float) -> str:
        cx, cy = int(math.floor(lon / CELL_DEG)), int(math.floor(lat / CELL_DEG))
        px, py = local_xy(lon, lat, lat)
        best_d, best_kind = MATCH_MAX_M, "unmatched"
        seen = set()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for wi, si in self.grid.get((cx + dx, cy + dy), ()):
                    if (wi, si) in seen:
                        continue
                    seen.add((wi, si))
                    tags, kind, geom = self.ways[wi]
                    if not system_accepts(system, tags):
                        continue
                    ax, ay = local_xy(*geom[si], lat)
                    bx, by = local_xy(*geom[si + 1], lat)
                    d = seg_dist(px, py, ax, ay, bx, by)
                    if d <= best_d:
                        best_d, best_kind = d, kind
        return best_kind


def cumulative_deg(coords):
    # 與 src/engines/railUtils.calculateTotalLength 同：經緯度平面長度（progress 的定義）
    out = [0.0]
    for i in range(len(coords) - 1):
        (x1, y1), (x2, y2) = coords[i], coords[i + 1]
        out.append(out[-1] + math.hypot(x2 - x1, y2 - y1))
    return out


def point_at(coords, cum, p: float):
    total = cum[-1]
    if total == 0:
        return coords[0]
    target = max(0.0, min(1.0, p)) * total
    for i in range(len(coords) - 1):
        if cum[i + 1] >= target:
            seg = cum[i + 1] - cum[i]
            t = 0.0 if seg == 0 else (target - cum[i]) / seg
            (x1, y1), (x2, y2) = coords[i], coords[i + 1]
            return (x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
    return coords[-1]


def classify(counts: dict, n: int) -> tuple[str, str]:
    u = counts["underground"] / n
    m = counts["unmatched"] / n
    cov = counts["covered"] / n
    e = counts["elevated"] / n
    g = counts["at_grade"] / n
    if m > UNMATCHED_MAX:
        return "X", "osm_unmatched"
    if u >= UNDERGROUND_MIN:
        return "U", "osm_tunnel"
    if u + cov <= SURFACE_LEAK_MAX:
        surf = e + g
        if surf > 0 and e / surf >= SURFACE_PURE_MIN:
            return "E", "osm_bridge_or_layer_gt0"
        if surf > 0 and g / surf >= SURFACE_PURE_MIN:
            return "G", "osm_no_tunnel_no_bridge"
        return "S", "osm_elevated_and_at_grade_mixed"
    return "X", "osm_portal_or_covered_transition"


def extract_feature(data):
    if not data:
        return None
    if data.get("type") == "FeatureCollection" and data.get("features"):
        return data["features"][0]
    if data.get("type") == "Feature":
        return data
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--rail-dir", default=os.path.join(REPO, "public", "rail"))
    ap.add_argument("--osm-json", required=True)
    ap.add_argument("--fetch", action="store_true", help="--osm-json 不存在時從 Overpass 下載")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    if not os.path.exists(args.osm_json):
        if not args.fetch:
            print(f"missing {args.osm_json} (use --fetch)", file=sys.stderr)
            return 2
        body = urllib.parse.urlencode({"data": OVERPASS_QUERY}).encode()
        req = urllib.request.Request(OVERPASS_URL, data=body, headers={"User-Agent": "pulse-sound-atlas-build/0.1"})
        with urllib.request.urlopen(req, timeout=300) as r, open(args.osm_json, "wb") as f:
            f.write(r.read())
    osm = json.load(open(args.osm_json, encoding="utf-8"))
    osm_base = (osm.get("osm3s") or {}).get("timestamp_osm_base")
    index = OsmIndex(osm["elements"])

    table: dict[str, list] = {}
    reasons: dict[str, str] = {}
    stats = defaultdict(lambda: defaultdict(int))
    for system in SYSTEMS:
        prog_path = os.path.join(args.rail_dir, system, "station_progress.json")
        progress = json.load(open(prog_path, encoding="utf-8"))
        for track_id, sp in progress.items():
            if system == "trtc" and track_id.startswith(EXCLUDED_TRTC_PREFIX):
                continue
            tpath = os.path.join(args.rail_dir, system, "tracks", f"{track_id}.geojson")
            if not os.path.exists(tpath):
                continue
            feat = extract_feature(json.load(open(tpath, encoding="utf-8")))
            if not feat or (feat.get("geometry") or {}).get("type") != "LineString":
                continue
            coords = [tuple(c[:2]) for c in feat["geometry"]["coordinates"]]
            if len(coords) < 2:
                continue
            cum = cumulative_deg(coords)
            ordered = sorted(((v, k) for k, v in sp.items() if isinstance(v, (int, float))), key=lambda x: x[0])
            for (pa, a), (pb, b) in zip(ordered, ordered[1:]):
                if pb <= pa or a == b:
                    continue
                (x1, y1), (x2, y2) = point_at(coords, cum, pa), point_at(coords, cum, pb)
                # 站間長度（公尺，粗估）決定取樣數
                approx_m = (cum[-1] * (pb - pa)) * 111_195.0 * max(0.5, math.cos(math.radians((y1 + y2) / 2)))
                n = max(5, int(math.ceil(approx_m / SAMPLE_STEP_M)))
                counts = defaultdict(int)
                for i in range(n):
                    p = pa + (pb - pa) * (i + 0.5) / n
                    lon, lat = point_at(coords, cum, p)
                    counts[index.nearest_kind(system, lon, lat)] += 1
                code, why = classify(counts, n)
                key = f"{system}|{min(a, b)}|{max(a, b)}"
                shares = [round(counts["underground"] / n, 3), round((counts["elevated"] + counts["at_grade"]) / n, 3), round(counts["unmatched"] / n, 3)]
                prev = table.get(key)
                if prev is None:
                    table[key] = [code, *shares, n]
                    reasons[key] = why
                elif prev[0] != code:
                    table[key] = ["X", *shares, n]
                    reasons[key] = "conflict_between_tracks"
    for key, row in table.items():
        stats[key.split("|")[0]][row[0]] += 1

    meta = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "osmBase": osm_base,
        "overpassQuery": OVERPASS_QUERY,
        "license": "ODbL 1.0 — © OpenStreetMap contributors（衍生資料，引用要標示）",
        "generator": "scripts/preprocess/build-rail-segments.py",
        "rules": {
            "sampleStepM": SAMPLE_STEP_M,
            "matchMaxM": MATCH_MAX_M,
            "unmatchedMax": UNMATCHED_MAX,
            "undergroundMin": UNDERGROUND_MIN,
            "surfaceLeakMax": SURFACE_LEAK_MAX,
            "surfacePureMin": SURFACE_PURE_MIN,
        },
        "counts": {k: dict(v) for k, v in sorted(stats.items())},
    }
    lines = [
        "/* eslint-disable */",
        "// 由 scripts/preprocess/build-rail-segments.py 產生，不要手改。",
        "// 資料來源：OpenStreetMap（© OpenStreetMap contributors，ODbL 1.0）的 tunnel／bridge／layer 標記比對 Pulse 軌道幾何。",
        "// 欄位：[code, 地下比例, 高架＋地面比例, 未比對到比例, 取樣數]；code U=地下 E=高架 G=地面 S=高架與地面混合 X=不明",
        "",
        f"export const RAIL_SEGMENT_TABLE_META = {json.dumps(meta, ensure_ascii=False, indent=2)} as const;",
        "",
        "export type RailSegmentCode = \"U\" | \"E\" | \"G\" | \"S\" | \"X\";",
        "",
        "/** key = `${system}|${站A}|${站B}`（兩站 id 依字串排序） */",
        "export const RAIL_SEGMENT_TABLE: Readonly<Record<string, readonly [RailSegmentCode, number, number, number, number]>> = {",
    ]
    for key in sorted(table):
        lines.append(f"  {json.dumps(key)}: {json.dumps(table[key])},")
    lines.append("};")
    lines.append("")
    lines.append("/** 每段的分類理由（osm_tunnel／osm_unmatched／osm_portal_or_covered_transition／conflict_between_tracks…） */")
    lines.append("export const RAIL_SEGMENT_REASON: Readonly<Record<string, string>> = {")
    for key in sorted(reasons):
        lines.append(f"  {json.dumps(key)}: {json.dumps(reasons[key])},")
    lines.append("};")
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(json.dumps(meta["counts"], ensure_ascii=False))
    print(f"wrote {args.out} ({len(table)} segments)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
