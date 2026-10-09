# Changelog — 日本氣象廳即時圖層

> 逐 PR 變更紀錄。最新在上。

## 2026-10-09 — 首批 4 層（PR 待併入 develop；尚未部署正式站）

- 日本 tab 新增主題「氣象防災」（併入大分類「自然與環境」）：AMeDAS 即時觀測、警報・注意報、地震（近 7 天）、火山警戒
- 警報 choropleth 沿用 `jp_admin_boundaries.pmtiles`，class20 前 5 碼對 admin_code，政令市分區整市著色
- NULL 一律中空點／「無觀測」，積雪模式只畫有積雪計的站
- Breaking：無（golden 只新增 4 key；日本主題數測試 14 → 15）
