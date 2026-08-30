# Changelog — 中國 ISR 衛星領海過境監測

## 2026-08-30 — Released

- 新增 `get_isr_satellite_passes_daily` 暫定契約 loader 與 loadingRegistry。
- 新增 Monitor 每日直柱卡：主值 `pass_count`、tooltip `unique_satellite_count`。
- 接入 dock / split 佈局與 packing tests。
- `p_days` 預設 30、上限 31，符合 RPC `1..31` 契約。
- 明確區分 v1 scope 內真 0、缺日、null、partial China-wide census、stale 與 RPC error；固定標示三家族範圍不是全中國 ISR census。
- localhost Browser 已驗證 dock/split 卡片接線與 RPC 未上線時的誠實錯誤狀態。
- production migrations/backfill 已套用；anon HTTP RPC 回傳 30 日資料，最新完整日為 2026-08-29，v1 scope coverage complete 且不宣稱全中國 ISR census。
- frontend PR #185 已以 merge commit `f78f24a` 發布；master CI 與 Zeabur deployment 成功。
- production Browser 驗證 Dock／Split 皆顯示 30 日柱；最新日 72 次／53 顆，tooltip、freshness、scope/census 警示正確，console 無 error。
- collector PR #64 deployment 後 aggregate `refreshed_at` 已自動更新；專屬 metadata heartbeat 尚無資料列，列入 ISR-MON-5，不以此誤報整體 collector 健康。
- Breaking：前端依賴平台提供本文 handoff 所列 RPC 欄位；RPC 已於 2026-08-30 上線。
