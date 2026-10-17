# Changelog — 日本宗教設施三源圖層

## 2026-09-30 — PF-4：OSM 源改 PMTiles

- `jpReligionOsm`：`world/jp_religion_osm.geojson`（10.93 MB，71,040 點）→ `world/jp_religion_osm_20260930.pmtiles`
  （23.46 MB，source-layer `jp_religion_osm`，Z4–z14 比照 GSI；`-r1 -pf -pk -ai`，每個 zoom 全量）。
  z4–z6 每級 71,040 點，z14 逐筆比對 `id`／`religion`／`name` 與座標（最大偏移 3e-6°）。
- `useJpReligionLayers`：GSI 的 PMTiles 掛載邏輯泛化為 `usePmtilesLayer(config)`，GSI／OSM 共用；
  移除 `fetchJpReligionOsm`。opacity／scale／描邊／popup 行為不變。
- 行為差異：source minzoom 4 → 地圖 z4 以下 OSM 點不再顯示（與 GSI 一致）；PMTiles metadata 帶
  `© OpenStreetMap contributors, ODbL`，會出現在地圖 attribution。
- 檔案比原 GeoJSON 大（每個 zoom 全量是「不抽稀」的代價），但初始 z4 視窗約 1.4 MB（gzip）即可畫出，
  免去 10.9 MB JSON 整包 parse。部署：`upload-deploy-assets.sh` world allowlist 已加入；原 GeoJSON 保留。

## 2026-08-24 — Unreleased

- 接入 `jpReligionGsi`、`jpReligionOsm`、`jpReligionWikidata` 三個獨立世界圖層，預設全 off。
- GSI 採主站 `mapbox-pmtiles` custom source type，固定 `source-layer=jp_religion_gsi` 與 source maxzoom 14。
- 三源共用宗教分類色票，新增 opacity、popup fallback、來源 attribution 與完整度 disclaimer。
- 三源皆新增點位大小 slider（0.3×–3×）；scale 直接重算 zoom stops，避免非法 Mapbox `zoom` expression 巢狀。
- 資料源：GSI 167,037／OSM 71,040／Wikidata 37,154。
- Breaking：無；不依賴 Supabase runtime。
