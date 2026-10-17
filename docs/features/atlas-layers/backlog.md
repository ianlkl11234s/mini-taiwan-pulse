# Backlog — atlas-layers

- [x] 26 層點／線／面接線（原民與農村 3、道路設施 7、淹水與災害照片 3、海洋 6、地名 2、水利設施 5）
- [x] PMTiles 7 層逐 zoom 稽核
- [x] 分析倉庫 layer-status：26 層皆對到倉庫表
- [x] 瀏覽器驗收 6 層（develop e141e1f1）
- [ ] 地名文字標籤：PMTiles 不畫 symbol（production 崩潰紀錄）；若要底圖註記，需另出精簡 GeoJSON 或確認 Mapbox 修正
- [ ] 孤島地區點大小依人口（layer-plan 建議）未做，現為固定大小＋成因色
- [ ] 疏濬工程低精度座標目前以 popup 標示，未做空心符號
- [ ] 微塑膠、海龜等年份／類別篩選可再細化
- [ ] 中文同義詞（鯨魚／海豚、海廢等）屬 MCP `discovery.ts`，不在本 repo
- [ ] `layer-status.csv` 重產後 `temperatureGrid` 被標 `dataset_not_in_warehouse`（舊列是欄位錯位，非本批造成），另案查
