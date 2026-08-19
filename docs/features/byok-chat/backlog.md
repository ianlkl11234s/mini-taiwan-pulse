# Backlog — byok-chat

> 全站對應：`.claude/memory/BACKLOG.md` 之後加 BC 系列。規劃 SSOT：`docs/proposal/member-byok-chat-plan.md`。

## Active work（進行中／待辦）

（無）

## Product / release backlog

- [ ] **BC-2** · `product` · P1 · `ready`：P3 會員加值 — `user_favorites`（圖層狀態快照收藏）+ `chat_logs`
  （含匿名 session_id，已拍板）+ 對話歷史跨裝置；依賴 BC-1
- [ ] **BC-3** · `research` · P2 · `waiting_external`：預設模型檔位是否從最便宜檔改中階檔（Flash/Sonnet 級）— 用戶待決
- [ ] **BC-4** · `security` · P1 · `ready`：部署前置 — CSP header（connect-src 三家 LLM 域名）+ 隱私頁 BYOK 揭露
  + **OAuth 網域切換**：Supabase Site URL 改正式網域、Redirect URLs 加正式網域、
    Google Console「已授權的 JavaScript 來源」加正式網域（測試期全走 localhost，2026-07-03 拍板）
- [ ] **BC-5** · `tech-debt` · P2 · `ready`：`police_stations_20260626` 日期戳 URL 改吃 manifest 或 latest 別名（上游換版免同步）
- [ ] **BC-6** · `product` · P3 · `conditional`：Anthropic 進階檔開 extended thinking（AI SDK providerOptions）
- [ ] **BC-7** · `research` · P2 · `waiting_external`：Phase 4 選項 — 站方付費免費額度（Edge Function + 單 key，AR-43 原案）／
  對話結果 pin 成 Monitor 面板（AR-44）／P2 layer manifest 落地後 tool 目錄來源切換

## Decision needed

- BC-3、BC-7 需 owner 分別拍板模型檔位與 Phase 4 方向；拍板前不開工。

## Conditional / triggered later

- BC-6 Trigger：產品與成本評估通過；Next action：補 providerOptions 與成本 guard；Acceptance：browser + provider test。

## Completed / historical（已完成／歷史）

- [x] **BC-1**：P0 會員系統 — migration 270 + auth.ts + UserAvatar + OAuth 端到端實測 — PR #52, 2026-07-03

- [x] P1 對話 MVP（BYOK 三家直連 + 地圖 tools + UI）— PR #51, 2026-07-02
- [x] P2 資料問答（13 dataset + 10 RPC 白名單 + h3 人口 join）— PR #51, 2026-07-03
- [x] 高度讓位（popup 開啟自動縮 45vh）— PR #51, 2026-07-03
- [x] FX-1~5 驗收回饋修正（IME / 對話記憶 / 顧問式 tools / 檔位 hint / agentic 人體工學 + abort 真修）— PR #51, 2026-07-03
