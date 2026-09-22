# Jev 候選加速器

Jev 是 routing accelerator，不是 agent、執行器、授權層或資料真值來源。正式工具仍須通過 MCP schema、Gateway allowlist、session/access gate 與資料契約。

## 何時呼叫

- **零次**：已知精確 tool、dataset ID、layer key，或 deterministic search 只剩一個明確候選。
- **最多一次**：自然語言問題同時可能落在 discovery、query、analysis、presentation 或 session；或仍有多個合理 capability。
- **不呼叫**：只是在延續上一個 resultId、翻頁、等待 receipt、重試已知 schema 錯誤或執行使用者已明確指定的操作。

多階段 capability → candidate ranking 是未來能力。現行一次 Jev 後只用 deterministic search／describe 縮小候選，不再呼叫第二次 Jev。

## 呼叫與判讀

對開放式請求呼叫 `pulse_route_request({query})`。只採用回傳的 `capability`、`surface`、`candidateTools`、confidence 與 routing receipt；`executed` 必須是 `false`。

目前 runtime 是一次 capability Choice，再由固定 allowlisted vocabulary 回傳小型 candidateTools；它不是逐一替所有 tools 做 learned ranking。不要把候選順序解讀成精確排名。

取得候選後仍需：

1. 以本 session 實際 tool catalog 移除不存在的工具。
2. 在 describe/read/execute 前重新檢查 access 與 schema。
3. 由主 agent選擇最小工具鏈，不照單全收 candidateTools。
4. provider unavailable、timeout、confidence 低、空候選或未知 tool 時，回到 SKILL.md 的 deterministic table；Jev 失敗不得阻擋明確可做的查詢。

## 不可交給 Jev 的判斷

- guest/owner、DEV/release gate、revocation。
- freshness、license、production health、missingness、geometry correctness。
- SQL、URL、檔案路徑、完整 GeoJSON、secret 或未授權 metadata。
- 是否已完成工具執行、資料載入或 browser ready。

候選圖層必須由既有 manifest/catalog/access policy 派生；不得新增另一份手寫 Jev layer index。詳細 taxonomy 與 shadow evidence 的 SSOT 是 `docs/features/agent-research-workbench/jev-routing-accelerator.md`。
