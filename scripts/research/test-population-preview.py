#!/usr/bin/env python3
"""Negative tamper check for the source-backed population preview builder."""
from __future__ import annotations

import importlib.util
import csv
import tempfile
from pathlib import Path


SCRIPT = Path(__file__).with_name("build-population-preview.py")
SPEC = importlib.util.spec_from_file_location("population_preview_builder", SCRIPT)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def source_rows() -> dict[str, dict[str, object]]:
    with tempfile.TemporaryDirectory() as temporary_directory:
        csv_path = Path(temporary_directory) / "segis.csv"
        csv_path.write_text(
            "COUNTY_ID,COUNTY,TOWN_ID,TOWN,P_CNT\n"
            "A,甲縣,A1,甲鎮,10\n"
            "A,甲縣,A2,乙鎮,20\n"
            "B,乙縣,B1,丙鎮,30\n",
            encoding="utf-8",
        )
        return BUILDER.source_county_rows(csv_path)


def main() -> None:
    source = source_rows()
    exact_gate = {code: dict(row) for code, row in source.items()}
    BUILDER.require_gate_rows_match_source(exact_gate, source)

    tampered_gate = {code: dict(row) for code, row in source.items()}
    tampered_gate["A"]["value"] = 31
    tampered_gate["B"]["value"] = 29
    try:
        BUILDER.require_gate_rows_match_source(tampered_gate, source)
    except ValueError as error:
        assert str(error) == "COUNTY_ROW_SOURCE_VALUE_MISMATCH: A"
    else:
        raise AssertionError("tampered county values must fail even when their total is unchanged")

    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "groups.csv"
        names = {f"C{i:02}": f"縣{i}" for i in range(22)}
        rows = [{"COUNTY_ID": f"C{i % 22:02}", "COUNTY": names[f"C{i % 22:02}"], "TOWN_ID": f"T{i}", "INFO_TIME": "114Y12M", "P_CNT": "3", "M_CNT": "1", "F_CNT": "2"} for i in range(368)]
        def write_rows():
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
                writer.writeheader(); writer.writerows(rows)
        old = BUILDER.POPULATION_GROUPS["male"]
        BUILDER.POPULATION_GROUPS["male"] = ("M_CNT", "男性人口數", 368)
        try:
            write_rows()
            result = BUILDER.population_group_rows(path, names, "male")
            assert len(result) == 22 and sum(row["value"] for row in result) == 368
            for field, value, expected in [("INFO_TIME", "114Y11M", "PERIOD_MISMATCH"), ("P_CNT", "4", "COUNTS_MISMATCH"), ("TOWN_ID", "T1", "DUPLICATE_TOWN")]:
                original = rows[0][field]; rows[0][field] = value; write_rows()
                try:
                    BUILDER.population_group_rows(path, names, "male")
                except ValueError as error:
                    assert expected in str(error)
                else:
                    raise AssertionError(f"must reject {field}")
                rows[0][field] = original
        finally:
            BUILDER.POPULATION_GROUPS["male"] = old
    print("population preview source-row and group/period tamper checks passed")


if __name__ == "__main__":
    main()
