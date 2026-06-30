#!/usr/bin/env python3
"""
Phase 3.5 — Fix pulse_only over-classification.

The hunt agent lazily marked 33 layers as pulse_only when many actually have
upstream datasets. This script re-classifies them based on real catalog content.

Reads:
  - scratchpad/audit/match_final.csv
Writes:
  - scratchpad/audit/match_final.csv (in-place update)
  - scratchpad/audit/08_pulse_only_fix_report.md
"""
import csv
from pathlib import Path
from collections import Counter

SCRATCH = Path("/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit")

# Manual mapping based on catalog inspection
# Format: layer_key → (new_status, dataset_ids[], confidence, reason)
CORRECTIONS = {
    # === 太空 16 個：全部 catalog_missing（CelesTrak 沒登錄）===
    "satellitesTaiwan":   ("catalog_missing", [], "", "CelesTrak/Space-Track 外部 API，catalog 未登錄衛星追蹤源"),
    "satellitesYaogan":   ("catalog_missing", [], "", "同上"),
    "satellitesJilin":    ("catalog_missing", [], "", "同上"),
    "satellitesGaofen":   ("catalog_missing", [], "", "同上"),
    "satellitesTJS":      ("catalog_missing", [], "", "同上"),
    "satellitesBeidou":   ("catalog_missing", [], "", "同上"),
    "satellitesShiyan":   ("catalog_missing", [], "", "同上"),
    "satellitesUSA":      ("catalog_missing", [], "", "同上"),
    "satellitesJapan":    ("catalog_missing", [], "", "同上"),
    "satellitesRussia":   ("catalog_missing", [], "", "同上"),
    "satellitesIndia":    ("catalog_missing", [], "", "同上"),
    "satellitesKorea":    ("catalog_missing", [], "", "同上"),
    "satellitesFrance":   ("catalog_missing", [], "", "同上"),
    "satellitesGermany":  ("catalog_missing", [], "", "同上"),
    "satellitesItaly":    ("catalog_missing", [], "", "同上"),
    "satellitesIsrael":   ("catalog_missing", [], "", "同上"),

    # === Demographics 4 個 ===
    "popCount":       ("verified", ["population"], "MED", "對應 demographics/population.md"),
    "indicators":     ("verified", ["county_indicators_yearly"], "MED", "對應 demographics/county_indicators_yearly.md"),
    "socioeconomic":  ("verified", ["village_comprehensive_extended"], "LOW", "對應 demographics/village_comprehensive_extended.md（社經面貌＝村里綜合）"),
    "spatialEconomy": ("verified", ["village_comprehensive_extended"], "LOW", "同 socioeconomic（空間經濟＝村里綜合衍生）"),

    # === Real estate 3 個 point layers → 跟 grid layers 共用 real_estate dataset ===
    "realEstateRentalPoint":  ("verified", ["real_estate"], "HIGH", "real_estate dataset 涵蓋租賃成交點"),
    "realEstateSalePoint":    ("verified", ["real_estate"], "HIGH", "real_estate dataset 涵蓋買賣成交點"),
    "realEstatePresalePoint": ("verified", ["real_estate"], "HIGH", "real_estate dataset 涵蓋預售成交點"),

    # === CWA imagery 2 個 + AQI raster ===
    "cwaCloudImagery": ("catalog_missing", [], "", "CWA 衛星雲圖 dataset 未登錄到 catalog"),
    "cwaRadarImagery": ("catalog_missing", [], "", "CWA 雷達整合回波 dataset 未登錄到 catalog"),
    "aqiImagery":      ("verified", ["air_quality"], "MED", "對應 environment/air_quality.md（空氣品質）"),

    # === Weather temperature ===
    "temperatureWave": ("verified", ["weather"], "MED", "對應 weather/weather.md（CWA 溫度觀測）"),

    # === 發電廠歷史 ===
    "facHistorical": ("verified", ["power_plants"], "MED", "對應 energy/power_plants.md（含退役歷史）"),

    # === 風場（NOAA GFS）===
    "windField": ("verified", ["noaa_gfs_wind_forecast"], "MED", "對應 global_climate/noaa_gfs_wind_forecast.md"),

    # === 廢棄物 schedule 子層 ===
    "wasteScheduleNote": ("verified", ["waste_collection_routes"], "LOW", "wasteSchedule 子層，共用 routes dataset"),

    # === 真 pulse_only — 派生 / 等時圈計算結果（無獨立上游 dataset）===
    "medIsochrone":  ("pulse_only", [], "", "派生分析：醫療 POI + 路網等時圈計算結果"),
    "medDesert":     ("pulse_only", [], "", "派生分析：等時圈反演的醫療沙漠"),
    "fireIsochrone": ("pulse_only", [], "", "派生分析：消防分隊 + 路網救援等時圈"),
}

# Load + update
csv_path = SCRATCH / "match_final.csv"
with csv_path.open() as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())

# Load catalog for verification
with (SCRATCH / "catalog_datasets.csv").open() as f:
    cat_ids = {r["dataset_id"] for r in csv.DictReader(f)}

# Verify all correction dataset_ids exist in catalog
broken = []
for k, (status, ds_ids, conf, reason) in CORRECTIONS.items():
    for did in ds_ids:
        if did not in cat_ids:
            broken.append((k, did))

if broken:
    print("❌ CORRECTION dataset_ids NOT in catalog (will be rejected):")
    for b in broken:
        print(f"   {b}")
    print()

# Apply corrections
changes = []
for row in rows:
    key = row["layer_key"]
    if key not in CORRECTIONS:
        continue
    new_status, ds_ids, conf, reason = CORRECTIONS[key]
    # If multi-dataset, we'll only set primary; but match_final has one row per layer
    # so we set dataset_id to first ds_id (csv schema constraint)
    new_ds = ds_ids[0] if ds_ids else ""
    if new_ds and new_ds not in cat_ids:
        # Skip if dataset doesn't exist
        continue
    old = (row["status"], row["dataset_id"], row["confidence"])
    row["status"] = new_status
    row["dataset_id"] = new_ds
    row["confidence"] = conf if new_status == "verified" else "UNMATCHED"
    row["rule"] = "manual_fix"
    row["notes"] = f"FIX: {reason}"
    new = (row["status"], row["dataset_id"], row["confidence"])
    if old != new:
        changes.append((key, old, new, reason))

# Write back
with csv_path.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

# Re-stats
status_counts = Counter(r["status"] for r in rows)
print(f"═══ Phase 3.5 — pulse_only Fix Report ═══\n")
print(f"Corrections applied: {len(changes)}\n")
print("New status distribution:")
for s, c in status_counts.most_common():
    print(f"  {s:24} {c}")

# Write fix report
report = SCRATCH / "08_pulse_only_fix_report.md"
with report.open("w", encoding="utf-8") as f:
    f.write("# Phase 3.5 — pulse_only Over-classification Fix\n\n")
    f.write(f"**Date**: 2026-07-01\n\n")
    f.write(f"## Summary\n\n")
    f.write(f"Agent in Phase 3 lazily marked 33 layers as `pulse_only` when many actually have upstream datasets.\n")
    f.write(f"This script re-classified them based on real catalog content inspection.\n\n")
    f.write(f"**Corrections**: {len(changes)} of 33 pulse_only layers reassigned.\n\n")
    f.write("## New Status Distribution\n\n| Status | Count |\n|---|---|\n")
    for s, c in status_counts.most_common():
        f.write(f"| {s} | {c} |\n")
    f.write("\n## All Corrections\n\n| Layer | Old | New | Reason |\n|---|---|---|---|\n")
    for k, old, new, reason in changes:
        old_str = f"{old[0]}/{old[1] or '—'}/{old[2]}"
        new_str = f"{new[0]}/{new[1] or '—'}/{new[2]}"
        f.write(f"| `{k}` | {old_str} | {new_str} | {reason} |\n")

print(f"\n✓ Report: {report}")
print(f"✓ Updated: {csv_path}")
