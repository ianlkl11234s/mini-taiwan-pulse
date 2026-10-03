# 監看模式改版 P4 交接（2026-10-03）

> P1–P3 已全部合併到 master（#473、#482、#486、#487、#493、#494）。本檔是接手 P4 的唯一入口；細節以連結的檔案為準。

## 1. 先讀（依序，只讀需要的段落）

1. `docs/design-system/spec.md` §5.35「監看模式卡片」——全部拍板與實作狀態；P4 看 **G2 狀態提示**、**狀態字表**、**K1 缺值修正**、窄格規則。
2. 本目錄 `README.md`——24 格總表、實作順序、資料面另案。
3. `data-quality.md`——每格來源、上游頻率、前端輪詢、過期門檻現況、缺值畫法（P4 的主要依據）。
4. `inventory-a.md` §14、`inventory-b.md` §5——**缺值畫成 0 的完整位置清單**（檔案:行號，2026-09-30 版，行號可能已漂移，以 `/usr/bin/grep` 重找）。
5. `data-time-trace.md`——資料時間要用資料本身的時間（使用者要求），各格追查結果。
6. `internet-health-reading.md`——網路觀察完整桶判斷與正常色帶。

## 2. P4 範圍（使用者拍板 G2＋K1）

### 2a. 來源新鮮度（G2）
現況：共用 `MonitorDataStatus` 只管「連不連得上」，不管「多舊」；24 格只有 5 格自己判斷過期（食品 >3 天、在監 >7 天、ISR、網路觀察、輻射站級），18 格停更也看不出來。

做法：
- 每格登記「預期更新週期」（建議放 `monitorCardMeta.ts` 或新檔 `monitorFreshness.ts`），週期依 `data-quality.md` 的上游頻率。
- 狀態字表（spec §5.35）：即時（1 週期內，只顯示時間）／延遲（>2 週期，時間變 `statusWarn`）／過期（>6 週期或日更資料 >2 天，pill「過期」＋G2 畫法）／停更（>7 天或來源下架，pill「停更 N 天」`statusErr`＋一行原因）／無資料（「—」＋原因）／收盤休市（中性 pill，不降灰）。
- G2 畫法：主數字 `MonitorMetric muted`、走勢最後一筆到現在畫斜線、卡底 `MonitorNote` 一行原因。受影響（資料本身警訊）不改卡底。
- 送到標題列：`useMonitorCardHeader({ time, timeText, state })`（`MonitorCardFrame.tsx`）。只用資料本身的時間，不用瀏覽器收到的時間。
- 已知停更／延遲（實測時要重查）：在監（上游停 2026-05-15）、機場（collector 停）、登革熱（來源下架，卡片目前直接消失）、流感／腸病毒（落後數週）、落雷 CWA 源、急診部分醫院（北市聯醫停在 08-28）。

### 2b. 缺值修正（K1）
- loader 與元件的 `?? 0`、`|| 0`、補 0、`Number(null)` 改成保留 null，交給共用元件畫缺值（折線斷線＋斜線、柱灰樁、數值「—」）。
- 重點項（影響最大）：地震規模／深度 null→0（`earthquakeLoader.ts`）、公衛 yoy 前端補 0（`intelLoaders.ts`；RPC 端 `COALESCE` 另案）、食品指數 `Number(null)`、TAIEX 高低漲跌 `?? 0`、落雷停更＝「今日尚無落雷」、機場停更顯示「入 0／出 0」、在監 null 亮綠燈、信號分級 null 歸第 0 級、警訊 series 失敗畫 24 格 0、颱風補日填 0、供電無序列傳 `[0,0]`、急診 `[0,0]`、共機 `pct ?? 0`（舊版 AxisBar）。
- **不要**把真 0 改成 null（特殊船舶 `fillDays` 補的是「當天真的沒船」，P3 已改回 0＝底線）。

### 2c. 前端 bug 與假值
- **壓力指數永遠「更新中斷」**：`intelLoaders.ts` 約 L179 讀 `row.asof`，RPC 回 `updated_at`；`per_signal` 是物件被 `asArray` 轉成空陣列。兩個都要修。`SituationOverview.tsx` 未就緒時用 50 決定卡片等級色，要改成中性。
- **熱區「熱度倍數」是合成值**：`HotspotsWidget.tsx` `1 + 則數 × 0.28`。改成真實比較（例：與過去 7 天同時段平均比）或拿掉；改成真實比較需要的資料先查 RPC 是否已有。
- **網路觀察預期探針數寫死** 79／39：loader `parseTimelineRow`（`internetHealthLoader.ts`）丟掉 `metadata.expected_probe_count`（DB 為 87／41），改由資料提供。

## 3. 已完成的共用元件（P4 直接用，不要手刻）

| 元件 | 位置 | 用途 |
|---|---|---|
| `useMonitorV2()` | `monitorStyle.ts` | 新舊版分支；**舊版畫面一律不改** |
| `fs(v2, px)`／`MF.*` | `monitorFont.ts` | 監看字級 S13（13／14／16／19／24） |
| `MonitorCardFrame`、`useMonitorCardHeader`、`MonitorCardTime` | `MonitorCardFrame.tsx` | 卡片殼與標題列時間／pill |
| `MonitorMetric`（`muted`、`tone`、`color`）、`MonitorKpis`、`MonitorSub`、`MonitorNote`、`MonitorRows` | `MonitorMetric.tsx` | 數值列、小倍數、卡底原因 |
| `TimeseriesSparkline`（`heightTier`、`gapSec`、`bare`、`band`、`extraSeries`、`moreSeries`） | `src/components/TimeseriesSparkline.tsx` | 連續量；新版缺口自動斜線＋最新點 |
| `HazardTrendBars`（`heightTier`、`bare`、`part`、`maxValue`） | `HazardTrendBars.tsx` | 計數；null＝灰樁、0＝底線 |

活的元件頁 §13（`/design-system.html#monitor`）有全部示範。

## 4. 工作方式（照前幾階段）

- worktree：`.worktrees/monitor-restyle`（從最新 `origin/master` 開新分支，例 `feat/monitor-p4-freshness`；node_modules 已 symlink；`.env`、`.env.local` 已 symlink 到主目錄）。
- dev server：`npx vite --host 127.0.0.1 --port 3750 --strictPort`（背景最多 2 小時會自動停）；**絕不 `pkill -f vite`**；不 curl vite 轉譯後的模組。
- 驗收：`npx tsc -b`；`npx vitest run src/components src/styles src/design-system src/data/__tests__`（機器忙時 `src/data` 統計測試會 5 秒逾時，加 `--testTimeout=60000`；`src/research` 有負載逾時，與監看無關）；瀏覽器 1920／1496／1280 新版＋1920 舊版（agent-browser 需 WebGL 參數，截圖給絕對路徑，見全域記憶 `agent-browser-mapbox-verify`）。
- 派工：主 agent 定位與驗收，多卡修改分 3 組平行（禁改共用檔清單寫進 prompt）；push、開 PR 可以，**merge 等使用者說**，一律一般 merge。
- 唯讀 SQL：只 SELECT、LIMIT／有界聚合、`statement_timeout=15000`；`.env` 只在 subshell source、絕不印出。注意 `get_ssot_facility_output_24h` 等 owner-gated RPC 會寫 `access_audit_log`，唯讀交易呼叫會失敗——驗證改用等價 SELECT。
- 文件：每階段結束更新 spec §5.35「實作狀態」、`docs/design-system/CHANGELOG.md`、`docs/design-system/README.md` 進度表、本目錄 README 實作順序。

## 5. 等使用者決定（P4 期間可能遇到）

- 可選的資料庫改動（要拍板）：新聞 RPC 回傳彙整時間、警報 RPC 回傳最新警報時間、災防觀測兩個頻道加進 YouTube 收集清單、公衛 yoy RPC 移除 `COALESCE(…,0)`。
- 資料面另案（需要人處理）：機場 collector（HiCloud VM）、在監上游、登革熱換源、落雷 CWA collector、急診斷段。
- P5（淡色版）、P6（四領域子指數，需 gis-platform migration）在 P4 之後。

## 6. 本輪跨 repo 紀錄（已完成）

- data-collectors #124：RIPE Atlas 抓取窗對齊 300 秒＋寫入守門；2026-10-02 19:05（台灣）起每桶 IPv4 82／IPv6 39 探針、鋸齒消失；#125 文件補「從何時起完整」與全流程（`docs/RIPE_INTERNET_HEALTH.md`）。歷史不回補。
- gis-platform #133／migration 424：`energy.taipower_region_counties`＋`power_facilities.taipower_region_override`，RPC `get_ssot_facility_output_24h` 加 `taipower_region`（已用 psql 套用正式庫）。23 座：北 3／中 13／南 4／東 0／離島 3。調查 `power-regions.md`。
