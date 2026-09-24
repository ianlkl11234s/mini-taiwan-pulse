# 全圖層分析覆蓋：本夜驗收與晨間討論

2026-09-25；工作分支 `codex/research-streamline-20260922`，僅隔離 `mini` worktree。本頁接續 [plan.md](./plan.md) 的 N0–N6；每一種「已可探索」「來源可讀」「可分析」「結果已顯示」分開認定。沒有 push、PR、merge 或 deploy，原 checkout 與現有配對未清除。

| 片 | 完成與證據 | 邊界／下一步 |
|---|---|---|
| N0 現況 | 沿用前輪全 22 縣市、嘉義五物件、深淺底圖與面板驗收，見 [六片驗收](./acceptance-feedback-six-20260925.md)；本輪正常配對再次確認查詢→呈現→ready→map readback→畫面可見 | 未把本輪兩點展示當成所有圖層 UI／互動已驗收 |
| N1 台帳 | `a7d0655f`：778 manifest layers 逐層分類；後續新增 adapter 後重跑為 77 datasets、69 descriptor layer mappings、68 queryable layer mappings、114 GeoJSON metadata candidates、596 unknown/unavailable。四個 source-kind assignment 合計 779，因一層混合來源 | `analysis-coverage-20260925.json` 可逐層查 blocker；metadata candidate 不是 reader |
| N2 Point | `a07fb5fa` 將縣中心代理點標成 proxy，拒絕 bbox／nearest；`892046a9` 登記 3 個林務推估位置與 8 個教育中心；`5d51b7ea` 登記 36 個來源座標燈塔；`2cf5e224` 把 58 個 OSM 海纜登陸站候選拆為 11 筆來源 node 座標與 47 筆 Overpass center 代理點兩 dataset。固定 SHA、筆數、角色與新地點變體均測試；正常鏈以 `tata tgn-pacific` 變體查到 1 個 node，proxy bbox 回 `BBOX_NOT_SUPPORTED` | 林務與 Overpass center 代理點只可查來源屬性，不能做真正近鄰／環域；其餘 114 候選仍需分批讀源驗證 |
| N3 custom／統計 | `4638e2ea` 以現有統計家族 adapter 接七個市區公車 release；臺北 `63000` 的 2025 年核定路線數 295 條在正常 MCP 鏈實讀，coverage 22/22 | `COLUMN6` 上游明示電動車欄名待校正，維持 HOLD；不能把七個 release 說成 52 個 Supabase layers 全可查 |
| N4 PMTiles | `614105db` 從同版完整 GeoJSON 建臺北細部都市計畫分區屬性 sidecar：15,518 列、1,921,082 bytes、固定 SHA；`5dce4318` 修正配對 dev server 跨 checkout `publicDir`，正常工具鏈 `residential` 查到 7,811 筆 | sidecar 無面 geometry；僅可查屬性／計數，不可做相交、面積與環域。新北 PMTiles SHA 未與上游對齊，不能冒稱同版 |
| N5 RPC／raster | [gate](./n5-rpc-raster-20260925.md) 區分具契約的 regional statistics、未登記 Supabase RPC、兩種物理值 raster、純配色影像。正常工具鏈實讀 114 學年臺北國小學生 117,650 人，`stale` 與 22/22 宣告 coverage 均保留 | 沒有新增通用任意 RPC／像元 reader；未讀取 raster 值，純配色影像 HOLD |
| N6 新地點整合 | 綠島燈塔來源 Point `[121.4664722,22.6762778]`；同島郵局來源 Point `[121.477541,22.659331]`。郵局在燈塔直線 3 km 內，MCP 回 `distanceM=2200.186`；兩筆成組呈現，`ready` revision 8、browser readback `featureCount=2`／兩 source／兩 layer，畫面可見兩色點並飛到綠島 | 郵局 2026-07-17 是取得日、非當前營業狀態；直線距離不是步行距離。完整自然語言問答耗時與 596 層覆蓋尚未驗收 |

596 個 unknown/unavailable 的 source-kind assignment：custom 444、PMTiles 97、Supabase 51、GeoJSON 5，合計 597 次 assignment，因一個 layer 同時屬兩類。595 層缺查詢 descriptor／reader，另 1 層有 descriptor 但明確關閉 query；這些是**目前能力缺口**，不等於原始資料不存在。114 個 GeoJSON 單檔候選另外列為 metadata，仍需實讀、來源與語意 gate。

切片測試：Point／統計／sidecar 均有各自 focused tests 與 `tsc`；全套回歸先發現兩個**舊測試斷言**與現行安全契約不合，`c9f1bc1e` 修正測試：locked dataset 對外隱藏為 `DATASET_NOT_FOUND`，完整面 geometry 留在 materialized result、預設 query receipt 僅回屬性。最後完整 `npm test -- --run`：266 files passed、1 skipped；1,974 tests passed、12 skipped。最後 `npm run build` 通過，有既有大 bundle size warning，未部署。正常工具鏈實讀與 browser readback 另外記於上表，不由 unit/build 推定。

## 早上需要一起決定

1. **來源批次優先序**：先從 114 個單一 GeoJSON 候選中選有來源時間、授權、完整筆數與真座標的一批；再按 596 unknown 的 blocker 分流。希望先偏民生設施、交通、環境或災防，會影響上游對接順序，但不影響已可做的安全接線。
2. **PMTiles 幾何**：臺北 sidecar 下一階段可做同版完整面分片及空間索引；新北先解上游／展示 PMTiles SHA 不一致。需確認哪個版本應作正式展示與分析共同基準，否則不做「兩者同版」宣稱。
3. **公車 `COLUMN6`**：待上游 steward 確認欄名後再以「電動車」接入；目前不從名稱推測。
4. **Raster 物理值**：先確定 canopy height、urban heat 的來源、編碼、NoData、時間與 license receipt，做一個有界像元 probe；其餘純配色影像須取得原始數值格網才談分析。
5. **覆蓋完成定義**：每層至少要有可明確回答的狀態（可分析／僅展示／缺 reader／權限或來源 HOLD），而「全部可分析」還需逐家族 source contract、回歸與網站 readback。原始資料存在會縮短補料，但不自動提供可比較粒度、同版 geometry 或合法使用權。

下一輪按台帳逐批接來源，不為數字降低 gate；每批保留 exact source/version、缺值與 geometry role、可重跑的反例、新地點工具鏈與原子 commit。
