# 日本全國高度圖層 runtime 計畫（待定契約）

2026-09-18。此文件只提出前端與發布清冊的最小擴展契約；不表示已有全國資料或可發布產物。

## 現況限制

- installer 目前固定五個 city id，並把同一批輸入限制在 150MB。
- 瀏覽器 catalog 上限是 5,000 regions、2MB；runtime 同時最多 4 個建物（detail 或 grid）與 2 個 canopy source，總數最多 6。
- 現行 `overview` 是單一 asset。在全國 250m 格網下，這會把大量 geometry、tile index 與更新責任集中到一個檔案，也不能以 source cap 解決單檔過大的問題。
- lifecycle 對超過 cap 的相交 region 只回報 capped ids。這對稀疏 ROI 可接受，對都會連續視野會造成可見缺片，不能作為全國 regional-grid 的長期行為。

## 最小分級發布契約

清冊仍維持 versioned `jp-height-catalog-v1`，但 `regions` 的意義改為可在同一視野內獨立掛載的空間分片，而不是每個市名一筆。每筆保留 asset 自己的精確 bbox、來源年、方法、授權、coverage 和 bytes/SHA；region bbox 只能是 asset bbox 的聯集，不能拿行政區外框代替。

| 顯示縮放 | 產物 | 清冊安排 | runtime 行為 |
| --- | --- | --- | --- |
| z4–7 | nationwide overview grid | 多個 coarse overview 分片，依固定空間索引分組 | 視野相交的鄰近分片以來源 cap 掛載；若會超限，先以較粗 parent 分片取代子分片 |
| z8–12 | regional grid | 同一空間索引的 regional grid 分片 | 選擇覆蓋完整視野的最粗可用 parent；不可只保留距中心最近四片而留下洞 |
| z13+ | building detail | detail 分片，與同區 grid 互斥 | 僅掛載相交的 detail；若超過可接受數量，狀態須明示「需縮小視野」，不可靜默遺漏 |
| canopy 低縮放 | optional canopy overview/coarse | 與建物格網分開的 raster/PMTiles 分片 | 只有實際 asset coverage 才掛載；沒有全國連續資料時維持 partial/hold，不能以 overview 補成全國覆蓋 |
| canopy 高縮放 | canopy detail | 實際 raster coverage 分片 | 僅載入相交區；最多兩個 source 的限制仍有效，超限須有可讀狀態 |

「parent」是同一資料版本、同一統計定義的空間彙總，不得由前端把子格網相加。不同解析度格網不能互相加總或當作同一觀測。

## 分片與 source 預算

為保留目前 Mapbox 的 4 building/grid + 2 canopy、總數 6 限制，發布端需要保證每一縮放層級可用不超過 cap 的 parent partition 覆蓋一般 viewport。建議採固定 hierarchy（例如國家 coarse parent → regional child → detail leaf），每一 parent 的 bbox 可由 catalog 列出，且 child 完全落在 parent coverage 內。

- z4–7 不要求「全國一檔」；將國土切成少量 coarse partitions。以 viewport 相交集合決定掛載，不按全部 regions 預載。
- z8–12 選最粗、能完整覆蓋目前相交 child 的 grid parent。若交集仍超過 4 sources，runtime 必須發出 capped/zoom-in 狀態，Legend 只顯示一則整體提示與 active/available/capped 計數，不逐一列出數千 region label。
- z13+ 不以 overview 偽裝建物 detail。若 detail 的視野分片超過 4，保留明確缺口狀態並要求縮小視野，避免把未載入區說成無資料。
- canopy 的 coarse 與 detail 各自描述 resolution、method、coverage；只有同一數值意義時才能在縮放間切換。

## Catalog 與 UI 最小調整點（待主 agent 定案）

現有 schema 可承載 `regions` 和單一 `overview`，但全國分片需先決定下列兼容擴展，才改 parser/lifecycle：

1. 是否把 `overview` 改為 `overviewRegions`（與 `regions` 同 asset 欄位），或將 coarse partitions 直接列為 `regions` 並加明確 scale/role。兩者只能選一種 SSOT，避免一份 asset 同時出現在兩個集合。
2. 每個 asset/region 必須可表達 `tier`（national-overview、regional-grid、detail、canopy-overview、canopy-detail）與 parent key；不接受以 URL 名稱、label 或 zoom 猜測層級。
3. catalog 的 5,000 / 2MB 是硬防護，不是全國切分目標。若預期超過，必須先發布小型 root catalog，再按 viewport 載入有相同 schema/版本/完整性限制的 regional index；不得在前端提供無上限 fallback fetch。
4. runtime status 需保留 `activeSourceIds`、available count、capped count/reason、catalog version，以及 `partial`/`source-coverage` 原值。Legend 以聚合計數與當前 coverage 訊息呈現，region label 僅限 active 或使用者點選的項目。

## Installer / 發布 gate

- 移除硬編 region label 與 150MB 單 campaign 判定前，改由版本化 manifest 列出所有分片、bytes、SHA、bbox、tier、parent、來源 metadata 與 status。仍保留每檔 grid 5MB、detail/canopy 25MB 的前端安全預算，或在契約中明確修訂並同步 parser。
- 安裝前驗證每個 PMTiles header bbox/zoom 與 manifest 相符、同 tier partition 不重複宣稱同一 coverage、parent coverage 不擴張 child 的實際資料邊界。
- 先寫 content-addressed assets，最後原子寫 root catalog；若使用 regional index，也必須在 root catalog 可驗證引用，失敗時顯示 unavailable/partial，不能回退成假全國資料。
- 發布驗收至少包含密集 viewport（相交 child 多於 4）與稀疏 viewport；確認前者有完整 parent coverage 或明確 capped 狀態，後者沒有累積 source。另驗證離開視野、toggle off、style rebuild、abort 與 error 都釋放 managed source/loading task。

## 尚待決定

- 國家 coarse partition 的格網解析度、最大 tile/index/PMTiles bytes、以及每個一般 viewport 的來源上限，需要依真實產物與裝置 profiling 決定，不能從現有五城數字推估。
- canopy 是否有可合法發布且數值方法一致的低縮放產物；沒有時只發 detail partial coverage。
- 超過 detail cap 時產品要顯示「縮小視野」或切換可驗證的 coarse grid；兩者取決於是否已有同定義的 parent asset。
