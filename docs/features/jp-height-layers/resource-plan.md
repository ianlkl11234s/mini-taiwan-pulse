> 最新進度：見 [日本跨區第一批](national-expansion.md)。下文保留前階段紀錄；動態 catalog 與五區資料已取代固定東京 pilot 管理。

# 視野與縮放資源計畫

2026-09-18；本地東京 pilot。目的：避免跨區移動持續累積 JP 高度來源，不承諾整站零 OOM。

## 預算與行為

- 同時詳細 sources 上限 2（建物 1、樹冠 1），摘要 source 上限 1；關閉圖層或離開 buffered bounds 即 remove layers/source。
- 不保留已離開區域的 Mapbox source；瀏覽器 HTTP cache 可重用。快速移動在 moveend 後約 200ms reconciliation，清掉過期 timer。
- 建物 z4–7: 10km、z8–10: 1km、z11–12: 250m、z13+: 屋頂輪廓。摘要與詳細互斥，不靠 opacity=0 假卸載。
- 樹冠 z9+ 僅在東京 coverage 相交時載入；既有 raster z9–12 pyramid 保持不變。本輪不新增高解析度全國 raster。
- 初始只註冊真實東京產物；大阪／北海道無資料不得產生假圖層。跨區上限用獨立測試與真實離區/返回 browser 分別驗證。
- 多尺度網格離線生成；不得下載全國 GeoJSON 至瀏覽器聚合。每個 building 代表點僅歸屬一格，統計不跨 grid 重複計數。
- 高度中位數上色；P90、有效/缺值筆數可查。部分 ROI 網格不是完整城市統計；0 與 null 分開。

## 實作與驗收順序

1. 上游 grid pipeline + counts/percentiles/null QA、PMTiles SHA。
2. 前端 grid registry、legend/popup + bounded lifecycle 接線。
3. source fake-map 100回合東京→大阪→北海道→東京，不增加活躍來源；off/unmount/style change/debounce cleanup。
4. TypeScript、全站 tests、build；本地 Range206 與 grid/detail zoom/browser 操作。
5. 記錄下載量/來源數量可觀測證據與限制；手機實機記憶體、全國高密度最壞情況仍是擴展前必要 gate。

不修改其他圖層的 cache，不下載全國、不上傳、不部署。

## 實際落地限制

- 此版固定三個 pilot sourceId，建物摘要／詳細互斥，因此同時最多2個JP來源（含樹冠）。未引入無上限的城市source清單。
- source bounds 採artifact實際範圍再加各邊10%小緩衝；world copy ±360°有測試。
- setStyle前暫停並卸載，style.load後恢复；source loading／error／dispose均清除對應loading task。
- 本地檔案安裝gate：建物與樹冠各25MB、grid5MB；超標在讀取payload之前拒絕。摘要tile上限512KB。
- mapbox-pmtiles每source建立PMTiles/Protocol；移除source不再由app持有，記憶體回收與已發出的metadata請求完成時機由引擎/瀏覽器決定。此輪沒有實測heap或GPU上限，不能保證整站永不OOM。
- `/embed` 保留既有初始化相容路徑；本次有界視野控制驗收範圍為主站MapView。若將JP高度層開放embed，須接同樣controller後才可聲稱同等保護。
