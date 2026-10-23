#!/usr/bin/env python3
"""Build the Taipei agency statistics family (src/data/taipeiAgencyStatisticsRecipes.json) from the analytics delivery.

Inputs (taipei-gis-analytics, read-only):
  --recipes  docs/handoff/taipei-agency-statistics-recipes.json
             (48 recipes; only the 5 township datasets are mapped here — waste, recycling, sewer, factories,
             usage permits. The bus county datasets stay in the DB／warehouse and are not map layers.)
  --root     analytics checkout whose `<bundle_dir>/<release_id>.json` holds each option's release bundle.

The output uses the atlas recipe schema (atlasStatisticsTypes.ts), so the shared atlas runtime (loader, selection,
legend, details, catalogue) serves it unchanged. This script owns the presentation: which indicators become map layers
(layer-plan: 11 of the 18 township recipes; sewer numerators／denominators are not coloured), the sidebar groups, fixed
breaks, legend notes (coverage, 12-district sum ≠ city, sewer formula break, permit counting, building area) and the
default dimension. Values, periods, boundaries and sources always come from the release bundles: every option is
cross-checked against its bundle (dataset／indicator／unit／id／period／boundary and the exact (area_code, dimensions)
tuple), only the 12 Taipei districts may appear, and unknown statuses abort the build.

`roc_year`／`month` stay inside each option's dimensions (the CDN selector identity) but are not declared as user
dimensions — the period select already covers them. `industry_name` likewise rides along with `industry_code`.

Usage:
  python3 scripts/statistics/build_taipei_agency_statistics_recipes.py \
    --recipes <taipei-agency-statistics-recipes.json> --root <analytics checkout>
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/taipeiAgencyStatisticsRecipes.json"

FAMILY = "taipeiAgency"
DATA_THEME = "臺北市局處統計 Taipei Agency Statistics"
TAB_THEME = "臺北市局處統計 Taipei City Agencies"
TAIPEI_DISTRICTS = {f"63000{n:02d}0" for n in range(1, 13)}
PERIOD_DIMENSIONS = {"roc_year", "month"}

MISSING_UNCOVERED = "未涵蓋（只涵蓋臺北市 12 區；其他縣市鄉鎮不是 0）"
MISSING_MIXED = "未涵蓋或無資料（臺北市以外未涵蓋；臺北市 12 區偶有缺值；都不是 0）"

COVERAGE_NOTE = "只涵蓋臺北市 12 區；其他縣市鄉鎮為未涵蓋，不是 0。"
WASTE_AREA_NOTE = "依清潔隊清運責任區統計，不等於該區居民產生量。"
GARBAGE_SUM_NOTE = "12 區加總不等於全市清運量：區隊量含巨大垃圾、不含回運垃圾量，全市量另計直屬隊等單位。"
SEWER_NOTES = [
    "累計值（月底）；分母為民政局月底門牌總戶數。",
    "108 年 5 月起公式與分類改變，拆成「108 年 4 月以前」與「108 年 5 月起」兩個口徑，不可串接比較。",
    "與縣市版「公共污水下水道用戶接管普及率」口徑不同：縣市版臺北市約 100%，衛工處門牌戶數基準 113 年 12 月為 82.8%。",
]
FACTORY_NOTES = [
    "來源「-」＝該區該產業無工廠，記為 0 家（真零）。",
    "缺 12 個月（例如 102 年 11 月、105 年 6 月、109 年 9 月）沒有月報，不補前月。",
]
FACTORY_TOTAL_NOTE = "92–95 年只有合計，沒有產業分項。"
FACTORY_INDUSTRY_NOTE = "產業分項自 96 年 1 月起；「99 無法歸類」只在部分期別出現。"
PERMIT_NOTES = [
    "一張使用執照計 1 件；跨區或無地址的執照（約 0.64%）不計入任何區。",
    "件數逐張計，95 年起比主計處年表多 6～21%，口徑不同。",
    "核發使用執照不等於完工入住或新增住宅供給。",
]
PERMIT_AREA_NOTE = "建築面積是建築物投影面積，不是總樓地板面積。"

SEWER_BREAKS = [70, 80, 85, 90]
PERMIT_COUNT_BREAKS = [1, 2, 3, 5]

# (layer_key, dataset_id, indicator_id, label, group, group_label, option_label, subgroup, visual, breaks, extra notes, digits)
LAYERS: list[dict] = [
    dict(key="statsTaipeiResourceRecyclingTownship", dataset="resource_recycling_township_taipei_monthly", indicator="resource_recycling_tonnes",
         label="臺北市各區資源回收量", group="taipeiResourceRecycling", group_label="臺北市各區資源回收量", option="公噸",
         subgroup="廢棄物與回收", breaks=[250, 350, 450, 550], notes=[WASTE_AREA_NOTE], digits=2,
         location="清潔隊清運責任區（區隊與行政區一對一），不等於居民產生地"),
    dict(key="statsTaipeiGarbageCollectedTownship", dataset="garbage_clearance_township_taipei_monthly", indicator="garbage_collected_tonnes",
         label="臺北市各區垃圾清運量", group="taipeiGarbageCollected", group_label="臺北市各區垃圾清運量", option="公噸",
         subgroup="廢棄物與回收", breaks=[2000, 2500, 3000, 3500], notes=[GARBAGE_SUM_NOTE, WASTE_AREA_NOTE], digits=2,
         location="清潔隊清運責任區（區隊與行政區一對一），不等於居民產生地"),
    dict(key="statsTaipeiSewerRatePublicTownship", dataset="sewer_connection_township_taipei_monthly", indicator="door_plate_connection_rate_public_from_10805",
         label="臺北市污水接管普及率（108 年 5 月起）", group="taipeiSewerRate", group_label="臺北市污水接管普及率", option="108 年 5 月起（公共污水下水道）",
         subgroup="污水下水道", breaks=SEWER_BREAKS, notes=SEWER_NOTES, digits=2, location="門牌所在行政區（月底累計）"),
    dict(key="statsTaipeiSewerRateLegacyTownship", dataset="sewer_connection_township_taipei_monthly", indicator="door_plate_connection_rate_incl_dedicated_to_10804",
         label="臺北市污水接管普及率（108 年 4 月以前，舊公式）", group="taipeiSewerRate", group_label="臺北市污水接管普及率", option="100 年 1 月～108 年 4 月（舊公式，含自設專用）",
         subgroup="污水下水道", breaks=SEWER_BREAKS, notes=SEWER_NOTES, digits=2, location="門牌所在行政區（月底累計）"),
    dict(key="statsTaipeiFactoryCountTownship", dataset="factory_count_township_taipei_monthly", indicator="factory_count_total",
         label="臺北市登記工廠家數", group="taipeiFactoryCount", group_label="臺北市登記工廠家數", option="合計",
         subgroup="工廠登記", breaks=[5, 10, 50, 100], notes=[FACTORY_NOTES[1], FACTORY_TOTAL_NOTE], digits=0,
         location="工廠登記地址所在行政區（月底家數）"),
    dict(key="statsTaipeiFactoryCountByIndustryTownship", dataset="factory_count_township_taipei_monthly", indicator="factory_count_by_industry",
         label="臺北市登記工廠家數（依產業中類）", group="taipeiFactoryCount", group_label="臺北市登記工廠家數", option="依產業中類",
         subgroup="工廠登記", breaks=[1, 3, 10, 25], notes=[*FACTORY_NOTES, FACTORY_INDUSTRY_NOTE], digits=0,
         location="工廠登記地址所在行政區（月底家數）",
         dimension=dict(key="industry_code", label="產業中類", default="26", name_key="industry_name")),
    dict(key="statsTaipeiUsagePermitCountTownship", dataset="building_usage_permits_township_taipei_monthly", indicator="permit_count_total",
         label="臺北市核發使用執照件數", group="taipeiUsagePermit", group_label="臺北市核發使用執照", option="件數（合計）",
         subgroup="建築使用執照", breaks=PERMIT_COUNT_BREAKS, notes=PERMIT_NOTES, digits=0, location="建築地點所在行政區（依發照日期）"),
    dict(key="statsTaipeiUsagePermitCountByBuildTypeTownship", dataset="building_usage_permits_township_taipei_monthly", indicator="permit_count_by_build_type",
         label="臺北市核發使用執照件數（依建造類別）", group="taipeiUsagePermit", group_label="臺北市核發使用執照", option="件數（依建造類別）",
         subgroup="建築使用執照", breaks=PERMIT_COUNT_BREAKS, notes=PERMIT_NOTES, digits=0, location="建築地點所在行政區（依發照日期）",
         dimension=dict(key="build_type", label="建造類別", default="新建", order=["新建", "增建", "修建", "改建"])),
    dict(key="statsTaipeiUsagePermitBuildingCountTownship", dataset="building_usage_permits_township_taipei_monthly", indicator="building_count",
         label="臺北市核發使用執照棟數", group="taipeiUsagePermit", group_label="臺北市核發使用執照", option="棟數",
         subgroup="建築使用執照", breaks=PERMIT_COUNT_BREAKS, notes=PERMIT_NOTES, digits=0, location="建築地點所在行政區（依發照日期）"),
    dict(key="statsTaipeiUsagePermitHouseholdCountTownship", dataset="building_usage_permits_township_taipei_monthly", indicator="household_count",
         label="臺北市核發使用執照戶數", group="taipeiUsagePermit", group_label="臺北市核發使用執照", option="戶數",
         subgroup="建築使用執照", breaks=[1, 25, 75, 150], notes=PERMIT_NOTES, digits=0, location="建築地點所在行政區（依發照日期）"),
    dict(key="statsTaipeiUsagePermitBuildingAreaTownship", dataset="building_usage_permits_township_taipei_monthly", indicator="building_area",
         label="臺北市核發使用執照建築面積", group="taipeiUsagePermit", group_label="臺北市核發使用執照", option="建築面積",
         subgroup="建築使用執照", breaks=[1, 300, 1000, 3000], notes=[PERMIT_AREA_NOTE, *PERMIT_NOTES], digits=2,
         location="建築地點所在行政區（依發照日期）"),
]
# 色階主題（只給 statisticsVisuals 對照；實際 icon／色票由 statisticsVisuals.ts 依 key 決定）
VISUAL_THEME = {"廢棄物與回收": "environment", "污水下水道": "utilities", "工廠登記": "labor", "建築使用執照": "housing"}
BREAK_BASIS = "固定門檻：依最近 24 個月 12 區 observed 值分布取整，跨月固定、不隨期別重算（污水普及率依 layer-plan 用固定百分比區間）。"


def zero_note(breaks: list[float], unit: str) -> str:
    if breaks[0] == 1:
        return f"0 {unit}自成最淺一級（該區當月為 0，不是無資料）。"
    return f"最淺色含 0 {unit}（該區當月為 0，不是無資料）。"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipes", required=True, type=Path)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    delivered = json.loads(args.recipes.read_text())
    if delivered.get("schema") != "taipei-agency-statistics-recipes-v1" or delivered.get("family") != "taipei_agency":
        raise SystemExit("unexpected recipes document")
    by_id = {(r["dataset_id"], r["indicator_id"]): r for r in delivered["recipes"]}

    recipes, report, bundle_cache = [], [], {}
    for spec in LAYERS:
        key = spec["key"]
        layer = by_id.get((spec["dataset"], spec["indicator"]))
        if not layer:
            raise SystemExit(f"{key}: {spec['dataset']}/{spec['indicator']} not in delivery")
        if layer["level"] != "township" or not layer["enabled"] or not layer["map_layer_recommended"]:
            raise SystemExit(f"{key}: expected an enabled, map-recommended township recipe")
        dim = spec.get("dimension")
        declared = [k for k in layer["dimension_keys"] if k not in PERIOD_DIMENSIONS]
        expected_declared = [dim["key"], dim["name_key"]] if dim and dim.get("name_key") else [dim["key"]] if dim else []
        if declared != expected_declared:
            raise SystemExit(f"{key}: dimension_keys {layer['dimension_keys']} != {expected_declared}")

        options, receipts, statuses, zero, meta, names = [], [], Counter(), 0, None, {}
        for option in layer["release_options"]:
            path = args.root / layer["bundle_dir"] / f"{option['release_id']}.json"
            body = bundle_cache.get(path)
            if body is None:
                body = bundle_cache[path] = json.loads(path.read_text())
            release = body["release"]
            if (body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"]
                    or body["indicator"]["unit"] != layer["unit"] or release["id"] != option["release_id"]):
                raise SystemExit(f"{key}: {option['release_id']} does not match dataset/indicator/unit/id")
            if (release["period_start"], release["period_end"]) != (option["period_start"], option["period_end"]):
                raise SystemExit(f"{key}: {option['release_id']} period differs")
            if release["boundary_version"] != layer["boundary_version"]:
                raise SystemExit(f"{key}: {option['release_id']} boundary differs")
            dims = option["dimensions"]
            obs = [o for o in body["observations"] if o["dimensions"] == dims]
            if {o["area_level"] for o in obs} != {"township"} or len(obs) != len({o["area_code"] for o in obs}):
                raise SystemExit(f"{key}: {option['release_id']} {dims} needs unique township rows")
            if not obs or not {o["area_code"] for o in obs} <= TAIPEI_DISTRICTS:
                raise SystemExit(f"{key}: {option['release_id']} {dims} has areas outside the 12 Taipei districts")
            for o in obs:
                statuses[o["status"]] += 1
                if o["status"] == "observed" and not isinstance(o["value"], (int, float)):
                    raise SystemExit(f"{key}: observed non-number")
                if o["status"] != "observed" and o["value"] is not None:
                    raise SystemExit(f"{key}: non-observed value must be null")
                zero += o["status"] == "observed" and o["value"] == 0
            if dim and dim.get("name_key"):
                names[dims[dim["key"]]] = names.get(dims[dim["key"]]) or (option["period_end"], dims[dim["name_key"]])
                if option["period_end"] > names[dims[dim["key"]]][0]:
                    names[dims[dim["key"]]] = (option["period_end"], dims[dim["name_key"]])
            meta = meta if meta and meta["release"]["period_end"] >= release["period_end"] else body
            options.append({"release_id": option["release_id"], "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": dims})
            receipts.append({"release_id": option["release_id"], "raw_sha256": release["raw_sha256"], "method_version": release["method_version"]})
        assert meta is not None
        if len({(o["release_id"], json.dumps(o["dimensions"], sort_keys=True)) for o in options}) != len(options):
            raise SystemExit(f"{key}: duplicate options")

        unexpected = set(statuses) - {"observed", "missing"}
        if unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")
        missing_label = MISSING_MIXED if statuses.get("missing") else MISSING_UNCOVERED

        dimensions = []
        if dim:
            values = sorted({o["dimensions"][dim["key"]] for o in options})
            if dim.get("order"):
                if set(values) != set(dim["order"]):
                    raise SystemExit(f"{key}: {dim['key']} values {values} != {dim['order']}")
                values = dim["order"]
            if dim["default"] not in values:
                raise SystemExit(f"{key}: default {dim['default']} not in {values}")
            values = [dim["default"], *[v for v in values if v != dim["default"]]]
            label_of = (lambda v: f"{v} {names[v][1]}") if dim.get("name_key") else (lambda v: v)
            dimensions = [{"key": dim["key"], "label": dim["label"], "default": dim["default"],
                           "options": [{"value": v, "label": label_of(v)} for v in values]}]

        def is_default(o: dict) -> bool:
            return not dim or o["dimensions"][dim["key"]] == dim["default"]
        default_option = max((o for o in options if is_default(o)), key=lambda o: (o["period_end"], o["period_start"]))

        breaks = spec["breaks"]
        if sorted(set(breaks)) != breaks or len(breaks) < 2 or breaks[0] <= 0 or len(breaks) > 4:
            raise SystemExit(f"{key}: breaks must be strictly increasing, 2–4 and positive")
        unit = layer["unit"]
        unit_word = {"公噸": "公噸", "%": "", "家": "家", "件": "件", "棟": "棟", "戶": "戶", "平方公尺": ""}[unit]
        release = meta["release"]
        recipes.append({
            "layer_key": key, "enabled": True, "family": FAMILY,
            "label": spec["label"], "group": spec["group"], "group_label": spec["group_label"], "option_label": spec["option"],
            "subgroup": spec["subgroup"], "data_theme": DATA_THEME, "tab_theme": TAB_THEME, "visual_theme": VISUAL_THEME[spec["subgroup"]],
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": "township",
            "boundary_version": layer["boundary_version"], "unit": unit, "aggregation": meta["indicator"]["aggregation"],
            "default_release_id": default_option["release_id"],
            "dimensions": dimensions,
            "release_options": options,
            "legend": {
                "method": "fixed_breaks", "breaks": breaks, "direction": "ascending",
                "scale_note": None, "zero_note": zero_note(breaks, unit_word) if zero else None, "display_note": None,
                "notes": [COVERAGE_NOTE, *spec["notes"]],
                "by_dimension": None, "dimension_notes": None,
            },
            "status_labels": {"missing": missing_label},
            "format": {"locale": "zh-TW", "maximumFractionDigits": spec["digits"]},
            "derived": False,
            "location_semantics": spec["location"],
            "disclosure": f"{layer['disclosure']} {layer['coverage_note']}",
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": release["source_metadata"]["dataset_title"],
            "delivery": {"observed_statuses": dict(sorted(statuses.items())), "observed_zero": zero, "receipts": receipts,
                         "breaks_basis": BREAK_BASIS},
        })
        report.append(f"{key:48} options={len(options):5} default={default_option['release_id'][:40]} zero={zero} statuses={dict(statuses)}")

    keys = [recipe["layer_key"] for recipe in recipes]
    if len(set(keys)) != len(keys) or len(keys) != len(LAYERS):
        raise SystemExit("duplicate layer keys")
    document = {
        "version": 1,
        "scope": "production_r2",
        "family": FAMILY,
        "generated_from": {"recipes": args.recipes.name, "bundles": "taipei-gis-analytics taipei agency statistics release bundles (<bundle_dir>/<release_id>.json)"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"coverage": "only the 12 Taipei City districts; every other township is not covered (no observation, shown as missing hatch, never 0)", "observed_zero": "status observed and value 0 (source「-」 or no permits that month)", "missing": "value null; no zero fill"},
        "recipes": recipes,
    }
    args.out.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {args.out.name} recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))


if __name__ == "__main__":
    main()
