# Monitor v2 過夜執行手冊（2026-07-09 02:00 啟動）

> 主 agent（本 session）於 02:00 被排程喚醒後，依本手冊分派子 agent、驗收、產出夜間報告。
> 依據：`docs/proposal/monitor-v2-plan.md`（§6 拍板結果已確認）。

## 鐵則（每個子任務 prompt 都要帶上）

1. **不碰用戶工作區** — `feat/light-theme` 與其未提交變更完全不動。所有寫碼任務一律 worktree 隔離。唯一例外：夜間產出物寫到 `docs/proposal/monitor-v2-night/`（僅新增檔案，不改主工作區既有檔案）。
2. **不 push、不開 PR、不動 production DB** — migration 只起草 SQL 檔不 apply；DB 查詢只 read-only。
3. **完成定義** = `npx tsc -b` + `pnpm test` 全綠（worktree 內先 `pnpm install` 若 node_modules 缺）。
4. Commit 照 CLAUDE.md 慣例（conventional prefix + Co-Authored-By），分支照本手冊指定。
5. **模型分配**：寫碼/重構 = Opus；查核/盤點/報告 = Sonnet。
6. 遇 blocker：記入夜間報告後跳過該任務繼續下一個，不硬做、不擴 scope。

## 任務鏈（依序執行，T2→T3→T4→T5 為 stacked branches）

### T1 — DB 現況驗證（Sonnet，read-only，先跑）
用 `SUPABASE_DB_URL` psql 查各表最新寫入時間（判定：最新 timestamp 距今 < 2× 收集間隔 = 活著）：
- 電力：`realtime.power_system_status` / `power_generation_unit` / `power_region_demand`
- 水資源：`realtime.reservoir_status` / `river_water_level` / `rain_gauge_readings` / `groundwater_level_readings`、`public.drought_alert_current`
- 空品：`realtime.air_quality_observations`；急診：`realtime.er_hospital_status`
- 航班：`realtime.flight_positions`
- 順帶查 `get_power_dashboard` RPC 定義，釐清 PowerCard 資料源頭
- Phase 3 依賴表也確認：`earthquake_events`、`typhoon_positions`、`lightning_events`、`nuclear_radiation_measurements`
- 輸出 → `docs/proposal/monitor-v2-night/T1-db-verification.md`（表格：表名 / 最新時間 / 判定 / 備註）

### T2 — Phase 0 hotfix（Opus，worktree，branch `fix/monitor-airport-card`，自 master）
- `src/components/TimeseriesSparkline.tsx:137`：style 補 `height`（`preserveAspectRatio="none"` 會自動拉伸）
- `src/components/intel/monitor/` 底部卡片 grid（`MonitorPanel.tsx:711` 一帶）：補 `minHeight:0` + 高度守門（`maxHeight` 或收進右欄捲動區，取對現有版面影響最小者）
- tsc + test 綠 → commit

### T3 — Phase 1 registry 化（Opus，worktree，branch `feat/monitor-widget-registry`，基於 T2 分支）
- 新增 `src/components/intel/monitor/widgetRegistry.ts`，介面照 plan §3.2（id/title/group/component/defaultSize/minSize/dataDeps/pollMs/conditional）
- 現有 14 panel 全數包成 widget 進 registry；**佈局渲染順序與現狀完全一致**（純內部重構，畫面不變）
- Polling 集中成 manager（同 RPC 共享、widget mount 才訂閱；AirportPaxCard 自抓收編進 manager）
- 每 widget 加 freshness badge（資料時戳 + stale 樣式；可先吃各 loader 回傳時間）
- tsc + test 綠 → commit（可拆多個小 commit）

### T4 — Phase 2 可配置佈局（Opus，worktree，branch `feat/monitor-grid-layout`，基於 T3）
- `pnpm add react-grid-layout`（v2）
- Edit mode（拖拉/resize/widget 目錄抽屜增刪）+ 三套 preset（預設＝現行排列 / 安全 / 發展）
- **自訂版面 = 會員限定**（沿用既有會員 session 判斷；非會員只能切 preset）
- Supabase 持久化：起草 migration SQL → `docs/proposal/monitor-v2-night/user_monitor_layouts.sql`（**不 apply**）；前端先 feature flag + in-memory stub
- Wall mode 相容性驗證（tsc + test 綠）→ commit

### T5 — Phase 3 快贏 widget batch 1（Opus，worktree，branch `feat/monitor-widgets-batch1`，基於 T3 分支；若 T4 已完成則基於 T4）
- 依 T1 驗證結果，資料活著者依拍板順序做：**地震卡 → 颱風卡（conditional：無颱風不顯示）→ 輻射卡 → 落雷卡**；時間允許再加交通壅塞卡
- 每張卡 = loader（走 `loadingRegistry`）+ registry 一筆 + 元件檔；RPC 若缺就用既有表薄查詢並記入報告（不新建 DB 物件）
- 動態時間一律走 `timeStore` 訂閱（CLAUDE.md §6），不收 currentTime prop
- 每張完成各自 commit；tsc + test 綠

### T6 — 驗收（主 agent 收尾）
1. 每個分支：確認 tsc + test 實跑全綠（不信子 agent 自述，抽驗跑一次）
2. 派 code-review agent 掃 T2–T5 diff（正確性為主）
3. 夜間報告 → `docs/proposal/monitor-v2-night/NIGHT-REPORT.md`：
   - 完成/未完成清單 + blocker
   - T1 驗證結論（哪些 collector 其實活著、哪些真斷流需重啟）
   - 分支清單 + 建議 merge 順序（T2 → T3 → T4 → T5，squash 各自 PR）
   - 遺留事項（migration 待 apply、preset 微調、browser 驗收待用戶做）
4. 早上向用戶摘要（聊天訊息）

## 時間預算

02:00–08:00。護欄：06:30 前未開始 T4 → 跳過 T4，直接做 T5（基於 T3）保住快贏卡；07:30 起只收尾不開新任務。
