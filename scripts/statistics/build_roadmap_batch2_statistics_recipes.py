#!/usr/bin/env python3
"""Build the Roadmap batch-2 atlas statistics families from the analytics handoff recipes.

Families (one output JSON each, atlas recipe schema in src/data/atlasStatisticsTypes.ts):
  culture      街頭藝人登記人數（G23；docs/handoff/culture-coin-street-performers-recipes.json，2 recipes）

Inputs (taipei-gis-analytics, read-only):
  --root     analytics checkout. The handoff recipes are the trimmed R2 form (release_id／period／dimensions only),
             so each option's bundle is read from data/processed/<theme>/<dataset_id>/releases/<release_id>.json.

The handoff carries no presentation, so this script owns it: sidebar group／option labels, default dimensions, fixed
breaks (quantiles of the default period, fixed across periods), partial-period flags, status legend labels and legend
notes. Values, periods, boundaries, publishers, licences and source URLs always come from the release bundles; every
option is cross-checked against its bundle (dataset／indicator／unit／id／period／boundary／level and the exact
(area_code, dimensions) tuple covering all 22 counties／368 townships), and statuses without a legend label abort.

Usage:
  python3 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --root <analytics checkout> [--family culture]
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parents[2] / "src/data"
AREA_COUNT = {"township": 368, "county": 22}
OGDL = "政府資料開放授權條款-第1版"

# ── 各家族的呈現設定 ────────────────────────────────────────────────────────────
# layer：key、group（同一列的群組 key）、group_label、option_label、subgroup、visual、digits，
# 選填 defaults（維度預設值）、notes（圖例逐行說明）、status（狀態→圖例標籤）、zero_note、breaks、annual（年資料：非全年期別標部分期）。

CULTURE_SOURCE = "出典：文化部 文化幣可用藝文消費點（data.gov.tw 177601，2026-10-24 下載）；政府資料開放授權條款-第1版。"
CULTURE_NOTES = [
    CULTURE_SOURCE,
    "名冊登記人數，依登記或聯絡地址所在行政區計，不是表演地點；不含姓名。",
    "臺中市西區 100 人多為登記於草悟道（登記地址只定位到地名），不代表居住於西區。",
    "名冊為自願登記，臺中市偏多可能反映制度差異，不宜解讀為各地實際街頭藝人分布。",
    "點位見「文化」主題的「文化幣藝文消費點」（不含街頭藝人）。",
]

CULTURE_ZERO = "0 人自成最淺一級（名冊在該區無登記，不是無資料）。"

FAMILIES: dict[str, dict] = {
    "culture": {
        "file": "cultureStatisticsRecipes",
        "handoff": "docs/handoff/culture-coin-street-performers-recipes.json",
        "theme_dir": "culture",
        "data_theme": "文化統計 Culture Statistics",
        "tab_theme": "文化與藝文 Culture & Arts",
        "observation_policy": {"observed_zero": "status observed and value 0 (no registration in the roster for that area; the roster is a full national list)", "missing": "not used", "suppressed": "not used"},
        "layers": [
            dict(key="statsCultureStreetPerformersTown", group="cultureStreetPerformers", group_label="街頭藝人登記人數",
                 option_label="鄉鎮市區", subgroup="街頭藝人", visual="education", digits=0, notes=CULTURE_NOTES, breaks=[1, 3, 6, 15], zero_note=CULTURE_ZERO),
            dict(key="statsCultureStreetPerformersCounty", group="cultureStreetPerformers", group_label="街頭藝人登記人數",
                 option_label="縣市", subgroup="街頭藝人", visual="education", digits=0, notes=CULTURE_NOTES, breaks=[1, 10, 30, 60], zero_note=CULTURE_ZERO),
        ],
    },
}

BREAK_BASIS = ("固定門檻：預設期別（年資料取最新全年）每個維度組合各一組，取 observed 正值的分位數"
               "（比率 20/40/60/80%、計數 25/50/75%，有 0 的計數組合第一級固定為 1）取 2 位有效數字，跨期固定。")


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
        raw = [1] + [max(1, round(nice(quantile(positive, q)))) for q in (0.25, 0.5, 0.75)] if positive else [1]
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
        breaks = [base, base * 2]
    return breaks[:4]


def partial_label(start: str, end: str) -> str | None:
    """年資料的非全年期別（例如 2026 年 1–9 月）；全年回 None。"""
    if start.endswith("-01-01") and end == f"{start[:4]}-12-31":
        return None
    if start[:4] != end[:4] or start[5:] != "01-01":
        raise SystemExit(f"unexpected annual period {start}..{end}")
    return f"{start[:4]} 年 {int(start[5:7])}–{int(end[5:7])} 月"


def build_family(name: str, config: dict, root: Path) -> dict:
    handoff_path = root / config["handoff"]
    delivered = json.loads(handoff_path.read_text())
    by_key = {r["layer_key"]: r for r in delivered["recipes"]}
    specs = {spec["key"]: spec for spec in config["layers"]}
    if set(by_key) != set(specs):
        raise SystemExit(f"{name}: handoff keys {sorted(by_key)} != layers {sorted(specs)}")
    cache: dict[Path, dict] = {}
    recipes, report = [], []
    for spec in config["layers"]:
        key = spec["key"]
        layer = by_key[key]
        if not layer["enabled"]:
            raise SystemExit(f"{key}: disabled in handoff")
        level = layer["level"]
        options, receipts, statuses, zero, meta = [], [], Counter(), 0, None
        values: dict[tuple, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        dim_keys = sorted({k for o in layer["release_options"] for k in o["dimensions"]})
        for option in layer["release_options"]:
            path = root / "data/processed" / config["theme_dir"] / layer["dataset_id"] / "releases" / f"{option['release_id']}.json"
            if path not in cache:
                cache[path] = json.loads(path.read_text())
            body = cache[path]
            release = body["release"]
            if (body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"]
                    or body["indicator"]["unit"] != layer["unit"] or release["id"] != option["release_id"]):
                raise SystemExit(f"{key}: {option['release_id']} does not match dataset/indicator/unit/id")
            if (release["period_start"], release["period_end"]) != (option["period_start"], option["period_end"]):
                raise SystemExit(f"{key}: {option['release_id']} period differs")
            if release["boundary_version"] != layer["boundary_version"]:
                raise SystemExit(f"{key}: {option['release_id']} boundary differs")
            dims = option["dimensions"]
            if sorted(dims) != dim_keys:
                raise SystemExit(f"{key}: option dims {dims} vs {dim_keys}")
            obs = [o for o in body["observations"] if o["dimensions"] == dims]
            codes = {o["area_code"] for o in obs}
            if {o["area_level"] for o in obs} != {level} or len(obs) != len(codes) or len(codes) != AREA_COUNT[level]:
                raise SystemExit(f"{key}: {option['release_id']} {dims} needs {AREA_COUNT[level]} unique {level} rows, got {len(obs)}")
            tuple_key = "|".join(dims[d] for d in dim_keys)
            for o in obs:
                statuses[o["status"]] += 1
                if o["status"] == "observed":
                    if not isinstance(o["value"], (int, float)):
                        raise SystemExit(f"{key}: observed non-number")
                    zero += o["value"] == 0
                    values[(option["period_end"], option["period_start"])][tuple_key].append(o["value"])
                elif o["value"] is not None:
                    raise SystemExit(f"{key}: non-observed value must be null")
            meta = meta if meta and meta["release"]["period_end"] >= release["period_end"] else body
            entry = {"release_id": option["release_id"], "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": dims}
            if spec.get("annual"):
                label = partial_label(option["period_start"], option["period_end"])
                if label:
                    entry["partial_period_label"] = label
            options.append(entry)
            receipts.append({"release_id": option["release_id"], "raw_sha256": release["raw_sha256"], "method_version": release["method_version"], "retrieved_at": release["retrieved_at"]})
        assert meta is not None
        if len({(o["release_id"], json.dumps(o["dimensions"], sort_keys=True)) for o in options}) != len(options):
            raise SystemExit(f"{key}: duplicate options")
        status_labels = spec.get("status", {})
        unexpected = set(statuses) - {"observed"} - set(status_labels)
        if unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")

        defaults = spec.get("defaults", {})
        if sorted(defaults) != dim_keys:
            raise SystemExit(f"{key}: defaults {defaults} must cover dims {dim_keys}")
        dimensions = []
        for dim in dim_keys:
            present = sorted({o["dimensions"][dim] for o in options})
            if defaults[dim] not in present:
                raise SystemExit(f"{key}: default {defaults[dim]} not in {present}")
            ordered = [defaults[dim], *[v for v in present if v != defaults[dim]]]
            dimensions.append({"key": dim, "label": dim, "default": defaults[dim], "options": [{"value": v, "label": v} for v in ordered]})

        full = [o for o in options if "partial_period_label" not in o and all(o["dimensions"][d] == defaults[d] for d in dim_keys)]
        default_option = max(full, key=lambda o: (o["period_end"], o["period_start"]))
        basis_period = (default_option["period_end"], default_option["period_start"])
        counts = layer["aggregation"] == "sum"
        default_tuple = "|".join(defaults[d] for d in dim_keys)
        tuples = sorted({"|".join(o["dimensions"][d] for d in dim_keys) for o in options})
        by_dimension = {}
        for tuple_key in tuples:
            source_values = values[basis_period].get(tuple_key)
            if not source_values:
                for period in sorted(values, reverse=True):
                    if values[period].get(tuple_key):
                        source_values = values[period][tuple_key]
                        break
            if tuple_key != default_tuple:
                by_dimension[tuple_key] = {"breaks": spec.get("breaks") or make_breaks(source_values or [], counts), "direction": "ascending"}
        breaks = spec.get("breaks") or make_breaks(values[basis_period][default_tuple], counts)
        for scale in [{"breaks": breaks}, *by_dimension.values()]:
            b = scale["breaks"]
            if sorted(set(b)) != b or not 2 <= len(b) <= 4 or b[0] <= 0:
                raise SystemExit(f"{key}: bad breaks {b}")
        zero_note = spec.get("zero_note")
        if zero_note is None and zero:
            zero_note = "0 自成最淺一級（該區為 0，不是無資料）。" if counts and breaks[0] == 1 else "最淺色含 0（該區為 0，不是無資料）。"
        release = meta["release"]
        params = release["provenance"]["processing"]["parameters"]
        nid = release["provenance"]["source_dataset_id"]
        if release["license"] != OGDL:
            raise SystemExit(f"{key}: unexpected licence {release['license']}")
        recipes.append({
            "layer_key": key, "enabled": True, "family": name,
            "label": spec.get("label") or layer["label"], "group": spec["group"], "group_label": spec["group_label"],
            "option_label": spec["option_label"], "subgroup": spec["subgroup"],
            "data_theme": config["data_theme"], "tab_theme": config["tab_theme"], **({"tab_group": spec["tab_group"]} if spec.get("tab_group") else {}),
            "visual_theme": spec["visual"],
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": level,
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": meta["indicator"]["aggregation"],
            "default_release_id": default_option["release_id"],
            "dimensions": dimensions,
            "release_options": options,
            "legend": {
                "method": "fixed_breaks", "breaks": breaks, "direction": "ascending",
                "scale_note": None, "zero_note": zero_note if zero else None, "display_note": None,
                "notes": spec["notes"],
                "by_dimension": by_dimension or None, "dimension_notes": None,
            },
            "status_labels": {kind: label for kind, label in status_labels.items() if statuses.get(kind)},
            "format": {"locale": "zh-TW", "maximumFractionDigits": spec["digits"]},
            "derived": layer["aggregation"] == "ratio",
            "location_semantics": params["location_semantics"],
            "disclosure": layer["disclosure"],
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": f"{release['source_metadata']['dataset_title']}（data.gov.tw {nid}）",
            "delivery": {"observed_statuses": dict(sorted(statuses.items())), "observed_zero": zero, "receipts": receipts,
                         "breaks_basis": BREAK_BASIS, "breaks_period": list(basis_period)},
        })
        report.append(f"{key:38} options={len(options):3} default={default_option['release_id'][:40]} breaks={breaks} zero={zero} statuses={dict(statuses)}")
    keys = [recipe["layer_key"] for recipe in recipes]
    if len(set(keys)) != len(keys):
        raise SystemExit(f"{name}: duplicate layer keys")
    print(f"{name}: recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))
    return {
        "version": 1,
        "scope": "production_r2",
        "family": name,
        "generated_from": {"recipes": handoff_path.name, "bundles": f"taipei-gis-analytics data/processed/{config['theme_dir']}/<dataset_id>/releases/<release_id>.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": config["observation_policy"],
        "recipes": recipes,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--family", action="append", choices=sorted(FAMILIES))
    args = parser.parse_args()
    for name in args.family or list(FAMILIES):
        config = FAMILIES[name]
        document = build_family(name, config, args.root)
        out = OUT_DIR / f"{config['file']}.json"
        out.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"wrote {out.name} bytes={out.stat().st_size}")


if __name__ == "__main__":
    main()
