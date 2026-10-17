# 未來路線：把分析引擎搬上 Zeabur（2026-09-26 記錄，尚未執行）

決策依據：[ADR-0014](../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md)。目前採用 **R2 存正本＋本機按需快取**（見 [PLAN-warehouse](./PLAN-warehouse-20260926.md)）；本頁保存「之後改走 Zeabur 雲端引擎」所需的現況、限制與步驟，避免遺忘。

## 什麼時候該切過去

- 網站訪客、其他裝置或雲端 Agent（不在本機的 Codex／Claude Code）也需要分析 API。
- 本機快取不夠用（常態分析大型面資料，例如淹水潛勢、等高線）。
- 想讓分析 24 小時可用，不依賴自己的 Mac 開機。

在那之前，本機快取較便宜（約 0 元）也較快（Agent 與瀏覽器都在本機，少一趟東京往返）。

## 目標架構

```
analytics → build_warehouse.py → GeoParquet ──上傳──► R2（正本；雲端引擎與本機共用）
                                                  │ 同步到 volume
Zeabur 服務「pulse-warehouse-engine」：DuckDB（memory_limit、threads 限制）＋ token 驗證 HTTP API
                                                  ▲ HTTPS
本機或雲端 MCP ──呼叫──┘ 取回結果 GeoJSON → 既有 import_warehouse_result → 瀏覽器呈現
```

- 引擎程式沿用 `mcp/src/warehouse/engine.ts`，外包一層 HTTP（nearby_profile／sql／region_rank／get_result／present-export）。
- MCP 端改為「遠端模式」：`PULSE_WAREHOUSE_REMOTE=https://…`＋token；結果檔仍寫本機 `runtime/warehouse-results/` 交給既有瀏覽器匯入流程，MCP／Gateway／瀏覽器契約不變。
- Zeabur→R2 讀取不收流出費。

## 2026-09-26 主機現況（`agent_test`，唯讀盤點）

| 項目 | 數值 |
|---|---|
| 規格／費用 | Akamai Tokyo，4 vCPU／8 GB RAM／157 GB 磁碟，US$40／月（已在付，到期 2026-10-03） |
| CPU | 約 3–5% |
| 記憶體 | 已用約 5–6 GB，available 約 2.5 GB（含可釋放 cache）|
| 磁碟 | 130／157 GB（87%），剩約 20 GB |
| 流量 | 418 GB／5 TB |

同機服務（依記憶體）：

| 專案 | 服務 | 記憶體 | 資料 volume |
|---|---|---|---|
| data-collectors-gomn | gis-data-collectors（24h 收集器，正式） | 1.35 GB | 70 GB |
| openAB | habermas-hermes | 1.28 GB | 4.3 GB |
| mini-tw-pulse | mini-taiwan-pulse（正式網站） | 1.10 GB | 21 GB |
| data-collectors-gomn | osrm-taiwan | 0.83 GB | — |
| flight-arc | flight-arc-graph、satellite-arc | 小 | 8.2 GB |
| 其餘 9 個專案 | openab、mini-tw-info、mini-tw-story、uk-trip… | 各 5–50 MB | 小 |

其他磁碟：containerd 映像 18 GB（39 映像對 38 容器，幾乎都在用）、`/var/log/journal` 4.0 GB。

## 切換前的前提與整理清單

**硬性前提**

1. 引擎服務記憶體上限約 1 GB（DuckDB `memory_limit`＋容器 limit），不得擠壓正式網站與收集器；大型面疊合（淹水潛勢等）在 1 GB 內可能失敗，失敗要回清楚錯誤而非 OOM。若要穩定跑重查詢，改升級主機（例如 16 GB）或另租小主機，不與正式服務同機。
2. API 需 token 驗證＋防火牆限制；`pulse_sql` 維持唯讀與既有守門。
3. 倉庫以 GeoParquet 同步，不在主機放 15 GB 的 DuckDB 全檔。

**主機整理（皆為正式機刪除動作，需使用者逐項批准）**

| 項目 | 大小 | 建議 | 風險 |
|---|---|---|---|
| systemd journal | 4.0 GB | `journalctl --vacuum-size=500M` | 低 |
| mini-taiwan-pulse volume 內 `jp-medical-install-glkgke8c` | 1.1 GB | 疑似安裝殘留，確認後刪 | 低～中 |
| 收集器 `gfw_hourly_publish_spool` | 13 GB | ⚠️ 發佈佇列理應清空，堆積可能代表發佈持續失敗；**先查原因**（最舊檔日期、發佈 log），不要直接刪 | 需調查 |
| 收集器 2026 原始檔（bus 14、road_congestion 8.2、cwa_marine 6.6、bus_intercity 4.8、youbike 4、satellite 4 GB） | 約 42 GB | 確認已備份 S3／R2 後設保留期限 | 中 |

## 切換步驟（屆時照做）

1. 完成上表整理與 gfw spool 調查；重量測記憶體 available。
2. 新增 Zeabur 服務（同專案或新專案）：Node＋`@duckdb/node-api`，volume 放 GeoParquet 快取，啟動時從 R2 同步 manifest 所列檔案並驗 SHA。
3. 引擎外包 HTTP API＋token；設定 `memory_limit=1GB`、`threads=2`、容器 memory limit。
4. MCP 加遠端模式與設定；本機模式保留為備援。
5. 以問題庫 `npm run question-bank` 對遠端跑一次，比較耗時與結果一致性；再做一次瀏覽器全鏈。
6. 部署與 push 依使用者授權。
