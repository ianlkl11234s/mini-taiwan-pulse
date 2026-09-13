# External tool review (fixed commits)

研究日期：2026-09-11。以下只引用既有 checkout 的固定 commit，不代表 upstream 最新狀態。

- WorldMonitor：[`df2ac7d`](https://github.com/koala73/worldmonitor/tree/df2ac7daf76cd4f287e5b505509abdcb672e40aa)，checkout `/private/tmp/pulse-worldmonitor-research-20260910`。repo license 為 AGPL-3.0；這是整合／部署的重要限制。
- monolith-terrain：[`f95b3bb`](https://github.com/kaolti/monolith-terrain/tree/f95b3bb47c826e88ac0330548278e1ba124ec276)，checkout `/private/tmp/pulse-monolith-research-20260910`，MIT；DEM 上游 attribution 仍須依 Terrain Tiles/Mapzen/Tilezen 條款處理。

## WorldMonitor：實際 MCP registry 與工具

入口是 MCP JSON-RPC `tools/list` / `tools/call`；每個工具另注入 `jmespath`，cache 工具另有 `summary`。`describe_tool(tool_name)` 可取得完整 input/output schema；文件明載它免 Pro 每日 quota，但仍受 60 requests/min（Pro）限制。[固定來源：registry](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/api/mcp/registry/index.ts)、[reference](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/docs/mcp-tools-reference.mdx#L34-L74)、[rate limits](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/docs/usage-rate-limits.mdx)。

| 實際名稱／method | 參數與 limits | 分析語意／限制 |
|---|---|---|
| `get_news_intelligence` / `tools/call` | `topic`, `category`, `country`, `alerts_only`, `query`, `min_importance`, `limit`（各清單 default 30；`summary`/`jmespath`） | cache read；news/GDELT/cross-source freshness 約 30/45/60 min；有 corroboration/source tier，但仍是新聞 intelligence，不是 GIS geometry。 |
| `get_conflict_events` / `tools/call` | `country`, `min_fatalities`, `limit` default 30 | UCDP/Iran/unrest 有座標的事件 cache；freshness 30 min/2 h；空結果要讀 source state，不能當作無事件。 |
| `get_natural_disasters` / `tools/call` | `dataset`（earthquakes/wildfires/other）, `min_magnitude`, `active_only`, `limit` default 30 | USGS/NRCan/FIRMS 等事件 cache；freshness 約 30 min；事件點／來源與 severity 可作輸入資料。 |
| `get_signal_convergence` / `tools/call` | `lat`,`lon`,`radius_km` 必須成組；radius >0、最多 20,000 km；`min_domains` 2–5、default 3 | MCP-only derived analysis：1-degree grid、24 h，protest/flight/naval/earthquake 共現；不是任意 polygon、路網或精確 local join。 |
| `get_population_exposure` / `tools/call` | `mode=events/point/countries`; point 的 `lat`,`lon`,`radius_km` default 50、clamp 1000；events `limit` default 20 | derived analysis；用「最近 priority-country centroid × 事件半徑」估算，文件明說無 city-level population dataset；可作粗篩，不能當 500 m exposure。 |
| `simulate_infrastructure_cascade` / `tools/call` | 先無參數取得 node catalog；`source_id`、`disruption_level` 0.1–1（default 1） | seeded cable/pipeline/port/chokepoint registry 的 BFS capacity propagation；情境模型，不是實際 network flow／需求校準。 |
| `search_intel_history` / `tools/call` | `query` 2–500 chars；`domain`,`country`,`from`,`to`；`limit` default/max 16 | embedding search，約 12 s、每次 embedding round-trip；歷史 coverage 從啟用日起，空集不等於無事件。 |
| `analyze_situation` / `tools/call` | `query` required，`context`,`framework` optional；worst-case約25 s | LLM geopolitical deduction，回傳 confidence/supporting signals；是敘事分析，不是 deterministic spatial primitive。 |

## monolith-terrain：DEM 工具的實際範圍

`src/dem.js` 的 `loadDem({lat, lon, zoom, tilesAcross=3})` 對 AWS Terrain Tiles Terrarium PNG fetch tile；預設 3×3（共 9）個 256 px tile，解碼為公尺 `R*256+G+B/256-32768`，回傳 Float32 height grid、`metersPerPixel`、extent、min/max/mean。`sampleDem(dem, px, py)` 只做邊界 clamp 後 bilinear interpolation。[固定來源：`dem.js`](https://github.com/kaolti/monolith-terrain/blob/f95b3bb47c826e88ac0330548278e1ba124ec276/src/dem.js#L1-L82)、[README attribution/zoom](https://github.com/kaolti/monolith-terrain/blob/f95b3bb47c826e88ac0330548278e1ba124ec276/README.md#L21-L61)。

這是「視覺 terrain heightfield」primitive：供 Three.js 地形、等高線、spot elevation 與動畫取樣；沒有 polygon/point-in-polygon、zonal statistics、slope/aspect output、CRS/coverage QA、時間版本或分析 API。`tilesAcross` 也不是分析範圍契約，沒有明確 tile quota/error aggregation beyond fetch failure。故可借鑑 Terrarium decode + bilinear sampler 作前端視覺，不能直接宣稱 DEM analysis service。

## 對通用 GIS primitives 的建議（現有 vs 推測）

**現有證據**：WorldMonitor 可重用的是受 schema/limits/freshness 約束的事件／新聞 catalog、bounded query、來源狀態、粗粒度 convergence/exposure/cascade；monolith 可重用的是 DEM tile 解碼與取樣。**推測／設計建議**：Mini Taiwan Pulse 應另建 typed `AOI + time window + source policy` primitives：`nearby(point,radius)`、`within(point/polygon)`、`aggregate(grid/admin)`、`zonalStats(DEM,polygon)`、`route/isochrone`，每一項回傳 source/version/freshness/coverage/status 與 null/missing/zero distinction。不要把 WorldMonitor 1-degree/centroid approximation 或 monolith visual height grid 升格為台灣精確空間分析；`analyze_situation` 應放在計算結果之後，且保留原始 evidence。

