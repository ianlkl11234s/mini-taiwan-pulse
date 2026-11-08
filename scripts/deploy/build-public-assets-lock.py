#!/usr/bin/env python3
"""維護 deploy/public-assets.lock.json：public/ 所有資料檔的正本清單（BACKLOG CI-4，計畫見 docs/features/public-assets-r2/PLAN.md）。

lock 是正本：資料檔移出 git 後，本機與 CI 都沒有實體檔，檢查一律對 lock。
每筆記 path／bytes／sha256 與供應方式（delivery）：
  r2        由 R2 site/ 供應（S3 deploy-assets 的 s3_key 同步而來；site_manifest.py 第 4 步依 lock 同步，前端不讀的測試檔也帶上）
  pending   輪替家族 /climate/ 的 git 舊快照（R2 由 sync-rotating 供應），移出 git 時從 lock 刪除
網站素材（KEEP_PATTERNS：部落格圖片與影片、截圖、showcase 程式、robots／sitemap／llms.txt、根目錄 html）
留在 git，不進 lock。

用法（repo 根目錄）：
  python3 scripts/deploy/build-public-assets-lock.py            # 重算：git 追蹤的資料檔 ＋ lock 既有條目
  python3 scripts/deploy/build-public-assets-lock.py --check    # 只比對、不寫檔；不一致 exit 1
  python3 scripts/deploy/build-public-assets-lock.py add <public/...> ...     # 新增或更新資產（讀本機檔算 bytes／sha256）
  python3 scripts/deploy/build-public-assets-lock.py remove <public/...> ...  # 刪除條目（資產下架）

新增靜態資產的流程：檔案放在本機 public/<dir>/（不要 git add）→ `add` → upload-deploy-assets.sh 末段依 lock 上傳 S3
→ 發版時同步到 R2。重算時本機有實體檔才重算 bytes／sha256，沒有實體檔就沿用 lock 既有值。
"""
from __future__ import annotations

import fnmatch
import hashlib
import json
import subprocess
import sys
from pathlib import Path

LOCK = Path("deploy/public-assets.lock.json")
R2_BASE = "https://data.itsmigu.com/site/"

# 留在 git 的網站素材（fnmatch，* 會跨斜線）。改這裡要同步 CI test job 的 sparse-checkout（.github/workflows/ci.yml）。
KEEP_PATTERNS = [
    "public/blog/*",
    "public/screenshots/*",
    "public/showcase/*",
    "public/llms.txt",
    "public/public_life/README.md",  # 資料夾說明文件
    "public/robots.txt",
    "public/sitemap.xml",
    "public/*.html",  # 只限根目錄（is_keep 另外檢查沒有子目錄）
]

# 前端不讀、只有測試或研究在讀：一樣由 lock 驅動同步到 R2（site_manifest.py 第 4 步），check:assets 才下載得到（B2）
TEST_ONLY = {
    "public/geo/ookla_fixed_global.geojson": "只有 staticDataContract 測試讀；前端改走 _20260930.pmtiles",
    "public/geo/ookla_mobile_global.geojson": "只有 staticDataContract 測試讀；前端改走 _20260930.pmtiles",
    "public/geo/waste_stops_static.geojson": "預處理來源與 wasteStopsChatDataset 測試讀；前端不載入",
    "public/forestry/hiking_trails.geojson": "只有研究 sidecar（hikingTrailsOwnerDataset）讀；前端走 .pmtiles",
    "public/forestry/forest_reserve.pmtiles": "deployContract 收據比對用；正式站走 R2 releases/<sha>/ 路徑",
}
# /climate/ 是輪替家族（sync-rotating.mjs 每天覆寫 R2），git 那份是舊快照；移出 git 時一併從 lock 刪除
PENDING_DIRS = {"climate"}
PENDING_FILES: dict[str, str] = {}
# rail/ 由 rail.tar.gz 整包供應（site_manifest.py 的 rail-tar 規則）
TARBALL = {"public/rail/routes_static.geojson": "deploy-assets/rail.tar.gz"}


def is_keep(path: str) -> bool:
    for p in KEEP_PATTERNS:
        if not fnmatch.fnmatchcase(path, p):
            continue
        if p.count("/") == 1 and path.count("/") > 1:  # 根目錄規則不跨子目錄
            continue
        return True
    return False


def s3_key(path: str) -> str:
    rel = path[len("public/"):]
    if path in TARBALL:
        return TARBALL[path]
    if rel.startswith("h3/"):  # S3 h3 維持扁平（site_manifest.py SYNCS 的 h3 規則）
        return "deploy-assets/" + rel.split("/", 1)[1]
    return "deploy-assets/" + rel


def classify(path: str) -> dict:
    top = path.split("/")[1] if path.count("/") > 1 else ""
    if path in TEST_ONLY:
        return {"delivery": "r2", "s3_key": s3_key(path), "note": TEST_ONLY[path]}
    if path in PENDING_FILES:
        return {"delivery": "pending", "note": PENDING_FILES[path]}
    if top in PENDING_DIRS:
        return {"delivery": "pending", "note": f"/{top}/ 是輪替家族，R2 由 sync-rotating 供應；git 舊快照待移出"}
    return {"delivery": "r2", "s3_key": s3_key(path)}


def measure(path: str) -> dict:
    data = Path(path).read_bytes()
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def git_data_files() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z", "public"], check=True, capture_output=True).stdout
    return [p for p in (raw.decode() for raw in out.split(b"\0") if raw) if not is_keep(p)]


def load_existing() -> dict[str, dict]:
    if not LOCK.exists():
        return {}
    return {e["path"]: e for e in json.loads(LOCK.read_text())["entries"]}


def entry(path: str, existing: dict[str, dict]) -> dict:
    if Path(path).is_file():
        size = measure(path)
    elif path in existing:
        size = {"bytes": existing[path]["bytes"], "sha256": existing[path]["sha256"]}
    else:
        raise SystemExit(f"{path}：本機沒有檔案、lock 也沒有舊條目，無法登記")
    return {"path": path, **size, **classify(path)}


def render(entries: dict[str, dict]) -> str:
    lock = {
        "_comment": "CI-4：public/ 所有資料檔的正本清單（網站素材除外）。由 scripts/deploy/build-public-assets-lock.py 產生，勿手改。",
        "r2_base": R2_BASE,
        "keep_patterns": KEEP_PATTERNS,
        "entries": [entries[p] for p in sorted(entries)],
    }
    return json.dumps(lock, ensure_ascii=False, indent=1) + "\n"


def rebuild(existing: dict[str, dict]) -> dict[str, dict]:
    # 網站素材不進 lock（v1 lock 曾把部落格影片、截圖記成 delivery=git，重算時移除）
    paths = {p for p in existing if not is_keep(p)} | set(git_data_files())
    return {p: entry(p, existing) for p in paths}


def main(argv: list[str]) -> int:
    existing = load_existing()
    if argv and argv[0] in ("add", "remove"):
        paths = argv[1:]
        if not paths or any(not p.startswith("public/") for p in paths):
            print("路徑要以 public/ 開頭", file=sys.stderr)
            return 2
        entries = rebuild(existing)
        for p in paths:
            if argv[0] == "add":
                if is_keep(p):
                    print(f"{p} 是網站素材（KEEP_PATTERNS），不進 lock", file=sys.stderr)
                    return 2
                if not Path(p).is_file():
                    print(f"{p} 本機不存在", file=sys.stderr)
                    return 2
                entries[p] = {"path": p, **measure(p), **classify(p)}
            else:
                entries.pop(p, None)
        LOCK.write_text(render(entries))
        print(f"{argv[0]} {len(paths)} 筆；lock 共 {len(entries)} 筆")
        return 0
    text = render(rebuild(existing))
    if "--check" in argv:
        if not LOCK.exists() or LOCK.read_text() != text:
            print(f"{LOCK} 與現況不同（git 追蹤的資料檔不在 lock，或本機檔的 bytes／sha256 與 lock 不符），"
                  "請重跑 python3 scripts/deploy/build-public-assets-lock.py", file=sys.stderr)
            return 1
        return 0
    LOCK.write_text(text)
    by: dict[str, list[int]] = {}
    for e in json.loads(text)["entries"]:
        by.setdefault(e["delivery"], [0, 0])
        by[e["delivery"]][0] += 1
        by[e["delivery"]][1] += e["bytes"]
    for k, (n, b) in sorted(by.items()):
        print(f"{k}: {n} 檔 {b / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
