#!/usr/bin/env python3
"""
Phase 3.5 — Merge hunt_results.csv into match_verified.csv

For each pulse layer, prefer hunt result if it's HIGH confidence,
else keep existing verified result. Apply known dataset_id aliases.
"""
import csv
from pathlib import Path
from collections import Counter

SCRATCH = Path("/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit")

# Known dataset_id aliases (agent simplified, but real catalog has prefix/suffix)
ALIASES = {
    "uswg_measurements": "water.uswg_measurements",
    "precipitation_raster": "water.precipitation_raster_frames",
    "ev_charging": "ev_charging_stations",
}

with (SCRATCH / "match_verified.csv").open() as f:
    existing = {r["layer_key"]: r for r in csv.DictReader(f)}
with (SCRATCH / "hunt_results.csv").open() as f:
    hunt = {r["layer_key"]: r for r in csv.DictReader(f)}
with (SCRATCH / "catalog_datasets.csv").open() as f:
    cat_ids = {r["dataset_id"] for r in csv.DictReader(f)}
with (SCRATCH / "pulse_layers.csv").open() as f:
    pulse = {r["layer_key"]: r for r in csv.DictReader(f)}


def apply_alias(ds):
    return ALIASES.get(ds, ds)


# Confidence ranking (high → low)
RANK = {"HIGH": 4, "MED": 3, "LOW": 2, "UNMATCHED": 1, "pulse_only": 0, "catalog_missing": 0}


def decide(layer_key):
    ex = existing.get(layer_key, {})
    hu = hunt.get(layer_key)
    if not hu:
        # No hunt result, keep existing
        return ex

    hu_conf = hu["confidence"]
    hu_ds = apply_alias(hu["dataset_id"])

    # Hunt special statuses
    if hu_conf == "pulse_only":
        return {
            "layer_key": layer_key,
            "dataset_id": "",
            "rule": "hunt",
            "confidence": "UNMATCHED",
            "status": "pulse_only",
            "notes": f"hunt: {hu['evidence'][:150]}",
        }
    if hu_conf == "catalog_missing":
        return {
            "layer_key": layer_key,
            "dataset_id": "",
            "rule": "hunt",
            "confidence": "UNMATCHED",
            "status": "catalog_missing",
            "notes": f"hunt: {hu['evidence'][:150]}",
        }

    # Hunt found a dataset
    if not hu_ds:
        return ex
    if hu_ds not in cat_ids:
        # Hunt picked invalid dataset_id — degrade
        return {
            "layer_key": layer_key,
            "dataset_id": "",
            "rule": "hunt_invalid",
            "confidence": "UNMATCHED",
            "status": "name_mismatch",
            "notes": f"hunt picked '{hu['dataset_id']}' not in catalog. evidence: {hu['evidence'][:120]}",
        }

    # Compare with existing
    ex_conf = ex.get("confidence", "UNMATCHED")
    ex_ds = ex.get("dataset_id", "")

    if ex_ds == hu_ds:
        # Same dataset, keep higher confidence
        chosen_conf = ex_conf if RANK.get(ex_conf, 0) >= RANK.get(hu_conf, 0) else hu_conf
        return {
            "layer_key": layer_key,
            "dataset_id": hu_ds,
            "rule": ex.get("rule", "") + "+hunt",
            "confidence": chosen_conf,
            "status": "verified",
            "notes": f"{ex.get('notes','')[:80]} | hunt: {hu['evidence'][:80]}",
        }

    if ex_ds and ex_conf in ("HIGH", "MED") and RANK[ex_conf] >= RANK[hu_conf]:
        # Existing is stronger
        return ex

    # Hunt wins
    return {
        "layer_key": layer_key,
        "dataset_id": hu_ds,
        "rule": "hunt",
        "confidence": hu_conf,
        "status": "verified",
        "notes": f"hunt overrode existing ({ex_ds or 'none'}/{ex_conf}). evidence: {hu['evidence'][:150]}",
    }


results = []
for key in pulse:
    results.append(decide(key))

# ── Write merged ──
out = SCRATCH / "match_final.csv"
fields = ["layer_key", "dataset_id", "rule", "confidence", "status", "notes"]
with out.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for r in results:
        w.writerow({k: r.get(k, "") for k in fields})

# ── Stats ──
status_counts = Counter(r["status"] for r in results)
conf_counts = Counter(r["confidence"] for r in results)

# Multi-dataset check (one dataset → many layers)
ds_to_layers = {}
for r in results:
    if r["dataset_id"]:
        ds_to_layers.setdefault(r["dataset_id"], []).append(r["layer_key"])
multi = {k: v for k, v in ds_to_layers.items() if len(v) > 1}

# Reverse validation
broken = [(r["layer_key"], r["dataset_id"]) for r in results if r["dataset_id"] and r["dataset_id"] not in cat_ids]
no_layer = [r["layer_key"] for r in results if r["layer_key"] not in pulse]

print("═══ Phase 3 — Final Verified Merge ═══\n")
print(f"Total layers:             {len(results)} (expect 227: {'✓' if len(results)==227 else '✗'})")
print(f"Broken catalog refs:      {len(broken)} {broken[:3]}")
print(f"Layer_keys not in pulse:  {len(no_layer)}")
print()
print("Status distribution:")
for s, c in status_counts.most_common():
    print(f"  {s:24} {c}")
print()
print("Confidence distribution:")
for c, n in conf_counts.most_common():
    print(f"  {c:24} {n}")
print()
verified = sum(1 for r in results if r["status"] == "verified")
print(f"Verified:                 {verified} ({verified/len(results)*100:.1f}%)")
print()
print(f"Datasets covering >1 layer: {len(multi)}")
for d, ls in sorted(multi.items(), key=lambda x: -len(x[1]))[:10]:
    print(f"  {d:40} {len(ls)}× : {', '.join(ls[:4])}{'...' if len(ls)>4 else ''}")

print(f"\n✓ Written: {out}")
