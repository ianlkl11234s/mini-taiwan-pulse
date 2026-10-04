#!/usr/bin/env python3
"""Build src/data/demographicsStatisticsRecipes.json from analytics demographics handoffs.

Inputs (taipei-gis-analytics, read-only): ``docs/handoff/<slug>-recipes.json`` for every
slug in HANDOFFS, plus ``docs/handoff/village-statistics-recipes.json`` (村里 11508 ×
VILLAGE_NLSC_1150817; its labor recipe belongs to laborStatisticsRecipes.json and is skipped).
Only ``enabled: true`` recipes are copied (per-dataset 村里 HOLD recipes stay out; the village
handoff supplies the publishable 村里 layers); recipe bodies are copied verbatim, so exact
selectors, fixed legend breaks, coverage and disclosure remain the analytics SSOT.  Village
recipes are placed right after their dataset's county/township recipes.  Each handoff's
SHA-256 is recorded as a receipt.

Adding P3–P6 (vital events, migration, indigenous, foreign origin): append the slug to
HANDOFFS, rerun this script, then regenerate the catalog:

  python3 scripts/statistics/build_demographics_statistics_recipes.py --analytics <analytics repo>
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/demographicsStatisticsRecipes.json"

# Order = sidebar order of datasets.
HANDOFFS = (
    "household-registration-population",  # P0/P1 戶籍人口與戶數
    "population-age-structure",           # P2 年齡結構
    "population-vital-events",            # P3 人口動態（出生／死亡／婚姻；年度＋年初累計 YTD）
    "population-migration",               # P4 遷徙
    "indigenous-population",              # P5 原住民
    "foreign-origin-population",          # P6 已設戶籍外來人口＋歸化
)

VILLAGE_HANDOFF = "village-statistics"
VILLAGE_LAYER_PREFIX = "statsDemographicsVillage"


def load_village_recipes(analytics: Path) -> tuple[dict[str, list[dict]], dict]:
    """村里 handoff：只收 demographics 村里 recipes（勞動村里 recipe 由 laborStatisticsRecipes.json 管）。"""
    path = analytics / "docs/handoff" / f"{VILLAGE_HANDOFF}-recipes.json"
    raw = path.read_bytes()
    document = json.loads(raw)
    if document.get("scope") != "local_frontend_wiring_ready_not_production":
        raise SystemExit(f"{path}: unexpected scope {document.get('scope')!r}")
    if len(document["recipes"]) != document.get("target_recipe_count"):
        raise SystemExit(f"{path}: recipe count {len(document['recipes'])} != target")
    by_dataset: dict[str, list[dict]] = {}
    held = 0
    for recipe in document["recipes"]:
        if not recipe["layer_key"].startswith(VILLAGE_LAYER_PREFIX):
            continue
        if recipe.get("enabled") is not True:
            held += 1
            continue
        if recipe.get("level") != "village" or len(recipe["release_options"]) != 1:
            raise SystemExit(f"{recipe['layer_key']}: village recipe must be level=village with one period")
        by_dataset.setdefault(recipe["dataset_id"], []).append(recipe)
    enabled = [recipe for recipes in by_dataset.values() for recipe in recipes]
    receipt = {
        "handoff": f"docs/handoff/{VILLAGE_HANDOFF}-recipes.json",
        "sha256": hashlib.sha256(raw).hexdigest(),
        "enabled_recipes": len(enabled),
        "held_recipes": held,
        "exact_selectors": sum(len(recipe["release_options"]) for recipe in enabled),
        "skipped_non_demographics_recipes": len(document["recipes"]) - len(enabled) - held,
    }
    return by_dataset, receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--analytics", type=Path, required=True, help="taipei-gis-analytics repo root")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()

    recipes: list[dict] = []
    receipts: list[dict] = []
    seen: set[str] = set()
    policies: dict[str, object] = {}
    village_by_dataset, village_receipt = load_village_recipes(args.analytics)
    for slug in HANDOFFS:
        path = args.analytics / "docs/handoff" / f"{slug}-recipes.json"
        raw = path.read_bytes()
        document = json.loads(raw)
        if document.get("scope") != "local_frontend_wiring_ready_not_production":
            raise SystemExit(f"{path}: unexpected scope {document.get('scope')!r}")
        enabled = [recipe for recipe in document["recipes"] if recipe.get("enabled") is True]
        if len(enabled) != document.get("target_enabled_recipe_count"):
            raise SystemExit(f"{path}: enabled recipe count {len(enabled)} != target")
        datasets = {recipe["dataset_id"] for recipe in enabled}
        village = [recipe for dataset in sorted(datasets) for recipe in village_by_dataset.pop(dataset, [])]
        for recipe in [*enabled, *village]:
            if recipe["layer_key"] in seen:
                raise SystemExit(f"duplicate layer_key {recipe['layer_key']}")
            if recipe.get("legend", {}).get("method") != "fixed_breaks":
                raise SystemExit(f"{recipe['layer_key']}: legend must be fixed_breaks")
            seen.add(recipe["layer_key"])
            recipes.append(recipe)
        receipts.append({
            "handoff": f"docs/handoff/{slug}-recipes.json",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "enabled_recipes": len(enabled),
            "held_recipes": len(document["recipes"]) - len(enabled),
            "exact_selectors": sum(len(recipe["release_options"]) for recipe in enabled),
        })
        for key in ("observation_policy", "health_policy"):
            policies.setdefault(key, document.get(key))
    if village_by_dataset:
        raise SystemExit(f"village recipes without a dataset handoff: {sorted(village_by_dataset)}")
    receipts.append(village_receipt)

    output = {
        "version": 1,
        "scope": "local_frontend_wiring_ready_not_production",
        "generated_from": receipts,
        "generator": "scripts/statistics/build_demographics_statistics_recipes.py",
        **policies,
        "recipes": recipes,
    }
    args.out.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{args.out}: {len(recipes)} enabled recipes from {len(HANDOFFS) + 1} handoffs")


if __name__ == "__main__":
    main()
