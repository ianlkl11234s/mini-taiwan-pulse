# Backlog — jp-core-layers

## 遞延圖層（需資料工序或 deploy，屬另一批）

- [ ] **jpRailways（鐵道 21,933 線，14MB GeoJSON）**：git-track 灰帶；建議轉 PMTiles 縮到 <5MB 再接。接進 JAPAN_THEME 交通 group。
- [ ] **jpSchools（學校 56,807 點，28MB GeoJSON）**：需先跑 tippecanoe 轉點 PMTiles（`-r1 -pf -pk -Z4 -z14`）+ 逐 zoom 稽核防掏空，再 git-track；接進新增「教育」group。13 類 school_class 可考慮分類分色（則需圖例）。
- [ ] **jpPopulationMesh1km（人口網格 176,896，49MB PMTiles）**：>25MB **必走 S3**（觸點 #20：nginx location 已有 `/world/`，但需加進 `upload-deploy-assets.sh` + `pull-deploy-assets.sh` 清單 + S3 upload，比照 power_poles）；deploy 需 user 拍板。接進新增「人口」group。pop_2020..2070 / ratio65 時間維度可考慮 slider。

## 增強（本輪刻意從簡）

- [ ] 車站按 railway_categories（JR/私鐵/地下鐵…）分類分色 + 圖例 + `jpStationsTypes.ts` 三邊色彩 SSOT
- [ ] 車站按運量做 graduated 圓大小 / 分級色（需圖例）
- [ ] 機場按 category（空港種別，拠点/地方管理…）分色 + 圖例
- [ ] auto-flyTo 座標目視微調（`JAPAN_CAMERA`）；含沖繩可改 `fitBounds([[127.6,26.2],[146.5,45.8]])`
- [ ] Locations 面板加「日本」跳點按鈕（目前 JAPAN_CAMERA 刻意不進 ALL_PRESETS）

## 驗收待辦

- [ ] 瀏覽器目視驗收（headless SwiftShader 無法自動化）：見 changelog「待辦」與 handoff。
- [ ] 分支改名 `feat/jp-core-layers`、開 PR、上游 handoff 反向引用本 feature folder。
