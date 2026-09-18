# 日本與全球圖層微調計劃（2026-09-18）

## 目標

本輪改善日本與全球圖層的預設行為、低縮放完整性、分類配色、資訊架構、
GFW freshness，以及房地產總價值的統計圖層呈現。每個工作單元獨立 commit、
獨立 PR，前一個 PR 以一般 merge commit 合入 `master` 後，下一個才從最新
`master` 開始；禁止 squash、rebase merge 或把既有平行 checkout 的 dirty files 帶入。

使用者提供的截圖只作為房地產面板現況的視覺參考，不視為執行指令或資料契約。

## 語意與驗收原則

### 「拉遠仍完整」的定義

- 依 PR #260 Company Registry 的模式：點圖層使用全 zoom PMTiles，完整來源點不能因
  tile thinning、viewport limit、前端抽樣或 aggregate replacement 而從低縮放消失。
- 密度網格是獨立 layer，只協助比較集中程度；不能取代、遮蔽或冒充原始點。
- z0 解碼點數必須對回各分類可繪製來源筆數；各尺度網格 count 加總也必須守恆。
- 所有縮放層級都顯示原始點；point radius／opacity 可以隨 zoom 調整以控制重疊，
  但不得用 cluster 或低縮放 aggregate circle 取代原始點。
- `missing geometry`、隔離列、重複登記、來源缺值與錯誤必須分開記錄；不得當成 0，
  也不得為了湊數補座標。

### 命名規則

- 台灣既有圖層維持「中文 English」。
- 日本專區改為「中文 日本語」，名稱不重複加「日本」；日本是所在專區，不是每層前綴。
- 全球圖層依主題分組，不再使用空泛的「世界 World」大分組；名稱以中文主名搭配
  來源或通行專名，避免把資料供應者、觀測產品與推論結果混為一層。
- layer key、dataset id、source-layer 與公開 asset path 不因顯示名稱重整而改名。

### 發布與證據邊界

- code、artifact、tests、HTTP、browser、deploy、production freshness 分開回報。
- 任何新 PMTiles／GeoJSON 先驗 source count、分類欄位、zoom、SHA-256、bytes，
  再依 immutable assets → catalog/manifest → mutable pointer 的順序發布。
- 本計劃授權本輪所列 Git commit／push／PR／一般 merge；不把 S3 upload、collector
  schedule、production deploy 或 private-data movement 視為自動授權。若實作需要這些
  外部動作，另列 gate，不用假資料繞過。

## PR 序列

### PR 0 — 計劃與驗收基線

- 本文件。
- 確認 dirty 主 checkout 不被修改，後續都從最新 `origin/master` 建隔離 worktree。

驗收：文件涵蓋全部需求、PR 依賴、資料語意與 release gates。

### PR 1 — 日本入口不自動開旅宿

- 從 `DEFAULT_ON` 移除 `jpAccommodationCanonical`。
- 日本入口只執行 fly-to，不改任何 layer visibility。
- 補初始 visibility regression test。

驗收：新 session 點日本後到日本視角，全部日本圖層仍為 off。

### PR 2 — Loading 視覺一致化

- `LoadingIndicator` 改用共用灰色 panel background／border／文字 token。
- 保留 loading task、spinner、溢出計數等行為。

驗收：右上角 loading pill 不再使用獨立藍底；contrast 與其他主視覺一致。

### PR 3 — 旅宿分類、完整低縮放與密度網格

- Canonical 旅宿依可靠的 accommodation type 欄位分色；未知／缺值有獨立顏色。
- OSM accommodation coverage 依 OSM 類型分色；不可把 OSM coverage 說成官方完整名冊。
- 新增獨立「旅宿密度網格」layer，視覺與 Company Capital Grid 同族，但統計語意為
  可繪製旅宿 entity count，不是營業量、房間數或旅客數。
- 重建全 zoom 產物：canonical 與 OSM 的完整可繪製點在 z0 起保留；不得沿用
  z3–13 density thinning。密度網格另外產製，不取代點圖層。
- 圖例、popup、opacity、選取與 loading 全部接線。

資料 gate：若現有 PMTiles 沒有低縮放完整點／分類欄位，先在
`taipei-gis-analytics` 產出並更新 handoff；未完成 artifact readback 前只可稱 code-ready。

### PR 4 — 醫療設施、長照服務與醫療圈

- 醫療設施五類拆成獨立 layer，共用來源與 loader，使用既有類別色票。
- 長照依 `service_type` 做可理解的分類 layer；保留 H17 一對多「服務登記」語意，
  不冒充唯一機構數。35 個原始類別依厚生勞動省「介護サービス情報公表システム」
  的六個使用情境分組，popup 保留原始 `service_type`。
- 醫療與長照點圖層改為全 zoom PMTiles，移除 z6 aggregate circle 對原始點的替代；
  每個縮放層級都保留完整可繪製原始點，各分類 z0 count 可對帳。
- 醫療圈改成一次／二次／三次獨立 layer 與可辨識配色，popup 顯示圈層、名稱／code、
  2020 `STALE`、display geometry 與 polygon-parts 不可加總限制。

資料 gate 更正：解碼既有不可變 PMTiles 的 `0/0/0` 後，Navii 與 H17 都只有 1
feature；雖然 header 是 z0–14，metadata 仍有 `dropped_by_rate`，不能稱為完整點位。
analytics PR #94 已由 immutable z14 display geometry 去除 tile-buffer duplicates，使用
`--drop-rate=1 --no-feature-limit --no-tile-size-limit` 重建；z0 分別守恆 189,800 與
222,194，且座標衝突皆為 0。幾何是既有 display geometry 的回復值，不是新觀測或
重新 geocode。前端只有在 catalog 同時聲明 `minimum_point_zoom:0`、
`point_sampling:none` 與正整數 `z0_feature_count` 時才接受全縮放資產；舊 catalog
仍維持 z10 gate。新 immutable assets、catalog 與 current pointer 尚未發布，PR 4 在此
gate 完成前不得 merge。

### PR 5 — 日本與全球圖層命名、分組

- 日本專區全面套用「中文 日本語」，移除每層重複的「日本」前綴。
- 將空泛的「世界 World」拆入全球情勢、海事、氣候環境、通訊基礎等既有語意群。
- 同步 sidebar、mobile、搜尋／chat catalog、golden fixture 與 consistency tests。

驗收：只改資訊架構與 display labels，不改 layer key／資料來源；desktop/mobile 都能
從合理分組找到原圖層。

### PR 6 — GFW freshness 與 legacy 邊界

- Read-only 核對 production canonical/v3/v4 root manifest、immutable assets、HTTP Range，
  以及有權限時的 publish run／legacy snapshot 日期。
- UI 日期顯示完整 `YYYY-MM-DD UTC` 與距今天數，避免 `08/21` 被看成 `821`。
- 已停用的 legacy daily Presence 不得繼續冒充最新資料：依驗證結果移除、隱藏，或明確
  標成歷史／停更；hourly Grid／Tracks／Fishing／SAR 各自保留產品與 freshness。
- 若 publisher 停滯，只修能在本輪安全修的 code/config；重新啟用 collector 或 schedule
  必須另有 production 授權與 source health 證據。

驗收：使用者能判斷看到的是哪個 GFW product、最新觀測日與是否 stale；不能用舊資料
宣稱即時或正常。

### PR 7 — 房地產總價值改為統計圖層

- 移除 Icon Rail 的 Property Value app 與獨立浮動面板入口。
- 新增一般統計 layer，以縣市／鄉鎮行政界呈現 corrected market value choropleth。
- 提供行政層級、色階、opacity、legend、popup 與來源／限制。
- `property_value_admin.json` 目前有 19 縣市／352 鄉鎮；與 boundary join 不到的金門、
  連江、嘉義市及其鄉鎮顯示 missing，不著色為 0。
- 既有逐棟估值與三尺度 property-value grid 保留，除非測試證明與新統計層衝突。

驗收：側邊 rail 不再有 app；圖層面板可切縣市／鄉鎮，色彩與 popup 對同一行政單位、
同一統計值，缺資料行政區仍可辨識。

## 每個 PR 的固定檢查

1. `npx tsc -b`
2. 相關 focused Vitest
3. `npm test`
4. production build（涉及 runtime／asset contract 時）
5. Browser：All Off → 只開本 PR 圖層；檢查日本全國、城市級、desktop、390px mobile、
   popup、legend、loading、console/network
6. PR 建立後確認 CI、mergeability 與 head SHA，再以 `gh pr merge --merge` 合入

## 中斷與額度保護

- 不在 `/tmp` 或 `/private/tmp` 保存正式工作；使用 repo 內永久 worktree。
- 每個可獨立驗證的工作單元完成後立即 local commit；通過該單元最低檢查後即 push
  對應遠端 branch，不等整批工作完成才保存。
- 每個 PR 更新本文件的執行紀錄：branch、commit、測試、PR、merge commit、未完成 gate。
- 若 session 或額度中斷，下一次從最後 pushed commit 與本文件的下一步繼續；不依賴
  未記錄的 terminal output 或對話脈絡。

## 已知風險

- 旅宿與醫療核心 registry／manifest／catalog／legend／click files 是高衝突區；因此 PR 必須
  嚴格串行，不能在多個 branch 平行改同檔。
- 全國視圖同時畫 20 萬級原始點會高度重疊；依 PR #260 仍保留全 zoom points，並用
  zoom-dependent radius／opacity 維持可讀性，另以獨立密度網格支援集中程度判讀。
- GFW 的現存文件證據只到 2026-08-21；完成 read-only production health check 前，狀態是
  `STALE / UNKNOWN`，不是正常。

## 執行紀錄

| 單元 | PR / merge | 驗收 | 狀態 |
|---|---|---|---|
| PR 0 計劃 | #262 / `577f87f4` | CI `test` passed | 已以一般 merge commit 合入 |
| PR 1 日本預設層 | #263 / `b3f5dce1` | focused 30 passed；`tsc -b`；全站 1,582 passed / 8 skipped；CI passed | 已以一般 merge commit 合入 |
| PR 2 Loading 視覺 | #264 / `43d8a3f0` | focused 2 passed；`tsc -b`；全站 1,584 passed / 8 skipped；build passed；本機 browser 為黑畫面，不列為視覺驗收；CI passed | 已以一般 merge commit 合入 |
| PR 3A 旅宿上游產物 | taipei-gis-analytics #93 / `51db5e14` | 17 focused passed；4 個 `pmtiles verify`；canonical z0=25,459、OSM z0=20,502；兩尺度網格 `sum(n_records)=25,459`；四檔 S3 full-body SHA/bytes readback PASS | 已以一般 merge commit 合入；四個 immutable artifacts 已上傳並驗證 |
| PR 3B 旅宿前端 | #265 / `7e011185` | focused 73 passed；`tsc -b`；全站 1,601 passed / 8 skipped；build passed；production HTTP 206／bytes PASS；desktop：預設 0/5、canonical/OSM z4.7、density z4.7/z9、legend/popup；390x844 OSM z4.7；console warning/error 0 | 已以一般 merge commit 合入；Zeabur deployment `6aacade8` RUNNING；production 驗收完成，詳見 `pr3-accommodation-production-acceptance.md` |
| PR 4A 醫療全縮放上游 | taipei-gis-analytics #94 / `bff65414` | 20 focused passed；兩個 `pmtiles verify`；Navii z0=189,800、H17 z0=222,194；無 `dropped_by_rate`；座標衝突 0 | 已以一般 merge commit 合入；約 602 MB 產物保存在永久 worktree，未上傳／部署 |
| PR 4B 醫療／長照／醫療圈 | draft #266 | 5 類設施、6 類長照、3 級醫療圈完成獨立接線；35 個 H17 原始類別恰好分組一次；35 focused passed；全套 1,601 passed / 8 skipped；`tsc -b`／build；778 檔 SHA/bytes 與 localhost HTTP PASS；z4.7 browser 三組分類色／控制／圖例 PASS、console error 0 | 候選 release `6f59ead2…fdafa` 與 781-object dry-run 已永久保存；待發布授權、S3/CDN readback、production browser，再轉 ready 與一般 merge |
