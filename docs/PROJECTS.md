# 專案追蹤總表

> 用途：做到一半的專案放這裡，有空時從這裡撿回來。一列一專案，只放指標，不重抄細節。
> 最後盤點：2026-11-08（依 CHANGELOG、各 repo git log／PR 與正式站 main-*.js 核對；正式站實測 `main-DfDBf1o6.js`＝2.26.1，master 最後合併 #878；develop 另有愛爾蘭第 2–10 波、南韓統計、歷史底圖 6 層等未發版）。

與其他文件的分工：

- **BACKLOG**（[`.claude/memory/BACKLOG.md`](../.claude/memory/BACKLOG.md)）＝單一待辦任務（有 ID、blocker、第一步）。
- **roadmap Gxx**（`../.gis-agent-system/roadmap/`）＝資料／圖層候選與發版佇列。
- **`.gis-agent-system/projects/`**＝跨 repo 計畫書。
- **本檔**＝專案層總覽，回答「有哪些專案做到一半、卡在哪」。

狀態圖例：🟢 已上線待收尾｜🟡 進行中｜⏸️ 暫停｜🔵 待拍板｜⚪ 構想／研究完成未動工

## 現在最該注意

1. **正式站 v2.26.1（Cloudflare）**：2026-11-06 起由 Cloudflare Worker（網頁＋R2 圖層）＋新主機 pulse-host（`/api`、gateway、collector）提供。標「正式站待驗收」的專案都可以直接到正式站目視。
2. **Zeabur 搬遷已全部完成，剩收尾（BACKLOG ZB-1）**：collector 已搬到 pulse-host（使用者 2026-11-08 確認；gis-data-collectors #170／#171 11-07 合併、#175–#180 新主機調整）。剩：依序停 Zeabur 舊服務（12/1 前）、SEC-6 換金鑰、flight-arc-sharing 網址、清寫死的 zeabur.app 網址（含 OSRM 腳本）。
3. **develop 未發版的一大批（發版要使用者拍板，IEREL-1）**：愛爾蘭統計＋第 2–10 波＋Coillte（#877、#884–#895）、南韓火災／交通事故統計（#874）、歷史底圖 6 層（#882）、framingCheck（#881）、30 天地圖挑戰總覽頁與 Day 3–7 文章（#873、#883）。另有 10 層未登記 pulse-data registry（REG-2）。
4. **資料保留期限 mig 505–509 排 2026-11-08 晚上套用**；mig 510（drop 20 張冷存表）要另外拍板。
5. **選舉投票日 11-28 前**活動地圖要持續每日更新（electionEvents2026；analytics #304 為 11-07 每日更新，仍 open）。
6. **資料新鮮度**：11/2 VM 首次自動產更新清單是否成功仍未確認（`update_list.py --pull`）。
7. **有遺失風險的本機成果**：Monitor 可拖曳版面兩個本機分支無 upstream（G015）；analytics `feat/transit-access-cities`（三市可及性＋cloud_run）仍只在本機（TA-1）；新聞／GDELT POC draft PR 去留（CL-3）。
8. **等使用者回覆**：愛爾蘭發版（IEREL-1）與 Coillte 站主目視（IECOI-1）；Google OAuth 品牌驗證審查結果。

## 情報與新聞

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 新聞地點證據 shadow 面板（POC） | 🔵 | 三 repo draft：mini #427、gp #128（migration 須重編號）、collectors #117 | CL-3：決定保留或關閉 | BACKLOG CL-3 | 2026-10-03 |
| 國際媒體台灣情資 feed（GDELT，POC） | 🔵 | draft：mini #426、gp #127、collectors #116 | 同 CL-3 | BACKLOG CL-3 | 2026-10-03 |
| Live wall 影片失效自動切換 | 🔵 | YouTube「無法播放」格子會卡住 | LW-1：先審 onError 切換設計 | BACKLOG LW-1 | 2026-10-16 |
| Monitor 可拖曳版面 | 🔵 | 本機分支 feat/monitor-grid-layout（+15）、feat/monitor-widgets-batch1（+11）無 upstream | G015：先 bundle 或 push 備份，再決定留或關 | BACKLOG G015 | 2026-10-16 |
| 國內新聞圖層維運 | 🟢 | 2026-06 已上線 | NEWS-1：collector 已搬到 pulse-host（Linode 東京 IP），改在新主機驗自由時報 RSS 是否可抓（CelesTrak 已擋該 IP，有同樣風險） | [`features/news/backlog.md`](./features/news/backlog.md) | 2026-11-08 |
| 衛星主控台改版收尾（#533） | 🟢 | 已合 develop（10-04），之後已隨某版上 master | 正式站目視暗／淡主題與手機版 | [`features/satellite-console-restyle/README.md`](./features/satellite-console-restyle/README.md) | 2026-10-16 |
| 情報牆（mini-taiwan-intel） | ⏸️ | 資安稽核 C1 完成（mig 477、站主登入才可寫） | W30 計畫 §3、§6 待拍板項待確認；W2：「否決關聯」改標 rejected | `../.gis-agent-system/projects/2026-W30-intel-wall/` | 2026-10-17 |
| Monitor 四域子指數／壓力指數重建 | ⏸️ | 規格 §5.35 I2 已有，無觸發 | MON-P6：決定重啟後先寫公開權重與基期提案 | BACKLOG MON-P6 | 2026-10-16 |
| 衛星主控台歷史模式機動清單 | ⏸️ | 2026-10-04 擱置 | SAT-Z3：解除擱置後先過三項核准 | BACKLOG SAT-Z3 | 2026-10-16 |
| Intel 面板三個計數不一致 | ⚪ | 已定位：標頭只算新聞、「全部」含警報、AlertSummaryBar 沒套 RANGE | IN-1：統一計數口徑後修 | BACKLOG IN-1 | 2026-10-16 |
| Monitor 小項（警報序列增量、PowerCard 空狀態、TRA 格座標、匯率卡、聊天釘選） | ⚪ | 只有定位，未動工 | G025、OG-5、TD-3、MO-6（ready）；AR-44 待決定留或丟 | BACKLOG 同 ID；[`features/owner-gated-layers/backlog.md`](./features/owner-gated-layers/backlog.md) | 2026-10-16 |

## 選舉

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 選舉圖層第二批（投開票所中性著色＋熱區、2026 議員選區、歷屆選舉統計） | 🟢 | mini #807／#811／#816 隨 v2.22.0 發布（2026-11-04）；gp #197 mig 496／498 已套用（journal 2026-11-04 12:50） | 正式站（v2.26.1）驗收 | CHANGELOG v2.22.0；gp PR #197；analytics `pulse-layers-contract.md` | 2026-11-04 |
| 2026 地方選舉活動地圖（electionEvents2026） | 🟢 | 站主限定圖層隨 v2.21.0 上線（mini #802、analytics #274、gp #194 mig 493/494）；每日資料由使用者叫跑 run_daily.sh；站主限定名單 2026-11-06 起統一呈現（#836，mig 500） | 投票日 11-28 前每日更新；GUI-2 站主登入目視；要開放只改 gated_layers 一列（待決定） | `../taipei-gis-analytics/docs/topic-research/election_events_2026/`；BACKLOG GUI-2 | 2026-11-06 |

## 會員與權限

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| Google OAuth 品牌驗證 | 🔵 | 10-23～24 以「發現的問題有誤」送人工審查 | 等 Google 回覆；被退再考慮 Supabase 自訂網域（付費） | 個人記憶 ctx-handoff（OAuth 段） | 2026-10-24 |
| 主站 CSP 改 enforcing | 🔵 | 主站仍 Report-Only，/privacy 已 enforcing | BC-4b：補 gsi.go.jp、jma.go.jp 等 allowlist，收集違規後再切 | BACKLOG BC-4b | 2026-10-23 |
| 會員區 v1（Google 登入、配額） | 🟢 | 前端 #220、gp #98（mig 408）已上；v2.12.0 可自行刪帳號 | 正式站真實 Google 登入／多裝置驗收；BC-2 收藏＋chat_logs 未動工 | [`features/member-area/`](./features/member-area/) | 2026-10-23 |
| 站主限定圖層機制（owner-gated） | ⏸️ | 機制已上；UI 鎖類型尚無實際圖層 | OG-3：有第一個 ui 鎖圖層時驗完整鏈 | [`features/owner-gated-layers/backlog.md`](./features/owner-gated-layers/backlog.md) | 2026-10-16 |

## AI 與分析

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| BYOK 對話預設模型 | 🔵 | — | BC-3：決定預設是否改中階檔 | [`features/byok-chat/backlog.md`](./features/byok-chat/backlog.md) | 2026-10-16 |
| Agent 分析能力（ADR-0022 A→B→C） | 🟡 | A（空間統計）10-21、B 10-23 上線；多國議題 2 P0–P5 10-29 上線 | C（區位配置 p-median）未動工；4 題待拍板（鄰接表預算等）；MC-6、MC-8 | ADR-0022；`../.gis-agent-system/roadmap/status/ai-mcp.md`（人工核對停在 10-18） | 2026-10-29 |
| 分析倉庫收尾小項 | ⚪ | — | AG-2、AG-11、RV27-2（layer-status 差約 159 層）、TWL-4（MCP 標籤改名）、JMA 入倉延後；MCP #27 土壤液化題庫 draft 落後 main | BACKLOG 同 ID；mini-pulse-gis-mcp #27 | 2026-10-29 |

## 資料新鮮度與自動更新（含 collector）

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 資料來源追蹤一條龍（ADR-0018／0024） | 🟡 | pulse-data #45：606 筆偵測清單，`_detect/changes/` 開始累積；週一 03:00 routine＋VM 04:30 | Phase 2 等 2–4 週數據；61 筆 draft 欄位待補；確認 11/2 VM 首次自動跑；collector run receipt 未做 | `../.gis-agent-system/decisions/0024-source-tracking-and-change-log.md` | 2026-10-29 |
| 靜態資產版本化（R2 layers/v1） | 🟢 | 讀取端 mini #700 隨 v2.14.0 上線；試點 immigration_offices、dui_crash_points v1 | 正式站瀏覽器驗收；批 2 起遷移（DESIGN §4） | `../.gis-agent-system/projects/2026-10-static-asset-versioning/` | 2026-10-25 |
| 移民署金門／連江座標錯 | ⏸️ | 上游資料兩點座標是台北 | 等上游修正後發 v2（可當首次真實更新） | 個人記憶 ctx-handoff | 2026-10-25 |
| 閃電快照遺失／縣市彙總 | ⏸️ | DS-01 blocked、DS-04 ready | DS-04：先查正式庫有沒有縣市面表 | BACKLOG DS-01／DS-04 | 2026-10-05 |
| A1 事故 feed | ⏸️ | 上游凍結在 2026-06 | 等上游恢復 | BACKLOG DS-02 | 2026-10-05 |
| 交通 feed 假健康 | ⏸️ | blocked | 見 BL-25 | BACKLOG BL-25 | 2026-10-05 |
| 靜態 LST 更新 | ⚪ | 已過 10-01 門檻，可做 | 重跑 LST pipeline | BACKLOG MC-5 | 2026-10-05 |

## 多國圖層

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 日本後續 | 🔵 | P1 第 1–4 波隨 v2.15.0 上線（10-28 正式站已驗）；第二輪自然公園、国立公園、鳥獣保護区、DID 隨 v2.24.0（#831）；交通事故 2025（287,020 點，#843）、DID z5 改善（#842）隨 v2.25.0；正式站 2026-11-07 實測 v2.25.1，第二輪與交通事故瀏覽器驗收未做 | JPRD-2 收費道路樣式（等決定）；JPW4-1 等填 WAM NET 表單；JPRD-1 原等搬家，主站已於 11-06 改走 R2（等使用者決定）；交通事故未入倉、2019–2024 未做；N3-4 新舊層並存（已決） | BACKLOG JPRD-1／JPRD-2／JPW4-1／N3-2／N3-4；`../taipei-gis-analytics/docs/topic-research/japan_opendata/_status.md` | 2026-11-06 |
| 英國後續 | 🔵 | 第 0–12 波隨 v2.18.0 上線（#765）；英格蘭污染排放申報場址（站主限定）隨 v2.24.0（#834，gp mig 499），座標修正 2,544 處隨 v2.25.0（#839，gp mig 501 已套用）；正式站 v2.25.1 | UKD-1 待拍板項；UKOSM-1 OSM 五層卡 Overpass 封鎖（換網路重跑 07_export.py）；UKLZ-1 等決定，UKLZ-2／3 可直接做；EA-1 授權 2027-10-29 到期 | BACKLOG UKD-1／UKOSM-1／UKLZ-1~3／EA-1；`../taipei-gis-analytics/…/united_kingdom_opendata/waves/PLAN.md` §3 | 2026-11-06 |
| 愛爾蘭 | 🔵 | 第 0、1 波隨 v2.26.0 上線（#868、#870）；統計（#877，gp mig 511）、第 2–10 波（#884–#894）、Coillte 國有林站主限定（#895，gp mig 512 owner-only RPC）已合 develop、未發版；mig 511／512 已套用正式 DB，統計已發布 R2；MCP #98 已補 IE | IEREL-1 發版（待使用者拍板）；IECOI-1 站主目視 Coillte；IEW-11 第 11、12 波（搬遷已完成，可重評）；IEADD-1、IEWH-1 | BACKLOG IEREL-1／IECOI-1／IEW-11／IEADD-1／IEWH-1；`../taipei-gis-analytics/docs/topic-research/ireland_opendata/waves/PLAN.md` §5–6 | 2026-11-08 |
| 加拿大第 0–3 波＋統計 | 🟢 | 第 0–2 波＋統計隨 v2.22.0（#812、#813）、第 3 波 7 層（氣象站、AQHI、輻射、NPRI、污水、地震、人口網格）隨 v2.24.0（#832）、即時地震 `caEarthquakesLive`（#847）隨 v2.25.0；地震四類分色（#864）隨 v2.26.0 上線；gp mig 497 依 analytics PLAN §4 步驟 2 紀錄 11-04 已套用（未另查 DB）；正式站 v2.26.1，瀏覽器驗收（PLAN §4 步驟 7）未做 | 正式站驗收；第 2 波建物、C002 海域 HOLD；LODE 補座標前端未接；RV-F068、RV-CA-DERIVED | CHANGELOG v2.22.0／v2.24.0／v2.25.0；analytics `canada_opendata/waves/PLAN.md` §4–5 | 2026-11-07 |
| 南韓後續 | 🟡 | 第 0–5 波＋統計隨 v2.19.0；第 6 波 5 層隨 v2.24.0（#830）；第 7 波 6 層隨 v2.26.0（#869）；火災與交通事故統計 16 層（#874）已合 develop、DB 與 R2 已發布、未發版；墓地維持 OSM（N3-1 已決） | KRW-6 第 8–10 波；KRSTAT-1 補每萬人比率（0 件被標成無資料）；第 11 波等 data.go.kr key；KRH-1 兩層 HOLD；KRI18N-1；第 6、7 波正式站驗收 | BACKLOG KRW-6／KRSTAT-1／KRH-1／KRI18N-1 | 2026-11-08 |
| 多國化議題 1 收尾 | 🟢 | 國家主體化隨 v2.16.0 上線 | MC-3 補目視；MC-1 主題識別名與顯示名拆開（有同名主題時再做） | BACKLOG MC-1／MC-3 | 2026-10-28 |
| 多國化議題 2 收尾（MCP 跨國） | 🟢 | P0–P5 於 2026-10-29 全部上線；countries.json 2026-11-07 補 KR／CA／IE、修北愛範圍框（MCP #98 已部署） | MC-6 補 name_en；MC-7 拆 airspace／coral 表；MC-8 觀察 eval 不穩點 | BACKLOG MC-6~8；`../.gis-agent-system/projects/2026-10-multi-country/PLAN-topic2-mcp.md` §5 | 2026-11-07 |
| 法國 | ⚪ | 國家選單已有 FR（v2.16.0），圖層只有「通訊」主題的 ANFR 無線站點（`anfrWirelessSites`）；MCP 缺邊界與人口，回「未涵蓋」；analytics 沒有 `france_opendata`，無波次計畫（2026-11-07 查） | 最低門檻：countries 一筆＋admin1 邊界＋人口分母 | `../pulse-data/docs/new-country-onboarding.md` §4 | 2026-11-07 查 |

## 台灣圖層（roadmap 群組）

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 主題分類統一（TWL-12） | 🔵 | 6 題等使用者決定 | 逐題拍板（兩套統計分類、陸域保護區、測試層等） | BACKLOG TWL-12；`../.gis-agent-system/roadmap/scout/2026-10-31-tw-gap/routeC_theme_allocation.md` | 2026-10-31 |
| 舊檔去留（public/fishery） | 🔵 | — | TWL-2 列 6 個檔請使用者選 | BACKLOG TWL-2 | 2026-10-29 |
| G10／G16／G20／G23（金融、國營事業、健康行為、文化幣） | 🟡 | roadmap status 皆 in_progress（G10 存放款、刷卡已上線；G20 含 B235） | 照各群「下一步」接續 | `../.gis-agent-system/roadmap/candidates/G10`、`G16`、`G20`、`G23` | 未查證 |
| G27 臺北市局處公務統計 | 🟡 | 部分隨 v2.13.0 上線 | BLOG-V 目視；PDF 獨有表 | candidates/G27；BACKLOG BLOG-V | 2026-10-24 |
| G32 熱島與高溫曝露 | 🟡 | queued；涼適點、熱傷害排進 TWL-5 第二批 | TWL-5 災害暴露組（使用者說晚點再處理） | candidates/G32；BACKLOG TWL-5 | 2026-10-29 |
| G33 海洋保育補接 | 🟡 | 海保署 5 個海上保護區檔已在 public/，沒有圖層接 | 接海域保護區範圍圖層 | candidates/G33 | 2026-10-29 |
| G29 淹水即時與情境（含多情境） | 🟢 | 方向 A：10 情境切換（#737）已上線 | TWL-5 雨水下水道；TWL-7 縣市×情境統計層；TWL-6 即時降雨 collector（搬遷已完成，可排） | candidates/G29；BACKLOG TWL-5／6／7 | 2026-10-29 |
| G34 治安與交通執法 | 🟢 | 測速照相換新版（#736） | TWL-5 各縣市科技執法；TWL-3 popup 舊 bug | candidates/G34；BACKLOG TWL-3／5 | 2026-10-29 |
| G35–G37 第二輪補強 | 🟢 | TWL-8／9／10 隨 v2.19.0 上線 | TWL-15 接續（正式站消防栓 PMTiles 仍舊版等）；frontmatter 改 live | BACKLOG TWL-15 | 2026-11-01 |
| 土壤液化（站主限定） | 🟢 | #407、#408 上線（09-29） | 正式站目視；MCP 題庫 PR #27 還開著 | [`features/soil-liquefaction/handoff.md`](./features/soil-liquefaction/handoff.md)；mini-pulse-gis-mcp #27 | 2026-09-29 |
| 古地圖（臺灣百年歷史地圖） | 🟡 | 2026-11-06 改公開隨 v2.26.0 上線（gp mig 503 已刪 gated_layers 列）；2026-11-07 #882 合 develop（未發版）：WMTS 86 張接 85 張，拆成歷史底圖 6 層（古地圖、戰後地形圖、航照衛星、界線路網、土地利用、主題圖），來源中研院 GIS 專題中心 CC BY-NC | 發版前先寫信向中研院確認授權（HIST-1）；發版後正式站驗收六層；HIST-3 研究成果搬進 git、HIST-4 Day 6 重拍與貼文、HIST-5 water1944 後續；REG-2 補登 registry；主站 CSP enforcing 時補 gis.sinica.edu.tw | BACKLOG HIST-1；PR #882；`src/data/historicalMapSinica.ts` | 2026-11-07 |
| 30 天地圖挑戰（#30DayMapChallenge） | 🟡 | Day 4 群聚四層（#821）、Day 5 海景兩層隨 v2.23.0；Day 6 復古四層隨 v2.26.0 公開；Day 7 成果在獨立站 mapchallenge-mrt.itsmigu.com；部落格總覽頁與 Day 3–5 文章（#873）、Day 6–7 文章（#883）已合 develop、未發版 | 隨下次發版上線文章；HIST-4 Day 6 正式站重拍；之後挑戰日放同主題 | CHANGELOG v2.23.0／v2.26.0；`src/blog/mapChallenge.ts` | 2026-11-08 |
| G30 災情、避難與民防 | ⚪ | 研究完成；避難容量衍生層排在 TWL-5 | B 部分需 collector（TWL-6）；搬遷已完成，可排 | candidates/G30 | 2026-11-08 |
| G38 全國都市計畫區邊界 | ⏸️ | 授權不明 | TWL-13：寄信問國土署／國土測繪中心 | BACKLOG TWL-13 | 2026-10-31 |
| G31 飲用水源與污染 | ⚪ | queued | 照 G31「下一步」 | candidates/G31 | 未查證 |
| 次優先候選（TWL-14）＋ researched 群 | ⚪ | researched：G01／03／05／06／07／09／11–15／18／21／22／24–26；TWL-14 是多縣市拼接清單 | 有空時挑一群排批次 | candidates/_index.md；BACKLOG TWL-14 | 2026-10-31 |

## 模擬實驗

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 國道逐車模擬（G39） | 🟡 | mini #814 隨 v2.22.0 發布（2026-11-06 隨 v2.25.1 上正式站）；MCP #95 已於 2026-11-04 部署；資料 R2 `sim/v1/freeway_tdcs/20261103-1` | 跟車減速 wip 5f692772（在 taipei-gis-analytics，已隨 #286 合進 master）暫停中；正式站待驗收 | `../taipei-gis-analytics/docs/topic-research/freeway_tdcs/_status.md`；[`features/freeway-tdcs-sim/handoff.md`](./features/freeway-tdcs-sim/handoff.md)；roadmap G39 | 2026-11-04 |
| 情境推演／數位雙生（G28） | 🟡 | P1 靜態鏈已合 analytics #225，主站沒接 | P2 八仙回測：先補雙北以外醫院、校正座標 | candidates/G28；`../taipei-gis-analytics/docs/topic-research/digital_twin/REPORT.md` | 2026-10-26 |
| 雙北大眾運輸可及性（含臺中、臺南、高雄） | 🟡 | 雙北 mini #810 隨 v2.25.1 上正式站；臺中／臺南／高雄（含國道客運上下車限制）11-04 算完，只在 analytics 本機分支 `feat/transit-access-cities`；雙北重算 P1 完成、P2／P3 未跑 | 正式站待驗收；TA-1 push＋PR（待核准）→ TA-3 三市上網站形式；TA-2 雙北雲端重算（待使用者說跑） | `../taipei-gis-analytics/docs/topic-research/transit_access/_status.md`；BACKLOG TA-1～TA-6 | 2026-11-06 |
| 全台交通可及性 | 🟢 | v2.20.0 上線（#801），使用者確認效果 OK | 兩層同開時點擊只跳網格 popup（已知問題）；色階細分、雙北尺度方向未選 | `../taipei-gis-analytics/docs/topic-research/transit_reach/_status.md` | 2026-11-02 |
| 公車擁擠模擬 | 🟢 | #701 隨 v2.14.0 上線（站主限定） | 站主帳號目視驗收 | `../taipei-gis-analytics/docs/topic-research/bus_crowding/` | 2026-10-25 |

## 專題研究

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 橋梁韌性 | 🟡 | 全臺 v5 上線；雙北 73 座，其中 47 座待複核 | 複核 47 座；本機 dev 設 BRIDGE_RESILIENCE_PRIVATE_ROOT 指向備份 | `../taipei-gis-analytics/pipelines/analysis/bridge_resilience/README.md` §0 | 2026-10-24 |
| GIS 圖台 plugin（gis-map-kit） | 🟡 | 課程版、公開版皆已發布 | 處理 inventory/_OPEN_QUESTIONS.md 未決項 | `../gis-map-kit/` | 2026-10-31 |
| CCTV×YOLO 機車微調 | ⏸️ | 10-02 資料全失，10-07 重建 worktree；r2 標註批次已備好 | 繼續收集與標註（E 鍵標緊急車輛） | 個人記憶 cctv-finetune-status-ref | 2026-10-17 |
| CCTV 鏡頭朝向 | ⏸️ | 判完 537／4,697 支 | 等 Codex 額度接續（Claude 模型驗證不過，不可投票）；兩個分支未 push | analytics worktree `cctv-url-fix-20261002` 的 `cctv_heading/STATUS.md` | 2026-10-17 |
| OSINT 研究體系擴充 | ⚪ | 研究結論只在記憶裡 | 等決定是否做；建議先做以統一編號為核心的法人實體表（FtM 格式） | 個人記憶 ctx-handoff（2026-10-30） | 2026-10-30 |

## 內容與推廣

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| SEO／AEO 實質內容頁 | 🔵 | GPTBot／ClaudeBot 被 403，與 robots.txt 允許矛盾 | SEO-6 等 SEO-5 收錄兩週結果；使用者裁定 Cloudflare AI Crawl Control | BACKLOG SEO-6 | 2026-10-29 |
| Pulse 筆記 /blog | ⏸️ | v2.13.0 上線；使用者說先觀察效應，暫停寫新文 | 一般長文暫停（BLOG-1 改 conditional：Flight Arc 不寫）；只照 30 天地圖挑戰產文；BLOG-V 目視與 Search Console | [`features/blog/article-plan.md`](./features/blog/article-plan.md)；BACKLOG BLOG-1／BLOG-V | 2026-10-24 |
| mini-taiwan-stories | ⏸️ | 08-23 開 repo，第一篇台鐵 | 後續進度未查證；內容重心已轉到 /blog | 個人記憶 mini-taiwan-stories-status-ref | 2026-08-23 |

## 平台與維運

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 資料保留期限（Supabase／R2／collector 最長 6 個月） | 🔵 | 使用者 2026-11-07 拍板各表天數；gp #208 mig 505–509 排 2026-11-08 晚上套用；20 張沒人讀的表已冷存到 S3 `supabase-export/` | 套用 mig 505–509；mig 510（drop 冷存表）待使用者拍板 | gis-platform PR #208；個人記憶 data-placement-policy | 2026-11-07 |
| 資安稽核後續 | 🔵 | 10-17 稽核、多項 migration 已套 | SEC-6 改 ready（搬遷收尾一起換）；SEC-7 改在 pulse-host compose 設 `PULSE_RESEARCH_TRUSTED_PROXY_IPS` 後合 gp #170；SEC-3／4／5／8、SEC-9 見 BACKLOG | `../gis-platform/docs/research/2026-10-17-security-audit.md`；BACKLOG SEC-3~9 | 2026-10-17 |
| Zeabur 停止營運搬遷 | 🟡 | **搬遷全部完成**：靜態站 10-29；主站、research-gateway、Valhalla 11-06（Cloudflare Worker＋Linode pulse-host）；collector 已搬到 pulse-host（使用者 2026-11-08 確認；collectors #170／#171／#175–#180），correctional 移 HiCloud VM（#174，上游停更已暫停）；OSRM 不搬 | **收尾 ZB-1（12/1 前）**：依序停 Zeabur 舊服務（主站與 gateway 目前留作回滾）、SEC-6 換金鑰、flight-arc-sharing 網址待決、清 zeabur.app 寫死網址、Worker routes 寫進 wrangler.jsonc；搬遷 README §0 仍寫 collector 未搬，待同步 | BACKLOG ZB-1；`../.gis-agent-system/projects/2026-10-zeabur-migration/README.md` §0；`SETUP-INVENTORY.md` | 2026-11-08 |
| Supabase Disk IO 複量 | 🟡 | 第三輪 mig 451–460 於 10-16 套用 | 原定約 10-23 用 pg_stat_io 取差值，未查證有沒有做；中間若重啟，基準作廢 | `../gis-platform/docs/research/2026-10-16-disk-io-round3.md` | 2026-10-16 |
| AWS 雲端運算工具 cloud_run | 🟡 | analytics `tools/cloud_run/`＋skill `cloud-run`（個人 AWS 帳號 ap-southeast-2，報價→開機→取回→自動刪機）；11-06 實機 smoke 兩項通過、合計約 US$0.19；只在本機分支未 push | 隨 TA-1 一起 PR；TA-4 測 Spot 中斷接續；TA-5 S3 測試檔去留 | analytics `tools/cloud_run/README.md`；BACKLOG TA-1／TA-4／TA-5 | 2026-11-06 |
| 地圖圖層改版 R6 | 🟢 | 段 1–3 隨 v2.8.0 上線 | R6-V 正式站目視；段 4（船、公車、垃圾車、漁船）R6-4 暫不碰 | [`features/map-layer-restyle/R6-PROPOSAL.md`](./features/map-layer-restyle/R6-PROPOSAL.md)；BACKLOG R6-V／R6-4 | 2026-10-15 |
| 地圖基礎 GIS 元件（指北針、量測、右鍵） | 🟢 | #803／#804 隨 v2.21.0；#808 隨 v2.22.0 發布（2026-11-06 隨 v2.25.1 上正式站） | GUI-2：手機實機觸控、真實定位、實體雙擊 | BACKLOG GUI-2 | 2026-11-04 |
| 地圖可見性整修 | 🟢 | v2.19.0 上線；#795 隨 v2.20.0 | VIS-3 剩餘目視項目 | BACKLOG VIS-3；[`design-system/map-layers.md`](./design-system/map-layers.md) §3.8 | 2026-11-01 |
| 多語系 i18n | 🟢 | P0–P5 隨 v2.9.0 上線 | P4-C（Agent 依網頁語言回答）、I18N-1（統計「資料限制」段仍中文）、KRI18N-1 | [`features/i18n/ROADMAP.md`](./features/i18n/ROADMAP.md) | 2026-10-31 |

## 其他／衍生專案

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| Flight Arc（plan-art） | ⏸️ | FR24 Top-1000 抓到 28.6% | 見 plan-art memory 的 11 步流程 | 個人記憶 flight-arc-campaign-pointer；`../plan-art/` | 2026-08-09 |

## 發現的不一致（待清理）

- ~~BACKLOG **PRIV-1**~~：已關閉（2026-11-06）。
- ~~BACKLOG **BLOG-1** 寫下一篇是 C1 Flight Arc~~：2026-11-08 已改寫成 conditional（Flight Arc 不寫、一般長文暫停）。
- roadmap **G35–G37** candidates frontmatter 仍寫 in_progress，但 TWL-8／9／10 已隨 v2.19.0 上線，應改 live。
- `roadmap/status/ai-mcp.md` 人工核對停在 10-18，倉庫最新版本以 pulse-data registry 為準。
- 土壤液化 MCP 題庫 PR（mini-pulse-gis-mcp #27）還是 draft 且落後 main。
- 新聞／GDELT POC 的 draft PR（mini #426–#428、gp #126–#128、collectors #116–#121）掛了一個多月未處理（CL-3）。
- `robots.txt`／`llms.txt` 寫明允許 GPTBot、ClaudeBot，實測卻回 403，與 /blog 的 AEO 目的衝突。
- R6 在兩份盤點分別被標為 🟢 與 ⏸️；本表依段 1–3 已上線、只剩目視，標 🟢。

## 怎麼維護

- 專案完成或狀態改變時，改該列的狀態與「最後進展」；新專案加一列。
- 收尾（wrap-up）時順手更新本檔。
- 結案的列從表中移到檔尾「已結案」，一行帶過。
- 每列「正本」要能找到：repo 內用相對連結，跨 repo 用 `../<repo>/…` 文字路徑；BACKLOG 項寫 ID。
- 各節內依狀態排序：🔵 → 🟡 → 🟢 → ⏸️ → ⚪。
- 只放指標與一兩句現況，細節留在正本。

## 已結案

回顧影片 v5.4（2026-10-05 發布封存）、隱私說明頁（v2.12.0）、多國議題 2 主體（2026-10-29）；roadmap G02、G08、G17、G19 已上線；TWL-8~11、TWL-16、KRREL-1、UKREL-1、VIS-1／2／4／5／6 已結案；多國化議題 3 主站遷移（MC-4，2026-11-06 隨 Zeabur 搬家完成）；2026-11-06 review 修正輪（mini #844／#845／#850、gp #202／#204 mig 502 已套用、collectors #172）；G04 parked。

## 不確定項

- 國道逐車 wip 5f692772 的細節以 analytics `freeway_tdcs/_status.md` 為準，本表未再核對。
- G10／16／20／23／27／31 的實際進度只看了 roadmap frontmatter status，沒讀內文。
- 情報牆 W30 計畫的待拍板項是否已在別處處理：未查證（目錄最後 commit 07-29）。
- 新鮮度 VM 11/2 首次自動執行結果、Disk IO 10-23 複量有沒有做：未查證。
- 衛星改版 #533（`a7864dbb`）最早含在 v2.5.0（2026-10-04）；正式站目視仍未做。
- 法國有沒有獨立波次計畫：未查。
- mini-taiwan-stories 後續進度：未查。
- 愛爾蘭、南韓細節取自 #898 收尾、BACKLOG 與 analytics PLAN／_status（2026-11-08 讀）。
- `release-queue.md`、`branches.md` 未讀，分支層級的遺漏可能存在。
- 「最後進展」多半取記憶或 BACKLOG 日期，沒逐一對照 git log。
- gis-platform mig 497：analytics `canada_opendata/waves/PLAN.md` §4 記載 2026-11-04 已套用（未另查 DB）；mig 496／498 依 journal 2026-11-04 已套用；mig 499–504、511、512 已套用；505–509 排 11-08 晚上。
- collector 搬完是使用者 2026-11-08 口述；.gis-agent-system 搬遷 README 與 journal 尚未同步（該 repo 有其他 session 未提交的改動，本次沒碰）。
