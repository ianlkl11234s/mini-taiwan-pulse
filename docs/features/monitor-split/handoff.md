# Handoff — 監看模式分割版面

## ⚠️ 待 apply 的上游依賴（2026-08-16）

**`gis-platform/migrations/348_lightning_nuclear_daily_rpc.sql` 已寫好但未 apply**
（migration 須 user 拍板）。它在 `public` 開兩支 SECURITY DEFINER 薄 RPC：

| RPC | 讀 | 給誰用 |
|---|---|---|
| `get_lightning_daily(p_days, p_source)` | `analytics.lightning_daily_summary` | 落雷卡趨勢柱 |
| `get_nuclear_radiation_daily(p_days)` | `analytics.nuclear_radiation_daily` | 輻射卡趨勢柱 |

**為什麼要 SECURITY DEFINER**：兩張 analytics 表只有 RLS policy，**沒有** base table
`GRANT SELECT TO anon`（`analytics` schema 不像 `live` 有 ALTER DEFAULT PRIVILEGES）——
RLS 不能取代 GRANT。同款問題與解法的前例是 `336_food_price_rpc.sql`。

**apply 前後**：前端已經合併且不會壞 —— loader 打不到 RPC 時安靜回 `[]`（`console.debug`
不是 `warn`），卡片就不畫圖、維持原高度。apply 後自動長出來，**不需要再改前端**。

**apply 後請跑**（檔頭也列了）：
```sql
SELECT * FROM public.get_lightning_daily(14);
SELECT count(*), min(strike_date), max(strike_date) FROM analytics.lightning_daily_summary;
```
第二條特別重要 —— 兩張聚合表實際有幾天資料**至今未能驗證**（`analytics` 不在 PostgREST
exposed schemas，連 service role 走 REST 都是 `406 Invalid schema`）。若資料只有零星幾天，
柱狀圖會很稀疏，那不是程式問題。

**隱性契約**：RPC 回傳欄位名（`strike_date` / `reading_date` …）與 loader 的 `RpcRow`
介面一一對應。review 時若改欄位名，**必須同步改 loader**，否則會靜默把每天都當缺日補 0。

## 上游

除了上面那支待 apply 的 migration，split 版面本身是**純前端呈現層改動**，
不新增資料源、不動既有 RPC、不動 schema。

split 模式渲染的 20 個 widget 與 dock 模式**完全同一組元件、同一組資料來源**，
只是換一套座標與容器幾何。widget → 資料來源的對照表請看
[`../monitor-grid-static/handoff.md`](../monitor-grid-static/handoff.md)，本功能不重抄。

## 下游

無。這是應用層末端。

## 會影響本功能的上游變動

| 上游變動 | 對本功能的影響 | 要做什麼 |
|---|---|---|
| 新增 / 移除 Monitor widget | `MonitorWidgetId` union 改變 | **兩套佈局都要補座標**：`MONITOR_LAYOUT`（dock）與 `MONITOR_LAYOUT_SPLIT`（split）。只補一邊 → 另一邊該 widget 不渲染。兩份沙盒也各自要加 widget 定義 |
| `monitorPacking.ts` 的 guillotine 演算法調整 | 窄版拆解結果可能改變 | 跑 `monitorPacking.test.ts`，特別是 split 那組結構斷言 |
| Layers 面板（`IconRailSidebar` 的 `LayersPanel`）改版 | compact 尺寸可能破版 | 確認 `compactLayers` 分支下的 `layersWidth` / `layersMaxVh` 仍合用 |
| 右上角按鈕列高度改變 | `MONITOR_SPLIT_DOCK.top`（56）可能不夠讓位 | 回沙盒調 `top` 重新匯出 |

## 契約備註

`MonitorPanel` 的 `mode` / `onModeChange` 是**選配 prop**（受控模式，比照既有 `filter`）。
不傳 → 用內部 state、預設 `dock`，舊呼叫端行為不變。測試與未來的其他嵌入情境可直接沿用。
