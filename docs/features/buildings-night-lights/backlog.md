# Backlog — Buildings Night Lights

> 本 feature 沒有新資料契約；實作歷史見 [changelog.md](./changelog.md)，視覺契約與限制見 [README.md](./README.md)。

## Release / verifying

- [ ] **BNL-1** · `release` · P2 · `verifying`：解決 README 的「dev（未 push）」與 changelog 的 PR #78 記錄不一致。
  - Outcome：確認夜景 mode 3、bloom 疊層與高度 slider 是否已進入 production，不用舊 branch 文字推測。
  - Next action：核對 PR/merge、目前 source 與 production browser，驗高度門檻、dark basemap、zoom 8+ 與 console/GL error。
  - Acceptance：PR/commit 可追溯，production 夜景 fill 與 bloom 皆有 browser evidence，README 狀態已同步。

## Conditional / triggered later

- **BNL-2** · `tech-debt` · P3 · `conditional`：目前一個 Mapbox GL context 不允許同時 render 兩個 Three.js bloom scenes。
  - Trigger：產品明確要求 Buildings Night Lights 與另一 bloom feature 同時可見。
  - Next action：先做單一 CustomLayer 管理多 scene 的 POC，不直接增加第二個 GL layer。
  - Acceptance：同時開啟無 GL error，FPS/記憶體有前後對照，單獨開啟無回歸。

## Completed / historical

- 夜景 fill、高樓 bloom、高度 slider 與圖例實作紀錄見 [changelog.md](./changelog.md)；本檔不重複長篇實作細節。
