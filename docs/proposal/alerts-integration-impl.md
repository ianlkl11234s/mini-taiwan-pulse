# 警訊整合（Alerts）— 實作交接文件

> 交接日：2026-06-17
> 對象：另一個 session / agent 接手實作
> 設計來源：claude.ai/design bundle，已含 5 個 chat transcripts + AlertBoard/AlertCards/alerts/TimelineDock/IndicatorPanel/IntelFeed/App 等 jsx 檔
> 設計 URL（如需重抓）：`https://api.anthropic.com/v1/design/h/L68hXywMutoZ7QL1sShNOQ?open_file=%E5%8D%B3%E6%99%82%E6%83%85%E5%A0%B1+Intel.html`
> 前置文件：[`alerts-integration-handoff.md`](./alerts-integration-handoff.md)（設計需求說明）/ [`monitor-mode-phase2-handoff.md`](./monitor-mode-phase2-handoff.md)

---

## 0. 一句話 brief

把 **NCDR 災害示警（5 群組）+ CWA 地震** 整合進「即時情報 Intel Panel」與「Monitor 戰情看板」：
- Intel Panel 頂端加 **AlertSummaryBar**（可摺疊）+ **FeedTabs**（全部 / 新聞 / 警報）+ **AlertCard**
- Monitor IndicatorPanel 插 **AlertBoard** widget（3×2 群組卡）
- TimelineDock 把原 phase2 預留改成真的 **AlertsTrack**（24h active 警報堆疊圖）

---

## 1. 環境前置

| 項目 | 值 |
|---|---|
| 主 repo | `/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse` |
| Branch | 新開 `feat/alerts-integration` |
| dev server | `pnpm dev` → `http://localhost:3721` |
| 後端 repo | `../gis-platform`（migration） |
| TypeScript 驗證 | `npx tsc -b`（commit 前必跑） |

**已上線後端表**（不需動，前端直接用）：
- `realtime.disaster_alerts`（NCDR，collector 15 min cron）
- `realtime.earthquake_events`（CWA）

---

## 2. 群組 key mapping（重要）

**設計師檔內**用短形 key：`earthquake / weather / flood / transit / lifeline / safety`
**現有 layer 系統**（`src/data/disasterAlertTypes.ts`）用長形 key：`weatherAlerts / floodAlerts / transitAlerts / lifelineAlerts / safetyAlerts`

**決策**：新檔用**短形 key**（更精簡），跟 layer 對接走 mapping fn：

```ts
// src/data/alertsTypes.ts 新增 helper
export const ALERT_GROUP_SHORT = ["earthquake", "weather", "flood", "transit", "lifeline", "safety"] as const;
export type AlertGroupShort = typeof ALERT_GROUP_SHORT[number];

// short → long (layer key)
export const SHORT_TO_LAYER: Record<AlertGroupShort, AlertGroupKey | "earthquakes"> = {
  earthquake: "earthquakes",     // 既有獨立 layer
  weather:    "weatherAlerts",
  flood:      "floodAlerts",
  transit:    "transitAlerts",
  lifeline:   "lifelineAlerts",
  safety:     "safetyAlerts",
};

// event_term → short group（給後端 RPC SQL 用）
// 規則照 src/data/disasterAlertTypes.ts:38-95 既有定義，去 "Alerts" 後綴
```

---

## 3. 後端：migration 211

路徑：`../gis-platform/migrations/211_monitor_alert_rpcs.sql`

3 個 RPC：

### 3.1 `get_alert_summary()` → 摘要（給 SummaryBar + AlertBoard）

```sql
CREATE OR REPLACE FUNCTION public.get_alert_summary()
RETURNS TABLE (
    "group"      TEXT,         -- short key: earthquake/weather/...
    count        INTEGER,      -- active 數
    severe       INTEGER,      -- severity ≥ Severe 數
    top_term     TEXT,         -- 該 group 內出現最多的 event_term
    sev_minor    INTEGER,
    sev_moderate INTEGER,
    sev_severe   INTEGER,
    sev_extreme  INTEGER
)
```

實作關鍵：
- `realtime.disaster_alerts` `WHERE expires > now() AND urgency != 'Past'`
- 用 CASE WHEN event_term → group 短 key（照 disasterAlertTypes.ts 對應表，含 fallback `safety`）
- 排除 `event_term IN ('地震','消防安全檢查重大不合格場所','ncdrSystemTest')`（EXCLUDED_TERMS 已定，地震走另一表）
- 地震 group：取 `realtime.earthquake_events` 過去 24h count，severity 用 magnitude 自己分

### 3.2 `get_active_alerts(p_group TEXT, p_severity_min INT)` → 列表

```sql
CREATE OR REPLACE FUNCTION public.get_active_alerts(
    p_group TEXT DEFAULT NULL,        -- short key 或 NULL = 全部
    p_severity_min INT DEFAULT 1      -- 1/2/3/4 = Minor/Moderate/Severe/Extreme
)
RETURNS TABLE (
    id           TEXT,
    "group"      TEXT,
    term         TEXT,         -- event_term 或 '地震'
    severity     INT,          -- 1-4
    urgency      TEXT,         -- immediate/future/past
    headline     TEXT,
    area_desc    TEXT,
    area_count   INT,          -- 從 area_desc 切「/」算
    sent_ts      BIGINT,       -- unix 秒
    expires_ts   BIGINT,
    description  TEXT,
    instruction  TEXT,
    -- 地震 only
    magnitude    NUMERIC,
    depth_km     NUMERIC,
    occurred_ts  BIGINT,
    county       TEXT          -- 從 area_desc 抽第一個縣市，無則「全國」
)
```

排序：severity DESC, sent_ts DESC（給 AlertCard 用）
地震用 UNION ALL，magnitude → severity 由 SQL 做：`CASE WHEN magnitude >= 6 THEN 4 WHEN >= 5 THEN 3 WHEN >= 4 THEN 2 ELSE 1 END`

### 3.3 `get_alert_series_24h()` → sparkline + TimelineDock

```sql
CREATE OR REPLACE FUNCTION public.get_alert_series_24h()
RETURNS TABLE (
    "group"   TEXT,
    h         INT,         -- 0-23（taipei tz）
    count     INT          -- 該小時內 active 警報數
)
```

實作：generate_series(0,23) cross join groups，每 (h, group) 算「該小時內有多少 disaster_alerts 處於 active 狀態」。**台北時區**參考 `feedback_pg_cron_taipei_tz`。

3 個 RPC 全部 `GRANT EXECUTE TO anon, authenticated`、`STABLE`、`LANGUAGE sql`（除了 series 可能要 plpgsql）。

---

## 4. Tokens 擴充

`src/components/intel/intelTokens.ts` 末尾加：

```ts
// ─── Alerts ─────────────────────────────────────────────

export type AlertGroupShort = "earthquake" | "weather" | "flood" | "transit" | "lifeline" | "safety";

export interface AlertGroupDef {
  id: AlertGroupShort;
  label: string;  // 地震 / 氣象 / 水文 / 交通 / 民生 / 安全
  en: string;
  color: string;
  iconKey: keyof typeof MICON;  // 或新增到 MICON
}

export const ALERT_GROUPS: Record<AlertGroupShort, AlertGroupDef> = {
  earthquake: { id: "earthquake", label: "地震", en: "EQ",      color: "#d946ef", iconKey: "quake" },
  weather:    { id: "weather",    label: "氣象", en: "WEATHER", color: "#38bdf8", iconKey: "cloud" },
  flood:      { id: "flood",      label: "水文", en: "WATER",   color: "#2dd4bf", iconKey: "wave" },
  transit:    { id: "transit",    label: "交通", en: "TRANSIT", color: "#fb923c", iconKey: "cone" },
  lifeline:   { id: "lifeline",   label: "民生", en: "LIFELINE",color: "#a3e635", iconKey: "plug" },
  safety:     { id: "safety",     label: "安全", en: "SAFETY",  color: "#fb7185", iconKey: "flame" },
};
export const ALERT_GROUP_ORDER: AlertGroupShort[] = [
  "earthquake", "weather", "flood", "transit", "lifeline", "safety",
];

export interface AlertSeverityDef {
  key: "minor" | "moderate" | "severe" | "extreme";
  label: string;
  en: string;
  color: string;
  anim: string | null;  // CSS animation value, null = static
}
export const ALERT_SEVERITY: (AlertSeverityDef | null)[] = [
  null,  // index 0 unused
  { key: "minor",    label: "留意", en: "MINOR",    color: "#eab308", anim: null },
  { key: "moderate", label: "警戒", en: "MODERATE", color: "#f97316", anim: "alertBreathe 4s ease-in-out infinite" },
  { key: "severe",   label: "嚴重", en: "SEVERE",   color: "#ef4444", anim: "alertBreathe 2s ease-in-out infinite" },
  { key: "extreme",  label: "緊急", en: "EXTREME",  color: "#dc2626", anim: "alertPulse 1s ease-in-out infinite" },
];

export function alertSeverity(severityIdx: number): AlertSeverityDef {
  return ALERT_SEVERITY[Math.max(1, Math.min(4, severityIdx))]!;
}

// 倒數格式 HH:MM:SS
export function fmtExpiry(expiresTs: number, nowTs: number): string {
  let s = Math.max(0, expiresTs - nowTs);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
```

擴充 `MICON`：加 `quake / cloud / wave / cone / plug / flame / warn / check / chevUp / pin / clock`（svg d 字串複製自 `AlertCards.jsx:7-21`）。

`MonitorPanel.tsx` 內 `<style>` 區加 alert keyframes：

```css
@keyframes alertBreathe { 0%,100%{opacity:1} 50%{opacity:0.62} }
@keyframes alertPulse   { 0%,100%{opacity:1} 50%{opacity:0.45} }
@keyframes alertEdge    { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0);} 50%{box-shadow:0 0 16px 0 rgba(239,68,68,0.42);} }
@media (prefers-reduced-motion: reduce) {
  [style*="alertBreathe"],[style*="alertPulse"],[style*="alertEdge"] { animation: none !important; }
}
```

`@keyframes drawerOpen` 已有，沿用。

---

## 5. Loader

新檔 `src/data/alertsLoader.ts`：

```ts
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import type { AlertGroupShort } from "../components/intel/intelTokens";

export interface AlertSummary {
  group: AlertGroupShort;
  count: number;
  severe: number;
  top_term: string | null;
  sev_minor: number;
  sev_moderate: number;
  sev_severe: number;
  sev_extreme: number;
}

export interface ActiveAlert {
  id: string;
  group: AlertGroupShort;
  term: string;
  severity: number;       // 1-4
  urgency: string;
  headline: string;
  area_desc: string;
  area_count: number;
  sent_ts: number;
  expires_ts: number;
  description: string | null;
  instruction: string | null;
  magnitude: number | null;
  depth_km: number | null;
  occurred_ts: number | null;
  county: string;
}

export interface AlertSeriesPoint {
  group: AlertGroupShort;
  h: number;       // 0-23
  count: number;
}

export async function fetchAlertSummary(): Promise<AlertSummary[]> { /* withLoading + supabase.rpc("get_alert_summary") */ }
export async function fetchActiveAlerts(group?: AlertGroupShort | null, severityMin = 1): Promise<ActiveAlert[]> { /* ... */ }
export async function fetchAlertSeries24h(): Promise<AlertSeriesPoint[]> { /* ... */ }

// 把 summary array 轉成 Map<group, summary> 方便查
export function indexSummary(rows: AlertSummary[]): Map<AlertGroupShort, AlertSummary> { /* ... */ }
// 把 series array 轉成 Record<group, number[24]>
export function indexSeries(rows: AlertSeriesPoint[]): Record<AlertGroupShort, number[]> { /* ... */ }
// summary[] → 全國 total / severe 統計
export function tallySummary(rows: AlertSummary[]): { total: number; severe: number; byGroup: Map<AlertGroupShort, AlertSummary> } { /* ... */ }
```

**全部包 `withLoading()`**（CLAUDE.md rule 3）。失敗 console.warn + return 空陣列。

Polling 建議：
- summary + series：30 s 重抓
- 列表（active alerts）：filter / tab 變動時抓

---

## 6. 5 個新元件

放 `src/components/intel/alerts/`：

### 6.1 `AlertSummaryBar.tsx`（元件 A）

依設計檔 `AlertCards.jsx:36-127` 重寫成 TS：

Props：
```ts
interface Props {
  summary: { total: number; severe: number; byGroup: Map<AlertGroupShort, AlertSummary> };
  expanded: boolean;
  onToggle: () => void;
  activeGroups: AlertGroupShort[];   // 已 filter 的群組（visual on/off）
  onPickGroup: (g: AlertGroupShort) => void;
}
```

關鍵行為：
- `total === 0` → 極簡單條「✓ 目前全國無 active 警報」（淡色，幾乎隱形）
- 收合時：icon + 「N 則警報」+「含 M 則嚴重」紅色 badge（含 breathe 動畫）+ mini group dots（無數字、單純色點，severe 時發光）
- 展開時：6 群組 chip（數字 + breathe 動畫 if severe），點 chip 觸發 `onPickGroup`

樣式對應：所有 `var(--xxx)` → `COLORS.xxx`；fonts → `FONT_CJK` / `FONT_DATA`。

### 6.2 `FeedTabs.tsx`（元件 B）

依 `AlertCards.jsx:132-163`：

Props：
```ts
type FeedTab = "all" | "news" | "alerts";
interface Props {
  tab: FeedTab;
  onTab: (t: FeedTab) => void;
  newsCount: number;
  alertCount: number;
}
```

3 個 flex:1 button，各帶 badge 數字。警報 tab 在 `alertCount > 0` 時用紅色 tint。

### 6.3 `AlertCard.tsx`（元件 C）

依 `AlertCards.jsx:168-285`：

Props：
```ts
interface Props {
  a: ActiveAlert;
  selected: boolean;
  expanded: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  nowTs: number;
}
```

關鍵：
- 結構參照既有 `IntelCard.tsx`（spine dot + chip 行 + headline + location + footer + expand）
- expand 顯示 description + instruction（NCDR 處置指引，用 group 色 tint 框框）+ meta grid + 連結到 NCDR / CWA
- severity ≥ 2 對應 `alertBreathe` 動畫（從 `alertSeverity(idx).anim` 取）
- 倒數即時刷：用 `useState(now)` + 1s interval（**僅在 expanded 或 severe 時才需要每秒更新**，避免不必要 re-render）

### 6.4 `AlertBoard.tsx`（元件 D，Monitor widget）

依 `AlertBoard.jsx:154-198`，含內部子元件：

- `AlertTrend`（`AlertBoard.jsx:112-152`）：24h 全 group 加總 area-line
- `GroupCard`（`AlertBoard.jsx:9-50`）：單 group 卡，含大數字 + sub 文字 + sparkline + alertEdge animation（hot 時）
- `AlertDrawer`（`AlertBoard.jsx:52-110`）：點卡 → 展開明細列表（重用 `fetchActiveAlerts(group)` 拿 detail）

Props：
```ts
interface Props {
  summary: { total: number; severe: number; byGroup: Map<AlertGroupShort, AlertSummary> };
  series: Record<AlertGroupShort, number[]>;  // 24h sparkline data
  accent: string;
  nowTs: number;
}
```

內部 state 自己管 `openGroup` + 點開時 lazy fetch 該 group 的 active alerts 細節。

空狀態：`total === 0` 顯示「✓ 目前全國無 active 警報」單條（同 AlertBoard.jsx:177）。

### 6.5 `AlertsTrack.tsx`（TimelineDock 警報軌）

依 `TimelineDock.jsx:171-217`：

獨立元件接 `series` + `nowFrac` + `playbackFrac`，畫一個高 30px 的 24h stacked bar，覆蓋未來時段加暗，共用 TimelineDock 的 scrub callback。

Props：
```ts
interface Props {
  series: Record<AlertGroupShort, number[]>;
  nowFrac: number;
  playbackFrac: number;
  onScrub: (e: { clientX: number }) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}
```

---

## 7. 接線

### 7.1 `IntelPanel.tsx` 改造

當前結構（line 240-352）：
```
IntelHeader → IntelFilters → IntelSituation → 卡片列表 → IntelReplay
```

改成：
```
IntelHeader
  → AlertSummaryBar  🆕
  → FeedTabs         🆕
  → tab === "news" ? IntelFilters : (tab === "alerts" ? 嚴重度 seg : tab === "all" ? 時間範圍 seg)
  → IntelSituation（保留）
  → 卡片列表
     ├─ "news" → 既有 IntelCard
     ├─ "alerts" → AlertCard
     └─ "all" → merge by ts DESC → newsEl/alertEl
  → IntelReplay（不動）
```

新增 state：
```ts
const [feedTab, setFeedTab] = useState<FeedTab>("all");
const [alertsExpanded, setAlertsExpanded] = useState(false);
const [pickedGroups, setPickedGroups] = useState<AlertGroupShort[]>([]);
const [severityMin, setSeverityMin] = useState<1|2|3|4>(1);

const [alertSummary, setAlertSummary] = useState<AlertSummary[]>([]);
const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);

// 30s polling summary
// filter / tab 變動時抓 activeAlerts
```

點 SummaryBar chip → `setFeedTab("alerts"); setAlertsExpanded(true); setPickedGroups(toggle)`。

### 7.2 `MonitorPanel.tsx` 改造

加 props 傳給 IndicatorPanel：`summary` / `series` / `nowTs`。

在 MonitorPanel 內部 30s 抓 summary + series（同 pressure 那組 polling）。

### 7.3 `IndicatorPanel.tsx` 改造

在 `<LiveWall />` 之後、`<Widget>熱區 Top 5</Widget>` 之前插入：

```tsx
<AlertBoard summary={alertSummary} series={alertSeries} accent={accent} nowTs={now} />
```

### 7.4 `TimelineDock.tsx` 改造

把原本「Phase 2 reserved multi-track ghost」整段（line 159-167）換成 `<AlertsTrack ... />` 元件（傳 series + frac）。

### 7.5 `LegendPanel.tsx`

如果地圖 alert 點未來要重新風格化（B2 方案 — pulse 動畫），到時再更新圖例。**本 PR 暫不動地圖視覺**（地圖 paint 改放下一個 PR）。

---

## 8. CLAUDE.md 規則檢核

| 規則 | 動作 |
|---|---|
| §1 TypeScript | commit 前 `npx tsc -b` 必跑 |
| §2 資料來源 | 走 `public.*` RPC 不直打 `realtime.*` ✅ |
| §3 Loading UI | 3 個 fetch 全包 `withLoading()` ✅ |
| §4 DB 優化 | 3 個 RPC 都簡單 SELECT，<10k rows、<1s，**不必** pre-aggregate |
| §6 timeStore | `nowTs` 用 `useState + 1s interval` OK；勿放進 useEffect deps（用 ref 或 throttle） |
| §5a 圖層四鐵則 | 本 PR 不開新 layer，不適用 |

---

## 9. 任務拆解（建議 TaskCreate）

1. ⏳ migration 211（3 RPC）+ apply + smoke test
2. ⏳ intelTokens 擴充（ALERT_GROUPS / ALERT_SEVERITY / MICON / fmtExpiry）
3. ⏳ alertsLoader.ts（3 fetch + 3 helper）
4. ⏳ AlertSummaryBar.tsx
5. ⏳ FeedTabs.tsx
6. ⏳ AlertCard.tsx
7. ⏳ AlertBoard.tsx（含 GroupCard / AlertTrend / AlertDrawer 子元件）
8. ⏳ AlertsTrack.tsx
9. ⏳ IntelPanel 接線（tab-aware + summary polling）
10. ⏳ MonitorPanel + IndicatorPanel + TimelineDock 接線
11. ⏳ tsc -b + dev server browser walkthrough
12. ⏳ commit + PR `feat/alerts-integration`

工時估 4-5 hr。

---

## 10. Verification

`npx tsc -b` 通過 + 瀏覽器 walkthrough：

### Intel Panel
- [ ] 開 Intel Panel → 看到頂端 SummaryBar（active 警報數 / 嚴重 badge / mini dots）
- [ ] 點 SummaryBar → 展開 6 群組 chip
- [ ] 點群組 chip → 自動切到「警報 tab」+ filter 該 group
- [ ] 切「全部 tab」→ 新聞 + 警報 merge by ts，順序正確
- [ ] 切「警報 tab」→ 只看 AlertCard，嚴重度 seg 可過濾
- [ ] AlertCard 展開 → 看到 description / instruction / 連結
- [ ] severity=Severe 的 AlertCard 邊框 / spine dot 有 breathe 動畫

### Monitor
- [ ] 進 Monitor → IndicatorPanel 出現 AlertBoard widget
- [ ] 全 0 警報時 → AlertBoard 收成單條綠訊息
- [ ] 有警報時 → 顯示 24h trend + 3×2 group cards + sparkline
- [ ] 點 group card → 展開 drawer 列明細
- [ ] severe 群組卡片邊框 `alertEdge` 動畫
- [ ] TimelineDock 警報軌（下方）顯示堆疊條，跟新聞軌共用指針

### Loading
- [ ] 慢網路時左上 loading registry 出現「警報摘要」/「警報細節」/「警報 24h」三個 task

---

## 11. 設計檔位置（如需重看）

原 bundle 在另一台機器 / session 解壓：
1. WebFetch 上方設計 URL，會回 gzip
2. `tar -xzf bundle.tar.gz`
3. 關鍵檔：
   - `untitled/project/intel/alerts.jsx`（資料定義 / helpers / mock 樣本）
   - `untitled/project/intel/AlertCards.jsx`（元件 A/B/C）
   - `untitled/project/intel/AlertBoard.jsx`（元件 D + GroupCard + AlertDrawer + AlertTrend）
   - `untitled/project/intel/IntelFeed.jsx`（IntelPanel tab-aware 改造）
   - `untitled/project/intel/TimelineDock.jsx`（警報軌）
   - `untitled/project/intel/App.jsx`（state 結構）

---

## 12. 不在本 PR 範圍

- 地圖警報點視覺重整（B2 pulse / B3 icon）— 等本 PR 上線後另開 PR
- 警報統計進壓力指數 signal — 另開（已有 signals_hourly framework）
- Mobile 響應式
- 警報「過去 N 天」歷史檢索（目前只有 active）
- ❌ 活動斷層（不算警訊）
