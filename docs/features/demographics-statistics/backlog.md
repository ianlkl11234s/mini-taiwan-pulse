# Backlog — 人口統計

- [x] R2 增量發布＋CDN readback（2026-10-04：縣市／鄉鎮 `cef036a8…`、村里 `f8cdd6bb…`）。
- [ ] 正式站 browser（前端部署後）。
- [x] 村里層：11508 × `VILLAGE_NLSC_1150817` 20 層（其他期別 HOLD，見 analytics village-layer-plan）。
- [ ] 授權確認（data.gov.tw 資料集頁）後更新來源卡措辭。
- [ ] catalog JSON 846 KB（minified 544 KB）落在 `layerCatalog` chunk：P0/P2 時 1,469.67→1,805.09 kB（gzip 215.6→231.1 kB）。瘦身：catalog 去掉 release_options 的 coverage／bundle_path 與 recipe 的 coverage／release_selector／filters／source_gate，估 544→248 KB；或比照 agri／social 把 release_options 移到 lazy details。
