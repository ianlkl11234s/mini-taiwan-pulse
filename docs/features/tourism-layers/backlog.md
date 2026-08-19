# Backlog — 觀光 Tourism

> 本檔只保留 current residual；TO-1 已完成，release 後續事項按類別分開。

## Release blocker / verifying

- [ ] **TO-2 · `verifying`**：上傳 D 類 3 檔至 S3 並完成 Zeabur pull 驗證。
  - Outcome：正式站可取得 gitignored 資產，不會以本地檔存在誤判部署完成。
  - Next action：owner 拍板後執行 `upload-deploy-assets.sh`，核對 S3 checksum、pull 與 browser HTTP/asset evidence。

## Data quality / product enhancement

- [ ] **TO-3**：tourRestaurants 分色 v2，等待 `cuisine_class` 官方對照表。
  - Outcome：分類色彩有官方語意，不用自行猜測來源值。
  - Next action：取得 codebook 後做分類覆蓋率與圖例驗收。
- [ ] **TO-4**：交互分析候選（民宿聚落×吸引核、可達性缺口、活動×住用率）。
  - Outcome：把候選研究問題轉成可驗證的分析產品，而非散落 idea。
  - Next action：先選一個問題，補資料契約、指標定義與授權，再開 POC。

## Conditional / scheduled

- [ ] **TO-5**：將每月快照重跑接入半動態提醒（`gis-data-onboard check_refresh`）。
  - Trigger：快照更新頻率與 owner/on-call 流程確認。
  - Outcome：資料過期可被提醒，避免月更工作只靠記憶。
  - Acceptance：一次正常更新與一次 stale fixture 都能觸發正確提醒。

## 已完成（歷史，不列入 active）

- [x] **TO-1**：12 圖層首發接線、新主題分組、7 步 SOP、UX 四鐵則與旅宿全 zoom 修正 — PR #82 `204459c`, 2026-07-24。
