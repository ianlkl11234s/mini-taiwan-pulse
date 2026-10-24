#!/usr/bin/env python3
"""Build the mortality statistics family (src/data/mortalityStatisticsRecipes.json) from the analytics delivery.

Inputs (taipei-gis-analytics, read-only):
  --recipes  docs/handoff/mortality-statistics-recipes.json (9 recipes: county 3, township 6)
  --root     analytics checkout whose `<bundle_dir>/<release_id>.json` holds each option's release bundle.

The output uses the atlas recipe schema (atlasStatisticsTypes.ts), so the shared atlas runtime (loader, selection,
legend, details, catalogue) serves it unchanged. This script owns the presentation: 6 map layers in one sidebar group
(township 5-year rate first = layer-plan default; `deaths_total(_5yr)` are not layers because they equal
deaths_by_cause cause=all／sex=all — checked here), fixed breaks per (cause[, sex]) tuple, legend notes and status labels.
Values, periods, boundaries and sources always come from the release bundles: every option is cross-checked against its
bundle (dataset／indicator／unit／id／period／boundary and the exact (area_code, dimensions) tuple), every tuple must
cover exactly 368 townships／22 counties, and unknown statuses abort the build.

Decision #5 (Roadmap batch 2): no suppression — values are shown as published; the default view is the 5-year window,
not a single-year township ranking, and the legend warns that small townships swing year to year.

Usage:
  python3 scripts/statistics/build_mortality_statistics_recipes.py \
    --recipes <mortality-statistics-recipes.json> --root <analytics checkout>
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/mortalityStatisticsRecipes.json"

FAMILY = "mortality"
SUBGROUP = "死因統計"
DATA_THEME = "疾病與健康統計 Disease & Health Statistics"
TAB_THEME = "醫療與長照 Health & Care"
GROUP = "mortalityCause"
GROUP_LABEL = "死因統計"
AREA_COUNT = {"township": 368, "county": 22}
SEX_LABELS = {"all": "全部", "female": "女", "male": "男"}

SOURCE_NOTE = "出典：衛生福利部統計處 死因統計（data.gov.tw 5965）；政府資料開放授權條款-第1版。"
ZERO_STATUS_NOTE = "0 為該期無死亡（真值，不是無資料）；斜線為不適用或無資料。"
CRUDE_NOTE = "粗死亡率未做年齡標準化：高齡人口多的地方偏高，不代表醫療較差。"
SMALL_AREA_NOTE = "小鄉鎮人口少，單年數值波動大，建議看 5 年合計。"
DENOM_NOTE = "死亡率分母為 12 月底戶籍人口（衛福部公布的全國粗死亡率用年中人口，數值略有差異）；分母只有 107 年起，率只到 107 年起。"
CAUSE_NOTE = "死因已統一為 109 年起 42 類；COVID-19 自 109 年起才有。"
FIVE_YEAR_SMALL_NOTE = "小鄉鎮人口少，單年波動大；本層為 5 年合計，較穩定，但極小鄉鎮仍宜保守解讀，不宜據此排名。"
FIVE_YEAR_RATE_NOTE = "5 年平均＝5 年合計死亡數 ÷ 5 年戶籍人口加總（人年）× 10 萬；只有 110–114 年一窗。"

STATUS_LABELS = {
    "missing": "無資料（分母戶籍人口缺，不是 0）",
    "not_applicable": "不適用（COVID-19 自 109 年起才有此分類）",
}
LOCATION = "死亡者戶籍所在地（依死亡年）"

LAYERS: list[dict] = [
    dict(key="statsMortalityCauseTownship", dataset="mortality_cause_township", indicator="crude_death_rate_5yr_per_100k",
         label="鄉鎮死因別粗死亡率（5 年平均）", option="鄉鎮・粗死亡率（5 年平均）", dims=["cause"], digits=1,
         notes=[SOURCE_NOTE, ZERO_STATUS_NOTE, FIVE_YEAR_SMALL_NOTE, FIVE_YEAR_RATE_NOTE, CRUDE_NOTE, DENOM_NOTE, CAUSE_NOTE]),
    dict(key="statsMortalityDeaths5yrTownship", dataset="mortality_cause_township", indicator="deaths_by_cause_5yr",
         label="鄉鎮死因別死亡人數（5 年合計）", option="鄉鎮・死亡人數（5 年合計）", dims=["cause", "sex"], digits=0,
         notes=[SOURCE_NOTE, ZERO_STATUS_NOTE, FIVE_YEAR_SMALL_NOTE, CAUSE_NOTE]),
    dict(key="statsMortalityRateTownship", dataset="mortality_cause_township", indicator="crude_death_rate_per_100k",
         label="鄉鎮死因別粗死亡率（逐年）", option="鄉鎮・粗死亡率（逐年）", dims=["cause"], digits=1,
         notes=[SOURCE_NOTE, ZERO_STATUS_NOTE, SMALL_AREA_NOTE, CRUDE_NOTE, DENOM_NOTE, CAUSE_NOTE]),
    dict(key="statsMortalityDeathsTownship", dataset="mortality_cause_township", indicator="deaths_by_cause",
         label="鄉鎮死因別死亡人數（逐年）", option="鄉鎮・死亡人數（逐年）", dims=["cause", "sex"], digits=0,
         notes=[SOURCE_NOTE, ZERO_STATUS_NOTE, SMALL_AREA_NOTE, CAUSE_NOTE]),
    dict(key="statsMortalityCauseCounty", dataset="mortality_cause_county", indicator="crude_death_rate_per_100k",
         label="縣市死因別粗死亡率", option="縣市・粗死亡率", dims=["cause"], digits=1,
         notes=[SOURCE_NOTE, ZERO_STATUS_NOTE, CRUDE_NOTE, DENOM_NOTE, CAUSE_NOTE]),
    dict(key="statsMortalityDeathsCounty", dataset="mortality_cause_county", indicator="deaths_by_cause",
         label="縣市死因別死亡人數", option="縣市・死亡人數", dims=["cause", "sex"], digits=0,
         notes=[SOURCE_NOTE, ZERO_STATUS_NOTE, CAUSE_NOTE]),
]
DEFAULTS = {"cause": "all", "sex": "all"}
BREAK_BASIS = ("固定門檻：每個（死因[, 性別]）組合各一組，取最新期別 observed 正值的分位數（率 20/40/60/80%、人數 25/50/75%）"
               "取 2 位有效數字，跨期固定；人數在該期有 0 人的組合，第一個門檻固定為 1，讓 0 人自成最淺一級"
               "（沒有 0 人的組合改取 20/40/60/80%）。")


def nice(value: float) -> float:
    if value <= 0:
        return 0
    digits = 2 - int(math.floor(math.log10(value))) - 1
    rounded = round(value, digits)
    return int(rounded) if rounded >= 10 or float(rounded).is_integer() else rounded


def quantile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def make_breaks(values: list[float], counts: bool) -> list[float]:
    positive = [v for v in values if v > 0]
    if counts and len(positive) < len(values):
        raw = [1] + ([nice(quantile(positive, q)) for q in (0.25, 0.5, 0.75)] if positive else [])
        raw = [max(1, round(v)) for v in raw]
    elif counts:
        raw = [max(1, round(nice(quantile(positive, q)))) for q in (0.2, 0.4, 0.6, 0.8)]
    else:
        raw = [nice(quantile(positive, q)) for q in (0.2, 0.4, 0.6, 0.8)] if positive else []
    breaks: list[float] = []
    for value in raw:
        if value > 0 and (not breaks or value > breaks[-1]):
            breaks.append(value)
    if len(breaks) < 2:
        base = breaks[0] if breaks else 1
        breaks = [base, base * 2] if not counts else [1, 2]
    return breaks[:4]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipes", required=True, type=Path)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    delivered = json.loads(args.recipes.read_text())
    if delivered.get("schema") != "mortality-statistics-recipes-v1" or delivered.get("family") != "mortality":
        raise SystemExit("unexpected recipes document")
    by_id = {(r["dataset_id"], r["indicator_id"]): r for r in delivered["recipes"]}
    bundle_cache: dict[Path, dict] = {}

    def bundle(layer: dict, release_id: str) -> dict:
        path = args.root / layer["bundle_dir"] / f"{release_id}.json"
        if path not in bundle_cache:
            bundle_cache[path] = json.loads(path.read_text())
        return bundle_cache[path]

    # deaths_total(_5yr) 不做圖層：確認與 deaths_by_cause(_5yr) cause=all／sex=all 逐區相同。
    for dataset, total_id, cause_id in [("mortality_cause_township", "deaths_total", "deaths_by_cause"),
                                         ("mortality_cause_township", "deaths_total_5yr", "deaths_by_cause_5yr"),
                                         ("mortality_cause_county", "deaths_total", "deaths_by_cause")]:
        total, cause = by_id[(dataset, total_id)], by_id[(dataset, cause_id)]
        for option in total["release_options"]:
            twin = [o for o in cause["release_options"] if (o["period_start"], o["period_end"]) == (option["period_start"], option["period_end"])
                    and o["dimensions"] == DEFAULTS]
            if len(twin) != 1:
                raise SystemExit(f"{total_id} {option['period_end']}: no cause=all/sex=all twin")
            a = {o["area_code"]: o["value"] for o in bundle(total, option["release_id"])["observations"]}
            b = {o["area_code"]: o["value"] for o in bundle(cause, twin[0]["release_id"])["observations"] if o["dimensions"] == DEFAULTS}
            if a != b:
                raise SystemExit(f"{total_id} {option['period_end']}: differs from {cause_id} cause=all/sex=all")

    recipes, report = [], []
    for spec in LAYERS:
        key = spec["key"]
        layer = by_id.get((spec["dataset"], spec["indicator"]))
        if not layer or not layer["enabled"] or not layer["map_layer_recommended"]:
            raise SystemExit(f"{key}: {spec['dataset']}/{spec['indicator']} missing or not map-recommended")
        if layer["dimension_keys"] != spec["dims"]:
            raise SystemExit(f"{key}: dimension_keys {layer['dimension_keys']} != {spec['dims']}")
        level = layer["level"]
        options, receipts, statuses, zero, meta = [], [], Counter(), 0, None
        values_by_period: dict[tuple, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        labels: dict[str, str] = {}
        for option in layer["release_options"]:
            body = bundle(layer, option["release_id"])
            release = body["release"]
            if (body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"]
                    or body["indicator"]["unit"] != layer["unit"] or release["id"] != option["release_id"]):
                raise SystemExit(f"{key}: {option['release_id']} does not match dataset/indicator/unit/id")
            if (release["period_start"], release["period_end"]) != (option["period_start"], option["period_end"]):
                raise SystemExit(f"{key}: {option['release_id']} period differs")
            if release["boundary_version"] != layer["boundary_version"]:
                raise SystemExit(f"{key}: {option['release_id']} boundary differs")
            labels.update(release["provenance"]["processing"]["parameters"]["dimension_labels"]["cause"])
            dims = option["dimensions"]
            if sorted(dims) != sorted(spec["dims"]):
                raise SystemExit(f"{key}: option dims {dims}")
            obs = [o for o in body["observations"] if o["dimensions"] == dims]
            codes = {o["area_code"] for o in obs}
            if {o["area_level"] for o in obs} != {level} or len(obs) != len(codes) or len(codes) != AREA_COUNT[level]:
                raise SystemExit(f"{key}: {option['release_id']} {dims} needs {AREA_COUNT[level]} unique {level} rows, got {len(obs)}")
            tuple_key = "|".join(dims[d] for d in spec["dims"])
            for o in obs:
                statuses[o["status"]] += 1
                if o["status"] == "observed":
                    if not isinstance(o["value"], (int, float)):
                        raise SystemExit(f"{key}: observed non-number")
                    zero += o["value"] == 0
                    values_by_period[(option["period_end"], option["period_start"])][tuple_key].append(o["value"])
                elif o["value"] is not None:
                    raise SystemExit(f"{key}: non-observed value must be null")
            meta = meta if meta and meta["release"]["period_end"] >= release["period_end"] else body
            options.append({"release_id": option["release_id"], "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": dims})
            receipts.append({"release_id": option["release_id"], "raw_sha256": release["raw_sha256"], "method_version": release["method_version"]})
        assert meta is not None
        if len({(o["release_id"], json.dumps(o["dimensions"], sort_keys=True)) for o in options}) != len(options):
            raise SystemExit(f"{key}: duplicate options")
        unexpected = set(statuses) - {"observed", "missing", "not_applicable"}
        if unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")

        dimensions = []
        for dim in spec["dims"]:
            values = sorted({o["dimensions"][dim] for o in options})
            default = DEFAULTS[dim]
            if default not in values:
                raise SystemExit(f"{key}: default {default} not in {values}")
            values = [default, *[v for v in values if v != default]]
            if dim == "cause":
                missing = [v for v in values if v not in labels]
                if missing:
                    raise SystemExit(f"{key}: cause labels missing {missing}")
                dimensions.append({"key": "cause", "label": "死因", "default": default, "options": [{"value": v, "label": labels[v]} for v in values]})
            else:
                dimensions.append({"key": "sex", "label": "性別", "default": default, "options": [{"value": v, "label": SEX_LABELS[v]} for v in values]})

        counts = layer["aggregation"] == "sum"
        latest = max(values_by_period)
        latest_values = values_by_period[latest]
        default_tuple = "|".join(DEFAULTS[d] for d in spec["dims"])
        tuples = sorted({"|".join(o["dimensions"][d] for d in spec["dims"]) for o in options})
        by_dimension = {}
        for tuple_key in tuples:
            source_values = latest_values.get(tuple_key)
            if not source_values:  # COVID-19 等最新期無值的組合：取該組合最新有值期別
                for period in sorted(values_by_period, reverse=True):
                    if values_by_period[period].get(tuple_key):
                        source_values = values_by_period[period][tuple_key]
                        break
            if tuple_key != default_tuple:
                by_dimension[tuple_key] = {"breaks": make_breaks(source_values or [], counts), "direction": "ascending"}
        breaks = make_breaks(latest_values[default_tuple], counts)
        for scale in [{"breaks": breaks}, *by_dimension.values()]:
            b = scale["breaks"]
            if sorted(set(b)) != b or not 2 <= len(b) <= 4 or b[0] <= 0:
                raise SystemExit(f"{key}: bad breaks {b}")

        default_option = max((o for o in options if all(o["dimensions"][d] == DEFAULTS[d] for d in spec["dims"])),
                             key=lambda o: (o["period_end"], o["period_start"]))
        zero_note = ("人數在有 0 人的組合中，0 人自成最淺一級（該期無死亡，不是無資料）。" if counts
                     else "最淺色含 0（該期無死亡，不是無資料）。") if zero else None
        release = meta["release"]
        recipes.append({
            "layer_key": key, "enabled": True, "family": FAMILY,
            "label": spec["label"], "group": GROUP, "group_label": GROUP_LABEL, "option_label": spec["option"],
            "subgroup": SUBGROUP, "data_theme": DATA_THEME, "tab_theme": TAB_THEME, "visual_theme": "health",
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": level,
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": meta["indicator"]["aggregation"],
            "default_release_id": default_option["release_id"],
            "dimensions": dimensions,
            "release_options": options,
            "legend": {
                "method": "fixed_breaks", "breaks": breaks, "direction": "ascending",
                "scale_note": None, "zero_note": zero_note, "display_note": None,
                "notes": spec["notes"],
                "by_dimension": by_dimension or None, "dimension_notes": None,
            },
            "status_labels": {kind: STATUS_LABELS[kind] for kind in ("not_applicable", "missing") if statuses.get(kind)},
            "format": {"locale": "zh-TW", "maximumFractionDigits": spec["digits"]},
            "derived": False,
            "location_semantics": LOCATION,
            "disclosure": layer["disclosure"],
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": "死因統計（data.gov.tw 5965）",
            "delivery": {"observed_statuses": dict(sorted(statuses.items())), "observed_zero": zero, "receipts": receipts,
                         "breaks_basis": BREAK_BASIS, "breaks_period": list(latest)},
        })
        report.append(f"{key:34} options={len(options):5} default={default_option['release_id'][:44]} breaks={breaks} zero={zero} statuses={dict(statuses)}")

    keys = [recipe["layer_key"] for recipe in recipes]
    if len(set(keys)) != len(keys):
        raise SystemExit("duplicate layer keys")
    document = {
        "version": 1,
        "scope": "production_r2",
        "family": FAMILY,
        "generated_from": {"recipes": args.recipes.name, "bundles": "taipei-gis-analytics mortality release bundles (<bundle_dir>/<release_id>.json)"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"observed_zero": "status observed and value 0 (no deaths in that period; full registration)", "missing": "value null; population denominator missing; no zero fill", "not_applicable": "value null; COVID-19 category exists only from 2020 (ROC 109)", "suppressed": "none (decision #5: not suppressed)"},
        "recipes": recipes,
    }
    args.out.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {args.out.name} recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)} bytes={args.out.stat().st_size}")
    print("\n".join(report))


if __name__ == "__main__":
    main()
