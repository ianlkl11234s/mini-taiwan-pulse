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
