# Backlog — education-layers

> 教育主題 9 個上游 dataset、17 個圖層已 shipped。實作、部署、資料量與 browser 驗收歷史見 [changelog.md](./changelog.md)；本檔只保留 current residual。

## Active work（進行中／待辦）

- 暫無。

## Conditional / triggered later

- **EDU-14** · `tech-debt` · P3 · `conditional`：現行 `cram_schools` z8–z14 抽稀、z15 完整；2026-08-09 owner 已拍板維持抽稀＋圖例說明，不重切。
  - Trigger：owner 因明確使用者回饋重新開啟決策。
  - Next action：在上游重切 POC 後，對照 3.80MB 現行檔、10.63MB 無抽稀檔的容量、低 zoom 可讀性與 browser 效能。
  - Acceptance：owner 新決策、可重現的切片參數、驗收與部署證據。

## Decision recorded / explicitly not planned

- `cram_schools` 現階段不取消抽稀；不得再以 unchecked active item 表示。
- 不新增全國校園聚合多年 replay；除非出現新產品需求，應另開有 owner 與 trigger 的項目。

## Completed / historical

- PR #116、S3 education assets、W1–W3、EDU-9/10/11/13 與相關負向驗證已完成；完整證據只保留在 [changelog.md](./changelog.md) 與 git history。
