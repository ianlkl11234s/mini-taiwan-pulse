# Status

**最後更新**：2026-07-07（owner-gated 資料資產鎖定 + 分層治理後台 + lock_type + 電廠洩漏修補）
**mini-taiwan-pulse head**：`master` = `2de4c3f`（PR #63 docs）；本 session 6 PR 全 merged，本地=遠端
**gis-platform head**：`main` = `e30796a`（migration 275/276/277/278/279）
**data-collectors head**：無變動

## 本 session 完成（2026-07-07）— 接手他人 session 續作

起手：用戶要把畜牧/污染等私有圖層「鎖起來不讓外部取得」、結合會員系統、做管理後台。從另一帳號的中斷 session（`~/.claude-work/.../c4d972ee`）讀 transcript 接續。

### A. 資料真鎖（Phase 1，前端 #60 + gis #28 migration 275）
- 34 層（畜牧 8 / 石化油氣 10 / 電網 6 / 電廠 9 + aviationGlow）從「前端假鎖」升級：22+ 支 RPC 改 SECURITY DEFINER + owner 守門、19 張表 REVOKE anon。
- **關鍵洞察**：光下架 CDN 鎖不住（anon key 公開 + staticRpc 404 fallback 打真 RPC）→ 真斷源在 DB REVOKE。
- 加油站是公開資料 → 拆出公開 `get_gas_station_layers`（不鎖）。排除：灌排渠道 / 電桿（用戶指定）。
- 前端：gated 旗標 + 單色鎖頭雙 sidebar + 非 owner 擋 toggle；石化/電網/電廠 loader 改直連 RPC；畜牧改 owner-only RPC 動態載入；deploy 腳本斷源（S3 不刪、只斷供應）。

### B. 分層治理後台（Phase 2，migration 276）
- 分層 tier（free<member<insider<owner）+ 3 治理表（gated_layers/dataset_freshness/access_audit_log）+ enforce_layer_access 守門 + 6 admin RPC + 公開 get_layer_gates。
- 站內 owner-only 後台四分頁（會員/tier、稽核、圖層鎖定、資料新鮮度）。動態 gating（DB SSOT，fail-safe 維持鎖定）。

### C. lock_type 分型（Phase 3，前端 #62 + gis #30 migration 278）
- gated_layers 加 lock_type（ui/full）。純宣告、不動 grant（防誤公開）。34 層全 full（乾淨鎖）。

### D. 安全審計 + 洩漏修補（migration 277/279）
- 上線後派獨立安全審計 agent 全掃 → ✅ 畜牧/石化/電網/PostgREST schema 繞道/git 歷史/CDN/防提權全守住。
- 🔴 掃出電廠 `public` schema 漏鎖（all_power_plants_v 等 4 個 anon 可讀）→ migration 279 REVOKE。
- 🐛 read-only tx regression（STABLE func + audit INSERT → 25006）→ migration 277 改 VOLATILE。詳 INCIDENTS 2026-07-07。
- denied 稽核落地限制：RAISE 令表 INSERT rollback → 改 RAISE LOG 寫 server log（app 表只留 granted）。

### E. 文件（PR #63）
- docs/features/owner-gated-layers/README 補 Phase 3 + 安全模型（三道防線）+ 2026-07-07 審計紀錄。

### 協作 / 工作區
- 主 agent 定契約 + delegate（DB 查核 / 前端 gating / migration / 安全審計 / lock_type）。用 worktree 隔離把混合工作區拆成各自乾淨 PR（PB-28），全程零觸碰用戶其他 WIP。

## 待辦
- **OG-1**（P2）：anon key 濫用防護 / Supabase Spend Cap（機密已鎖，殘餘僅額度濫用）— 用戶之後處理
- **OG-2~4**（P3）：freshness 後台編輯 / UI 鎖首個實際圖層驗收 / powerPlants owner 存取
- 前 session 遺留：BC-2/4a/4b、AR-11e/12~16、SC-1、GC/SAT/NE/MO 系列
- ⚠️ **工作區有用戶並行 WIP（本 session 未碰）**：淺色底圖主題化（App/DataSourceBrowser/IconRailSidebar + 全 featureInfo panels + 新 featureTheme.tsx）+ 會員規劃 docs（member-features-plan.md 等）

---

_本 session memory commits_：INCIDENTS / PRINCIPLES / PLAYBOOKS PB-28 / REFLECTIONS / GLOSSARY / BACKLOG（OG 系列）+ 本檔
