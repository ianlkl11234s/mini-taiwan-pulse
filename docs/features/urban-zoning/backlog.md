# Backlog — urban-zoning

> 本檔只保留 current residual；UZ-0/UZ-6 的接線完成但 PR pending，移到 verifying 區。

## Release blocker

- [ ] **UZ-4**：deploy 前上傳 3 個 PMTiles（都計 2 個 + 非都市 1 個 37.5MB）。
  - Outcome：正式站可載入兩套分區資料，不因 gitignored asset 缺失而 404。
  - Next action：執行 `upload-deploy-assets.sh`，核對 S3 HEAD/checksum、HTTP Range 與 browser 兩群 layer。

## Data quality / upstream

- [ ] **UZ-1**：依來源矩陣逐城補其他縣市都計分區。
  - Outcome：非都市全國覆蓋之外，都市計畫分區也能逐步跨縣市比較。
  - Next action：每城先記來源、日期、coverage 與清洗結果，再產同構 PMTiles/registry entry。
- [ ] **UZ-2**：處理新北官方站 TLS 憑證信任問題。
  - Outcome：正式排程不再依賴 `--insecure`，下載可信鏈完整。
  - Next action：上游先驗 CA/endpoint 與 checksum；在安全連線證據完成前維持 `verifying`。
- [ ] **UZ-5**：上游移除北市 4 筆範圍框 meta-polygon。
  - Outcome：清除 `zone_name/zone_raw="nan"` 的錯誤資料，前端防禦 filter 仍保留作安全網。
  - Next action：上游清洗後重出檔案並做 feature count/geometry 對帳。

## Decision needed / conditional

- [ ] **UZ-3**：評估以 NLSC LUIMAP WMS raster 作未覆蓋縣市的暫時視覺層。
  - Outcome：在向量資料不足時提供有清楚限制的視覺參考，不冒充可查詢分區。
  - Next action：owner 決定是否接受 WMS 授權、穩定性與不可查詢限制後，再做 POC。

## Release verification（完成施工，尚未證明 release）

- [ ] **UZ-0 · `verifying`**：北市＋新北 2 層接線（commit `8a8de4b`）。
  - Acceptance：PR/merge、production asset、browser 兩層 render 與 popup/legend。
- [ ] **UZ-6 · `verifying`**：非都市土地使用分區 68,220 面／18 縣市接線。
  - Acceptance：PR/merge、production asset、全國 coverage、dropdown 與專屬 popup。

## 已放棄 / 延後（決策紀錄）

- OSS godspeedhuang 2020 全國預跑庫不作上線資料；資料時點 stale，僅留歷史比較。
