# Status

**最後更新**：2026-10-03（Pulse Agent v2 上線：四個 skill 的 plugin、22 個核心工具、本機免授權配對）

> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。Agent 分析的完整進度看 [`docs/features/general-analysis/STATUS.md`](../../docs/features/general-analysis/STATUS.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0016（`.gis-agent-system/decisions/0016-pulse-agent-v2-skill-plugin.md`）。

## 範圍

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #495（周邊呈現與分段浮現、免授權面板、scene-ready、地震漣漪改 Three.js、舊 skill 移除）、#496（PROD-HOME 修正）、#497（圖例來源）已合併到 master；Zeabur 已部署。 |
| **mini-pulse-gis-mcp** | #31（core 工具組、show_result／show_nearby、自動配對、pulse-analyst plugin、eval 接真地圖）、#32、#33（名稱標籤與來源）已合併；`plugins/pulse-analyst/skills/` 是 skill 的唯一來源。 |
| **gis-platform** | #134（gateway 免授權配對、樣式驗證放寬、scene-ready 測試）已合併。 |
| **taipei-gis-analytics** | #134（牧場 manifest 標題）已合併。 |
| **本機正式環境** | `analysis-prod/{gateway 232b85a, mcp fd47e9f, mini 6f3b65b2}`；8794、3734 在跑，免授權開著。 |
| **使用者層設定** | Claude `~/.claude-migu/skills/` 與 Codex `~/.codex/config.toml` 都指向 analysis-prod 的四支 skill；兩邊的 pulse-research env 都加了 `PULSE_RESEARCH_DEV_AUTOPAIR=1`。 |

## 上線狀態

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| gateway（本機 8794） | done：72 tests | done：樣式 11 種全通過 | done：#134 merged | N/A | done：設定檢查通過 | done：analysis-prod 已 checkout | done：已重啟 | done：代理回 405 | done：自動配對分頁 |
| MCP（analysis-prod） | done：462 tests＋build | done：22 工具 | done：#31–#33 merged | N/A | done：stdio 列出 22 個工具 | done | done：已 build | N/A | done：show_nearby 回 `shown:true`，截圖 prod-smoke-3 |
| mini 正式站 | done：CI 綠 | done | done：#495–#497 merged | N/A | N/A | done：資產同步完成 | done：部署 6abfeb0f 已切流量 | done：200 | not run：正式站沒有 Agent 面板，沒做目視 |
| mini 本機 3734 | done | done | done | N/A | N/A | done | done | done | done：中心點、虛線圈、分類點、人讀標籤、圖例來源 |

## 回歸測試（Sonnet、無頭瀏覽器、每題重置）

- 舊 20 題：14 → **18/20**；剩 A10（綜合指標算法分歧）。A18 修正後補測 2/2 通過。
- 分層 13 題：**12/13**（repeat 2 曾 26/26）；上圖、動靜、語氣都是 100%。
- run 紀錄：`analysis-prod/mcp/eval/agent-regression/runs/`。

## 卡點與下一步

**下一個 session 的入口**：mini-taiwan-pulse master ＋ mini-pulse-gis-mcp main。

- 目標：圖層組要能講出畫面上「看得到的現象」。
- 現在的卡點：只開圖層的題目只能回「已打開」。core 工具組沒有圖層統計或摘要，讀不到圖層背後的數值。
- 第一步：在 core 加一個唯讀的圖層摘要工具，或讓 `pulse_get_map_context` 帶回可見範圍的統計摘要。先評估哪一種成本低。
- 驗收：L01–L04 回答第二句是一個具體的現象（例如「雨集中在宜蘭山區」），而且分層題庫維持 12/13 以上。

其餘待辦見 BACKLOG 的 AG-1～AG-4。
