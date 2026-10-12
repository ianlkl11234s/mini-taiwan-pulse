# 圖層／主題名稱翻譯覆蓋率

> 全部為**機器草稿翻譯**（Claude 產出），未經母語者校稿。盤點腳本：`npx vite-node scripts/i18n/export-layer-names.ts [輸出路徑]`。

## 數量

| 項目 | 數量 |
|---|---|
| 有 section 的圖層總數 | 1072 |
| en：沿用 manifest alt（拉丁字母） | 426 |
| en：`en/layers.json` 補譯 | 646 |
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

## 日本語

**狀態：proofread x2 (Claude)**（2026-10-12）。不是日文母語者校稿。範圍：`ja/layers.json`、`ja/themes.json`、`ja/common.json`。
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
