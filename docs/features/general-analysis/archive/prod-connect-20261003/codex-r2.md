1. **部分接受**：QueryResponder 健康時確實零間隔長輪詢（[QueryResponder.ts](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/analysis-prod/mini/src/research/QueryResponder.ts:93)），我原稱「2 秒輪詢」不精確；但 command readiness 仍每 1.5 秒查一次（[relayClient.ts](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/analysis-prod/mcp/src/research/relayClient.ts:261)），故先以 HTTP long-poll＋wake 改 command/query，WSS 延後至實測 P95 未達標才採用。

2. **部分接受**：18 MiB 是每筆 presentation budget（[engine.ts](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/analysis-prod/mcp/src/warehouse/engine.ts:573)），而 browser 是每筆 24 MiB、總 96 MiB（[resultStore.ts](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/analysis-prod/mini/src/research/resultStore.ts:9)）；落 volume 可支援重整，但應設 **30 分鐘 lease／revoke 即刪**，不可沿 study 7 天保留，並持久化經驗證的 import metadata。

3. **接受**：gateway package 宣告 Node `>=22.13`，我不應直接要求 Node 24；獨立服務可避開 mini Dockerfile 僅 COPY mini 內容的邊界（[Dockerfile](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/analysis-prod/mini/Dockerfile:8)）。但 Zeabur 私網 DNS、TLS/proxy 與 storage durability 必須先驗收。

4. **部分接受**：HttpOnly cookie 與 nginx 清 Cookie 衝突（[nginx.conf](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/analysis-prod/mini/nginx.conf:35)），改用既有 browser session 恢復；但反對預設 90 天 agent bearer token，0600 不是防竊取邊界，應採短效可輪替 credential＋明確裝置撤銷。

5. **接受**：不做 owner-only production local-URL 相容層、超限 fail closed；且 Gateway 現行設計只保存 result IDs，不含 rows（[README.md](/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/analysis-prod/gateway/services/research-gateway/README.md:17)），所以持久結果必補完整授權與重建契約。

修正後推薦：

1. HTTP long-poll＋study wake 先取代 command/query 的固定等待，量測後再決定 WSS。  
2. MCP PUT 至 gateway private volume、browser authenticated GET，30 分鐘／revoke 即刪、每筆 18 MiB、每 study 96 MiB。  
3. Gateway 獨立 Zeabur service，先驗私網 upstream、健康檢查、重啟與刪除保證。  
4. 保留首次 code/phrase；恢復採可輪替短效 agent credential 與 device revoke。  
5. 上線前驗證正式 bundle 無 local URL、owner-only 衍生結果授權、browser readback。

Fable 方案最大風險是把衍生 GeoJSON 保留至 study 的 7 天：這從暫態 relay 變成雲端資料庫，會擴大資料留存、撤銷與外洩面，且尚未證明每筆 metadata／權利都可安全重播。