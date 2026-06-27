# Mini Taiwan Pulse → 台灣版 World Monitor 願景與提案

> 研究日期：2026-06-15 ｜ 對標：[koala73/worldmonitor](https://github.com/koala73/worldmonitor)
>
> 本文記錄一次「我現有的圖層之上能長出什麼產品」的探索：worldmonitor 的拆解、現有能力盤點、以及四組提案（情報面板 / 跨流關聯 / UX 升級 / 產品方向）。
>
> 相關既有文件：[`monitor-mode.md`](./monitor-mode.md)、[`intel-panel-status.md`](../intel-panel-status.md)、[`alerts-integration-impl.md`](./alerts-integration-impl.md)、[`satellite-console.md`](./satellite-console.md)

---

## 0. 一句話結論

**我缺的不是資料，是「情報層」。**

對標下來：worldmonitor 56 個圖層，我有 122 個；水文資料（USWG 積水 / 抽水站 / 疏散門 / 下水道）深度遠超它。worldmonitor 真正的價值不在圖層數，而在它把 raw signal 變成 insight 的三件事：

1. **指數化** — 把多訊號聚成單一分數（國家不穩定指數 CII、金融壓力指數）
2. **AI 簡報** — 500+ feed 聚類去重後合成「現在世界發生什麼事」
3. **跨流關聯** — CorrelationEngine 偵測軍事 + 經濟 + 災害訊號在同一區域收斂

我現在是「台灣圖層百科」（使用者要自己開圖層、自己解讀）；worldmonitor 是「打開就告訴你哪裡有事」。**這就是要補的東西。**

---

## 1. World Monitor 拆解

### 1.1 定位
開源即時全球情報儀表板（OSINT hub）。把 500+ 新聞 feed、65+ 外部 API 匯入單一畫面，用 AI 合成簡報、做跨訊號關聯。AGPL-3.0、單一 codebase 出 6 個變體站 + Tauri 桌面版 + PWA + MCP server + 開放 API。

### 1.2 UI 呈現
**Dashboard 風 + map-central 混合**：中央地圖（3D 地球 ↔ 平面，行動裝置降級 SVG），四周是 GridStack 拖拉式 panel 網格（60+ panel，可收合、重排、依訂閱層級 gating）。Dark theme、資訊密度極高。

關鍵 UI 機制：
- **Cmd+K command palette** — 搜 panel / 圖層 / 8 個地圖 preset view / layer preset（Military / Finance / Infrastructure / Intel / All / None / Minimal）/ 指令式查詢（`fly LON DXB`）
- **來源管理 modal** — 逐 feed 開關、localStorage 持久化
- **活動追蹤** — 新項目 NEW 標籤 2 分鐘、glow 30 秒、panel badge 未讀數、IntersectionObserver 判已讀
- **分享連結** — URL 帶 lat/lon/zoom/time/view/layers 還原視圖
- **手機版** — <768px 改 40vh 小地圖 + 單欄堆疊 panel
- **Snapshot 系統** — 每次刷新自動快照、留 7 天可回放（IndexedDB）

### 1.3 模組 × 資料來源 × 呈現

**地圖圖層（56 種）**
| 模組 | 來源 | 呈現 |
|---|---|---|
| 衝突/熱點/制裁/抗議 | ACLED、GDELT、UCDP、LiveUAMap | 點 + 嚴重度分級，只畫高嚴重度防雜訊 |
| 軍事基地/核設施/輻射源/APT/太空發射場 | 自建靜態庫 + IAEA | POI + 40+ popup 型別 |
| 航班（含軍機） | Wingbits ADS-B、OpenSky 備援 | 即時點位 |
| 船舶 AIS + 62 戰略港 + 海峽咽喉 | AIS WebSocket、IMF PortWatch | 即時船位 + chokepoint |
| 海底電纜/油氣管線/AI 資料中心 | Submarine Cable Map、NGA、Epoch AI | 線/點 + 級聯依賴 |
| 天災 | USGS、NASA EONET、GDACS、FIRMS、NWS | 事件點 |
| 衛星軌道 | CelesTrak TLE + SGP4 | 80–120 顆即時軌跡 + 地面足跡 |

**Panel（60+）**
| 類別 | 代表 | 來源 |
|---|---|---|
| AI 情報 | Latest Brief、AI Forecasts、WM Analyst（聊天）、Threat Timeline、Country Brief | LLM 合成 |
| 指數 | **CII**（31 國不穩定指數 + 24h delta）、Resilience Index、Financial Stress | 多訊號伺服器端計分 |
| 新聞 | 區域 panel、Telegram Intel（56 頻道 60s 輪詢）、OREF 防空警報 | 435–500+ RSS、GDELT |
| 金融 | Watchlist、Sector Heatmap、Fear & Greed、Polymarket 預測市場 | Yahoo/Finnhub/FRED/ECB |
| 專題 | Aviation Intel、Hormuz Tracker、Disease Outbreaks、Radiation Watch | 各專屬 API |
| 工具 | My Monitors（自訂關鍵字警報）、Live TV、Webcams | — |

### 1.4 智慧功能
1. **AI 新聞簡報** — 500+ feed → Jaccard 聚類去重 → 摘要；4 層 LLM fallback（Ollama → Groq → OpenRouter → 瀏覽器內 T5），無 key 也能跑
2. **CorrelationEngine** — 跨流訊號關聯、兵力集結模式偵測
3. **指數類** — CII v8（server-authoritative）、DEFCON 式態勢估計
4. **ThreatDetection** — 瀏覽器內 ML（Web Worker + Transformers.js）做威脅分類、實體抽取
5. **Scenario Engine**（PRO）— disruption 情境模擬
6. **注意力呈現** — NEW/glow/badge、>5% 預測市場變動標記、35 來源群健康度監測

### 1.5 技術架構
- 前端：Vanilla TypeScript（**無 UI 框架**）+ Vite；globe.gl/Three.js + deck.gl/MapLibre 雙引擎；GridStack
- Edge 層：60+ Vercel Edge Functions（RSS proxy、API key 隔離、快取）
- Relay 層：Railway Node.js（AIS WebSocket、Telegram 輪詢）
- 快取：3 層（memory → IndexedDB → Edge/CDN）+ Upstash Redis
- 桌面：Tauri 2（Rust）+ 本地 Ollama

---

## 2. 現有能力盤點（Mini Taiwan Pulse）

**總計**：122 圖層 key ｜ 17 section ｜ 95 可展開層 ｜ 80+ Feature Info Panel ｜ 2 模式（realtime / historical）｜ 50+ loader

### 2.1 Section 概覽
| Section | 內容重點 | 即時性 |
|---|---|---|
| MOVING | 航班 / 船舶 / 鐵道 / 市區公車 / 公路客運 | 即時 GPS + 回放 |
| STATION | 高鐵/台鐵/捷運/公車/客運站 + YouBike 有車率 | 多靜態 + YouBike 即時 |
| ROUTE | 國道/省道/自行車道 + CCTV(內嵌影像) + ETC 門架 + 服務區 | 靜態 + CCTV 即時 |
| INFRA | 港口/機場/燈塔/海纜/登陸站 | 靜態 |
| ANALYTICS | 人流/人口/社經/空間經濟（H3 網格 Res.7–10） | 歷史年度 |
| MONITOR | 國道壅塞（5 級 timeline）+ 即時路況事件 | 即時 RPC |
| ENVIRON | 氣象站/風電/溫度波(3D)/衛星雲圖/雷達/AQI 柵格+測站/LASS 微感測 | 多即時 + 影像 timeline |
| FACILITY | 學校 / 超商（PMTiles） | 靜態 |
| HAZARD | 活動斷層 / 地震(timeline) / NCDR 災害示警 | 地震+警報即時 |
| FIRE & RESCUE | 火災(歷史/最新) / 消防分隊(3D) / 消防栓 / 救援等時圈 | 多靜態 |
| MEDICAL | 醫院/診所/藥局/AED/長照 + 醫療等時圈 + 醫療沙漠 | 靜態 |
| NEWS | 即時新聞點位（ripple 動畫 + cumulative timeline + 分類上色 + GIS 相關性篩選） | 即時管線 20min/輪 |
| WATER | 流域/河川/堤防/水庫/淹水潛勢/即時雨量/河川水位/地下水/**USWG 雙北積水 1999 站**/北市下水道·疏散門·抽水站/降雨柵格 | 大量即時 |
| AGRICULTURE | 農田/土壤/肥力/休閒農業/作物適栽(132 種)/農企業/農路 | 靜態 |
| FORESTRY | 林班/保安林/森林遊樂/林道/步道(7339 條)/阿里山鐵路 | 靜態 |
| WASTE | 垃圾車 GPS(高雄即時)+表定/焚化爐·掩埋場·轉運(3D)/各類回收設施 | 高雄即時 + 表定 |
| SPACE | 衛星（遙感/吉林/高分/中國其他/台灣）即時 SGP4 軌跡 + 足跡 | 即時 2h TLE 同步 |

### 2.2 既有互動能力
- **Timeline** — Replay（日期 ±1、1/3/7 天視窗、30x–3600x、seek）+ Live（RAF 60Hz）+ 影像 timeline（雲圖/雷達/雨量）
- **圖層控制** — 122 獨立 toggle、95 可展開面板
- **3D 參數** — size / opacity / altitude / ring slider（Three.js 層）
- **著色模式** — 壅塞 5 級、AQI 五指標切換、公車 路線/速度/密度
- **Popup** — 80+ layerType panel、CCTV 內嵌影像、水庫 context（自動拉集水區/流域/河川）
- **相機預設** — 12 地點（全台 + 6 城市 + 5 機場），含自動播放 + 圖層預設
- **響應式** — 桌機 IconRail / 手機 LayerSidebar + BottomSheet

### 2.3 已在進行中（docs 裡發現的相關工作）
> ⚠️ 寫這份文件時發現 `docs/` 已有 `monitor-mode.md`、`intel-panel-status.md`、`alerts-integration-*.md` — 表示「監控模式 / 情報面板 / 警報整合」可能已部分啟動。**回來接這份提案前先讀那幾份，避免重工。**

---

## 3. 提案 A：情報面板層（worldmonitor 化核心）

保持 map-first，**不要**做成整面 panel grid（那是 worldmonitor 的弱點，資訊過載）。建議右側加一條可收合情報欄，放 3 個 panel：

### A1. 「台灣現在」事件流 Event Feed ⭐ 最建議先做
把現有即時訊號全部彙進一條 feed：
- NCDR 災害示警、地震、TDX 道路事件、新聞（**都已有**）
- 國道壅塞突變（等級跳 ≥2 級）
- USWG 積水超門檻、抽水站警戒、河川水位破警戒線
- AQI 紅色站點出現

每筆附時間 / 地點 / 嚴重度，**點擊飛到該處並自動開對應圖層**。這就是 worldmonitor 的 NEW/glow/badge 注意力機制。差異化：我的 timeline 架構天生支援「回放某事件當下全島狀態」——它做不到。

### A2. 縣市脈動指數 Taiwan Pulse Index
仿 CII 模式，每縣市算 0–100 即時分數（現有 RPC 加權）：交通壅塞 + 雨量/水位警戒 + AQI + 災害事件數 + 地震。呈現：側欄 22 縣市色條排行 + 24h delta（↑↓），地圖可選配 choropleth。實作 = 一個 pg_cron 每 10 分鐘算一次（pre-aggregate pattern 已熟）。

### A3. AI 即時簡報 Taiwan Brief
每 30 分鐘把 event feed + 指數變化丟 LLM 產一段「過去 N 小時台灣概況」。worldmonitor 用 4 層 fallback，我可以簡單：一個 edge function 打 Claude Haiku，成本極低。

---

## 4. 提案 B：跨流關聯（差異化武器）

worldmonitor 的 CorrelationEngine 最聰明，而**我的資料密度做這件事更有利**——訊號都在同一個小島、同一套 H3 網格上：

- **豪雨情境鏈**：雷達回波強 → 該區雨量站破值 → USWG 積水 → 下水道水位 → 抽水站啟動 → 道路事件。這條因果鏈 5 個環節的資料**全都有**，自動偵測「鏈條點亮」就是一個 storyline。
- **地震情境鏈**：地震 → 鐵路延誤/路況事件/斷層帶 → 醫療資源圈。

偵測到收斂時，event feed 升級成「情境卡」，一鍵套用該情境的圖層組合。**沒有任何台灣網站做到，是真正的護城河。**

---

## 5. 提案 C：UX 升級（低成本，直接抄好東西）

| 功能 | 說明 | 成本 |
|---|---|---|
| **Layer Presets（主題模式）** | 「颱風」「通勤」「防災」「登山」一鍵套圖層組 + 相機。直接解掉「122 圖層新用戶不知開什麼」 | 低，純前端 |
| **Cmd+K command palette** | 搜圖層、跳城市、套 preset。sidebar 已到捲動極限 | 低 |
| **Share link** | URL 帶 lat/lon/zoom/time/layers，還原視圖。也是傳播管道 | 低 |
| **手機版精選** | 小地圖 + event feed 單欄。防災場景多在手機 | 中 |

→ **Presets 放第一個做**：一天內完成，立刻讓 122 圖層的價值被看見。

---

## 6. 提案 D：產品應用方向

1. **颱風/豪雨作戰室** ⭐ 最強一張牌。水資源組合（USWG 1999 站 + 北市抽水站/疏散門/下水道 + 河川水位 + 雷達 + CAP + 淹水潛勢）颱風天就是全台最完整即時水情站。做 `/typhoon` 專屬模式，颱風來自然有流量（worldmonitor 靠 Hormuz tracker 這種專題帶流量）。
2. **通勤脈動**：上下班國道 + 公車 + 鐵道 + YouBike 有車率，做「今日通勤簡報」自動推播。
3. **生活風險底圖**：斷層 + 淹水潛勢 + 火災歷史 + 醫療沙漠 + 救援等時圈，輸入地址出「這個地點的風險與資源報告」——買房/租屋族的清晰使用情境，可能是商業化入口。
4. **嵌入式 widget / API**：仿它的 MCP server，把 event feed 與 pulse index 開成 API，讓媒體、社區網站嵌入。

---

## 7. 建議起手順序

| # | 項目 | 為何這個順序 | 是否需新資料 |
|---|---|---|---|
| 1 | **Layer Presets + 相機綁定** | 1–2 天，馬上有感 | 否 |
| 2 | **Event Feed 右側欄** | 資料都有，純前端彙整 + 一個彙總 RPC | 否 |
| 3 | **Pulse Index** | 一個 pre-aggregate cron + 排行 panel | 否 |
| 4 | **AI Brief** | 站在 2、3 之上加 LLM 摘要層 | 否 |
| 5 | **颱風模式專題** | 等 1–4 就緒，颱風季前上線 | 否 |

每一步都站在前一步上，前三步完全不需新資料源。

---

## 8. 回來時的下一步

- [ ] 先讀 `docs/monitor-mode.md` + `docs/intel-panel-status.md` + `docs/proposal/alerts-integration-impl.md`，盤點「情報面板 / 警報」已做到哪
- [ ] 決定提案 A1（Event Feed）vs C（Presets）哪個先做 → 出一份含檔案觸點 + RPC 設計 + UI 草圖的實作規劃
- [ ] 評估 Pulse Index 的加權公式（哪些 RPC、各佔權重）
