# Monitor v2 — 元件化監控儀表板規劃

> 2026-07-08 起草。基於四路調查：Monitor 前端現況、data-collectors 盤點、taipei-gis-analytics/TwinkleHub 盤點、worldmonitor 等參考專案研究。
> 前身：`docs/proposal/monitor-mode.md`（Phase 1/2，已上線）、`docs/proposal/alerts-integration-impl.md`（AI 系列）。
> Backlog 對應：MO 系列（未完成：MO-4/5/7/8/12/13/14/15/16）+ 本文件新增 MV2 系列。

---

## 0. 現況診斷（TL;DR）

1. **Monitor 沒有 panel registry** — 14 個 panel 全是 `MonitorPanel.tsx` / `IndicatorPanel.tsx` 裡硬編 JSX，加/減/排序都要改程式碼。這是「Canva 式可配置」的根本障礙，也是本次改造的核心。
2. **機場入出境卡爆大是一行 bug**（見 §1），司法矯正卡無恙但同處的底部 grid 缺高度守門。
3. **資料面最大落差**：直覺該上 Monitor 的「發展」類資料（台電供需、水庫水情、空品、急診量能），collector 程式都寫好了但 **production 多為停用狀態**——要先開回來才有資料，這是後端前置工作不是前端問題。
4. **安全主題手上的牌其實很好**：共機通報、NCDR 示警、地震、雙源颱風、落雷、核電廠輻射、AIS 船位全部在跑，大半還沒上 Monitor。
5. 參考專案共識：panel-per-domain registry + 資料源 freshness 指示 + widget 啟用才 fetch + severity 分級 + 地圖-panel 聯動。可配置佈局選型結論 = **react-grid-layout v2 + 自建 WIDGET_REGISTRY**。

---

## 1. P0 修復：機場入出境卡（MV2-0）

### Root cause
`src/components/TimeseriesSparkline.tsx:132-138` 的 `<svg>` 只設 `width="100%"`，**沒設 render 高度**；`height={70}` prop 只進 viewBox 座標系。瀏覽器依 viewBox 內在比例（256:70）用容器寬度反推高度 → 卡片越寬 sparkline 越高。機場卡佔半個面板寬、疊入境+出境兩條，Wall mode 滿版時單卡可撐到 600px+，把 `flex:1` 的新聞 feed / 指標區擠扁。

### 修法（兩處）
1. `TimeseriesSparkline.tsx:137`：`style={{ display:"block", marginTop:4, height }}` — `preserveAspectRatio="none"` 會讓內容自動拉伸填滿固定框，一行即解。
2. `MonitorPanel.tsx:711` 底部 grid（PrisonCard + AirportPaxCard）：補 `minHeight:0` + 上限守門（`maxHeight` 或改為納入右欄 scroll 區），避免任何未來卡片再把 body 擠扁。

分支：`fix/monitor-airport-card`，獨立 PR，先於 v2 改造出貨。

---

## 2. 資料整合矩陣

圖例：狀態 ✅=collector 在跑、🟡=程式已寫但 production 停用（重啟即有資料）、🔵=需新建/復活；Monitor 欄 ●=已上、○=未上。

### 2a. 台灣的安全

| 資料 | 來源 / 表 | 頻率 | 狀態 | Monitor | 備註 |
|---|---|---|---|---|---|
| 共機/共艦擾台 | `pla_activity_daily`（國防部） | 日報（30min 輪詢） | ✅ | ● SituationCards | 可升級：ADIZ 分區視覺 + 歷史 trend（參考 Taiwan_ADIZ_alerts） |
| 災防示警 CAP | `ncdr_alerts` → `disaster_alerts` | 15min | ✅ | ● AlertBoard | NCDR 是跨機關統一入口（CWA/水利/農村/核安），王牌 |
| 地震 | `earthquake`（CWA，事件驅動）+ USGS 全球 | 事件 | ✅ | ○（MO-5 partial） | 獨立地震卡：最新有感 + 24h 序列 |
| 颱風 | JMA + JTWC 雙源 → `typhoon_positions` | 3–6h | ✅ | ○ | 有颱風才顯示的 conditional widget |
| 落雷 | `lightning_events`（台電） | 1min | ✅ | ○ | 分鐘級，適合即時計數 + 地圖聯動 |
| 核電廠周邊輻射 | `nuclear_radiation`（51 站） | 15min | ✅ | ○ | 安全主題差異化強項；核安會+台電雙源交叉驗證可後補 |
| 船舶 AIS | `ship_positions`（航港局，HiCloud） | 10min | ✅ | ○（地圖有 layer） | Monitor 可做「海域船舶計數/異常」摘要卡 |
| 治安（A1 死亡事故） | `npa_traffic_accident_a1` | 12h | ✅ | ○ | 日級摘要卡；一般刑案無即時源 |
| 司法矯正 | `correctional_daily_snapshot` | 日 | ✅ | ● PrisonCard | 顯示 OK，補 trend sparkline 可選 |
| 機場入出境 | `immigration_apis_airport`（HiCloud） | 60min | ✅ | ● AirportPaxCard | §1 修復後保留 |
| 疾病監測 | `cdc_public_health_weekly` | 週 | ✅ | ● SituationCards | — |
| 空域限航區 geofence | sentinel `det:geofence-flight-rcr`（RCR 29 區） | 15min 設計 | 🔵 runner 未實作 | ○ | anomaly 分級結果可直接成為「安全告警」widget；依賴航班資料復活 |
| 軍偵衛星過境 | `satellite_passes_daily` | 日 | 🔵（依賴 `satellite` 停用） | ○ | 復活需 Space-Track TLE 重啟 |
| 空域航班 | FR24 / OpenSky 三源 | 5min | 🔵 全停用 | ○ | geofence 與空域 widget 的前置 |
| 假訊息 | Cofacts（MO-7） | — | 🔵 | ○ | P3 |

### 2b. 台灣的發展

| 資料 | 來源 / 表 | 頻率 | 狀態 | Monitor | 備註 |
|---|---|---|---|---|---|
| 供電/備轉容量 | `get_power_dashboard` + `get_ssot_facility_output_24h` | 5–10min | ⚠️ 驗證 | ● PowerCard | 前端已有卡且有資料；data-collectors 的 `power_taipower` 標停用 → 資料實際來源待驗證（疑走 energy v2 管線），見 §5 |
| 水庫水情/放流 | `reservoir_status`（WRA） | 60min | ⚠️ 驗證 | ○ | data-collectors 標停用 vs water_tic 標 🟢 生產中，衝突待驗證 |
| 水庫即時發電 | 台電機組發電（水力機組）+ 水庫放流 | 10min | 🟡 | ○ | 用戶點名項；依賴台電機組級資料，隨供電資料驗證一併確認 |
| 河川水位 / 雨量站 / 地下水 | `river_water_level` 等 4 路 | 10–60min | ⚠️ 驗證 | ○ | 同水庫，兩邊盤點矛盾 |
| 水情燈號（抗旱） | `wra_drought_alert` | 日 | 🟡 | ○ | 低成本、語意強（綠黃橙紅） |
| 台股加權 | `twse_market_index` | 1min | ✅ | ● ticker | MO-14 格式化待修 |
| 匯率 | 央行（MO-16） | — | 🔵 | ○ | P3 |
| 交通壅塞 | `freeway_vd` + `road_congestion` | 5–10min | ✅ | ○（地圖有 layer） | Monitor 摘要卡：國道壅塞路段數 / 平均車速 |
| 鐵道/公車即時 | `tra_train`、`bus` | 2min | ✅ | ○（地圖有 layer） | 誤點/停駛摘要可後補 |
| 台北治水三支 | `wic_sewer`/`wic_evacuate`/`wic_pumb` | 10min | ✅ | ○ | 汛期 conditional widget（抽水站運轉 + 疏散門） |
| 空氣品質 | `air_quality` 三支（MOENV） | 5–60min | 🟡 | ○ | 重啟需 production env key |
| 急診量能 | `er_hospital_realtime`（59 家） | 15min | 🟡 | ○ | 安全×發展交界，價值高 |
| 垃圾車 GPS | `waste_positions` | 2min | ✅ | ○（地圖有） | Monitor 價值低，不排 |

### 2c. TwinkleHub / master_catalog 的角色

TwinkleHub（MCP，data.gov.tw 53k+ dataset 鏡像）與 master_catalog.sqlite（76,528 筆，`llm_actually_realtime=1` 共 487 筆）**是候選盤點工具，不是即時資料源**——任何候選仍要走 collector → gis-platform → Supabase 既有管線。已篩出的真即時候選（充電樁槍位、高鐵剩位、路邊停車格位、台水產水、CEMS 燃燒塔、QPESUMS 雷達…）列為 Phase 3 之後的擴充池，不進本輪。

⚠️ TwinkleHub 的 `geo_has_latlon`/`join_keys` 旗標是規則層推測，接入前必須 `get_dataset(sample_rows)` 驗證實際欄位。

---

## 3. Widget 化架構（Canva 式可配置）

### 3.1 核心決策

| 決策 | 選擇 | 理由 |
|---|---|---|
| 佈局引擎 | **react-grid-layout v2** | React 原生 + TS 重寫 + hooks、拖拉/resize/RWD breakpoint 內建、layout 天生可序列化 JSON。不自建（碰撞/斷點/序列化/無障礙都是坑）；Dockview/Gridstack 對磁磚儀表板過重 |
| Widget 定義 | **自建 `WIDGET_REGISTRY`** | 抄 worldmonitor 的 panel-per-domain 心智模型，與本專案 `layerCatalog.ts`/`overlayRegistry.ts` 的 registry 慣例同構 |
| 版面持久化 | localStorage 先行 → Supabase `user_monitor_layouts`（會員） | 與 member-features-plan 銜接；未登入也能用 |
| 資料抓取 | 集中 polling manager，**widget mount 才訂閱** | 抄 OSIRIS：on-demand fetch + 防重複 + 同源共享（兩個 widget 用同一 RPC 只打一次）；page hidden 暫停 |
| 新鮮度 | 每個 widget 顯示資料時戳 + staleness badge | 抄 worldmonitor Freshness monitor；擴充既有 `get_source_health` + `upstreamRegistry.ts`；對我們「collector 有的在跑有的停用」現況特別重要 |

### 3.2 Registry 介面（草案）

```ts
// src/components/intel/monitor/widgetRegistry.ts
interface MonitorWidget {
  id: string;                       // 'pla-activity' | 'power' | 'airport-pax' ...
  title: string;
  group: '總覽' | '安全' | '發展' | '新聞' | '直播';
  component: React.ComponentType<WidgetProps>;
  defaultSize: { w: number; h: number };   // RGL grid units
  minSize: { w: number; h: number };
  dataDeps: string[];               // RPC / loader key，polling manager 據此排程與共享
  pollMs: number;
  conditional?: () => boolean;      // 颱風卡、汛期治水卡等「有事才出現」
}
```

現有 14 個 panel 全數包成 widget 進 registry；新 widget 只加一筆 + 一個元件檔。

### 3.3 佈局與 preset

- **View mode**（預設）：鎖定，按已存版面渲染。
- **Edit mode**：右上「編輯版面」→ 拖拉/resize/從 widget 目錄抽屜增刪 → 存檔。
- **Preset 三套起手**：`預設`（≈現行排列）、`安全`（共機/示警/地震/颱風/輻射/船艦/新聞-災害濾器）、`發展`（供電/水情/股匯/交通/空品）。Preset 本身就是一份 layout JSON，使用者可從 preset 出發再改。
- Wall mode 沿用，各 preset 各有 wall 變體。

### 3.4 與地圖的聯動（保留差異化）

參考專案的共識亮點是「點 panel ↔ 地圖聚焦」。既有 newsEvents 已做 feed↔地圖聯動；v2 規範：**每個有空間性的 widget 宣告 `mapAction`**（點卡片 → 開對應 layer + flyTo），例如落雷卡 → 落雷 layer、船舶卡 → ship layer、共機卡 → ADIZ 分區示意。這是我們勝過所有單點靜態站的地方。

---

## 4. 分階段 Roadmap

| Phase | 內容 | 規模 | 產出分支 |
|---|---|---|---|
| **0 Hotfix** | §1 機場卡 sparkline 高度 + 底部 grid 守門 | 0.5d | `fix/monitor-airport-card` |
| **1 Registry 化** | `widgetRegistry.ts` + 現有 14 panel 包裝成 widget；polling 集中到 manager（去除 AirportPaxCard 自抓等散點）；每 widget 加 freshness badge。**佈局暫不動**（仍固定），純內部重構 | 1–2d | `feat/monitor-widget-registry` |
| **2 可配置佈局** | 引入 react-grid-layout v2 + edit mode + 三套 preset + localStorage 持久化；會員 Supabase 存檔留接口 | 2–3d | `feat/monitor-grid-layout` |
| **3 資料擴充（快贏先行）** | Tier ✅ 新 widget：地震卡（收 MO-5）、颱風卡、落雷卡、輻射卡、船舶摘要、交通壅塞、A1 治安、台北治水（conditional）。每張 ≈0.5d，可分批 | 各 0.5d | `feat/monitor-widgets-*` |
| **4 停用 collector 重啟** | §5 驗證後，Zeabur 開回 `power_taipower` / 水資源 4 路 / `wra_drought_alert` / `air_quality` / `er_hospital_realtime` → 對應 widget（含用戶點名的**水庫即時發電**）。屬 data-collectors + gis-platform 工作，走跨 repo 順序（上游先動） | 依驗證結果 | upstream handoff 先開 |
| **5 進階** | sentinel detector runner → 安全告警 widget；FR24/衛星過境復活；MO-7 Cofacts、MO-8 Radar、MO-12 Supabase Realtime push、MO-14 格式、MO-16 匯率 | 另估 | — |

Phase 1、2 是純前端且互相獨立於資料擴充，可先出貨；Phase 3 的每張卡都是 registry 加一筆的增量工作，順序可依用戶喜好調。

---

## 5. 待驗證項（Phase 4 前置，各一條 SQL 即可）

兩路盤點出現矛盾，規劃 Phase 4 前先對 DB 驗最新寫入時間：

1. **供電資料真實來源**：`realtime.power_*` 三表 vs energy v2 管線 — PowerCard 有資料但 `power_taipower` 標停用，確認誰在餵。
2. **水資源 4 路**：`reservoir_status` / `river_water_level` / `rain_gauge_readings` / `groundwater_level_readings` 最新 timestamp — data-collectors 標停用 vs water_tic 標生產中。
3. **flight_positions**：sentinel sources.yaml 稱生產中 vs collectors 標 2026-05 停跑 — 若已斷流，空域類 widget 全部後移。

另有文件債（不擋路，順手記）：`docs/EXTERNAL_COLLECTORS.md` HiCloud 清單漏列 `immigration_apis_airport`；BACKLOG 的 AI-1 實際已大半落地未銷帳。

---

## 6. 拍板結果（2026-07-08 用戶已確認）

1. **佈局引擎：react-grid-layout v2** ✅ 採用。
2. **版面存檔：會員限定（Supabase）** — 未登入只能用 preset，不做 localStorage 自訂版面；`user_monitor_layouts` migration 併入 member-features 波次。過夜任務只起草 SQL、不 apply production。
3. **Phase 4 首波：四組全查**（台電 / 水資源水庫+燈號 / 空品 / 急診）— 用戶預期 DB 其實都有資料在進，§5 驗證改為第一優先：若資料活著就直接做 widget、免重啟；確認斷流者才列入重啟清單。
4. **Phase 3 順序：建議順序**（地震 → 颱風 → 輻射 → 落雷 → 交通壅塞 → 船舶/A1/治水）。

## 7. 過夜自動執行

執行手冊見 `docs/proposal/monitor-v2-overnight-runbook.md`（02:00 排程啟動，主 agent 分派 Opus/Sonnet 子任務並驗收，產出夜間報告）。
