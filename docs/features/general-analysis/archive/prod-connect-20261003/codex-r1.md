推薦採「正式站單一 runtime + WebSocket relay」：DuckDB 與原始 GeoParquet 保持本機 MCP；Zeabur 僅持有配對、狀態與暫態結果轉送，不搬雲端 DuckDB。

- 將 `gateway/services/research-gateway` 納入 Pulse 容器，以 Node 24 + nginx runtime（現有 `mini/Dockerfile` 最終層的 `apk nodejs` 不保證 `node:sqlite` 所需的 ≥23.10）。`entrypoint.sh` 同時監管 gateway，SQLite 放 `/data/research-gateway/`；nginx 維持 loopback `/api/research/v1`。
- 將 `bridgeClient.ts`／`relayClient.ts` 改為各一條 authenticated WSS：瀏覽器、MCP 都長連線。Gateway 推送 command/query/state，取代 `QueryResponder.ts` 的 2 秒輪詢與 `/browser/query` 4.5 秒 long-poll。
- 結果改為 MCP 先以 binary frames 上傳至 Gateway，再立即 relay 給已配對瀏覽器；`warehouseResultImport.ts` 改收已驗 SHA-256 的 `Blob/ArrayBuffer`，不再 fetch `/__warehouse-results/*`。每 session 限 18 MiB（已與引擎 presentation budget 對齊），Gateway 僅保留短暫記憶體至 browser ACK/reconnect grace，逾限明確失敗。這比 R2 暫存少一次 upload/download 與簽名 URL 管理；R2 可作「瀏覽器離線逾 grace 才落盤」的第二階段，不宜先做。
- owner-only 原始資料不可讓正式瀏覽器讀本機路徑。將可分析者納入本機 warehouse，僅傳被允許的衍生結果及既有 source/precision/coverage metadata；權利不允許衍生者拒絕呈現。`vite.config.ts` 的 `/__local-research*`、`/__warehouse-results` 一律只保留 dev，不提供 production 相容層。

候選比較：  
1. **推薦 WSS 暫態 relay**：最快、最少元件，適合單 owner。  
2. R2 presigned PUT/GET：較耐斷線，但多一段 RTT、物件 TTL/CORS/權限面，適合日後跨裝置。  
3. 雲端 DuckDB：解決「Mac 不開機」，但主機目前記憶體緊，且不解決 owner-only 原始資料治理；延後至獨立 16GB+ 引擎。

延遲目標（台灣↔東京 RTT 假設 35–60ms）：

| 動作 | 現況 | 目標 |
|---|---:|---:|
| 地圖 command | POST+輪詢，約 1.5–3s | WSS 1–2 RTT + render，約 100–250ms |
| browser query | 4.5s hold + 2s 間隔 | push，約 1–2 RTT + 計算 |
| 結果上圖 | 本機 URL，正式不可用 | 串流時間 + render；18MiB 受上行頻寬主導 |
| JWT | 每 POST 驗 Supabase | WSS connect 驗一次；短 TTL、token hash LRU，絕不快取 raw token |

配對保留「登入＋email allowlist＋8 碼＋短語」的首次信任；成功後以同一 Supabase principal、同一 tab 的 durable device ID 與 HttpOnly resume cookie 恢復 30 分鐘 lease，refresh 不必重配。MCP 重啟或 device 不符仍要求新碼。移除正式以外的 dev-autopair 三處特例；本機也走同一 WSS/配對流程，測試可用 test identity 注入，不保留另一套協定。

分期：

1. Gateway 容器化、健康檢查、真實 owner login/allowlist、SQLite restart/revoke 驗收。  
2. WSS control plane，驗收 command/query P95、斷線重連、手動操作優先與 rate limit。  
3. Binary result relay，驗 SHA、18MiB/feature 上限、browser readback、無結果殘留。  
4. owner-only 資料分類與 warehouse 化；驗收正式 bundle 不含 local URL、拒絕未授權資料。  
5. 移除 POST polling/dev-autopair/Vite 結果 middleware；production browser、容器重啟、MCP 重啟全鏈驗收。

風險是 WSS proxy timeout、單容器多程序監管，以及結果暫態記憶體；均以連線心跳、明確大小上限、grace/retry 與 container memory limit 驗收。此次為唯讀分析，未修改檔案或讀取 `.env`。

