# 原民文化健康站 Indigenous Cultural Health Stations（G20）

> **Slug**：`cultural-health-stations`
> **狀態**：dev（等 PR review）
> **Owner**：migu
> **相關 PR**：#689
> **上游**：taipei-gis-analytics `docs/topic-research/cultural_health_stations/`（layer-plan.md）；來源原民會文化健康站通訊錄（data.gov.tw 157725，2025-07-22 版，政府資料開放授權條款第 1 版）

## 一句話說明

全國 525 個文健站放在「社福長照 → 長照與托育」，layer key `culturalHealthStations`，檔案 `public/welfare/cultural_health_stations.geojson`（250 features，約 140 KB，進 git、隨 dist 供檔）。

## 兩種點（250 features ≠ 525 站）

| kind | 數量 | 畫法 | 意義 |
|---|--:|---|---|
| `site` | 191 | 實心點 | 依地址定位（門牌點等） |
| `township_group` | 59 群（334 站） | 空心圈，半徑隨 √站數，z8 起圈內顯示站數 | 地址只到村里／鄰或 geocoder 未命中，**只畫在鄉鎮中心**；同鄉鎮合併成一圈 |

- 彈窗：空心圈標題寫「（僅到鄉鎮，N 站）」，注意列寫「位置僅到鄉鎮（畫在鄉鎮中心），非各站實際位置；不可用來量距離」，列出站名；實心點列地址、行政區、座標來源、通訊錄日期。
- **不顯示電話**：`build-atlas-public.py` 遇到電話欄會中止；成品沒有電話、聯絡人欄。
- 精確點中有 1 組重複座標（2 站同址），未偏移。
- 側欄可用「定位精度」多選只看其中一種。

## 重產

```bash
python3 scripts/preprocess/build-atlas-public.py --only culturalHealthStations
```
