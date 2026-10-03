# Design System 變更紀錄

> 每一輪拍板了什麼、哪個 PR 做的。規格細節以 [`spec.md`](./spec.md)、[`map-layers.md`](./map-layers.md) 為準；數值以程式（見 [`README.md`](./README.md)「程式裡的唯一來源」）與活的元件頁為準。
> 設計稿都在 `docs/features/ui-consistency-audit-20260927/`（UI）與 `docs/features/map-layer-restyle/`（地圖）。

## 2026-10-03

### 圖層面板收尾修正

| 項目 | 內容 |
|---|---|
| 換底圖後統計層（BACKLOG R8-1） | `map/regionalStatisticsMap.ts`：`style.load` 時 `isStyleLoaded()` 仍為 false，`render()` 直接 return；`idle` 重試只比對資料物件（快取仍在、source 已被 setStyle 清掉）也不觸發，要等下一次操作才畫回。改成 `style.load` 走 `render(true)` 略過檢查、用 store 快取重建＋`setData`，不重抓（同 perf-audit §7／#481）。暗→淡→暗實測立即畫回、資料請求 0；補單元測試 |

### 圖層面板統一：統計與世界大分類 — spec §5.5

| 項目 | 內容 |
|---|---|
| 決定 | 選擇頁 `docs/features/layer-panel-unify/macro-groups-picks.html`：統計 S-B、世界 W-A |
| 統計 | 5 類：人口與社會／經濟與住宅／交通／土地與環境／基準。「人口與社會」拆成人口與教育（13）、醫療與長照（36）、犯罪與治安（1）、住宅與不動產（26）；「交通與運輸」拆成公共運輸（30）、道路與車輛（43）、交通用地（32）；主題 6→11 個、共 340 層，圖層 key、資料、manifest 名稱不變；工作與所得從第一個移到第四個（經濟與住宅） |
| 世界 | 3 類：公共生活（全球通訊）／環境與資源（全球氣候、全球環境）／情報（全球情勢、全球海事）；`WORLD_MACRO_GROUPS` 由 `THEME_MACRO_GROUPS` 派生，主題順序改依大分類 |
| 預設收合 | 日本 14 個主題、統計 11 個主題全部預設收合，與台灣一致（使用者 2026-10-03） |
| 名稱待決四項 | `names-review.md` 四項照改：国土数値情報代碼（A10／A11／A28／W09）移出名稱，限定詞只留年份，代碼留在說明與主題詞（仍可搜）；偵察衛星中文國名、「水質測定點」確認定案；風場（10m）、淹水潛勢（650mm/24h）、農田範圍（2025）、省道路況（v1）尾段改為限定詞 |
| 對照 | `docs/features/layer-panel-unify/macro-groups-result.html` |

### 圖層面板統一 C 段（統計連動選單）— spec §5.11／§5.37／§6.3

| 項目 | 內容 |
|---|---|
| 決定 | AUDIT P6 A：新增「連動選單」控制項，統計完全走共用規格，一次到位 |
| 控制項 | `layerParamsSpec` 新型別 `linkedSelect`（`provider`／`field`／`dependsOn`／`primary`／`persist`）；值在 provider 不在 layerParamsStore；共用連動規則（前面的列不動、後面的列合法就保留否則第一個合法值）在 `state/linkedSelect.ts`；接到 `buildParamControls`（`visibleControlSpecs` 含可見規則）、`LayerParamControls`、`research/layerControls`、`memberSceneAdapter`、manifest `params.kinds` |
| 統計 | 357 個統計 key 由 recipe 目錄派生連動選單（`data/statisticsParamsSpec.ts`）：教育固定入口與勞動「顯示」有指標列；環境＝資料期別＋細項；其他依維度鍵順序；releaseSelector 補 `dimensionKeys`。`StatisticsDetails` 不再畫 select，只剩「說明・來源」內容（位置口徑、資料限制、目前選擇、來源與處理紀錄、相關圖層），放在展開區最後 |
| 群組變體 | 醫療、住宅、土地等一列對多個 key 的群組：`LayerDef.variant`（群組＋lead）決定群組列位置；「指標／口徑」改成展開區第一列連動選單（`statisticsVariant` provider，同期別切換、必要時預載），不存進場景 |
| 載入狀態 | 保底列（`primary`）顯示「載入中…」「載入失敗＋重試」；改值後「切換中…」；資料與配方明細照舊走 loadingRegistry |
| 場景 | 存連動選單目前值；還原時等選項就緒再逐列驗證，略過項目一起回報；舊存檔不受影響 |
| 內部代碼 | 參考邊界代碼改中文（說明・來源、圖例、popup、資料來源卡、圖層說明）；guard `internal-id-display` 基準 1→0 |
| 黃金快照 | `params` section：357 個統計 key 在透明度前多出連動選單（未載入狀態），其他 key 不變 |
| 對照 | `docs/features/layer-panel-unify/phase-c-compare.html` |

### 圖層面板統一 B 段（資料結構）— spec §5.5／§5.11／§5.22

| 項目 | 內容 |
|---|---|
| P2 名稱 | manifest `name: { zh, alt?, qualifier? }`（`layerName()` 寫入），`label` 由 `composeLayerLabel()` 組成 `中文 外文（限定詞）`，搜尋、Agent、無障礙名稱照讀；列上同一行：中文＋外文小字（只省略外文）＋限定詞小標籤（`LayerNameLine`）。525 筆字面名稱：352 筆自動（兩支舊拆字函式一致、字串不變），173 筆人工，其中 52 筆字串改變（來源／版本改成限定詞、拿掉 emoji 與寫死的筆數）；清單 `docs/features/layer-panel-unify/names-review.md`。日本醫療三組常數加 `zh`／`ja` |
| 拆字退場 | `splitThemeTitle`、`DataSourcePanel` `splitLabel` 移除；主題顯示名稱改查 `themeName()`（`THEME_NAMES`），大分類 `LAYER_MACRO_GROUPS` 改 `{ zh, en }` |
| `labelMobile` | 欄位與 136 筆資料移除（A 段後已無畫面讀取） |
| P3 日本副標 | 14 個主題補日文漢字副標，同字照樣顯示（宗教 宗教）；行政區→行政区域、旅宿→宿泊、長照服務→介護サービス、高度與地表→高さ・地表（內容是建物與樹冠高度，不用「標高」） |
| P4 大分類 | `LayerPanelDef.macroGroups` 每個入口一份；日本 5 類，主題清單照分類重排；統計、世界待選定，暫不分 |
| P5 順序 | 資料篩選→顏色→透明度→大小→其他外觀→說明・來源；`paramControlCategory`（明寫 `category`＞型別＞「透明度」字樣＞詞彙表），`buildParamControls` 與 Agent 端共用 `orderedVisibleParamsSpec`；190 層順序改變（黃金快照只有順序差）；汙染設施／裁處的篩選移到透明度前；`layerParamsOrder.test` 擋未分類標籤 |
| 內部代碼 | 寺廟說明的 `deity_family` 改中文；資料來源卡不再用資料集代號當標題（guard `internal-id-display` 基準 3→1） |
| 對照 | `docs/features/layer-panel-unify/phase-b-compare.html` |

### R7 熱區／網格配色 — map-layers §3.4 G-2／G-3、LG-8；spec §5.36

| 項目 | 內容 |
|---|---|
| 決定 | 提案 `docs/features/layer-color-picker/PROPOSAL.md` §0（Q1 A 設定裡一列色條＋浮出清單、Q2 A 長清單、Q4 A 熱區預設新版 magma、Q6 B 多層熱區降透明度）；色盤庫 17 組（§0.1）；計畫 `layer-panel-unify/PLAN.md` D 段 |
| 色盤庫 | `src/map/palettes.ts`：17 組序列色階，暗／淡各 7 階（淡版越密越深），色值沿用 `ramp-validation.md` §5；dataviz 驗證器 68 次（17 組 × 4 陸地色）除多色相「單一色相」N/A 外全過；`palettes.test.ts` 鎖階數與方向 |
| 控制項 | `layerParamsSpec` 新型別 `palette`（字串、不進 overlayParams），接到 `buildParamControls`、`LayerParamControls`、`research/layerControls`（Agent 白名單）、`memberSceneAdapter`（場景存檔）、manifest `params.kinds` |
| 解析器 | `src/state/layerPalette.ts`：registry paint、hook、圖例、popup 共用；`heatmapPaint` 改收 ramp＋疊放倍率 |
| 熱區 | 43 層（台灣 34、日本 8、全球 1）「熱區顏色」，預設新版 magma；同時開 ≥2 層 ×0.7（`HEATMAP.stackedOpacity`）；雨量、電桿不開放 |
| 網格 | 23 個 key「網格顏色」；預設沿用現行色系，YlOrRd／inferno／Oranges → YlOrBr（不動產總市值、預售、日本人口、日本旅宿密度）；租賃熱力圖青→橘 → batlow（只換網格，3D 點色表不動）；日本人口高齡比在預設時維持 BuPu；醫療 5／照護 6 各共用一份 |
| 不做 | 都市紋理、人流 H3（原因見 G-3）；反轉（方向已由底圖決定）；分享連結（PLAN 第 4 段） |
| UI | spec §5.36 色盤選單：portal 浮出（下方不夠往上開、手機抽屜裡改 modal 層）、lucide `Check`、2px 藍色焦點、中文不用等寬字、還原預設用 `.lpc-btn`；修原型稽核 §8 五項 |
| 對照 | `docs/features/layer-color-picker/phase-d-compare.html` |

### 圖層面板統一 A 段（共用外殼）— spec §5.1／§5.5／§5.10／§5.22

| 項目 | 內容 |
|---|---|
| 共用元件 | `LayerRow`／`ListRow`、`ThemeBanner`、`SubGroupLabel`、`MacroGroupLabel`、`ExpandedControls`、`LayersPanel` 從 `IconRailSidebar.tsx` 搬到 `components/sidebar/`；四個入口只有一份定義 `layerPanels.ts` |
| P1 圖層列 | 計數格兼載入轉圈（接 `loadingRegistry`，盡力比對）；每列可展開，最後一行「說明・來源」（manifest 說明＋資料來源卡）；icon 關閉一律灰（統計原本彩色）；「All Off」→「全部關閉」；台灣入口標題「台灣 Taiwan」 |
| P7 手機 | 分頁改四個入口（台灣／統計／世界／日本），直接用桌機 `LayersPanel`；色點開關、手刻 28×14 總開關、`labelMobile`（名稱內筆數）退場；手機也有「全部關閉」，切到日本會飛過去 |
| P8 其他清單 | 資料來源、Agent 分析結果、衛星群組、我的・收藏／已開啟、醫療統計群組列都改用 `ListRow`；原生 checkbox、強調色衛星開關改成黑白列開關（衛星開關移到 chevron 後） |
| P9 搜尋 | 結果列改一般圖層列；末尾提示其他入口筆數，點了切換並帶入關鍵字 |
| 不改 | manifest 名稱結構（B 段）、控制項順序（B 段）、統計設定區與醫療群組「指標」在列外（C 段） |
| 對照 | `docs/features/layer-panel-unify/phase-a-compare.html` |

### 監看卡 P5 淡色版 — spec §5.35 H2

| 項目 | 內容 |
|---|---|
| 拍板 | 比較頁 `docs/features/monitor-restyle/p5-picks.html`：S1 白卡疊淡灰面板、W1 外殼 95%（全屏不透明）、D2 淺色相填色加深、P2 pill 淡底實心、X1 斜線同 alpha 換極性、R2 壓力環保留光暈＋數字用等級色 |
| 機制 | `MonitorPanel` 收 `isDarkTheme`（App 傳入），新版依底圖包 `IntelThemeProvider`＋`.mtp-mon--light`；舊版一律暗。`monitorTheme.ts`：`useMonitorTheme()` 給 palette、圖表中性色、`fill`（淡色對白至少 3:1）、`text`、`neutral`；暗色值＝改版前字面值 |
| 共用元件 | 折線、計數柱、數值列、圖表提示框都吃主題（沒有 Provider 時為暗，一般彈窗不變）；設計系統 §13 改暗／淡並排 |
| 卡片 | 24 格全部換；直播牆影片與影片上的字幕條維持暗；只在舊版跑的分支不動 |
| 驗收 | 淡色底圖 1920 新版 24 格無截斷、無溢出；暗色新版、淡色底圖下的舊版維持全暗；tsc、1325 個測試 |


### 監看卡 P4b 資料時間與缺值的 RPC 根本解 — spec §5.35 G2／K1

| 項目 | 內容 |
|---|---|
| 資料庫 | gis-platform #135／migration 425（已套正式庫）：`get_news_events_day_clustered_v2` 加 `aggregated_at`（新聞管線彙整時間）；公衛 yoy、加權指數 change_pct、壓力指數 vs_baseline／vs_1h_ago 缺值回 NULL，不再補 0 |
| 前端 #503 | 新聞四格新鮮度改看彙整時間（凌晨不再誤報延遲），最新一則超過 12 小時改用發布時間並寫原因；漲跌幅、壓力比較缺值顯示「—」；熱區說明更正為「過去 7 天有新聞的小時平均」 |
| 刻意保留 | `get_news_trending.baseline_avg` 的 `COALESCE(…,0)`（前端以 0 判斷「新」，改 NULL 會讓整個縣市倍數消失） |

### 監看卡 P4 來源新鮮度與缺值修正 — spec §5.35 G2／K1

| 項目 | 內容 |
|---|---|
| 新鮮度 | `monitorFreshness.ts`：每格週期登記在 `monitorCardMeta.ts`（stream／days／market／event），只用資料本身的時間判斷即時／延遲／過期／停更／無資料／收盤；`useMonitorFreshness` 取代卡片直接呼叫 `useMonitorCardHeader` |
| G2 畫法 | 過期／停更：主數字 `muted`、折線 `staleUntil` 尾段斜線、卡底 `MonitorNote` 原因；`MonitorKpis` 加 `muted`；計數柱在過期時才補 null 灰樁到今天 |
| 資料時間 | 加權指數改用最後交易日＋HH:MM（不再套今天日期）；機場、ISR 不再退回瀏覽器收到的時間；新聞直播不再用解析器時間；公衛由週次推週四 |
| 缺值修正 | 地震規模／深度、落雷計數（彙整落後時不說「今日尚無落雷」）、颱風、輻射站數、警訊序列失敗、食品、加權指數高低、共機、台鐵、公衛、信號分級（另列「未分級」）、供電分區、機場空序列 → 保留 null 顯示「—」；特殊船舶新版合併柱真 0 畫底線 |
| 壓力指數 | loader 改讀 `updated_at`、解析 `per_signal` 物件（只顯示子分數，不在前端複製權重）；未就緒改中性色；新版環內不再疊英文等級字 |
| 熱區 | 「熱度倍數」合成值（1＋則數×0.28）改為近 1 小時升溫（`get_news_trending` 按縣市 Σ則數 ÷ Σ7 天每小時平均），新舊版都換 |
| 網路觀察 | 每個 5 分鐘桶用資料的 `expected_probe_count` 判斷完整桶（取代寫死 79／39；7D／30D 與即時值仍用寫死值） |
| 不改 | 只在舊版路徑的補 0（舊版供電／急診 `[0,0]`、共機 AxisBar、機場舊版加總）；資料庫端 `COALESCE(…,0)`（公衛年增、漲跌幅、壓力指數比較）前端已能接 null，要改 RPC 才看得到 |
| 驗收 | 1920／1496／1280 新版 24 格無截斷、無溢出；1920 舊版版面不變；tsc、1323 個測試 |

### 地圖 R5 密集點熱區＋密度透明度 — map-layers §3.1 P-3／P-4、§3.4 G-2

| 項目 | 內容 |
|---|---|
| 點數盤點 | 292 個點圖層（台灣、日本、全球）：>100k 10、10k–100k 45、1k–10k 78、<1k 158、未知 1（`jpRamsarSites` 資料檔遺失） |
| 熱區 | 42 層＋示範 2 層（`fireHydrants`、`jpReligionGsi`）：10k–100k z<10、>100k z<12 熱區；原本 minzoom 較高者保留原出點縮放（使用者選 B）；共用 magma、熱區與點同 filter、滑桿同時控制 |
| 強度 | 每層目視校正 0.01–5；7 層低縮放 PMTiles 抽稀，強度偏高為補償、密度分布被壓平 |
| 保留 | `powerPoles` 熱區、`companyPoints` 密度格網、`jpMedical*`／`jpCare*` 10km 格網（使用者決定）；`eduCramSchool` 抽稀過重不套 |
| 取消聚合 | `aqiMicroSensors` 456 點直接顯示（使用者：點不多就全顯示） |
| P-3 | 滑桿預設：>100k 0.6、10k–100k 0.75、1k–10k 0.8；<1k 不動 |
| 不做 | 泡泡 M3 大小正規化：使用者決定各層維持原大小 |
| 對照 | `docs/features/map-layer-restyle/r5-compare.html`（示範兩層前後）、`r5-all.html`（全層拉遠總覽） |
| 後續 | 熱區配色全站同色難分辨 → 提案「各層預設色＋科學色盤可選」 |

## 2026-10-02

### 資料面修正與供電依區域分組

| 項目 | 內容 |
|---|---|
| 網路觀察 collector | RIPE collector 覆寫問題已修（data-collectors #124），19:05 起資料完整 |
| 台電分區 | gis-platform migration 424（#133）：`get_ssot_facility_output_24h` 每廠多 `taipower_region`（north／central／south／east／offshore_island／null），調查見 `docs/features/monitor-restyle/power-regions.md` |
| 供電卡 | 機組出力小格加「依區域｜依發電方式」分段，預設依區域；東部目前無電廠，顯示空組說明而非 0 MW；僅新版 |

### 監看卡 P3 多指標卡實作 — spec §5.35

| 項目 | 內容 |
|---|---|
| 共用 | `MonitorRows` 小倍數列；折線 `bare`／`band`／`moreSeries`；柱 `bare`／`part`／`maxValue` |
| 供電 P-A | 備轉容量率｜供電能力 vs 尖峰負載兩主圖並排；四區用電一行；機組出力小倍數（登入後） |
| 急診 E-A | 14 天主圖斷線＋斜線（09/25–28）；60 院迷你線改時間軸、保留缺口 |
| 共機 L-A | 大柱＋越中線疊在柱底（藍）；方位、機型兩組橫條並排 |
| 特殊船舶 V-A | 合併大柱＋四分帶小倍數同一把尺；修掉「真 0 艘畫成缺值灰樁」 |
| ISR I-A | 主數字＋標準柱＋一行圖例＋兩行說明 |
| 台鐵 T-B | 三 KPI 並列＋三線疊成一張大圖；最誤點車次收合 |
| 網路觀察 N-A | 四指標小倍數＋正常色帶＋「怎麼看」；殘缺量測桶不畫、24h 每小時取完整桶平均、即時值取最近完整桶（collector 覆寫造成殘缺，見 `internet-health-reading.md`） |
| 機場 A-A | 入出境疊成一張圖；停更時仍顯示 0（P4 修） |
| 驗收 | 1920／1496／1280 新版無溢出、無格子被裁；1920 舊版不變；tsc、366 個相關測試 |

### 監看卡 P3 多指標卡拍板 — spec §5.35

比較頁 `docs/features/monitor-restyle/p3-picks.html`：P-A、E-A、L-A、V-A、I-A、T-B、N-A、A-A。使用者補充兩點：共機要把越中線放進主圖（柱底疊色＋數字列）；網路觀察要說明怎麼判斷正常（近 7 天正常範圍色帶、判斷規則、可交叉比對的來源，調查見 `internet-health-reading.md`）。

### 監看卡 P2b：共用數值列與走勢 — spec §5.35

| 項目 | 內容 |
|---|---|
| 共用元件 | `MonitorMetric`／`MonitorKpis`／`MonitorSub`／`MonitorNote`（由災害卡私有元件升格）；圖高三階 `MON_CHART_H` 經 `heightTier` 套到 `TimeseriesSparkline`、`HazardTrendBars`，舊版忽略 |
| 走勢 | 新版折線缺口畫斜線、最新值圓點；上留白加大、單位字移到留白、Y 軸字最多三個（實測在監、加權指數原本刻度字被切或疊字） |
| 套用 | 颱風、環境輻射、落雷、地震、加權指數、公衛、在監、食品價格、警訊整合、熱區、信號分級、新聞；卡內與外框同義的標題拿掉，有狀態意義的改成狀態小字 |
| 保留原圖 | 時間軸類別堆疊、食品異常日區帶、警訊 24 小時桶與公衛週次（沒有時間戳，不捏造日期），只對齊圖高、字級、首尾標籤 |
| KPI 最小寬 | 96 → 110px（S13 字級下 96 放不下） |
| 驗收 | 1920／1496／1280 新版無溢出、無格子被裁；1920 舊版不變；tsc、相關測試（統計兩支測試在機器忙時逾時，放寬時限後通過，本 PR 未改該處） |

### 監看字級 S13（P2a）— spec §5.35

| 項目 | 內容 |
|---|---|
| 拍板 | 使用者覺得監看模式字太小，問能否以 14 為最小；比較頁 `docs/features/monitor-restyle/fonts.html`（S0 現況／S13／S14，分割模式真實寬度並排）選 **S13**，只改監看模式 |
| 字級 | 13（軸字、英文、來源、標籤、時間）／14 正文／16 標題／19 KPI／24 主數字；新版取消 1.15 放大 |
| 範圍 | 30 個元件檔約 340 處字級改走 `fs(v2, …)`；即時情報面板共用的 `IntelCard`／`IntelFilters`、全站共用的 `TimeseriesSparkline` 只在監看新版生效 |
| 版面 | 寫死的欄寬放寬（共機、台鐵、船舶、熱區、供電、急診 60 院自動減欄）；警訊六宮格最熱警報詞移到組名同一行；上半部固定高格子重新分配列數 |
| 行距（2026-10-02） | 使用者反映上下行太緊：卡內預設行高 1.45、卡內區塊間距 8 → 10px（`monitorCard.css`；主數字等自訂行高不變） |
| 驗收 | 1920／1496／1280 新版無溢出、無格子被裁（新聞清單本來就捲動）；1920 舊版不變；tsc、1,029 個相關測試 |

### 監看卡 P1：卡片殼與標題列 — spec §5.35

| 項目 | 內容 |
|---|---|
| 卡片殼 | `MonitorCardFrame`（由 `HazardShell` 結構升格）：MonitorPanel 統一畫框與標題列；24 格各自的外框、段落標、卡內第二層英文標題、共機／船舶額外 zoom 在新版拿掉 |
| 標題列 | 中文標題＋英文小字（`monitorCardMeta.ts`）；右側資料時間與異常 pill；卡寬 < 260px 時英文先隱藏 |
| 中文化 | 面板標頭（測試中、停靠／分割／全屏）、各卡英文小節標與狀態字（網路觀察、ISR、警訊、信號分級等）；內部欄位與 RPC 名不再顯示 |
| 窄格 | 卡片 `overflow: hidden`；加權指數走勢改隨卡寬（溢出 48px 已消除）；標頭可換行（1280 寬「退出」不被裁） |
| 資料時間 | 只送資料本身的時間；使用者要求追到源頭：環境輻射改用站級觀測時間、新聞四格用最新發布時間；警訊整合與災防觀測上游沒有可用時間，不顯示（追查 `docs/features/monitor-restyle/data-time-trace.md`） |
| 切換 | 標頭「新版／舊版」，預設新版；舊版畫面不變 |
| 驗收 | 1920／1496／1280 寬新版截圖（24 格無溢出）、1920 舊版對照、tsc、vitest、design guard |

### 監看模式卡片拍板 — spec §5.35

比較頁 `docs/features/monitor-restyle/picks.html`（2026-09-30 盤點＋提案）；尚未實作。

| 題 | 選 | 內容 |
|---|---|---|
| A 卡片殼 | A1 | `MonitorPanel` 統一畫框，標題列在框內；`HazardShell` 升格，不新造通用 Card |
| B 尺寸階 | B1 | 格寬 1/3／1/2／全寬；圖高 24／48／96；圖寬 100% |
| C 標題列 | C3 | 中文標題＋9px 英文小字附註（窄格先隱藏英文）；右側時間；異常才出 pill |
| D 數值列 | D3 | 一個 22px 主數字＋18px KPI 列；只剩 22／18／10 三階 |
| E 走勢 | E3 | 連續量折線、計數柱；缺值斷線＋斜線／灰樁，0＝底線；共用一個走勢元件 |
| F 多指標 | F3＋補充 | 主圖＋小倍數；使用者補充「要能接受一個以上重要指標」→ **全寬卡最多 2 個主圖並排**，各配 22px 主數字 |
| G 狀態 | G2 | 過期／停更：pill＋主數字降灰＋斜線＋一行原因；收盤不降灰；受影響用資料色、不改卡底；狀態字表擴充 §6.4 |
| H 主題 | H2 | 監看模式跟底圖暗／淡（取代 §5.21「刻意全暗」） |
| I 指數化 | I2 | 子指數四領域：災害、民生、國防、網路與交通；總指數先修好，之後由子指數加權合成；需 gis-platform migration（使用者拍板） |
| K 缺值 | K1 | 這輪一起修 `?? 0`／補 0、壓力指數 loader、熱度倍數合成值；RPC 與上游停更另開工單 |
| 窄格規則 | — | 使用者在比較頁抓到示意卡數字互壓 → 規格加入：卡片不溢出、數字不斷行、KPI 自動折行、標題不截斷、1496／1920px 驗收 |

## 2026-09-30

### 監看模式 split 盤點與提案（未拍板）— spec §5.35

| 項目 | 內容 |
|---|---|
| 範圍 | split 24 格逐格盤點外觀（尺寸、標題、數值、圖表、缺值畫法、共用／手刻）與資料品質（來源、頻率、最近資料時間實測） |
| 主要發現 | 沒有共用卡片框；標題 5 種寫法；主數字 9 種字級；時間序列 5 套實作；約 20 處缺值畫成 0；24 格只有 5 格判斷來源過期；加權指數走勢寫死寬度溢出 48px（實測） |
| 資料 | 在監停更 138 天、機場停更 2.5 天、登革熱來源下架、落雷氣象署源疑似停、急診 09-25～28 斷段、壓力指數前端 bug 永遠「更新中斷」 |
| 提案 | 比較頁 `docs/features/monitor-restyle/picks.html`：A 卡片殼、B 尺寸階、C 標題列、D 數值列、E 走勢、F 多指標卡、G 狀態提示、H 主題、I 指數化（只列利弊）、K 缺值修正 |
| 狀態 | **等使用者選代號**；§5.35 為草案，拍板後改寫成定案並記一筆 |
| 文件 | `docs/features/monitor-restyle/`（README 總表、inventory-a／b、data-quality） |

### 地圖 R3b hook 線面與影像／文字／擠出

使用者確認 `r3b-tiers.html` 建議，另修正 D 區：計數徽章保留出現縮放與 GFW 資料驅動字級，POI minzoom 取現值與 13 的較大值。A 共 184 列（裝飾與資料編碼保留）；B 14 層全部維持；C 9 層影像統一預設 0.7／滑桿 0.3–1；D 提案 9 個選項／10 個文字子層，實作核對排除 noiseCapture 誤列後為 8 個／9 子層；E 9 層擠出預設 0.85、vertical-gradient 開啟，高度倍率 1 對應原高度。hook 與 registry 共用計算，新增與更新 paint 一致；沒有修改資料來源、零值／缺值或 popup。

完整逐層差異、測試與本機資料限制見 [`R3b-report.md`](../features/map-layer-restyle/R3b-report.md)，視覺對照見 [`r3b-compare.html`](../features/map-layer-restyle/r3b-compare.html)。Claude 驗收通過（2026-10-01）。驗收時另修：船舶監看航跡與不動產行政區的透明度預設值、BSS 橋梁方向線保留較細、颱風預測點線維持平頭。

### 時間軸播放邊界與暫停（spec §5.24）

- 回放播到「現在」就停（視窗結尾與現在取較早者），不再播進未來；游標在現在之後按播放原地停。
- 按過暫停後，資料重載（例如打開航班、船舶等圖層）不會再被自動播放重啟；自己按播放才會播。

### 地圖 R3a 線與面（registry）— map-layers §3.2、§3.3

| 決定 | 內容 |
|---|---|
| 分階 | 比較頁 `docs/features/map-layer-restyle/r3-tiers.html`；使用者確認照建議，只改 `osmPowerLines/cable`（海纜虛線）透明度 0.6 → 0.85 |
| 範圍 | OVERLAY_REGISTRY 畫的 75 個面、31 條線、3 個行政界；hook 自畫線面與網格／影像／文字留 R3b |
| 做法 | `lineFillTiers.ts` 登記每層的階；`lineFillSpec.ts` 的 `withLineFillSpec` 在 registry 出口統一套用（接在 `withPointSpec` 後）。滑桿照舊有效：新值 × 原 paint「目前參數 ÷ 規格預設」的比值 |
| 線 | 寬三階（細 0.5→1、標準 1→2、強調 2→3.5）；透明度一般 0.85／參考線 0.6、下限 0.3；`[2,1]` → `[2,2]`；行政界、海域界、流域界尖角，其他圓頭圓角 |
| 行政界 | 縣市強調、鄉鎮標準、村里細；三層統一中性灰（暗 `#9ca3af`／淡 `#374151`） |
| 面 | 分級 0.55、覆蓋 0.35、背景 0.15、網格 0.7；外框：覆蓋 1px 同色 0.8、背景 0.5px 中性灰 0.6、分級與網格底圖色細縫（`FILL_OUTLINE`） |
| 資料編碼保留 | 寬度或透明度依資料變化的層（道路等級、電壓、等高線、Ookla、警察等時圈、房價網格等 16 列）不套階；外框顏色依資料（港口等級、離岸風場狀態）保留 |
| K-4 | 套階的線寬、線透明度、面透明度不再依暗淡改變（registry 暗淡差異 37 → 14，剩底圖色細縫與依資料的層） |
| `fill-outline-color` | registry 7 處全拿掉；`parkingOnstreet` 新增 `outline` 子圖層；`jpBuildingHeight` 走網格「無外框」 |
| 護欄 | `src/map/__tests__/lineFillSpec.test.ts`（階值、K-4、虛線、禁用 `fill-outline-color`） |
| 盤點修正 | `design:audit-layers` 判斷「圖例暗淡不一致」時不再把面圖層外框線當主色（原本 8 個誤報：`forestCompartments`、`ecoNetworkZones`、`companyCapitalGrid`、`ooklaPerformanceGrid`、`jpAccommodationDensity`、`realEstateRentalGrid`、`industrialParkBoundaries`、`industrialParkComparison`） |

### 地圖 R4 圖例對齊與識別色 — map-layers §3.7、§4.3

Codex 實作、Claude 驗收（`docs/features/map-layer-restyle/R4-report.md`）。原則：地圖是對的，圖例去對齊地圖；地圖畫法零改動（黃金快照零差異）。

| 決定 | 內容 |
|---|---|
| 形狀 | 面圖層改方塊（建物、都市紋理、不動產市值）、點圖層改圓點（消防栓、政府機關、噪音稽查、聲音照相）、線圖層改線段（橋梁承載、OSM 道路） |
| 色票同源 | 圖例色票改引用與 paint 同一常數：新檔 `src/map/layerPaintColors.ts`（化石燃料、政府機關、道路、林業、步道、設施狀態、主題色）、`medicalPOITypes.ts` 的 `medicalPoiColor` |
| 暗淡 | 醫療 5 層、學校、新聞、渠道等圖例依暗淡切換；分級面／網格外框描邊用 `mapSeamColor`（與 R3a 同源） |
| 化石燃料 | 圖例原本用品牌色（中油綠等），地圖實際畫 registry 色（中油淺藍 `#41AEF2`）；依原則改成地圖色 |
| 加油站品牌色（R4 後續） | 使用者指定加油站三家業者改用品牌色，地圖與圖例一起改（同一常數 `FOSSIL_PAINT_COLORS`）：中油 `#00875A`、台塑 `#1E40AF`、台糖 `#EA580C`；「其他」與 SSOT 總表不是品牌，維持原色；manifest 識別色同步 |
| 裁處分層 | 嚴重度在地圖上不是用顏色表示，圖例的嚴重度三列拿掉色票只留文字；介質色票保留 |
| K-1 | 13 層識別色（manifest `color`）改成地圖暗色版主色：醫療 5 層、AED、計程車招呼站、清運點、海纜、登陸站、溫泉區、風景區、農路、歷史電廠 |
| 手寫色票 | `LegendPanel.tsx` 90 → 6（剩的 kit 無對應元件） |
| 盤點 | `legendsWithIssues` 28 → 3（剩的 3 個是屬性色，程式同源，盤點讀不到） |

## 2026-09-29

### 開關兩階（S2）— spec §5.10

- 站上本來就有兩種開關，規格只寫了細項那種。拍板 **S2**：維持現況、補規格——**列開關** 28×16、開＝黑白（依主題）；**細項開關** 20×11、開＝強調藍；刪掉從未使用的 24×14。
- 列開關預設顏色改成跟著主題（`LAYER_TOGGLE_PALETTE`），三處重抄的色碼收斂成同一份；暗色開啟圓點統一為 `#111827`（原桌機 rail `#1a1a1a`，肉眼無差）。

### 開站畫面（#395）— spec §5.33

| 決定 | 內容 |
|---|---|
| 方向 | 從 B1／B2／B3 → M1–M5 進場動畫 → W1–W3 等待畫面，選 **W2 城市脈動＋M2 機關展開** |
| 等待（W2） | 台灣本島＋離島輪廓（澎湖、金門、馬祖、綠島、蘭嶼、小琉球、龜山島；不含東沙、太平島、釣魚台），九個城市由北往南亮起並擴出波紋 |
| 版面（用調整工具 `boot-w2-tuner.html` 定案） | 本島高 19vh；本島外框中心＝視窗中心往上 4.5vh；城市點 5.8px（900px 高視窗）；波紋 ×6；一輪 2.2s；不顯示城市名稱；顯示品牌字 |
| 狀態列 | 同 §5.30 載入狀態條；「載入地圖」的中線在「入」「地」之間，圖示掛在左側 |
| 開頭 | 台灣淡入 0.7s（試過由小彈出，不自然，改淡入） |
| 收尾 | 「✓ 完成」停 0.4s → 遮罩淡出 0.45s → 側欄、工具列、時間軸、標題從邊界帶回彈進場，整段約 1.6s（比初版慢約 0.5s） |
| 淡色 | 帶 `style=light` 的連結開淡色版 |
| 拿掉 | 假進度條、log 終端框、「Supabase Realtime」副標、漸層光暈 |

### 左側面板（#395）— spec §5.1

- Layers 等 rail 面板原本 `rgba(0,0,0,0.45)`，比時間軸淡 → 改 `SURFACE.strong`＋`BORDER.panel`＋`ELEVATION.lg`；rail 底改 `SURFACE.app`，與時間軸同一個藍黑色系。
- rail 面板、即時情報、衛星、地震回放、Agent 共用上緣 `LAYOUT.leftDockTop`（60），對齊 rail 第一條分隔線、剛好在左上座標列下方（原本 92／98 不一）。

### 時間軸「尚無資料」（#397）— spec §5.24

- 拖過「現在」時，列內的「尚無資料」會擠窄時間軸，刻度對應的時間跟著變，提示在「現在」前後來回跳。改成浮在卡片上方、掛在時間的冒號上：標籤中線（「無」「資」之間）對齊冒號，不佔列寬。

### 開站加速（#395）

- 地形 DEM 只在地圖傾斜（pitch > 0）時才載入，傾斜後不再拿掉。
- 待辦：關閉的圖層不建資料來源、Three.js 圖層打開才建（下一輪）。

### 地圖點圖層 R2 後半（#396、#398）— map-layers §3

- hook／factory 自己畫的 122 層套固定分階與底圖色細縫描邊（Codex 實作、隔壁 session 修正、Claude 驗收）。
- **B 類**：11 層點大小代表資料數值（地震、雨量、河川水位、淹水感測、地下水、兩個水利 IoT、送養動物、漁船軌跡、地震回放站點）→ 保留依資料的半徑，只統一描邊。
- **資料編碼描邊要保留**：描邊依資料屬性變化時不換成細縫——警察設施位置不精確（橘框）、抽水站運轉中、衛星機動中、火災有死傷（暗白／淡 `#111827`）、颱風預測點（空心藍環）。圖例要寫出外框的意思（例「有外框＝有死傷」）。
- 主題、透明度只能改樣式（`setPaintProperty`），不可觸發重新抓資料或重算。
- 船舶監看：透明度當倍率乘進「訊號中斷／推定位置」淡化，不再蓋掉它。
- 待 R5：日本宗教設施（16.7 萬點）低縮放糊成一片 → 熱區；微型感測器聚合泡泡描邊。

## 2026-09-28

### 地圖圖層規格拍板（#385、#386、#387）— map-layers

- 40 個代號（P 點、L 線、F 面、G 立體、T 文字、K 底圖切換、LG 圖例）逐一拍板，比較頁 `map-layer-picks.html`；套用計畫 R1–R6（`docs/features/map-layer-restyle/PLAN.md`）。
- 重點：點三階 S 3／M 4.5／L 6.5px（P-1 B）；描邊用底圖色細縫；光暈只留即時資料；超過 10 萬點改熱區（P-4）；Three.js 圖層要能切回一般 Mapbox 畫法、預設 Mapbox（G-1，R6）；地圖中文字用本機系統字（T-1）；圖例標題「中文＋英文小字」不轉大寫（LG-11）；圖例各層自己決定、不自動縮減。P-3 密度透明度延到 R5。

### R1 基礎（#391）

- 新增 `src/map/mapStyleScale.ts`（全部拍板數值）與 `src/components/legend/legendKit.tsx`（共用色票與標題）。
- 統計圖層：外框改底圖色細縫；**缺值＝單向細斜線、遮蔽＝交叉斜線**（使用者確認）；淡色底圖上無數值的面改灰邊（原本看不見）。
- 163 個圖例標題改「中文＋英文小字」。

### R2 點圖層 registry（#392）＋站點（#393）

- registry 191 層套固定分階（`pointTiers.ts`）與統一描邊（`pointSpec.ts` `withPointSpec`）；靜態光暈改透明度 0 但保留（點擊範圍會用到）；即時光暈上限：半徑 ≤ 主體 2 倍、透明度 ≤ 0.35、blur ≥ 0.6。
- 高鐵／台鐵光柱預設關；捷運站「Mapbox 點位」全縮放都有點，「實際範圍」用光暈示意。

### 載入提示與 Agent 動態（#390）— spec §5.30、§5.31

- 位置 **S1**：工具列正下方單行狀態條。150ms 內不顯示、載入中至少 0.6s、完成停 2s 再淡出 0.5s、失敗停 4s、播放中不跳完成。
- Agent **A1**：保留光暈但改強調色、淡入淡出、不忙碌 1.5s 後才熄。

### UI 統一第二輪 N–R（#379–#383）

- Layers 主題標題 LT1、面板層級 Z1（`Z_INDEX` 六層＋左側面板互斥）、說明／分享視窗、移除沒有功能的設定鈕（S1）、手機標頭 M1、共用 `controls/Slider`、Inter 字型清除、時間軸 TC3（收合膠囊、滑過展開）。細節見 `ui-consistency-audit-20260927/handoff.md` §4a 第五輪。

## 2026-09-27

### UI 統一第一輪 A–M（#357–#372）

- popup 全部右下停靠、B 版細線緊湊；選取圈 R2 呼吸脈衝；來源 footer F2；Layers 群組 L2；面板標頭 H2；按鈕 C2；工具列 T2（右側單一底板）；底圖選單 B3；圖層控制 V2＋S1；資料來源 D1；不載入 web font、只用系統字；開 `CONTROL.*` token。細節見 `handoff.md` §4a 第一～四輪。
- 設計稿一律暗／淡並排、用代號讓使用者選（之後每一輪沿用）。

## 待辦（跨輪）

- 地圖：R3 線與面、R4 圖例對齊（28 個不一致）、R5 熱區＋P-3 密度透明度＋聚合泡泡、R6 Three.js／Mapbox 切換（範圍與切換位置待決）。
- `LegendPanel.tsx` 手寫色票 90 處（ratchet 只准減少）、圖例附註改用 `LegendNote`、registry 內失效的半徑字面值清理（spec §10.3）。
- 時間軸：播放會播進未來、暫停後會被自動播放重啟（未修）。
