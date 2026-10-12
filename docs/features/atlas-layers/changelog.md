# Changelog — atlas-layers

> 逐 PR 變更紀錄。最新在上。

---

## 2026-10-12 — 首批（PR 待補，併入 develop；尚未部署正式站）

- 新增 26 層：原民與農村 3、交通 › 道路設施 7、災害 › 淹水 2＋崩塌 1、海洋 6、底圖 › 地名 2、水資源 › 水利設施 5
- 新主題「原民與農村」「海洋」；新目錄 `indigenous_rural/`、`marine/`（nginx＋pull 同構）
- PMTiles 7 檔（最大 15.9MB）全 git 管理、dist 供檔，不上 S3
- 分析倉庫 layer-status 重產（26 層皆可分析）
- Breaking：無（golden 只新增）
