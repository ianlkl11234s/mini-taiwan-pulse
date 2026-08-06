# PLA Activity — Changelog

## 2026-08-06 · 航跡向量化全自動化（前端無改動）

**症狀**：圖層預設「單日」是空的，資料停在 2026-07-31。

**根因不是 collector 掛掉** —— `live.pla_activity_daily`（數值）一路正常寫到 08-05，
連 08-01~08-05 的 `track_chart_url` 都抓到了。斷掉的是**航跡向量化**：那是
taipei-gis-analytics 的**手動批次腳本**，08-02 跑完 07-31 之後沒人再跑，
`spatial.pla_tracks` 與 `live.pla_activity_items` 就停在那天。

**修法**：轉成 data-collectors 的每日 collector `pla_tracks_vectorize`（1440 min）。

| 缺口 | 處理 |
|---|---|
| 原圖沒被保存（daily collector 只寫 URL，S3 上 588 張是一次性回填腳本傳的） | collector 下載原圖並備份 `pla/track_charts/` |
| 每日單張無法沿用「整批取中位數」的配準保護 | 固化配準常數，當張解只作一致性檢查 |
| 斷了 5 天沒有任何告警 | 新增 ledger `spatial.pla_tracks_runs`（migration **337**）並進 `realtime_tables.yaml` |

**為什麼需要 ledger 而不是直接監控 `pla_tracks`**：「共機 0 架次」是合法的 0 形狀，
那天在 `pla_tracks` 沒有任何 row —— 分不出「沒共機」與「沒跑」。這正是斷 5 天沒被
發現的原因。ledger 每個處理過的日子必有一列。

**為什麼配準要固化**（2026-05~07 實測 75 張）：`solve_georef` 有 **16% 會「成功但
錯誤」**（網格線 off-by-N，整幅平移最多 3 度 ≈ 300 km），而 `needs_review` 抓不到
（它只比對形狀數量，不驗位置）。批次流程靠中位數擋掉，單張跑就沒保護。
實測 08-01~08-05 這 5 天裡，08-04 與 08-05 的偏差正好都是 3.006°。

前端完全沒改 —— 兩支 RPC、`needs_review` 語意、popup 都不變。

## 2026-08-02 · 歷史模式支援

- 圖層在「歷史」模式可用：hook 加 `dateOverride`，由 `HistoricalTimeline` 的年/月/日
  換算成視窗結束日（歷史模式不寫 `timeStore`）
- 切進歷史模式時不再被「全部關掉只留人口」波及
- 歷史時間軸的 ▶ 負責推進，圖層自己的回放在歷史模式自動停用
- 年份清單延伸到民國 115；月/日推進上限在本圖層開著時放寬到 115
- 時間軸資料範圍提示支援本圖層（「共機活動區：115/01~115/07」）

**順手修掉一個既有 bug**：`useRealEstateTimeline` 的播放引擎只要 `historical + playing`
就跑，不管房地產圖層有沒有開；游標預設停在區間尾端 → 第一個 tick 就 `onStop()`。
症狀是**歷史模式按 ▶ 永遠只前進一格**，火災／人口一直都中招。加上 `active` guard 修正。

## 2026-08-02 · 多日疊加 + 累積回放

- gis-platform migration **331**：`get_pla_tracks_range(p_end_date, p_days, p_include_review)`，
  回傳 `days_ago`（0=最新）供前端做新舊淡化與逐日累積。已 apply production
- 疊加：單日 / 30 / 60 / 90 / 120 天，視窗結束日＝時間軸選定日
- 累積回放：從最舊一天往前播、形狀逐日長出來，18 秒一輪 + 停留 2.5 秒後 loop。
  走圖層自己的 clock（全域時間軸最多 7 天視窗），且只改 Mapbox filter 不重打 RPC
- 單日與疊加合併成同一條 loader 路徑（`fetchPlaTracksRange`，days=1 即單日）
- 依疊加天數壓低單層 alpha —— 不壓的話 120 天會糊成不透明一片（見 README「設計決策」）

## 2026-08-02 · A~D 期全上（PT-0 Phase 5）

**後端**
- gis-platform migration **330**：`spatial.pla_tracks` + `get_pla_tracks_day()` / `get_pla_track_dates()`，
  已 apply production，anon 實測通過
- 灌入 2026 年：348 個形狀 / 164 天（含 20 天待審）

**前端**（`feat/pla-activity-layer`）
- 群組「新聞 News」→「**情勢 Situation**」，底下分「事件」「軍事」兩子群
  （4 處：`layerCatalog.ts` title + `InfoModal.tsx` SectionTitle / 說明卡 / 資料來源列）
- 新圖層 `plaActivity`：10 個註冊點 + `plaTracksLoader.ts` + `usePlaActivityLayer.ts` + `PlaActivityPanel`
- 參數：透明度 slider + 「待核實」toggle（預設 off）
- 災害示警**未**搬進新群組（拍板：不改變既有使用者習慣）

**驗證**：`npx tsc -b` 綠 / `pnpm test` 237 passed / 瀏覽器四鐵則全過

## 2026-08-02 · 向量化通過率 69.9% → 85.4%（上游 taipei-gis-analytics）

- 表格項次依類型分流（`table_items.py`，tesseract 讀英文行）—— 空飄氣球不該抽成多邊形
- 氣球圖徽抑制 —— 只扣期望數會把「抽太少」換成「抽太多」
- 已知目標數引導重試（`extract_guided`）+ 品質門檻擋掉湊數字的方案

方法與失敗紀錄見 `taipei-gis-analytics/docs/topic-research/defense_pla/shape-extraction-methodology.md`。

## 2026-08-02 · collector 部署止血

線上 collector 是舊版、每 30 分鐘覆蓋修好的資料。data-collectors PR #41 merge → Zeabur 自動部署。
部署後資料自行修正，不需回填：730 天 0 筆舊版截斷、近 21 天無缺漏。

## 2026-08-01 · 資料修復與回填（前一個 session）

11 個解析 bug 全修；`live.pla_activity_daily` 達 729 天零缺日、架次覆蓋 100%。
圖片版時代（~2025-02-02 前，185 天）以 subagent 讀圖轉錄，中英交叉驗證 0 筆不符。
