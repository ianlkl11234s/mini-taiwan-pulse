# Performance Refactor — External Time Store (P0-A)

> 分支：`perf/external-time-store` · 開始：2026-04-14 · 目標：消除多圖層同開時的 React re-render cascade

## 背景問題

**現象**：單獨開任一圖層（flight / ship / bus / rail）都順暢；四個同開明顯卡頓。

**根因**：
- `currentTime` 放在 `useTimeline` 的 `useState` 裡
- Replay 模式下每幀呼叫 `setCurrentTime(prev + dt * speed)`（~60Hz）
- 每次 `setCurrentTime` → 整顆 `App.tsx` re-render
  - 所有 `xxxRef.current = ...` 賦值（App.tsx:285-299，~20 行）
  - 所有 `useEffect` 重新檢查相依
  - 所有子元件 re-render 比對
- 圖層數 N 愈多 → 每次 re-render 的「協調成本」愈高

**為什麼單開不卡、合起來卡**：成本是 `O(N × 60Hz)`，React 調度 + GC + ref 賦值的常數項疊加。

## 盤點（2026-04-14）

### 動態圖層（12 個）
flight / ship / rail / busLive / busIntercity / news / earthquakes / temperatureWave / cwaImagery / freeway / youbikeFullness / lighthouseBlink

### 獨立 RAF loop（7 個）
timeline / useRailEngine / useBusLayer / useBusIntercityLayer / useNewsTimeline / useEarthquakeLayer / temperatureWaveCustomLayer

### `currentTime` 的使用方式三類

| 類別 | 位置 | 行為 | 處理方式 |
|---|---|---|---|
| **A. 假相依**（只需日期粒度） | App.tsx:244, 313, 322, 539 | 放在 useEffect deps 每幀觸發，但邏輯只用 dateKey | 改訂閱 `subscribeDate` |
| **B. 真相依節流即可** | useNewsTimeline, useEarthquakeLayer, useFreewayLayer, useCwaImageryLayer | 需要 currentTime 做 filter 或 frame pick | 改訂閱 `subscribeThrottled(ms)` |
| **C. 純 ref 讀**（已 OK） | customLayer.ts 各層, useRailEngine, useBusLayer 的 RAF | 已用 `timeRef.current` | 改讀 `timeStore.getTime()` |
| **D. UI 顯示** | TimelineControls | 顯示 HH:MM:SS | `useSyncExternalStore` 節流訂閱（4Hz） |

## 設計原則（永久規則）

> 此規則同步寫入 `docs/development-rules.md` 與專案 `CLAUDE.md`

**所有動態 / 時序圖層必須遵守**：

1. **`currentTime` 禁入 React deps**：不得放進 `useEffect` / `useMemo` / `useCallback` 的依賴陣列。
2. **動畫迴圈直接讀 store**：RAF / per-frame 內用 `timeStore.getTime()`。
3. **粗粒度變化用日期訂閱**：資料載入邏輯若只關心「日期切換」，用 `subscribeDate()`，不要用 `currentTime`。
4. **中粒度變化用節流訂閱**：filter / lookup 邏輯用 `subscribeThrottled(ms)`，ms 由視覺需求決定（見下表）。
5. **UI 顯示節流**：顯示時間數字等 UI 訂閱 `useSyncExternalStore` + 節流。

### 各圖層節流建議

| 圖層/用途 | 建議節流 | 理由 |
|---|---|---|
| TimelineControls 數字 | 250ms (4Hz) | 肉眼感受不出差 |
| News ripple filter | 200ms | ripple 動畫自帶 RAF |
| Earthquake ripple | 500ms | ripple 擴散夠緩 |
| Freeway 顏色 | 60_000ms | 資料本身 10min 快照 |
| CWA Imagery frame | 1000ms | frame 粒度約 10min |
| YouBike H3 fill | 60_000ms | 資料粒度 1 分鐘 |
| 資料載入（dateKey） | 日期變化才觸發 | 非節流而是粒度過濾 |

## timeStore API

```ts
// src/state/timeStore.ts

interface TimeStore {
  // 讀
  getTime(): number;              // 當前 unix 秒
  getDateKey(): string;           // YYYY-MM-DD (Asia/Taipei)

  // 寫（只有 useTimeline 內部該呼叫）
  setTime(t: number): void;

  // 訂閱
  subscribe(cb: (t: number) => void): () => void;              // 每次變動
  subscribeThrottled(ms: number, cb: (t: number) => void): () => void;
  subscribeDate(cb: (dateKey: string) => void): () => void;    // 只在日期變化
}
```

## 實作步驟（8 commits）

1. **docs**: 本計畫文件（此 commit）
2. **feat**: 新增 `src/state/timeStore.ts`
3. **refactor**: `useTimeline` 內部改寫 store，public API 不變
4. **refactor**: App.tsx 假相依改 `subscribeDate`
5. **refactor**: news / earthquake / freeway / cwa hooks 改 `subscribeThrottled`
6. **refactor**: TimelineControls 用 `useSyncExternalStore` 節流訂閱
7. **docs**: 更新 `CLAUDE.md` + `development-rules.md` + `/new-layer` skill 骨架
8. **test**: tsc 驗證 + 手動回歸

## 測試計畫

### A. TypeScript
```bash
npx tsc -b
```

### B. 功能回歸（對每個動態圖層）
| 項目 | 驗收 |
|---|---|
| Timeline Replay | 播放 / 暫停 / 速度切換 / 日期切換 / range days |
| Timeline Live | Live 模式時間跟現實時間同步 |
| Flight | trail lerp 平滑；日期切換正確重載 |
| Ship | 同上 |
| Rail | 列車沿軌跡移動；THSR/TRA 都正常 |
| Bus Live / Replay | Live 30s poll；Replay 軌跡日期正確 |
| News | ripple 動畫持續；time filter（<= currentTime）正確 |
| Earthquake | ripple 擴散；pre/post/fresh window 切換 |
| Temperature Wave | 兩 frame lerp 平滑 |
| CWA Imagery | 雲圖跟著時間換 frame |
| Freeway | 顏色隨時間變化 |
| YouBike | H3 fill 每分鐘更新 |

### C. 效能對比（6 層同開 + Replay 60x）
| 指標 | 工具 | 期望 |
|---|---|---|
| FPS | DevTools FPS meter | 顯著提升 |
| React commits/sec | React DevTools Profiler | 60 → ~4 |
| Scripting time / frame | Performance tab | -30%+ |
| JS heap | Performance memory | 不惡化 |

## 風險與回滾

- `useSyncExternalStore` tearing → 保留介面，可退回 useState
- 節流頻率抓錯 → 各圖層獨立設定，保守起點 250ms
- 回歸 → git commit 顆粒度細，每 Step 一顆，方便 bisect
