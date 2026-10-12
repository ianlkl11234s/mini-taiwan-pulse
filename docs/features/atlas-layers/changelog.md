# Changelog — atlas-layers

> 逐 PR 變更紀錄。最新在上。

---

## 2026-10-12 — 首批（PR #585，merge `e141e1f1`，併入 develop；尚未部署正式站）

- 新增 26 層：原民與農村 3、交通 › 道路設施 7、災害 › 淹水 2＋崩塌 1、海洋 6、底圖 › 地名 2、水資源 › 水利設施 5
- 新主題「原民與農村」「海洋」；新目錄 `indigenous_rural/`、`marine/`（nginx＋pull 同構）
- PMTiles 7 檔（最大 15.9MB）全 git 管理、dist 供檔，不上 S3
- 分析倉庫 layer-status 重產（26 層皆可分析）
- Breaking：無（golden 只新增）
- 瀏覽器驗收（develop `e141e1f1`，port 6012）：部落、省道標誌（PMTiles）、淹水災點（PMTiles）、鯨豚擱淺、地名（PMTiles）、中央管水門 6 層皆顯示，popup 中文 label 與座標精度正常
