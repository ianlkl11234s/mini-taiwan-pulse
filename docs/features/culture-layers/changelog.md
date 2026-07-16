# Changelog — culture-layers

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-16 — PR 待開（branch feat/culture-layers，3 commits）

- `aacdc41` feat(culture)：4 靜態藝文圖層（culturalFacilities 787 / culturalMuseums 252 / artsEvents 6,121 / performingVenues 857），新 sidebar 主題「文化 Culture」，色票 SSOT `cultureTypes.ts`、popup `culturePanels.tsx`，nginx + pull 腳本補 culture 登記
- `a4ef900` feat(culture)：librarySeats 北市圖 6 分館即時座位（tpml_seat RPC，仿 er-hospital 架構，popup 24h TimeseriesSparkline，`is_closed` → 休館中）
- fix(culture)：3 層分類篩選 `rebuildOnParamChange` 參數名 → `["circle"]`（filter 重建路徑本來永遠不觸發；根因見 `.claude/pitfalls/2026-07-16-rebuildonparamchange-suffix-not-param.md`）
- 驗收：tsc 0 錯 / 190 tests 全綠 / agent-browser 逐層 5/5 PASS（含金門點抽驗、篩選器復驗 3/3）
- Breaking：無
