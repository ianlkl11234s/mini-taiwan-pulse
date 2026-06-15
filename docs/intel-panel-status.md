# Intel Panel — 即時情報 docked panel · Status

> 分支：`feat/intel-panel`（3 repo 同時開）
> 起：2026-06-14
> 來源：`docs/proposal/monitor-mode.md` + Claude Design Intel.html handoff（/tmp/design-intel/）
> 範圍：**只做 Explore mode 左側 docked panel**，Monitor / Wall / Indicator / TimelineDock 一律 Phase 2

## 設計檔重點抽出

7 分類 + 顏色與既有 `newsEventTypes.ts` 完全一致（label/color 都同），唯一差別：design key `safety` vs backend `crime`（label 都「治安」）→ **保留 `crime`**。

UI 結構（左 64 / top 98 / bottom 14 / width 412 glass panel）：
1. **Header** — Radio icon + 即時情報/INTEL + LIVE pulse + close
2. **Status row** — 更新 HH:MM · 共 N 則 · 來源 28/29 popover · ⟳ 倒數
3. **Filters** — 7 chip multiselect + 1h/6h/24h + 縣市 dropdown + 相關度 segmented + 只看事件 toggle
4. **現況 SITUATION** — 24h 7 色堆疊直方 + 熱區 TOP 5 + 分級 one-liner
5. **Card list** — timeline spine 風格，行內展開 meta grid + 跨來源 / 同地點集群 / 原文連結
6. **Replay scrubber** — 底部，play/pause + LIVE button + range slider 接 timeStore

## Phase 1 任務清單（夜間執行 — 已全數完成 ✅）

| # | 任務 | repo | commit |
|---|---|---|---|
| A1 | migration 166 升溫 pre-aggregate + `get_news_trending` | gis-platform | `a7f3f27` |
| A2 | migration 167 source_health + collector 寫入 + `get_source_health` | gis-platform + data-collectors | `acc7114` + `88af2c9` |
| B | 拆 `newsFilter` 為 3 軸 state | mini-taiwan-pulse | `89f0a19` |
| C1 | IntelPanel 殼 + Header + Replay | mini-taiwan-pulse | `b891396` |
| C2 | IntelFilters | mini-taiwan-pulse | `0b15ecd` |
| C3 | IntelSituation 現況 | mini-taiwan-pulse | `b2d30a2` |
| C4 | IntelCard timeline spine | mini-taiwan-pulse | `89aea63` |
| D | 接線 + IconRail 入口 + filter 同步 | mini-taiwan-pulse | `e9d5e4f` |

## 早上驗收 checklist

### 後端（Supabase 已實際跑過）
- [x] migration 166 已 apply，cron job 57 重排，seed 7 天 934 行
- [x] `SELECT * FROM public.get_news_trending(6,5);` 回 5 行含 surge_ratio
- [x] migration 167 已 apply
- [x] `SELECT * FROM public.get_source_health();` collector 跑過後會有 29 列
- [ ] 確認 cron 'refresh-news-events' 下一輪（XX:01）有跑到 hourly refresh

### Browser 驗收
1. 啟動 dev server `npm run dev`，瀏覽 localhost:3721
2. **左側 IconRail 應出現新的 Radio 圖示**（在 MapPin 下方）
3. 點 Radio → 左側拉出 412px 寬玻璃面板（top:98 / bottom:14）
4. **Header**：即時情報 / INTEL / LIVE pulse / 共 N 則 / 來源 29/29 popover / 倒數
5. **Filter**：7 分類 chip / 1h-6h-24h / 縣市 dropdown / 相關度 / 嚴重 / 只看事件
6. **現況**：24h 7 色堆疊直方圖 + 熱區 TOP 5（含 🔥）+ 分級 one-liner
7. **卡片**：timeline spine 風格，點卡片地圖飛去，再點展開顯示 meta grid
8. **Replay**：底部拉桿，play 動畫掃過 24h 重播
9. **filter 同步**：在 Intel panel 改相關度 → sidebar newsEvents 的副 control 同步、地圖 pin 也跟著重抓
10. **layer toggle 不會消失**：newsEvents toggle 仍可在 sidebar 開關（與 Intel panel 並列）

### 未做（Phase 2）
- Monitor mode / Wall mode / 右側 IndicatorPanel / TimelineDock 多軌
- 國家信號 widget / 直播 embed
- 地圖 pin click → scroll panel + 展開（單向 only 目前）
- 升溫 chip 動畫 / 卡片進場動畫
- 手機 fallback（< 1280px panel 會擠出畫面）

## 已決定

| 決策 | 結果 |
|---|---|
| 相關度 filter | **完全照設計檔** — 3 軸 `minRelevance(0/2/3)` + `eventsOnly(bool)` + `minSeverity(0/1/2)`，預設 2/true/1 ≈ 現在 important |
| 🔥升溫 | **後端 RPC**（A1）— 升溫定義 `cnt / NULLIF(baseline_avg, 0) >= 2`，baseline 過去 7 天同小時平均 |
| 來源健康 | **後端落地**（A2）— realtime.source_health 表 + collector upsert |
| layer toggle | **保留** — Intel panel 與 sidebar newsEvents toggle 並列，共用 state |
| 7 分類顏色 | 已一致，不動 |
| `crime` vs `safety` | 維持 `crime` |

## P0 守則（執行時必守）

來源：CLAUDE.md §4 效能守則 + `.claude/memory/PRINCIPLES.md`
1. refresh function 的 WHERE + ORDER BY 必須有索引（缺索引 = 全表 sort = OOM）
2. today + yesterday 放同一個 cron job 循序跑（**禁止拆兩個 job**）
3. 聚合用 `MAX()` 而非 `mode()`
4. `SET work_mem TO '64MB'` 減少 disk spill
5. cron 排程錯開分鐘

## 提交順序（夜間自動化）

每完成一個 task = 一個 commit，分支不 push，等用戶早上驗收：
1. A1 commit on gis-platform
2. A2 commit on gis-platform + data-collectors（兩 repo 分開 commit）
3. B commit on mini-taiwan-pulse
4. C1/C2/C3/C4 各一 commit
5. D commit + tsc 驗證

## 風險

- migration 166 / 167 已部署上 Supabase；不能破壞 162/164/165 既有 RPC 與資料
- collector 寫 source_health 失敗不能擋主流程（try/except + log warn）
- 雙 repo 同時加 cron 步驟到 job 55 — 確認串入位置不影響既有 today/yesterday 順序
- Intel panel 與 layer panel 互斥，不能讓 newsEvents layer 在 Intel 開啟時消失

## 完成定義

- 三 repo 各自 commit 完整、未 push
- `npx tsc -b` 通過
- migration 在 Supabase 跑成功、cron job 正常
- 早上人工 browser 驗收
