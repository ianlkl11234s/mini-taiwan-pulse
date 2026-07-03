# Backlog — byok-chat

> 全站對應：`.claude/memory/BACKLOG.md` 之後加 BC 系列。規劃 SSOT：`docs/proposal/member-byok-chat-plan.md`。

## 進行中

- [ ] **BC-1**：P0 會員系統（Supabase Auth Google OAuth）— 等 OAuth 憑證備妥，
  migration（profiles + RLS + trigger）+ `src/lib/auth.ts` + Avatar；分支 `feat/member-auth`

## 待辦

- [ ] **BC-2**：P3 會員加值 — `user_favorites`（圖層狀態快照收藏）+ `chat_logs`
  （含匿名 session_id，已拍板）+ 對話歷史跨裝置；依賴 BC-1
- [ ] **BC-3**：預設模型檔位是否從最便宜檔改中階檔（Flash/Sonnet 級）— 用戶待決
- [ ] **BC-4**：部署前置 — CSP header（connect-src 三家 LLM 域名）+ 隱私頁 BYOK 揭露
  + **OAuth 網域切換**：Supabase Site URL 改正式網域、Redirect URLs 加正式網域、
    Google Console「已授權的 JavaScript 來源」加正式網域（測試期全走 localhost，2026-07-03 拍板）
- [ ] **BC-5**：`police_stations_20260626` 日期戳 URL 改吃 manifest 或 latest 別名（上游換版免同步）
- [ ] **BC-6**：（選配）Anthropic 進階檔開 extended thinking（AI SDK providerOptions）
- [ ] **BC-7**：Phase 4 選項 — 站方付費免費額度（Edge Function + 單 key，AR-43 原案）／
  對話結果 pin 成 Monitor 面板（AR-44）／P2 layer manifest 落地後 tool 目錄來源切換

## 已完成（近期）

- [x] P1 對話 MVP（BYOK 三家直連 + 地圖 tools + UI）— PR #TBD, 2026-07-02
- [x] P2 資料問答（13 dataset + 10 RPC 白名單 + h3 人口 join）— 同 PR, 2026-07-03
- [x] 高度讓位（popup 開啟自動縮 45vh）— 同 PR, 2026-07-03
- [x] FX-1~5 驗收回饋修正（IME / 對話記憶 / 顧問式 tools / 檔位 hint / agentic 人體工學 + abort 真修）— 同 PR, 2026-07-03
