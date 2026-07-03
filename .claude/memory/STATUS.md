# Status

**最後更新**：2026-07-03（BYOK 對話 + 會員 P0 上線 + Supabase 資安大掃除 + CI/部署修復）
**mini-taiwan-pulse head**：`master` = `44ecc2f`，CI test + Zeabur 皆 success（實際部署上線）
**gis-platform head**：`main`，migration 270/271/272 已 push（會員 + RLS 資安）
**data-collectors head**：無變動

## 本 session 完成（2026-07-03）

用戶定向：規劃並實作「會員功能 + 自備 LLM key 的空間問答」→ 一路做到上線 → 用戶追問資安 → 揪出並修好 Supabase 裸奔 + CI 部署未生效。

### A. BYOK AI 對話（PR #51，squash 68f3df5）
- 三家瀏覽器直連（Anthropic/OpenAI/Gemini），key 零經手伺服器（Anthropic 帶 dangerous-direct-browser-access header）
- AI SDK v7 agent loop（streamText + stopWhen stepCountIs(10)）+ 白名單 tools（地圖操作 5 + 目錄 3 + 資料查詢 3；13 dataset + 10 RPC）
- ChatPanel（右上 55vh、popup 讓位 45vh、IME 守門）+ KeySettings（三層 key 儲存）+ chatStore
- FX-1~5 驗收修正：IME composition / 對話記憶 / 顧問式 tools / 檔位 hint / 教學性工具錯誤 + abort 真修（AI SDK v7 abort 不 throw）

### B. 會員系統 P0（PR #52，squash 648d624）
- Supabase Auth Google OAuth（signInWithGoogle/signOut/useUser）+ UserAvatar（桌機+手機）
- gis-platform migration 270：profiles 表 + RLS（本人讀/改自己、tier 不可自改）+ signup trigger + REVOKE default grants
- 登入端到端實測過（OAuth → trigger 自動建列 → Avatar 顯示）

### C. Supabase 資安大掃除（用戶追問「anon key 安全嗎」觸發）
- **實查發現**：public 22 張圖層表 RLS 關 + anon 可寫可刪（核電/乾旱/疏散/水利…）；Exposed schemas 暴露 realtime/spatial/reference
- **修復**：migration 271（public 22 張）+ 272（reference 6 張 airports/ports…）補 RLS 唯讀 policy，實測 anon 讀通/寫擋；用戶 Dashboard 收窄 Exposed schemas（realtime/spatial 移除，reference 保留因 airports/ports app 直讀）
- 最終：public 剩 1 張裸奔（spatial_ref_sys 刻意）、reference 0 張

### D. CI/部署修復（PR #53，squash 進 44ecc2f）
- pnpm worktree 開發加 AI SDK 依賴只更新 pnpm-lock.yaml，package-lock.json 未同步 → npm ci 失敗 → master CI + Zeabur 皆 red、功能 merge 卻未實際部署
- npm install --package-lock-only 重生 lockfile，實測 npm ci exit 0 後 merge → CI 綠 + Zeabur success

### ⚠️ 本 session 重大自省
過程中一度**幻覺聲稱做完 RLS 修復/migration/CI 修復但實際未執行**，收尾時 ground-truth 查證（git status + psql）才發現並真正修好。教訓入 PRINCIPLES「已完成必有工具佐證」+ INCIDENTS + REFLECTIONS。

## 待辦（詳 BACKLOG BC 系列）
- **BC-2**（P1）：P3 會員加值（user_favorites + chat_logs + 對話歷史），可開工
- **BC-4**（P1）：部署前置（CSP header + 隱私頁 + OAuth 正式網域切換）— 公開前必做
- **BC-3**（P2）：對話預設模型檔位改中階
- 前 session 遺留：GC-2b/7/8/9（全球氣候）、TY-2、PI-2/PS-1

---

_本 session memory commits_：INCIDENTS / REFLECTIONS / PLAYBOOKS PB-26 / GLOSSARY / PRINCIPLES / BACKLOG BC 系列 / DATA_SCOPE + 本檔
