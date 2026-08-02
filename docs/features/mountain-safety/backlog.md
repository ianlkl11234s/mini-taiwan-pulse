# Backlog — 登山安全 Mountain Safety

> 本 feature 的待辦。編號 MS-*。

## 待辦

- [ ] **MS-1**：事故熱區 vs 通訊點覆蓋的量化分析（哪些事故點 500m 內無通訊點）——
      目前只能靠人眼疊圖看；要量化得走 `accessibility-analysis` skill 的路網/格點模式
- [ ] **MS-2**：山屋容量 vs 週邊事故密度的關聯圖層（capacity 欄只有部分有值，先確認覆蓋率）
- [ ] **MS-3**：`cause` × `mountain_area` 的 Top 10 危險路段排行（可放 monitor 面板或 popup 補充）

## 已完成（近期）

- [x] **MS-0**：`mountainRescueIncidents` + `mountainHuts` 兩層上線 — PR #（待補）, 2026-08-02

## 已放棄 / 延後

- **年度時序回放**：上游 handoff 建議「時間欄可接時序回放」，本次刻意不做——
  全域時間軸是即時/當日語意，年度歷史掛上去語意不合。若日後真要做，應比照
  `earthquakeReplay` 另開獨立回放控制，而不是塞進 timeStore。
- **「登山安全」一鍵情境 preset**：本站無 preset 機制，不為單一敘事新建（最小方案原則）。
  組合開法寫在 README。若之後有 3 個以上敘事都需要，再考慮通用機制。
