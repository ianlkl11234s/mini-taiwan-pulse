# Handoff — 公共生活與韌性資料系統（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/public-life-resilience.md`
> **狀態**：local frontend ready / CDN-ready assets / not published
> **最後更新**：2026-09-23
> **Pulse worktree**：`codex/public-life-systems-20260922`

本 feature 不建立一個「全部生活設施」的大 layer。前端繼續使用各服務家族的 layer key，再以「日常補給」、「避難」、「無障礙探索」、「單車補給」、「自然遊憩」做交叉入口，避免複製資料與困難的總分數。

## 目前 Pulse 可用基底

| 家族 | 現有 layer | 下一步 |
|---|---|---|
| 公廁 | `publicToilets` | 已有場所類別 multi-select、grade legend、來源 popup 與 z16 名稱標籤；無障礙／親子篩選仍待上游補欄位 |
| 垃圾／回收 | `wasteStopsStatic`、`wdMixed`、`wdRecyclingContainer`、`wfRecycling` 等 | 先區分清運停靠、容器、處理設施；材質用 filter |
| 防空 | `civilDefenseShelter` | 與 analytics canonical rows／hash／schema 回讀；排除低精度點的距離分析 |
| 公園 | `parksTaipei` | key／asset 名稱與實際 3 市 coverage 對齊；拆出遊戲場與無障礙細節 |
| 單車 | `bikeStations`、`cyclingRoutes`、`youbikeFullness` | 不重做基底；增加停車／維修／打氣，並交叉飲水／公廁 |
| 自然遊憩 | `tourScenicAreas`、`forestRecreation`、`hikingTrails`、`forestTrailSigns` | 新增可追溯的臺灣國家公園；風景區補滿 13 處後才宣告完整 |

## 本次已接線 layers

1. `drinkingWaterPoints`：飲水／補水點，顯示 source coverage、access、opening hours 與 unknown。
2. `publicWasteBaskets`：公共垃圾桶；不與定點垃圾收集車停靠點混用。
3. `materialRecyclingPoints`：點位共用一層，依 `materials[]` 做 multi-select，不細切成數十 layer。
4. `disasterShelters`：預定天災收容處所。
5. `playgrounds`：兒童遊戲場，與 parks polygon／point 關聯但不合併。
6. `accessibleParkFacilities`：廣義 OSM 無障礙設施探索，含出入口、遊具、公廁、路徑與其他 POI；不限於公園。
7. `bicycleSupport`：維修、打氣、停車與綜合補給。
8. `nationalParks`：臺灣 9 座國家公園＋1 座國家自然公園，保留計畫版次與海陸範圍。
9. `visitorCentres`：OSM 遊客中心觀測點；非完整官方清冊。
10. `publicLifeOsmCoverage`：H3 r7 OSM 映射密度；只顯示觀測密度，不是服務覆蓋或可達性。

`activeDisasterShelters` 未公開：77133 事件狀態快照 66 列尚無可靠 geometry，無法與 73242 預定場所穩定連結，繼續 HOLD。

## 圖層 UX 一致性（2026-09-23）

- 公共生活色票集中於 `src/data/publicLifePalette.ts`，manifest、overlay、legend 與 popup 共用；公共垃圾桶由過暗的 `#a16207` 調亮為 `#d97706`，其餘維持水務青、回收綠、避難橘、遊戲粉、遊客中心靛色與狀態／服務語意色。
- 有真實分類欄位的 layer 使用既有可展開 multi-select：公廁場所類別、回收材質、預定收容適用災害、無障礙設施類型＋狀態、單車補給服務。全選保留所有資料；部分選取只顯示來源明列的分類；全關不退回全顯示。
- 名稱標籤只在適合閱讀的 zoom 顯示：遊客中心 z10、飲水 z13、回收／遊戲場／單車 z14、垃圾桶／預定收容 z15、公廁／無障礙 z16。碰撞排版由 Mapbox 控制，低縮放仍只顯示點位。
- symbol label 不加入 `queryRenderedFeatures`，避免 Mapbox symbol query 破壞 popup；popup 仍由既有 circle／glow 命中。
- 公廁 popup 已補「環境部列管公廁（同址聚合）」、來源機關、FAC_P_07 端點、OGDL-Taiwan-1.0 與 2026-07-17 抓取日。無障礙 popup 的標題色改以 accessibility status 為準，不再被 playground 等 `feature_type` 色覆蓋。

## 資產與傳輸

- 追蹤契約：`public/public_life/manifest.json`，狀態 `local_verified_cdn_ready_not_published`。
- 10 份 GeoJSON／PMTiles 已安裝到 `public/public_life/`；build 後出現於 `dist/public_life/`。
- 飲水、單車補給、無障礙與預定收容 PMTiles 為 z0–z14 full-density：不用 density drop／feature cluster，逐 zoom 的唯一 `entity_id` 均等於可定位來源筆數。垃圾桶、回收、遊戲場與遊客中心 GeoJSON 也維持一來源實體一顯示點。原始 OSM 線／面仍在 analytics canonical GeoJSON；前端只用帶有 `source_geometry_type`／`display_geometry_method` 的代表點顯示。
- deploy scripts 將目錄鏡像到 `deploy-assets/public_life/`；nginx `/public_life/` 優先讀 `/data`，再 fallback 到 dist。
- nginx 已定義 `application/vnd.pmtiles` 與 `application/geo+json`，PMTiles 支援 HTTP Range。
- 本次沒有執行 S3 upload、deploy 或 production activation。

## 本機驗收紀錄

- 契約：10 份資產的 bytes、SHA-256、source feature count 驗證通過。
- full-density：飲水 3,369、單車補給 11,989、無障礙 20,870、預定收容 5,946 的唯一 `entity_id`，均已在 z0–z14 逐級守恆；垃圾桶 662、回收 640、遊戲場 2,580、遊客中心 15 的 GeoJSON 全數為 Point 且 ID 守恆。收容來源另有 27 列缺 geometry，保留缺值且不製造座標。
- 前端：10 層已納入 type、manifest、catalog、overlay、click registry、legend、popup 與 params；golden snapshot 為 788 layers。所有點位層都有透明度／大小控制，國家公園只保留 fill + outline 與透明度控制，不產生邊界 circle。公廁／回收／預定收容／無障礙／單車補給另有分類 multi-select；命名點位依 zoom 顯示標籤。
- browser：z7.2 全臺視圖同時顯示飲水、垃圾桶、回收、預定收容、遊戲場、無障礙、單車補給、遊客中心八個點圖層；z11.6 點選飲水點與 z17 點選原始 MultiPolygon 的回收設施，皆可讀回來源、原始幾何、顯示位置、快照與授權，console 無 warning/error。H3 映射密度、國家公園邊界也已分別載入；點位大小／透明度即時變更、可展開 row、attribution、legend 與國家公園 popup 已讀回。
- popup：公共生活 POI、預定收容所、國家公園與既有公廁統一使用色點標題、資料角色、來源 footer；保留 snapshot coverage、geometry precision、license、fetched_at 與 `unknown` 語意。
- 本輪自動驗收：`npx tsc -b`、`npm run build`、全量 Vitest 243 files passed / 1 skipped，1,819 tests passed / 10 skipped。瀏覽器驗證公廁「場所類別」11 選項可全關後單選公園（1/11），z16 顯示點位標籤；點擊 circle 可讀回同址聚合、等級、類別、來源、授權與抓取日。symbol label 曾造成 Mapbox query error，移出 click registry 後 popup 恢復，reload 後未新增 console warning/error。
- PMTiles 本機 Vite Range 請求回 `206` 及正確 `Content-Range`；生產 nginx 設定已登記 `application/vnd.pmtiles` 與 `/public_life/` data→dist fallback，但尚未取得 CDN/production readback。
- 尚未取得生產 CDN 讀回、部署與 production browser 證據。

## 前端資料契約

全部服務 POI 應共用下列心智模型，但不強迫每個 source 擁有全部欄位：

- identity：`entity_id`, `name`, `feature_type`, `service_tags[]`
- service：`access`, `opening_hours`, `status`, `temporary`, `capacity`
- accessibility：`wheelchair`, `accessible_entrance`, `accessible_toilet`, `accessible_play`
- domain：`materials[]`, `disaster_types[]`, `repair_tools[]`, `drinking_water`
- evidence：`source`, `source_url`, `license`, `fetched_at`, `coverage_scope`, `geometry_precision`

Popup 不得隱藏下列語意：`unknown`、`temporary`、`stale`、`approximate`、`government_only`、`osm_only`、`pending_review`。

## 側邊欄組織建議

保留現有 theme 歸屬，用交叉入口或 saved view 收納，不將相同 layer 複製到多個 catalog：

| 探索入口 | 初始圖層組合 |
|---|---|
| 日常補給 | 飲水、公廁、垃圾桶、回收點 |
| 災害避難 | 天災收容、臨時開設、防空、疏散設施 |
| 親子與無障礙 | 公園、遊戲場、無障礙設施、公廁 |
| 單車補給 | 站點、車道、停車、維修打氣、飲水、公廁 |
| 自然遊憩 | 國家公園、國家風景區、森林遊樂區、步道、山屋、遊客中心 |

## 接線順序

每一批都先完成上游 artifact／manifest／handoff 回讀，才做前端：

1. `src/types/index.ts`：layer key，visibility，feature-info type。
2. `src/data/layerManifest.ts`：section、upstream dataset，source URL，description，legend，popup。
3. `src/data/layerParamsSpec.ts`：opacity，有 4 個以上類別時提供 select；材質使用 multi-select。
4. loader／hook／host：所有 async loader 進 loading registry，且卸載或切換時忽略過期結果。
5. `src/map/overlayRegistry.ts` 或 custom layer：點／線／面各自維持 geometry 語意。
6. `src/map/gisClickRegistry.ts` 與 `src/components/featureInfo/`：popup 顯示資料時點、源、coverage，不把 null 轉 0／no。
7. tests：layer consistency、overlay expression、static asset／PMTiles contract、interaction。
8. browser：toggle，opacity，legend，popup，select，network content-type，實際 feature readback，desktop／mobile。

## 批次與驗收

| 批次 | 前端目標 | 開工 Gate |
|---|---|---|
| 0 | 修正既有公園／防空／風景區／公廁契約漂移 | upstream rows/hash/schema/coverage 已確認 |
| 1 | 公廁屬性升級＋飲水探索層 | 飲水各 source coverage 已量化 |
| 2 | 天災收容＋臨時開設＋防空分層 | 預定／已開設與時間契約過關 |
| 3 | 垃圾桶／回收點／材質篩選 | 清運停靠與垃圾桶已分類 |
| 4 | 遊戲場／無障礙設施探索 | yes/no/limited/unknown 可分辨，unknown 不等於否 |
| 5 | 單車補給交叉探索 | 既有站點／車道不重複接線 |
| 6 | 國家公園＋完整 13 風景區＋園區服務 | 10 公園與 13 風景區 completeness gate |
| 7 | nearest／isoline／coverage 分析呈現 | 路網版本、cutoff、missingness 契約已固定 |

## 不可發布的情形

- 以 SPA HTML 200 當資產上線證據，卻未驗 content-type／結構／點數。
- 以 OSM 未標記斷言沒有無障礙、不開放或不回收。
- 將防空避難、天災收容與集合點合為一層。
- 將預定收容所呈現成「現正開設」。
- 局部縣市資料使用「全台」標籤。
- `tourScenicAreas` 未補雲嘉南卻對外宣告 13 處完整。

## 剩餘 HOLD／後續批次

- 事件期間已開設收容處所：先完成 77133 與場所 geometry 連結契約。
- 國家風景區：現有 `tourScenicAreas` 只有 12 處，缺雲嘉南，不宣告全國完整。
- 真正可達性：需另行固定路網版本、移動模式、cutoff、人口格網與 missingness 契約。
- 官方公廁無障礙／親子屬性、全國官方遊戲場清冊，仍是下一批資料強化。
