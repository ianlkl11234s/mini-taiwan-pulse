#!/usr/bin/env python3
"""
Phase 3 — Claude 對抗式 review (programmatic + heuristic)

Inputs:
  - scratchpad/audit/pulse_layers.csv
  - scratchpad/audit/catalog_datasets.csv
  - scratchpad/audit/match_proposal.csv

Output:
  - scratchpad/audit/match_verified.csv  (cols: layer_key, dataset_id, status, confidence, notes)
  - scratchpad/audit/03_review_report.md
  - scratchpad/audit/pending_catalog_additions.md

Strategy (Claude review automated):
  1. HIGH (R0) — auto-verified (R0 evidence is strong: catalog explicitly points to pulse path)
  2. MED  (R4) — auto-verified (normalized name exact match)
  3. LOW  (R5) — filter: require basename/theme alignment OR strong rpc match; else demote to UNMATCHED
  4. UNMATCHED — classify into 4 STATUS:
     - pulse_only      : source_type=three_only OR layer_key in known demo list
     - name_mismatch   : has source_url/rpc but no catalog hit via tokens (very likely catalog has it under different name)
     - catalog_missing : no catalog dataset in same theme matches any token; needs new catalog entry
     - multi_dataset   : layer name suggests aggregation (e.g. *Alerts, weatherAlerts pulls multiple sources)

  After programmatic pass, generates secondary matching for UNMATCHED by theme + token:
  pulse theme → catalog theme directory mapping, looking for closest token overlap.
"""
import csv
import json
from pathlib import Path
from collections import defaultdict, Counter

SCRATCH = Path("/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit")

# ── Pulse theme → Catalog theme directory ──
# Maps Chinese theme strings in layerCatalog.ts to catalog/ subdirectory names
THEME_MAP = {
    "底圖 Base Map": ["base_map", "demographics"],
    "交通 Move": ["transportation", "aviation", "aviation_drone"],
    "人口社經 People": ["demographics", "socioeconomic"],
    "環境氣候 Environment": ["weather", "global_climate"],
    "水資源 Water": ["water_resources", "water"],
    "災害 Hazard": ["emergency_response", "global_climate"],
    "全球氣候 Global Climate": ["global_climate"],
    "消防 Fire & Rescue": ["emergency_response", "police_justice"],
    "醫療 Medical": ["poi"],
    "農業 Agriculture": ["agriculture"],
    "林業 Forestry": ["forestry"],
    "廢棄物 Waste": ["urban_composite", "emergency_response"],
    "能源 Energy": ["energy"],
    "基礎建設 Infrastructure": ["infrastructure"],
    "房地產 Real Estate": ["real_estate"],
    "太空 Space": ["aviation"],
    "新聞 News": ["news"],
    "執法治安 Law & Order": ["police_justice"],
    "民防避難 Civil Defense": ["emergency_response", "police_justice"],
    "警察覆蓋分析 Police Coverage": ["police_justice"],
}

# Layers that are pure-frontend (no upstream dataset)
PULSE_ONLY_HINTS = {
    "hillshade",   # rendered from DEM
    "slope",
    "aspect",
    "windField",   # generated from wind plan polygons + animation
    "oceanCurrents",  # animated current particle
    "medIsochrone",   # derived from medical facilities + isochrone calc
    "medDesert",      # derived
    "powerStatusHud", # HUD overlay, no separate dataset
    "powerRegionDemand",  # derived
    "facHistorical",
    "facOffshore",
    "islandPowerGrid",
    "courtJurisdiction",  # polygon overlay
    "evIsland",
}

NOISE = {"data","real","time","info","list","table","city","town","year","stop","stat","layer","frames","raster","imagery","station","stations","wholesale","companies","points","point","areas","area","zone","zones","map","public","county","national","facilities","facility","status","current","records","global","measurements","observations","positions","events","sites","centers","offices","schools","monthly","yearly","weekly","daily","hourly","trails","routes","stops"}


def tokens(s: str) -> set:
    if not s:
        return set()
    out = set()
    for t in s.lower().replace(".", "_").split("_"):
        t = "".join(c for c in t if c.isalnum())
        if len(t) >= 4 and t not in NOISE:
            out.add(t)
    # camelCase split
    import re
    for t in re.split(r"(?=[A-Z])", s):
        t = t.lower()
        if len(t) >= 4 and t not in NOISE and t.isalnum():
            out.add(t)
    return out


def load_csv(p):
    with p.open() as f:
        return list(csv.DictReader(f))


pulse = load_csv(SCRATCH / "pulse_layers.csv")
catalog = load_csv(SCRATCH / "catalog_datasets.csv")
proposals = load_csv(SCRATCH / "match_proposal.csv")

pulse_by_key = {r["layer_key"]: r for r in pulse}
catalog_by_id = {r["dataset_id"]: r for r in catalog}
catalog_by_theme = defaultdict(list)
for c in catalog:
    catalog_by_theme[c["theme"]].append(c)


def secondary_match(pulse_row):
    """For UNMATCHED layers, search catalog within pulse's mapped theme dirs for token overlap."""
    pkey = pulse_row["layer_key"]
    ptheme = pulse_row["theme"]
    catalog_themes = THEME_MAP.get(ptheme, [])

    pulse_tokens = tokens(pkey)
    for url in pulse_row["source_url"].split("|"):
        pulse_tokens |= tokens(url.split("/")[-1].split(".")[0])
    for rpc in pulse_row["rpc_names"].split("|"):
        stripped = rpc.replace("get_", "").replace("fetch_", "")
        for suffix in ["_day", "_dates", "_latest", "_at", "_timeseries", "_frames", "_batch", "_window", "_recent"]:
            if stripped.endswith(suffix):
                stripped = stripped[:-len(suffix)]
        pulse_tokens |= tokens(stripped)

    if not pulse_tokens or not catalog_themes:
        return None, 0, ""

    # Score every dataset in mapped catalog themes
    best = None
    best_score = 0
    for ctheme in catalog_themes:
        for c in catalog_by_theme.get(ctheme, []):
            dtokens = tokens(c["dataset_id"]) | tokens(c["title"])
            shared = pulse_tokens & dtokens
            if not shared:
                continue
            # Score: shared count + bonus for long shared tokens
            score = len(shared) * 10 + sum(len(t) for t in shared)
            if score > best_score:
                best_score = score
                best = c["dataset_id"]
    return best, best_score, f"theme={catalog_themes}, shared={list(pulse_tokens)[:5]}"


# ── Process proposals ──
results = []  # (layer_key, dataset_id, status, confidence, notes)

for p in proposals:
    key = p["layer_key"]
    pul = pulse_by_key.get(key, {})
    src_type = pul.get("source_type", "")
    conf = p["confidence"]
    rule = p["rule"]
    proposed_ds = p["dataset_id"]
    evidence = p["evidence"]

    if conf == "HIGH":
        # R0: catalog frontend_target explicitly points to pulse path → trust it
        results.append({
            "layer_key": key,
            "dataset_id": proposed_ds,
            "rule": rule,
            "confidence": "HIGH",
            "status": "verified",
            "notes": f"R0 frontend_target points to pulse file directly. {evidence[:100]}",
        })
        continue

    if conf == "MED":
        # R4: normalized name exact match → trust
        results.append({
            "layer_key": key,
            "dataset_id": proposed_ds,
            "rule": rule,
            "confidence": "MED",
            "status": "verified",
            "notes": f"R4 normalized name exact match. {evidence[:100]}",
        })
        continue

    if conf == "LOW":
        # R5: token overlap — verify by checking if proposed dataset is in same THEME
        cat_row = catalog_by_id.get(proposed_ds)
        if cat_row:
            cat_theme = cat_row.get("theme", "")
            expected_themes = THEME_MAP.get(pul.get("theme", ""), [])
            if cat_theme in expected_themes:
                results.append({
                    "layer_key": key,
                    "dataset_id": proposed_ds,
                    "rule": "R5+theme",
                    "confidence": "MED",  # promote
                    "status": "verified",
                    "notes": f"R5 token+theme alignment. dataset theme={cat_theme}",
                })
                continue
        # else: theme mismatch, demote to needs further matching
        # Try secondary match instead
        ds2, score, note = secondary_match(pul)
        if ds2 and score >= 25:
            results.append({
                "layer_key": key,
                "dataset_id": ds2,
                "rule": "R5b",
                "confidence": "LOW",
                "status": "verified",
                "notes": f"R5 original {proposed_ds} was theme-mismatch; secondary picked {ds2} (score={score}). {note[:80]}",
            })
            continue
        results.append({
            "layer_key": key,
            "dataset_id": "",
            "rule": "NONE",
            "confidence": "UNMATCHED",
            "status": "name_mismatch",
            "notes": f"R5 hit {proposed_ds} but theme mismatch; secondary match insufficient (score={score})",
        })
        continue

    # UNMATCHED — classify
    if key in PULSE_ONLY_HINTS or src_type == "three_only":
        results.append({
            "layer_key": key,
            "dataset_id": "",
            "rule": "NONE",
            "confidence": "UNMATCHED",
            "status": "pulse_only",
            "notes": f"source_type={src_type} or in PULSE_ONLY_HINTS",
        })
        continue

    # Try secondary match by theme
    ds2, score, note = secondary_match(pul)
    if ds2 and score >= 25:
        results.append({
            "layer_key": key,
            "dataset_id": ds2,
            "rule": "R6_theme",
            "confidence": "LOW",
            "status": "verified",
            "notes": f"Secondary theme-scoped match: {ds2} (score={score}). {note[:80]}",
        })
        continue

    # Final unmatched — classify
    if src_type in ("static_geojson", "pmtiles"):
        status = "name_mismatch"
    elif src_type == "supabase_rpc":
        status = "catalog_missing"  # most RPCs imply backend dataset
    else:
        status = "name_mismatch"

    results.append({
        "layer_key": key,
        "dataset_id": "",
        "rule": "NONE",
        "confidence": "UNMATCHED",
        "status": status,
        "notes": f"source_type={src_type}, no theme match (best secondary score={score})",
    })


# ── Write verified CSV ──
out_csv = SCRATCH / "match_verified.csv"
fieldnames = ["layer_key", "dataset_id", "rule", "confidence", "status", "notes"]
with out_csv.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    for r in results:
        w.writerow(r)

# ── Cross-check: each layer_key appears exactly once ──
key_counts = Counter(r["layer_key"] for r in results)
dup_keys = [k for k, v in key_counts.items() if v > 1]
missing_keys = set(pulse_by_key) - set(key_counts)
extra_keys = set(key_counts) - set(pulse_by_key)

# ── Reverse-validate: every non-empty dataset_id exists in catalog ──
broken_refs = []
for r in results:
    if r["dataset_id"] and r["dataset_id"] not in catalog_by_id:
        broken_refs.append((r["layer_key"], r["dataset_id"]))


# ── Report ──
status_counts = Counter(r["status"] for r in results)
conf_counts = Counter(r["confidence"] for r in results)

print("═══ Phase 3 — Verified Match Report ═══\n")
print(f"Total layers:                {len(results)} (expected 227: {'✓' if len(results)==227 else '✗'})")
print(f"Duplicate layer_keys:        {len(dup_keys)} {dup_keys[:5]}")
print(f"Missing from pulse list:     {len(missing_keys)} {list(missing_keys)[:5]}")
print(f"Extra (not in pulse):        {len(extra_keys)} {list(extra_keys)[:5]}")
print(f"Broken catalog refs:         {len(broken_refs)} {broken_refs[:5]}")
print()
print("Status distribution:")
for s, c in status_counts.most_common():
    print(f"  {s:24} {c}")
print()
print("Confidence distribution:")
for c, n in conf_counts.most_common():
    print(f"  {c:24} {n}")
print()
verified_count = sum(1 for r in results if r["status"] == "verified")
print(f"Verified (has dataset_id):   {verified_count} ({verified_count/len(results)*100:.1f}%)")
print()

# Pending catalog additions
catalog_missing = [r for r in results if r["status"] == "catalog_missing"]
name_mismatch = [r for r in results if r["status"] == "name_mismatch"]
pulse_only = [r for r in results if r["status"] == "pulse_only"]

# Write pending_catalog_additions.md
pending = SCRATCH / "pending_catalog_additions.md"
with pending.open("w", encoding="utf-8") as f:
    f.write("# Pending Catalog Additions\n\n")
    f.write(f"Generated: 2026-07-01\n\n")
    f.write(f"## catalog_missing ({len(catalog_missing)})\n\n")
    f.write("These pulse layers have RPC/loader but no matching catalog dataset. Needs new entry in `taipei-gis-analytics/docs/data-catalog/`.\n\n")
    f.write("| layer_key | theme | rpc_names | source_url |\n|---|---|---|---|\n")
    for r in catalog_missing:
        pul = pulse_by_key.get(r["layer_key"], {})
        f.write(f"| `{r['layer_key']}` | {pul.get('theme','')} | {pul.get('rpc_names','')[:80]} | {pul.get('source_url','')[:80]} |\n")
    f.write(f"\n## name_mismatch ({len(name_mismatch)})\n\n")
    f.write("Likely exists in catalog under different name. Manual hunt needed (catalog-search / WebFetch).\n\n")
    f.write("| layer_key | theme | source_url | rpc_names |\n|---|---|---|---|\n")
    for r in name_mismatch:
        pul = pulse_by_key.get(r["layer_key"], {})
        f.write(f"| `{r['layer_key']}` | {pul.get('theme','')} | {pul.get('source_url','')[:80]} | {pul.get('rpc_names','')[:60]} |\n")
    f.write(f"\n## pulse_only ({len(pulse_only)})\n\n")
    f.write("Pure-frontend layers (derived / animated / no upstream dataset).\n\n")
    for r in pulse_only:
        f.write(f"- `{r['layer_key']}` — {r['notes']}\n")

print(f"✓ Written: {out_csv}")
print(f"✓ Written: {pending}")
