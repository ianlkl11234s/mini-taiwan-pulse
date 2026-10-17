#!/usr/bin/env python3
"""Build src/data/landslideStatisticsRecipes.json from the analytics landslide delivery.

Inputs (taipei-gis-analytics landslide worktree, read-only):
  --recipes    output/landslide/statistics-recipes.json
               (5 indicator recipes, 102 exact release selectors; no layer_key / breaks / source block).
  --processed  data/processed root; hazards/<dataset>/releases/*.json give the exact period, boundary,
               publisher, license, source URLs, location semantics and observed statuses per release.

The delivery carries no presentation, so this script owns it: layer_key, sidebar group, option label,
fixed breaks (S-track report: latest-year distribution, not re-fitted per period), status legend labels
and disclosure additions. Values, periods and sources always come from the release bundles.

`slope_works_collapsed_land_treated_ha`（崩塌地處理面積）is kept disabled: several years mix what look like
square metres into hectares (2025 桃園 4,005、2024 雲林 4,286 …), so a map would be driven by outliers.

Usage:
  python3 scripts/statistics/build_landslide_statistics_recipes.py \
    --recipes <analytics WT>/output/landslide/statistics-recipes.json \
    --processed <analytics WT>/data/processed
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/landslideStatisticsRecipes.json"

LANDSLIDE = "崩塌"
WORKS = "治山防災工程"
LOSS = "水土保持災害"

BOUNDARY = "縣市以內政部 114 年 3 月縣市界顯示；不代表歷史邊界、不做面積重分配。"
NO_ZERO_FILL = "未列與缺值都不是 0。"
UNLISTED = "未列（來源當年未列該縣市，不是 0）"

# (dataset_id, indicator_id) → (layer_key, enabled, subgroup, group, group_label, option_label, decimals, breaks, extra disclosure, legend display note)
PRESENTATION: dict[tuple[str, str], tuple[str, bool, str, str, str, str, int, list[float], str, str | None]] = {
    ("landslide_area_county", "landslide_count"): (
        "statsLandslideCountCounty", True, LANDSLIDE, "landslideArea", "崩塌筆數與面積", "崩塌筆數", 0,
        [1, 100, 500, 1500, 3000], "", None),
    ("landslide_area_county", "landslide_area_ha"): (
        "statsLandslideAreaCounty", True, LANDSLIDE, "landslideArea", "崩塌筆數與面積", "崩塌面積（公頃）", 2,
        [1, 50, 300, 1000, 3000], "", None),
    ("slope_treatment_works_county", "slope_works_cost_total_twd"): (
        "statsSlopeWorksCostCounty", True, WORKS, "slopeWorks", "治山防災工程", "總經費（元）", 0,
        [50_000_000, 150_000_000, 300_000_000, 500_000_000],
        "早年工程表只列部分縣市（2003 年 18 縣市），未列的縣市顯示「未列」，不是 0。",
        "門檻換算：0.5 億／1.5 億／3 億／5 億元。"),
    ("slope_treatment_works_county", "slope_works_collapsed_land_treated_ha"): (
        "statsSlopeWorksCollapsedLandCounty", False, WORKS, "slopeWorks", "治山防災工程", "崩塌地處理面積（公頃）", 2,
        [1, 5, 20, 100], "部分年度縣市疑混入平方公尺（離群值），不上地圖。", None),
    ("swc_disaster_loss_county", "swc_disaster_loss_total"): (
        "statsSwcDisasterLossCounty", True, LOSS, "swcDisasterLoss", "水土保持災害總損失", "總損失（千元，推定）", 0,
        [1, 100_000, 300_000, 700_000, 1_000_000],
        "單位為推定千元：來源未標示單位，依量級推定，待向機關確認。缺 2011–2018 與 2021 年，期別選單只列有資料的 14 年。",
        "推定單位千元；門檻換算：1 億／3 億／7 億／10 億元。"),
}

SOURCE_TITLE = {
    "landslide_area_county": "臺灣地區各縣市崩塌面積（data.gov.tw 178768）",
    "slope_treatment_works_county": "臺灣地區治山防災整體治理工程（data.gov.tw 87430）",
    "swc_disaster_loss_county": "臺灣地區水土保持類天然災害損失情形（data.gov.tw 157545）",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipes", required=True, type=Path)
    parser.add_argument("--processed", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    delivered = json.loads(args.recipes.read_text())["recipes"]
    keys = {(layer["dataset_id"], layer["indicator_id"]) for layer in delivered}
    if set(PRESENTATION) != keys:
        raise SystemExit(f"presentation keys differ from delivery: {sorted(set(PRESENTATION) ^ keys)}")
    index = {path.stem: path for path in args.processed.glob("hazards/*/releases/*.json")}

    recipes = []
    for layer in delivered:
        key, enabled, subgroup, group, group_label, option_label, decimals, breaks, extra, display_note = PRESENTATION[(layer["dataset_id"], layer["indicator_id"])]
        options, receipts, meta, statuses, zero = [], [], None, Counter(), 0
        for option in layer["release_options"]:
            release_id = option["release_id"]
            body = json.loads(index[release_id].read_text())
            release = body["release"]
            if (body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"]
                    or body["indicator"]["unit"] != layer["unit"]):
                raise SystemExit(f"{key}: {release_id} does not match dataset/indicator/unit")
            if (release["period_start"], release["period_end"]) != (option["period_start"], option["period_end"]):
                raise SystemExit(f"{key}: {release_id} period differs from the delivered option")
            if release["boundary_version"] != layer["boundary_version"]:
                raise SystemExit(f"{key}: {release_id} boundary differs")
            if {obs["area_level"] for obs in body["observations"]} != {layer["level"]}:
                raise SystemExit(f"{key}: {release_id} level differs")
            if any(obs["dimensions"] for obs in body["observations"]) or option["dimensions"]:
                raise SystemExit(f"{key}: {release_id} carries dimensions")
            statuses.update(obs["status"] for obs in body["observations"])
            zero += sum(1 for obs in body["observations"] if obs["status"] == "observed" and obs["value"] == 0)
            meta = meta or body
            options.append({"release_id": release_id, "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": {}})
            receipts.append({"release_id": release_id, "raw_sha256": release["raw_sha256"], "method_version": release["method_version"], "retrieved_at": release["retrieved_at"]})
        assert meta is not None
        unexpected = set(statuses) - {"observed", "missing"}
        if unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")
        if breaks == [0] or sorted(set(breaks)) != breaks:
            raise SystemExit(f"{key}: breaks must be strictly increasing and not [0]")
        release = meta["release"]
        params = release["provenance"]["processing"]["parameters"]
        default = max(options, key=lambda option: (option["period_end"], option["period_start"]))
        recipes.append({
            "layer_key": key, "enabled": enabled, "label": layer["label"],
            "group": group, "group_label": group_label, "option_label": option_label,
            "subgroup": subgroup, "visual_theme": "environment",
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": layer["level"],
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": meta["indicator"]["aggregation"],
            "default_release_id": default["release_id"],
            "release_options": options,
            "legend": {
                "method": "fixed_breaks", "breaks": breaks,
                "zero_note": "最淺色含 0（來源明列 0，不是無資料）。" if zero else None,
                "display_note": display_note,
            },
            # 只列本層會出現的非數值狀態；未列（missing）不上數值色。
            "status_labels": {"missing": UNLISTED} if statuses.get("missing") else {},
            "format": {"locale": "zh-TW", "maximumFractionDigits": decimals},
            "pair_raw_key": None,
            "derived": False,
            "location_semantics": params["location_semantics"],
            "disclosure": f"{layer['disclosure']}{extra}{NO_ZERO_FILL}{BOUNDARY}",
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": SOURCE_TITLE[layer["dataset_id"]],
            "delivery": {"observed_statuses": dict(sorted(statuses.items())), "observed_zero": zero, "receipts": receipts},
        })
    document = {
        "version": 1,
        "scope": "production_r2",
        "generated_from": {"recipes": args.recipes.name, "processed": "taipei-gis-analytics data/processed/hazards/*/releases/*.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"observed_zero": "status observed and value 0", "missing": "value null; county not listed by the source that year; no zero fill"},
        "recipes": recipes,
    }
    args.out.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    enabled_recipes = [r for r in recipes if r["enabled"]]
    print(f"wrote {args.out} recipes={len(recipes)} enabled={len(enabled_recipes)} selectors={sum(len(r['release_options']) for r in enabled_recipes)}")


if __name__ == "__main__":
    main()
