# Handoff — 臺灣電信與網路狀態 MVP

## 產品目的

在 Monitor 顯示臺灣目前的電信與網路狀態。這是多來源狀態卡，不是地圖圖層：
Cloudflare Radar、IODA 與 NCDR evidence 只顯示文字／數值，不替 ASN、國家狀態或缺資料區域製造 geometry。

## 上游契約

- RPC：`public.get_internet_health_status`
- 前端參數：
  - `p_entity_type = 'country'`
  - `p_entity_ids = ['TW']`
  - `p_include_evidence = true`
  - `p_limit = 500`
- 預期欄位：

```text
row_type, source_observation_id, source, evidence_family, entity_type,
entity_id, entity_name, signal, reported_status, effective_status,
incident_kind, value, unit, baseline_value, change_ratio, confidence,
sample_count, observed_at, source_updated_at, collected_at, age_seconds,
is_stale, active_incident_id, incident_status, metadata
```

`effective_status` 是 UI 真相；`reported_status` 只保留溯源。前端接受的保守狀態為
`normal / watch / degraded / outage / unknown`，並防禦性收斂少量舊別名。

## 前端彙整規則

1. `is_stale !== false`（包含欄位缺失）強制 `unknown`。
2. 空 rows、RPC error、unavailable 與 null 都顯示「資料不足」，不補 0。
3. RPC 的 `row_type = status` 中，`evidence_family = composite` 才正規化為 detector；其他 status rows 是 provider evidence，`official_evidence` 是 NCDR 正向證據。
4. 有 fresh detector 時，以 detector composite 加 active official evidence 的 `effective_status` 為總體真相；沒有 detector 時才保守退回 fresh rows。
5. `confidence` 的 RPC 值為 0–1；前端以 `<0.5 / 0.5–<0.8 / ≥0.8` 顯示 low / medium / high。
6. `normal` 仍至少需要 Cloudflare Radar 與 IODA 兩個 fresh evidence 都是 normal。
7. NCDR 無 row 或 0 alerts 只能顯示「未通報／無資料」，不可單獨證明正常。
8. active incident 只列 entity name/id、類型與時間。
9. 不新增 LayerVisibility、Mapbox source、overlay、popup 或 ASN geometry。

## 前端觸點

- `src/data/internetHealthLoader.ts`：RPC、runtime parser、來源／incident 彙整。
- `src/components/intel/monitor/TelecomStatusCard.tsx`：5 分鐘輪詢與狀態卡。
- `src/components/intel/monitor/MonitorPanel.tsx`：widget 接線。
- `src/components/intel/monitor/monitorLayout.ts`：dock/wall 全寬位置。
- `src/components/intel/monitor/monitorSplitLayout.ts`：split 全寬位置。

既有 `lifelineAlerts` 仍負責 NCDR CAP 地圖：只有上游真的提供 geometry 才渲染；本卡不複製或推測其範圍。

## 驗收邊界

- RPC migration 未 apply 前，卡片應誠實顯示「資料不足」，不代表前端壞掉。
- Browser live gate 必須把卡片與實際 RPC rows、`source_updated_at`、`is_stale` 逐項對照。
- 單元測試覆蓋 stale、空資料、NCDR-only normal、雙來源 normal、incident 與 null 語意。
- 正式上線仍需 migration apply、collector fresh data、RPC anonymous grant、browser QA 與 deploy 分別確認。

## Browser live gate

1. 確認 migration 已 apply，且 RPC 用 anonymous session 呼叫 country/TW 能回 fresh detector 與 provider rows。
2. 啟動前端並開啟 Monitor；`電信與網路 · CONNECTIVITY` 應位於事件區下方、全寬、不壓到下方雙欄卡片。
3. 在 browser Network 面板確認 request 是 `get_internet_health_status`，參數為 country、`[TW]`、include evidence、limit 500。
4. 逐列對照 Cloudflare／IODA／NCDR 的狀態、metric、最後資料時間；null 必須是 `—`，NCDR 缺 row 必須是「未通報／無資料」。
5. 用 stale 或空資料 fixture 驗證總體為「資料不足」且 fresh sources 為 0；用 RPC 失敗驗證舊 normal 不會繼續亮綠。
6. 用 fresh detector + Cloudflare + IODA fixture 驗證 normal quorum；加入 active NCDR official evidence 時驗證 outage 與 incident 摘要。
7. 縮窄視窗檢查來源列換行、卡片內容不裁切；Mapbox sources/layers 數量不應因本卡增加。
