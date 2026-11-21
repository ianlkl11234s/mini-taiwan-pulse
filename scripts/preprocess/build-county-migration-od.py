#!/usr/bin/env python3
"""縣市間遷徙流向（twCountyMigrationFlows）前端 OD 檔。

來源：taipei-gis-analytics data/processed/demographics/county_migration_od/county_migration_od_2024_2025.csv
（內政部 各直轄市、縣（市）間遷徙人口數按性別分，data.gov.tw 168209，月檔加總成年；analytics #420）。
輸出 src/data/countyMigrationOd.json（約 25 KB，前端 lazy import、隨 dist 出貨，不進 public／lock）：
  {"years": {"2025": [[origin_code, dest_code, persons, male, female], ...]}, ...}
只收 12 個月齊全、status=observed 的列；同縣市（o==d）不收。2026 年未滿 12 個月，本輪不出。

用法（mini repo 根目錄）：
  python3 scripts/preprocess/build-county-migration-od.py <analytics>/data/processed/demographics/county_migration_od/county_migration_od_2024_2025.csv
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

OUT = Path("src/data/countyMigrationOd.json")


def main() -> None:
    src = Path(sys.argv[1])
    years: dict[str, list[list]] = {}
    for row in csv.DictReader(src.open(encoding="utf-8")):
        if row["status"] != "observed" or int(row["months"]) != 12:
            raise SystemExit(f"unexpected row: {row}")
        o, d = row["origin_county_code"], row["dest_county_code"]
        if o == d:
            continue
        years.setdefault(row["year"], []).append([o, d, int(row["persons"]), int(row["male"]), int(row["female"])])
    for rows in years.values():
        rows.sort(key=lambda r: (-r[2], r[0], r[1]))
    doc = {
        "dataset_id": "county_migration_od",
        "source": "內政部 各直轄市、縣（市）間遷徙人口數按性別分（data.gov.tw 168209），月檔加總成年",
        "license": "政府資料開放授權條款-第1版",
        "unit": "人（戶籍遷徙登記）",
        "years": dict(sorted(years.items(), reverse=True)),
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(OUT, OUT.stat().st_size, {y: len(r) for y, r in years.items()})


if __name__ == "__main__":
    main()
