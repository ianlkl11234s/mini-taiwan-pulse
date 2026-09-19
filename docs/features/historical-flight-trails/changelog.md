# Changelog

## 2026-09-18 — 本地實作，尚未發布

- 新增台灣／日本歷史航班層、機場/樣本日期、方向/跨境篩選、透明度/線寬、圖例與popup。
- 原始有效點不抽稀，時間/日期線/無效點處切段，不補假線；本地98資產、3,775,824保留點。
- CDN-only loader、SHA/bytes驗證、in-flight去重、LRU3份；離線與前端零FR24/DB新增查詢路徑。
- 一般日資料缺口保留unavailable/partial，春節列特殊案例。
- 只在獨立worktree開發，未commit/push/上傳/部署。

## 2026-09-18 3D 修正（本地）

使用者要求依 Flight Arc 呈現立體航跡並直接連線。由平面 Mapbox line 改成真實觀測高度的 3D custom layer；高度倍率預設3，可調1–10。藍白改為逐點高度漸層；同航班觀測空白直接連接，原始GeoJSON和gap_count不變，UI明示連接語意。高度線採真正3D picking，不留平面隱藏點擊層。

斷點盤點：桃園03/10有56班、53,317來源點、53,314保留點、79個>900秒gap，3個孤立點。日期篩選未裁剪整條path。直接連線不增加實測資料，也不補齊原始起訖以外的路徑。

### 移除航跡亮點

依使用者要求移除逐段圓形端帽與寬 halo。最終細線 shader 不畫觀測點或端帽，仍保留全部來源座標與3D高度。

### Flight Arc globe／細線改造

舊 `LineSegments2` 雙層粗線改為單批次細線 shader，移植 Flight Arc 的 ECEF globe 投影、Mapbox transition、球緣淡出及背面剔除。長距離缺口採 render-only great-circle 細分；Mercator 半段維持最近 world，避免跨日界線橫跨畫面。透明度預設降至0.28，線寬控制改為0.25–1的線條強度，預設0.75。

本地 browser 已驗收 z8/pitch60 近景、z4.5 過渡、z1.83 全球正面與南美背面；背面無航跡、近景無觀測點亮點。未commit、push、上傳或部署。

### 全部機場選項

機場選單首項新增「全部機場」。同一國家／日期只讀取 manifest 中已有 asset 的靜態檔，按 `flight_id` 去重、合併進離場角色，並保留點數較完整的軌跡；沒有 asset 的機場維持 unavailable 且顯示數量。此選項沿用既有 SHA／bytes 驗證與 session cache，不增加資料庫或付費 API 查詢。定位按鈕改為台灣／日本全國視角。

初始選擇改為全部機場與各國涵蓋最多的既有代表日：台灣 `2026-02-20`、日本 `2026-02-18`。

日本 exporter 不再硬編碼7座代表機場；改由 `airport-points.geojson` 的 `country=JP` Point features fail-closed 建立清單。來源中的78座日本機場在 `2026-02-18` 均有可繪資產，因此日本只保留此日期。78資產合計5,512筆機場航班紀錄、3,087,635點；前端按 `flight_id` 合併後為3,708個唯一航班。這是來源機場清單全涵蓋，不宣稱日本所有登記飛行場或完整日流量。
