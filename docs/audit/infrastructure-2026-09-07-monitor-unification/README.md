# Monitor 資料生命週期統一：2026-09-07

## 成果與範圍

盤點 26 個 Monitor widgets；有獨立資料讀取的卡片改用同一套 polling lifecycle，純衍生新聞圖表仍共用上層資料。新 useMonitorResource 是既有 useIntelPollingQuery 的薄 adapter，沒有新增 cache 或第二套 scheduler。移除卡片內各自維護的 interval、取消旗標與重複 error handling。維持原更新頻率、資料來源、圖表及顯示密度。

涵蓋 Dashboard、機場、急診、共機、船舶區域、物價、台鐵、Telecom、ISR、四種 Hazard、行情歷史與 LiveWall resolver。IntelPanel 共用的 source health/trending 消費端同步遷移，以符合 loader 的失敗契約。

- 暫時讀取失敗保留該查詢最後一次成功資料，顯示更新中斷及最後成功讀取時間；各查詢獨立，不因趨勢失敗清空摘要。
- 正常成功的 null/空陣列仍可清空上一筆資料，避免把已結束事件永久留下。
- 首次讀取或故障不再以預設 0 假裝已取得資料；來源 freshness、partial、coverage、缺值維持各資料自身語意。
- 權限拒絕與一般故障分開。Monitor 發電資料以現有 owner 身分為條件，退出/身分切換遮蔽舊資料並清除相關快取；未修改資料庫政策。

## 已確認的產品方向

服務容量目標為同時 10–20 人，管理入口主要由使用者本人使用。桌機多圖層與 Monitor 長時間監看為主要驗收場景；保留遠景細節與現有可見資料，不以抽稀換取效能。

使用者描述三個保護圖層；目前設定環境匿名 get_layer_gates 回傳 34 個 enabled owner/full 細項，清單見 gate-metadata.json。可能是分類粒度不同，名稱待對齊；本批保留既有全部政策。這份 metadata 不是 SQL grants/RLS、物件存取或正式部署安全性的完整驗證。

## 驗證

- npx tsc -b：通過。
- npm test：145 files 通過；1277 tests passed，3 skipped。
- npm run build：通過；既有大型 bundle 警告仍在，未宣稱首屏問題已解決。
- git diff --check：通過。
- 測試涵蓋 raw loader 原始錯誤傳遞、403/42501 分類、初始/中斷/拒絕狀態、owner 範圍及卡片遷移；既有基底 hook 測試一併執行。
- 本地 Vite 搭配目前設定資料源，瀏覽器確認地圖、Monitor Dock/Wall、機場切換的讀取狀態、新聞/急診/共機/電信圖表。公開電力資料可顯示，未登入時受保護發電資料顯示無權限且不假裝為零。
- 瀏覽器中壓力指數顯示更新中斷，其他卡片仍顯示資料；不把畫面可開啟等同所有上游健康，未在此批修復該上游。

測試與建置記錄附於此目錄。未做正式發布、migration、真實斷網演練、2/8 小時 soak 或 10–20 人負載驗收。基底 timer 模擬測試不能替代真實長跑。

## 提交與後續

- 7d61935：共用生命週期 adapter、transport status、權限錯誤分類。
- f9b43b3：卡片與 loader 一起遷移，避免半套錯誤契約；包含 owner 資料隔離與回歸測試。

後續仍需受控長跑/負載量測、資料庫與物件權限穿透驗證、CDN fallback/故障負載控制，以及依 trace 處理 Three.js/重複計算/首屏載入熱點。每批依證據決定，不預先增加基礎設施。

所有程式修改在 codex/infrastructure-foundation-20260907 的隔離 worktree，未改動主 checkout 的既有程式工作；未 push、merge 或 deploy。回復本批可逆序 revert 上述兩個提交，正式發布前仍須整合驗收。
