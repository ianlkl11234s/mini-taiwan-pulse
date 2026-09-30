#!/usr/bin/env python3
"""
一次性轉換：public/bus/*_bus_routes.json 與 tourist_shuttle_routes.json 去掉可推導的 cumDist，
其他欄位與座標原封不動。
  - 走 S3 的 4 個大檔（BIG_FILES）→ 輸出 <name>_v2.json（舊檔保留，換檔名避開快取）
  - 其餘進 git 的縣市小檔 → 原地覆寫（舊內容留在 git 歷史；loader 兩種格式都吃）
  - chiayi_bus_routes.json 不動：src/research/busRouteDatasetAdapter.ts 以該檔 SHA-256
    作研究資料集身分，已記錄於 analysis 驗收證據（runtime/n03-*）
已無 cumDist 的檔案自動略過（可重跑）。

cumDist 由前端 busLoader.computeCumDist 依 coords 重算；本腳本先以原產生腳本
（preprocess-bus-routes.py / taipei-gis-analytics 08_build_tourist_shuttle_routes.py）
相同公式 round(cum, 6) 逐點核對原檔，任一不符即中止（代表該檔 cumDist 不可推導）。

用法：python3 scripts/preprocess/strip_bus_cumdist.py
"""
import glob
import json
import math
import os
import sys

BUS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public", "bus")
BIG_FILES = {
    "taipei_bus_routes.json",
    "intercity_bus_routes.json",
    "pingtungcounty_bus_routes.json",
    "tourist_shuttle_routes.json",
}
SKIP_FILES = {"chiayi_bus_routes.json"}


def compute_cum_dist(coords):
    # 與 preprocess-bus-routes.py compute_cum_dist 完全一致
    cum = [0.0]
    for i in range(1, len(coords)):
        dx = coords[i][0] - coords[i - 1][0]
        dy = coords[i][1] - coords[i - 1][1]
        cum.append(cum[-1] + math.sqrt(dx * dx + dy * dy))
    return cum


def convert(src, in_place):
    dst = src if in_place else src[: -len(".json")] + "_v2.json"
    src_size = os.path.getsize(src)
    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    if not any("cumDist" in r for r in data.values()):
        print(f"{os.path.basename(src)}: 已無 cumDist，略過")
        return
    out = {}
    for key, r in data.items():
        cum = compute_cum_dist(r["coords"])
        if [round(v, 6) for v in cum] != r["cumDist"]:
            sys.exit(f"ABORT {os.path.basename(src)} {key}: cumDist 與重算不符")
        if round(cum[-1], 6) != r["totalDist"]:
            sys.exit(f"ABORT {os.path.basename(src)} {key}: totalDist 與重算不符")
        out[key] = {k: v for k, v in r.items() if k != "cumDist"}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    # 回讀核對：除 cumDist 外逐欄相等
    with open(dst, encoding="utf-8") as f:
        back = json.load(f)
    assert back.keys() == data.keys()
    for key, r in data.items():
        assert back[key] == {k: v for k, v in r.items() if k != "cumDist"}, key
    print(f"{os.path.basename(src)} → {os.path.basename(dst)}  routes={len(data)}  "
          f"{src_size:,} → {os.path.getsize(dst):,} bytes")


def main():
    files = sorted(glob.glob(os.path.join(BUS_DIR, "*_bus_routes.json")))
    files.append(os.path.join(BUS_DIR, "tourist_shuttle_routes.json"))
    for src in files:
        name = os.path.basename(src)
        if name in SKIP_FILES:
            continue
        convert(src, in_place=name not in BIG_FILES)


if __name__ == "__main__":
    main()
