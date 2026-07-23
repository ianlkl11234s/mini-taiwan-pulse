# 樹冠高度 × 可及性分析（Canopy Height vs Accessibility）

> 分析日期：2026-07-23 · 一次性研究產出（非上線 feature）
>
> **問題**：台灣「最高的樹」是不是都長在 OSM 道路到不了、步道與林道很難到達的偏遠地方？

## 結論（TL;DR）

**成立，而且很極端。** 真正的巨木（樹冠 45–85m，去孤立雜訊後 7,823 個像素）離最近道路/步道/林道的**中位數 2,925m，是全體森林（425m）的約 7 倍**；89% 的巨木離任何可及線 > 1km（全體森林僅 34%）。效果在**控制海拔後仍成立**——同一海拔帶內樹高照樣隨距離上升，代表不是「偏遠只是因為海拔高」，而是可及性本身。

## 資料來源

| 資料 | 路徑 | 說明 |
|---|---|---|
| 樹冠高度 | `taipei-gis-analytics/data/processed/forestry/canopy_height_meta/canopy_height_taiwan_10m.tif` | Meta×WRI DINOv3 CHM v2，10m，uint8=公尺，EPSG:3857，本島 |
| OSM 車行路網 | `taipei-gis-analytics/data/processed/transportation/osm_road_drive/osm_road_drive_20260626.geojson` | 555,390 條 |
| 登山步道 | `mini-taiwan-pulse/public/forestry/hiking_trails.geojson` | 林業署國家步道系統 7,339 條 |
| 林道 | `mini-taiwan-pulse/public/forestry/forest_roads.geojson` | 林業署林道分布圖 107 條 |
| DEM | `taipei-gis-analytics/data/raw/base_map/dtm_20m/不分幅_台灣20MDEM(2024).tif` | 全台 20m，海拔分層用 |

## 方法

1. **合併可及線網**（道路＋步道＋林道）→ 投影 EPSG:3857 → rasterize 到 canopy 格網（`prep.sh`）
2. **距離場**：`gdal_proximity` 算每像素到最近可及線的公尺數（3857，事後 ×0.9157 校正到地面公尺）
3. **DEM 對齊**：warp 到 canopy 格網當海拔共變數
4. **聯合直方圖**：距離分箱 × 海拔帶 × 樹高，導出各箱百分位（`analyze.py`）
5. **巨木尾端**：抽 45–85m 像素，鄰域支持度過濾孤立尖點，比對其距離分布 vs 全體森林（`tail_giants.py`）

## 產出

| 檔案 | 內容 |
|---|---|
| `chart_distance_height.png` | 核心：距離 → 樹高 p50/p90/p95/p99（全單調上升，mean 5→15m） |
| `chart_elev_stratified.png` | 穩健性：同海拔帶內樹高仍隨距離上升（打掉海拔混淆） |
| `chart_giants_distance.png` | 巨木 vs 全體森林距離分布鏡像對照 |
| `giant_trees.geojson` | 7,823 個巨木點（height_m / dist_access_m / elev_m）——可接成 app 圖層 |
| `result_by_distance.csv` | 距離分箱統計表 |
| `tall_pixels_ge90.geojson` | 3 個 ≥90m 雜訊像素（診斷用） |

### 巨木距離統計

| 指標 | 全體森林 | 最高的樹（45m+） |
|---|---|---|
| 距最近可及線中位數 | 425 m | **2,925 m** |
| > 1 km 比例 | 34% | **89%** |
| > 2 km 比例 | 20% | **65%** |

最偏遠的巨木在中央山脈核心無路區（郡大／丹大一帶，海拔 2,000–2,560m 檜木／台灣杉帶），離任何可及線約 9km。

## 資料品質註記

- **149m 是雜訊**：全台 ≥90m 僅 3 個孤立像素，且在山區內陸非海岸 → 用邊界裁切救不了，改用 85m 物理上限 + 鄰域支持度過濾。45–74m（8,594 像素）物理可信，保留為真實巨木。
- **OSM 林道不完整**會灌水偏遠度（已納入林業署步道＋林道補強，但深山產業道路仍可能漏）→ 真實距離也許略小，方向不變。
- 路邊樹矮部分是「路邊本就是農田/開發地」而非純被砍 → 已被海拔分層＋只看巨木兩個分析繞開。
- 3857 距離已校正到地面公尺（×0.9157，cos 23.7°N）。

## 重現

```bash
bash scripts/prep.sh        # 產 dist.tif + dem_aligned.tif（重，數分鐘；中間檔未入庫）
python3 scripts/tall_diag.py    # 149m 雜訊診斷
python3 scripts/analyze.py      # 核心 + 海拔分層兩張圖
python3 scripts/tail_giants.py  # 巨木距離分布 + giant_trees.geojson
```

> 中間光柵（`dist.tif` 322MB / `dem_aligned.tif` 308MB / `*_3857.gpkg`）刻意不入庫，跑 `prep.sh` 重生。腳本內路徑為當時 scratchpad 絕對路徑，重跑前需改 `S=` 與輸入路徑。

## 後續

- ✅ **已接成 app 圖層 `canopyGiants`**（2026-07-24，走 layer-onboarding SOP）：靜態 GeoJSON 點層 `public/forestry/canopy_giants_taiwan.geojson`，側欄「林業 Forestry · 分區」，依 `dist_access_m` 5 級遠離度上色，含 opacity slider / 圖例 / 點擊 popup（樹高·離路距離·海拔）。驗收：tsc 綠 + 197 tests 綠 + browser（toggle→visible / 7,307 rendered / legend / popup）全過。**尚未 commit**（工作區與既有 canopy v2 WIP 並存，待 git 拍板）。
- ⬜ 巨木熱點對照已知神木群（拉拉山/司馬庫斯/棲蘭…）做交叉驗證。
