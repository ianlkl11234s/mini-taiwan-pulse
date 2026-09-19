# Codex 地圖探索能力計劃

更新：2026-09-20。狀態：新版 MCP dist 已驗證 23 個工具；本地 3732／8791 已由本輪 recovery worktree 啟動，Gateway 已重載新 operation，學校與警察圖層有實際資料及瀏覽器顯示證據；目前桌面 task 仍需重新載入 MCP，真使用者配對待驗，未發布。此文件維護能力範圍、使用情境與驗收結果。

## 目標

使用者用自然語言透過 Codex 找圖層、理解來源與限制、計算可驗證的數量、比較不同地區與圖層，再回地圖探索。工具介面通用；每個資料來源需明確宣告支援欄位、計數粒度與完整性。不能因某層可展示就推定所有計算均可用。

## 路線與能力

| 階段 | 能力 | 狀態與邊界 |
|---|---|---|
| 探索基底 | 搜尋、來源說明、開關、設定、時間、鏡頭、故事模板 | 已有；配對 E2E 另驗 |
| 連線 | 錯誤分類、退避、續租、安全恢復、長工作階段 | 本地完成、測試通過；真使用者長工作階段待驗，保留驗證與去重 |
| 基礎統計 | 總筆數、等值篩選、分類／縣市／鄉鎮分組、排序、分頁、定位 bounds | 本地完成：學校與警察機關兩份來源契約；其他圖層未自動開放 |
| 能力目錄與紀錄搜尋 | 全部 manifest key 的 capability 狀態；單一已登記來源的文字／欄位搜尋 | 本地完成：760 keys 可分頁列出；count-ready 與 record-search-ready 目前各2層，其他明確 fail closed |
| 跨層對照 | 分別呼叫同一統計工具，並列各自數量、來源、年份、粒度與未知值 | 不自動相加、不推論因果；同源不同呈現不可當獨立資料 |
| 面積 | 來源 polygon 面積、行政區面積、單位與計算方法 | 待做：先確認 CRS、幾何有效性、重疊／去重、boundary 版本；點不代表校地／轄區面積 |
| 面積衍生比較 | 經驗證分母後的每平方公里數量、覆蓋占比 | 待做，不因有總數即開放；未知分母不可計算 |
| 更進階探索 | 跨圖層空間關係、可達性與時序比較 | 另定範圍與證據，逐步擴充 |

## 全圖層基礎分析架構

2026-09-19 的機械盤點、現有23工具白話狀態與工具集合見 [layer-capability-inventory-20260919.md](layer-capability-inventory-20260919.md)。未來新增圖層如何同步 dataset contract、快速查詢、統計能力與三端驗收，見 [analysis-capability-onboarding.md](analysis-capability-onboarding.md)。

全圖層都應能被搜尋、說明來源並回報可用能力；不要求所有圖層執行完全相同的計算。共同契約先揭露來源、版本／時間、資料粒度、幾何角色、範圍、欄位、缺值、未匹配、載入狀態與完整資料取得方式，再依能力宣告開放量測。畫面上渲染的 feature、tile 抽稀或目前 viewport 不可代替完整來源統計。

| 資料角色 | 基礎量測 | 必須保留的語意與限制 |
|---|---|---|
| 點／事件 | 來源紀錄數、唯一實體數（有可靠 ID 才開）、分類、行政區、缺座標、點位 extent | 區分機構／校區／地址／事件；重複、未匹配與缺 geometry 不自動丟棄 |
| 線／路徑／網路 | feature 數、總長度、分類長度、長度分布、缺／壞 geometry | 宣告 CRS、geodesic 或 projected 算法、單位、multipart；連通性只對具網路語意的來源開放 |
| 面／邊界／覆蓋 | feature 數、面積、周長、分類面積、覆蓋比例 | 宣告 CRS、boundary 版本、幾何修復、重疊與去重規則；重疊面不可直接當無重複總面積 |
| 網格／raster／hex | cell／pixel 數、解析度、有效覆蓋、NoData、min／max／mean／quantile、分類 histogram | 宣告像元／cell 面積、縮放層級、聚合方式；經緯度網格不可假設每格等面積 |
| 行政區統計／choropleth | 指標值、單位、期間、分子／分母、分布、排名、缺值／抑制／0 | 區分 observed／derived、總數／比率／平均；不同地理層級、年份或定義先做可比性檢查 |
| 時序／即時狀態 | observation／event 數、時間範圍、更新時間、延遲、freshness、變化量／率 | 區分事件流與狀態快照、event time 與 ingestion time；遲到、重送、修訂、STALE 不當成 0 |

資料角色與 transport 分開記錄：同一個點圖層可能來自 GeoJSON、PMTiles、RPC 或 stream；同一個 PMTiles 也可能包含點、線、面。每個可統計來源需指定 `full_source`、可驗證 aggregate 或 fail-closed 狀態。大型 PMTiles、RPC、網格與即時資料優先使用來源端 aggregate／sidecar manifest，不在瀏覽器下載全量後臨時計算。

### 工具面維持少量通用介面

- 延伸 `pulse_describe_layer_statistics` 為能力入口：回傳 geometry／data role、可用 measure、group/filter 欄位、時間語意、來源範圍、建議問題與不支援原因。
- 延伸 `pulse_summarize_layer` 的 measure 契約：`count` 先行，後續加入 `length`、`area`、`value_distribution`、`freshness`；只有圖層宣告並通過驗收的 measure 可呼叫。
- 搜尋分兩層：所有 manifest 圖層都能做 metadata 搜尋；feature／record 搜尋只對有索引、可公開欄位與有界分頁的來源開放。
- 比較沿用各層分別摘要再做 comparability gate。只有單位、期間、粒度、地理範圍與定義相容才計算差值／比率；其他情況並列展示。
- 建議問題由能力描述動態產生，例如點層問數量與分類、線層問長度、面層問面積、統計層問指標與排名、即時層問更新時間與變化；不可推薦當下無法可靠回答的問題。

### 擴充順序

1. 盤點全部 manifest key，建立 `layerKey → source dataset → data role → transport → time model → supported measures` registry；同源不同呈現只建一份資料契約。
2. 將現有完整 GeoJSON 點來源逐批接入 `count` 契約，先覆蓋公共設施類並驗證來源粒度、ID、行政區與缺值。
3. 各選一個線、面、網格、行政區統計來源做 pilot，驗證長度、面積、分布與 NoData／missing 語意，再批次推廣同型來源。
4. 盤點歷史、時間切片與即時層，增加 freshness／window／change 契約，保留遲到、重送、PARTIAL 與 STALE。
5. 完成全圖層 capability registry 後才開跨層比較；可達性、密度、空間 join 與因果推論仍是後續獨立能力。

## 首批通用工具

- `pulse_describe_layer_statistics(layerKey)`：回傳支援的統計欄位、分類值、缺值、資料範圍、來源與計數單位。不支援的圖層明確回報，仍可用既有探索工具看地圖。
- `pulse_summarize_layer(layerKey, filters, groupBy, order, offset, limit)`：從完整同源資產計數；篩選為 AND 等值、臺／台正規化，缺值可用 null 查詢；依 count 降／升冪或 key 排序，同數量以 key 穩定排序，分頁預設20、最多50。只列有紀錄的分組（`zeroCountGroupsIncluded=false`），沒有出現在分組中不等同現實為零。鄉鎮分組同時帶縣市辨識。
- 回傳來源 SHA、讀取時間、來源版本／年份（未知保留 null）、總數／符合數、分組總數、分頁、缺值／未匹配、資料範圍、重複 ID、點位有效性、結果 bounds。完整指整份資產已讀取，不等於官方現實全集已驗證。
- 地圖定位沿用 `pulse_set_layers` 與 `pulse_fit_bounds`；bounds 是符合紀錄的點位範圍，不是行政區邊界，也不代表地圖已只顯示篩選結果。

## 計數語意

學校計數是來源「學制／學校紀錄」。4,315 筆資產存在重複學校代碼，可能同校附設不同學制；不自動去重，不稱唯一學校／校址總數。年份未知時不以讀取年份取代。`region_type` 的原始 null 依既有圖層契約表示非偏遠，保留 null 並說明其意義，不一律當未知。

警察機關包括警察局、分局、派出所與專業警察等據點。「有多少警察局」先說明範圍：所有機關據點，或 `facility_subtype=police_dept`。原始資料無縣市／鄉鎮欄位，使用行政區名稱參考表解析地址前綴，標示 derived/address；無法解析保留 unmatched，不把所在地當轄區。`20260626` 是資產版本標記，不假定所有紀錄同日觀測。

任何載入失敗、HTML fallback、schema 不合或超預算都回錯誤，不回 0。有效空 FeatureCollection 才可回資料集0筆。缺 geometry 的紀錄仍可計數，僅不納入定位 bounds。

## 驗收案例

| 使用者問題／失敗情境 | 預期 |
|---|---|
| 全圖層有幾筆學校？ | 全資產筆數、粒度、重複代碼與年份未知 |
| 各類學校各幾筆？ | 分類含 null，加總等於總數 |
| 各縣市／鄉鎮有多少學校、哪裡最多？ | 行政區辨識、穩定排名與可續頁 |
| 台北市／新北市有多少警察機關？ | 地址解析的來源紀錄數、未匹配與限制 |
| 只算警察局，不含派出所？ | 明確 subtype filter，不能以名稱猜測 |
| 比較同一市的學校與警察機關 | 各自來源與計數單位並列，不做無根據因果 |
| 帶我看結果 | 保留其他圖層，開啟目標並用回傳 bounds 取景 |
| 目前畫面只看到幾個點 | 統計不隨 viewport、zoom 或抽稀改變 |
| 缺欄位／不存在圖層／HTML200／載入失敗 | 明確不支援或失敗，不能假0 |
| 30分鐘以上／雙頁／429／reload | 續租與退避、過期／撤銷不復活、同tab恢復 |

## 驗收紀錄

本輪分支（三 repo）：`codex/exploration-counts-20260918`。前端 base `7ebbb865`、Gateway base `87d3b814`、MCP base `5dcd5b0`；MCP 現已有 origin/main，取代上一輪無 remote 的快照。

| 證據 | 本輪結果 |
|---|---|
| frontend tests | 全站 1,635 passed / 6 skipped（212 passed／1 skipped files）；新 capability／record search focused 31 passed／1 skipped |
| 測試執行條件 | 初跑3個大型案例超過預設5秒，降低至2 workers、testTimeout=15000後全站通過；未跳過失敗案例 |
| frontend build | 最終 tsc + Vite build 通過（Vite 24.25秒）；保留既有大chunk警告 |
| Gateway tests | 47/47：含 capability／record search 嚴格 schema，以及既有長session、去重、429、驗證與owner/tab案例 |
| MCP tests / build | 最終全站38/38、TypeScript/build通過；含session輸出schema與stale-session race回歸 |
| MCP stdio | 實際dist入口列出23工具，進階analysis工具維持不可呼叫 |
| 實際資料 / HTTP | 3732 的學校與警察 URL 回 application/geo+json；FeatureCollection 4,315／2,065筆，SHA與local一致；未補檔或上傳資料 |
| browser | 3732 主地圖以All Off後分別只開schools、policeStation，台北視角z12.5可見真實點位；不代表全站所有層已驗 |
| 協定往返 | 真stdio → HTTP Gateway → QueryResponder → 真3732資產；760 capability entries、2個count-ready來源、學校record search、既有學校／雙北警察統計、分頁、錯誤不回0與disconnect均通過；owner與tab為隔離測試替身 |
| 真使用者配對 E2E | 待驗；本地Agent面板尚未Google登入，尚未提供本輪Gateway允許帳號。不能以協定替身當真人驗收 |
| 真長時間與UI情境 | duplicate/reload/TTL/429有自動化證據；真人雙分頁、30分鐘以上導覽、全部面板配置與時間操作仍待驗 |
| Git / 部署 | 依本 session 授權完成三 repo 本地 commit（見下）；未push/PR/merge/deploy。僅啟動自己的前端3732與短暫隔離協定測試服務 |

可重跑的協定入口：[`evaluation-statistics.mjs`](../../../scripts/research/evaluation-statistics.mjs)，命令 `npx vite-node scripts/research/evaluation-statistics.mjs http://127.0.0.1:3732`。前置為 sibling MCP 已build及3732網站啟動；使用隨機本地埠與MemoryPairingStore，不改真身分驗證設定、不影響其他MCP程序。2026-09-19 實跑為23 tools、760 capability entries、2個 count-ready來源，學校「雙蓮」record search 1筆，unsupported layer 明確錯誤；既有統計案例仍全部通過。上一輪持久結果見 [`statistics-acceptance-20260918.json`](statistics-acceptance-20260918.json)。

### 已驗證的資料例子

| 地區 | 學校來源紀錄 | 警察機關所有類型據點 | 其中來源分類 police_dept |
|---|---:|---:|---:|
| 台北市 | 345 | 161 | 3 |
| 新北市 | 406 | 212 | 2 |

上述是資產紀錄數，不是唯一學校數或地方政府警察局機構數。學校全資產共有269筆重複代碼的額外紀錄，保留學制粒度；警察全資產4筆無法解析縣市，雙北計數僅已匹配紀錄。school district分組得到367個有資料的行政區，不補出不存在於資產的零值群組。

學校SHA：`7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`。
警察SHA：`63dadd2cf7e764138e2cca8bdd57010464b91fb5c3d90afa8a65c8349e83e2e7`（版本20260626）。

### 本地連線契約與剩餘限制

- 正常sync/query各3秒single-flight；背景至少15秒，錯誤指數退避，429尊重Retry-After。
- 配對成功後預設開啟「跟隨 Agent」。手動拖曳只中止當次鏡頭動畫並回寫目前場景，不再永久關閉跟隨；下一個明確的 Agent 圖層／鏡頭命令仍可執行。只有使用者自行取消勾選或按下連線「暫停」才持續阻擋後續鏡頭操作。
- 有效Agent活動續租30分鐘idle，8小時hard上限；idle/hard到期與撤銷均不復活。每study command/query各1024筆預算，保留有界回執與ID去重，達上限需新study。
- 同origin使用Web Locks取得study/tab獨占權後才恢復，避免duplicate tab共用身分；不支援Web Locks則不自動恢復。sessionStorage僅四個參照ID，無token/code/claim。
- 已驗證browser/account與agent/session分桶600/min；未驗證IP120/min與驗證inflight guard保留。browser request仍逐次遠端Auth，尚未引入驗證快取；真遠端網路抖動需配對驗收。
- 已啟動的其他MCP程序不會自動載入新dist。下一次啟動／重新載入此MCP後取得23工具，不能整批停止其他task的程序。

## 下一個可執行步驟

1. 提供本輪測試帳號後，用既有 `PULSE_RESEARCH_PILOT_EMAILS=<account> node scripts/research/start-gateway.mjs` 啟動8791；不填猜測帳號。
2. 本地Agent登入 → 建立配對 → 新MCP claim → 使用者比對短語確認 → 搜尋學校／警察 → describe statistics → 雙北count/group → 以結果bounds取景。
3. 驗證reload、複製分頁、手動拖曳、超過30分鐘與8小時hard期限語意，再更新本表；未觀察的不標完成。
4. 下一批圖層依來源逐個加入統計契約。面積階段另定polygon資料、CRS、單位、boundary版本與重疊政策，不從點位推估。

## 2026-09-18 本地提交與載入紀錄

- 分支：三 repo 均為 `codex/exploration-counts-20260918`。
- 前端：`48b463ce`，通用來源統計、連線恢復與驗收文件；提交前 `npx tsc -b` 通過。
- Gateway：`0cc672d`，連線續租、錯誤／流量限制與統計 query。
- MCP：`2ccb783`，新增統計工具與 session race 防護。
- 本機網站 `http://127.0.0.1:3732/` 已重新在瀏覽器開啟，台北 policeStation 場景 loading 消失；沿用本輪自己的 Vite，未重啟他人的服務。
- 提交後執行 `node scripts/research/evaluation-mcp.mjs --smoke`，新 dist 真 stdio 啟動成功、21 工具、advanced analysis 維持封鎖；測試程序正常退出。
- 目前 Codex task 工具目錄仍為19工具；設定已指向 recovery MCP 的 dist。CLI 無 reload 子命令，CUA 明確拒絕操作 Codex app，因此未完成此 task 的 MCP 重載，也未整批停止 MCP。需使用者在 Codex 支援的管理介面重新載入此 MCP，再確認新增兩個統計工具可用。
- 8791 真 Gateway 尚未常駐啟動：待本輪測試帳號與本地 Agent 登入；隔離測試的假 owner 不能代替真人配對。

下一步優先完成「此 task 載入23工具 → 真帳號配對 → capability／record search → 雙北學校／警察總數、分類、行政區排名與地圖定位」驗收，接著驗證長工作階段恢復。通過後再逐層擴充來源契約；面積計算需另外確認 polygon、CRS、版本、單位與重疊語意。

## 2026-09-19 capability 與 record search 增量

- 新增 `pulse_list_layer_capabilities`：分頁列出760個 manifest key，可依 data role、measure、source kind、status、time model 篩選；目前只把有完整來源契約的 schools、policeStation 標成 count-ready。
- 新增 `pulse_search_layer_records`：目前只開放 schools、policeStation；必須有非空文字或1–5個白名單等值 filter，每頁最多20筆，固定回傳安全欄位且字串最長120字元。
- 前端全站 1,635 passed／6 skipped；`npx tsc -b` 與 production build 通過，保留既有 large chunk 警告。
- Gateway 47/47；MCP 38/38 與 build 通過；真 dist stdio smoke 為23 tools，既有 advanced analysis tools 仍封鎖。
- 隔離協定 E2E 通過：真 stdio MCP → HTTP Gateway → QueryResponder → 3732真資產；這是模擬 owner/tab，不是 Google 登入後的真人配對。
- HTTP 資產為 GeoJSON，不是 SPA fallback：學校2,504,719 bytes／4,315筆；警察1,698,235 bytes／2,065筆。browser 實看 policeStation 點位正常。
- 本輪只重啟已確認屬於 recovery worktree 的8791 Gateway，沿用畫面已確認的測試帳號 allowlist；未停止其他 MCP 或服務。Gateway 根路徑回受控404，listener正常。
- 未 push、PR、merge、deploy；目前桌面 task 尚未重載新版 MCP。
