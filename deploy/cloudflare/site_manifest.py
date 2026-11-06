#!/usr/bin/env python3
"""Pulse 主站「網址 → S3 key」對照表（由 .gis-agent-system 的 build_manifest.py 搬來，2026-11-05）。

重現 `scripts/deploy/pull-deploy-assets.sh`（aws s3 sync include/exclude：後面的規則優先、`*` 會匹配斜線）、
rail.tar.gz 解包、bus gunzip 與 jp-medical／jp-heights／flight-trails／embed-rail 的 install 邏輯，
算出每個 S3 key 落地的 /data 路徑；再依 nginx.conf 判斷哪些路徑真的由 nginx 供應，最後與前端 src 的引用交集。

與原版差異：輸入改成記憶體物件（由 sync_site_assets.py 從 S3 取得）；不讀 GFW manifest、不比對舊版 tree
（輪替家族 climate／global-maritime 由 sync-rotating.mjs 負責，這裡一律排除）。
⚠️ SYNCS／NGINX_DATA 是 nginx.conf 與 pull-deploy-assets.sh 的手抄版，那兩個檔改了要同步改這裡。
"""
from __future__ import annotations

import re
from collections import defaultdict
from fnmatch import fnmatchcase
from pathlib import Path

PREFIX = "deploy-assets/"

# ── pull-deploy-assets.sh 的 sync 規則（依腳本順序；filters 依序套用、最後命中者決定）──
def inc(p): return ("include", p)
def exc(p): return ("exclude", p)

MIRRORS = ["network_structures", "medical", "industrial_zone", "sports", "education", "fishery",
           "water_resources", "urban", "culture", "religion", "funeral", "welfare", "hazards",
           "indigenous_rural", "marine", "civic_facilities", "environment", "public_life", "poi",
           "harm_reduction", "world", "tourism", "embed-snapshots", "embed-rail", "base_map",
           "road", "climate", "flood", "police_justice"]

SYNCS: list[tuple[str, str, str, list]] = [
    ("root-json", "", "/", [exc("*"), inc("aviation_data.json"), inc("ship_data.json")]),
    ("geo-flat", "", "/geo/", [exc("*"),
        inc("bus_stations_intercity.geojson"), inc("bike_stations.geojson"), inc("cycling_routes.geojson"),
        inc("freeway_congestion.geojson"), inc("weather_stations.geojson"), inc("convenience_stores.geojson"),
        inc("active_faults.geojson"), inc("water_*.geojson"), inc("water_*.pmtiles"), inc("fire_*.geojson"),
        inc("medical_*.geojson"),
        exc("water_flood_extreme.geojson"), exc("water_reservoirs.geojson"), exc("water_rivers.geojson"),
        exc("water_river_polygons.geojson"), exc("water_canals.geojson"), exc("fire_hydrants.geojson"),
        exc("medical_clinics.geojson"), exc("medical_pharmacies.geojson"), exc("medical_aed.geojson"),
        exc("medical_ltc.geojson")]),
    ("geo-mirror", "geo/", "/geo/", []),
    ("network_structures", "network_structures/", "/network_structures/", []),
    ("h3", "", "/h3/", [exc("*"), inc("h3_*_res8.json")]),
    ("fire-root-pmtiles", "", "/fire/", [exc("*"), inc("*.pmtiles"),
        *[exc(f"{d}/*") for d in ["agriculture", "business_registry", "industrial_zone", "medical", "flood",
          "forestry", "fishery", "coverage", "base_map", "geo", "road", "urban", "network_structures",
          "jp-medical", "jp-heights", "public_life"]],
        exc("water_*.pmtiles"), exc("*/*")]),
    ("medical", "medical/", "/medical/", []),
    ("agriculture", "agriculture/", "/agriculture/", [exc("livestock_farms.geojson"), exc("slaughterhouses.geojson"),
        exc("agri_retail_companies.geojson"), exc("produce_wholesale_companies.geojson"),
        exc("farm_roads.geojson"), exc("eco_network_zones.geojson")]),
    ("business_registry", "business_registry/", "/business_registry/", [
        exc("company_points_202608.pmtiles"), exc("company_capital_grid_202608.pmtiles"),
        exc("regulated_facilities_20260818.pmtiles"), exc("factory_locations_202606.pmtiles"),
        exc("common_registration_addresses_202608.geojson"), exc("factory_locations_202606_allzoom.pmtiles"),
        exc("manufacturing_company_points_202608_allzoom.pmtiles"), exc("regulated_facilities_20260818_allzoom.pmtiles")]),
    ("forestry", "forestry/", "/forestry/", [exc("forest_reserve.geojson"), exc("forest_roads.geojson"), exc("hiking_trails.geojson")]),
    ("flight-trails-releases", "flight-trails/releases/", "/flight-trails/releases/", []),
    ("coverage", "coverage/", "/coverage/", [exc("real_estate_points.pmtiles")]),
    ("static-rpc", "static-rpc/", "/static-rpc/", [exc(f"{n}.json") for n in [
        "get_fossil_fuel_layers", "get_fossil_fuel_infrastructure", "get_osm_substations", "get_osm_power_lines",
        "get_osm_power_towers", "get_ssot_facilities_primary_operating", "get_ssot_facilities_planned",
        "get_ssot_facilities_historical", "get_ssot_facilities_secondary_small", "get_ssot_facilities_osm_supplement",
        "get_osm_power_plants_static", "get_ssot_facilities_offshore_zones"]]),
    ("bus-gz-cache", "", "/.cache/", [exc("*"), inc("*_bus_routes_v2.json.gz"), inc("tourist_shuttle_routes_v2.json.gz")]),
    ("rail-cache", "", "/.cache/", [exc("*"), inc("rail.tar.gz")]),
]
for d in MIRRORS:
    SYNCS.append((d, f"{d}/", f"/{d}/", []))

RM_AFTER = {"/agriculture/livestock_farms.geojson", "/agriculture/slaughterhouses.geojson",
            "/business_registry/factory_locations_202606_allzoom.pmtiles",
            "/business_registry/manufacturing_company_points_202608_allzoom.pmtiles",
            "/business_registry/regulated_facilities_20260818_allzoom.pmtiles"}
BUS_GUNZIP = ["taipei_bus_routes_v2.json", "intercity_bus_routes_v2.json",
              "pingtungcounty_bus_routes_v2.json", "tourist_shuttle_routes_v2.json"]

# ── nginx.conf（origin/master）：prefix → (模式, 是否 ^~) ──
# data = root /data 無 fallback；fallback = root /data + try_files $uri @dist
NGINX_DATA = {
    "geo": ("fallback", False), "h3": ("fallback", False), "bus": ("fallback", False),
    "forestry": ("fallback", False), "fishery": ("fallback", False), "water_resources": ("data", False),
    "flood": ("fallback", False), "urban": ("fallback", False), "culture": ("fallback", False),
    "civic_facilities": ("fallback", False), "religion": ("fallback", False), "funeral": ("fallback", False),
    "welfare": ("fallback", False), "hazards": ("fallback", False), "indigenous_rural": ("fallback", False),
    "marine": ("fallback", False), "environment": ("fallback", False), "public_life": ("fallback", False),
    "poi": ("fallback", False), "harm_reduction": ("fallback", False), "world": ("fallback", False),
    "global-maritime": ("data", True), "tourism": ("fallback", False), "agriculture": ("data", False),
    "business_registry": ("data", False), "industrial_zone": ("data", False), "sports": ("data", False),
    "education": ("data", False), "static-rpc": ("data", False), "coverage": ("fallback", False),
    "medical": ("data", False), "network_structures": ("data", True), "base_map": ("data", False),
    "climate": ("data", True), "fire": ("data", False), "police_justice": ("data", False),
    "road": ("data", False), "rail": ("data", False), "embed-snapshots": ("data", False),
    "embed-rail": ("data", False), "jp-heights": ("data", True), "jp-medical": ("data", True),
    "flight-trails": ("data", True),
}
ROOT_JSON = {"/aviation_data.json", "/ship_data.json", "/temperature_grid.json"}
STATIC_EXT_RE = re.compile(r"\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$", re.I)
OOKLA_RE = re.compile(r"^/geo/ookla_(fixed_global|mobile_global|tw_z14|tw_z16)(_[0-9]+)?\.(geojson|pmtiles)$")
# 「整個資料夾都算用到」的家族：檔名在執行期才決定（rail id、氣候 frame、嵌入快照日期）
WHOLE_FAMILIES = {"rail": "rail.tar.gz 整包解壓、track/schedule id 執行期決定",
                  "climate": "refresh-climate 每 6 小時同步；frames 由 frames/manifest.json 指定",
                  "embed-snapshots": "embed 依 layer/date 組路徑"}


def nginx_route(path: str) -> tuple[str, str]:
    """回傳 (route, note)；route ∈ data / fallback / dist / none。"""
    if path in ROOT_JSON:
        return "data", ""
    seg = path.split("/")[1] if path.count("/") >= 2 else ""
    if any(part.startswith(".") for part in path.split("/")):
        return "none", "dotfile 一律 404"
    if OOKLA_RE.match(path):
        return "dist", "nginx ookla 正則只走 dist"
    if seg not in NGINX_DATA:
        return "none", ""
    mode, caret = NGINX_DATA[seg]
    if not caret and STATIC_EXT_RE.search(path):
        return "dist", "副檔名被 nginx 靜態正則搶走、落回 dist（/data 版供不出來）"
    return mode, ""


def sync_filter(rel: str, filters: list) -> bool:
    ok = True
    for kind, pat in filters:
        if fnmatchcase(rel, pat):
            ok = kind == "include"
    return ok


def simulate(s3: dict, ptrs: dict, rail_members: list[tuple[int, str]]) -> tuple[dict, dict]:
    """served/data path → list of (s3_key, rule, extra_note)。第二個回傳：家族說明。"""
    landed: dict[str, list] = defaultdict(list)
    # 外層照 SYNCS 規則順序（pull 腳本就是依序執行 aws s3 sync），同一網址後面規則覆蓋前面，
    # 所以 landed[path][-1] 才是真正的勝者；外層若走 S3 key 順序，勝者會變成「key 字母序最後」而非「sync 規則最後」。
    for rule, src, dest, filters in SYNCS:
        for key in s3:
            full = key[len(PREFIX):]
            if not full.startswith(src):
                continue
            rel = full[len(src):]
            if not rel or rel.endswith("/"):
                continue
            if sync_filter(rel, filters):
                landed[dest + rel].append((key, rule, ""))
    for p in RM_AFTER:
        landed.pop(p, None)
    # bus：cache 裡的 .gz → gunzip 到 /bus/
    for name in BUS_GUNZIP:
        k = f"{PREFIX}{name}.gz"
        if k in s3:
            landed[f"/bus/{name}"].append((k, "bus-gunzip", "S3 是 .json.gz、/data 是 gunzip 後 .json，size 為壓縮大小"))
    # rail.tar.gz → /rail/...
    rk = f"{PREFIX}rail.tar.gz"
    for size, name in rail_members:
        if name.endswith("/"):
            continue
        landed["/" + name.lstrip("./")].append((rk, "rail-tar", f"rail.tar.gz 內檔，解壓後 {size} bytes"))
    # flight-trails manifest（aws s3 cp）
    landed["/flight-trails/manifest.json"].append((f"{PREFIX}flight-trails/manifest.json", "flight-trails-manifest", ""))
    # 不進 nginx 的 cache 路徑移除（.cache 是 dotfile，nginx 404）
    for p in [p for p in landed if p.startswith("/.cache/")]:
        landed.pop(p)

    pointer: dict[str, list] = defaultdict(list)
    # jp-medical：current → release；inherited 檔的 S3 key 在來源 release
    cur = ptrs["jp-medical_current.json"]
    pub = ptrs["jpmed_pub.json"]
    ver = cur["version"]
    jb, js = "/jp-medical", PREFIX + "jp-medical"
    pointer[f"{jb}/current.json"].append((f"{js}/current.json", "jp-medical-install", "可變指標"))
    for rel in (cur["catalog"], cur["publication_manifest"]):
        pointer[f"{jb}/{rel}"].append((f"{js}/{rel}", "jp-medical-install", ""))
    for rel, meta in pub["files"].items():
        pointer[f"{jb}/releases/{ver}/{rel}"].append((f"{js}/releases/{ver}/{rel}", "jp-medical-install", ""))
    for rel, meta in pub.get("inherited_files", {}).items():
        sv = meta["source_version"]
        pointer[f"{jb}/releases/{ver}/{rel}"].append((f"{js}/releases/{sv}/{meta['source_path']}", "jp-medical-install",
                                                      f"inherited from {sv[:8]}（網址與 S3 key 不同）"))
    # jp-heights：catalog.json + catalog 內 ./jp-heights/assets/*
    cat = ptrs["jp-heights_catalog.json"]
    pointer["/jp-heights/catalog.json"].append((f"{PREFIX}jp-heights/catalog.json", "jp-height-install", "可變指標"))
    def walk(o):
        if isinstance(o, dict):
            for v in o.values(): yield from walk(v)
        elif isinstance(o, list):
            for v in o: yield from walk(v)
        elif isinstance(o, str) and "jp-heights/" in o:
            yield o
    for u in set(walk(cat)):
        p = "/" + u.lstrip("./")
        pointer[p].append((PREFIX + p.lstrip("/"), "jp-height-install", ""))
    # flight-trails：manifest 只指當前 release
    ft = ptrs["flight-trails_manifest.json"]
    pointer["/flight-trails/manifest.json"].append((f"{PREFIX}flight-trails/manifest.json", "flight-trails-manifest", "可變指標"))
    for smp in ft["samples"]:
        if not smp.get("asset"):
            continue  # 無資產的樣本（例：未發布日期）
        p = "/flight-trails/" + smp["asset"]["path"]
        pointer[p].append((PREFIX + p.lstrip("/"), "flight-trails", ""))
    # embed-rail：manifest + 目前 bundle
    er = ptrs["embed-rail_rail-manifest.json"]
    pointer["/embed-rail/rail-manifest.json"].append((f"{PREFIX}embed-rail/rail-manifest.json", "embed-rail", "可變指標"))
    pointer[f"/embed-rail/{er['bundle']}"].append((f"{PREFIX}embed-rail/{er['bundle']}", "embed-rail", ""))
    return landed, pointer


# ── 前端引用 ──
LIT_RE = re.compile(r"\"((?:[^\"\\\n]|\\.)*)\"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`", re.S)
SRC_EXT = {".ts", ".tsx", ".js", ".mjs", ".html", ".json"}


def iter_src(tree: Path):
    roots = [tree / "src", tree / "lab"] + [tree / f for f in ("embed.html", "card.html", "index.html", "privacy.html")]
    for r in roots:
        if r.is_file():
            yield r
        elif r.is_dir():
            for p in r.rglob("*"):
                if p.suffix not in SRC_EXT or not p.is_file():
                    continue
                s = str(p)
                if "__tests__" in s or ".test." in p.name or ".spec." in p.name:
                    continue
                if p.suffix == ".json" and p.stat().st_size > 2_000_000:
                    continue
                yield p


def collect_literals(tree: Path):
    lits: dict[str, set] = defaultdict(set)  # literal → {file:line}
    for p in iter_src(tree):
        text = p.read_text(errors="ignore")
        for m in LIT_RE.finditer(text):
            s = next(g for g in m.groups() if g is not None)
            if len(s) > 400 or "\n" in s and "${" not in s:
                continue
            line = text.count("\n", 0, m.start()) + 1
            lits[s].add(f"{p.relative_to(tree)}:{line}")
    return lits


def norm_path(s: str) -> str | None:
    s = s.split("?")[0].split("#")[0].strip()
    if s.startswith("./"):
        s = s[1:]
    elif "/" in s and s.split("/", 1)[0] in NGINX_DATA and re.search(r"\.[a-z0-9]+$", s):
        s = "/" + s  # 相對 public/ 的寫法（例：repPointLayers 的 `funeral/x_points.pmtiles`）
    if not s.startswith("/") or s.startswith("//"):
        return None
    return s


def domain_of(p: str) -> str:
    return p.split("/")[1] if p.count("/") >= 2 else "(root)"


PLACEHOLDER_RE = re.compile(r"[<>*]|/$|^/fishery/x\.pmtiles$|\.(md|ts|tsx|py|sh)$")  # 註解範例、文件路徑
# 對不到 S3 但原因已知的引用（人工查證 origin/master src）
KNOWN_UNMATCHED = {
    "/agriculture/livestock_farms.geojson": "owner-gated：pull 刻意 exclude＋rm，前端改走 owner-only RPC，fallbackUrl 會 404（預期）",
    "/agriculture/slaughterhouses.geojson": "owner-gated：pull 刻意 exclude＋rm，前端改走 owner-only RPC，fallbackUrl 會 404（預期）",
    "/jp-heights/buildings.pmtiles": "jpHeightCatalog legacyTokyoCatalog 的舊本機路徑，只在 catalog 載入失敗時用；正式走 catalog.json 的 assets/<sha>",
    "/jp-heights/building_grid.pmtiles": "同上（legacy fallback）",
    "/jp-heights/canopy.pmtiles": "同上（legacy fallback）",
    "/world/jp_natural_parks_ksj_2010.pmtiles": "研究層 production:false／NON_COMMERCIAL_ONLY，刻意不上 S3",
    "/world/jp_nature_conservation_ksj_2015.pmtiles": "研究層 production:false，刻意不上 S3",
    "/world/jp_wildlife_protection_moe_202504.pmtiles": "研究層 production:false，刻意不上 S3",
    "/world/jp_ramsar_moe_current.geojson": "研究層 production:false／LICENSE_UNVERIFIED HOLD，刻意不上 S3",
    "/world/jp_world_natural_heritage_ksj_2011.geojson": "研究層 production:false，刻意不上 S3",
}


def is_data_path(p: str) -> bool:
    return p in ROOT_JSON or domain_of(p) in NGINX_DATA


def template_regex(t: str):
    """`${...}` → 單段萬用。回傳 (regex, strong)。strong = 每個含變數的段都還有固定字元。"""
    parts = re.split(r"(\$\{[^}]*\})", t)
    rx, segs_var_only = "", False
    for part in parts:
        rx += "[^/]+" if part.startswith("${") else re.escape(part)
    for seg in t.split("/"):
        if "${" in seg and re.fullmatch(r"(\$\{[^}]*\})+", seg):
            segs_var_only = True
    return re.compile("^" + rx + "$"), not segs_var_only


def build_refs(lits):
    exact, templates, basenames, basename_templates = {}, [], defaultdict(set), []
    for s, locs in lits.items():
        # 檔名樣板（例：`h3_population_res${res}.json`），開頭固定且固定字元 ≥ 8 才採用
        if "${" in s and "/" not in s and re.search(r"\.(json|geojson|pmtiles|gz|bin|png)$", s):
            fixed = re.sub(r"\$\{[^}]*\}", "", s)
            if len(fixed) >= 8 and not s.startswith("${"):  # 開頭須是固定字元，避免 `${x}.geojson` 這類萬用
                rx, _ = template_regex(s)
                basename_templates.append((s, rx, locs))
            continue
        if "${" in s:
            p = norm_path(s)
            if p and domain_of(p) in NGINX_DATA:
                rx, strong = template_regex(p)
                templates.append((p, rx, strong, locs))
            continue
        p = norm_path(s)
        if p and is_data_path(p) and not PLACEHOLDER_RE.search(p):
            exact.setdefault(p, set()).update(locs)
        token = s.split("?")[0]
        if token and "/" not in token:  # 只收裸檔名（例：spec.file）；含路徑的由 exact 處理
            basenames[token].update(locs)
    return exact, templates, basenames, basename_templates


FIELDS = ["served_path", "s3_key", "size", "etag", "storage_class", "source", "note"]
ROTATING = ("climate", "global-maritime")  # 由 sync-rotating.mjs 負責


def build_rows(tree: Path, s3: dict, ptrs: dict, rail_members: list[tuple[int, str]]):
    """回傳 (rows, unreferenced)。rows 欄位見 FIELDS；輪替家族一律排除。
    s3：{key: {size, etag, storage_class}}；ptrs：見 POINTERS；rail_members：[(bytes, tar 成員名)]。"""
    tree = Path(tree)
    landed, pointer = simulate(s3, ptrs, rail_members)
    lits = collect_literals(tree)
    exact, templates, basenames, basename_templates = build_refs(lits)

    rows, unref, dist_only = {}, [], []
    exact_basenames = {p.rsplit("/", 1)[-1] for p in exact}
    def add(path, keys, source, notes):
        rows[path] = (keys, source, notes)

    # 1) pointer 家族（gfw／jp-medical／jp-heights／flight-trails／embed-rail）
    for path, keys in pointer.items():
        src = "refresh" if path.startswith("/global-maritime/") else "manifest"
        add(path, keys, src, [k[2] for k in keys if k[2]])
    pointer_domains = {"/global-maritime/", "/jp-medical/", "/jp-heights/", "/flight-trails/", "/embed-rail/"}

    # 2) sync 落地的每個 /data 路徑
    for path, keys in landed.items():
        if any(path.startswith(d) for d in pointer_domains):
            if path not in rows and path.startswith("/flight-trails/releases/"):
                unref.append((path, keys, "flight-trails 舊 release：已同步但 manifest 未引用"))
            elif path not in rows:
                unref.append((path, keys, "pointer 家族未引用"))
            continue
        route, rnote = nginx_route(path)
        if path in ROOT_JSON:
            continue
        if route in ("none", "dist"):
            unref.append((path, keys, f"nginx 不從 /data 供應：{rnote or '無對應 location'}"))
            continue
        dom = domain_of(path)
        notes = [k[2] for k in keys if k[2]]
        why = None
        if path in exact:
            why = "exact"
        elif dom in WHOLE_FAMILIES:
            why = "family"; notes.append(WHOLE_FAMILIES[dom])
        else:
            for t, rx, strong, locs in templates:
                if rx.match(path):
                    base = path.rsplit("/", 1)[-1]
                    stem = base.rsplit(".", 1)[0]
                    if strong or base in basenames or stem in basenames:
                        why = "template"; notes.append(f"樣板 {t}")
                        break
            if not why:
                base = path.rsplit("/", 1)[-1]
                stem = base.split(".", 1)[0]
                if base in basenames:
                    why = "basename"; notes.append("以檔名字面引用（非完整路徑）")
                elif dom == "static-rpc" and stem in basenames:
                    why = "basename"; notes.append("STATIC_RPC_BASE + rpc 名稱")
                else:
                    for t, rx, _ in basename_templates:
                        if rx.match(base):
                            why = "template"; notes.append(f"檔名樣板 {t}")
                            break
        if why == "basename" and path.rsplit("/", 1)[-1] in exact_basenames:
            why = None  # 同名檔已有完整路徑引用 → 這份是別處的副本（例：water_* 萬用字元灌進 /geo/water_resources/）
        if not why:
            unref.append((path, keys, "已同步、nginx 會供應，但 src 查無引用"))
            continue
        if path in ROOT_JSON and why != "exact":
            pass
        src = "refresh" if dom == "climate" else "manifest"
        add(path, keys, src, notes)

    # 3) src 引用了、但 S3 落地集合沒有的 /data 網址
    public = tree / "public"
    for p, locs in exact.items():
        if p in rows:
            continue
        route, rnote = nginx_route(p)
        in_public = (public / p.lstrip("/")).is_file()
        if route == "dist" or (route in ("fallback", "none") and in_public):
            dist_only.append(p)
            continue
        if route == "none":
            continue
        loc = sorted(locs)[0]
        note = f"對不到 S3（src {loc}）" + (f"：{KNOWN_UNMATCHED[p]}" if p in KNOWN_UNMATCHED else "")
        if route == "data" and in_public:
            note += "；public/ 有同名檔但此 location 無 dist fallback"
        add(p, [], "manifest", [note])
    # nginx 根層 json
    for p in ROOT_JSON:
        if p not in rows:
            keys = landed.get(p, [])
            note = [] if keys else ["nginx 有 location，但 pull 腳本未同步（S3 根層有檔）" if f"{PREFIX}{p[1:]}" in s3 else "S3 無"]
            add(p, keys, "nginx", note + ["src 查無引用"])
        elif p not in exact:
            rows[p] = (rows[p][0], "nginx", rows[p][2])

    out_rows = []
    for path in sorted(rows):
        keys, source, notes = rows[path]
        real = [k for k in keys if k[0]]
        uniq = list(dict.fromkeys(k[0] for k in real))
        if len(uniq) > 1:
            sizes = {s3.get(k, {}).get("size") for k in uniq}
            etags = {s3.get(k, {}).get("etag") for k in uniq}
            same = "內容相同（etag 一致）" if len(etags) == 1 else ("大小相同、etag 不同" if len(sizes) == 1 else "大小不同")
            notes = notes + [f"多對 {len(uniq)} 個 key（{'; '.join(f'{k[1]}:{k[0][len(PREFIX):]}' for k in real)}），{same}，以最後一條 sync 為準"]
        key = real[-1][0] if real else ""
        if key and key not in s3:
            notes = notes + ["pointer 指向的 key 在 S3 不存在"]
        meta = s3.get(key, {})
        pub = public / path.lstrip("/")
        if key and pub.is_file():
            same = "大小相同" if pub.stat().st_size == meta.get("size") else f"大小不同（git {pub.stat().st_size}）"
            notes = notes + [f"shadowed：public/ 也有 git 追蹤版（進 dist），{same}；今天 /data 優先"]
        size = meta.get("size", "")
        tar_sizes = [k[2] for k in real if k[1] == "rail-tar"]
        if tar_sizes:
            size = int(re.search(r"解壓後 (\d+)", tar_sizes[-1]).group(1))
        out_rows.append({"served_path": path, "s3_key": key, "size": size, "etag": meta.get("etag", ""),
                         "storage_class": meta.get("storage_class", ""), "source": source,
                         "note": " | ".join(dict.fromkeys(n for n in notes if n))})

    out_rows = [r for r in out_rows if domain_of(r["served_path"]) not in ROTATING]
    return out_rows, unref
