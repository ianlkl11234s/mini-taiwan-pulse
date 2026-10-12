# atlas 批次點線面圖層 Atlas Layers

> **Slug**：`atlas-layers`（analytics topic：`atlas-batch-2026-10`）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：見 changelog.md

## 一句話說明

把 atlas 批次 2026-10 的 26 個點、線、面 dataset 接上地圖：原民與農村、道路設施、淹水與土砂災害照片、海洋、地名、水利設施。另 7 個 dataset 是非空間表或維度表，不上圖（見下）。

## 圖層

| 名稱（layer key） | 型態 | 檔案 | 主題 › 群組 |
|---|---|---|---|
| 原住民族部落（`indigenousTribes`） | 點 | `indigenous_rural/indigenous_tribes.geojson` | 原民與農村 › 原住民族 |
| 原鄉易成孤島地區（`indigenousIsolationRisk`） | 點 | `indigenous_rural/indigenous_isolation_risk_areas.geojson` | 原民與農村 › 原住民族 |
| 農村社區分類（`agriRuralCommunityVillages`） | 面 | `indigenous_rural/rural_community_villages.pmtiles`（5.1MB，z7–12） | 原民與農村 › 農村 |
| 省道交通標誌（`provincialRoadSigns`） | 點 | `geo/provincial_road_signs.pmtiles`（7.7MB，z9–14） | 交通 › 道路設施 |
| 省道里程牌（`provincialRoadMileposts`） | 點 | `geo/provincial_road_mileposts.pmtiles`（6.3MB，z11–14） | 交通 › 道路設施 |
| 國道交通標誌（`freewayTrafficSigns`） | 點 | `geo/freeway_traffic_signs.pmtiles`（6.8MB，z10–14） | 交通 › 道路設施 |
| 國道交流道（`freewayInterchanges`） | 點 | `geo/freeway_interchanges.geojson` | 交通 › 道路設施 |
| 國道生態敏感路段（`freewayEcoSensitive`） | 面 | `geo/freeway_eco_sensitive_sections.geojson` | 交通 › 道路設施 |
| 省道防救災監控路段（`provincialRoadMonitored`） | 線＋點 | `geo/provincial_road_monitored_sections.pmtiles`（0.3MB，z8–12） | 交通 › 道路設施 |
| 省道緊急避車彎（`provincialRoadEmergencyBays`） | 點＋線 | `geo/provincial_road_emergency_bays.geojson` | 交通 › 道路設施 |
| 淹水災點（`floodDisasterPointsNcdr`） | 點 | `hazards/flood_disaster_points_ncdr.pmtiles`（1.5MB，z5–12） | 災害 › 淹水 |
| 臺北市歷年積水範圍（`taipeiWaterloggingHistory`） | 面 | `hazards/taipei_waterlogging_history.geojson` | 災害 › 淹水 |
| 土砂災害照片點位（`swcbDisasterPhotoPoints`） | 點 | `hazards/swcb_disaster_photo_points.pmtiles`（15.9MB，z5–12） | 災害 › 崩塌 |
| 鯨豚擱淺（`cetaceanStrandings`） | 點 | `marine/cetacean_strandings.geojson` | 海洋 › 擱淺 |
| 海龜擱淺（`seaTurtleStrandings`） | 點 | `marine/sea_turtle_strandings.geojson` | 海洋 › 擱淺 |
| 海水浴場水質（`beachWaterQuality`） | 點 | `marine/beach_water_quality.geojson` | 海洋 › 海域環境 |
| 海洋微塑膠調查站（`marineMicroplastics`） | 點 | `marine/marine_microplastics_stations.geojson` | 海洋 › 海域環境 |
| 海洋污染事件（`marinePollutionIncidents`） | 點 | `marine/marine_pollution_incidents.geojson` | 海洋 › 海域環境 |
| 環境 DNA 調查站位（`namrEdnaSurveySites`） | 點 | `marine/namr_edna_survey_sites.geojson` | 海洋 › 調查站網 |
| 臺灣地名（`placeNames`） | 點 | `geo/place_names_moi.pmtiles`（15.1MB，z9–14） | 底圖 › 地名 |
| 三角點（`triangulationPoints`） | 點 | `geo/triangulation_points_moi.geojson` | 底圖 › 地名 |
| 中央管水門（`wraFloodgatesCentral`） | 點 | `geo/wra_floodgates_central.geojson` | 水資源 › 水利設施 |
| 中央管區域排水（`wraCentralDrainage`） | 面 | `geo/wra_central_drainage.geojson` | 水資源 › 水利設施 |
| 水利結構監測站（`iowStructureMonitoring`） | 點 | `geo/wra_iow_structure_monitoring.geojson` | 水資源 › 水利設施 |
| 河川疏濬工程（`wraDredgingPoints`） | 點 | `geo/wra_dredging_points.geojson` | 水資源 › 水利設施 |
| 河川生態調查站（`wraEcologySurveySites`） | 點 | `geo/wra_ecology_survey_sites.geojson` | 水資源 › 水利設施 |

新主題「原民與農村 Indigenous & Rural」「海洋 Marine」與 Statistics 分頁的同名主題對齊。

## 部署

- 全部檔案 git 追蹤、隨 dist 供檔，不上 S3（PMTiles 最大 15.9MB，比照酒駕事故 13MB、Ookla 16MB 前例）。
- 新目錄 `indigenous_rural/`、`marine/`：nginx 新增 location（`root /data` + `try_files $uri @dist`，同 hazards）、pull 腳本補同構 sync（S3 前綴空＝no-op）。
- 水利 GeoJSON 刻意命名 `geo/wra_*`：`public/geo/water_*.geojson` 在 .gitignore 且走 S3 glob，用 `wra_` 前綴才能 git 追蹤走 dist。
- `geo/*.pmtiles` 也會被 upload 腳本 glob 推上 S3 geo/（若有人跑整支 upload；與 dist 內容相同，無害）。

## PMTiles 逐 zoom 稽核（tippecanoe 2.79）

點 `-r1 -pf -pk`；線／面 `-r1 -pf -pk -pt`；**不用 --drop-densest**。`tippecanoe-decode` 逐 zoom 數不重複 id：

| 圖層 | zoom | 每層筆數 |
|---|---|---|
| 農村社區 | z7–12 | 4,271（全部） |
| 省道標誌 | z9–14 | 22,522 |
| 省道里程牌 | z11–14 | 30,098 |
| 國道標誌 | z10–14 | 51,405 |
| 監控路段 | z8–12 | 110（z5–7 極短路段退化成點會被丟 → 改 z8 起） |
| 淹水災點 | z5–12 | 8,646 |
| 土砂照片 | z5–12 | 34,419 |
| 地名 | z9–11／z12–13／z14 | 994（自然）／30,320（＋村里、聚落）／36,431（＋地標）＝依 feature minzoom 應有筆數 |

## 不上圖的 dataset

| dataset | 理由 |
|---|---|
| `indigenous_townships_55` | 55 原鄉維度表（無幾何），供統計／MCP 篩選 |
| `debris_flow_alert_history` | 土石流警戒紀錄表（無幾何），縣市統計另有 `debris_flow_alerts_county` |
| `place_name_aliases`、`place_name_romanization_moi`、`lienchiang_standard_place_names` | 地名別名／譯寫／連江標準地名表（無幾何），供地名查詢 |
| `wra_ecology_survey_records` | 生態調查明細（140,841 筆），站點層 `wraEcologySurveySites` 已上圖 |
| `wra_drainage_disaster_damage` | 排水災損事件表（無幾何；未通報≠0，不做 choropleth） |

## 資料限制（UI 都有標）

- 擱淺、海污：只畫有座標的事件（鯨豚 936／1,019、海龜 1,719／2,262、海污 1,759／1,821）；`suspect_county_mismatch` 點改橘色，popup 顯示精度說明。
- 地名：同一實體只畫一點、精度 >1.2 km 的 105 點不上圖；PMTiles 不畫文字標籤（vector source symbol placement 有 production 崩潰紀錄），只畫點＋popup。
- 水門為 1999–2000 測量成果；疏濬座標多只到小數 2 位；淹水災點只到年、2023 年覆蓋不足。
- popup 讀上游 `<欄>_label`，精度欄另補 `precision_note`（前處理由旗標原值轉寫，原值一併保留）。

## 關鍵檔案

- 前處理：`scripts/preprocess/build-atlas-public.py`
- 類別／色票／filter：`src/data/atlasLayerTypes.ts`（代表色 `atlasLayerColors.ts`）
- Overlay：`src/map/overlayRegistry.ts`（`ATLAS_OVERLAYS`）；點擊：`src/map/gisClickRegistry.ts`
- Popup：`src/components/featureInfo/atlasPanels.tsx`；Legend：`src/components/legend/atlasLegends.tsx`

## 資料契約摘要

看 [handoff.md](./handoff.md)。
