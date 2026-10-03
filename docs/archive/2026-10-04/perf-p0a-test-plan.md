# P0-A 測試 Checklist

> 改動分支：`perf/external-time-store`（6 commits）
> 執行人手動驗收，發現異常請 git bisect 鎖到哪一顆 commit

## A. TypeScript

```bash
npx tsc -b
# 預期：零錯誤、零警告
```

## B. 功能回歸（必跑）

### 1. Timeline 基本控制
- [ ] Replay 模式：點「播放」→ 時間軸前進 → 再點「暫停」→ 停住
- [ ] 速度切換（1x / 10x / 60x）→ 立即生效
- [ ] 進度條拖拉（seek）→ 時間跳到指定點
- [ ] 日期前後鍵切換（shiftDate）→ 時間重置到新日午夜
- [ ] 日期選擇器切換任意日 → 時間重置
- [ ] Range Days 切換（1/2/3/7）→ 視窗範圍對
- [ ] Live 模式：切到 Live → 時間跟真實時間同步，每秒跳一次
- [ ] Live ↔ Replay 切換 → 狀態乾淨轉換

### 2. 動態圖層（每個都單獨打開 + 四個同開）
每個圖層：**Replay 60x 播放 1 天** → 視覺正常，無卡頓

- [ ] **Flight** (航班)：光球沿軌跡飛，trail 跟著
- [ ] **Ship** (船舶)：光球移動
- [ ] **Rail** (軌道)：THSR + TRA 列車沿軌道
- [ ] **Bus Live** (市區公車)：Replay 軌跡正確、Live 30s poll
- [ ] **Bus Intercity** (公路客運)：同上
- [ ] **News Events**：`timeBased=true` 時累積顯示（<=currentTime 的新聞），ripple 動畫持續
- [ ] **Earthquakes**：pre/post/ripple 正確，拉日期 → 當日地震對
- [ ] **Disaster Alerts**：active 過濾正確，日期切換載入新資料
- [ ] **Temperature Wave**：兩相鄰 frame lerp 平滑，日期切換 OK
- [ ] **CWA Cloud Imagery**：雲圖跟著時間換 frame
- [ ] **CWA Radar Imagery**：雷達回波跟著時間換 frame
- [ ] **Freeway Congestion**：顏色隨時間變（10min 粒度）
- [ ] **YouBike Fullness**：每 60 秒模擬時間 H3 fill 更新

### 3. 四層同開壓力測試（目標場景）
- [ ] 同時打開：Flight + Ship + Bus Live + Rail
- [ ] Replay 60x → **比改動前流暢**（這是整個改動的目標）
- [ ] 再加 BusIntercity + Freeway + News → 仍可接受

### 4. Edge Cases
- [ ] 首次載入頁面 → 時間從「現在 -1 小時」開始
- [ ] Replay 播到視窗末端 → loop back 到 windowStart + playing=false
- [ ] 切日期到資料範圍外 → 不會炸

## C. 效能對比（客觀量化）

開 Chrome DevTools → Performance tab

### 情境
- 同時打開：Flight + Ship + Bus Live + Rail + BusIntercity + Freeway
- Replay 速度 60x，錄 10 秒

### 比較兩個分支
```bash
# 改動前基線
git checkout master
npm run dev  # 錄一份 performance.json
# 改動後
git checkout perf/external-time-store
npm run dev  # 錄一份 performance.json
```

### 關鍵指標
| 指標 | 工具 | 期望 |
|---|---|---|
| **平均 FPS** | DevTools FPS meter | 顯著提升（+20% 以上） |
| **React commits / 秒** | React DevTools Profiler | **60 → ~4**（15x 降幅） |
| **Scripting time / 幀** | Performance tab | 下降 30%+ |
| **JS heap growth** | Memory tab | 不惡化（<5% 差距） |
| **Long tasks (>50ms)** | Performance tab | 減少 |

## D. 回滾方案

若發現致命問題：
```bash
# 回到 master
git checkout master
# 或只退單顆 commit
git revert <commit-hash>
```

commit 順序（由新到舊）：
1. `99fcbf6` docs(rules) — 最晚，無風險
2. `bab55da` refactor(hooks) — 5 個 hook 改動
3. `0070635` refactor(app) — App.tsx 假相依
4. `9ebc75f` refactor(timeline) — useTimeline 核心
5. `b7b727a` feat(state) — timeStore 基建
6. `2ef938f` docs(perf) — 計畫文件

若問題在 hooks（2）或 app（3），可只 revert 那顆而保留 timeStore 基建。
若問題在 timeline 核心（4），必須一起 revert 3 與 2。

## E. 已知行為改變（非 bug）

1. **TimelineControls 時間數字節流 250ms**：肉眼幾乎無感，但理論上不再逐幀跳。若有強迫症需求，改 `useTimeline.ts` 的 `UI_TIME_THROTTLE_MS = 250` 為更小值。
2. **App.tsx re-render 頻率降到 4Hz**：整棵 React 元件樹 re-render 降到 4Hz。任何依賴「每幀 re-render」的邏輯（不應該有）會不準。動畫迴圈已改走 `timeStore.getTime()` 直讀，不受影響。

## F. 驗收通過標準

- [ ] B 全部通過
- [ ] C 的 FPS 或 React commits 至少一項明顯改善
- [ ] 無任何視覺回歸（顯示方式一致、流暢度不退）

都 OK → 合回 master + push。
