#!/usr/bin/env python3
"""資產清單全量核對（ASSET-1）：deploy/public-assets.lock.json 全部條目 ↔ R2 公開網域。

CI 的 assets job 只核對 deploy/asset-test-files.txt 的子集；這支由 .github/workflows/asset-lock-audit.yml 每天跑一次：
  1. 全部 lock 條目 HEAD data.itsmigu.com/site/…，比對 Content-Length 與 lock bytes（並行 ≤4，直連 R2 網域、不經 Worker）。
  2. sha256 抽樣：每天輪流整檔下載 N 筆（依日期輪替，約 596/N 天輪完一圈）；--sha-all 全量（約 3 GB，手動用）。
  3. 反向：前端 src 字面引用的資料路徑（deploy/cloudflare/site_manifest.py 的同一套掃描）不在 lock、但 R2 回 200 的檔
     ＝「線上供應中、卻沒有 sha 契約」。樣板路徑（含 ${...}）列舉不到，不在此檢查範圍。
     既有的這類檔（CI-4 之前就直接放 S3 deploy-assets、從沒進過 git，所以不在 lock）列在
     deploy/public-assets-not-in-lock.txt，只減不增：補進 lock 或不再被引用的要刪掉那一行，否則報 stale。

任何 lock 條目不符／缺檔、抽樣 sha 不符、新的「lock 外被引用」或 stale 基準 → exit 1（通知交給 schedule-watch）。
只讀公開網址、零第三方套件。用法：
  python3 scripts/monitor/audit_asset_lock.py [--lock <lock.json>] [--tree <repo 根>] [--baseline <txt>] [--sha-sample N | --sha-all] [--out <tsv>]
  python3 scripts/monitor/audit_asset_lock.py --offline   # 不連網：只檢查「前端引用 − lock − 基準」是否為空（CI quick job，PR 時擋新增）
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "deploy" / "cloudflare"))
import site_manifest as sm  # noqa: E402

CONCURRENCY = 4
# R2 公開網域會擋部分自動化 User-Agent（Python urllib 預設 UA 回 403；同 scripts/deploy/check-assets.mjs）
HEADERS = {"User-Agent": "curl/8.7.1 (pulse asset-audit)"}
# 輪替家族由 sync-rotating.mjs 管、不進 lock
ROTATING = ("climate", "global-maritime")
DATA_EXT = (".pmtiles", ".geojson", ".json", ".gz", ".png", ".jpg", ".bin", ".csv", ".arrow")

BASELINE = ROOT / "deploy" / "public-assets-not-in-lock.txt"


def read_baseline(path: Path) -> set[str]:
    """基準檔：每行一個 public/ 路徑，# 開頭為註解。回傳 /geo/x 形式（與前端引用同格式）。"""
    out = set()
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            if not line.startswith("public/"):
                raise SystemExit(f"{path}：路徑要以 public/ 開頭：{line}")
            out.add(line[len("public"):])
    return out


def url_of(r2_base: str, public_path: str) -> str:
    return r2_base + "/".join(quote(p) for p in public_path[len("public/"):].split("/"))


def sha_sample(entries: list[dict], n: int, day: dt.date) -> list[dict]:
    """依日期輪替抽 n 筆（路徑排序後取連續區段），n 天內不重複、約 len/n 天輪完一圈。"""
    if n <= 0 or not entries:
        return []
    ordered = sorted(entries, key=lambda e: e["path"])
    start = (day.toordinal() * n) % len(ordered)
    return [ordered[(start + i) % len(ordered)] for i in range(min(n, len(ordered)))]


def classify_head(entry: dict, status: int, length: int | None) -> str:
    if status != 200:
        return f"HTTP {status}"
    if length is None:
        return "沒有 Content-Length"
    return "OK" if length == entry["bytes"] else f"SIZE({length} vs lock {entry['bytes']})"


def collect_literals(tree: Path) -> dict[str, set]:
    """同 site_manifest.collect_literals（同一組檔、同一個 LIT_RE、同一個過濾），但不算行號：
    原版每個字面值都從檔頭數換行，大檔是 O(n²)，全站掃一次要 60 秒以上；這裡只需要「有沒有引用」。"""
    lits: dict[str, set] = {}
    for p in sm.iter_src(tree):
        text = p.read_text(errors="ignore")
        rel = str(p.relative_to(tree))
        for m in sm.LIT_RE.finditer(text):
            s = next(g for g in m.groups() if g is not None)
            if len(s) > 400 or "\n" in s and "${" not in s:
                continue
            lits.setdefault(s, set()).add(rel)
    return lits


def referenced_paths(tree: Path) -> set[str]:
    """前端 src／lab／entry html 字面引用的資料路徑（/geo/x.pmtiles 形式），排除輪替家族、註解範例與已知不上 S3 的引用。"""
    exact, _templates, _basenames, _btemplates = sm.build_refs(collect_literals(tree))
    out = set()
    for p in exact:
        if sm.domain_of(p) in ROTATING or p in sm.KNOWN_UNMATCHED:
            continue
        if p.lower().endswith(DATA_EXT):
            out.add(p)
    return out


def not_in_lock(refs: set[str], lock_paths: set[str]) -> list[str]:
    return sorted(p for p in refs if "public" + p not in lock_paths)


def judge_reverse(candidates: list[str], baseline: set[str]) -> tuple[list[str], list[str]]:
    """candidates：前端引用但不在 lock 的路徑。回傳 (新違規, stale 基準)。
    stale：基準裡已補進 lock 或已不被引用（不在 candidates）的行，只減不增要刪掉。"""
    cand = set(candidates)
    return sorted(cand - baseline), sorted(baseline - cand)


def _request(url: str, method: str = "HEAD"):
    req = urllib.request.Request(url, method=method, headers=HEADERS)
    for attempt in range(3):
        try:
            return urllib.request.urlopen(req, timeout=60)
        except urllib.error.HTTPError as e:
            return e
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 2:
                raise


def head(url: str) -> tuple[int, int | None]:
    try:
        with _request(url) as r:
            cl = r.headers.get("Content-Length")
            return r.status if hasattr(r, "status") else r.code, int(cl) if cl is not None else None
    except Exception as e:  # noqa: BLE001 — 網路錯誤記成狀態，不中斷全量核對
        return 0, None


def sha256_of(url: str) -> tuple[str | None, int]:
    h = hashlib.sha256()
    n = 0
    with _request(url, "GET") as r:
        if getattr(r, "status", getattr(r, "code", 0)) != 200:
            return None, 0
        while chunk := r.read(1 << 20):
            h.update(chunk)
            n += len(chunk)
    return h.hexdigest(), n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lock", default=str(ROOT / "deploy" / "public-assets.lock.json"))
    ap.add_argument("--tree", default=str(ROOT), help="掃前端引用的 repo 根（排程用 master 的 checkout）")
    ap.add_argument("--baseline", help="lock 外既有引用的基準檔（預設 --tree 下的 deploy/public-assets-not-in-lock.txt）")
    ap.add_argument("--offline", action="store_true", help="不連網，只做反向的「引用 − lock − 基準」檢查")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--sha-sample", type=int, default=6)
    g.add_argument("--sha-all", action="store_true")
    ap.add_argument("--out", help="逐筆結果 TSV")
    args = ap.parse_args()

    lock = json.loads(Path(args.lock).read_text())
    tree = Path(args.tree)
    baseline_path = Path(args.baseline) if args.baseline else tree / "deploy" / BASELINE.name
    if not baseline_path.exists():
        # master 還沒發版帶上基準檔時，退回本支腳本同一個 checkout 的版本
        print(f"::notice::{baseline_path} 不存在，改用 {BASELINE}")
        baseline_path = BASELINE
    baseline = read_baseline(baseline_path)
    lock_paths = {e["path"] for e in lock["entries"]}
    refs = referenced_paths(tree)
    candidates = not_in_lock(refs, lock_paths)
    new_rev, stale = judge_reverse(candidates, baseline)
    if args.offline:
        print(f"前端字面引用的資料路徑 {len(refs)} 個；不在 lock {len(candidates)} 個（基準 {len(baseline)}）：新增 {len(new_rev)}、stale {len(stale)}")
        for p in new_rev:
            print(f"::error::前端引用了不在 lock 的資料檔 public{p}：新資料檔要上傳 S3 並 python3 scripts/deploy/build-public-assets-lock.py add public{p}")
        for p in stale:
            print(f"::error::{baseline_path.name} 只減不增：public{p} 已補進 lock 或已不被引用，請刪掉這一行")
        return 1 if new_rev or stale else 0
    base = lock["r2_base"]
    entries = [e for e in lock["entries"] if e["delivery"] == "r2"]
    rows: list[tuple[str, str, str]] = []  # (kind, path, status)

    with ThreadPoolExecutor(CONCURRENCY) as pool:
        heads = list(pool.map(lambda e: head(url_of(base, e["path"])), entries))
    head_bad = []
    for e, (st, ln) in zip(entries, heads):
        s = classify_head(e, st, ln)
        rows.append(("head", e["path"], s))
        if s != "OK":
            head_bad.append((e["path"], s))

    picks = entries if args.sha_all else sha_sample(entries, args.sha_sample, dt.datetime.now(dt.timezone.utc).date())
    with ThreadPoolExecutor(CONCURRENCY) as pool:
        shas = list(pool.map(lambda e: sha256_of(url_of(base, e["path"])), picks))
    sha_bad = []
    for e, (sha, n) in zip(picks, shas):
        s = "OK" if sha == e["sha256"] and n == e["bytes"] else f"SHA_DIFF(bytes {n})" if sha else "下載失敗"
        rows.append(("sha256", e["path"], s))
        if s != "OK":
            sha_bad.append((e["path"], s))

    # 基準外的新引用不論 R2 有沒有都算違規；另外 HEAD 一次，報告它們（與基準）是否真的在線上供應
    with ThreadPoolExecutor(CONCURRENCY) as pool:
        rev = list(pool.map(lambda p: head(url_of(base, "public" + p)), candidates))
    served = []
    for p, (st, ln) in zip(candidates, rev):
        rows.append(("not-in-lock", "public" + p, f"R2 HTTP {st}" + (f"、{ln} bytes" if ln else "") + ("、基準內" if p in baseline else "、新增")))
        if st == 200:
            served.append(p)

    if args.out:
        Path(args.out).write_text("".join("\t".join(r) + "\n" for r in rows))
    lines = [
        f"lock {len(entries)} 筆 HEAD：{len(entries) - len(head_bad)} 相符、{len(head_bad)} 不符",
        f"sha256 抽樣 {len(picks)} 筆：{len(picks) - len(sha_bad)} 相符、{len(sha_bad)} 不符",
        f"前端字面引用的資料路徑 {len(refs)} 個；不在 lock {len(candidates)} 個（R2 供應中 {len(served)}）；"
        f"基準 {len(baseline)}：新增 {len(new_rev)}、stale {len(stale)}",
    ]
    details = [f"✗ {p}\t{s}" for p, s in head_bad + sha_bad] + [
        f"✗ 前端引用了不在 lock 的資料檔（R2 {'有' if p in served else '沒有'}）：public{p}" for p in new_rev
    ] + [f"✗ {baseline_path.name} 只減不增，已補進 lock 或已不被引用，請刪：public{p}" for p in stale]
    print("\n".join(lines + details))
    failed = bool(head_bad or sha_bad or new_rev or stale)
    for d in details:
        if d.startswith("✗"):
            print(f"::error::{d[2:]}")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write("### 資產清單全量核對\n\n" + "\n".join(f"- {l}" for l in lines + details[:60]) + "\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
