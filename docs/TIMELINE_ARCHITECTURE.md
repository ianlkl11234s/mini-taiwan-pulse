# Timeline Architecture — 時間軸與 timeStore 現況

> 用途：說明主站時間軸（Replay／Live、日期視窗、timeStore）**現在怎麼運作**，給要寫或改動態圖層的人與 agent 讀。
> **正本規則**見 [`development-rules.md` §8 動態圖層時間訂閱](./development-rules.md#8-動態圖層時間訂閱external-time-store)；本檔只講架構與實作狀態，規則衝突時以 §8 為準。
> 更新：2026-10-16（依 `src/` 實查改寫；2026-03 原始設計稿保留在文末附錄）。

## 實作狀態

對照 2026-03-07 設計稿（附錄）的 Step 1–5 與各機制，依 `src/` 實查：

| 設計稿項目 | 狀態 | 佐證 |
|---|---|---|
| Step 1 `TimeType`／`DataSourceMeta` 型別 | 已實作 | `src/types/index.ts`（`TimeType`、`TimeRange`、`DataSourceMeta`，多了 `id` 欄位） |
| Step 1 Data Source Registry（`useDataRegistry`） | 部分 | `src/hooks/useDataRegistry.ts`；`src/App.tsx` 只註冊 `flights`／`ships`／`rail`／`temperatureWave` 四個來源，用 `getTimelineRange()` 算 replay 範圍聯集（無資料時退回航班範圍）。設計稿的 `DATA_SOURCE_META` 常數表沒有做，其餘圖層不註冊 |
| Step 2 Sidebar 每層顯示時間範圍小字 | 未做 | `useDataRegistry` 有 `getTimeLabel()`，但 `src/components/IconRailSidebar.tsx` 只宣告 `dataRegistry?` prop、沒有使用 |
| Step 3 模式切換 Replay／Live | 已實作 | `TimeMode = "replay" \| "live"`（`src/types/index.ts`）；`src/hooks/useTimeline.ts`（Live 1Hz 同步 `Date.now()`、Replay 由 RAF 直接寫 timeStore）；`src/components/TimelineControls.tsx`（`LiveTimelineControls`、回到 Live 按鈕） |
| Step 3 All Data／Today／Custom 快捷範圍 | 放棄（改成日期視窗） | 現行是「選定日期＋範圍天數 1–7」：`timeStore.setRangeDays()`／`setWindowDateKeys()`，`TimelineControls` 下拉選天數 |
| Step 4 多源資料密度條、非線性壓縮 | 未做 | `getSegments()`、`hasDataOnDate()` 只定義在 `useDataRegistry.ts`，`src/` 無其他呼叫端 |
| Step 5 逐層時間控制（Jump to Start／Use Layer Range／Follow Global） | 未做 | `src/` 無對應字串或元件 |
| 設計稿外：timeStore 外部時間來源 | 已實作（2026-04） | `src/state/timeStore.ts`，見下節 |
| 設計稿外：即時／歷史大模式 | 已實作 | `AppMode = "realtime" \| "historical"`（`src/types/index.ts`、`src/App.tsx`）；切換時用 `historicalPeriodSnapshot()`／`restoreTimelineSnapshot()`（`src/hooks/useTimeline.ts`）保存與還原時間軸 |
| 設計稿外：scoped 回放時鐘 | 已實作 | `src/state/earthquakeReplayClock.ts`（地震回放）、`src/embed/replayClock.ts`（`/embed` 回放） |

設計稿的「不做什麼」（附錄最後一節）至今仍成立：只有一條主時間軸、沒有日曆選擇器、沒有逐層播放速度。

## timeStore（外部時間來源）

動態圖層的時間來源是 `src/state/timeStore.ts` 的 `timeStore`，不是 React state。

**為什麼不放 React state**：2026-04 以前 `currentTime` 放在 `useTimeline` 的 `useState`，Replay 每幀 `setCurrentTime` 讓整顆 `App.tsx` 約 60Hz re-render；單開一層順、四層同開就卡（成本約 O(圖層數 × 60Hz)）。改成 external store 後，時間變動只通知訂閱者，不觸發整棵元件樹重算。背景與盤點見 [`archive/2026-10-04/perf-external-time-store.md`](./archive/2026-10-04/perf-external-time-store.md)。

### API

| 方法 | 用途 |
|---|---|
| `getTime()` | 目前時間（unix 秒），純讀；RAF 迴圈裡用它 |
| `getDateKey()` | 目前日期 `YYYY-MM-DD`（Asia/Taipei） |
| `setTime(t)` | 寫入時間；**只有 `useTimeline` 可以呼叫** |
| `subscribe(cb)` | 每次時間變動都通知（高頻，動畫用） |
| `subscribeThrottled(ms, cb)` | 節流通知（trailing edge 保證最後一次會送）；篩選、查表、UI 顯示用 |
| `subscribeDate(cb)` | 日期變化才通知；資料載入用 |
| `getRangeDays()`／`setRangeDays()`／`subscribeRangeDays()` | 時間軸範圍天數（1–7），time-aware loader 用來決定預載幾天 |
| `getWindowDateKeys()`／`setWindowDateKeys()`／`subscribeWindowDateKeys()` | 視窗內的日期清單；loader 只預載這份，視窗外不打 RPC |

同檔另有 `wallClock`（`getWallNow()`、`subscribeWallClock(ms, cb)`）：給「現在時間」「3 分鐘前」這類跟著真實時間跳的 UI，**不是**資料時間軸。不要在元件裡用 `useState`＋`setInterval` 做時鐘。

React UI 要顯示時間時用 `useUiTime()`（`src/hooks/useTimeline.ts`，內部是 `useSyncExternalStore`）。

### scoped 回放時鐘

事件級回放（時間單位不是 timeline 的 unix 秒、或只有一個面板在用）不掛全域 timeStore，改用獨立的 external clock：寫入即時、通知節流 10Hz，視覺是時鐘的純函數，scrub 只要 `set(t)`。範本是 `src/state/earthquakeReplayClock.ts`；`src/embed/replayClock.ts` 另外自帶 RAF 與 play／pause／loop。多層共用同一個 scoped 時鐘時，時間範圍取聯集、`setRange` 只呼叫一次（見 PRINCIPLES「事件級回放用 scoped 時鐘」）。

### 常見錯誤

- **把 `currentTime` 放進 `useEffect`／`useMemo` deps**：等於回到每幀 re-render。改法依用途：RAF 讀 `getTime()`、篩選用 `subscribeThrottled`、跨日載入用 `subscribeDate`（規則與節流表見 development-rules §8）。
- **在 render body 寫被訂閱的 store**（例如初始化時直接 `timeStore.setTime()`）：會觸發「Cannot update a component while rendering a different component」，而且只在 remount／StrictMode／HMR 時才穩定出現，容易漏測。一律搬進 `useEffect`（見 PRINCIPLES「render body 禁止寫入被訂閱的外部 store」）。
- **把資料時間軸和真實時間混用**：顯示「現在」用 `wallClock`，不要讀 `timeStore`（Replay 時 timeStore 是歷史時間）。

---

## 附錄：2026-03 原始設計稿（歷史）

> ⚠️ 歷史設計（2026-03-07），未標實作的部分以上方實作狀態表為準

### Timeline Architecture — 多源彈性時間軸設計（原標題）

### 設計原則

1. **漸進揭露** — 預設簡單，需要時才展開細節
2. **與 Layer 自然整合** — 不新增獨立面板，融入現有 Sidebar
3. **資料驅動** — 時間軸由資料自動決定，不需手動配置
4. **三種粒度** — 粗放（一鍵切換）→ 中等（範圍選擇）→ 精細（逐層控制）

---

### 核心概念：Layer 本身就是時間軸的單位

不需要另外開一個「時間軸面板」。每個 Layer 在 Sidebar 中已經有
toggle、參數控制。**時間資訊直接長在 Layer 上**。

```
現有 Layer 項目：
  ● Flights ────── [14 active]  >

加上時間資訊後：
  ● Flights ────── [14 active]  >
    2/18 00:00 ~ 2/20 06:00        ← 淡灰小字，自然顯示
```

Layer 面板不需要改結構，只需要在每個「有時間維度的圖層」下方
加一行時間範圍標示。使用者一眼就知道每個圖層的資料涵蓋時段。

---

### UI 設計：三層結構

#### Layer 1：底部時間軸（全局控制）— 已存在，需改進

現有的 TimelineControls 保留，但升級為「智慧時間軸」：

```
┌─────────────────────────────────────────────────────┐
│  [▶]  [60x ▼]   02/18 14:32          [Replay ▼]    │
│                                                      │
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░▓▓▓▓▓░░░░░░░░▓▓▓▓▓▓▓ │ ← 資料密度條
│  ═══════════════╋═══════════════════════════════════ │ ← 播放頭
│  2/18          2/20                3/5         now   │
│                                                      │
│  ▪ Flights  ▪ Ships  ▪ Rail  ▪ News  ▪ YouBike     │ ← 圖例（彩色點）
└─────────────────────────────────────────────────────┘
```

**改進重點**：
- 資料密度條：用半透明色塊疊加顯示各資料源的涵蓋時段
- 非線性壓縮：無資料的時段自動壓縮（參考 KronoGraph）
- 彩色圖例：與 Layer 顏色一致，滑鼠 hover 某色塊可 highlight 該圖層
- 右上角模式選擇（取代播放速度旁邊的空間）

#### Layer 2：模式快捷切換（右上角下拉）

```
┌──────────────┐
│  ● Replay    │  ← 播放歷史資料，有時間軸滑桿
│  ○ Live      │  ← currentTime = now()，持續更新
│  ─────────── │
│  ○ All Data  │  ← 時間軸 = 所有資料的聯集
│  ○ Today     │  ← 只看今天
│  ○ Custom... │  ← 自選時間範圍
└──────────────┘
```

- Replay + Live 是最常用的兩個，放最上面
- All Data / Today / Custom 是快捷範圍選擇（參考 Grafana）
- 選 Live 時，播放按鈕變成脈搏動畫，時間軸滑桿消失

#### Layer 3：逐層時間控制（Sidebar 展開面板內）

在 Layer 的 ExpandedPanel 中，有時間維度的圖層多一個時間控制區：

```
┌─── Flights ExpandedPanel ───────────────┐
│                                          │
│  Display:  [Live Status]  [Trails]       │
│                                          │
│  Time Range ─────────────────────────    │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░    │
│  2/18 00:00           2/20 06:00         │
│  [ Use Layer Range ] [ Follow Global ]   │
│                                          │
│  altExaggeration  ════╋════  1.2         │
│  staticOpacity    ═══╋═════  0.6         │
│                                          │
│                              [Hide]      │
└──────────────────────────────────────────┘
```

- **Use Layer Range**：用這個圖層自己的時間範圍覆蓋全局時間軸
- **Follow Global**（預設）：跟隨全局時間軸
- 大部分時候使用者不需要動這個，「Follow Global」就夠了

---

### 時間模式詳細行為

#### Replay 模式

```
時間軸範圍 = 所有 enabled 圖層的 timeRanges 聯集
currentTime = 由滑桿/播放控制
各圖層行為：
  - track 類（航班/船舶）→ 在有資料時段顯示，其他時間消失
  - cyclic 類（鐵道）→ 用 currentTime 的「時刻」部分循環
  - snapshot 類（YouBike/壅塞）→ 顯示最接近 currentTime 的快照
  - event 類（新聞）→ 顯示 currentTime 前 N 小時內的事件
  - static 類（車站/道路）→ 永遠顯示
```

#### Live 模式

```
時間軸範圍 = 不適用（鎖定在 now）
currentTime = Date.now()，每秒更新
各圖層行為：
  - track 類 → 若有 live 資料源則顯示，否則自動隱藏（灰化）
  - cyclic 類 → 用 now 的時刻跑時刻表
  - snapshot 類 → 顯示最新快照
  - event 類 → 顯示最近 24h 事件
  - static 類 → 永遠顯示

UI 差異：
  - 播放按鈕 → 變成綠色脈搏動畫 ●
  - 時間滑桿 → 隱藏（或變為「回看」滑桿：now-24h ~ now）
  - 時間顯示 → 即時時鐘，每秒更新
```

---

### Data Source Registry（資料來源登錄）

```typescript
// src/types/index.ts 新增

type TimeType = "track" | "snapshot" | "cyclic" | "event" | "static";

interface DataSourceMeta {
  /** 時間行為類型 */
  timeType: TimeType;

  /** 可用的時間範圍（可多段不連續） */
  timeRanges: { start: number; end: number }[];

  /** 是否支援 Live 模式 */
  supportsLive: boolean;

  /** 資料更新頻率（秒），用於 Live 模式 */
  refreshInterval?: number;
}
```

各圖層的 metadata：

```typescript
const DATA_SOURCE_META: Record<string, DataSourceMeta> = {
  flights: {
    timeType: "track",
    timeRanges: [],        // 由 flightLoader 動態填入
    supportsLive: false,   // 未來接 FR24 live 後改 true
    refreshInterval: 30,
  },
  ships: {
    timeType: "track",
    timeRanges: [],
    supportsLive: false,
    refreshInterval: 60,
  },
  rail: {
    timeType: "cyclic",
    timeRanges: [{ start: -Infinity, end: Infinity }],  // 永遠可用
    supportsLive: true,
    refreshInterval: undefined,  // 不需要 refresh，時刻表驅動
  },
  newsEvents: {
    timeType: "event",
    timeRanges: [],        // 動態填入
    supportsLive: true,
    refreshInterval: 900,  // 15 分鐘更新一次
  },
  bikeStations: {
    timeType: "snapshot",
    timeRanges: [],
    supportsLive: true,
    refreshInterval: 300,  // 5 分鐘
  },
  freewayCongestion: {
    timeType: "snapshot",
    timeRanges: [],
    supportsLive: true,
    refreshInterval: 300,
  },
  // static 類型不需要列出，預設就是 static
};
```

---

### 時間軸聯集計算

```typescript
function computeTimelineRange(
  sources: DataSourceMeta[],
  enabledLayers: string[],
): { start: number; end: number; segments: { start: number; end: number; sources: string[] }[] } {

  // 1. 收集所有 enabled 且非 static/cyclic 的 timeRanges
  // 2. 合併重疊區段
  // 3. 壓縮大於 N 小時的空白（非線性）
  // 4. 回傳 segments 列表（用於繪製資料密度條）
}
```

資料密度條的繪製：

```
  航班  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  船舶  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  鐵道  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (cyclic)
  新聞  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓
        ├──── 2/18 ────┤        ├── 3/5 ──┤   ├ 3/7 ┤
                    ╳ 壓縮 ╳          ╳ 壓縮 ╳
```

---

### Layer Sidebar 中的時間標示

#### 收合狀態（最簡潔）

```
  MOVING ──────────────────
  ● Flights     14     >      ← 現有
    2/18-2/20                  ← 新增：淡灰小字
  ● Ships       892    >
    2/18-2/19
  ● Rail        247    >
    daily                      ← cyclic 類型顯示 "daily"

  NEWS ────────────────────    ← 新 section
  ● News Events  17   >
    live · 24h                 ← live 類型顯示 "live"
```

#### 展開狀態（ExpandedPanel 內）

只在需要精確控制時才出現時間範圍控制：

```
┌─── Flights ────────────────────────────┐
│  Display:  [Live Status]  [Trails]     │
│                                        │
│  ◷ 2/18 00:00 ~ 2/20 06:00           │  ← 時間範圍
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░           │  ← mini 密度條
│  [Jump to Start]                       │  ← 跳轉按鈕
│                                        │
│  altExaggeration  ════╋════  1.2       │
│  staticOpacity    ═══╋═════  0.6       │
└────────────────────────────────────────┘
```

點擊 [Jump to Start] 會把全局時間軸播放頭跳到這個圖層的起始時間。
這是一個自然的操作：「我想看航班資料」→ 展開 Flights → Jump to Start。

---

### 互動流程範例

#### 場景 1：使用者開啟應用（預設）

1. 載入航班 + 船舶 + 鐵道資料
2. 時間軸自動 = 2/18 00:00 ~ 2/20 06:00（航班+船舶聯集）
3. 模式 = Replay
4. 自動播放

使用者看到的和現在完全一樣，零學習成本。

#### 場景 2：使用者想看新聞

1. 在 Layer Sidebar 開啟 NEWS section 的 News Events
2. 時間軸自動擴展：2/18 ~ now（因為新聞到今天）
3. 中間 2/20~3/7 的空白被壓縮
4. 播放頭跳到有新聞的區段
5. 或者：切換到 Live 模式，直接看最新新聞

#### 場景 3：使用者只想看今天

1. 點時間軸右上角模式選擇 → Today
2. 時間軸 = 今天 00:00 ~ now
3. 航班/船舶因為沒有今天的資料 → 自動灰化（不隱藏，但標示無資料）
4. 鐵道 + 新聞 + YouBike 正常顯示

#### 場景 4：使用者想同時看 2/18 航班 + 今天新聞

1. 模式選 All Data
2. 時間軸 = 2/18 ~ now（壓縮中間空白）
3. 播放時，2/18~2/20 航班會動，滑到 3/7 新聞會出現
4. 或者：把新聞設定為 "Always Show Latest"（在展開面板中 toggle）
   → 不管時間軸在哪，新聞永遠顯示最新 24h

---

### 實作優先順序

#### Step 1：Data Source Registry（基礎設施）
- 新增 `DataSourceMeta` 型別
- 各 loader 回報 timeRanges
- `useTimeline` 接受多個 timeRanges 輸入

#### Step 2：Layer 時間標示（UI 最小改動）
- Sidebar 每個圖層下方顯示時間範圍小字
- 不改任何互動邏輯，純顯示

#### Step 3：模式切換（Replay / Live）
- TimelineControls 新增模式下拉
- Live 模式下 currentTime = Date.now()
- 新聞圖層在 Live 模式下啟用

#### Step 4：資料密度條（視覺升級）
- TimelineControls 中繪製多源密度條
- 非線性時間軸壓縮

#### Step 5：逐層時間控制（進階）
- ExpandedPanel 中新增 Jump to Start
- 未來可加 Use Layer Range 功能

---

### 不做什麼（避免過度設計）

- ✗ 不做多條獨立時間軸（一條主軸 + 模式切換就夠）
- ✗ 不做日曆選擇器（用快捷按鈕 + 密度條點擊取代）
- ✗ 不做逐層獨立播放速度
- ✗ 不做時間軸上的 brush selection（太複雜，用模式切換取代）
- ✗ 不在 Sidebar 中嵌入完整時間軸（空間太窄）
