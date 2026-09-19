> 最新進度：見 [日本跨區第一批](national-expansion.md)。下文保留前階段紀錄；動態 catalog 與五區資料已取代固定東京 pilot 管理。

# 日本建物高度與樹冠高度

本次 scope：research/prototype → 本地真實資料、前端操作與可重跑管線。發布另行驗收。

## 實作順序

1. 確認 TW 現有建物 vector PMTiles 與樹冠 RGBA PMTiles 契約。
2. 日本建物使用官方 PLATEAU CityGML 的LOD0 RoofEdge 屋頂輪廓與高度；不以楼層數或預設高度填補缺值。
3. 日本樹冠沿用 Meta/WRI CHMv2 的全球來源，以 bbox 擷取、降採樣、建立高度編碼 PMTiles。
4. 日本分頁加入獨立圖層，提供 opacity、圖例、建物 2D/3D 與點擊讀值。
5. 先以東京試點驗證真實資料，再按城市與覆蓋區域逐批擴展。未下載地區不可聲稱沒有建物／森林。
6. 完成來源、artifact、測試、browser 四項本地證據；尚未 upload/deploy/production。

## 範圍與語意

- PLATEAU 是各自治體、年度的 3D 城市模型，並非全日本連續的同年測量。
- 建物高度是來源提供的地上高度；不是海拔，LOD1 不代表真實屋頂形狀。
- CHMv2 是 DINOv3 遙測模型估計，2026 是 release 年，不是所有像素的影像拍攝年。
- 樹冠輸出以 Web Mercator 約 19.109m pixel 存放；實際地面尺度依緯度變化。不是 1m 原始解析度顯示。
- 樹冠 0/nodata 透明，不補為 0m；顏色最深值只是色階上限，點擊保留實際高度。

## 永久工作區

- 前端：`mini-taiwan-pulse/.worktrees/jp-height-layers-20260918`
- 上游：`taipei-gis-analytics/.worktrees/jp-height-layers-20260918`
- 兩者 branch：`codex/jp-height-layers-20260918`
- 前端起點：`7ebbb865`；上游起點：`bff65414`。

詳見 [handoff](handoff.md)、[acceptance](acceptance.md)。

多尺度與卸載保護的計畫、預算及限制見 [resource-plan](resource-plan.md)。
