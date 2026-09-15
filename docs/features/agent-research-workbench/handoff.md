## 2026-09-15 最新增量：Open-ended 本地資料研究（以本節為準）

本地提交：Pulse `89336514`、MCP `76f16e4`、gateway `07063d1`。未 push／部署。

- 主線維持 `datasetId → analysis → resultId`：`explore_data` 先找 catalog，canonical 與 generic registered same-origin GeoJSON 的 Point subset reader 才可 query，之後可做 `compare_neighborhoods` 的多來源個別計數並以 resultId 呈現。generic metadata 可讀不等於 spatial-approved；PMTiles／RPC 仍要專用 adapter。
- 上限：單一 asset 8 MiB、reader 20,000 rows、neighborhood 候選 2,000、最多 5,000,000 次點對比較、半徑 100–5,000 m。schools 為 4,315 筆（臺北 345），libraries 634；1 km 校址候選不代表全域 hotspot、品質、步行可達性或獨立機構。
- 真 Codex 離線原問句首輪因範圍過廣失敗；補 lineage scope 後 v2 自行完成 explore、describe×2、query×2、compare×2。`answer-v2.md` 保留半徑、345 候選、臺北 libraries 64、未算跨市界與 freshness unknown；offline 不是真 paired/browser E2E。
- 瀏覽器診斷頁已實際 render 345 點並確認 opacity、清除無殘留；主站登入配對仍待使用者，不能宣稱 E2E 已過。來源 hash 證據在 [驗收 receipt](./evidence/open-ended-acceptance.json) 與 [Agent 實際回答](./evidence/open-ended-agent-answer.txt)。
- 新 worktree：`/private/tmp/pulse-research-open-ended{,-mcp,-gateway}-20260915`，branch `codex/research-open-ended`。站 3732、gateway 8791 已啟動；global `pulse-research` 已指向新 MCP dist entry，需重載 Codex 才有新 tools。無 push／deploy，commit 由主 agent 處理。

啟動（不含 secrets）：`node scripts/research/start-local.mjs --port 3732 --gateway-origin http://127.0.0.1:8791 --asset-source /private/tmp/pulse-research-workbench/mini-taiwan-pulse/public --analytics-root /private/tmp/pulse-research-workbench/taipei-gis-analytics`。

## 已完成接手點：本地 Semantic Registry／Research Library／Grid（2026-09-14）

下方同日「下一個最小切片」已由本輪完成，本節與 [acceptance](./acceptance.md) 為最新狀態。

- M2 三份 machine-readable 語意卡、validator 與證據 gate 已完成；canonical 在 analytics，Pulse／MCP 以 SHA provenance 同步。
- 本地 Library 契約與 SQLite lifecycle 已完成；schools 真實 150 m grid 為 4,061 格／4,315 source records，固定 receipt 驗證後可從主地圖本地 Agent 面板產生 resultId 並呈現。原始 Point archive 保留。資料授權、時間與完整 coverage 尚未知，維持 HOLD／local research only。
- 主要入口：[tool plan](./tool-foundation-plan.md)、[roadmap](./gis-analysis-roadmap.md)、[互動說明](./gis-analysis-roadmap-guide.html)。重現與 CLI 命令在 tool plan；canonical library 設計在 analytics `docs/adr/0005-research-library-local-school-grid.md`。
- 三個工作位置均為 `/private/tmp/pulse-research-workbench/{mini-taiwan-pulse,taipei-gis-analytics,mini-pulse-gis-mcp}`，branch `codex/agent-research-workbench`；c92d checkout 未修改。DEV 主地圖為 `http://127.0.0.1:3731/`，bundle 必須存在於 analytics `schools-grid-v3` 本地目錄。
- 下一步：補來源 licence／observed time 證據才考慮 promote；用已配對 MCP 重跑新 grid 的端到端驗收；再以合格真實來源擴充第二個 asset。Network 要先補完整 graph/profile 證據；school district／real estate 維持 HOLD。雲端持久化、跨使用者 ACL、任意 geometry grid、production 都未完成。
- 本輪提交：analytics `eb237bdd`（semantic）、`cdc75625`（library/grid）；MCP `ff3542a`（契約同步）；Pulse `1664e179`（接線與測試）。本 handoff／roadmap／acceptance 另為文件提交。
- 本輪本地檢查與 browser 證據見 acceptance；原子提交留本地，沒有 push 或部署。

## 新 Session 接手點：GIS Research Library ＋ Grid／Network Foundation（2026-09-14）

- **目標與共識**：核心流程固定為 `datasetId → analysis → resultId`；圖層只是呈現出口。MCP 提供受控操作、Skill 規範分析流程、本地 Agent 組合工具。下一階段要把一次性分析變成可搜尋、可驗證、可版本化重用的 GIS Research Library；原始 point／line／polygon 不得被格網取代。
- **目前完成**：M0 資料契約與共用 query executor 完成；37 個 research MCP tool schemas、session-scoped results、budget／receipt／hash／access plan、基本 filter／time／nearby／aggregate／join／metric／quality／evidence 已有測試。主地圖的本地 Agent 已整合進左側 app rail，可呈現多組 Point 結果與 fit bounds；`/lab/` 僅作診斷。
- **真實 pilot 證據**：schools GeoJSON 4,315/4,315 個有效 Point；台北車站直線 1 km 回傳 9 筆來源 place records。2026-09-12 新聞 exact selector 合法回傳 0，非空樣本仍缺；水稻統計 exact release 有 368/368 鄉鎮、總計 158,701.13 ha，但尚未做版本相符 boundary join。詳細數字、checksum 與限制以 [acceptance.md](./acceptance.md) 為準。
- **不可誤報**：直線附近查詢不是步行／駕車可達性；學校筆數不是教育品質；行政統計不是 parcel geometry；圖層已登記／頁面可見不等於可供 executor 分析。尚無通用 grid/H3、school district、real-estate、network isochrone、持久研究庫或 production 證據。
- **下一個最小切片**：先完成 M2 Semantic Registry 的 machine-readable schema、validator 與 schools／news／paddy 三份語意卡，再建立 `ResearchAsset`／`GridDefinition`／`GridMetric` 契約及 library index（search／describe／promote／stale）。接著以真實 schools 做第一個 H3 或方格 assign＋aggregate＋materialize 驗收；沒有已驗證 walking profile 前，不以空殼 `network.isochrone` 冒充完成。
- **驗收與邊界**：負向測試必須保留 hypothesis、missing／suppressed／zero、來源與版本；格網結果保留 CRS／resolution／時間與原始資料血緣。更新 [GIS roadmap](./gis-analysis-roadmap.md)、[tool plan](./tool-foundation-plan.md) 與本 handoff，使用原子化 commit。不得重做全圖層盤點，不 push、不 deploy。
- **工作位置**：`/private/tmp/pulse-research-workbench/mini-taiwan-pulse`，branch `codex/agent-research-workbench`，本 checkpoint 前最新 commit `cf7e29de`。互動說明頁為 [gis-analysis-roadmap-guide.html](./gis-analysis-roadmap-guide.html)。

## 協作基準更新（2026-09-11）

使用者已確認改以 **datasetId → analysis → resultId** 為中心，圖層是呈現出口；分析可直接使用有版本／血緣的資料，不需先開啟來源圖層。MCP提供受控操作，Skill提供分析流程，本地Agent負責組合與程式，工作台顯示研究與結果。Twinkle Hub為待評估外部來源。

下一次接手先讀 [tool-foundation-plan.md 的已確認協作方向](./tool-foundation-plan.md)，再按需查看 [inventory](./inventory/README.md)。目前優先tools與資料底層，暫不擴充工作台UI。最小runtime foundation、共用query executor、四個pilot adapter、result session、基本分析與地圖呈現已完成；進階raster／network／cluster／spatial join及持久化研究紀錄仍是後續工作。

本輪功能與修正已依責任拆成原子commit；完整狀態、驗收數字與明確未完成項目見 [tool-foundation-plan.md](./tool-foundation-plan.md) 與 [acceptance.md](./acceptance.md)。其下歷史段落的「未commit」描述為當時紀錄，不代表目前狀態。未push／未部署。

## 最新顯示調整（2026-09-11）

附近查詢只呈現虛線半徑圈，取消查詢中心白點與結果金色點，保留原始圖層分色。結果清單及點選定位保留；清單截斷不代表原始圖層也被篩選。

# Agent Research Workbench — implementation handoff

日期：2026-09-11。Phase A + Phase B 本地里程碑；完整 v1 與正式站接通仍在實作中。

## 最新增量：探索、讀取、定位與附近查詢（2026-09-11）

- 使用者要求下一步以真實問題驗收；已新增圖層探索／描述／有界紀錄讀取／目前地圖context／既有地名鏡位搜尋／移動縮放／附近查詢／結果呈現工具。詳細驗收與檔案責任見 [acceptance.md](./acceptance.md)。
- 原地圖面板已移除圖層代碼清單；可查地圖中心、在地圖選點再查附近。金點／白色中心／虛線半徑、清單、popup、透明度、清除均在原地圖。
- 讀取與附近查詢第一批只允許 schools；其他圖層能探索，不冒充可讀取。沿用既有本地公開school檔；5MiB/15秒/10000features，頁面記憶體快取，不是S3查詢或磁碟快取管理。
- 獨立Python、實際browser+MCP stdio SDK，以及真正Codex CLI自然語言驗收均得到 [121.5170,25.0478] 半徑1km共9筆，並在原地圖呈現。最近三筆：市立建成國中459.200m、私立志仁中學進修學校520.768m、市立日新國小726.754m。limit3明示total9/returned3/truncated；海上點成功零筆仍有來源；不支援回LAYER_READ_UNSUPPORTED。
- CLI第一次併行query撞到單pending限制，依序重試完成；已修正QUERY_PENDING不再誤映射PAIRING_PENDING，且工具instructions要求依序執行查詢。另有pulse_get_query_result讀pending結果，淘汰資料回expired。
- Query本身不變更revision；呈現由scene.nearby queryId指令控制，queryId綁session。上鎖、撤銷、暫停、30秒TTL、24KiB結果、4筆保留與32次lifetime限制均有檢查。結果缺值／geometry排除與資料時間未知保留。
- 最終相關測試：Pulse research34、gateway34、MCP research23通過；Pulse tsc/build與MCP build通過。原工作區未改、未commit/push。
- 真Codex驗收已disconnect並保留結果；尚未部署正式站。正式Google登入整合仍未做。
- 證據：worktree根 `evidence/nearby-{independent,live-result}.json`、`evidence/nearby-codex-final.txt`；CLI輸出報tokens used 47,594，這是驗收host輸出的用量，不是本次整個桌面任務的總額。

## 最新增量：原本主地圖圖層開關（2026-09-11）

- 使用者明確要原本 Mini Taiwan Pulse 的地圖與圖層，不以獨立 lab 當第一步。入口改為本地 `http://127.0.0.1:3731/` 右上「本地 Agent」，目前 DEV-only，尚未正式部署。
- `src/research/MainMapConnection.tsx` 為薄 adapter；`App.tsx` 僅注入既有 chatBridge、Mapbox map、catalog labels 與 locked keys。沿用原本 visibility handler / statistics 互斥 / 資料 loader / 圖例與 popup，不複製圖層實作。
- Relay scene/patch 可選 `layers`（最多20個合法 key:boolean override，整組取代上一筆 overrides）；MCP `pulse_apply_scene` 支援 layers，新增 `pulse_set_layers`。未知或上鎖圖層整筆寫入前拒絕；既有互斥規則造成讀回不符時回 error，不假稱成功。
- `ready` 在主地圖只代表 visibility switch 已讀回，不代表來源已載完或 geometry 完整；UI 明確提示。scene.layers 是最近要求的 overrides，不是全站完整圖層目錄／可見性快照。完整 discovery/state 工具仍待後續。
- 手動鏡頭操作保留最近追蹤的圖層鍵；手動關閉以實際 store 值更新，避免舊的 Agent 開啟指令重播。此行為有回歸測試。
- 此輪真 Supabase 登入 + 實際主地圖 + built MCP stdio client 已驗證 schools true r1 ready / false r2 ready。這次用 SDK host 驗證，不是另一次 Codex CLI host 測試；上一輪 CLI 證據仍是 lab synthetic。
- 開關驗證時發現 worktree 缺 Git-ignored `public/education/schools.geojson`。僅從原工作區複製該檔（2,504,719 bytes / 4,315 features / SHA-256 相同，未重抓來源）；之後用原 sidebar 開啟並 screenshot 確认學校點位呈現。其餘 ignored 資產未全量複製。
- 主站公開 Mapbox frontend 設定已加入 ignored `.env.local`，沒有複製 service-role／DB key。原檔案未改。
- 測試：Pulse research23、gateway31、MCP21；Pulse tsc/build 與 MCP typecheck/build 通過。證據 logs 在 worktree根 main-map-*.log；SDK harness 在 evidence/main-map-live.mjs，不包含配對憑證。
- 本轮測試 MCP 已斷線。重新使用：打開原站 → 本地 Agent → 建立配對 → 複製指令給載入 pulse-research 的 Codex → 網站比對確認 → 用 pulse_set_layers 開關。關閉視窗面板不會撤銷連線；用「撤銷」。

## 最新狀態：真實本地登入與 Codex 已接通

- Gateway 已在本機 `127.0.0.1:8790` 執行；Mini Taiwan Pulse 主站 `127.0.0.1:3731/` 代理同源 API。`/lab/` 僅保留作獨立驗證頁，不是使用入口。
- 使用原專案的 **兩個公開 VITE_SUPABASE 設定**，未複製 service-role／DB key。研究登入已改獨立 PKCE + tab sessionStorage，與一般地圖登入分開。
- 私有 runtime 設定在 `/private/tmp/pulse-research-workbench/runtime/gateway.env`（0600），SQLite parent0700、DB0600；僅目前登入且 email 已由 Supabase 確認的試辦帳號可用。不在 repo 記錄其 email／憑證。
- 透過官方 `codex mcp add` 新增全域 `pulse-research`，保留其他 MCP。設定指向此 worktree 的 built stdio entry 與本地研究網址；未配置來源讀取 root。
- **真正 Codex CLI + 真 Supabase 登入 + 實際網站**完成配對、顯示、清除、再顯示，三筆 receipts 均 ready（r1/r2/r3）；browser 亦實際讀回 r2空白、r3成果。不是 SDK 模擬 verifier。
- 驗收 CLI 已結束；網站已撤銷這輪連線。你自行使用時按「建立配對」→「複製配對指令」→貼给已載入新MCP的Codex→核對短語→網站確認。
- 本次使用獨立 CLI 作 host 驗收；既有桌面對話的工具清單不會被本次驗收替换。若桌面對話找不到新工具，須重新載入 MCP／重啟 Codex 後再配對。[官方MCP設定文件](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。
- 正式網域仍未部署；本機服務與worktree要保留。下方 Phase A/B 證據是歷史階段，最新以本段為準。

重啟本機服務（兩個終端，各自持續執行；若目前 port 已在使用，先沿用）：

```sh
# gis-platform worktree
node --env-file=/private/tmp/pulse-research-workbench/runtime/gateway.env services/research-gateway/server.mjs
# mini-taiwan-pulse worktree
npm run dev -- --host 127.0.0.1 --port 3731
```

本輪補強：browser native fetch receiver、MCP numeric array schema、排除版面resize冒充手動地圖操作、已驗證email allowlist、獨立PKCE登入、網站撤銷後登出。Pulse19、gateway30、MCP research20 tests通過；最新build通過。真CLI去敏結果見 worktree根 `evidence/codex-live-pairing-final.txt`，原始log限0600；沒有raw access token、provider token或refresh token寫入此repo。

首次 implicit OAuth 測試回呼的網址fragment曾被瀏覽器工具輸出到任務紀錄；已在網站登出該次登入，改PKCE後重登，後續只讀DOM登入狀態、不讀callback URL。不能聲稱刪除了歷史工具紀錄或立即撤銷所有已簽發access tokens。

## 開啟與工作位置

- 實際使用與驗收入口：`http://127.0.0.1:3731/` 右上「本地 Agent」。`http://127.0.0.1:3731/lab/` 僅供獨立連線／renderer 診斷。
- Worktree 根：`/private/tmp/pulse-research-workbench/`。
- 四個 repo 的 branch 均為 `codex/agent-research-workbench`。
- Pulse baseline `617f1dcb117e72738dde85f0cf0ab19281661432`。
- Gateway baseline `09494f14c95fb7a70f9b5900dac6552f0ab30f7b`；MCP baseline `a62967fe9f4e5c5bb494a1590b95f054fd131582`。
- Analytics baseline `02dbb218aa62c83ea91b598f73a069be2dffd9a3`。
- 所有改動尚未 commit/push；原始工作區的並行程式修改沒有搬入或覆蓋。
- 未部署、未套 migration、未設定正式帳號／bucket／費率、未取得真實來源資料。

從 Pulse worktree 啟動：`npm run dev -- --host 127.0.0.1 --port 3731`。
不要在 worktree 遺失前刪除；目前變更是工作區檔案，尚無 commit 保護。

## 已有的可操作範圍

| 部分 | 實作 | 實際限制 |
|---|---|---|
| 獨立研究頁 | `/lab/` entry，地圖／表格、點選屬性、透明度、圖例、清除、來源方法 | 合成資料限定；沒有正式站 Agent 連線 |
| 地圖基礎 | 重用現有 MapLibre dependency；單一研究結果 host | 經緯度格線，不含街道底圖／真實行政區；沒有載入外部 tile provider |
| 共用契約 | analytics canonical JSON Schema + 純 JS invariant validator，SHA-256 pinned copies | `research-result/0.1` 是 v1 的 Phase A 子集 |
| 本地 MCP | 獨立 stdio 入口，`pulse_validate_result`、`pulse_inspect_local_assets` | 驗證／列檔案；不是 verified cache，不上傳，不開埠 |
| 配對與 relay | Supabase server verifier、pilot ACL、SQLite、HTTP、一次性配對、30 分鐘租期、撤銷、revision CAS | 程式與本地測試完成；未部署、未設定正式試辦帳號 |
| 網站與 MCP 控制 | 配對、讀取狀態、移動鏡頭、固定合成成果、清除、applied/ready | 使用 library/test verifier 的本地串接證據，尚非真實 Codex host / production |

研究頁目前由使用者選擇合成 JSON 或載入固定範例。**沒有 Codex → 正式站控制的完成宣稱**，也沒有把 SDK 測試 client 當作 Codex host 驗收。

## 實際檔案結構與責任

```text
mini-taiwan-pulse/
  lab/index.html                         獨立 HTML entry
  src/research/
    main.tsx                             僅載 research app
    ResearchApp.tsx / research.css        畫布、側欄、表格、方法與限制
    ResearchConnection.tsx / bridgeClient.ts  登入、配對、pause/revoke、同源 API
    StudyController.ts                   mutation 排序、manual 優先、同 revision report
    basemap.ts                           離線經緯度參考格線
    resultOverlay.ts                     共用結果 host / colors / cleanup
    sceneReadiness.ts                    idle/error/timeout 與 loadingRegistry
    resultValidator.ts                   原始 JSON bytes 邊界
    contracts/                           canonical copies + provenance.json
    __tests__/                           lifecycle / timeout / file boundary
  scripts/research/sync-contracts.mjs     複製與 --check drift 檢查
  vite.config.ts / nginx.conf             /lab entry / isolated CSP
  docs/features/agent-research-workbench/
    spec.md / handoff.md / backlog.md / changelog.md
mini-pulse-gis-mcp/
  src/research/
    index.ts / server.ts                 獨立 stdio，保留既有 map server
    relayClient.ts / relayClient.test.ts  memory-only credential、bounded HTTPS client
    workspace.ts                         有界且拒絕 symlink 的本地讀取
    server.test.ts                       protocol + filesystem 安全測試
    contracts/                           與 frontend 相同 canonical copies
  docs/research-local-tools.md

taipei-gis-analytics/
  src/analysis/contracts/
    result.schema.json                   canonical structural schema
    result-validator.mjs / .d.ts         browser/Node 共用 invariant validator
    validate-result-cli.mjs              有界 stdin，與 browser module 分離
  src/analysis/validate_result.py         呼叫同一驗證器，沒有另一份公式
  tests/analysis/                         fixture / regressions
  docs/handoff/agent-research-workbench.md
gis-platform/
  services/research-gateway/
    pairing-service.mjs                  domain + 單程序測試 store
    auth.mjs / sqlite-store.mjs          真實驗證、pilot ACL、持久 store
    relay-service.mjs / server.mjs       scoped command relay / bounded HTTP
    *.test.mjs / README.md               回歸、啟動與部署邊界
```

上游契約與限制見 [analytics handoff](../../../../taipei-gis-analytics/docs/handoff/agent-research-workbench.md)。

Phase A architecture decision：動態成果屬獨立 `/lab`，不向主站 `LayerVisibility`／`layerManifest` 登記每份 artifact。唯一 host 目前 `analysis:preview:result`，由 `resultOverlay.ts` 集中管理；未接 session 時不偽造 server studyId。Phase B 配對仍僅固定 synthetic preview；Phase C 私有 artifact 接入時才換成規格要求的 study/artifact namespace。這個 host 自行驗證 loading、opacity、legend、popup、cleanup；沒有把主站 App/Chat/state/data loaders 引入研究 entry。`/lab` 使用已存在的 MapLibre 基礎，沒有再安裝一套 engine。

## 已落實的安全與資料邊界

- 合成來源限定，真實資料／receipt mode 拒絕；不把 Agent 自報標籤當 server ACL。
- JSON 原始 UTF-8 5 MiB、10k features、200k vertices、文字 2 KiB；table 10k rows/100 columns。畫面僅預覽 100 rows/20 columns，明示預覽量且不變更統計值。
- Point/MultiPoint/LineString/MultiLineString、單外環 Polygon；暫拒絕 holes/MultiPolygon。每 polygon ≤512 vertices，總相交檢查 ≤1m；自交、零面積及無效座標拒絕。擴充到完整 v1 geometry 前需再驗證。
- 100 metrics/properties/reference strings，parameters depth 32／10k nodes；最多 100 個有界 error，未知 key 不回原文。這些是運算／顯示限制，不是來源讀取或費用限制。
- ratio 的 numerator/denominator 都需 valid，正分母，數值符合相除（相對容差 1e-9）；缺值與 suppressed 不變零。
- 固定 renderer 樣式；React 文字輸出，不執行 HTML/JS、不 fetch 結果中的網址。
- MCP 根目錄只能由 `PULSE_WORKSPACE_ROOT` 設定；只讀指定 study results。全祖先檢查、nonblocking/no-follow open、固定大小 buffer、前後 identity 檢查；最多50回傳項目/1000掃描項目。
- Node 的前後檢查不是對惡意同使用者 process 的 OS sandbox；必須用可信本地使用者控制的 workspace。檔案已可讀不代表已授權重用。
- Memory store 僅測試；CLI 強制使用 Supabase verifier、非空 pilot allowlist 與 SQLite。DB專用0700目錄、檔案0600；來源憑證不進瀏覽器。無 dev auth bypass。
- Gateway 32 KiB HTTP、4 MiB state、每study最多32 commands，限流與TTL。指令最多30秒；manual/paused/revoke取消pending；idle才可回同revision ready。
- nginx `/lab/` 加 no-store、no-referrer、nosniff 與限制 CSP（frame-ancestors none、connect self 與固定 Supabase auth origin）；目前僅 config/build 證據，未作 production header readback。

## 驗收證據

- Pulse `npm run build`（含 `tsc -b`）通過；原有大型 bundle warning 保留。
- Pulse research targeted tests：7 passed。含 timeout 不冒充 ready、舊 revision listener cleanup、overlay 清除／style reload、原始檔案大小／ratio 邊界。
- Pulse 全站執行：1344 passed、3 skipped、1 failed。失敗是未修改的 upstreamRegistry catalog 對照，共14個既有資料引用（農漁業統計／日本資料）在此次 analytics baseline 缺對應 catalog。相關登記／test 本次無 diff，沒有改測試繞過。
- MCP 全站：28 passed（最後 directory-swap 修正前）；修正後 research targeted：9 passed，typecheck/build passed。
- Pairing：11 passed（包含真實 Promise.all 競爭、過期、重放、跨帳號／分頁、pending revoke）。
- Analytics：16 passed、1 skipped。skip 是環境無 `jsonschema` 套件；canonical JS regression 與 schema JSON parse 已驗證，未假稱 schema runtime checker 通過。
- Browser：實際本地頁點／線／面、table、popup、opacity、手機390×844無橫向溢出；HTML文字未生成 img/script elements；零分母拒絕且保留舊成果。這是本地 browser 證據，不是 MCP capture／production 證據。
- 工作檔 logs/screenshots：`/private/tmp/pulse-research-workbench/evidence/` 與根目錄 `*-tests.log`、`build.log`；僅合成資料。

共用契約 drift 檢查（在 Pulse repo）：

```sh
node scripts/research/sync-contracts.mjs --analytics ../taipei-gis-analytics --check
node scripts/research/sync-contracts.mjs --analytics ../taipei-gis-analytics --consumer ../mini-pulse-gis-mcp/src/research/contracts --check
```

## 下一段實作順序

1. 選定 gateway 受管理服務位置、正式 pilot IDs、OAuth redirect allowlist，完成部署與 HTTPS/no-store/CSP readback。nginx 預留 loopback8790，但目前網站容器不會自動啟動 gateway。
2. 真實 Codex host 安裝與 invocation、正式配對／撤銷是獨立驗收；不得把注入測試身分的 SDK smoke 當作已完成登入。
3. 使用者選本地 root／留存／容量後，做 receipt-aware cache、manifest index、S3/Supabase/R2目錄；不把現有列檔工具稱快取系統。
4. 做受控 acquisition reader、費率／預算確認／reservation ledger；未就緒回 COST_GUARD_UNAVAILABLE。
5. 私有 artifact 上傳／ACL繼承／TTL與恢復、真實 S3-only 分析，再做同 revision inspect/capture。

尚未確認：正式部署runtime、試辦帳號、私有成果儲存、首批S3-only immutable assets與費率。本次沒有設定額度或新雲端資源。

## Phase B 本次驗證與限制

- Pulse research tests 17 passed（其中1項為明確啟用的真gateway跨repo契約測試）；`npm run build`（含 tsc-b）通過。StudyController 測試包含 ack 前不回 ready、queued manual 使舊 ready 失效、clear empty 也可 ready、舊 sync 不退 revision、ack failure 暫停、stop 後不回報。
- 新增 gateway tests 覆蓋 HTTP lifecycle、SQLite 重開後 receipt、跨帳號／分頁、32KiB、32 commands、trusted IP、auth body timeout。完整合併測試發現 SQLite 啟動 lock，已把 busy_timeout 設於 WAL 初始化之前；修正後重新驗收。
- MCP 全套 39 assertions passed，但既有 `src/bridge/browserBridge.test.ts` disconnect test 出現 unhandled SESSION_DISCONNECTED，runner exit 1；該檔沒有本次 diff。不宣稱全套綠燈。新 research targeted 另跑。
- 本地瀏覽器檢查新連線面板、合成資料與清除。preview 未帶 Supabase 設定，會明示連線未啟用；未移用正式登入秘密。
- 本地地圖維持離線格線。配對後只能固定 synthetic 或 empty，不能上傳本地任意JSON；opacity/點选屬個人展示，不增加 server revision。資料授權、真實資料快取／分析與費用 gate 尚未完成。
- 詳細端點：[bridge-contract.md](./bridge-contract.md)；gateway設定：[README](../../../../gis-platform/services/research-gateway/README.md)。

最終 Phase B 驗證：gateway **28 passed**（新增 dangling WAL symlink 拒絕案例）（含 lock 修正）；MCP research **19 passed**、build通過；實際 spawned stdio SDK smoke **passed**，流程 waiting_confirmation→active、accepted→ready、revoke→unpaired。Smoke 的網站端為注入測試身分與模擬 HTTP ack/report，**不是登入後的真實瀏覽器或 Codex host 驗收**。重跑腳本與去敏結果在 `evidence/relay-stdio-smoke.mjs` / `.result.json`（worktree根）。

本次Browser DOM：desktop viewport 1422 CSS px、mobile 433 CSS px（工具390 device width在目前瀏覽器zoom下），scrollWidth等於innerWidth，無橫向溢出；同一canvas、合成呈現ready與清除empty。截圖工具產出有重影，截圖不作完整視覺驗收證據。正式登入／配對的UI仍待端到端驗收。

跨repo client/gateway contract test 須顯式 `PULSE_RESEARCH_GATEWAY_ROOT=/absolute/gis-platform/services/research-gateway npm test -- src/research`；獨立Pulse checkout預設略過此1項，其他16項照跑，避免CI硬依賴 sibling repo。
