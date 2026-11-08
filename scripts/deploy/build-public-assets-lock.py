#!/usr/bin/env python3
"""產生 deploy/public-assets.lock.json：git 追蹤、>1MB 的 public/ 檔清單（BACKLOG CI-4）。

每筆記 path／bytes／sha256 與供應方式：
  r2        正式站由 R2 site/ 供應（S3 deploy-assets 的 s3_key 同步而來），之後可移出 git
  git       刻意留在 git（內容資產，例如部落格影片、截圖）
  undecided 前端沒有引用（只給測試／預處理用，或已被新版取代），去留待決定

用法（repo 根目錄）：python3 scripts/deploy/build-public-assets-lock.py [--check]
--check：只比對、不寫檔；與現況不同時 exit 1。
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

LOCK = Path("deploy/public-assets.lock.json")
MIN_BYTES = 1_048_576

KEEP_IN_GIT = {
    "public/blog/mapchallenge-2026-day07-ten-minute-map/day07-timelapse.mp4": "部落格內容資產",
    "public/screenshots/taiwan-flight-arc.png": "頁面截圖",
    "public/screenshots/mini-taiwan.png": "頁面截圖",
}
UNDECIDED = {
    "public/geo/ookla_fixed_global.geojson": "只有 staticDataContract 測試讀；前端改走 _20260930.pmtiles",
    "public/geo/ookla_mobile_global.geojson": "只有 staticDataContract 測試讀；前端改走 _20260930.pmtiles",
    "public/geo/waste_stops_static.geojson": "預處理來源與 wasteStopsChatDataset 測試讀；前端不載入",
    "public/world/gb_coastal_erosion.pmtiles": "已由 gb_coastal_erosion_v2.pmtiles 取代，前端無引用",
    "public/world/jp_religion_osm.geojson": "前端改走 jp_religion_osm_20260930.pmtiles，無引用",
}
# rail/ 由 rail.tar.gz 整包供應（site_manifest.py 的 rail-tar 規則）
TARBALL = {"public/rail/routes_static.geojson": "deploy-assets/rail.tar.gz"}


def s3_key(path: str) -> str:
    rel = path[len("public/"):]
    if path in TARBALL:
        return TARBALL[path]
    if rel.startswith("h3/"):  # S3 h3 維持扁平（site_manifest.py SYNCS 的 h3 規則）
        return "deploy-assets/" + rel.split("/", 1)[1]
    return "deploy-assets/" + rel


def build() -> dict:
    out = subprocess.run(["git", "ls-files", "-z", "public"], check=True, capture_output=True).stdout
    entries = []
    for raw in out.split(b"\0"):
        if not raw:
            continue
        path = raw.decode()
        p = Path(path)
        if not p.is_file() or p.stat().st_size <= MIN_BYTES:
            continue
        data = p.read_bytes()
        e = {"path": path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        if path in KEEP_IN_GIT:
            e.update(delivery="git", note=KEEP_IN_GIT[path])
        elif path in UNDECIDED:
            e.update(delivery="undecided", note=UNDECIDED[path])
        else:
            e.update(delivery="r2", s3_key=s3_key(path))
        entries.append(e)
    entries.sort(key=lambda e: e["path"])
    return {
        "_comment": "CI-4：git 追蹤 >1MB 的 public/ 檔。由 scripts/deploy/build-public-assets-lock.py 產生，勿手改。",
        "min_bytes": MIN_BYTES,
        "r2_base": "https://data.itsmigu.com/site/",
        "entries": entries,
    }


def main() -> int:
    lock = build()
    text = json.dumps(lock, ensure_ascii=False, indent=1) + "\n"
    if "--check" in sys.argv:
        if not LOCK.exists() or LOCK.read_text() != text:
            print(f"{LOCK} 與現況不同，請重跑 python3 scripts/deploy/build-public-assets-lock.py", file=sys.stderr)
            return 1
        return 0
    LOCK.write_text(text)
    by = {}
    for e in lock["entries"]:
        by.setdefault(e["delivery"], [0, 0])
        by[e["delivery"]][0] += 1
        by[e["delivery"]][1] += e["bytes"]
    for k, (n, b) in sorted(by.items()):
        print(f"{k}: {n} 檔 {b / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
