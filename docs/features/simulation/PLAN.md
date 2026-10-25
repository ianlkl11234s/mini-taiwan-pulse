# 模擬面板（數位雙生方向）— 規劃

> 狀態：規劃中（2026-10-24），尚未開工。
> 範圍：在主地圖左側 IconRail 新增與「台灣／統計／全球／日本」並列的「模擬」面板，共用底圖與既有圖層；第一批放「雙北跨河橋梁中斷」與「公車早尖峰擁擠」。
> 上游研究（只連結不複製）：
> - 公車：`../../../../taipei-gis-analytics/docs/topic-research/bus_crowding/`（REPORT.md、pulse_integration_plan.md、scenario_contract.md、range_amshare.md）
> - 橋梁：`../../../../taipei-gis-analytics/pipelines/analysis/bridge_resilience/README.md`；前端 handoff：[`../network-structures/handoff.md`](../network-structures/handoff.md)

## 0. 已拍板

| 日期 | 決定 |
|---|---|
| 2026-10-24 | 模擬放主地圖內的獨立面板（甲），不做獨立頁面；理由是要能疊既有 POI、共用底圖 |
| 2026-10-24 | 橋梁、公車兩個模擬都搬進模擬面板 |
| 2026-10-24 | 實驗內**不放**醫院、消防等疊圖捷徑；之後再決定要不要加 |
| 2026-10-24 | 對比在同一張地圖內做（前後切換、差異圖、面板數字對比），不做雙地圖拖拉 |
| 2026-10-24 | D-1 第一版只有站主看得到（匿名不顯示模擬面板） |
| 2026-10-24 | D-2 沿用現有圖層面板（甲-1），每個實驗＝一個主題群組 |
| 2026-10-24 | D-3 公車人數兩版都放：預設顯示範圍與兩版都成立的排名；進階提供「較寬鬆（7–9 時佔全日 13.7%，YouBike 推估）／較擁擠（18.0%，捷運推估）」切換，各看各的地圖 |
| 2026-10-24 | D-4 選橋、選路線只靠地圖點選 |
| 2026-10-24 | D-5 日夜人口是「用手機信令推估出來的模擬值」：可當活動需求（公車擁擠即如此使用），但總數是日＋夜加總，仍不可當人均分母，人均一律用戶籍人口 |
| 2026-10-24 | D-6 只搬雙北已完成的「雙北跨河橋梁韌性」；全臺橋梁點位／方向候選留在交通 |
| 2026-10-24 | 本面板取代 2026-10-21 的「進階分析專區」構想（analytics BACKLOG B248、`pulse_integration_plan.md`）；上游 backlog 之後同步 |
| 2026-10-25 | 公車擁擠資料選乙：只有站主讀得到，走既有私人 Range API（同橋梁韌性），不放 `public/`、不進公開 CDN；部署見 §6 |

## 1. 為什麼要獨立面板

圖層回答「現在是什麼」，模擬回答「如果發生某件事會怎樣」。兩者資料性質（實測／推估）、操作（看／調情境）、可信度要求不同，所以入口分開；但結果畫在同一張地圖上，使用者可以自行打開既有圖層對照。

模擬面板的共通語言（每個實驗都照這五段）：

1. **情境設定**：選要拿掉的橋、選方案、參數版本
2. **基準 vs 情境**：前後切換或差異圖
3. **影響擴散**：村里著色、路段負載、車輛回放
4. **結果與可信度**：排名、範圍、資料限制
5. （之後）**復原曲線**

## 2. 面板結構：兩條路

| | 甲-1（建議） | 甲-2 |
|---|---|---|
| 做法 | 模擬面板仍用 `LayersPanel`；每個實驗＝一個主題（L2 群組），控制項全部走 `layerParamsSpec` | 第一層做「實驗卡」新元件，點進去才展開情境與圖層 |
| 新元件 | 無 | 實驗卡（狀態、展開規則都要先補 spec §5.5／§5.27） |
| 覆蓋度 | 現有 6 種控制型別（slider、toggle、select、multiSelect、palette、linkedSelect）＋`showWhen`／`cascade` 已涵蓋大部分調整項，見 §3 | 同左，外加卡片層級的說明與狀態 |
| 風險 | 實驗說明只能放在群組描述與圖例；缺播放列等元件（§3 缺口）仍要補 | 新元件要過 §8 checklist、手機版、i18n，工作量高一階 |

建議先做甲-1，等實驗超過 3–4 個、群組描述不夠用時再評估甲-2。

## 3. 調整項 × 設計規格對照

規格依據：[`../../design-system/spec.md`](../../design-system/spec.md)、[`../../design-system/map-layers.md`](../../design-system/map-layers.md)。

| 調整項 | 沿用 | 缺口 |
|---|---|---|
| 方案、時段、權重、指標（≤3 選項） | select 自動轉分段（§5.8；`LayerParamControls.tsx:172`） | — |
| 方案（>3 選項，例如公車 7 個情境） | 原生 select（§5.9） | — |
| 參數版本 0.137／0.180 | select，數值放 label（§6.2） | 版本命名文案（使用者看得懂的叫法） |
| 距離遞減 τ | `showWhen` 帶出 slider（§5.13） | — |
| 前後切換 | 分段（§5.8）；橋梁替代路線已用同一圖層 variant filter | **S-3** 切換時圖例怎麼一起換 |
| 差異圖（情境－基準） | map-layers F-3（正負用 PuOr） | **S-4** 差異面、圖例、零值與缺值畫法 |
| 選橋／選路線 | 地圖點選＋popup（§5.4）；橋梁已在 `useMapInteraction.ts:428` | 面板端是否也要選單，與地圖點選同步 |
| 時間播放（公車回放） | §5.24 時間軸規則、`controls/Slider`、lucide Play／Pause | **S-1** 面板內播放列元件；現有 `EarthquakeReplayPanel`、embed 播放列都不符合規格，不能照抄 |
| 可信度／待複核標記 | 限定詞小標籤（§5.5，「研究中」） | **S-2** 全站共用的可信度徽章；§5.21 只允許 `chipTint`／`chipOutline` 兩種公式，要沿用其一或修訂 §5.21 |
| 推估線（公車路段） | map-layers L-2：推估用 `[2,2]` 虛線 | — |
| 數字與範圍 | `Row`、`FONT_DATA`、§6.2；缺值顯示「—」 | 範圍「A～B」寫法併入 §6.2 |

另外要處理的既有違規：橋梁 popup 用 `.fi-seg`／`.fi-btn` 重做一套 weighting、mode 等控制（`bridgeResiliencePanels.tsx:61-72`、`:330-335`），「待複核」是 inline 虛線 pill（約 `:325`）。搬進模擬面板時一併收斂：控制留在面板，popup 只顯示結果。

## 4. 分期

### Phase 0 — 先補規格（不寫程式）
- 狀態：規格已寫入 spec §5.40、map-layers F-3a（2026-10-24，待使用者看示意後合併）
- 在 spec 補 S-1 播放列、S-2 可信度徽章、S-3 前後切換的圖例、S-4 差異圖；§5.1「四個入口」改為五個；§6.2 補範圍寫法。
- 驗收：spec PR 合併；S-1～S-4 各有一節可引用。

### Phase 1 — 面板骨架＋搬橋梁（不加新資料）
- 狀態：已實作於分支 `feat/simulation-panel-phase1`（2026-10-24，待 PR；`showSimulation` 由 App `isOwner && !memberAuthLoading` 傳入 rail 與手機；主題「雙北跨河橋梁中斷」、群組「橋梁中斷」）
登記處（漏一個測試就會紅）：
- `src/components/sidebar/layerPanels.ts`：`LayerPanelId` 加 `simulation`、`LAYER_PANELS` 加一筆、`*_TAB_THEME_TITLES`；`MAIN_THEMES` 排除新主題
- `IconRailSidebar.tsx`（`panelSearch` 初值、`togglePanel`、`RailIcon`）、手機版 `LayerSidebar.tsx:231`
- `src/research/explorationNavigation.ts` 的 `ExplorationPanel`
- `layerCatalog.ts`：`THEME_NAMES`、`THEME_MACRO_GROUPS`；從「橋梁研究（進行中）」群組（約 `:754`）移出 `bridgeResilienceTwinCity`，群組其餘兩層留在交通（依 D-6）
- `layerManifest.ts`：`bridgeResilienceTwinCity` 的 section 改到新主題（`layerManifest.test.ts:124` 比對 section 與 THEMES）
- i18n：`common.json` 加 `panel.simulation.*` 後跑 `scripts/i18n/gen-keys.ts`；`themes.json`
- 重產 `layer-style-inventory.json`（`npm run design:audit-layers`）；只搬位置時 `layer-golden.json` 不變
- `GATED_LAYERS` 保留橋梁（站主限定不變）；rail 抽屜不需進 `leftPanelMutex`
- 驗收：`npm run check` 全綠；agent-browser 站主登入看得到模擬面板與橋梁，匿名看到鎖定狀態（依 D-1 決定）；原「交通」分類不再出現「雙北跨河橋梁韌性（研究中）」，全臺橋梁點位／方向候選兩層仍在交通。

### Phase 2 — 公車擁擠：靜態研究圖層（pulse_integration_plan 的 C 案）
開工前驗證清單（目前都**未驗證**）：
1. 跑 `p3_export_viz.py` 匯出 0.137 版（模型已跑完，只缺匯出），量大小
2. 比對 Pulse `public/bus/*_bus_routes*.json` 與 bus_crowding `shapes.geojson` 是否同一版線形（RouteUID 格式已確認一致）
3. 確認 `StationID` 是否跨城市撞號；對照改用 `StationUID`
4. s2 區間車、s3 新接駁線是合成線（s3 只是站點連線），決定是否畫、怎麼標

內容：
- 路段負載圖層（超載班次比例，班次 <5 的段不畫，推估用 `[2,2]` 虛線）、站點圖層（被拒人次範圍、候車壓力）
- 控制：參數版本 0.137／0.180、方案（基準＋7 個情境）、前後或差異
- 資料：預先打包，路段與站點每版約 1–2 MB（預估），情境差異包各約 0.1–0.2 MB gz（預估）；切換只換檔，不在瀏覽器重算
- 走 `/new-layer` 骨架＋layer-onboarding 驗收（四鐵則）；資料放私人 S3 sidecar（2026-10-25 拍板乙，見 §6）

對外口徑（上游已拍板，圖例與 popup 照做）：
- 人數一律寫「0.137 版～0.180 版」範圍，預設只顯示排名與超載比例，不顯示單班人數
- 圖層名加「推估」，圖例註明「平日 7–9 時、資料日 2026-10-14、模擬推估，非實測」
- 「被拒人次」附定義（同一人被拒兩次記兩次）
- 不講單一版才成立的結論（例如「加車比調度有效」）；新北市區公車、沒有班次的段標「未涵蓋」

### Phase 2a — 公車結果入分析倉庫（A 案，可與 Phase 2 並行）
- 路線排名、站點、方案排名三表進 pulse-data registry（含 warehouse 區塊與口徑 pitfalls：人數為兩版範圍）＋發包組裝，讓 Agent 能把模擬結果和既有 POI 交叉（CLAUDE.md §5b）
- 未入倉前，圖層標 `DISPLAY_ONLY`

### Phase 3 — 公車回放依負載上色（D 案）
- 另開 hook，不動 `useBusLayer`／`BusScene`（它們吃的是真實 GPS，不是模擬班次）
- 用獨立播放時鐘（範本 `src/state/earthquakeReplayClock.ts`），不掛全站 timeStore；UI 用 Phase 0 的 S-1 播放列
- 班次資料切成「路線 × 班次」gz，點路線才載入（基準 4.2 MB，gz 後約 1 MB，預估）；單班剖面放 popup 或面板
  - **2026-10-25 實作偏離**：全城動畫需要全部班次，改為開啟「時間回放」時整包載入基準 trips＋該方案 diff（組法同原型 index.html:183–184），切版本才換檔；每班每站只輸出負載分級 0–3（不含人數），基準約 1.9 MB／gzip 0.45 MB、線形 gzip 0.54 MB。單班剖面這一刀未做。
- 依 map-layers G-1 R6 修訂：車輛是移動物件，「立體效果」預設開、可關；關閉時照 R6 段 3 的平面規則（圓點、z≥12 方向箭頭）

### Phase 4 以後 — 新實驗候選
見附錄 A。建議順序：淹水情境切換 → 急救醫院停收 → 捷運站關閉；橋梁 Phase D（斷橋後醫院、消防可及性）價值最高，但受授權限制與 3 個待決事項，排後面。

## 5. 待決事項

| ID | 問題 | 選項 | 建議 |
|---|---|---|---|
| D-1 | 第一版誰看得到 | (a) 全部站主限定，匿名隱藏整個面板；(b) 匿名看得到面板，橋梁鎖定、公車公開；(c) 公車只公開排名層 | (a) 先內部驗收，公車口徑看過畫面再開放 |
| D-2 | 面板結構 | 甲-1／甲-2（§2） | 甲-1 |
| D-3 | 公車參數版本怎麼呈現 | 切換 0.137／0.180；或只顯示範圍、不給切換 | 預設顯示範圍，進階才切換（兩版結論在 s4 上不同，不能只放一版） |
| D-4 | 面板端要不要選橋／選路線清單 | 只靠地圖點選；面板加選單同步 | 先只靠地圖點選 |
| D-6 | 橋梁搬哪些圖層 | 只搬「雙北跨河橋梁韌性」；或整個「橋梁研究（進行中）」群組 | 只搬韌性圖層；全臺橋梁點位／方向候選是現況清冊，不是 what-if，留在交通 |
| D-5 | 人口分母口徑 | registry 說日夜人口是模擬值，bus_crowding `daynight_caliber.md` 說是信令實測 | 開工前先釐清；在此之前新實驗的分母一律用戶籍人口 |

## 6. 公車擁擠：站主私人資料與部署（2026-10-25）

資料只經 `/api/private-research/bus-crowding/<key>`（`server/coral-private/coral-private-server.mjs`，與橋梁韌性同一個 sidecar、同一套站主驗證與撤銷名單）。key 只能是白名單裡的 34 個（`segments`、`lines`、`v137|v180-<方案>`、`v137|v180-trips-<方案>`），請求不能指定路徑；`meta.json` 不在白名單。每個檔的大小與 sha256 釘在 `server/coral-private/bus-crowding-assets.mjs`，前端 `src/data/busCrowdingSimAssets.ts` 同一組數字（測試逐一比對）。

| 環境 | 資料位置 |
|---|---|
| 本機 | repo 根目錄 `bus-crowding-sim.local/`（`*.local` 已在 .gitignore／.dockerignore）；sidecar 預設讀這裡，可用 `BUS_CROWDING_PRIVATE_ROOT` 改指 |
| 正式站 | 私人 S3 `migu-private-research-ap-southeast-2`，key `private-research/bus-crowding/<sha256>/<filename>`（`PRIVATE_RESEARCH_STORAGE=s3`，sidecar 啟動時逐檔驗 size／sha256） |

重產資料：`python3 scripts/preprocess/build-bus-crowding-sim.py --write-contract`，會同時重寫兩份契約檔與 `bus-crowding-sim.local/local_validation.json`；資料一變 sha256 就變，契約檔要跟著 commit，S3 也要重新上傳（舊物件在不同 sha 前綴，不會被覆蓋）。

本機預覽：`npm run dev:private-research`（port 8796）＋`npm run dev`；vite 把 `/api/private-research/bus-crowding` 代理到 8796。未登入或不是站主時，圖層鎖住；存取被拒時關圖層並顯示提示。

發版當天（develop 合進 master 之前，使用者明確授權後才執行）：
1. 確認 `bus-crowding-sim.local/` 與契約一致（上傳腳本會再驗一次）。
2. `S3_ACCESS_KEY=… S3_SECRET_KEY=… node scripts/deploy/upload-bus-crowding-private.mjs <repo>/bus-crowding-sim.local`：逐檔核對 `local_validation.json`、契約、磁碟位元組三者一致；bucket policy 沒有公開 Allow；`IfNoneMatch` 上傳、SSE、`Cache-Control: private, no-store`；讀回比對 sha256；匿名 HEAD 必須 403。
3. 合併部署後，sidecar 暖機會逐檔從 S3 驗證；任何一檔缺失時只有本家族回 503（`private bus crowding sidecar unavailable`），其他私人圖層不受影響。
4. 正式站站主登入驗收：模擬面板開「公車路段超載班次比例」，切方案、切版本、切時間回放；匿名開啟應被鎖住。

nginx 只放行白名單 key（`location ~ ^/api/private-research/bus-crowding/(...)$`），其餘路徑 404，不會落到 `/data` 或 SPA。

## 附錄 A：既有資料可做的模擬（2026-10-24 盤點）

計算分級：A 事先算好靜態結果；B 事先算好多組情境讓使用者切換；C 瀏覽器即時算；D 需呼叫服務（valhalla 要 token，瀏覽器不能直接呼叫，只能走 Agent／MCP）。

| # | what-if | 現有資料 | 級 | 可信度 | 主要限制 | 量 |
|---|---|---|---|---|---|---|
| 1 | 斷橋後到急救醫院、消防多花幾分鐘（橋梁 Phase D） | 橋梁移除模擬 v4、醫院、分隊 | B | 排名可信 | 橋梁資料授權 HOLD 只能站主；3 件事待拍板；47 座橋未複核 | M |
| 2 | 捷運站關閉影響多少旅次 | 北捷站對站分時 OD（2026-08／09）、站序 | B／C | 只看排名 | 缺列車容量；1 站名對不上 | M |
| 3 | 早尖峰捷運哪段最擠 | 同上 | B | 只看範圍 | 容量是假設 | M |
| 4 | 某急救醫院停收，誰車程變長 | 醫院名冊、醫療等時圈 | B→C | 較可信 | 表疊 3 份名冊要去重；未含壅塞 | M |
| 5 | 消防分隊停勤，5 分鐘覆蓋缺多少 | 分隊點位 | B／C | 較可信 | 要重算單隊等時圈 | M |
| 6 | 選設計降雨，哪些道路、醫院、收容所、村里會淹 | 淹水潛勢 10 情境、設施、戶籍人口 | B | 較可信（只看暴露） | 各情境涵蓋縣市不同，不能相加；部分深度標籤損壞 | S |
| 7 | 收容所容量夠不夠 | 預定收容處所 PMTiles（含容量） | A／C | 只看範圍 | 倉庫表 0 列要重入；「預定」不等於會開設 | S |
| 8 | YouBike 能不能補捷運 | 北市 2026-02 租借 trips | C | 只看排名 | 只有北市、與捷運 OD 不同期 | M |
| 9 | 公車路線停駛，哪些站失去服務 | 站序、班表、擁擠模型 | A／B | 靜態版較可信 | 情境契約沒有「停駛」要新增 | S／M |
| 10 | 歷史地震重演暴露 | 鄉鎮震度、斷層 | B | 較可信（只看暴露） | 是重演不是預測；液化只限站主 | S |
| 11 | 颱風路徑風圈內人口 | 颱風軌跡（部分有風圈） | B | 只看範圍 | 風速不等於災損 | S |
| 12 | 土石流斷路後哪些部落成孤島 | 孤島清冊、土石流溪流、省道災情 | B | 只看排名 | 斷點要人工指定 | M |

不能做或只能做弱版：停電範圍（缺輸配電拓樸）、地震損害推估（缺衰減模型與建物易損）、新北 YouBike（無 trips）、真實擁擠人數（缺刷卡與車廂容量）。

此表之後可搬到 `.gis-agent-system/roadmap/candidates/`。
