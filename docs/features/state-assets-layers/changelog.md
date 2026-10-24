# Changelog — 國營事業與國有資產

## 2026-10-24 · 接線（G16）

- `stateAssets` 統計家族 23 層（stateAssetsStatisticsRecipes.json／catalog／ts），放 Statistics「住宅與不動產」三個小群組；data_theme「國有資產統計」歸「移動與城市」大分類；visuals 沿用住宅色票。
- builder 加 disclosure 公開化（內部欄名換中文＋殘留斷言）；行政執行署兩層手動門檻。
- 4 個點層（build-atlas-public.py → public/state_assets/）：台水廠所、台水淨水設施、台糖糖廠據點、國有財產待標售標的；popup、圖例、多選篩選、i18n 英日文。
- 測試：治安契約「其他家族預設＝最新期別」排除行政執行署並另測預設 2025 全年；計數、golden、inventory、statisticsText 第二批檢查。

## 2026-10-24 · 開 PR

- PR #690（base develop，G23／G16／G10 三群合一）；merge 後補 merge hash。
