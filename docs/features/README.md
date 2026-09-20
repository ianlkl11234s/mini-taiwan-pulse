# Feature 文件索引

每個資料夾對應一個可獨立理解、驗收或交接的 feature／working area。這裡保存長期契約；
全站短期進度與 backlog 仍由 `.claude/memory` 的索引管理，不在 feature 文件複製流水帳。

## 最小文件契約

- `README.md`：active/shipped feature 必備，說明用途、runtime 路徑、資料來源與驗收方式。
- `handoff.md`：有跨 repo 資料契約或需要接手時必備。
- `backlog.md`：有未完成工作時才建立；完成後可保留決策與明確的 done/closed 狀態。
- `changelog.md`：需要逐 PR 保存設計脈絡時使用，不強制每個 feature 建空檔。

舊資料夾可能只有 handoff/backlog；巡檢會列為文件債，但不得為了湊模板建立空文件或刪除歷史。

## 命名與生命週期

- folder 使用 kebab-case，盡量與上游 dataset/handoff slug 一致。
- 文件開頭標示 `active`、`shipped`、`paused` 或 `historical`，避免舊計畫被誤認為現行規格。
- 現行規則與歷史紀錄衝突時，以 `CLAUDE.md`、`docs/development-rules.md`、manifest 契約測試為準。
- 需要封存時移到 `docs/archive/`，並保留原路徑的索引或導向；不要直接刪除。

## 建立新 feature

從 [`_TEMPLATE`](./_TEMPLATE/) 取用需要的檔案，不必機械式複製全部。至少補齊：

1. source / snapshot time / coverage / missingness / geometry semantics
2. runtime access（RPC、R2/CDN、GeoJSON、PMTiles 或 custom）
3. frontend wiring（manifest key、loader、hook、overlay、legend、popup）
4. local test、browser/network、deployment/production 的分開驗收證據

目前資料夾清單與缺件由 `scripts/audit/weekly/check_docs.ts` 掃描，避免在本頁維護容易漂移的
手寫總表。重要入口：

- [Layer Manifest](./layer-manifest/)
- [Japan core layers](./jp-core-layers/)
- [Japan height layers](./jp-height-layers/)
- [Taiwan statistics](./taiwan-statistics/)
- [Social statistics](./social-statistics/)
- [Global events](./global-events/)
- [Research workbench](./agent-research-workbench/)
