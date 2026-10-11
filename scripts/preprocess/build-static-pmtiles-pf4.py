#!/usr/bin/env python3
"""PF-4：把整包 fetch 的大 GeoJSON 轉成 PMTiles（不抽稀、不丟 feature），並逐筆驗證。

    python3 scripts/preprocess/build-static-pmtiles-pf4.py            # 全部
    python3 scripts/preprocess/build-static-pmtiles-pf4.py waste_stops # 指定目標

原則（docs/archive/2026-10-04/perf-overhaul-2026-06.md「tippecanoe 轉檔坑」）：
  - 點：-r1 + --no-feature-limit + --no-tile-size-limit（每個 zoom 都是全量）
  - 面：另加 --no-tiny-polygon-reduction；不用任何 --coalesce / --drop-* 旗標
  - 不帶 -y/-x：屬性全保留（popup / 分色 / filter 欄位名與原檔一致）
  - -ai：每個 feature 依輸入順序拿到 id，驗證時以「最高 zoom 去重 id 數 = 原檔 feature 數」
    並逐筆比對屬性與座標
輸出檔名帶 _YYYYMMDD 版本後綴（nginx 對帶日期檔名給一年 immutable 快取，不可同名覆寫）；
來源 GeoJSON 保留不動。本機可重跑（--force 覆寫同名輸出）。
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION = "20260930"

OOKLA_ATTRIBUTION = (
    "Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps · CC BY-NC-SA 4.0"
)

# minzoom 依既有圖層的顯示下限：Ookla 全球層無 minzoom（全球視角）→ Z0；
# 格網是對齊 web mercator tile 的矩形（最細 z10 cell），z6 切片 overzoom 無損 → z6。
# 清運點 layer minzoom 6 → Z6；日本宗教 OSM 比照同主題 GSI PMTiles 的 Z4–z14。
TARGETS: dict[str, dict] = {
    "ookla_mobile": {
        "src": "public/geo/ookla_mobile_global.geojson",
        "out": f"public/geo/ookla_mobile_global_{VERSION}.pmtiles",
        "layer": "ookla",
        "args": ["-Z0", "-z6", "-b", "0", "--no-tiny-polygon-reduction", "-A", OOKLA_ATTRIBUTION],
        "coord_tol": 1e-4,
    },
    "ookla_fixed": {
        "src": "public/geo/ookla_fixed_global.geojson",
        "out": f"public/geo/ookla_fixed_global_{VERSION}.pmtiles",
        "layer": "ookla",
        "args": ["-Z0", "-z6", "-b", "0", "--no-tiny-polygon-reduction", "-A", OOKLA_ATTRIBUTION],
        "coord_tol": 1e-4,
    },
    "waste_stops": {
        "src": "public/geo/waste_stops_static.geojson",
        "out": f"public/geo/waste_stops_static_{VERSION}.pmtiles",
        "layer": "waste_stops",
        "args": ["-Z6", "-z14", "-r1"],
        "coord_tol": 2e-5,
    },
    "jp_religion_osm": {
        "src": "public/world/jp_religion_osm.geojson",
        "out": f"public/world/jp_religion_osm_{VERSION}.pmtiles",
        "layer": "jp_religion_osm",
        "args": ["-Z4", "-z14", "-r1", "-A", "© OpenStreetMap contributors, ODbL"],
        "coord_tol": 2e-5,
    },
}

COMMON = ["--no-feature-limit", "--no-tile-size-limit", "-ai", "--force", "-q"]


def build(name: str, cfg: dict) -> None:
    # 以 repo 相對路徑 + cwd=ROOT 呼叫：tippecanoe 會把 -o／輸入路徑寫進 PMTiles metadata
    # （name／description／generator_options），絕對路徑會洩漏工作站路徑且讓產物不可重現（F187）。
    src, out = cfg["src"], cfg["out"]
    cmd = ["tippecanoe", "-o", str(out), "-l", cfg["layer"], *cfg["args"], *COMMON, str(src)]
    print(f"[{name}] {' '.join(cmd[1:])}")
    subprocess.run(cmd, check=True, cwd=ROOT)
    subprocess.run(["pmtiles", "verify", str(out)], check=True, cwd=ROOT)


def norm(v):
    # MVT 不分 int/float：67.0 解回 67，數值比對一律用 float
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else v


def ring_bbox(geom: dict) -> tuple[float, float, float, float]:
    pts: list = []

    def walk(c):
        if c and isinstance(c[0], (int, float)):
            pts.append(c)
        else:
            for x in c:
                walk(x)

    walk(geom["coordinates"])
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def verify(name: str, cfg: dict) -> dict:
    src, out = ROOT / cfg["src"], ROOT / cfg["out"]
    original = json.loads(src.read_text("utf-8"))["features"]
    maxz = int(next(a for a in cfg["args"] if a.startswith("-z"))[2:])
    decoded = subprocess.run(
        ["tippecanoe-decode", "-Z", str(maxz), "-z", str(maxz), str(out)],
        check=True, capture_output=True, text=True, cwd=ROOT,
    ).stdout
    doc = json.loads(decoded)
    # 同一 feature 可能被切到多個 tile（面）或落在 buffer（點）→ 依 id 合併
    seen: dict[int, dict] = {}
    for tile in doc["features"]:
        for layer in tile["features"]:
            for f in layer["features"]:
                fid = f["id"]
                if fid in seen:
                    seen[fid]["bboxes"].append(ring_bbox(f["geometry"]))
                else:
                    seen[fid] = {"props": f["properties"], "type": f["geometry"]["type"],
                                 "bboxes": [ring_bbox(f["geometry"])]}
    problems: list[str] = []
    if len(seen) != len(original):
        problems.append(f"feature 數 {len(seen)} ≠ 原檔 {len(original)}")
    max_dev = 0.0
    base = min(seen) if seen else 0  # tippecanoe -ai 依輸入順序編號（從 1 起）
    for i, feat in enumerate(original):
        got = seen.get(base + i)
        if got is None:
            problems.append(f"#{i} 缺")
            continue
        want = {k: norm(v) for k, v in (feat.get("properties") or {}).items() if v is not None}
        have = {k: norm(v) for k, v in got["props"].items()}
        if want != have:
            problems.append(f"#{i} 屬性不符 want={want} have={have}")
        if got["type"] != feat["geometry"]["type"]:
            problems.append(f"#{i} geometry {got['type']} ≠ {feat['geometry']['type']}")
        # 幾何：合併各 tile 片段的 bbox 與原幾何 bbox 比對（點＝座標本身）
        bx = got["bboxes"]
        merged = (min(b[0] for b in bx), min(b[1] for b in bx), max(b[2] for b in bx), max(b[3] for b in bx))
        dev = max(abs(a - b) for a, b in zip(merged, ring_bbox(feat["geometry"])))
        max_dev = max(max_dev, dev)
        if dev > cfg["coord_tol"]:
            problems.append(f"#{i} 座標偏移 {dev:.2e}°")
        if len(problems) > 20:
            break
    size = out.stat().st_size
    sha = subprocess.run(["shasum", "-a", "256", str(out)], check=True, capture_output=True, text=True).stdout.split()[0]
    result = {"target": name, "out": cfg["out"], "features": len(seen), "original": len(original),
              "max_coord_dev_deg": max_dev, "bytes": size, "src_bytes": src.stat().st_size, "sha256": sha}
    print(json.dumps(result, ensure_ascii=False))
    if problems:
        print("\n".join(problems[:20]), file=sys.stderr)
        raise SystemExit(f"[{name}] 驗證失敗")
    return result


def main() -> None:
    names = sys.argv[1:] or list(TARGETS)
    for name in names:
        cfg = TARGETS[name]
        build(name, cfg)
        verify(name, cfg)


if __name__ == "__main__":
    main()
