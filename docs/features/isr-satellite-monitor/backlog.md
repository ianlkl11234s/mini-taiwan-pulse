# Backlog — 中國 ISR 衛星領海過境監測

## Active work

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| ISR-MON-3 | data-health | P1 | waiting_external | ISR registry 覆核日期可監測 | 上游確認 registry review SLA 與告警門檻 | `registry_reviewed_at` 有值且逾期狀態有規格 |
| ISR-MON-5 | data-health | P1 | investigating | collector deploy 後 aggregate `refreshed_at` 已更新，證明排程有執行；但 `metadata.collector_status` 尚無專屬列 | 確認 direct-SQL runtime heartbeat 的 role/RLS，或正式指定 aggregate `refreshed_at` 為健康 SSOT | 專屬 heartbeat 可讀，或文件／告警統一採 aggregate freshness |

## Decision needed

| ID | Decision | Options / trade-off | Decision owner | Next action after decision |
|---|---|---|---|---|
| ISR-MON-4 | `twmain_12nm` 是否含哪些附屬島嶼 | 僅本島+澎湖較符合標題；擴大範圍需改名稱與比較基準 | Product / data owner | 固化 region registry 與 UI 中文標籤 |

## Completed / historical

- [x] **ISR-MON-0**：完成 frontend loader、Monitor card、dock/split packing 與 null/zero contract tests — 2026-08-30，PR #185；詳見 [changelog.md](./changelog.md)
- [x] **ISR-MON-0B**：localhost dock/split 均可見卡片；production RPC 尚未套用時正確顯示「更新失敗，不以 0 代替」與 v1 scope 警示 — 2026-08-30
- [x] **ISR-MON-1**：production migrations、三種 tier mode 各 30 日 backfill 與 anon HTTP RPC 回讀通過 — 2026-08-30
- [x] **ISR-MON-2**：production Dock／Split 均顯示 30 日柱；最新日 72 次／53 顆，tooltip、freshness、scope 與 census 警示驗收通過，console 無 error — 2026-08-30
- [x] **ISR-MON-6**：frontend 完成 30D／90D／120D 日曆窗、期間中位數、最新日差異與 X/window 缺日揭露；production release 仍待上游 `p_days<=120` 與整體發布驗收 — 2026-08-30

## Explicitly not planned

- **實際蒐情次數**：公開 OMM/TLE 無 payload tasking、姿態或感測器開機資料，不能由過境事件推論。
- **地圖 layer**：本期只做 Monitor card，不建立 `layerManifest` 或地圖 overlay。
