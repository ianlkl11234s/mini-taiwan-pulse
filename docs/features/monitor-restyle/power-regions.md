# 供電卡：電廠依台電四區分組（調查）

> 2026-10-02 調查；**已實作並上線**（方案 B：RPC 回 `taipower_region`，gis-platform migration `424_power_facility_taipower_region.sql`，前端 mini PR #494；前端讀取見 `src/data/energyLoader.ts`、`src/components/intel/monitor/powerCardData.ts`）。以下為調查當時的內容，§4 的方案比較與「未實作」字樣是歷史紀錄，不代表現況。目的：機組小格要能「依區域」分組，而且分組的定義要和卡上「四區用電」一致。

## 1. 四區用電資料從哪來

| 層 | 位置 | 內容 |
|---|---|---|
| 台電原始 | `https://service.taipower.com.tw/data/opendata/apply/file/d006019/001.csv`（政府開放資料 162596「台灣電力公司今日區域別用電情況」）| 欄位：`時間`、`區域`（北部／中部／南部／東部）、`發電(萬瓩)`、`用電(萬瓩)`；每 10 分鐘 4 列。2026-10-02 18:50 實測：北部發電 1183.7／用電 1366.7、東部發電 7.4／用電 44.9（萬瓩）|
| collector | `data-collectors/collectors/power_taipower.py:42`（URL_REGION）、`:175-194`（`_fetch_region`，萬瓩→MW）| 寫入 `live.power_region_demand`（UNIQUE(region, observed_at)）|
| DB／RPC | `gis-platform/migrations/212_power_dashboard_rpc.sql:30-41`；表在 `312_move_realtime_to_live.sql:108` 搬到 `live` schema，RPC 最新定義在 `312:2407-2411` | `get_power_dashboard()` 取最新一輪 4 區 |
| mini loader | `src/data/energyLoader.ts:35-58`（`PowerRegion`、`fetchPowerDashboardUncached`）| `regions[]` |
| 卡片 | `src/components/intel/monitor/powerCardData.ts:34` | **卡上顯示的是 `consumption_mw`（用電）**，不是發電 |

電廠出力：`get_ssot_facility_output_24h()`（`312_move_realtime_to_live.sql:3627` 起），來源表 `energy.power_facilities` ＋ `live.power_generation_unit`。RPC 只輸出 facility_id／plant_name／fuel_type／capacity_mw／lon／lat／points；**`energy.power_facilities` 本身有 `county` 欄**（離岸風場是 NULL），只是 RPC 沒帶出來。

## 2. 台電四區的官方定義

來源一，台電「電網供電現況」頁的「用電區域範圍劃分」：https://www.taipower.com.tw/2289/2363/2367/2371/10298/normalPost（頁面標示更新日期 2025-12-19；這個站有防爬蟲，curl 會拿到 202 空白頁，要用瀏覽器開）

> 本島地區用電區域範圍依行政區(縣市別)劃分為北、中、南、東四個地區：
> 北部地區　臺北市、新北市、基隆市、新竹市、桃園市、新竹縣、宜蘭縣
> 中部地區　臺中市、苗栗縣、彰化縣、南投縣、雲林縣
> 南部地區　高雄市、臺南市、嘉義市、嘉義縣、屏東縣
> 東部地區　花蓮縣、臺東縣

來源二，台電「用電曲線圖(依區域別)」頁的備註：https://www.taipower.com.tw/d006/loadGraph/loadGraph/load_areas_.html（卡上用電數字就是這份資料）

> 各區域發電量劃分，原則先以電廠所在地理位置劃分北、中、南、東四區；區域用電量則再依中送北、南送中、南送東、中送東電力潮流量調整得出。
> IPP和平電廠及碧海電廠引接宜蘭縣冬山超高壓變電所，故歸類於北區;麥寮塑化汽電共生廠引接南投縣中寮北超高壓開閉所，故歸類於中區;麥寮發電廠引接嘉義縣嘉民超高壓變電所，故歸類於南區。

要注意的地方：
- **苗栗、雲林屬中部；宜蘭屬北部；花蓮、台東屬東部。**
- **離島（澎湖、金門、連江）不在四區裡**。定義寫的是「本島地區」。離島電廠的出力有沒有算進四區發電量，官方沒有說明，目前沒查到。
- **例外是看電廠接到哪個變電所，不是看它蓋在哪**：和平（花蓮）、碧海（花蓮）算北區；麥寮發電廠（雲林）算南區；麥寮汽電共生算中區。這幾座都不在目前 23 座裡，但以後清單變長就要另外處理。
- **DB 的 `reference.counties.region` 跟台電定義不一樣**：它把宜蘭歸到 `east`，另外多一個 `island` 類。不能直接拿來用。而且這張表的 `geom_4326` 只是中心點（POINT），不是縣市邊界。
- 卡上的四區數字是**用電**（已經依各區之間的電力潮流調整過）。電廠出力加總只能拿來對**發電**（`generation_mw`）。所以分組後各區的電廠出力加總，本來就不會等於卡上那個 MW。

## 3. 23 座電廠歸區

查法：先看 `energy.power_facilities.county`，再用 `spatial.boundaries`（level='county'，2024 版，22 個多邊形）做 ST_Contains 交叉驗證。在海上的點改用離它最近的縣市多邊形（以 geography 算距離）。唯讀 SELECT，查詢結果是 23 列。

| 電廠 | 燃料 | 縣市 | 歸區 | 判斷方式／疑義 |
|---|---|---|---|---|
| 大潭發電廠 | oil_gas | 桃園市 | 北部 | 點落在多邊形內，DB county 一致 |
| 林口發電廠 | coal | 新北市 | 北部 | 同上 |
| 石門發電廠 | hydro | 桃園市 | 北部 | 同上 |
| 卓蘭發電廠 | hydro | 苗栗縣 | 中部 | 同上 |
| 通霄發電廠 | oil_gas | 苗栗縣 | 中部 | 同上 |
| 台中發電廠 | coal | 臺中市 | 中部 | 同上 |
| 大甲溪發電廠 | hydro | 臺中市 | 中部 | 同上 |
| 大觀發電廠 | hydro | 南投縣 | 中部 | 同上 |
| 明潭發電廠 | hydro | 南投縣 | 中部 | 同上 |
| 萬大發電廠 | hydro | 南投縣 | 中部 | 同上 |
| 彰芳暨西島離岸風場 | offshore_wind | （海上）彰化縣 | 中部 | ⚠ 離岸，離最近的縣市（彰化）14.9 km |
| 大彰化東南離岸風場 | offshore_wind | （海上）彰化縣 | 中部 | ⚠ 離岸，離彰化 36.9 km |
| 大彰化西南離岸風場 | offshore_wind | （海上）彰化縣 | 中部 | ⚠ 離岸，離彰化 36.6 km |
| 海龍離岸風場 | offshore_wind | （海上）最近的是澎湖縣（27.2 km）| 中部（推定）| ⚠⚠ 單看幾何會歸到離島。它是彰化外海的風場，推定接彰化陸上變電所，所以歸中部。併網點**沒有查到官方來源** |
| 海能風電 Formosa 1 | offshore_wind | （海上）苗栗縣 | 中部 | ⚠ 離岸，離苗栗 3.5 km |
| 海能風電 Formosa 2 | offshore_wind | （海上）苗栗縣 | 中部 | ⚠ 離岸，離苗栗 17.9 km。併網點沒查證 |
| 曾文發電廠 | hydro | 臺南市 | 南部 | 點在多邊形內。它在嘉義縣和臺南市交界附近，不過兩邊都屬南部，不影響歸區 |
| 南部發電廠 | oil_gas | 高雄市 | 南部 | 點在多邊形內 |
| 大林發電廠 | coal | 高雄市 | 南部 | 同上 |
| 興達發電廠 | coal | 高雄市 | 南部 | 同上 |
| 尖山發電廠 | oil_gas | 澎湖縣 | 離島 | ⚠ 不在四區裡 |
| 塔山發電廠 | oil_gas | 金門縣 | 離島 | ⚠ 不在四區裡 |
| 協和電廠－珠山分廠 | oil_gas | 連江縣 | 離島 | ⚠ 不在四區裡（廠名有「協和」，但這座是馬祖的珠山分廠）|

小結：北部 3、中部 13、南部 4、東部 0、離島 3。**東部一座都沒有**，台電實測東部發電只有約 7 萬瓩。UI 要決定東部是顯示「無機組資料」還是乾脆不顯示，不能顯示成 0 MW。

## 4. 前端實作建議（調查當時；現已採 B 並上線）

| 方案 | 做法 | 優點 | 缺點 |
|---|---|---|---|
| A. 純前端：用經緯度判斷所在縣市 | 載入 `public/statistics/county-reference-2025.geojson`（513 KB）做 point-in-polygon，再配一張 22 筆的「縣市→台電分區」常數 | 不用動 migration | 為了 23 個點多下載 513 KB；海上的點落不進任何多邊形，要另外寫「找最近縣市」的邏輯；而且海龍會被誤判成澎湖；併網例外（麥寮、和平）也要硬寫在程式裡 |
| A'. 純前端：facility_id 對照表 | 直接寫一張 23 筆的 `facility_id → 分區` 常數 | 最小、最快 | 新增電廠就會漏掉，而且無聲無息（要有 fallback「未分區」，並加測試）|
| **B. RPC 加 `taipower_region` 欄（推薦）** | gis-platform migration：用 `energy.power_facilities.county` 對「縣市→台電分區」對照（可以做成小表，或寫在 RPC 的 CASE 裡）；county 是 NULL 的離岸風場、以及麥寮／和平這類併網例外，用 override 欄補上（例如在 power_facilities 加 `taipower_region_override`）；離島回 `island` | 定義只放在 DB 一個地方，以後清單變長、或其他 RPC 要用都能共用；前端零幾何運算 | 要寫 migration，需要 user 拍板；而且要照「上游先動」的順序，先 gis-platform 再 mini |

推薦 B。如果想先讓 UI 動起來，可以用 A' 當過渡，但一定要有「未分區」fallback，等 B 上線後就刪掉。不管選哪個方案，「縣市→分區」都要照台電的表，**不能用 `reference.counties.region`**（宜蘭歸錯區，而且沒有區分本島和離島）。
