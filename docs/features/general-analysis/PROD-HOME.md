# Agent 分析正式環境：唯一的家（2026-09-29 整併）

本機 Agent 分析（MCP、skill、研究 gateway、分析倉庫快取、分析結果）只放在一個地方：

```
mini-taiwan-pulse/.worktrees/analysis-prod/
├── mini/      mini-taiwan-pulse，detached 在 origin/master（skill、3734 前端）
├── mcp/       mini-pulse-gis-mcp，detached 在 origin/main（MCP dist）
├── gateway/   gis-platform，detached 在 origin/main（研究 gateway 8794）
└── runtime/   資料（不進 git）：倉庫快取、分析結果、gateway 資料庫、啟動腳本、log
```

- Claude（`~/.claude-migu/.claude.json`）與 Codex（`~/.codex/config.toml`）的 pulse-research 都指向 `analysis-prod/mcp/dist/research/index.js`，快取分別在 `analysis-prod/runtime/warehouse-cache` 與 `warehouse-cache-codex`。
- 相容連結（勿刪，舊設定與 UI worktree 仍可能用到）：`.worktrees/runtime` → `analysis-prod/runtime`、`.worktrees/research-streamline/runtime` → `../analysis-prod/runtime`。
- `research-streamline/mini` 不是正式環境，但**不能刪**：多個 UI worktree 的 `node_modules` 連結到它。

## Skill 與連線方式（2026-10-03 起）

- **Skill 唯一來源**：`analysis-prod/mcp/plugins/pulse-analyst/skills/{pulse-conductor,pulse-layers,pulse-overlay,pulse-insight}`。Claude：`~/.claude-migu/skills/<name>` symlink 指向這裡；Codex：`~/.codex/config.toml` 的 `[[skills.config]] path` 指向各 SKILL.md。mcp 更新後 skill 自動跟著更新（不用再改連結）。
- **正式站連線**（日常用法）：`pulse-research` 的 `PULSE_RESEARCH_ORIGIN=https://mini-taiwan-pulse.itsmigu.com`（Claude 與 Codex 都已設，dev autopair／loopback 旗標已移除）。
  1. 在正式站登入，Agent 面板（站主在正式站也看得到）產生 token，複製。
  2. `cd analysis-prod/mcp && pbpaste | npm run token:save`，存到 `~/.config/pulse-research/agent-token`（0600）。
  3. 保持正式站分頁開著；Agent 第一次動地圖時 MCP 自動接上該分頁。開多個分頁會請你選分頁（`pulse_pair_session`）。token 可在面板撤銷，30 天到期。
- **本機測試**（只在 127.0.0.1＋vite dev，用測試身分，不登入）：
  1. gateway：`runtime/start-v03-gateway.mjs` 的 env 設 `PULSE_RESEARCH_TEST_IDENTITY: '1'`（host 或 origin 不是 loopback 會拒絕啟動）；
  2. 前端：`analysis-prod/mini/.env.local` 寫 `VITE_RESEARCH_TEST_IDENTITY=1`（`.env` 是指向主 repo 的 symlink，`.env.local` 是獨立檔，已 gitignore）；
  3. token：`node gateway/services/research-gateway/scripts/mint-test-token.mjs --origin http://127.0.0.1:8794 --out <file>`，MCP 的 token 檔指到它，`PULSE_RESEARCH_ORIGIN` 指向本機。
- 工具組：MCP 預設 `PULSE_TOOLSET=core`（22 個）；要舊的全部工具設 `PULSE_TOOLSET=full`。

## 更新（任何一個 repo 合併後）

```bash
cd mini-taiwan-pulse/.worktrees/analysis-prod
git -C mini    fetch -q origin && git -C mini    checkout --detach origin/master   # vite 會熱更新
git -C mcp     fetch -q origin && git -C mcp     checkout --detach origin/main && (cd mcp && npm run build)
git -C gateway fetch -q origin && git -C gateway checkout --detach origin/main     # 之後重啟 8794
```

mcp 更新後，在 Claude Code 用 `/mcp` 重連 pulse-research（重連會清空 wh-* 結果）。

## 啟動與停止

```bash
cd mini-taiwan-pulse/.worktrees/analysis-prod
# gateway 8794（只接受 http://127.0.0.1:3734）
(cd gateway && ( nohup node ../runtime/start-v03-gateway.mjs > ../runtime/gateway-8794.log 2>&1 & ))
# 前端 3734（本機測試用；Agent 面板在 dev 與正式站站主都看得到）
(cd mini && ( PULSE_RESEARCH_GATEWAY_ORIGIN=http://127.0.0.1:8794 nohup npx vite --host 127.0.0.1 --port 3734 --strictPort > ../runtime/vite-3734.log 2>&1 & ))
```

- 雙層括號讓程序掛在系統下，不會隨 Claude session 結束。
- 停止：`lsof -tiTCP:8794 -sTCP:LISTEN` 取 PID 後 `kill <PID>`；3734 另需 kill 其父程序 `npm exec vite`。**不要 pkill**。
- `mini/.env` 是指向主 repo `.env` 的 symlink；除錯時不要 curl vite 轉譯後的原始碼模組（會印出 VITE_* 金鑰）。
- 健康檢查：gateway 根路徑回 404、`http://127.0.0.1:3734/api/research/v1/` 回 405 代表代理通到 gateway。

## 全雲端準備清單

目標是之後不依賴本機 Mac。長期路線與主機現況見 [zeabur-cloud-engine-option.md](./zeabur-cloud-engine-option.md)；下表是「每一塊現在在哪、搬上雲要做什麼」。

| 元件 | 現在 | 雲端去處 | 已就緒 | 還缺 |
|---|---|---|---|---|
| 分析倉庫正本 | R2 `pulse-warehouse`（版本化 GeoParquet） | 不變 | ✅ | — |
| 倉庫快取 | `runtime/warehouse-cache*`（本機，上限 3GB） | 雲端主機的持久磁碟 | — | 主機與磁碟（見 zeabur 文件） |
| MCP | 本機 stdio（`analysis-prod/mcp`） | 遠端 MCP（HTTP）服務 | 程式不持有 Supabase 寫入憑證 | 遠端傳輸層、認證、Google／Valhalla 對外呼叫的金鑰管理 |
| 研究 gateway | 正式：Zeabur `research-gateway`（2026-10-03 上線）；本機 8794 供測試 | 已在 Zeabur；正式站 nginx 代理 `/api/research/v1/` | ✅ 程式在 gis-platform、CI 有測試 | 持久儲存是否足夠（`research.sqlite`）待觀察 |
| 分析結果檔 | `runtime/warehouse-results`（本機） | 物件儲存或 session 暫存 | — | 保存期限與清理規則 |
| Agent 面板 | dev＋正式站站主（2026-10-03） | 正式站 owner 限定 | ✅ 面板產生／撤銷 token | — |
| 分析卡 | Supabase `analysis_cards`＋`/card/` | 不變 | ✅ | — |
| 回歸測試 | 本機 `npm run eval:agent`（訂閱登入） | CI 或排程雲端 agent | 題目與檢查不依賴本機以外的東西（倉庫除外） | 雲端倉庫可用後才能在 CI 跑 |

`runtime/` 裡另有大量 2026-09 研究期的 log 與 readback JSON，屬歷史紀錄，搬雲時不需要帶走。
