---
name: accessibility-analysis
description: 服務可達性分析工具箱（accessibility / service coverage）。當用戶說「30km 路網可達」「最近 X 站」「服務範圍」「沙漠」「孤島」「等時圈」「isochrone」「可達性分析」「路網覆蓋」或要新增任何「離 POI 多遠」類型的分析時觸發。整合 mini-taiwan-pulse + taipei-gis-analytics 兩端 SOP，覆蓋三種視覺模式（路網染色 / Polygon 沿路網 / Hex 格點）、三套既有 reference pipeline 對照、模式選擇決策樹、常見坑（Overpass mirror 不穩 / pyrosm 爆 RAM / multi-bucket / whitelist）。新增 POI 類型（加油站 / 醫療 / 消防 / 充電站 / 警局 / 學校）做可達分析時用。允許只跑 pipeline 不接前端，也允許 pipeline 已備好只做前端接線。
user_invocable: true
---

# 可達性分析工具箱

> Service Accessibility / Coverage Analysis Toolkit

回答「**從這個點到最近 X 多遠 / 多久**」、「**X 的服務範圍是哪一片**」、「**哪裡是 X 沙漠 / 孤島**」這類問題。

---

## 🚨 卡了就讀：`references/troubleshooting.md`

> 跑可達分析 pipeline 容易遇到 Overpass mirror 卡 / pyrosm 爆 RAM / cache miss / silent stall。
> **跑前 30 秒健康檢查 + 卡時 5 分鐘診斷流程 + 6 條 pipeline 寫法守則** 全在那個檔。
> 這 session 因為沒這份 checklist 卡了 8 小時 + 反覆 retry — **不能再忘**。

---

## ⚠️ 兩大鐵則（新 POI 一定要過，否則資料會錯）

> 這 session 學到的兩個血淚教訓 — 任何「最近 X」分析的 SQL → Python 邊界都會碰到。
> 看到「按 brand / category 分 layer」的需求，**先讀本節**再寫 SQL。

### 鐵則 #1：Multi-bucket 歸屬（**不要用 SQL `CASE WHEN`**）

**症狀**：雙身分的 POI（如「中油+台糖」加油站 73 站）只進第一個匹配 bucket，後面所有 layer 永遠收不到。

**根因**：SQL `CASE WHEN ... WHEN ... ELSE` 是**短路求值**，匹配第一個就停。

**❌ 錯誤寫法**：
```sql
CASE WHEN '中油' = ANY(brand) THEN 'cpc'           -- 中油+台糖 在這就停了
     WHEN '台塑' = ANY(brand) THEN 'fpcc'
     WHEN '台糖' = ANY(brand) THEN 'taisugar'      -- 雙品牌站永遠到不了
END
```

**✅ 正確寫法（Python 端 list-of-buckets）**：
```sql
-- SQL 只回原始 brand[] / categories[] 不分類
SELECT id, name, brand, ...
```

```python
def buckets_of(brand_arr, name):
    bs = []
    if "中油" in (brand_arr or []): bs.append("cpc")
    if "台塑" in (brand_arr or []) or "Formosa" in (brand_arr or []): bs.append("fpcc")
    if "台糖" in (brand_arr or []): bs.append("taisugar")
    # 不在三大才考慮 other（避免 cpc 站重複進 other）
    if not bs and name and PRIVATE_NAME_RE.search(name): bs.append("other")
    return bs

# 每站可進多 bucket
for r in poi: r["_buckets"] = buckets_of(r.get("brand"), r.get("name"))

# dijkstra source 自然多 bucket
buckets = defaultdict(list)
for n, r in zip(nn, poi):
    for b in r["_buckets"]:
        buckets[b].append(n)
```

**影響數字（加油站本 session 案例）**：
- 台糖：13 站 → **86 站**（+73 雙品牌，覆蓋率 50% → 59%）
- 台塑：319 站 → 350 站（+31）

---

### 鐵則 #2：Whitelist > 反向定義（**「其他」不要用 NOT IN**）

**症狀**：「其他/私營」layer 收進 374 個 41455 商業司登記但實際非加油站的 false positive（停車場 / 公司辦公室 / 設備儲存場）。

**根因**：政府 raw 資料的「name 含『加油站』」是 ground truth，「brand=`{unknown}`」是雜訊。

**❌ 錯誤寫法**：
```sql
-- 把所有不是三大品牌的當「私營」
WHERE NOT ('中油' = ANY(brand) OR '台塑' = ANY(brand) OR '台糖' = ANY(brand))
-- → 665 站，含 374 false positive
```

**✅ 正確寫法（Python whitelist regex）**：
```python
import re

# Whitelist — 看 SQL 樣本決定字詞
# SELECT name, count(*) FROM ... WHERE 反向條件 GROUP BY name ORDER BY 2 DESC LIMIT 30
PRIVATE_NAME_RE = re.compile(r"山隆|速邁樂|台亞|西歐|統一精工|Smile|7-?Eleven|加油站|加油")

# 在 buckets_of() 內套用（見鐵則 #1 範本）
if not bs and name and PRIVATE_NAME_RE.search(name):
    bs.append("other")
```

**影響數字（加油站本 session 案例）**：
- 「其他/私營」：665 → **292 站**（去 374 false positive）
- 「全加油站」：3,010 → 2,612（也清乾淨）

**Whitelist 字詞怎麼選**：

| POI 類型 | 推薦 regex |
|---|---|
| 加油站 | `山隆\|速邁樂\|台亞\|西歐\|統一精工\|Smile\|7-?Eleven\|加油站\|加油` |
| 醫療 | `醫院\|診所\|衛生所\|藥局\|藥房\|長照\|護理` |
| 教育 | `國小\|國中\|高中\|高職\|大學\|學校\|幼兒園\|托嬰` |
| 警消 | `分隊\|派出所\|警察局\|消防局\|分局` |
| 自定義 | 先跑 `SELECT name, count(*) ... GROUP BY name ORDER BY 2 DESC LIMIT 30` 看樣本 |

---

### 兩個鐵則合體 — 完整 buckets_of 函式（**copy 這個改**）

```python
import re

# ★ 改：依 POI 類型調整 whitelist regex
PRIVATE_NAME_RE = re.compile(r"<your-pattern-here>")

# ★ 改：依 POI 類型調整 bucket 邏輯（可有 0 到多個 bucket）
def buckets_of(brand_arr, name):
    bs = []
    # 已知大品牌（多 bucket）
    if "<品牌 A>" in (brand_arr or []): bs.append("brand_a")
    if "<品牌 B>" in (brand_arr or []): bs.append("brand_b")
    # ...
    # 不在已知品牌才落到 other（whitelist 過濾 false positive）
    if not bs and name and PRIVATE_NAME_RE.search(name):
        bs.append("other")
    return bs

# 套用：每站可進多 bucket，false positive 自動丟掉
for r in poi:
    r["_buckets"] = buckets_of(r.get("brand"), r.get("name"))
poi = [r for r in poi if r["_buckets"]]   # 過 false positive
```

---

## 0. TL;DR — 何時用這個 SKILL

| 觸發場景 | 用這個 SKILL |
|---|---|
| 新增 POI（加油站 / 醫療 / 消防 / 充電站 / 警局 / 學校）的「最近站距離」分析 | ✅ |
| 既有覆蓋層要改色 / 改算法 / 改視覺模式 | ✅ |
| 跨服務疊圖（如「醫療沙漠 ∩ EV 孤島 ∩ 火災密集」三角分析） | ✅ |
| 單純看 POI 位置點分布（無「最近距離」概念） | ❌ → 走 `/new-layer` skill |
| 即時時序資料染色（非空間累積） | ❌ → 走 `dynamic-layer` 相關 |

**核心原則**：可達性分析是「**空間 × 距離函數**」的視覺化，pipeline 跟前端是兩端，**允許獨立操作**：
- 只要新 PMTiles 出貨 → 前端把 sourceUrl 換掉就上線（資料端 SOP）
- 只要前端 layer 框架就緒 → pipeline 慢慢補不阻塞（前端端 SOP）

---

## 1. 三種視覺模式（選一）

### Mode A — 路網染色 LineString

```
每條 OSM edge 染「到最近 source 的路網距離」5 級色階
0-5km 深綠 / 5-10km 草綠 / 10-20km 黃 / 20-30km 橙 / >30km 紅
```

- **回答**：「我站在這條路上，最近 X 站幾 km」
- **視覺**：沿路網細線染色，像血管圖
- **演算法**：osmnx / pyrosm → networkx graph → **multi-source dijkstra** → 每 edge band
- **範例**：加油站 30km coverage（本 session）/ 充電站孤島
- **適合 POI**：開車能到的（加油 / 充電 / 服務區）
- **不適合**：步行 POI（路網不對）/ 不沿路網的服務（直線距離概念）

### Mode B — Polygon 沿路網外殼

```
每 source 站算可達點集 → concave_hull / alpha shape → 圍 polygon
然後 union 多站成「服務範圍區塊」
```

- **回答**：「X 的服務範圍是哪一片？」
- **視覺**：半透明覆蓋區 + outline
- **演算法**：osmnx ego_graph 或 OSRM /table grid sample → concave_hull → unary_union
- **範例**：fire isochrone 救援等時圈 / flood sensor 步行 3min
- **適合 POI**：以「站」為單位看服務範圍（消防 / 醫療 / 救援）
- **不適合**：超多站（hull 計算貴 + 視覺重疊互相覆蓋）

### Mode C — Hex / Grid 格點

```
全台 H3 hex（z8 ~460m）或 1km grid
每 cell 標「最近站路網距離」或「覆蓋站數」
```

- **回答**：「跨服務聚合 / 沙漠在哪 / 哪裡有 N 個站可達」
- **視覺**：馬賽克格點，跨服務疊圖容易（hex id 一致）
- **演算法**：每 cell centroid → nearest_node → multi-source dijkstra
- **範例**：medical isochrone grid_accessibility / 醫療沙漠
- **適合**：跨服務疊圖 / 跨指標統計
- **不適合**：細緻路網語意（馬賽克視覺粗糙）

### 決策樹

```
要回答的問題是什麼？
├─ 「最近站幾 km」                    → Mode A
├─ 「服務範圍是哪一片」                → Mode B
├─ 「跨服務疊圖 / 沙漠 / 統計」         → Mode C
└─ 多個都要                          → 三種都做（hex 底圖 + path overlay + polygon outline）
```

完整對照見 `references/mode-comparison.md`。

---

## 2. 兩個 repo 三個 SOP

```
┌────────────────────────────┐         ┌──────────────────────────────┐
│  taipei-gis-analytics      │         │  mini-taiwan-pulse           │
│  (data side)               │  PMTiles│  (frontend side)             │
│                            │  ──→    │                              │
│  Pipeline → GeoJSON →      │  S3 /   │  overlayRegistry helper →    │
│  tippecanoe → PMTiles      │  public/│  5 級色階 paint →             │
│                            │         │  LegendPanel + Panel + test  │
└────────────────────────────┘         └──────────────────────────────┘
```

| SOP | 位置 | 何時用 |
|---|---|---|
| **SOP-1 Pipeline** | `taipei-gis-analytics/scripts/road_isochrone/` | 生成 / 更新 / 重跑資料 |
| **SOP-2 PMTiles 發佈** | tippecanoe + S3 deploy-assets 或 `mini-taiwan-pulse/public/coverage/` | Pipeline 完成後 |
| **SOP-3 Frontend** | `mini-taiwan-pulse/src/map/overlayRegistry.ts` + 周邊 | 接 layer + sidebar toggle + popup |

三個 SOP **可獨立執行**：
- 換色 / 改 paint：只動 SOP-3
- 換資料源 / 加新 POI：跑 SOP-1+2，SOP-3 只改 sourceUrl
- 全套新功能：三個都跑

詳細各 SOP 步驟見 `references/sop-pipeline.md` / `references/sop-publish.md` / `references/sop-frontend.md`。

---

## 3. 三套既有 Reference Pipeline

| Mode | Script | POI | 規模 | 跑時 |
|---|---|---|---|---|
| **A** | `scripts/road_isochrone/taiwan_nearest_distance.py` | 加油站 / EV | 6,058 站 / 75K edges | ~10 min（順）/ ~∞（mirror 卡）|
| **A** | `scripts/road_isochrone/yunlin_nearest_distance.py` | 同上但縣界 POC | 1,033 + 605 | ~2 min |
| **B** | `pipelines/water_resources/flood_sensors/10_walking_isochrone_3min.py` | USWG 淹水感測器 | 174 站 | ~5 min |
| **B** | `scripts/fetch/fetch-fire-isochrones.py` | 消防分隊救援等時圈 | 全台分隊 | ~30 min |
| **C** | `pipelines/poi/medical/isochrone/grid_accessibility.py` | 醫療機構 | 醫院/診所/藥局/AED/LTC | ~1-2h |

新增 POI 時：**clone 最像的，改 SQL + 改 bucket 邏輯**。

---

## 4. 常見坑（這 session 學到的，含未來如何避）

詳見 `references/pitfalls.md`，這裡列前 7 大：

1. **Overpass mirror 不穩** — `overpass-api.de` 被 IP ban（406）/ `kumi.systems` 大 subquery 卡 / `overpass.openstreetmap.fr` whitelist only（403）
   - **解法**：生產 pipeline 應避開公開 mirror。三條救援路徑見 §5。

2. **osmnx subdivide 是阿基里斯腱** — 全台 bbox 切 32 subquery 序列跑，任一卡死全卡，無 socket timeout
   - **解法**：(a) 設 `ox.settings.max_query_area_size` 切更小 / (b) 用本機 PBF 避開 / (c) 分縣跑

3. **pyrosm 全台 driving 吃 50 GB RAM** — 含 residential 直接爆
   - **解法**：先 `osmium tags-filter` 過濾（留 motorway-unclassified）才用 pyrosm 讀

4. **PMTiles 命名契約** — sourceLayer / properties schema 在 pipeline 跟 frontend 必須對齊
   - **解法**：寫死在 SKILL 範本，clone 必改

5. **Whitelist > 反向定義** — 「其他/私營」反向定義（非三大品牌）會吃進 41455 false positive；用 whitelist regex 才乾淨
   - **解法**：見 §6 範本 `PRIVATE_NAME_RE`

6. **多 bucket 歸屬** — 雙品牌站（如「中油+台糖」）SQL CASE 短路求值會吃掉，要 Python 端 list-of-buckets
   - **解法**：見 §6 範本 `buckets_of()`

7. **磁碟空間** — pyrosm + ndjson 中間檔需 ~5 GB free，否則 swap thrash
   - **解法**：跑前 `df -h` 看 free ≥ 50 GB

---

## 5. Pipeline 救援路徑（Mirror 失靈時）

當 Overpass 公開 mirror 全卡，按此優先順序：

| 路徑 | 工具 | 時間 | 適用情境 |
|---|---|---|---|
| **5.1 預設 mirror retry** | osmnx + overpass-api.de | 10 min | 通常 cooldown 24-72h 自然解 |
| **5.2 切其他 mirror** | osmnx + kumi / fr | 視運氣 | 不穩，但偶爾成功 |
| **5.3 本機 PBF + osmium 預過濾** | osmium-tool + pyrosm | 30 min（含 install）| Mirror 全掛時的正解 |
| **5.4 既有 osrm-taiwan service** | OSRM /table grid sample | ~1h on zeabur | 不吃本機 RAM/磁碟 |
| **5.5 PostGIS pgr_drivingDistance** | gis-platform DB | 一次性投入大 | 真正的長期解 |

完整實作見 `references/mirror-fallback.md`。

---

## 6. Pipeline 範本（Mode A — multi-source dijkstra）

```python
#!/usr/bin/env python3
"""
{POI 名} 最近站路網距離 pipeline (Mode A).
"""
import os, json, time, subprocess, re
from collections import defaultdict
from pathlib import Path
import osmnx as ox
import networkx as nx
from pyproj import Transformer

# ── config ──────────────────────────────────
DATABASE_URL = os.environ["DATABASE_URL"]
if os.environ.get("OVERPASS_URL"):
    ox.settings.overpass_url = os.environ["OVERPASS_URL"]
ox.settings.requests_timeout = 600
ox.settings.use_cache = True
TW_MAIN_BBOX = (120.00, 21.85, 122.05, 25.35)
CUSTOM_FILTER = '["highway"~"motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link"]'
DIST_BANDS = [(5000, "0-5km"), (10000, "5-10km"), (20000, "10-20km"), (30000, "20-30km")]
OVER_BAND = "over-30km"

# ── 1. 抓路網 + 投影 ────────────────────────
G = ox.graph_from_bbox(bbox=TW_MAIN_BBOX, custom_filter=CUSTOM_FILTER, simplify=True)
G = ox.project_graph(G, to_crs="EPSG:3826")

# ── 2. 拉 stations（自訂 SQL）────────────────
def psql_json(sql):
    out = subprocess.run(["psql", DATABASE_URL, "-A", "-t", "-c",
        f"SELECT json_agg(row_to_json(t)) FROM ({sql}) t"],
        capture_output=True, text=True, check=True).stdout.strip()
    return json.loads(out) if out else []

# 取得 station list，含 brand[] / name 兩欄
poi = psql_json("""SELECT id, name, brand, ST_X(geom) AS lng, ST_Y(geom) AS lat
  FROM energy.gas_stations""")

# Whitelist regex — 篩掉 41455 false positive
PRIVATE_NAME_RE = re.compile(r"山隆|速邁樂|台亞|西歐|統一精工|Smile|7-?Eleven|加油站|加油")

# Multi-bucket 歸屬 — 雙品牌站同進多 bucket
def buckets_of(brand_arr, name):
    bs = []
    if "中油" in (brand_arr or []): bs.append("cpc")
    if "台塑" in (brand_arr or []) or "Formosa" in (brand_arr or []): bs.append("fpcc")
    if "台糖" in (brand_arr or []): bs.append("taisugar")
    if not bs and name and PRIVATE_NAME_RE.search(name): bs.append("other")
    return bs

for r in poi: r["_buckets"] = buckets_of(r.get("brand"), r.get("name"))
poi = [r for r in poi if r["_buckets"]]  # 過 false positive

# ── 3. nearest_node + multi-source dijkstra ──
to_tm2 = Transformer.from_crs("EPSG:4326", "EPSG:3826", always_xy=True)
xs, ys = zip(*[to_tm2.transform(r["lng"], r["lat"]) for r in poi])
nn = list(ox.distance.nearest_nodes(G, xs, ys))

buckets = defaultdict(list)
for n, r in zip(nn, poi):
    for b in r["_buckets"]: buckets[b].append(n)
buckets["all"] = nn

node_dist = {}
for bucket, sources in buckets.items():
    node_dist[bucket] = nx.multi_source_dijkstra_path_length(
        G, set(sources), cutoff=DIST_BANDS[-1][0], weight="length"
    )

# ── 4. edge band → ndjson streaming ──────────
G_wgs = ox.project_graph(G, to_crs="EPSG:4326")
def band_for(d):
    if d is None: return OVER_BAND
    for limit, label in DIST_BANDS:
        if d <= limit: return label
    return OVER_BAND

# ... 5 個 bucket 寫 5 個 ndjson + tippecanoe
```

完整 `pipeline-template.py` 在 `scripts/pipeline-template.py`，可直接 copy 改 SQL + bucket 邏輯。

---

## 7. PMTiles 命名契約

新 POI 必須遵守，否則前端 swap 不無痛：

```
檔名：{topic}_{bucket}_{metric}.pmtiles
   topic   = gas / ev / fire / medical / police / school / ...
   bucket  = all / cpc / fpcc / hospital / clinic / ...
   metric  = nearest / coverage / isochrone

sourceLayer：coverage_{bucket}        # tippecanoe --layer
properties：
   band       text  必填   "0-5km" / "5-10km" / "10-20km" / "20-30km" / "over-30km"
   dist_m     int   可選   原始距離 m（給 popup 顯示用）

minzoom 6 / maxzoom 12  # 全台範圍對應 zoom
```

---

## 8. Frontend 5 處 SOP

仿 fossil fuel 化石燃料 14 layer pattern，**11 處改動**：

1. `src/types/index.ts` — `LayerVisibility` +5 key + `FeatureInfo.layerType` union +5
2. `src/hooks/useLayerVisibility.ts` — 預設 false（量大避免初始載入）
3. `src/map/overlayRegistry.ts` — 用 `gasCoverageOverlay()` helper（已存在於 `overlayRegistry.ts:35`）clone 改 sourceUrl + sourceLayer + paletteKey
4. `src/hooks/useTransportParams.ts` — +5 opacity slider + 5 lineWidth slider
5. `src/components/sidebar/layerCatalog.ts` — SECTIONS 加 sub-group + LAYER_COLORS +5
6. `src/components/featureInfo/energyPanels.tsx`（或對應 panel 檔）— 5 panel 顯示 dist_m + band
7. `src/components/featureInfo/registry.tsx` — PANEL_REGISTRY +5 + HEADER_LABELS +5
8. `src/hooks/useMapInteraction.ts` — 5 click handler
9. `src/components/sidebar/LegendPanel.tsx` `CoverageLegend` — 加 5 級色階 swatches
10. `src/components/sidebar/__tests__/layerConsistency.test.ts` — 確認 5 key
11. `npx tsc -b && npm test` 必過

詳細範本 + 既有實作位置見 `references/sop-frontend.md`。

---

## 9. 新增 POI 類型 checklist

```
跑前健康檢查（30 秒 — 看 troubleshooting.md §跑前）
[ ] ★ curl 測 3 個 Overpass mirror 至少一個回 200
[ ] ★ df -h 確認 free ≥ 50 GB
[ ] ★ 若 retry：grep CUSTOM_FILTER / BBOX / OVERPASS_URL 跟上次成功的對齊

資料邏輯（最容易踩雷）
[ ] ★ MUST — buckets_of() 用 Python list-of-buckets 不用 SQL CASE（鐵則 #1）
[ ] ★ MUST — PRIVATE_NAME_RE whitelist 不用 NOT IN 反向定義（鐵則 #2）
[ ] 跑 SELECT name, count(*) GROUP BY 看樣本決定 whitelist 字詞
[ ] 驗證雙身分 POI 確實進多 bucket（grep 一筆親自確認）

Pipeline
[ ] 決定 Mode A/B/C（依 §1 決策樹）
[ ] 確認資料源（Supabase RPC / table）
[ ] Clone 最像的 reference pipeline（§3 表）
[ ] 改 SQL + buckets_of() + PRIVATE_NAME_RE
[ ] script 必加 progress log（troubleshooting.md §預防）
[ ] 跑 pipeline 出 GeoJSON + PMTiles
[ ] PMTiles 命名對齊契約 §7（檔名/sourceLayer/properties）

長跑監控（卡 → troubleshooting.md §真卡了）
[ ] 若 > 30 min 無 cache 增量 / log 進度 → kill，不要被動等
[ ] CPU=0% + alive 用 sample <PID> 看 stack 確認是 socket 卡

發佈
[ ] PMTiles 上 S3 或放 public/coverage/

Frontend（如要前端接，否則跳）
[ ] Frontend 11 處 SOP（§8）
[ ] tsc + test 過
[ ] browser 視覺驗收（先 "All Off" 再單獨開新 layer）

收尾
[ ] commit + push（pipeline 不 commit 中間檔，只 commit script）
[ ] 若發現新的 bucket 模式 / whitelist 字詞 / 卡點 / mirror 變動，回更新本 SKILL
```

---

## 10. 關聯 SKILL / 規則

- `/new-layer` — 純 POI 點層（不含可達分析）走它
- `/check-rpc` — 跑 EXPLAIN 看 RPC 效能
- `/supabase-optimize` — pre-aggregate pattern
- `/wrap-up` — session 收尾
- `mini-taiwan-pulse/CLAUDE.md §5` — 新增 Layer 強制順序
- `mini-taiwan-pulse/CLAUDE.md §5a` — UX 四鐵則
- `gis-data-onboard` — 資料生命週期決策

---

## 主動更新時機

當下列情況發生時，提醒用戶或 next session 更新此 SKILL：

- 新增第四種視覺模式 → 更新 §1
- 新增 reference pipeline → 更新 §3 表 + clone source
- 新坑出現 → 更新 §4 / `pitfalls.md`
- mirror 環境變更（新 mirror / 舊 mirror 永久下線）→ 更新 §5 救援表
- PMTiles 命名契約改 → 更新 §7
- frontend SOP 路徑變動 → 更新 §8 + `sop-frontend.md`
