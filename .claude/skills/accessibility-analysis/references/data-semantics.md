# 資料與幾何語意

## POI bucket

- 先保留原始 category／brand／名稱與選取依據，再做 bucket。具有多個適用身分的 POI 必須進入每個 bucket；不要用 SQL `CASE WHEN` 把它縮成第一個符合者。
- 「其他／私營」是正向納入：先審核名稱樣本，再用可版本化的 whitelist。`NOT IN` 或 unknown 值不是服務類型證據。
- 回報每個 bucket 的候選、納入、排除與多重歸屬計數；變更 regex 或來源時重跑這些檢查。

## 距離、coverage 與缺值

| 狀態 | 應保留的表示 | 不可轉成 |
|---|---|---|
| 有可達路徑 | 原始距離或時間、單位、band、方法 | 未標示單位的分數 |
| 超過 cutoff | `over_cutoff` 與 cutoff | 0 或無服務的證明 |
| 無可對應路網節點 | `unmatched_network` | 最遠 band |
| POI／目標缺 geometry | `missing_geometry` | centroid 或推測位置 |
| 路網或來源缺資料／失敗 | `no_data`／`error` 與原因 | coverage=0 或正常 |
| 格網採樣未算 | `not_computed` | 沙漠或未覆蓋 |

coverage 是對特定 source set、路網、交通模式與 cutoff 的計算結果，不是服務品質或需求滿足度。H3／grid cell 的 centroid 只是計算代表點，不能冒充 POI 或精確邊界。

## Geometry

保留 EPSG、路網版本、輸入／輸出 geometry type 與 validity 結果。LineString 距離只能解釋為已納入路網 edge 的路徑成本；polygon 等時圈只代表採樣和算法覆蓋到的區域。跨模式比較前，確認單位、交通模式、cutoff、解析度和 as-of 一致。
