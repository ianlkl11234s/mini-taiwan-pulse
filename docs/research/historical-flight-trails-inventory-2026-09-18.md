# 台灣／日本歷史飛行軌跡靜態圖層：盤點與建議

盤點日：2026-09-18。範圍僅研究與本地檔案驗證，未實作、付費抓取、上傳、commit 或部署。
上游：`../plan-art`。manifest 產生時間：2026-09-16T02:08:18.783Z，全球 97,511 班去重軌跡。

## 初次盤點的可用日期（已由下方第二版規劃取代選日優先序）

可用現有實際軌跡做靜態線層，首版不需飛機動畫或播放時間軸。台灣 TW-CIVIL 16 座均已有軌跡；若包含恆春則是 17 座目標中的 16 座。TW 群組另含軍用機場，不宜直接把 22 個代碼當作民航目標。

- 台灣工作日候選：2026-02-24（二），現有出發日分檔涵蓋全部 16 座。
- 台灣假日候選：2026-02-22（日、春節假期），涵蓋 15 座，望安缺資料。
- 若優先讓所有 16 座在假日樣本也有線：可改用 2026-02-20（五、春節假期）。這是國定假期案例，不能標成週末。
- 若要求「普通平日 vs 普通週末」：現有高覆蓋資料不能直接滿足，需另選非連假週末、核對名單並補軌跡。
- 日本先以 2026-02-18 作單日示範，優先羽田／成田／關西／福岡／新千歲／中部／那霸；目前日本週末資料多為台灣航班另一端帶入，不能當成全日本機場整日流量。

2/18–2/22 屬台灣春節期間，不可以只看星期幾就稱為一般平日。假日標籤依[人事總處 115 年辦公日曆](https://www.dgpa.gov.tw/information?pid=12685&uid=55)，該日曆作樣本分類，並不表示航空業當日休業。日本需另用日本假日曆。

## 台灣逐機場盤點

以下是 manifest 現有軌跡筆數，日期為「台灣時間的航班起飛日」，不是所選機場當地整日起降數。`—` 表示本地沒有軌跡，不表示當日沒有飛機。不同機場可重複收錄同一航班，欄位不可相加當不重複航班量。

|機場|ICAO|累計軌跡|2/24 工作日|2/22 春節週日|2/20 春節週五|
|---|---|---:|---:|---:|---:|
|桃園|RCTP|7695|464|481|452|
|松山|RCSS|1527|135|175|170|
|高雄|RCKH|1806|162|186|181|
|臺南|RCNN|153|15|16|16|
|金門|RCBS|925|82|106|102|
|馬祖南竿|RCFG|121|10|12|16|
|馬祖北竿|RCMT|36|4|4|4|
|澎湖|RCQC|1104|85|126|119|
|望安|RCWA|6|2|—|2|
|七美|RCCM|86|8|12|10|
|綠島|RCGI|49|6|6|8|
|蘭嶼|RCLY|68|10|5|11|
|臺中|RCMQ|912|75|94|108|
|花蓮|RCYU|44|2|9|9|
|臺東|RCFN|230|29|23|32|
|嘉義|RCKU|40|4|4|4|
|恆春|RCKW|0|—|—|—|

望安只有 2/20、2/23、2/24 各 2 筆；這是目前資料存在日，不足以推論固定每週班表。恆春 core-airports 索引有 3/4、4/26 各 1 筆航班名單、done=0，可優先查這兩班的軌跡可得性，仍不保證取得。蘭嶼 2/18、2/23 無軌跡，2/24 有 10 筆，說明日期須按機場查詢。

[民航局航空站簡介](https://www.caa.gov.tw/Article.aspx?a=532&lang=1)包含恆春等派出站；建議機場選單保留恆春並標「尚無軌跡」，不要為了有線而畫推測路線。

## 日本盤點

以 RJ/RO 前綴盤點，manifest 有 78 個機場代碼有軌跡；這是資料庫範圍，並非日本完整民航機場清冊。其中 17 座在 2/18 被現有 fullDates 標記為主力日，仍須逐班驗證完整度。

|機場|ICAO|2/18 軌跡|2/22 軌跡|2/24 軌跡|
|---|---|---:|---:|---:|
|羽田|RJTT|1209|19|19|
|成田|RJAA|588|46|33|
|關西|RJBB|462|30|34|
|伊丹|RJOO|340|—|—|
|福岡|RJFF|446|12|15|
|新千歲|RJCC|351|10|14|
|中部|RJGG|224|7|5|
|那霸|ROAH|373|28|22|
|石垣|ROIG|65|—|—|

## 「完整」需要拆成三件事

1. 查詢完整：指定機場與本地整日時間窗，來源名單查詢成功、分頁完成。已存在航班名單不一定代表整日都掃過。
2. 航班取得完整：以 fr24_id 對照名單、實際可用軌跡、空回應、404、待抓、暫時性錯誤；分母不能用機場間加總。done 記錄不等於有可畫軌跡。
3. 單班幾何完整：可用點數、時間連續性、起降端涵蓋、跳點與日期線切割。來源本身有缺口時，呈現已觀測的線段並標示缺口。

現有 `build-core-airports.ts` 的 fullDates = done>=50 且 done/scheduled>=80%；`split-tracks.ts:265` 再要求實際軌跡>=50。它是主力日篩選，不是完整度證明。小機場每天只有 2–30 班也可能名單全部處理，不應因未滿 50 就排除。

同日 core 索引例：2/24 松山 scheduled/done=136/136，但 manifest 135；臺中 76/76、manifest 75。這些差異需要 ID 層對帳後分類，本次不把差額逕自解釋成某一種錯誤。

本次本地全量掃描 TW-CIVIL 機場檔，以 fr24_id 去重得到 12,232 班、8,141,322 軌跡點：5,064 班存在相鄰點間隔>15分鐘，27 班存在不嚴格遞增時間，1,555 班相鄰經度差>180度；沒有少於2點的航班。這是全部既有日期的初篩，不是所選兩日的驗收；15分鐘為盤點門檻，不代表判定每班失敗。日期線跨越本身也不是錯誤。這些結果表示不可把所有相鄰點無條件連成實線，更不能聲稱每班從起飛到落地都完整。

## 日期與 geometry 契約

現有 `split-tracks.ts:234-242` 以 dep_time（缺值回退首點時間）換算 UTC+8，連日本都一樣。原始 schedule 檔又按 UTC 日期分桶；不能直接按相同檔名 join。

建議新資產按所選機場的當地事件日：出發用 dep_time，抵達用 arr_time；台灣 Asia/Taipei、日本 Asia/Tokyo。取 [當日00:00, 次日00:00)，時間缺失標 unknown，不用首點悄悄冒充實際起飛。航班若當日有起降事件，顯示該航班可得的全程線段，線本身可以延伸到前後日；同機場同日依 fr24_id 去重，保留 arrival/departure 角色。

因此上表只是挑樣本用的既有分檔盤點；重建當地起降日後數字會變，需要讀原始機場檔或足夠前後日資料，不能只載單一 dep-day shard。

原始 path = [lat,lng,alt_m,unix_s]，GeoJSON 要改成 [lng,lat]（2D）；高度與時間另外保留供 metadata/未來3D使用。不得再次把高度由英呎轉公尺。長時間斷點、異常座標、非遞增時間、跨日期線均要有明確拆段規則，MultiLineString 保留同一航班身份；不拿大圓弧補成實測軌跡。

## 首版產品與接線建議

- 同一套資料與 renderer，台灣交通與日本交通各一個入口；若希望只新增一個 toggle，也可用國家 select。避免兩套獨立實作。
- toggle 內依序：機場 select、樣本（工作日／春節假日／其他有資料日）、實際日期、進場／離場／全部、透明度；線寬可加 slider。機場超過3個選項使用原生 select。
- 第一版以單機場載入，預設臺灣桃園、日本羽田。機場定位按本場範圍，另外提供全航程視野，避免長程航班把預設視野拉到全世界。
- 圖例以進場／離場分色；popup 顯示航班、起訖機場、日期時區、觀測起迄、來源與軌跡缺口。資料不齊就顯示「已有 X 班軌跡／部分資料」，未驗收前不用「完整一天」。
- 無資料日期不靜默換日；顯示可選替代日。若使用機場各自不同日期的綜合展示，明示「各機場代表日」，不能稱同一天全台航班。
- 首選 Mapbox 靜態線，不需 Three.js 飛機或全站 timeStore 驅動；所選歷史日期放在該 layer params 中，避免被全站即時時間覆蓋。

接線位置：`src/data/layerManifest.ts`、`src/data/layerParamsSpec.ts`、`src/components/sidebar/layerCatalog.ts`、loader/hook、`src/map/overlayRegistry.ts`、layer host/registry、click/popup/legend。適用 layer-onboarding 的 loadingRegistry 與四項 UX 檢核。

可參考 `src/data/jpAirportsLoader.ts` 的 lazy loading，`src/data/flightTrails.ts` 的斷線處理概念；但其輸入是分號編碼的 RPC rows，不能直接餵 plan-art JSONL。現有 `selectedAirport` 只處理鏡頭，需另建資料篩選語意。新層與既有動態 flights 分開。

## 資產與驗收安排

建議離線轉出 country/airport/date 資產與版本化 catalog，先用壓縮 GeoJSON，實測後才決定是否需要 PMTiles。不可直接下載全球97,511班；2/24 台灣16機場原始 daily JSONL 合計21.75MB，估計gzip合計6.87MB，且含跨機場重複。這不是未來GeoJSON大小；按單場載入與適度簡化後需重測。簡化只變幾何解析度，不改航班集合。

Catalog 至少保存來源、source snapshot、country、airport ICAO/IATA、date、timezone、day_type、date_basis、scheduled_count、usable_track_count、missing/empty/error counts、geometry quality、bytes/hash、資產路徑與授權狀態。完整性未知用 unknown，明確無航班與未取得資料分開。

後續順序：

1. 依下方第二版規劃，先選非連假工作日與週末，再按機場當地起降事件重算，輸出 ID 對帳與品質清單；原列2月日期保留作庫存證據與春節案例。
2. 恆春優先查既有 3/4、4/26 名單；日本週末先查完整機場名單／分頁，再估缺軌跡。只在需要新增抓取時另列 dry-run 與預算，不能套用全球戰役餘額。
3. 通過對帳後轉單機場樣本，做日期線、斷點、大小與可視化檢查。
4. 再接新 layer，跑 tsc -b、必要的 layerConsistency/loader 檢查與 browser 單層驗收。這些尚未執行。

## 發布依賴與證據邊界

FR24 資料不是已確認可自由散布的開放資料。現行[FR24條款](https://www.flightradar24.com/terms-of-service) §2.4、§6.3 對保存與原始資料再散布有條件；本次沒有帳戶個別合約，因此不能認定公開 CDN 下載或永久靜態保存已獲允許。轉成 GeoJSON 不會自動解決這點。研究可完成，發布前需核對實際合約涵蓋的供應方式；未做任何發布。

證據：本地 manifest/core-airports/JSONL、分檔與索引程式、Pulse loader/manifest/hooks 的唯讀盤點；未驗證線上資產、瀏覽器效果、手機效能或 production。既有 dirty files 均保留，本次只新增這份研究文件。


## 第二版規劃：代表日、靜態供應、前端與成本

更新：2026-09-18，依使用者後續方向，主示範改以一般工作日／一般週末；春節留作額外案例。以下是實作規格與驗收目標，尚未實作、建立雲端資源或產生抓取支出。

### A. 選日與機場範圍

先以非連假的同一週工作日和週末為一組，按台灣／日本各自當地日曆排除假日、補假與已知特殊事件；單日樣本僅稱代表日，不稱平均或典型運量。兩國可各選不同一週，但不拿它們作同日國際比較。2/24緊接春節，不再作一般工作日首選。

先在既有名單中評估3月等非連假週，再根據「查詢時間窗是否完整 → 可畫軌跡取得比例 → 小機場涵蓋 → 補抓量」排序。日期清單仍未正式定案，不能因某日只有少量台日互飛資料便說完整。

台灣保留17座民航機場選項，先確保每座至少一個有資料的代表日，再努力補齊工作日／週末。小機場找鄰近週的同類日期；若實際只在某些日飛，保留有資料日及原因，不為滿足雙日期而捏造。恆春先查既有兩筆名單可得性。日本首批以羽田、成田、關西、福岡、新千歲、中部、那霸7座為目標，再擴充其他有足量資料的機場。

零新增抓取預算與一般日期完整度可能無法同時達成。先輸出已存資料可做的範圍及待補航班清單；若要花FR24 credits，另列去重後的dry-run與明確上限，沒有授權不啟動。瀏覽者任何操作均不得觸發補抓。

### B. 資料存放與供應路徑

建議：plan-art保留來源 → 本地離線轉檔／驗證 → R2 Standard 靜態物件 → 既有自訂網域CDN → Pulse loader → Mapbox線層。

- 新層零新增Supabase table、RPC、Edge Function、cron或即時訂閱；失敗不fallback到資料庫。既有站台其他層的資料庫流量不在此保證範圍。
- 優先沿用現有`data.itsmigu.com`資產架構，使用獨立`flight-trails/v1/`命名空間；這是擬議路徑，尚未確認bucket對應、現有快取規則與可用額度。不得覆寫Statistics的current.json或整個bucket設定。
- 不同步全球原始JSONL到Pulse、Git、Zeabur volume或前端bundle。公開資產只含選定日、選定機場及畫線/popup必要欄位。
- 若R2供應方式不符合實際資料合約，發布規格須另調；不把CORS或隱藏下載按鈕當存取控制。

擬議物件結構（相對於上述命名空間，日期僅為格式占位）：

```text
current.json
releases/<release-id>/manifest.json
releases/<release-id>/tw_RCTP_<YYYY-MM-DD>.geojson
releases/<release-id>/jp_RJTT_<YYYY-MM-DD>.geojson
```

每個機場日一檔，進/出場、國內/跨境、航空公司篩選共用此檔，不為每種filter複製檔案。預處理產生FeatureCollection<MultiLineString>，每個flight id一個feature，斷點放多段geometry；同場同日抵達兼出發保留roles陣列。跨機場重複收錄可接受以換取一次請求，未來全台總數再以flight id去重。

採HTTP gzip/br傳輸壓縮，物件/回應Content-Type為application/geo+json，壓縮bytes與Content-Encoding一致，由瀏覽器解碼；不混用既有embed的「.json.gz手動解壓」契約。manifest的bytes/sha256明訂針對解碼後UTF-8原文，另列wire_bytes作成本估計；若預壓縮檔採另一契約，須全鏈一致改動與測試。

先上傳immutable資料並驗hash/headers，再上傳immutable manifest，最後更新current.json。immutable路徑長期快取；current.json短TTL（建議5分鐘）且頁面session固定release，不在使用中混用新版選單與舊版檔案。回滾僅切回已驗收pointer，不刪來源或其他session資產。

### C. 前端載入與畫面

採兩個入口、共用一套loader/hook/renderer：台灣「歷史飛行軌跡」、日本「日本歷史飛行軌跡」。預設皆關閉。展開控制項時才讀輕量catalog；未展開、未開啟時軌跡請求為0，開啟後只載所選單機場單日。

控制順序：機場 → 一般工作日／一般週末／特殊假期／其他代表日 → 明確日期 → 全部／出發／抵達 → 國內／跨境／全部 → 透明度（預設0.85）與線寬。選項由該機場catalog可用資料驅動，無資料的日期保留原因，不悄悄跳日。機場以「桃園 TPE」等友善名稱顯示，ICAO保留搜尋與popup。

- 首次開啟至多current、manifest、選定asset共3個GET；之後切不同機場日只取1個新asset。沒有逐航班HTTP請求。
- 分色、透明度、線寬、方向、國內/跨境filter與popup皆本地執行，0網路請求。平移縮放不重新fetch，重複toggle復用cache。
- 以release+country+airport+date作cache key，用既有`cachedByKey`的in-flight去重；先以最多3份解析資料作LRU目標，另量測Mapbox worker副本與記憶體，必要時改byte-budget。快速切換取消未共享請求或忽略舊回應，不能讓慢回應覆蓋新選擇。
- 檔案loading/error接loadingRegistry。404/驗證失敗顯示錯誤、允許手動重試，不無限重試、不降級成空白成功。
- Mapbox source只在切換asset時setData；樣式/filter使用Mapbox樣式API。關閉層停止該層活動並釋放source/GPU資料，cache保留受限數量。全站時間軸不改變此層歷史日期；不建立每幀動畫循環。
- 摘要顯示「2026-xx-xx・當地時間・已收錄X班」和覆蓋狀態。顯示班數依flight id去重，不把MultiLineString段數當航班數。完整來源查詢且逐班對帳後才可稱「來源名單全數取得」，仍不代表世界上所有航班或每條軌跡無缺口。
- 用本場位置定位，另提供「看全航程」。靜態2D線先行；3D與移動飛機列後續，避免本期增加GPU負荷與LOD下載。

### D. 標籤、分類與資料語意

Sidebar具體位置：台灣放「交通 Move → 歷史軌跡」（新增小群組），避免放進現有「即時運具」；日本放既有「交通 → 線」。manifest topics標記歷史、靜態、航空及地區。`src/lib/layerSearch.ts`已索引label/description/topics/aliases，沿用即可；個別航班搜尋如需提供，只搜尋已載入的機場日資料，不擴充成全庫遠端查詢。


|用途|首版內容|來源與限制|
|---|---|---|
|圖層搜尋|航空、機場、航班、航跡、飛行軌跡、歷史、靜態、台灣/日本、flight、trajectory|寫入專案既有搜尋metadata，不另建搜尋服務|
|樣本標籤|一般工作日、一般週末、特殊假期、其他代表日|地區日曆+選日註記；春節不可只標一般週末|
|空間標籤|國家、機場、城市/地區、離島（有可靠機場分類時）|正式機場對照表；RJ/RO/RC前綴不作所有業務分類的唯一依據|
|方向|出發、抵達、同日兩者|相對於所選機場的事件角色；不依線的朝向猜|
|航程篩選|國內、跨境、未分類|按起訖機場國別；兩岸/港澳如需另分，用明確地區欄位，不用國籍推論|
|航空公司|operating_as代碼及有依據的顯示名稱|painted_as只作塗裝公司，不能替代營運者；未知保留未提供|
|機型|來源aircraft_type代碼|首版popup；噴射/螺旋槳等須可靠lookup才可分組|
|資料狀態|部分資料、來源名單全數取得、尚無軌跡、載入失敗|查詢完整度、名單/軌跡對帳與runtime各自記錄|
|軌跡品質|有觀測缺口、時間異常、簡化展示|前處理結果；不把簡化線說成原始逐點完整資料|

首版不從callsign/registration/aircraft_type猜「軍用、貨運、客運、廉航、包機、延誤」。航班號、航空公司、機型、起訖機場、當地起降時間、觀測起迄、資料來源放popup；缺值寫「未提供」。不載入機身照片或航空公司遠端圖片，避免額外請求與權利依賴。

Catalog欄位分離：`sample_kind`（選日性質）、`query_coverage`（查詢完成度）、`track_coverage`（可用軌跡與名單對帳）、`geometry_quality`（觀測線品質）、`runtime_status`（前端本地狀態）。不能一個FULL/PARTIAL欄位包辦所有意思。未驗證的分母為null，不算100%。

### E. 資料庫與費用控制

|項目|設計結果|仍需確認|
|---|---|---|
|Supabase計算/儲存/egress|本新層新增用量0，不落表、不RPC|browser network證據；全站其他層維持既有用量|
|FR24瀏覽成本|0，前端不打API|一般代表日補抓可能一次性用credits，需另估授權|
|常駐後端/Worker/排程|不新增|沿用既有網域、直接R2 custom domain路由是否可用|
|R2|少量靜態檔與cache miss讀取|全帳戶剩餘免費額度、實際GET、物件bytes|
|Mapbox|沿用既有Map實例畫本地GeoJSON，不新增第二個Map或付費查詢API|既有底圖與地圖載入費照常，不宣稱整站免費|
|本地轉檔|一次性CPU/磁碟，手動更新|產物大小與轉檔耗時，無雲端重算工作|

2026-09-18核對[R2官方價格](https://developers.cloudflare.com/r2/pricing/)：Standard免費額度每月10GB-month、100萬Class A、1,000萬Class B；超額單價分別$0.015/GB-month、$4.50/百萬A、$0.36/百萬B，Internet egress免收。額度是帳戶共享，計費有單位進位；未查帳戶餘額，不承諾新增費用一定為0。使用Standard，不為節省極小儲存改Infrequent Access。

容量/流量規劃例（假設，非實测）：17座台灣+7座日本×2日=最多48份asset；每份壓縮2MB，單版本約96MB，兩版192MB，加manifest後初版目標<250MB。每月1萬次新session、每次看3個不同機場日，最多約5萬GET（pointer+manifest+3asset，未扣任何cache），傳輸約60GB；以此模型且帳戶剩餘免費額度足夠，R2可無新增費用。缺日期的機場不輸出假空資料以湊48檔，額外代表日另計。

[R2快取官方說明](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)要求custom domain；JSON/GeoJSON需確認Cache Rule實際命中，不能只設Cache-Control就推定edge已有cache。不使用r2.dev作正式供應；不加入付費Worker代理、分析pipeline或per-request日誌儲存。只在既有平台看usage/快取命中率，本次不建立監控排程。

成本限制落地：只發布manifest列出的檔案；不全bucket sync、不重傳原始全球庫存、不自動擴充日期。單一asset目標壓縮<=2MB、解碼原文<=8MB、<=10萬頂點，catalog<=100KB，均是待樣本驗證的預算。超標先做保留航班集合的幾何簡化，再量測；不能為過門檻刪航班。仍超標才評估分片/PMTiles，不能偷偷擴張請求量。公開檔案的請求量無法靠UI做硬上限；若要求帳單絕不增加，需先確認帳戶側限制或維持本地展示。

### F. 交付順序與驗收

1. 選日報表：逐機場日的查詢時間窗、scheduled/usable/missing/unknown、資料品質、預估補抓量，分開提供「零新增抓取」與「補齊一般日」範圍。
2. 單機場試產：繁忙場（桃園/羽田）與小場（望安），驗geometry與資料量，再定最終檔案預算；不要求小場滿50班。
3. 前端：兩個入口共用實作，日期/方向/分類/圖例/popup/loading完整；既有動態flights及其他parallel edits不改語意。
4. 必要檢查：日期跨午夜、TW/JST、同航班雙角色去重、missing不變0、日期線/斷點、壓縮/hash一致、快速切換競態、manifest/layerConsistency與tsc -b。
5. Browser：關閉時0軌跡請求；首次3GET內；同檔filter/popup/平移縮放0新增資料請求；切換1GET內；新層不新增Supabase/FR24/Worker請求。手機視窗驗可用性，效能數據另量測，不把桌面browser當真機證明。
6. 發布才核對實際合約與雲端帳戶額度，確認指定bucket/prefix、headers/CORS/cache和immutable readback；本次不執行上傳、設定或部署。


## 2026-09-18 實作更新

使用者確認精細度優先；先前小檔案預算不作為抽稀理由。已離線產生原始解析度2D藍白航跡與台日機場／日期選項，詳見 ../features/historical-flight-trails/acceptance.md。一般日資料不足仍明確保留，不自動改用春節當作一般日。
