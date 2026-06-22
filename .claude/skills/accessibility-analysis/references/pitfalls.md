# Pitfalls — 可達性分析常見坑

> 這個 session（2026-06-21~22）學到的 7 大坑展開。新增 POI 前必讀。

---

## 1. Overpass 公開 mirror 全方位不穩

### 觀察
- `overpass-api.de`：白天歐美工作時段 cooldown / 短時間多打被 IP ban 24-72h（HTTP 406 / Connection refused）
- `overpass.kumi.systems`：簡單 query OK 但對全台 + subdivide 後某個 subquery 卡死沒回應（CPU 0% 持續數小時，無 socket timeout）
- `overpass.openstreetmap.fr`：白名單限定（HTTP 403 forbidden）

### 根因
osmnx 在 `graph_from_bbox` 對大 bbox 自動 subdivide 32-way（log 顯示 `This area is 32 times your configured Overpass max query area size`），32 個 subquery 序列跑 — 任一卡死全程式卡死。

### 對策
1. **Pipeline 應避開公開 mirror**：用本機 PBF 或私有 OSRM service（見 SKILL §5）
2. **加 `requests_timeout`**：`ox.settings.requests_timeout = 600`（但 connect timeout 卡時無效）
3. **若必須用公開 mirror**：選**亞洲時段晚上 21:00 後**跑，歐美 idle 命中率高
4. **cache 不可靠**：osmnx subdivide 的 cache key 跟 query body hash 有關，重跑可能因 subdivide 切法微差 miss

---

## 2. osmnx subdivide 是阿基里斯腱

### 觀察
全台 bbox（120.0-122.05 × 21.85-25.35）面積 80,000+ km² 遠超 osmnx 預設 `max_query_area_size = 2500 km²`，自動切 32 個 sub-bbox 序列跑。

### 對策
| 策略 | 操作 | 風險 |
|---|---|---|
| 調大上限 | `ox.settings.max_query_area_size = 100_000` | 單 query 可能太大被 mirror 拒 504 |
| 調小上限 | `= 1000`（切更多更小）| query 變 80+ 個，序列跑 ~40 min |
| 分縣手動 | 22 縣各自 bbox 跑 → graph compose_all | 縣界路網斷層需 buffer 重疊 |
| **本機 PBF** | 跳過 Overpass | 推薦正解 |

---

## 3. pyrosm 全台 driving 吃 50 GB RAM

### 觀察
`OSM(pbf, bbox).get_network(network_type="driving", nodes=True)` 對 309 MB 台灣 PBF 跑時：
- 第一個 step（parse + bbox filter）秒過
- 第二個 step（GeoDataFrame → to_graph networkx）**吃 50 GB RAM**
- macOS 觸發 swap，磁碟 5 GB free 不夠 swap → swap thrash → CPU 5% 假活著實則卡死

### 根因
`network_type="driving"` 包 motorway 到 residential 全 driveable 路網 — 估 100-200 萬 edges，networkx Graph 物件每 edge ~500 bytes → 50+ GB。

### 對策
1. **先 `osmium tags-filter` 預過濾 PBF**（`brew install osmium-tool`）：
   ```bash
   osmium tags-filter \
     taiwan-latest.osm.pbf \
     w/highway=motorway,trunk,primary,secondary,tertiary,unclassified \
     -o taiwan-filtered.osm.pbf
   ```
   過濾後 ~60-80 MB，pyrosm 讀只吃 ~10 GB RAM
2. **跑前 `df -h` 確認 ≥ 50 GB free**
3. **不要用 `network_type="driving+service"`** 含 residential 永遠爆

---

## 4. PMTiles 命名契約

### 痛點
Pipeline 跟 frontend 兩端對齊。Pipeline 改了 sourceLayer 名 / properties schema，前端會 silent fail（layer 看起來空白）。

### 契約（已寫在 SKILL §7）
```
檔名：{topic}_{bucket}_{metric}.pmtiles
sourceLayer：coverage_{bucket}     # tippecanoe --layer 對齊
properties.band：text，5 個 enum {"0-5km","5-10km","10-20km","20-30km","over-30km"}
properties.dist_m：int，原始 m 給 popup
```

### 驗證
PMTiles 出貨後用 `pmtiles tile <file> 8 200 100` 看 properties 是不是預期的；frontend 啟動後 Mapbox `map.querySourceFeatures(sourceId)` 看 layer 數是否非 0。

---

## 5. Whitelist > 反向定義

### 痛點
`gas_stations` 表 3,053 站，其中 374 站是 41455 商業司登記但 brand=`{unknown}` name=「XX 股份有限公司」— 實際非加油站（可能是停車場 / 公司辦公室 / 設備儲存場）。

如果「其他/私營」用反向定義（`NOT IN (中油/台塑/台糖)`）會把這些 false positive 全收進去。

### 對策
正向 whitelist regex：
```python
PRIVATE_NAME_RE = re.compile(r"山隆|速邁樂|台亞|西歐|統一精工|Smile|7-?Eleven|加油站|加油")
```

效果：
- 反向定義：665 站（含 374 false positive）
- whitelist：291 站（乾淨）

### 適用其他 POI
- 醫療：whitelist `醫院|診所|衛生所|藥局|藥房|長照`
- 教育：whitelist `國小|國中|高中|高職|大學|學校|幼兒園`
- 加油：上述
- 自定義時，先 `SELECT name, count(*) FROM ... WHERE 反向條件 GROUP BY name ORDER BY 2 DESC LIMIT 30` 看樣本決定 whitelist 字詞

---

## 6. 多 bucket 歸屬（SQL CASE 短路求值陷阱）

### 痛點
雙品牌站（如「中油+台糖」72 站、「中油+台塑」31 站、「台塑+台糖」1 站）用 SQL CASE WHEN 處理會短路：

```sql
CASE WHEN '中油' = ANY(brand) THEN 'cpc'        -- 中油+台糖 在這就停了
     WHEN '台塑' = ANY(brand) THEN 'fpcc'
     WHEN '台糖' = ANY(brand) THEN 'taisugar'   -- 永遠到不了
END
```

結果：73 個雙品牌「台糖」站永遠不會進 `taisugar` bucket，只進 `cpc`。

### 對策
Python 端 list-of-buckets：
```python
def buckets_of(brand_arr, name):
    bs = []
    if "中油" in (brand_arr or []): bs.append("cpc")
    if "台塑" in (brand_arr or []) or "Formosa" in (brand_arr or []): bs.append("fpcc")
    if "台糖" in (brand_arr or []): bs.append("taisugar")
    if not bs and name and PRIVATE_NAME_RE.search(name): bs.append("other")
    return bs
```

每站可進多 bucket。後面 dijkstra 對每 bucket 跑一次，雙品牌站貢獻多個 source。

### 影響數字（加油站案例）
- CPC: 1,988 (不變)
- FPCC: 319 → **351** (+31+1)
- 台糖: 13 → **86** (+72+1) — **6.5x 提升**，覆蓋率從 50% 到接近 99%

---

## 7. 磁碟空間警戒

### 痛點
這 session 用戶筆電磁碟 100% 滿（926 GB 用 854 GB / free 5 GB）。pyrosm 吃 50 GB RAM 時 macOS swap → 磁碟滿不夠 swap → swap thrash → CPU 5% 假活著。

### 預檢
```bash
df -h ~
# 確認 free ≥ 50 GB
# 跑 pipeline 需中間檔 ndjson ×5 約 1-2 GB / PMTiles ×5 約 25 MB
# pyrosm 跑全台需 RAM 10-50 GB（swap 後也要 disk 同等）
```

### 救援
跑前清磁碟：
- `~/Library/Caches/` 老 build cache
- Docker images（`docker system prune -a`）
- Xcode DerivedData（`~/Library/Developer/Xcode/DerivedData`）
- 老 PBF / 中間檔（`taipei-gis-analytics/data/raw/osm/*.pbf`）
- `~/Library/Developer/CoreSimulator/Devices/`
