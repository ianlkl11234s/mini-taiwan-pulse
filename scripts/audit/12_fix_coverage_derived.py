#!/usr/bin/env python3
"""Mark gasCoverageAll + evIsland as pulse_only (derived spatial analysis)."""
import csv
from pathlib import Path
from collections import Counter
SCRATCH = Path("/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit")

FIXES = {
    "gasCoverageAll": "pulse-derived coverage analysis (PMTiles from gas stations + road network)",
    "evIsland":       "pulse-derived island analysis (PMTiles from EV chargers + road network)",
}

csv_path = SCRATCH / "match_final.csv"
with csv_path.open() as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())

for row in rows:
    if row["layer_key"] not in FIXES:
        continue
    row["status"] = "pulse_only"
    row["dataset_id"] = ""
    row["confidence"] = "UNMATCHED"
    row["rule"] = "coverage_derived"
    row["notes"] = f"DERIVED: {FIXES[row['layer_key']]}"

with csv_path.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

print("Final:", Counter(r["status"] for r in rows).most_common())
