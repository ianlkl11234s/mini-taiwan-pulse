> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# 全圖層空間分析覆蓋：可執行施工計畫

2026-09-25；接 [十層來源試跑](./ten-layer-spatial-trial-20260925.md) 與 [逐層台帳](./analysis-coverage-20260925.json)。本計畫是下一輪施工規格，未完成事項不因寫入本頁而變成可查能力。只在隔離 `research-streamline/{mini,mcp,gateway}` 工作；保護原 checkout／既有配對，不 push、PR、merge、部署或擴大付費 provider 呼叫。每片 exact-path 原子 commit。

## 目標與完成定義

使用者選一個點、範圍與時間後，Agent 能找出**已驗證來源**中可分析的附近資料，依場所、路線、範圍、格網數值、動態事件分組回答並顯示地圖；同時說清楚哪些來源未涵蓋、為何不能算。這是資料接入及分析流程，不能用「圖層開關可用」或 PMTiles 畫出來取代查詢結果。

現況基線：778 manifest layers、85 registered datasets、78 層可查、105 個另列 metadata GeoJSON candidates、595 個 unknown/unavailable（594 缺 reader／descriptor、1 query disabled）。原始 596 層逐層清單保留於 [CSV](./unknown-layer-queue-20260925.csv)；`agriPOI` 已接通。這些數字是 layer mapping，不是 595 份獨立資料；先歸併上游 source family，實際家族數在 P0 盤出，不能預估一層一次開發。

每層最終須有一個可稽核狀態：`SPATIAL_READY`（特定運算／時間／權限下可算且已全鏈驗收）、`ATTRIBUTE_ONLY`、`DISPLAY_ONLY`、`READER_PENDING`、`SOURCE_MISSING`、`VERSION_MISMATCH`、`RIGHTS_HOLD`、`GEOMETRY_HOLD`、`VALUE_HOLD` 或 `DYNAMIC_CONTRACT_HOLD`。允許一層多個次要 blocker，但主狀態唯一；`unknown` 只能作尚未盤查的暫態，**結案時未分類數為 0，不要求每層都變成 SPATIAL_READY**。

每個可分析 dataset 的契約要有：source/version/SHA 或等價 immutable receipt、publisher/license/access、來源觀測時間與取得時間、record grain、geometry CRS/role/precision、欄位單位與 null/suppressed/zero、完整母體與排除數、允許操作、bbox/時間/分頁限制、地圖 layerRefs。距離要標直線／線幾何／路網，不能混稱「走路」。沒有完整來源或有權限疑慮時 fail closed。

## 共用機制：延伸現有元件

`capability-audit.mjs` 與現有台帳負責逐層分類；`DatasetDescriptor`／`QueryExecutor` 是查詢契約；`verifiedPointDataset`、`pointDatasetPartitions`、`administrativeBoundaryAdapter`、`createLineDatasetAdapter` 是共用 reader 起點；既有 typed `spatial_query` 與 result collection 負責分析與多物件地圖。不要再做另一套任意 URL reader、萬用 SQL 或 prompt 題庫。前端 PMTiles 只用於展示；分析應讀**可驗證的原表／同版 sidecar**。若一份來源供七層使用，只建立一份來源 reader，加七個有語意的 layer mapping/filter。

對於「附近有哪些」建立薄的組合流程：先以 descriptor 篩合法且有空間資格的候選，依資料家族分別做 bounded query；Point 算地表直線距離、Line 算點到線距離、Polygon 算包含／相交、格網讀原格值、動態資料必附時間窗口。合併層只整理分類、來源、截斷與圖面順序，**不改寫各 dataset 的粒度或缺值**。同名跨清冊紀錄可在 UI 合併展示，但計數須保留原始紀錄數與經證據確認的實體數兩個口徑。

## 施工片、依賴與驗收

| 片 | 工作與檔案入口 | 可交付結果／過關條件 | 停止或改列 HOLD |
|---|---|---|---|
| P0 來源家族台帳 | 從 595 未知層與 105 metadata candidates 回查 manifest、analytics `_manifest.json`／catalog／processed、原 repo、必要的 Supabase/S3 版本 receipt；在 `scripts/research/capability-audit.mjs` 與 dated ledger 增加 family key、source artifact、geometry、主 blocker、下一步，不覆寫舊快照 | 778 層一層不漏；595 未知層先歸併到有證據的 source family，抽樣 10 個與原始 CSV 對帳；區分「本地有檔」「遠端確有此版本」「可查」「已顯示」。family 歸併須有原檔／RPC／release 共同契約，不依相似名稱 | 找不到原表、license 或同版證據，保留 `SOURCE_MISSING`／`VERSION_MISMATCH`／`RIGHTS_HOLD`；不靠猜測建 adapter |
| P1 縣市界 Polygon 試點 | 用既有 `administrativeBoundaryAdapter`，對照 `countyBoundary` PMTiles 與 analytics 22 個 raw MultiPolygon；核對官方授權、`COUNTY_MOI_1140318`、SHA/欄位，再決定是否從 DEV opt-in 升格為有界 reader | point-in-polygon 與環域相交；inside/outside、洞、多面、邊界 `within` vs `intersects`、無效幾何正反例；埔里與另選新地點的獨立 oracle；descriptor、查詢→地圖 ready/readback 一致。只在同版證據通過後映射 `countyBoundary` | 授權／tile ↔ raw 版次未對齊，維持 local preview，不標公開 ready |
| P2 林道 Line 試點 | 由 analytics 107 LineString、FGB／GeoJSON 與展示 PMTiles 建固定版 line reader；沿用 `createLineDatasetAdapter`，小型試點可全量校驗，大檔路徑優先 FGB bbox／immutable shard | 點到線 10 km 與線相交；埔里「卓社林道」本地 oracle、另一新地點反例；曲線／跨 bbox／重複 tile 邊界不漏不重；source 欄位與可通行狀態分開；MCP→Gateway→browser 顯示線 geometry，不只顯示中心點 | display tile 與原表不能證明同版，或 bbox 無法證明完整，保留 reader pending |
| P3 公司點大量資料 | 對 `companyPoints` 202608 r2 的 657,882 來源列、654,165 發布點及 5,745 overview cells 對帳；由 `company_points.geojsonseq` 建固定 SHA 的 bbox shard／索引或 allowlisted bounded server reader，沿用 `pointDatasetPartitions` 模式 | 兩個不同城市的新點與距離／分類變體；detail 結果與全表獨立 oracle 一致，來源排除數可追；限制欄位只用公開白名單，不回統編、地址、負責人；有限 bytes/rows、游標和截斷可見；測 cold/warm 耗時與下載量，不送 224 MB 給 browser | 未證明原表↔r2 展示同版、無法限流／保護欄位或結果不完整，保留 `VERSION_MISMATCH`／`READER_PENDING` |
| P4 多家族「附近」組合 | 在既有 typed research/session 與 result collection 上加最薄的候選篩選、運算路由、分類呈現；先用 `agriPOI`＋縣市界＋林道，再視 P3 加公司點 | 同一點一次得到 Point/Line/Polygon，三組結果各自保留 source/time/missing/truncation；地圖可同時開關及取景；埔里與至少另一新地點／問題變體有獨立預期值；無合法候選時明說缺口，不把空回覆當 0。需檢查重複場域的「紀錄／場所」口徑 | P1/P2 未過關時只能做已通過家族，不以假資料湊三類；不可把直線半徑稱為步行可及性 |
| P5 批次接其他家族 | 依 P0 家族數排序：可證來源 Point → 小型 Polygon/Line → 統計／格網 → 有時間與權限的 RPC → 大型 PMTiles sidecar。每批使用同一 adapter 模式與 family fixture，處理多 layerRefs/filter，而非逐層複製程式 | 每批列清新增 **source families / datasets / queryable layers / spatial-ready layers** 四種不同計數；有來源 SHA/count、缺值與 geometry role 的正反例；新地點／問法變體、focused tests、tsc/build、正常配對 readback、原子 commit；重跑 778 層台帳與前版差異 | owner-only、非商業、Google 衍生座標、代理點、概覽格網與來源缺檔各依語意維持 HOLD／僅屬性；不得為降低 unknown 數放寬 gate |
| P6 動態／影像專案片 | 對 `busIntercityLive` 定 snapshot/TTL/觀測時間/車輛 vs 路線；對 `aqiImagery`、其他 raster 找同版物理值、encoding、NoData、單位與授權；與靜態附近運算分開驗 | 有真數值／時間契約才允許點取樣或歷史附近查詢；延遲、過期、缺測與觀測零分開；固定回放與新時點測試各自可重現 | 純配色影像、無原始數值或時間窗口不明，維持 `DISPLAY_ONLY`／`VALUE_HOLD`；不從 RGB 反推 AQI |
| P7 收尾與下一輪入口 | 重跑 audit，彙總每 family 的 pass/HOLD、耗時／bytes／來源版次、局部與完整回歸；更新本計畫與晨間交接 | 778 層均有狀態與下一步，未分類數 0；實際可問的案例有 source→query→analysis→ready→browser 證據；保留未解來源／授權決策與 owner；可一鍵重跑台帳。沒有宣稱 778 層全可做空間運算 | 任一 blocker 未解，照原樣列出，不以文檔完成取代功能完成 |

P0→P1/P2→P4 是第一條可用路徑；P3 可與 P1/P2 在獨立檔案並行，完成後加入 P4。P5 與 P6 是後續批次，不能因 P4 跑通就把所有 595 層標完成。P1/P2/P3 做成共用元件後，要回頭用第二個同家族來源證明不是為單一題目硬編。

## 每片固定驗收與交付節奏

1. 開工前查該 worktree `git status`、服務 origin／配對狀態、上片收據；不清理其他人的變更。只讀必要 source metadata、必要原表樣本及權限資訊；secret 只查 key 存在，不輸出值。
2. 寫固定 contract 與反例：source/version/hash、筆數與排除、同版展示、license、觀測時間、geometry precision／role、允許操作、距離定義、單次上限。獨立 oracle 在正式 adapter 之外計算，不用實作複製自己的預期值。
3. 最小實作，優先既有 reader／session／presentation；不讓時間 state 造成重複載入，async 接 loading registry 並取消／忽略過期結果。Point/Line/Polygon 的操作分開，面 holes/boundary 與線跨 bbox 必有反例。
4. 跑 focused tests、必要的 `npx tsc -b`／build；只有新變更或失敗才擴測。對新地點及問法變體走正常 Codex→MCP→Gateway→browser，檢查 `ready`、來源／筆數、map readback 與目視；本地計算和 browser 分列。
5. 更新 dated ledger 和可讀收據，記新增能力、仍 HOLD 的部分、實測耗時／bytes 與原子 commit。若來源不可得，記具體檔案／權限／版本缺口後轉下一個獨立家族，不重試同一錯誤。

**完成節點**：第一個可交使用者試用的節點是 P0–P4（Point＋Line＋Polygon 在同一個新點上有可見結果）；「595 層都有判定」是 P7；「每個合法且具可計算原表的家族都接入」則依 P5/P6 台帳逐批驗收，無預設一天到位或虛構日期。S3/Supabase 是否已有某版資料，仍須逐來源實讀 receipt 才能寫成已驗證。任何批次都不自動授權發布。
