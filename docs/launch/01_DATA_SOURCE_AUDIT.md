# 逐層資料來源稽核（上線前）

> 2026-06-01｜129 個 layer 全分類｜目的：確認每層讀取方式合適有效率、不會打掛服務。
> 來源類型：**A** = Supabase public RPC｜**B** = 靜態 GeoJSON｜**C** = 靜態 PMTiles｜**D** = 外部 API / 混合

## 1. 來源類型統計

| 類型 | 數量 | 供應路徑 | 風險面 |
|---|---|---|---|
| A. Supabase RPC | 33 | PostgREST `public.get_*` | DB 負載 / timeout / 費用 |
| B. 靜態 GeoJSON | 79 | git→dist 或 S3→/data→nginx | 404 缺口 / 大檔載入 |
| C. 靜態 PMTiles | 10 | S3→/data→nginx（Range Request） | 404 缺口 / 體積 |
| D. 外部/混合 | 7 | OpenSky/AIS/CWA 經 Supabase | 同 A |

## 2. 資料供應「兩條路徑」契約

```
小檔 (<~2MB)  → 留 git → vite build 打進 dist/ → nginx 直接 serve（/, /geo/, /h3/, /bus/小檔）
大檔          → .gitignore → upload-deploy-assets.sh 上傳 S3
              → (部署時) pull-deploy-assets.sh 拉到 /data/<子目錄>
              → nginx location 反代 /geo/ /h3/ /fire/ /rail/ → /data/<子目錄>
```
**鐵則：任何前端會 fetch 的檔，必須「在 git」或「同時在 upload+pull+nginx 三清單」。缺一即 404。**（新資料 SOP 見 `04_NEW_DATA_SOP.md`）

## 3. 高風險 layer 標注

### 3a. Supabase RPC — 可能 >1s 或 >10k rows（已多數套 pre-aggregate）
| Layer | RPC | 狀態 |
|---|---|---|
| freewayCongestion | get_freeway_congestion_day | ✅ timeout 60s + 路段×時間矩陣 |
| wasteSchedule | get_waste_schedule_day | ✅ JSONB grouped（避開 PostgREST 20k 截斷，migration 063） |
| h3Population / youbikeFullness | get_h3_*/get_youbike_h3_snapshots | ✅ timeout 30s + H3 聚合 |
| groundwater / riverLevel / rainGauge / iotWra* | get_*_day | ✅ hourly DISTINCT ON（migration 060/060b 降採樣）|
| cwa/aqi imagery | get_*_imagery_frames_batch | ✅ timeout 60s（base64 大 payload） |
| **busLive / busIntercityLive** | get_bus_current 等 | ✅ 前端 `dedupRpc` 25s 去重 + 30s poll |
| **(get_bus_trails)** | get_bus_trails | ✅ live DB 實測 timeout=60s（migration 033 已覆蓋 030）；單城 22ms / 全城 35ms，零風險 |

### 3b. 靜態大檔（>5MB，初次載入需留意 UX，非 404）
water_flood_extreme 80MB、provincial_road 44MB、agri ftw_fields 102MB(PMTiles)、crop_suitability 74MB(PMTiles)、bus_stations_city 19MB、water_reservoirs 19MB、water_rivers 16MB、fire_hydrants 13MB(minzoom 12)、agri_retail 20MB、produce_wholesale 13MB。
→ PMTiles 已分級載入；GeoJSON 大檔靠 nginx 1d 快取 + gzip。**屬效能/UX，不影響上線正確性。**

## 4. 🔴 部署鏈 404 缺口（必修，否則明早這些 layer 全空）

### GAP-1（嚴重）— 整個農業群組會 404
`public/agriculture/` 的 **10 個檔（4 GeoJSON + 6 PMTiles，~380MB）**：
- 被 `.gitignore`（不進 dist）
- **不在** `upload-deploy-assets.sh`（不上 S3）
- **不在** `pull-deploy-assets.sh`（不落 /data）
- `nginx.conf` **沒有** `location /agriculture/`
- 連帶：`*.pmtiles` 的 upload/pull glob 會把農業 pmtiles **誤丟進 `/data/fire/`**，污染且仍 404。

**影響 layer**：agriculture, agriSoil, agriSoilFertility, agriLeisureFarmZones, agriRuralRegen, agriCropSuitability, agriPOI, agriRetail, agriProduceWholesale, agriWholesaleMarket（共 10）。
**修法**：見 runbook「修 GAP-1」（upload+pull+nginx+compose 四處補 `/agriculture/`，pmtiles glob 分流）。**注意：是否納入本次上線需你拍板（380MB 成本 + memory 記載「待 browser 驗收」）。**

### GAP-2（中）— bus 三大檔線上路由
`taipei/intercity/pingtungcounty_bus_routes.json` 有 upload(gzip)+pull(→/data/bus/)，但 **nginx 無 `location /bus/`**。

### 🔴 GAP-3（Codex 獨立審查發現，重要）— `/geo/` `/h3/` 無 dist fallback
`nginx location /geo/ { root /data; }`（同理 `/h3/`）**沒有 try_files fallback**，所以 `/geo/*` 一律只從 `/data/geo/` 找；**留在 git→dist 的小型 geo 檔不會被 serve**。受影響（git-tracked，pull 不抓）：station_points/polygons、port_polygons、lighthouse、wind_plan、airports、cctv、etc_gantry、service_area(_polygon)、taxi_stand、submarine_cables、landing_stations、news_events、waste_stops_static。`/h3/` 的 res7（socioeconomic/spatial_economy/demo/pop）同樣風險。

**實務影響分級**：
- 🟢 目前穩定版能跑 → 現有 `/data` volume 歷史上已被填過這些檔 → **沿用同一 volume 重新部署，不會壞**。
- 🔴 若 volume 全新/被清、或要可重現/災難復原 → 大量 404。
- **建議穩健解**：給 `/geo/` `/h3/` `/bus/` 加 dist fallback（`try_files $uri @dist_x`），image 自給自足、不依賴 volume 狀態（見 runbook STEP 4）。

### ✅ 已確認齊全（無缺口）
fire（fire_*.geojson + fire_isochrone_coverage.pmtiles）、road events、water_*（glob）、geo **列舉的大檔**（provincial_road 等在 pull 清單）、rail（tar.gz）、root json。

> 兩位 reviewer（內部 agent + Codex）對 /geo dist fallback 的初判不同，已以 nginx 實際語義（root 無 try_files = 不 fallback）為準採 Codex 結論。Dockerfile entrypoint 缺失（Codex 標 Critical）今晚已修。

## 5. Supabase 後端稽核（migration 靜態盤點 + DB 實測）

### 5a. ✅ anon RPC 授權 — DB 實測：81/81 全可呼叫，0 缺
> migration 098/100/101/102 檔內漏寫 14 個 GRANT，但 **DB 實際已補齊**（hotfix 未回寫檔案 = 文件債，非功能問題）。水資源/乾旱 layer **不會空白**。
> 建議：早上把 migration 檔補回 GRANT 段，消除文件債（見 SOP）。

### 5b. 🟡 anon 可繞 RPC 直讀曝光 schema（資安 + 費用，中度）
DB 實測 anon table-level SELECT：**realtime 459 表、reference 20、spatial 20、fire 17、maritime 5、rail 4、safety 2**。
PostgREST 實測曝光 schema = `public, graphql_public, reference, spatial, metadata, opendata, fire, maritime, rail, safety, demographics`。
- 🟢 **realtime 未曝光** → 459 張高頻表 anon key **打不到**（最嚴重情境不成立）。
- 🟡 reference/spatial/fire/maritime/rail/safety **曝光 + 有授權** → anon 可 `GET /rest/v1/<table>` 直讀（無 LIMIT/timeout），實測 `spatial.h3_demographics_yearly` 回 **HTTP 200**。
- **但前端實際只有** `earthquakeLoader.ts` 用 `.from()`（public），其餘全走 RPC → 這些 schema 曝光對前端**幾乎沒用到**，是可收斂的多餘面。
**建議（早上，需 smoke test）**：撤 anon 對這些 schema 的 table SELECT、或縮 exposed schemas，撤完逐層測。+ 加 Supabase API rate-limit / 前面擋 Cloudflare。

### 5c. 🟡 費用面
- 31 個 cron job 全 active（分鐘已錯峰，符合 cron_throttle 守則）。
- anon 直讀曝光靜態表 = 最易被刷 egress 的點（同 5b）。
- imagery base64 RPC payload 大，但有 timeout + 日期窗護欄。
- **Zeabur credit $0.00** → 帳務與 volume/egress 預算需早上確認。

## 6. 逐層完整清單

完整 129 層對照表（layer key / 分區 / 來源 / RPC或檔名 / loader / loadingRegistry / 動態 / 量級 / 載入時機）保存在本 session 稽核 agent 輸出。重點結論已濃縮於上 §3–§5。若需重生完整表，重跑稽核 agent 即可。
