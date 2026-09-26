# AI Agent 查詢系統檢查點（2026-09-26）

本頁固定「現在能做什麼、證據在哪裡、下一次如何接續」。它是本地隔離分支的檢查點，不是正式環境可用性承諾。逐層真實狀態以 [778 層台帳](./p0-source-family-ledger-20260925-current.json)、[目前佇列](./completion-queue-20260925.csv) 及[施工收據](./source-family-priority-rollout-20260925.md)為準；本頁不把多個來源家族合併成虛構的全鏈通過數。

## 一條龍目前走到哪裡

使用者在 Codex 或其他接上同一 typed MCP 契約的 Agent 提問 → Agent 從 dataset descriptor 選資料、指定版本／範圍／篩選 → `pulse-research` MCP 執行有界查詢或分析 → Gateway 把結果交給已配對的瀏覽器 → 地圖回報 `ready`，Agent 讀回實際 feature/source/layer 並確認畫面。`ready` 僅證明本次呈現完成；來源是否合法、完整、可否算距離，由來源契約另行判定。其他 Agent 能否使用，仍取決於其 MCP host 有沒有載入相同工具及能否與本機瀏覽器配對，不能由 Codex 成功直接推定。

這條鏈已在部分固定來源真實跑通。例如烏來 10 公里農業休閒點 3 筆＋溫泉露頭 1 筆，同一地圖回讀 4 features／2 sources／2 layers，見 [P4 Point 收據](./p4-nearby-point-slice-receipt-20260925.md)；縣市界、林道單線、警察局點及六項縣市交通統計也各有範圍明確的實查收據。這些證明系統能工作，但不代表對任意位置、任意圖層的一問全找已完成。完整的自動候選選擇、多幾何「附近有什麼」、林道點到線距離仍在 [E01–E04／B04](./completion-checklist-20260925.md) 待辦。

## 數字與可用性，不混算

| 層級 | 2026-09-26 目前證據 | 能對使用者承諾什麼 |
|---|---|---|
| 列冊 | manifest 778 個 layer key；逐層台帳與施工佇列已建立 | 不遺漏圖層身份，未處理者保留下一步／HOLD；不代表已找到全部真實原表 |
| 查詢入口 | audit 登記 256 datasets、248 個有可查映射的 layer key；比 78 個起點多 170 個；529 個無 descriptor、1 個有 descriptor 但 query disabled | 這些映射在程式中有查詢路徑；不是 248 層逐一即時實測、空間合格或公開可用 |
| 資料查詢 | 各家族收據分別有 source SHA、原表筆數／缺值、獨立 oracle、MCP 或本地實讀；例如裁罰 4 層共用 414,904 筆歷史事件，同一母體不重算四次 | 只對已核來源、版本、欄位、範圍和操作回答；owner-only 與缺授權資料不公開 |
| 空間運算 | 合格 Point 可做標明為地表直線的距離；完整縣市面可查幾何；部分線／代理面只通過特定 bbox、屬性或單筆呈現 | `geometry.role=proxy`、地址地理編碼、模型等時圈、無座標列不可冒充精確位置、路網時間或零值 |
| 正常 MCP→地圖 | 已有多個逐家族 `ready`／map readback／目視收據；第 83 批警察等時圈 3 層僅 reader／測試通過，尚無此 gate | 只有附特定範圍、結果 ID、feature 數與收據的案例才稱全鏈通過；目前沒有 248 層逐一全鏈通過的總數 |
| 正式發布 | 本輪未 push、PR、merge、部署，也未寫 Supabase／S3 | 本機驗收不等於線上公開服務或其他裝置可用 |

「248」來自可重跑 [capability audit](./capability-audit-20260925-current.json) 的 registry 統計，不是現場 uptime 數字。`owner-only` 大資料 sidecar 在忽略版控的本機 runtime，程式／重建腳本／SHA 收據可由 commit 固化，但換機或清空本機檔案後必須從已核原檔重建並重驗；不能把 Git commit 當作資料本體備份。部分上游原檔、授權或遠端同版仍 HOLD，見逐家族收據。

## 驗收門檻與合理成本

1. **原表與契約**：確認來源機關、版本或 SHA、授權／存取、觀測與取得時間、母體／排除、缺值／零／抑制、geometry 類型與精度。不能驗證的部分如實 HOLD。
2. **資料能查**：用新地點與篩選變體，將 reader 結果和獨立原表計數核對；檢查上限、分頁／截斷、錯版拒絕。純屬性資料到此可標「屬性可查」，不強制畫假點。
3. **允許的分析**：只為該來源真正支援的 Point／Line／Polygon／統計運算驗獨立正反例。地址參考點不保證實際出入口距離；代理面不保證住址落點判斷；不同期間／分母的縣市值不硬比。
4. **Agent 到地圖**：在正常配對而非直接注入下，由 MCP 查詢與分析、Gateway 呈現，等 `ready`，讀回結果 ID、features、sources、layers、bounds／revision，並目視。這是「地圖全鏈通過」門檻；瀏覽器未啟動時不能補寫通過。
5. **交付**：focused tests、`npx tsc -b` 與相應 build、可讀收據、只含本片檔案的原子 commit。既通過而未受修改的案例不機械重跑；共用 reader 可按來源家族選代表地點與 layer filter 驗，不要求 778 次毫無差異的點擊。

這些 gate 是為了把「當下查不到」定位在資料、運算、MCP、配對或地圖哪一段。對已完成部分不必等所有 778 層才承認可用；對尚未走完的一段也不把註冊數當成成功率。

## 本次冷啟動狀態與接續

- 本次核對時 `git HEAD=50bb0536`（2026-09-26 06:10 +0800）。3734 前端、8794 Gateway 均未 LISTEN；因此**此刻沒有 live MCP→browser 查詢保證**。既有歷史配對／資料庫不應以重置來求通過；恢復服務後先核 origin、session、tool catalog，再針對未過 gate 的新片做查詢與 readback。
- 第 83 批 `policeIsoSubstation`／`policeIsoPrecinct`／`policeIsoCityDept`：本機 reader、固定 SHA、來源 oracle、focused tests、`tsc -b`、程式 bundle 有收據；正常 MCP／地圖仍待驗。完整資產 build 曾因 ENOSPC 失敗，程式 bundle 通過不可冒稱完整 build。
- 下一批 eAIP 空域研究草稿已在 `046a1fc4` 單獨保存 `aviationAirspaceOwnerDataset.ts` 與 `build-airspace-owner-only.py`；查詢 registry 與 Vite route **未接線**，因此**未列入 248**。本機 owner-only 81 面 sidecar 保留於 `../runtime/owner-only/aviation-airspace/`，SHA `b32288f6d8a7bb31313b3b6ad853e27f1e2323b1ef65a814f50de6350d405fb7`。接續先核來源／授權／幾何修補，補真實來源測試、runtime route、audit 與收據，正常 MCP／browser 通過後才標可用。
- 工作區是 `research-streamline/mini` 隔離 worktree；原 checkout、其他配對、Supabase／S3、已暫停過夜排程保持原狀。下一步按 [完成清單的 A03 與 B／C／D／E／F](./completion-checklist-20260925.md) 持續施工，先臺灣 GIS、再縣市統計、全球與日本；缺來源或權利證據的家族記具體 HOLD，轉做其他可行家族。

**重新驗證的最小順序**：核 `git status` 與本頁 HEAD → 檢查本片 runtime sidecar 是否存在、SHA 是否吻合 → 檢查 3734／8794 與 Gateway origin → 看 MCP host 是否有 live `pulse-research` tools、建立／恢復配對 → 用未驗片的新地點和問題變體實問 → `ready`、readback、目視 → 記錄結果及 commit。服務離線或 sidecar 不在時，應回報明確失敗原因，不能用歷史成功收據回答「現在一定查得到」。
