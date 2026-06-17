# 警訊整合（Alerts）— 設計交接文件

> 交接日：2026-06-17
> 對象：設計師（設計警報摘要列 / 切換頁籤 / AlertCard / Monitor AlertBoard / 地圖點樣式重整）
> 對應後續工程：1 個新 migration（2 RPC）+ 前端 5 個新元件 + 地圖 paint 微調
> 前置文件：`monitor-mode-phase2-handoff.md`（Monitor Phase 2 已上線）

---

## 0. 一句話 brief

> 把現有的 **NCDR 災害示警**（disasterAlerts，5 群組）+ **CWA 地震** 整合進「即時情報 Intel Panel」和「Monitor 戰情看板」：
> Intel Panel 頂端加**警報摘要 chip 列**（常駐），下方加 **新聞 / 警報** 切換頁籤；
> Monitor 加 **警報牆 ALERT BOARD** widget（2×3 grid 卡片）；
> 地圖上重整警報點的視覺（**形狀 / 大小 / 動畫**），避免跟新聞點混淆。

---

## 1. 警訊資料源（已上線後端）

### 1.1 NCDR 災害示警（`realtime.disaster_alerts`）

**狀態**：✅ 已上線（collector: `data-collectors/collectors/ncdr_alerts.py`，15 min cron）

**單一表，靠 `event_term` 分 5 個 group**（定義在 `src/data/disasterAlertTypes.ts`）：

| Group | event_term | 圖層既有色 |
|---|---|---|
| **lifelineAlerts**（民生中斷）| 停水 / 電力中斷 / 行動電話中斷 / 停班停課 | 青/黃/紫/粉 |
| **floodAlerts**（水文防汛）| 淹水 / 淹水感測 / 水庫放流 / 河川高水位 / 區排警戒 / 土石流及大規模崩塌 / 枯旱預警 | 藍系（深淺）|
| **weatherAlerts**（氣象特報）| 雷雨 / 降雨 / 強風 / 高溫 / 低溫 / 濃霧 / 颱風 / 海嘯 | 紫 / 紅 / 青 / 灰 |
| **transitAlerts**（交通阻斷）| 道路封閉 / 鐵路事故 / 捷運營運 / 高速公路路況事件 | 橘 / 紅 / 綠 |
| **safetyAlerts**（安全環境）| 火災 / 海洋污染 / 空氣品質 / 國家森林遊樂區 + fallback | 紅 / 青 / 萊姆 / 綠 |

**真實樣本**（2026-06-17 上午 active 警報）：

```text
event_term  | severity | urgency   | area_desc            | sent              | expires
------------+----------+-----------+----------------------+-------------------+-------------------
停水         | Minor    | Future    | 桃園市蘆竹區富竹里…  | 2026-06-17 14:30  | 2026-06-17 18:00
降雨         | Moderate | Future    | 臺北市士林區、北投區… (75 鄉鎮) | 2026-06-17 14:27 | 2026-06-17 23:00
水庫放流     | Minor    | Immediate | 臺中市石岡區、豐原區… | 2026-06-17 13:58 | 2026-06-17 16:58
鐵路事故     | Severe   | Immediate | 蘇澳新-南澳間 K115   | 2026-06-17 13:42  | 2026-06-17 17:30
火災         | Severe   | Immediate | 臺北市信義區松仁路   | 2026-06-17 16:04  | 2026-06-17 20:00
```

**Severity 4 級**（CAP 標準）：

| Severity | 中文 | 顏色建議 | 動畫 |
|---|---|---|---|
| Minor | 留意 | 黃 `#eab308` | 靜態 |
| Moderate | 警戒 | 橘 `#f97316` | 慢呼吸 4s |
| Severe | 嚴重 | 紅 `#ef4444` | 快呼吸 2s |
| Extreme | 緊急 | 深紅 `#dc2626` | 脈動 1s + 邊緣發光 |

**Urgency 3 級**（影響時序）：
- `Immediate` = 立即（已發生 / 正在發生）
- `Future` = 未來會發生（例如預告停水）
- `Past` = 已結束

**判斷 active**：`expires > now()` AND `urgency != 'Past'`

### 1.2 CWA 地震（`realtime.earthquake_events`）

**狀態**：✅ 已上線（collector: `data-collectors/collectors/earthquake.py`，1440 min cron + 即時 push）

**真實樣本**（最近 1 筆）：

```text
magnitude | depth_km | location_desc                                  | occurred_at
----------+----------+------------------------------------------------+--------------------
4.5       | 45.2     | 宜蘭縣政府南南西方 25.5 公里 (位於宜蘭縣南澳鄉) | 2026-06-14 11:15
```

**設計欄位**：`magnitude` / `depth_km` / `location_desc` / `occurred_at`

**Magnitude 分級**（無 severity，前端依 magnitude 自己分）：

| 規模 | 中文 | 顏色 | 動畫 |
|---|---|---|---|
| < 3 | 微小 | 灰 `#9ca3af` | 靜態 |
| 3–4 | 有感 | 黃 `#eab308` | 靜態 |
| 4–5 | 中等 | 橘 `#f97316` | 慢呼吸 |
| 5–6 | 強震 | 紅 `#ef4444` | 快呼吸 |
| ≥ 6 | 大震 | 深紅 `#dc2626` | 脈動 + 發光 |

### 1.3 為何不收「活動斷層」

活動斷層（Fault Zone）是純靜態地質圖資，**不會有警報、不會更新**。沿用「圖層說明」即可，不進「警訊」軌。

---

## 2. 設計需求

### 2.1 Intel Panel 改造（左側 412px panel）

整體版面（從上到下）：

```
┌─────────────────────────────────────┐
│ IntelHeader（不動）                  │
│ 即時情報 LIVE · 共 N 則 · 12:23 倒數│
├─────────────────────────────────────┤
│ 🚨 警報摘要 chip 列（常駐 1 行高）   │  ← 🆕 新元件 A
│ 地震 0  氣象 3  水文 1  交通 2      │
│ 民生 5  安全 1                       │
├─────────────────────────────────────┤
│ [ 新聞 Feed (N) ] [ 警報 Alerts (M)]│  ← 🆕 新元件 B（segmented tab）
├─────────────────────────────────────┤
│ IntelFilters                         │
│  · 新聞 tab → 既有 7 類 chips + 縣市 │
│  · 警報 tab → 6 群組 chips + 嚴重度  │
├─────────────────────────────────────┤
│ 卡片清單                              │
│  · 新聞 tab → IntelCard（既有）      │
│  · 警報 tab → AlertCard（🆕 新元件 C）│
├─────────────────────────────────────┤
│ IntelReplay（共用時間軸）            │
└─────────────────────────────────────┘
```

#### 元件 A. 警報摘要 chip 列

- 6 個 chip：地震 / 氣象 / 水文 / 交通 / 民生 / 安全（順序按嚴重度語意）
- 每個 chip 顯示：icon + 中文 + 數字（active 警報數）
- **數字 = 0** → chip 變淡灰
- **存在 Severe/Extreme** → chip 紅底 + pulse 動畫
- 點 chip → 自動切到「警報 tab」+ filter 對應 group
- 高度約 28px，橫向 scroll if overflow

#### 元件 B. 新聞 / 警報 segmented tab

- 兩個 tab，括弧數字顯示當下視窗內筆數
- 切換時：filter chip 換、卡片列表換、Replay timeline 共用（兩邊同步播放）
- 樣式參考既有 `IntelFilters.tsx` 內的 TIME_OPTS segmented

#### 元件 C. AlertCard（取代 IntelCard 在警報 tab）

每張卡：

```
┌─────────────────────────────────────┐
│ ● [群組色] 火災  [Severe]  4 分鐘前 │
│ 臺北市信義區松仁路商辦大樓 5 樓火警  │
│ ◎ 信義區松仁路 · 影響 1 區           │
│ 來源：NCDR · 倒數 3:24:00 失效       │
│ [展開] 詳細描述 + 處置指引（顯示）   │
└─────────────────────────────────────┘
```

- 標頭：群組色點 + event_term + severity badge + 相對時間
- title：headline 或從 description 取首句
- 地點：area_desc（多區用「N 鄉鎮影響」摺疊）
- footer：NCDR 來源連結 + 倒數
- expand：description + instruction（NCDR 提供的處置指引）

---

### 2.2 Monitor 戰情看板 — AlertBoard widget

**位置**：IndicatorPanel 右側 grid，**插在 LiveWall 與 Hotspots Top5 之間**：

```
[戰情概覽 PRESSURE INDEX]           ← 保留
[情勢 SITUATION BOARD（PLA + CDC）] ← 保留
[新聞直播 LIVE WALL]                ← 保留
[🚨 警報牆 ALERT BOARD]             ← 🆕 新元件 D
[熱區 TOP 5 HOTSPOTS]               ← 保留
[24H 事件直方圖 BREAKDOWN]          ← 保留
[信號分級 TRIAGE]                   ← 保留
```

#### 元件 D. AlertBoard（2×3 grid）

```
┌─ 警報牆 · ALERT BOARD ────────────────── 共 12 則 active ──┐
│                                                              │
│  ┌─ 地震 EQ ─┐  ┌─ 氣象 ⛈ ─┐  ┌─ 水文 💧 ─┐                │
│  │    0     │  │    3     │  │    1     │                  │
│  │  24h 內  │  │ 1 Severe │  │ 1 Modrat │                  │
│  │   無震   │  │ ▁▂▃▄▅▆  │  │ ▁▁▂▃▂▁  │                  │
│  │  灰靜態  │  │ 紅 pulse │  │ 橘 呼吸  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
│  ┌─ 交通 🚧 ┐  ┌─ 民生 💡 ┐  ┌─ 安全 ⚠ ─┐                  │
│  │    2     │  │    5     │  │    1     │                  │
│  │ 1 Severe │  │  5 停水  │  │ 1 火災   │                  │
│  │ ▁▁▂▁▃▂  │  │ ▁▂▃▅▄▃  │  │ ▁▁▁▂▁▃  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

每張小卡（136×96px 推薦）：
- 標頭：群組 icon + 中文 + 英文小字
- 大數字：active 警報數
- 副資訊：「N 件 Severe」或 event_term 摘要（取數量最多的）
- sparkline：過去 24h 每小時 active 警報數變化
- 點卡 → 展開 drawer：列每筆 alert（地區 / 時間 / 來源連結 / NCDR 處置指引）
- **有 Extreme/Severe → 邊框 pulse**（同 PressureRing emergency 規格）

---

### 2.3 地圖視覺重整（避免警報點與新聞點混淆）

**問題**（實測 audit）：

| 視覺類型 | 新聞 layer | Alert layer | 衝突 |
|---|---|---|---|
| 大面積 polygon | ❌ 沒有 | ✅ 雷雨 / 降雨 / 颱風 polygon | **不衝突** |
| 小圓點 | ✅ 7 類分色圓 (r≈5px) | ✅ 12+ event_term 分色圓 (r≈5px) | **🔴 衝突嚴重** |

兩邊都是「小圓 + 顏色」，且色票重疊（alert 火災 `#ef4444` ≈ 新聞事故 `#ef4444`）。

**設計需求**（請設計師決定走哪條）：

#### 選項 B1（低成本）— 大小 + 邊框差異
- Alert 點 radius ×1.6（5px → 8px）
- 白邊 2.5px（粗於新聞的 1.2px）
- 維持圓形

#### 選項 B2（中等）— B1 + active 動畫
- B1 + active 警報加 pulse 動畫（同心圓擴散）
- Severity ≥ Severe 才動，避免畫面太雜

#### 選項 B3（高品質）— icon symbol
- 改用 Mapbox symbol layer + 6 個警告 icon（地震 / 氣象 / 水文 / 交通 / 民生 / 安全）
- 警告三角底 + 內裝小 icon
- 工程量大但**最不混淆**

**推薦**：B2，符合「警報應該比新聞顯眼」的語意，工程量可控。

---

## 3. 顏色 / 動畫 spec（給工程實作）

### 3.1 群組主色（沿用 `disasterAlertTypes.ts`，但提供「群組統一色」給 AlertBoard 卡片）

| Group | 群組統一色（卡標籤用）| 既有單 type 多色 |
|---|---|---|
| earthquake | `#a855f7`（紫）| n/a |
| weatherAlerts | `#3b82f6`（藍）| 雷雨紫 / 颱風紅 等不變 |
| floodAlerts | `#0ea5e9`（青藍）| 不變 |
| transitAlerts | `#f97316`（橘）| 不變 |
| lifelineAlerts | `#facc15`（黃）| 不變 |
| safetyAlerts | `#ef4444`（紅）| 不變 |

統一色給：警報摘要 chip 底色、AlertBoard 卡片標題色、AlertCard spine dot。
單 type 色（既有）給：地圖點 / polygon、AlertCard 內展開時的細項色票。

### 3.2 Severity → 動畫 spec

```
Minor    → 靜態，無動畫
Moderate → animation: alertBreathe 4s ease-in-out infinite
Severe   → animation: alertBreathe 2s ease-in-out infinite
Extreme  → animation: alertPulse 1s ease-in-out infinite
           + box-shadow: 0 0 30px <color>/0.55 inset
```

```css
@keyframes alertBreathe { 0%,100%{opacity:1} 50%{opacity:0.62} }
@keyframes alertPulse   { 0%,100%{opacity:1} 50%{opacity:0.45} }
```

### 3.3 「無警報」空狀態（重要）

NCDR 多數時段 active 警報 = 0–5 則，要避免「6 張卡全空」看起來像系統壞掉。

- 全 0 時 AlertBoard 顯示「✓ 目前全國無 active 警報」橫排訊息（取代 grid）
- 個別卡 = 0 時：淡灰、不脈動、數字 `0` 帶 ✓ icon

---

## 4. 整體版面（Intel Panel + Monitor 同時呈現）

```
┌─ Intel Panel (412px) ──────────┐    ┌─ Monitor Mode ───────────────────────┐
│ ╭───╮ 即時情報 LIVE ·12:23倒數│    │ [Timeline Dock]                       │
│ │ 28│                          │    ├──────────────────────────────────────┤
│ │平時│                          │    │ News Feed │ Pressure Ring + TWSE    │
│ ╰───╯                          │    │ Column    │ Situation (PLA+CDC)     │
├─ 🚨 警報摘要 chip 列 ──────────┤    │           │ LIVE WALL (4 格)        │
│ 地震 0  氣象 3  水文 1  交通 2 │    │           │ 🆕 ALERT BOARD          │
│ 民生 5  安全 1                  │    │           │ ┌──┬──┬──┐              │
├─ [新聞 12] [警報 12] ──────────┤    │           │ │EQ│⛈ │💧│              │
├─ Filters ──────────────────────┤    │           │ ├──┼──┼──┤              │
├─ 卡片列表（新聞 or 警報）─────┤    │           │ │🚧│💡│⚠ │              │
│ ● 災害 火災 4 分鐘前            │    │           │ └──┴──┴──┘              │
│   信義區商辦大樓 5 樓火警        │    │           │ Hotspots Top 5          │
│   ◎ 信義區松仁路                │    │           │ 24H Histogram           │
│   倒數 3:24:00                  │    │           │ Triage                  │
│ ● 災害 降雨 7 分鐘前            │    └──────────────────────────────────────┘
│   ...                          │
├─ Replay ──────────────────────┤
└────────────────────────────────┘
```

---

## 5. 設計交付期待

請設計師交回：

1. **警報摘要 chip 列**（A）— 6 個 chip 樣式 + 0/active/severe 三態
2. **新聞/警報 segmented tab**（B）— sliding indicator + 數字 badge
3. **AlertCard**（C）— 跟 IntelCard 同層級的視覺規範
4. **Monitor AlertBoard**（D）— 6 張卡 grid + 空狀態 + 展開 drawer
5. **地圖點視覺方向**（B1 / B2 / B3 選一）— 含 active 動畫 spec
6. **6 個群組 icon**（如果走 B3）— 警告三角內裝 icon

設計確認後我們再進工程：

- 1 個 migration（`get_alert_summary()` + `get_earthquake_summary()`）
- 2 個前端 loader
- 5 個前端元件（A/B/C/D + 重新整地圖 paint）
- IntelPanel + MonitorPanel + IndicatorPanel 接線

---

## 6. 附錄：工程備忘

| 表 / 元件 | 位置 | 已就緒？ |
|---|---|---|
| `realtime.disaster_alerts` | gis-platform | ✅ |
| `realtime.earthquake_events` | gis-platform | ✅ |
| `src/data/disasterAlertTypes.ts` | mini-taiwan-pulse | ✅（SoT）|
| `src/hooks/useDisasterAlertLayer.ts` | mini-taiwan-pulse | ✅（fill + line + circle 三層）|
| `src/components/intel/IntelCard.tsx` | mini-taiwan-pulse | ✅（AlertCard 沿用結構）|
| `get_alert_summary()` RPC | gis-platform | ❌ 待建（migration 211）|
| `get_earthquake_summary()` RPC | gis-platform | ❌ 待建（migration 211）|

**估時**：設計 1-2 天 + 工程 4 hr。
