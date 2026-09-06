# 公開唯讀 RPC 基線

量測時間：2026-09-06 11:50 UTC+8。以專案現有 anon client identity 對三支已由 UI 使用的公開唯讀 RPC 依序各呼叫三次；每次 client timeout 為 10 秒。沒有呼叫寫入 RPC、`log_session_events`、EXPLAIN 或大型資料查詢，也沒有記錄回傳列內容、credentials 或 endpoint URL。

| RPC | UI 使用處 | 參數 | 3 次 client elapsed ms（min / median / max） | HTTP | returned count |
|---|---|---|---:|---|---:|
| `get_data_catalog_for_layer` | DataSourceModal / catalog tool | `p_layer_key: cctv` | 202.6 / 210.4 / 1906.6 | 200 × 3 | 1 |
| `get_source_health` | Intel source-health summary | 無 | 197.5 / 207.2 / 458.7 | 200 × 3 | 29 |
| `get_layer_gates` | Layer gate bootstrap | 無 | 194.1 / 197.2 / 221.4 | 200 × 3 | 34 |

三次樣本只能作為公開路徑是否可讀及粗略冷／暖延遲的 evidence，**不足以估計代表性的 p95**。尤其 catalog 首次 1906.6 ms 與後兩次約 200 ms 差異很大；不能從這一組推論穩定延遲或資料庫瓶頸。完整逐次紀錄見 [rpc-baseline.json](./rpc-baseline.json)。
