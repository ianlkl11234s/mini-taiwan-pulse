# Status

**最後更新**：2026-06-12（newsEvents 從靜態 PoC 變自動化即時管線）
**分支**：`master`（已 push `7909b25`）。

## 2026-06-12 newsEvents 自動化即時管線（三 repo）

- **data-collectors `209bde8`**：`collectors/news_events.py` — RSS ×29 → URL 正規化 + simhash 去重 → Gemini Flash-Lite 地名抽取（20 則/batch、368 鄉鎮白名單、LLM 不吐座標）→ `realtime.news_events`，20 min/輪
- **gis-platform `e7d18c2`**：migration 162（已 apply）— 表 + geom trigger（admin_code→界圖 PointOnSurface，縣市級 fallback ST_Union）+ daily pre-agg + cron job 55（14,34,54 分）+ `get_news_events_day` / `get_news_event_dates` RPC
- **本 repo `7909b25`**：`newsEventsLoader.ts` + `useNewsEventsLayer.ts` + `OverlayConfig.dynamicData`；useNewsTimeline/popup 零改動
- 驗收：瀏覽器 204 則/today + ripple + popup PASS；tsc + 55 tests 過；成本穩態估 $1.5–3/月
- ✅ 生產已上線（2026-06-13 凌晨）：Zeabur env 已設 + 部署完成，首輪 00:14 入庫 29 則、cron job 55 自動聚合確認。觀察項：自由時報 RSS 被 Zeabur IP 403（本地正常），持續的話改走 Google News 間接
- 詳見全域記憶 `news-roadmap.md` + `docs/research/news-layer-revival-2026-06.md`

## 2026-06-08 hikingTrails 全台步道 layer（FORESTRY 區段）

新增單一靜態 layer `hikingTrails`，整合 6 來源、按 `source` 屬性上色。共 **7,339 條**（去重後），20 MB GeoJSON。

### 資料來源（公開／合法）

| Source | 條數 | 抓法 | 顏色 |
|--------|------|------|------|
| `A_forest` | 345 | 林業署 `/Files/RT/GE/{TRAILID}.kml` 批次下載（CSV 列出 115 條 TRAILID）| `#d62728` |
| `B_osm` | 7,135 | Overpass 寬版 query — 含 `highway=path` 且 name 含「步道\|古道\|山徑\|親山\|登山」+ `foot=designated` + `sac_scale` + `route=hiking` relation | `#1f77b4` |
| `C_np_sheipa` | 107 | data.gov.tw dataset/174421 雪霸 SHP | `#2ca02c` |
| `C_np_kinmen` | 20 | data.gov.tw dataset/174421 金門 KML（zip cp950 解壓）| `#9467bd` |
| `D_taipei_grand` | 11 | 臺北大縱走 9 段 GPX（Google Drive 公開連結，taipeigrandtrail.gov.taipei）| `#ff7f0e` |
| `D_newtaipei` | 307 | 新北市觀光局 GPX 84 檔（newtaipei.travel/file/{id}，含微笑山線 6 段、淡蘭古道、22 區）| `#e377c2` |

7 處未開放官方步道線段的國家公園（太魯閣／玉山／陽明山／墾丁／台江／東沙／壽山）改靠 B + spatial join 各 NP 邊界 polygon 標上 `in_national_park` 欄位（boundary 來自同 catalog 9+1 個範圍 SHP）。

### 去重邏輯
A 為主：以 A 線段 EPSG:3826 buffer 50m 為 union，B/C/D 線段落在 buffer 內 ≥ 50% 長度視為與 A 重疊 → `is_dup_of_A=true`。Pruned 版（給前端用）保留全部 A + 非重疊 B/C/D，共 7,339 條。

### 健行筆記（hiking.biji.co）
**不抓**。雖然 GPX 規模 5,000+ 最完整，但需登入 + scraping 違反 ToS、再散布構成著作權與不正競爭法 § 25 風險。決議只用政府開放資料 + OSM。

### 接線觸點（10 個檔，依專案 SOP）

```
src/types/index.ts                      ExpandableLayerKey + LayerVisibility + FeatureInfo.layerType
src/map/overlayRegistry.ts              glow + line（match by source 6 色）
src/components/sidebar/layerCatalog.ts  LAYER_COLORS + FORESTRY section
src/components/IconRailSidebar.tsx      Footprints icon
src/hooks/useLayerVisibility.ts         預設 false
src/hooks/useTransportParams.ts         opacity + width slider + memo deps
src/components/LegendPanel.tsx          FORESTRY_LEGEND_ROWS + HikingTrailsSourcesLegend (6 列)
src/components/FeatureInfoPanel.tsx     HikingTrailsPanel + HEADER_LABELS
src/hooks/useMapInteraction.ts          GIS_LAYERS popup target
scripts/deploy/upload-deploy-assets.sh  FOREST_FILES 加 hiking_trails.geojson
```

### 來源資料工作目錄（不在 repo）

`/Users/migu/Downloads/taiwan_trails/`
- `A_forest_kml/` 109 KML
- `B_osm/raw.json` 17 MB Overpass response（寬版）
- `C_nationalpark/` 雪霸 SHP + 金門 KML/KMZ + 10 處 NP 邊界 SHP
- `D_taipei_grand/` 9 GPX
- `D_newtaipei/files/` 84 GPX + manifest.json
- `build_merged_v2.py` 整合 pipeline（→ output/taiwan_trails_{merged,pruned}.geojson）
- `output/preview.html` Leaflet 預覽

如要更新：跑 `python3 build_merged_v2.py` → 複製 pruned.geojson 到 `mini-taiwan-pulse/public/forestry/hiking_trails.geojson` → push（小檔走 git，部署時 entrypoint pull）。

## ⭐ 當前狀態：已正式上線

- **線上網址**：`https://mini-taiwan-pulse.itsmigu.com`（+ `mini-taiwan-pulse.zeabur.app`），前面有 **Cloudflare**。
- **Zeabur service**：`service-69a3b5f307e6de1869be6e2c`，git-connected → push master 自動 build（從 git）+ 部署，零停機切換。
- **資料流**：Supabase RPC（動態）+ 靜態檔（小檔 git→dist / 大檔 S3 `deploy-assets/`→entrypoint pull→`/data` volume→nginx）。
- **上線稽核全文**：`docs/launch/` 8 份（00 計畫 / 01 逐層稽核 / 02 Go-NoGo / 03 runbook / 04 新資料分類SOP / 05 晨間報告 / 06 deploy-assets搬家 / 07 key設定 / 08 上線後硬化）。

## 本次上線做了什麼（2026-06-02，已全部部署驗證）

### 部署鏈強化
- **Dockerfile entrypoint**（`scripts/deploy/entrypoint.sh`）：背景 `pull-deploy-assets.sh` + nginx 立即前景啟動（避免大量 pull 阻塞 Zeabur 健康檢查）。
- **pull 全面改 `aws s3 sync`**：重啟幾乎零下載；agriculture 整夾 sync（`--exclude "agriculture/*"` 防 fire pmtiles 遞迴誤抓）；bus/rail 變更才解壓。
- **nginx `/geo /h3 /bus` 加 `@dist` fallback**：git 小檔即使 volume 空也 200；新增 `/agriculture/` location。
- **移除 nginx `/api`→pulse-api 死碼**：前端全走 Supabase，nginx 不再依賴 pulse-api 存活。
- **package-lock 同步**（移除 fr24sdk）避免 `npm ci` 失敗。
- 安全網 tag：`backup/pre-launch-master-*`、`backup/pre-launch-feat-*`、`backup/pre-merge-master-localhead`。

### 前端功能（已上線）
- **農業 +2 新層**：`farmRoads`（農路 8678 線，寬度+透明度+popup，minzoom 8）、`ecoNetworkZones`（國土綠網 12 地理分區面，12 色 match+圖例+popup）。新建 `src/data/ecoNetworkZoneTypes.ts`。
- **flight/ship 開啟顯示 loading 圈圈**：custom layer render() 狀態機（首幀啟動 loadingRegistry → 空轉 3 幀讓圈圈 paint → 才跑同步 Three.js 建構 → 建完收圈圈）。本地 agent-browser 實測捕捉到「航班軌跡 渲染中」。
- **3 UI 改**：移除左側 Data Availability(日曆) icon、齒輪改「設定功能規劃中」提示、表定音符(`wasteScheduleNote`) 預設關閉。
- **預設開站視角**：`overview` preset 改 center [120.3795, 23.6081] / zoom 6.9 / pitch 0 / bearing 0（全台平視；同時影響「全台總覽」location 按鈕）。

### 基礎建設（用戶執行 / 設定）
- **D1**：Zeabur runtime S3 改**唯讀 key**（只 GetObject deploy-assets/*）+ Mapbox token 加 URL 限制。
- **Cloudflare**：Cache Rule 快取 `/geo /h3 /bus /agriculture /fire /rail`（HIT 省回源）+ Status Code TTL **404/5xx → No cache**（修「固定 TTL 把暫態 404 釘 1 天」事件）。
- **D4 誤報**：`get_bus_trails` live 已 60s（migration 033 覆蓋 030）、實測 22-35ms，零動作。

## ⚠️ 上線後待辦（見 BACKLOG「上線/部署」區）

- **D3（P1）資安收斂**：收窄 Supabase Exposed schemas（只留 public+graphql_public），擋 anon 直讀 reference/spatial 等表。**前置**：先掃其他共用 gis-platform 的站（mini-taiwan-info 等）確認無 REST 直讀。**不可撤 table grant**（74/81 RPC 是 INVOKER 會掛）。詳見 docs/launch/08。
- **LA-5（P2）deploy-assets 搬家**：扁平→鏡像結構 + manifest 總帳（docs/launch/06），加新大檔 0 改腳本。
- **LA-7（P2）帳務觀察**：Supabase 連線/CPU/egress + Zeabur/Mapbox 用量，設帳單警報（有 spend cap/IO 爆表前科）。
- **LA-6（P3）**：評估關閉 pulse-api service 省錢（前端已不用）。

## 新增 layer 完整接線（本次 2 層的觸點，供下次參考）

types/index.ts（LayerVisibility + ExpandableLayerKey + FeatureInfo.layerType）、overlayRegistry.ts（line/fill entry）、
layerCatalog.ts（LAYER_COLORS + SECTIONS）、useLayerVisibility.ts（預設 false）、useTransportParams.ts（opacity slider + overlayParams 物件 + deps array）、
LegendPanel.tsx（分類圖例 + import types）、useMapInteraction.ts（GIS_LAYERS popup）、FeatureInfoPanel.tsx（case + sub-panel + **HEADER_LABELS**）、
IconRailSidebar.tsx（**LAYER_ICONS**）、upload-deploy-assets.sh（AGRI_FILES）。**3 張 exhaustive Record（LAYER_COLORS/LAYER_ICONS/HEADER_LABELS）缺一即 tsc TS2739**。詳見 PRINCIPLES + docs/launch/04。

## 先前進度（2026-05 前，保留摘要）

- 5/26 消防救援等時圈（PMTiles + 全國聚合 + 屏東 geocode；PB-16）
- 5/25 農企業登記 3 layer（overlayRegistry，AG-6 已於上線一併部署）
- 5/23 農業 Phase 3 Batch 1（6 layer + 132 作物 dropdown + UX 四鐵則）
- 5/8~14 廢棄物 OSRM map-matching + 22 城 schedule（89.6% coverage）
- 4 月 水資源 Phase 1/2 + iot_wra + 河川/地下水 delta 著色
