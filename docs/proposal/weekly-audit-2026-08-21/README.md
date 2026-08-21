# Weekly Audit — 每週專案巡檢（提案）

> 日期：2026-08-21 · 狀態：**提案，待拍板**（三個旋鈕見 §8）
> 目標：把「新圖層有沒有資料 / 效能機制還在不在 / 文件過不過時 / 儲存長多大」這類
> 每週該看一眼、但沒人固定看的事，收成一個指令跑得完、有報告可回溯的例行動作。

## 0. 問題定義

專案每週都在長：新圖層、新資料源、新疊圖。目前的守門機制都是**事件觸發**的——
CI 在 PR 時跑、`layer-onboarding` 在接線時跑、`wrap-up` 在 session 結束時跑。
沒有任何機制回答「**上線之後過了三週，這東西還健康嗎**」。

實測佐證（2026-08-21 現場跑，見 §3）：正式 DB 已 37 GB、71 個 pg_cron job、
DB 端 1023 個 public function 但前端只用得到 158 個、有 RPC 平均耗時 23 秒被呼叫 522 次——
這些沒有一項會讓 CI 變紅，也沒有一項會出現在任何人的待辦清單上。

## 1. 定位與邊界（不與既有機制重疊）

| 機制 | 時機 | 問的問題 |
|---|---|---|
| GitHub Actions CI | 每次 PR / push | 這次改動有沒有弄壞編譯與契約？ |
| `layer-onboarding` skill | 新圖層接線當下 | 這一層上線該檢查什麼？ |
| `wrap-up` skill | session 收尾 | 這次 session 做了什麼、記憶怎麼寫？ |
| **`weekly-audit`（本提案）** | **每週一次** | **整個專案現在健康嗎？哪裡在腐化？** |
| `.gis-agent-system/schedule/` | 跨 repo 生態 | 15 個 repo 的 hygiene 與資料新鮮度 |

**本 skill 不做**：不 deploy、不 push、不改 migration、不寫 DB、不做 UI 視覺驗收（v1）。
純讀 + 產報告 + 把該修的變成 backlog 條目。

與上層 `.gis-agent-system/schedule/` 的關係：**借它的慣例、不搬到它那裡**。
沿用 spec-driven 的 🟢🟡🔴 drift 分級與 dated check 檔慣例；範圍限 pulse repo（外加對上游的唯讀探測）。
> 上層框架 2026-05-30 建好後從未跑過（`checks/` 目錄不存在）。教訓很明確：
> **它死在沒有可執行物**。本提案的 v1 成敗判準是「一個指令跑完就有一份報告」，不是清單有多完整。

## 2. 檢查項總表

分六組。`自動化` 欄：⚙️＝腳本全自動、🤝＝腳本收集＋人／LLM 判讀、👁＝目前只能人工。

### A. 資料活性 — 「新圖層有資料嗎 / 圖層為什麼空白」

| # | 檢查 | 怎麼查 | 自動化 |
|---|---|---|---|
| A1 | **動態表斷更**：每個 `live.*` 表最後一筆時間戳 vs 預期頻率 | psql 掃 509 表的 `max(ts)`，超過 N×週期＝斷更 | ⚙️ |
| A2 | **RPC 活性**：manifest 內每個 RPC 打一次（帶 LIMIT） | 回 rows／空集合／錯誤三態，空集合是最常見的「圖層空白」根因 | ⚙️ |
| A3 | **靜態資產線上活性**：CDN 上是否還 200 | `curl -I`（**HEAD 不 GET**，有 46 MB 級檔案）+ content-length 比對本機 | ⚙️ |
| A4 | **PMTiles 遠端存在性**：94 個切片檔在 S3／CDN 上都還在 | HEAD + size；本機 sourceLayer 已有 `pmtilesContract` 守 | ⚙️ |
| A5 | **孤兒資產**：S3／`public/` 有檔但無任何 manifest 引用 | 反向比對，抓出付錢養的死檔 | ⚙️ |

### B. 儲存與成本 — 「Supabase 儲存狀態 / S3 價格」

| # | 檢查 | 怎麼查 | 自動化 |
|---|---|---|---|
| B1 | **Supabase 總量與成長**：DB 大小、schema／table top 20、**週增量** | `pg_database_size` + `pg_total_relation_size`，跟上週報告比 | ⚙️ |
| B2 | **retention 缺口**：哪些 `live.*` 時序表只進不出、沒有清理政策 | 比對 pg_cron 的 cleanup job 覆蓋率 | 🤝 |
| B3 | **pg_cron 健康度**：71 個 job 近 7 天成功率、有沒有 job 停擺 | `cron.job_run_details` | ⚙️ |
| B4 | **S3 用量與費用估算**：`deploy-assets/` 各子目錄大小＋總量 | `aws s3 ls --summarize --recursive` × 牌價 | ⚙️ |
| B5 | **R2 用量與費用估算** | rclone `size`（需指定 bucket 名，見 §3 限制） | ⚙️ |
| B6 | **CDN 快取有效性**：抽樣看 `cf-cache-status` 是 HIT 還是 MISS/DYNAMIC | `curl -I` 抽樣 10 個代表性資產 | ⚙️ |

> 💰 成本是**牌價估算不是帳單**：AWS CLI 目前沒有預設 credentials（`aws sts` 失敗），
> Cost Explorer API 拿不到。要真帳單需另外授權，v1 不承諾。

### C. 效能 — 「之前為效能做的調整還在嗎 / 有沒有新的效能議題」

| # | 檢查 | 怎麼查 | 自動化 |
|---|---|---|---|
| C1 | **慢查詢排行**：本週新進榜的慢 RPC | `pg_stat_statements`（已安裝）。⚠️ 它是**自上次 reset 起的累計視圖**，均值會混入舊時代 → 每週存一份 raw snapshot（calls／total_time）到 `.cache/`，**下週做差分**才是「本週真實值」。榜上每一筆都要附「呼叫者」（grep `src/` ＋ 查 `cron.job.command` ＋ 上游 repo） | ⚙️ |
| C2 | **pre-aggregate 覆蓋率**：慢 RPC 有沒有照 `docs/supabase-optimization.md` 套 matview | 慢榜 × 既有 matview 清單比對，缺的丟給 `/check-rpc` | 🤝 |
| C3 | **孤兒 RPC**：約 86 個候選（口徑見 §3 發現 2） | `public` function 排除 extension-owned（`pg_depend deptype='e'`）→ 排除 `cron.job.command` 提及的 → 排除前端 `.rpc()` 用到的 → 人工分批判生死 | 🤝 |
| C4 | **正式站回應時間**：首頁 TTFB、關鍵資產下載時間 | `curl -w`，跟上週比 | ⚙️ |
| C5 | **bundle 體積趨勢** | `vite build` 產物大小，跟上週比 | ⚙️ |

### D. 文件與結構 — 「文件過時 / README 過時 / 結構跑掉」

| # | 檢查 | 怎麼查 | 自動化 |
|---|---|---|---|
| D1 | **README 數字對帳** ⭐ 本組 CP 值最高 | 從 manifest 即時算 layer 數／dataClass 分佈／features 夾數，跟 README 內文的數字做 diff | ⚙️ |
| D2 | **feature 文件齊全度**：47 個 `docs/features/*` 的四檔缺件 | 檔案存在性掃描（目前 5 夾缺件，見 §3） | ⚙️ |
| D3 | **文件落後於程式**：feature 對應的 `src/` 本週有改、但該夾 `changelog.md` 沒動 | `git log` 日期比對，**須排除 `docs:`／`memory:` 批次 reorg commit**（見 §3.1 陷阱 2） | ⚙️ |
| D4 | **docs 頂層散檔**：一次性 plan／status 完成後沒歸檔 | 頂層 25 份 `*.md` × 年齡 × **是否被 CLAUDE.md／README／MEMORY.md 連結**（連結狀態才是判準，不是檔名，見陷阱 3） | 🤝 |
| D5 | **狀態檔過期**：`.claude/memory/PMTILES_STATUS.md` 只記 19 檔、實際 94 檔 | 檔內數字 vs 現場實數 | 🤝 |
| D6 | **豁免名單健康度**：`layerConsistency`／`loadingRegistryContract` 的 exemption ledger 該退場的還躺著 | 名單項目逐一回查現況 | 🤝 |
| D7 | **params spec 漂移**哨兵：`layerParamsSpec` vs manifest `params` 非空的 key 差集（首跑實測已對齊，364=364） | 兩側 key 差集 | ⚙️ |
| D8 | **更新頻率欄位覆蓋率**：44 份 `handoff.md` 只有 23 份寫了更新頻率，且是自由文字 | 覆蓋率統計；長期解是把頻率結構化（見 §3.1 盲區） | 🤝 |

### E. Git 與 repo hygiene — 「結構跑掉」

| # | 檢查 | 怎麼查 | 自動化 |
|---|---|---|---|
| E1 | 未 push 的本地 branch、超過 14 天的 | `git for-each-ref` + 日期 | ⚙️ |
| E2 | 長期 dirty 的工作區檔案（含平行 session 的，**只列不動**） | `git status --porcelain` | ⚙️ |
| E3 | 大檔誤入 git（首跑實測：19 個 >5MB 追蹤檔，最大 `forestry/forest_reserve.geojson` 44.6 MB） | `git ls-files` × 檔案大小 | ⚙️ |
| E4 | 目錄慣例違規：新檔案沒放在 `CLAUDE.md §目錄規則` 指定位置 | 路徑規則比對 | 🤝 |

### F. 跨 repo 契約（選配，看 §8 旋鈕 c）

| # | 檢查 | 怎麼查 | 自動化 |
|---|---|---|---|
| F1 | **上游 handoff 引用未斷**：`upstreamRegistry` 指的 catalog 條目還在 | 已有 `upstreamRegistry.test.ts`，週巡檢確保 sibling repo 有 checkout 才真的驗到 | ⚙️ |
| F2 | **半動態資料該重抓**：`taipei-gis-analytics` catalog 的 `next_refresh` 到期清單 | 複用 `gis-data-onboard` 的 `check_refresh.py` | ⚙️ |
| F3 | **collector 心跳**：`data-collectors` 該跑的還在跑嗎 | 由 A1 的斷更清單反查 | 🤝 |

## 3. 可行性實測（2026-08-21 現場跑過，全部可用）

| 通道 | 結果 |
|---|---|
| Supabase psql | ✅ 通。DB **37 GB**；`live` 509 表／33 GB、`public` 95 表／2052 MB、`spatial` 34 表／1164 MB |
| pg_cron | ✅ **71 個 job**，近 7 天 7828 次執行**全部 succeeded** |
| `pg_stat_statements` | ✅ 已安裝，可直接取慢查詢榜 |
| S3 | ✅ 用 `.env` 的 `S3_ACCESS_KEY` 可列 `s3://migu-gis-data-collector/deploy-assets/` |
| R2 | ⚠️ rclone remote `r2:` 存在，但 token **沒有 ListBuckets 權限**（403）→ 必須指定 bucket 名 |
| AWS Cost Explorer | ❌ 無預設 credentials，**帳單數字拿不到**，只能牌價估算 |
| 正式站 | ✅ `https://mini-taiwan-pulse.itsmigu.com` HTTP 200；首頁 1.2 s／`DYNAMIC`，靜態 geojson `cf-cache-status: HIT` |
| `npm test` / `tsc -b` | ✅ 全綠（50 檔 650 tests／8 s；tsc 11 s）。**CI 已守，週巡檢不重複跑** |

### 首波發現（不用等 skill 做好就已經浮出來的）

1. 🟡 **`public.health_snapshot` 均值 23 秒／522 次**（另有 70 次／17.6 秒的變體）。
   **追查後降級**：前端 `src/` **完全沒有呼叫**，pg_cron 也沒有——呼叫者是
   `data-collectors/tasks/monitoring.py` 與 `daily_report.py`（背景監控），不影響使用者體驗，
   但仍是 DB 負載（統計自 2026-08-11 起算 10 天，約 52 次／天 × 23 秒）。
   ⚠️ 教訓寫進 C1：**pg_stat_statements 只給數字不給呼叫者**，任何慢查詢都要先查「誰在打」再定嚴重度。
2. 🟡 **孤兒 RPC 實際約 86 個，不是 800 多個**。1023 是含 extension 函式的毛數；
   排除 `pg_depend deptype='e'` 後剩 278 個，再排除 34 個被 pg_cron 呼叫的、158 個前端在用的
   → **86 個候選**（其中 `admin_*`／`enforce_layer_access` 等可能由 RLS policy 或
   SECURITY DEFINER 內部呼叫，實際孤兒還會更少）。C3 腳本必須照這個口徑寫，否則第一份報告就在列假孤兒。
3. 🟡 **`live` schema 佔 33 GB／89% 的 DB 體積**，全是時序表；retention 政策覆蓋率待查（B2）。
4. 🟡 **`.claude/memory/PMTILES_STATUS.md` 只記錄 19 個 PMTiles，實際 `public/` 下有 94 個** → 狀態檔已失效。
5. ~~🟡 `public/bus/intercity_bus_routes.json` 89 MB 沒被 gitignore~~ → **首跑推翻**：
   已於 2026-08-18（`1586d36`）加入 .gitignore，且 `git log --all` 確認從未進過版控。
6. 🟡 **README 數字已落後**：README 寫 359 個 layer key／`docs/features` 40 夾，
   實際是 **376 key（366 themed + 10 orphan）／47 夾**。手寫數字天生會腐爛 → D1 自動比對。
   （初盤點的「377／13 orphan」是裸 `grep -c "section: null"` 把型別定義行與註解也算進去，首跑用 import 直讀後更正。）
7. ~~🟡 `layerParamsSpec` 與 manifest params 有 20~30 筆落差~~ → **首跑推翻**：
   兩側 key 集合完全相等（364=364，差集為空），P3 遷移已收尾。D7 保留為未來的漂移哨兵。
8. 🟡 **5 個 feature 夾缺文件**：`property-value`（缺 README+changelog）、`static-to-cdn`、`water-resources`（各缺 changelog+handoff）、`buildings-night-lights`、`chart-hover-tooltip`（各缺 handoff）。
9. 🟡 **docs 頂層 25 份散檔中約 14 份疑似該歸檔**（最舊 129 天）。但**不能用檔名判斷**：
   `water-resources-status.md`／`waste-collection-status.md` 看起來像一次性 status，實際是 MEMORY.md 指定的現行狀態檔。
10. 🟢 首頁 `cf-cache-status: DYNAMIC`（SPA 本體未邊緣快取），對照 `docs/scaling-resilience-runbook.md` 的未完成項。

### 3.1 腳本實作陷阱（盤點時實際踩到，寫進 v1 才不會白做）

1. **`src/data/layerParamsSpec.ts` 含非文字位元組**，BSD grep 會把它判成 binary 而**靜默回傳空結果（不報錯）**。
   掃這檔一律加 `grep -a` 或改用 python3，否則巡檢腳本會悄悄漏檢而且看起來一切正常。
2. **資料夾層級 `git log -1` 會被批次 commit 洗掉**：2026-08-19 一個 `docs(backlog): reorganize…` 幾乎摸過每個
   feature 夾的 `backlog.md`，導致「47 夾全都是三天前更新」的假象。staleness 要看**單檔**（如 `handoff.md`）
   或排除 `docs:`／`memory:` 前綴的批次 commit。
3. **散檔歸檔判準是「有沒有被連結」不是檔名**：要掃 `CLAUDE.md`／`README.md`／`.claude/memory/MEMORY.md`
   有沒有指向它，沒人連結 + 年齡大才是候選。

### 3.2 已知盲區（v1 補不了，要誠實標示）

**本 repo 內查不到「上游多久沒更新」**。`src/data/upstreamRegistry.ts` 只做
「pulse layer_key ↔ taipei-gis-analytics catalog dataset_id」的橋接，
欄位只有 status／datasets，**沒有更新頻率、沒有最後更新時間**。
頻率目前只在各 `handoff.md` 用自由文字寫（44 份中 23 份有寫），無法機器巡檢。

→ A1（掃 `live.*` 表時間戳）能抓到**動態表**斷更；
**半動態／靜態資料**的過期只能靠旋鈕 (c) 跨 repo 讀 catalog frontmatter（F2）。
長期解是把更新頻率結構化進 `upstreamRegistry` 或 handoff frontmatter——這是本提案外的獨立工作，先記著。

## 4. 執行架構

```
scripts/audit/weekly/          # 確定性收集器，每支輸出 JSON 到 .cache/
├── collect_supabase.sh        # B1 B2 B3 C1 C3
├── collect_storage.sh         # B4 B5 B6
├── probe_layers.ts            # A1 A2 A3 A4 A5（讀 layerManifest）
├── probe_production.sh        # C4 F1（HEAD 為主）
├── check_docs.ts              # D1~D6
├── check_hygiene.sh           # E1~E4
└── run_all.sh                 # 依序跑，收攏成一包 JSON

.claude/skills/weekly-audit/SKILL.md   # 編排 + 判讀 + 產報告 + 更新索引
docs/audit/weekly/
├── README.md                  # 索引 + 趨勢表（DB 大小 / S3 大小 / 紅燈數 逐週）
└── 2026-W34.md                # 每週一份，ISO 週編號
```

**趨勢資料放哪**：raw snapshot 走 `.claude/.cache/weekly-audit/`（已在 `.gitignore` 第 67 行涵蓋，不進版控）；
但**每週報告本身進版控**，且報告內的趨勢表要自帶關鍵數字（DB 大小／S3 用量／慢 RPC 數／紅燈數）——
這樣即使換機器或 cache 被清，上一週的比較基準仍在 `docs/audit/weekly/` 裡讀得到。

**分工原則**：腳本只**收集**不判斷（確定性、可重跑、進版控）；
skill 只**判讀**不收集（LLM 做趨勢比較、分級、寫成人看得懂的報告）。
`scripts/audit/` 現有的編號腳本是 2026-06／07 的一次性稽核，放子目錄 `weekly/` 避免混淆。

## 5. 報告格式（每週一份）

```markdown
# Weekly Audit 2026-W34 (2026-08-18 ~ 08-24)

## 摘要
🔴 2 · 🟡 7 · 🟢 12 ｜ 上週：🔴 1 · 🟡 9

## 趨勢
| 指標 | 本週 | 上週 | 變化 |
|---|---|---|---|
| Supabase DB | 37 GB | 35 GB | +2 GB ⚠️ |
| S3 deploy-assets | – | – | – |
| 慢 RPC（>1s） | 12 | 10 | +2 |
| 斷更動態表 | 3 | 1 | +2 🔴 |

## 🔴 需拍板
- [A1] `live.xxx` 已 9 天無新資料，上游 collector 疑似停擺 → 建議動作 …

## 🟡 已列入 backlog
- [C3] 孤兒 RPC 清點第 2 批（40 個）…

## 🟢 已自動處理／無異常
…

## 本週新增圖層驗收
（對照 git log 的新 manifest entry，逐一過 A1~A4）
```

同時把 🔴🟡 條目**追加**到 `.claude/memory/BACKLOG.md`，避免報告寫完就沉底。

## 6. 分級與處置

| 級別 | 定義 | 處置 |
|---|---|---|
| 🟢 | 純整潔問題，改了不會壞事 | 依旋鈕 (b)：自動修 or 列清單 |
| 🟡 | 需要判斷或有成本，但不緊急 | 寫進報告 + append 到 BACKLOG |
| 🔴 | 資料斷更／線上 404／成本異常跳升／安全 | **停下來問**，不自行處置 |

**硬約束**（寫進 SKILL.md）：
- 正式 DB **一律唯讀**（SELECT／describe），查詢帶 LIMIT；不 INSERT／UPDATE／DELETE，
  **也不為了測試唯讀鎖而試寫**。用 `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;`
  （連線字串的 `default_transaction_read_only` 對 Supabase pooler 無效，實測）。
  ⚠️ 2026-08-21 開發過程中 `pg_stat_statements_reset()` 被誤觸一次，8/11~8/21 統計永久遺失。
- **執行時段無限制**。（初版誤把 iCHEF 團隊守則的「避開餐期尖峰」套進來——那條是給 iCHEF POS
  正式庫寫的，這裡是個人 GIS 專案 DB，與餐飲業務無關，不適用。）
- 報告**不得出現任何密鑰**：腳本讀 env 但永不 echo 值，出現疑似 secret 一律 `<REDACTED>`。
- 大檔一律 HEAD 不 GET（`provincial_road.geojson` 是 46 MB）。
- 只列平行 session 的 dirty 檔，**不代為 commit、不 revert**。

## 7. 落地步驟

**v1（2026-08-21 完成，首跑報告 [`docs/audit/weekly/2026-W34.md`](../../audit/weekly/2026-W34.md)）**
1. ✅ 六支收集器 + `run_all.sh`（實跑 6/6 成功、105 秒）
2. ✅ `.claude/skills/weekly-audit/SKILL.md`（已過 `agentskill-expertise` 設計審查，六項修改已 apply）
3. ✅ **實跑產出第一份報告**。收集器初判 4 個 🔴，逐一查證後**全數降級**，真實紅燈 0——
   這個落差是首跑最大的產出：閾值要吃上游 `critical` 旗標與 owner-gated 白名單（見報告末節）。
4. ✅ `docs/audit/weekly/README.md` 索引與趨勢表（W34 數據已填）
5. ✅ `collect_storage.sh`（B4 S3 用量 3.74GB／月費估算 US$0.09；B5 R2 待補 token 權限）

**v2（跑順再加）**
- 真 render 驗收：`agent-browser` 逐層截圖確認不是空白（重，需 WebGL launch args，見全域 memory `agent-browser-mapbox-verify`）
- 排程自動觸發（`/loop` 或 launchd／cron）
- 把 pulse 的巡檢結果回寫到 `.gis-agent-system/schedule/checks/`，讓生態層看得到

## 8. 旋鈕（2026-08-21 已拍板）

| # | 問題 | 決定 |
|---|---|---|
| a | 觸發方式 | ✅ **v1 手動 `/weekly-audit`**，跑順 3~4 週、確認報告真的有用之後再考慮上排程 |
| b | 🟢 級是否自動修 | ✅ **自動修，但分開 commit**（每類一個 commit，可單獨 revert）。只碰確定無害的：gitignore、README 數字對帳、補文件骨架；**不碰程式碼** |
| c | 範圍 | ✅ **含上游唯讀探測**（F1~F3）：gis-platform migration、data-collectors 心跳、taipei-gis-analytics 的 `next_refresh` 到期清單 |

### 自動修的白名單（依 (b) 的界線，只有這些能自動動手）

| 動作 | commit 前綴 |
|---|---|
| 補 `.gitignore` 條目（大檔誤入版控） | `chore(audit): ` |
| 更新 README 中與 manifest 對不上的數字 | `docs(audit): ` |
| 補 `docs/features/*/` 缺的檔案骨架（照 `_TEMPLATE`） | `docs(audit): ` |
| 更新過期的狀態檔數字（如 `PMTILES_STATUS.md`） | `memory: ` |

**不在白名單 = 不自動做**：搬移／刪除文件、改程式碼、改 migration、改 pg_cron、動 S3／R2 物件、
push、deploy、`git add -A`。這些一律列進報告等拍板。
