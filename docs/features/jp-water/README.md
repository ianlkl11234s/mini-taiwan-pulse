# 日本水資源圖層

狀態：`LOCAL_CANDIDATE`。湖泊、高松供排水相關設施、水質測站、橫濱水位站四層已有真實GeoJSON、allowlist及完整前端接線；production未發布。

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
