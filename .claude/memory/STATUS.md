# Status

**最後更新**：2026-06-18（Design System Phase 0-6 上線、PR #22 已 merge 進 master）
**分支**：`master`，head 在 `38de940`（PR #22 merge commit）。工作區乾淨、與 origin/master 同步。

## 2026-06-18 Design System Phase 0-6 上線（PR #22，8 commits）

**背景**：從用戶問「該不該有設計系統？」起，盤點 60+ 元件、1200+ inline 散落值
（panel bg 4 種寫法 / borderRadius 12 種 / fontSize 16 種 / 白色 alpha 20 階 / monospace 直寫 80 次等），
建立 `src/styles/designTokens.ts` SSOT + `docs/design-system.md` 規範文件，
分 6 phase 逐項收斂、每 phase 獨立 commit 可單獨 revert。

**核心決策**：**不引入 CSS 框架**（Tailwind / CSS Modules / styled-components），
維持 inline `style={{}}` + token import。**不抽通用元件庫**（業務元件深耦合 Mapbox / timeStore）。

| Phase | Commit | 內容 |
|---|---|---|
| 0 | `d9aaf28` | `designTokens.ts` + `design-system.md` 規範（純新增） |
| 1 | `1cb6f9b` | 8 檔 panel bg + shadow → SURFACE / ELEVATION |
| 2 | `86391f4` | 16 檔 / 83 處 `monospace` → `FONT_DATA` |
| 3 | `cc744e1` | 22 檔 / 165 處 text color → `COLORS.text*` |
| 4 | `7ee817b` | 57 檔 / ~935 處 borderRadius + fontSize → scale |
| 5 | `c6a4e7e` | 警示語意色對齊 LAYER_COLORS（earthquake / flood） |
| 6 | `22c8d64` | CloseButton × → `<X>` + LoadingScreen → SURFACE.app |
| docs | `9c810b2` | §9 新元件 checklist + §6 標 phase commit hash |

新檔：`src/styles/designTokens.ts` / `docs/design-system.md`。
詳細 PB-19 6-phase 流程 / Phase 1 codex 抓 10 處 over-replacement 見 INCIDENTS 2026-06-18 /
反省見 REFLECTIONS。

PR #22 已 merge（merge commit `38de940`），feat/design-tokens-phase-0 分支已自動刪除。

### Phase 5 trade-off（已用戶接受）

- earthquake: `#d946ef` → `#ff3b30`（對齊 LAYER_COLORS.earthquakes）
- flood: `#2dd4bf` → `#ef4444`（對齊 LAYER_COLORS.floodSensor）
- flood (#ef4444) 與 safety (#fb7185) 視覺較接近，警示卡若同時亮起需靠 icon / label 區分
- 不滿意可 `git revert c6a4e7e` 單獨還原

### 未抽 token 範圍（DS-1~7，BACKLOG，刻意延後）

「沒有真實痛點就不抽 token」原則：
- DS-1 Z_INDEX scale / DS-2 transition / DS-3 互動狀態色 + CONTROL.* /
  DS-4 Breakpoint / DS-5 Control sizing / DS-6 intelTokens 退役 / DS-7 LayerSidebar 亮側

### 下個 session 入口

```
1. 看實際使用 1-2 週，若 DS-1~7 任一出現真實痛點 → 進 BACKLOG 優先級調整
2. 新元件 / 重構元件直接照 docs/design-system.md §9 checklist 抄
3. 若要做下一個大主題：Monitor Phase 2 還有 G011/G012 perf 題、或 AI-1 警訊整合（impl doc 已備）
```

---

## 過往里程碑

### 2026-06-18 Monitor / News 效能優化（PR #21 merged，6 commits）

**背景**：PR #18 Monitor Phase 2 + 新聞圖層上線後使用者回報「網頁變慢」。
Explore 全面盤點 9 條根因 → 5 step 重構（不改 UI / 不改 props 對外契約）。

| Commit | 主題 |
|---|---|
| `584b950` | Step 1: intelLoaders / alertsLoader 包 `cachedOnce` / `keyedThunkCache`（TTL 25s/55s/5min） |
| `61d4376` | Step 2: `timeStore.wallClock` 命名空間 + `useWallClock` hook；MonitorPanel 1Hz → 5s tick |
| `62cc3ee` | Step 3: TimelineDock 自訂 1Hz wallClock；playback `setInterval(70ms)` → rAF + 200ms throttle |
| `212313d` | Step 4: 新 `useInView` hook；LiveSlot×4 + HazardSlot×2 iframe IO gate；移除 `key={src}` |
| `8724f35` | Step 5: LiveWall + HazardWatchStrip 加 `React.memo` |
| `06105c0` | **hotfix**: useWallClock 無限 re-render → 改 useState+subscribe |

新檔：`src/hooks/useWallClock.ts` / `src/hooks/useInView.ts`。
詳細 PB-18 / 陷阱見 INCIDENTS 2026-06-18 / 反省見 REFLECTIONS。

### 跳過項（保守 → BACKLOG）

- **G011 (P2)** Wall mode 暫停地圖 engine — 需動 `src/engines/` + `src/three/`、視覺凍結需 PM 確認
- **G012 (P3)** alertSeries24h 改增量抓 — 需動 gis-platform RPC

### 2026-06-17 三 PR 合進 master（Monitor Phase 2 + YT B1 + 警訊 handoff）

| PR | 主題 | merge commit |
|---|---|---|
| #18 | Monitor Mode Phase 2 — 戰情看板 + 新聞直播牆 | `4d005c1` |
| #19 | 警訊整合 handoff（設計需求 + 實作交接）| `4412255` |
| —  | CLAUDE.md 加 Karpathy 4 條前言（直 commit master）| `5d47257` |

### Monitor Mode Phase 2（PR #18，共 10 元件 + 5 loader）

新檔（`src/components/intel/monitor/`）：
- `MonitorPanel.tsx` — 底部上拉容器，拖拉 ns-resize 30-92%、Wall mode 全螢幕、退出
- `TimelineDock.tsx` — 全寬 24h 直方圖 + 拖拉 scrubber + 播放 / LIVE 切換
- `IndicatorPanel.tsx` — 右 60% grid，組 6 個 widget
- `PressureRing.tsx` — 270° gauge + TwseTicker + CompareLine + Sparkline + Widget/SectionLabel
- `SituationOverview.tsx` — 環 + 雙比較 + KPI + ticker + 10 軌 signal 抽屜
- `SituationCards.tsx` — PLA 卡 + 3 CDC 疾病卡（含 sparkline）
- `LiveWall.tsx` — 4 格 YouTube + 14 家頻道下拉
- 順手把右上 3D Altitude button 換成 Monitor toggle（`src/App.tsx`）

`src/data/intelLoaders.ts` 加 5 loader：`fetchPressureIndex` / `fetchSignalsTimeline` / `fetchMarketIndex` / `fetchPlaActivity` / `fetchPublicHealthWeekly`。

### YT 直播 B1 解析三 repo 串通（同日衍生）

**動機**：LiveWall 跳「無法播放這部影片」。診斷後發現 YouTube `embed/live_stream?channel=UCxxx` 在多數新聞台找不到 primary live event。

**B1 方案**（三 repo 同步）：
- **data-collectors** `e7d2d80` — `collectors/yt_live_video_resolver.py` 5 min cron 抓 14 家 `@handle/live` page → 解析 `ytInitialPlayerResponse` JSON 拿當前 videoId
- **gis-platform** migration 209 — `realtime.yt_live_current` (PK=handle) + `realtime.yt_live_history` + `get_yt_live_videos()` RPC
- **mini-taiwan-pulse** — LiveWall 改用 `embed/<videoId>` 而非 channel ID，加 fetchLiveVideos loader

**13 家當下狀態**（移除中天）：9 家可播 / 2 家拿到 videoId 但非 24h 直播（年代 / 中央社）/ 2 家 @handle 待補（鏡新聞 / 非凡）。

### Monitor 卡空白 hotfix（同日，migration 210）

實測發現戰情卡 / TWSE / PLA / CDC 全空。根因：前端 loader 用了 3 個不存在的 RPC（migration 207 只建了 pressure 那支）。

`gis-platform` migration 210 補建 3 個薄 RPC：
- `get_market_index_now()` → 取 t00.tw 最新 + 漲跌算好
- `get_pla_activity_latest()` → 最新 report_date
- `get_public_health_weekly()` → 最新 ISO 週 3 疾病 sum + 4 週 sparkline + YoY

實測：TWSE 45,809.19 +412.20 (+0.91%) / CDC W23 / PLA 0 架次 6 海軍艦。詳見 INCIDENTS 「Monitor 卡片全空白」。

### Zeabur 部署

- `gis-data-collectors` service 啟 `YT_LIVE_VIDEO_RESOLVER_ENABLED=true`，cron 5min
- migration 209/210 已套用 Supabase（gis-platform）

### 警訊整合 handoff（PR #19，純文件無程式）

兩份 docs/proposal/ 文件：
- `alerts-integration-handoff.md` — 設計需求（給設計師）
- `alerts-integration-impl.md` — 實作交接（給另一 session）

含 migration 211 三 RPC signature / 5 元件 Props + 對應設計 jsx 行號 / 12 顆 task list / verification walkthrough / 不在範圍清單。**設計師 v2 設計檔已收到（URL 在 doc 第一段）**，下個 session 拉設計 bundle + 看 impl doc 就能開工。

預計 4-5 hr。

---

## 過往里程碑（保留索引）

### 2026-06-13 衛星 SPACE 圖層上線（PR #10，10 個 commit）

從零做到上線、含 Phase A-D 完整提案，分階段拆 commits：

| Commit | 內容 |
|---|---|
| `1060e05` | 初版：3 toggle（CN mil/obs + TW）+ 雙圈足跡 + 軌跡 + 即時點 |
| `3fb4d4b` | **CelesTrak 403** → 改走 gis-platform Supabase `satellite_classified` view |
| `4275d6f` | 補 FS-8A NORAD 66666 + TRITON 58017 |
| `96e73be` | **中國分流 4 群**：Yaogan 101 / Jilin 36 / Gaofen 30 / 中國其他 ~184 |
| `652f576` | 拿掉 Satellite icon + 全球模式 |
| `8e8163a` | **修閃爍**：殭屍 throttle closure + listener 洩漏 |
| `d821908`/`4985397` | **perf 拆 light/heavy**：點+足跡 10 Hz、軌跡 1 Hz |
| `0196c86` | 拿掉 (S) 字樣 + 全部預設關 |
| `18429d3` | 提案文件 `docs/proposal/satellite-console.md` 上 commit |

**5 個 layer keys**：satellitesYaogan / Jilin / Gaofen / ChinaOther / Taiwan。
**Phase A-D 待辦在 BACKLOG SAT-1~7**。

## 2026-06-13 新聞 v2（PR #11，用戶並行完成）

3 階段全套上線：
- A. 分類上色（`b50f6ba`）：7 類分色 + 圖例 + popup 中文
- B. 同鄉鎮聚合（`295ca15` + migration 163）：clustered RPC + 點放大 + 數字 + 多則 popup
- v2. GIS 相關性 + Filter（`292b884` + migration 164/165 + collector `9fc0c60`）

## 2026-06-12 newsEvents 自動化即時管線（三 repo）

- **data-collectors `209bde8`**：`collectors/news_events.py` — RSS ×29 → URL 正規化 + simhash 去重 → Gemini Flash-Lite 地名抽取 → `realtime.news_events`，20 min/輪
- **gis-platform `e7d18c2`**：migration 162 — 表 + geom trigger + daily pre-agg + cron + `get_news_events_day` / `get_news_event_dates` RPC
- **本 repo `7909b25`**：`newsEventsLoader.ts` + `useNewsEventsLayer.ts` + `OverlayConfig.dynamicData`

## 2026-06-08 hikingTrails 全台步道 layer（FORESTRY 區段）

新增單一靜態 layer `hikingTrails`，整合 6 來源、按 `source` 屬性上色。共 **7,339 條**（去重後），20 MB GeoJSON。

## ⭐ 當前狀態：已正式上線（自 2026-06-02）

- **線上網址**：`https://mini-taiwan-pulse.itsmigu.com`（+ `mini-taiwan-pulse.zeabur.app`），前面有 **Cloudflare**。
- **Zeabur service**：`service-69a3b5f307e6de1869be6e2c`，git-connected → push master 自動 build + 部署。
- **資料流**：Supabase RPC（動態）+ 靜態檔（小檔 git→dist / 大檔 S3 `deploy-assets/`→entrypoint pull→`/data` volume→nginx）。
- **上線稽核全文**：`docs/launch/` 8 份。

## ⚠️ 上線後待辦（見 BACKLOG）

- **D3（P1）資安收斂**：收窄 Supabase Exposed schemas
- **LA-5（P2）**：deploy-assets 扁平→鏡像結構
- **LA-7（P2）**：帳務觀察
- **LA-6（P3）**：評估關閉 pulse-api service 省錢

## 先前進度（2026-05 前，保留摘要）

- 5/26 消防救援等時圈（PMTiles + 全國聚合 + 屏東 geocode；PB-16）
- 5/25 農企業登記 3 layer（overlayRegistry，AG-6 已於上線一併部署）
- 5/23 農業 Phase 3 Batch 1（6 layer + 132 作物 dropdown + UX 四鐵則）
- 5/8~14 廢棄物 OSRM map-matching + 22 城 schedule（89.6% coverage）
- 4 月 水資源 Phase 1/2 + iot_wra + 河川/地下水 delta 著色
