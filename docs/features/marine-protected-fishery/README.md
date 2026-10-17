# 海域保護與漁業 Marine Protected Areas & Fisheries

> **Slug**：`marine-protected-fishery`（analytics topic：`marine_protected_fishery`；Roadmap 第一批 G08）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：見 changelog.md

## 一句話說明

海洋主題新增「海域保護與漁業」群組 7 層：保護區範圍、開放捕魚點、海岸地區範圍與漁業區（魚礁中心點、定置漁業權區），全部是靜態檔，不跟時間軸。

## 圖層

| 名稱（layer key） | 型態 | 檔案 | 筆數 | 出典／授權 |
|---|---|---|---|---|
| 自然保留區（`natureReserves`） | 面 | `marine/nature_reserves.geojson`（1.0MB） | 24 | 農業部林業及自然保育署／OGDL 1.0 |
| 野生動物保護區（`wildlifeProtectedAreas`） | 面 | `marine/wildlife_protected_areas.geojson`（0.8MB） | 32 | 農業部林業及自然保育署／OGDL 1.0 |
| 開放捕魚點（`openFishingLocations`） | 點 | `marine/open_fishing_locations.geojson` | 155 | 海洋委員會海洋保育署／OGDL 1.0 |
| 海岸地區範圍（111 年版）（`coastalAreaExtents`） | 面 | `marine/coastal_area_extents.pmtiles`（0.9MB，z5–12） | 336／343 | 內政部國家公園署（data.gov.tw 20821）／OGDL 1.0 |
| 人工魚礁區（中心位置）（`artificialReefCenters`） | 點 | `marine/artificial_reef_areas.geojson` | 88 | 農業部漁業署／OGDL 1.0 |
| 保護礁區（中心位置）（`protectedReefCenters`） | 點 | `marine/protected_reef_areas.geojson` | 67／68 | 農業部漁業署／OGDL 1.0 |
| 定置漁業權區（`setNetFishingAreas`） | 面 | `marine/set_net_fishing_areas.geojson` | 65 | 農業部漁業署（114-08-05 版）／網站著作權聲明，未見開放授權 |

## 資料流

analytics `data/processed/marine/<dataset>/`（G08 資料層，PR #177）→ `scripts/preprocess/build-atlas-public.py`（7 個 `@layer`，只瘦身＋補 `source_org／source_url／license／fetched_at／vintage`）→ `public/marine/`（git 追蹤、隨 dist 部署；nginx `/marine/` 與 pull-deploy 已存在）。前端沿用 atlas 圖層框架（`ATLAS_LAYER_COLORS`／`ATLAS_NOTES`／`ATLAS_LEGENDS`／`ATLAS_PANELS`）。Supabase `reference.marine_*`（mig 475）是給 MCP 倉庫與分析用，前端不讀。

重產：

```bash
python3 scripts/preprocess/build-atlas-public.py --src <analytics>/data/processed \
  --only natureReserves wildlifeProtectedAreas openFishingLocations coastalAreaExtents artificialReefCenters protectedReefCenters setNetFishingAreas
```

## 必要標示（語意守門）

- 7 層彈窗最後一列都是「僅供參考，不構成法規適用判斷」，圖例說明也有。
- 開放捕魚點：「點位不代表可進入或安全；點位不是範圍」。
- 人工魚礁、保護礁：只畫中心點，圖層名、圖例與彈窗都標「中心位置，非範圍」；彈窗列出範圍規則原文、座標原文與點位依據（`vertex_mean` 為「所列頂點之平均位置（非官方中心）」）。不由範圍文字推畫圓、帶狀或方框。
- 海岸地區範圍：圖層名帶「111 年版」，彈窗標「非現行海岸線或管制」；不顯示來源 `source_area`（單位未記載）。
- 自然保留區、野生動物保護區：註明含陸域、日期是法定日期。
- 定置漁業權區：圖例出典改用 `legend.atlas.noteSourceLicense` 模板，寫「網站著作權聲明，未見開放授權」，不套 OGDL；彈窗另列授權列與「不代表現行許可、可否進入或航行安全」。

## 已知限制

- 保護礁區 68 處中 1 處（宜蘭保護礁禁漁區）來源只有地名描述、沒有座標，未上圖（圖例說明有寫）。
- 海岸地區範圍 343 面中 7 面（金門，source_row 235、328–333）面積不到 1 m²，是來源的退化面，任何縮放都畫不出，build 時排除並寫進圖例說明與 build audit；其餘 336 面依面積延後出現的縮放（小島礁放大才出現），逐 zoom 稽核：z5 88、z6 103、z7 131、z8 191、z9 239、z10 281、z11 310、z12 336，與應有筆數一致。
- PMTiles 切片用 `-r1 -pf -pk -pt --no-tile-size-limit`，不用 `--drop-densest`。
- 魚礁兩層都是圓點，以顏色區分（人工魚礁橘、保護礁褐），沒有另做形狀。
- 定置漁業權區授權未確認為開放授權；發布 master 前由使用者確認（2026-10-17 使用者決定照上、出典照實寫）。
