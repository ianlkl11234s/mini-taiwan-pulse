# Embeddable Map — Changelog

## 2026-08-09 — `rsys=` 擴充到營運者級 + 線路級（`feat/rail-line-codes`）

- 一個參數吃三種粒度：`trtc`（營運者）／`trtc-bl`（線路，必帶前綴避免北捷高捷 R/O 撞名）／
  `tra`（系統即最細）。混用取聯集，代碼表 SSOT = `src/constants/railLines.ts`
- ⚠️ **breaking**：`rsys=trtc` 從「整個 trtc 系統」（含機捷 + 新北四線，94 軌道／4,516 班次）
  縮成「北捷本體五線」（76／3,017）。舊範圍寫 `rsys=trtc,tymc,ntm`。
  **不升 `URL_STATE_VERSION`**（升版會讓所有舊嵌入碼作廢，代價遠大於此；解析結果本身沒變）
- 過濾仍在**組裝階段**（`railReplayData`），沒選到的線連時刻表都不進 Map；
  時刻表沒有 `line_id` → 留不下軌道的班表一起丟，避免 departureCounts 與軌道數對不上
- 圖例跟著收斂到線路級（`rsys=trtc-bl` 只列板南線，用資料裡的官方線色）
- 🕳 **資料坑**：trtc 96 條軌道有 13 條（淡水信義線變體 `R-4-*`～`R-15-*`）**沒有 `line_id`**，
  快照時刻表更是整份都沒有 → `railLineIdOf()` 以 properties 優先、缺了才退回 trtc 專用的
  `track_id` 前綴解析。follow-up：上游 bundle 補齊後刪掉 fallback

## 2026-08-05 — Cloudflare 邊緣快取（EM-13）

- 建 Cache Rule `Static map data`（設定內容記於 [`handoff.md`](./handoff.md) §0b）——
  Cloudflare 預設不快取 `.pmtiles` / `.geojson` 副檔名，設定前全是 `DYNAMIC`
- nginx `/embed-snapshots/` 改 `immutable` + 1y（檔名含日期、內容永不變 = 天然 cache busting）
- 不設 Status code TTL：Edge TTL 選「沒有 cache-control 就 bypass」+ nginx 的
  `add_header` 無 `always` → 404 天然不被快取
- ⚠️ **驗證踩雷**：`curl -I`（HEAD）會回 `DYNAMIC` 讓人誤判規則沒生效，一律用 GET
- 實測：快照 HIT×3、`temples.pmtiles` MISS→HIT、**底圖 297 MB 純 range request 也 HIT**
  （Cloudflare 自行處理大檔案分段快取，不需先完整 GET）

## 2026-08-05 — 🚀 部署上線（EM-21）

- 底圖 `taiwan_basemap.pmtiles`（297 MB）+ 共機快照上 S3 `deploy-assets/`
- Zeabur 由 push master 自動觸發部署，容器 entrypoint 拉取成功（**未手動 redeploy**）
- **正式站端到端驗證**：`/embed` 200、底圖 Range Request 206、
  `temples.pmtiles`×7 tiles + `churches.geojson` 正常，
  **`mapboxCalls: 0`、`supabaseCalls: 0`** —— 成本模型實證成立
- 踩雷：上傳**不要**跑整個 `upload-deploy-assets.sh`，base_map 那段是逐檔 `cp`，
  會把既有 400 MB+ 全部重傳

## 2026-08-05 — popup + 分享面板收尾（`feat/embed-popup-share`）

- **通用 popup**（EM-20）：所有圖層可點。不複用主站 `useMapInteraction` + 30 檔／7379 行
  客製面板（撐大 bundle 且只覆蓋 38 種 layerType）
  - 欄位過濾逐輪收斂：內部 id → 硬名單；資料血緣後設 → **pattern**（逐個列舉擋不完）；
    **布林 `false` 不顯示**（「不是古蹟」沒有資訊量），`true` 顯示為「是」；
    空值含 MVT 常見的 `"[]"` / `"{}"`；上限 8 欄
  - 🔒 key／value／圖層名全 escape，3 個 XSS 測試守門
- **修**：嵌入版明暗改為同時吃 `style=` 與 `theme=` —— Share 產出的是 `style=`（主站底圖 id），
  EmbedApp 原本只讀 `theme=` → 選淺色底圖分享出去仍是暗的
- 加 `window.__embedMap` 診斷把手（同主站 `window.__map` 慣例）

## 2026-08-04 — 分享面板 + 網址雙向同步（EM-19，取代原 EM-04）

- `style=`（底圖 id）與 `h=`（0–23 小時）進 schema
- `moveend` + 圖層／底圖變動時 `replaceState`；**不是 pushState、不綁 move、不進 React state**
- ShareModal：連結 + iframe 代碼雙欄複製，標示網址包含哪些參數
- ⚠️ 修掉自己寫錯的判準：原用 `timeMode !== "live"` 決定是否寫日期，但 `TimeMode` 只有
  `"replay" | "live"` 且**預設就是 replay** → 每條分享連結都被凍上今天的日期。
  改為比對「時間軸日期 vs 今天（台北時區）」

## 2026-08-04 — 動態／歷史圖層（Phase A + B）

- **EM-14**：`dynamicData` 但已 CDN 化的 7 層可嵌。發現快照**早就做完了**
  （`public/static-rpc/` 25 檔），缺的只是 embed 怎麼吃 → 明確清單 + 通用 `rowsToGeoJSON`。
  **零主站改動**
- **EM-15**：按需歷史快照 pilot（`plaActivity`）。「文章要哪天就凍結哪天」，
  不做 AR-14~16 的全量 per-day 匯出。`export-embed-snapshot.sh` psql 直出 GeoJSON
  - 踩雷：psql `-c` 不做 `:'var'` 插值；`.env` 含未引號特殊字元、bash `source` 會當指令執行

## 2026-08-03/04 — `/embed` 正式版（EM-05/06，PR #105）

- `overlayManager` 泛化支援雙引擎：結構介面（union 會讓每個呼叫點 TS2349）+
  `pmtilesSource` 注入點。主站行為零改動，另加編譯期斷言守門
- Vite 多入口 + MapLibre 薄殼 + LegendPanel 複用 + 出處標示（不可由 `ui=` 移除）
- nginx `location = /embed`（⚠️ `add_header` 不繼承，安全 header 須重複宣告）
- 底圖落 `public/base_map/`：既有 upload/pull/nginx **零額外接線**

## 2026-08-03 — URL 深連結 + 解除 iframe 封鎖（EM-02/03）

- `src/lib/urlState.ts`：版本閘門 + 靜默降級 + gated 硬排除
- nginx：移除 `X-Frame-Options`（不支援白名單語法），改 enforcing CSP `frame-ancestors *`
  - ⚠️ `frame-ancestors` 在 `-Report-Only` 下**不生效**，故必須另立一條
- 順手修 master 既有的 nginx 語法錯誤（`location /religion/` 缺閉合括號 → 一 redeploy 整站起不來）

## 2026-08-03 — 規劃與底圖 spike（EM-01/09）

- 關鍵發現：Mapbox 計費 = `Map` 初始化 = 文章 PV，**與圖磚來源無關** →
  只換 OSM tile 省不到錢，必須連函式庫換成 MapLibre
- 台灣 z0–15 Protomaps extract = **283 MB**（原估 500 MB 偏高），中文地名完整到「里」層級
- owner 驗收底圖美觀度通過 → 定案走 MapLibre + Protomaps
