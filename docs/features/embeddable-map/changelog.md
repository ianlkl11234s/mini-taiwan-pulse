# Embeddable Map — Changelog

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
