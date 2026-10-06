#!/usr/bin/env python3
"""Build src/data/addictionStatisticsRecipes.json from the analytics delivery.

Inputs (taipei-gis-analytics harm-reduction worktree, read-only):
  --recipes    docs/handoff/addiction-statistics-recipes.json
               (78 recipes; `enabled` is honoured: 第二級毒品嫌疑犯與毒品危害防制中心保留 false，
               其 selector 不在 R2；`display_priority` 原樣帶出：地檢署轄區層 primary、縣市退化版 secondary)。
  --processed  data/processed root; releases/*.json give the exact period, boundary,
               publisher and the observed statuses per release.

The release whitelist is the delivered release_options, cross-checked against each bundle
(dataset / indicator / unit / level / period / boundary). Presentation (sidebar group, option
label, disclosure wording per release plan §3, status legend labels) lives in the tables below;
values, periods and sources always come from the delivery.

Usage:
  python3 scripts/statistics/build_addiction_statistics_recipes.py \
    --recipes <analytics WT>/docs/handoff/addiction-statistics-recipes.json \
    --processed <analytics WT>/data/processed
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/addictionStatisticsRecipes.json"

HIV = "疾病（HIV）"
ENFORCEMENT = "執法（毒品、酒駕、地檢署）"
SURVEY = "行為調查（吸菸、檳榔）"
SERVICES = "服務據點"

BOUNDARY = "縣市以內政部 114 年 3 月縣市界、鄉鎮以同版鄉鎮市區界顯示；不代表歷史邊界、不做面積重分配。"
DISTRICT_BOUNDARY = ("地檢署轄區界由內政部 114 年 3 月鄉鎮市區界依司法院事務分配（115 年現況）整區合併（22 面）；"
                     "歷年數值都畫在現行轄區上，不代表歷史轄區。")
NO_ZERO_FILL = "缺值、不適用、隱私遮蔽都不是 0。"

POLICE = ("統計單位是查獲（受理）警察機關所在縣市，不是居住地或發生地；數字反映執法強度與專案，"
          "不等於吸毒或酒駕盛行率；警政署提醒各縣市數據不宜直接比較；刑事局、航警、國道等署屬單位不歸縣市（列未分配）。")
POLICE_RATIO = "每 10 萬人＝人數（件數）÷同年年底戶籍人口×100,000（2018 年起才有同年分母）；分子仍是查獲機關所在地，不是居民盛行率；比率不可加總。"
HIV_COUNTY = ("本國籍、依居住縣市的年度新通報人數（疾管署資料，經性平會統計資料庫發布）；不含危險因子，無法分辨注射藥癮者；"
              "離島數字小，不宜放大解讀；與鄉鎮層（NIDSS 確定病例、依診斷日、5 年合計）口徑不同，兩者不可並列比較。")
HIV_COUNTY_RATIO = "每 10 萬人＝新通報人數÷同年年底戶籍人口×100,000（2018 年起）；比率不可加總。"
HIV_TOWNSHIP = ("本國籍、依診斷日的確定病例 5 年合計（2016–2020、2021–2025；疾管署 NIDSS）；1–2 例的鄉鎮不顯示數字（隱私遮蔽），"
                "0 例照實顯示；與縣市層（性平會 gecdb 年度新通報）口徑不同，兩者不可並列比較，加總也不必相等。")
HIV_TOWNSHIP_RATIO = "年平均每 10 萬人＝5 年病例÷各年年底戶籍人口加總×100,000；只有 2021–2025（2016–2020 缺 2016、2017 年分母）；遮蔽鄉鎮比例同步遮蔽。"
SURVEY_NOTE = "抽樣調查值（每縣約數百至兩千樣本），縣市差距多在抽樣誤差內，不宜細排名次。"
SERVICE = ("名冊快照（2026-10-06）的據點數，由本專案減害點位圖層以點在參考行政區面內計數；0＝名冊中該區沒有據點（不是無資料）；"
           "不代表服務量、開放時間或使用人數。")
SERVICE_RATIO = "每 10 萬人＝據點數÷115 年 8 月底戶籍人口×100,000；分母日期與名冊快照日（2026-10-06）不同；比率不可加總。"
PROSECUTOR = ("地檢署轄區不等於縣市：縣市圖只顯示轄區恰為單一縣市的 14 署；臺北市、新北市、基隆市、新竹縣、新竹市、嘉義縣、嘉義市、"
              "高雄市顯示「不適用」（這 8 署的人數列未分配）；完整 22 署請看「地檢署毒品案件新收（22 地檢署轄區）」；115 年為 1–8 月累計，不可與整年比較。")
PROSECUTOR_DISTRICT = ("地檢署轄區不等於縣市：雙北與基隆由臺北、士林、新北、基隆四署交錯管轄，高雄市分屬高雄與橋頭兩署，"
                       "新竹、嘉義地檢署各管轄縣與市；地圖面與名稱都是地檢署，不是縣市。新收人數反映查緝與起訴量，不是吸毒盛行率；"
                       "苗栗以全縣推定；115 年為 1–8 月累計，不可與整年比較。")

# dataset → (subgroup, visual theme, location semantics, status legend labels)
DATASETS: dict[str, tuple[str, str, str, dict[str, str]]] = {
    "addiction_hiv_county": (HIV, "health", "個案居住縣市（本國籍）", {"missing": "無資料（不等於 0）"}),
    "addiction_hiv_township": (HIV, "health", "個案居住鄉鎮市區（本國籍、依診斷日、確定病例）", {"suppressed": "隱私遮蔽（1–2 例不顯示，不是 0）"}),
    "addiction_drug_suspects_county": (ENFORCEMENT, "security", "查獲（受理）警察機關所在縣市，不是居住地或發生地", {"missing": "無資料（不等於 0）"}),
    "addiction_dui_county": (ENFORCEMENT, "security", "查獲（受理）警察機關所在縣市，不是居住地或發生地", {"missing": "無資料（不等於 0）"}),
    "addiction_prosecutor_drug_county": (ENFORCEMENT, "security", "地方檢察署受理（轄區不等於縣市；只顯示轄區恰為單一縣市的 14 署）", {"not_applicable": "不適用（地檢署轄區跨縣市或同縣市多署）"}),
    "addiction_prosecutor_drug_district": (ENFORCEMENT, "security", "地方檢察署受理，以 22 個地檢署轄區顯示（地檢署轄區≠縣市；案件受理地，不是居住地或發生地）", {"missing": "無資料（不等於 0）"}),
    "addiction_tobacco_betel_county": (SURVEY, "health", "受訪者現住縣市（抽樣調查）", {"missing": "無資料（金門、連江未納入調查，不是 0）"}),
    "addiction_service_points": (SERVICES, "health", "服務據點所在行政區（名冊快照）", {"missing": "無資料（不等於 0）"}),
}

# layer_key → (sidebar group key, group label, option label, decimals, disclosure, derived)
PRESENTATION: dict[str, tuple[str, str, str, int, str, bool]] = {
    "statsHivNewCasesCounty": ("hivCounty", "HIV 本國籍新通報（縣市）", "人數", 0, HIV_COUNTY, False),
    "statsHivPer100kCounty": ("hivCounty", "HIV 本國籍新通報（縣市）", "每 10 萬人", 2, f"{HIV_COUNTY}{HIV_COUNTY_RATIO}", True),
    "statsHivCasesTownship": ("hivTownship", "HIV 本國籍確定病例（鄉鎮，5 年合計）", "5 年合計人數", 0, HIV_TOWNSHIP, False),
    "statsHivPer100kYearTownship": ("hivTownship", "HIV 本國籍確定病例（鄉鎮，5 年合計）", "年平均每 10 萬人", 2, f"{HIV_TOWNSHIP}{HIV_TOWNSHIP_RATIO}", True),
    "statsDrugSuspectsCounty": ("drugSuspects", "毒品嫌疑犯", "人數", 0, POLICE, False),
    "statsDrugSuspectsPer100kCounty": ("drugSuspects", "毒品嫌疑犯", "每 10 萬人", 2, f"{POLICE}{POLICE_RATIO}", True),
    "statsDrugUseSuspectsCounty": ("drugUseSuspects", "毒品嫌疑犯（施用）", "人數", 0, POLICE, False),
    "statsDrugUseSuspectsPer100kCounty": ("drugUseSuspects", "毒品嫌疑犯（施用）", "每 10 萬人", 2, f"{POLICE}{POLICE_RATIO}", True),
    "statsDrugGrade1SuspectsCounty": ("drugGrade1Suspects", "第一級毒品嫌疑犯", "人數", 0, f"第一級（海洛因等）最貼近注射減害族群。{POLICE}", False),
    "statsDrugGrade1SuspectsPer100kCounty": ("drugGrade1Suspects", "第一級毒品嫌疑犯", "每 10 萬人", 2, f"第一級（海洛因等）最貼近注射減害族群。{POLICE}{POLICE_RATIO}", True),
    "statsDrugGrade2SuspectsCounty": ("drugGrade2Suspects", "第二級毒品嫌疑犯", "人數", 0, POLICE, False),
    "statsDrugGrade2SuspectsPer100kCounty": ("drugGrade2Suspects", "第二級毒品嫌疑犯", "每 10 萬人", 2, f"{POLICE}{POLICE_RATIO}", True),
    "statsDuiCasesCounty": ("duiCases", "酒駕公共危險罪", "發生數", 0, f"不能安全駕駛（酒駕）公共危險罪發生數。{POLICE}", False),
    "statsDuiRateCounty": ("duiCases", "酒駕公共危險罪", "犯罪率（來源自帶）", 2, f"犯罪率為警政統計來源自帶（件／10 萬人），不重算；比率不可加總。{POLICE}", False),
    "statsDuiEnforcementCounty": ("duiEnforcement", "酒駕取締", "件數", 0, f"交通違規取締量＝執法量，不是酒駕發生率。{POLICE}", False),
    "statsDuiEnforcementPer100kCounty": ("duiEnforcement", "酒駕取締", "每 10 萬人", 2, f"交通違規取締量＝執法量，不是酒駕發生率。{POLICE}{POLICE_RATIO}", True),
    "statsProsecutorDrugNewCasesCounty": ("prosecutorDrug", "地檢署毒品案件新收", "毒品新收人數", 0, PROSECUTOR, False),
    "statsProsecutorDrugUseCounty": ("prosecutorDrug", "地檢署毒品案件新收", "施用新收人數", 0, PROSECUTOR, False),
    "statsProsecutorDrugGrade1County": ("prosecutorDrug", "地檢署毒品案件新收", "第一級新收人數", 0, PROSECUTOR, False),
    "statsProsecutorDrugGrade2County": ("prosecutorDrug", "地檢署毒品案件新收", "第二級新收人數", 0, PROSECUTOR, False),
    "statsProsecutorDeferredTreatmentCounty": ("prosecutorDrug", "地檢署毒品案件新收", "緩起訴附命戒癮治療人數", 0, f"施用毒品緩起訴處分附命完成戒癮治療人數。{PROSECUTOR}", False),
    "statsProsecutorDrugNewCasesDistrict": ("prosecutorDrugDistrict", "地檢署毒品案件新收（22 地檢署轄區）", "毒品新收人數", 0, PROSECUTOR_DISTRICT, False),
    "statsProsecutorDrugUseDistrict": ("prosecutorDrugDistrict", "地檢署毒品案件新收（22 地檢署轄區）", "施用新收人數", 0, PROSECUTOR_DISTRICT, False),
    "statsProsecutorDrugGrade1District": ("prosecutorDrugDistrict", "地檢署毒品案件新收（22 地檢署轄區）", "第一級新收人數", 0, PROSECUTOR_DISTRICT, False),
    "statsProsecutorDrugGrade2District": ("prosecutorDrugDistrict", "地檢署毒品案件新收（22 地檢署轄區）", "第二級新收人數", 0, PROSECUTOR_DISTRICT, False),
    "statsProsecutorDeferredTreatmentDistrict": ("prosecutorDrugDistrict", "地檢署毒品案件新收（22 地檢署轄區）", "緩起訴附命戒癮治療人數", 0, f"施用毒品緩起訴處分附命完成戒癮治療人數。{PROSECUTOR_DISTRICT}", False),
    "statsAdultSmokingRateCounty": ("adultSmoking", "18 歲以上目前吸菸率", "吸菸率", 2, f"113 年國人吸菸行為調查，兩性合計粗率（非標準化率）。{SURVEY_NOTE}", False),
    "statsAdultBetelRateCounty": ("adultBetel", "18 歲以上嚼檳榔率（近六個月）", "嚼檳榔率", 2, f"最近六個月曾經嚼食檳榔比率（102／106／110 年調查）；嚼檳榔調查不含金門、連江（無資料，不是 0）。{SURVEY_NOTE}", False),
}

SERVICE_CATEGORIES = {
    "NeedleEducationStations": ("needleEducationStations", "清潔針具衛教站", "清潔針具據點"),
    "NeedleVendingMachines": ("needleVendingMachines", "清潔針具自動服務機", "清潔針具據點"),
    "NeedleReturnBins": ("needleReturnBins", "針具回收桶", "清潔針具據點"),
    "NeedleSitesTotal": ("needleSitesTotal", "清潔針具據點（三類任一）", "清潔針具據點"),
    "DrugTreatmentFacilities": ("drugTreatmentFacilities", "藥癮／替代治療機構", "替代療法與藥癮戒治"),
    "SubstitutionTreatmentSites": ("substitutionTreatmentSites", "替代治療執行機構", "替代療法與藥癮戒治"),
    "AlcoholTreatmentFacilities": ("alcoholTreatmentFacilities", "酒癮治療機構", "酒癮治療機構"),
    "HivTestingSites": ("hivTestingSites", "HIV 篩檢服務點", "愛滋篩檢與指定醫療"),
    "HivSelftestOutlets": ("hivSelftestOutlets", "HIV 自我檢測販售點", "愛滋自我篩檢通路"),
    "PrepServiceSites": ("prepServiceSites", "PrEP 服務據點", "PrEP 服務據點"),
    "SmokingCessationProviders": ("smokingCessationProviders", "戒菸服務據點", "戒菸服務"),
    "InternetAddictionServices": ("internetAddictionServices", "網路成癮服務據點", "網路成癮服務"),
    "DrugPreventionCenters": ("drugPreventionCenters", "毒品危害防制中心", "毒品危害防制中心"),
}
LEVEL_LABEL = {"county": "縣市", "township": "鄉鎮"}
# 計數口徑（analytics recipe disclosure）：三類針具據點不可相加；替代治療只計執行機構。
SERVICE_SCOPE = {
    "NeedleSitesTotal": "衛教站、自動服務機、回收桶任一即算 1 處（同一地點不重複計），三類分開的圖層相加會大於本數。",
    "SubstitutionTreatmentSites": "只計替代治療執行機構（美沙冬／丁基原啡因），不含 29 處衛星給藥點與只辦藥癮戒治的指定機構。",
}
for stem, (group, label, point_layer) in SERVICE_CATEGORIES.items():
    # 全國 <30 點的類別（毒品危害防制中心）只出縣市層。
    for level in ("County",) if stem == "DrugPreventionCenters" else ("County", "Township"):
        lv = LEVEL_LABEL[level.lower()]
        source = f"{SERVICE_SCOPE.get(stem, '')}點位來源圖層：「{point_layer}」。"
        PRESENTATION[f"stats{stem}{level}"] = (group, f"{label}據點數", f"{lv}：據點數", 0, f"{SERVICE}{source}", True)
        PRESENTATION[f"stats{stem}Per100k{level}"] = (group, f"{label}據點數", f"{lv}：每 10 萬人", 2, f"{SERVICE}{SERVICE_RATIO}{source}", True)

ZERO_NOTE = {"addiction_service_points": "最淺色含 0 處（名冊中該區沒有據點，不是無資料）。"}
SOURCE_TITLE = {
    "addiction_hiv_county": "性平會重要性別統計資料庫：HIV 感染者本國籍新通報人數（縣市別）",
    "addiction_hiv_township": "疾管署傳染病統計資料查詢系統（NIDSS）：人類免疫缺乏病毒感染（044）鄉鎮地圖",
    "addiction_drug_suspects_county": "警政署警政統計查詢網：毒品嫌疑犯人數（機關別）",
    "addiction_dui_county": "警政署警政統計查詢網：公共危險（不能安全駕駛）案件與酒駕取締",
    "addiction_prosecutor_drug_county": "法務部法務統計：地方檢察署毒品案件新收與緩起訴附命戒癮治療",
    "addiction_prosecutor_drug_district": "法務部法務統計：地方檢察署毒品案件新收與緩起訴附命戒癮治療（22 地檢署轄區）",
    "addiction_tobacco_betel_county": "國健署國人吸菸行為調查（性平會 gecdb）／衛福部心理健康司嚼檳榔率（data.gov.tw 173036）",
    "addiction_service_points": "本專案減害點位圖層（名冊快照 2026-10-06）",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipes", required=True, type=Path)
    parser.add_argument("--processed", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    delivered = json.loads(args.recipes.read_text())
    if delivered.get("family") != "addiction":
        raise SystemExit("not the addiction recipes draft")
    layers = delivered["recipes"]
    keys = {layer["layer_key"] for layer in layers}
    if set(PRESENTATION) != keys:
        raise SystemExit(f"presentation keys differ from delivery: {sorted(set(PRESENTATION) ^ keys)}")
    index = {path.stem: path for path in args.processed.glob("poi/addiction_*/releases/*.json")}

    recipes = []
    for layer in layers:
        key = layer["layer_key"]
        group, group_label, option_label, decimals, disclosure, derived = PRESENTATION[key]
        subgroup, theme, location, status_labels = DATASETS[layer["dataset_id"]]
        if layer["dimensions"]:
            raise SystemExit(f"{key}: dimensions are not expected in the addiction family")
        options, receipts, meta, statuses = [], [], None, Counter()
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
            meta = meta or release
            options.append({"release_id": release_id, "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": {}})
            receipts.append({"release_id": release_id, "raw_sha256": release["raw_sha256"], "method_version": release["method_version"], "retrieved_at": release["retrieved_at"]})
        assert meta is not None
        if layer["default_release"] not in {option["release_id"] for option in options}:
            raise SystemExit(f"{key}: default release not in options")
        unexpected = set(statuses) - {"observed"} - set(status_labels)
        if layer["enabled"] and unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")
        breaks = layer["breaks"]
        if breaks == [0] or sorted(set(breaks)) != breaks:
            raise SystemExit(f"{key}: breaks must be strictly increasing and not [0]")
        recipes.append({
            "layer_key": key, "enabled": bool(layer["enabled"]), "label": layer["label"],
            "group": group, "group_label": group_label, "option_label": option_label,
            "subgroup": subgroup, "visual_theme": theme,
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": layer["level"],
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": layer["aggregation"],
            "default_release_id": layer["default_release"],
            "release_options": options,
            "legend": {"method": "fixed_breaks", "breaks": breaks, "zero_note": ZERO_NOTE.get(layer["dataset_id"])},
            # 圖例只列本層會出現的非數值狀態（不適用／無資料／隱私遮蔽分開）；都不上數值色。
            "status_labels": {status: label for status, label in status_labels.items() if status in statuses} or {"missing": "無資料（不等於 0）"},
            "format": {"locale": "zh-TW", "maximumFractionDigits": decimals},
            "pair_raw_key": layer["pair_raw_key"],
            "derived": derived,
            "location_semantics": location,
            "disclosure": f"{disclosure}{NO_ZERO_FILL}{DISTRICT_BOUNDARY if layer['level'] == 'prosecutor_district' else BOUNDARY}",
            # 同一指標兩層都在時 primary（轄區）預設顯示、secondary（縣市退化版）保留；其餘層為 null。
            "display_priority": layer.get("display_priority"),
            "publisher": layer["source"]["publisher"], "license": layer["source"]["license"],
            "source_landing_url": layer["source"]["landing_url"], "source_download_url": meta["source_download_url"],
            "source_title": SOURCE_TITLE[layer["dataset_id"]],
            "delivery": {"breaks_basis": layer.get("breaks_basis"), "key_status": layer.get("key_status"), "observed_statuses": dict(sorted(statuses.items())), "receipts": receipts},
        })
    document = {
        "version": 1,
        "scope": "production_r2",
        "generated_from": {"recipes": args.recipes.name, "processed": "taipei-gis-analytics data/processed/poi/addiction_*/releases/*.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"observed_zero": "status observed and value 0", "missing": "value null; no zero fill", "not_applicable": "value null; not zero", "suppressed": "value null; never reverse-engineered"},
        "recipes": recipes,
    }
    args.out.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    enabled = [r for r in recipes if r["enabled"]]
    print(f"wrote {args.out} recipes={len(recipes)} enabled={len(enabled)} selectors={sum(len(r['release_options']) for r in enabled)}")


if __name__ == "__main__":
    main()
