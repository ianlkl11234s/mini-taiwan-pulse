# AGENTS

本專案規則 SSOT 是 [`CLAUDE.md`](./CLAUDE.md)，請直接讀它。
本檔僅為各家 agent 的入口指標，不維護規則副本（避免漂移）。

## Astra／Terra／Luna 協作

主 agent 負責範圍、跨模組決策、整合與驗收；只有明確可獨立的盤點、搜尋或有界實作才委派。Astra／Terra／Luna 的角色、最少脈絡與停止條件以工作區 [`../CLAUDE.md`](../CLAUDE.md) 為準。

## Code Review Rules

- GIS 與統計資料修改必須保留 source、時間、license/status、缺值／抑制／零值、filter 與 geometry precision 語意；HOLD 或授權不明資料不得被接成可用圖層。
- 動態圖層不得因時間 state 進入不必要的 effect dependency 而重複載入；所有 async loader 必須接上既有 loading registry，並在卸載或切換時正確取消／忽略過期結果。
- 新增或修改圖層時，檢查 manifest、catalog、hook/host、overlay/click registry、popup 與 visibility default 是否一致；若上游契約與前端 readback 不一致，應回報為阻擋性問題。
