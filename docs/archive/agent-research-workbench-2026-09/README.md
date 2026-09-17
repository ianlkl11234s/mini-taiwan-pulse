# Agent Research Workbench 文件封存（2026-09）

> 狀態：`ARCHIVED_REFERENCE`
> 這是歷史設計與本地驗收紀錄，不是目前主線的 SSOT，也不代表現行程式仍保有相同實作。

## 這是什麼

這批文件記錄 Mini Taiwan Pulse 曾經嘗試建立的資料分析工作流：以 `datasetId → analysis → resultId` 為主軸，讓圖層只負責呈現；MCP 限制可執行的資料操作，Semantic Registry 說明資料能代表什麼，Research Library 保存可重用的資料、方法、格網指標、結果與證據。

這個方向曾用學校點位、新聞事件與鄉鎮水田統計做本地 pilot，並進一步驗證學校點位轉 150 公尺方格、暫時性 Polygon 結果與主地圖顯示。後來產品主線已重新設計，因此本目錄只保留概念、方法、驗收邊界與互動說明，供未來選擇性取用。

## 封存來源

| 項目 | 值 |
|---|---|
| 原 branch | `codex/agent-research-workbench` |
| 完整文件 snapshot | `2e66aee8075c91597944d9711c9e6a11e33746a3` |
| Roadmap 初版 | `cac52022` |
| 淺白互動指南 | `cf7e29de` |
| Research Library 接手點 | `a8ce9657` |
| 主地圖學校格網結果 | `1664e179` |
| 最後驗收紀錄 | `2e66aee8` |
| 封存日期 | 2026-09-18 |

`snapshot/` 內 27 個檔案是上述 commit 的原樣複本。封存沒有搬入 `src/` 程式、資料 bundle、登入設定、runtime、secret 或部署內容；也排除了原本用於產生盤點的可執行腳本 `inventory/layer-inventory-ast.mjs`。

## 建議閱讀順序

1. [淺白 Roadmap](./snapshot/gis-analysis-roadmap-guide.html)：用互動方式理解元件、里程碑與可回答的問題。
2. [GIS 分析總路線圖](./snapshot/gis-analysis-roadmap.md)：系統支柱、分析循環、里程碑與治理方式。
3. [工具基礎計畫](./snapshot/tool-foundation-plan.md)：資料契約、query executor、tool families 與 adapter 邊界。
4. [最新 Handoff](./snapshot/handoff.md)：當時實際做到哪裡，以及各階段的歷史脈絡。
5. [Acceptance](./snapshot/acceptance.md)：真實跑過的資料 readback、測試、browser 證據與限制。
6. [Inventory 索引](./snapshot/inventory/README.md)：當時的圖層／資料族群盤點，只能視為 2026-09 的快照。

工程視角的互動圖另見 [GIS roadmap interactive](./snapshot/gis-analysis-roadmap-interactive.html) 與 [tool foundation interactive](./snapshot/tool-foundation-interactive.html)。

## 當時已證明的部分

- 建立 `DatasetDescriptor`、`SourceReceipt`、`ResultEnvelope` 與有 budget／receipt 的共用 query executor。
- 用真實 schools GeoJSON 驗證點位查詢；4,315 筆來源紀錄不等於 4,315 所獨立學校。
- 建立 schools／news／paddy 的 Semantic Registry 本地 MVP，保留 observed／derived／proxy／hypothesis 與 missing／suppressed／zero 的差異。
- 將 4,315 筆學校來源紀錄聚合為 4,061 個有紀錄的 150 公尺方格，並保存來源、方法與結果 lineage。
- 在本地主地圖呈現暫時性 Point／Polygon 分析結果，保留 `resultId` 與清除生命週期。

以上是歷史 branch 的本地證據，不等於目前主線已具備，也不等於正式環境已上線。

## 當時仍未完成的部分

- 新聞非空真實樣本與版本相符的行政區 boundary join。
- 通用、任意輸入的 Grid/H3 executor；當時學校格網仍是有界 pipeline。
- 學區、人口、實價登錄的合格分析資產與跨尺度 crosswalk。
- 經驗證的步行／駕車路網 engine、profile、topology、unreachable 與 isochrone／coverage。
- 多人／雲端 Research Library、正式配對端到端、mobile、production 部署與監控。

文件中的 `COMPLETE`、`PARTIAL` 或「已完成」都只適用於該歷史 snapshot 明列的驗收範圍；不能直接沿用為現在的進度。

## 未來取用規則

- 先看概念與驗收門檻，再依目前架構重新實作；不要直接把舊 branch 整批 merge 或 cherry-pick 回主線。
- 若採用其中一項設計，應在目前主線建立新的 active 文件，重新核對資料版本、來源、授權、geometry、時間、缺值與 browser／production 證據。
- 直線距離不得改稱步行可達；格網不得取代原始 geometry；圖層可見、build 成功或 HTTP 200 不代表資料完整可分析。
- `snapshot/` 保持歷史原貌；新的決策與修正應寫在現行 feature 文件，而不是回頭改寫這份封存。

## 完整性與追溯

需要核對封存內容時，以來源 commit 為準：

```bash
git diff --no-index \
  docs/archive/agent-research-workbench-2026-09/snapshot/gis-analysis-roadmap.md \
  <(git show 2e66aee8:docs/features/agent-research-workbench/gis-analysis-roadmap.md)
```

原 worktree 的 `/private/tmp/...` 路徑與未進 Git 的 runtime evidence 不保證仍存在；本封存只承諾保存已提交的文件與文件內記錄的歷史證據。
