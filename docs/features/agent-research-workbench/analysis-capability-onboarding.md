# 圖層分析能力接線手冊

更新：2026-09-19。這份文件補充 `layer-onboarding`：新圖層除了能畫、能調、能點，也要能被 Codex 找到，並明確回報可以與不可以做的基礎分析。

## 完成標準

每個新 layer key 至少要完成 metadata 能力；可執行的 record search 與統計則依來源證據逐項開放。

1. `pulse_search_layers` 能以名稱、主題或關鍵字找到圖層。
2. `pulse_list_layer_capabilities` 能列出圖層的 transport、analysis status 與已驗證能力。
3. 能說明資料來源、版本／時間、範圍、一筆代表什麼、geometry 角色與已知缺值。
4. 沒有完整來源或可驗證 aggregate 時，統計能力維持 `needs_contract` 或 `needs_aggregate`；不可用畫面點位數代替。
5. 只有經過欄位白名單、分頁與來源驗證的資料，才開放 `pulse_search_layer_records`。
6. 只有已驗證的 measure 才能由統計工具執行；載入失敗、schema 不合或過期不可回 0。

## 先分清三件事

- **Layer key** 是使用者在前端開關的呈現入口。同一份資料可能有多個 key。
- **Dataset** 是可計數、搜尋或量測的來源。同資料的多種顏色、分類與縮放呈現應共用一份契約。
- **Render type** 是 Mapbox 怎麼畫，例如 circle、line、fill。它不能證明一筆資料代表什麼，也不能單獨決定可做的統計。

例：polygon 資料可能同時用 fill 與 line 畫邊界，仍是一份來源；line 畫法也可能只是 polygon 的外框，不能直接當道路長度相加。

## 新圖層接線順序

### 1. 先完成既有 layer-onboarding

確認 upstream handoff、manifest、catalog、loader／hook、overlay、legend、popup、控制項、資料筆數與 browser 顯示。HTTP 200 若內容其實是 SPA HTML，視為資料載入失敗。

### 2. 建立 dataset mapping

為 layer key 指到穩定的 dataset identity，並記錄：

- source URL、RPC、stream 或檔案，以及版本／年份與授權。
- `recordGrain`：一筆是學校、校區、地址、道路段、行政區指標、事件或狀態快照。
- `dataRole`：point、event、line、network、polygon、boundary、grid、raster、statistic、snapshot、stream 或 mixed。
- `transport`：GeoJSON、PMTiles、RPC、stream、image、binary 或 custom。
- `timeModel`：static version、historical slice、snapshot 或 event stream。
- coverage、missingness、未匹配、重複 ID 與 geometry 缺失政策。

以下不可只靠 manifest 或畫法自動推定：唯一實體 ID、官方完整性、資料粒度、長度／面積單位、時間語意、可比較性與是否能公開搜尋。

### 3. 選擇完整資料路徑

| 來源 | 建議做法 | 禁止捷徑 |
|---|---|---|
| 小型完整 GeoJSON | 驗 schema、hash、筆數後由有界 loader 讀完整來源 | 不以 viewport 或 Mapbox rendered features 計數 |
| PMTiles | 產生與 tiles 同版本的 sidecar summary／search index | 不下載全檔、不把抽稀 tile feature 當完整資料 |
| Supabase／API | 使用有 LIMIT、索引與 timeout 的 aggregate／search RPC | 不把大量 records 拉回 browser 再統計 |
| 即時 stream | 來源端維護 window aggregate、freshness 與 watermark | 不把目前記憶體快照說成歷史總量 |
| custom／Three.js／raster | 先辨識真正 dataset 與資料角色，再接 sidecar 或 adapter | 不因 custom hook 存在就推定可統計 |

Sidecar／aggregate 指的是「和主資料同版本、體積很小、已先算好」的摘要或索引，例如總筆數、分類 counts、時間範圍、NoData 與行政區分組。它讓 Agent 快速查詢，不必下載整份 PMTiles 或重播即時資料。

### 4. 宣告能力，預設關閉

能力狀態使用 `ready`、`pilot`、`needs_aggregate`、`needs_contract`、`unsupported` 或 `broken`。只有證據完整的能力標成 ready。

- Point／event：count、可靠 ID 下的 unique count、分類、行政區、缺座標。
- Line／network：feature count、length、分類長度；network connectivity 另需 topology 契約。
- Polygon／boundary：feature count、area、perimeter、coverage；需 CRS、geometry validity 與 overlap 規則。
- Grid／raster：cell／pixel count、resolution、valid coverage、NoData、distribution。
- Statistic：value、unit、period、numerator／denominator、ranking、missing／suppressed／zero。
- Snapshot／stream：time window、freshness、latency、change；需區分 event time 與 ingestion time。

### 5. Record search 白名單

`pulse_search_layer_records` 只回傳公開且對探索有用的欄位。每個 dataset 明列：

- 可搜尋文字欄位與可回傳欄位。
- stable sort 與 cursor／offset 規則。
- 預設及最大 page size；不得提供無上限查詢。
- 可用的欄位、bbox 與時間篩選。
- 個資、內部 ID、原始 payload 與敏感欄位不得因來源內存在就自動公開。

搜尋結果必須附 total／matched、offset／limit、truncated 或 next-page 資訊，以及來源與時間證據。找不到是 0 matches；來源失敗則回錯誤，兩者不可混淆。

### 6. 建議問題

能力說明只推薦當下能可靠回答的問題：

- 點：有多少筆、有哪些類別、哪些行政區最多、缺座標多少。
- 線：總長度、各類長度與分布；未驗 CRS／算法前不推薦。
- 面：總面積、分類面積與覆蓋；有重疊時說明是否 union。
- 統計：指標值、排名、期間與缺值，不把 feature 數當人口或案件數。
- 即時：最近更新、資料窗與變化，不把 STALE 當 0。

跨層比較前先比對單位、期間、粒度、範圍與定義；不相容時並列展示，不計算差值或比率。

## 驗收清單

### 契約與資料

- [ ] layer key 能對到 dataset，且同源多呈現沒有重複計數。
- [ ] 一筆代表什麼、來源版本、coverage、missing／unmatched／duplicate 已記錄。
- [ ] 完整來源、verified aggregate 或 sidecar 的版本關係可驗證。
- [ ] geometry 類型由實際 source schema 驗證，不只看 render type。
- [ ] 有效空資料可回 0；載入、HTML fallback、schema、timeout 失敗會 fail closed。

### 工具

- [ ] metadata search 能找到新 key。
- [ ] capability list 回傳正確 status、transport 與 measures。
- [ ] 若開 record search，欄位白名單、穩定排序、分頁上限與錯誤路徑均有測試。
- [ ] 若開 measure，總數與各分組加總可由獨立方式核對。
- [ ] 建議問題不包含尚未支援的量測。
- [ ] MCP、Gateway、browser operation 三端名稱、schema、allowlist 一致。

### 效能

- [ ] 一般 capability／record 首頁查詢保持小 payload，不回整份資料。
- [ ] PMTiles、large GeoJSON、RPC 與 stream 使用 sidecar／aggregate／索引。
- [ ] SQL／RPC 有 LIMIT；必要索引、timeout 與成本上限已驗證。
- [ ] pagination 不重複、不漏資料；排序在相同資料版本下穩定。

### 驗證證據分開記錄

- [ ] unit／schema tests。
- [ ] frontend typecheck 與 build。
- [ ] MCP build 與實際 stdio tool list。
- [ ] 實際來源 count／hash／aggregate 對讀。
- [ ] browser 單層顯示與 network response。
- [ ] 真配對 Codex → Gateway → browser E2E。
- [ ] push、PR、merge、deployment／production，各自有明確證據；未做的不可由本地通過代替。

## 建議的更新位置

新 layer 上線的同一個變更應更新 manifest／catalog 接線、dataset capability registry、record adapter 或 aggregate、三端 query allowlist／schema（若有新 operation）、測試，以及該 layer handoff。新增新的 measure 時，再同步 MCP tool description、server instructions、建議問題與驗收案例。

全站目前盤點與分批優先順序見 [layer-capability-inventory-20260919.md](layer-capability-inventory-20260919.md)；產品路線與驗收狀態見 [exploration-capabilities-plan.md](exploration-capabilities-plan.md)。
