# Changelog — land-subsidence

> 逐 PR 變更紀錄。最新在上。

---

## 2026-10-17 — 首批 PR #628（merge f4d207fd，2026-10-17）

- 水資源新群組「地層下陷與海堤」4 層：測站 112 點、累積／速率等值線 696 條（單一 PMTiles，z9 起完整）、一般性海堤區域 239 面；資料放 `public/hazards/`
- 測站彈窗：RPC `get_land_subsidence_timeseries`（mig 474）月平均 10 年趨勢；GNSS 相對首月 mm、磁環可換環、深層樁標單位未註明、0 筆顯示「無監測資料」
- 污染潛勢設施彈窗新增「毒化物運作」區塊（EMS_S_05 依 emsno 聚合的分片 lookup，資料期至 115 年第 2 季，命中 6,531 個設施）
- 瀏覽器驗收（port 6012，agent-browser）：4 層顯示、圖例、測站三類彈窗含趨勢圖、兩種等值線彈窗、海堤彈窗、污染設施毒化物區塊中英文、console 無 page error
- Breaking：無（golden 只新增 4 層）
