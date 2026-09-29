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
