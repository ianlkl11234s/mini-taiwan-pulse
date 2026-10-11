# AGENTS

本專案規則 SSOT 是 [`CLAUDE.md`](./CLAUDE.md)，請直接讀它。
本檔不維護一般開發規則副本；下方 `Code Review Rules` 是原生 Codex GitHub review 的必要整合入口，只保留高風險檢查。

## Astra／Terra／Luna 協作

主 agent 負責範圍、跨模組決策、整合與驗收；只有明確可獨立的盤點、搜尋或有界實作才委派。Astra／Terra／Luna 的角色、最少脈絡與停止條件以工作區 [`../CLAUDE.md`](../CLAUDE.md) 為準。

## Code Review Rules

- GIS 與統計資料修改必須保留 source、時間、license/status、缺值／抑制／零值、filter 與 geometry precision 語意；授權明確受限的資料不得被接成可用圖層；授權未標示與 HOLD 候選的處理見下方「已決定、不需再提的事項」。
- 動態圖層不得因時間 state 進入不必要的 effect dependency 而重複載入；所有 async loader 必須接上既有 loading registry，並在卸載或切換時正確取消／忽略過期結果。
- 新增或修改圖層時，檢查 manifest、catalog、hook/host、overlay/click registry、popup 與 visibility default 是否一致；若上游契約與前端 readback 不一致，應回報為阻擋性問題。

### 已決定、不需再提的事項

- 政府來源頁未標示授權的資料照常上線，來源卡標「授權待確認」即可，不要求隱藏、降級或排除出分析倉庫。
- HOLD 候選圖層一進分析倉庫即視為放行（`scripts/research/build-layer-status.mjs` 現行行為）。
- Google 定位或 Google Places 推得的座標維持現狀，不要求額外標注或改授權欄。
- UI 與地圖樣式以 `docs/design-system/spec.md`、`docs/design-system/map-layers.md` 為準，規格允許的做法不再提；鏡頭自動 fit 上限 zoom 16 是刻意設計。
- 分析口徑：未涵蓋 ≠ 0，必要的資料限制但書都要寫；`ds_poi_medical` 是已接受來源。
- 正本在 gis-agent-system reports/code-review/POLICIES.md。
