#!/usr/bin/env python3
"""
Phase 4A（2026-08-12 改寫）— 對帳 match_final.csv ↔ layerManifest.ts 的 `upstream` 欄位

## 為什麼不再是「產生器」

原版把 `scratchpad/audit/{match_final,catalog_datasets,pulse_layers}.csv` 整份
**重新產生並覆蓋** `src/data/upstreamRegistry.ts`。AR-22 之後那條路壞了兩次：

1. **輸入沒了**：三個 CSV 在 session scratchpad（`/private/tmp/claude-501/…/6c00383b-…/`），
   該目錄早已消失。只有 `docs/audit/data_sources_match_final.csv` 進了版控活下來
   （`catalog_datasets.csv` 原本讀進來就沒用到，一併移除）。
2. **輸出換家了**：`upstreamRegistry.ts` 的 `HANDWRITTEN_UPSTREAM` 已空殼，
   348/348 全由 `layerManifest.ts` 的 `upstream` 欄位派生。往舊檔寫 = 寫進黑洞。

而且 CSV 是 **2026-07-01 的凍結快照**：227 個 layer_key，manifest 現在有 348 個。
無腦重生會刪掉 123 筆快照後才加的 layer，並把後來手修的血緣改回舊值
（實測：`schools` 會從 `schools/HIGH` 退回 `layer2_polygon/LOW`）。
**所以本腳本改成單向對帳器：預設只報帳不寫檔，`--apply` 也只補寫既有 entry 的
`status` / `datasets` 兩行，永不新增或刪除 entry。**

## 用法

    python3 scripts/audit/06_apply_to_pulse.py            # 對帳報告 + 會寫入什麼的 unified diff
    python3 scripts/audit/06_apply_to_pulse.py --apply     # 真的寫進 layerManifest.ts

⚠️ `--apply` 只有在「CSV 是新的那一側」才該用 —— 也就是先跑過 01→05 重新產出
`match_final.csv` 之後。拿 2026-07-01 的凍結快照 apply = 把後來的手修改回去。
dry-run 印出的 diff 就是 `--apply` 會寫下的**逐位元內容**，看完再決定。

Reads:
  - docs/audit/data_sources_match_final.csv
  - src/data/layerManifest.ts
Writes（僅 --apply）:
  - src/data/layerManifest.ts（只動既有 upstream 區塊的 status / datasets 兩行）
"""
import argparse
import csv
import difflib
import re
import sys
from collections import defaultdict
from pathlib import Path

PULSE_ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = PULSE_ROOT / "docs/audit/data_sources_match_final.csv"
MANIFEST_TS = PULSE_ROOT / "src/data/layerManifest.ts"

MANIFEST_OPEN = "export const LAYER_MANIFEST = {"
MANIFEST_CLOSE = "} satisfies Partial<"

RE_ENTRY = re.compile(r"^  ([A-Za-z][A-Za-z0-9_]*): \{$")
RE_UPSTREAM_OPEN = re.compile(r"^    upstream: \{$")
RE_BLOCK_CLOSE = re.compile(r"^    \},$")
RE_STATUS = re.compile(r'^      status: "([a-z_]+)",$')
RE_DATASETS = re.compile(r"^      datasets: \[(.*)\],$")
RE_DATASET_ITEM = re.compile(r'\{\s*datasetId:\s*"([^"]+)",\s*confidence:\s*"([^"]+)"\s*\}')
# 衍生血緣欄位 —— 出現就代表這層是本站自己算出來的，機械覆寫 status 會靜默毀掉語意
RE_LINEAGE = re.compile(r"^      (derivedFromLayers|derivedFromDatasets|derivationType|processing):")


class ManifestEntry:
    """layerManifest.ts 裡某個 layer 的 upstream 區塊在原始碼中的位置與內容。"""

    def __init__(self, key):
        self.key = key
        self.status = None
        self.status_line = None      # 行號（0-based）
        self.datasets = []           # [(datasetId, confidence), …]
        self.datasets_line = None
        self.has_lineage = False


def parse_manifest(lines):
    """行導向解析 —— 不做完整 TS parse，只認得 manifest 既有的固定縮排格式。

    刻意不用 vite-node 把 manifest 求值成 JSON：本腳本除了比對還要**回寫原檔**，
    求值拿不到行號，回寫時仍得再解析一次原始碼，不如一次到位。
    """
    try:
        start = next(i for i, ln in enumerate(lines) if ln.startswith(MANIFEST_OPEN))
        end = next(i for i, ln in enumerate(lines) if ln.startswith(MANIFEST_CLOSE))
    except StopIteration:
        sys.exit(f"✗ 認不出 {MANIFEST_TS.name} 的 LAYER_MANIFEST 區塊邊界（格式改了？）")

    entries = {}
    cur = None
    in_upstream = False
    for i in range(start + 1, end):
        ln = lines[i]
        m = RE_ENTRY.match(ln)
        if m:
            cur = ManifestEntry(m.group(1))
            entries[cur.key] = cur
            in_upstream = False
            continue
        if cur is None:
            continue
        if RE_UPSTREAM_OPEN.match(ln):
            in_upstream = True
            continue
        if in_upstream:
            if RE_BLOCK_CLOSE.match(ln):
                in_upstream = False
                continue
            m = RE_STATUS.match(ln)
            if m:
                cur.status, cur.status_line = m.group(1), i
                continue
            m = RE_DATASETS.match(ln)
            if m:
                cur.datasets = RE_DATASET_ITEM.findall(m.group(1))
                cur.datasets_line = i
                continue
            if RE_LINEAGE.match(ln):
                cur.has_lineage = True
    return entries


def load_csv():
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))
    status = {}
    datasets = defaultdict(list)
    for r in rows:
        status[r["layer_key"]] = r["status"]
        if r["dataset_id"]:
            datasets[r["layer_key"]].append((r["dataset_id"], r["confidence"]))
    return status, datasets


def render_datasets(items):
    if not items:
        return "      datasets: [],"
    body = ", ".join(f'{{ datasetId: "{d}", confidence: "{c}" }}' for d, c in items)
    return f"      datasets: [{body}],"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument(
        "--apply",
        action="store_true",
        help="把差異寫回 layerManifest.ts（只改既有 entry 的 status/datasets 兩行）",
    )
    args = ap.parse_args()

    csv_status, csv_datasets = load_csv()
    original = MANIFEST_TS.read_text(encoding="utf-8")
    lines = original.split("\n")
    entries = parse_manifest(lines)

    mismatch, blocked = [], []
    for key, csv_st in csv_status.items():
        e = entries.get(key)
        if e is None:
            continue
        want = (csv_st, sorted(csv_datasets.get(key, [])))
        have = (e.status, sorted(e.datasets))
        if want == have:
            continue
        (blocked if e.has_lineage else mismatch).append((key, have, want))

    csv_only = sorted(k for k in csv_status if k not in entries)
    manifest_only = sorted(k for k in entries if k not in csv_status)

    print(f"CSV: {CSV_PATH.relative_to(PULSE_ROOT)}（{len(csv_status)} keys，2026-07-01 凍結快照）")
    print(f"Manifest: {MANIFEST_TS.relative_to(PULSE_ROOT)}（{len(entries)} keys）")
    print(f"  ✓ 一致           : {len(set(csv_status) & set(entries)) - len(mismatch) - len(blocked)}")
    print(f"  ✗ 不一致         : {len(mismatch)}")
    for key, have, want in mismatch:
        print(f"      {key}: manifest={have[0]}{have[1]}  csv={want[0]}{want[1]}")
    if blocked:
        print(f"  ⚠ 有衍生血緣不機械覆寫（需人工判斷）: {len(blocked)}")
        for key, have, want in blocked:
            print(f"      {key}: manifest={have[0]}{have[1]}  csv={want[0]}{want[1]}")
    print(f"  ○ 只在 CSV（快照後已改名/移除的 layer，不動）: {len(csv_only)} {csv_only}")
    print(f"  ○ 只在 manifest（快照後新增的 layer，本腳本管不到）: {len(manifest_only)}")

    if not mismatch:
        print("\n無可機械同步的差異 —— 不需寫檔。")
        return

    patched = list(lines)
    for key, _have, want in mismatch:
        e = entries[key]
        if e.status_line is None or e.datasets_line is None:
            print(f"  ! {key}: upstream 區塊缺 status/datasets 行，跳過")
            continue
        patched[e.status_line] = f'      status: "{want[0]}",'
        patched[e.datasets_line] = render_datasets(want[1])

    new_text = "\n".join(patched)
    diff = list(
        difflib.unified_diff(
            original.splitlines(keepends=True),
            new_text.splitlines(keepends=True),
            fromfile=f"a/{MANIFEST_TS.relative_to(PULSE_ROOT)}",
            tofile=f"b/{MANIFEST_TS.relative_to(PULSE_ROOT)}",
            n=3,
        )
    )
    print("\n" + ("── 已寫入 ──" if args.apply else "── dry-run：--apply 會寫下的逐位元內容 ──"))
    sys.stdout.writelines(diff)

    if args.apply:
        MANIFEST_TS.write_text(new_text, encoding="utf-8")
        print(f"\n✓ 已更新 {MANIFEST_TS.relative_to(PULSE_ROOT)} —— 記得跑 npx tsc -b && npx vitest run")
    else:
        print("\n（未寫檔。確認 CSV 是較新的那一側後，加 --apply）")


if __name__ == "__main__":
    main()
