# Changelog

## 2026-09-15 本地接線（未提交、未發布）

- 教育11、醫療長照16、住宅18，共45個配方及416 exact selectors接入既有Statistics。
- 增量資料僅走opt-in DEV dataset路由，既有CDN與完整snapshot不變。
- values/sources/health共用完整selector；未知social release即使呼叫者允許fallback仍拒絕。
- 地圖與圖例共用固定分級；重複門檻保留最後可達顏色、去除空區間，不修改上游JSON。修復安寧床位與護理列示人力無法render。
- 社會統計tooltip使用配方中文名稱，保留null、0、原始-、PARTIAL與STALE。
- 桌面45層、手機三主題與特例驗收證據保存在evidence/。

## 後續授權：本地原子提交

- `d94149d5` 配方與色階工具。
- `3d393b7f` 完整接線與增量路由。
- 文件及原始驗收證據獨立提交；未push或發布。

## 正式發布完成

- analytics #88、platform #109/#110、frontend #248 皆一般 merge commit。
- 414 releases / 13,716 values 匯入；R2全量3590 selectors，既有3174不變。
- 1364 tests passed / 4 skipped、tsc/build通過；公開HTTP416與正式桌面45層、手機三主題驗收通過。
- 詳見 [production-release](./production-release.md)。
