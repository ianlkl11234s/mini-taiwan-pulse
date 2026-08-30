# Backlog — 中國 ISR 衛星領海過境監測

## Active work

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| ISR-MON-1 | validation | P1 | waiting_external | 前端可讀到真實每日過境列 | 平台完成 RPC 後，以 anon 角色回讀預設參數 | RPC schema 對齊、最近完整日非空、缺日未補 0 |
| ISR-MON-2 | validation | P1 | waiting_external | dock / split 已通過本機 error/null 與範圍警示驗收；真實柱仍待 RPC | 平台完成 RPC/backfill 後，檢查 30 日柱、tooltip、partial census、stale 與真零狀態 | live RPC Browser 截圖與互動證據 |
| ISR-MON-3 | data-health | P1 | waiting_external | ISR registry 覆核日期可監測 | 上游確認 registry review SLA 與告警門檻 | `registry_reviewed_at` 有值且逾期狀態有規格 |

## Decision needed

| ID | Decision | Options / trade-off | Decision owner | Next action after decision |
|---|---|---|---|---|
| ISR-MON-4 | `twmain_12nm` 是否含哪些附屬島嶼 | 僅本島+澎湖較符合標題；擴大範圍需改名稱與比較基準 | Product / data owner | 固化 region registry 與 UI 中文標籤 |

## Completed / historical

- [x] **ISR-MON-0**：完成 frontend loader、Monitor card、dock/split packing 與 null/zero contract tests — 2026-08-30，尚未 commit／PR；詳見 [changelog.md](./changelog.md)
- [x] **ISR-MON-0B**：localhost dock/split 均可見卡片；production RPC 尚未套用時正確顯示「更新失敗，不以 0 代替」與 v1 scope 警示 — 2026-08-30

## Explicitly not planned

- **實際蒐情次數**：公開 OMM/TLE 無 payload tasking、姿態或感測器開機資料，不能由過境事件推論。
- **地圖 layer**：本期只做 Monitor card，不建立 `layerManifest` 或地圖 overlay。
