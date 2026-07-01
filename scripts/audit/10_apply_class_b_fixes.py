#!/usr/bin/env python3
"""
Phase 3.7 — Apply Class B fixes: catalog HAS the dataset but was mis-classified.

Findings from deep catalog search:
- aqiStations / aqiMicroSensors → air_quality (already has 77 站 + LASS AirBox in md)
- renewablePermitsTaipei → renewable (renewable.md 明確含北市 438 筆)
- fossilFuelInfra → gem_coal_plants (or general fossil_fuel subtopic — using canonical)
- taipeiSewer → storm_drainage_pipes (北市 dataset 145829)
- h3Population → population (population.md 主 pipeline 涵蓋 H3 aggregation)
"""
import csv
from pathlib import Path
from collections import Counter

SCRATCH = Path("/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit")

FIXES = {
    "aqiStations":            ("verified", "air_quality", "HIGH", "air_quality.md 明確涵蓋 77 站即時觀測 (MOENV AQX_P_432)"),
    "aqiMicroSensors":        ("verified", "air_quality", "HIGH", "air_quality.md 明確涵蓋 LASS AirBox ~500 個微感測器"),
    "renewablePermitsTaipei": ("verified", "renewable", "HIGH", "renewable.md 明確涵蓋(b) 臺北市再生能源設置 438 筆"),
    "fossilFuelInfra":        ("verified", "gem_coal_plants", "MED", "energy/gem_* 系列涵蓋化石燃料基礎設施（coal_plants 為代表）"),
    "taipeiSewer":            ("verified", "storm_drainage_pipes", "MED", "storm_drainage_pipes.md 含北市 dataset 145829 雨水下水道"),
    "h3Population":           ("verified", "population", "MED", "population.md 主 pipeline 涵蓋 H3 網格聚合"),
}

csv_path = SCRATCH / "match_final.csv"
with csv_path.open() as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
with (SCRATCH / "catalog_datasets.csv").open() as f:
    cat_ids = {r["dataset_id"] for r in csv.DictReader(f)}

for k, (st, did, conf, reason) in FIXES.items():
    if did not in cat_ids:
        print(f"❌ dataset '{did}' not in catalog, skipping {k}")
        continue

changes = []
for row in rows:
    if row["layer_key"] not in FIXES:
        continue
    st, did, conf, reason = FIXES[row["layer_key"]]
    if did not in cat_ids:
        continue
    old = (row["status"], row["dataset_id"])
    row["status"] = st
    row["dataset_id"] = did
    row["confidence"] = conf
    row["rule"] = "class_b_fix"
    row["notes"] = f"CLASS-B: {reason}"
    changes.append((row["layer_key"], old, (st, did), reason))

with csv_path.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

print(f"═══ Class B Fixes Applied: {len(changes)} ═══\n")
for k, o, n, r in changes:
    print(f"  {k}: {o[0]}/{o[1] or '—'} → {n[0]}/{n[1]}")
    print(f"    {r}")
print()
print("New distribution:")
for s, c in Counter(r["status"] for r in rows).most_common():
    print(f"  {s:24} {c}")
