# 專案追蹤總表

> 用途：做到一半的專案放這裡，有空時從這裡撿回來。一列一專案，只放指標，不重抄細節。
> 最後盤點：2026-11-04（唯讀盤點；正式站最新 tag v2.21.0，2026-11-03）。

與其他文件的分工：

- **BACKLOG**（[`.claude/memory/BACKLOG.md`](../.claude/memory/BACKLOG.md)）＝單一待辦任務（有 ID、blocker、第一步）。
- **roadmap Gxx**（`../.gis-agent-system/roadmap/`）＝資料／圖層候選與發版佇列。
- **`.gis-agent-system/projects/`**＝跨 repo 計畫書。
- **本檔**＝專案層總覽，回答「有哪些專案做到一半、卡在哪」。

狀態圖例：🟢 已上線待收尾｜🟡 進行中｜⏸️ 暫停｜🔵 待拍板｜⚪ 構想／研究完成未動工

## 現在最該注意

1. **Zeabur 全平台 12/31 停止營運，以 11 月底前搬完為準**：第 2 階段（開 Akamai、主站方案 §5a）待拍板；collector／OSRM／Valhalla／research-gateway 未搬；秘密輪換（SEC-6）要一併做。見「平台與維運」。
2. **選舉圖層第二批**：mini #811 ＋ gis-platform #197（mig 496，未套用）須使用者拍板套用；投票日 11-28 前活動地圖要持續每日更新。見「選舉」。
3. **加拿大第 0–2 波**：上游 analytics #279–#285 先合，再套 mig 497（gis-platform #198，須拍板），最後合 mini #812、#813。見「多國圖層」。
4. **已合 develop、尚未發版**：雙北大眾運輸可及性（#810）、國道逐車模擬（#814）；整批發版前要逐一列出 develop 上範圍外的 PR 讓使用者確認。見「模擬實驗」。
5. **主站遷移（MC-4）與 Zeabur §5a 要合併決定**：先唯讀量 S3 deploy-assets 各資料夾組成。
6. **資料新鮮度**：確認 11/2 VM 首次自動產更新清單是否成功（`update_list.py --pull`）。
7. **有遺失風險的本機成果**：Monitor 可拖曳版面的兩個本機分支無 upstream（G015）；新聞／GDELT POC 的 draft PR 去留（CL-3）。
8. **等使用者回覆**：愛爾蘭 §6 五題；Google OAuth 品牌驗證審查結果。

## 情報與新聞

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 新聞地點證據 shadow 面板（POC） | 🔵 | 三 repo draft：mini #427、gp #128（migration 須重編號）、collectors #117 | CL-3：決定保留或關閉 | BACKLOG CL-3 | 2026-10-03 |
| 國際媒體台灣情資 feed（GDELT，POC） | 🔵 | draft：mini #426、gp #127、collectors #116 | 同 CL-3 | BACKLOG CL-3 | 2026-10-03 |
| Live wall 影片失效自動切換 | 🔵 | YouTube「無法播放」格子會卡住 | LW-1：先審 onError 切換設計 | BACKLOG LW-1 | 2026-10-16 |
| Monitor 可拖曳版面 | 🔵 | 本機分支 feat/monitor-grid-layout（+15）、feat/monitor-widgets-batch1（+11）無 upstream | G015：先 bundle 或 push 備份，再決定留或關 | BACKLOG G015 | 2026-10-16 |
| 國內新聞圖層維運 | 🟢 | 2026-06 已上線 | NEWS-1：驗自由時報 RSS 在正式站是否仍被 Zeabur IP 403（搬完再驗） | [`features/news/backlog.md`](./features/news/backlog.md) | 2026-10-16 |
| 衛星主控台改版收尾（#533） | 🟢 | 已合 develop（10-04），之後已隨某版上 master | 正式站目視暗／淡主題與手機版 | [`features/satellite-console-restyle/README.md`](./features/satellite-console-restyle/README.md) | 2026-10-16 |
| 情報牆（mini-taiwan-intel） | ⏸️ | 資安稽核 C1 完成（mig 477、站主登入才可寫） | W30 計畫 §3、§6 待拍板項待確認；W2：「否決關聯」改標 rejected | `../.gis-agent-system/projects/2026-W30-intel-wall/` | 2026-10-17 |
| Monitor 四域子指數／壓力指數重建 | ⏸️ | 規格 §5.35 I2 已有，無觸發 | MON-P6：決定重啟後先寫公開權重與基期提案 | BACKLOG MON-P6 | 2026-10-16 |
| 衛星主控台歷史模式機動清單 | ⏸️ | 2026-10-04 擱置 | SAT-Z3：解除擱置後先過三項核准 | BACKLOG SAT-Z3 | 2026-10-16 |
| Intel 面板三個計數不一致 | ⚪ | 已定位：標頭只算新聞、「全部」含警報、AlertSummaryBar 沒套 RANGE | IN-1：統一計數口徑後修 | BACKLOG IN-1 | 2026-10-16 |
| Monitor 小項（警報序列增量、PowerCard 空狀態、TRA 格座標、匯率卡、聊天釘選） | ⚪ | 只有定位，未動工 | G025、OG-5、TD-3、MO-6（ready）；AR-44 待決定留或丟 | BACKLOG 同 ID；[`features/owner-gated-layers/backlog.md`](./features/owner-gated-layers/backlog.md) | 2026-10-16 |

## 選舉

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 選舉圖層第二批（投開票所中性著色＋熱區、2026 議員選區、2022 村里得票） | 🟡 | mini #811、gp #197（mig 496，未套用）開著；pollingStations2024 已在 develop | 套 mig 496（須拍板）→ 等 CI、合 #811 → 隨整批發版 | mini PR #811、gp PR #197；analytics `pulse-layers-contract.md` | 2026-11-03 |
| 2026 地方選舉活動地圖（electionEvents2026） | 🟢 | 站主限定圖層隨 v2.21.0 上線（mini #802、analytics #274、gp #194 mig 493/494）；每日資料由使用者叫跑 run_daily.sh | 投票日 11-28 前每日更新；GUI-2 站主登入目視；要開放只改 gated_layers 一列（待決定） | `../taipei-gis-analytics/docs/topic-research/election_events_2026/`；BACKLOG GUI-2 | 2026-11-03 |

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
| 日本後續 | 🔵 | P1 第 1–4 波隨 v2.15.0 上線，10-28 正式站已驗 | JPRD-2 收費道路樣式（等決定）；JPW4-1 等填 WAM NET 表單；JPRD-1 等搬家完成 | BACKLOG JPRD-1／JPRD-2／JPW4-1 | 2026-10-28 |
| 英國後續 | 🔵 | 第 0–12 波隨 v2.18.0 上線（#765） | UKD-1 待拍板項；UKOSM-1 OSM 五層卡 Overpass 封鎖（換網路重跑 07_export.py）；UKLZ-1 等決定，UKLZ-2／3 可直接做 | BACKLOG UKD-1／UKOSM-1／UKLZ-1~3；`../taipei-gis-analytics/…/united_kingdom_opendata/waves/PLAN.md` §3 | 2026-11-01 |
| 愛爾蘭第一輪 | 🔵 | 系統盤點完成（analytics #256），還沒上圖層 | 等使用者回 §6 五題；補登 IE pii | `../taipei-gis-analytics/docs/topic-research/ireland_opendata/` | 2026-10-31 |
| 多國化議題 3（主站遷移） | 🔵 | 未開工 | MC-4：與 Zeabur §5a 合併決定 | BACKLOG MC-4 | 2026-10-29 |
| 加拿大第 0–2 波＋統計 | 🟡 | analytics #279–#285、gp #198（mig 497，未套用）、mini #812（國家選單＋17 層）、#813（統計）皆開著 | 依序合上游 → 套 mig 497（須拍板）→ 合 #812、#813；第 2 波建物、C002 HOLD | PR mini #812／#813、analytics #279–#285、gp #198 | 2026-11-04 |
| 南韓後續 | 🟡 | 第 0–5 波＋統計隨 v2.19.0 上線 | KRW-6 第 6–10 波可開；第 11 波等註冊 data.go.kr key；KRH-1 兩層 HOLD；KRI18N-1 逐層驗 en/ja | BACKLOG KRW-6／KRH-1／KRI18N-1 | 2026-11-01 |
| 多國化議題 1 收尾 | 🟢 | 國家主體化隨 v2.16.0 上線 | MC-3 補目視；MC-1 主題識別名與顯示名拆開（有同名主題時再做） | BACKLOG MC-1／MC-3 | 2026-10-28 |
| 多國化議題 2 收尾（MCP 跨國） | 🟢 | P0–P5 於 2026-10-29 全部上線 | MC-6 補 name_en；MC-7 拆 airspace／coral 表；MC-8 觀察 eval 不穩點 | BACKLOG MC-6~8；`../.gis-agent-system/projects/2026-10-multi-country/PLAN-topic2-mcp.md` §5 | 2026-10-29 |
| 法國 | ⚪ | 國家選單已有 FR（v2.16.0）；MCP 缺邊界與人口，回「未涵蓋」 | 最低門檻：countries 一筆＋admin1 邊界＋人口分母；有無波次計畫未查證 | `../pulse-data/docs/new-country-onboarding.md` §4 | 未查證 |

## 台灣圖層（roadmap 群組）

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 主題分類統一（TWL-12） | 🔵 | 6 題等使用者決定 | 逐題拍板（兩套統計分類、陸域保護區、測試層等） | BACKLOG TWL-12；`../.gis-agent-system/roadmap/scout/2026-10-31-tw-gap/routeC_theme_allocation.md` | 2026-10-31 |
| 舊檔去留（public/fishery） | 🔵 | — | TWL-2 列 6 個檔請使用者選 | BACKLOG TWL-2 | 2026-10-29 |
| G10／G16／G20／G23（金融、國營事業、健康行為、文化幣） | 🟡 | roadmap status 皆 in_progress（G10 存放款、刷卡已上線；G20 含 B235） | 照各群「下一步」接續 | `../.gis-agent-system/roadmap/candidates/G10`、`G16`、`G20`、`G23` | 未查證 |
| G27 臺北市局處公務統計 | 🟡 | 部分隨 v2.13.0 上線 | BLOG-V 目視；PDF 獨有表 | candidates/G27；BACKLOG BLOG-V | 2026-10-24 |
| G32 熱島與高溫曝露 | 🟡 | queued；涼適點、熱傷害排進 TWL-5 第二批 | TWL-5 災害暴露組（使用者說晚點再處理） | candidates/G32；BACKLOG TWL-5 | 2026-10-29 |
| G33 海洋保育補接 | 🟡 | 海保署 5 個海上保護區檔已在 public/，沒有圖層接 | 接海域保護區範圍圖層 | candidates/G33 | 2026-10-29 |
| G29 淹水即時與情境（含多情境） | 🟢 | 方向 A：10 情境切換（#737）已上線 | TWL-5 雨水下水道；TWL-7 縣市×情境統計層；TWL-6 即時降雨等 collector 新家 | candidates/G29；BACKLOG TWL-5／6／7 | 2026-10-29 |
| G34 治安與交通執法 | 🟢 | 測速照相換新版（#736） | TWL-5 各縣市科技執法；TWL-3 popup 舊 bug | candidates/G34；BACKLOG TWL-3／5 | 2026-10-29 |
| G35–G37 第二輪補強 | 🟢 | TWL-8／9／10 隨 v2.19.0 上線 | TWL-15 接續（正式站消防栓 PMTiles 仍舊版等）；frontmatter 改 live | BACKLOG TWL-15 | 2026-11-01 |
| 土壤液化（站主限定） | 🟢 | #407、#408 上線（09-29） | 正式站目視；MCP 題庫 PR #27 還開著 | [`features/soil-liquefaction/handoff.md`](./features/soil-liquefaction/handoff.md)；mini-pulse-gis-mcp #27 | 2026-09-29 |
| G30 災情、避難與民防 | ⏸️ | 研究完成；避難容量衍生層排在 TWL-5 | B 部分需 collector，卡 Zeabur 搬遷（TWL-6） | candidates/G30 | 2026-10-31 |
| G38 全國都市計畫區邊界 | ⏸️ | 授權不明 | TWL-13：寄信問國土署／國土測繪中心 | BACKLOG TWL-13 | 2026-10-31 |
| G31 飲用水源與污染 | ⚪ | queued | 照 G31「下一步」 | candidates/G31 | 未查證 |
| 次優先候選（TWL-14）＋ researched 群 | ⚪ | researched：G01／03／05／06／07／09／11–15／18／21／22／24–26；TWL-14 是多縣市拼接清單 | 有空時挑一群排批次 | candidates/_index.md；BACKLOG TWL-14 | 2026-10-31 |

## 模擬實驗

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| 國道逐車模擬（G39） | 🟡 | mini #814 已合 develop；MCP #95 已合並於 2026-11-04 部署；資料 R2 `sim/v1/freeway_tdcs/20261103-1`；尚未發版 | 跟車減速 wip 5f692772（在 taipei-gis-analytics，已隨 #286 合進 master）暫停中；等整批發版 | `../taipei-gis-analytics/docs/topic-research/freeway_tdcs/_status.md`；[`features/freeway-tdcs-sim/handoff.md`](./features/freeway-tdcs-sim/handoff.md)；roadmap G39 | 2026-11-04 |
| 情境推演／數位雙生（G28） | 🟡 | P1 靜態鏈已合 analytics #225，主站沒接 | P2 八仙回測：先補雙北以外醫院、校正座標 | candidates/G28；`../taipei-gis-analytics/docs/topic-research/digital_twin/REPORT.md` | 2026-10-26 |
| 雙北大眾運輸可及性 | 🟢 | 已合 develop（mini #810），在 CHANGELOG Unreleased，尚未發版 | 整批發版；下一步 P5 全台縣市 | roadmap G28 表 transit_access | 2026-11-03 |
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
| Pulse 筆記 /blog | ⏸️ | v2.13.0 上線；使用者說先觀察效應，暫停寫新文 | BLOG-1 下一篇（見不一致）；BLOG-V 目視與 Search Console | [`features/blog/article-plan.md`](./features/blog/article-plan.md)；BACKLOG BLOG-1／BLOG-V | 2026-10-24 |
| mini-taiwan-stories | ⏸️ | 08-23 開 repo，第一篇台鐵 | 後續進度未查證；內容重心已轉到 /blog | 個人記憶 mini-taiwan-stories-status-ref | 2026-08-23 |

## 平台與維運

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| Zeabur 停止營運搬遷 | 🟡 | 第 1 階段 11 個靜態站 10-29 切 Cloudflare | **期限 11 月底**：第 2 階段開 Akamai、主站方案 §5a（R2＋Workers 重構）待拍板；flight-arc-sharing 網址待決；collector／OSRM／Valhalla／research-gateway 未搬；搬時換金鑰 | `../.gis-agent-system/projects/2026-10-zeabur-migration/README.md` §5a §7 | 2026-11-03 |
| Supabase Disk IO 複量 | 🟡 | 第三輪 mig 451–460 於 10-16 套用 | 原定約 10-23 用 pg_stat_io 取差值，未查證有沒有做；中間若重啟，基準作廢 | `../gis-platform/docs/research/2026-10-16-disk-io-round3.md` | 2026-10-16 |
| 地圖圖層改版 R6 | 🟢 | 段 1–3 隨 v2.8.0 上線 | R6-V 正式站目視；段 4（船、公車、垃圾車、漁船）R6-4 暫不碰 | [`features/map-layer-restyle/R6-PROPOSAL.md`](./features/map-layer-restyle/R6-PROPOSAL.md)；BACKLOG R6-V／R6-4 | 2026-10-15 |
| 地圖基礎 GIS 元件（指北針、量測、右鍵） | 🟢 | #803／#804 隨 v2.21.0；#808 在 develop | GUI-2：手機實機觸控、真實定位、實體雙擊 | BACKLOG GUI-2 | 2026-11-03 |
| 地圖可見性整修 | 🟢 | v2.19.0 上線；#795 隨 v2.20.0 | VIS-3 剩餘目視項目 | BACKLOG VIS-3；[`design-system/map-layers.md`](./design-system/map-layers.md) §3.8 | 2026-11-01 |
| 多語系 i18n | 🟢 | P0–P5 隨 v2.9.0 上線 | P4-C（Agent 依網頁語言回答）、I18N-1（統計「資料限制」段仍中文）、KRI18N-1 | [`features/i18n/ROADMAP.md`](./features/i18n/ROADMAP.md) | 2026-10-31 |
| 資安稽核後續 | ⏸️ | 10-17 稽核、多項 migration 已套 | SEC-6 秘密輪換暫緩（建議併入搬遷）；SEC-7 待設 `PULSE_RESEARCH_TRUSTED_PROXY_IPS` 後合 gp #170；SEC-3／4／5／8、SEC-9 見 BACKLOG | `../gis-platform/docs/research/2026-10-17-security-audit.md`；BACKLOG SEC-3~9 | 2026-10-17 |

## 其他／衍生專案

| 專案 | 狀態 | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|
| Flight Arc（plan-art） | ⏸️ | FR24 Top-1000 抓到 28.6% | 見 plan-art memory 的 11 步流程 | 個人記憶 flight-arc-campaign-pointer；`../plan-art/` | 2026-08-09 |

## 發現的不一致（待清理）

- BACKLOG **PRIV-1**（隱私說明頁）仍標 ready，但頁面已隨 v2.12.0 上線，應關閉。
- BACKLOG **BLOG-1** 寫下一篇是 C1 Flight Arc，但 10-24 使用者決定「Flight Arc 不寫進 Pulse 筆記」，BACKLOG 可能沒更新。
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

回顧影片 v5.4（2026-10-05 發布封存）、隱私說明頁（v2.12.0）、多國議題 2 主體（2026-10-29）；roadmap G02、G08、G17、G19 已上線；TWL-8~11、TWL-16、KRREL-1、UKREL-1、VIS-1／2／4／5／6 已結案；G04 parked。

## 不確定項

- 國道逐車 wip 5f692772 的細節以 analytics `freeway_tdcs/_status.md` 為準，本表未再核對。
- G10／16／20／23／27／31 的實際進度只看了 roadmap frontmatter status，沒讀內文。
- 情報牆 W30 計畫的待拍板項是否已在別處處理：未查證（目錄最後 commit 07-29）。
- 新鮮度 VM 11/2 首次自動執行結果、Disk IO 10-23 複量有沒有做：未查證。
- 衛星改版隨哪個版本上 master：未查。
- 法國有沒有獨立波次計畫：未查。
- mini-taiwan-stories 後續進度：未查。
- 這輪沒讀 analytics 的 topic-research `_status.md` 與 `waves/PLAN.md` 原文，愛爾蘭、南韓細節取自記憶與 BACKLOG。
- `release-queue.md`、`branches.md` 未讀，分支層級的遺漏可能存在。
- 「最後進展」多半取記憶或 BACKLOG 日期，沒逐一對照 git log。
