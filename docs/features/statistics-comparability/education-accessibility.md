# 教育交通可達性：本地北臺灣 pilot

本輪已重跑 foot 與 car 路由。兩份 receipt 都是 `LOCAL_ROUTED_PILOT_NOT_NATIONAL`，不可稱為全臺服務覆蓋或人口加權可達性。

## 已重建結果

- 起點：81 個 WGS84 角度格網 sample points，間距 0.02°；不是人口、住址或校園 geometry。
- 學制：preschool、elementary、junior_high、senior_high；每種 81 個 sample。
- 模式：foot 與 car；合計 **81 × 4 × 2 = 648** route results。
- 網路範圍 `[121.3, 24.8, 121.8, 25.3]`，sample 範圍 `[121.46, 25.0, 121.62, 25.16]`；15 分鐘門檻，snap 上限 250m。
- receipt（以 `recovery/statistics-comparability` 為 cwd）：`../data/statistics-comparison-data/accessibility/foot-results/education-foot-receipt.json` 與 `../data/statistics-comparison-data/accessibility/car-results/education-car-receipt.json`。

## 限制

- 只在 network extent 內的學校點中取最短時間；有限路網邊界可能漏掉跨界路徑。
- 路徑採最快路由，沒有尖峰交通、公共運輸時刻、候車轉乘、學區、招生或入學資格模型。
- 校點未驗證為校門；snap 位移不計入 route cost。無法 snap、未連通與超過門檻須保留為不可達／部分結果，不可當 0。
- 無學齡人口格網，不能計算學齡 coverage；即使加入總居民人口，也只能稱居民 coverage。

下一步若要擴大，需先取得全臺（含離島）可重現路網、校門／目的地規則與適用的人口分母；再將批次結果以 immutable artifact 發布，不能在使用者開圖層時逐次路由。
