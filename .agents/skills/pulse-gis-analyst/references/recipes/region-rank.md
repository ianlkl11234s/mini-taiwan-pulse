# 縣市／鄉鎮比較與排名（關聯）

**適用**：「台北和新北的教育資源差在哪」「師生比全國第幾」。

**工具鏈**
1. 找指標：`pulse_sql("SELECT indicator, area_level, count(*), max(period_start) FROM stats_observations WHERE indicator ILIKE '%teacher%' GROUP BY ALL")`。
2. `pulse_region_rank({indicator, areaLevel: "county"|"township", dimensions, order, highlightAreaCodes})`；有多組維度（例如教育階段）時每組各排一次。
3. 多指標：同一期間逐一排名，整理成「指標 × 兩地名次」表，再下總結。

**必帶但書**：先想清楚方向（師生比越低越好 → `order: "asc"`），並寫出「第 1 名＝…」；只比同期、同單位、同邊界版本；缺值與抑制不排名；總量指標要搭配人口或學生數才公平。

**停止**：名次表＋一段「整體而言」的結論（強調哪幾項差最多）。

**追問**：要不要看近 10 年名次變化？要不要換成鄉鎮看縣內落差？要不要把人口或少子化指標一起放進來？
