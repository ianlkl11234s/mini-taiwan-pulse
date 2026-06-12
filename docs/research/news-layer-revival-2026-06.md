# 即時新聞圖層復活研究（2026-06-12）

> 目標：把做到一半的 newsEvents 圖層重新完整化 —— 長期收集台灣即時新聞、
> 低成本標註地點、與地圖結合，並盤點其他「台灣現在哪裡發生什麼事」的資訊流。
> 來源驗證：本報告中標 **[✓實測]** 的 URL 都在 2026-06-12 實際 fetch 過。

---

## 1. 現況盤點：之前做到哪

| 部分 | 狀態 |
|---|---|
| 前端圖層（types / useNewsTimeline / overlayRegistry / eventPanels / sidebar NEWS 區 / DataCalendar） | ✅ 已完成且併入 master（commit `ee86f81` 等） |
| 時間動態（published_ts 累積式 + 15min ripple 脈衝） | ✅ 完成 |
| 地點辨識 PoC（`scripts/poc/poc-news-geocode.py`，Gemini Flash Lite 一次做 NER+座標+摘要） | ✅ PoC 驗證過 |
| 資料 | ⚠️ 只有 2026-03-07 那天 32 則 CNA 的靜態 `public/geo/news_events.geojson` |
| 自動排程 pipeline（data-collectors） | ❌ 未做 |
| 資料庫（gis-platform `realtime.news_events` + RPC） | ❌ 未做 |
| 多來源 + 去重 | ❌ 未做 |

**結論：前端是現成的，缺的整段都在資料管線。** 復活成本主要在後端，前端只需把資料來源從靜態 GeoJSON 換成 Supabase RPC（或 S3 日檔）。

設計文件：`docs/NEWS_MAP_PLAN.md`（4-phase 完整計畫，仍適用）。

---

## 2. 新聞來源現況（2026-06 驗證）

### 還活著的 RSS

| 來源 | Feed | 量/天 | 備註 |
|---|---|---|---|
| 中央社 CNA | `feeds.feedburner.com/rsscna/{local,social,lifehealth,...}` [✓實測] | 250–400 | 11 分類各 20 則；`mainnews` 已 404 |
| 自由時報 | `news.ltn.com.tw/rss/all.xml` + `society.xml` + `local.xml` [✓實測] | 400–700 | 即時 feed 50 則，尖峰建議 5–10min 輪詢 |
| ETtoday | `feeds.feedburner.com/ettoday/realtime` [✓實測] | 800–1,500 | 量最大、分鐘級更新 |
| 公視 | `news.pts.org.tw/xml/newsfeed.xml` [✓實測] | 50–100 | 量小品質穩；另有 PeoPo 公民新聞 |
| 報導者 | `public.twreporter.org/rss/twreporter-rss.xml` [✓實測] | <10 | 深度報導，非即時源 |
| 上下游 | `newsmarket.com.tw/feed/` [✓實測] | ~10 | 農業食安，常含產地縣市 |
| 聯合報 UDN | ❌ 主站 RSS 已死 [✓實測 404] | — | 走 Google News 間接取得 |
| TVBS | ❌ 無 RSS [✓實測 404] | — | 同上 |

### Google News geo feed（重要發現 ⭐）

```
https://news.google.com/rss/headlines/section/geo/Tainan?hl=zh-TW&gl=TW&ceid=TW:zh-Hant
```
[✓實測] 每縣市 ~100 則、跨媒體（含 UDN/TVBS/Yahoo）。**22 縣市各開一條 = feed 本身就自帶縣市標籤**，
縣市級定位零成本，LLM 只需做鄉鎮級細化。限制：非官方、連結是 google redirect、抓太頻繁會 429（建議每縣市 15–30min）。

### GDELT

DOC 2.0 API 有台灣中文媒體 + 自動地點抽取（含座標、15min 更新、免費），但中文經 translingual
翻譯後鄉鎮級精度差、索引有延遲。**只當補充源，不當主力。**

### 聚合 API（NewsAPI / newsdata.io）

免費層都有 12–24hr 延遲或禁 production，**不如 RSS + Google News 自建**。

**全訂閱去重後估 2,000–4,000 則/天。**

---

## 3. 地點辨識：低成本方案

### 五路線比較（以 1,000 則/天計）

| 路線 | 準確率 | 月成本 | 工作量 |
|---|---|---|---|
| 1 純字典 gazetteer | 75–85% | $0 | 1–2 天（消歧規則是大頭） |
| 2 CKIP NER 本地跑 | 75–85% | $0 | 1–2 天（仍要字典 mapping） |
| 3 純 LLM batch | **90–95%** | **$1–11** | **0.5–1 天** |
| 4 混合（字典先濾 → 歧義丟 LLM） | ~90% | $0.3–3 | 2–3 天 |
| 5 Embedding 分類 | 60–75%（僅縣市） | ~$0 | 不建議 |

### 你擔心的「一則一則打 API 很貴」其實不會發生

2026-06 batch 價格（50% off）：Claude Haiku 4.5 = $0.50/$2.50 per MTok；
Gemini 2.5 Flash-Lite = $0.05/$0.20 per MTok。

**三個省錢關鍵**：
1. **Packing**：一個 request 塞 20 則新聞、輸出 JSON array → system prompt 攤提 20 倍。
   Haiku 月成本 ~$5、Flash-Lite **<$1**。
2. **368 鄉鎮清單塞進 system prompt**（2–3k tokens）：一舉兩得 —— 超過 1024 token
   快取門檻（再省 90% input）+ 直接提升消歧品質。
3. **座標絕對不讓 LLM 吐**：LLM 只輸出正規化地名（縣市+鄉鎮），座標一律查
   gazetteer centroid 表。同時用 368 鄉鎮白名單做後驗驗證擋幻覺。

加上 Google News geo feed 已自帶縣市，實際要 LLM 細化的量更少。
**結論：月成本 $1–5 美元級，這個量級不值得為了省錢犧牲準確率去搞字典法。**

字典消歧的天然盲點（為何不走純規則）：中山區（北/基/高）、東區（中/南/竹/嘉/屏）、
嘉義市vs嘉義縣、「金門高粱」「中山高」誤命中、一則多地的主體判斷。

### 推薦：路線 3 起步，量大再升級路線 4

- Phase 1：Gemini 2.5 Flash-Lite batch（或 Haiku 4.5 batch）+ 20 則 packing + 鄉鎮清單 system prompt
- 後驗：gazetteer 白名單 + centroid 查表
- 之後若想歸零：加字典前濾，高信心唯一命中直接過（約 60–75%），剩下才丟 LLM

---

## 4. 免 LLM 的事件源（自帶地點，建議優先接）

| 來源 | 端點 | 地點 | 更新 |
|---|---|---|---|
| **NCDR 民生示警 CAP** ⭐ | `alerts.ncdr.nat.gov.tw/RssAtomFeed.ashx?AlertType={n}`（另有 JSON 版）[✓實測] | CAP 自帶 polygon/鄉鎮 geocode | 每分鐘，回溯 7 天 |
| **警廣即時路況** ⭐ | `rtr.pbs.gov.tw/NMP103_PbsWS/resources/roadData/opendata`（免 key JSON） | **自帶 x1/y1 經緯度** | ~1 分鐘，最近 1000 筆 |
| CWA 顯著有感地震 | open data E-A0015/E-A0016（已有 key） | 震央座標 + 各站震度 | 震後數分鐘 |
| TDX TRA/Metro Alert | `/v3/Rail/TRA/Alert` | 影響路線/站間 → 直接 map 到既有軌道幾何 | 即時 |

NCDR 涵蓋 **61 類**：消防署火災（NFA_Fire）、公路封閉（THB）、淹水、土石流、水庫放流、
停班停課、停電停水…… 一次接入就是「全台事件牆」的骨幹，且與 disasterAlerts 既有經驗相通。

---

## 5. 其他「實體資訊」管道盤點

### 社群媒體

- **Threads**：2026 已開放 **Keyword Search API**（搜全平台公開貼文），但需 app review 取
  `threads_keyword_search` 權限（現有個人 token 只有 `threads_basic`）；2,200 queries/24h；
  回傳**無任何座標欄位**，地點全靠 LLM 抽。→ 第二階段再做。
- **PTT** ⭐：官方 Atom feed `ptt.cc/atom/<板名>.xml` [✓實測 Kaohsiung/Gossiping 可用]。
  地方板（Kaohsiung/Tainan/TaichungBun…）+ 八卦板 `[地點]` 標題慣例，地點訊號比 Threads 好。
  唯一務實的「民間聲音」即時流。
- **Dcard**：API 已鎖 + Cloudflare 擋爬，不建議。
- **X/Twitter**：pay-per-use $0.005/讀，side project 不可行。

### 其他確認過的

- 各縣市 119 即時案件網頁可爬（北/高/南共用 DTS 系統）但屬灰色地帶；火災改走 NCDR NFA_Fire 正規管道。
- 警政署 110 無公開 feed。Waze for Cities 僅限政府機關申請。
- 台電停電無正式 API（災時 OpenGeoNDD 可挖鄉鎮級 JSON）；停電示警部分進 NCDR CAP。
- 水利署水位 / 環境部 AQI 是「狀態型」非「事件型」，要自訂門檻才變事件；水位警戒也會進 NCDR CAP。

### 值得做 Top 5（含工程 CP 值）

1. 警廣即時路況 — 免 key、自帶座標、接入成本趨近零
2. NCDR CAP 全量 — 61 類事件、自帶 geometry、事件牆骨幹
3. TDX TRA/Metro Alert — 邊際成本最低（軌道幾何已有）
4. CWA 顯著有感地震 — 震央+測站震度，視覺效果好
5. PTT 地方板 Atom + LLM 地點抽取 — 與新聞共用同一條 LLM pipeline

---

## 6. 建議架構（接專案既有慣例）

```
data-collectors (cron 15min)
  ├─ rss_news collector：CNA/LTN/ETtoday/PTS + Google News geo×22
  │    → URL 去重（去 google redirect）→ 標題 simhash 跨媒體去重
  │    → 字典快篩（可選）→ LLM batch（20 則 packing）→ gazetteer 後驗 + centroid
  ├─ ncdr_cap collector：CAP → polygon/鄉鎮直接入庫（零 LLM）
  └─ pbs_road collector：警廣 JSON → 自帶座標直接入庫（零 LLM）
        ↓
gis-platform (Supabase)
  realtime.news_events（title, summary, category, source, link, published_ts,
                        location_name, admin_code, lat/lng, confidence, geom）
  + per-day pre-aggregate（依專案 pattern）+ 薄 RPC（public.get_news_events）
        ↓
mini-taiwan-pulse 前端（大多已寫好）
  newsLoader.ts（loadingRegistry）→ useNewsTimeline（已有）→ overlayRegistry newsEvents（已有）
  + sidebar「臺灣即時新聞」區塊：最新 N 則清單，點擊 flyTo + 開 popup
```

注意事項：
- 動態圖層時間訂閱規則照舊（timeStore，currentTime 禁入 deps）—— useNewsTimeline 已符合。
- 圖層 UX 四鐵則：opacity slider（已有 newsScale，補 opacity）、category 分色要進
  LEGEND_REGISTRY、click popup（已有 NewsEventPanel）、來源/分類選項 ≥4 用 dropdown。
- LLM 跑在 collector 端（每 15min 批一次當天新增），不在前端、不在 request path。

## 7. 建議 Roadmap

1. **Week 1 — pipeline 打通**：rss_news collector（先 CNA+LTN+Google News geo）+
   Flash-Lite/Haiku batch 地點抽取 + gazetteer 後驗 → 寫入 Supabase → 前端換 RPC 餵資料
2. **Week 2 — 事件牆擴充**：NCDR CAP 全量 + 警廣路況（兩者零 LLM）+ sidebar 即時新聞區塊
3. **Week 3+**：多源去重調優、category 分色+圖例、cluster/heatmap、PTT 地方板、
   （送 Threads keyword search 權限審核）

預估營運成本：**LLM $1–5/月 + 既有 Supabase/S3，幾乎零增量。**
