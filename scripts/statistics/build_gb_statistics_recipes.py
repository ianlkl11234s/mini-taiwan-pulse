#!/usr/bin/env python3
"""Build the UK (GB) local-authority statistics family from the analytics handoff recipes.

Input (taipei-gis-analytics, read-only):
  --handoff  docs/handoff/gb-statistics-recipes.json（18 recipes, level gb_lad, 100 releases）
             docs/handoff/gb-statistics-recipes-crops.json（4 recipes，英格蘭 June Survey 作物，2026-10-29 第 12 波）
             可重複傳多份，合併成同一個 gb 家族。
  --root     analytics checkout whose data/processed/<theme>/<dataset_id>/releases/<release_id>.json holds the bundles.

Output: src/data/gbStatisticsRecipes.json（atlas recipe schema, src/data/atlasStatisticsTypes.ts; family "gb", country "GB"）.

The handoff carries the data contract (dataset／indicator／boundary／release selectors／source／licence／attribution) and
draft presentation. This script owns the presentation: sidebar group／option labels, the GB statistics themes, curated
legend notes (user-facing, no internal tokens), status legend labels pruned to the statuses that actually occur, and the
fixed breaks. Every option is cross-checked against its bundle (dataset／indicator／unit／id／period／boundary／level and
361 unique gb_lad rows). Breaks differ from the draft only where noted in BREAK_OVERRIDES (reason recorded there).

Usage:
  python3 scripts/statistics/build_gb_statistics_recipes.py --root <analytics checkout> \
    --handoff <gb-statistics-recipes.json> <gb-statistics-recipes-crops.json>
  npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src/data/gbStatisticsRecipes.json"
AREA_COUNT = 361
LEVEL = "gb_lad"

# GB 統計主題：Statistics 分頁（tab）＝人口／社經／住宅；完整目錄（data）另一組名稱，避免與 tab 主題同身分。
# 農業（第 12 波作物）：tab「農業」對齊台灣統計「農林漁牧」的農業主題（英國只有作物面積，取短名）。
TAB = {"demographics": "人口", "socioeconomic": "社經", "real_estate": "住宅", "agriculture": "農業"}
DATA = {"demographics": "人口統計", "socioeconomic": "社經統計", "real_estate": "住宅統計", "agriculture": "農業統計"}
NATION_ZH = {"England": "英格蘭", "Wales": "威爾斯", "Scotland": "蘇格蘭", "Northern Ireland": "北愛爾蘭"}
NATION_ORDER = ["England", "Wales", "Scotland", "Northern Ireland"]

LOC_POP = "常住地所在地方行政區（LAD 2024 年界）"
LOC_RURAL = "居住地所在地方行政區（由普查小區分類彙整）"
LOC_DEPRIVATION = "小區所在地方行政區（由小區排名彙整）"
LOC_HPI = "房屋所在地方行政區（LAD 2026 年界）"
LOC_PIPR = "租賃住宅所在地方行政區（LAD 2026 年界）"

POP_METHOD = "英格蘭與威爾斯由 ONS 推估，蘇格蘭來自 NRS、北愛來自 NISRA，方法不同，跨國比較請保守。"
POP_ERROR = "距 2021 年普查越遠的年份，推估誤差越大。"
RURAL_DEF = "英格蘭、威爾斯與蘇格蘭的鄉村定義不同，分成兩個圖層，不可直接比較；北愛沒有地方行政區層級的官方鄉村人口比例。"
DEPRIVATION = "英國四地的剝奪指數方法、指標、年份都不同，各用各的圖例，不可跨國比較；排名只在本國內有意義。"
HPI_METHOD = "UK HPI 平均房價是混合調整指數換算的平均價，不是成交均價；成交量少的地區波動大。"
HPI_PERIOD = "每年取 8 月一期；北愛為季資料，2026-08 因第三季尚未發布標為無資料。"
HPI_SCILLY = "Isles of Scilly 在 UK HPI 併入 Cornwall，沒有獨立數值，標為無資料。"
PIPR_METHOD = "PIPR 是存量租約的平均月租，不是新租約開價；屬 ONS 開發中統計，日後可能修訂。"
PIPR_SCOPE = "蘇格蘭、北愛只有租屋市場區（BRMA）層級，不是地方行政區，因此未涵蓋。"
PIPR_MISSING = "City of London 與 Isles of Scilly 沒有獨立數值，標為無資料。"
PIPR_PERIOD = "每年取 9 月一期。"
LOC_CROP = "農戶所在地方行政區（依農戶歸戶，不是土地實際位置；LAD 2026 年界）"
CROP_SURVEY = "英格蘭商業農戶抽樣調查推估（Defra June Survey，2025 年 6 月）；推估值有抽樣誤差。"
CROP_LOCATION = "面積依農戶歸戶到農戶所在的地方行政區，不是土地實際所在位置。"
CROP_SUPPRESSED = "遮蔽＝涉及少於 5 戶而由來源抑制，或為保護已抑制格而二次抑制；不是 0，也不可反推。占比的分子或分母被遮蔽時，占比也遮蔽。"
CROP_SHARE = "占比分母為同表「農戶總面積」；四類不涵蓋全部土地利用（另有休耕、林地等），合計不等於 100%。"
CROP_NO_HOLDINGS = "沒有商業農戶（農戶總面積為 0）的地方行政區，占比無法計算，標為「無農戶」，不是 0。"
CROP_ZERO = "原始值 0 是官方數值（該區沒有此類面積），不是缺值。"

# 每層：group（同一列的群組 key）、group_label、option_label、subgroup、label、visual、digits、derived_method、notes、zero_note、loc
LAYERS = [
    # ── 人口 ──
    dict(key="statsGbPopulation", group="gbPopulation", group_label="年中人口推估", option="總人口", sub="年中人口推估",
         label="年中人口", visual="population", digits=0, loc=LOC_POP,
         notes=[POP_METHOD, "蘇格蘭數字四捨五入到 10 人。", POP_ERROR]),
    dict(key="statsGbPopulationDensity", group="gbPopulation", group_label="年中人口推估", option="人口密度", sub="年中人口推估",
         label="人口密度", visual="population", digits=0, loc=LOC_POP,
         notes=[POP_METHOD, "人口密度的分母是陸地面積，不含潮間帶與水域。", POP_ERROR]),
    dict(key="statsGbMedianAge", group="gbPopulation", group_label="年中人口推估", option="年齡中位數", sub="年中人口推估",
         label="年齡中位數", visual="population", digits=1, loc=LOC_POP,
         notes=[POP_METHOD, POP_ERROR]),
    dict(key="statsGbRuralShareEw", group="gbRuralEw", group_label="城鄉（英格蘭、威爾斯）", option="鄉村人口比例", sub="城鄉",
         label="鄉村人口比例（英格蘭、威爾斯）", visual="population", digits=1, loc=LOC_RURAL,
         notes=[RURAL_DEF, "鄉村＝ONS 2021 城鄉分類中歸為鄉村的普查小區（OA）；以 2021 年普查人口計算。"],
         zero_note="0% 自成最淺一級（該區沒有鄉村人口，是官方數值，不是缺值）。"),
    dict(key="statsGbFarFromTownShareEw", group="gbRuralEw", group_label="城鄉（英格蘭、威爾斯）", option="遠離主要城鎮人口比例", sub="城鄉",
         label="遠離主要城鎮人口比例（英格蘭、威爾斯）", visual="population", digits=1, loc=LOC_RURAL,
         notes=[RURAL_DEF, "主要城鎮＝建成區人口 75,000 人以上；遠離＝開車超過 30 分鐘。"],
         zero_note="0% 自成最淺一級（該區人口都在主要城鎮 30 分鐘車程內，是官方數值，不是缺值）。"),
    dict(key="statsGbRuralShareSco", group="gbRuralSco", group_label="鄉村人口比例（蘇格蘭）", option="鄉村人口比例", sub="城鄉",
         label="鄉村人口比例（蘇格蘭）", visual="population", digits=1, loc=LOC_RURAL,
         derived_method="蘇格蘭官方城鄉分類的兩級鄉村（Accessible rural＋Remote rural）人口比例相加",
         notes=[RURAL_DEF, "蘇格蘭的鄉村＝居住地人口不到 3,000 人（Accessible rural＋Remote rural 兩級相加），以 2022 年普查人口計算。"]),
    # ── 社經（四地剝奪指數各自一組）──
    dict(key="statsGbImdScoreEng", group="gbImdEng", group_label="英格蘭剝奪指數（IoD2025）", option="IMD 平均分數", sub="英格蘭（IoD2025）",
         label="IMD 平均分數（英格蘭 IoD2025）", visual="environment", digits=1, loc=LOC_DEPRIVATION,
         notes=[DEPRIVATION, "分數越高越剝奪；為區內小區（LSOA）分數依人口加權的官方彙整值。"]),
    dict(key="statsGbImdShare10Eng", group="gbImdEng", group_label="英格蘭剝奪指數（IoD2025）", option="最剝奪 10% 小區占比", sub="英格蘭（IoD2025）",
         label="最剝奪 10% 小區占比（英格蘭 IoD2025）", visual="environment", digits=1, loc=LOC_DEPRIVATION,
         notes=[DEPRIVATION, "該區小區（LSOA）中，落在全英格蘭最剝奪 10% 的比例（官方摘要值）。"],
         zero_note="0% 自成最淺一級（該區沒有小區落在最剝奪 10%，是官方數值，不是缺值）。"),
    dict(key="statsGbWimdShare10", group="gbWimd", group_label="威爾斯剝奪指數（WIMD 2025）", option="最剝奪 10% 小區占比", sub="威爾斯（WIMD 2025）",
         label="最剝奪 10% 小區占比（威爾斯 WIMD 2025）", visual="environment", digits=1, loc=LOC_DEPRIVATION,
         notes=[DEPRIVATION, "官方門檻：全威爾斯 1,917 個小區（LSOA）中排名 1–191（10%）／1–382（20%）。",
                "授權：gov.wales 版權聲明載明可依 Open Government Licence 再利用（未標版本，連結為 v3）。"]),
    dict(key="statsGbWimdShare20", group="gbWimd", group_label="威爾斯剝奪指數（WIMD 2025）", option="最剝奪 20% 小區占比", sub="威爾斯（WIMD 2025）",
         label="最剝奪 20% 小區占比（威爾斯 WIMD 2025）", visual="environment", digits=1, loc=LOC_DEPRIVATION,
         notes=[DEPRIVATION, "官方門檻：全威爾斯 1,917 個小區（LSOA）中排名 1–191（10%）／1–382（20%）。",
                "授權：gov.wales 版權聲明載明可依 Open Government Licence 再利用（未標版本，連結為 v3）。"]),
    dict(key="statsGbSimdShare10", group="gbSimd", group_label="蘇格蘭剝奪指數（SIMD 2020v2）", option="最剝奪 10% 小區占比", sub="蘇格蘭（SIMD 2020v2）",
         label="最剝奪 10% 小區占比（蘇格蘭 SIMD 2020v2）", visual="environment", digits=1, loc=LOC_DEPRIVATION,
         derived_method="依官方排名門檻，由全蘇格蘭 6,976 個 data zone 的排名彙整到議會區",
         notes=[DEPRIVATION, "依官方排名門檻，由全蘇格蘭 6,976 個小區（data zone，2011 年版）彙整；資料年份 2020，比英格蘭、威爾斯舊。"]),
    dict(key="statsGbSimdShare20", group="gbSimd", group_label="蘇格蘭剝奪指數（SIMD 2020v2）", option="最剝奪 20% 小區占比", sub="蘇格蘭（SIMD 2020v2）",
         label="最剝奪 20% 小區占比（蘇格蘭 SIMD 2020v2）", visual="environment", digits=1, loc=LOC_DEPRIVATION,
         derived_method="依官方排名門檻，由全蘇格蘭 6,976 個 data zone 的排名彙整到議會區",
         notes=[DEPRIVATION, "依官方排名門檻，由全蘇格蘭 6,976 個小區（data zone，2011 年版）彙整；資料年份 2020，比英格蘭、威爾斯舊。"]),
    dict(key="statsGbNimdmShare10", group="gbNimdm", group_label="北愛剝奪指數（NIMDM 2017）", option="最剝奪 10% 小區占比", sub="北愛爾蘭（NIMDM 2017）",
         label="最剝奪 10% 小區占比（北愛 NIMDM 2017）", visual="environment", digits=1, loc=LOC_DEPRIVATION,
         derived_method="官方未發布此占比，依官方 SOA 排名自行彙整到地方政府區",
         notes=[DEPRIVATION, "官方沒有發布這一層的占比；依官方排名自行彙整（全北愛 890 個小區（SOA）中排名 89 以內／178 以內）。資料年份 2017，比英格蘭、威爾斯舊。",
                "授權依據為 OpenDataNI 同資料集頁標示的 UK Open Government Licence；NISRA 本站只寫 © Crown Copyright。"]),
    dict(key="statsGbNimdmShare20", group="gbNimdm", group_label="北愛剝奪指數（NIMDM 2017）", option="最剝奪 20% 小區占比", sub="北愛爾蘭（NIMDM 2017）",
         label="最剝奪 20% 小區占比（北愛 NIMDM 2017）", visual="environment", digits=1, loc=LOC_DEPRIVATION,
         derived_method="官方未發布此占比，依官方 SOA 排名自行彙整到地方政府區",
         notes=[DEPRIVATION, "官方沒有發布這一層的占比；依官方排名自行彙整（全北愛 890 個小區（SOA）中排名 89 以內／178 以內）。資料年份 2017，比英格蘭、威爾斯舊。",
                "授權依據為 OpenDataNI 同資料集頁標示的 UK Open Government Licence；NISRA 本站只寫 © Crown Copyright。"]),
    # ── 住宅 ──
    dict(key="statsGbHousePrice", group="gbHousePrice", group_label="房價（UK HPI）", option="平均房價", sub="房價（UK HPI）",
         label="平均房價（UK HPI）", visual="housing", digits=0, loc=LOC_HPI,
         notes=[HPI_METHOD, HPI_PERIOD, HPI_SCILLY]),
    dict(key="statsGbHousePriceChange", group="gbHousePrice", group_label="房價（UK HPI）", option="房價年增率", sub="房價（UK HPI）",
         label="房價年增率（UK HPI）", visual="housing", digits=1, loc=LOC_HPI,
         notes=["與去年同月相比的 12 個月變動（%）；棕色為下跌、紫色為上漲。", HPI_METHOD, HPI_PERIOD, HPI_SCILLY]),
    dict(key="statsGbPrivateRent", group="gbRent", group_label="私人租金（PIPR）", option="平均私人租金", sub="租金（PIPR）",
         label="平均私人租金（英格蘭、威爾斯）", visual="housing", digits=0, loc=LOC_PIPR,
         notes=[PIPR_METHOD, PIPR_SCOPE, PIPR_MISSING, PIPR_PERIOD]),
    dict(key="statsGbPrivateRentChange", group="gbRent", group_label="私人租金（PIPR）", option="私人租金年變動率", sub="租金（PIPR）",
         label="私人租金年變動率（英格蘭、威爾斯）", visual="housing", digits=1, loc=LOC_PIPR,
         notes=["與去年同月相比的租金指數變動（%）；棕色為下跌、紫色為上漲；樣本少的小區域波動大。", PIPR_METHOD, PIPR_SCOPE, PIPR_MISSING, PIPR_PERIOD]),
    # ── 農業（第 12 波作物，只有英格蘭）──
    # 名稱只留一層地區括號：交付草稿「其他耕作物面積占比（不含穀物）（英格蘭）」連兩個括號，「不含穀物」改寫進圖例說明。
    dict(key="statsGbCropCerealsShare", group="gbCrops", group_label="作物面積（英格蘭）", option="穀物面積占比", sub="作物面積",
         label="穀物面積占比（英格蘭）", visual="agriculture", digits=1, loc=LOC_CROP,
         notes=["穀物面積 ÷ 農戶總面積。", CROP_SURVEY, CROP_LOCATION, CROP_SUPPRESSED, CROP_NO_HOLDINGS, CROP_ZERO, CROP_SHARE]),
    dict(key="statsGbCropArableShare", group="gbCrops", group_label="作物面積（英格蘭）", option="其他耕作物面積占比", sub="作物面積",
         label="其他耕作物面積占比（英格蘭）", visual="agriculture", digits=1, loc=LOC_CROP,
         notes=["其他耕作物＝不含穀物的耕作物（如油菜、甜菜、馬鈴薯、豆類），面積 ÷ 農戶總面積。", CROP_SURVEY, CROP_LOCATION, CROP_SUPPRESSED, CROP_NO_HOLDINGS, CROP_ZERO, CROP_SHARE]),
    dict(key="statsGbCropFruitVegArea", group="gbCrops", group_label="作物面積（英格蘭）", option="蔬果面積", sub="作物面積",
         label="蔬果面積（英格蘭）", visual="agriculture", digits=1, loc=LOC_CROP,
         notes=["蔬菜與水果面積（公頃）。", CROP_SURVEY, CROP_LOCATION, CROP_SUPPRESSED,
                "沒有商業農戶的地方行政區，蔬果面積是官方值 0（不是缺值）。",
                "分級：多數地方行政區很小、少數集中產區很大，門檻 50／250／1,000 公頃大致每級放大 4–5 倍（對數間距）。"],
         zero_note="0 公頃自成最淺一級（該區沒有蔬果面積，是官方數值，不是缺值）。"),
    dict(key="statsGbCropGrasslandShare", group="gbCrops", group_label="作物面積（英格蘭）", option="草地面積占比", sub="作物面積",
         label="草地面積占比（英格蘭）", visual="agriculture", digits=1, loc=LOC_CROP,
         notes=["草地（5 年內暫時草地、5 年以上永久草地與專用粗放放牧地）面積 ÷ 農戶總面積。", CROP_SURVEY, CROP_LOCATION, CROP_SUPPRESSED, CROP_NO_HOLDINGS, CROP_SHARE]),
]

# 狀態標籤：交付草稿的「資料抑制」改用台灣統計既有的「遮蔽」說法；三種狀態分開列，不合併。
STATUS_LABEL_OVERRIDES = {
    "statsGbCropCerealsShare": {"suppressed": "遮蔽（少於 5 戶）"},
    "statsGbCropArableShare": {"suppressed": "遮蔽（少於 5 戶）"},
    "statsGbCropFruitVegArea": {"suppressed": "遮蔽（少於 5 戶）"},
    "statsGbCropGrasslandShare": {"suppressed": "遮蔽（少於 5 戶）"},
}

# 草稿斷點的調整（其餘照草稿：草稿＝最新期 observed 20/40/60/80 百分位取 2 位有效數字，與本地重算一致）。
BREAK_OVERRIDES = {
    # 草稿第一個門檻是 0：0 值會落到第二級（最淺色空著），且 76／189／104 個 0 值與正值擠在同一級。
    # 比照台灣「有 0 的組合第一級固定」先例：第一門檻 0.1（來源最小正值的解析度），0 自成最淺一級；
    # 其餘取正值的 25/50/75 百分位、2 位有效數字。
    "statsGbRuralShareEw": [0.1, 8.6, 25, 45],
    "statsGbFarFromTownShareEw": [0.1, 3.8, 30, 71],
    "statsGbImdShare10Eng": [0.1, 3, 8.9, 18],
    # 草稿只看最新一期取正負對稱（±4.9／±9.8、±4.8／±9.6）；門檻是跨期契約，改用 11 期全部 observed 的
    # |值| 50/90 百分位（2 位有效數字），維持以 0 為中心的對稱 PuOr-6（3 級下跌／3 級上漲），棕負紫正語意不變。
    "statsGbHousePriceChange": [-11, -3.4, 0, 3.4, 11],
    "statsGbPrivateRentChange": [-8, -3.5, 0, 3.5, 8],
    # 蔬果面積：草稿 [0, 25, 140, 490] 第一門檻 0 會把 67 個官方 0（32%）擠進第二級、最淺級空著。
    # 正值 145 區橫跨 1.7–7,496 公頃（近 4 個數量級、強右偏：中位 216、p75 685），等距或全體分位數都會把
    # 多數小區壓在同一兩級；改「0 自成最淺一級」＋對數間距 50／250／1,000（約 ×5，接近正值四分位 64／216／685 的整數化），
    # 各級 67／30／47／40／28 區。單期資料，無跨期比較影響。
    "statsGbCropFruitVegArea": [0.1, 50, 250, 1000],
    # 穀物／其他耕作物占比各只有 7／8 個官方 0（約 3.5%），照草稿（20/40/60/80 百分位），0 與小值同屬最淺一級；
    # 草地占比沒有 0。
}


def nation_list(nations: list[str]) -> str:
    return "、".join(NATION_ZH[n] for n in sorted(nations, key=NATION_ORDER.index))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--handoff", required=True, type=Path, nargs="+")
    args = parser.parse_args()
    by_key = {}
    for handoff in args.handoff:
        delivered = json.loads(handoff.read_text())
        if delivered["country"] != "GB" or delivered["schema"] != "gb-statistics-recipes-v1":
            raise SystemExit(f"{handoff.name}: unexpected handoff schema")
        for r in delivered["recipes"]:
            if r["layer_key"] in by_key:
                raise SystemExit(f"{r['layer_key']}: duplicated across handoffs")
            by_key[r["layer_key"]] = r
    specs = {spec["key"]: spec for spec in LAYERS}
    if set(by_key) != set(specs):
        raise SystemExit(f"handoff keys {sorted(by_key)} != layers {sorted(specs)}")

    recipes, report = [], []
    for spec in LAYERS:
        key = spec["key"]
        layer = by_key[key]
        if not layer["enabled"] or layer["level"] != LEVEL or layer["dimension_keys"]:
            raise SystemExit(f"{key}: disabled, wrong level or has dimensions")
        options, statuses, zero, latest = [], Counter(), 0, None
        for option in layer["release_options"]:
            path = args.root / option["bundle_path"]
            body = json.loads(path.read_text())
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
            if {o["area_level"] for o in obs} != {LEVEL} or len(obs) != len(codes) or len(codes) != AREA_COUNT:
                raise SystemExit(f"{key}: {option['release_id']} needs {AREA_COUNT} unique rows, got {len(obs)}")
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
        if len({o["release_id"] for o in options}) != len(options):
            raise SystemExit(f"{key}: duplicate options")
        unexpected = set(statuses) - {"observed"} - set(layer["status_labels"])
        if unexpected:
            raise SystemExit(f"{key}: statuses {sorted(unexpected)} have no legend label")
        if statuses.get("not_applicable") and not layer["uncovered_nations"]:
            raise SystemExit(f"{key}: not_applicable rows but no uncovered nations")
        default_option = max(options, key=lambda o: (o["period_end"], o["period_start"]))
        breaks = BREAK_OVERRIDES.get(key, layer["legend"]["breaks"])
        if sorted(set(breaks)) != breaks:
            raise SystemExit(f"{key}: bad breaks {breaks}")
        diverging = layer["legend"]["direction"] == "diverging"
        if diverging and (len(breaks) != 5 or breaks[2] != 0):
            raise SystemExit(f"{key}: diverging breaks must be [a, b, 0, c, d] for PuOr-6")
        if not diverging and breaks[0] <= 0:
            raise SystemExit(f"{key}: sequential first break must be > 0 (0 自成最淺一級)")
        release = latest["release"]
        params = release["provenance"]["processing"]["parameters"]
        attribution = layer["source"]["attribution"]
        if params.get("attribution") != attribution:
            raise SystemExit(f"{key}: attribution differs between handoff and bundle")
        notes = list(spec["notes"])
        if layer["uncovered_nations"]:
            notes.insert(0, f"未涵蓋：{nation_list(layer['uncovered_nations'])}（來源不含這些地區，不是 0）。")
        notes.append(f"署名：{attribution}")
        derived_method = spec.get("derived_method")
        recipes.append({
            "layer_key": key, "enabled": True, "family": "gb", "country": "GB",
            "label": spec["label"], "group": spec["group"], "group_label": spec["group_label"],
            "option_label": spec["option"], "subgroup": spec["sub"],
            "data_theme": DATA[layer["theme"]], "tab_theme": TAB[layer["theme"]],
            "visual_theme": spec["visual"],
            "dataset_id": layer["dataset_id"], "indicator_id": layer["indicator_id"], "level": LEVEL,
            "boundary_version": layer["boundary_version"], "unit": layer["unit"], "aggregation": latest["indicator"]["aggregation"],
            "default_release_id": default_option["release_id"],
            "dimensions": [],
            "release_options": sorted(options, key=lambda o: o["period_end"], reverse=True),
            "legend": {
                "method": "fixed_breaks", "breaks": breaks, "direction": "diverging" if diverging else "ascending",
                "scale_note": None, "zero_note": spec.get("zero_note") if zero else None, "display_note": None,
                "notes": notes, "by_dimension": None, "dimension_notes": None,
            },
            "status_labels": {kind: STATUS_LABEL_OVERRIDES.get(key, {}).get(kind, label) for kind, label in layer["status_labels"].items() if statuses.get(kind)},
            "format": {"locale": "zh-TW", "maximumFractionDigits": spec["digits"]},
            "derived": bool(derived_method),
            **({"derived_method": derived_method} if derived_method else {}),
            "location_semantics": spec["loc"],
            "disclosure": layer["disclosure"],
            "publisher": release["publisher"], "license": release["license"],
            "source_landing_url": release["source_landing_url"], "source_download_url": release["source_download_url"],
            "source_title": release["source_metadata"]["dataset_title"],
            "attribution": attribution,
            "scope_nations": sorted(layer["scope_nations"], key=NATION_ORDER.index),
            "uncovered_nations": sorted(layer["uncovered_nations"], key=NATION_ORDER.index),
            "delivery": {
                "observed_statuses": dict(sorted(statuses.items())), "observed_zero": zero,
                "draft_breaks": layer["legend"]["breaks"], "draft_breaks_basis": layer["legend"].get("breaks_basis"),
                "label_en": layer["label_en"], "unit_en": layer["unit_en"], "definition": layer["definition"],
                "receipts": [{"release_id": o["release_id"], "bundle_path": o["bundle_path"]} for o in layer["release_options"]],
            },
        })
        report.append(f"{key:28} options={len(options):2} default={default_option['release_id'][:44]} breaks={breaks} zero={zero} statuses={dict(statuses)}")
    print(f"gb: recipes={len(recipes)} selectors={sum(len(r['release_options']) for r in recipes)}")
    print("\n".join(report))
    document = {
        "version": 1,
        "scope": "production_r2",
        "family": "gb",
        "country": "GB",
        "generated_from": {"recipes": "、".join(h.name for h in args.handoff), "bundles": "taipei-gis-analytics data/processed/<theme>/<dataset_id>/releases/<release_id>.json"},
        "release_selector": {"type": "exact_whitelist", "identity_fields": ["dataset_id", "indicator_id", "release_id", "period_start", "period_end", "boundary_version", "dimensions"], "unknown_release": "reject"},
        "observation_policy": {"not_applicable": "來源國家不在本指標涵蓋範圍（未涵蓋）；不是 0、不是缺值", "missing": "來源該國有涵蓋但此區無值", "observed_zero": "observed 且值為 0 是官方真實數值"},
        "recipes": recipes,
    }
    OUT.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.name} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
