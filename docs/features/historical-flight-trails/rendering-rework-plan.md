# Flight Arc 對照調查與改造計畫

2026-09-18；調查後已完成本地 renderer 改造與 browser 驗收，尚未 commit、發布或部署。

## 已確認原因

- Pulse `HistoricalFlightTrailsScene.ts` 只建立 Mercator 座標，custom layer 只傳 matrix，未接 globe projection matrix、transition 與 ECEF。低 zoom 因此繪製錯位；不是單純 depthTest 問題。
- Pulse 使用 LineSegments2 加三倍線寬 glow。上一輪移除端帽只能消除亮點，不能得到 Flight Arc 的細線質感。
- Flight Arc `src/map/customLayer.ts:229` 接 Mapbox globe callback；`src/three/shaders/globeProject.ts` 預算 ECEF、徑向高度、globe/Mercator 過渡與背面淡出。不是低 zoom 改用平面線。
- Flight Arc `src/three/FlightScene.ts:464` 與 `src/three/shaders/staticTrail.frag` 使用 LineSegments / ShaderMaterial、subpixel alpha 與單 pass glow；dark additive / light normal。關閉 depthTest 配合 ECEF 背面剔除，不能只複製前半部。
- 參考截圖為 RCTP 2026-02-18、649 班，先前 Pulse 樣本日期與班數不同。質感對照須固定日期、機場與相機，並記錄資料覆蓋差異。

## 實作順序

1. 移植 Flight Arc 的靜態線條與 globe projection 核心到本圖層，保留 batched geometry、藍白高度色、原始觀測點、靜態載入與篩選。移除粗寬雙 pass glow；線寬控制改為符合細線 renderer 的語意與範圍。
2. 接 projection callback、ECEF 預計算、徑向高度、transition、相機 ECEF、背面剔除與球緣淡出。CPU popup picking 必須用相同投影與可見性，避免點到背面航班。
3. 同航班缺口照使用者要求直接連線；長缺口在球面顯示時需按球面路徑細分以免成穿球弦，插值僅為繪圖頂點，不回寫觀測資料或變更來源點數。跨日界線不可跨整個世界。
4. 此次不套資料 LOD 或平滑演算法刪減原始點，也不加入動態飛機。先確認高密度靜態完整解析度效能，再决定是否需要獨立優化。

## 必要驗收

- 近景 z8–10：高 pitch 起降高度、細線、無圓點、密集航線不糊成粗光帶。
- 全球 z1.8–3：台灣、日本與跨洲航線貼合球體；旋轉至背面完全隱藏，球緣沒有射出長線。
- 中間縮放连续往返：投影連續、不跳位、不消失；寬高不同 viewport 與 DPR 下比較線條。
- 長缺口、日界線、篩選、透明度、高度、樣式切換、關閉重開，以及前後半球 popup。
- 數學回歸測試、相關 layer tests、tsc -b；浏览器實際檢查近/中/遠景。測試通過不替代視覺驗收。
- 維持現有靜態 asset cache，不新增 DB、付費 API 或下載排程；本地工作不包含發布。

## 範圍

主要修改 HistoricalFlightTrailsScene、historicalFlightTrailsCustomLayer 與其 tests；必要時調整 params/legend、picking 接線。Flight Arc repo 唯讀，其他圖層保持原狀。
