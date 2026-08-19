# Backlog — 登山安全 Mountain Safety

> 本 feature 的待辦。編號 MS-*。

## Active work（進行中／待辦）

- [ ] **MTS-1** · `research` · P2 · `ready`：事故熱區 vs 通訊點覆蓋的量化分析（哪些事故點 500m 內無通訊點）——
      目前只能靠人眼疊圖看；要量化得走 `accessibility-analysis` skill 的路網/格點模式
- [ ] **MTS-2** · `data-health` · P2 · `waiting_external`：山屋容量 vs 週邊事故密度的關聯圖層（先確認 capacity 覆蓋率）
- [ ] **MTS-3** · `product` · P2 · `ready`：`cause` × `mountain_area` 的 Top 10 危險路段排行；Next action：先定義排行分母與顯示位置；Acceptance：分析結果與 browser/popup evidence。

## Decision needed

- MTS-3 的排行是 monitor 面板或 popup 補充，需 owner 先選呈現位置。

## Completed / historical（已完成／歷史）

- [x] **MS-0**：`mountainRescueIncidents` + `mountainHuts` 兩層已在 source/README/handoff 對齊（2026-08-02）；PR 編號在本 repo 無法確認，保留 verifying release evidence，不填 placeholder。

## Verifying

- **MS-0-RELEASE** · `release` · P1 · `verifying`：PR/production browser evidence 未在本 repo 文件中可核對；Next action：以 git/PR 與正式資產 HTTP evidence 補齊；Acceptance：PR merge、asset 200、兩層 browser。

## Explicitly not planned（明確不做）

- **年度時序回放**：上游 handoff 建議「時間欄可接時序回放」，本次刻意不做——
  全域時間軸是即時/當日語意，年度歷史掛上去語意不合。若日後真要做，應比照
  `earthquakeReplay` 另開獨立回放控制，而不是塞進 timeStore。
- **「登山安全」一鍵情境 preset**：本站無 preset 機制，不為單一敘事新建（最小方案原則）。
  組合開法寫在 README。若之後有 3 個以上敘事都需要，再考慮通用機制。
