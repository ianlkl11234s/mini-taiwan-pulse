# Changelog

## 2026-09-14 — 本地第一批完成

從 `617f1dcb` 建立獨立 worktree，沿用 analytics 已取得來源，建立第一批靜態 allowlist 與主站醫療圖層。資料 worker、UI worker 分檔 ownership；主 agent 接線與驗收。沒有 PR、commit 或發布 hash；上傳／部署／push／merge not run。

完成三入口、五類／35 服務／三層醫療圈、格網聚合、按需時段、共址多服務、深色詳情對比、醫療圈邊線及失敗重試。資料／HTTP／桌機與390px三尺度驗收見 acceptance.md；正式發布仍 not run。

## 2026-09-15 — 既有 S3／Zeabur 發布整合

使用者授權上傳與正式網站驗收。從最新 master `0f86b926` 建立 `feat/jp-medical-static-release`，保留已上線的 494 層（含日本觀光），再加入三層醫療。新增精確 publisher、fail-closed installer、Docker/pull/nginx 接線及驗證；詳細 Git 與正式驗收後續寫入 [release.md](./release.md)。
