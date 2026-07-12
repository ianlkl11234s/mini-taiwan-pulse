# Monitor v2 執行報告（T1–T6 全數完成）

> 2026-07-09 執行。規劃：`docs/proposal/monitor-v2-plan.md`；手冊：`docs/proposal/monitor-v2-overnight-runbook.md`。
> 全程：worktree 隔離、未 push、未動 production DB、未觸碰 `feat/light-theme` 工作區。

## 完成清單

| 任務 | 狀態 | 產出 |
|---|---|---|
| T1 DB 驗證 | ✅ | `T1-db-verification.md` |
| T2 機場卡 hotfix | ✅ | branch `fix/monitor-airport-card`（1 commit） |
| T3 registry 化 | ✅ | branch `feat/monitor-widget-registry`（5 commits） |
| T4 可配置佈局 | ✅ | branch `feat/monitor-grid-layout`（6 commits，含 review 修正） |
| T5 快贏卡 ×4 | ✅ | branch `feat/monitor-widgets-batch1`（5 commits，含 review 修正） |
| T6 驗收 | ✅ | 兩路 Opus code review + 修正回圈 + 主 agent 實跑抽驗 |

**最終驗證（主 agent 實跑）**：`feat/monitor-grid-layout` tip `5e0f80b` → tsc 綠 + 214 tests 全過；`feat/monitor-widgets-batch1` tip `51b06f6` → tsc 綠 + 195 tests 全過。主工作區僅新增 docs 檔案。

## T1 關鍵結論

- **幾乎所有 realtime 表都活著**（電力三表 6–16min、水資源四表、空品、急診、航班 40s、地震、颱風、落雷、輻射）→ 原規劃的「Phase 4 重啟 collector」大幅縮水，只剩一項。
- 🔴 唯一斷流：`public.drought_alert_current`（水情燈號）停在 2026-05-15，**斷 53 天**，需查 collector。
- 執行時有活躍颱風 **Bavi (TC2611)**，颱風卡上線即有內容。

## 各分支內容

### `fix/monitor-airport-card`（基於 master 2de4c3f）
- `9e59e24`：TimeseriesSparkline `<svg>` 補 CSS height（root cause：viewBox 比例隨容器寬反推高度）+ 底部卡片列高度守門。5 處使用處全數確認為回歸預期行為。

### `feat/monitor-widget-registry`（基於 T2）
- 11 個邏輯 panel 全數進 `widgetRegistry.ts`（id/group/defaultSize/dataDeps/pollMs/conditional）
- 輪詢集中 `useMonitorData` manager：per-key ref-count、同 key 共享 fetch、歸零停 timer、記 `lastFetchedAt`
- 每 widget freshness badge（>2×pollMs 轉警示色）
- 新增 registry 一致性測試；`AirportPaxCard`/`prison` 補 loadingRegistry 合規

### `feat/monitor-grid-layout`（基於 T3）
- react-grid-layout v2 + 12 欄畫布（原 indicator 區 + 底部卡合併）；新聞 Feed / TimelineDock / 頁首為固定框架
- View/Edit mode + widget 目錄抽屜 + 「重置此版面」；三 preset：default（還原現狀）/ security / development
- 版面存檔會員限定：`useUser()` gating + `MONITOR_LAYOUT_PERSIST_ENABLED = false`（flag off 走 session in-memory，絕不打 Supabase）
- **key-diff 訂閱**（review 修正）：畫布移除 widget → 該資料源輪詢真正停止，且增刪不觸發全量 refetch
- migration 草稿：`user_monitor_layouts.sql`（RLS per-user + SECURITY DEFINER VOLATILE upsert，**未 apply**）
- agent-browser 實測：11 格渲染 / 拖拉 resize / 移除加回 / preset reflow / Esc 全通過

### `feat/monitor-widgets-batch1`（基於 T3）
| 卡 | 資料 | 狀態 |
|---|---|---|
| 地震 | 複用 `earthquakeLoader`（public view，排除 catalog）| 可用；pollMs 15min 對齊快取 TTL |
| 颱風 | 改查 `public.typhoons_active` view（牆鐘 24h，review 修正）+ 跨源補齊氣壓/風速 + 距台距離 | 可用；無颱風自動隱藏 |
| 輻射 | RPC `get_nuclear_radiation_status`，兩級分級（0.2–0.5 觀察橙 / >0.5 超標紅）| 可用（51 站全正常）|
| 落雷 | 需新 RPC `get_lightning_summary`（草稿在 `rpc-drafts.sql`）| **flag 短路隱藏**，apply 後翻 `LIGHTNING_SUMMARY_RPC_READY = true` |

## Review 結果摘要

- T2–T4 鏈：無 HIGH。M1（移除 widget 不停輪詢）+ 3 LOW → 已修（`5e0f80b`）。RLS 草稿、StrictMode 生命週期、會員 gating、timeStore 規則全數 CONFIRMED 乾淨。
- T5：HIGH 颱風幽靈卡（活躍判定相對資料最新點而非牆鐘）+ 2 MED + 4 LOW → 已修（`51b06f6`）。距離計算 / 時區 / conditional 隱藏 / 地震排序驗證正確。

## 建議 merge 順序與衝突備註

1. PR① `fix/monitor-airport-card` → squash 進 master
2. PR② `feat/monitor-widget-registry` → rebase 到新 master 後 squash（單人 squash flow，stacked branch 每段 merge 後下一段先 rebase）
3. PR③ `feat/monitor-grid-layout` → 同上
4. PR④ `feat/monitor-widgets-batch1` → **預期衝突**：與 T4 同時改了 `useMonitorData.ts`（T4 動訂閱段/useAirportPax，T5 加 SOURCES 四個 key）、`widgetRegistry.ts`（T4 加 deriveActiveKeys/FRAME_KEYS，T5 加 4 widget 定義），皆為可加法合併的區塊級衝突。
5. ⚠️ **merge PR④ 後必做**：`layoutPresets.ts` 三 preset 只含原 11 widget — 需把 4 張新卡排入 preset（或確認 preset 一致性測試的斷言方向），否則新卡只能從目錄抽屜手動加。

## 遺留事項（需用戶決定/操作）

1. **兩份 SQL 待 review + apply**（gis-platform migration）：`user_monitor_layouts.sql`（會員版面表）、`rpc-drafts.sql`（get_lightning_summary；apply 後翻前端 flag）
2. **水情燈號 collector 斷流 53 天** — data-collectors 端查 `wra_drought_alert` 排程/來源站
3. **Browser 最終驗收**：本機無 Supabase 憑證，資料層畫面（badge/卡片內容/preset 高度校準 rowHeight=28）需在有憑證環境目視；既有問題：`UserAvatar` 在 stub client 缺 `.auth` 時會 crash 整個 app（T4 前既存）
4. `MONITOR_LAYOUT_PERSIST_ENABLED` 於 migration apply 後翻 true
5. 文件債：`EXTERNAL_COLLECTORS.md` HiCloud 清單漏 `immigration_apis_airport`；BACKLOG AI-1 已大半落地未銷帳；data-collectors 的 cross_layer_map「enabled」與 DB 實況不符（電力/水資源/空品/急診其實都在寫入）值得校正
6. Worktree 清理（merge 完後）：`git worktree list` → `git worktree remove .claude/worktrees/agent-*`（4 個）
7. `package-lock.json` 未隨 `pnpm add react-grid-layout` 更新（pnpm 專案，僅提醒）

## 後續 roadmap 位置

本輪完成 plan 的 Phase 0–3（batch 1）。未動：Phase 3 剩餘卡（交通壅塞/船舶/A1/台北治水）、Phase 5（sentinel detector runner、Realtime push MO-12、匯率 MO-16、Cofacts MO-7 等）。
