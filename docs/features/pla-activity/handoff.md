# HANDOFF — 共機通報資料 + 航跡圖向量化

> 2026-08-02 session 結束交接。**貼這份給新 session 即可接手。**
> 全部工作已 commit，**皆未 push**。

---

## TL;DR — 接手第一件事

新 session 開場請先讀這三份：
1. 本檔（狀態與待辦）
2. `taipei-gis-analytics/docs/topic-research/defense_pla/shape-extraction-methodology.md`
   （**什麼方法行不通、為什麼** —— 省下重走冤枉路的時間）
3. `mini-taiwan-pulse/docs/proposal/pla-activity-layer.md`（前端接線規劃，含 10 個註冊點）

**⚠️ 最優先的一件事**：線上 collector 仍是舊版，**每 30 分鐘覆蓋修好的資料**（見 §5.1）。

---

## 1. 這個 session 完成了什麼

### 1.1 台股 30 日趨勢（MO-17，已完成）
Monitor 戰情概覽的 TAIEX 卡片加近 30 交易日走勢線。

- gis-platform migration **325**（已 apply production）：`get_market_index_daily(p_days, p_code)`
- 順修 MO-14：查證發現 `value_thousands` **不是成交金額而是成交股數**
  （對官方 FMTQIK 四交易日 98-99% 吻合）→ 顯示改「1365.1 萬張」，前端 label「額」→「量」

### 1.2 共機通報資料修復與回填（MO-19，已完成）
`live.pla_activity_daily` **729 天零缺日**（2024-08-02 ~ 2026-07-31，正好近兩年）。

| 欄位 | 修正前 | 現在 |
|---|---|---|
| 架次 | — | **729/729 (100%)** |
| 逾越中線 | **51 天全空** | 728/729 |
| 統計窗結束日 | 197/544 | 728/729 |
| 中部空域標記 | **0/51 天** | 115 天 |
| 乾淨原文（可重解析） | 0 | 729/729 |

修了 **11 個 bug**（原盤點只有 3 個），全部有單元測試（11 例）。
關鍵幾個：括號句尾數字、ADIZ 頓號列舉、單架寫「1架」、第二日期無年份、
無括號子句 crossed 記 0、maincontent 被巢狀結構截斷、gate 過嚴、
圖片下載 406（Accept header）、上游漏字「偵獲共4架次」。

**圖片版時代**（~2025-02-02 以前，185 天）：網頁內文為空、數值只在 JPG 裡
→ 用 8 個 subagent 讀圖轉錄（**走訂閱額度、沒打 API**），再交給同一支 regex 解析器算數值。
185 份轉錄全數解析成功、**中英交叉驗證 0 筆不符**。

### 1.3 航跡圖向量化（PT-0 Phase 0-2，方法已可用）
- 588 天航跡圖已存 S3（`pla/track_charts/`），圖片版另存數字表格圖（`pla/activity_charts/`）
- 配準（像素↔經緯度）**已驗證可用**：用圖上自帶經緯網格 + 物理錨點
- 形狀抽取用混合法，**最近 5 天 5/5 通過**、2026 全年 **116/181 (69.9%)**

---

## 2. 未 push 的 commit（全部）

| Repo | Branch | 內容 |
|---|---|---|
| **gis-platform** | `feat/market-index-30d` | migration 325（台股日線）/ 326（共機統計窗+航跡圖URL+區間RPC）/ 327（圖片版 activity_chart_url）。**三支都已 apply production** |
| **data-collectors** | `feat/pla-parse-fix-backfill` | 解析修復 4 commits + 回填腳本 + 轉錄 pipeline + 11 單元測試 |
| **taipei-gis-analytics** | `master` | 向量化程式（`scripts/pla_tracks/`）+ 計畫與方法論文件（`docs/topic-research/defense_pla/`） |
| **mini-taiwan-pulse** | `feat/market-index-30d` | 台股與共機兩張卡片趨勢 + BACKLOG + 本規劃文件 |

⚠️ **gis-platform 的 `feat/market-index-30d` 夾帶了另一個 session 的 commit**
（`d98de5d feat(religion): mig 328/329`）—— 出 PR 前需處理（rebase 或請對方認領）。

---

## 3. 下一步：共機活動區圖層（PT-0 Phase 5）

完整規劃見 `mini-taiwan-pulse/docs/proposal/pla-activity-layer.md`。摘要：

**A 期 — 資料上線**：建 `spatial.pla_tracks`（date × shape_no × Polygon × kind × needs_review）
+ `get_pla_tracks_day()` / `get_pla_track_dates()` 兩支 RPC；先灌 2026 年守門通過的 116 天。

**B 期 — 群組改組**：主題「新聞 News」改名。**只需改 4 處**
（`layerCatalog.ts:1374` + `InfoModal.tsx:363/365-370/726-730`），
theme title 無硬編碼複本、其餘消費端全部 derive。

**C 期 — 圖層本體**：範本用 `useDisasterAlertLayer.ts`（**不是**地震回放，
後者刻意走自己的 clock）。共機資料無 intraday 變化 → 只需 `subscribeDate`。
10 個註冊點清單見規劃文件 §4.2，漏接會被 tsc 或 5 支測試擋下。

**D 期 — 瀏覽器驗收**：拉時間軸換日、popup、圖例、透明度 slider。

### 待 owner 拍板 4 項
1. **群組名稱**：即時消息 Live Feed / 情勢 Situation / 情報 Intel
   （此群組未來收共機、警訊、衛星等**每日回顧型**內容，「情勢」語意較準）
2. **資料範圍**：先上 2026（116 天）或先把 2024-08 起 588 天全跑完（建議先 2026）
3. **needs_review 的 65 天**是否入表但以旗標區分
4. **災害示警**是否一併搬進新群組（建議暫不搬，會改變既有使用者習慣）

---

## 4. 向量化的已知限制（全量批次前必解）

2026 全年通過率 **69.9%**，未達可上線水準。失敗模式：

| 當日形狀數 | 通過率 |
|---|---|
| 1 項 | 92% |
| 2 項 | 74% |
| 3 項 | 57% |
| 5 項 | 17% |

**兩個改進方向（依價值排序）**：

1. **表格項次依類型分流**（工程量小、效益大）
   守門用的 ground truth 有瑕疵：表格「項次」不全是封閉多邊形。
   例如 2026-01-08 項次④ 是**空飄氣球**（紅色虛線軌跡 + 圓圈），本就不該抽成多邊形。
   從表格文字認出這類項目並排除，真實通過率會明顯上升。
2. **用「已知目標數」引導分割**
   既然表格告訴我們該有幾個形狀，密集區可用這個數字引導切分，比盲目分割容易。

其他限制：兩個**不規則**形狀交叉會被併成一塊；線框斷口 >26px 該 cluster 被丟棄
（會留警告、不靜默）；3 張 794×1115 版型配準失敗（該版型只有 3 張，抓不到網格）。

---

## 5. 已知問題 / 待辦

### 5.1 ⚠️ 線上 collector 是舊版，正在覆蓋修好的資料
**最優先。** 證據：最近幾天 `raw_text` 長度剛好卡 2000（舊版特徵，新版存內文上限 4000），
且 7/30 原本抓到的「逾越中線 22、四區全進」又變回空值與 false。

程式已修好並 commit（`data-collectors` branch），但**要部署到線上跑的環境才生效**
（Zeabur 或 VM，需 owner 操作）。在那之前資料會持續被覆蓋。

### 5.2 空飄氣球是完全沒接的維度
通報自 2026-02 起出現獨立段落「三、中共空飄氣球活動：中共空飄氣球計偵獲 N 顆」。
目前 DB 無此欄位。原文已全數入庫，加欄位後可直接從 `raw_text` 重解析、不需重爬。

### 5.3 pulse 前端 branch 分歧
`feat/market-index-30d` 是本 session 的工作 branch。
`verify/batch-20260801` 與 `feat/religion-layers` 是另一個 session 的，勿混。

---

## 6. 環境陷阱（會浪費時間的）

- 向量化程式**必須用 `taipei-gis-analytics/venv/bin/python`**（有 scikit-image）；
  系統 python3 沒有，**且無 OpenCV**（PEP 668 擋，別再嘗試安裝）
- numpy 2.x 移除了 `ndarray.ptp()` 與 2D `np.cross` → 用 `np.ptp(arr)`、手算外積
- 抓 mnd.gov.tw 的圖**必須帶 `Accept: image/*`**，否則回 **406**
- 回填腳本每頁即時寫入 DB（早期版本累積到最後才寫，被中止就整輪全丟）；
  中斷可用 `--resume` 續跑
- 對比圖務必用 **Web Mercator 且等比縮放**；用等距圓柱硬拉伸會把台灣壓扁

---

## 7. 產出的檢視頁（可重新發布）

| 用途 | 來源檔（scratchpad） |
|---|---|
| 729 天資料品質稽核 | `pla_quality.html` |
| 最近 5 天向量化 + 原圖對比 | `pla_corridors.html` |
| 2026 逐月逐日檢視（181 天） | `y2026_viewer.html` |

⚠️ scratchpad 是 session 專屬暫存，**新 session 看不到**。
需要時用 `scripts/pla_tracks/build_geojson.py` 重跑產資料，再重建頁面。

---

## 8. 關鍵指令

```bash
# 向量化（必須用 venv）
cd taipei-gis-analytics
venv/bin/python scripts/pla_tracks/build_geojson.py <img_dir> -o out.geojson --png

# 回填通報（近兩年，可 --resume 續跑）
cd data-collectors
python3 scripts/backfill_pla_activity.py --days 730 --resume

# 圖片版轉錄三步
python3 scripts/pla_ocr_prepare.py --limit 200 --batch-size 25   # 備料
#   → 派 subagent 讀 batches/*.json 看圖抄字到 transcripts/
python3 scripts/pla_ocr_apply.py                                  # 套用（含中英交叉驗證）

# 驗證
cd data-collectors && python3 -m pytest tests/test_pla_activity_parse.py -q
cd mini-taiwan-pulse && npx tsc -b && pnpm test
```
