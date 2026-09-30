# Network Structures handoff

## 上游與版本

- 上游 [Analytics PR #79](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/79)，merge `710ff483ebad217fc77afa43baccf81a97c2ebbf`。
- [固定版本資料契約](https://github.com/ianlkl11234s/taipei-gis-analytics/blob/2ae0cd7bacc53b3772dcd5fb090081c672ec620c/docs/handoff/network-structures.md)，pipeline commit `3ae244f`、lineage commit `2ae0cd7`。
- `20260906` 是 build ID；feature 的 `source_date` 才是來源時間。OSM snapshot 為 2026-09-05 20:22:06 UTC；官方 2025-12-29 是目錄更新日，並非逐橋調查日。
- 靜態 PMTiles，沒有新增 DB migration／RPC／collector。既有會員與交通統計功能保留。

## 四層契約

| layer key | PMTiles source-layer | 原始 features | archive zoom |
|---|---|---:|---|
| osmBridgeCarriers | osm_bridge_carriers | 45,721 | 5–14 |
| osmBridgeFootprints | osm_bridge_footprints | 1,505 | 8–15 |
| officialBridgesNewTaipei | official_bridges | 1,028 | 7–15 |
| bridgeComparisonNewTaipei | bridge_comparison | 4,267 | 7–15 |

前端位置：交通 Move → 路網結構 Network Structures。搜尋「橋梁」可找到四層。每層提供圖例、popup、透明度；承載線另有類型篩選，官方／比對另有大小，比對另有狀態篩選。

- OSM 承載線數是 ways 數，不能解讀為實體橋梁座數；輪廓只使用原生橋梁面，不生成緩衝區充數。
- 官方清冊只涵蓋新北市轄管橋梁；軸線是近似幾何，`official_length_m` 才是登錄長度。179 筆軸線距離超過登錄長度 1.25 倍，保留兩者差異。
- ID 427「菜公坑一號橋(4C-23)」原始兩端重合，保留 Point、登錄長度 6.4 m；比對狀態 NOT_EVALUATED，評分缺值，不造假線、不補零。
- `match_confidence` 是候選規則評分，非校準機率。MATCHED 顯示「候選一致」，不聲稱權威身份確認。OSM_ONLY 不代表官方漏登。
- 比對範圍使用新北市行政界多邊形；候選距離使用 EPSG:3826。MVT 省略 null 屬性時，popup 仍顯示缺值。

## 部署與保全

四份 PMTiles 保存於 `deploy-assets/network_structures/`，由容器拉到 `/data/network_structures/`。nginx 路由對不存在檔案回 404，支援 Range，避免 SPA HTML 偽成功。

13 份物件（四圖磚、metadata／QC／manifest、六原始輸入）已完整 SHA-256 readback，見 [storage receipt](../../audit/network-structures-release-20260906/storage-readback.json)。原始資料位於獨立 `source-archives/network_structures/20260906/raw/`，不隨網站容器下載。

發布腳本 `scripts/deploy/publish-network-structures.py` 預設只列計劃，`--apply` 限定本次資產、使用條件式建立，拒絕覆蓋同名不同內容；來源／產物 hash 先校驗再發布。

本地、storage、正式站證據分列於 [release audit](../../audit/network-structures-release-20260906/README.md)。原始 dirty checkout 與其他交通統計 session 未操作。

## 2026-09-24 本地交通設施擴充

上游 [Analytics PR #102](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/102)
已以一般 merge commit `a96ae0267cb7eadd5719e6a6bf1ddeb25557ae22` 合併；隔離分支
`codex/transport-facilities-data-20260923`：橋梁資料
`f70ce086`、隧道 `b9029812`、彰化號誌 `b60308fc`、盤點與瀏覽器驗收紀錄 `5b295bac`。
資料契約分見上游 `docs/handoff/network-structures.md`、
`docs/data-catalog/transportation/tunnels.md`、
`docs/data-catalog/transportation/roadside_facilities.md`。下列五個新 layer 是本地研究快照，
沒有改動既有四層的 `20260906` 發布版本。

| layer key | 本機 PMTiles / source-layer | 來源 features | SHA-256 |
|---|---|---:|---|
| `tainanBridgeInspections` | `tainan_bridge_inspections_20260924.pmtiles` / `tainan_bridge_inspections` | 1,719 檢測列 | `a1e1eee288ae2bf955baf91c56fb241b29c63d8dae3c51913074d2c9634f37b4` |
| `officialBridgesHsinchu` | `official_bridges_hsinchu_20260924.pmtiles` / `official_bridges_hsinchu` | 175 清冊列 | `63c6c7d092deb87b4b614efe2eed7c89b9b4a0323f584b7ef611613f800e82fb` |
| `taipeiRoadTunnels` | `taipei_road_tunnels_20260924.pmtiles` / `taipei_road_tunnels` | 13 登錄點 | `01e444524605158a89fda0fa1cbc0864c2ae39f28c6cd105125b67e1719eb5f2` |
| `tainanRoadTunnels` | `tainan_road_tunnels_20260924.pmtiles` / `tainan_road_tunnels` | 6 登錄點 | `9b9840d1b60fea67ec3e97b1d98e84766754457e5922600514bf4b21de7862bf` |
| `changhuaTrafficSignals` | `changhua_traffic_signals_20260924.pmtiles` / `changhua_traffic_signals` | 3,448 有效點 | `5df464248100551cc8a38cdb18153cd5ae6af7aa9eb251a3a6b24be91f25009c` |

圖磚在隔離 worktree 的 `public/network_structures/`，該目錄依 `.gitignore` 留待 S3 發布，
**不隨 Git commit 轉移**。五層已在本機 `127.0.0.1:4179` 實際繪製並點選 popup；
2026-09-25 已將五份圖磚發布至 `deploy-assets/network_structures/`，逐檔從 S3 完整讀回並
與本表 SHA-256 比對通過，見 [storage receipt](../../audit/network-structures-release-20260924/storage-readback.json)。
發布前正式站五個 URL 均為 HTTP 404；合併及部署後仍須確認正式站 Range 206 和瀏覽器實際顯示。
臺南檢測列數不是橋座數，新竹兩端是近似軸線，隧道只畫官方登錄點，彰化號誌沒有即時燈態。
`bridgeRainThresholds` 是既有測站資料的環境條件試點，不能解讀為橋梁檢測或安全判斷。

## 全臺橋梁研究圖層（進行中，站主限定）

狀態（2026-09-29）：`bssNationalBridgePreview`（線）與 `bssNationalBridgePointsPreview`（點）從舊工作樹
`transport-facilities-20260923`（僅 DEV 顯示）移植到 master 現行慣例，改為**站主限定私人 PMTiles**。授權仍是
`HOLD_BSS_BULK_REUSE_RIGHTS_UNCONFIRMED`，解除前不得公開；**尚未上傳、尚未部署**。

| 項目 | 內容 |
|---|---|
| 標籤／群組 | 「全臺橋梁方向候選（進行中）」「全臺橋梁清冊點位（進行中）」；交通 Move →「橋梁研究（進行中）」 |
| 語意 | 26,188 筆是 BSS 來源紀錄，不是去重後橋座數；23,772 條無向局部方向候選（含 11 條新增）、2,416 筆只有點；方向線不是橋長、橋頭尾或路網；影像抽驗 300 筆為 103 支持／2 負向／195 未定，整體錯誤率 <3% 尚未證明 |
| 來源 | BSS 公開查詢（授權 HOLD）、OpenStreetMap（ODbL）、新北市官方清冊 |
| 資料檔 | `bss_bridge_location_direction_preview_20260927_v4.pmtiles`，63,367,460 bytes，SHA-256 `2d71de78be8b4c3c19b8a683946a1f083f37e160182b8932cd288fdbe713072f`；source-layer `bss_bridge_national_preview`（z6–15），一個檔兩層共用一個 source |
| 本機讀取 | sidecar（`node server/coral-private/coral-private-server.mjs`，port 8796；vite dev 已 proxy）預設讀舊工作樹 `.worktrees/transport-facilities-20260923/bss-bridge-pilot.local/bridge-location-direction-preview-20260927-v4/`；可用 `BSS_BRIDGE_PRIVATE_ROOT` 覆寫。PMTiles 不進 `public/`、不 commit |
| production 路徑 | S3 `migu-private-research-ap-southeast-2` / `private-research/bss-bridge/<sha256>/<filename>`；前端只打同源 `/api/private-research/bss-bridge/tiles`（nginx 精確 location + Range，其餘 404） |
| 站主限定 | `GATED_LAYERS`＋`App.tsx` `lockedKeys`（`useBssBridgePrivateAccess` 驗證後才解鎖）＋失權即關圖層清 popup；作法同 [土壤液化](../soil-liquefaction/handoff.md)。未加入 `RELEASE_HOLD_LAYERS`（那會連站主也鎖死） |
| 接線 | `src/data/bssBridgeTypes.ts`（契約、色票、篩選）、`src/hooks/useBssBridgeLayers.ts`、`src/hooks/useBssBridgePrivateAccess.ts`、`src/layers/hosts/bridgeHosts.tsx`；popup `BssNationalBridgePreviewPanel`；sidecar `server/coral-private/coral-private-server.mjs` `BSS_BRIDGE_*` |
| 控件 | 線：透明度／交通類別／品質；點：透明度／大小／品質（品質預設「全部」；「影像有支持」只留綁定第一階段 release 的 103 筆） |

### 上線步驟（需使用者授權，Claude 不代為執行）

1. 使用者確認要在授權 HOLD 下以站主限定方式上私人 bucket。
2. 使用者以 S3 憑證執行：`node scripts/deploy/upload-bss-bridge-private.mjs <v4 資料夾>`（會核對 `local_validation.json` sha256、bytes、bucket policy 無公開 Allow、讀回比對、匿名 HEAD 必須 403）。
3. Pulse PR（`gh pr merge --merge`）→ 部署。若部署早於上傳，只有 BSS 家族 warm 失敗，站主看到 sidecar unavailable，其他私人家族不受影響。
4. production 動態 `get_layer_gates()` 若為權威：目前兩個 key 只靠前端 `GATED_LAYERS` 與 sidecar owner 驗證，DB 端沒有 `gated_layers` row；要在後台顯示／管理需 gis-platform 補 row（待拍板）。
5. 重產 PMTiles 後同步更新 sidecar `BSS_BRIDGE_ASSETS` 的 size／sha256。

### 分析專題（反向連結）

`taipei-gis-analytics/pipelines/analysis/bridge_resilience/`（目前在 analytics 工作樹 `.worktrees/bridge-resilience-20260929`，未 merge master）。圖層只呈現候選位置與方向，不是該專題的路網或韌性結論。

## 雙北跨河橋梁韌性圖層（研究中，站主限定）

狀態（2026-09-30）：`bridgeResilienceTwinCity` 顯示 analytics 專題 §8／§8b 的前端顯示成品（v2，含**目的地視角**）；**尚未上傳、尚未部署**。授權
`HOLD_BSS_BULK_REUSE_RIGHTS_UNCONFIRMED`（橋的身份判定鏈用到 BSS），解除前不得公開。分析專題（反向連結）：
`taipei-gis-analytics/pipelines/analysis/bridge_resilience/README.md` §8／§8b（v2 在 analytics 工作樹 `.worktrees/bridge-destination-20260930`、分支 `feat/bridge-destination-view`，未 push）。

| 項目 | 內容 |
|---|---|
| 群組／標籤 | 交通 Move →「橋梁研究（進行中）」（與 BSS 兩層同群組，同一站主限定研究主題）；「雙北跨河橋梁韌性（研究中）」 |
| 來源 bundle | `taipei-gis-analytics/data/processed/transportation/bridge_resilience/bridge-display-bundle-20260930-v2/`（唯讀）；receipt `dataset_id=bridge_display_bundle_20260930_v2`（v1 全部檔案原樣＋`village_destinations.json`；`bridges.geojson` 是唯一改動的 v1 檔：77 個裸 NaN→null）。v2 receipt.json SHA-256 `d60ab5a7…64ba` |
| 輸入檔 SHA-256 | `bridges.geojson` 1adfbae9…3c3e（118,119 B，v2；v1 是 34938880…7253／118,042 B）；`replacement_routes.geojson` 3a09c123…2828（1,415,563 B）；`villages.geojson` 5a6725aa…ce22b（1,896,133 B）；`bridge_summary.json` 4b04d5bb…1574（63,004 B）；`village_impacts.json` 4df8f4cb…2764（1,333,831 B）；`village_destinations.json` d2da4228…64b5（6,425,352 B） |
| 私人資產（前端契約） | `bridge-resilience-20260930-v2.pmtiles` 1,944,552 B、SHA-256 `434e38bdcdf63c940529a7320242feb3c6fe8d5d560c94443b433c1fc8b88852`（z8–14，source-layer `bridges`／`replacement_routes`／`villages`；villages 以 `int(VILLCODE)` 當 feature id）；`bridge_summary.json`、`village_impacts.json`、`village_destinations.json` 原檔（SHA 同上）。`village_destinations.json` 6.4 MB < sidecar 單一 Range 上限 8 MB，**懶載入**：第一次點村里才下載 |
| 打包 | `python3 scripts/preprocess/build-bridge-resilience-private.py <v2 bundle_dir> <out_dir>`：先依 receipt 驗輸入 SHA 與大小，再用 tippecanoe 打包，最後寫 `local_validation.json`（含 `village_destinations.json`）。**tippecanoe 重跑不保證位元相同**；重打包後要同步改 sidecar `BRIDGE_RESILIENCE_ASSETS`、`bridgeResilienceTypes.ts` `BRIDGE_RESILIENCE_ASSETS`、manifest 註記（`sidecar 資產契約` 測試會擋不同步）、sidecar 測試 pinned 值 |
| 上游缺陷（v2 已修） | v1 `bridges.geojson` 的 77 處裸 `NaN`（無名匝道 `name`）在 v2 改為 `null`；打包腳本仍對 null／NaN 一律移除該屬性（無名＝沒有 `name` 欄位） |
| sidecar 家族 | `bridge-resilience`，`/api/private-research/bridge-resilience/{tiles,summary,impacts,destinations}`（Range only、每個請求驗站主、`?access=1` 探測）；S3 `migu-private-research-ap-southeast-2` / `private-research/bridge-resilience/<sha256>/<filename>`；nginx 精確 location＋其餘 404；vite dev 已 proxy。JSON 也走 Range（sidecar 沒有整檔 GET，前端以已知大小要整段） |
| 本機讀取 | 預設讀本工作樹（`.worktrees/bridge-destination-view-20260930`）`bridge-resilience.local/bridge-display-bundle-20260930-v2/`（`*.local` 已 gitignore，不進 `public/`、不 commit）；`BRIDGE_RESILIENCE_PRIVATE_ROOT` 可覆寫。與 BSS 相同的脆弱點：預設路徑是工作樹絕對路徑，工作樹移除後要覆寫 |
| 站主限定 | `GATED_LAYERS`＋`App.tsx` `lockedKeys`（`useBridgeResiliencePrivateAccess` 驗證後才解鎖）＋失權即關圖層清 popup；非站主看到鎖頭、不下載任何資產（hook 未授權不掛 source、不打 JSON） |
| 接線 | `src/data/bridgeResilienceTypes.ts`（契約、色階、解碼、格式）、`bridgeResilienceStore.ts`（選取＋私人 JSON）、`bridgeResilienceLoader.ts`、`src/hooks/useBridgeResilienceLayers.ts`、`useBridgeResiliencePrivateAccess.ts`、`src/layers/hosts/bridgeHosts.tsx`、popup `featureInfo/bridgeResiliencePanels.tsx`、圖例 `LegendPanel` `BridgeResilienceLegend` |
| 互動 | 圖層參數：透明度／交通模式（汽車、機車）／顯示受影響村里／村里色階（p90 或受影響目的地人口比）／顯示替代路線／關渡＋淡江同時中斷。點橋開 popup（同一組模式、村里、替代路線按鈕；關渡／淡江多一顆「與另一座同時中斷」），這些按鈕與圖層參數是同一份狀態（`layerParamsStore`）。選取橋以白色光暈高亮，聯合情境同時高亮兩座成員橋 |
| 目的地視角 | 選橋且開「顯示受影響村里」後**點村里**＝進入目的地視角（`bridgeResilienceOrigin` store；不換 popup、**不取消選橋**）：起點白色粗外框；其他村里依「所在行政區」的平均 ΔT（只算受影響目的地）上色，沒受影響＝中性灰，不可達＝紫色（v3 目前 0 筆）；受影響最多的前 20 個村里藍色外框。popup 內出現「目的地視角」區塊：依行政區彙整表（受影響人口比排序，欄位＝受影響人口比／平均多花／最多）、前 5 名受影響村里、不可達列、「回到起點視角」鈕。切汽車／機車或聯合情境時，起點保留、表與顏色同步換情境。**資料限制**：`village_destinations.json` 只有各區彙整與前 20 名，沒有逐村里 ΔT，所以同區村里同色（圖例與 popup 已註明）。清除起點的方式：點空白處（只清起點、橋與 popup 維持；再點一次空白才照舊關 popup）、「回到起點視角」、關閉「顯示受影響村里」、換橋、關閉 popup／圖層 |
| 村里上色（起點視角） | feature-state（`has`／`v`）依 `village_impacts.villages[VILLCODE][field][i]`↔`scenarios[i]`；p90 為 null＝無受影響目的地，以中性色顯示，不當 0；`affected_dest_pop_share` 的 0 是真實的 0（最低一級色） |
| 語意（必守） | 自由車流模型時間、不含壅塞；是失效後果，不是風險；人口為戶籍人口，不等於實際旅次；日夜間人口為模擬資料、機車不走快速公路是敏感度（皆非主結果）；淡江大橋交流道匝道一併移除（使用者標「不確定」），屬上界；聯合情境沒有自己的線；替代路線只是戶籍權重最大的 3 組代表性起訖對，不一定是繞最遠的；「暴露人口」是起點村里對其受影響目的地平均 ΔT>60 秒的戶籍人口（加總口徑，可能大於單一區域人口，不是受災人數） |

### 上線步驟（需使用者授權，Claude 不代為執行）

1. 使用者確認要在授權 HOLD 下以站主限定方式上私人 bucket。
2. 產出本機資產：`python3 scripts/preprocess/build-bridge-resilience-private.py <bundle_dir> <out_dir>`（若沿用現有本機檔則略過）。
3. 使用者以 S3 憑證執行：`S3_ACCESS_KEY=… S3_SECRET_KEY=… node scripts/deploy/upload-bridge-resilience-private.mjs <out_dir>`（`<out_dir>` ＝ `bridge-resilience.local/bridge-display-bundle-20260930-v2`；四個資產 tiles／summary／impacts／destinations 依 sidecar 契約逐一上傳，腳本不需改）（核對 `local_validation.json`、sidecar 契約、磁碟位元組三者一致；bucket policy 無公開 Allow；讀回比對；匿名 HEAD 必須 403）。
4. Pulse PR（`gh pr merge --merge`）→ 部署。若部署早於上傳，只有 `bridge-resilience` 家族 warm 失敗，站主看到 sidecar unavailable，其他家族不受影響。
5. 站主限定驗證（瀏覽器，需站主登入）：
   - 非站主／未登入：圖層列有鎖頭，開啟無效；Network 面板看不到任何 `/api/private-research/bridge-resilience/*` 請求。
   - 站主：交通 →「橋梁研究（進行中）」開「雙北跨河橋梁韌性」；Network 有 `tiles` 與 `summary`／`impacts` 的 206；橋線汽車（琥珀）、機車（青）分色，地面引道淡色虛線。
   - 點三鶯大橋：popup 有河川、人工評級 A、複核日期 2026-09-28、汽車／機車 p90／平均／可及性損失／暴露／孤立人口、替代橋；開「顯示受影響村里」：面量圖出現且 null 村里為灰色、圖例同步；切「受影響目的地人口比」色階改變；開「顯示替代路線」：出現移除前（灰虛線）與移除後（紅實線）。
   - 點關渡大橋→「與另一座同時中斷」：兩座橋同時高亮、popup 標題變聯合、指標與村里色改用聯合情境（機車與汽車各自切換）；換點三鶯大橋時聯合開關不影響。
   - 關閉 popup：高亮消失；把不透明度拉到最低：線與村里都跟著變淡。
   - 目的地視角：選橋、開「顯示受影響村里」，點一個村里：Network 出現 `destinations` 的 206（只有第一次）；起點白框、其他村里依所在區平均 ΔT 變色，popup 有「目的地視角」區塊（區表、前 5 名、回到起點視角）；橋仍高亮。切機車／汽車、關渡＋淡江聯合：起點保留、表與顏色更新。點空白處：回到起點視角、橋與 popup 還在；再點空白才關閉。點另一座橋：結束目的地視角。圖例在兩種視角說明不同（起點：從這裡出發平均變慢；目的地：去那裡變慢）。
   - 尚未在瀏覽器實測（站主登入與私人資產都還沒上傳）；本次只以單元測試、style-spec 驗證與 tsc 驗證。
6. production 動態 `get_layer_gates()` 若為權威：DB 端沒有 `gated_layers` row，後台顯示／管理需 gis-platform 補 row（待拍板）。
