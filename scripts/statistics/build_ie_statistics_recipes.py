#!/usr/bin/env python3
"""Build the Ireland (IE) regional statistics family from the analytics handoff recipes.

Input (taipei-gis-analytics, read-only):
  --handoff  docs/handoff/ie-statistics-recipes.json（29 recipes, levels ie_la 31／ie_ed 3,420, 38 releases）
  --root     analytics checkout whose data/processed/<theme>/<dataset_id>/releases/<release_id>.json holds the bundles.

Output: src/data/ieStatisticsRecipes.json（atlas recipe schema, src/data/atlasStatisticsTypes.ts; family "ie", country "IE"）.

Same contract as build_ca_statistics_recipes.py: the handoff carries the data contract and draft breaks; this script
owns the presentation (one sidebar row per indicator with 地方政府、選舉分區 as options; IE statistics themes 人口／社經;
curated legend notes translated in enums.statLegendNote; status labels pruned to statuses that occur) and cross-checks
every option against its bundle.  Differences from CA: observed 0 is real in small EDs (urban share, social renting,
unemployment) → generic zero_note; RTB rent is LA-only with 8 LAs not_applicable; BREAKS overrides draft breaks
whose first break is 0 (urban share by ED is bimodal 0/100).

Usage:
  python3 scripts/statistics/build_ie_statistics_recipes.py --root <analytics checkout> \
    --handoff <analytics>/docs/handoff/ie-statistics-recipes.json
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/ieStatisticsRecipes.json"
AREA_COUNT = {"ie_la": 31, "ie_ed": 3420}
LEVEL_OPTION = {"ie_la": "地方政府", "ie_ed": "選舉分區"}
LEVEL_ORDER = ["ie_la", "ie_ed"]

# Statistics 分頁（tab）＝人口／社經；完整目錄（data）另一組名稱，避免與 tab 主題同身分（比照加拿大、南韓）。
TAB = {"population": "人口", "socioeconomic": "社經"}
DATA = {"population": "人口統計", "socioeconomic": "社經統計"}

SUB_POP = "人口（2022 普查）"
SUB_AGE = "年齡結構（2022 普查）"
SUB_HOUSING = "家戶與住宅（2022 普查）"
SUB_RENT = "租金（RTB）"
SUB_LABOUR = "教育與勞動（2022 普查）"

LOC_RES = "常住地所在的地方政府／選舉分區（2022 年普查）"
LOC_HH = "家戶常住地所在的地方政府／選舉分區（2022 年普查）"
LOC_RENT = "出租住宅所在的郡（RTB 地點，對照到地方政府）"

# 圖例說明（使用者看得到；en／ja 譯文在 enums.statLegendNote，以中文原文為 key）
CENSUS = "2022 年人口普查（普查日 2022-04-03），各表口徑不同，不可相除或混算。"
ED_SMALL = "選舉分區平均約 1,500 人，人口少的分區比例波動大。"
DENSITY = "人口密度＝人口 ÷ 面積（含湖泊等內陸水域），自行計算到小數 3 位。"
URBAN = "都市人口比依 CSO 城鄉分類 2022 第 1–3 類小區（城市、衛星都市鎮、獨立都市鎮），不是行政上的市或鎮；選舉分區多為 0% 或 100%。"
HOUSEHOLD = "私人家戶，不含集體住所（療養院、宿舍等）。"
TENURE = "權屬比例的分母排除未填權屬的家戶（全國 4.37%），只算永久私人住宅。"
DEGREE = "學歷分母含仍在學的 15 歲以上人口，學生多的分區比例偏低。"
LABOUR = "普查「主要經濟狀態」自填口徑（15 歲以上），與勞動力調查（LFS）不可直接比較。"
RENT = "RTB 登記租約的平均月租（所有房數、房型），不含未登記租約與社會住宅。"
RENT_SCOPE = "只涵蓋 23 個地方政府：都柏林 4 區與 Cork、Galway 的市／郡對不上 RTB 地點，標未涵蓋。"
BOUNDARY = "行政區界：地方政府為 Tailte Éireann 2026 法定界、選舉分區為 CSO 2022 統計界（CC BY 4.0），簡化 100–200 公尺。"
ZERO = "最淺色含 0（該區為 0，不是無資料）。"

POP_NOTES = [CENSUS, ED_SMALL]

# 一列一個指標（group），列內用 地方政府、選舉分區 切換（option）。
INDICATORS = [
    # ── 人口 ──
    dict(base="statsIePopulation", tab="population", sub=SUB_POP, label="總人口", digits=0, loc=LOC_RES, notes=[CENSUS]),
    dict(base="statsIePopulationDensity", tab="population", sub=SUB_POP, label="人口密度", digits=2, loc=LOC_RES, notes=[CENSUS, DENSITY]),
    dict(base="statsIeUrbanShare", tab="population", sub=SUB_POP, label="都市人口比", digits=1, loc=LOC_RES, notes=POP_NOTES + [URBAN]),
    dict(base="statsIeAgeYoungShare", tab="population", sub=SUB_AGE, label="0–14 歲人口比例", digits=1, loc=LOC_RES, notes=POP_NOTES),
    dict(base="statsIeAgeWorkingShare", tab="population", sub=SUB_AGE, label="15–64 歲人口比例", digits=1, loc=LOC_RES, notes=POP_NOTES),
    dict(base="statsIeAgeOldShare", tab="population", sub=SUB_AGE, label="65 歲以上人口比例", digits=1, loc=LOC_RES, notes=POP_NOTES),
    # ── 社經 ──
    dict(base="statsIeHouseholds", tab="socioeconomic", sub=SUB_HOUSING, label="私人家戶數", digits=0, loc=LOC_HH, notes=[CENSUS, HOUSEHOLD]),
    dict(base="statsIeOwnerOccupied", tab="socioeconomic", sub=SUB_HOUSING, label="自有住宅比例", digits=1, loc=LOC_HH, notes=POP_NOTES + [TENURE]),
    dict(base="statsIePrivateRented", tab="socioeconomic", sub=SUB_HOUSING, label="私人租屋比例", digits=1, loc=LOC_HH, notes=POP_NOTES + [TENURE]),
    dict(base="statsIeSocialRented", tab="socioeconomic", sub=SUB_HOUSING, label="社會住宅租戶比例", digits=1, loc=LOC_HH, notes=POP_NOTES + [TENURE]),
    dict(base="statsIeAverageRent", tab="socioeconomic", sub=SUB_RENT, label="平均月租", digits=0, loc=LOC_RENT, notes=[RENT, RENT_SCOPE]),
    dict(base="statsIeDegreeShare", tab="socioeconomic", sub=SUB_LABOUR, label="學士以上學歷比例", digits=1, loc=LOC_RES, notes=POP_NOTES + [DEGREE]),
    dict(base="statsIeUnemploymentRate", tab="socioeconomic", sub=SUB_LABOUR, label="失業率", digits=1, loc=LOC_RES, notes=POP_NOTES + [LABOUR]),
    dict(base="statsIeParticipationRate", tab="socioeconomic", sub=SUB_LABOUR, label="勞動參與率", digits=1, loc=LOC_RES, notes=POP_NOTES + [LABOUR]),
    dict(base="statsIeEmploymentRate", tab="socioeconomic", sub=SUB_LABOUR, label="就業率", digits=1, loc=LOC_RES, notes=POP_NOTES + [LABOUR]),
]
# 由 SAPS 計數自行計算的比例與密度：derived=True，以 handoff 的 definition 當 derived_method（總人口、家戶數、租金是來源值）。
DERIVED_BASES = ["statsIePopulationDensity", "statsIeUrbanShare", "statsIeAgeYoungShare", "statsIeAgeWorkingShare",
                 "statsIeAgeOldShare", "statsIeOwnerOccupied", "statsIePrivateRented", "statsIeSocialRented",
                 "statsIeDegreeShare", "statsIeUnemploymentRate", "statsIeParticipationRate", "statsIeEmploymentRate"]
LEVEL_SUFFIX = {"ie_la": "La", "ie_ed": "Ed"}
# 草稿斷點第一級為 0（選舉分區都市人口比多為 0% 或 100%）時改用固定分級。
BREAKS = {"statsIeUrbanShareEd": [20, 40, 60, 80]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--handoff", required=True, type=Path)
    args = parser.parse_args()
    delivered = json.loads(args.handoff.read_text())
    if delivered["country"] != "IE" or delivered["schema"] != "ie-statistics-recipes-v1":
        raise SystemExit(f"{args.handoff.name}: unexpected handoff schema")
    by_key = {r["layer_key"]: r for r in delivered["recipes"]}
    if len(by_key) != len(delivered["recipes"]):
        raise SystemExit("duplicated layer_key in handoff")

    planned = {}
    for spec in INDICATORS:
        for level in LEVEL_ORDER:
            key = spec["base"] + LEVEL_SUFFIX[level]
            if key in by_key:
                planned[key] = (spec, level)
    if set(planned) != set(by_key):
        raise SystemExit(f"handoff keys {sorted(set(by_key) - set(planned))} not planned / {sorted(set(planned) - set(by_key))} missing")

    recipes, report = [], []
    for key, (spec, level) in planned.items():
        layer = by_key[key]
        if not layer["enabled"] or layer["level"] != level or layer["dimension_keys"]:
            raise SystemExit(f"{key}: disabled, wrong level or has dimensions")
        options, statuses, zero, latest = [], Counter(), 0, None
        for option in layer["release_options"]:
            body = json.loads((args.root / option["bundle_path"]).read_text())
            release = body["release"]
            if (body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"]
                    or body["indicator"]["unit"] != layer["unit"] or release["id"] != option["release_id"]):
                raise SystemExit(f"{key}: {option['release_id']} does not match dataset/indicator/unit/id")
            if (release["period_start"], release["period_end"]) != (option["period_start"], option["period_end"]):
                raise SystemExit(f"{key}: {option['release_id']} period differs")
            if release["boundary_version"] != layer["boundary_version"] or option["dimensions"]:
                raise SystemExit(f"{key}: {option['release_id']} boundary or dimensions differ")
            obs = body["observations"]
            codes = {o["area_code"] for o in obs}
            if {o["area_level"] for o in obs} != {level} or len(obs) != len(codes) or len(codes) != AREA_COUNT[level]:
                raise SystemExit(f"{key}: {option['release_id']} needs {AREA_COUNT[level]} unique rows, got {len(obs)}")
            for o in obs:
                statuses[o["status"]] += 1
                if o["status"] == "observed":
                    if not isinstance(o["value"], (int, float)):
                        raise SystemExit(f"{key}: observed non-number")
                    zero += o["value"] == 0
                elif o["value"] is not None:
                    raise SystemExit(f"{key}: non-observed value must be null")
            if latest is None or release["period_end"] > latest["release"]["period_end"]:
                latest = body
            options.append({"release_id": option["release_id"], "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": {}})
        assert latest is not None
        unexpected = set(statuses) - {"observed"} - set(layer["status_labels"])
        if unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")
        breaks = BREAKS.get(key, layer["legend"]["breaks"])
        if sorted(set(breaks)) != breaks or breaks[0] <= 0:
            raise SystemExit(f"{key}: bad breaks {breaks}")
        release = latest["release"]
        attribution = layer["source"]["attribution"]
        if release["provenance"]["processing"]["parameters"].get("attribution") != attribution:
            raise SystemExit(f"{key}: attribution differs between handoff and bundle")
        notes = list(spec["notes"]) + [BOUNDARY, f"署名：{attribution}"]
        if level == "ie_la" and ED_SMALL in notes:
            notes.remove(ED_SMALL)
        default_option = max(options, key=lambda o: (o["period_end"], o["period_start"]))
        recipes.append({
            "layer_key": key, "enabled": True, "family": "ie", "country": "IE",
            "label": spec["label"], "group": spec["base"][len("stats"):][0].lower() + spec["base"][len("stats") + 1:],
            "group_label": spec["label"], "option_label": LEVEL_OPTION[level], "subgroup": spec["sub"],
            "data_theme": DATA[spec["tab"]], "tab_theme": TAB[spec["tab"]],
            "visual_theme": "population",
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": level,
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": latest["indicator"]["aggregation"],
            "default_release_id": default_option["release_id"],
            "dimensions": [],
            "release_options": sorted(options, key=lambda o: o["period_end"], reverse=True),
            "legend": {
                "method": "fixed_breaks", "breaks": breaks, "direction": "ascending",
                "scale_note": None, "zero_note": ZERO if zero else None, "display_note": None,
                "notes": notes, "by_dimension": None, "dimension_notes": None,
            },
            "status_labels": {kind: label for kind, label in layer["status_labels"].items() if statuses.get(kind)},
            "format": {"locale": "zh-TW", "maximumFractionDigits": spec["digits"]},
            "derived": spec["base"] in DERIVED_BASES,
            **({"derived_method": layer["definition"]} if spec["base"] in DERIVED_BASES else {}),
            "location_semantics": spec["loc"],
            "disclosure": layer["disclosure"],
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": release["source_metadata"]["dataset_title"],
            "attribution": attribution,
            "delivery": {
                "observed_statuses": dict(sorted(statuses.items())),
                "draft_breaks_basis": layer["legend"].get("breaks_basis"),
                "label_en": layer["label_en"], "unit_en": layer["unit_en"], "definition": layer["definition"],
                "receipts": [{"release_id": o["release_id"], "bundle_path": o["bundle_path"]} for o in layer["release_options"]],
            },
        })
        report.append(f"{key:30} zero={zero} options={len(options)} breaks={breaks} statuses={dict(statuses)}")
    print(f"ie: recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))
    document = {
        "version": 1,
        "scope": "production_r2",
        "family": "ie",
        "country": "IE",
        "generated_from": {"recipes": args.handoff.name, "bundles": "taipei-gis-analytics data/processed/<theme>/<dataset_id>/releases/<release_id>.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"not_applicable": "來源不涵蓋此地區（未涵蓋）；不是 0、不是缺值", "missing": "來源有涵蓋但此區無值；本批普查 4 個 dataset 地方政府、選舉分區全部有值，RTB 租金 23 個地方政府全部有值"},
        "recipes": recipes,
    }
    OUT.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.name} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
