# 分析配方索引（一題型一檔）

先用 [geo-reasoning](../../../geo-reasoning/SKILL.md) 判斷問題在哪條軸（空間／關聯／因果），再只讀**一份**對應配方。題型已知時不要呼叫 `pulse_route_request`。

| 使用者大概這樣問 | 配方 | 軸 |
|---|---|---|
| 這裡／這個地址附近有什麼、生活機能如何 | [nearby-profile](nearby-profile.md) | 空間 |
| A、B、C 三地哪裡比較好住、差在哪 | [compare-places](compare-places.md) | 空間 |
| X 多的地方 Y 也多嗎、有沒有關係 | [area-correlation](area-correlation.md) | 關聯（→因果） |
| 這些事件周圍有沒有學校／敏感機構 | [event-screening](event-screening.md) | 空間 |
| 污染源周圍有沒有學校、河川、保護區，整體盤點 | [source-receptor](source-receptor.md) | 空間＋關聯 |
| 哪條路線經過最多 X | [corridor-ranking](corridor-ranking.md) | 空間 |
| 台北 vs 新北、全國排名第幾 | [region-rank](region-rank.md) | 關聯 |
| 畫出環域／疊合範圍 | [buffer-overlay](buffer-overlay.md) | 空間 |
| 哪裡特別集中、熱點在哪 | [hotspot-density](hotspot-density.md) | 空間＋關聯 |
| 哪裡是統計顯著熱點（不只是密度高） | [hotspot-gi-star](hotspot-gi-star.md) | 空間＋關聯 |
| 變多了嗎、前後差多少、為什麼變了 | [change-over-time](change-over-time.md) | 因果 |
| 同一個地方連續好幾週／月都出現 | [news-persistence](news-persistence.md) | 因果前置 |
| 某類設施周邊有哪些關鍵設施、同時靠近多個來源 | [infrastructure-proximity](infrastructure-proximity.md) | 空間 |
| 把多個指標合成一個分數排名、排名穩不穩 | [composite-index](composite-index.md) | 關聯 |
| 河川穿越幾個鄉鎮、淹水面積占比前幾名 | [boundary-overlay](boundary-overlay.md) | 空間 |
| 這些點是集中還是分散、群聚程度多顯著 | [clustering-ann](clustering-ann.md) | 關聯 |

## 新增配方

複製任一檔的五段格式（適用／工具鏈／但書／停止／追問），用 `npm run question-bank`（mcp repo）加一題回歸測試。配方只寫**已驗證**的表名與 SQL；新表先用 `pulse_wh_describe` 確認欄位。
