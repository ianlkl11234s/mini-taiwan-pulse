#!/usr/bin/env python3
"""毒化物運作（環境部 EMS_S_05）依 EMS 管制編號聚合 → 污染潛勢設施 popup 的 lazy lookup（G19 決定 #7）。

不獨立成層、不重建 pollution_facilities.pmtiles；點污染設施時依 emsno 第 1 碼抓分片 JSON：
  public/environment/toxic_permits/{首字母}.json  →  { "<EMSNO>": [chems, activities, valid_permits, latest_edate, period] }
  public/environment/toxic_permits/_chems.json    →  [[中文名, 英文名], ...]（chems 存索引）
  public/environment/toxic_permits/_meta.json     →  資料期、筆數、出典

規則（analytics docs/topic-research/land_subsidence/layer-plan.md §4、toxic-vs-ems-comparison.md）：
  - 鍵＝upper(trim(ems_no))；座標不帶（以污染設施為準）；統編 unino、許可文號、數量不帶。
  - 化學物質／運作行為：取該設施「最新出現的 (roc_year, season)」那一季的去重清單；period 記該季。
  - 有效許可數＝同一最新季中 per_status=='有效' 的 per_no 去重數；latest_edate＝那些列 edate 最大值。
    per_status 是「該季申報當下」的狀態，跨季累加會把已過期的許可算進「有效」，所以只取最新季。
    per_status 空值是「使用／輸入」等申報類的正常狀態，不是缺值。
  - 最新季的「有效」列若 edate 早於快照日（SNAPSHOT_DATE）＝許可已到期，不計入有效許可數與 latest_edate
    （最新季可能很舊，per_status 只反映當季申報當下）。
  - 合併：舊全量 CSV（2026-07 抓）只取 ≤ 114 年第 3 季；115 年第 1、2 季用 2026-10-17 重抓檔
    （舊檔 115-1 只有 21,751 列，重抓 26,792 列＝舊檔該季不完整）。

用法：
  python3 scripts/preprocess/build-toxic-permits-lookup.py \
      --raw ../taipei-gis-analytics/data/raw/hazards/toxic_chemical_facilities
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "environment" / "toxic_permits"
NEW_SEASONS = [("115", "1"), ("115", "2")]
SNAPSHOT_DATE = "2026-10-17"  # 2026-10-17 重抓檔的抓取日；同時寫進 _meta.fetched_at


def season_key(year: str, season: str) -> tuple[int, int]:
    return int(year), int(season or 0)


def rows(raw: Path):
    with (raw / "ems_s_05_all.csv").open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if season_key(row["roc_year"], row["season"]) <= (114, 3):
                yield row
    for year, season in NEW_SEASONS:
        with (raw / "ems_s_05_115s2" / f"ems_s_05_{year}_{season}.csv").open(encoding="utf-8") as f:
            yield from csv.DictReader(f)


def main(raw: Path) -> None:
    latest: dict[str, tuple[int, int]] = {}
    by_season: dict[tuple[str, tuple[int, int]], dict] = defaultdict(lambda: {"chems": set(), "acts": set(), "permits": set(), "edate": ""})
    chem_names: dict[str, str] = {}
    total = 0
    max_period = (0, 0)
    for row in rows(raw):
        total += 1
        ems = row["ems_no"].strip().upper()
        if not ems:
            continue
        key = season_key(row["roc_year"], row["season"])
        max_period = max(max_period, key)
        if key > latest.get(ems, (0, 0)):
            latest[ems] = key
        bucket = by_season[(ems, key)]
        item = row["emi_item"].strip()
        if item:
            name = item.split("-", 1)[1] if "-" in item else item
            bucket["chems"].add(name)
            chem_names.setdefault(name, row.get("emi_ename", "").strip())
        if row["emi_type"].strip():
            bucket["acts"].add(row["emi_type"].strip())
        if row["per_status"].strip() == "有效" and row["edate"].strip() >= SNAPSHOT_DATE:
            bucket["permits"].add(row["per_no"].strip())
            if row["edate"] > bucket["edate"]:
                bucket["edate"] = row["edate"]
    chem_list = sorted(chem_names)
    chem_index = {name: i for i, name in enumerate(chem_list)}
    shards: dict[str, dict] = defaultdict(dict)
    for ems, key in sorted(latest.items()):
        bucket = by_season[(ems, key)]
        shards[ems[0]][ems] = [
            sorted(chem_index[c] for c in bucket["chems"]),
            sorted(bucket["acts"]),
            len(bucket["permits"]),
            bucket["edate"] or None,
            f"{key[0]}-{key[1]}",
        ]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()
    for letter, data in shards.items():
        (OUT_DIR / f"{letter}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT_DIR / "_chems.json").write_text(json.dumps([[n, chem_names[n]] for n in chem_list], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    meta = {"source_org": "環境部 毒性及關注化學物質運作（EMS_S_05，data.gov.tw 161616）", "source_url": "https://data.gov.tw/dataset/161616",
            "license": "政府資料開放授權條款第1版", "fetched_at": SNAPSHOT_DATE, "rows": total, "facilities": len(latest),
            "period_max": f"{max_period[0]}-{max_period[1]}", "shards": sorted(shards)}
    (OUT_DIR / "_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    size = sum(p.stat().st_size for p in OUT_DIR.glob("*.json"))
    biggest = max(OUT_DIR.glob("*.json"), key=lambda p: p.stat().st_size)
    print(f"rows {total:,} → facilities {len(latest):,}，化學物質 {len(chem_list)} 種，資料期至 {meta['period_max']}；"
          f"{len(shards)} 片共 {size:,} B（最大 {biggest.name} {biggest.stat().st_size:,} B）")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, type=Path, help="taipei-gis-analytics data/raw/hazards/toxic_chemical_facilities")
    main(ap.parse_args().raw)
