# 周邊問題「一問就畫好」改善計劃（2026-09-29，待施工）

> 下一個 session 從這裡開始。狀態：**已完成調查、尚未施工**；使用者尚未拍板第 1–6 項是否照做、超商資料是否另案。

## 使用者實測回饋（2026-09-29）

1. **不會主動畫圖**：問「台北車站跟松山車站附近有哪些超商或公車站」，Agent 只用文字回答。
2. **範圍太重、缺中心點**：範圍是藍色半透明填色；希望改成**白色虛線圓圈**，並**明確標出中心點**。
3. **沒有具體地標**：地圖上看不到是哪家店、哪所學校，只看到「周圍 205 間國小」這類集合。

## 根因（唯讀調查，路徑以 `.worktrees/analysis-prod/` 為基準）

- **引導把 Agent 帶到錯的工具**：MCP instructions（mcp `src/research/server.ts` 約 L397）與 skill `references/map-session.md` L38 都寫「要顯示中心或半徑就用 `pulse_create_analysis_scope`」，而這條正是藍色半透明（mini `src/research/analysisResultOverlay.ts` 約 L22、L570–620，填色 × 0.18）。
- **沒有「必須畫圖」的規則**：skill SKILL.md L102「不為已回答的單一步驟追加圖表」反而抑制畫圖；`recipes/nearby-profile.md` 是條件句；配方很少被讀。
- **畫一次要 5 個工具**：nearby_profile → wh_present → set_result_collection → wait_scene_ready → get_map_context；範圍圈在拆出的面結果裡、筆數顯示 0，容易被略過（mini `warehouseResultImport.ts` L145–150）。
- **nearby 範圍圈本身已接近設計**（`#e2e8f0` 虛線、不填色，overlay L74、L816），**只缺中心點**（mcp `src/warehouse/engine.ts` 約 L890 只加圓圈）。
- **沒有名稱**：`includeSamples` 預設 false（server.ts L143），回傳只有每類筆數；地圖每類只畫最近 5 筆（`perDatasetLimit` 預設 5，engine L875），文字卻說 205。
- **一般點不分類配色、沒有名稱標籤**；只有 proportional 有 labelField，但需數值欄位且不能混面。
- **倉庫沒有「超商」資料集**（categories.json 商業類只有餐廳、市場）。

## 計劃

| # | 位置 | 修改 | 量 |
|---|---|---|---|
| 1 | mcp `engine.ts` nearbyProfile | 範圍圈之外多加一個**中心點** feature | 小 |
| 2 | mini overlay | 範圍圈改**純白虛線、不填色**、線寬約 2.5；中心點醒目樣式（依 DECISIONS M2） | 小 |
| 3 | mini overlay 一般點 | 依 `_wh_dataset` **分類配色**（C2 類別色）；最近前 N 個**標名稱**（沿用 proportional 標籤圖層做法，符合 N2 A1） | 中 |
| 4 | mcp 新工具 `pulse_show_nearby` | 一次完成：nearby 計算＋present＋點與面全放進 collection＋取景＋等待就緒；回傳每類前 N 名的名稱與距離 | 中 |
| 5 | mcp `server.ts` | nearby 預設帶名稱樣本；`perDatasetLimit` 預設約 10 | 小 |
| 6 | 引導 | MCP instructions **第一句**：「附近／周邊這類有地點的問題，一律用 `pulse_show_nearby` 畫到地圖，確認顯示後才回答」；限縮 `create_analysis_scope` 的用途說明；改寫 SKILL L102 與 map-session L38；nearby_profile 工具說明開頭指向新工具 | 小 |
| 7 | 資料 | 補「超商」資料集（另案，量大） | 大 |

驗收：瀏覽器實測「台北車站附近有哪些公車站和學校」→ 地圖出現中心點＋白色虛線圈＋分類配色的點、最近幾個有名稱、Agent 一句結論；回歸測試不退步（基準 14/20，mcp `eval/agent-regression/README.md`）。

## 開工前要先做

- 使用者拍板第 1–6 項與超商資料的處理方式。
- 主資料夾整理狀態見 [STATUS.md](../general-analysis/STATUS.md)；施工一律開新 worktree（從最新 origin/master／main）。
