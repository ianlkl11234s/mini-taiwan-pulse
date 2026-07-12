# 會員系統 + BYOK 空間問答 — 系統架構規劃

> 建立：2026-07-02 · 狀態：規劃完成、待拍板開工
> 需求來源：用戶三大需求 —— (1) BYOK 金鑰管理與資安 (2) Google 登入會員 + 查詢記錄 (3) 空間資訊問答 + 地圖聯動

---

## 0. 一句話結論

**會員走 Supabase Auth（= 落地 AR-42），問答走「純前端 BYOK agent loop」（= AR-43 的變體）：
使用者的 LLM key 只存在瀏覽器、直連三家 API，永不經過我方伺服器；
LLM 透過白名單 tools 操作地圖與查資料，絕不生 SQL 直打 DB。**

---

## 1. 與既有規劃的關係（先讀，避免重造）

| 既有文件 | 關係 |
|---|---|
| `architecture-overhaul-plan.md` AR-42 | 會員系統已規劃（Supabase Auth + user_profiles + RLS）→ **本計畫直接落地它** |
| `architecture-overhaul-plan.md` AR-43 | 對話介面已規劃，但走「後端 Edge Function + 單一 key」→ **本計畫改走 BYOK**（差異見 §1.1）|
| `architecture-overhaul-plan.md` AR-41 / audit D3 | 收窄 Exposed schemas 到 public only → **上 Auth 前的硬前置** |
| worktree `mini-taiwan-pulse-auth/docs/auth-membership-plan.md`（2026-06-25，未 commit） | 已拍板：Google OAuth only、GA4 為主的使用監測、收藏延後 → **Phase 0 骨架照抄、GA4 分工結論沿用**，本檔取代它成為 SSOT |
| `worldmonitor-taiwan-vision.md` A3 | 「AI Brief 每 30 分鐘後端 Haiku」→ 與本計畫獨立不衝突，屬未來免費 tier 素材（Phase 4）|
| `monitor-mode.md` / `alerts-integration-impl.md` | 其 pre-aggregate 薄 RPC（news/alert 系列）= 問答 tool 的現成白名單成員 |
| P2 layer manifest（未做） | AR-43 原本依賴 manifest 當 tool schema 來源 → **本計畫不等它**：先用 `layerCatalog.ts` THEMES 當目錄（它本來就是 sidebar SSOT），tool 層設計成目錄來源可抽換，manifest 落地後一行切換 |

### 1.1 拍板點：BYOK vs 後端單 key

兩者**不互斥**，是分層策略：

| | BYOK（本計畫主體） | 後端單 key（AR-43 原案，延後為 Phase 4 選項）|
|---|---|---|
| 費用 | 使用者自付 | 站方付（Haiku/Flash 級便宜模型）|
| Key 風險 | 站方零經手 | 站方管一把 key（Edge Function 隔離）|
| 用途 | 主要問答功能，無限量 | 未來「免登入試用 N 次」的免費額度 |

---

## 2. 總體架構

```
┌────────────────────────── Browser（信任邊界內只有使用者自己）──────────────────────────┐
│                                                                                        │
│  ChatPanel ──> chatStore（satelliteConsoleStore pattern）                              │
│      │                                                                                 │
│      ▼                                                                                 │
│  Agent Loop（Vercel AI SDK，maxSteps tool-calling）                                    │
│      │  ├─ apiKey ◄── KeyVault（memory / sessionStorage / opt-in localStorage）       │
│      │  └─ 直連：api.anthropic.com / api.openai.com / generativelanguage.googleapis.com│
│      ▼                                                                                 │
│  Tool Registry（白名單，兩類）                                                          │
│   ├─ 地圖操作：set_layers / fly_to / jump_to_place / highlight_point / all_off        │
│   │            （直接綁 App.tsx 既有 handler，零新增地圖邏輯）                          │
│   └─ 資料查詢：query_geojson_dataset（靜態檔記憶體統計）                                │
│                query_h3_population（h3-js 空間 join）                                  │
│                call_rpc（Supabase anon RPC 白名單）                                    │
│                get_data_catalog（metadata.data_catalog 現成 RPC）                      │
│                                                                                        │
│  Auth：supabase.auth（Google OAuth）──> profiles / user_favorites / chat_logs（RLS）  │
└────────────────────────────────────────────────────────────────────────────────────────┘
         ▲ 靜態 geojson/PMTiles（S3/CDN）        ▲ Supabase gis-platform（public RPC only）
```

LLM key 的資料流只有一條：`使用者輸入 → 瀏覽器記憶體/storage → 直連 LLM API`。
我方伺服器（Supabase / Zeabur / S3）**在這條路徑上完全不存在**。

---

## 3. 子系統 A：BYOK 金鑰管理（需求 1）

### 3.1 為什麼「瀏覽器直連」可行

| Provider | 瀏覽器 CORS | 做法 |
|---|---|---|
| Anthropic | ✅ 官方支援 | request header `anthropic-dangerous-direct-browser-access: true`（官方為 BYOK 場景設計；SDK 對應 `dangerouslyAllowBrowser: true`）|
| OpenAI | ✅ 允許 | 直接 fetch，官方警示「勿曝露自己的 key」不適用於 BYOK（key 是使用者自己的）|
| Google Gemini | ✅ 允許 | `@google/genai` 支援瀏覽器執行 |

這是 TypingMind / Chatbox / big-AGI 等 BYOK 工具的業界標準做法。

### 3.2 儲存策略（誠實版）

| 層級 | 存放 | 生命週期 | 預設 |
|---|---|---|---|
| L1 | React state（記憶體） | 分頁關閉即消失 | ✅ 永遠 |
| L2 | sessionStorage | 分頁存活期間 | ✅ 預設勾選「本分頁記住」 |
| L3 | localStorage | 永久，需一鍵刪除 | ⬜ opt-in「在此瀏覽器記住」+ 風險說明 |

**不做 passphrase 加密**（WebCrypto AES-GCM）：加密 key 若同存瀏覽器只是 obfuscation；
若要求每次輸入 passphrase 則摩擦等同重貼 key。XSS 場景下運行時記憶體一樣讀得到，加密不改變威脅模型。

### 3.3 真正的防線（XSS 防護 + 洩漏面歸零）

1. **CSP header**（Zeabur/Cloudflare 設）：`script-src 'self'`；`connect-src` 白名單 =
   supabase + 三家 LLM API + mapbox + S3/CDN 域名。第三方 script 一律不引入。
2. **洩漏面歸零守則**（code review 檢查點）：
   - key 絕不進 `chat_logs` / GA4 event / console.log / 錯誤訊息（catch 時 strip）
   - key 絕不放 URL / query string
   - UI 欄位 masked，只顯示尾 4 碼，附「測試連線」與「刪除」按鈕
3. **使用者端建議**（設定頁文案）：建議建立**專用低額度 key**
   （OpenAI project key + 月花費上限 / Anthropic workspace key / Gemini 免費 tier）。
4. **費用透明**：每則回答下方顯示該輪 token 用量與估算成本。

### 3.4 模型選單

各家提供 2 檔：預設輕量檔（tool-calling 夠用、便宜）+ 進階檔。
實作時以各家當時最新型號為準，方向：Anthropic `claude-haiku-4-5`（$1/$5 per MTok）起步、
OpenAI mini 級、Gemini Flash 級；進階檔給 Sonnet / GPT 主力 / Gemini Pro 級。

---

## 4. 子系統 B：對話引擎

### 4.1 Provider 抽象

用 **Vercel AI SDK**（`ai` + `@ai-sdk/anthropic` / `@ai-sdk/openai` / `@ai-sdk/google`）：
- 統一三家的 tool-calling 格式與 streaming（自刻要維護三套差異極大的 wire format）
- 純 fetch、可在瀏覽器跑；Anthropic provider 帶 §3.1 的 header
- agent loop 用 `maxSteps`（建議 5-8），LLM 可連續呼叫多個 tool 再作答

### 4.2 System prompt 組成（順序即快取順序，穩定在前）

1. 站台簡介 + 回答規範（繁中、簡潔、引用資料日期）
2. **主題索引**：只放 19 個主題名 + 一行說明（~300 tokens）；完整圖層目錄**不進 prompt**，
   LLM 需要時呼叫 `list_layers` / `search_layers` tool 查（§5.1；2026-07-02 拍板改 tool 模式）
3. tool 使用規範（先查目錄再開圖層；查數字用 query tool 不要瞎猜；回答附資料來源）
4. 動態尾段：當前開啟圖層、timeline 時間、地圖視角（每輪更新，放最後不破壞快取）

### 4.3 前端掛法（照既有 pattern，改動最小）

| 新檔 | Pattern 來源 |
|---|---|
| `src/state/chatStore.ts` | 照抄 `satelliteConsoleStore.ts`（useSyncExternalStore）|
| `src/components/chat/ChatPanel.tsx` | 仿 `MonitorPanel` 浮層掛法（absolute + zIndex + open state）|
| `src/components/chat/KeySettings.tsx` | 設定頁（provider/model 選擇 + key 輸入）|
| `src/chat/agent.ts` | agent loop + provider 工廠 |
| `src/chat/tools/registry.ts` | tool schema + 執行體綁定 |

App.tsx 只加：一顆觸發按鈕 + `<ChatPanel …/>`，把既有 handler 當 props 傳入
（`handleBulkSetVisibility` / `handleAllOff` / `handleLocationJump` / `setFeatureInfo` / `mapRef`）。

---

## 5. 子系統 C：Tool 層（安全邊界所在）

**原則：LLM 只能呼叫白名單 tool；絕不讓 LLM 產生 SQL；DB 暴露面 = 既有 anon RPC，零新增。**

### 5.1 地圖操作 tools（既有 handler 直綁，幾乎零成本）

| Tool | 綁定 | 出處 |
|---|---|---|
| `set_layers(keys[], visible)` | `handleBulkSetVisibility` | App.tsx:1497 |
| `all_layers_off()` | `handleAllOff` | App.tsx:1487 |
| `fly_to(lng, lat, zoom?)` | `mapRef.current.flyTo` | 範例 App.tsx:1807 |
| `jump_to_place(presetId)` | `handleLocationJump` + `cameraPresets.ts`（具名地點目錄）| App.tsx:1514 |
| `highlight_point(lng, lat, layerType?, properties?)` | `setFeatureInfo` → 自動觸發 halo（useSelectedFeatureHalo）+ popup（PANEL_REGISTRY）| App.tsx:687 |
| `list_layers(theme)` | `THEMES`（layerCatalog.ts）依主題回傳 key + 中文名 | layerCatalog.ts:321 |
| `search_layers(query)` | `LAYER_LABELS` 中英文關鍵字比對，回前 10 筆 | layerCatalog.ts:1034 |

### 5.2 資料查詢 tools

| Tool | 實作 | 回答什麼 |
|---|---|---|
| `query_geojson_dataset(datasetId, op)` | fetch 靜態 geojson（datasetId → sourceUrl 白名單，起步 ~15 個常問資料集）→ 記憶體 count / groupBy / filter / nearest | 「全台幾個警察局？分類？」→ `police_stations` 2065 點 groupBy `facility_subtype`（7 類）|
| `query_h3_population(points, res)` | h3-js `latLngToCell` × `public/h3/h3_population_res8.json`（日/夜間人口）| 「哪些消防分隊附近人口密度最高」|
| `call_rpc(name, params)` | **白名單** anon RPC：`get_data_catalog_by_theme` / `get_fire_events_by_year` / `get_h3_demographics_yearly` / news・alert 系列薄 RPC…（起步 ~10 支，全部已存在）| 時序/事件類問題 |
| `get_data_catalog(theme)` | 現成 `metadata.data_catalog` RPC（migration 269）| 「有哪些消防相關圖層/資料？」|

### 5.3 護欄

- **回傳截斷（鐵則，2026-07-02 拍板確認）**：任何 tool **永不回傳全量資料**——一律回統計值、
  top N 示範案例（如 top 20 + 總數 + 欄位摘要）或合理範圍內的節錄；防灌爆 context 與費用
- **loadingRegistry**：資料類 tool 執行包 `withLoading`（守 CLAUDE.md 規則 3）
- **Prompt injection 天花板**：tools 全部唯讀查詢 + 前端視覺操作，最壞情況 = 亂開圖層亂飛視角，無資料寫入面（chat_logs insert 由前端程式碼做，不是 tool）
- **2min pooler timeout** 同樣適用 tool 的 RPC 呼叫（白名單只收薄 RPC）

### 5.4 範例走查

1. **「目前全臺灣有多少個警察局？分類有哪些？」**
   `query_geojson_dataset('policeStations', {op:'groupBy', field:'facility_subtype'})`
   → 2065 點 / substation・precinct・police_dept・specialized・headquarters・security・other
   → 作答 + `set_layers(['policeStation'], true)` 讓答案上圖。
2. **「臺北市消防局與警察局的分佈與服務範圍」**
   `set_layers(['fireStations','policeStation','fireIsochroneCoverage'], true)` + `fly_to(121.56, 25.04, 11)`
   → 消防服務範圍用現成救援等時圈 PMTiles；警局服務範圍用現成 `policeIso*` 三層等時圈。
3. **「哪些消防分隊附近人口密度最高？」**
   `query_geojson_dataset('fireStations')` 取 716 點 → `query_h3_population(points, 8)` join 夜間人口
   → 排名 top 10 文字作答 + `highlight_point` 第一名 + 開 `fireStations` + h3 人口圖層疊圖。

---

## 6. 子系統 D：會員系統（需求 2）

> 2026-07-03 更新：會員功能細部規劃（會員面板 icon / 收藏快照 schema / 上站統計 / migration 273+274 / 風險 8 條）
> 已拍板獨立成 [`member-features-plan.md`](./member-features-plan.md)（M 系列）。本章保留架構決策，實作以該檔為準。

### 6.1 Auth

- Supabase Auth + **Google OAuth only**（沿用舊計畫拍板）；gis-platform Dashboard 開 provider，
  redirect URL 白名單：`localhost:3721` + 正式域名
- `src/lib/supabase.ts` 補 auth options（persistSession / detectSessionInUrl）
- 新增 `src/lib/auth.ts`（signInWithGoogle / signOut / useUser hook）+ 右上 Avatar 元件
- **硬前置 AR-41/D3**：確認 Supabase Exposed schemas 只留 `public`，再開 Auth

### 6.2 資料表（gis-platform migration，全新 — 現有 270 個 migration 中零 auth 相關）

```sql
profiles        (id uuid PK FK auth.users, display_name, avatar_url,
                 tier text default 'free', created_at)          -- + signup trigger 自動建列
user_favorites  (id, user_id FK, name, state_snapshot jsonb,    -- 圖層 keys + 時間 + 相機視角
                 created_at)
chat_logs       (id, user_id uuid NULL, session_id text,        -- 匿名用 sessionTracker id
                 provider text, model text, question text,
                 answer_summary text, tool_calls jsonb,
                 latency_ms int, created_at)                     -- ⚠️ 絕不含 API key
```

RLS（本專案首批 authenticated 政策）：
- `profiles` / `user_favorites`：本人 CRUD
- `chat_logs`：本人 insert + select 自己的；後台用 service role / Dashboard SQL 看全量
- 匿名 chat_logs：`user_id NULL` + anon insert 允許（掛 session_id），量大再加 rate limit

### 6.3 監測分工（沿用 2026-06-25 GA4 結論）

- 通用行為（DAU / layer_toggle / popup_open）→ GA4；登入後 `gtag('set', {user_id})`
- **對話內容與 tool 軌跡** → Supabase `chat_logs`（內容型資料，GA4 放不下也不該放）
- 後台掌握使用狀況：初期 Dashboard SQL 即可，不先刻 admin UI

### 6.4 匿名 vs 登入

| | 匿名 | 登入 |
|---|---|---|
| 瀏覽全部圖層 | ✅ | ✅ |
| BYOK 問答 | ✅（自帶 key 即可） | ✅ |
| 查詢記錄歸戶 | session 級 | 帳號級（可跨裝置看歷史）|
| 我的最愛圖層（狀態快照） | ❌ | ✅ |
| 未來免費額度 / plus tier | ❌ | 預留 `tier` 欄位 |

---

## 7. Phase 切分與跨 repo 順序

> 跨 repo 順序照規：**gis-platform 先動（migration + OAuth），mini-taiwan-pulse 後接**；
> 開工時在 `taipei-gis-analytics/docs/handoff/member-byok-chat.md` 建 handoff。

| Phase | 內容 | 依賴 | 規模 |
|---|---|---|---|
| **P0 會員基礎** | AR-41 schema 收窄確認 → OAuth provider → `profiles` migration → auth.ts + Avatar | 無 | 1-2 天 |
| **P1 BYOK 對話 MVP** | KeySettings + KeyVault → AI SDK provider 層 → ChatPanel/chatStore → 地圖操作 5 tools → system prompt 目錄 → CSP header | 無（可與 P0 平行）| 3-5 天 |
| **P2 資料問答** | query_geojson_dataset（15 資料集白名單）→ h3 join → call_rpc 白名單 → 回傳截斷護欄 | P1 | 3-5 天 |
| ~~P2b 警局服務範圍~~ | **免做（2026-07-03 確認）**：master 已有 `policeIsoSubstation` / `policeIsoPrecinct` / `policeIsoCityDept` 三層警局等時圈 PMTiles（PR #44），chat 開圖層即可回答 | — | 0 |
| **P3 會員加值** | `user_favorites` + `chat_logs` migration → 收藏 UI → 對話記錄寫入 + 歷史同步 → GA4 接線 | P0+P1 | 2-3 天 |
| **P4 延後選項** | 免費額度（Edge Function + 站方 Haiku key = AR-43 原案）／對話 pin 成 Monitor 面板（AR-44）／tool 目錄切到 layer manifest（P2 overhaul 完成後）| P1-P3 | 另議 |

分支：`feat/member-auth`（P0/P3，worktree 已在）+ `feat/byok-chat`（P1/P2），各自 PR squash 進 master。

---

## 8. 風險與待拍板

1. **第三方 CORS 政策可變**（OpenAI/Gemini 非契約保證；Anthropic 是官方明文支援）。
   **拍板（2026-07-02）：不做 proxy 備援、不降級**——「key 零經手」的信任模型永不妥協。
   若某家封鎖瀏覽器直連：UI 誠實揭露「該 provider 暫不支援」，引導切換其他家；
   公開站屬附贈性質，本地開發不受影響。
2. **localStorage 的殘餘風險**要在 UI 明說（同機惡意程式 / 共用電腦）；預設 sessionStorage。
3. **匿名 chat_logs 濫寫**：anon insert 開放後可能被灌；先靠前端節流 + 量大再上 DB 端 rate limit。
4. ~~圖層目錄 token 成本~~ **已解決（2026-07-02 拍板）**：目錄改 `list_layers` / `search_layers`
   tool 模式（§4.2 / §5.1），system prompt 只留主題索引 ~300 tokens。
5. **待拍板**：(a) P0/P1 先做哪個（建議平行，見 §7 註）；(c) GA4 property 歸屬（舊計畫遺留問題）。
6. **已拍板**（2026-07-02）：(b) 匿名使用者**也記** chat_logs，`user_id NULL` + sessionTracker 的匿名 session_id。

---

## 9. 驗收回饋修正清單（2026-07-03 凌晨，用戶實測後；預計 04:30 chain 派工）

> 現況：P1+P2+高度讓位已完成並通過審查，worktree `mini-taiwan-pulse-byok` **未 commit**，
> dev server 3799 運行中。用戶端到端實測通過，回饋以下修正。

### FX-1 IME 中文輸入 Enter 誤送出 + 送出後文字殘留（P0，同一根因）
`ChatPanel.tsx` 的 `handleKeyDown` 沒有處理 IME composition：注音/拼音選字按 Enter 會被當成送出
（送出當下組字未完成 → `setDraft("")` 清了 state 但 IME 之後才 commit 文字回 textarea → 看起來沒清掉）。
修法：`if (e.nativeEvent.isComposing || e.keyCode === 229) return;` 於 Enter 分支前。

### FX-2 對話記憶強化：tool 結果進歷史（P1）
現況 `agent.ts` 的 `toModelMessages` 只送文字 content，前輪 tool 執行結果不在歷史裡
→ 追問「你有開啟嗎？」模型只能重跑工具。修法：assistant 歷史訊息若有 `toolCalls`，
把 summaries 併進 content（如附註「[已執行：開啟 2 個圖層]」），輕量且不撐爆 context。

### FX-3 顧問式深對話（「垃圾清運有哪些圖層、你建議怎麼做、他們的關係」）（P1）
1. 新 tool `get_layer_details(keys[])`：彙整 layerCatalog（主題/分區）+ `get_data_catalog_for_layer`
   （上游來源/更新頻率）回富 metadata，讓模型能講「圖層之間的關係」
2. `DATASET_WHITELIST` 擴充廢棄物主題（掩埋場/焚化廠等靜態 geojson，先盤 public/ 有什麼）
   ——用戶實測「總共幾個掩埋場」因白名單沒有而答不了
3. system prompt 加顧問段：被問「建議/怎麼做/關係」時，先 list_layers + get_layer_details
   蒐集脈絡再給結構化建議（開哪些圖層、疊圖順序、時間軸怎麼用）

### FX-4（順帶）model 檔位切換提醒
顧問式問題建議引導用戶用進階檔（Sonnet 級）；輕量檔（Haiku 級）容易偷懶。
低成本做法：KeySettings 的模型下拉 hint 文案補一句。

### FX-5 Agentic 工具人體工學（2026-07-03 上午，用戶實測 Haiku 躺平後加）
1. `query_dataset` 查 0 筆 / 欄位不存在 → 回可用欄位 + 樣本值 + 建議下一步（讓模型自我修正）
2. 新增 op `filterContains`（address 等文字欄模糊比對）——解「台北的派出所」類問題
3. 空回覆 bug：錯誤必須 surface 到 UI；content 空且無 error 時補 fallback；systemPrompt 加「工具失敗也必須文字總結」
4. maxSteps 6 → 10
5. 架構結論（盤點後拍板）：**不引入** Agent SDK（需後端、Anthropic-only）與 Dify（key 進伺服器、
   tools 在瀏覽器架構錯位）；維持瀏覽器內 AI SDK loop。模型因素實證：Gemini 2.5 Pro 表現佳。

### 收尾（修正完成後）
`docs/features/byok-chat/`（從 _TEMPLATE）→ 分批 commit → PR（模板）→ 用戶 squash merge。
