# Changelog — 社福長照 Welfare

## 2026-08-13 · 接線（第 40 主題上線，9 層）

分支 `feat/welfare-layers`（自 `master` 開，走 worktree `.claude/worktrees/w-welfare/`
以免動到主樹的 `feat/vessel-watch`）。

**資料**：上游 `output/welfare/pulse/*.geojson` ×9 copy 進 `public/welfare/`，
10,004 點 / 5.4 MB 全部進 git。

**新檔 3 個**
- `src/data/welfareTypes.ts` —— 分色／篩選／精度／數值表達式 SSOT（三個 🔴 陷阱寫檔頭）
- `src/components/featureInfo/welfarePanels.tsx` —— 9 個 popup panel
- `docs/features/welfare-layers/` —— README / handoff / backlog / changelog

**改檔 12 個**：`types/index.ts`（2 處 union ＋ `LayerVisibility` 9 key）、
`layerManifest.ts`、`layerParamsSpec.ts`、`overlayRegistry.ts`、`layerCatalog.ts`、
`LegendPanel.tsx`、`featureInfo/registry.tsx`、`gisClickRegistry.ts`、
`nginx.conf`、`scripts/deploy/{upload,pull}-deploy-assets.sh`、
3 個測試檔 ＋ 黃金快照 fixture。

**設計決定**
- 9 層全走 OVERLAY_REGISTRY 通用路徑 —— 無 loader / hook / CustomLayer
- 主題群「社福長照 Welfare」3 子群（住宿照顧 / 長照與托育 / 公部門與民間），
  上游建議的三層排群內最前
- 護理之家泡泡用**總床數**（一般＋產後＋嬰兒室），不是只用 `beds_nh`
- 身障使用率用**三種安置型態加總**，除零先 `case` 擋掉
- 概略座標（98 筆）z≥15 淡化＋加粗描邊，不刪點
- `permit_status` 完全不用（連 popup 都不顯示）

**與上游建議的差異**
- `DEFAULT_ON` **未改**（維持全站預設全關）—— 見 backlog WF-1
- 托嬰人均密度（上游建議的第三個視覺化）**未做** —— 是衍生分析層不是點層，見 WF-3

**驗收**
- `npx tsc -b` ✅ / `npx vitest run` ✅ 42 檔 573 tests
- 黃金快照重生：348 → 357 key，diff 只有新 key ＋ `keyCount` 一行（既有層零 diff）
- 瀏覽器實測 6 項全過（渲染點數／泡泡／使用率分色／概略降階／4 個 popup／圖例），
  console 無 Mapbox 表達式錯誤 —— 逐項見 `handoff.md` 末節
