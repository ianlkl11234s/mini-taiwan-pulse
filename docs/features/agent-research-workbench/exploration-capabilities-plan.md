# Codex 地圖探索能力計劃

更新：2026-09-18。狀態：本地實作及自動化／資產／圖層顯示驗收完成；真使用者配對待驗，未發布。此文件維護能力範圍、使用情境與驗收結果。

## 目標

使用者用自然語言透過 Codex 找圖層、理解來源與限制、計算可驗證的數量、比較不同地區與圖層，再回地圖探索。工具介面通用；每個資料來源需明確宣告支援欄位、計數粒度與完整性。不能因某層可展示就推定所有計算均可用。

## 路線與能力

| 階段 | 能力 | 狀態與邊界 |
|---|---|---|
| 探索基底 | 搜尋、來源說明、開關、設定、時間、鏡頭、故事模板 | 已有；配對 E2E 另驗 |
| 連線 | 錯誤分類、退避、續租、安全恢復、長工作階段 | 本地完成、測試通過；真使用者長工作階段待驗，保留驗證與去重 |
| 基礎統計 | 總筆數、等值篩選、分類／縣市／鄉鎮分組、排序、分頁、定位 bounds | 本地完成：學校與警察機關兩份來源契約；其他圖層未自動開放 |
| 跨層對照 | 分別呼叫同一統計工具，並列各自數量、來源、年份、粒度與未知值 | 不自動相加、不推論因果；同源不同呈現不可當獨立資料 |
| 面積 | 來源 polygon 面積、行政區面積、單位與計算方法 | 待做：先確認 CRS、幾何有效性、重疊／去重、boundary 版本；點不代表校地／轄區面積 |
| 面積衍生比較 | 經驗證分母後的每平方公里數量、覆蓋占比 | 待做，不因有總數即開放；未知分母不可計算 |
| 更進階探索 | 跨圖層空間關係、可達性與時序比較 | 另定範圍與證據，逐步擴充 |

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
| frontend tests | 全站 1,632 passed / 5 skipped（212 files）；最後來源 null 語意增量另跑統計19/19 |
| 測試執行條件 | 初跑3個大型案例超過預設5秒，降低至2 workers、testTimeout=15000後全站通過；未跳過失敗案例 |
| frontend build | 最終 tsc + Vite build 通過（32.44秒）；保留既有大chunk警告 |
| Gateway tests | 46/46：注入clock模擬30分鐘以上活動續租、idle/hard到期、撤銷、33+命令/query、去重、429、錯誤憑證、owner/tab |
| MCP tests / build | 最終全站38/38、TypeScript/build通過；含session輸出schema與stale-session race回歸 |
| MCP stdio | 實際dist入口列出21工具，進階analysis工具維持不可呼叫 |
| 實際資料 / HTTP | 3732 的學校與警察 URL 回 application/geo+json；FeatureCollection 4,315／2,065筆，SHA與local一致；未補檔或上傳資料 |
| browser | 3732 主地圖以All Off後分別只開schools、policeStation，台北視角z12.5可見真實點位；不代表全站所有層已驗 |
| 協定往返 | 真stdio → HTTP Gateway → QueryResponder → 真3732資產，學校、雙北警察分類、鄉鎮分頁、錯誤不回0、disconnect均通過；owner與tab為隔離測試替身 |
| 真使用者配對 E2E | 待驗；本地Agent面板尚未Google登入，尚未提供本輪Gateway允許帳號。不能以協定替身當真人驗收 |
| 真長時間與UI情境 | duplicate/reload/TTL/429有自動化證據；真人雙分頁、30分鐘以上導覽、全部面板配置與時間操作仍待驗 |
| 部署 | 未commit/push/PR/merge/deploy；本輪僅啟動自己的前端3732與短暫隔離協定測試服務 |

可重跑的協定入口：[`evaluation-statistics.mjs`](../../../scripts/research/evaluation-statistics.mjs)，命令 `node --import tsx scripts/research/evaluation-statistics.mjs http://127.0.0.1:3732`。前置為 sibling MCP 已build及3732網站啟動；使用隨機本地埠與MemoryPairingStore，不改真身分驗證設定、不影響其他MCP程序。持久結果見 [`statistics-acceptance-20260918.json`](statistics-acceptance-20260918.json)。

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
- 有效Agent活動續租30分鐘idle，8小時hard上限；idle/hard到期與撤銷均不復活。每study command/query各1024筆預算，保留有界回執與ID去重，達上限需新study。
- 同origin使用Web Locks取得study/tab獨占權後才恢復，避免duplicate tab共用身分；不支援Web Locks則不自動恢復。sessionStorage僅四個參照ID，無token/code/claim。
- 已驗證browser/account與agent/session分桶600/min；未驗證IP120/min與驗證inflight guard保留。browser request仍逐次遠端Auth，尚未引入驗證快取；真遠端網路抖動需配對驗收。
- 已啟動的其他MCP程序不會自動載入新dist。下一次啟動／重新載入此MCP後取得21工具，不能整批停止其他task的程序。

## 下一個可執行步驟

1. 提供本輪測試帳號後，用既有 `PULSE_RESEARCH_PILOT_EMAILS=<account> node scripts/research/start-gateway.mjs` 啟動8791；不填猜測帳號。
2. 本地Agent登入 → 建立配對 → 新MCP claim → 使用者比對短語確認 → 搜尋學校／警察 → describe statistics → 雙北count/group → 以結果bounds取景。
3. 驗證reload、複製分頁、手動拖曳、超過30分鐘與8小時hard期限語意，再更新本表；未觀察的不標完成。
4. 下一批圖層依來源逐個加入統計契約。面積階段另定polygon資料、CRS、單位、boundary版本與重疊政策，不從點位推估。
