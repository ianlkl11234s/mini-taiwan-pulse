# Status

**最後更新**：2026-06-02（**mini-taiwan-pulse 正式上線 Zeabur**）
**分支**：`master`（已部署）。`feat/fire-rescue` 已併入 master（~104 commits）並隨後多次 push。

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
