#!/usr/bin/env python3
"""Build the Roadmap batch-2 atlas statistics families from the analytics handoff recipes.

Families (one output JSON each, atlas recipe schema in src/data/atlasStatisticsTypes.ts):
  stateAssets  國有資產與國營事業資產（G16；docs/handoff/state-assets-statistics-recipes.json，23 recipes）
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
import re
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


# ── 國有資產（G16）──────────────────────────────────────────────────────────────
def src_note(org: str, title: str, nid: str) -> str:
    return f"出典：{org} {title}（data.gov.tw {nid}）；政府資料開放授權條款-第1版。"


FNP = "財政部國有財產署"
SA_LAND_SRC = src_note(FNP, "國有非公用土地管理區分報告表", "30583")
SA_PROP_SRC = src_note(FNP, "國有非公用房地數量價值報告表", "30580")
SA_RENT_SRC = src_note(FNP, "歷年國有非公用不動產出租統計", "6720")
SA_RES_SRC = src_note(FNP, "國有非公用住宅用地統計表", "36963")
TS_RENT_SRC = src_note("台灣糖業股份有限公司", "可供出租土地資訊", "25754")
TS_ANN_SRC = src_note("台灣糖業股份有限公司", "資產公告土地明細資料", "101669")
MOJ_SRC = src_note("法務部行政執行署", "所屬分署已拍定不動產資料（各年季度檔）", "178752 等")
SA_STOCK = "114 年底存量（單一期）。"
SA_LAND_SUBTOTAL = "管理區分含「未處理土地」「已處理土地」兩個小計，不可跨類加總；已處理土地不屬現有庫存。"
SA_PROP_SUBTOTAL = "分類含「土地」「房屋」兩個小計，不可跨類加總；房屋面積為建物面積。"
SA_VALUE = "每平方公尺價值只供縣市間比較，不可乘回面積或加總成國有財產總值（來源未註明是帳面價值或公告現值）。"
SA_IDLE_SHARE = "占比分母為未處理土地面積（13 個管理區分合計）。"
SA_RENT = "91–99 年臺中、臺南、高雄為改制前縣＋市合併值；連江縣 91–93 年無資料。"
TS_RENT = "台糖公告「可供出租」的土地清單，不是台糖持有土地總量；清單沒列到的鄉鎮為未涵蓋（斜線），不是 0。"
TS_ANN = "歷年標租標的，非持有地（2016 年起至下載日累計公告）；清單沒列到的鄉鎮為未涵蓋（斜線），不是 0。"
TS_LISTINGS = "公告列數未去重（同地號被公告幾次就計幾次）；面積與地號數已依地號去重。"
MOJ = "行政執行（欠稅、罰鍰等）拍賣的已拍定件數，不是國有財產、也不含法院拍賣，不代表當地房市；來源無金額。"
MOJ_PARTIAL = "2026 年只到 9 月 30 日（部分年），不可與全年比較。"
MOJ_TOWN = "某縣市當年有標的未填鄉鎮時，該縣市所有鄉鎮當年標示為無資料（斜線），不是 0；小鄉鎮逐年波動大。"
SA_NA_VALUE = {"not_applicable": "不適用（該類面積為 0，沒有單位價值）"}
SA_RENT_MISSING = {"missing": "無資料（連江縣 91–93 年來源為「-」，不是 0）"}
TS_MISSING = {"missing": "未涵蓋（台糖清單未列此鄉鎮，不是 0）"}
MOJ_TOWN_MISSING = {"missing": "無資料（該縣市當年有標的未填鄉鎮，鄉鎮值不完整；不是 0）"}


def sa(key, group, group_label, option, sub, digits, notes, **extra):
    return dict(key=key, group=group, group_label=group_label, option_label=option, subgroup=sub, visual="housing", digits=digits, notes=notes, **extra)


STATE = "國有資產"
SOE = "國營事業資產"
MOJ_SUB = "行政執行拍賣"
LAND_DEF = {"管理區分": "未處理土地"}
PROP_DEF = {"分類": "土地"}
STATE_ASSETS_LAYERS = [
    sa("statsStateLandIdleArea", "stateLandIdle", "閒置國有地", "面積", STATE, 1, [SA_LAND_SRC, SA_STOCK]),
    sa("statsStateLandIdleShare", "stateLandIdle", "閒置國有地", "占未處理土地比例", STATE, 1, [SA_LAND_SRC, SA_STOCK, SA_IDLE_SHARE]),
    sa("statsStateLandIdleParcels", "stateLandIdle", "閒置國有地", "筆戶數", STATE, 0, [SA_LAND_SRC, SA_STOCK]),
    sa("statsStateLandStatusShare", "stateLandStatus", "國有地管理區分占比", "各管理區分占比", STATE, 1, [SA_LAND_SRC, SA_STOCK, SA_IDLE_SHARE], defaults={"管理區分": "閒置"}),
    sa("statsStateLandArea", "stateLand", "國有非公用土地", "面積", STATE, 1, [SA_LAND_SRC, SA_STOCK, SA_LAND_SUBTOTAL], defaults=LAND_DEF),
    sa("statsStateLandParcels", "stateLand", "國有非公用土地", "筆戶數", STATE, 0, [SA_LAND_SRC, SA_STOCK, SA_LAND_SUBTOTAL], defaults=LAND_DEF),
    sa("statsStateLandValuePerSqm", "stateLand", "國有非公用土地", "每平方公尺價值", STATE, 0, [SA_LAND_SRC, SA_STOCK, SA_VALUE, SA_LAND_SUBTOTAL], defaults=LAND_DEF, status=SA_NA_VALUE),
    sa("statsStatePropertyArea", "stateProperty", "國有非公用房地", "面積", STATE, 1, [SA_PROP_SRC, SA_STOCK, SA_PROP_SUBTOTAL], defaults=PROP_DEF),
    sa("statsStatePropertyParcels", "stateProperty", "國有非公用房地", "筆戶數", STATE, 0, [SA_PROP_SRC, SA_STOCK, SA_PROP_SUBTOTAL], defaults=PROP_DEF),
    sa("statsStatePropertyValuePerSqm", "stateProperty", "國有非公用房地", "每平方公尺價值", STATE, 0, [SA_PROP_SRC, SA_STOCK, SA_VALUE, SA_PROP_SUBTOTAL], defaults=PROP_DEF, status=SA_NA_VALUE),
    sa("statsStateLandRentalArea", "stateLandRental", "國有不動產出租", "出租面積", STATE, 1, [SA_RENT_SRC, SA_RENT], annual=True, status=SA_RENT_MISSING),
    sa("statsStateLandRentalParcels", "stateLandRental", "國有不動產出租", "出租筆數", STATE, 0, [SA_RENT_SRC, SA_RENT], annual=True, status=SA_RENT_MISSING),
    sa("statsStateResidentialArea", "stateResidential", "國有住宅用地", "面積", STATE, 1, [SA_RES_SRC, SA_STOCK], defaults={"計畫區別": "都市計畫區"}),
    sa("statsStateResidentialParcels", "stateResidential", "國有住宅用地", "筆數", STATE, 0, [SA_RES_SRC, SA_STOCK], defaults={"計畫區別": "都市計畫區"}),
    sa("statsTaisugarRentableArea", "taisugarRentable", "台糖可供出租土地（公告）", "面積", SOE, 1, [TS_RENT_SRC, TS_RENT], status=TS_MISSING),
    sa("statsTaisugarRentableParcels", "taisugarRentable", "台糖可供出租土地（公告）", "地號數", SOE, 0, [TS_RENT_SRC, TS_RENT], status=TS_MISSING),
    sa("statsTaisugarAnnouncedArea", "taisugarAnnounced", "台糖歷年標租標的", "面積（依地號去重）", SOE, 1, [TS_ANN_SRC, TS_ANN, TS_LISTINGS], status=TS_MISSING),
    sa("statsTaisugarAnnouncedParcels", "taisugarAnnounced", "台糖歷年標租標的", "地號數（去重）", SOE, 0, [TS_ANN_SRC, TS_ANN, TS_LISTINGS], status=TS_MISSING),
    sa("statsTaisugarAnnouncedListings", "taisugarAnnounced", "台糖歷年標租標的", "公告列數（未去重）", SOE, 0, [TS_ANN_SRC, TS_ANN, TS_LISTINGS], status=TS_MISSING),
    sa("statsMojAuctionItems", "mojAuction", "行政執行署拍定不動產", "縣市・標的數", MOJ_SUB, 0, [MOJ_SRC, MOJ, MOJ_PARTIAL], annual=True),
    sa("statsMojAuctionLots", "mojAuction", "行政執行署拍定不動產", "縣市・拍賣案數", MOJ_SUB, 0, [MOJ_SRC, MOJ, MOJ_PARTIAL], annual=True),
    sa("statsMojAuctionItemsByCategory", "mojAuction", "行政執行署拍定不動產", "縣市・標的數（依類別）", MOJ_SUB, 0, [MOJ_SRC, MOJ, MOJ_PARTIAL], annual=True, defaults={"拍賣類別": "住宅"}, breaks=[1, 3, 6, 12]),
    sa("statsMojAuctionItemsTown", "mojAuction", "行政執行署拍定不動產", "鄉鎮・標的數", MOJ_SUB, 0, [MOJ_SRC, MOJ, MOJ_PARTIAL, MOJ_TOWN], annual=True, status=MOJ_TOWN_MISSING, breaks=[1, 2, 4, 8]),
]

# 交付 disclosure 照用，只把內部欄名／dataset id／狀態代碼換成中文（資料限制卡給一般讀者看）。
DISCLOSURE_REPLACEMENTS = [
    ("dimensions 管理區分含兩個小計", "管理區分含兩個小計"),
    ("dimensions.管理區分 為 20 類（含兩個小計）。", "管理區分為 20 類（含兩個小計）。"),
    ("dimensions.分類 為 9 類（含土地、房屋兩個小計）。", "分類為 9 類（含土地、房屋兩個小計）。"),
    ("dimensions 計畫區別分都市計畫區、非都市計畫區。", "計畫區別分都市計畫區、非都市計畫區。"),
    ("dimensions.計畫區別。", ""),
    ("dimensions.拍賣類別 為來源原值。", "拍賣類別為來源原值。"),
    ("面積 0 為 not_applicable。", "面積 0 時單位價值為不適用。"),
    ("標 missing", "標示為無資料"),
    ("announced_listings 才是", "「公告列數」才是"),
    ("auctioned_items＝", "標的數＝"),
    ("auctioned_lots＝", "拍賣案數＝"),
]

CULTURE_ZERO = "0 人自成最淺一級（名冊在該區無登記，不是無資料）。"

FAMILIES: dict[str, dict] = {
    "stateAssets": {
        "file": "stateAssetsStatisticsRecipes",
        "handoff": "docs/handoff/state-assets-statistics-recipes.json",
        "theme_dir": "socioeconomic",
        "data_theme": "國有資產統計 State Assets Statistics",
        "tab_theme": "住宅與不動產 Housing & Property",
        "observation_policy": {"observed_zero": "status observed and value 0 (source lists 0)", "missing": "value null; area not covered by the source list or source '-'; no zero fill", "not_applicable": "value null; per-sqm value where the area is 0", "suppressed": "not used"},
        "layers": STATE_ASSETS_LAYERS,
    },
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


def public_disclosure(key: str, text: str) -> str:
    for old, new in DISCLOSURE_REPLACEMENTS:
        text = text.replace(old, new)
    leftover = re.findall(r"[A-Za-z]+_[A-Za-z_]+|dimensions|processing|not_applicable|\bmissing\b", text)
    if leftover:
        raise SystemExit(f"{key}: internal tokens left in disclosure: {sorted(set(leftover))}")
    return text


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
            "disclosure": public_disclosure(key, layer["disclosure"]),
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
