# CWA／ISOHE 海洋固定站觀測

本功能在 Mini Taiwan Pulse 提供兩個彼此獨立的固定站圖層：

- `marineObservationCwa`：中央氣象署（CWA）海洋觀測站。
- `marineObservationIsohe`：港灣環境資訊網（ISOHE）港區海氣象站。

兩層共用 loader、Mapbox hook 與 popup panel，但各自有 source、toggle、圖例、來源說明與 freshness 閾值。資料不與 CMEMS 海流預報、AIS 或 GFW 船舶資料混用，也不跨來源平均同名指標。

潮位等帶有垂直基準的觀測會保留 `vertical_datum`；不同 datum 不直接比較。Missing／invalid 值不補成 `0`。History 僅在使用者從 popup 選擇 metric 後 lazy-load，支援最近 24 小時與 7 天。
