# Mini Taiwan Pulse — Design System

> 所有 UI 與地圖圖層外觀的**唯一家目錄**。改任何面板、popup、控制項、圖例或地圖點線面之前先從這裡開始。

## 這個資料夾有什麼

| 檔案 | 是什麼 | 什麼時候看 |
|---|---|---|
| **活的元件頁** `design-system.html`（`src/design-system/`） | 直接 import 真正的 React 元件與 token 畫出來，暗／淡並排，旁邊印出精確數值與規格章節。**數值永遠跟程式同步** | 要看「現在長怎樣、數值多少」時；本機 `npm run dev` 後開 `http://127.0.0.1:3721/design-system.html` |
| [`reference.html`](./reference.html) | 活的元件頁的**靜態快照**（單一 HTML，不需要 dev server，可發布分享） | 要分享給別人、或沒有開 dev server 時；會落後程式，以活頁為準 |
| [`spec.md`](./spec.md) | UI 元件規格（token、字型、元件、文案、禁止事項、PR checklist、guard、遷移狀態） | 新增或修改 UI 前必讀；PR 前照 §8 checklist |
| [`map-layers.md`](./map-layers.md) | 地圖圖層視覺規格（點線面、光暈、熱區、標籤、圖例） | 改地圖圖層的畫法或圖例時 |
| [`CHANGELOG.md`](./CHANGELOG.md) | 每一輪拍板了什麼、哪個 PR 做的 | 想知道「為什麼長這樣」時 |
| [`layer-style-inventory.json`](./layer-style-inventory.json) | 全部圖層的實際樣式盤點（`npm run design:audit-layers` 產生） | 驗收地圖改版範圍時比對 |
| [`map-layer-picks.html`](./map-layer-picks.html) | 地圖圖層 40 個代號的拍板比較頁（2026-09-28） | 回顧地圖規格決策 |

## 程式裡的唯一來源（改數值只改這裡）

| 範圍 | 檔案 |
|---|---|
| UI token（TS） | `src/styles/designTokens.ts` |
| UI token（CSS 變數，與 TS 同值） | `src/styles/tokens.css` |
| 地圖點線面數值 | `src/map/mapStyleScale.ts` |
| 點圖層分階（S／M／L／B） | `src/map/pointTiers.ts`（registry `POINT_TIERS`、hook `HOOK_POINT_TIERS`） |
| 點圖層統一套用（描邊、光暈上限） | `src/map/pointSpec.ts` |
| 圖例元件 | `src/components/legend/legendKit.tsx` |
| 開站畫面數值 | `src/components/boot/bootSequence.ts` |

## 怎麼維護

1. **改數值**：改上表的程式檔 → 活的元件頁自動反映 → 在 `spec.md`／`map-layers.md` 對應章節更新文字 → `CHANGELOG.md` 記一筆。
2. **新元件**：先在 `spec.md` §5 寫規格 → 實作 → 在 `src/design-system/` 加一段展示（暗／淡並排、標出規格章節與實作檔）。
3. **更新靜態快照**：開 dev server 後跑 `npm run design:snapshot`，會把活頁存成 `reference.html`。
4. **自動檢查**：`src/styles/__tests__/designSystemGuard.test.ts`（ratchet，只准違規變少）；紅燈要修程式，不可用改基準繞過。只有違規確實減少時才跑 `npm run design:baseline`。
5. **出設計稿**：新的視覺決策照慣例做「暗／淡並排、用代號選」的比較頁，放在 `docs/features/<slug>/`，拍板後把結果寫回這裡。

## 設計稿與決策來源

- UI 統一（2026-09-27～28）：`docs/features/ui-consistency-audit-20260927/`（`handoff.md` §4a 拍板表、各 `*-sheet.html`）
- 開站畫面（2026-09-29）：同目錄 `boot-screen-sheet.html` → `boot-motion-sheet.html` → `boot-wait-sheet.html` → `boot-w2-tuner.html`
- 地圖圖層改版：`docs/features/map-layer-restyle/`（`PLAN.md`、`handoff-r2-hooks*.md`）
- 統計圖層：`docs/statistics-layer-guidelines.md`
