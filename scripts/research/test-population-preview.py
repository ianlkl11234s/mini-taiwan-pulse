#!/usr/bin/env python3
"""Negative tamper check for the source-backed population preview builder."""
from __future__ import annotations

import importlib.util
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

    print("population preview source-row tamper check passed")


if __name__ == "__main__":
    main()
