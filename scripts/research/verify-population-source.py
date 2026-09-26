#!/usr/bin/env python3
"""Verify the local 2025-12 SEGIS population source without publishing it."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import pyarrow.parquet as pq


EXPECTED_PERIOD = "114Y12M"
EXPECTED_TOWNSHIPS = 368
EXPECTED_COUNTIES = 22
EXPECTED_POPULATION = 23_299_132


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fail(message: str) -> None:
    raise ValueError(message)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analytics-root", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "runtime" / "population-source-gate-20260923.json",
    )
    args = parser.parse_args()

    root = args.analytics_root.resolve()
    raw = root / "data/raw/demographics/segis_2025_12/stat_12"
    csv_path = raw / "data.csv"
    info_path = raw / "Info.ini"
    schema_path = raw / "Schema.ini"
    parquet_path = root / "data/processed/demographics/population_by_township_monthly/population_by_township_20260530.parquet"
    township_path = root / "data/processed/demographics/township_boundary/township_boundary_20260626.geojson"
    county_path = root / "data/processed/demographics/county_boundary/county_boundary_20260626.geojson"
    for path in (csv_path, info_path, schema_path, parquet_path, township_path, county_path):
        if not path.is_file():
            fail(f"required source missing: {path}")

    info = info_path.read_text(encoding="utf-8-sig")
    schema = schema_path.read_text(encoding="utf-8-sig")
    for text in ("產品名稱=114年12月行政區人口統計_鄉鎮市區", "空間範圍=全國", "空間統計單元代碼=U01TO", "資料時間=114Y12M"):
        if text not in info:
            fail(f"Info.ini missing receipt: {text}")
    for text in ("欄位清單=COUNTY_ID,COUNTY,TOWN_ID,TOWN,H_CNT,P_CNT,M_CNT,F_CNT,INFO_TIME", "中文欄位名=人口數", "原始計量單位=人"):
        if text not in schema:
            fail(f"Schema.ini missing receipt: {text}")

    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        source_rows = [row for row in csv.DictReader(handle) if row["COUNTY_ID"] != "縣市代碼"]
    if len(source_rows) != EXPECTED_TOWNSHIPS:
        fail(f"expected {EXPECTED_TOWNSHIPS} source townships, got {len(source_rows)}")
    codes = [row["TOWN_ID"] for row in source_rows]
    if len(set(codes)) != len(codes):
        fail("duplicate SEGIS TOWN_ID")
    if {row["INFO_TIME"] for row in source_rows} != {EXPECTED_PERIOD}:
        fail("SEGIS INFO_TIME is not exactly 114Y12M")
    for row in source_rows:
        if int(row["P_CNT"]) < 0 or int(row["H_CNT"]) < 0 or int(row["P_CNT"]) != int(row["M_CNT"]) + int(row["F_CNT"]):
            fail(f"invalid population or sex total for {row['TOWN_ID']}")
    source_total = sum(int(row["P_CNT"]) for row in source_rows)
    if source_total != EXPECTED_POPULATION:
        fail(f"expected total population {EXPECTED_POPULATION}, got {source_total}")
    counties = {row["COUNTY_ID"] for row in source_rows}
    if len(counties) != EXPECTED_COUNTIES:
        fail(f"expected {EXPECTED_COUNTIES} source counties, got {len(counties)}")

    township_features = json.loads(township_path.read_text())['features']
    town_codes = {str(feature["properties"]["TOWNCODE"]) for feature in township_features}
    if len(town_codes) != EXPECTED_TOWNSHIPS or set(codes) != town_codes:
        fail("SEGIS TOWN_ID does not exactly match the 368-township boundary")
    township_counties = {str(feature["properties"]["COUNTYCODE"]) for feature in township_features}
    if counties != township_counties:
        fail("SEGIS COUNTY_ID does not exactly match the township boundary county codes")
    county_features = json.loads(county_path.read_text())['features']
    county_codes = {str(feature["properties"]["行政區域代碼"]) for feature in county_features}
    if len(county_codes) != EXPECTED_COUNTIES or counties != county_codes:
        fail("SEGIS COUNTY_ID does not exactly match the county boundary")

    parquet_rows = [row for row in pq.read_table(parquet_path).to_pylist() if row["year_month"] == "2025-12"]
    if len(parquet_rows) != EXPECTED_TOWNSHIPS:
        fail(f"expected {EXPECTED_TOWNSHIPS} parquet rows for 2025-12, got {len(parquet_rows)}")
    source_by_name = {(row["COUNTY"], row["TOWN"]): int(row["P_CNT"]) for row in source_rows}
    parquet_by_name = {(row["county_name"], row["town_name"]): int(row["population"]) for row in parquet_rows}
    if source_by_name != parquet_by_name:
        fail("parquet 2025-12 rows do not exactly reproduce SEGIS P_CNT by county/town name")

    county_population: dict[str, int] = defaultdict(int)
    county_name: dict[str, str] = {}
    for row in source_rows:
        county_population[row["COUNTY_ID"]] += int(row["P_CNT"])
        county_name[row["COUNTY_ID"]] = row["COUNTY"]
    output = {
        "schema_version": "pulse-population-source-gate/1",
        "status": "PASS_FOR_LOCAL_PREVIEW_ONLY",
        "not_published": True,
        "source": {
            "publisher": "內政部統計處社會經濟資料服務平台(SEGIS)",
            "product": "114年12月行政區人口統計_鄉鎮市區",
            "source_period": "114Y12M",
            "observation_date": "2025-12-31",
            "indicator_source_label": "人口數",
            "unit": "人",
            "scope": "行政區人口；原始 receipt 未用『戶籍』或『現住』限定詞，local preview 不得改稱任一者。",
        },
        "receipts": {
            "segis_csv": {"path": str(csv_path), "sha256": sha256(csv_path)},
            "segis_info": {"path": str(info_path), "sha256": sha256(info_path)},
            "segis_schema": {"path": str(schema_path), "sha256": sha256(schema_path)},
            "processed_parquet": {"path": str(parquet_path), "sha256": sha256(parquet_path)},
            "township_boundary": {"path": str(township_path), "sha256": sha256(township_path), "version": "township_boundary_20260626"},
            "county_boundary": {"path": str(county_path), "sha256": sha256(county_path), "version": "COUNTY_MOI_1140318"},
        },
        "validation": {
            "source_townships": len(source_rows), "source_counties": len(counties), "source_total_population": source_total,
            "all_info_time": EXPECTED_PERIOD, "sex_total_check": "P_CNT == M_CNT + F_CNT for every row",
            "township_code_join": "exact TOWN_ID == TOWNCODE", "county_code_join": "exact COUNTY_ID == COUNTYCODE == 行政區域代碼",
            "parquet_2025_12_exact_match": True,
        },
        "county_rows": [
            {"area_code": code, "area_name": county_name[code], "value": county_population[code], "status": "observed"}
            for code in sorted(county_population)
        ],
        "local_preview_r2_contract": {
            "dataset_id": "population_statistics", "indicator_id": "total_population", "level": "county",
            "release_id": "2025-12-total_population-county-local-preview", "period_start": "2025-12-31", "period_end": "2025-12-31",
            "unit": "人", "dimensions": {"population_scope": "total"}, "boundary_version": "COUNTY_MOI_1140318",
            "geometry_sha256": sha256(county_path), "coverage": {"expected": 22, "observed": 22, "missing": 0},
            "publication_gate": "Write an immutable R2 artifact and selector before registering any reader; this file is only a local source gate.",
            "comparison_gate": "Current compareRegions requires exact start/end period and boundary SHA equality. A calendar-year service numerator cannot join this 2025-12 denominator until a separately tested alignment contract is approved.",
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": output["status"], "output": str(args.output), "validation": output["validation"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
