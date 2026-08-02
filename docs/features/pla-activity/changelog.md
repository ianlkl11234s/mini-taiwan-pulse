# PLA Activity — Changelog

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
