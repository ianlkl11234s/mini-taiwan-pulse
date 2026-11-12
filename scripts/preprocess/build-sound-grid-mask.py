#!/usr/bin/env python3
"""City Sound Atlas：北北網格（src/sound/grid/gridSpec.json）的縣市範圍遮罩。

輸入：repo 內 public/base_map/county_boundary.pmtiles（內政部縣市界，tippecanoe 產，
      屬性「名稱」）。worktree 沒有大檔時用 --pmtiles 指向主 checkout。
      讀法：pmtiles extract（z12、北北 bbox）→ tippecanoe-decode → shapely 合併各縣市 tile 片段。
輸出：src/sound/grid/gridMask.generated.ts（逐列 span：[起始行, 結束行(含), 縣市碼]）。

判定規則：
  - 格子與（臺北市 ∪ 新北市）相交面積 > 0 → 在範圍內（含海岸、縣界的半格，海浪／河口需要）。
  - 縣市碼：1 = 臺北市、2 = 新北市，取與格子相交面積較大者。
  - 基隆市不在範圍內：網格中間會有一個洞（碼 0）。
  - 另印「格心在界內」的格數供比較（不寫入檔）。
z12 向量瓦片的座標精度約 10 m 以內，對 250 m 格的判定影響只在邊界格。

用法（repo 根目錄）：
  python3 scripts/preprocess/build-sound-grid-mask.py [--pmtiles <county_boundary.pmtiles>]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from datetime import date
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = ROOT / "src/sound/grid/gridSpec.json"
OUT_PATH = ROOT / "src/sound/grid/gridMask.generated.ts"
COUNTIES = {"臺北市": 1, "新北市": 2}


def load_spec() -> dict:
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def county_polygons(pmtiles: Path, spec: dict) -> dict[str, shapely.Geometry]:
    south = spec["north"] - spec["rows"] * spec["dLat"]
    east = spec["west"] + spec["cols"] * spec["dLon"]
    bbox = f"{spec['west'] - 0.05},{south - 0.05},{east + 0.05},{spec['north'] + 0.05}"
    with tempfile.TemporaryDirectory() as td:
        sub = Path(td) / "nn.pmtiles"
        subprocess.run(["pmtiles", "extract", str(pmtiles), str(sub), f"--bbox={bbox}", "--minzoom=12", "--maxzoom=12"],
                       check=True, capture_output=True)
        decoded = subprocess.run(["tippecanoe-decode", "-z12", "-Z12", str(sub)], check=True, capture_output=True).stdout
    parts: dict[str, list] = {}
    for tile in json.loads(decoded)["features"]:
        for layer in tile["features"]:
            for f in layer["features"]:
                parts.setdefault(f["properties"]["名稱"], []).append(shape(f["geometry"]).buffer(0))
    missing = [c for c in COUNTIES if c not in parts]
    if missing:
        raise SystemExit(f"county_boundary.pmtiles 找不到：{missing}")
    # 瓦片切邊的細縫：正負微小 buffer 收合
    return {c: unary_union(parts[c]).buffer(1e-7).buffer(-1e-7) for c in COUNTIES}


def build_mask(spec: dict, polys: dict[str, shapely.Geometry]) -> tuple[np.ndarray, int]:
    rows, cols = spec["rows"], spec["cols"]
    c = np.arange(cols)
    r = np.arange(rows)
    cc, rr = np.meshgrid(c, r)
    w = spec["west"] + cc * spec["dLon"]
    n = spec["north"] - rr * spec["dLat"]
    boxes = shapely.box(w, n - spec["dLat"], w + spec["dLon"], n)
    areas = []
    for name in COUNTIES:
        g = polys[name]
        shapely.prepare(g)
        areas.append(shapely.area(shapely.intersection(boxes, g)))
    areas = np.stack(areas)  # (2, rows, cols)
    code = np.where(areas.max(axis=0) > 0, areas.argmax(axis=0) + 1, 0).astype(np.uint8)
    centers = shapely.points(w + spec["dLon"] / 2, n - spec["dLat"] / 2)
    union = unary_union(list(polys.values()))
    shapely.prepare(union)
    center_in = int(shapely.contains(union, centers).sum())
    return code, center_in


def spans(code: np.ndarray) -> list[list[list[int]]]:
    out = []
    for row in code:
        rs, start = [], None
        for i, v in enumerate(list(row) + [0]):
            v = int(v)
            if start is not None and v != row_val:
                rs.append([start, i - 1, row_val])
                start = None
            if start is None and v != 0:
                start, row_val = i, v
        out.append(rs)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pmtiles", type=Path, default=ROOT / "public/base_map/county_boundary.pmtiles")
    args = ap.parse_args()
    spec = load_spec()
    polys = county_polygons(args.pmtiles, spec)
    code, center_in = build_mask(spec, polys)
    sp = spans(code)
    counts = {name: int((code == v).sum()) for name, v in COUNTIES.items()}
    total = sum(counts.values())
    lines = [
        "/* eslint-disable */",
        "// 由 scripts/preprocess/build-sound-grid-mask.py 產生，勿手改。",
        f"// 來源：public/base_map/county_boundary.pmtiles（內政部縣市界，z12 解碼）；產生日 {date.today().isoformat()}",
        "// 規則：格子與（臺北市∪新北市）相交面積 > 0 即在範圍內；縣市碼取相交面積較大者（1 臺北市、2 新北市）。",
        f"// 範圍內 {total} 格（臺北市 {counts['臺北市']}、新北市 {counts['新北市']}）；格心在界內 {center_in} 格。",
        f'export const GRID_MASK_SPEC_ID = "{spec["id"]}";',
        f"export const GRID_MASK_CELL_COUNT = {total};",
        f"export const GRID_MASK_COUNTY_CELLS = {{ taipei: {counts['臺北市']}, newTaipei: {counts['新北市']} }} as const;",
        "/** 每列的 span：[起始行, 結束行（含）, 縣市碼]；列 0 在北 */",
        "export const GRID_MASK_ROW_SPANS: readonly (readonly (readonly [number, number, number])[])[] = [",
    ]
    lines += ["  " + json.dumps(r, separators=(",", ":")) + "," for r in sp]
    lines.append("];")
    OUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"rows": spec["rows"], "cols": spec["cols"], "bboxCells": spec["rows"] * spec["cols"],
                      "inScope": total, **counts, "centerIn": center_in,
                      "spanCount": sum(len(r) for r in sp), "out": str(OUT_PATH.relative_to(ROOT))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
