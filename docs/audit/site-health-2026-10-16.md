# 全站健檢 2026-10-16（正式站 v2.8.0）

**一句話結論**：網站本身可用、效能與安全基本盤及格，但「搜尋引擎和 AI 助理看不到我們」——Google 查不到、`robots.txt`／`sitemap` 不存在、首頁 HTML 是空的。這一輪先補最便宜的 5 項（見 §4），其餘列為 BACKLOG 候選。

## SEO／AEO 是什麼、為什麼我們搜不到

SEO（搜尋引擎最佳化）是讓 Google 這類搜尋引擎找得到、讀得懂、願意收錄我們的網頁。搜尋引擎的爬蟲先讀網頁的 HTML 文字；我們是純前端的 3D 地圖，HTML 裡只有一個空的 `<div id="root">`，文字全靠瀏覽器執行 JavaScript 才長出來，所以爬蟲看到的幾乎是白紙，加上沒有 `sitemap` 告訴它有哪些頁面，Google 就不收錄（`site:` 查詢零結果）。AEO（回答引擎最佳化）是讓 ChatGPT、Perplexity、Google AI 概覽在回答問題時能引用我們，它需要的是機器可讀的說明文字（首頁靜態說明、`llms.txt`）、結構化資料（JSON-LD）、以及允許 AI 爬蟲進入的 `robots.txt`。「靜態說明＋索引檔」是第一步；要讓爬蟲看到更多內容（各主題說明頁、FAQ），需要預渲染或另開說明頁，列在下面的 SEO-6、AEO-3。

## 1. 量測方法與日期

| 項目 | 方法 | 日期 | 備註 |
|---|---|---|---|
| HTTP 標頭、各路徑狀態 | `curl -sI`／`curl -s`（只看標頭與狀態碼） | 2026-10-16 | 正式站 `https://mini-taiwan-pulse.itsmigu.com/`，版本 v2.8.0（由 `main-*.js` 內版號確認） |
| 載入資源大小 | 讀 `index.html` 的 modulepreload／css，逐檔 gzip 大小 | 2026-10-16 | 不貼 JS 內容 |
| Lighthouse | 本機 `lighthouse@12.2.1` ＋ Google Chrome headless，預設 mobile 模擬節流，對正式站 `/` 跑一次 | 2026-10-16 | **單次、本機網路**，分數有波動，僅供基準；機器當時負載偏高（load 約 7–8），效能分數可能偏低 |
| 瀏覽器實測 | agent-browser（無 WebGL） | 2026-10-16 | 無 WebGL 時整個 `#root` 空白 |
| PageSpeed Insights API | 呼叫 API | 2026-10-16 | 429 quota exceeded（無 key），**未取得** |
| 搜尋收錄 | Google `site:` 與品牌詞手動搜尋 | 2026-10-16 | 零結果；英文關鍵字只出現第三方（sourcepulse.org）介紹 GitHub repo |
| 真實使用者指標（LCP/INP/CLS 現場值） | — | — | **未測**（需 CrUX／Search Console） |

表格「現況」欄標記：【實測】已量測；【未測】沒有量測；【讀碼】由原始碼或設定判讀。

## 2. 健檢框架（8 面向）

### 2.1 效能

| 檢查項 | 現況 | 理想 | 建議 | 效益 | 工作量 | BACKLOG ID |
|---|---|---|---|---|---|---|
| Lighthouse 效能分數 | 【實測】0.26（mobile 模擬）：FCP 11.4 s、LCP 15.9 s、TBT 2,960 ms、TTI 17.0 s、CLS 0 | 行動版 ≥ 0.5；FCP < 3 s | 先拆首屏 JS（PERF-1／PERF-3），再複測 | 高 | 中 | PERF-1 |
| 首屏 JS 體積 | 【實測】modulepreload＋css 合計 gzip 2.11 MB（raw 9.03 MB）；`main` 826 KB gz、`mapbox-gl` 462 KB gz、`statisticsText` 322 KB gz（raw 2.7 MB）、shared 163 KB、`JpMedicalStatus` 124 KB gz | 首屏 < 1 MB gz | 把 `statisticsText`、`JpMedicalStatus` 這類非首屏模組改為使用時才載入 | 高 | 中 | PERF-1 |
| 未使用 JS | 【實測】Lighthouse 估可省 904 KiB | 少於 200 KiB | 同 PERF-1，依 coverage 找出可延後的模組 | 中 | 中 | PERF-3 |
| 文字壓縮 | 【實測】僅 gzip；`Accept-Encoding: br` 仍回 gzip；Lighthouse 估可省 51 KiB | 啟用 brotli | nginx 加 brotli（需模組）或讓 Cloudflare 邊緣壓縮 | 中 | 低 | PERF-2 |
| 伺服器回應 | 【實測】Lighthouse 根文件 430 ms；單次 curl TTFB 約 2.9 s（含 CF／Zeabur，僅參考） | TTFB < 600 ms | 確認 `index.html` 是否經 CF 邊緣快取（現為 `no-cache`，每次回源） | 中 | 低 | PERF-4 |
| preconnect | 【實測】Lighthouse 估可省 310 ms | 對 Mapbox、Supabase、CDN 提前連線 | `index.html` 加 `<link rel="preconnect">` | 低 | 低 | PERF-4 |
| 靜態資源快取 | 【實測】`/assets/*` 為 `max-age=31536000, immutable`；有 `nginxCachePolicy.test.ts` 守門 | 同現況 | 維持 | — | — | — |
| 現場指標 LCP/INP/CLS | 【未測】 | 有 CrUX／RUM 資料 | Search Console 的 Core Web Vitals 報表累積後看；或 PSI key | 中 | 低 | OPS-2 |
| 既有執行期效能 | 【讀碼】`docs/perf-audit-2026-09-30.md` 已做執行期優化（首屏 JS 8.61→6.2 MB 等） | — | 與本表為不同層面（執行期 vs 載入），不重複 | — | — | — |

### 2.2 無障礙

| 檢查項 | 現況 | 理想 | 建議 | 效益 | 工作量 | BACKLOG ID |
|---|---|---|---|---|---|---|
| Lighthouse 無障礙分數 | 【實測】0.94；唯一未過項為縮放限制 | ≥ 0.95 | 見下一列 | 中 | 低 | A11Y-1 |
| 縮放限制 | 【實測】viewport 含 `user-scalable=no`，Lighthouse `meta-viewport` 未過 | 允許縮放 | 移除 `user-scalable=no`；先確認地圖手勢（雙指縮放地圖）不受影響 | 中 | 低 | A11Y-1 |
| 對比、語言、連結文字 | 【實測】`color-contrast`、`html-has-lang`、`link-text` 皆過 | 同現況 | 維持 | — | — | — |
| 鍵盤與螢幕閱讀器操作地圖 | 【未測】 | 面板可鍵盤操作、重點資訊有文字替代 | 排一次人工走查 | 中 | 中 | A11Y-2 |
| 小字 | 【實測】Lighthouse 判定 16% 文字小於可讀字級（best-practices 的 `font-size`） | ≥ 60% 文字可讀 | 查是哪些元件（多半是圖例／標籤），與設計系統規格對照 | 低 | 中 | A11Y-3 |

### 2.3 最佳實務／安全

| 檢查項 | 現況 | 理想 | 建議 | 效益 | 工作量 | BACKLOG ID |
|---|---|---|---|---|---|---|
| Lighthouse best-practices | 【實測】0.96；未過：`font-size`、缺 source map | ≥ 0.95 | 缺 source map 屬刻意（不公開原始碼對映）時可忽略 | 低 | — | — |
| HTTPS | 【實測】http 會 302 到 https | 同現況 | 維持 | — | — | — |
| HSTS | 【實測】origin 無 `Strict-Transport-Security`（Cloudflare 邊緣設定【未驗】） | 啟用 HSTS | 先在 CF 查是否已開；沒有就開（先短 max-age 觀察） | 中 | 低 | SEC-1 |
| CSP | 【實測】enforcing 僅 `frame-ancestors *`（為了允許嵌入）；完整 CSP 仍是 Report-Only，含 `unsafe-inline`／`unsafe-eval` | 完整 CSP 強制 | 已有 BC-4 追蹤（先收 violation 再轉強制），此處不另開 | 高 | 中 | BC-4（既有） |
| Permissions-Policy | 【實測】未設定 | 限制不用的瀏覽器能力 | nginx 加 `Permissions-Policy`（camera／microphone 等關閉；geolocation 依產品需求） | 低 | 低 | SEC-2 |
| X-Frame-Options | 【實測】未設定，屬刻意（`frame-ancestors *` 以支援嵌入） | — | 維持；若日後收斂嵌入白名單再改 CSP | — | — | — |
| X-Content-Type-Options、Referrer-Policy | 【實測】`nosniff`、`strict-origin-when-cross-origin` | 同現況 | 維持 | — | — | — |

### 2.4 SEO

| 檢查項 | 現況 | 理想 | 建議 | 效益 | 工作量 | BACKLOG ID |
|---|---|---|---|---|---|---|
| Google 收錄 | 【實測】`site:` 零結果、品牌詞零結果 | 首頁與語言版本被收錄 | 補索引檔後到 Search Console 提交 sitemap（§3） | 高 | 低 | SEO-5 |
| robots.txt | 【實測】不存在，回 200 的首頁 HTML；Lighthouse 判 50 個語法錯誤 | 有效的 robots.txt＋Sitemap 行 | 新增 `public/robots.txt` | 高 | 低 | SEO-1 ✅ 本 PR |
| sitemap.xml | 【實測】不存在（回 200 首頁 HTML） | 列出首頁與語言版本、含 hreflang | 新增 `public/sitemap.xml` | 高 | 低 | SEO-1 ✅ 本 PR |
| meta description | 【實測】正式站（v2.8.0）沒有（Lighthouse 未過）；develop 已由 PR #607 補上，尚未發布 | 有 | 隨下次發布上線 | 中 | 低 | SEO-2 ✅ 本 PR（沿用 #607 並補完） |
| canonical、hreflang | 【實測】正式站皆無 | 有 | `index.html` 補 canonical 與 4 組 hreflang | 中 | 低 | SEO-2 ✅ 本 PR |
| title | 【實測】僅「Mini Taiwan Pulse」，無用途關鍵字 | 含用途 | 改為「Mini Taiwan Pulse｜台灣即時脈動地圖」 | 低 | 低 | SEO-2 ✅ 本 PR |
| 首頁可讀文字 | 【實測】body 只有空 `<div id="root">`，h1 數量 0 | 有 h1 與簡短說明 | `#root` 內放靜態說明，React 掛載後取代 | 高 | 低 | SEO-2 ✅ 本 PR |
| soft-404 | 【實測】`/robots.txt`、`/sitemap.xml`、`/about`、`/nonexistent-xyz` 全回 200 首頁 HTML；`/favicon.ico` 404 | 不存在的檔案回 404；真正的 SPA 路徑才回首頁 | nginx 讓「有副檔名但不存在」回 404 | 中 | 低 | SEO-3 ✅ 本 PR |
| 社群預覽圖 og:image | 【讀碼】`public/` 沒有適合的橫幅圖（現有截圖是舊介面或其他專案） | 1200×630 的站圖 | 需要一張圖（使用者提供或另做），補 og:image 與 `summary_large_image` | 中 | 低 | SEO-4 |
| 預渲染／可索引的內容頁 | 【實測】全站單一 URL，內容靠 JS | 重點說明頁有實體 HTML | 另做幾頁靜態「關於／資料來源／主題導覽」頁（或對首頁預渲染） | 高 | 高 | SEO-6 |
| 外部連結 | 【實測】只有第三方網站介紹 GitHub repo | 有來自 GitHub、社群貼文的連結 | README 與作者社群貼文放正式網址 | 低 | 低 | SEO-8 |

### 2.5 AEO

| 檢查項 | 現況 | 理想 | 建議 | 效益 | 工作量 | BACKLOG ID |
|---|---|---|---|---|---|---|
| 允許 AI 爬蟲 | 【實測】沒有 robots.txt（等於未表態） | 明示允許 GPTBot、ClaudeBot、PerplexityBot、Google-Extended 等 | `robots.txt` 逐一列出 | 中 | 低 | SEO-1 ✅ 本 PR |
| llms.txt | 【實測】不存在（回 200 首頁 HTML） | 依 llmstxt.org 格式說明網站、功能、資料來源與限制 | 新增 `public/llms.txt`（只寫可查證的內容，數字附來源或不寫） | 中 | 低 | AEO-1 ✅ 本 PR |
| 結構化資料 | 【實測】無 | WebSite＋WebApplication JSON-LD | `index.html` 加 JSON-LD | 中 | 低 | AEO-2 ✅ 本 PR |
| FAQ／問答型內容 | 【實測】無 | 「這個網站是什麼、資料哪來、怎麼用」有文字版 | 靜態「關於」頁加 FAQ（可配 FAQPage 標記） | 中 | 中 | AEO-3 |
| 資料集層級描述 | 【讀碼】圖層來源登記在 manifest 的 `upstream`，沒有對外的文字目錄 | 每個主題有可被引用的資料說明（含來源、授權、覆蓋範圍） | 從 manifest 產生 `llms-full.txt` 或資料目錄頁，標明覆蓋限制 | 中 | 中 | AEO-4 |
| 被 AI 引用的成效 | 【未測】 | 定期抽問 ChatGPT／Perplexity／Google AI 概覽並記錄 | 固定 3–5 題問答做基準，1–2 週後與數週後各測一次 | 中 | 低 | AEO-5 |

### 2.6 i18n

| 檢查項 | 現況 | 理想 | 建議 | 效益 | 工作量 | BACKLOG ID |
|---|---|---|---|---|---|---|
| 語言決定順序 | 【讀碼】`?lang=` ＞ localStorage ＞ `navigator.languages` ＞ zh-TW（`src/state/localeStore.ts`） | 同現況 | 維持 | — | — | — |
| 語言版本的 URL | 【讀碼】同一路徑，只靠 `?lang=en／ja` 區分 | 每個語言有獨立、可被收錄的 URL | 本 PR 先在 sitemap／hreflang 列出 `?lang=` 版本；爬蟲看不到內文前，hreflang 效益有限 | 低 | 低 | SEO-2 ✅ 本 PR |
| 英日文的可讀內容 | 【實測】靜態說明僅中文；說明文字在 JS 內 | 英日文頁也有實體文字 | 與 SEO-6 一起做（路徑式 `/en/`、`/ja/` 靜態頁） | 中 | 高 | SEO-7 |
| 瀏覽器語言自動切換 | 【讀碼】PR #607 已上（develop，未發布） | — | 注意：自動切換依瀏覽器語言，爬蟲通常用英文，可能看到非預設語言；canonical 固定指向預設 URL | 低 | — | — |

### 2.7 隱私

| 檢查項 | 現況 | 理想 | 建議 | 效益 | 工作量 | BACKLOG ID |
|---|---|---|---|---|---|---|
| 追蹤與分析工具 | 【讀碼】`src` 內無 GA／Sentry／Plausible 等（rg 僅命中 i18n 文字） | 同現況 | 維持；若日後加分析工具，需同步更新隱私說明 | — | — | — |
| 隱私說明頁 | 【實測】沒有 | 說明蒐集什麼、資料送到哪 | 新增靜態隱私說明（登入走 Supabase／Google；BYOK 對話金鑰留在瀏覽器、直連 LLM 供應商；Mapbox 會收到載圖請求） | 中 | 低 | PRIV-1 |
| 第三方請求揭露 | 【讀碼】CSP 的 connect-src 列有 Mapbox（含 events.mapbox.com）、Supabase、三家 LLM；實際請求清單【未逐一實測】 | 有清單且與隱私說明一致 | 用瀏覽器 network 面板列一次實際第三方 | 低 | 低 | PRIV-2 |
| Cookie 橫幅 | 【實測】無 | 若只用必要儲存則不需要 | 確認登入 session 與 localStorage 皆屬必要用途後，在隱私說明註明 | 低 | 低 | PRIV-2 |

### 2.8 可靠性

| 檢查項 | 現況 | 理想 | 建議 | 效益 | 工作量 | BACKLOG ID |
|---|---|---|---|---|---|---|
| 無 WebGL 時的畫面 | 【實測】`Failed to initialize WebGL` 後整個 `#root` 空白，沒有說明 | 顯示「需要 WebGL」的提示與替代連結 | 加 error boundary／初始化失敗提示；也讓爬蟲與少數裝置看到說明 | 中 | 低 | OPS-1 |
| 缺檔行為 | 【實測】`/assets/zzz.js` 回 404；其他不存在檔案回 200 首頁（見 SEO-3） | 缺檔一律 404 | 本 PR 處理副檔名情況 | 中 | 低 | SEO-3 ✅ 本 PR |
| favicon.ico | 【實測】`/favicon.ico` 404（頁面用 inline data URI 圖示） | 有實體檔，避免爬蟲與瀏覽器 404 | `public/` 放 `favicon.ico` 或 `favicon.svg` 並在 head 引用 | 低 | 低 | OPS-3 |
| 部署後舊分頁 | 【讀碼】無版本偵測 | 提示重新整理 | 已有 AG-10 追蹤 | 低 | 中 | AG-10（既有） |
| 外部監測 | 【未測】沒有 uptime／Search Console 告警 | 有 | 開 Search Console，必要時加簡單 uptime 檢查 | 中 | 低 | OPS-2 |

## 3. 下一步怎麼複測

1. **Search Console**：驗證網域（DNS TXT，需要使用者操作）→ 提交 `https://mini-taiwan-pulse.itsmigu.com/sitemap.xml` → 對首頁按「請求建立索引」。Bing Webmaster Tools 同理（可匯入 Search Console）。
2. **發布後立刻驗證**（本 PR 隨下一個版本上線後）：`curl -sI` 看 `/robots.txt`、`/sitemap.xml`、`/llms.txt` 是否為 200 且 Content-Type 正確、`/nonexistent.txt` 是否回 404；用 Google 的「Rich Results Test」貼首頁網址檢查 JSON-LD。
3. **1–2 週後重搜**：`site:mini-taiwan-pulse.itsmigu.com`、「Mini Taiwan Pulse」、「台灣 即時 地圖 開放資料」；記錄收錄頁數。
4. **Lighthouse／PSI**：本機可跑 `npx lighthouse@12.2.1 <網址> --chrome-flags="--headless=new" --output=json`（本次已成功，CHROME_PATH 指向本機 Chrome）；或到 Google Cloud 申請 PageSpeed Insights API key 後走 API。每次比較請用同一組設定、跑 3 次取中位數，並避開本機高負載。
5. **AEO**：固定 3–5 題（例如「台灣有沒有可以看即時航班與船舶的開放資料地圖」）問 ChatGPT、Perplexity、Google AI 概覽，記錄是否引用、引用了哪一頁（AEO-5）。

## 4. 本 PR 做了什麼

| 項目 | ID |
|---|---|
| `public/robots.txt`（允許全部，明示 AI 爬蟲，附 Sitemap） | SEO-1 |
| `public/sitemap.xml`（首頁＋`?lang=en／ja`，含 hreflang） | SEO-1 |
| `public/llms.txt` | AEO-1 |
| `index.html`：canonical、hreflang、og:url、title 加用途、JSON-LD、`#root` 內靜態說明與 noscript | SEO-2、AEO-2 |
| nginx：有副檔名但不存在的檔案回 404，SPA 路徑照舊回首頁 | SEO-3 |

**刻意沒做**：og:image（缺圖，SEO-4）、預渲染與內容頁（SEO-6）、效能拆包（PERF-1）。

## 5. ID 一覽

| 前綴 | ID | 一句話 | 本 PR |
|---|---|---|---|
| SEO | SEO-1 | robots.txt＋sitemap.xml | ✅ |
| SEO | SEO-2 | 首頁 meta、canonical、hreflang、靜態說明 | ✅ |
| SEO | SEO-3 | 不存在的檔案回 404 | ✅ |
| SEO | SEO-4 | og:image／twitter summary_large_image（待圖） | |
| SEO | SEO-5 | Search Console／Bing 提交與追蹤 | |
| SEO | SEO-6 | 預渲染或靜態內容頁 | |
| SEO | SEO-7 | 英日文實體頁（路徑式） | |
| SEO | SEO-8 | 外部連結（README、社群） | |
| AEO | AEO-1 | llms.txt | ✅ |
| AEO | AEO-2 | JSON-LD | ✅ |
| AEO | AEO-3 | 關於／FAQ 頁 | |
| AEO | AEO-4 | 資料目錄／llms-full.txt | |
| AEO | AEO-5 | 被引用成效基準測試 | |
| PERF | PERF-1 | 首屏 JS 拆包（statisticsText、JpMedicalStatus 等） | |
| PERF | PERF-2 | brotli | |
| PERF | PERF-3 | 未使用 JS 清查 | |
| PERF | PERF-4 | TTFB、preconnect | |
| SEC | SEC-1 | HSTS | |
| SEC | SEC-2 | Permissions-Policy | |
| A11Y | A11Y-1 | 移除 `user-scalable=no` | |
| A11Y | A11Y-2 | 鍵盤與螢幕閱讀器走查 | |
| A11Y | A11Y-3 | 小字清查 | |
| OPS | OPS-1 | 無 WebGL 提示 | |
| OPS | OPS-2 | Search Console／uptime／現場指標 | |
| OPS | OPS-3 | favicon.ico | |
| PRIV | PRIV-1 | 隱私說明頁 | |
| PRIV | PRIV-2 | 第三方請求清單與儲存揭露 | |

既有、不重複開的項目：BC-4（CSP 轉強制）、AG-10（舊分頁版本偵測）。
