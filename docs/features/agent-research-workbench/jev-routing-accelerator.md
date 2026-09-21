# Jev Routing Accelerator

> 狀態：已接入本機 MCP shadow routing，並由 `.agents/skills/pulse-gis-analyst` 作為 Codex 分析路由入口；仍不是 production routing，也不授權任何工具或圖層。
>
> 目標：用 Jev 快速縮小工具與圖層候選，減少使用者從提問到第一個有用地圖結果的等待時間。

## 定位

Jev 是受限的候選分類與排序器，不是 agent、資料真值來源、權限系統或執行器。

`pulse-gis-analyst` Skill 負責判斷何時直接走 deterministic tool chain、何時呼叫一次 `pulse_route_request`，以及命中後要讀哪一份分析／語意 reference。Jev provider unavailable、低信心或 schema 不符時，Skill 直接 fallback；不會重試到拖慢明確問題，也不會讓 routing receipt 取代資料 receipt。

```text
使用者問題
  -> 本地精確匹配與權限過濾
  -> Jev 分類／排序允許的候選
  -> 現有契約驗證
  -> 主 agent 決定並呼叫正式 tool
  -> receipt／readback
```

Jev 的回答不得直接造成網站操作。開關圖層、移動鏡頭、調整圖層控制項與等待載入，仍由既有 typed tools 執行。Browser 只保留給實際畫面驗收，不建立第二條 DOM／Playwright 控制路徑。

## 2026-09-20 決策演進

1. 最初評估 Jev 是否應參考 voice-browser 直接操作頁面。
2. 確認 Pulse 已有 typed map tools，因此不建立 DOM／Playwright 第二控制路徑。
3. Jev 收斂為工具與圖層的快速候選分類／排序器，永不自動執行。
4. 工具不再按「網站目前 11 個、MCP 曾有多少個」硬切；數量是 runtime snapshot，必須由實際 registry/listTools 取得。
5. 共同責任邊界確定為：網站負責看與操作地圖；MCP 負責讀與分析資料；兩者共用 capability vocabulary、access policy 與 receipts。

```text
Jev 選 capability／候選
  -> MCP 產生有來源與限制的 resultId
  -> 網站以 typed command 呈現、調整與 readback
```

網站可以搜尋／描述既有 layer，但不自行擴張成任意資料分析。MCP 可以透過正式 bridge 要求網站呈現結果，但不模擬瀏覽器操作。`call_rpc` 是相容期底層工具，不列為 Jev 候選；長期由 Dataset adapter 選擇宣告過的 RPC／snapshot／static reader。

## 已知平台限制與實測心得

以下為 2026-09-20 使用者提供的 Jev 實測，正式採用前仍需以鎖定的 provider/model 版本重跑：

1. Input 上限 32K，只接受文字；檔案必須先由程式擷取成受控文字紀錄。
2. 輸出只有三種 typed decision：
   - `noul`：是非機率。
   - `choice`：從最多 255 個候選選擇並回傳機率。
   - `score`：從 2–10 個有序等級評分。
3. `criteria` 是準確率的重要輸入。每個候選應寫 `what`、`not_for`、代表例子及必要邊界，不能只給名稱。
4. 複合判斷應拆成單因子問題，再由程式組合機率。例如不要只問「是否適合呈現」，應分別問範圍、密度、遮蔽、完成度等。
5. 不假設 Jev 必然更便宜。文字擷取、補充描述、第二階段生成或驗證都應納入端到端成本。
6. 繁中可用；provider 可評估 OpenRouter／Cloudflare。provider 可用不等於本專案已完成可靠度、隱私或 release 驗收。

## 自適應分類，不固定跑滿所有層級

每多一次 Jev 都會增加網路延遲、費用與失敗點。因此層級是候選過多時的手段，不是固定儀式。

建議規則：

| 權限過濾後候選數 | 路由方式 |
|---:|---|
| 0 | fail closed；回沒有授權候選 |
| 1 | 不呼叫 Jev，直接交契約驗證 |
| 2–20 | 一次 `choice` 排序 |
| 21–80 | 先選大類，再在該類排序 |
| 81–255 | 本地搜尋／既有 taxonomy 先縮小，再做一至兩次 `choice` |
| >255 | 禁止單次 Choice；必須分支、分頁或先做 deterministic retrieval |

閾值是初始假設，應以 shadow evaluation 的 latency、top-k recall 與成本調整。

## Tool Accelerator

### 分類方式

目前網站 chat tools 共 11 個（catalog 3、map 5、data 3），直接一次 Choice 即可；分類只作 criteria/context，不值得為它多一次網路呼叫。MCP tool count 曾隨不同階段與 allowlist 改變，因此只要實際候選超過門檻，才先選穩定的大類，再從該類選 tools。任何數量都從實際 registry 動態計算，不寫成 routing 邏輯常數。

初始大類：

- `discovery`：搜尋／描述圖層或 dataset。
- `read_query`：受限讀取、查詢、分頁。
- `analysis`：aggregate、compare、spatial、quality/evidence。
- `presentation`：呈現 result、圖層控制與相機。
- `session_state`：配對、狀態、results lifecycle、等待 ready。
- `none`：目前工具無法可靠完成。

第一階段只問「需要哪種能力」，不讓 Jev宣稱工具已執行。第二階段回傳 top-k 工具與機率；主 agent仍須檢查 input schema、read/write annotation、session、actor、dataset access 與 limits。

### Criteria 範例

```json
{
  "presentation": {
    "what": "已有合法 layerKey、bounds 或 resultId，需要改變地圖呈現",
    "not_for": "尚未找到資料；需要讀取紀錄；需要判斷資料是否最新",
    "examples": ["打開學校圖層", "框住這批結果", "把透明度調低"]
  }
}
```

## Layer Accelerator

圖層比工具更需要階層式縮減，但分類來源必須沿用 manifest／catalog，不增加第三份手寫圖層索引。

建議流程：

1. 由既有 access/gate 決策移除未授權、owner-only、DEV-only 或 release-hidden layers。
2. 先跑本地 alias／keyword search；精確命中不必呼叫 Jev。
3. 候選仍多時，先以既有 `LAYER_MACRO_GROUPS`（目前 6 類）作第一層，不直接把所有 theme 送入 Choice。
4. 在命中 macro 內，以 manifest/catalog 既有 theme 或 group 作第二層；大多 group 約 1–14 個候選。
5. 交給既有 `searchLayers` 縮到前 10；只有仍歧義時才再用一次 Choice 排序，回 top 3，不直接開啟。超大 group 才允許第三層 Jev，不讓一般問題固定承擔三次 latency。
6. 呼叫 `describe_layer`／`describe_dataset` 驗證來源、可用性、資料角色與限制後，才可交給 `set_layers`。

分類樹是 retrieval index，不是 access SSOT。Jev 不得看到使用者無權搜尋的 layer ID、label、criteria 或 private metadata。

2026-09-20 的 runtime 盤點為：manifest 778 entries、sidebar 62 themes／167 groups／569 toggle keys、search index 580；匿名預設排除 40 gated 後約 540 候選。這些是當下盤點數，不是固定契約；候選永遠從既有 registry/manifest 派生，不新增手寫 Jev layer index。

### 不固定三次 Jev

`最大類別 -> 大類別 -> 小類別` 可以作為資料結構，但 runtime 應跳過沒有必要的層級：

- 本地搜尋剩 6 個候選：直接一次 Choice。
- 剩 45 個且集中在單一主題：跳過主題 Choice，直接選 group。
- 剩 180 個且跨多主題：主題 Choice後再選 layer。
- 使用者輸入精確 layer key：零次 Jev。

## 未來的 Presentation Advisor

「目前畫面是否適合回答」是合理的後續能力，但不與快速 routing 混在一起。先以 deterministic evidence 建立有限方案，再讓 Jev 排序方案：

- 範圍：target bounds、實際 viewport、側欄 padding、zoom。
- 密度：source/result count、rendered density、cluster 或抽樣狀態。
- 樣式：layer geometry role、重疊層數、既有 opacity control 與 UX baseline。
- readiness：loading registry、scene revision、error、truncation。

不得只問一個模糊的「畫面好不好」。應拆成 `target_in_view`、`too_dense`、`occlusion_risk`、`ready` 等單因子，再由程式選擇 `overview`、`detail`、`comparison` 或 `dense-points` 等預先定義 profile。

## Fail-closed 邊界

- authorization 必須發生在 Jev 之前，執行前再驗一次以涵蓋 revocation。
- Jev 不判定資料 freshness、license、production health、missingness 或 geometry correctness。
- 不傳任意 URL、SQL、檔案路徑、完整 GeoJSON、secret 或未授權 metadata。
- 逾時、provider error、低信心、候選不在允許集合或 schema 不符，一律退回既有 deterministic search／agent routing。
- model/provider/version 必須記錄；`latest` 不用於調整過 threshold 的 production policy。
- cache key 至少包含 normalized query、actor access fingerprint、manifest/tool registry version 與目前 map context version；revocation 使相關 cache 立即失效。

## Routing Receipt

每次實驗至少保留：

```ts
interface JevRoutingReceipt {
  requestId: string;
  mode: "tool" | "layer" | "presentation";
  provider: "openrouter" | "cloudflare" | "typesafe";
  model: string;
  taxonomyVersion: string;
  accessFingerprint: string;
  candidateCountBefore: number;
  candidateCountAfter: number;
  stages: Array<{
    questionId: string;
    selected: string | null;
    confidence: number;
    durationMs: number;
  }>;
  fallbackReason: string | null;
  executed: false;
}
```

Routing receipt 只證明候選縮減，不證明工具成功、圖層 ready 或畫面正確。

## 第一輪試驗

先以 shadow mode 執行，不接 tool execution：

1. 取 50–100 條繁體中文真實查詢，涵蓋精確名稱、模糊主題、複合問題、無能力及 owner-only 誘導。
2. 工具比較：一次全選 vs. 大類 + 類內工具。
3. 圖層比較：本地 search top-N vs. theme/group 自適應 routing。
4. 測量 top-1、top-3 recall、p50/p95、總 input tokens、每題成本、fallback rate。
5. 安全硬門檻：未授權候選曝光與選中都必須為 0。
6. 只有端到端 time-to-first-useful-map 明顯改善，才進入 UI／MCP integration。

本輪不延伸到 Presentation Advisor 的 browser 驗收，也不因 shadow 結果自動啟用任何 layer、adapter 或 production route。

本地 shadow 指令：

```bash
npm run research:jev-shadow -- --query "打開台中的醫院圖層" --dry-run
npm run research:jev-shadow -- --query "比較台中各區醫院數量"
```

第二個指令會從本機 `.env` 讀取 `OPENROUTER_API_KEY`，呼叫固定模型 `typesafe/jev-1.13`，只輸出 typed answers 與 `executed:false`，不執行任何網站或 MCP tool。

### 首次 OpenRouter shadow evidence（2026-09-20）

固定模型 `typesafe/jev-1.13`，三次繁中請求均只 routing、沒有執行工具：

| query | capability | MCP analysis Noul | website tool | latency |
|---|---|---:|---|---:|
| 比較台中各區醫院數量並顯示 | analysis 0.93 | 0.91 | search_layers 0.40／confidence 0.33 | 976ms |
| 打開台中的醫院圖層 | map_presentation 0.97 | 0.11 | search_layers 0.69／confidence 0.65 | 493ms |
| 醫院資料每筆代表什麼、缺值意思 | dataset_discovery 1.00 | 0.47 | get_layer_details 0.39／confidence 0.33 | 440ms |

解讀：capability 足以區分網站地圖操作與 MCP dataset／analysis；當需求超出網站工具時，網站 Choice 分布會偏平，不能硬採最高項。因此 routing 先以 capability 決定 surface：`layer_discovery/map_presentation/map_context -> website`，`dataset_discovery/data_query/analysis -> MCP`；capability confidence < 0.6 則 review/fallback。只有 surface=website 時才把 website tool Choice 當候選，仍不自動執行。

### Codex MCP 對接驗證（2026-09-20）

- `pulse-research` 已指向本機 MCP worktree 的 build output，並只透過
  `PULSE_OPENROUTER_ENV_FILE` 指定 env 檔路徑；驗收過程未讀取或輸出 key 內容。
- 最初真 stdio MCP client 列出 27 個 tools；第三階段擴充後為 41 個。兩者均成功呼叫 `pulse_route_request`；測試查詢被分到
  `analysis -> mcp`，回傳 structured candidate tools、confidence、latency 與 `executed:false`。
- MCP 39 tests、Gateway 49 tests、主站 production build 通過。主站完整測試只剩與本輪無關的
  upstream registry 既有 19 筆 JP catalog reference 差異。
- 這些只證明 MCP 進程、schema 與 routing 可用；尚未證明 owner browser pairing、production
  health 或任何資料的即時新鮮度。
