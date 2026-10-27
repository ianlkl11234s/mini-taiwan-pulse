---
name: blog-writing
description: 撰寫與更新 Mini Taiwan Pulse 的部落格長文（/blog/，Pulse 筆記）。當使用者說「寫下一篇文章」「把 Threads 貼文整理成長文」「新增部落格文章」「更新文章」「部落格加一篇 X」「文章計劃」時使用：從計劃列表挑題、抽 Threads 素材、查證數字、寫 Markdown、拍截圖與嵌入互動地圖、登記 sitemap、本機預覽給使用者看，最後更新計劃列表。本 skill 不做：改部落格版型或產生器程式（直接改 src/blog/，規則見 docs/features/blog/README.md）、發 Threads 貼文（threads-api skill）。
---

# Pulse 筆記寫作流程

正本文件：
- 架構、front matter、語法、嵌入地圖限制 → [`docs/features/blog/README.md`](../../../docs/features/blog/README.md)
- 要寫哪些、進度 → [`docs/features/blog/article-plan.md`](../../../docs/features/blog/article-plan.md)

本檔只寫流程與踩過的坑，不重抄上面兩份。

## 1. 選題

1. 讀 `article-plan.md`，依「建議順序」挑一篇（使用者有指定就照指定）。
2. 主題只有三類，依「文章在做什麼」分（`src/blog/topics.ts`）：`layers` 圖層（把資料畫成地圖）、`analysis` 分析與模擬（用資料問問題）、`making` 製作筆記（怎麼做出來的）。不要為單一資料種類新增主題；真的三類都放不下，先問使用者。
3. 用一則訊息跟使用者確認：標題方向、主題、要不要嵌入地圖。附上建議值，讓使用者一句「照建議」就能帶過。

## 2. 開分支

從最新 `origin/develop` 開 worktree，不要在別人的分支上做：

```bash
git fetch origin
git worktree add -b docs/blog-<slug> .worktrees/blog-<slug> origin/develop
ln -s ../../node_modules .worktrees/blog-<slug>/node_modules
```

之後的指令一律用絕對路徑或 `git -C`，不要 `cd` 進 worktree。

## 3. 抽素材

- Threads 貼文：`../knowledge-radar/threads/data/posts/*.jsonl`（以 `id` 去重；只有部分貼文有 `text`）。依計劃表的日期範圍抽出原文，存到 scratchpad，不要整包貼進對話：

  ```bash
  python3 - <<'PY'
  import json, glob
  seen, rows = set(), []
  for f in glob.glob("../knowledge-radar/threads/data/posts/*.jsonl"):
      for line in open(f):
          p = json.loads(line)
          if p["id"] in seen or not p.get("text"):
              continue
          seen.add(p["id"]); rows.append(p)
  rows.sort(key=lambda p: p["timestamp"])
  for p in rows:
      if "2026-02-13" <= p["timestamp"][:10] <= "2026-02-14":   # ← 改成計劃表的日期
          print(f'## {p["timestamp"][:10]} · {p["permalink"]}\n{p["text"]}\n')
  PY
  ```

- 計劃表的素材範圍晚於最後同步日（2026-08-28）時，先用 `threads-api` skill 增量同步。
- 作者口吻：`../knowledge-radar/threads/STYLE.md`（第一人稱、轉折用「但」、技術細節具體到名詞和數字、不用 emoji）。長文可以有正常的句號與段落。

## 4. 查證數字（不可省）

- 文章裡每個數字、日期、名稱都要有出處：repo 文件、git log、資料檔筆數、程式常數。貼文說的數字也要回頭對一次。
- 查不到的不要編，也不要「合理推估」。草稿裡寫 `〔待確認：…〕`，交給使用者確認後才能發布。
- 同一件事出現不同數字時（例：台鐵 907／928／992 班），寫明口徑與時間點，或乾脆不用。
- 查證量大時派 subagent，要求回報「數字 → 出處檔案:行號／commit」對照表。

## 5. 寫 Markdown

檔案：`content/blog/<slug>.md`，front matter 欄位見 README。

- **開頭兩三句就回答「這是什麼、在哪裡看」**，AI 摘要最常引用開頭。
- 內文 1,800–3,000 個中文字，分 4–6 個 `##` 小節（自動進左側目錄）。
- 最後一節前放 `## 常見問題`，3 題，每題用 `### 問題` 加一段答案（自動產生 FAQ 結構化資料）。
- 標題含搜尋關鍵字（計劃表有列），32 字內；`description` 120 字內。
- 不出現內部名稱：程式識別字、資料表名、檔名、圖層 key。
- 文末不要自己放 Threads 連結，版型會依 `threads:` 自動列出。
- `tags` 不要重複主題名。

## 6. 圖片與嵌入地圖

**截圖**：用 agent-browser 拍正式站。

- Bash 要帶 `dangerouslyDisableSandbox: true`，參數用 `--args "--use-gl=swiftshader,--enable-unsafe-swiftshader"`，每個 agent 用自己的 `--session` 名稱，用完要 `close`。
- zsh 把指令存進變數時要寫成 `${=A}`，否則參數不會拆開。
- 開頁後點右上「Capture mode」收起介面，等約 12 秒再拍。
- 規格：1600×900 JPEG、每張小於 400 KB（用 `sips -s format jpeg -s formatOptions 82`、`sips -Z 1600`）。
- 存到 `public/blog/<slug>/`。封面要拍深色、淺色兩張（`style=dark`／`style=light`）。
- 縮放到 z7 時列車、船這類小點幾乎看不到；封面用 z8 以上，或改用局部畫面。

**嵌入地圖**：用 ```` ```map ```` 區塊，語法見 README。

- 回放圖層要帶 `date=`，而且那天要有快照。正式站目前有 rail、ships 的 2026-08-06（先 `ls public/embed-snapshots/<layer>/` 並 `curl -sI` 正式站確認 200）。沒有快照就不要嵌回放圖層，改嵌靜態圖層或用截圖。
- 船舶在嵌入版 z9 以下幾乎看不到點，改用 z9.5 左右的港口構圖，或疊 `maritimeBoundary` 等靜態圖層給全景脈絡。
- 要產生新的快照日期，先問使用者。產生與上傳屬於正式部署資產。
- 一律帶 `p.speed=30` 和 `h=8`（使用者 2026-10-23 拍板 30 倍速），圖說寫明回放日期與倍速。
- 一篇最多 2～3 張嵌入地圖，每張都要載入地圖程式。

## 7. 登記

- `public/sitemap.xml`：加文章網址 `/blog/<slug>/`；該主題的第一篇，再加主題頁 `/blog/<topic>/`。
- `public/llms.txt` 的「文章（Pulse 筆記）」段落加一行。
- `CHANGELOG.md` 在 `## [Unreleased]` 底下加一行（沒有「### 新增」就自己新增）。合併 develop 之後要再確認這行還在 Unreleased 底下。

## 8. 驗證與給使用者看

以下指令都要針對文章 worktree 執行（不 `cd`，所以每條都指定位置；漏掉會測到主 checkout）。`WT` 代表 worktree 的絕對路徑 `<repo>/.worktrees/blog-<slug>`：

```bash
npx vitest run --root "$WT" src/blog src/map/__tests__/seoAssets.test.ts
npm --prefix "$WT" run build          # 有 [blog] 警告（找不到圖片）要處理
npm --prefix "$WT" run preview -- --port 4399   # 背景執行
```

- `open http://localhost:4399/blog/<slug>/`，直接在使用者的瀏覽器打開。不要只丟截圖路徑，使用者要看實際網頁。
- 自己再用 agent-browser 拍深色、淺色、手機 390px 三張，確認沒有橫向捲動、圖片和地圖都有出現。
- `curl` 原始 HTML，確認內文第一段在裡面（不靠 JS 渲染）。
- 本機的「回到地圖」與嵌入地圖會連到正式站（worktree 沒有 `.env`，本機地圖是空白的）。這是預期行為，要先跟使用者說明。
- 使用者要調整就改，改完重新 build、重開 preview。

## 9. 送出與收尾

- 使用者說可以發 PR 才 commit 和開 PR（base `develop`）。說「推到 develop」才合併。
- 開 PR 後、等 CI 前，先查 `gh pr view <n> --json mergeable`。結果是 `CONFLICTING` 時 CI 不會跑，要先合併 develop、解完衝突再推，不要空等。衝突最常出在 CHANGELOG。
- 合併後更新 `article-plan.md`：狀態、PR 編號、更新紀錄一行。新發現的素材或點子加進候選。
- 發布到正式站（develop → master）要使用者另外拍板。發布後到正式站開文章頁驗收。

## 常見問題

- **文章網址要改？** 不要改。已發布的 slug／topic 改了，外部連結和搜尋收錄都會斷。真的要改，先問使用者，並在 nginx 加 301。
- **同一主題要連載？** front matter 加同一個 `series:`，同系列達 2 篇才會顯示系列導覽。
- **舊文章要更新？** 改內文並把 `updated:` 改成今天，Google 會看這個欄位。小錯字不用改日期。
