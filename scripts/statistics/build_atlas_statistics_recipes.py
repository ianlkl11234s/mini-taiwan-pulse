#!/usr/bin/env python3
"""Build the six atlas statistics families (src/data/<family>StatisticsRecipes.json) from the analytics atlas delivery.

Inputs (taipei-gis-analytics atlas worktree, read-only):
  --recipes  docs/handoff/atlas-statistics-recipes.json
             (66 indicator recipes, 2,278 exact release selectors with dimensions; already identical to R2 current).
  --root     analytics worktree root; each option's `bundle_path` (relative to it) gives the exact period, boundary,
             publisher, license, source URLs, observed statuses and dimension labels per release.

The delivery carries no presentation, so this script owns it: family, layer_key (20 recipes arrive without one),
sidebar group / toggle, fixed breaks (latest-year distribution, not re-fitted per period), per-dimension scales,
colour direction, status legend labels and location semantics. Values, periods and sources always come from the
release bundles. Every option is cross-checked against its bundle (dataset / indicator / unit / period / boundary /
level / dimensions); statuses without a legend label abort the build.

Usage:
  python3 scripts/statistics/build_atlas_statistics_recipes.py \
    --recipes <analytics WT>/docs/handoff/atlas-statistics-recipes.json --root <analytics WT>
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parents[2] / "src/data"

BOUNDARY = "縣市以內政部 114 年 3 月縣市界顯示、鄉鎮以內政部 114 年 3 月鄉鎮市區界顯示；不代表歷史邊界、不做面積重分配。"
NO_ZERO_FILL = "無資料、不適用與遮蔽都不是 0。"
MISSING = "無資料（來源未列，不是 0）"

# ── family → Layers 目錄主題（manifest section）與預設色系 ───────────────────────────────
FAMILIES = {
    "health": {"file": "healthStatisticsRecipes", "data_theme": "疾病與健康統計 Disease & Health Statistics"},
    "fiscal": {"file": "fiscalStatisticsRecipes", "data_theme": "財稅與消費統計 Fiscal & Consumption Statistics"},
    "indigenousRural": {"file": "indigenousRuralStatisticsRecipes", "data_theme": "原民與農村統計 Indigenous & Rural Statistics"},
    "sports": {"file": "sportsStatisticsRecipes", "data_theme": "體育統計 Sports Statistics"},
    "hazard": {"file": "hazardStatisticsRecipes", "data_theme": "災害風險統計 Disaster Risk Statistics"},
    "marine": {"file": "marineStatisticsRecipes", "data_theme": "海洋統計 Marine Statistics"},
}

# Statistics 分頁主題（layerPanels STATISTICS_MACRO_GROUPS）
TAB_HEALTH = "醫療與長照 Health & Care"
TAB_POPULATION = "人口與教育 Population & Education"
TAB_AGRI = "農林漁牧 Agriculture, Forestry & Fisheries"
TAB_FISCAL = "財稅與消費 Fiscal & Consumption"
TAB_SPORTS = "體育運動 Sports"
TAB_HAZARD = "災害風險 Disaster Risk"
TAB_MARINE = "海洋 Marine"

# dataset → (family, 中文位置口徑（依 bundle parameters／dataset description；未說明者明寫未說明）, 來源資料集標題)
DATASETS: dict[str, tuple[str, str, str]] = {
    "disease_tb_county": ("health", "疾管署縣市別統計；來源未說明縣市歸屬是居住地或通報地", "結核病縣市別新案發生數與死亡數（data.gov.tw 44814／44851）"),
    "disease_tb_township": ("health", "個案居住地鄉鎮市區（鄉鎮名已由來源回溯為現行行政區）", "結核病鄉鎮市區新案發生數與發生率（data.gov.tw 127880／44856）"),
    "cancer_incidence_county": ("health", "個案居住縣市（依診斷年）；全國另含居住地不詳個案", "癌症登記縣市別發生統計（data.gov.tw 6399）"),
    "cancer_screening_county": ("health", "個案戶籍縣市", "國民健康署癌症篩檢率"),
    "birth_health_county": ("health", "產婦現住地縣市（出生通報；與戶政出生登記口徑不同）", "國民健康署出生通報統計"),
    "immunization_coverage_county": ("health", "各縣市衛生所及合約院所接種統計；應接種世代與截止日依疾管署定義", "疾病管制署常規疫苗接種完成率"),
    "health_utilization_county": ("health", "衛福部統計處縣市別統計；分母依統計處定義", "衛生福利部統計處醫療利用統計"),
    "local_gov_finance_county": ("fiscal", "縣市政府（地方政府財政主體）", "財政部國庫署縣市政府歲入歲出決算"),
    "income_tax_county": ("fiscal", "申報戶籍所在縣市（綜所稅申報地），非工作地", "財政部財政資訊中心綜合所得稅所得縣市別統計"),
    "vat_filing_county": ("fiscal", "營業人稅籍登記縣市（非實際營業／消費地）", "財政部財政資訊中心營業稅申報縣市別統計"),
    "credit_card_county": ("fiscal", "依指標：居民指標＝持卡人居住縣市；消費地指標＝交易發生縣市", "金管會銀行局縣市信用卡消費統計（聯合信用卡處理中心）"),
    "einvoice_b2c_county": ("fiscal", "開立發票營業人所在縣市", "縣市電子發票 B2C 開立資料集（data.gov.tw 36858）"),
    "industry_census_county": ("fiscal", "場所單位（工廠、店面、營業處所）所在縣市", "行政院主計總處工業及服務業普查"),
    "bank_deposits_loans_county": ("fiscal", "金融機構分支單位所在縣市（非存戶居住地）", "金管會銀行局金融機構存放款餘額按縣市別"),
    "indigenous_reserved_land_county": ("indigenousRural", "保留地所在縣市（地政事務所註記），非權利人戶籍地", "原住民族委員會原住民保留地筆數與面積"),
    "rural_regen_training_county": ("indigenousRural", "參與社區所在縣市", "農村發展及水土保持署農村再生培根計畫累計社區數"),
    "sports_funding_percapita_county": ("sports", "縣市政府體育運動經費；人口口徑為運動部檔內總人口數", "運動部縣市體育運動經費"),
    "sports_participation_survey_county": ("sports", "受訪者居住縣市（抽樣調查推估）", "運動部運動現況調查"),
    "debris_flow_alerts_county": ("hazard", "被發布警戒的土石流潛勢溪流所在縣市", "土石流警戒發布紀錄（data.gov.tw 156617）"),
    "social_vulnerability_county": ("hazard", "縣市（跨 22 縣市標準化的相對位置）", "縣市社會脆弱度評估（data.gov.tw 130018）"),
    "marine_stranding_county": ("marine", "擱淺發現地縣市", "海洋保育署鯨豚、海龜擱淺統計（data.gov.tw 171188／171189）"),
    "marine_debris_cleanup_county": ("marine", "清理所在縣市（地方政府填報）", "海洋保育署海洋廢棄物清理統計（data.gov.tw 172912）"),
}

STATUS = {
    # dataset → status → legend label（只列會出現的；未列的狀態出現時 build 失敗）
    "debris_flow_alerts_county": {"not_applicable": "不適用：無土石流潛勢溪流（不是 0）"},
    "indigenous_reserved_land_county": {"not_applicable": "不適用：無原住民保留地（不是 0）"},
    "marine_stranding_county": {"not_applicable": "不適用：非臨海縣市（不是 0）"},
    "marine_debris_cleanup_county": {"not_applicable": "不適用：非臨海縣市（不是 0）"},
    "health_utilization_county": {"not_applicable": "不適用：無此類病床（不是 0）"},
    "einvoice_b2c_county": {"suppressed": "未涵蓋：來源刪除（營業人少於 5 家），不是 0"},
    "social_vulnerability_county": {"missing": "無資料：來源標示「-」（不是 0）"},
}

# (dataset, indicator) → (layer_key, group, group_label, option_label, subgroup, tab_theme, visual_theme, decimals, breaks,
#                         derived, default dimensions, extra disclosure, display note)
P = dict
PRESENTATION: dict[tuple[str, str], dict] = {
    # ── 疾病與健康 ──
    ("disease_tb_county", "tb_new_cases"): P(key="statsHealthTbNewCases", group="tbNewCases", group_label="結核病新案", option="縣市・新案數", sub="傳染病", tab=TAB_HEALTH, vis="health", dec=0, breaks=[100, 200, 400, 600, 1000]),
    ("disease_tb_county", "tb_new_cases_per_100k_hrp"): P(key="statsHealthTbNewCasesPer100kHrp", group="tbNewCases", group_label="結核病新案", option="縣市・每十萬人口（衍生）", sub="傳染病", tab=TAB_HEALTH, vis="health", dec=1, breaks=[15, 20, 25, 30, 40], derived=True,
        extra="新案數 ÷ 同年 12 月底戶籍人口（本站衍生）；疾管署年報率可能用年中人口，數值可能略異。"),
    ("disease_tb_township", "tb_new_cases"): P(key="statsHealthTbNewCasesTownship", group="tbNewCases", group_label="結核病新案", option="鄉鎮・新案數", sub="傳染病", tab=TAB_HEALTH, vis="health", dec=0, breaks=[5, 10, 20, 40]),
    ("disease_tb_township", "tb_incidence_per_100k"): P(key="statsHealthTbIncidencePer100kTownship", group="tbNewCases", group_label="結核病新案", option="鄉鎮・發生率（每十萬人口）", sub="傳染病", tab=TAB_HEALTH, vis="health", dec=1, breaks=[10, 20, 30, 50, 80],
        extra="小鄉鎮病例少，率年波動大，宜看多年。"),
    ("disease_tb_county", "tb_deaths"): P(key="statsHealthTbDeaths", group="tbDeaths", group_label="結核病死亡", option="死亡數", sub="傳染病", tab=TAB_HEALTH, vis="health", dec=0, breaks=[10, 30, 60, 100]),
    ("disease_tb_county", "tb_death_rate_per_100k"): P(key="statsHealthTbDeathRate", group="tbDeaths", group_label="結核病死亡", option="死亡率（每十萬人口）", sub="傳染病", tab=TAB_HEALTH, vis="health", dec=2, breaks=[1, 2, 3, 5]),
    ("cancer_incidence_county", "cancer_new_cases"): P(key="statsHealthCancerNewCases", group="cancerIncidence", group_label="癌症發生", option="新發生數（全癌症）", sub="癌症", tab=TAB_HEALTH, vis="health", dec=0, breaks=[1000, 3000, 8000, 15000]),
    ("cancer_incidence_county", "cancer_incidence_asr"): P(key="statsHealthCancerIncidenceAsr", group="cancerIncidence", group_label="癌症發生", option="年齡標準化發生率", sub="癌症", tab=TAB_HEALTH, vis="health", dec=1, breaks=[250, 300, 350, 400],
        dims={"sex": "all", "site": "all_sites"}),
    ("cancer_incidence_county", "cancer_incidence_crude"): P(key="statsHealthCancerIncidenceCrude", group="cancerIncidence", group_label="癌症發生", option="粗發生率", sub="癌症", tab=TAB_HEALTH, vis="health", dec=1, breaks=[400, 500, 600, 700],
        dims={"sex": "all", "site": "all_sites"}),
    ("cancer_screening_county", "breast_screening_rate_2yr"): P(key="statsHealthBreastScreening2yr", group="cancerScreening", group_label="癌症篩檢率", option="乳癌（45–69 歲婦女兩年內）", sub="癌症篩檢", tab=TAB_HEALTH, vis="health", dec=1, breaks=[30, 35, 40, 45, 50]),
    ("cancer_screening_county", "cervical_screening_rate_3yr"): P(key="statsHealthCervicalScreening3yr", group="cancerScreening", group_label="癌症篩檢率", option="子宮頸癌（30–69 歲婦女三年內）", sub="癌症篩檢", tab=TAB_HEALTH, vis="health", dec=1, breaks=[30, 35, 40, 45, 50]),
    ("cancer_screening_county", "colorectal_screening_rate_2yr"): P(key="statsHealthColorectalScreening2yr", group="cancerScreening", group_label="癌症篩檢率", option="大腸癌（50–74 歲兩年內）", sub="癌症篩檢", tab=TAB_HEALTH, vis="health", dec=1, breaks=[30, 35, 40, 45, 50]),
    ("birth_health_county", "live_births_by_mother_residence"): P(key="statsHealthLiveBirthsMotherResidence", group="liveBirths", group_label="活產新生兒數", option="活產數", sub="出生健康", tab=TAB_HEALTH, vis="health", dec=0, breaks=[1000, 5000, 10000, 20000],
        extra="與戶政出生登記（人口統計「出生數」）口徑不同，不可並列相減。"),
    ("birth_health_county", "low_birth_weight_rate"): P(key="statsHealthLowBirthWeightRate", group="lowBirthWeight", group_label="低出生體重率", option="低出生體重率", sub="出生健康", tab=TAB_HEALTH, vis="health", dec=2, breaks=[10, 10.5, 11, 11.5, 12],
        dims={"sex": "all"}),
    ("birth_health_county", "birth_sex_ratio"): P(key="statsHealthBirthSexRatio", group="birthSexRatio", group_label="出生性別比", option="出生性別比", sub="出生健康", tab=TAB_HEALTH, vis="health", dec=1, breaks=[104, 106, 108, 110],
        note="自然出生性別比約 105；小縣市出生數少，比值年波動大。"),
    ("immunization_coverage_county", "immunization_completion_rate"): P(key="statsHealthImmunizationCompletion", group="immunization", group_label="常規疫苗接種完成率", option="接種完成率", sub="疫苗", tab=TAB_HEALTH, vis="health", dec=2, breaks=[97, 98, 98.5, 99],
        dims={"vaccine": "mmr_1"}),
    ("health_utilization_county", "outpatient_visit_rate_per_100k"): P(key="statsHealthOutpatientVisitRate", group="outpatientVisit", group_label="健保門診就診率", option="門診就診率", sub="醫療利用", tab=TAB_HEALTH, vis="health", dec=0, breaks=[95000, 95500, 96000, 96500],
        note="縣市差距很小（約 9.3–9.8 萬／十萬人），門檻刻意取窄。"),
    ("health_utilization_county", "mental_outpatient_per_1000"): P(key="statsHealthMentalOutpatientPer1000", group="mentalOutpatient", group_label="精神疾病門診", option="每千人口門診件數", sub="醫療利用", tab=TAB_HEALTH, vis="health", dec=0, breaks=[600, 650, 700, 750],
        dims={"disease": "all_mental"}),
    ("health_utilization_county", "hospital_alos_days"): P(key="statsHealthHospitalAlos", group="hospitalAlos", group_label="醫院平均住院日數", option="平均住院日數", sub="醫療利用", tab=TAB_HEALTH, vis="health", dec=2, breaks=[6, 7, 8, 9, 10],
        dims={"bed_type": "general_total"}),
    # ── 財稅與消費 ──
    ("local_gov_finance_county", "local_gov_revenue"): P(key="statsFiscalLocalRevenue", group="localFinance", group_label="縣市政府歲入歲出", option="歲入", sub="地方財政", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[25000, 50000, 100000, 150000],
        note="門檻換算：250 億／500 億／1,000 億／1,500 億元。"),
    ("local_gov_finance_county", "local_gov_expenditure"): P(key="statsFiscalLocalExpenditure", group="localFinance", group_label="縣市政府歲入歲出", option="歲出", sub="地方財政", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[25000, 50000, 100000, 150000],
        note="門檻換算：250 億／500 億／1,000 億／1,500 億元。"),
    ("income_tax_county", "income_tax_units"): P(key="statsIncomeTaxUnits", group="incomeTaxUnits", group_label="綜所稅納稅單位", option="納稅單位", sub="所得", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[50000, 100000, 300000, 700000]),
    ("income_tax_county", "income_total"): P(key="statsIncomeTaxTotal", group="incomeTaxTotal", group_label="綜合所得總額", option="所得總額", sub="所得", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[1e8, 2e8, 5e8, 8e8],
        note="門檻換算：1,000 億／2,000 億／5,000 億／8,000 億元。"),
    ("income_tax_county", "income_mean_per_unit"): P(key="statsIncomeTaxMean", group="incomePerUnit", group_label="每納稅單位所得", option="平均數", sub="所得", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[900, 1000, 1100, 1300]),
    ("income_tax_county", "income_median_per_unit"): P(key="statsIncomeTaxMedian", group="incomePerUnit", group_label="每納稅單位所得", option="中位數", sub="所得", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[680, 720, 780, 850]),
    ("income_tax_county", "income_q1_per_unit"): P(key="statsIncomeTaxQ1", group="incomePerUnit", group_label="每納稅單位所得", option="第一分位數", sub="所得", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[410, 430, 460, 500]),
    ("income_tax_county", "income_q3_per_unit"): P(key="statsIncomeTaxQ3", group="incomePerUnit", group_label="每納稅單位所得", option="第三分位數", sub="所得", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[1150, 1250, 1350, 1600]),
    ("vat_filing_county", "vat_declarers"): P(key="statsVatDeclarers", group="vatFiling", group_label="營業稅申報", option="申報家數", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[10000, 20000, 50000, 120000]),
    ("vat_filing_county", "vat_sales_total"): P(key="statsVatSales", group="vatFiling", group_label="營業稅申報", option="銷售額", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[2e11, 5e11, 1.5e12, 5e12],
        note="門檻換算：2,000 億／5,000 億／1.5 兆／5 兆元。"),
    ("vat_filing_county", "vat_tax_payable"): P(key="statsVatTaxPayable", group="vatFiling", group_label="營業稅申報", option="本年應實繳稅額", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[2e9, 5e9, 1.5e10, 5e10],
        note="門檻換算：20 億／50 億／150 億／500 億元。"),
    ("credit_card_county", "cc_resident_txn_amount"): P(key="statsCreditCardResidentAmount", group="creditCardResident", group_label="居民信用卡消費", option="消費金額", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[3e10, 6e10, 1.5e11, 4e11],
        note="門檻換算：300 億／600 億／1,500 億／4,000 億元。"),
    ("credit_card_county", "cc_resident_cross_county_amount"): P(key="statsCreditCardCrossCountyAmount", group="creditCardResident", group_label="居民信用卡消費", option="跨縣市消費金額", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[2e10, 5e10, 1e11, 3e11],
        note="門檻換算：200 億／500 億／1,000 億／3,000 億元。"),
    ("credit_card_county", "cc_resident_cross_county_share"): P(key="statsCreditCardCrossCountyShare", group="creditCardResident", group_label="居民信用卡消費", option="跨縣市消費占比", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=1, breaks=[75, 80, 85, 90]),
    ("credit_card_county", "cc_resident_cards_december"): P(key="statsCreditCardCards", group="creditCardResident", group_label="居民信用卡消費", option="持卡數（12 月）", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[250000, 500000, 1000000, 3000000]),
    ("credit_card_county", "cc_location_txn_amount"): P(key="statsCreditCardLocationAmount", group="creditCardLocation", group_label="信用卡消費地金額", option="消費地金額", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[1e10, 2e10, 5e10, 1.5e11],
        note="門檻換算：100 億／200 億／500 億／1,500 億元。"),
    ("einvoice_b2c_county", "einvoice_avg_ticket"): P(key="statsEinvoiceAvgTicket", group="einvoiceAvgTicket", group_label="電子發票平均客單價", option="平均客單價", sub="營業與消費", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[125, 135, 145, 155],
        dims={"industry": "便利商店"}),
    ("industry_census_county", "census_persons_engaged"): P(key="statsCensusPersonsEngaged", group="industryCensus", group_label="工商普查（場所單位）", option="年底從業員工人數", sub="普查", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[60000, 120000, 300000, 1000000]),
    ("industry_census_county", "census_employee_payroll"): P(key="statsCensusEmployeePayroll", group="industryCensus", group_label="工商普查（場所單位）", option="僱用員工全年薪資", sub="普查", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[3e7, 6e7, 1.5e8, 5e8],
        note="門檻換算：300 億／600 億／1,500 億／5,000 億元。"),
    ("industry_census_county", "census_establishments"): P(key="statsCensusEstablishments", group="industryCensus", group_label="工商普查（場所單位）", option="場所單位數", sub="普查", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[15000, 30000, 60000, 150000],
        extra="場所單位數只有 2016、2021 兩期。"),
    ("bank_deposits_loans_county", "bank_deposits_total"): P(key="statsBankDeposits", group="bankBalances", group_label="金融機構存放款餘額", option="存款餘額", sub="金融", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[3e5, 6e5, 1.5e6, 5e6],
        note="門檻換算：3,000 億／6,000 億／1.5 兆／5 兆元。"),
    ("bank_deposits_loans_county", "bank_loans_total"): P(key="statsBankLoans", group="bankBalances", group_label="金融機構存放款餘額", option="放款餘額", sub="金融", tab=TAB_FISCAL, vis="labor", dec=0, breaks=[1e5, 3e5, 6e5, 3e6],
        note="門檻換算：1,000 億／3,000 億／6,000 億／3 兆元。"),
    # ── 原民與農村 ──
    ("indigenous_reserved_land_county", "reserved_land_parcels"): P(key="statsIndigenousReservedLandParcels", group="reservedLand", group_label="原住民保留地", option="筆數", sub="原住民保留地", tab=TAB_POPULATION, vis="population", dec=0, breaks=[5000, 20000, 40000, 70000]),
    ("indigenous_reserved_land_county", "reserved_land_area_ha"): P(key="statsIndigenousReservedLandArea", group="reservedLand", group_label="原住民保留地", option="面積（公頃）", sub="原住民保留地", tab=TAB_POPULATION, vis="population", dec=1, breaks=[5000, 15000, 30000, 50000]),
    ("rural_regen_training_county", "rural_regen_training_communities"): P(key="statsRuralRegenTraining", group="ruralRegenTraining", group_label="農村再生培根累計社區數", option="累計社區數", sub="農村再生", tab=TAB_AGRI, vis="agriculture", dec=0, breaks=[25, 75, 150, 250]),
    # ── 體育 ──
    ("sports_funding_percapita_county", "sports_budget_total"): P(key="statsSportsBudgetTotal", group="sportsBudget", group_label="體育運動經費", option="經費總額", sub="體育經費", tab=TAB_SPORTS, vis="education", dec=0, breaks=[1e8, 3e8, 6e8, 1.5e9],
        note="門檻換算：1 億／3 億／6 億／15 億元。"),
    ("sports_funding_percapita_county", "sports_budget_per_capita"): P(key="statsSportsBudgetPerCapita", group="sportsBudget", group_label="體育運動經費", option="每人平均", sub="體育經費", tab=TAB_SPORTS, vis="education", dec=0, breaks=[400, 600, 900, 1500],
        note="連江縣人口少，每人經費為離群值，落在最深一級。"),
    ("sports_participation_survey_county", "exercise_participation_rate"): P(key="statsExerciseParticipationRate", group="exerciseSurvey", group_label="運動現況調查", option="有運動比例", sub="運動參與", tab=TAB_SPORTS, vis="education", dec=1, breaks=[78, 80, 82, 85]),
    ("sports_participation_survey_county", "regular_exercise_rate"): P(key="statsRegularExerciseRate", group="exerciseSurvey", group_label="運動現況調查", option="規律運動比例", sub="運動參與", tab=TAB_SPORTS, vis="education", dec=1, breaks=[33, 35, 37, 39]),
    # ── 災害風險（20 個新命名 key 之一部分） ──
    ("debris_flow_alerts_county", "debris_alert_stream_events"): P(key="statsDebrisFlowAlertStreamsCounty", group="debrisFlowAlerts", group_label="土石流警戒發布溪流次數", option="黃＋紅色警戒", sub="土石流警戒", tab=TAB_HAZARD, vis="environment", dec=0, breaks=[1, 25, 100, 200, 300],
        extra="潛勢溪流數逐年增加、警戒基準值會調整，次數不等於降雨強度。"),
    ("debris_flow_alerts_county", "debris_red_alert_stream_events"): P(key="statsDebrisFlowRedAlertStreamsCounty", group="debrisFlowAlerts", group_label="土石流警戒發布溪流次數", option="紅色警戒", sub="土石流警戒", tab=TAB_HAZARD, vis="environment", dec=0, breaks=[1, 25, 50, 100, 150],
        extra="潛勢溪流數逐年增加、警戒基準值會調整，次數不等於降雨強度。"),
    ("social_vulnerability_county", "svi_composite_z"): P(key="statsSocialVulnerabilityCompositeCounty", group="socialVulnerability", group_label="社會脆弱度", option="綜合指標", sub="社會脆弱度", tab=TAB_HAZARD, vis="environment", dec=2, breaks=[-0.4, -0.2, 0, 0.2, 0.4],
        scale_note="淺 → 深：較不脆弱 → 較脆弱（Z 分數，0 為 22 縣市平均）"),
    ("social_vulnerability_county", "svi_exposure_z"): P(key="statsSocialVulnerabilityExposureCounty", group="socialVulnerability", group_label="社會脆弱度", option="暴露量構面", sub="社會脆弱度", tab=TAB_HAZARD, vis="environment", dec=2, breaks=[-0.4, -0.2, 0, 0.2, 0.4],
        scale_note="淺 → 深：暴露量較低 → 較高（Z 分數，0 為 22 縣市平均）"),
    ("social_vulnerability_county", "svi_mitigation_z"): P(key="statsSocialVulnerabilityMitigationCounty", group="socialVulnerability", group_label="社會脆弱度", option="減災整備構面", sub="社會脆弱度", tab=TAB_HAZARD, vis="environment", dec=2, breaks=[-0.4, -0.2, 0, 0.2, 0.4], direction="descending",
        scale_note="色階反轉：深 → 淺＝能力較弱 ← → 能力較強（Z 分數，0 為 22 縣市平均）"),
    ("social_vulnerability_county", "svi_response_z"): P(key="statsSocialVulnerabilityResponseCounty", group="socialVulnerability", group_label="社會脆弱度", option="應變能力構面", sub="社會脆弱度", tab=TAB_HAZARD, vis="environment", dec=2, breaks=[-0.4, -0.2, 0, 0.2, 0.4], direction="descending",
        scale_note="色階反轉：深 → 淺＝能力較弱 ← → 能力較強（Z 分數，0 為 22 縣市平均）"),
    ("social_vulnerability_county", "svi_recovery_z"): P(key="statsSocialVulnerabilityRecoveryCounty", group="socialVulnerability", group_label="社會脆弱度", option="復原能力構面", sub="社會脆弱度", tab=TAB_HAZARD, vis="environment", dec=2, breaks=[-0.4, -0.2, 0, 0.2, 0.4], direction="descending",
        scale_note="色階反轉：深 → 淺＝能力較弱 ← → 能力較強（Z 分數，0 為 22 縣市平均）"),
    ("social_vulnerability_county", "svi_subindicator_z"): P(key="statsSocialVulnerabilitySubindicatorCounty", group="socialVulnerabilitySub", group_label="社會脆弱度子指標", option="子指標", sub="社會脆弱度", tab=TAB_HAZARD, vis="environment", dec=2, breaks=[-1, -0.5, 0, 0.5, 1],
        dims={"sub_indicator": "si01"}, svi_sub=True),
    # ── 海洋 ──
    ("marine_stranding_county", "cetacean_stranded"): P(key="statsCetaceanStrandedCounty", group="cetaceanStranded", group_label="鯨豚擱淺", option="總數", sub="海洋動物擱淺", tab=TAB_MARINE, vis="fishery", dec=0, breaks=[1, 5, 10, 20]),
    ("marine_stranding_county", "cetacean_stranded_alive"): P(key="statsCetaceanStrandedAliveCounty", group="cetaceanStranded", group_label="鯨豚擱淺", option="活體", sub="海洋動物擱淺", tab=TAB_MARINE, vis="fishery", dec=0, breaks=[1, 2, 4]),
    ("marine_stranding_county", "cetacean_stranded_dead"): P(key="statsCetaceanStrandedDeadCounty", group="cetaceanStranded", group_label="鯨豚擱淺", option="死亡", sub="海洋動物擱淺", tab=TAB_MARINE, vis="fishery", dec=0, breaks=[1, 5, 10, 20]),
    ("marine_stranding_county", "sea_turtle_stranded"): P(key="statsSeaTurtleStrandedCounty", group="seaTurtleStranded", group_label="海龜擱淺", option="總數", sub="海洋動物擱淺", tab=TAB_MARINE, vis="fishery", dec=0, breaks=[1, 10, 30, 60]),
    ("marine_stranding_county", "sea_turtle_stranded_alive"): P(key="statsSeaTurtleStrandedAliveCounty", group="seaTurtleStranded", group_label="海龜擱淺", option="活體", sub="海洋動物擱淺", tab=TAB_MARINE, vis="fishery", dec=0, breaks=[1, 10, 30, 60]),
    ("marine_stranding_county", "sea_turtle_stranded_dead"): P(key="statsSeaTurtleStrandedDeadCounty", group="seaTurtleStranded", group_label="海龜擱淺", option="死亡", sub="海洋動物擱淺", tab=TAB_MARINE, vis="fishery", dec=0, breaks=[1, 10, 30, 60]),
    ("marine_debris_cleanup_county", "marine_debris_cleaned_tonnes"): P(key="statsMarineDebrisCleanedTonnesCounty", group="marineDebrisCleanup", group_label="海洋廢棄物清理", option="清理量（噸）", sub="海洋廢棄物", tab=TAB_MARINE, vis="fishery", dec=1, breaks=[100, 300, 1000, 2000],
        extra="清理量不等於產生量，受海岸線長度與清理人力影響。"),
    ("marine_debris_cleanup_county", "marine_debris_fishing_gear_tonnes"): P(key="statsMarineDebrisFishingGearTonnesCounty", group="marineDebrisCleanup", group_label="海洋廢棄物清理", option="廢漁具漁網（噸）", sub="海洋廢棄物", tab=TAB_MARINE, vis="fishery", dec=2, breaks=[1, 5, 20, 100],
        extra="清理量不等於產生量，受海岸線長度與清理人力影響。"),
    ("marine_debris_cleanup_county", "marine_debris_cleanup_operations"): P(key="statsMarineDebrisCleanupOperationsCounty", group="marineDebrisCleanup", group_label="海洋廢棄物清理", option="清理次數", sub="海洋廢棄物", tab=TAB_MARINE, vis="fishery", dec=0, breaks=[500, 1500, 3000, 6000]),
    ("marine_debris_cleanup_county", "marine_debris_cleanup_participants"): P(key="statsMarineDebrisCleanupParticipantsCounty", group="marineDebrisCleanup", group_label="海洋廢棄物清理", option="參與人次", sub="海洋廢棄物", tab=TAB_MARINE, vis="fishery", dec=0, breaks=[3000, 8000, 15000, 25000]),
}

SEX_LABELS = {"all": "全部", "male": "男", "female": "女"}
DIMENSION_LABELS = {"sex": "性別", "site": "癌別", "vaccine": "疫苗劑次", "disease": "疾病別", "bed_type": "病床別", "industry": "行業", "sub_indicator": "子指標"}
SVI_DIMENSION = {"exposure": "暴露量", "mitigation": "減災整備", "response": "應變能力", "recovery": "復原能力"}


def tidy(values: list[float]) -> list[float | int]:
    """Integral thresholds serialise as integers (1e8 → 100000000, not 100000000.0)."""
    return [int(value) if float(value).is_integer() else value for value in values]


def nice_breaks(values: list[float], count: int = 4) -> list[float]:
    """Fixed thresholds for a non-default dimension tuple: rounded inner quantiles of the latest year (once, not per period)."""
    ordered = sorted(values)
    if len(ordered) < 3:
        return []
    def quantile(p: float) -> float:
        i = (len(ordered) - 1) * p
        lo = math.floor(i)
        hi = min(lo + 1, len(ordered) - 1)
        return ordered[lo] + (ordered[hi] - ordered[lo]) * (i - lo)
    raw = [quantile((i + 1) / (count + 1)) for i in range(count)]
    span = max(raw) - min(raw) or abs(max(raw)) or 1
    step = 10 ** math.floor(math.log10(span / count))
    for factor in (1, 2, 2.5, 5, 10):
        if span / (step * factor) <= count * 2:
            step *= factor
            break
    out: list[float] = []
    for value in raw:
        rounded = round(round(value / step) * step, 6)
        if rounded == 0 and min(ordered) >= 0:
            rounded = round(step, 6)
        if not out or rounded > out[-1]:
            out.append(rounded)
    return out if len(out) >= 2 else []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipes", required=True, type=Path)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()
    delivered = json.loads(args.recipes.read_text())["recipes"]
    keys = {(layer["dataset_id"], layer["indicator_id"]) for layer in delivered}
    if set(PRESENTATION) != keys:
        raise SystemExit(f"presentation keys differ from delivery: {sorted(set(PRESENTATION) ^ keys)}")
    for layer in delivered:
        given = layer["layer_key"]
        mine = PRESENTATION[(layer["dataset_id"], layer["indicator_id"])]["key"]
        if given and given != mine:
            raise SystemExit(f"{layer['indicator_id']}: delivered layer_key {given} != {mine}")
    all_keys = [spec["key"] for spec in PRESENTATION.values()]
    if len(set(all_keys)) != len(all_keys):
        raise SystemExit("duplicate layer keys")

    families: dict[str, list[dict]] = defaultdict(list)
    report: list[str] = []
    order = list(PRESENTATION)
    for layer in sorted(delivered, key=lambda item: order.index((item["dataset_id"], item["indicator_id"]))):
        spec = PRESENTATION[(layer["dataset_id"], layer["indicator_id"])]
        family, location_semantics, source_title = DATASETS[layer["dataset_id"]]
        dim_keys = list(layer["dimension_keys"])
        options, receipts, statuses, zero, meta = [], [], Counter(), 0, None
        dim_values: dict[str, list[str]] = {key: [] for key in dim_keys}
        dim_labels: dict[str, dict[str, str]] = {key: {} for key in dim_keys}
        latest_end = max(option["period_end"] for option in layer["release_options"])
        latest_values: dict[str, list[float]] = defaultdict(list)
        svi_meta = None
        for option in layer["release_options"]:
            release_id = option["release_id"]
            body = json.loads((args.root / option["bundle_path"]).read_text())
            release = body["release"]
            if (body["dataset"]["id"] != layer["dataset_id"] or body["indicator"]["id"] != layer["indicator_id"]
                    or body["indicator"]["unit"] != layer["unit"] or release["id"] != release_id):
                raise SystemExit(f"{spec['key']}: {release_id} does not match dataset/indicator/unit/id")
            if (release["period_start"], release["period_end"]) != (option["period_start"], option["period_end"]):
                raise SystemExit(f"{spec['key']}: {release_id} period differs from the delivered option")
            if release["boundary_version"] != layer["boundary_version"]:
                raise SystemExit(f"{spec['key']}: {release_id} boundary differs")
            if set(option["dimensions"]) != set(dim_keys):
                raise SystemExit(f"{spec['key']}: {release_id} dimension keys differ")
            mine = [obs for obs in body["observations"] if obs["dimensions"] == option["dimensions"]]
            if not mine or {obs["area_level"] for obs in mine} != {layer["level"]}:
                raise SystemExit(f"{spec['key']}: {release_id} has no observations at {layer['level']} for {option['dimensions']}")
            statuses.update(obs["status"] for obs in mine)
            zero += sum(1 for obs in mine if obs["status"] == "observed" and obs["value"] == 0)
            if option["period_end"] == latest_end:
                tuple_key = "|".join(option["dimensions"][key] for key in dim_keys)
                latest_values[tuple_key] += [obs["value"] for obs in mine if obs["status"] == "observed" and obs["value"] is not None]
            meta = meta or body
            params = release["provenance"]["processing"].get("parameters") or {}
            labels = params.get("dimension_labels") or {}
            for key in dim_keys:
                value = option["dimensions"][key]
                if value not in dim_values[key]:
                    dim_values[key].append(value)
                if len(dim_keys) == 1 and value in labels:
                    dim_labels[key][value] = labels[value]
            if len(dim_keys) == 2 and labels:
                # cancer：合併鍵 "sex|site" → 「癌別（性別）」；拆出癌別名稱
                tuple_key = "|".join(option["dimensions"][key] for key in dim_keys)
                if tuple_key in labels:
                    site_label = labels[tuple_key].rsplit("（", 1)[0]
                    dim_labels[dim_keys[1]][option["dimensions"][dim_keys[1]]] = site_label
            if spec.get("svi_sub"):
                svi_meta = svi_meta or params.get("sub_indicator_meta")
            options.append({"release_id": release_id, "period_start": option["period_start"], "period_end": option["period_end"], "dimensions": option["dimensions"]})
            receipts.append({"release_id": release_id, "raw_sha256": release["raw_sha256"], "method_version": release["method_version"], "retrieved_at": release["retrieved_at"]})
        assert meta is not None
        status_labels = {"missing": MISSING, **STATUS.get(layer["dataset_id"], {})}
        unexpected = set(statuses) - {"observed"} - set(status_labels)
        if unexpected:
            raise SystemExit(f"{spec['key']}: statuses {sorted(unexpected)} have no legend label")
        status_labels = {kind: label for kind, label in status_labels.items() if statuses.get(kind)}
        breaks = tidy(spec["breaks"])
        if breaks == [0] or sorted(set(breaks)) != breaks or len(breaks) < 2:
            raise SystemExit(f"{spec['key']}: breaks must be strictly increasing, ≥2 and not [0]")

        # dimensions：標籤（bundle → 性別通用 → 原值）與預設
        default_dims = spec.get("dims", {})
        if set(default_dims) != set(dim_keys):
            raise SystemExit(f"{spec['key']}: default dims {default_dims} vs keys {dim_keys}")
        dimensions = []
        for key in dim_keys:
            values = dim_values[key]
            if default_dims[key] not in values:
                raise SystemExit(f"{spec['key']}: default {key}={default_dims[key]} not delivered")
            def label_of(value: str, key: str = key) -> str:
                if key == "sex":
                    return SEX_LABELS[value]
                if key == "industry":
                    return value  # 來源值本身就是中文行業名
                if value not in dim_labels[key]:
                    raise SystemExit(f"{spec['key']}: no label for {key}={value}")
                return dim_labels[key][value]
            ordered = [default_dims[key]] + sorted((v for v in values if v != default_dims[key]), key=lambda v: (label_of(v) if key != "sub_indicator" else v))
            if key == "sub_indicator":
                ordered = sorted(values)
            dimensions.append({"key": key, "label": DIMENSION_LABELS[key], "default": default_dims[key],
                               "options": [{"value": value, "label": label_of(value)} for value in ordered]})
        default_tuple = "|".join(default_dims[key] for key in dim_keys)
        direction = spec.get("direction", "ascending")

        # 非預設維度組合：各自一組固定門檻（最新一年分布，算一次、不隨期別重算）；子指標依脆弱度正負號決定方向。
        by_dimension: dict[str, dict] | None = None
        dimension_notes: dict[str, str] | None = None
        if dim_keys:
            by_dimension = {}
            for tuple_key, values in sorted(latest_values.items()):
                if tuple_key == default_tuple and not spec.get("svi_sub"):
                    continue
                if spec.get("svi_sub"):
                    sign = svi_meta[tuple_key]["vulnerability_sign"]
                    by_dimension[tuple_key] = {"breaks": breaks, "direction": "ascending" if sign == "+" else "descending"}
                    continue
                tuple_breaks = nice_breaks(values)
                if tuple_breaks:
                    by_dimension[tuple_key] = {"breaks": tidy(tuple_breaks), "direction": direction}
            if spec.get("svi_sub"):
                dimension_notes = {}
                for code, item in sorted(svi_meta.items()):
                    basis = "依 NCDR 簡報" if item["basis"] == "ncdr_slide" else "方向為推論，非來源明文"
                    toward = "值越高越脆弱（色階：淺 → 深＝較不脆弱 → 較脆弱）" if item["vulnerability_sign"] == "+" else "值越高越不脆弱（色階反轉：深＝較脆弱）"
                    dimension_notes[code] = f"所屬構面：{SVI_DIMENSION[item['dimension']]}；{toward}；{basis}。"
                missing_tuples = {o["dimensions"]["sub_indicator"] for o in options} - set(by_dimension)
                if missing_tuples:
                    raise SystemExit(f"{spec['key']}: sub-indicators without direction {sorted(missing_tuples)}")
            if spec.get("svi_sub"):
                default_direction = by_dimension[default_tuple]["direction"]
                if default_direction != direction:
                    direction = default_direction
        for tuple_key, values in sorted(latest_values.items()):
            scale = (by_dimension or {}).get(tuple_key, {"breaks": breaks})["breaks"]
            if values:
                report.append(f"{spec['key']:44} {tuple_key[:24]:24} n={len(values):3} min={min(values):.4g} max={max(values):.4g} breaks={scale}")

        release = meta["release"]
        default = sorted(options, key=lambda o: (o["period_end"], o["period_start"], o["dimensions"] == default_dims), reverse=True)[0]
        if default["dimensions"] != default_dims:
            raise SystemExit(f"{spec['key']}: latest period lacks the default dimensions tuple")
        zero_note = "最淺色含 0（來源明列 0，不是無資料）。" if zero else None
        is_svi = layer["dataset_id"] == "social_vulnerability_county"
        families[family].append({
            "layer_key": spec["key"], "enabled": True, "family": family, "label": layer["label"],
            "group": spec["group"], "group_label": spec["group_label"], "option_label": spec["option"],
            "subgroup": spec["sub"], "data_theme": FAMILIES[family]["data_theme"], "tab_theme": spec["tab"],
            "visual_theme": spec["vis"],
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": layer["level"],
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": meta["indicator"]["aggregation"],
            "default_release_id": default["release_id"],
            "dimensions": dimensions,
            "release_options": options,
            "legend": {
                "method": "fixed_breaks", "breaks": breaks, "direction": direction,
                "scale_note": spec.get("scale_note") or ("子指標為未反向的原始 Z 分數；色階方向依所選子指標的脆弱度正負號（見說明）。" if spec.get("svi_sub") else None),
                "zero_note": None if is_svi else zero_note,
                "display_note": spec.get("note"),
                "by_dimension": by_dimension or None,
                "dimension_notes": dimension_notes,
            },
            "status_labels": status_labels,
            "format": {"locale": "zh-TW", "maximumFractionDigits": spec["dec"]},
            "derived": bool(spec.get("derived")),
            "location_semantics": location_semantics,
            "disclosure": f"{layer['disclosure']}{spec.get('extra', '')}{NO_ZERO_FILL}{BOUNDARY}",
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": source_title,
            "delivery": {"observed_statuses": dict(sorted(statuses.items())), "observed_zero": zero, "receipts": receipts},
        })

    for family, recipes in families.items():
        document = {
            "version": 1,
            "scope": "production_r2",
            "family": family,
            "generated_from": {"recipes": args.recipes.name, "bundles": "taipei-gis-analytics atlas batch release bundles (bundle_path per option)"},
            "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
            "observation_policy": {"observed_zero": "status observed and value 0", "missing": "value null; source did not list; no zero fill", "not_applicable": "value null; indicator does not apply to the area", "suppressed": "value null; source removed the cell"},
            "recipes": recipes,
        }
        out = args.out_dir / f"{FAMILIES[family]['file']}.json"
        out.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"wrote {out.name} recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))


if __name__ == "__main__":
    main()
