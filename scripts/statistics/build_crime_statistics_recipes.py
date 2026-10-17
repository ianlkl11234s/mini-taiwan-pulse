#!/usr/bin/env python3
"""Build the crime statistics family (src/data/crimeStatisticsRecipes.json) from the analytics crime delivery.

Inputs (taipei-gis-analytics, read-only):
  --recipes  docs/handoff/crime-statistics-recipes.json
             (36 recipes = 9 case types × cases／per-100k × township／county, 386 exact release selectors).
  --root     analytics checkout whose data/ holds each option's `bundle_path`
             (data/processed/police_justice/{crime,telecom_fraud}_{township,county}_annual/releases/*.json).

The output uses the atlas recipe schema (atlasStatisticsTypes.ts), so the shared atlas runtime (loader, selection,
legend, details, catalogue) serves it unchanged. This script owns the presentation: one sidebar row per case type with
township／county × cases／per-100k options, partial-period flags (2026 Jan–Jun, 2018 Oct–Dec), the default period
(latest full year, not the latest option) and the legend notes. Values, periods, boundaries and sources always come
from the release bundles; every option is cross-checked against its bundle and unknown statuses abort the build.

Usage:
  python3 scripts/statistics/build_crime_statistics_recipes.py \
    --recipes <crime-statistics-recipes.json> --root <analytics checkout>
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/crimeStatisticsRecipes.json"

DATA_THEME = "治安統計 Crime Statistics"
TAB_THEME = "犯罪與治安 Crime & Safety"
MISSING = "無資料（來源未列，不是 0）"

# toggle_group 去掉層級尾綴 → (group, group_label, subgroup)；順序＝側欄順序
CASES: dict[str, tuple[str, str]] = {
    "statsCrimeDrug": ("毒品", "刑案發生"),
    "statsCrimeResidentialBurglary": ("住宅竊盜", "刑案發生"),
    "statsCrimeMotorcycleTheft": ("機車竊盜", "刑案發生"),
    "statsCrimeCarTheft": ("汽車竊盜", "刑案發生"),
    "statsCrimeRobbery": ("強盜", "刑案發生"),
    "statsCrimeSnatching": ("搶奪", "刑案發生"),
    "statsCrimeSexualAssault": ("強制性交", "刑案發生"),
    "statsCrimeOrganizedCrime": ("組織犯罪", "刑案發生"),
    "statsTelecomFraud": ("電信詐欺", "詐欺"),
}
BREAK_OVERRIDES: dict[str, list[float]] = {"statsCrimeOrganizedCrimeCasesTownship": [1, 2]}
LEVEL_LABEL = {"township": "鄉鎮", "county": "縣市"}
LEVEL_ORDER = {"township": 0, "county": 1}

# 圖例的口徑斷點句（layer-plan §3；數字見 disclosure.md）。圖例只放一句，完整說明在「資料限制」。
BREAK_NOTES: dict[tuple[str, str | None], str] = {
    ("statsTelecomFraud", None): "斷點：2024 年第 3 季（民國 113 年）起季件數約為前一季 7 倍，原因未查明；跨 2024 年前後比較請保守。",
    ("statsCrimeMotorcycleTheft", "township"): "斷點：鄉鎮層 2015–2024 約 55% 只登記到縣市，2025 起跳升是登記口徑改變，不是案件增加（縣市層口徑一致）。",
    ("statsCrimeResidentialBurglary", None): "全國件數 2023 年起連年倍增（1,268 → 2,340 → 5,427 件），原因未查明。",
}


def location_semantics(base: str, delivered: str) -> str:
    """交付 36 個 recipe 共用同一句（含「毒品案多為查獲地」）；只有毒品保留查獲地，電信詐欺依 disclosure.md 註明地點語意未說明。"""
    if delivered != "案件發生地（鄉鎮市區精度）；毒品案多為查獲地":
        raise SystemExit(f"unexpected location_semantics: {delivered}")
    if base == "statsCrimeDrug":
        return delivered
    if base == "statsTelecomFraud":
        return "案件發生地點（鄉鎮市區精度；來源未說明是受騙地或報案地）"
    return "案件發生地（鄉鎮市區精度）"


def public_disclosure(text: str) -> str:
    """交付的口徑說明照用，只拿掉內部註記（決策日期、reconciliation 欄名）；邊界說明交付已含，不再重複。"""
    cleaned = re.sub(r"（使用者 \d{4}-\d{2}-\d{2} 決定）", "", text).replace("（見 reconciliation）", "（圖例「覆蓋狀態」列出未分配件數）").replace("缺值為 null（不補 0）", "缺值標示為無資料（不補 0）")
    if "使用者" in cleaned or "reconciliation" in cleaned or "null" in cleaned:
        raise SystemExit(f"internal note left in disclosure: {cleaned}")
    return cleaned


def period_label(start: str, end: str) -> str | None:
    """部分期別的中文標示（全年回 None）。"""
    if start.endswith("-01-01") and end == f"{start[:4]}-12-31":
        return None
    if start[:4] != end[:4]:
        raise SystemExit(f"cross-year partial period {start}..{end}")
    return f"{start[:4]} 年 {int(start[5:7])}–{int(end[5:7])} 月"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipes", required=True, type=Path)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    delivered = json.loads(args.recipes.read_text())
    if delivered.get("schema") != "crime-statistics-recipes-v1" or delivered.get("replaces_layer") != "crimeAreaMonthly":
        raise SystemExit("unexpected recipes document")
    legend_notes = list(delivered["legend_notes"])
    if len(legend_notes) != 3 or not legend_notes[0].startswith("人口分母＝戶籍人口"):
        raise SystemExit("legend_notes must be the three fixed sentences")

    def sort_key(layer: dict) -> tuple:
        base = layer["toggle_group"].removesuffix("Township").removesuffix("County")
        return (list(CASES).index(base), LEVEL_ORDER[layer["level"]], "Per100k" in layer["layer_key"])

    recipes, report = [], []
    for layer in sorted(delivered["recipes"], key=sort_key):
        key, level = layer["layer_key"], layer["level"]
        base = layer["toggle_group"].removesuffix("Township").removesuffix("County")
        if layer["toggle_group"] != f"{base}{'Township' if level == 'township' else 'County'}":
            raise SystemExit(f"{key}: toggle_group {layer['toggle_group']} does not match level {level}")
        rate = layer["indicator_id"].endswith("_per_100k")
        if rate != ("Per100k" in key) or layer["unit"] != ("件/10萬人" if rate else "件"):
            raise SystemExit(f"{key}: indicator／unit／key disagree")
        if not layer["enabled"] or layer["dimension_keys"]:
            raise SystemExit(f"{key}: expected enabled and no dimensions")
        case_label, subgroup = CASES[base]
        suffix = f"（{LEVEL_LABEL[level]}）"
        if not layer["label"].endswith(suffix):
            raise SystemExit(f"{key}: label {layer['label']} lacks {suffix}")

        options, receipts, statuses, zero, meta = [], [], Counter(), 0, None
        latest_full = None
        for option in layer["release_options"]:
            body = json.loads((args.root / option["bundle_path"]).read_text())
            release = body["release"]
            if (body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"]
                    or body["indicator"]["unit"] != layer["unit"] or release["id"] != option["release_id"]):
                raise SystemExit(f"{key}: {option['release_id']} does not match dataset/indicator/unit/id")
            if (release["period_start"], release["period_end"]) != (option["period_start"], option["period_end"]):
                raise SystemExit(f"{key}: {option['release_id']} period differs")
            if release["boundary_version"] != layer["boundary_version"]:
                raise SystemExit(f"{key}: {option['release_id']} boundary differs")
            partial = period_label(option["period_start"], option["period_end"])
            if bool(partial) == bool(option["full_year"]):
                raise SystemExit(f"{key}: {option['release_id']} full_year flag disagrees with its period")
            if rate and partial:
                raise SystemExit(f"{key}: per-100k must not have partial periods")
            obs = body["observations"]
            expected = 368 if level == "township" else 22
            if len(obs) != expected or {o["area_level"] for o in obs} != {level} or len({o["area_code"] for o in obs}) != expected:
                raise SystemExit(f"{key}: {option['release_id']} expected {expected} unique {level} areas")
            statuses.update(o["status"] for o in obs)
            zero += sum(1 for o in obs if o["status"] == "observed" and o["value"] == 0)
            if any(o["status"] == "observed" and o["value"] is None for o in obs):
                raise SystemExit(f"{key}: observed null value")
            meta = meta or body
            entry = {"release_id": option["release_id"], "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": {}}
            if partial:
                entry["partial_period_label"] = partial
            options.append(entry)
            receipts.append({"release_id": option["release_id"], "raw_sha256": release["raw_sha256"], "method_version": release["method_version"], "retrieved_at": release["retrieved_at"]})
            if option["full_year"] and (latest_full is None or option["period_end"] > latest_full["period_end"]):
                latest_full = option
        assert meta is not None and latest_full is not None
        status_labels = {"missing": MISSING}
        unexpected = set(statuses) - {"observed"} - set(status_labels)
        if unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")
        status_labels = {kind: label for kind, label in status_labels.items() if statuses.get(kind)}
        # 交付門檻可手調（layer-plan §3）：只有一個門檻的稀疏層補一級，維持 atlas「至少兩個門檻」契約（0／1／≥2）。
        breaks = BREAK_OVERRIDES.get(key, layer["breaks"])
        if sorted(set(breaks)) != breaks or len(breaks) < 2 or breaks[0] <= 0:
            raise SystemExit(f"{key}: breaks must be strictly increasing, ≥2 and positive")

        notes = list(legend_notes)
        note = BREAK_NOTES.get((base, level)) or BREAK_NOTES.get((base, None))
        if note:
            notes.append(note)
        if any("partial_period_label" in o for o in options):
            notes.append("部分期別（2026 年 1–6 月等）只有件數、沒有比率，不可與全年比較。")
        if rate:
            zero_note = "最淺色含 0（該區該年無通報事件，不是無資料）。"
        else:
            zero_note = ("0 件自成最淺一級（該區該年無通報事件，不是無資料）。" if breaks[0] == 1
                         else "最淺色含 0 件（該區該年無通報事件，不是無資料）。")
        release = meta["release"]
        recipes.append({
            "layer_key": key, "enabled": True, "family": "crime",
            "label": layer["label"].removesuffix(suffix),
            "group": base[len("stats"):][0].lower() + base[len("stats") + 1:],
            "group_label": case_label,
            "option_label": f"{LEVEL_LABEL[level]}・{'每十萬人' if rate else '件數'}",
            "subgroup": subgroup, "data_theme": DATA_THEME, "tab_theme": TAB_THEME, "visual_theme": "security",
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": level,
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": meta["indicator"]["aggregation"],
            "default_release_id": latest_full["release_id"],
            "dimensions": [],
            "release_options": options,
            "legend": {
                "method": "fixed_breaks", "breaks": breaks, "direction": "ascending",
                "scale_note": None, "zero_note": zero_note if zero else None, "display_note": None,
                "notes": notes,
                "by_dimension": None, "dimension_notes": None,
            },
            "status_labels": status_labels,
            "format": {"locale": "zh-TW", "maximumFractionDigits": 2 if rate else 0},
            "derived": rate,
            "location_semantics": location_semantics(base, layer["location_semantics"]),
            "disclosure": public_disclosure(layer["disclosure"]),
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": f"{release['source_metadata']['dataset_title']}（data.gov.tw {layer['source']['landing_url'].rsplit('/', 1)[-1]}）",
            "delivery": {"observed_statuses": dict(sorted(statuses.items())), "observed_zero": zero, "receipts": receipts,
                         "breaks_basis": layer.get("breaks_basis")},
        })
        report.append(f"{key:44} options={len(options):2} default={latest_full['release_id'][:6]} zero={zero} statuses={dict(statuses)}")

    keys = [recipe["layer_key"] for recipe in recipes]
    if len(set(keys)) != len(keys) or len(keys) != 36:
        raise SystemExit(f"expected 36 unique keys, got {len(set(keys))}")
    document = {
        "version": 1,
        "scope": "production_r2",
        "family": "crime",
        "generated_from": {"recipes": args.recipes.name, "bundles": "taipei-gis-analytics crime_statistics release bundles (bundle_path per option)"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"observed_zero": "status observed and value 0 (no reported event in the area that period)", "missing": "value null; no zero fill", "suppressed": "not used (user decision 2026-10-17: small counts shown as-is)"},
        "replaces_layer": delivered["replaces_layer"],
        "recipes": recipes,
    }
    args.out.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {args.out.name} recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))


if __name__ == "__main__":
    main()
