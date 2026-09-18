# 日本醫療／長照縮放切換驗收

日期：2026-09-18

## 預期行為

- zoom < 8：顯示目前開啟分類的 10 km EPSG:6933 等面積密度網格。
- zoom >= 8：自動切換成完整 PMTiles 點位。
- 不再顯示舊的 z6 格心圓點與數字標籤。
- Navii 格網計數是可繪製設施筆數；H17 格網計數是服務登記筆數。
  兩者都不是容量、病床數、服務人次、唯一機構數或服務範圍。

## 資料產製

- Analytics PR [#97](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/97)
  已用一般 merge commit `3ce88a7c1ea34605e21c9b930bb93992fd2453f9` 合併。
- Navii：189,800 筆、2,947 格、1,489,098 bytes，SHA-256
  `24ad3896153d9b6da4a1852e2df00ff9c4ac080f763abc0b633d06f0bd9fe175`。
- H17：222,194 筆服務登記、3,097 格、1,712,797 bytes，SHA-256
  `d68a8fcb8b4d9fdf4e015983eb65feb5d4fadbc211ab0914d2f2901420e2cc76`。
- 新 release `eed57ed37d1f7cdc936ff87937d5d0ca1ad5f6b75d10351a34abb02cbb3c8b38`
  只需發布兩個新網格與三個 metadata objects，合計 3,210,751 bytes。
- 點位與 A38 五個既有 immutable assets 沿用 release
  `6f59ead2cd2381d80154b4fa9b5ac7c32acec0d315600a3e5f97282cf93fdafa`，
  不重複上傳約 621 MB。

## 本地驗收

- focused Vitest：15 passed。
- Python promotion/publication/installer：23 passed。
- full Vitest：217 files passed + 1 skipped；1,661 passed / 8 skipped。
- production build：PASS；僅既有 large-chunk warning。
- 候選 release：7/7 assets 完整 SHA-256 與 bytes PASS。
- localhost HTTP：current/catalog/grid 200；五個 PMTiles Range 206。
- browser：醫院與到宅服務在 z4.7 顯示 polygon density grid；醫院在 z9
  自動切成紅色完整點位；clean tab console error 0。

## 發布門檻

- S3 上傳與 `current.json` CAS 更新：尚未執行，需要使用者明確授權將上述兩個
  公開資料衍生 GeoJSON 上傳至專案既有 S3 `deploy-assets/jp-medical/`。
- 在 S3 readback、Pulse PR 一般 merge、容器重新部署與 production browser 驗收前，
  不宣稱正式站完成。
