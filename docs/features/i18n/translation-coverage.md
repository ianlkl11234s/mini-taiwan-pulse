# 圖層／主題名稱翻譯覆蓋率

> 全部為**機器草稿翻譯**（Claude 產出），未經母語者校稿。盤點腳本：`npx vite-node scripts/i18n/export-layer-names.ts [輸出路徑]`。

## 數量

| 項目 | 數量 |
|---|---|
| 有 section 的圖層總數 | 1072 |
| en：沿用 manifest alt（拉丁字母） | 74 |
| en：`en/layers.json` 補譯／覆蓋 | 998 |
| ja：沿用 manifest alt（日文／含漢字） | 53 |
| ja：`ja/layers.json` 補譯 | 1019 |
| 主題＋子群字串（distinct） | 277 |
| `en/themes.json`（僅無英文半段者） | 193 |
| `ja/themes.json`（全部） | 277 |

驗證：en 皆解析為非中文主名、ja 皆有條目或日文 alt（0 缺）；`npx vitest run src/i18n` 通過。

## 不確定、建議校稿

1. 土地使用「占…同類比」：en "Share of National Total"、ja「全臺同種比」（或「全臺構成比」較自然）
2. `statsComparison*NursingHome／CareWorker`：「人口比較」基準依 key 推定（每千名 65 歲以上）
3. `statsComparisonHousingOccasionalSharePct*`「偶爾自住」：譯為 Occasionally Used Dwellings
4. `weakSoil*` 六筆：中文同名，依 key 補深度（0–5／5–10／10–20 m），單位為推測
5. `satellitesTJS`：ja「静止軌道情報衛星」為意譯
6. `plaActivity`「共機」：ja「中国軍機」
7. `coastGuardStation`：ja「海巡（海岸巡防）」
8. `statsComplaintCasesPndCounty` 陳情件數 vs 案件數：英文難區分
9. `statsLaborCountyEmploymentByIndustry`：Employed Persons by Industry
10. `jpMarineEbsaCoastal`：EBSA 已展開
11. `iPostBoxes`：ja 括號說明為自加
12. 民國年份主題／圖層：en 換成西元，ja 保留民国（如 115 年 1–8 月 → Jan–Aug 2026）
13. 「投放點」「整體公司」「樞紐節點」等主題字串
14. 期末營業里程（bus）：Operating Route Length at Period End

## English

**狀態：proofread x2 (Claude)**（2026-10-12）。不是英文母語者校稿。範圍：`en/layers.json`、`en/themes.json`、`en/common.json`。
第 1 輪逐筆對照中文原名，修正 499 筆（layers 452、themes 44、common 3）。第 2 輪從頭重讀，再修 9 筆（用語統一、大小寫）。
另外 2 層的 manifest 英文 alt 太短看不懂，在 `en/layers.json` 補條目覆蓋（manifest 未改）：`fireLatest`「Latest」→ Fires (Latest Year)、`wasteStopsStatic`「Stops」→ Garbage Collection Stops (Static)。

**第 3 輪：manifest 英文 alt 稽核**（2026-10-12）。alt 原本是中文旁的副標，英文介面變成主名後很多看不懂（例：濱海掩埋場「Coastal」、充電站最近距離「EV Island」）。逐筆檢查 426 個 alt，352 筆在 `en/layers.json` 補覆蓋（manifest 未改），74 筆原 alt 夠清楚、保留。覆蓋後再快速重讀一輪，修 11 筆。覆蓋原則：補上主體名詞（Coastal → Coastal Landfills）、展開縮寫（ER → Emergency Room Crowding）、點位類用複數、衛星類加國家（IGS / ALOS → Japan Satellites (IGS / ALOS)）、最近距離類寫 Distance to Nearest …；qualifier（台電、氣象署、10m 等）已由 `en/qualifiers.json` 顯示，名稱不重複。

**說明框（P1）**（2026-10-12）：範圍加 `en/popup.json`、`en/popup.transport.json`、`en/enums.json`、`en/popupHeaders.json`（94 個標題）；校對兩輪（對照 zh-TW 原檔、從頭重讀），欄位名依 `field="…"` 實際用法選詞。

**大小寫**：圖層名、主題名用 Title Case（和 manifest 既有 426 個英文 alt、主題「中文 English」的英文半段一致，混用會更亂）；`common.json` 介面字用 sentence case。

### 用語表（全部條目統一套用）

| 中文 | 英文 | 備註 |
|---|---|---|
| 縣市／鄉鎮市區（鄉鎮）／村里 | County/City／Township/District／Village | |
| 每萬人口／每萬名居民 | per 10,000 People | 原本 per 10k Population、per 10k Residents 混用 |
| 每 10 萬人／每平方公里 | per 100,000 People／per km² | 放名稱後面，不加括號 |
| 人口比較（護理之家、照服員） | per 1,000 People Aged 65+／per 1,000 Births | 依 key `Per65plus1000`、`PerBirths1000` |
| 占全臺同類比／占所屬縣市同類比 | Share of National Total／Share of County/City Total | |
| 占縣市（鄉鎮）行政面積／相對集中度 LQ | Share of County/City Area／Location Quotient (LQ) | |
| ○○用地面積 | ○○ Land Area；比較類寫「○○ Land: 指標」 | 15 種用地統一（例：Paddy Field Land） |
| 民國年 | 西元（ROC＋1911） | 110→2021、114→2025、115→2026；累計寫 (Jan–Aug 2026, Cumulative) |
| 畜禽 | Livestock and Poultry | |
| 機構或學校／學生或幼生 | Schools or Institutions／Students or Preschoolers | |
| 期末營業里程／期末營業車輛／營業行車次數 | Bus Route Length in Operation (End of Period)／Buses in Operation (End of Period)／Bus Trips Operated | 加 Bus，比較組沒有市區客運子群可看 |
| 汽車／機車 | Car／Motorcycle | 原本 Car、Automobile 混用 |
| A1／A2 事故 | A1／A2 Traffic Accidents | |
| 護理師／西醫師 | Registered Nurses／Physicians (Western Medicine) | |
| 產後護理之家 | Postpartum Care Center | 原本 Nursing Home、Care Center 混用 |
| 有人／無人經常居住、偶爾自住、自住以外用途、目前沒有使用 | Usually Occupied／Usually Unoccupied／Occasionally Owner-Occupied／Used for Other Purposes／Vacant Housing | |
| 已設戶籍外來人口（原屬…） | Registered Residents of Foreign Origin (Originally from …) | 主題名同步 |
| 第一級／第二級毒品 | Category 1／Category 2 Drugs | 毒品危害防制條例官方英譯 |
| 地檢署…新收人數 | New … Defendants at District Prosecutors' Offices | 轄區已由 qualifier 顯示，名稱不重複 |
| 據點數 | Sites | 主題「服務據點」→ Service Sites |
| 綜合所得 | Consolidated Income | 財政部用語 |
| 責任業者 | Responsible Enterprises | 環境部用語，主題同步 |
| 中捷 | Taichung MRT | 原主題誤譯為 Central Taichung MRT |
| 共機（manifest alt） | PLA | 既有 alt「PLA Activity」中性，未動 |
| 即時 | Real-Time（主題）；工具列模式維持 Live | |
| and／& | 圖層名用 and，主題名用 & | |
| 說明框標題（popupHeaders） | Title Case、複數（Fire Stations） | 和借用圖層名的標題一致；單一物件的標記（Map Marker、Analysis Result）用單數 |
| 鄉鎮（欄位） | Township/District | 欄位用 sentence case |
| 縣市區（欄位，值是「縣市 鄉鎮」） | Administrative area | |
| 營運單位／營運者 | Operating entity／Operator | 兩個 key 不同字 |
| 統一編號 | Unified Business No. | |
| 資本額 | Registered capital | |
| 注意（資料但書） | Caveat | 備註 = Remarks |
| 更新（值是更新頻率） | Update frequency | |
| 距現在 | Age | 值是「3 分鐘前」 |
| 測項／測項明細 | Parameter／Parameter details | 環境監測用語 |
| 胸徑 | Trunk diameter (DBH) | |
| 資料角色 | Data type | |
| 署屬有人站／署屬無人站／自動雨量站／農業站 | Staffed／Unstaffed CWA station／Automatic rain gauge station／Agrometeorological station | |
| 臺鐵／高鐵／北捷／高捷／高雄輕軌／中捷 | Taiwan Railway／Taiwan High Speed Rail／Taipei Metro／Kaohsiung MRT／Kaohsiung Light Rail／Taichung MRT | 和既有圖層名一致（Taiwan Railway (TRA) Stations） |
| 核安觀測站 | Radiation Monitoring Stations | 不是核電廠 |
| 國道／省道 | National Freeways／Provincial Highways | |
| 清潔隊 | Sanitation Squad | |
| i郵箱 | i-Post Parcel Lockers | 中華郵政品牌，英文名待確認 |

### 原清單的處理結果（英文）

| 項目 | 處理 |
|---|---|
| 1 占…同類比 | 保留 Share of National Total，分隔改冒號、縮短（例：Airport Land: Township/District Share of National Total） |
| 2 人口比較基準 | 依 key 確認，寫進名稱 |
| 3 偶爾自住 | 改 Occasionally Owner-Occupied Housing（普查「無人經常居住住宅」的子類，屋主偶爾回來住） |
| 4 `weakSoil*` | 深度已由 qualifier 顯示，主名拿掉深度：Weak-Layer Clay／Sand |
| 5 `satellitesTJS` | TJS / TJSW GEO Intelligence Satellites |
| 8 陳情件數 vs 案件數 | 查 `environmentStatisticsRecipes.catalog.json`：PND 層來自「公害陳情件數及人口數陳情頻率分析」表 → Pollution Complaint Cases (Frequency Table) |
| 9 就業者之行業 | 保留 Employed Persons by Industry |
| 10 EBSA | 縮為 Coastal Ecologically or Biologically Significant Areas |
| 12 民國年 | 逐筆驗算無誤；主題「民航各機場所在地活動（115 年 7 月）」→ July 2026 |
| 13 投放點／整體公司／樞紐節點 | 依所屬圖層：Collection Points／All Companies／Hubs |
| 14 期末營業里程 | Bus Route Length in Operation (End of Period) |

### 仍不確定（英文）

1. 縣市／鄉鎮市區／地檢署轄區／進行中等 qualifier 在英文介面仍顯示中文（`layerText.ts` 不翻 qualifier），不在本次範圍。
2. `statsComplaintsCounty` 與 PND 層：repo 只說兩者 110 年高雄差 1 件、建議只上架一層，實際差異來源不明；英文名只先區分開。
3. 長名稱（例：Registered Residents of Foreign Origin (Originally Nationals without Household Registration)）在側欄會很長，已盡量縮短，仍待決策 #4（截斷或換行）。

### P1 說明框新增用語（2026-10-12，兩輪校對）

| 中文 | 英文 | 備註 |
|---|---|---|
| 政府資料開放授權條款第1版 | Open Government Data License, version 1.0 | 官方英文名 |
| 統編 | Unified Business No. | |
| 資本額 | Registered capital | |
| 測項 | Parameter | 環境監測 |
| 資料逾時 | Data stale | |
| 震度／最大震度 | Seismic intensity／Maximum seismic intensity | 閃電強度另用 Intensity |
| 噴火警戒 | Volcanic alert level | 氣象廳用語 |
| 地檢署／檢察署 | (District/High/Supreme) Prosecutors' Office | 與 layers.json 一致 |
| 急診順暢／略壅／壅塞 | Normal／Slightly crowded／Crowded | |
| 過水路 | Low-water crossing | 原譯 Causeway 有誤 |
| 環保列管 | Environmentally regulated | 不寫 EPA（已改制） |
| 仍列管／已解除列管 | Still listed／Delisted | |
| 上市櫃 | Listed (TWSE/TPEx) | |
| 更生保護會 | After-Care Association | |
| 觀光工廠 | Tourism factory | |
| 綜合體育館 | Multi-purpose sports hall | |
| 小型車費率 | Small vehicle rate | 國道收費 |
| 貨幣 | NT${value} | |
| 民國年 | 由程式換算西元（`displayRocYear`） | 翻譯檔不做算術 |
| 拼字 | 一律美式（color、center、gray、meter、license） | |

### P1 仍不確定（英文）

1. 田媽媽 → Tian Mama (rural women's food business)、地方文化館 → Local cultural museum、國民運動中心 → Civil sports centers：未查到官方英文。
2. 長照 A／B／C 據點、公廁評等（特優／優等／普通／不合格）：非官方英譯。
3. 兩個公害陳情圖層的差異 repo 內查不到，英文名只是先區分。
4. 警戒通報原文「AEC／原能會」已於 2026-10-12 依使用者決定，中英日三語一起改成新名稱「核安會／Nuclear Safety Commission／原子力安全委員会」。

### P2 設定面板新增用語（2026-10-12，兩輪校對）
- 漁電共生＝Fishery-solar co-location；淡江大橋＝Danjiang；肉羊／乳羊的「羊」一律 goat。
- 梅＝Japanese apricot (mei)（避免與「李」Plum 混淆）。
- 行業別同名中類（45／46 批發業、47／48 零售業）只靠代碼區分，不自加 (other)。
- 統計：資料期別＝Data period、地理層級＝Geographic level、口徑＝Basis。

### P2 仍不確定（英文）
- 作物代碼 `bigatem`、`marush` 中文原文就是佔位代碼，保留代碼；梨瓜＝chayote、鐘麻＝Kenaf、亞麻(甘蔗) 依代碼推測。
- 台北河濱公園名多為拼音，未查官方英文名。

### P2 圖例新增用語（2026-10-12，兩輪校對）
- 急診壅塞＝Normal／Slightly crowded／Crowded／Severe；弱層＝Weak-layer；移民署＝Immigration Agency。
- 毒品危害防制中心＝Drug abuse prevention center；限電警戒＝Power rationing alert；冷門／幹線（接駁）＝Low-use／Main route。
- 內政部實價登錄＝Ministry of the Interior actual price registration；億 m³＝× 10⁸ m³；萬元＝NT$10k。
- 仍不確定：智財商業法院、少家法院、海巡海洋分署英文名；日本噴火警戒レベル 1–5 為直譯（JMA 官方英文另有說法）。

### P2b 統計新增用語（2026-10-15，兩輪校對）
- 地檢署轄區＝District Prosecutors' Office jurisdiction；第一級／第二級統計區＝Level-1／Level-2 statistical area；戶籍人口＝registered population。
- 工商普查＝Industry and Commerce Census；營業稅＝Business Tax；電子發票＝E-Invoice；原住民保留地＝Indigenous Reserved Land；擱淺＝Stranded；社會脆弱度＝Social Vulnerability；人次＝person-times；中央管＝Centrally Managed。
- 仍不確定：「培根」計畫（Pei-Ken Training）、溪流次（stream alerts）。
- atlas：閘門＝Sluice gate；疏散門＝Evacuation gate；系統交流道＝System interchange；賽德克＝Sediq；拉阿魯哇＝Hla'alua；高速公路局＝Taiwan Area National Freeway Bureau；保全戶＝households at risk（意譯）。

### P3 進階模式新增用語（2026-10-15，兩輪校對）
- 基準低段／中段＝Low range／Mid range；平時／留意／警戒／緊急＝Peacetime／Notice／Alert／Emergency；地理相關 0／1＝Unrelated／Mentioned；中央社＝CNA；越中線＝median-line crossings；超齡服役＝Past design life。
- 「平常週日同時段」原意（平日或同星期幾）未確認，譯成不指明星期的 vs usual at this time。

### P4 AI 介面新增用語（2026-10-15，兩輪校對）
- 分析倉庫＝analysis warehouse；跟隨 Agent 視角＝Follow Agent view；分析依據與來源＝Basis and sources；發布連結＝Publish link；Agent 金鑰＝Agent key。
- 缺資料（狀態）＝Missing data，無資料／未涵蓋＝No data／Not covered；分位數分級＝Quantile classes，等距分級＝Equal-interval classes。

### P2b 統計選單英文校對（2026-10-16，兩輪）
- 範圍 `en/enums.statVariant.json`（190 筆）、`en/statisticsSelect.json` 模板；下拉選單用 sentence case（專名如 Indigenous 例外）。
- 第 1 輪（32 筆）：每萬名居民＝per 10,000 people（模板改成 `{base} per 10,000 people`、`{base} per km²`，不加括號）；鄉鎮＝Township/District；第一／二級毒品＝Category 1／2；登錄數＝Registrations；筆數類＝records；乳癌／子宮頸癌／大腸癌（篩檢率選項）加 screening；原住民＝Indigenous（大寫）；參與人次＝Participants (person-times)；A2 事故＝A2 traffic accidents；期末營業車輛／里程＝Operating buses／Operating bus route length at period end；占…同類比＝Share of national total／Share of county/city total（層級前綴已顯示，不重複）；占縣市行政面積＝Share of county/city area；相對集中度 LQ＝Location quotient (LQ)；偶爾自住／無人經常居住／其他使用占總住宅比＝Occasionally owner-occupied／Usually unoccupied／Other-use share of all dwellings。
- 第 2 輪（17 筆，風格與長度）：淨遷徙人數（社會增加數）＝Net migration（避免與累計期別括號相疊）；已設戶籍外來人口＝Foreign-origin registered residents／Foreign-origin residents (from …)；加護＝ICU；○○占營業車比＝Operating buses 句型；縮短過長句。
- 仍不確定：原始數維持 Raw count（`statistics.json` 已用 raw count）；西醫師只寫 Physicians（未帶 Western medicine）；崩塌筆數＝Landslide records（單位「筆」＝records，是否指多邊形數未確認）；「原屬臺灣地區無戶籍國民」縮成 Taiwan-area, unregistered；土地用途細項組合仍可達約 80 字元（前綴＋用地＋比較項）。
### P5 地名、機關、授權（2026-10-16，兩輪校對）
- 縣市／鄉鎮市區：內政部羅馬拼音（Taipei City、Banqiao District、Hsinchu County）；英文連寫為「Zhongzheng District, Taipei City」。表由 `scripts/i18n/gen-place-names.ts` 產生，頭份、員林已升格為市（Toufen City、Yuanlin City），三民區（64000050）CSV 沒有，補 Sanmin District。
- 機關：官方英文名（DGBAS、Ministry of the Interior…）；署／司寫在部名之前加逗號（Water Resources Agency, Ministry of Economic Affairs）。
- 授權：歸 6 類——Open Government Data License, Version 1.0 (Taiwan OGDL)／CC BY 4.0 (Attribution)／CC BY-SA／Open Database License (ODbL) 1.0／Not specified／Unverified；帶註記的長句原樣或整句查表。

## 日本語

**狀態：proofread x2 (Claude)**（2026-10-12）。不是日文母語者校稿。範圍：`ja/layers.json`、`ja/themes.json`、`ja/common.json`；P1 popup：`ja/popupHeaders.json`（新建 94 筆）、`ja/popup.json`、`ja/popup.transport.json`、`ja/enums.json`（校對 2 輪，改 9 筆）。
第 1 輪逐筆對照中文原名，修正 352 筆（layers 306、themes 42、common 4）。第 2 輪從頭重讀，再修 29 筆，主要是用語統一和第 1 輪留下的問題。

### 用語表（全部條目統一套用）

| 中文 | 日文 | 備註 |
|---|---|---|
| 縣市／鄉鎮市區／村里 | 県市／郷鎮市区／村里 | 「臺」一律寫「台」 |
| 占全臺同類比／占所屬縣市同類比 | 全台シェア／県市内シェア | 原本是「全臺同種比」 |
| 相對集中度 LQ | 特化係数（LQ） | 日本統計標準用語 |
| 每萬人／每 10 萬人／每平方公里 | （人口1万人あたり）／（人口10万人あたり）／（1km²あたり） | 統一用全形括號放在名稱後面 |
| 民國年 | 西元年（ROC＋1911） | 114→2025、115→2026、110→2021 |
| 公車／市區客運／公路客運 | バス／市内バス／都市間バス | |
| 捷運／中捷 | MRT／台中MRT | |
| 機車 | 二輪車 | 統計、登記類用語，全檔統一 |
| 營業里程 | 営業キロ | |
| 戶籍人口／戶量 | 戸籍人口／平均世帯人員 | |
| 原住民 | 原住民 | 依台灣官方自稱，不用「先住民」 |
| 已設戶籍外來人口（原屬大陸地區） | 戸籍取得済み外来人口（元中国大陸籍） | |
| 地檢署 | 地方検察署 | |
| 公害陳情 | 公害苦情 | 日本官方用語 |
| 罰鍰／稽查 | 過料／立入検査 | |
| 一般護理之家／產後護理之家／照顧服務員 | 一般ナーシングホーム／産後ケアセンター／介護職員 | 開放床數＝開設床数 |
| 長照 | 長期介護 | |
| 水土保持 | 水土保全 | |
| 廚餘 | 生ごみ | |
| 測站 | 測定局（空品、噪音）／観測所（氣象、水文） | |
| 土地使用分區 | 用途地域 | |
| 預售 | 予約販売 | |
| 歷史（資料、軌跡） | 過去の… | 不用「歴史的」 |
| 點位／線／面 | ポイント／ライン／ポリゴン | 子群標題 |
| 共機 | 中国軍用機 | 依日文媒體慣用寫法，選比「中国軍機」中性的完整說法 |
| 站號（popup 通用欄位） | 地点番号 | 同一欄位跨空品、水文、氣象，用中性說法 |
| 層級（醫院層級、警察層級） | 区分 | |
| 路段 | 道路区間 | |
| 車柱數 | ラック数 | 公共自行車 |
| 已停用／運作中 | 運用停止／稼働中 | 「廃止」語氣太重 |
| 未命名站點 | 名称不明 | 氣象站、公車站共用，不用「駅」 |
| 開放時間／營業時間 | 利用時間／営業時間 | |
| 統一編號 | 統一編号 | 台灣事業者編號，保留原名 |
| 台鐵／高鐵／台北捷運 | 台湾鉄道／台湾高速鉄道／台北メトロ | 高雄MRT、高雄ライトレール、台中MRT |
| 署屬有人站／無人站 | 有人／無人気象観測所（気象署） | |
| 等時圈 | 等時間圏 | |
| 事件（全球重要事件） | 出来事 | 日文「事件」偏犯罪、意外 |

### 原清單的處理結果（日文）

| 項目 | 處理 |
|---|---|
| 1 占…同類比 | 改「全台シェア」「県市内シェア」 |
| 2 護理之家、照服員的人口比較 | 依 key（`Per65plus1000`、`PerBirths1000`）確認基準是「65 歲以上每千人」與「每千名出生」，已寫進名稱 |
| 4 `weakSoil*` | 深度已由 qualifier 顯示，日文主名拿掉深度，改「軟弱層（粘土）／（砂質土）」 |
| 5 `satellitesTJS` | 改「静止軌道情報収集衛星」（日文既有的「情報収集衛星」用語） |
| 6 `plaActivity` | 「中国軍用機の活動エリア」 |
| 7 `coastGuardStation` | 「海巡署（沿岸警備）」 |
| 11 `iPostBoxes` | 保留括號說明，改「i郵箱（宅配ロッカー）」，日本讀者看不懂原名 |
| 12 民國年 | 改西元，和 en 一致 |
| 13 投放點／整體公司／樞紐節點 | 依所屬圖層確認意思：排出場所／企業全体／交通拠点 |
| 14 期末營業里程 | 期末営業キロ |

### 仍不確定

1. `statsComplaintsCounty`（公害苦情件数）和 `statsComplaintCasesPndCounty`（公害苦情受付件数）：兩者 indicator 都是 `complaint_cases`，但來自不同資料集，repo 裡沒有說明差在哪。日文名稱只是先把兩者區分開。
2. 偶爾自住住宅譯為「時々自己使用する住宅」：日本住宅統計沒有完全對應的分類，這是直譯。
3. `wasteSchedule*` 的「音符」：直譯成「音符」。是否該改成「メロディ」（垃圾車音樂），要看畫面上實際的圖示。
4. 地名、機關名（航港局、廉政署、海巡署、国家風景区、台湾好行、田媽媽）保留中文專有名詞，日本讀者可能需要說明。
5. 縣市／鄉鎮類的 qualifier 目前以中文顯示（`layerText.ts` 不翻 qualifier），不在本次範圍。
6. popup `popup.field.stationNo` 跨測定局與観測所共用，改中性的「地点番号」；`nuclearStation` 面板顯示即時輻射劑量，已定為「放射線監視局」（與英文 Radiation Monitoring Stations 一致）。

### P1 說明框新增用語（2026-10-12，兩輪校對）

| 中文 | 日文 | 備註 |
|---|---|---|
| 元／萬元 | {value} 台湾ドル／万台湾ドル | |
| 公頃 | {value} ha | |
| 站名（共用） | ステーション名 | 充電站、加油站、輻射站共用 |
| 站況（共用） | 稼働状況 | |
| 測站（共用 field.station） | 地点 | |
| 網格尺度 | グリッドサイズ | 日本地域網格例外用メッシュ |
| 限制 | 制約 | |
| 失效（橋梁） | 機能停止 | 「崩落」太重 |
| 已除役 | 運転終了 | |
| 機組 | 発電ユニット | |
| 船長（長度） | 全長 | |
| 暴露人口 | 曝露人口 | |
| 上市櫃 | 上場・店頭登録 | |
| 公立／私立（殯葬） | 公営／民営 | |
| 保全住戶 | 保全対象世帯 | |
| 內池／外池水位 | 内水位／外水位 | |
| 過水路 | 洗い越し | |
| 機場管制空域 CTR | 管制圏 | |
| 測站氣壓 | 現地気圧 | |
| 歷史版 | 過去データ | |
| 人次 | 延べ{count}人 | |
| 護理機構床數 | 床数 | 「病床」只用於醫院 |
| 巷弄長照站 | 近隣ケアステーション | |
| 來源 | 出典 | 不用「ソース」 |
| 共機架次 | 中国軍用機の延べ機数 | |
| 紫外線等級 | 弱い／中程度／強い／非常に強い／極端に強い | 氣象廳用語 |
| 罰鍰分層 | 重大処分／高額の一般処分／一般処分／移動発生源汚染 | noise 與 pollution 共用 |

### P1 仍不確定（日文）

1. 水質站維持「観測所」，但日本公共水域慣用「測定地点」，與日本資料層不一致。
2. 「台塑石化スタンド」「台湾糖業スタンド」、OSM 道路等級「二次道路」「連絡道路」為直譯。
3. 「長期介護2.0」「海巡署」保留原名，日本讀者可能不懂。
4. 「大規模崩壊潜在区域」無日本官方對應用語；「試験 Shiyan」假設代碼對應「試驗」系列衛星。
5. 數字與單位之間是否空格（{n}社 vs {value} 社）各檔未統一。

### P2 設定面板新增用語（2026-10-12，兩輪校對）
- 嚴重度＝深刻度；肉羊／乳羊＝肉用ヤギ／乳用ヤギ；民眾洽公場所＝行政窓口施設；針具＝注射器具。
- 河濱公園＝河川敷公園（各公園名保留中文）；環保葬＝環境配慮型埋葬地；橄欖＝カンラン（橄欖）。
- 統計：資料期別＝データ期間、地理層級＝地理階層、口徑＝集計基準。

### P2 仍不確定（日文）
- 作物代碼 `bigatem`、`marush` 保留代碼；45／46、47／48 同名行業只靠代碼區分。

### P2 圖例新增用語（2026-10-12，兩輪校對）
- 檢察署＝検察署；罰鍰＝過料；公路客運站＝都市間バス停；風場＝風況；軟弱層（砂質土）＝軟弱砂質土層。
- 毒品危害防制中心＝薬物乱用防止センター；電光黃／藍＝蛍光イエロー／ブルー；捷運＝MRT。
- 仍不確定：樹種和名（コバノモモタマナ等）、雨量分級沿用漢字、OSM 道路等級直譯、公設民営、区間速度取締。

### P2b 統計新增用語（2026-10-15，兩輪校對）
- 「あたり」一律假名（不用「当たり」）；每萬人＝人口1万人あたり；km²＝1km²あたり。
- 地檢署轄區＝地方検察署の管轄区；陳情＝苦情；一般護理之家＝一般ナーシングホーム；產後護理之家＝産後ケアセンター；長照 2.0 C 據點＝長期介護2.0（C拠点）。
- 色階＝段階色；不適用＝該当なし；醫事人員＝医療従事者；山坡地＝斜面地；工商普查＝工商業センサス；擱淺＝ストランディング。
- 仍不確定：圖例說明的文體（常體）與其他檔（です・ます）未統一；營業稅日文譯法。
- atlas：閘門＝樋門；系統交流道＝ジャンクション；快速公路＝高規格道路；拉阿魯哇＝ラアルア；保全戶＝保全対象世帯；疏散門＝避難用ゲート（「陸閘」或更貼切，未定）。

### P3 進階模式新增用語（2026-10-15，兩輪校對）
- 共機＝中国軍用機；架次＝機数；越中線＝中間線越え；等床＝入院待ち；即時＝リアルタイム、直播＝ライブ；事件（新聞）＝出来事；壓力指數＝圧力指数；備轉＝予備力；輻射監測站＝監視局；已下架＝提供終了；顯著（最高級距）＝非常に高い；遙測偵察＝リモートセンシング偵察。
- 仍不確定：「平常週日同時段」譯成不指明曜日的「通常の同時間帯」；電視台名沿用中文名＋ニュース。

### P4 AI 介面新增用語（2026-10-15，兩輪校對）
- 缺資料（狀態）＝欠損，無資料＝データなし；分位數分級＝分位数区分，等距分級＝等間隔区分；研究連線＝リサーチ接続；面板與狀態標題體言止め。

### 統計選單（enums.statVariant）新增用語（2026-10-16，兩輪校對）
- 原住民＝原住民（不用「先住民」，與 params／layers 一致）；鄉鎮＝郷鎮市区；已設戶籍外來人口（原屬 X）＝戸籍取得済み外来人口（元 X籍）；淨遷徙人數＝純移動数（社会増加数）。
- 開放床數＝開設床数（護理機構不加「病」：開設看護床数、開設新生児床数）；陳情＝苦情；列管＝管理対象；罰鍰÷稽查＝過料÷立入検査；暴露量構面＝曝露量。
- 機車＝二輪車（登記＝登録二輪車数、駕照＝二輪車運転免許保有者数）；期末營業里程＝期末営業キロ；營業行車里程＝営業走行キロ；電動車輛＝電気バス車両数；占營業車比＝営業車両に占める割合。
- 占全臺同類比／占所屬縣市同類比＝全台シェア／県市内シェア；公頃＝ha；畜禽＝家畜・家禽；活體＝生存；路外／路邊停車位＝路外／路上駐車区画数；原始面積＝面積（実数）；累計期間用「～」（例：1～8月）。
- 仍不確定：偶爾自住住宅（直譯）；施用新收人數＝使用罪による新規収容者数（「施用」的罪名語感）；本年應實繳稅額＝当年納付税額。
### P5 地名、機関、ライセンス（2026-10-16，2 輪校對）
- 縣市／鄉鎮：新字體（臺→台、縣→県、區→区、鄉→郷；台北市、板橋区、新竹県、信義郷）。
- 機關：日本漢字（内政部、経済部、行政院主計総処、衛生福利部）；括號內的英文縮寫保留。
- 授權：政府データ開放ライセンス第1版（台湾 OGDL）／CC BY 4.0（表示）／オープンデータベースライセンス（ODbL）1.0／未表示／未確認。
