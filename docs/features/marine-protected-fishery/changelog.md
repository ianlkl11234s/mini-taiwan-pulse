# Changelog — marine-protected-fishery

> 逐 PR 變更紀錄。最新在上。

---

## 2026-10-17 — 首批（PR #624，併入 develop 後補 merge hash）

- 新增海洋 › 海域保護與漁業 7 層（面 4、點 3），資料檔 git 追蹤、dist 供檔
- 海岸地區範圍切 PMTiles（0.9MB，z5–12，依面積設 feature minzoom，逐 zoom 稽核通過）；7 面退化面（< 1 m²）不上圖
- atlas 框架小擴充：`build-atlas-public.py` 的 PMTiles spec 可帶 `extra_flags`；`AtlasLegend` 可帶非 OGDL 的 `license`
- 彈窗「資料日期」只放日期（上游 vintage 句子含欄名與內部註記，不上前端）
- 瀏覽器驗收（port 6012，agent-browser）：7 層皆顯示、7 個 popup 中英文、圖例（含定置漁業權區非 OGDL 授權列）、console 無 page error
- Breaking：無（golden 只新增 7 層）
