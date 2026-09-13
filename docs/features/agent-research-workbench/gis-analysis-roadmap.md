# Mini Taiwan Pulse 理想 GIS 分析總路線圖

> 更新日期：2026-09-14
>
> 狀態：本地規劃基準；未 push、未部署
>
> 淺白互動說明：[gis-analysis-roadmap-guide.html](./gis-analysis-roadmap-guide.html)
>
> 工程版流程圖：[gis-analysis-roadmap-interactive.html](./gis-analysis-roadmap-interactive.html)
>
> 現行工具細節：[tool-foundation-plan.md](./tool-foundation-plan.md)
>
> 已完成驗收：[acceptance.md](./acceptance.md)

## 本輪增量

2026-09-14 已實作 Semantic Registry、單機 SQLite Research Library 與真實 schools 150m occupied grid。4,315 筆來源校址紀錄 → 4,061 個格網，來源觀測時間與授權 unknown，維持本地 HOLD。詳細重算／CLI／主地圖流程見 [tool plan](./tool-foundation-plan.md)；各證據面見 [acceptance](./acceptance.md)。學區、房價、network 仍 HOLD；沒有 production 交付。

## 一句話目標

把 Mini Taiwan Pulse 從「可以把很多資料畫在地圖上」，推進成「Agent 能知道資料代表什麼、不能代表什麼，選擇合適方法交叉分析，留下可重算證據，再把結果呈現在原本主地圖上」的 GIS 分析系統。

核心循環不變：

```text
資料來源
  → datasetId（知道這份資料是什麼）
  → analysis（用受控工具與方法運算）
  → resultId（留下可追溯結果）
  → 主地圖／表格／圖表／說明
  → 驗收與監看
  → 回饋資料與方法
```

圖層只是結果的顯示出口，不是分析系統本身。

## 現在已經站在哪裡

| 能力 | 目前狀態 | 已有證據 | 還不能宣稱 |
|---|---|---|---|
| 資料契約 | **基礎完成** | `DatasetDescriptor` 已描述 grain、時間、geometry、限制與來源 | 尚未覆蓋每個可分析資料集 |
| 共用讀取 | **基礎完成** | Query Executor、budget、receipt、hash 與 access plan 已接通 | 尚無完整分區 materialization 與持久 cache |
| 工具表面 | **基礎完成** | 37 個 research MCP tool schema 已由 source build 的 SDK host 驗證 | 不代表每個工具都有所有資料型態的正式 adapter |
| 結果生命週期 | **session 版完成** | `resultId` 可供後續空間、彙總、品質、證據與呈現操作引用 | 尚未形成跨 session 的研究檔案庫 |
| 主地圖呈現 | **Point 基礎完成** | 本地 Agent 已搬入 app rail；可呈現多組點結果與 fit bounds | polygon、line、raster、network 與圖表比較仍未完成 |
| 學校點資料 | **真實樣本完成** | 4,315 筆合法 Point；臺北車站直線 1 公里查到 9 筆來源紀錄 | 不是 9 個獨立機構、不是步行可達性；license／freshness 仍 unknown |
| 新聞事件 | **部分完成** | 2026-09-12 指定 selector 合法 0 筆；proxy geometry 被拒絕做精確半徑分析 | 不能推論其他日期也沒有事件；非空真實樣本尚待補證 |
| 行政統計 | **讀取完成、上圖未完成** | 固定 release 368／368 鄉鎮、總計 158,701.13 公頃、狀態 STALE | 未接版本相符邊界前，不能直接畫成行政區統計圖 |
| 醫院點資料 | **HOLD** | adapter 已有 | 此工作樹缺實際受管資產，不能冒充可用 |
| Production | **未完成** | 只有本地 runtime 與 browser 證據 | 沒有部署、正式監控、TLS／auth 與 production readback 證據 |

這個基準刻意分開「程式已存在」、「本地資料可讀」、「瀏覽器有呈現」與「正式環境健康」，避免一個綠燈掩蓋其他缺口。

## 理想系統需要補齊的八個支柱

### 1. 可追溯資料底座

每份資料都要能回答：

- 從哪裡來、依什麼授權使用。
- 何時取得、對應哪個版本或 release。
- 原始檔的 checksum、bytes、row count 與 coverage。
- geometry 是原始座標、行政區代表點、推估位置，還是根本沒有 geometry。
- `0`、`null`、suppressed、missing、stale、denied、error 是否被分開保存。

要補：完整 source registry、固定版本 artifact、資料健康 readback、license 與 freshness 證據。

### 2. Dataset Contract

`DatasetDescriptor` 是 Agent 使用資料前的說明書，至少包含：

- `datasetId`、record grain、主鍵與去重規則。
- 時間語意：發生、發布、觀測、可用、更新時間。
- 空間語意：geometry type、精度、CRS、boundary version。
- 可用 operation 與禁止 operation。
- 欄位定義、單位、缺值與 suppression 規則。
- 來源、授權、更新頻率與已知限制。

要補：把目前四個 pilot 擴展成可重複 onboarding 的契約檢查，而不是手動靠記憶。

### 3. GIS Semantic Registry

這是下一個最重要的核心。它不是另一份手寫 layer registry，而是替既有 dataset／layer catalog 補「分析語意」。每個可用概念都分成四層：

| 類型 | 意義 | 學校例子 |
|---|---|---|
| `observed` | 來源直接提供的紀錄／主張；仍受來源品質限制 | 名稱、位置、學制 |
| `derived` | 有明確方法可重算的指標 | 到最近學校的直線距離、行政區學校密度 |
| `proxy` | 可替代觀察，但不能當成事實 | 用學校位置近似學生可能聚集區 |
| `hypothesis` | 需要其他證據驗證的推論 | 上下課時段人流較高、周邊客群偏學生 |

每筆語意還要有：

- 適用的空間與時間尺度。
- semantic version 與適用的 dataset version。
- 必要的支援資料。
- 計算方法與版本。
- confidence、evidence status、evidence references 與審核來源。
- `prohibitedClaims`，明列不能直接跳到的結論。

confidence 不能由 Agent 自行把 `hypothesis` 升級為 `observed`；缺少必要 evidence 時必須保留假設或拒絕分析。

例如「附近有學校」不能直接等於「安全」、「清幽」、「居民教育程度高」或「學生健康風險高」。要做這些判斷，還需要事故、噪音、空污、人口、時段、人流或問卷等證據。

### 4. 可組合分析引擎

現在已有 filter、time window、nearby、aggregate、compare、quality 與 evidence 的基礎。理想能力還要補：

- vector：spatial join、buffer、intersection、containment、nearest、cluster。
- administrative：統計與版本相符 boundary join、跨版本 crosswalk。
- network：道路／步行／運輸路網距離、等時圈與服務範圍。
- raster：坡度、淹水、溫度、空污與其他連續表面取樣／統計。
- temporal：時段、趨勢、季節、事件前後與 baseline comparison。
- uncertainty：位置精度、樣本偏差、coverage 與敏感度分析。

每次運算都必須輸入 dataset version 與 method version，輸出新的 `resultId`，不能靜默覆蓋原資料。

### 5. Recipe 與 Skill

MCP tool 是受控動作；Skill／Recipe 決定「什麼問題該用哪些動作、順序與停止條件」。每個 recipe 應保存：

- 可回答的問題與必要輸入。
- 適用與不適用的資料 grain。
- 操作步驟、參數範圍與 budget。
- 必跑的品質檢查與負向案例。
- 失敗時要停在哪裡，而不是硬產生答案。
- 成果應用地圖、表格、圖表或敘述中的哪種出口。

### 6. Evidence 與防誤判閘門

結果必須同時帶回：

- 資料來源、版本、selector、checksum 與查詢時間。
- 排除筆數、無 geometry 筆數、suppressed／null／0 分布。
- 使用的方法、距離類型、boundary 與時間窗口。
- 可支持的結論與不能支持的結論。
- 若用了 proxy／hypothesis，清楚標示而非包裝成 observed fact。

### 7. 研究成果與呈現

`ResultEnvelope` 最終應可跨 session 保存，並能：

- 重算、比較、引用與撤回。
- 追到父 `resultId`，看出分析鏈。
- 同時產生 map overlay、table、chart、summary。
- 在 Mini Taiwan Pulse 原本主地圖中開關與比較。
- 不因圖層關閉而遺失研究結果。

### 8. 持續監看與治理

監看不只看服務有沒有回 200，而要分成五個證據面：

| 面向 | 持續看的指標 | 失敗代表什麼 |
|---|---|---|
| 資料健康 | last acquired、checksum、rows、coverage、schema drift、license | 資料可能過期、缺漏或不能用 |
| 分析能力 | recipe 通過數、資料型態覆蓋、負向案例 | 工具有名稱，但不能可靠解題 |
| Runtime | tool 成功率、延遲、budget、cache、取消／session 隔離 | Agent 循環不穩或結果互相污染 |
| Browser | ready revision、可存取摘要、overlay／表格／圖表一致 | 後端有結果，但使用者看不到或看錯 |
| Production | deployment、auth、TLS、監控、真實來源 readback | 本地成功不能等於正式可用 |

## 分析實際如何運作

1. 使用者在 Mini Taiwan Pulse 的本地 Agent 提問。
2. Agent 搜尋 dataset，而不是直接搜尋畫面上的 layer。
3. 讀取 `DatasetDescriptor` 與 Semantic Registry，判斷資料是否適用。
4. Recipe 將問題拆成受控查詢、GIS 計算、品質與證據步驟。
5. Query Executor 依 budget 讀資料，留下 access receipt。
6. 每一步產生或引用 `resultId`，保留父子關係。
7. Evidence gate 阻止錯誤 grain、proxy 精算、過期資料或因果跳躍。
8. 選擇適合的呈現出口；空間結果才上主地圖，非空間結果用表格／圖表／說明。
9. Browser 驗證使用者實際看到的內容與結果一致。
10. 里程碑監看把失敗回饋到資料、契約、recipe 或 runtime。

## 里程碑

不用假精確百分比；以「驗收閘門是否全數通過」判定完成。

| 里程碑 | 狀態 | 要交付什麼 | 完成閘門 | 完成後解鎖 |
|---|---|---|---|---|
| M0 資料契約與共用 executor | **完成** | contract、query receipt、budget、result session | 單元測試、型別、真實點資料 readback | 可重用資料讀取 |
| M1 三類 pilot 閉環 | **部分完成** | 點、新聞事件、行政統計 | 學校完成；新聞需非空樣本；統計需 boundary join | 跨資料型態 recipe |
| M2 Semantic Registry MVP | **本地 MVP 完成** | machine-readable schema、學校／新聞／統計語意、wiki view | 四類語意與禁用主張可驗證；缺 evidence 必拒絕／保留假設的負向測試通過 | Agent 能知道資料「代表什麼」 |
| M3 Vector 與行政區交叉分析 | **待做** | spatial join、buffer、nearest、cluster、versioned boundary join | CRS、距離／面積單位、geometry validity／topology、重複 join、crosswalk 權重、MAUP／生態謬誤、邊界版本與 null／0 測試 | 教育可及性、事件空間關聯／潛在暴露、服務缺口 |
| M4 Network、Raster、Temporal | **待做** | 路網／等時圈、raster sampling、時序 baseline | 直線與路網分離；旅行模式／連通性、CRS、resolution、NoData 與時間基準明確 | 步行可達、災害暴露、環境與時段分析 |
| M5 持久研究檔案庫 | **本地 asset index 完成；多人／雲端待做** | result archive、lineage、materialization、cache policy | 可重算、可撤回、跨 session、權限隔離 | 長時間自主分析與比較 |
| M6 完整成果 UX | **待做** | Point／line／polygon／raster、表格、圖表、compare | Browser 與可存取摘要一致；手機與桌面可用 | 在主地圖直接理解複合結果 |
| M7 Production 化 | **待做** | 正式 auth、TLS、監控、部署與來源 readback | production 證據獨立通過，不沿用本地綠燈 | 可持續對外使用 |

### 建議實作順序

1. M2 三張語意卡與本地 schools grid 已完成；擴展時沿用 machine-readable validator 與負向 evidence 閘門。
2. 補齊 M1 的新聞非空樣本、統計 boundary join 與醫院資產證據。
3. 完成 M3：先把常用 vector／行政區交叉分析做穩。
4. 依實際問題增加 M4，不一次把所有 GIS 演算法搬進來。
5. 有多次真實研究結果後，再做 M5 archive 與 M6 比較 UX。
6. 本地閉環穩定後才進 M7。

## 能解決哪些問題

| 問題家族 | 現在 | M2 後 | M3 後 | M4 後 |
|---|---|---|---|---|
| 附近有哪些學校／設施 | 可做直線 nearby | 會說清楚設施代表與不代表什麼 | 可疊行政區與其他點位 | 可回答步行／運輸時間 |
| 哪裡是教育服務缺口 | 只能看點與簡單彙總 | 可定義「缺口」所需人口與學制語意 | 可做人群 × 校點 × 邊界 coverage | 可用路網與時段做真實可達性 |
| 學生上下課安全 | 只能提出假設 | 會要求事故、時段、人流等證據 | 可做校點 buffer × 事故／道路 join | 可加入路網、速度、照明、時序風險 |
| 新聞事件影響哪些地方 | 可查時間與拒絕不合格 proxy | 可區分事件、報導與位置可信度 | 合格 geometry 可與人口／設施交叉 | 可做事件前後、擴散與趨勢 |
| 醫療／公共服務沙漠 | 資產未齊 | 可定義服務類型、容量與適用人群 | 可做點位、人口、行政區 coverage | 可做路網等時圈與尖峰差異 |
| 災害暴露與韌性 | 尚不足 | 可定義 hazard／exposure／vulnerability | 可做設施與行政區交叉 | 可加入 raster、時間與交通中斷 |
| 空污、噪音與環境不正義 | 尚不足 | 可區分監測值、模型面與 proxy | 可與人口／學校／醫院做空間 join | 可處理 raster、風向、時序與不確定性 |
| 土地／農業變化 | 可讀固定統計 | 可描述指標與 STALE 限制 | 可接版本相符行政界線與多期比較 | 可加入遙測／raster 與季節變化 |
| 商業選址與客群 | 只能看附近設施 | 可把「學生客群」保留為待驗假設 | 可加入人口、競品、土地使用 | 可用路網、人流時段與情境比較 |

## 可以拿來測試複雜交互的問題

以下問題會迫使系統同時處理多資料集、尺度、時間與限制，適合作為後續驗收題：

1. 哪些國中小位在事故熱點 500 公尺內，而且該行政區兒少人口較高？先標示資料年份是否一致。
2. 哪些地區學校密度看似充足，但以步行 15 分鐘計算仍有服務缺口？請比較直線距離與路網結果。
3. 某次豪雨事件周邊有哪些學校、醫院與道路可能受影響？哪些只是鄉鎮代表點，不能做精確判斷？
4. 哪些學校同時暴露於高空污、交通事故與高溫？結果對 buffer 半徑與資料解析度有多敏感？
5. 新聞量突然上升，是獨立事件增加、同一事件被重複報導，還是來源更新方式改變？
6. 水田面積下降的鄉鎮，是否也出現土地使用或人口變化？不同 boundary version 能否可靠比較？
7. 如果要新增一個醫療服務點，哪裡能改善最多未覆蓋人口？容量、交通時間與尖峰情境如何改變答案？
8. 學校附近的商業活動是否呈現明顯上下課時段差異？沒有真實人流資料時，哪些只能列為假設？

## Semantic Registry 最小資料形狀

```yaml
datasetId: tw-schools
concepts:
  - id: school_location
    kind: observed
    spatialScope: point
    evidenceFields: [geometry, sourceRef]
  - id: student_activity_area
    kind: hypothesis
    requires: [enrollment, schedule, mobility_observation]
    confidence: unknown
    prohibitedClaims:
      - nearby_school_implies_safe
      - nearby_school_implies_quiet
      - nearby_school_implies_high_education_level
allowedAnalyses:
  - straight_line_nearby
blockedAnalyses:
  - walking_accessibility_without_network
```

這份 machine-readable registry 應是 SSOT；人看的 wiki 由它產生。既有 layer manifest 只提供顯示與資料引用，不再手寫第二份重複清單。

## 持續監看的總表

每次更新只接受下列狀態：

- `COMPLETE`：所有明列閘門都有證據。
- `PARTIAL`：可用但仍缺一部分資料型態或驗收。
- `NEXT`：已排為下一個有界切片。
- `BLOCKED`：已有明確外部阻塞，並列出解除條件。
- `HOLD`：授權、語意或品質不允許繼續。

建議節奏：

| 時點 | 更新內容 |
|---|---|
| 每個功能 commit | 對應里程碑、測試、資料／runtime／browser 證據 |
| 每次資料 release | checksum、rows、coverage、schema、freshness、license |
| 每次 recipe 變更 | 方法版本、負向案例、可支持／禁止結論 |
| 每次準備部署 | 本地與 production 分開驗收，記錄 exact commit |
| 每週 | 檢查 stale、來源失敗、cache、成本與未關閉 HOLD |

不要用單一進度百分比。監看資料至少要有 `milestoneId`、`gateId`、`status`、`evidenceRef`、驗證時間、commit／source version、負責人與阻塞解除條件；頁面顯示每個里程碑的「已通過閘門／總閘門」與最後證據時間，才知道缺口是真的什麼。

目前完成的是這套監看規格與互動視圖，不是自動監控服務；互動圖上的「本輪建立」指的是規格建立。

## 每次新增資料的最低門檻

1. 來源與授權可追溯。
2. artifact 可固定版本、可算 checksum、可讀回。
3. grain、主鍵、時間、geometry 與 boundary semantics 已定義。
4. `0`、`null`、suppressed、missing、stale、error 分開。
5. DatasetDescriptor 與 Semantic Registry 已建立。
6. 至少一個正向與一個負向 fixture。
7. Query Executor 有 budget 與 receipt。
8. 結果可產生 `resultId`，並附 evidence 與 limitations。
9. 若要上圖，需另過 geometry 與 browser 驗收。
10. 若要部署，需另過 production readback；本地成功不代替正式環境。

## 文件如何保持不漂移

- 本文件是「能力、里程碑、問題與治理」的總入口。
- [tool-foundation-plan.md](./tool-foundation-plan.md) 是工具、契約與 adapter 的實作細節。
- [acceptance.md](./acceptance.md) 只保存已實際跑過的驗收證據。
- [gis-analysis-roadmap.workflow.json](./gis-analysis-roadmap.workflow.json) 是互動圖的可重建來源。
- 互動 HTML 是產物；內容變更先改來源與本文件，再重新驗證產生。
- 只有實際證據通過時才能把里程碑改成 `COMPLETE`；規劃存在不算完成。

## 下一個可直接開工的切片

**M2 Semantic Registry MVP**：先為 `tw-schools`、`tw-news-events`、`land-use:paddy-area-township` 建立 machine-readable schema、validator、三份語意資料與自動 wiki view；再讓 `describe_dataset` 能回傳 concepts、semantic／dataset versions、required evidence、allowed analyses 與 prohibited claims，並以負向測試確認缺 evidence 時不會自行升級假設。

這個切片完成後，Agent 才不只是「知道有哪些工具」，而是開始知道「什麼資料可以合理連在一起，以及何時必須拒絕回答」。
