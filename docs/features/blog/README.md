# Pulse 筆記（/blog）

> **Slug**：`blog`
> **狀態**：active（已合 develop，尚未發布到正式站）
> **Owner**：migu
> **相關 PR**：#670（文章專區＋第一篇）、#673（地圖站入口）
> **寫文章**：照 [`.claude/skills/blog-writing/SKILL.md`](../../../.claude/skills/blog-writing/SKILL.md)；要寫哪些看 [article-plan.md](./article-plan.md)

## 一句話說明

把 Threads 上的開發日記整理成長文，放在同網域 `/blog/`。每篇文章有獨立網址，build 時產生靜態 HTML，搜尋引擎和不跑 JS 的 AI 爬蟲（GPTBot、ClaudeBot、PerplexityBot）都讀得到全文。目的是 SEO 與 AEO。

## 為什麼不做成地圖上的彈窗

2026-10-23 研究與使用者拍板（方案 B）：

- 彈窗或 hash 網址的內容沒有獨立 URL，Google 無法逐篇收錄（Google Search Central〈JavaScript SEO basics〉）。
- GPTBot、ClaudeBot、PerplexityBot 不執行 JavaScript（Vercel〈The rise of the AI crawler〉，2024-12），只用 CSR 渲染的內文對它們等於看不見。
- 子目錄比子網域好管理，權重也累積在同一個網站。

## 網址與檔案

| 網址 | 來源 | 說明 |
|---|---|---|
| `/blog/` | 產生器 | 列表頁：主題分頁＋最新精選＋依主題分區 |
| `/blog/<topic>/` | 產生器 | 主題頁（只有已有文章的主題才產生） |
| `/blog/<slug>/` | `content/blog/<slug>.md` | 文章頁（網址不含主題；slug 不可與主題 id、`about` 等保留名撞） |
| `/blog/about/` | 產生器 | 關於作者（ProfilePage） |
| `/blog/feed.xml` | 產生器 | RSS（寫到 gitignored 的 `public/blog/feed.xml`） |
| `/blog/<slug>/*.jpg` | `public/blog/<slug>/` | 文章圖片，原樣複製 |

**網址是契約**：文章 `slug` 定了就不要改（外部連結與搜尋收錄會斷）。文章網址不含主題，所以文章換主題不影響連結；主題頁 id 改了要在 nginx 加 301。

**主題**（2026-10-24 由六類收斂成三類，依「文章在做什麼」分）：`layers` 圖層、`analysis` 分析與模擬、`making` 製作筆記。v2.13.0 發布過的 `/blog/rail/…` 由 nginx 301 到新網址。

## 關鍵檔案

| 檔案 | 作用 |
|---|---|
| `src/blog/generator.ts` | Markdown → 靜態 HTML；front matter 解析、目錄、FAQ、JSON-LD、```map 區塊、列表／主題／關於頁、RSS |
| `src/blog/topics.ts` | 主題登記（id、中文名、說明；順序＝列表頁分區順序） |
| `src/blog/blog.css` | 版型（左側目錄＋正文）、淺深色、卡片；只用 design token（spec §3.13a PROSE 字級） |
| `public/blog/blog.js` | 主題切換、目錄高亮、嵌入地圖補 `style=`、複製連結（外部檔，CSP 不開 inline script） |
| `vite.config.ts` | `generateBlog()` 產出 `<root>/blog/**`（gitignored）並加進 rollup input |
| `nginx.conf` `location ^~ /blog/` | 缺頁 404、無結尾斜線 301（相對 Location）、安全標頭與 CSP |
| `public/sitemap.xml`、`public/llms.txt` | 每篇、每個主題頁都要登記（測試會檢查） |
| `src/blog/__tests__/blog.test.ts` | 契約測試 |
| `src/components/IconRailSidebar.tsx` `RailLink`、`App.tsx` 手機 ⋯ 選單 | 地圖站入口，帶 `?theme=dark|light` |

## 文章 front matter

```yaml
---
title: 標題（含搜尋關鍵字，32 字內）
description: 120 字內摘要（搜尋結果與分享卡）
slug: taiwan-rail-realtime-map      # 小寫英數與連字號，檔名必須是 <slug>.md
topic: layers                       # layers｜analysis｜making（src/blog/topics.ts）
series: 軌道地圖                     # 選填；同系列 ≥2 篇才顯示系列導覽
date: 2026-02-02                    # 發布日（多半是 Threads 正式分享那天）
updated: 2026-10-23                 # 最後實質修改日
tags: [開發日記, 時刻表]             # 不要重複主題名
cover: cover-dark.jpg               # public/blog/<slug>/ 底下
coverLight: cover-light.jpg         # 選填；淺色主題用
coverAlt: 封面替代文字
mapLink: "/?v=1&lng=…&lat=…&z=…&layers=rail&style=dark"   # 封面下「在地圖上打開這個畫面」
threads:                            # 原始 Threads 串，文末自動列出
  - https://www.threads.com/@ianlkl1314/post/…
---
```

## 內文特殊語法

- `## 小節`：自動進左側目錄（只收 h2）。
- `## 常見問題` 底下的 `### 問題` ＋段落：自動產生 FAQPage 結構化資料（AI 摘要常引用）。
- 圖片：`![圖說](檔名.jpg)`，檔案放 `public/blog/<slug>/`，找不到會在 build 時警告並略過。
- 互動地圖：

  ````markdown
  ```map
  src: /embed?v=1&lng=121.53&lat=25.05&z=11.3&layers=rail&rsys=trtc&date=2026-08-06&h=8&p.speed=30
  caption: 圖說（寫明回放日期與倍速）
  height: 460
  ```
  ````

  - 只接受站內 `/embed?v=1&…`；`style=` 由 blog.js 依主題補上，`lang=zh-TW` 由產生器補上。
  - 圖說下方自動加「在完整地圖打開」（主站網址，去掉 `rsys`／`p.*`）。

## 嵌入地圖的限制（2026-10-23 實測）

- 回放圖層（rail、flights、ships）**必須帶 `date=`**，而且那天要有快照 `/embed-snapshots/<layer>/<date>.json.gz`。目前正式站確認有的是 **rail、ships 的 2026-08-06**。
- 新的快照日期要用 `scripts/export/export-embed-snapshot.sh <layer> <date>` 產生，再走 deploy-assets 上傳（屬正式部署資產，要使用者同意）。
- 回放預設約 90 秒播完一天（約 960 倍速）。使用者覺得太快，文章一律帶 `p.speed=30`。
- `h=` 指定起始小時；不帶會從 00:00 開始，深夜幾乎沒車。
- 鐵路可用 `rsys=` 只顯示某些營運者或線路（代碼表見 `docs/features/embeddable-map/README.md`）。
- 嵌在 iframe 時，嵌入版會開協作手勢（單指捲頁面、雙指移動地圖），見 PR #670 的 embed commit。

## 淺深色

優先序：網址 `?theme=dark|light`（從地圖點進來時依底圖帶上）→ 讀者按過的切換鈕（localStorage `mini-taiwan:blog-theme:v1`）→ 系統設定。地圖本身沒有全站主題，只有底圖（`isDarkTheme = !["light","streets"].includes(style)`）。

## 本機預覽

```bash
npm run build && npx vite preview --port 4399
# 開 http://localhost:4399/blog/
```

- worktree 沒有 `.env` 時，本機 build 的主站地圖是空白的。blog.js 在 localhost 會把「回到地圖」與嵌入地圖改連正式站，方便預覽。
- `npm run dev` 也能看，但改文章後要重啟（產生器只在 vite 啟動時跑）。

## 待辦

- 發布到正式站（develop → master 由使用者拍板）後，到正式站驗收：文章、列表、主題頁、關於頁、RSS、301／404、嵌入地圖手勢。
- 首頁 `index.html` 的靜態說明可以加一個 `/blog/` 連結，讓爬蟲從首頁就找得到。
- Search Console 提交 sitemap（使用者操作）。
