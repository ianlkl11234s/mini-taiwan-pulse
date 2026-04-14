# 效能優化總結 — 2026-04-14

> 三階段優化（P0-A / P0-C / P0-B），共 **13 顆 commits**，全部合入 `master`。

## 🎯 起因

**症狀**：同時打開公車、軌道、飛機、船舶四個圖層時，應用明顯卡頓；個別開啟都順暢。
**規模**：~1.3 萬個動畫物件同步渲染（4864 flights + 3598 ships + 312 trains + 4429 buses）。

## 📊 成果（量化對比）

| 指標 | 優化前 | 優化後 | 改善 |
|---|---|---|---|
| React commits/秒 | 60 | 4 | **15×** |
| LayersPanel 單次 render | 11-18ms | 4-8ms | **-55%** |
| 最貴 commit 總時長 | 49.8ms | 27ms | **-45%** |
| 典型 commit 總時長 | 35-45ms | 17-18ms | **-50%** |
| 50ms+ long task | 常見 | **消失** | ✓ |
| 動態圖層 RAF 數量 | 4 個 | 1 個（統一） | 架構簡化 |

---

## 🏗️ 三階段內容

### P0-A — External Time Store（2026-04-14 上午）

**問題根源**：`currentTime` 存在 React `useState` 裡，Replay 每幀 `setCurrentTime` → 整棵 App re-render → 12 個動態圖層 hook 跟 20+ 個 `xxxRef.current = ...` 全部重跑。

**解決方案**：把 `currentTime` 抽離成 external store（`src/state/timeStore.ts`），動畫脫離 React re-render 週期。

**提供 API**：
```ts
timeStore.getTime()              // 同步讀（RAF 用）
timeStore.getDateKey()           // YYYY-MM-DD (Asia/Taipei)
timeStore.subscribe(cb)          // 每次變動（60Hz）
timeStore.subscribeThrottled(ms, cb)  // 節流
timeStore.subscribeDate(cb)      // 只在日期變化
```

**4 類 currentTime 使用方式分別處理**：

| 類別 | 位置 | 處理方式 |
|---|---|---|
| 假相依（只需日期） | App.tsx 活躍日追蹤、公車 replay 跨日、YouBike 分鐘 key | `subscribeDate` / 分鐘 boundary 監聽 |
| 真相依節流即可 | useNewsTimeline / useEarthquakeLayer / useFreewayLayer / useCwaImageryLayer / useDisasterAlertLayer | `subscribeThrottled(ms)` |
| 純 ref 讀 | customLayer render / RAF | `getTime()` 同步讀 |
| UI 顯示 | TimelineControls | `useSyncExternalStore` + 250ms 節流 |

**節流配置**：
- UI 時間數字：250ms
- News filter：200ms
- Earthquake / Disaster Alert：500ms
- Freeway / CWA Imagery：1000ms
- YouBike：minute boundary

**Commits**：`2ef938f`（計畫）→ `b7b727a`（timeStore）→ `9ebc75f`（useTimeline）→ `0070635`（App.tsx 假相依）→ `bab55da`（5 hooks 真相依）→ `99fcbf6`（規則文件）→ `9d279a0`（測試 checklist）

---

### P0-C — LayerRow Memoization（下午）

**問題根源**：P0-A 解掉 React 4Hz re-render，但 `LayersPanel` 自己仍花 11-18ms（30+ layer rows 每次重建）。

**解決方案**：
1. `useLayerVisibility.toggleVisibility` 包 `useCallback`
2. App.tsx 傳給 IconRailSidebar 的 5 個 inline callback 包 `useCallback`；`counts` object 包 `useMemo`
3. **抽出 `LayerRow` 子元件 + `React.memo`**（核心改動）

**關鍵架構**：`LayerRow` 每個只在自己的 props 真變動時才 re-render。多數 row 的 `active` / `count` / `isExpanded` 不變 → 跳過；只有 count 變動的 row（rail / bus / ship / flight）重繪。`ExpandedControls` **刻意不 memo**（slider 值需即時反映）。

**Commits**：`3ba258b`（toggleVisibility useCallback）→ `e4c263a`（App.tsx props 穩定化）→ `39ca861`（LayerRow memo）

---

### P0-B — 統一動畫節拍器（晚上）

**問題根源**：動態圖層各自開獨立 RAF：useTimeline Replay + Live + useRailEngine + useBusLayer + useBusIntercityLayer = **4+ 個 RAF**。暫停時 engine 仍持續 60Hz 計算相同位置，浪費 CPU。

**解決方案**：`useTimeline` 為唯一時間源，其他 engine 改訂閱 `timeStore.subscribe`。

**變動**：
- useTimeline Live 從 `setInterval(1000)` 改 RAF 60Hz（讓 Live/Replay 時間源一致）
- useRailEngine 移除獨立 RAF，改 `timeStore.subscribe`
- useBusLayer / useBusIntercityLayer 同上
- 三個 hook 參數表移除 `timeRef`

**好處**：
- 暫停 Replay 時所有 engine 自動停止計算（省 CPU）
- 時序一致（不再有 engine 慢半幀）
- 未來新增動態圖層：只要 `timeStore.subscribe()` 就行

**Commits**：`9a5b7fc`（Live RAF）→ `46c9614`（Rail 訂閱）→ `0a050cf`（Bus 訂閱）

---

## 📐 永久規則（已寫入專案）

> 所有未來新增的動態 / 時序圖層必須遵守

1. **Hook 參數表禁收 `currentTime`**
2. **`currentTime` 禁入 React `useEffect` / `useMemo` deps**
3. **動畫迴圈讀 `timeStore.getTime()`**，不自開 RAF
4. **粗粒度資料載入用 `subscribeDate`**
5. **中粒度 filter / lookup 用 `subscribeThrottled(ms)`**
6. **UI 顯示用 `useSyncExternalStore`**

### 規則所在位置
- [`docs/development-rules.md §8`](./development-rules.md#8-動態圖層時間訂閱external-time-store) — 完整版（API + 決策表 + 節流建議 + 正反例 + 檢查清單）
- [`CLAUDE.md`](../CLAUDE.md) 「新增 Layer 強制順序」第 6 點
- [`.claude/agents/layer-creator.md`](../.claude/agents/layer-creator.md) — agent 產骨架時自動套用

---

## 📁 改動檔案一覽

### 新增
- `src/state/timeStore.ts` — external time store（核心基建）
- `docs/perf-external-time-store.md` — P0-A 計畫文件
- `docs/perf-p0a-test-plan.md` — P0-A 測試 checklist
- `docs/perf-optimization-2026-04-14.md` — 本文件

### 改動（前端）
- `src/App.tsx` — 假相依改訂閱 + 穩定化 props
- `src/hooks/useTimeline.ts` — 核心：改寫 store / Live RAF
- `src/hooks/useLayerVisibility.ts` — toggleVisibility useCallback
- `src/hooks/useRailEngine.ts` — 改訂閱 timeStore
- `src/hooks/useBusLayer.ts` — 改訂閱 timeStore
- `src/hooks/useBusIntercityLayer.ts` — 改訂閱 timeStore
- `src/hooks/useNewsTimeline.ts` — 改訂閱 timeStore（節流 200ms）
- `src/hooks/useEarthquakeLayer.ts` — 改訂閱 timeStore（節流 500ms）
- `src/hooks/useDisasterAlertLayer.ts` — 改訂閱 timeStore（節流 500ms）
- `src/hooks/useFreewayLayer.ts` — 改訂閱 timeStore（節流 1000ms）
- `src/hooks/useCwaImageryLayer.ts` — 改訂閱 timeStore（節流 1000ms）
- `src/components/IconRailSidebar.tsx` — 抽出 LayerRow memo 元件

### 改動（規則 / 文件）
- `CLAUDE.md`
- `docs/development-rules.md` — 新增 §8
- `.claude/agents/layer-creator.md`

---

## 🔬 還沒做但已評估

| 項目 | 預期效益 | 風險 | 備註 |
|---|---|---|---|
| **P1**：物件池 + update 降頻 30Hz | 中（減 GC） | 中 | 之後有需要再做 |
| **P2**：位置計算搬 GPU shader | 大（長期） | 高 | 除非撞 CPU 牆，否則不做 |
| **P3**：共用 Three.js Renderer | 小 | 中 | 性價比差，不建議 |
| Memo TimelineControls | 小（~2ms） | 低 | 之後可選做 |

---

## 🐛 已知待修

- **高雄公車 16:16 集體暗→亮**（發現於 2026-04-14 P0-B 驗收）
  - 初判：既有資料 / fade 架構行為，非 P0-B 造成
  - 方向：Trip 轉換的 `FADE_SECONDS = 60` 設定、排班交接辨識
  - 另起分支處理，不與本次效能優化混

---

## 📝 驗收 Profile 截圖

### P0-A 前（estimated）
- LayersPanel: 0ms（沒出現，因為 re-render 60Hz 被 React 節流）
- 整棵樹 re-render 成本：~50ms/幀

### P0-A 後
- LayersPanel: 11-18ms（開始變成 bottleneck）
- 最貴 commit: 49.8ms

### P0-C 後
- LayersPanel: 4.7-8ms
- 最貴 commit: 27ms
- 多數 commit: 17-18ms

### P0-B 後
- 功能性改動，效能指標與 P0-C 相近；主要效益在**暫停時 CPU 降為 0**和架構統一

---

## 💡 背後的思考

這次優化的**核心哲學**：「**動畫不應該走 React 的 re-render 路徑**」。

React 的心智模型是「state 變動 → 元件樹 diff → DOM update」。這套流程適合**低頻互動**（點擊、輸入）。但動畫是 **60Hz 連續變化**，走 React 等於每幀把整棵樹用 React 的規則重算一遍，成本爆炸。

正確的分工：
- **React 管「UI 結構 / 互動 state」**（哪些 layer 開、哪些展開、參數值）
- **External store 管「高頻連續變化的動畫狀態」**（time、動畫 tick）
- **動畫邏輯直接讀 store + 更新 WebGL / Three.js**（不經 React）

這次把這條界線畫清楚了。未來加圖層只要遵守規則，架構能撐到更多動態物件。
