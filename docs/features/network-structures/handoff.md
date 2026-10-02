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
| 語意 | v5（2026-10-02）：26,188 筆是 BSS 來源紀錄，不是去重後橋座數；23,276 條線＝OSM 橋實體整段 17,830（唯一 14,291＋同實體多標段 3,539）＋新北官方頭尾近似軸 206＋路網推估 5,240；2,912 筆只有點（多候選待複核 1,731＋無候選 1,181）；線依 `v5_class` 著色，仍不是已審核身份、工程橋長或路網；v4 影像抽驗 300 筆為 103 支持／2 負向／195 未定，整體錯誤率 <3% 尚未證明（未對 v5 重抽） |
| 來源 | BSS 公開查詢（授權 HOLD）、OpenStreetMap（ODbL）、新北市官方清冊 |
| 資料檔 | `bss_bridge_location_direction_preview_20261002_v5.pmtiles`，79,869,337 bytes，SHA-256 `a7f1ea3fca7bc5331912f3fca5e94d09c1fdb3e21e696bc9e117d7957a046400`；source-layer `bss_bridge_national_preview`（z6–15），一個檔兩層共用一個 source。規格：analytics `pipelines/analysis/bridge_resilience/national/v5_layer.py`。回滾：sidecar `BSS_BRIDGE_ASSETS` 改回 v4 `bss_bridge_location_direction_preview_20260927_v4.pmtiles`（63,367,460 bytes，SHA-256 `2d71de78be8b4c3c19b8a683946a1f083f37e160182b8932cd288fdbe713072f`，S3 物件保留） |
| 本機讀取 | sidecar（`node server/coral-private/coral-private-server.mjs`，port 8796；vite dev 已 proxy）預設讀 analytics `data/processed/transportation/bridge_resilience/bss-bridge-location-direction-preview-20261002-v5/`；可用 `BSS_BRIDGE_PRIVATE_ROOT` 覆寫。PMTiles 不進 `public/`、不 commit |
| production 路徑 | S3 `migu-private-research-ap-southeast-2` / `private-research/bss-bridge/<sha256>/<filename>`；前端只打同源 `/api/private-research/bss-bridge/tiles`（nginx 精確 location + Range，其餘 404） |
| 站主限定 | `GATED_LAYERS`＋`App.tsx` `lockedKeys`（`useBssBridgePrivateAccess` 驗證後才解鎖）＋失權即關圖層清 popup；作法同 [土壤液化](../soil-liquefaction/handoff.md)。未加入 `RELEASE_HOLD_LAYERS`（那會連站主也鎖死） |
| 接線 | `src/data/bssBridgeTypes.ts`（契約、色票、篩選）、`src/hooks/useBssBridgeLayers.ts`、`src/hooks/useBssBridgePrivateAccess.ts`、`src/layers/hosts/bridgeHosts.tsx`；popup `BssNationalBridgePreviewPanel`；sidecar `server/coral-private/coral-private-server.mjs` `BSS_BRIDGE_*` |
| 控件 | 線：透明度／交通類別／品質；點：透明度／大小／品質（品質預設「全部」；「影像有支持」只留綁定第一階段 release 的 103 筆） |

### 上線步驟（需使用者授權，Claude 不代為執行）

1. 使用者確認要在授權 HOLD 下以站主限定方式上私人 bucket。
2. 使用者以 S3 憑證執行：`node scripts/deploy/upload-bss-bridge-private.mjs <資料夾>`（v5 起已於 2026-10-02 上傳；會核對 `local_validation.json`（v4）或 `receipt.json`（v5）的 sha256、bytes、bucket policy 無公開 Allow、讀回比對、匿名 HEAD 必須 403）。
3. Pulse PR（`gh pr merge --merge`）→ 部署。若部署早於上傳，只有 BSS 家族 warm 失敗，站主看到 sidecar unavailable，其他私人家族不受影響。
4. production 動態 `get_layer_gates()` 若為權威：目前兩個 key 只靠前端 `GATED_LAYERS` 與 sidecar owner 驗證，DB 端沒有 `gated_layers` row；要在後台顯示／管理需 gis-platform 補 row（待拍板）。
5. 重產 PMTiles 後同步更新 sidecar `BSS_BRIDGE_ASSETS` 的 size／sha256。

### 分析專題（反向連結）

`taipei-gis-analytics/pipelines/analysis/bridge_resilience/`（目前在 analytics 工作樹 `.worktrees/bridge-resilience-20260929`，未 merge master）。圖層只呈現候選位置與方向，不是該專題的路網或韌性結論。

## 雙北跨河橋梁韌性圖層（研究中，站主限定）

### v4（2026-10-02）：73 座＝26 座人工複核＋47 座自動選入

- 來源：analytics `bridge-display-bundle-20261002-v4`（選橋 v7、sim v4、decay v2、fingerprint v2；schema 同 v3，多 `validated`、`fingerprint`、`same_river_any_distance` 與 `fingerprint.json`；工作紀錄 analytics `pipelines/analysis/bridge_resilience/docs/project-log-20261002-overnight-expand.md`）。打包：`python3 scripts/preprocess/build-bridge-resilience-private.py --v4 <v4 bundle_dir> <out_dir> <bridge-decay-impacts-20261002-v2/decay_bridge_metrics.csv>`（bundle 依 receipt 驗 SHA；metrics CSV 以釘死 SHA `55711751…fbfd2` 驗，值取自 analytics git 追蹤的 `_manifest.json`）。本機產物：`.worktrees/bridge-resilience-73-20261002/bridge-resilience.local/bridge-display-bundle-20261002-v4/`（gitignore）。
- `decay_summary.json` v4：v2 CSV 沒有名次欄，名次在「同 mode、單橋、在該 mode 路網內、影響 >0」之間排（汽車 64、機車 65 座，與 `decay_rank_compare.json` 的 n 相同；該檔列出的 80 組名次逐一相符）；原 26 座的 τ=20 數值與 v3 逐值相同。每 mode 帶 `status`：`ok`／`no_affected_od`（8 座上游小橋×2 模式，模型算出沒有受影響起訖對，影響是真的 0）／`not_in_mode_graph`（華翠大橋汽車；CSV 的 0 不採用，全 null）。
- S3 私人 key（`private-research/bridge-resilience/<sha256>/<filename>`，2026-10-02 上傳、讀回 SHA 相符、匿名 403）：tiles `417bb96b…feeb/bridge-resilience-20261002-v4.pmtiles`（2,676,761 B）、summary `1df50ae6…628f`（361,546 B）、impacts `fea835ee…8697`（3,338,743 B）、destinations `532266b4…30a8`（10,034,240 B）、decay-impacts `f230ac1a…bf2d`（2,106,225 B）、decay-summary `713ade9e…19f3`（137,261 B）、fingerprint `a0791406…4280`（229,172 B）。完整 SHA 見 sidecar `BRIDGE_RESILIENCE_ASSETS`。
- `village_destinations.json` 10 MB 超過 sidecar 單一 Range 上限 8 MiB：前端 `fetchPrivateJson` 依序以 ≤8 MiB 分段 Range 讀、位元組拼好後才解碼；sidecar 上限不變。
- UI：自動選入橋（`validated=false`）地圖線 opacity ×0.45、圖例一列「自動選入・尚未人工複核」、popup 標籤；fingerprint 標題「為什麼重要（73 座內百分位）」，「四維怎麼算」附原 26 座內百分位與同河替代不限距離變體；`not_in_mode_graph` 寫「汽車路網未收此橋」、`no_affected_od` 寫「模型算出無受影響起訖對」，都不列 0。
- **回滾到 v3**：sidecar `BRIDGE_RESILIENCE_ASSETS` 改回註解中列出的 v3 檔名／大小／SHA（S3 物件保留、未刪），前端 `bridgeResilienceTypes.ts` 同步改回；最簡單是 revert 本次 PR。
- 已知上游問題（未在本次處理）：`介壽橋` 與 `介壽橋（瑞芳區）` 兩座 town 都是瑞芳區，後綴會誤導；analytics 工作紀錄建議改名（需從選橋 v7 重跑約 50 分）。華翠大橋汽車是否實際禁行、松江大橋等 trunk 橋機車是否可騎，均待查。


（**2026-10-02 起已換 v4，見上節**；以下是 v3 時的紀錄。）狀態（2026-10-01）：`bridgeResilienceTwinCity` 顯示 analytics 專題 §8／§8b／§9 的前端顯示成品（**v3**：v2 全部＋**距離遞減版**＋村里邊界扣水面；預設權重＝距離遞減）；v3 資產**尚未上傳**（分支 `feat/bridge-decay-view`，未 push／未開 PR）。授權
`HOLD_BSS_BULK_REUSE_RIGHTS_UNCONFIRMED`（橋的身份判定鏈用到 BSS），解除前不得公開。分析專題（反向連結）：
`taipei-gis-analytics/pipelines/analysis/bridge_resilience/README.md` §8／§8b（v2 在 analytics 工作樹 `.worktrees/bridge-destination-20260930`、分支 `feat/bridge-destination-view`，未 push）。

| 項目 | 內容 |
|---|---|
| 群組／標籤 | 交通 Move →「橋梁研究（進行中）」（與 BSS 兩層同群組，同一站主限定研究主題）；「雙北跨河橋梁韌性（研究中）」 |
| 來源 bundle（v3） | `taipei-gis-analytics/data/processed/transportation/bridge_resilience/bridge-display-bundle-20261001-v3/`（唯讀）；`dataset_id=bridge_display_bundle_20261001_v3`＝v2 全部檔案原樣＋`villages_display.geojson`（扣除 OSM 水域，VILLCODE 順序同 `villages.geojson`，2,156,010 B、SHA `4c91739a…f29e`）＋`decay_village_impacts.json`。橋層級距離遞減指標來自 `bridge-decay-findings-20261001-v1/decay_bridge_ranking.csv`（207,014 B、SHA `d48692a0…0532`，不在 bundle 內；打包腳本依 v3 receipt → findings receipt 鏈驗 SHA）。說明：該目錄 `findings.md`、analytics 專題 README §9。（v2：`bridge-display-bundle-20260930-v2`，v1 全部＋`village_destinations.json`，77 個裸 NaN→null） |
| 輸入檔 SHA-256 | `bridges.geojson` 1adfbae9…3c3e（118,119 B，v2；v1 是 34938880…7253／118,042 B）；`replacement_routes.geojson` 3a09c123…2828（1,415,563 B）；`villages.geojson` 5a6725aa…ce22b（1,896,133 B）；`bridge_summary.json` 4b04d5bb…1574（63,004 B）；`village_impacts.json` 4df8f4cb…2764（1,333,831 B）；`village_destinations.json` d2da4228…64b5（6,425,352 B） |
| 私人資產（前端契約，7 個） | `bridge-resilience-20261001-v3.pmtiles` 2,091,890 B、SHA-256 `61b6859f551856eeef555883a3a8d51967e2ad254d617baf6050386fe3ad64cc`（z8–14，source-layer `bridges`／`replacement_routes`／`villages`；villages 讀 `villages_display.geojson`，仍以 `int(VILLCODE)` 當 feature id）；`bridge_summary.json` 63,004 B、`village_impacts.json` 1,333,831 B、`village_destinations.json` 6,425,352 B（三者 SHA 與 v2 相同）；**新增** `decay_village_impacts.json` 864,533 B（SHA `a251cf706f7fe0cb394bbbf4c2680990de943c56155f9bf36f7d0c7ce3060873`，原檔）、`decay_summary.json` 55,424 B（SHA `29d3582c4e5e6c11ee8e74256e77cba38219c69cbf55b137ca6aeacbf623d3f0`，由 CSV 精簡：每橋×mode（含聯合）的 τ=20 `decay_impact`／`decay_mean_dT_per_trip`／`pop_gt30s`／`pop_gt60s`／`decay_impact_rank`／`uniform_impact_rank`／`top5_villages`，加 `rank_tau10`／`rank_tau30` 供敏感度；聯合情境名次為 null）。`village_destinations.json` 6.4 MB < sidecar 單一 Range 上限 8 MB，**懶載入**；兩份 decay JSON 與 summary／impacts 一起載入。**2026-10-02 新增** `bridge_fingerprint.json` 54,886 B（SHA `263f4f8c9894bffe8e334a39adfa80475460e59d2a4ee0f95473e5cca74753a4`）＝analytics `bridge-fingerprint-20261002-v1/fingerprint.json` 原檔（產生腳本 `fingerprint/build_fingerprint.py` SHA `b99198e5…33d9`；該 receipt 沒有輸出 SHA，以此處計算值為準）；與其他四個 JSON 並行載入（五個並行），已上傳 S3 `private-research/bridge-resilience/263f4f8c…53a4/bridge_fingerprint.json` |
| 打包 | `python3 scripts/preprocess/build-bridge-resilience-private.py <v3 bundle_dir> <out_dir> <decay_bridge_ranking.csv>`：先依 receipt 驗輸入 SHA 與大小（CSV 走 receipt 鏈），再用 tippecanoe 打包、產 `decay_summary.json`，最後寫 `local_validation.json`（含全部 6 個資產）。**tippecanoe 重跑不保證位元相同**；重打包後要同步改 sidecar `BRIDGE_RESILIENCE_ASSETS`、`bridgeResilienceTypes.ts` `BRIDGE_RESILIENCE_ASSETS`、manifest 註記（`sidecar 資產契約` 測試會擋不同步）、sidecar 測試 pinned 值 |
| 上游缺陷（v2 已修） | v1 `bridges.geojson` 的 77 處裸 `NaN`（無名匝道 `name`）在 v2 改為 `null`；打包腳本仍對 null／NaN 一律移除該屬性（無名＝沒有 `name` 欄位） |
| sidecar 家族 | `bridge-resilience`，`/api/private-research/bridge-resilience/{tiles,summary,impacts,destinations,decay-impacts,decay-summary,fingerprint}`（Range only、每個請求驗站主、`?access=1` 探測）；S3 `migu-private-research-ap-southeast-2` / `private-research/bridge-resilience/<sha256>/<filename>`；nginx 精確 location（regex 已含 `decay-impacts|decay-summary|fingerprint`，`deployContract` 測試比對）＋其餘 404；vite dev 已 proxy（前綴）。JSON 也走 Range（sidecar 沒有整檔 GET，前端以已知大小要整段） |
| 本機讀取 | 預設讀本工作樹（`.worktrees/bridge-decay-view-20261001`）`bridge-resilience.local/bridge-display-bundle-20261001-v3/`（`*.local` 已 gitignore，不進 `public/`、不 commit）；`BRIDGE_RESILIENCE_PRIVATE_ROOT` 可覆寫。與 BSS 相同的脆弱點：預設路徑是工作樹絕對路徑，工作樹移除後要覆寫 |
| 站主限定 | `GATED_LAYERS`＋`App.tsx` `lockedKeys`（`useBridgeResiliencePrivateAccess` 驗證後才解鎖）＋失權即關圖層清 popup；非站主看到鎖頭、不下載任何資產（hook 未授權不掛 source、不打 JSON） |
| 接線 | `src/data/bridgeResilienceTypes.ts`（契約、色階、解碼、格式）、`bridgeResilienceStore.ts`（選取＋私人 JSON）、`bridgeResilienceLoader.ts`、`src/hooks/useBridgeResilienceLayers.ts`、`useBridgeResiliencePrivateAccess.ts`、`src/layers/hosts/bridgeHosts.tsx`、popup `featureInfo/bridgeResiliencePanels.tsx`、圖例 `LegendPanel` `BridgeResilienceLegend` |
| 權重（v3，預設距離遞減） | 圖層參數與 popup 各一個「權重」切換（同一份 `layerParamsStore` 狀態，參數 `bridgeResilienceWeighting`）：**距離遞減（平均行程 20 分）**＝預設；**不分遠近**＝原版指標與色階。**距離遞減下**：村里改用 `decay_village_impacts.decay_mean_dT_s`，依秒數 7 級（<1、1–5、5–15、15–30、30–60、60–120、≥120，色票 `DECAY_RAMP`，與 analytics 地圖同分段），null＝中性色不當 0，0 是真實的最低級；「村里色階（p90／占比）」選項只在不分遠近下生效；popup 橋層級顯示影響（百萬人·秒）、每人每次多花（秒）、多花 >30／>60 秒人口、影響排名（汽車／機車各自，括號附不分遠近名次；聯合情境「不列名次」）、排名敏感度（τ 10／20／30）、影響最大的 3 個村里，不再顯示不分遠近的 p90／暴露／孤立人口。聯合情境「關渡大橋+淡江大橋」兩種權重都可用（`decay_summary` 與 `decay_village_impacts` 都含聯合鍵）。**預設用距離遞減的理由**：不分遠近把「過橋去很遠的目的地」與「就近目的地」等權，橋旁居民日常行程多半在附近，遠距離目的地被高估；距離遞減（τ=20 分，專題 findings：汽車 20 分內權重 70%→79%）較貼近實際出行；但名次只小幅變動（Spearman 汽車 0.984、機車 0.995），排名結論兩者一致 |
| 互動 | 圖層參數：透明度／交通模式（汽車、機車）／權重／顯示受影響村里／村里色階（p90 或受影響目的地人口比，僅不分遠近）／顯示替代路線／關渡＋淡江同時中斷。點橋開 popup（同一組模式、村里、替代路線按鈕；關渡／淡江多一顆「與另一座同時中斷」），這些按鈕與圖層參數是同一份狀態（`layerParamsStore`）。選取橋以白色光暈高亮，聯合情境同時高亮兩座成員橋 |
| 四維 fingerprint（2026-10-02） | popup 常駐區一塊「為什麼重要（26 座內百分位）」：目前交通模式的阻隔／路網／人口／缺乏替代四條小長條＋數字（越高越關鍵，不加總、不合成分數）；null 寫「未提供」不畫長條；關渡＋淡江聯合情境寫「聯合情境不排名」。定義與限制收在「四維怎麼算」（阻隔與模式無關；5 km 同河規則讓關渡／淡江缺乏替代偏高；新北大橋水面跨距屬上界；人口多數為 0 同分取平均名次）。資料 HOLD（BSS 判定鏈）→ 僅站主 |
| 目的地視角 | **（v3：目的地視角資料只有不分遠近版）距離遞減下點村里仍進入目的地視角，popup 區塊與圖例明寫「目的地明細是不分遠近版」，並提示切回「不分遠近」才同口徑；目的地視角的上色沿用原邏輯（行政區平均 ΔT）。**選橋且開「顯示受影響村里」後**點村里**＝進入目的地視角（`bridgeResilienceOrigin` store；不換 popup、**不取消選橋**）：起點白色粗外框；其他村里依「所在行政區」的平均 ΔT（只算受影響目的地）上色，沒受影響＝中性灰，不可達＝紫色（v3 目前 0 筆）；受影響最多的前 20 個村里藍色外框。popup 內出現「目的地視角」區塊：依行政區彙整表（受影響人口比排序，欄位＝受影響人口比／平均多花／最多）、前 5 名受影響村里、不可達列、「回到起點視角」鈕。切汽車／機車或聯合情境時，起點保留、表與顏色同步換情境。**資料限制**：`village_destinations.json` 只有各區彙整與前 20 名，沒有逐村里 ΔT，所以同區村里同色（圖例與 popup 已註明）。清除起點的方式：點空白處（只清起點、橋與 popup 維持；再點一次空白才照舊關 popup）、「回到起點視角」、關閉「顯示受影響村里」、換橋、關閉 popup／圖層 |
| 村里上色（起點視角） | feature-state（`has`／`v`）依 `village_impacts.villages[VILLCODE][field][i]`↔`scenarios[i]`；p90 為 null＝無受影響目的地，以中性色顯示，不當 0；`affected_dest_pop_share` 的 0 是真實的 0（最低一級色） |
| 語意（必守） | τ=20 分鐘是**假設值**（project-defined distance-decay，非文獻公式）；距離遞減的「影響」＝村里人口×平均多花秒數加總（人·秒），名次在同交通模式的單橋之間；自由車流模型時間、不含壅塞；是失效後果，不是風險；人口為戶籍人口，不等於實際旅次；日夜間人口為模擬資料、機車不走快速公路是敏感度（皆非主結果）；淡江大橋交流道匝道一併移除（使用者標「不確定」），屬上界；聯合情境沒有自己的線；替代路線只是戶籍權重最大的 3 組代表性起訖對，不一定是繞最遠的；「暴露人口」是起點村里對其受影響目的地平均 ΔT>60 秒的戶籍人口（加總口徑，可能大於單一區域人口，不是受災人數） |

### 上線步驟（需使用者授權，Claude 不代為執行）

1. 使用者確認要在授權 HOLD 下以站主限定方式上私人 bucket。
2. 產出本機資產：`python3 scripts/preprocess/build-bridge-resilience-private.py <v3 bundle_dir> <out_dir> <decay_bridge_ranking.csv>`（本機已產出於 `.worktrees/bridge-decay-view-20261001/bridge-resilience.local/bridge-display-bundle-20261001-v3`；tippecanoe 重打包後 SHA 會變，要同步改 sidecar／types／manifest／測試 pinned 值）。
3. 使用者以 S3 憑證執行：`S3_ACCESS_KEY=… S3_SECRET_KEY=… node scripts/deploy/upload-bridge-resilience-private.mjs <out_dir>`（`<out_dir>` ＝ `/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/bridge-decay-view-20261001/bridge-resilience.local/bridge-display-bundle-20261001-v3`；六個資產 tiles／summary／impacts／destinations／decay-impacts／decay-summary 依 sidecar 契約逐一上傳，腳本不需改；舊 v2 PMTiles 在 S3 是不同 sha 前綴，不會被覆蓋）（核對 `local_validation.json`、sidecar 契約、磁碟位元組三者一致；bucket policy 無公開 Allow；讀回比對；匿名 HEAD 必須 403）。
4. Pulse PR（`gh pr merge --merge`）→ 部署。若部署早於上傳，只有 `bridge-resilience` 家族 warm 失敗，站主看到 sidecar unavailable，其他家族不受影響。
5. 站主限定驗證（瀏覽器，需站主登入）：
   - 非站主／未登入：圖層列有鎖頭，開啟無效；Network 面板看不到任何 `/api/private-research/bridge-resilience/*` 請求。
   - 站主：交通 →「橋梁研究（進行中）」開「雙北跨河橋梁韌性」；Network 有 `tiles` 與 `summary`／`impacts` 的 206；橋線汽車（琥珀）、機車（青）分色，地面引道淡色虛線。
   - 點三鶯大橋：popup 有河川、人工評級 A、複核日期 2026-09-28、汽車／機車 p90／平均／可及性損失／暴露／孤立人口、替代橋；開「顯示受影響村里」：面量圖出現且 null 村里為灰色、圖例同步；切「受影響目的地人口比」色階改變；開「顯示替代路線」：出現移除前（灰虛線）與移除後（紅實線）。
   - 點關渡大橋→「與另一座同時中斷」：兩座橋同時高亮、popup 標題變聯合、指標與村里色改用聯合情境（機車與汽車各自切換）；換點三鶯大橋時聯合開關不影響。
   - 關閉 popup：高亮消失；把不透明度拉到最低：線與村里都跟著變淡。
   - 目的地視角：選橋、開「顯示受影響村里」，點一個村里：Network 出現 `destinations` 的 206（只有第一次）；起點白框、其他村里依所在區平均 ΔT 變色，popup 有「目的地視角」區塊（區表、前 5 名、回到起點視角）；橋仍高亮。切機車／汽車、關渡＋淡江聯合：起點保留、表與顏色更新。點空白處：回到起點視角、橋與 popup 還在；再點空白才關閉。點另一座橋：結束目的地視角。圖例在兩種視角說明不同（起點：從這裡出發平均變慢；目的地：去那裡變慢）。
   - v3 權重切換：預設「距離遞減」；開村里：圖例為 7 級秒數、popup 為影響／每人多花／>30、>60 秒人口／排名（括號不分遠近）／前 3 村里；切「不分遠近」：回到原指標與色階；關渡＋淡江聯合在兩種權重都可用（距離遞減下名次顯示「不列名次」）；距離遞減下點村里：popup 目的地區塊有「目的地明細是不分遠近版」；村里邊界沿河岸應已扣水面（淡水河、基隆河沿岸不再蓋住水面）。
   - 尚未在瀏覽器實測（站主登入與 v3 私人資產都還沒上傳）；本次以單元測試、style-spec 驗證、tsc、sidecar 本機 smoke（node 起 sidecar、六個路由 Range 讀回 SHA 全對）驗證。
   - 已知限制：目的地視角無距離遞減版；τ=20 為假設值；PMTiles 重跑不保證位元相同。
6. production 動態 `get_layer_gates()` 若為權威：DB 端沒有 `gated_layers` row，後台顯示／管理需 gis-platform 補 row（待拍板）。
