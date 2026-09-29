# 縣市／鄉鎮比較與排名（關聯）

**適用**：「台北和新北的教育資源差在哪」「師生比全國第幾」。

**工具鏈**
1. 找指標：`pulse_sql("SELECT indicator, area_level, count(*), max(period_start) FROM stats_observations WHERE indicator ILIKE '%teacher%' GROUP BY ALL")`。
2. `pulse_region_rank({indicator, areaLevel: "county"|"township", dimensions, order, highlightAreaCodes})`；有多組維度（例如教育階段）時每組各排一次。
3. 多指標：同一期間逐一排名，整理成「指標 × 兩地名次」表，再下總結。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：先想清楚方向（師生比越低越好 → `order: "asc"`），並寫出「第 1 名＝…」；只比同期、同單位、同邊界版本；缺值與抑制不排名；總量指標要搭配人口或學生數才公平。

**停止**：名次表＋一段「整體而言」的結論（強調哪幾項差最多）。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要看近 10 年名次變化？要不要換成鄉鎮看縣內落差？要不要把人口或少子化指標一起放進來？

**服務缺口變體**（例如「AED／消防分隊對人口的服務缺口」，`stats_observations` 沒有現成指標時）：改用 `pulse_sql` 把設施點依 `ST_Within` 算進每個行政區，再 JOIN 人口（`ds_demographics_village_comprehensive` 依 `substr(VILLCODE,1,8)` 彙總到鄉鎮），算「人口 / 設施數」排序找出高人口低密度的鄉鎮；界內設施數為 0 不代表無服務，可能由鄰區支援，要註明。

