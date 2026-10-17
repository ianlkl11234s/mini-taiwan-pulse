#!/usr/bin/env python3
"""Build a local-only, content-addressed county population preview from a verified gate."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
from typing import Any


EXPECTED_COUNTIES = 22
EXPECTED_TOTAL = 23_299_132
SCHEMA_VERSION = "regional-statistics-cdn-v1"
RELEASE_ID = "2025-12-total_population-county-local-preview"
OBSERVATION_DATE = "2025-12-31"
POPULATION_GROUPS = {
    "male": ("M_CNT", "男性人口數", 11_462_401),
    "female": ("F_CNT", "女性人口數", 11_836_731),
}


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(value, dict), f"JSON_OBJECT_REQUIRED: {path}")
    return value


def verify_input_receipts(gate: dict[str, Any]) -> dict[str, str]:
    receipts = gate.get("receipts")
    require(isinstance(receipts, dict), "SOURCE_GATE_RECEIPTS_REQUIRED")
    hashes: dict[str, str] = {}
    for name in ("segis_csv", "segis_info", "segis_schema", "processed_parquet", "township_boundary", "county_boundary"):
        receipt = receipts.get(name)
        require(isinstance(receipt, dict), f"SOURCE_GATE_RECEIPT_REQUIRED: {name}")
        path = Path(str(receipt.get("path", "")))
        expected = receipt.get("sha256")
        require(path.is_file() and isinstance(expected, str) and len(expected) == 64, f"SOURCE_GATE_RECEIPT_INVALID: {name}")
        actual = sha256_file(path)
        require(actual == expected, f"SOURCE_GATE_RECEIPT_SHA_MISMATCH: {name}")
        hashes[name] = actual
    return hashes


def county_codes(boundary_path: Path) -> tuple[set[str], dict[str, str]]:
    boundary = read_json(boundary_path)
    features = boundary.get("features")
    require(isinstance(features, list), "COUNTY_BOUNDARY_FEATURES_REQUIRED")
    pairs: dict[str, str] = {}
    for feature in features:
        props = feature.get("properties") if isinstance(feature, dict) else None
        code = props.get("行政區域代碼") if isinstance(props, dict) else None
        name = props.get("名稱") if isinstance(props, dict) else None
        require(isinstance(code, str) and code and isinstance(name, str) and name, "COUNTY_BOUNDARY_CODE_NAME_REQUIRED")
        require(code not in pairs, "COUNTY_BOUNDARY_DUPLICATE_CODE")
        pairs[code] = name
    require(len(pairs) == EXPECTED_COUNTIES, "COUNTY_BOUNDARY_COUNT_MISMATCH")
    return set(pairs), pairs


def source_county_rows(csv_path: Path) -> dict[str, dict[str, Any]]:
    values: dict[str, dict[str, Any]] = {}
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        for source_row in csv.DictReader(handle):
            if source_row.get("COUNTY_ID") == "縣市代碼":
                continue
            code, name, population = source_row.get("COUNTY_ID"), source_row.get("COUNTY"), source_row.get("P_CNT")
            require(isinstance(code, str) and code and isinstance(name, str) and name and isinstance(population, str), "SEGIS_COUNTY_ROW_REQUIRED")
            try:
                value = int(population)
            except ValueError as error:
                raise ValueError(f"SEGIS_COUNTY_POPULATION_INVALID: {code}") from error
            require(value >= 0, f"SEGIS_COUNTY_POPULATION_NEGATIVE: {code}")
            existing = values.get(code)
            if existing is None:
                values[code] = {"area_code": code, "area_name": name, "value": value, "status": "observed"}
            else:
                require(existing["area_name"] == name, f"SEGIS_COUNTY_NAME_MISMATCH: {code}")
                existing["value"] += value
    require(values, "SEGIS_COUNTY_ROWS_REQUIRED")
    return values


def require_gate_rows_match_source(gate_rows: dict[str, dict[str, Any]], source_rows: dict[str, dict[str, Any]]) -> None:
    require(set(gate_rows) == set(source_rows), "COUNTY_ROW_SOURCE_CODE_SET_MISMATCH")
    for code, source_row in source_rows.items():
        gate_row = gate_rows[code]
        require(gate_row["area_name"] == source_row["area_name"], f"COUNTY_ROW_SOURCE_NAME_MISMATCH: {code}")
        require(gate_row["value"] == source_row["value"], f"COUNTY_ROW_SOURCE_VALUE_MISMATCH: {code}")


def population_group_rows(csv_path: Path, names: dict[str, str], group: str) -> list[dict[str, Any]]:
    field, _, expected_total = POPULATION_GROUPS[group]
    values = {code: {"area_code": code, "area_name": name, "value": 0, "status": "observed"} for code, name in names.items()}
    seen: set[str] = set()
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("COUNTY_ID") == "縣市代碼":
                continue
            town, code = row.get("TOWN_ID"), row.get("COUNTY_ID")
            require(bool(town) and town not in seen, "POPULATION_GROUP_DUPLICATE_TOWN")
            seen.add(town)
            require(row.get("INFO_TIME") == "114Y12M", "POPULATION_GROUP_PERIOD_MISMATCH")
            require(code in values and row.get("COUNTY") == names[code], "POPULATION_GROUP_BOUNDARY_MISMATCH")
            counts = {key: int(row[key]) for key in ("P_CNT", "M_CNT", "F_CNT")}
            require(all(value >= 0 for value in counts.values()) and counts["P_CNT"] == counts["M_CNT"] + counts["F_CNT"], "POPULATION_GROUP_COUNTS_MISMATCH")
            values[code]["value"] += counts[field]
    require(len(seen) == 368 and len(values) == EXPECTED_COUNTIES, "POPULATION_GROUP_COVERAGE_MISMATCH")
    require(sum(row["value"] for row in values.values()) == expected_total, "POPULATION_GROUP_TOTAL_MISMATCH")
    return [values[code] for code in sorted(values)]


def canonical_rows(gate: dict[str, Any], names: dict[str, str], segis_csv_path: Path) -> list[dict[str, Any]]:
    rows = gate.get("county_rows")
    require(isinstance(rows, list), "SOURCE_GATE_COUNTY_ROWS_REQUIRED")
    values: dict[str, dict[str, Any]] = {}
    for row in rows:
        require(isinstance(row, dict), "COUNTY_ROW_OBJECT_REQUIRED")
        code, name, value, status = row.get("area_code"), row.get("area_name"), row.get("value"), row.get("status")
        require(isinstance(code, str) and isinstance(name, str), "COUNTY_ROW_CODE_NAME_REQUIRED")
        require(status == "observed" and isinstance(value, int) and value > 0, "COUNTY_ROW_OBSERVED_POSITIVE_REQUIRED")
        require(code not in values, "COUNTY_ROW_DUPLICATE_CODE")
        require(names.get(code) == name, "COUNTY_ROW_BOUNDARY_NAME_MISMATCH")
        values[code] = {"area_code": code, "area_name": name, "value": value, "status": status}
    require(len(values) == EXPECTED_COUNTIES, "COUNTY_ROW_COUNT_MISMATCH")
    require(sum(row["value"] for row in values.values()) == EXPECTED_TOTAL, "COUNTY_TOTAL_MISMATCH")
    source_rows = source_county_rows(segis_csv_path)
    require(len(source_rows) == EXPECTED_COUNTIES, "SEGIS_COUNTY_COUNT_MISMATCH")
    require(sum(row["value"] for row in source_rows.values()) == EXPECTED_TOTAL, "SEGIS_COUNTY_TOTAL_MISMATCH")
    require_gate_rows_match_source(values, source_rows)
    return [values[code] for code in sorted(values)]


def build_artifact(gate: dict[str, Any], rows: list[dict[str, Any]], input_hashes: dict[str, str]) -> dict[str, Any]:
    source, receipts, contract = gate["source"], gate["receipts"], gate["local_preview_r2_contract"]
    require(source.get("product") == "114年12月行政區人口統計_鄉鎮市區", "SOURCE_PRODUCT_MISMATCH")
    require(source.get("source_period") == "114Y12M" and source.get("observation_date") == OBSERVATION_DATE, "SOURCE_PERIOD_MISMATCH")
    require(contract.get("boundary_version") == "COUNTY_MOI_1140318", "COUNTY_BOUNDARY_VERSION_MISMATCH")
    require(contract.get("geometry_sha256") == input_hashes["county_boundary"], "COUNTY_BOUNDARY_SHA_MISMATCH")
    return {
        "schema_version": SCHEMA_VERSION,
        "values": {
            "status": "OK",
            "release": {
                "release_id": RELEASE_ID,
                "dataset_id": "population_statistics",
                "indicator_id": "total_population",
                "boundary_version": "COUNTY_MOI_1140318",
                "period_start": OBSERVATION_DATE,
                "period_end": OBSERVATION_DATE,
                "levels": ["county"],
            },
            "area_level": "county",
            "total": EXPECTED_COUNTIES,
            "returned": EXPECTED_COUNTIES,
            "truncated": False,
            "next_offset": None,
            "observations": rows,
        },
        "sources": {"status": "OK", "source": {
            "id": "segis-114y12m-administrative-population",
            "dataset_id": "population_statistics",
            "indicator_id": "total_population",
            "publisher": source["publisher"],
            "source_product": source["product"],
            "source_period": "114Y12M",
            "observation_date": OBSERVATION_DATE,
            "population_label": "行政區人口數",
            "population_scope_note": "原始 receipt 僅定義行政區人口統計／人口數，未限定戶籍或現住。",
            "unit": "人",
            "license": "unknown (retained SEGIS receipts do not state a license)",
            "boundary_version": "COUNTY_MOI_1140318",
            "boundary_sha256": input_hashes["county_boundary"],
            "input_sha256": input_hashes,
            "processing_summary": "2025-12 township P_CNT aggregated by exact COUNTY_ID == COUNTYCODE == 行政區域代碼; no population category is inferred.",
        }},
        "health": {
            "status": "OK",
            "publication_status": "LOCAL_ONLY",
            "coverage_status": "COMPLETE",
            "coverage_numerator": EXPECTED_COUNTIES,
            "coverage_denominator": EXPECTED_COUNTIES,
            "currency": "人",
            "source_snapshot": "historical_2025-12-31",
        },
        "geometry": {"status": "OK", "geometry": {
            "resource": "local-preview://county_boundary_20260626.geojson",
            "sha256": input_hashes["county_boundary"],
            "code_scheme": "TW_MOI_COUNTY",
            "code_property": "行政區域代碼",
            "name_property": "名稱",
            "boundary_version": "COUNTY_MOI_1140318",
            "level": "county",
        }},
        "local_preview_contract": {
            "dimensions": {"population_scope": "total"},
            "not_published": True,
            "source_gate_receipts": {name: receipts[name]["sha256"] for name in receipts},
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-gate", type=Path, default=Path("../runtime/population-source-gate-20260923.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("../runtime/population-preview"))
    parser.add_argument("--population-group", choices=["total", *POPULATION_GROUPS], default="total")
    args = parser.parse_args()

    gate = read_json(args.source_gate)
    require(gate.get("status") == "PASS_FOR_LOCAL_PREVIEW_ONLY" and gate.get("not_published") is True, "SOURCE_GATE_NOT_LOCAL_PREVIEW_READY")
    input_hashes = verify_input_receipts(gate)
    boundary_path = Path(gate["receipts"]["county_boundary"]["path"])
    expected_codes, names = county_codes(boundary_path)
    rows = canonical_rows(gate, names, Path(gate["receipts"]["segis_csv"]["path"]))
    require({row["area_code"] for row in rows} == expected_codes, "COUNTY_CODE_SET_MISMATCH")

    artifact = build_artifact(gate, rows, input_hashes)
    if args.population_group != "total":
        group = args.population_group
        field, label, _ = POPULATION_GROUPS[group]
        rows = population_group_rows(Path(gate["receipts"]["segis_csv"]["path"]), names, group)
        indicator = f"{group}_population"
        artifact["values"]["observations"] = rows
        artifact["values"]["release"].update(dataset_id=f"population_statistics:{group}", indicator_id=indicator, release_id=f"2025-12-{indicator}-county-local-preview")
        artifact["sources"]["source"].update(dataset_id=f"population_statistics:{group}", indicator_id=indicator, population_label=label,
            processing_summary=f"2025-12 township {field} aggregated by exact COUNTY_ID; P_CNT=M_CNT+F_CNT verified for all 368 townships; no observation period inferred from export time.")
        artifact["local_preview_contract"]["dimensions"] = {"population_scope": group}
    artifact_bytes = canonical_bytes(artifact)
    artifact_sha = sha256_bytes(artifact_bytes)
    rows_sha = sha256_bytes(canonical_bytes(rows))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = args.output_dir / f"{artifact_sha}.json"
    artifact_path.write_bytes(artifact_bytes)
    require(sha256_file(artifact_path) == artifact_sha, "ARTIFACT_READBACK_SHA_MISMATCH")

    receipt = {
        "schema_version": "pulse-population-preview-receipt/1",
        "status": "PASS_LOCAL_PREVIEW_ONLY",
        "not_published": True,
        "artifact": {"path": artifact_path.name, "sha256": artifact_sha, "bytes": len(artifact_bytes)},
        "canonical_county_rows": {"sha256": rows_sha, "count": len(rows), "total_population": sum(row["value"] for row in rows)},
        "checks": {
            "source_gate_status": gate["status"],
            "input_receipt_sha256": input_hashes,
            "county_boundary_sha256": input_hashes["county_boundary"],
            "county_boundary_version": "COUNTY_MOI_1140318",
            "county_code_set_equals_boundary": True,
            "county_code_count": EXPECTED_COUNTIES,
            "all_rows_observed_positive": True,
            "total_population_equals_23299132": True,
            "artifact_readback_sha256_equals_filename": True,
        },
        "reproduction": "python3 scripts/research/build-population-preview.py --source-gate ../runtime/population-source-gate-20260923.json --output-dir ../runtime/population-preview",
    }
    receipt_name = "local-preview-receipt.json"
    if args.population_group != "total":
        receipt_name = f"{args.population_group}-preview-receipt.json"
        receipt["canonical_county_rows"]["total_value"] = receipt["canonical_county_rows"].pop("total_population")
        receipt["checks"].pop("total_population_equals_23299132")
        receipt["checks"]["population_group"] = args.population_group
        receipt["checks"]["source_group_total_verified"] = True
        receipt["reproduction"] += f" --population-group {args.population_group}"
    (args.output_dir / receipt_name).write_bytes(canonical_bytes(receipt))
    print(json.dumps({"artifact": str(artifact_path), "receipt": str(args.output_dir / receipt_name), "sha256": artifact_sha}, ensure_ascii=False))


if __name__ == "__main__":
    main()
