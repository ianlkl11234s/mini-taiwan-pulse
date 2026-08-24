# Changelog — 日本宗教設施三源圖層

## 2026-08-24 — Unreleased

- 接入 `jpReligionGsi`、`jpReligionOsm`、`jpReligionWikidata` 三個獨立世界圖層，預設全 off。
- GSI 採主站 `mapbox-pmtiles` custom source type，固定 `source-layer=jp_religion_gsi` 與 source maxzoom 14。
- 三源共用宗教分類色票，新增 opacity、popup fallback、來源 attribution 與完整度 disclaimer。
- 三源皆新增點位大小 slider（0.3×–3×）；scale 直接重算 zoom stops，避免非法 Mapbox `zoom` expression 巢狀。
- 資料源：GSI 167,037／OSM 71,040／Wikidata 37,154。
- Breaking：無；不依賴 Supabase runtime。
