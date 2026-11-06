#!/usr/bin/env python3
"""Build the Canada (CA) regional statistics family from the analytics handoff recipes.

Input (taipei-gis-analytics, read-only):
  --handoff  docs/handoff/ca-statistics-recipes.json（24 recipes, levels ca_pr 13／ca_cd 293, 24 releases）
  --root     analytics checkout whose data/processed/<theme>/<dataset_id>/releases/<release_id>.json holds the bundles.

Output: src/data/caStatisticsRecipes.json（atlas recipe schema, src/data/atlasStatisticsTypes.ts; family "ca", country "CA"）.

Same contract as build_kr_statistics_recipes.py: the handoff carries the data contract and draft breaks; this script
owns the presentation (one sidebar row per indicator with 省／地區、普查區 as options; CA statistics themes 人口／社經;
curated legend notes translated in enums.statLegendNote; status labels pruned to statuses that occur) and cross-checks
every option against its bundle.

Usage:
  python3 scripts/statistics/build_ca_statistics_recipes.py --root <analytics checkout> \
    --handoff <analytics>/docs/handoff/ca-statistics-recipes.json
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/caStatisticsRecipes.json"
AREA_COUNT = {"ca_pr": 13, "ca_cd": 293}
LEVEL_OPTION = {"ca_pr": "省／地區", "ca_cd": "普查區"}
LEVEL_ORDER = ["ca_pr", "ca_cd"]

# Statistics 分頁（tab）＝人口／社經；完整目錄（data）另一組名稱，避免與 tab 主題同身分（比照英國、南韓）。
TAB = {"population": "人口", "socioeconomic": "社經"}
DATA = {"population": "人口統計", "socioeconomic": "社經統計"}

SUB_POP = "人口（2021 普查）"
SUB_AGE = "年齡結構（2021 普查）"
SUB_INCOME = "家戶與所得（2021 普查）"
SUB_LABOUR = "勞動力（2021 普查）"

LOC_RES = "常住地所在的省／普查區（2021 年普查界）"
LOC_HH = "家戶常住地所在的省／普查區（2021 年普查界）"

# 圖例說明（使用者看得到；en／ja 譯文在 enums.statLegendNote，以中文原文為 key）
CENSUS = "2021 年人口普查（普查日 2021-05-11），各表年份與口徑不同，不可相除或混算。"
DENSITY = "人口密度＝人口 ÷ 陸地面積，自行重算到小數 3 位（官方表只到小數 1 位，北方地區會顯示為 0）。"
AGE_ROUND = "年齡計數經加拿大統計局隨機捨入到 5 的倍數，比例誤差小於 0.01 個百分點。"
HOUSEHOLD = "私人家戶＝有常住居民的私人住宅，不含集體住宅。"
INCOME_YEAR = "所得為 2020 年度（2020 年幣值加幣），含 COVID-19 紓困給付，中位數因此偏高。"
INCOME_SAMPLE = "來自 2021 普查長表（25% 抽樣，多數直接連結稅務資料），只算私人家戶。"
LABOUR_WEEK = "參考週 2021-05-02～05-08 正值 COVID-19 第三波封鎖，失業率高於常態年份。"
LABOUR_SAMPLE = "2021 普查長表（25% 抽樣）推估，15 歲以上；與勞動力調查（LFS）月資料口徑不同。"
BOUNDARY = "行政區界：加拿大統計局 2021 年普查製圖界線（OGL-Canada），簡化 1 公里並略去小於 1 平方公里的小島。"

POP_NOTES = [CENSUS]
AGE_NOTES = [CENSUS, AGE_ROUND]
INCOME_NOTES = [INCOME_YEAR, INCOME_SAMPLE]
LABOUR_NOTES = [LABOUR_WEEK, LABOUR_SAMPLE]

# 一列一個指標（group），列內用 省／地區、普查區 切換（option）；visual 對應 statisticsVisuals 的主題色。
INDICATORS = [
    # ── 人口 ──
    dict(base="statsCaPopulation", tab="population", sub=SUB_POP, label="總人口", digits=0, loc=LOC_RES, notes=POP_NOTES),
    dict(base="statsCaPopulationDensity", tab="population", sub=SUB_POP, label="人口密度", digits=2, loc=LOC_RES, notes=POP_NOTES + [DENSITY]),
    dict(base="statsCaAgeYoungShare", tab="population", sub=SUB_AGE, label="0–14 歲人口比例", digits=1, loc=LOC_RES, notes=AGE_NOTES),
    dict(base="statsCaAgeWorkingShare", tab="population", sub=SUB_AGE, label="15–64 歲人口比例", digits=1, loc=LOC_RES, notes=AGE_NOTES),
    dict(base="statsCaAgeOldShare", tab="population", sub=SUB_AGE, label="65 歲以上人口比例", digits=1, loc=LOC_RES, notes=AGE_NOTES),
    dict(base="statsCaMedianAge", tab="population", sub=SUB_AGE, label="年齡中位數", digits=1, loc=LOC_RES, notes=[CENSUS]),
    # ── 社經 ──
    dict(base="statsCaHouseholds", tab="socioeconomic", sub=SUB_INCOME, label="私人家戶數", digits=0, loc=LOC_HH, notes=POP_NOTES + [HOUSEHOLD]),
    dict(base="statsCaHouseholdIncome", tab="socioeconomic", sub=SUB_INCOME, label="家戶總所得中位數", digits=0, loc=LOC_HH, notes=INCOME_NOTES),
    dict(base="statsCaHouseholdIncomeAfterTax", tab="socioeconomic", sub=SUB_INCOME, label="家戶稅後所得中位數", digits=0, loc=LOC_HH, notes=INCOME_NOTES),
    dict(base="statsCaUnemploymentRate", tab="socioeconomic", sub=SUB_LABOUR, label="失業率", digits=1, loc=LOC_RES, notes=LABOUR_NOTES),
    dict(base="statsCaParticipationRate", tab="socioeconomic", sub=SUB_LABOUR, label="勞動參與率", digits=1, loc=LOC_RES, notes=LABOUR_NOTES),
    dict(base="statsCaEmploymentRate", tab="socioeconomic", sub=SUB_LABOUR, label="就業率", digits=1, loc=LOC_RES, notes=LABOUR_NOTES),
]
# 由來源欄位自行計算的指標（人口密度重算到小數 3 位、年齡比例由計數相除）：derived=True，以 handoff 的 definition 當 derived_method。
# 失業／參與／就業率等來源另有公布值的指標維持 False（未逐一核對上游是否自算；handoff 補充後再擴充）。
DERIVED_BASES = ['statsCaPopulationDensity', 'statsCaAgeYoungShare', 'statsCaAgeWorkingShare', 'statsCaAgeOldShare']
LEVEL_SUFFIX = {"ca_pr": "Pr", "ca_cd": "Cd"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--handoff", required=True, type=Path)
    args = parser.parse_args()
    delivered = json.loads(args.handoff.read_text())
    if delivered["country"] != "CA" or delivered["schema"] != "ca-statistics-recipes-v1":
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
        breaks = layer["legend"]["breaks"]
        if sorted(set(breaks)) != breaks or breaks[0] <= 0:
            raise SystemExit(f"{key}: bad breaks {breaks}")
        if zero:
            raise SystemExit(f"{key}: observed zero needs a zero_note")
        release = latest["release"]
        attribution = layer["source"]["attribution"]
        if release["provenance"]["processing"]["parameters"].get("attribution") != attribution:
            raise SystemExit(f"{key}: attribution differs between handoff and bundle")
        notes = list(spec["notes"]) + [BOUNDARY, f"署名：{attribution}"]
        default_option = max(options, key=lambda o: (o["period_end"], o["period_start"]))
        recipes.append({
            "layer_key": key, "enabled": True, "family": "ca", "country": "CA",
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
                "scale_note": None, "zero_note": None, "display_note": None,
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
        report.append(f"{key:32} options={len(options)} breaks={breaks} statuses={dict(statuses)}")
    print(f"ca: recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))
    document = {
        "version": 1,
        "scope": "production_r2",
        "family": "ca",
        "country": "CA",
        "generated_from": {"recipes": args.handoff.name, "bundles": "taipei-gis-analytics data/processed/<theme>/<dataset_id>/releases/<release_id>.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"not_applicable": "來源不涵蓋此地區（未涵蓋）；不是 0、不是缺值", "missing": "來源有涵蓋但此區無值；本批 4 張普查表省／地區、普查區全部有值"},
        "recipes": recipes,
    }
    OUT.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.name} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
