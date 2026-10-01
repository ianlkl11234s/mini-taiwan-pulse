# Mini Taiwan Pulse — Design System

> 所有 UI 與地圖圖層外觀的**唯一家目錄**。改任何面板、popup、控制項、圖例或地圖點線面之前先從這裡開始。

## 目前進度

> 最後更新：2026-09-30（master 至 #468）。**每一輪結束時更新這一節**；細節與理由寫在 [`CHANGELOG.md`](./CHANGELOG.md)。

### 各條工作線

| 工作線 | 狀態 | 已完成（PR） | 下一步 |
|---|---|---|---|
| UI 統一（面板、popup、工具列、控制項、時間軸、層級） | ✅ 完成 | 第一輪 A–M #357–#372；第二輪 N–R #379–#383 | 只剩 spec §10.3 的零星項目 |
| 載入提示＋Agent 光暈 | ✅ 完成 | #390 | — |
| 開站畫面（W2 城市脈動＋M2 機關展開） | ✅ 完成 | #395 | — |
| 左側面板底色與對齊、時間軸「尚無資料」浮標 | ✅ 完成 | #395、#397 | — |
| 開關兩階（S2） | ✅ 完成 | #404 | — |
| Design system 文件 v2（本資料夾、活的元件頁、快照） | ✅ 完成 | #402 | 新元件記得在活頁加一段、跑 `npm run design:snapshot` |
| 地圖 R1 基礎（共用數值、統計圖層、圖例 kit、地圖中文字） | ✅ 完成 | #391 | — |
| 地圖 R2 點圖層（registry 191 層＋hook 122 層） | ✅ 完成 | #392、#393、#396、#398、#401 | 新圖層照 `pointTiers.ts` 登記分階（#407 土壤液化已照做） |
| 地圖 R3a 線與面（registry） | ✅ 完成 | #461 | registry 106 層線面接上分階（`lineFillTiers.ts`＋`lineFillSpec.ts`）；新圖層的線面照 `lineFillTiers.ts` 登記 |
| 地圖 R3b 線面（hook）＋網格／影像／文字／擠出 | ✅ 完成 | #475 | 使用者已確認提案與 D 區修正；[逐層報告](../features/map-layer-restyle/R3b-report.md)／[前後對照](../features/map-layer-restyle/r3b-compare.html) |
| 地圖 R4 圖例對齊 | ✅ 完成 | #465、加油站品牌色 #468 | 28 個不一致圖例已對齊（盤點剩 3 個屬性色、程式同源）；K-1 13 層識別色改地圖現色；手寫色票 90 → 6。新圖例色票一律引用 paint 同一常數（`src/map/layerPaintColors.ts`） |
| 地圖 R5 熱區＋密度透明度 | ⏳ 未開始 | — | 超過 10 萬點改熱區（日本宗教設施低縮放糊塊）、P-3 密度透明度、聚合泡泡描邊、泡泡 M3 |
| 地圖 R6 Three.js／Mapbox 切換 | ⏳ 未開始 | — | **先要使用者決定**範圍與開關位置 |
| 開站加速 | ✅ 完成 | 地形延後載入 #395；Three.js 圖層打開才建 #464、#476；隱藏圖層不算樣式（本 PR） | 量測後改做法：開站本來就不抓隱藏圖層的資料（GeoJSON 空起手、PMTiles 0 請求），成本在換主題／拖滑桿時替約 300 組隱藏圖層算樣式；改成跳過、打開時補套（`docs/perf-audit-2026-09-30.md` §6） |

### 等使用者決定

- **R6**：哪些 Three.js 圖層要能切回 Mapbox 畫法（飛機、船、公車、台鐵是否納入），切換開關放在哪（建議每層一個）。
- **泡泡即時層光暈**（新聞事件、A1 即時事故）：要不要限制半徑（目前只限透明度，見 map-layers §3.1）。

### 已知未修

- **切主題重抓資料**：少數 hook（淹水感測、地下水、水利 IoT、河川水位、雨量、漁船軌跡、抽水站、清潔隊）切主題時會重新抓資料（master 既有）→ 交 Codex（同上交接 P1；R3b 已順手修 3D 建物、不動產行政區、淹水等時圈、日本醫療圈）。
- 其他零星項目：[`spec.md` §10.3](./spec.md)。

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
