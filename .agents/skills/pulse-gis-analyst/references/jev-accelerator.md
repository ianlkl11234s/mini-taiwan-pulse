# Jev 候選加速器

Jev 是 routing accelerator，不是 agent、執行器、授權層或資料真值來源。正式工具仍須通過 MCP schema、Gateway allowlist、session/access gate 與資料契約。

`pulse_find_data` 是廣搜工具：跨 dataset 名稱、欄位名、統計指標名稱比對，並用 Jev 相關性分數排序（保留 ≥0.7）。不確定有沒有相關資料，或 Jev 分類信心 <0.7 時，改呼叫這個工具，不要直接執行低信心候選、也不要在搜尋前說「沒有資料」。

## 何時呼叫

- **零次**：已知精確 tool、dataset ID、layer key，deterministic search 只剩一個明確候選，或題目落在下方「題型對照」表中任一格（速度優先，直接查表用配方，不呼叫 Jev）。
- **最多一次**：自然語言問題同時可能落在 discovery、query、analysis、presentation 或 session；或仍有多個合理 capability，且不在題型對照表內。
- **不呼叫**：只是在延續上一個 resultId、翻頁、等待 receipt、重試已知 schema 錯誤或執行使用者已明確指定的操作。

多階段 capability → candidate ranking 是未來能力。現行一次 Jev 後只用 deterministic search／describe 縮小候選，不再呼叫第二次 Jev。

## 題型對照（round 3，七大類 → capability → 倉庫工具 → 配方）

出處：`mini/docs/features/general-analysis/question-bank-backlog-20260927.md`。capability 定義／候選工具在 `jevRouter.ts`（`CAPABILITY_CRITERIA`／`MCP_CANDIDATES`），與此表手動同步。

| 題型（七大類） | capability | 倉庫工具 | 配方 |
|---|---|---|---|
| 1. 基礎設施周邊關聯 | `analysis` | `pulse_sql`／`pulse_wh_present` | infrastructure-proximity.md |
| 2. 生活品質面向拆解／複合指數 | `index` | `pulse_sql`／`pulse_region_rank`／`pulse_wh_present`(choropleth) | composite-index.md |
| 3. 教育／運動可及性、服務缺口 | `accessibility` | `pulse_nearby_profile`／`pulse_sql`／`pulse_region_rank`／`pulse_wh_present` | nearby-profile.md（等時圈版見 `accessibility-analysis` skill，🔴 待接倉庫） |
| 4. 災害／環境／產業疊合 | `analysis` | `pulse_sql`／`pulse_wh_present` | area-correlation.md／clustering-ann.md／hotspot-gi-star.md |
| 5. 新聞情勢與空間事件 | `event_context` | `pulse_nearby_profile`／`pulse_sql`／`pulse_wh_present` | event-screening.md／news-persistence.md |
| 6. 視覺化與跨區比較 | `analysis` | `pulse_region_rank`／`pulse_sql`／`pulse_wh_present` | region-rank.md／compare-places.md |
| 7. 擴充面向（宗教／高齡／韌性／能源／觀光／交安／食物可及／產業群聚） | 高齡照護、食物可及走 `accessibility`；其餘 `analysis` | 同上 | 依主題挑最近的配方 |

⚠️ 「指數」中文歧義：ANN／Gi\* 等**空間統計量**（clustering-ann.md、hotspot-gi-star.md）不算 `index`，仍是 `analysis`；`index` 只限「多指標合成一個分數或跨區百分位」（composite-index.md）。抽測實測見 `/private/tmp/claude-501/jev-eval.md`（Q16 曾被離線 proxy 誤判為 index）。

## 呼叫與判讀

對仍有路由歧義的開放式請求，可呼叫 `pulse_route_request({query})`；已知資料家族或工作流程則直接用 deterministic 路由。只採用回傳的 `capability`、`surface`、`candidateTools`、confidence 與 routing receipt；`executed` 必須是 `false`。

目前 runtime 是一次 capability Choice，再由固定 allowlisted vocabulary 回傳小型 candidateTools；它不是逐一替所有 tools 做 learned ranking。不要把候選順序解讀成精確排名。

取得候選後仍需：

1. 以本 session 實際 tool catalog 移除不存在的工具。
2. 在 describe/read/execute 前重新檢查 access 與 schema。
3. 由主 agent選擇最小工具鏈，不照單全收 candidateTools。
4. provider unavailable、timeout、confidence <0.7、空候選或未知 tool 時，改呼叫 `pulse_find_data` 廣搜；仍無結果才退回本檔「題型對照」表或 `recipes/README.md` 配方索引（deterministic fallback）；Jev 失敗不得阻擋明確可做的查詢。

## 不可交給 Jev 的判斷

- guest/owner、DEV/release gate、revocation。
- freshness、license、production health、missingness、geometry correctness。
- SQL、URL、檔案路徑、完整 GeoJSON、secret 或未授權 metadata。
- 是否已完成工具執行、資料載入或 browser ready。

候選圖層必須由既有 manifest/catalog/access policy 派生；不得新增另一份手寫 Jev layer index。詳細 taxonomy 與 shadow evidence 的 SSOT 是 `docs/features/agent-research-workbench/jev-routing-accelerator.md`。
