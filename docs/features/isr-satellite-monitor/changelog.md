# Changelog — 中國 ISR 衛星領海過境監測

## 2026-08-31 — 相對過境量色階與提醒 released

- 每日柱依所選 30D／90D／120D 可呈現資料的 `p25 / p50 / p75 / p90` 重算為綠、灰、黃、橙、紅五段，圖例同步顯示實際門檻。
- 最新完整日嚴格高於 p90 時才顯示紅色相對量提醒；p75–p90 只保留橙色位階，不掛警告。文字明確限制為公開軌道推算的過境量比較，不代表威脅、任務執行或實際蒐情。
- 可呈現日少於 8 日時停用分級與提醒；null、缺日及 scope 不完整下的 0 仍不進門檻，也不被畫成有效低量。
- 維持中性灰卡片底色；顏色只用於柱體、圖例、最新位階與相對量提醒。
- mini-taiwan-pulse PR #190 已以 merge commit `2b7e5f1` 發布；CI test／review、Zeabur deployment `6a94c32479e7277ffa4e4c12`（RUNNING）均通過。
- 正式站 Dock／Split Browser 驗收通過：五色柱與灰色面板皆呈現，30D／90D／120D 門檻會分別重算，卡片排序維持「特殊船舶 → ISR → TRA」，console 無 error。

## 2026-08-30 — 30D／90D／120D released

- 新增 30D／90D／120D 期間切換，預設 30D；前端一次取 120 日後依 `latest_valid_day` 日曆窗篩選，切窗不重打 RPC。
- 新增期間 `pass_count` 中位數與最新日高／低／相等、絕對差；median 排除 null、保留合法 0，偶數筆取兩中央平均。
- 顯示「可呈現日 X/window」，不補缺日、不把過境解讀為實際蒐情。
- Dock／Split 皆將本卡排在「特殊船舶接近帶」後面。
- 面板底色改為與其他 Monitor 卡一致的中性灰，不再使用紫色漸層。
- gis-platform PR #73 已將 RPC `p_days` 上限擴至 120；production 120 日回填與 anon HTTP 驗證通過。
- mini-taiwan-pulse PR #187 已發布；CI、Zeabur deployment 與正式站 Dock／Split Browser 驗收通過。
- 正式站 30D／90D／120D 中位數分別為 94／94.5／95.5，最新完整日 72 次，三段皆顯示低於中位數；面板 computed background 為中性灰 `rgba(255,255,255,0.02)`。

## 2026-08-30 — Released

- 新增 `get_isr_satellite_passes_daily` 暫定契約 loader 與 loadingRegistry。
- 新增 Monitor 每日直柱卡：主值 `pass_count`、tooltip `unique_satellite_count`。
- 接入 dock / split 佈局與 packing tests。
- 當時前端明確請求 `p_days=30`，RPC 上限 31；後續期間切換擴約見 Unreleased。
- 明確區分 v1 scope 內真 0、缺日、null、partial China-wide census、stale 與 RPC error；固定標示三家族範圍不是全中國 ISR census。
- localhost Browser 已驗證 dock/split 卡片接線與 RPC 未上線時的誠實錯誤狀態。
- production migrations/backfill 已套用；anon HTTP RPC 回傳 30 日資料，最新完整日為 2026-08-29，v1 scope coverage complete 且不宣稱全中國 ISR census。
- frontend PR #185 已以 merge commit `f78f24a` 發布；master CI 與 Zeabur deployment 成功。
- production Browser 驗證 Dock／Split 皆顯示 30 日柱；最新日 72 次／53 顆，tooltip、freshness、scope/census 警示正確，console 無 error。
- collector PR #64 deployment 後 aggregate `refreshed_at` 已自動更新；專屬 metadata heartbeat 尚無資料列，列入 ISR-MON-5，不以此誤報整體 collector 健康。
- Breaking：前端依賴平台提供本文 handoff 所列 RPC 欄位；RPC 已於 2026-08-30 上線。
