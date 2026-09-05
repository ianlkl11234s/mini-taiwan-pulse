# Changelog — 交通場站顯示模式

## 2026-09-05 — 本地開發

- 依最終驗收決策，高鐵、台鐵、捷運、港口與機場的顯示模式全部改為預設 Mapbox 點位。
- 視覺複核後補上台鐵 212 個小站的 z<10 overview，遠距離不再只顯示 32 個大站；第二類漁港由鮮綠改為低飽和鼠尾草綠。
- 高鐵、台鐵、港口、機場新增 Polygon / Mapbox 點位切換，保留原 Polygon 顯示。
- 捷運新增相同模式控制，但因現有資料無站體面，Polygon 選項明確停用；z10 以下新增 overview 點，z10 以上保留原 detail layers。
- 港口依 9 種現有 `port_class` 著色，Legend 與 popup 共用同一色彩 SSOT；未知分類回灰。
- 新增 Polygon/MultiPolygon 派生點 transform、模式可見性守門與契約測試。
- 本地 browser 驗收通過：全台遠距離點位、原 Polygon 切回、港口 9 類分色 / Legend / popup，以及捷運無面資料 disabled 狀態；console 無 error/warning。
- 本次已獲授權建立 commit / PR；未 deploy。
