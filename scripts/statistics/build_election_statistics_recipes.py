#!/usr/bin/env python3
"""Build the Taiwan election regional statistics family from the analytics handoff recipes.

Input (taipei-gis-analytics, read-only):
  --handoff  docs/handoff/election-statistics-recipes.json（66 recipes, 5 dataset；village／township／county）
  --root     analytics checkout whose data/processed/<theme>/<dataset_id>/releases/<release_id>.json holds the bundles.

Output: src/data/electionStatisticsRecipes.json（atlas recipe schema, src/data/atlasStatisticsTypes.ts; family "election"）.

Presentation owned here (same contract as build_ca_statistics_recipes.py):
- one sidebar row per election（總統、立委政黨票、縣市長、縣市議員政黨合計、公投）; the row's dropdown switches
  indicator × level; lead option＝最高黨・縣市（公投＝同意票比率・縣市）, latest election by default;
- placed in the GIS theme「政治 Politics → 選舉」(data_theme / subgroup); layerCatalog folds it into that group
  instead of opening a duplicate theme;
- top_party → legend.method categorical (party colours by key); kmt_minus_dpp_pp → diverging + palette partisan;
  vote_share → legend.party_dimension "party" (sequential in the chosen party's colour).

Usage:
  python3 scripts/statistics/build_election_statistics_recipes.py --root <analytics checkout> \
    --handoff <analytics worktree>/docs/handoff/election-statistics-recipes.json
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/electionStatisticsRecipes.json"
DATA_THEME = "政治 Politics"
SUBGROUP = "選舉"
TAB_THEME = "選舉 Elections"

ELECTIONS = [  # (handoff key fragment, group id, group label)
    ("President", "electionPresident", "總統選舉"),
    ("LegislatorParty", "electionLegislatorParty", "立委選舉（政黨票）"),
    ("Mayor", "electionMayor", "縣市長選舉"),
    ("CouncilorParty", "electionCouncilorParty", "縣市議員選舉（政黨合計）"),
    ("Referendum", "electionReferendum", "全國性公民投票"),
]
INDICATORS = [  # (handoff key fragment, option label, fraction digits)
    ("TopParty", "得票最高政黨", 0),
    ("KmtMinusDpp", "國民黨減民進黨（百分點）", 1),
    ("AgreeRate", "同意票比率", 1),
    ("VoteShare", "各黨得票率", 1),
    ("Turnout", "投票率", 1),
    ("ValidVotes", "有效票數", 0),
]
LEVELS = [("County", "county", "縣市"), ("Township", "township", "鄉鎮市區"), ("Village", "village", "村里")]
PARTY_ORDER = ["dpp", "kmt", "tpp", "npp", "ind", "other"]
LOCATION = "投開票所所在村里（依中選會投開票所對到現行村里界彙總）；鄉鎮、縣市為全部投開票所加總"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--handoff", required=True, type=Path)
    args = parser.parse_args()
    delivered = json.loads(args.handoff.read_text())
    if delivered["schema"] != "election-statistics-recipes-v1" or delivered["family"] != "election":
        raise SystemExit(f"{args.handoff.name}: unexpected handoff schema")
    by_key = {r["layer_key"]: r for r in delivered["recipes"]}
    if len(by_key) != len(delivered["recipes"]):
        raise SystemExit("duplicated layer_key in handoff")

    planned: dict[str, tuple] = {}
    for election in ELECTIONS:
        for indicator in INDICATORS:
            for level in LEVELS:
                key = f"statsElection{election[0]}{indicator[0]}{level[0]}"
                if key in by_key:
                    planned[key] = (election, indicator, level)
    if set(planned) != set(by_key):
        raise SystemExit(f"handoff keys {sorted(set(by_key) - set(planned))} not planned / {sorted(set(planned) - set(by_key))} missing")

    recipes, report = [], []
    for key, (election, indicator, level) in planned.items():
        layer = by_key[key]
        if not layer["enabled"] or layer["level"] != level[1]:
            raise SystemExit(f"{key}: disabled or wrong level")
        dim_keys = layer["dimension_keys"]
        options, statuses, latest = [], Counter(), None
        bundles: dict[str, dict] = {}
        for option in layer["release_options"]:
            body = bundles.get(option["bundle_path"])
            if body is None:
                body = bundles[option["bundle_path"]] = json.loads((args.root / option["bundle_path"]).read_text())
            release = body["release"]
            if (body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"]
                    or release["id"] != option["release_id"]):
                raise SystemExit(f"{key}: {option['release_id']} does not match dataset/indicator/id")
            if (release["period_start"], release["period_end"]) != (option["period_start"], option["period_end"]):
                raise SystemExit(f"{key}: {option['release_id']} period differs")
            if release["boundary_version"] != layer["boundary_version"] or set(option["dimensions"]) != set(dim_keys):
                raise SystemExit(f"{key}: {option['release_id']} boundary or dimensions differ")
            obs = [o for o in body["observations"] if o["dimensions"] == option["dimensions"]]
            codes = {o["area_code"] for o in obs}
            if not obs or {o["area_level"] for o in obs} != {level[1]} or len(obs) != len(codes):
                raise SystemExit(f"{key}: {option['release_id']} {option['dimensions']} needs unique {level[1]} rows")
            for o in obs:
                statuses[o["status"]] += 1
                if o["status"] == "observed" and not isinstance(o["value"], (int, float)):
                    raise SystemExit(f"{key}: observed non-number")
                if o["status"] != "observed" and o["value"] is not None:
                    raise SystemExit(f"{key}: non-observed value must be null")
            if latest is None or release["period_end"] > latest["release"]["period_end"]:
                latest = body
            options.append({"release_id": option["release_id"], "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": dict(option["dimensions"])})
        assert latest is not None
        unexpected = set(statuses) - {"observed"} - set(layer["status_labels"])
        if unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")

        dimensions = []
        for dim in dim_keys:
            labels = layer["dimension_labels"][dim]
            present = {o["dimensions"][dim] for o in options}
            if dim == "party":
                values = [p for p in PARTY_ORDER if p in present]
                default = "kmt" if "kmt" in values else values[0]
            else:  # 公投 case：最新一次投票的第一案在前
                values = sorted(present, key=lambda v: (max(o["period_end"] for o in options if o["dimensions"][dim] == v), v), reverse=True)
                latest_end = max(o["period_end"] for o in options)
                default = sorted(v for v in present if any(o["period_end"] == latest_end and o["dimensions"][dim] == v for o in options))[0]
            values = [default] + [v for v in values if v != default]
            dimensions.append({"key": dim, "label": {"party": "政黨", "case": "案別"}[dim], "default": default,
                               "options": [{"value": v, "label": labels[v]} for v in values]})
        default_dims = {d["key"]: d["default"] for d in dimensions}
        latest_end = max(o["period_end"] for o in options)
        default_option = next(o for o in options if o["period_end"] == latest_end and o["dimensions"] == default_dims)

        src = layer["legend"]
        legend = {"method": "fixed_breaks", "breaks": src.get("breaks", []), "direction": "ascending",
                  "scale_note": None, "zero_note": None, "display_note": None, "by_dimension": None, "dimension_notes": None,
                  "notes": list(layer["legend_notes"])}
        if src["method"] == "categorical":
            cats = [{"value": c["value"], "label": c["label"], "key": c["key"]} for c in src["categories"]]
            legend.update(method="categorical", categories=cats, breaks=sorted(c["value"] for c in cats)[1:])
            legend["scale_note"] = "顏色＝該區得票最高的政黨（以候選人所屬政黨歸類）"
        elif src.get("palette") == "partisan":
            legend.update(direction="diverging", palette="partisan")
            legend["scale_note"] = f"綠＝{src['negative_label']}、藍＝{src['positive_label']}，越深差距越大；正中灰色為相差 5 個百分點以內"
        if src.get("party_dimension"):
            legend["party_dimension"] = src["party_dimension"]
            legend["display_note"] = "色階用所選政黨的代表色"
        breaks = legend["breaks"]
        if sorted(set(breaks)) != breaks:
            raise SystemExit(f"{key}: bad breaks {breaks}")
        release = latest["release"]
        label = re.sub(r"（[^（）]*）$", "", layer["label"])
        recipes.append({
            "layer_key": key, "enabled": True, "family": "election",
            "label": label, "group": election[1], "group_label": election[2],
            "option_label": f"{indicator[1]}・{level[2]}", "subgroup": SUBGROUP,
            "data_theme": DATA_THEME, "tab_theme": TAB_THEME, "visual_theme": "politics",
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": level[1],
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": latest["indicator"]["aggregation"],
            "default_release_id": default_option["release_id"],
            "dimensions": dimensions,
            "release_options": sorted(options, key=lambda o: o["period_end"], reverse=True),
            "legend": legend,
            "status_labels": {kind: lab for kind, lab in layer["status_labels"].items() if statuses.get(kind)},
            "format": {"locale": "zh-TW", "maximumFractionDigits": indicator[2]},
            "derived": True,
            "derived_method": layer["definition"],
            "location_semantics": LOCATION,
            "disclosure": layer["disclosure"],
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": release["source_metadata"]["dataset_title"],
            "delivery": {
                "observed_statuses": dict(sorted(statuses.items())),
                "draft_breaks_basis": src.get("breaks_basis"),
                "definition": layer["definition"],
                "receipts": [{"release_id": o["release_id"], "bundle_path": o["bundle_path"]} for o in layer["release_options"]],
            },
        })
        report.append(f"{key:48} options={len(options)} statuses={dict(statuses)}")
    print(f"election: recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))
    document = {
        "version": 1,
        "scope": "production_r2",
        "family": "election",
        "generated_from": {"recipes": args.handoff.name, "bundles": "taipei-gis-analytics data/processed/socioeconomic/<dataset_id>/releases/<release_id>.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"missing": "舊屆對不上現行村里或中選會合併計票（不分配到組成村）；不是 0"},
        "recipes": recipes,
    }
    OUT.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.name} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
