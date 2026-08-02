# PLA Activity — Changelog

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
