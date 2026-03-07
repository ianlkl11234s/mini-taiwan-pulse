# Timeline Architecture — 多源彈性時間軸設計

## 設計原則

1. **漸進揭露** — 預設簡單，需要時才展開細節
2. **與 Layer 自然整合** — 不新增獨立面板，融入現有 Sidebar
3. **資料驅動** — 時間軸由資料自動決定，不需手動配置
4. **三種粒度** — 粗放（一鍵切換）→ 中等（範圍選擇）→ 精細（逐層控制）

---

## 核心概念：Layer 本身就是時間軸的單位

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

## UI 設計：三層結構

### Layer 1：底部時間軸（全局控制）— 已存在，需改進

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

### Layer 2：模式快捷切換（右上角下拉）

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

### Layer 3：逐層時間控制（Sidebar 展開面板內）

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

## 時間模式詳細行為

### Replay 模式

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

### Live 模式

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

## Data Source Registry（資料來源登錄）

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

## 時間軸聯集計算

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

## Layer Sidebar 中的時間標示

### 收合狀態（最簡潔）

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

### 展開狀態（ExpandedPanel 內）

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

## 互動流程範例

### 場景 1：使用者開啟應用（預設）

1. 載入航班 + 船舶 + 鐵道資料
2. 時間軸自動 = 2/18 00:00 ~ 2/20 06:00（航班+船舶聯集）
3. 模式 = Replay
4. 自動播放

使用者看到的和現在完全一樣，零學習成本。

### 場景 2：使用者想看新聞

1. 在 Layer Sidebar 開啟 NEWS section 的 News Events
2. 時間軸自動擴展：2/18 ~ now（因為新聞到今天）
3. 中間 2/20~3/7 的空白被壓縮
4. 播放頭跳到有新聞的區段
5. 或者：切換到 Live 模式，直接看最新新聞

### 場景 3：使用者只想看今天

1. 點時間軸右上角模式選擇 → Today
2. 時間軸 = 今天 00:00 ~ now
3. 航班/船舶因為沒有今天的資料 → 自動灰化（不隱藏，但標示無資料）
4. 鐵道 + 新聞 + YouBike 正常顯示

### 場景 4：使用者想同時看 2/18 航班 + 今天新聞

1. 模式選 All Data
2. 時間軸 = 2/18 ~ now（壓縮中間空白）
3. 播放時，2/18~2/20 航班會動，滑到 3/7 新聞會出現
4. 或者：把新聞設定為 "Always Show Latest"（在展開面板中 toggle）
   → 不管時間軸在哪，新聞永遠顯示最新 24h

---

## 實作優先順序

### Step 1：Data Source Registry（基礎設施）
- 新增 `DataSourceMeta` 型別
- 各 loader 回報 timeRanges
- `useTimeline` 接受多個 timeRanges 輸入

### Step 2：Layer 時間標示（UI 最小改動）
- Sidebar 每個圖層下方顯示時間範圍小字
- 不改任何互動邏輯，純顯示

### Step 3：模式切換（Replay / Live）
- TimelineControls 新增模式下拉
- Live 模式下 currentTime = Date.now()
- 新聞圖層在 Live 模式下啟用

### Step 4：資料密度條（視覺升級）
- TimelineControls 中繪製多源密度條
- 非線性時間軸壓縮

### Step 5：逐層時間控制（進階）
- ExpandedPanel 中新增 Jump to Start
- 未來可加 Use Layer Range 功能

---

## 不做什麼（避免過度設計）

- ✗ 不做多條獨立時間軸（一條主軸 + 模式切換就夠）
- ✗ 不做日曆選擇器（用快捷按鈕 + 密度條點擊取代）
- ✗ 不做逐層獨立播放速度
- ✗ 不做時間軸上的 brush selection（太複雜，用模式切換取代）
- ✗ 不在 Sidebar 中嵌入完整時間軸（空間太窄）
