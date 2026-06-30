#!/usr/bin/env python3
"""
Phase 3.6 — Apply adversarial review findings.

Adversarial agent found 4 false positives + 1 false negative.
Validated each by inspecting catalog content directly.
"""
import csv
from pathlib import Path
from collections import Counter

SCRATCH = Path("/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit")

FIXES = {
    # False positive: taipeiSewer (real-time water level) ≠ sewage_treatment_plants (static facility)
    "taipeiSewer": ("catalog_missing", "", "", "北市下水道即時水位無對應 catalog（storm_drainage_pipes 是靜態管網，非即時水位）"),
    # False positive: ecoNetworkZones (national green-network zoning) ≠ wildlife_distribution
    "ecoNetworkZones": ("catalog_missing", "", "", "國土綠網分區無對應 catalog dataset"),
    # False positive: farmRoads (agricultural road) ≠ forest_roads (forestry road, different agency)
    "farmRoads": ("catalog_missing", "", "", "農路無對應 catalog（forest_roads 是林道，主責機關不同）"),
    # False positive: power_generation is dynamic output, fac* are static facility locations
    "facPrimary":   ("verified", "power_plants", "MED", "ADV-FIX: 應為靜態廠址 power_plants 非即時 power_generation"),
    "facSecondary": ("verified", "power_plants", "MED", "ADV-FIX: 應為靜態廠址 power_plants 非即時 power_generation"),
    # False negative: a1AccidentRealtime catalog has it!
    "a1AccidentRealtime": ("verified", "traffic_accident", "HIGH", "ADV-FIX: catalog 已有 environment/traffic_accident.md（A1+A2 警政署）"),
}

csv_path = SCRATCH / "match_final.csv"
with csv_path.open() as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
with (SCRATCH / "catalog_datasets.csv").open() as f:
    cat_ids = {r["dataset_id"] for r in csv.DictReader(f)}

# Verify all fix dataset_ids exist
for k, (st, did, conf, reason) in FIXES.items():
    if did and did not in cat_ids:
        print(f"❌ Fix dataset_id '{did}' not in catalog, aborting")
        exit(1)

changes = []
for row in rows:
    if row["layer_key"] not in FIXES:
        continue
    st, did, conf, reason = FIXES[row["layer_key"]]
    old = (row["status"], row["dataset_id"], row["confidence"])
    row["status"] = st
    row["dataset_id"] = did
    row["confidence"] = conf if st == "verified" else "UNMATCHED"
    row["rule"] = "adversarial_fix"
    row["notes"] = f"ADV: {reason}"
    new = (row["status"], row["dataset_id"], row["confidence"])
    if old != new:
        changes.append((row["layer_key"], old, new, reason))

with csv_path.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

print(f"═══ Phase 3.6 — Adversarial Fixes Applied ═══\n")
print(f"Fixes applied: {len(changes)}\n")
for k, old, new, reason in changes:
    print(f"  {k}")
    print(f"    {old[0]}/{old[1] or '—'} → {new[0]}/{new[1] or '—'}")
    print(f"    {reason}")
    print()
print("New distribution:")
for s, c in Counter(r["status"] for r in rows).most_common():
    print(f"  {s:24} {c}")
print(f"\n✓ Updated: {csv_path}")
