# 日本水資源圖層

狀態：`PRODUCTION_VERIFIED`。湖泊、高松供排水相關設施、水質測站、橫濱水位站四層已發布為 immutable GeoJSON release `20260918-v1`；正式站 HTTP readback 與 Chrome 地圖驗收已通過。

| layer key | geometry | source snapshot | 語意 |
|---|---|---|---|
| jpWaterDams | point | W01 2014 | ダム位置；非即時蓄水量 |
| jpWaterLakes | polygon | W09 2005 | 湖沼範圍歷史快照 |
| jpWaterSupplyFacilities | point | P21 2010/2012 | 上水道設施，含泵場/管理中心；不可全稱淨水場 |
| jpWaterSupplyAreas | polygon | P21 2010/2012 | 給水區域歷史範圍 |
| jpWaterSewerFacilities | point | P22 2012 | 下水處理廠/泵場，需保留來源分類 |
| jpWaterRivers | line | W05 2006–2009 | 河川線歷史快照 |
| jpWaterLocalPipes | line | 半田市 source-specific | 半田地方範圍；CRS已驗，但尚未接線 |
| jpWaterLocalFacilities | point | 高松市 source-specific | 地方供排水相關設施，含下水道設施 |
| jpWaterQualityStations | point | 環境省 2024 | 12,274 raw / 9,831 distinct stations；站表不是水質測值 |
| jpWaterLevelStations | point | 未註（站表 URL 2024-07-05） | 水位觀測站；2026-03 僅屬另一觀測表，不可套到站表 |

資料契約與 release boundary 見 [handoff.md](./handoff.md)。

## 2026-09-18 production receipt

- Zeabur deployment [`6aace0570f50de6ff52c3469`](./evidence/production-deployment.json) 已在 `2026-09-18T07:01:08Z` 完成並為 `RUNNING`，對應 master merge commit `5fdde19d`。
- 正式站 `/world/jp_water/release.json` 和四個 GeoJSON 都回應 HTTP 200；SHA-256、bytes 與 feature count 均符合 release metadata：詳見 [HTTP readback](./evidence/production-readback.json)。
- Native Chrome 已驗 Japan 選單的「水資源 1/4」、四個 toggle 與「水資源靜態資料」分類，以及實際 geometry、popup、來源、授權、加工揭露與 URL layer selection：琵琶湖、上野、トーヨー橋、旧御殿水源地；詳見 [browser receipt](./evidence/production-browser.json)。實體行動裝置未驗。
