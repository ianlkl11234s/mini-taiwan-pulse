#!/usr/bin/env python3
"""Build the South Korea (KR) regional statistics family from the analytics handoff recipes.

Input (taipei-gis-analytics, read-only):
  --handoff  docs/handoff/kr-statistics-recipes.json（49 recipes, levels kr_sido 16／kr_sigungu 256, 65 releases）
  --root     analytics checkout whose data/processed/<theme>/<dataset_id>/releases/<release_id>.json holds the bundles.

Output: src/data/krStatisticsRecipes.json（atlas recipe schema, src/data/atlasStatisticsTypes.ts; family "kr", country "KR"）.

The handoff carries the data contract (dataset／indicator／boundary／release selector／source／licence／attribution) and
draft breaks. This script owns the presentation: one sidebar row per indicator with 道級／市郡區 as options, the KR
statistics themes (人口／社經／公共安全), curated legend notes (user-facing, no internal tokens; translated in
enums.statLegendNote), status legend labels pruned to the statuses that actually occur, and the fixed breaks.
Every option is cross-checked against its bundle (dataset／indicator／unit／id／period／boundary／level and the
expected number of unique area rows).

Usage:
  python3 scripts/statistics/build_kr_statistics_recipes.py --root <analytics checkout> \
    --handoff <analytics>/docs/handoff/kr-statistics-recipes.json
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/krStatisticsRecipes.json"
AREA_COUNT = {"kr_sido": 16, "kr_sigungu": 256}
LEVEL_OPTION = {"kr_sido": "道級", "kr_sigungu": "市郡區"}
LEVEL_ORDER = ["kr_sido", "kr_sigungu"]

# Statistics 分頁（tab）＝人口／社經；完整目錄（data）另一組名稱，避免與 tab 主題同身分（比照英國）。
TAB = {"population": "人口", "socioeconomic": "社經", "safety": "公共安全"}
DATA = {"population": "人口統計", "socioeconomic": "社經統計", "safety": "公共安全統計"}

SUB_MOIS = "住民登錄人口（2026-09）"
SUB_SGIS_POP = "人口密度與高齡化（2024）"
SUB_SEOUL = "首爾生活人口（2026-07）"
SUB_HOUSING = "家戶與住宅（2024）"
SUB_BUSINESS = "事業體（2024）"
SUB_FIRE = "火災（2021–2023）"
SUB_TRAFFIC = "交通事故（2025）"

LOC_MOIS = "住民登錄地所在行政區（2026-10 界）"
LOC_SGIS = "統計對象所在行政區（2024 年統計廳界對應到 2026-10 界）"
LOC_SEOUL = "在地人數所在的首爾自治區（電信推估）"
LOC_FIRE = "火災發生地所在行政區（2026-10 界）"
LOC_TRAFFIC = "事故發生地所在行政區（2026-10 界）"

# 圖例說明（使用者看得到；en／ja 譯文在 enums.statLegendNote，以中文原文為 key）
MOIS_SCOPE = "住民登錄人口（2026-09-30），不含未登錄外國人；與台灣戶籍人口同類口徑。"
MOIS_BRANCH = "60 個出張所的人口已依代碼計入所屬市郡區與道級。"
MOIS_SEJONG = "市郡區共 256 個（含一般區）；世宗特別自治市只有一層。"
SGIS_YEAR = "2024 年統計（登錄普查，含外國人），與住民登錄人口（2026-09-30）年份與口徑不同，不可相除或混算。"
SGIS_BOUNDARY = "來源為 2024 年統計廳舊界，已對應到 2026-10 界線，2025-07 後新設 8 區無資料"
SGIS_MERGED = "全南光州統合特別市的道級值，是以 2024 年光州廣域市＋全羅南道的分子分母合併重算。"
SGIS_HOUSEHOLD = "一般戶，不含集體戶。"
SGIS_HOUSEHOLD_SIZE = "來源只到小數 1 位，也沒有戶內人口總數，道級無法依分子分母重算，因此只提供市郡區。"
SGIS_BUSINESS = "事業體與從業人員為 2024 年全國事業體調查口徑。"
SEOUL_SCOPE = "只涵蓋首爾 25 區，其他地區未涵蓋（不是 0）。"
SEOUL_METHOD = "電信推估的在地人數（內國人），不是住民登錄人口，不可與住民登錄人口相除或混算。"
SEOUL_MONTH = "只取 2026 年 7 月一個月的月平均，不代表全年。"
SEOUL_HOURS = "全日＝24 小時平均；日間＝09–18 時平均；夜間＝00–06 時平均。"
SEOUL_RATIO = "日夜生活人口比＝日間（09–18 時平均）÷夜間（00–06 時平均）×100；大於 100 表示白天流入。"
FIRE_SCOPE = "消防機關出動並調查的火災（國家火災情報系統逐件紀錄），依接報日歸年度、依發生地歸區。"
FIRE_GUNWI = "軍威郡 2023 年 7 月劃入大邱，2021–2022 年也算在大邱。"
FIRE_DAMAGE = "財產損失為名目千韓元，未調整物價。"
FIRE_GAP = "富川市、華城市只有市合計，各一般區無資料；仁川 2026 年改制的濟物浦、永宗、西海、黔丹 4 區無資料（不是 0）。這些件數仍計入道級。"
TRAFFIC_SCOPE = "只含警察處理、有人員傷亡的交通事故；死亡指事故後 30 日內死亡。"
TRAFFIC_INJURY = "受傷人數＝重傷（治療 3 週以上）＋輕傷（5 日至 3 週）＋傷害申報（未滿 5 日）。"
TRAFFIC_GAP = "水原、城南、安養、富川、安山、華城、高陽、龍仁、清州、天安、全州、浦項、昌原 13 市只有市合計，其 39 個一般區無資料；仁川 2026 年改制的 4 區無資料（不是 0）。這些件數仍計入道級。"
COUNT_NOTE = "件數與人數未除以人口，人口多的地區自然較高。"
MERGED_SUM = "全南光州統合特別市的道級值＝光州廣域市＋全羅南道合計（資料年份早於 2026 年 7 月合併）。"
ZERO_IN_LOWEST = "最淺色含 0 人（該區該年為 0，不是無資料）。"
ZERO_OWN_CLASS = "0 人自成最淺一級（該區該年無火災死亡，不是無資料）。"
BOUNDARY = "行政區界：vuski/admdongkor 2026-10-01 版（CC BY 4.0）。"

MOIS_NOTES = [MOIS_SCOPE, MOIS_BRANCH, MOIS_SEJONG]
SGIS_NOTES = [SGIS_YEAR, SGIS_BOUNDARY]
FIRE_NOTES = [FIRE_SCOPE, COUNT_NOTE, FIRE_GUNWI]
TRAFFIC_NOTES = [TRAFFIC_SCOPE, COUNT_NOTE]
# 市郡區層才有「無資料」區；道級是全部列加總，另加全南光州合併說明
GAP_NOTES = {"kr_fire_incidents_nfds": FIRE_GAP, "kr_traffic_accidents_koroad": TRAFFIC_GAP}

# 一列一個指標（group），列內用 道級／市郡區 切換（option）；visual 對應 statisticsVisuals 的主題色。
INDICATORS = [
    # ── 人口：住民登錄人口 ──
    dict(base="statsKrPopulation", tab="population", sub=SUB_MOIS, label="總人口", digits=0, loc=LOC_MOIS, notes=MOIS_NOTES),
    dict(base="statsKrPopulationMale", tab="population", sub=SUB_MOIS, label="男性人口", digits=0, loc=LOC_MOIS, notes=MOIS_NOTES),
    dict(base="statsKrPopulationFemale", tab="population", sub=SUB_MOIS, label="女性人口", digits=0, loc=LOC_MOIS, notes=MOIS_NOTES),
    dict(base="statsKrSexRatio", tab="population", sub=SUB_MOIS, label="性比例", digits=1, loc=LOC_MOIS, notes=MOIS_NOTES),
    dict(base="statsKrAgeYoungShare", tab="population", sub=SUB_MOIS, label="0–14 歲人口比例", digits=1, loc=LOC_MOIS, notes=MOIS_NOTES),
    dict(base="statsKrAgeWorkingShare", tab="population", sub=SUB_MOIS, label="15–64 歲人口比例", digits=1, loc=LOC_MOIS, notes=MOIS_NOTES),
    dict(base="statsKrAgeOldShare", tab="population", sub=SUB_MOIS, label="65 歲以上人口比例", digits=1, loc=LOC_MOIS, notes=MOIS_NOTES),
    # ── 人口：SGIS 2024 ──
    dict(base="statsKrPopulationDensity", tab="population", sub=SUB_SGIS_POP, label="人口密度", digits=0, loc=LOC_SGIS, notes=SGIS_NOTES),
    dict(base="statsKrMeanAge", tab="population", sub=SUB_SGIS_POP, label="平均年齡", digits=1, loc=LOC_SGIS, notes=SGIS_NOTES),
    dict(base="statsKrAgingIndex", tab="population", sub=SUB_SGIS_POP, label="老化指數", digits=1, loc=LOC_SGIS, notes=SGIS_NOTES),
    # ── 人口：首爾生活人口（只有市郡區） ──
    dict(base="statsKrSeoulLivingPop", tab="population", sub=SUB_SEOUL, label="全日平均生活人口", digits=0, loc=LOC_SEOUL, notes=[SEOUL_SCOPE, SEOUL_HOURS, SEOUL_METHOD, SEOUL_MONTH]),
    dict(base="statsKrSeoulLivingPopDay", tab="population", sub=SUB_SEOUL, label="日間生活人口", digits=0, loc=LOC_SEOUL, notes=[SEOUL_SCOPE, SEOUL_HOURS, SEOUL_METHOD, SEOUL_MONTH]),
    dict(base="statsKrSeoulLivingPopNight", tab="population", sub=SUB_SEOUL, label="夜間生活人口", digits=0, loc=LOC_SEOUL, notes=[SEOUL_SCOPE, SEOUL_HOURS, SEOUL_METHOD, SEOUL_MONTH]),
    dict(base="statsKrSeoulDayNightRatio", tab="population", sub=SUB_SEOUL, label="日夜生活人口比", digits=1, loc=LOC_SEOUL, notes=[SEOUL_SCOPE, SEOUL_RATIO, SEOUL_METHOD, SEOUL_MONTH]),
    # ── 社經 ──
    dict(base="statsKrHouseholds", tab="socioeconomic", sub=SUB_HOUSING, label="一般戶數", digits=0, loc=LOC_SGIS, notes=SGIS_NOTES + [SGIS_HOUSEHOLD]),
    dict(base="statsKrHouseholdSize", tab="socioeconomic", sub=SUB_HOUSING, label="平均戶量", digits=1, loc=LOC_SGIS, notes=SGIS_NOTES + [SGIS_HOUSEHOLD, SGIS_HOUSEHOLD_SIZE]),
    dict(base="statsKrDwellings", tab="socioeconomic", sub=SUB_HOUSING, label="住宅數", digits=0, loc=LOC_SGIS, notes=SGIS_NOTES),
    dict(base="statsKrEstablishments", tab="socioeconomic", sub=SUB_BUSINESS, label="事業體數", digits=0, loc=LOC_SGIS, notes=SGIS_NOTES + [SGIS_BUSINESS]),
    dict(base="statsKrEmployees", tab="socioeconomic", sub=SUB_BUSINESS, label="從業人員數", digits=0, loc=LOC_SGIS, notes=SGIS_NOTES + [SGIS_BUSINESS]),
    # ── 公共安全：火災（2021–2023，件數類；visual 用治安紅色系，數量越多越深）──
    dict(base="statsKrFireIncidents", tab="safety", sub=SUB_FIRE, label="火災件數", digits=0, loc=LOC_FIRE, notes=FIRE_NOTES, visual="security"),
    dict(base="statsKrFireDeaths", tab="safety", sub=SUB_FIRE, label="火災死亡人數", digits=0, loc=LOC_FIRE, notes=FIRE_NOTES, visual="security",
         zero_note={"kr_sido": ZERO_IN_LOWEST, "kr_sigungu": ZERO_OWN_CLASS}, breaks={"kr_sigungu": [1, 2, 3, 5]}),
    dict(base="statsKrFireInjuries", tab="safety", sub=SUB_FIRE, label="火災受傷人數", digits=0, loc=LOC_FIRE, notes=FIRE_NOTES, visual="security",
         zero_note={"kr_sigungu": ZERO_IN_LOWEST}),
    dict(base="statsKrFireDamage", tab="safety", sub=SUB_FIRE, label="火災財產損失", digits=0, loc=LOC_FIRE, notes=FIRE_NOTES + [FIRE_DAMAGE], visual="security"),
    # ── 公共安全：交通事故（2025）──
    dict(base="statsKrTrafficAccidents", tab="safety", sub=SUB_TRAFFIC, label="交通事故件數", digits=0, loc=LOC_TRAFFIC, notes=TRAFFIC_NOTES, visual="security"),
    dict(base="statsKrTrafficDeaths", tab="safety", sub=SUB_TRAFFIC, label="交通事故死亡人數", digits=0, loc=LOC_TRAFFIC, notes=TRAFFIC_NOTES, visual="security",
         zero_note={"kr_sigungu": ZERO_IN_LOWEST}),
    dict(base="statsKrTrafficSeriousInjuries", tab="safety", sub=SUB_TRAFFIC, label="交通事故重傷人數", digits=0, loc=LOC_TRAFFIC, notes=TRAFFIC_NOTES, visual="security"),
    dict(base="statsKrTrafficInjuries", tab="safety", sub=SUB_TRAFFIC, label="交通事故受傷人數", digits=0, loc=LOC_TRAFFIC, notes=TRAFFIC_NOTES + [TRAFFIC_INJURY], visual="security"),
]
# 本專案（或上游 pipeline）由來源欄位自行計算的指標：derived=True，並以 handoff 的 definition 當 derived_method。
# 來源直接公布的值（人口、SGIS 平均年齡、戶數…）維持 False。
DERIVED_BASES = ['statsKrSexRatio', 'statsKrAgeYoungShare', 'statsKrAgeWorkingShare', 'statsKrAgeOldShare', 'statsKrAgingIndex', 'statsKrSeoulLivingPop', 'statsKrSeoulLivingPopDay', 'statsKrSeoulLivingPopNight', 'statsKrSeoulDayNightRatio', 'statsKrTrafficInjuries']
LEVEL_SUFFIX = {"kr_sido": "Sido", "kr_sigungu": "Sgg"}
SGIS_DATASET = "kr_sgis_admin_stats"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--handoff", required=True, type=Path)
    args = parser.parse_args()
    delivered = json.loads(args.handoff.read_text())
    if delivered["country"] != "KR" or delivered["schema"] != "kr-statistics-recipes-v1":
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
        breaks = spec.get("breaks", {}).get(level, layer["legend"]["breaks"])
        if sorted(set(breaks)) != breaks or breaks[0] <= 0:
            raise SystemExit(f"{key}: bad breaks {breaks}")
        zero_note = spec.get("zero_note", {}).get(level)
        if zero and not zero_note:
            raise SystemExit(f"{key}: observed zero needs a zero_note")
        if zero_note and not zero:
            raise SystemExit(f"{key}: zero_note without observed zero")
        release = latest["release"]
        attribution = layer["source"]["attribution"]
        if release["provenance"]["processing"]["parameters"].get("attribution") != attribution:
            raise SystemExit(f"{key}: attribution differs between handoff and bundle")
        notes = list(spec["notes"])
        if layer["dataset_id"] == SGIS_DATASET and level == "kr_sido":
            notes.append(SGIS_MERGED)
        if layer["dataset_id"] in GAP_NOTES:
            notes.append(MERGED_SUM if level == "kr_sido" else GAP_NOTES[layer["dataset_id"]])
        notes += [BOUNDARY, f"署名：{attribution}"]
        default_option = max(options, key=lambda o: (o["period_end"], o["period_start"]))
        recipes.append({
            "layer_key": key, "enabled": True, "family": "kr", "country": "KR",
            "label": spec["label"], "group": spec["base"][len("stats"):][0].lower() + spec["base"][len("stats") + 1:],
            "group_label": spec["label"], "option_label": LEVEL_OPTION[level], "subgroup": spec["sub"],
            "data_theme": DATA[spec["tab"]], "tab_theme": TAB[spec["tab"]],
            "visual_theme": spec.get("visual", "population"),
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": level,
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": latest["indicator"]["aggregation"],
            "default_release_id": default_option["release_id"],
            "dimensions": [],
            "release_options": sorted(options, key=lambda o: o["period_end"], reverse=True),
            "legend": {
                "method": "fixed_breaks", "breaks": breaks, "direction": "ascending",
                "scale_note": None, "zero_note": zero_note, "display_note": None,
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
    print(f"kr: recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))
    document = {
        "version": 1,
        "scope": "production_r2",
        "family": "kr",
        "country": "KR",
        "generated_from": {"recipes": args.handoff.name, "bundles": "taipei-gis-analytics data/processed/<theme>/<dataset_id>/releases/<release_id>.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"not_applicable": "來源不涵蓋此地區（未涵蓋，例：首爾生活人口只涵蓋首爾）；不是 0、不是缺值", "missing": "來源有涵蓋但此區無值（例：2025-07 後新設、沒有 2024 年值的 8 區；來源只給市合計的一般區）"},
        "recipes": recipes,
    }
    OUT.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.name} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
