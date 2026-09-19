# 全圖層與基礎分析工具盤點

日期：2026-09-19。範圍：layerManifest.ts、overlayRegistry.ts、目前 Codex task 實際載入的 Pulse MCP 工具。這是能力規劃盤點，不代表 760 個 layer key 都已有完整統計契約。

未來新增圖層的必要接線、快速查詢限制與驗收清單見 [analysis-capability-onboarding.md](analysis-capability-onboarding.md)。

## 結論

- Manifest 共有 **760 個 layer key、60 個有 sidebar section 的主題、10 個 orphan key**。
- 760 個 key 不等於 760 份獨立資料。多個 key 可能共用同一來源，或只是同資料的分類、尺度與視覺模式。
- 所有 layer 應先具備 metadata 搜尋與能力說明；record 搜尋、count、length、area、value distribution、freshness 依來源契約逐批開放。
- 新版 MCP dist 已驗證 **23 個工具**；目前桌面 task 需重新載入後才會取得新版。地圖探索工具可用；完整來源統計與 record search 只對 schools 與 policeStation／policeStations 宣告支援。
- 已新增兩個通用工具：pulse_list_layer_capabilities 與 pulse_search_layer_records。幾何量測仍擴充既有 describe／summarize，不為點、線、面各開一套重複工具。

## 1. Manifest 與來源接線

### 依前端資料接線類別

| Data class | Layer keys | 意義 | 基礎統計策略 |
|---|---:|---|---|
| A | 129 | 靜態 GeoJSON，全量 fetch | 最容易先接；驗 schema、來源粒度、ID、geometry、缺值後可直接摘要 |
| B | 96 | PMTiles 按需載入 | 不以畫面 tiles 計總數；需要同版 sidecar manifest 或來源端 aggregate |
| C | 52 | Supabase／動態 loader | 使用有界 RPC aggregate；保留查詢時間、資料窗、PARTIAL／STALE |
| D | 483 | custom hook、統計、Three.js、raster、即時或自行接線 | 必須逐來源分類；不能由 custom 推定幾何或統計方法 |
| **合計** | **760** | | |

Manifest 內共有 **783 筆 source declaration**：custom 483、geojson 135、pmtiles 113、supabase 52。數量大於 layer key 是因少數 key 有多來源或多尺度。Upstream 狀態為 verified 725、pulse_only 26、catalog_missing 9。

### 標準 Overlay Registry 的渲染型態

非 custom 的 A／B／C 正好有 **277 個 unique overlay id、300 筆 config**。同一來源可產生多個 Mapbox sublayer，總計 circle 263、line 126、fill 90、fill-extrusion 4、symbol 3、raster 2。

以每個 layer key 的 render combination 歸納：

| Render family | Keys | 初步分析候選 | 注意 |
|---|---:|---|---|
| circle 或 circle+symbol | 172 | point count、分類、行政區、缺座標 | circle 是呈現方式；仍需確認一筆代表機構、地址或事件 |
| fill／fill+line／fill+extrusion | 65 | polygon count、area、perimeter、coverage | fill+line 通常是同一 polygon 畫兩次，不可算兩份資料 |
| line | 24 | feature count、length、分類長度 | line 也可能只是 polygon boundary 的呈現，需查來源 geometry role |
| raster | 2 | resolution、extent、NoData、value distribution | 畫面像素不是原始資料格數 |
| mixed circle／fill／line | 13 | mixed geometry summary | 必須按 geometry role 拆分，不直接合併量測 |
| symbol only | 1 | label／point metadata | symbol 不證明來源只有 Point |
| **合計** | **277** | | |

這張表是**渲染型態盤點**，不是完整資料幾何盤點。其餘 483 個 custom key 包含行政區統計、網格、raster、即時狀態、Three.js、HUD 與自行管理的點／線／面，下一階段需要 capability registry 才能可靠分類。

## 2. 統計型圖層

目前可辨識 **311 個統計呈現 key**，分布於下列主題：

| 主題 | Keys |
|---|---:|
| 統計比較 | 188 |
| 交通統計 | 38 |
| 教育與少子化統計 | 23 |
| 住宅存量與使用 | 18 |
| 醫療與長照統計 | 16 |
| 農業統計 | 8 |
| 畜牧／漁業／林業統計 | 各 4 |
| 水資源／廢棄物統計 | 各 2 |
| 能源／農業 Agriculture／人口／資源回收統計 | 各 1 |

這些 layer 的核心不是 geometry feature 數，而是指標值、單位、期間、地理層級、分子／分母、缺值、抑制、PARTIAL、STALE 與可比性。多個呈現 key 可能來自同一 selector／dataset，不可相加成資料總量。

## 3. 全圖層共同 capability contract

每個 layer／source dataset 應登記：

- datasetId、來源、版本／年份、取得時間、授權與完整性範圍。
- dataRole：point、event、line、network、polygon、boundary、grid、raster、statistic、snapshot、stream 或 mixed。
- recordGrain：一筆代表什麼；可否以 stable ID 計唯一實體。
- transport：GeoJSON、PMTiles、RPC、stream、image、binary 或 custom。
- timeModel：static version、historical slice、snapshot、event stream；event time、ingestion time、freshness 與 late arrival。
- supportedMeasures：count、unique_count、length、area、coverage、value_distribution、freshness、change。
- 可用 filter／group fields、單位、CRS、行政區來源、缺值與未匹配政策。
- fullSourceMode：full artifact、verified aggregate、sidecar manifest、bounded RPC 或 unsupported。
- analysisStatus：ready、pilot、needs_aggregate、needs_contract、unsupported、broken。

同一 dataset 的多個 layer key 共用一份 source contract，再由 presentation mapping 指向它，避免學校家族或統計 selector 被重複計算。

## 4. 建議工具集合

### 保留並擴充

| 工具 | 建議 |
|---|---|
| pulse_search_layers | 保留為所有圖層的 metadata 搜尋；結果增加 dataRole、analysisStatus、supportedMeasures 摘要 |
| pulse_describe_layer_statistics | 擴充成單層 capability 說明，回傳來源契約、量測、欄位、時間、品質、建議問題與拒絕原因 |
| pulse_summarize_layer | 增加 measure：count、unique_count、length、area、coverage、value_distribution、freshness、change；未驗證 measure fail closed |
| pulse_get_query_result | 保留處理 bounded async result、分頁與 expiry |
| pulse_set_layers／pulse_fit_bounds | 保留把查詢結果帶回地圖；統計 filter 不自動等於畫面 filter |
| pulse_get_time_context／pulse_set_time | 延伸支援來源 timeModel；保留 live、replay、historical statistics 差異 |

### 本輪已新增

| 新工具 | 用途 | 原因 |
|---|---|---|
| pulse_list_layer_capabilities | 依 dataRole、measure、source kind、timeModel、status 篩選與分頁列出可分析圖層 | 已接760 keys；未驗證者回 unknown／not_registered，不從 render type 猜測 |
| pulse_search_layer_records | 在單一已宣告來源做文字、等值欄位 filter 與分頁搜尋 | 首批只開 schools／policeStation；bbox、time filter 留待各來源契約補齊 |

暫不新增 geometry-specific tool。點、線、面、網格由 capability 與 measure 決定，避免 count_points、sum_lines、area_polygons 各自長出不同分頁、錯誤與 provenance 契約。

跨層比較工具延後到 comparability gate 穩定後再決定。近期可由多次 pulse_summarize_layer 並列結果；只有單位、時間、粒度、地理範圍、來源定義相容時才計算差值或比率。

## 5. 現有 23 個 MCP 工具白話狀態

| 工具 | 白話用途 | 目前狀態 |
|---|---|---|
| pulse_pair_session | Codex 接手瀏覽器建立的配對票 | 已載入；需要網站先建立配對並由使用者核對短語 |
| pulse_get_session | 看配對是否成功、何時到期 | 已載入；不回傳秘密憑證 |
| pulse_disconnect_session | 撤銷這次本機研究連線 | 已載入；會使目前 session 失效 |
| pulse_get_study_state | 看目前研究場景與 revision | 已載入；需完成配對 |
| pulse_get_map_context | 看鏡頭、可見圖層、面板與載入狀態 | 已載入；是畫面狀態，不代表完整資料 |
| pulse_get_time_context | 看 live／replay、時間游標與可用日期 | 已載入；未知日期不等於沒有資料 |
| pulse_search_layers | 依名稱或主題找圖層 | 已載入；搜尋 metadata，不搜尋圖層內每筆紀錄 |
| pulse_list_layer_capabilities | 列出哪些圖層目前能做什麼查詢 | 新版 dist 已驗證；760 keys 可查，只有學校與警察正式開放 count／record search |
| pulse_search_layer_records | 搜尋某一圖層內的安全紀錄欄位 | 新版 dist 已驗證；限學校／警察，每頁最多20筆，其他層明確不支援 |
| pulse_get_layer_details | 一次比較 1–3 個圖層的來源與相關層 | 已載入；不讀完整 records |
| pulse_describe_layer | 說明單一圖層的登記資訊與可用性 | 已載入；metadata 不是 geometry 證據 |
| pulse_describe_layer_statistics | 先說清楚怎麼計數、可用欄位與缺值 | 已載入；目前只正式支援學校與警察來源 |
| pulse_summarize_layer | 算總數、篩選、分組、排序與分頁 | 已載入；目前只有 count，且只支援學校與警察來源 |
| pulse_get_query_result | 取得非同步查詢的完成結果 | 已載入；expired／error 不可解讀成 0 |
| pulse_find_places | 搜尋網站內建的命名視角 | 已載入；是 viewpoint preset，不是地址搜尋 |
| pulse_geocode_address | 搜尋本機候選地址或解析明確座標 | 已載入；資料範圍有限，不是全台門牌服務 |
| pulse_set_layers | 一次設定最多 20 個圖層開關 | 已載入；switch ready 不保證資料已成功載入 |
| pulse_get_layer_controls | 讀取圖層可調的 slider／select／toggle | 已載入；只回目前允許操作的控制項 |
| pulse_set_layer_control | 用網站同一套規則修改一個控制項 | 已載入；要先讀 controls，修改後再讀一次 |
| pulse_set_camera | 移動到明確中心點與 zoom | 已載入；不會自行推定分析範圍 |
| pulse_fit_bounds | 讓地圖框住一組 EPSG:4326 範圍 | 已載入；只移鏡頭，不會篩選資料 |
| pulse_set_time | 切換 live／replay 與每日時間游標 | 已載入；目前是既有 daily timeline，不等於多年統計切換 |
| pulse_wait_scene_ready | 等待地圖命令真正完成或失敗 | 已載入；accepted／applied 不等於資料 ready |

## 6. 推薦執行批次

1. **Registry first**：為 760 keys 建立 dataset mapping 與 capability registry；先處理 10 orphan，避免幽靈 toggle 進入分析目錄。
2. **GeoJSON point batch**：從 129 個 A 類 keys 去重成 source datasets，批次驗 count、ID、category、admin、missing geometry。
3. **四種 pilot**：各選一個可信的 line、polygon、grid/raster、administrative statistic，建立 length、area、value distribution、NoData 契約。
4. **PMTiles／RPC aggregate**：為 96 個 B 類及 52 個 C 類建立同版 sidecar／RPC aggregate，不使用 viewport feature count。
5. **Custom split**：把 483 個 D 類拆成 statistics、realtime、Three.js、raster、grid、mixed geometry、HUD／非地圖及未實作。
6. **Time and comparison**：最後加入 freshness、change、historical comparison 與 comparability gate。

## 證據界線

- 本盤點的 760／資料類別／來源類別／overlay render counts 是直接載入 TypeScript registry 後計算。
- Render type 只能說明前端怎麼畫，不能獨立證明來源 geometry 或分析粒度。
- 目前沒有逐一讀取 760 keys 的完整來源資料，也未聲稱全部 layer data ready。
- 實際瀏覽器與 full-source 資料證據仍只有已驗收的學校、警察，以及啟動時另核對的公共圖書館資產。
