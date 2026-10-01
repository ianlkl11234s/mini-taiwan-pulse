# 2026-09-30 沒開任何圖層，地圖仍一直重畫（隱藏圖層 paint transition 卡住）

**日期**：2026-09-30
**嚴重度**：medium
**受影響範圍**：全站（正式站與本機），閒置時 GPU／CPU 持續運作
**發現方式**：效能盤點時瀏覽器實測（全關＋暫停，5 秒仍 render 20–29 次）
**耗時**：定位約 1 小時；修復含驗收約半天

---

## 現象（Symptom）

所有圖層關閉、時間軸暫停，`map.on('render')` 仍持續觸發。`__map.style.hasTransitions()` 恆為 `true`。stack 顯示重畫來自 Mapbox 自己的 `Map._render`，不是任何 CustomLayer 的 `triggerRepaint`。

殘留 transition 的圖層都是 `visibility: none`：`water-reservoir-poly-glow`、`water-reservoir-dams-glow-1/2`、`agri-ftw-fields-fill`；後來又找到 `earthquake-ripple-*`、`earthquakes-global-ripple-*`、`news-events-ripple-*`。

## 復現步驟

1. 開站（或開地震圖層後關閉），暫停時間軸。
2. 在隱藏中的圖層上呼叫任何 `map.setPaintProperty(...)`，或在 paint 剛改完的 300ms 內把圖層隱藏。
3. 數 5 秒 render 次數，結果大於 0，而且 `hasTransitions()` 為 true。
4. 把該圖層暫時設 visible 再設回 none，render 立刻歸 0。

## 根因（Root Cause）

- Mapbox 對圖層做任何 `setPaintProperty`，會替該圖層「所有」paint 屬性建立 transition，不只被改的那一個。
- 隱藏圖層不會被 recalculate，所以 transition 的 `prior` 永遠不會清掉。
- `style.hasTransitions()` 一直是 true，Map 就每幀排程重畫，永遠不會 idle。
- 因此「只把被改的那個屬性 transition 設 0」擋不住。

觸發來源：
- `useReservoirContextLayer` 一掛載就把寫死的暗色值寫到隱藏圖層上。
- `agricultureLayerFactory` 在隱藏時仍改 paint。
- 漣漪動畫每幀寫 paint，圖層關閉的那一刻就卡住。

## 修法

- PR：#464（`b4a005ee`、`f44bfe23`、`b9c83406`、`feb188e4`）、#476（`fc1afa0e`）
- `src/map/overlayManager.ts` 新增 `setPaintPropertyGuarded`：隱藏時暫存 paint，重新顯示才寫入；`applyPaintDiff` 改走這裡。
- 水庫 dim 只還原自己改過的值；農地隱藏時不改 paint。
- RAF 驅動的漣漪／脈動圖層：所有 paint 屬性 transition 設為 0。
- `src/map/MapView.tsx`：每次 `style.load` 將 style 根層 transition 設為 `{duration:0, delay:0}`，作為全域防線。
- 不需要 migration 或 infra 改動。

## 教訓（Learning）

- 通用規則已寫進 `PRINCIPLES.md` §3D 效能：
  - 不對隱藏圖層寫 paint。
  - 每幀改 paint 的圖層要把 transition 設 0。
- 驗收要有工具佐證：全關＋暫停時，5 秒 render 次數必須是 0，`hasTransitions()` 必須是 false。
- 本專案的「平滑過渡」一律是資料插值，不靠 GL transition，所以全域 transition 0 不影響設計意圖。

## 相關

- 整體紀錄：`docs/perf-audit-2026-09-30.md`
- Related pitfall：`2026-04-22-mapbox-load-once-fired.md`（同屬 Mapbox 生命週期時序問題）
