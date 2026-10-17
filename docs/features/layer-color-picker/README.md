# 圖層配色可選（layer-color-picker，R7）

> **狀態**：shipped（CHANGELOG v2.3.0 記「熱度圖與網格圖層可自選配色（R7，#510）」）

## 一句話說明

熱區（heatmap）與網格圖層可在設定面板自選科學色階，避免多層同開時共用 magma 分不出來。範圍已縮小為熱區／網格的序列色階，點、面、類別層不做。

## 決策與範圍

2026-10-03 使用者在 [picks.html](./picks.html) 定案六題（入口、長清單、科學＋識別色衍生兩區、預設維持新版 magma、面板整體統一、多層熱區降透明度）；最終收錄 17 組色階。面板統一另立 [layer-panel-unify](../layer-panel-unify/README.md)。

## 主要程式與規格

- 色盤定義：`src/map/palettes.ts`；色盤控制項：`src/components/sidebar/PaletteControl.tsx`
- 設計規格：`docs/design-system/map-layers.md`（G-2／G-3／LG-8）、`docs/design-system/spec.md` §5.36

## 驗收

色階以 dataviz `validate_palette.js` 驗證（暗／淡底圖各一）；結果見 palette-validation、ramp-validation。

## 資料夾內文件

- [PROPOSAL.md](./PROPOSAL.md)：提案與 §0 使用者六題決定
- [design-audit.md](./design-audit.md)：設計系統稽核與台／日面板差異盤點
- [palette-validation.md](./palette-validation.md)：R7 樣稿色盤驗證結果
- [ramp-validation.md](./ramp-validation.md)：56 組科學色階候選的驗證與建議清單
- [mockup.html](./mockup.html)、[ramp-gallery.html](./ramp-gallery.html)、[picks.html](./picks.html)、[phase-d-compare.html](./phase-d-compare.html)：樣稿、色階總覽、選擇頁、前後對照頁
