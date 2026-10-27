# Status

**最後更新**：2026-10-24 v2.13.0（Pulse 筆記文章專區、臺北市局處統計 11 層）

> 本檔只重寫當前 checkpoint；舊段落在 [`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

## 2026-10-24：v2.13.0 Pulse 筆記文章專區

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #670（`/blog/` 靜態文章專區＋第一篇〈台灣軌道即時地圖〉＋PROSE 字級＋嵌入版協作手勢＋nginx `/blog/`）、#673（地圖站 rail／手機 ⋯ 入口）、#675（blog-writing skill＋文章計劃）、#678（單張封面淺色消失、外站圖片改 build 報錯）、#679（臺北市污水新舊口徑切換）→ #680 版號 → #681 develop→master；tag `v2.13.0`＋GitHub Release。同包帶上另一 session 的臺北市局處統計（#664、#671、#674）與首頁隱私連結（#668）；原 v2.12.2 未發布（#669 關閉、#677 退回 Unreleased），內容併入本版。POC 草稿 #426–#428 未發。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| `/blog/` 文章專區 | done：CI 綠 | done：`src/blog/__tests__/blog.test.ts`；本機 nginx 實測 301／404／CSP | done：develop `c3e91b2c` | N/A（靜態站隨容器 build，無獨立資產上傳） | N/A | N/A（Zeabur 自動部署） | done：master `9f58ac6a` | done：正式站 `main-0HytoUDk.js` 含 "2.13.0"；文章／列表／關於／RSS 200、`/blog/nope/` 404、`/blog/rail` 301 | done：正式站文章頁目錄高亮、台北捷運嵌入地圖有列車（30 倍速） |
| 地圖站入口 | done | N/A | done | N/A | N/A | N/A | done | done | done：rail 連結 `/blog/?theme=dark` |
| 臺北市局處統計＋污水修正 | done：CI 綠 | done：合約與切換測試 | done | N/A | N/A | N/A | done | not run | not run（BACKLOG BLOG-V） |

- 下一步：寫第二篇（BACKLOG **BLOG-1**，流程 `.claude/skills/blog-writing/SKILL.md`，清單 `docs/features/blog/article-plan.md`）；正式站補驗（**BLOG-V**）。
- 文件：`docs/features/blog/README.md`（網址契約、front matter、```map 語法、嵌入快照限制）。
