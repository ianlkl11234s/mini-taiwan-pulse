# Backlog — 都市熱島 Urban Heat

> 本檔只保留 current residual；UH-3/UH-4 是已完成的調查結論，不列入 active。

## Release blocker

- [ ] **UH-1**：瀏覽器驗收兩模式色帶、nodata 透明、z11→z12 overzoom 與 opacity slider。
  - Outcome：確認接線完成後使用者實際看到正確色帶與控件。
  - Next action：啟動 `npm run dev` 做 All Off→single-layer、邊界 zoom、空資料與 console 檢查；以 screenshot/browser evidence 關閉。

- [ ] **UH-2**：上傳 `deploy-assets/environment/urban_heat_lst_taiwan.pmtiles`。
  - Outcome：production 不因 PMTiles 不進 git 而 404。
  - Next action：owner 拍板後執行 `upload-deploy-assets.sh`，核對 S3 checksum、HTTP Range 與 browser layer。

## Product decision

- [ ] **UH-A**：維持不做 popup ΔT/°C，除非有明確需求與 raster 解碼方案。
  - Outcome：不把不可由 `queryRenderedFeatures` 直接取得的 raster 值，誤包成已可行的 popup 工作。
  - Trigger：使用者需要點位數值且可接受自行抓磚解碼的成本時，另開 POC。

## 已完成（歷史，不列入 active）

- [x] **UH-3**：canopyHeight mix 係數已實測正常，採 ×255 寫法。
- [x] **UH-4**：上游 §3.4 已確認原本正確，不需修改。
- [x] **UH-0**：前端七步接線、四鐵則與 feature 文件 — 見 [changelog.md](./changelog.md)。
