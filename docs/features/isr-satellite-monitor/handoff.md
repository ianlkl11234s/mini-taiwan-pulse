# Handoff — 中國 ISR 衛星領海過境監測（下游視角）

> **上游 SSOT（預定）**：[taipei-gis-analytics/docs/handoff/isr-satellite-monitor.md](../../../../taipei-gis-analytics/docs/handoff/isr-satellite-monitor.md)
>
> 本檔只記前端硬依賴與目前暫定契約；正式 migration／RPC 以 gis-platform 與上游 handoff 為準。

## 上游 handoff 摘要

- RPC：`public.get_isr_satellite_passes_daily(p_days, p_region_key, p_tier_mode)`
- 更新頻率：每日批次；前端每 30 分鐘檢查一次並以 30 分鐘 TTL 去重
- 日界：Asia/Taipei
- `p_days` 契約：`1..120`；前端固定取 120 日，超過 120 會 clamp 為 120
- RPC 參數預設仍為 `p_days=7`；一般 loader 呼叫預設仍為 30，Monitor card 明確請求 120
- Monitor 查詢：`p_days=120`、`p_region_key='twmain_12nm'`、`p_tier_mode='confirmed_plus_dual_use'`
- UI 預設 30D，可切換 30D／90D／120D；切換只篩已取得資料，不重新呼叫 RPC
- tier modes：`confirmed_only` / `confirmed_plus_dual_use` / `all_non_excluded`

## 前端接線位置

- Loader：`src/data/isrSatellitePassesLoader.ts`
- Monitor card：`src/components/intel/monitor/IsrSatellitePassCard.tsx`
- Dock / split：`monitorLayout.ts` / `monitorSplitLayout.ts`
- 圖表：重用 `HazardTrendBars`；`pass_count` 為柱高，`unique_satellite_count` 放 tooltip。

## 硬依賴欄位

每日一列：

- `target_day` — x 軸日期，`YYYY-MM-DD`。
- `region_key` — 查詢實際套用的 region。
- `tier_mode` — 查詢實際套用的分類模式。
- `pass_count` — 每日穿越事件數；null 不得補 0。
- `unique_satellite_count` — 當日 distinct 衛星數；null 不得補 0。
- `latest_valid_day` — 最近完整有效日。
- `computed_at` 或 `refreshed_at` — 批次計算時間。
- `coverage_complete` — RPC 的整體／partial registry coverage 訊號；`false` 不等於無資料，非 null count 仍須呈現。
- `registry_reviewed_at` — ISR registry 最近人工覆核時間，loader 保留供後續 UI 擴充。
- `scope_coverage_complete` — v1 `YAOGAN / GAOFEN / JILIN` registry 分母是否完整；只有 `true` 時 `0` 才能解讀為 v1 scope 內真零。
- `china_isr_census_complete` — 是否涵蓋全中國 ISR census；v1 預期為 `false`，不會因此隱藏三家族 scope 內的非 null 計數。

缺少的 calendar day 不由前端補列，也不補 0。
圖表只保留 `target_day <= latest_valid_day`；`latest_valid_day` 之後的未完成日不呈現。
期間以 `latest_valid_day` 為終點往前算 30／90／120 個日曆日，不使用最後 N 筆資料；UI 顯示可呈現日 X/window。
期間 median 只納入可呈現的非 null `pass_count`，合法 0 納入，偶數筆取兩中央值平均；最新日與 median 顯示高／低／相等及絕對差。

`coverage_complete=false` 可能仍回 partial registry 計數，前端會保留數字並搭配固定範圍警示；卡片不得將這種情況當成無資料。卡片固定顯示「v1 YAOGAN／GAOFEN／JILIN 範圍，非全中國 ISR census」。

## Freshness 暫定推導

RPC 暫不直接回 `freshness`，前端依以下條件推導：

- `computed_at/refreshed_at` 距現在不超過 36 小時；且
- `latest_valid_day` 的臺北日終距現在不超過 48 小時；
- 兩者皆成立才是 `fresh`，任一超過為 `stale`，缺欄為 `unknown`。

若平台後續回傳正式 `freshness` 欄位，前端優先採該欄並應同步更新本文件與 tests。

## 上游改動 → 下游動作

| 上游改動 | 下游動作 |
|---|---|
| RPC 或參數改名 | 更新 loader、contract test、handoff |
| 日界改動 | 更新日期標籤、freshness 推導與 tooltip |
| coverage 定義改動 | 重新驗證 scoped true-zero 與 partial China-wide census 的顯示規則 |
| tier enum 改動 | 更新 TypeScript union 與預設模式 |
| `p_days` 上限低於 120 | 90D／120D 不可發布；先擴約並完成 RPC contract 驗證 |

## 已知不對稱

- production anon HTTP RPC 與 frontend Dock／Split Browser 已於 2026-08-30 完成驗收。
- 過境是星下點與領海 polygon 的幾何事件，不等於感測器實際蒐情。
- v1 registry 只承諾 YAOGAN／GAOFEN／JILIN 三家族 scope，不代表全中國 ISR census。
- `twmain_12nm` 的精確 islands inclusion 由上游 region registry 定義，前端不自行 buffer 或改 geometry。
