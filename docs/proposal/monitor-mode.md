# Monitor Mode — 即時情報儀表板模式

> 提案日期：2026-06-13
> 對象：Claude Design（之後做 UI 設計）+ 工程實作
> Phase 1 範圍：**完成新聞為主**，其他指標 / 直播 / 非地理信號預留位置但暫不接資料
> 主要依據：現有 `realtime.news_events` 管線（已上線 2026-06-12，RSS×29 → Gemini 地名抽取 → migration 162 RPC）

---

## 0. 一句話定位

> 「在現有 Mini Taiwan Pulse 之上，加一個 **Monitor 模式 toggle**，按下去後從底部拉起一個全寬覆蓋面板，把畫面切成『**底：時間軸／左：新聞 feed／右：指標 + 直播**』三區，變成可以掛著看的即時情報看板（situational awareness dashboard）。」

不取代原本的地圖，是**疊上去的工作模式**。退出 monitor → 回到原本的探索式地圖體驗。

---

## 1. UX：兩種模式切換

### 1.1 既有模式（Explore Mode）
- 全螢幕地圖 + 左側 sidebar 選 layer + 點 pin 看細節
- 目的：使用者主動探索特定地點 / 資料層

### 1.2 新模式（Monitor Mode）
- 點頂部「Monitor」toggle（或 `M` 鍵）
- 底部一塊面板**拉起**蓋住下半部畫面（約 55-70% 高度，可拖把手調整）
- 地圖縮成上半部小景，仍可看
- 整個面板就是**一張即時情報看板**

```
═══════════════════════════════════════════════════════
║                                                     ║
║              MAP（縮小，仍 interactive）              ║
║                                                     ║
╠══════════════ ↕ drag handle ═════════════════════════╣
║ TIMELINE DOCK（橫跨全寬）                            ║
║  ▁▂▃▅▇█▇▅▃▂▁▁▂▂▁▁▂▃▂▁ 新聞密度  ●─────────         ║
║  00:00              14:30                  23:59     ║
╠═════════════════════╦═══════════════════════════════╣
║                     ║                               ║
║   NEWS FEED         ║   INDICATORS / LIVE           ║
║   (左 40%)          ║   (右 60%)                    ║
║                     ║                               ║
║  ● 事故 9 分鐘前    ║  ┌─ KPI ──────────────┐      ║
║  信義商辦火警        ║  │ 29 事件 ↑23%       │      ║
║                     ║  │ 高雄 6 ↑ 火爆       │      ║
║  ● 災害 13 分鐘前    ║  └────────────────────┘      ║
║  ...                ║                               ║
║                     ║  ┌─ 熱區 Top 5 ───────┐      ║
║                     ║  │ 1. 高雄市 6        │      ║
║                     ║  │ 2. 臺北市 5        │      ║
║                     ║  └────────────────────┘      ║
║                     ║                               ║
║                     ║  ┌─ 新聞直播（預留）──┐      ║
║                     ║  │ [YouTube live]     │      ║
║                     ║  └────────────────────┘      ║
║                     ║                               ║
║                     ║  ┌─ 國家信號（預留）──┐      ║
║                     ║  │ 共機 12  電網 8.2%  │      ║
║                     ║  └────────────────────┘      ║
╚═════════════════════╩═══════════════════════════════╝
```

### 1.3 互動契約

| 動作 | 結果 |
|---|---|
| 拖底部 drag handle | 調整面板高度（min 30% / max 90%） |
| 點 `Monitor` 再按一次 / `Esc` | 收回面板，回 Explore Mode |
| 點 timeline 上某時刻 | feed + 地圖（包括小景）+ 指標 widget 全部同步跳到該時刻 |
| 點 feed 卡片 | 地圖小景飛去該 pin、右側 indicator 區可選擇展開「該地點 30 天事件直方圖」 |
| 點地圖小景 pin | feed 自動 scroll 到該則新聞 |
| Wall mode（可選） | 進一步隱藏地圖小景 + sidebar，純看板（給大螢幕掛） |

---

## 2. 三大區塊功能規格（Phase 1 範圍）

### 2.1 底部：Timeline Dock

**Phase 1：單軌（只畫新聞密度）**
- 橫軸：24h（與既有 `HistoricalTimeline` 對齊）
- 縱軸：每小時新聞事件數
- 視覺：strip chart（迷你直方圖 / area chart，uPlot 或 visx）
- 指針：當前時間（同步既有 `timeStore`）
- Hover：顯示該小時的事件數 + 主要分類分佈
- 點擊：把 `timeStore` 跳到該時間，feed + 地圖跟著切

**Phase 2 預留**：多軌（共機 / 電網 / 地震 / 假訊息…），同一橫軸對齊。每多一個信號 = 多一條 30px 軌道。

**與既有時間軸的差異**：
- 既有 `HistoricalTimeline` = 純拉桿（軸上沒資訊）
- Timeline Dock = 拉桿 + 軸上**畫著資料的迷你圖**（軸本身就是 chart）

### 2.2 左側：News Feed

**沿用既有元件**：
- 資料：`getNewsEventsForDate(p_day)` RPC（migration 162 已上線）
- 卡片設計：照截圖樣式（時間相對值、分類 chip、地點、標題、摘要、來源、conf）
- 已有：`useNewsEventsLayer` / `useNewsTimeline` / `newsEventTypes`（7 分類色）

**Monitor Mode 新增**：
- 滾動跟著 timeline 指針：指針往前走 → 列表自動高亮對應卡片
- 「焦點模式」：上方固定當下 5 分鐘內的新聞，下方自由滾動歷史
- 卡片右上角加「升溫 🔥」chip（資料依賴：Phase 1 後端 RPC `get_news_trending`，見 §4）
- 集群顯示：截圖已有「另有 1 個來源」，monitor mode 展開後顯示 source logo 列

### 2.3 右側：Indicators + Live

#### A. KPI 條（Phase 1 可做）
- 「29 事件 ↑23%」「最熱地區：高雄市 6」「新增來源：28 / 29」
- 資料：前端 group-by 現有 feed 就能算

#### B. 熱區 Top 5（Phase 1 需新增一支 RPC，見 §4.2）
- 過去 1h 各 county+category 計數排序
- 點任一行 → 地圖飛去、feed filter 到該縣市

#### C. 24h 事件直方圖 widget（Phase 1 可做）
- 跟 Timeline Dock 同資料，但這裡用大圖呈現分類堆疊
- 跟既有 `TimeseriesSparkline` 元件共用

#### D. 新聞直播嵌入（Phase 1 預留外殼，先空著）
- 可選擇嵌入：中央社 / 公視 / 民視等 YouTube live
- 技術上就是 `<iframe>` 嵌入，每個直播一個 card
- **法律 / 版權考量**：用 YouTube embed 是合法的；不要自己代理推流
- 預留 widget slot，先放靜態「直播即將上線」placeholder

#### E. 國家信號 widget 群（Phase 2+，先預留 slot）
- 共機擾台、電網備轉、地震次數、假訊息、加權指數…
- 資料層：見 §5（通用 `realtime.national_signals` 表）
- Phase 1：UI 預留卡片格子但不接資料，顯示「Phase 2 即將上線」

---

## 3. 既有資產盤點（Phase 1 大量複用）

### 3.1 資料層（已上線）

| 資產 | 位置 | Monitor Mode 怎麼用 |
|---|---|---|
| `realtime.news_events` | gis-platform migration 162 | 直接用 |
| RPC `get_news_events_day(p_day)` | 同上 | feed + timeline dock 同一支 |
| RPC `get_news_event_dates()` | 同上 | 顯示「哪幾天有資料」 |
| RSS×29 source / Gemini 地名抽取 | data-collectors `collectors/news_events.py`（787 行）| 後端管線無需動 |
| Cron job 55（14/34/54 分跑）| gis-platform | 無需動 |
| 分類 7 類（事故/治安/災害/交通/健康/政策/其他）| `src/data/newsEventTypes.ts` | 直接用 |
| Simhash 去重 + 「另有 N 來源」 | collector | 已部分顯示，monitor 展開細節 |

### 3.2 前端元件（已存在，可複用）

| 元件 | 在哪 | 用在 monitor 的哪 |
|---|---|---|
| `useNewsEventsLayer` | `src/hooks/useNewsEventsLayer.ts` | 地圖小景的 pin |
| `useNewsTimeline` | `src/hooks/useNewsTimeline.ts` | ripple + 時間過濾 |
| `newsEventTypes.ts` | 7 分類顏色 + label | feed chip / KPI 色 |
| `LegendPanel` 的 `NewsEventLegend` | 圖例 | monitor 內小圖例 |
| `featureInfo/eventPanels.tsx` `NewsEventPanel` | popup | 點 feed 卡片展開時用 |
| `TimeseriesSparkline` | `src/components/TimeseriesSparkline.tsx` | 24h widget |
| `HistoricalTimeline` | `src/components/HistoricalTimeline.tsx` | timeline dock 的拉桿基礎 |
| `timeStore` | `src/state/timeStore.ts` | 所有時間同步的核心 |
| `MobileBottomSheet` | `src/components/MobileBottomSheet.tsx` | **monitor 面板拉起的範本** |
| `loadingRegistry` | `src/lib/loadingRegistry.ts` | RPC 載入狀態 |

### 3.3 已有但沒接入 monitor 的圖層（之後可掛 mini-widget）
水利 / 雷達 / 衛星 / 雨量 / 高速公路 / 公車 / road events / CCTV / 消防 / 災害警報 / AQI…
Phase 1 不接，但 right panel 預留「Layer probe」widget slot 給未來。

---

## 4. Phase 1 工程清單（新增/改動）

### 4.1 前端

| 任務 | 動作 | 估時 |
|---|---|---|
| **Monitor 模式 toggle** | 頂部 `ModeToggle.tsx` 旁加「Monitor」按鈕；新增 `monitorMode` zustand state | 0.5d |
| **MonitorPanel 容器** | 新增 `src/components/monitor/MonitorPanel.tsx`，從底部拉起，可拖 handle 改高度（複用 `MobileBottomSheet` 思路） | 1d |
| **TimelineDock**（單軌） | 新增 `src/components/monitor/TimelineDock.tsx`，uPlot 多軌但 Phase 1 只畫新聞密度 1 軌；指針同步 `timeStore` | 1d |
| **NewsFeedPanel** | 新增 `src/components/monitor/NewsFeedPanel.tsx`，左區，吃 `getNewsEventsForDate`；卡片設計 = 截圖樣式 + 升溫 chip + 集群展開 | 1.5d |
| **IndicatorPanel** | 新增 `src/components/monitor/IndicatorPanel.tsx`，右區；Phase 1 含：KPI 條、熱區 Top 5、24h widget、直播 slot（placeholder）、信號 slot（placeholder） | 1.5d |
| **時間同步** | timeline 點擊 / feed scroll / 地圖小景三者透過 `timeStore` 互通 | 0.5d |
| **Loading + 空狀態** | 所有區塊接 `loadingRegistry`，空狀態文案 | 0.3d |
| **動畫**：ripple / 卡片進場 / KPI 數字滾動 | 純 CSS + Framer Motion | 0.5d |

**前端小計：約 7 工作日**

### 4.2 後端（新增一支 pre-aggregate RPC）

熱區 Top 5 + 升溫偵測需要新後端。套既有 pre-aggregate pattern（套 `supabase-optimize` skill 範本）：

```sql
-- realtime.news_events_hourly_county_cat（普通 table）
-- 欄位：hour timestamptz, county text, category text, cnt int
-- refresh function: 每 15 分跑一次今日 + 昨日
-- pg_cron: 加進 job 55 的循序步驟（禁止拆新 job — 見 PRINCIPLES）
-- 索引：(hour DESC, county, category)

-- RPC 1: 熱區排行
CREATE OR REPLACE FUNCTION public.get_news_trending_hotspots(
    p_window_hours int DEFAULT 1,
    p_limit int DEFAULT 5
) RETURNS TABLE (county text, category text, cnt int, surge_ratio numeric)
-- surge_ratio = 過去 window 計數 / 過去 24h 同時段均值

-- RPC 2: 24h 各小時 + 各分類計數（給 timeline dock + widget）
CREATE OR REPLACE FUNCTION public.get_news_hourly_breakdown(
    p_day date DEFAULT CURRENT_DATE
) RETURNS TABLE (hour int, category text, cnt int)
```

**估時：0.5d migration + 0.5d 前端 loader + 0.5d 驗證 = 1.5d**

### 4.3 不動的部分
- collector（RSS×29 / Gemini）
- migration 162（既有 RPC）
- 既有地圖 layer 邏輯
- 既有 HistoricalTimeline（monitor 用獨立元件）

---

## 5. Phase 2+ 預留架構（這次不做，但 layout 預留）

### 5.1 通用信號表
```sql
CREATE TABLE realtime.national_signals (
    id          BIGSERIAL PRIMARY KEY,
    signal_type TEXT NOT NULL,     -- 'pla_intrusion' / 'grid_reserve' / 'earthquake' / 'taiex' / 'misinfo'
    ts          TIMESTAMPTZ NOT NULL,
    value       NUMERIC,
    level       TEXT,              -- 'normal' / 'elevated' / 'critical'
    metadata    JSONB,
    source      TEXT,
    url         TEXT
);
CREATE INDEX ON realtime.national_signals (signal_type, ts DESC);
```
- Pre-aggregate：`national_signals_hourly`（signal_type, hour, agg_value, count）
- 通用 RPC：`get_signals_recent(types text[], window_hours int)`
- **加新信號 = 加一個 collector + IndicatorPanel 加一張 widget，不動 schema**

### 5.2 信號候選清單（按優先級）

| 信號 | 來源 | 優先 |
|---|---|---|
| 共機擾台 | 國防部 PDF / `EyesOnPLA` GitHub | ⭐⭐⭐ |
| 電網備轉容量 | 台電 Open Data | ⭐⭐⭐ |
| 地震即時 | CWA Open API | ⭐⭐⭐ |
| 加權指數 / 匯率 | 證交所 / 央行 | ⭐⭐ |
| 假訊息 / Cofacts | MyGoPen / Cofacts API | ⭐⭐ |
| 海纜 / 連通性 | Cloudflare Radar | ⭐ |
| 公衛週報 | 疾管署 | ⭐ |

### 5.3 新聞直播嵌入候選
- 中央社 YT live、公視新聞網、民視新聞、TVBS、PTS News
- 純 `<iframe>` embed，每個 widget 一張卡

### 5.4 Realtime push 升級（Phase 3）
- 把 polling（20min）改為 Supabase Realtime channel 訂閱 `news_events` INSERT
- 真正秒級推送
- 涉及 gis-platform RLS + replication slot 設定

---

## 6. 技術可行性逐項評估

| 功能 | 可行性 | 阻礙 |
|---|---|---|
| Monitor 模式 toggle + 面板拉起 | ✅ 沒問題 | 純前端 |
| Timeline Dock（單軌新聞密度） | ✅ 沒問題 | 用 uPlot；資料已在 |
| Timeline Dock（多軌信號）| 🟡 Phase 2 | 需 `national_signals` 表先建好 |
| 左側 feed（含集群、升溫 chip） | ✅ 沒問題 | 升溫 chip 需 §4.2 RPC |
| KPI 條 + 24h widget | ✅ 沒問題 | 前端就能算 |
| 熱區 Top 5 | 🟡 需新 RPC | §4.2 1.5d |
| 新聞直播 embed | ✅ 沒問題 | `<iframe>`；版權安全 |
| 國家信號 widget | 🟠 Phase 2 | 需新 collectors + signals 表 |
| Realtime push | 🟠 Phase 3 | gis-platform 設定 |
| Wall mode | ✅ 沒問題 | 純 CSS fullscreen |

---

## 7. Phase 1 交付物（給 Claude Design 設計參考）

設計時請以這份的「§2 三大區塊功能規格」為核心，包含：

### 必做（Phase 1）
1. Monitor 模式 toggle 位置（建議頂部右側，靠近現有「即時／歷史」「Capture」「3D Altitude」一排）
2. 從底部拉起的面板動效（建議 spring 動畫，drag handle 視覺）
3. 三區比例（左 40% / 右 60% / 底部 timeline 全寬 120-160px）
4. Timeline Dock 視覺（單軌 strip chart + 指針 + hover tooltip）
5. News Feed 卡片設計（截圖已是雛形，加「🔥 升溫」chip、集群來源 logo 列、時間相對 + 絕對雙顯）
6. 右側四個 widget：KPI 條 / 熱區 Top 5 / 24h 直方圖 / 直播 placeholder
7. 空狀態 / 載入狀態 / 錯誤狀態

### 預留（Phase 2+，先畫位但不接資料）
1. Timeline Dock 多軌的擴展視覺（信號軌道堆疊）
2. 國家信號 widget 卡片樣式（共機 / 電網 / 地震…的數字卡）
3. Wall mode 全螢幕版本（隱藏地圖小景 + sidebar）

### 一句話 brief 給 Claude Design
> 「在 Mini Taiwan Pulse 加一個 Monitor 模式 toggle，按下去從底部拉起一張覆蓋下半部的情報看板：底部 timeline dock（單軌畫新聞密度的迷你 strip chart）、左 40% 新聞 feed（卡片含升溫 🔥 chip 與集群來源列）、右 60% 指標區（KPI 條 / 熱區 Top 5 / 24h 直方圖 / 直播 placeholder / 國家信號預留 slot）。風格：less news app, more mission control，monospace 數字 + 暗色 + 餘光資訊密度高。Phase 1 只接新聞資料，其他 slot 預留空殼。」

---

## 8. Phase 1 落地節奏

| Day | 內容 |
|---|---|
| Day 1 | Migration `news_events_hourly_county_cat` + 兩支 RPC，本地驗證 |
| Day 2 | `MonitorPanel` 容器 + toggle + drag handle |
| Day 3 | `TimelineDock` 單軌 + 指針同步 |
| Day 4 | `NewsFeedPanel`（含升溫 chip / 集群） |
| Day 5 | `IndicatorPanel` KPI + 熱區 Top 5 |
| Day 6 | 24h widget + 直播 placeholder + 空狀態 + 動畫 |
| Day 7 | 整合測試、空狀態、Loading、行動裝置 fallback |

**總估時：1-1.5 週**（Phase 1 只接新聞、其他 slot 預留）

---

## 9. 風險 / 注意事項

| 風險 | 對策 |
|---|---|
| 加新 cron job 影響既有 pg_cron | 不開新 job，把 hourly_county_cat refresh 串進既有 job 55 |
| Pooler 2min timeout | refresh function 本身在 pg_cron 跑，RPC 只 SELECT 預聚合表 |
| Monitor 模式手機體驗 | Phase 1 桌機優先；手機強制改 layout（單欄堆疊或維持 explore mode） |
| 自由時報 RSS 在 Zeabur 403 | 既有問題，不在 Phase 1 scope |
| 直播 embed 法律 | 只用 YouTube `<iframe>`，不代理 / 不錄影 |
| TimelineDock 跟既有 HistoricalTimeline 衝突 | Monitor mode 開時隱藏既有，關閉時還原 |
| 4 大主題分類（民生中斷 / 水文防汛 / 氣象特報 / 交通阻斷）vs 現有 7 類 | Phase 1 沿用 7 類；之後再決定是否重訓 Gemini prompt 加 sub-category |

---

## 10. 參考資料

- 既有新聞管線：`.claude/memory/news-roadmap.md`
- 既有 NEWS_MAP_PLAN：`docs/NEWS_MAP_PLAN.md`（Phase 1-3 已完成）
- 既有 Timeline 架構：`docs/TIMELINE_ARCHITECTURE.md`
- Supabase pre-aggregate pattern：`docs/supabase-optimization.md`
- 圖層 UX 四鐵則：`CLAUDE.md` §5a（透明度 / 圖例 / popup / dropdown）
- migration 162（news_events 表 + RPC）：`../gis-platform/migrations/162_news_events.sql`
- collector：`../data-collectors/collectors/news_events.py`

---

## 附錄 A. 假資料（Phase 1 mock 用）

過去 5 小時 10 則跨 4 類測試資料見 chat 紀錄（民生中斷 / 水文防汛 / 氣象特報 / 交通阻斷）。
建議匯出成 `public/geo/news_events_mock.geojson` 給 Claude Design 在無 Supabase 環境也能跑通設計稿。

## 附錄 B. 三區比例 ASCII 草圖（供 Claude Design 參考）

```
桌機（≥1280px）：
┌──────────────────────────────────────────┐
│ MAP (上半 35%)                            │
├──────────────────────────────────────────┤ ← drag handle
│ TIMELINE DOCK 120px 全寬                  │
├────────────────┬─────────────────────────┤
│ NEWS FEED 40%  │ INDICATORS + LIVE 60%   │
│                │  KPI / 熱區 / 24h /     │
│                │  直播 / 信號 slot       │
└────────────────┴─────────────────────────┘

手機（<768px）：
維持 Explore Mode 或單欄垂直堆疊
[Timeline] → [Feed] → [Indicators]
```
