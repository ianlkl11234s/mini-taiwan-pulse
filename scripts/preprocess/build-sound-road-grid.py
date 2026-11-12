#!/usr/bin/env python3
"""City Sound Atlas W6-2：道路車流網格的來源資料（路段＋流量時間序列）。

只準備來源資料；距離 kernel、流量換算、分級都在前端 TS（src/sound/grid/roadNetwork.ts），網格值＝queryReceiver(格心, t)。
品質規則、配 VD、延伸的純函式在 scripts/preprocess/sound/road_grid_lib.py（單元測試 test_road_grid_lib.py）。

兩個子命令（repo 根目錄執行）：

  network：靜態路網 public/sound-atlas/grid/road-network-v1.json（schema pulse-sound-road-network-v1）
    - 國道（freeway）：analytics freeway_sections.geojson（TDX 國道路段，分方向、有起迄里程）＋ freeway_vd_devices.geojson
      主線 VD（VDID 第 5 段 = M；I/O 匝道、C 集散道、N/L/B/R 等其他型態不用）。同國道同方向依里程最近配 VD
      （VD 在路段上 ≤150 m 時以投影位置換算里程；相鄰兩支在里程中點切開；離最近 VD 里程 > FREEWAY_MAX_GAP_KM 的部分不配，前端為無法判斷）。
      隧道段（OSM motorway tunnel=yes 外擴 TUNNEL_BUFFER_DEG）剔除：在地下，不是地面聲源。
    - 臺北市區（taipei）：public/sound-atlas/vd-baseline-taipei.json 的 VD 吸附到 OSM 主要道路（≤ SNAP_M），
      沿同路名延伸到下一支 VD（中點分界）或路口（與不同路名的主要道路交會）為止，最長 TAIPEI_MAX_EXTEND_M。
      延伸不到的臺北市主要道路另列 taipeiUncovered（前端為無法判斷）。
    - 新北與範圍外（estimate）：OSM 主要道路依等級（trunk／primary／secondary／tertiary），前端以等級權重推估。
    - 小路（minorCells）：OSM residential／unclassified／living_street／*_link（motorway_link 除外）／road／busway
      經過的網格（北北範圍內）；前端「有路但沒資料」＝無法判斷，與「離道路遠」＝0 區分。service（車道、停車場）不算。
    - OSM motorway 一律視為國道（臺灣 OSM 慣例；快速公路是 trunk），不進等級推估；motorway_link 不用。
    - OSM tunnel=yes 一律剔除。OSM 授權 ODbL 1.0（© OpenStreetMap contributors）。

  vd --date YYYY-MM-DD：國道 VD 當日每 10 分流量 public/sound-atlas/grid/freeway-vd-<D>.json（schema pulse-sound-freeway-vd-v1）
    - 輸入：analytics data/raw/sound_atlas/freeway_vd/freeway_vd_beibei_<D>.csv.gz（timezone 欄其實是 UTC 抓取時間）。
    - total_volume 是「每 10 分抓一次的 1 分鐘流量」（查證見 road_grid_lib 檔頭）；輛/時 = 值 × 60（前端換算）。
    - 槽 k＝臺灣日 D 00:00 + 600k 秒起的 10 分鐘；依抓取時間落槽，同槽多筆取有效最大；沒抓到的槽＝null（不回補）。
    - 品質規則（road_grid_lib.clean_vd_day）：status≠0、每車道每分 >50、整日全零、前後 ≥10 的單筆全零 → null。

產出後：python3 scripts/deploy/build-public-assets-lock.py add <檔案>（不 git add；public/sound-atlas/grid/ 已 gitignore）。
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent / "sound"))
from road_grid_lib import (  # noqa: E402
    RoadGraph, VdRow, assign_section_pieces, base_road_name, clean_vd_day, extend_vds, parse_vd_id,
)


def find_analytics() -> Path:
    for p in [ROOT, *ROOT.parents]:
        if (p / "taipei-gis-analytics").is_dir():
            return p / "taipei-gis-analytics"
    raise SystemExit("找不到 taipei-gis-analytics（應為 GIS 根目錄的兄弟 repo）")


GRID = json.loads((ROOT / "src/sound/grid/gridSpec.json").read_text())
GRID_SHA = hashlib.sha256((ROOT / "src/sound/grid/gridSpec.json").read_bytes()).hexdigest()
OUT_DIR = ROOT / "public/sound-atlas/grid"

FREEWAY_ROADS = {
    "國道1號": "N1", "國道1號汐止五股高架道路": "N1H", "國道2號": "N2", "國道3號": "N3",
    "國道3甲": "N3A", "南港聯絡道": "N3N", "國道5號": "N5",
}
FREEWAY_MAX_GAP_KM = 2.0
TUNNEL_BUFFER_DEG = 0.0004  # 約 40 m
SNAP_M = 40.0
VD_ON_LINE_M = 150.0
SNAP_ANY_NAME_M = 20.0
TAIPEI_MAX_EXTEND_M = 600.0
DENSIFY_M = 25.0
SIMPLIFY_DEG = 0.00004  # 約 4 m
MAJOR = {"trunk", "primary", "secondary", "tertiary"}
MINOR = {"residential", "unclassified", "living_street", "trunk_link", "primary_link", "secondary_link", "tertiary_link", "road", "busway"}
PAD = 0.02


# ── 網格與縣市碼 ─────────────────────────────────────────────

def county_codes() -> list[int]:
    txt = (ROOT / "src/sound/grid/gridMask.generated.ts").read_text()
    body = txt[txt.index("GRID_MASK_ROW_SPANS"):]
    body = body[body.index("= [") + 2:]
    rows = json.loads(re.sub(r",\s*\]", "]", body[: body.rindex("];") + 1]))
    out = [0] * (GRID["cols"] * GRID["rows"])
    for r, spans in enumerate(rows):
        for c0, c1, code in spans:
            for c in range(c0, c1 + 1):
                out[r * GRID["cols"] + c] = code
    return out


def cell_of(lon: float, lat: float) -> int:
    col = math.floor((lon - GRID["west"]) / GRID["dLon"] + 1e-9)
    row = math.floor((GRID["north"] - lat) / GRID["dLat"] + 1e-9)
    if 0 <= col < GRID["cols"] and 0 <= row < GRID["rows"]:
        return row * GRID["cols"] + col
    return -1


def bbox():
    w, n = GRID["west"], GRID["north"]
    return (w - PAD, n - GRID["rows"] * GRID["dLat"] - PAD, w + GRID["cols"] * GRID["dLon"] + PAD, n + PAD)


def seg_m(a, b) -> float:
    kx = 111_195 * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 111_195)


def rnd(coords) -> list[list[float]]:
    out: list[list[float]] = []
    for x, y in coords:
        p = [round(x, 5), round(y, 5)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def chain_edges(edges: list[tuple[int, int]], coord: dict[int, tuple[float, float]]) -> list[list[list[float]]]:
    """無向邊集合 → 盡量長的折線"""
    adj: dict[int, list[int]] = defaultdict(list)
    for u, v in edges:
        adj[u].append(v); adj[v].append(u)
    used: set[tuple[int, int]] = set()
    lines = []
    starts = [n for n in adj if len(adj[n]) != 2] + list(adj)
    for s in starts:
        for nb in adj[s]:
            e = (min(s, nb), max(s, nb))
            if e in used:
                continue
            line = [s]
            prev, cur = s, nb
            used.add(e)
            line.append(cur)
            while len(adj[cur]) == 2:
                nxt = adj[cur][0] if adj[cur][0] != prev else adj[cur][1]
                e2 = (min(cur, nxt), max(cur, nxt))
                if e2 in used:
                    break
                used.add(e2); line.append(nxt); prev, cur = cur, nxt
            lines.append([list(coord[n]) for n in line])
    return lines


def simplify(line: list[list[float]]) -> list[list[float]]:
    from shapely.geometry import LineString
    if len(line) < 3:
        return rnd(line)
    return rnd(list(LineString(line).simplify(SIMPLIFY_DEG, preserve_topology=False).coords))


# ── network ─────────────────────────────────────────────────

def cmd_network(args) -> None:
    import pyogrio
    from shapely.geometry import LineString, MultiLineString, Point
    from shapely.ops import unary_union

    ana = find_analytics()
    osm_path = Path(args.osm or ana / "data/processed/transportation/osm_road_drive/osm_road_drive_20260626.geojson")
    sec_path = Path(args.sections or ana / "data/processed/transportation/freeway/freeway_sections.geojson")
    dev_path = Path(args.devices or ana / "data/processed/transportation/freeway/freeway_vd_devices.geojson")
    base_path = ROOT / "public/sound-atlas/vd-baseline-taipei.json"
    counties = county_codes()
    bb = bbox()

    print("讀 OSM（bbox 裁切）…")
    gdf = pyogrio.read_dataframe(osm_path, bbox=bb)
    ways: list[dict] = []
    for hw, name, tunnel, geom in zip(gdf.highway, gdf["name"], gdf.tunnel, gdf.geometry):
        if geom is None:
            continue
        parts = list(geom.geoms) if isinstance(geom, MultiLineString) else [geom]
        coords: list[tuple[float, float]] = []
        for p in parts:  # pyrosm 的 MultiLineString 多半是首尾相接的兩點段 → 串回一條
            pc = list(p.coords)
            if coords and coords[-1] == pc[0]:
                coords.extend(pc[1:])
            else:
                if coords:
                    ways.append({"hw": hw, "name": name, "tunnel": tunnel, "coords": coords})
                coords = pc
        if coords:
            ways.append({"hw": hw, "name": name, "tunnel": tunnel, "coords": coords})
    print(f"  ways {len(ways)}")
    is_tunnel = lambda w: w["tunnel"] == "yes"  # noqa: E731

    # ── 國道 ──
    tunnel_geom = unary_union([LineString(w["coords"]) for w in ways if w["hw"] == "motorway" and is_tunnel(w)]).buffer(TUNNEL_BUFFER_DEG)
    devs = [f["properties"] for f in json.loads(dev_path.read_text())["features"]]
    vds_by_key: dict[tuple[str, str], list[tuple[float, str]]] = defaultdict(list)
    vd_pos: dict[str, tuple[float, float]] = {}
    for d in devs:
        p = parse_vd_id(d["VDID"])
        if not p or p[3] != "M":
            continue
        if not (bb[0] - 0.05 <= d["lng"] <= bb[2] + 0.05 and bb[1] - 0.05 <= d["lat"] <= bb[3] + 0.05):
            continue
        km = _km(d.get("LocationMile")) if d.get("LocationMile") else p[2]
        vds_by_key[(p[0], p[1])].append((km, d["VDID"]))
        vd_pos[d["VDID"]] = (d["lng"], d["lat"])
    freeway = []
    check: list[float] = []
    for f in json.loads(sec_path.read_text())["features"]:
        pr = f["properties"]
        code = FREEWAY_ROADS.get(pr["RoadName"])
        if not code or f["geometry"]["type"] != "LineString":
            continue
        coords = f["geometry"]["coordinates"]
        if not any(bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3] for x, y in coords):
            continue
        s_km, e_km = _km(pr["StartKM"]), _km(pr["EndKM"])
        # VD 在本路段上的位置：VD 點離路段幾何 ≤ VD_ON_LINE_M → 用投影比例換算的「幾何里程」
        # （TDX 路段幾何長度與里程不一致，最多差 1 km；直接用 LocationMile 內插會把 VD 放錯位置）；
        # 不在本路段上的鄰段 VD 才用 LocationMile（只影響路段兩端的分界）。
        line = LineString(coords)
        vds = []
        for km0, vid in vds_by_key.get((code, pr["RoadDirection"]), []):
            pt = Point(vd_pos[vid])
            if line.distance(pt) * 111_195 <= VD_ON_LINE_M:
                vds.append((s_km + (e_km - s_km) * line.project(pt, normalized=True), vid))
            else:
                vds.append((km0, vid))
        for piece, vid, a, b in assign_section_pieces(coords, s_km, e_km, vds, FREEWAY_MAX_GAP_KM):
            g = LineString(piece).difference(tunnel_geom)
            if g.is_empty:
                continue
            for part in (g.geoms if hasattr(g, "geoms") else [g]):
                if part.length <= 0 or part.geom_type != "LineString":
                    continue
                freeway.append({"sec": pr["SectionID"], "road": pr["RoadName"], "dir": pr["RoadDirection"], "vd": vid,
                                "km": [round(a, 3), round(b, 3)], "c": simplify(list(part.coords))})
        # 驗證：VD 點到其里程內插位置的距離
        from road_grid_lib import _cut_at_km, vertex_km  # noqa: PLC0415
        kms = vertex_km(coords, s_km, e_km)
        for km, vid in vds:
            if min(s_km, e_km) <= km <= max(s_km, e_km) and line.distance(Point(vd_pos[vid])) * 111_195 <= VD_ON_LINE_M:
                hit = _cut_at_km(coords, kms, km)
                if hit:
                    check.append(seg_m(hit[1], vd_pos[vid]))
    check.sort()
    print(f"  國道子段 {len(freeway)}（配到 VD {sum(1 for x in freeway if x['vd'])}）；VD 到里程內插點距離 中位 {check[len(check)//2]:.0f} m、p95 {check[int(len(check)*.95)]:.0f} m、最大 {check[-1]:.0f} m（{len(check)} 支）")

    # ── 主要道路加密成圖 ──
    node_id: dict[tuple[float, float], int] = {}
    coord: dict[int, tuple[float, float]] = {}
    def nid(c) -> int:
        k = (round(c[0], 7), round(c[1], 7))
        if k not in node_id:
            node_id[k] = len(node_id); coord[node_id[k]] = k
        return node_id[k]
    edges: list[tuple[int, int, float, str, str, int]] = []  # u, v, 長度, 路名基底, 等級, 縣市碼
    node_names: dict[int, set[str]] = defaultdict(set)
    unnamed = 0
    for w in ways:
        if w["hw"] not in MAJOR or is_tunnel(w):
            continue
        bn = base_road_name(w["name"])
        if bn is None:
            unnamed += 1; bn = f"__unnamed{unnamed}"
        cs = w["coords"]
        for a, b in zip(cs, cs[1:]):
            L = seg_m(a, b)
            n = max(1, math.ceil(L / DENSIFY_M))
            prev = nid(a)
            node_names[prev].add(bn)
            for i in range(1, n + 1):
                c = b if i == n else (a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)
                cur = nid(c)
                mid = ((coord[prev][0] + coord[cur][0]) / 2, (coord[prev][1] + coord[cur][1]) / 2)
                ci = cell_of(*mid)
                edges.append((prev, cur, L / n, bn, w["hw"], counties[ci] if ci >= 0 else 0))
                prev = cur
            node_names[prev].add(bn)
    intersections = {n for n, names in node_names.items() if len(names) >= 2}
    print(f"  主要道路邊 {len(edges)}、路口節點 {len(intersections)}")

    # ── 臺北 VD 吸附 ──
    base = json.loads(base_path.read_text())
    tp_edges = [e for e in edges if e[5] == 1]
    bucket: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, (u, v, *_r) in enumerate(tp_edges):
        c = coord[u]
        bucket[(int(c[0] / 0.002), int(c[1] / 0.002))].append(i)
    seeds_by_name: dict[str, list[tuple[str, int]]] = defaultdict(list)
    snap_stats = {"name_match": 0, "nearest_any_name": 0, "unsnapped": 0}
    snap_dist: list[float] = []
    cls_of_vd: dict[str, str] = {}
    for v in base["vds"]:
        p = (v["lon"], v["lat"])
        vb = base_road_name(v.get("road"))
        best_named, best_any = None, None
        bx, by = int(p[0] / 0.002), int(p[1] / 0.002)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in bucket.get((bx + dx, by + dy), []):
                    u, w_, _L, bn, hw, _c = tp_edges[i]
                    for n in (u, w_):
                        d = seg_m(coord[n], p)
                        if d <= SNAP_M and vb and (bn == vb or vb in bn or bn in vb) and (best_named is None or d < best_named[0]):
                            best_named = (d, n, bn, hw)
                        if d <= SNAP_ANY_NAME_M and (best_any is None or d < best_any[0]):
                            best_any = (d, n, bn, hw)
        pick = best_named or best_any
        if not pick:
            snap_stats["unsnapped"] += 1; continue
        snap_stats["name_match" if best_named else "nearest_any_name"] += 1
        snap_dist.append(pick[0])
        seeds_by_name[pick[2]].append((v["id"], pick[1]))
        cls_of_vd[v["id"]] = pick[3]
    snap_dist.sort()
    print(f"  臺北 VD 吸附 {snap_stats}；距離中位 {snap_dist[len(snap_dist)//2]:.1f} m")

    # ── 沿路延伸 ──
    by_name: dict[str, RoadGraph] = defaultdict(RoadGraph)
    for u, v, L, bn, _hw, _c in tp_edges:
        by_name[bn].add_edge(u, v, L)
    covered: dict[tuple[int, int], str] = {}
    for bn, seeds in seeds_by_name.items():
        g = by_name[bn]
        g.intersections = {n for n in g.edges if n in intersections}
        covered.update(extend_vds(g, seeds, TAIPEI_MAX_EXTEND_M))
    per_vd: dict[str, list[tuple[int, int]]] = defaultdict(list)
    uncovered_by_name: dict[str, list[tuple[int, int]]] = defaultdict(list)
    cov_len = unc_len = 0.0
    for u, v, L, bn, _hw, _c in tp_edges:
        k = (min(u, v), max(u, v))
        if k in covered:
            per_vd[covered[k]].append(k); cov_len += L
        else:
            uncovered_by_name[bn].append(k); unc_len += L
    taipei = [{"vd": vid, "c": simplify(line)} for vid, es in per_vd.items() for line in chain_edges(es, coord)]
    tp_unc = [{"name": None if bn.startswith("__") else bn, "c": simplify(line)} for bn, es in uncovered_by_name.items() for line in chain_edges(es, coord)]
    print(f"  臺北主要道路 {cov_len/1000:.0f} km 有 VD 延伸、{unc_len/1000:.0f} km 延伸不到")

    # ── 等級推估（非臺北） ──
    est_edges: dict[tuple[str, str], list[tuple[int, int]]] = defaultdict(list)
    for u, v, _L, bn, hw, c in edges:
        if c != 1:
            est_edges[(hw, bn)].append((min(u, v), max(u, v)))
    estimate = [{"cls": hw, "name": None if bn.startswith("__") else bn, "c": simplify(line)}
                for (hw, bn), es in est_edges.items() for line in chain_edges(es, coord)]

    # 等級典型流量參考（臺北 VD 平日 07–19 時中位數，依吸附道路等級）
    by_cls: dict[str, list[float]] = defaultdict(list)
    for v in base["vds"]:
        hw = cls_of_vd.get(v["id"])
        day = [q for q in v["wd_flow"][7:20] if q is not None]
        if hw and day:
            by_cls[hw].append(sorted(day)[len(day) // 2])
    cls_ref = {k: {"n": len(xs), "median_veh_per_hour": sorted(xs)[len(xs) // 2]} for k, xs in sorted(by_cls.items())}
    print(f"  等級參考（臺北 VD 平日 07–19 中位數）：{cls_ref}")

    # ── 小路經過的格 ──
    minor: set[int] = set()
    for w in ways:
        if w["hw"] not in MINOR or is_tunnel(w):
            continue
        cs = w["coords"]
        for a, b in zip(cs, cs[1:]):
            n = max(1, math.ceil(seg_m(a, b) / 50))
            for i in range(n + 1):
                ci = cell_of(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)
                if ci >= 0 and counties[ci]:
                    minor.add(ci)
    print(f"  小路經過的格 {len(minor)}")

    out = {
        "schema": "pulse-sound-road-network-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "grid": {"id": GRID["id"], "sha256": GRID_SHA},
        "sources": {
            "freeway_sections": {"file": "taipei-gis-analytics freeway_sections.geojson", "provider": "TDX 國道路段", "license": "政府資料開放授權條款-第1版"},
            "freeway_vd_devices": {"file": "taipei-gis-analytics freeway_vd_devices.geojson", "provider": "TDX 國道 VD", "license": "政府資料開放授權條款-第1版"},
            "osm": {"file": osm_path.name, "snapshot": "taiwan-latest.osm.pbf 2026-06-22", "license": "ODbL 1.0", "attribution": "© OpenStreetMap contributors"},
            "vd_baseline": {"file": "public/sound-atlas/vd-baseline-taipei.json", "period": base["meta"].get("period")},
        },
        "rules": {
            "freeway_max_gap_km": FREEWAY_MAX_GAP_KM, "vd_on_line_m": VD_ON_LINE_M, "tunnel_buffer_deg": TUNNEL_BUFFER_DEG, "snap_m": SNAP_M,
            "snap_any_name_m": SNAP_ANY_NAME_M, "taipei_max_extend_m": TAIPEI_MAX_EXTEND_M, "densify_m": DENSIFY_M,
            "simplify_deg": SIMPLIFY_DEG, "major": sorted(MAJOR), "minor": sorted(MINOR),
            "intersection": "主要道路節點同時屬於兩個以上路名基底（去「X段」）",
        },
        "stats": {"taipei_snap": snap_stats, "taipei_covered_km": round(cov_len / 1000, 1), "taipei_uncovered_km": round(unc_len / 1000, 1),
                  "class_reference": cls_ref, "freeway_vd_offset_m": {"median": round(check[len(check)//2]), "max": round(check[-1])}},
        "freeway": freeway,
        "taipei": taipei,
        "taipeiUncovered": tp_unc,
        "estimate": estimate,
        "minorCells": sorted(minor),
    }
    write_json(OUT_DIR / "road-network-v1.json", out)


def _km(s: str) -> float:
    m = re.match(r"(\d+)K\+(\d+)", str(s))
    return int(m.group(1)) + int(m.group(2)) / 1000 if m else float(s)


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
    path.write_bytes(raw)
    print(f"→ {path.relative_to(ROOT)}  {len(raw):,} B（gzip -9 {len(gzip.compress(raw, 9)):,} B）")


# ── vd ──────────────────────────────────────────────────────

def cmd_vd(args) -> None:
    import pandas as pd
    ana = find_analytics()
    csv = Path(args.csv or ana / f"data/raw/sound_atlas/freeway_vd/freeway_vd_beibei_{args.date}.csv.gz")
    net = json.loads((OUT_DIR / "road-network-v1.json").read_text())
    used = sorted({p["vd"] for p in net["freeway"] if p["vd"]})
    df = pd.read_csv(csv)
    ts = pd.to_datetime(df["timezone"], utc=True)
    midnight = pd.Timestamp(f"{args.date}T00:00:00+08:00")
    df["slot"] = ((ts - midnight).dt.total_seconds() // 600).astype(int)
    df = df[(df.slot >= 0) & (df.slot < 144)]
    fetch_by_slot: dict[int, str] = {}
    for s, t in zip(df.slot, ts[df.index]):
        if s not in fetch_by_slot or t.isoformat() < fetch_by_slot[s]:
            fetch_by_slot[int(s)] = t.isoformat(timespec="seconds")
    reasons_total: dict[str, int] = defaultdict(int)
    vds = {}
    groups = {k: g for k, g in df.groupby("vd_id")}
    for vid in used:
        g = groups.get(vid)
        if g is None:
            vds[vid] = {"lanes": None, "day": "not_in_export", "v": [None] * 144}
            reasons_total["not_in_export"] += 1
            continue
        rows = [VdRow(int(s), int(t), float(sp), float(oc), int(ln), int(st))
                for s, t, sp, oc, ln, st in zip(g.slot, g.total_volume, g.avg_speed, g.avg_occupancy, g.lane_count, g.status)]
        vals, reasons, day = clean_vd_day(rows)
        for k, n in reasons.items():
            reasons_total[k] += n
        vds[vid] = {"lanes": int(g.lane_count.iloc[0]), "day": day, "v": vals}
    missing = [k for k in range(144) if k not in fetch_by_slot]
    known = sum(1 for v in vds.values() for x in v["v"] if x is not None)
    out = {
        "schema": "pulse-sound-freeway-vd-v1",
        "date_taiwan": args.date,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {"table": "live.freeway_vd_traffic（data-collectors freeway_vd，TDX /v2/Road/Traffic/Live/VD/Freeway）",
                   "export": csv.name, "license": "政府資料開放授權條款-第1版"},
        "unit": "veh_per_min",
        "unit_note": "每 10 分抓一次即時值，每個值是該次的 1 分鐘流量（上游 UpdateInterval=60），不是 10 分鐘累計；輛/時＝值×60",
        "frames": {"count": 144, "step_s": 600, "first_slot_utc": midnight.tz_convert("UTC").isoformat(),
                   "slot_rule": "slot k＝[first_slot+600k, +600)，依抓取時間落槽；同槽多筆取有效最大；沒抓到＝null（不回補）",
                   "slots_missing": missing, "slot_fetch_utc": [fetch_by_slot.get(k) for k in range(144)]},
        "qa": {"rules": clean_vd_day.__doc__.strip(), "null_reasons": dict(reasons_total),
               "known_values": known, "total_values": len(vds) * 144},
        "vds": vds,
    }
    print(f"{args.date}: VD {len(vds)}、缺槽 {missing}、有效值 {known}/{len(vds)*144}、原因 {dict(reasons_total)}")
    write_json(OUT_DIR / f"freeway-vd-{args.date}.json", out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("network")
    n.add_argument("--osm"); n.add_argument("--sections"); n.add_argument("--devices")
    v = sub.add_parser("vd")
    v.add_argument("--date", required=True); v.add_argument("--csv")
    args = ap.parse_args()
    (cmd_network if args.cmd == "network" else cmd_vd)(args)


if __name__ == "__main__":
    main()
