# 探索階段 release handoff — 2026-09-17

## 下次從這裡開始

先讀本文件、[checkpoint](checkpoint-20260917.md) 與 [connection audit](connection-audit-20260917.md)。舊 handoff.md 保留歷史分析階段，不能直接當目前探索入口規格。

工作目錄 `/Users/migu/.codex/worktrees/c92d/research-recovery/` 下三個 repo；branch 均為 `codex/map-exploration`。不要從外層舊 checkout 啟動網站。使用者希望接著做單圖層基礎統計，不是立即擴張多圖層交叉分析。

## 這次保存內容

- 第一階段圖層搜尋/說明/開關、圖層細項、地點查詢、時間控制、地圖取景與活動回饋。
- 故事 Skill 與模板：先查來源和差異、寫完整章節再導覽。尚無網站故事播放器。
- VIEWPORT_OCCLUDED 修正 commit e69c54eb；文件與 Skill 09ef0534。
- MCP disconnect regression 5dcd5b0：先註冊 rejection assertion 再關 socket，解決測試未處理 rejection，並非修正 Gateway 連線問題。
- 合併最新主線需保留 Coral/Allen 授權設定、統計來源與 catalog 分流、開發代理與探索功能。

## 踩坑與尚未解的門檻

1. Vite 啟動目錄或 Gateway port 不對：網站應用 `npm run dev:exploration`，3732 proxy8791；不要把正常 SPA HTML200 當資料成功。
2. Git 不包含全部 local public 圖資；使用者最新回報圖資又消失，尚未恢復。先追實際 layer key/loader/來源/HTTP再 browser 驗證。public/world 未追蹤檔不是本次可發布資料。
3. Google登入、Agent配對、鏡頭跟隨、資料載入、指令回執是不同狀態。先前 UI 混合錯誤造成誤判。
4. 固定30分鐘 TTL、共用120/min限流、兩條2秒輪詢、每次遠端Auth、32次累積上限、reload恢復均待修；詳見稽核，不宣稱可靠性已解。
5. 遮擋不應讓讀取 context 失敗；已拆分，仍需實際 paired browser 與各面板配置驗收。
6. MCP是每任務本地stdio程序，build不會更新舊程序；不要整批kill他人task程序。
7. 此分支包含早期分析程式與文件歷史；第一階段僅隔離對外探索工具/UI，沒有刪除所有後期模組。

## 驗證與發布狀態

- 合併主線前：前端全站1458 passed /5 skipped、完整build通過；Gateway39 passed；MCP33 passed與build通過。
- 本地 frontend/MCP contracts 都符合各自 pin hash，共用檔 byte-identical。analytics canonical sibling 不存在，未能對當前上游重跑 canonical sync；不得視為新上游驗收。
- 最新 paired browser E2E 未跑；production Gateway不隨網站容器自動啟動，8790正式代理與8791本地測試刻意不同。
- 未上傳資料、未設定部署服務；程式碼合併不等於production可用。
- 本次本地整合已完成：frontend merge 976b7981、Gateway merge 713c454 / CI 24438c9、MCP 5dcd5b0。前端合併後全站1543 passed /6 skipped，完整build通過；Gateway整合後39 passed；MCP33 passed與build通過。
- **尚未建立PR、尚未合併遠端預設分支。** GitHub push遭自動審批拒絕，要求使用者確認精確目的地 `ianlkl11234s/mini-taiwan-pulse` 與 `ianlkl11234s/gis-platform`。確認前不重試。這與本地合併 origin/master/main 不同。
- 授權後先 fetch/檢查主線是否更新→必要時merge並驗證→push codex/map-exploration→建立PR→等待CI/review→`gh pr merge --merge --match-head-commit <verified-head>`，不得 squash/rebase/admin bypass；再回寫PR URLs和merge SHA。
- PR草稿暫存 `/tmp/pulse-pr-body.md` 與 `/tmp/gateway-pr-body.md`，重用前補最新測試結果與關聯PR；若暫存遺失可依本文件重建。
- 原public/world未追蹤檔仍留本地；新主線gitignore涵蓋它們，所以status不再列出，並非本次上傳/提交。
- MCP目前無remote，同名GitHub repo未找到；等待使用者選擇保留本地或建立私人repo，不擅自建立。

## 下一步順序

1. 恢復並驗證缺失圖資（至少目前報錯層 + 學校完整資料來源）。
2. 修connection audit：錯誤分類與清除舊訊息→輪詢/退避→配對續租/安全恢復→長工作階段上限。測試雙頁、超過30分鐘、429、逾時、手動拖動與reload。
3. 單一圖層基礎統計：描述可統計欄位/粒度，計數、類別/縣市/鄉鎮分組、排序分頁，再用既有工具定位。先學校，不以rendered points統計全台；校址不混成機構數；unknown/unmatched/partial與0分開。
4. 驗收總數對帳、分類缺值、行政區代碼同名處理、完整性與排名；有資料才回答最多，不從視覺密度推論。

可交給下個task的提示：
> 請從 recovery/mini-taiwan-pulse 的 release-handoff-20260917.md 接手。先確認 Git/PR狀態與現有服務，不重啟他人程序；優先恢復測試圖資，再處理連線穩定性；完成後以學校為第一個pilot疊加單圖層基礎統計。保留來源、年份、計數粒度與未知值，避免一開始擴張成複雜交叉分析。
