#!/usr/bin/env python3
"""Build src/data/environmentStatisticsRecipes.json from the analytics delivery.

Inputs (taipei-gis-analytics, read-only):
  --recipes    docs/handoff/environment-statistics-recipes.json (SSOT; layer_key/dimensions[]/
               location_semantics) or the earlier frontend_recipes.json (key/dimension).
               The handoff's `enabled: false` (research/prototype profile) is not honoured here;
               enabling is a frontend decision recorded in docs/features/environment-statistics.
  --processed  data/processed root; releases/*.json give the exact period,
               boundary, publisher and the *observed* dimension tuples per release.

The release whitelist is the observed (release_id, dimensions) tuples, never
releases x dimension_options: some ratios only exist for a subset of types.
Presentation (group, wording, disclosure) lives in PRESENTATION below; values,
periods and sources always come from the delivery.

Usage:
  python3 scripts/statistics/build_environment_statistics_recipes.py \
    --recipes <analytics>/data/intermediate/regional_statistics/moenv/frontend_recipes.json \
    --processed <analytics>/data/processed
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/environmentStatisticsRecipes.json"

COUNTY_SEMANTICS = "依來源縣市列報；以 COUNTY_MOI_1140318 縣市參考邊界 identity 呈現，不做面積重分配。"
POP_DENOMINATOR = "分母＝同年年底人口；比率不可加總、不可由細項重算總計。"

# key: (group, subgroup, tab_group, visual_theme, toggle option label, decimals, extra disclosure, location semantics override)
PRESENTATION: dict[str, tuple[str, str, str, str, str, int, str, str | None]] = {
    "statsComplaintsCounty": ("污染與公害統計", "公害陳情", "污染與公害", "environment", "原始數", 0,
        "公害陳情受理案件數，依陳情事由分類；細項與總計不可混加。", "陳情受理縣市；" + COUNTY_SEMANTICS),
    "statsComplaintsPer10kDerivedCounty": ("污染與公害統計", "公害陳情", "污染與公害", "environment", "每萬人", 2,
        "公害陳情件數÷同年年底人口×10,000。" + POP_DENOMINATOR, "陳情受理縣市；" + COUNTY_SEMANTICS),
    "statsComplaintTargetCounty": ("污染與公害統計", "公害陳情", "污染與公害", "environment", "原始數", 0,
        "公害陳情受理案件數，依陳情對象分類；與「依陳情事由」為同一批案件的另一種分類。", "陳情受理縣市；" + COUNTY_SEMANTICS),
    "statsComplaintCasesPndCounty": ("污染與公害統計", "公害陳情", "污染與公害", "environment", "陳情件數", 0,
        "來源原表（公害陳情頻率）自帶件數；件數請優先使用「公害陳情案件數」，兩者 110 年高雄差 1 件。", "陳情受理縣市；" + COUNTY_SEMANTICS),
    "statsComplaintPopulationCounty": ("污染與公害統計", "公害陳情", "污染與公害", "environment", "人口數", 0,
        "來源原表（公害陳情頻率）自帶人口數，僅供對照該表每萬人件數的分母；不是人口統計正式來源。", None),
    "statsComplaintsPer10kCounty": ("污染與公害統計", "公害陳情", "污染與公害", "environment", "每萬人件數", 2,
        "來源原表自帶每萬人件數；2023 年來源值錯誤未產製。建議改用「公害陳情案件數」的每萬人口徑。比率不可加總。", "陳情受理縣市；" + COUNTY_SEMANTICS),
    "statsBurningComplaintsCounty": ("污染與公害統計", "燃燒陳情", "污染與公害", "environment", "原始數", 0,
        "燃燒行為陳情（異味類），口徑含燒稻草、燒香紙錢與露天燃燒；107–112 年子類定義未逐年比對。", "陳情受理縣市；" + COUNTY_SEMANTICS),
    "statsBurningComplaintsPer10kCounty": ("污染與公害統計", "燃燒陳情", "污染與公害", "environment", "每萬人", 2,
        "燃燒行為陳情件數÷同年年底人口×10,000；僅 2021–2025。口徑含燒香紙錢。" + POP_DENOMINATOR, "陳情受理縣市；" + COUNTY_SEMANTICS),
    "statsSoilControlAreaCounty": ("污染與公害統計", "土壤地下水", "污染與公害", "environment", "原始數", 0,
        "土壤及地下水污染控制場址期末面積，依場址類型分類。", "場址所在縣市；" + COUNTY_SEMANTICS),
    "statsSoilRemediationAreaCounty": ("污染與公害統計", "土壤地下水", "污染與公害", "environment", "原始數", 0,
        "土壤及地下水污染整治場址期末面積，依場址類型分類；多數縣市為 0（真零）。", "場址所在縣市；" + COUNTY_SEMANTICS),
    "statsEnvInspectionsCounty": ("環境治理統計", "稽查與罰鍰", "環境治理", "environment", "原始數", 0,
        "地方環保局環保稽查次數，依稽查類別分類。", "稽查機關所屬縣市；" + COUNTY_SEMANTICS),
    "statsEnvInspectionsPerFacilityCounty": ("環境治理統計", "稽查與罰鍰", "環境治理", "environment", "每列管設施", 2,
        "環保稽查次數÷列管設施數。分母為 2026-08-18 環境部列管設施快照，非同年；只有 2025 年，細項僅 5 類；設施旗標可重疊。比率不可加總。", "稽查機關所屬縣市；" + COUNTY_SEMANTICS),
    "statsEnvFineCasesCounty": ("環境治理統計", "稽查與罰鍰", "環境治理", "environment", "原始數", 0,
        "環保罰鍰處分次數，依稽查類別分類。", "裁處機關所屬縣市；" + COUNTY_SEMANTICS),
    "statsEnvFineRateCounty": ("環境治理統計", "稽查與罰鍰", "環境治理", "environment", "裁處率（罰鍰÷稽查）", 2,
        "罰鍰次數÷稽查次數×100（同年同細項）。可大於 100%：罰鍰與稽查不一定同案同年。稽查為 0 時為缺值，不是 0。", "裁處機關所屬縣市；" + COUNTY_SEMANTICS),
    "statsEnvFineAmountCounty": ("環境治理統計", "稽查與罰鍰", "環境治理", "environment", "原始數", 0,
        "環保罰鍰處分金額（千元），依稽查類別分類。", "裁處機關所屬縣市；" + COUNTY_SEMANTICS),
    "statsEnvFineCollectedCounty": ("環境治理統計", "稽查與罰鍰", "環境治理", "environment", "原始數", 0,
        "環保實收罰鍰金額（千元）；實收可能包含往年處分，與當年處分金額不可直接相除。", "裁處機關所屬縣市；" + COUNTY_SEMANTICS),
    "statsAqiPoorRatioCounty": ("空氣品質統計", "空品概況", "空氣品質", "environment", "原始數", 2,
        "AQI>100 站日數占總站日數比率；比率不可加總。", "測站所在縣市；" + COUNTY_SEMANTICS),
    "statsMotorArrivalRateCounty": ("空氣品質統計", "機車定檢", "空氣品質", "environment", "原始數", 2,
        "機車排氣定檢到檢率＝實際檢測數÷應到檢數；應到檢數未扣除不使用的機車。比率不可加總。", "車籍縣市（不是檢驗站或行駛所在地）；" + COUNTY_SEMANTICS),
    "statsMotorNotifiedCounty": ("空氣品質統計", "機車定檢", "空氣品質", "environment", "原始數", 0,
        "機車排氣定檢應到檢數；未扣除不使用的機車。", "車籍縣市（不是檢驗站或行駛所在地）；" + COUNTY_SEMANTICS),
    "statsMotorTestedCounty": ("空氣品質統計", "機車定檢", "空氣品質", "environment", "原始數", 0,
        "機車排氣定檢實際檢測數；來源「不詳」的檢測數不分配到縣市。", "車籍縣市（不是檢驗站或行駛所在地）；" + COUNTY_SEMANTICS),
    "statsSewerConnectionCounty": ("水質與污水統計", "污水下水道", "水質與污水", "utilities", "原始數", 2,
        "公共污水下水道用戶接管普及率；只有 2024 年。比率不可加總。", "縣市行政轄區；" + COUNTY_SEMANTICS),
    "statsSewageTreatmentCounty": ("水質與污水統計", "污水下水道", "水質與污水", "utilities", "原始數", 2,
        "整體污水處理率（來源自帶）；只有 2024 年。比率不可加總。", "縣市行政轄區；" + COUNTY_SEMANTICS),
    "statsTapWaterTestsCounty": ("水質與污水統計", "自來水水質", "水質與污水", "utilities", "原始數", 0,
        "自來水水質抽驗檢驗件數。", None),
    "statsTapWaterFailuresCounty": ("水質與污水統計", "自來水水質", "水質與污水", "utilities", "原始數", 0,
        "自來水水質抽驗不合格件數；多數縣市為 0（真零），以「有／無不合格」二元呈現。", None),
    "statsTapWaterFailureRateCounty": ("水質與污水統計", "自來水水質", "水質與污水", "utilities", "原始數", 2,
        "自來水水質抽驗不合格率；以「有／無不合格」二元呈現，比率不可加總。", None),
    "statsBodGeneratedCounty": ("水質與污水統計", "廢污水排放", "水質與污水", "environment", "原始數", 2,
        "廢（污）水 BOD 產生量（BOD5 公噸／日），依污水來源分類。", None),
    "statsBodDischargedCounty": ("水質與污水統計", "廢污水排放", "水質與污水", "environment", "原始數", 2,
        "廢（污）水 BOD 排放量（BOD5 公噸／日），依污水來源分類。", None),
    "statsBodDischargedPerKm2County": ("水質與污水統計", "廢污水排放", "水質與污水", "environment", "每平方公里", 2,
        "BOD 排放量（換算公斤 BOD5／日）÷縣市面積；面積為 114 年縣市面積。比率不可加總。", None),
    "statsWasteGeneratedCounty": ("廢棄物統計", "產生與清理", "廢棄物與回收", "environment", "原始數", 0,
        "一般廢棄物總產生量（公噸）。", None),
    "statsWasteGeneratedPer10kCounty": ("廢棄物統計", "產生與清理", "廢棄物與回收", "environment", "每萬人", 1,
        "一般廢棄物產生量÷同年年底人口×10,000。" + POP_DENOMINATOR, None),
    "statsWastePerCapitaCounty": ("廢棄物統計", "產生與清理", "廢棄物與回收", "environment", "原始數", 3,
        "平均每人每日一般廢棄物產生量（來源自帶）；比率不可加總。", None),
    "statsGeneralGarbageCounty": ("廢棄物統計", "產生與清理", "廢棄物與回收", "environment", "原始數", 0,
        "一般垃圾量（清理量，公噸）。", None),
    "statsGeneralGarbagePer10kCounty": ("廢棄物統計", "產生與清理", "廢棄物與回收", "environment", "每萬人", 1,
        "一般垃圾清理量÷同年年底人口×10,000；僅 2021–2025。" + POP_DENOMINATOR, None),
    "statsFoodWasteCounty": ("廢棄物統計", "產生與清理", "廢棄物與回收", "environment", "原始數", 0,
        "廚餘量（清理量，公噸）。", None),
    "statsRecyclingAmountCounty": ("資源回收統計", "回收量", "廢棄物與回收", "environment", "原始數", 0,
        "執行機關資源回收量（公噸），依回收物種類分類。", None),
    "statsRecyclingPer10kCounty": ("資源回收統計", "回收量", "廢棄物與回收", "environment", "每萬人", 1,
        "執行機關資源回收量÷同年年底人口×10,000。" + POP_DENOMINATOR, None),
    "statsResponsibleEnterprisesCounty": ("資源回收統計", "責任業者", "廢棄物與回收", "environment", "原始數", 0,
        "責任業者列管家數。單期快照：來源沒有統計期欄位，期別是擷取日期（2026-10-02），不是來源統計期。", "列管業者登記所在縣市；" + COUNTY_SEMANTICS),
}

TOGGLE_LABELS = {
    "statsComplaintCasesPndCounty": "公害陳情頻率（來源原表）",
}
# The pnd source table publishes three indicators; they share one 「指標」 toggle instead of three rows.
EXTRA_TOGGLE_GROUPS = {
    "statsComplaintCasesPndCounty": ["statsComplaintCasesPndCounty", "statsComplaintPopulationCounty", "statsComplaintsPer10kCounty"],
}

BINARY_BREAKS = {"statsTapWaterFailuresCounty": [1], "statsTapWaterFailureRateCounty": [0.01]}


BOUNDARY_DISCLOSURE = "縣市歸屬以 COUNTY_MOI_1140318 參考縣界顯示；不代表歷史邊界、不做面積重分配；缺值不是 0。"


def normalize(layer: dict) -> dict:
    """Accept both frontend_recipes.json (key/dimension) and the handoff SSOT (layer_key/dimensions[])."""
    layer = dict(layer)
    if "layer_key" in layer:
        layer["key"] = layer["layer_key"]
        dims = layer.get("dimensions") or []
        if len(dims) > 1:
            raise SystemExit(f"{layer['key']}: multi-dimension recipes are not supported")
        if dims:
            layer["dimension"], layer["dimension_default"], layer["dimension_options"] = dims[0]["key"], dims[0]["default"], dims[0]["options"]
        else:
            layer["dimension"] = None
    return layer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipes", required=True, type=Path)
    parser.add_argument("--processed", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    delivered = json.loads(args.recipes.read_text())
    layers = delivered if isinstance(delivered, list) else delivered.get("recipes") or delivered["layers"]
    layers = [normalize(layer) for layer in layers]
    index = {path.stem: path for path in args.processed.glob("*/*/releases/*.json")}
    if set(PRESENTATION) != {layer["key"] for layer in layers}:
        raise SystemExit(f"presentation keys differ from delivery: {set(PRESENTATION) ^ {layer['key'] for layer in layers}}")
    toggle_groups: dict[str, list[str]] = {}
    for layer in layers:
        if layer.get("toggle_group"):
            toggle_groups.setdefault(layer["toggle_group"], []).append(layer["key"])
    for group, members in toggle_groups.items():
        members.sort(key=lambda key: key != group)
    toggle_groups.update(EXTRA_TOGGLE_GROUPS)
    member_of = {key: group for group, members in toggle_groups.items() for key in members}

    recipes = []
    for layer in layers:
        key = layer["key"]
        group, subgroup, tab_group, theme, option_label, decimals, disclosure, location = PRESENTATION[key]
        options, receipts, meta = [], [], None
        for release_id in layer["releases"]:
            body = json.loads(index[release_id].read_text())
            release = body["release"]
            if body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"] or body["indicator"]["unit"] != layer["unit"]:
                raise SystemExit(f"{key}: {release_id} does not match dataset/indicator/unit")
            meta = meta or release
            if release["boundary_version"] != meta["boundary_version"]:
                raise SystemExit(f"{key}: mixed boundary versions")
            tuples = sorted({json.dumps(obs["dimensions"], sort_keys=True, ensure_ascii=False) for obs in body["observations"]})
            dimension = layer.get("dimension")
            for raw in tuples:
                dims = json.loads(raw)
                if (list(dims) != [dimension]) if dimension else dims:
                    raise SystemExit(f"{key}: unexpected dimensions {dims}")
                options.append({"release_id": release_id, "period_start": release["period_start"], "period_end": release["period_end"], "dimensions": dims})
            receipts.append({"release_id": release_id, "raw_sha256": release["raw_sha256"], "method_version": release["method_version"], "retrieved_at": release["retrieved_at"], "coverage": release["provenance"].get("coverage")})
        assert meta is not None
        if layer["default_release"] not in layer["releases"]:
            raise SystemExit(f"{key}: default release not in releases")
        dimension = None
        if layer.get("dimension"):
            observed = {option["dimensions"][layer["dimension"]] for option in options}
            dimension = {
                "key": layer["dimension"], "default": layer["dimension_default"],
                "options": [option for option in layer["dimension_options"] if option["value"] in observed],
            }
            if layer["dimension_default"] not in observed or observed - {option["value"] for option in dimension["options"]}:
                raise SystemExit(f"{key}: dimension labels do not cover observed values")
        binary = layer.get("classification") == "binary"
        group_key = member_of.get(key)
        recipes.append({
            "layer_key": key, "enabled": True, "label": layer["label"],
            "group": group, "subgroup": subgroup, "tab_group": tab_group, "visual_theme": theme,
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": layer["level"],
            "boundary_version": meta["boundary_version"], "unit": layer["unit"], "aggregation": layer["aggregation"],
            "default_release_id": layer["default_release"],
            "release_options": options,
            "dimension": dimension,
            "legend": {
                "method": "binary" if binary else "fixed_breaks",
                "breaks": BINARY_BREAKS[key] if binary else layer["breaks"],
                "binary_labels": ["0：無不合格", "大於 0：有不合格"] if binary else None,
            },
            "format": {"locale": "zh-TW", "maximumFractionDigits": decimals},
            "toggle": {"group": group_key, "label": TOGGLE_LABELS.get(group_key, layer["label"]) if group_key == key else None,
                       "option_label": option_label, "members": toggle_groups[group_key] if group_key == key else None} if group_key else None,
            "pair_raw_key": layer.get("pair_raw_key"),
            "derived": bool(layer.get("pair_raw_key")),
            # 上游 handoff 的位置口徑較保守（不宣稱發生地／設施地），有就以上游為準。
            "location_semantics": layer.get("location_semantics") or location or COUNTY_SEMANTICS,
            "disclosure": f"{disclosure}{BOUNDARY_DISCLOSURE}" if layer.get("location_semantics") else disclosure,
            "source_note": layer.get("notes", ""),
            "publisher": meta["publisher"], "license": meta["license"],
            "source_landing_url": meta["source_landing_url"], "source_download_url": meta["source_download_url"],
            "source_title": meta["source_metadata"].get("dataset_title"),
            "delivery": {"breaks_basis": layer.get("breaks_basis"), "delivered_breaks": layer["breaks"], "key_status": layer.get("key_status"), "receipts": receipts},
        })
    document = {
        "version": 1,
        "scope": "production_r2_pending_import",
        "generated_from": {"recipes": args.recipes.name, "processed": "taipei-gis-analytics data/processed releases/*.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"observed_zero": "status observed and value 0", "missing": "value null; no zero fill"},
        "recipes": recipes,
    }
    args.out.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {args.out} recipes={len(recipes)} options={sum(len(r['release_options']) for r in recipes)}")


if __name__ == "__main__":
    main()
