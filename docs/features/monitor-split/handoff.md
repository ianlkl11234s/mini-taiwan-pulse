# Handoff — 監看模式分割版面

## 上游 RPC（2026-08-16 已 apply ✅）

**`gis-platform/migrations/348_lightning_nuclear_daily_rpc.sql` 已於 2026-08-16 apply 到正式庫**
（user 拍板）。它在 `public` 開兩支 SECURITY DEFINER 薄 RPC：

| RPC | 讀 | 給誰用 |
|---|---|---|
| `get_lightning_daily(p_days, p_source)` | `analytics.lightning_daily_summary` | 落雷卡趨勢柱 |
| `get_nuclear_radiation_daily(p_days)` | `analytics.nuclear_radiation_daily` | 輻射卡趨勢柱 |

**為什麼要 SECURITY DEFINER**：兩張 analytics 表只有 RLS policy，**沒有** base table
`GRANT SELECT TO anon`（`analytics` schema 不像 `live` 有 ALTER DEFAULT PRIVILEGES）——
RLS 不能取代 GRANT。同款問題與解法的前例是 `336_food_price_rpc.sql`。

**apply 後實測（2026-08-16）**：

| 聚合表 | 列數 | 天數 | 區間 | 卡片效果 |
|---|---|---|---|---|
| `analytics.nuclear_radiation_daily` | 3011 | 62 | 06-15 ~ 08-15 | 14 天滿格，每天 48/51 站 |
| `analytics.lightning_daily_summary` | 39 | 35 | 06-15 ~ 08-15 | 近 14 天有 10 天有雷 |

- `anon` 身分實測可呼叫兩支 RPC（SECURITY DEFINER 生效）
- 兩表的 `max(date)` 都是**昨天** —— refresh function 只補前一天，today 永遠沒列，
  這正是 RPC 窗口右界錨在表內最新日期而不是 `NOW()` 的原因
- ⚠️ `lightning_daily_summary` 的 `county` 欄位**全部是 NULL**（ST_PointInPolygon 推不出
  縣市）。RPC 是 `GROUP BY strike_date` 全國加總，不受影響；但要做縣市維度就會發現沒資料

### ⚠️ 落雷必須指定 `p_source='cwa'`

RPC 的 `p_source=null` 會把 `cwa` 與 `taipower` **加總**，但兩者是同一批落雷的兩份獨立
觀測，加起來等於重複計算（實測 08-14：cwa 2985 + taipower 2204 = 5189）。
卡片主數字（今日累計／近 1h）走氣象署，`fetchLightningDaily` 因此固定傳 `p_source: "cwa"`，
否則同一張卡上下兩半的數字對不起來。

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
