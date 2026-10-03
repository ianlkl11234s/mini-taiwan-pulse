# Status

**最後更新**：2026-10-03 晚（本機 Claude Code 連正式站：P0–P3＋AG-1 上線）

> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

## 範圍

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #506（面板站主可見、nginx 轉 gateway）、#512（AG-1＋P1–P3）、#517（自繪圖層摘要＋SCENE_ERROR 修正）、#519（map_context 等資料、aqi isStyleReady）、#515（文件）已合併並部署。 |
| **gis-platform** | #136（zbpack 啟動）、#137（結果通道、長輪詢、agent token、清掉配對碼）已合併；Zeabur 服務 `research-gateway` 以 `zeabur deploy` 部署（不綁 GitHub）。 |
| **mini-pulse-gis-mcp** | #35（P1–P3＋AG-1）、#37、#38（摘要讀法）已合併。 |
| **本機** | analysis-prod 三個 worktree 已切到最新；8794 改測試身分（`PULSE_RESEARCH_TEST_IDENTITY`），3734 `.env.local` 改 `VITE_RESEARCH_TEST_IDENTITY=1`。Claude／Codex 的 pulse-research 預設連正式站。 |

## 上線狀態

| 上線項目 | build | contract/wire | stage | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| gateway（Zeabur） | done：100 tests | done：本機 e2e 13 項 | done：#137 | done：12:36Z pod 啟動 | done：新端點未登入 401、`/pairings/claim` 404 | not run：需使用者 token |
| mini 正式站 | done：CI 綠 | done | done：#512／#517／#519 | done | done：上傳路徑放行 2 MB、一般路徑 100 KB 413 | not run：需使用者 token |
| MCP（analysis-prod） | done：524 tests | done | done：#35／#37／#38 | done：已 build | N/A | done：本機 live-map 分層題庫 13/13 |

## 數字（本機無頭瀏覽器，改版前 → 後）

set_camera 4.6 → 1.7 s；set_layers 1.6 → 0.16 s；map_context 88 → 13 ms；token 接上 55 ms；重整還原 5.5 s；18 MiB 上傳 151 ms。正式站改版前（P0）：set_camera 4.7 s、map_context 0.96 s、set_layers 4.8 s；網路經 Cloudflare 新加坡，ping 150 ms。

## 卡點與下一步

**下一個 session 的入口**：BACKLOG AG-5。

- 卡點：正式站量測需要使用者登入正式站、在面板產生 token，並在 analysis-prod/mcp 執行 `pbpaste | npm run token:save`；Claude Code 需 `/mcp` 重連才會用新版工具。
- 第一步：使用者完成上述後，跑 `node scratchpad/bench/e2e-prod-connect.mjs prod`（腳本在 session scratchpad；已記錄於 PLAN §9）。
- 驗收：各項通過，數字寫回 PLAN。

其餘待辦：AG-2～AG-4、AG-6（其他自繪圖層摘要）、AG-7（回歸測試重置殘留圖層）。
