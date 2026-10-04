#!/usr/bin/env python3
"""Build src/data/demographicsStatisticsRecipes.json from analytics demographics handoffs.

Inputs (taipei-gis-analytics, read-only): ``docs/handoff/<slug>-recipes.json`` for every
slug in HANDOFFS.  Only ``enabled: true`` recipes are copied (村里 HOLD recipes stay out);
recipe bodies are copied verbatim, so exact selectors, fixed legend breaks, coverage and
disclosure remain the analytics SSOT.  Each handoff's SHA-256 is recorded as a receipt.

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
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--analytics", type=Path, required=True, help="taipei-gis-analytics repo root")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()

    recipes: list[dict] = []
    receipts: list[dict] = []
    seen: set[str] = set()
    policies: dict[str, object] = {}
    for slug in HANDOFFS:
        path = args.analytics / "docs/handoff" / f"{slug}-recipes.json"
        raw = path.read_bytes()
        document = json.loads(raw)
        if document.get("scope") != "local_frontend_wiring_ready_not_production":
            raise SystemExit(f"{path}: unexpected scope {document.get('scope')!r}")
        enabled = [recipe for recipe in document["recipes"] if recipe.get("enabled") is True]
        if len(enabled) != document.get("target_enabled_recipe_count"):
            raise SystemExit(f"{path}: enabled recipe count {len(enabled)} != target")
        for recipe in enabled:
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

    output = {
        "version": 1,
        "scope": "local_frontend_wiring_ready_not_production",
        "generated_from": receipts,
        "generator": "scripts/statistics/build_demographics_statistics_recipes.py",
        **policies,
        "recipes": recipes,
    }
    args.out.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{args.out}: {len(recipes)} enabled recipes from {len(HANDOFFS)} handoffs")


if __name__ == "__main__":
    main()
