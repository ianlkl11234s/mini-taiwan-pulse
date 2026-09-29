# 真等時圈可達性（空間）

**適用**：題目真的在問「路網可達」而不是直線距離——「走路／騎車／開車幾分鐘能到 X」「這個範圍是真的等時圈，不是直線環域」「跟直線代理比差多少」。已經在用 [buffer-overlay 的涵蓋率變體](buffer-overlay.md) 或 [elderly-care-access](elderly-care-access.md) 的 `ST_DWithin` 直線距離、但使用者追問「這是真的走路時間嗎」時，換這個配方；純粹想快速掃一個涵蓋率、不在意路網精度，直線代理夠用且免呼叫外部服務，不必升級。

**工具鏈**（`pulse_isochrone` 產生等時圈 → `pulse_sql` 疊合分析）

1. `pulse_isochrone {points:[{lng,lat,label?}] (1–10), mode:"walk"|"bike"|"drive", minutes:[..] 或 meters:[..] (擇一，≤4 條)}` — 一次最多 10 點；`minutes` 上限 walk 120／bike,drive 90。回條是一般倉庫結果（`wh-N`，可 `pulse_wh_present`），另外在 `summary.table` 給一個可直接查詢的表名（例如 `iso_wh_7`，`-`→`_`，**照 `summary.table` 抄，不要自己拼 `iso_wh-7`**）。
2. 超過 10 點（例如「台北市所有國小」）：**自己在呼叫端分批**，每批 ≤10 點呼叫一次 `pulse_isochrone`，收集每批的 `summary.table`，再用 `UNION ALL` 併成一個 CTE：
   ```sql
   WITH iso AS (
     SELECT minutes, geom_3826 AS g FROM "iso_wh_7"
     UNION ALL SELECT minutes, geom_3826 AS g FROM "iso_wh_8"
   )
   SELECT DISTINCT v.name FROM boundaries_village v, iso
   WHERE iso.minutes = 10 AND ST_Within(ST_Centroid(v.geom_3826), iso.g)
   ```
   等時圈表每點每條等時線各一列（欄位 `label`／`mode`／`minutes` 或 `meters`／`area_km2`）。一次要了多條（例如 `minutes:[10,15]`）時，**必須帶 `minutes`（或 `meters`）欄並逐條篩選或 `GROUP BY minutes`**；不篩會把 15 分的大圈一起算進「10 分鐘可達」，多條等時線塌成一個結果。同一村里落在多個點的等時圈內會重複，計數要 `DISTINCT`。
   涵蓋率／缺口清單模板照抄 [elderly-care-access](elderly-care-access.md) 的 `NOT EXISTS` 寫法，只是把 `ST_DWithin(c, facility, 半徑)` 換成 `ST_Within(c, iso.g)`。
3. **呼叫量控制**：先用 `pulse_sql` 算出實際要跑的點數（例如「台北市國小」先 `count(*)` 確認 <=200），範圍先縮小到縣市／類別，不要對全國資料直接展開；伺服器端已用併發 3、10 秒逾時，不必自己加節流。
4. 面積、涵蓋人口等後續分析一律用 `geom_3826`（等時圈表已內建這欄），不要拿 `geom`（EPSG:4326）直接做公尺運算。

已驗證數字（2026-09-27，自架 Valhalla 3.9）：台北車站 walk 10 分 1.452 km²／15 分 3.378 km²；台北市 154 所國小 walk 10 分等時圈涵蓋 80.3% 村里（366/456，村里中心點落入即算），同題直線代理（800m 環域）僅 55.6%（全國口徑，兩者範圍不同不能直接比對百分點，但可作為「直線代理系統性高估／低估涵蓋率」的參考）；12 處臺北市運動中心 bike 15 分涵蓋 88.2% 人口（2,214,308/2,511,886）。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：Valhalla 3.9 + OSM（© OpenStreetMap contributors），路網版本／建置日期見服務端 R2 latest.json；等時圈是路網可達估計，**不含等紅燈、坡度、實際步速差異**，非真實通行時間。座標偏離可通行路網的點會被跳過並記在 `summary.failed`／caveats，不會生出假多邊形；只有全部點都失敗才會整個報 `ISOCHRONE_UPSTREAM`。`ISOCHRONE_NOT_CONFIGURED` 代表這個 MCP 沒設定 Valhalla（不是使用者輸入錯），回報時要跟「查無資料」分開講。涵蓋率用村里**中心點**落入判斷，非村里全面積涵蓋。

**停止**：涵蓋率 %／面積 km²／人口數其中使用者要的那個＋未涵蓋村里樣本（前 5–10 筆）；有失敗點時附失敗數與樣本標籤；若同題有直線代理版本，兩個數字並列並註明範圍是否一致。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要換交通方式或分鐘數看差異？要不要把等時圈疊到地圖看形狀（`pulse_wh_present`）？要不要跟直線代理版本正式比較差異幅度？
