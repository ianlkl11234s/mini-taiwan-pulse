# 統計圖層施工與交付

2026-09-06：統計功能已完成本機 3734 驗收，PR 整理中。主線合併會觸發既有 Zeabur 自動部署，發布須與使用者確認；遠端統計 migration、production API 與排程尚未啟用。

## 已完成

獨立 Statistics 入口沿用 Layers 大分組／小分組／圖層、toggle、展開與 All Off。icon 使用 Layers 加統計徽章。共用 recipe、store、loader、renderer 支援 8 個統計指標、14 版本，涵蓋縣市與鄉鎮市區；期別、來源、opacity、legend、popup 與缺值可呈現。深色文字與年份選單對比已修正。

犯罪圖層為既有獨立 PMTiles 路徑；已補齊 368 鄉鎮圖磚，zoom 5 起可用，完整重載後 zoom 6.8 可見填色。

## 新增統計圖層

1. Analytics 依 long-term-plan.md 與 onboarding-template.md 確認來源、授權、期別、單位與行政區層級。
2. 沿用 regional_statistics bundle contract，新增來源 adapter，保留 raw receipt、checksum、processing、coverage 與缺值。
3. Platform 註冊 geometry 版本、匯入資料版本並逐筆回讀；本機預覽與 production 分別驗收。
4. 前端新增 regionalStatisticsRecipes 與 layerManifest／layerParamsSpec，使用既有統計 UI 與 renderer，再跑測試與瀏覽器驗收。

本機 VITE_STATISTICS_API_URL=http://localhost:3735；未設定時預設 Supabase public RPC。遠端尚未套用，不能移除 override 就宣稱正式可用。public/statistics 的縣市與鄉鎮 geometry 已入版控；正式服務仍需確認 URL、雜湊與權限。

Analytics 文件：docs/topic-research/regional_statistics/long-term-plan.md、onboarding-template.md、commit-map.md。

## 版本與回滾

PR 保留 loader／UI／犯罪修正等原子提交；移除共用功能需先回滾其依賴。Git 不會撤回資料庫內容。正式排程、伺服器端分享期別與任意色階編輯仍待後續施工。
