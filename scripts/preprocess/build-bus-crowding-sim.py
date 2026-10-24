#!/usr/bin/env python3
"""公車擁擠模擬（模擬面板，站主限定、研究中）→ Pulse 本機靜態資產。

上游（唯讀，taipei-gis-analytics 的 bus_crowding P3 匯出）：
  ../taipei-gis-analytics/output/bus_crowding/p3_viz_am137/data   0.137 版（較寬鬆，YouBike 推估）
  ../taipei-gis-analytics/output/bus_crowding/p3_viz/data         0.180 版（較擁擠，捷運推估）
  兩版 lines.json、stations.json 逐位元相同；meta.json 沒記 am_share，資料夾對應寫死在 VERSIONS。

產出（public/sim/ 已 gitignore：資料公開與否尚未拍板，不進 git）：
  public/sim/bus-crowding/segments.geojson          路段幾何（只輸出一次；feature id＝陣列順序）
  public/sim/bus-crowding/{v137,v180}/<方案>.json    {"ov": [...], "n": [...]}，依 feature 順序對齊
  public/sim/bus-crowding/meta.json                 版本、方案、涵蓋、bbox、QA 計數

重產：
  python3 scripts/preprocess/build-bus-crowding-sim.py
  python3 scripts/preprocess/build-bus-crowding-sim.py --analytics <taipei-gis-analytics 路徑>

契約（lines.json）：index 即線編號；st=[StationID, 站名, 沿線公尺]；g=[lng,lat]、gm=沿 g 累積公尺。
segs.json 的 ov[i][j]＝平日 7–9 時離開第 j 站的班次中負載比 ≥1.0 的比例，代表路段 st[j]→st[j+1]；
n[i][j]＝班次數；null＝無班次。末站那格丟掉。
s3（index 1，TPE-SYN-s3-0|0）沒有實際路線幾何（只是站點連線），整條不輸出（使用者決定：不畫線）。
s2（index 0，307 區間車）用真實線形，照常輸出並帶 syn=1。
"""
from __future__ import annotations

import argparse
import bisect
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ANALYTICS = ROOT.parent / "taipei-gis-analytics"
# 若在 worktree（.claude/worktrees/<name>）執行，往上找 GIS 工作區
for parent in ROOT.parents:
    if (parent / "taipei-gis-analytics" / "output" / "bus_crowding").is_dir():
        DEFAULT_ANALYTICS = parent / "taipei-gis-analytics"
        break
OUT = ROOT / "public" / "sim" / "bus-crowding"

VERSIONS = [
    {"id": "v137", "dir": "p3_viz_am137", "am_share": 0.137, "label": "較寬鬆 13.7%（YouBike 推估）"},
    {"id": "v180", "dir": "p3_viz", "am_share": 0.180, "label": "較擁擠 18.0%（捷運推估）"},
]
SKIP_LINE_KEYS = {"TPE-SYN-s3-0|0"}  # s3 新接駁線：無實際路線幾何
COVERAGE_TEXT = "臺北市 307 走廊周邊 257 條路線（559 條路線×方向）；新北市區公車未涵蓋"


def load(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def interp(g, gm, m):
    """沿線公尺 m 在折線上的座標（超出兩端就夾住）。"""
    if m <= gm[0]:
        return g[0]
    if m >= gm[-1]:
        return g[-1]
    k = bisect.bisect_right(gm, m)
    m0, m1 = gm[k - 1], gm[k]
    t = 0.0 if m1 == m0 else (m - m0) / (m1 - m0)
    (x0, y0), (x1, y1) = g[k - 1], g[k]
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]


def cut(g, gm, a, b):
    """截取沿線 a→b 公尺（a<b）的子折線。"""
    pts = [interp(g, gm, a)]
    for (pt, m) in zip(g, gm):
        if a < m < b:
            pts.append(pt)
    pts.append(interp(g, gm, b))
    out = []
    for p in pts:
        q = [round(p[0], 5), round(p[1], 5)]
        if not out or out[-1] != q:
            out.append(q)
    if len(out) == 1:
        out.append(out[0])
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--analytics", type=Path, default=DEFAULT_ANALYTICS)
    args = ap.parse_args()
    base = args.analytics / "output" / "bus_crowding"
    dirs = {v["id"]: base / v["dir"] / "data" for v in VERSIONS}

    lines = load(dirs["v137"] / "lines.json")
    if (dirs["v137"] / "lines.json").read_bytes() != (dirs["v180"] / "lines.json").read_bytes():
        raise SystemExit("兩版 lines.json 不一致：契約已變，先確認上游")
    meta_up = {vid: load(d / "meta.json") for vid, d in dirs.items()}
    index = {vid: load(d / "scenarios" / "index.json") for vid, d in dirs.items()}
    titles = {vid: [(s["id"], s["title"]) for s in idx] for vid, idx in index.items()}
    if titles["v137"] != titles["v180"]:
        raise SystemExit("兩版方案清單或標題不一致")
    scenarios = titles["v137"]

    features = []
    order = []  # (li, sj)
    skipped_nonmono = 0
    nonmono_lines = set()
    clamped = 0
    skipped_syn = 0
    for li, line in enumerate(lines):
        st = line["st"]
        if line["k"] in SKIP_LINE_KEYS:
            skipped_syn += max(0, len(st) - 1)
            continue
        g, gm = line["g"], line["gm"]
        if len(g) != len(gm):
            raise SystemExit(f"line {li} g/gm 長度不符")
        for sj in range(len(st) - 1):
            a, b = st[sj][2], st[sj + 1][2]
            if b <= a:
                skipped_nonmono += 1
                nonmono_lines.add(li)
                continue
            if a < gm[0] or b > gm[-1]:
                clamped += 1
            props = {"li": li, "sj": sj, "n": line["n"], "sn": line["sn"], "a": st[sj][1], "b": st[sj + 1][1]}
            if line.get("new") == 1:
                props["syn"] = 1
            features.append({"type": "Feature", "id": len(order), "properties": props,
                             "geometry": {"type": "LineString", "coordinates": cut(g, gm, a, b)}})
            order.append((li, sj))

    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "segments.geojson").open("w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh, ensure_ascii=False, separators=(",", ":"))

    def pack(segs):
        ov, n = [], []
        for li, sj in order:
            o = segs["ov"][li][sj]
            ov.append(None if o is None else round(o, 3))
            n.append(int(segs["n"][li][sj] or 0))
        return {"ov": ov, "n": n}

    n_equal = True
    files = {}
    for v in VERSIONS:
        vid = v["id"]
        (OUT / vid).mkdir(exist_ok=True)
        packs = {"base": pack(load(dirs[vid] / "segs.json"))}
        for sid, _ in scenarios:
            packs[sid] = pack(load(dirs[vid] / "scenarios" / sid / "segs.json"))
        for sid, p in packs.items():
            if len(p["ov"]) != len(order):
                raise SystemExit(f"{vid}/{sid} 長度不符")
            with (OUT / vid / f"{sid}.json").open("w", encoding="utf-8") as fh:
                json.dump(p, fh, separators=(",", ":"))
        files[vid] = packs
    for sid in files["v137"]:
        if files["v137"][sid]["n"] != files["v180"][sid]["n"]:
            n_equal = False

    up = meta_up["v180"]
    meta = {
        "date": up.get("date"),
        "window": "平日 07:00–09:00",
        "capacity_assumed": up.get("capacity_assumed"),
        "bbox": up.get("bbox"),
        "coverage": COVERAGE_TEXT,
        "versions": [{"id": v["id"], "am_share": v["am_share"], "label": v["label"], "upstream_dir": v["dir"]} for v in VERSIONS],
        "scenarios": [{"id": "base", "title": "基準（現況）"}] + [{"id": sid, "title": t} for sid, t in scenarios],
        "qa": {
            "segments_out": len(features),
            "segments_upstream": sum(max(0, len(l["st"]) - 1) for l in lines),
            "segments_skipped_nonmonotone": skipped_nonmono,
            "lines_nonmonotone": len(nonmono_lines),
            "lines_nonmonotone_upstream_meta": up.get("lines_nonmonotone_stop_projection"),
            "segments_clamped_to_shape_end": clamped,
            "s3_skipped_segments": skipped_syn,
            "n_equal_across_versions": n_equal,
            "lines": len(lines),
            "routes": len({l["r"] for l in lines}),
        },
    }
    with (OUT / "meta.json").open("w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    print(json.dumps(meta["qa"], ensure_ascii=False))


if __name__ == "__main__":
    main()
