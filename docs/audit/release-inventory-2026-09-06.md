# Mini Taiwan Pulse 近期發布缺口盤點

盤點日期：2026-09-06。範圍：2026-08-31 至今已辨識的開發成果、現存前端 worktrees、Git/PR、正式資產與指定圖層 browser。唯讀查核，僅新增本報告；未修改程式、分支、資料庫或其他進行中的任務。

## 結論

**目前確定漏在正式版之外的是 Network Structures 四個圖層。另有交通統計的一個新圖層與 single/overlap 顯示模式，依該任務的最新指示刻意先 commit、不部署。** 本次未發現日本／海洋／噪音近期已合併內容另有資產未發布；這不代表全站每一個圖層的 freshness、popup 或 render 都已巡檢。

正式 master 與最新 production deployment 都是 `9124d1f021f1253eabfbc5f61cacd765bccd9ecd`，正式 browser 載入 `main-1tatJ1RX.js`。manifest 有 412 筆登記、402 筆 section 非 null；這是登記量，**不是402層均已通過正式資料驗收**。會員／共用搜尋／底層優化與統計8指標已在本版。

| 類型 | 已確認數量 | 判定 |
|---|---:|---|
| 先前本地完成但未發布 | 4個圖層／1組功能 | Network Structures |
| 進行中、明確暫不部署 | 1個新圖層＋1組顯示模式 | 航港局補助統計；single/overlap |
| 近期已合併、正式靜態路徑缺檔 | 0／18個抽查路徑 | 日本／噪音／農業Embed／交通樞紐；PMTiles header或GeoJSON起始內容回讀 |
| 海洋公開RPC | 4／4個 bounded查詢成功 | stations/current × cwa/isohe，各200與1筆對應network |

「4」是本次已證實的遺漏圖層數，不能當成全歷史／全站盤點的完整總數。施工中的交通統計另列，不混成漏發布。

## Network Structures：不是單純資料載入失敗

| 當時完成的圖層 | 先前驗收記錄的 feature數（非此次正式回讀） | 正式狀態 |
|---|---:|---|
| OSM 橋梁承載路段 | 45,424 | 無前端接線、正式資產路徑不是PMTiles |
| OSM 橋梁範圍 footprint | 1,464 | 同上 |
| 新北市官方橋梁 | 1,028 | 同上 |
| OSM × 官方橋梁比對 | 3,188 | 同上 |

此次實證：

1. 正式版 layerManifest/overlay 沒有 Network Structures／橋梁四層；正式網站搜尋「橋梁」回覆「找不到相符圖層」。
2. 以下已知 `/network_structures/` 路徑，以 `Range: bytes=0-126` 請求全部回 `200 text/html`（首頁 fallback），沒有 Content-Range／PMTiles magic。HTTP200 不代表圖磚已上傳。
   - `osm_bridge_carriers_20260621.pmtiles`
   - `osm_bridge_footprints_20260621.pmtiles`
   - `official_bridges_new_taipei_20260902.pmtiles`
   - `bridge_comparison_new_taipei_20260621_20260902.pmtiles`
3. 當時本地前端 `/private/tmp/mini-taiwan-pulse-osm-network-structures-20260902` 與上游 `/private/tmp/taipei-gis-analytics-network-structures-20260902` 現在均不存在；前端也無3721 listener。
4. 前端 branch `codex/osm-network-structures-20260902` 還在，但只停在建立時的 `5e36006`，reflog僅「Created from origin/master」；該tree沒有Network Structures實作。Analytics branch仍指向`264ee43`，其worktree被Git標為路徑不存在，亦未找到對應bridge pipeline提交。
5. 搜查已知worktree、目前Git歷史與部分備份路徑，尚未找到可直接恢復的完整實作／產物。這**不等於已證明永久遺失或知道刪除原因**；Codex原任務紀錄仍有本機驗收與操作來源，需另立復原盤點。

先前會員／統計發布所說的「原子 commits 保留」，範圍是該次PR的已提交成果，未包含這組更早、尚未提交的暫存實作。此次確認應補上這個範圍界線。

## 哪些近期成果已有上線證據

| 功能 | Git證據 | 此次正式回讀 |
|---|---|---|
| 日本鐵道／學校／1km人口網格 | PR #210 已合併 | 3份PMTiles皆206、v3 header；人口網格50,998,171 bytes |
| 日本GSI宗教低zoom全量修正 | PR #211 已合併 | PMTiles206、15,675,395 bytes；本輪未數rendered點 |
| CWA／ISOHE海洋觀測 | PR #212 已合併 | 4個public anon RPC查詢皆200；不代表已驗freshness |
| 噪音／聲響6層 | PR #213 已合併 | 6份新/共用資產全部206、格式相符 |
| 農業Embed | PR #216 已合併 | FTW PMTiles206、107,138,689 bytes |
| 交通樞紐顯示模式 | PR #217 已合併 | 7個unique共用資產皆206、格式相符 |
| Embed文章camera bridge | `a5abe3e` 已在master祖先鏈 | 原dirty副本不代表未發布；本輪未重測跨iframe互動 |
| Global Events近期修正 | PR #202–209、#214–215已合併 | 本輪查Git，未重跑全套即時資料freshness驗收 |
| 統計8指標／會員／搜尋／效能底座 | PR #219–220 已合併部署 | 正式版資產與會員入口仍可見；上次正式DB與browser發布證據另存foundation audit |

舊handoff中的Unreleased、未上傳、未部署可能未隨發布更新，不能單憑那些字樣判定今日缺檔；本次對上述靜態路徑與marineRPC採live readback修正判定。大PMTiles僅讀header，未整份下載；完整tile內容、zoom、popup、filter、資料時間尚未逐層巡檢。

## 正在開發的交通統計

任務名稱：**盤點交通統計圖層資料**。本輪只讀其狀態，沒有傳送指令、改檔或介入開發。

截至盤點快照，前端工作樹 `/private/tmp/taiwan-statistics-pr-pulse` 為：

- `031d0eb` single/overlap顯示模式。
- `0d9a84d` 航港局補助縣市圖層。
- `5df010a` maritime release選取修正。

該任務最新使用者要求是原子化commit、先不部署，因此不把這個圖層算成漏上線。

**已有具體整合衝突：** Platform工作樹 `/private/tmp/taiwan-statistics-pr-platform` 的 `408_statistics_reconciliation_state.sql` 與正式已套用 `408_member_private_storage.sql` 編號重複。前端工作亦從#219版本分出，尚未包含#220會員整合；需以最新master做三方整合，不以整包檔案覆蓋。本次僅標記，未改編號或執行migration。

## 原目錄未提交項目不等於未發布功能

新增本報告前，原目錄27項dirty中，15項內容已與正式master相同（含Embed camera等），3項tracked差異屬load-session、accessibility skill與CLAUDE規則，其餘9項屬skill links／references／提案文件。未發現另一組可由這些dirty證明未上線的程式功能。勿把27項檔案狀態解讀成27項功能漏發布。

## 建議接續順序（本次不執行）

1. 為Network Structures找回操作紀錄、剩餘備份與原始來源；確認可恢復範圍後，再決定復原或重建。保留四層source separation與比較狀態，不將missing變0。
2. 交通統計任務準備發布時先處理migration編號及最新master整合，保留會員、搜尋與AI語意修正。
3. 對已合併但handoff仍寫未上線的功能校正文書狀態；避免再次將歷史文件與正式狀態混淆。
4. 復原成果放可持續保留的worktree，資料產物有immutable物件儲存、程式碼有原子commit及發布矩陣，不能只靠`/tmp`的本機驗收完成通知。

## 證據位置

- 正式版：https://mini-taiwan-pulse.itsmigu.com/
- 前端PR：https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/220
- 本次raw evidence：`/private/tmp/pulse-release-inventory-20260906/`
- Network HTTP／Git：`network-structures-http.json`、`network-structures-git.json`
- 正式資產／RPC：`assets/recent-layer-assets.md`
- branch／dirty核對：`git-gaps`、`git-gaps.json`（以最終校正檔為準）
