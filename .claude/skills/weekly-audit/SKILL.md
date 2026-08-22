---
name: weekly-audit
description: 每週一次的專案健康度巡檢，產出 docs/audit/weekly/YYYY-Www.md 報告。當用戶說「週巡檢」「每週檢查」「weekly audit」「幫專案做大整理」「這週新增的圖層有沒有資料」「Supabase 長多大了」「S3/R2 花多少錢」「有沒有圖層掛掉」「文件是不是過時了」「README 數字對不對」「專案結構有沒有跑掉」時觸發。查的是「上線之後過了一段時間，東西還健康嗎」——資料活性、儲存成本、效能退化、文件時效、repo hygiene、跨 repo 契約六組。**唯讀巡檢 + 產報告；只有白名單四類整潔問題會自動修**（各自獨立 commit，可單獨 revert）。不做單一 layer 的上線驗收（→ layer-onboarding）、不做 session 收尾（→ wrap-up）、不 deploy、不 push、不寫 DB。主動更新時機：新增檢查項、收集器誤報漏報、某項連續 3 週無變化該降頻、白名單自動修出過事時。
---

# Weekly Audit — 每週巡檢

**目的**：專案每週都在長（新圖層、新資料源、新疊圖），但所有守門機制都是事件觸發的——
CI 在 PR 時跑、`layer-onboarding` 在接線時跑、`wrap-up` 在 session 結束時跑。
沒有人回答「**上線三週後這東西還健康嗎**」。這個 skill 就是回答這句話的。

設計依據與完整檢查項清單：[`docs/proposal/weekly-audit-2026-08-21/README.md`](../../../docs/proposal/weekly-audit-2026-08-21/README.md)

## 何時觸發 / 何時不要

| 觸發 | 不要觸發（該用別的） |
|---|---|
| 「跑一下週巡檢」「這週的檢查」 | 新 layer 剛接好要驗收 → `layer-onboarding` |
| 「幫專案做大整理」 | session 要收尾、整理記憶 → `wrap-up` |
| 「Supabase／S3 現在多大」「花多少錢」 | 某個 RPC 慢要優化 → `/check-rpc` + `supabase-optimize` |
| 「有沒有圖層掛掉／沒資料」 | 某個 feature 的跨 repo commit 對照 → `/handoff` |
| 「README／文件過時了嗎」 | 一次性的專題稽核 → 直接做，別套週巡檢格式 |

## 硬約束（違反即中止）

1. **正式 DB 唯讀**：只能 SELECT／describe，查詢帶 LIMIT。
   每個 session 開頭下 `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;`
   （⚠️ 連線字串的 `default_transaction_read_only` 對 Supabase pooler **無效**，實測過）。
   禁止任何寫入——**包含為了「測試唯讀鎖有沒有效」而試寫**。
   特別是 `pg_stat_statements_reset()`：它會清空 C1 的差分基準且不可逆
   （2026-08-21 真的被誤觸過一次，8/11~8/21 的統計因此永久遺失）。
   要驗證唯讀鎖，用 `SHOW transaction_read_only;` 讀狀態，不要真的送 DML。
2. **執行時段無限制**：這是個人 GIS 專案的 DB。最重的兩支是 `probe_upstream`（~70s）
   與 `collect_supabase`（~64s，A7 亂碼掃描佔其中約 60s；不含 A7 只要 3.8s）。
   想什麼時候跑就什麼時候跑。
   ⚠️ A7 預設是**抽樣**（小表全掃、大表抽樣），能可靠抓到「系統性解碼壞掉」，
   但抓不到「大表裡孤零零幾筆壞」。要窮盡檢查跑 `AUDIT_MOJIBAKE_DEEP=1`（實測 5 分鐘以上）。
3. **報告不得含密鑰**：收集器讀 env 但永不 echo 值。產報告前掃一次，
   出現疑似 secret 一律 `<REDACTED>`。
4. **大檔一律 HEAD 不 GET**：站上有 46MB 級的 geojson。
5. **不碰平行 session 的髒檔**：本 repo 長期有平行 session。dirty 檔只列不動、
   不代為 commit、不 revert。
6. **收集器失敗就標 blocked**，不因為沒收到資料就寫「無異常」。
   `_all.json` 的 `failed[]` 必須反映到報告裡。
7. **必須在主工作樹跑，不要在 `git worktree` 裡跑**（2026-08-21 實測）。
   worktree 只有 git 追蹤的檔案——`public/` 的 1125 個檔在 worktree 裡只剩 156 個
   （PMTiles／大 GeoJSON 全被 gitignore 走 S3），且 `../data-collectors` 等 sibling repo
   的相對路徑會失效。結果是 A3／A5／D5 給出嚴重偏低的假數字、上游探測整組失效，
   **而且不會報錯**——它會安靜地告訴你「只有 18 個 PMTiles」。
   主樹被平行 session 佔用時，寧可等，不要改在 worktree 跑。

## 流程

### Step 0 — 前置

- 確認在 repo root、`.env` 可讀（不讀內容，只確認存在）。
- 看一眼現在幾點：落在 10:00–20:00 就提醒用戶這會打到正式 DB。
- 讀**上一份報告** `docs/audit/weekly/`（最新的那份）——趨勢比較的基準來自報告本身，
  不是 `.claude/.cache/`（cache 不進版控，換機器就沒了）。

### Step 1 — 收集（確定性，不動腦）

```bash
bash scripts/audit/weekly/run_all.sh
```

六支收集器依序跑，任一支失敗不中斷其他支，結果彙整到 `.claude/.cache/weekly-audit/_all.json`。

| 收集器 | 蓋到的檢查項 |
|---|---|
| `collect_supabase.sh` | B1 儲存量／B2 retention 缺口／B3 pg_cron 健康／C1 慢查詢 snapshot／C3 孤兒 RPC／**A7 文字欄位亂碼掃描** |
| `probe_upstream.sh` | A1 動態表斷更／F2 next_refresh 到期／上游 repo 狀態 |
| `probe_layers.ts` | A2 RPC 死鏈／A3 A4 線上資產活性／A5 孤兒資產 |
| `probe_runtime.ts` | **A6 圖層執行期建置**（真的開瀏覽器跑正式站，比對 registry 期望的 sourceId 與實際建起來的）|
| `probe_production.sh` | C4 正式站回應／B6 CDN 快取有效性 |
| `check_docs.ts` | D1 README 數字對帳（14 項：layer 數／dataClass／features 夾／主題數／主題表逐列／上游 dataset／Loader 數／collector 數／nginx location／Three.js Scene）／D2 文件齊全／D3 落後／D4 散檔／D5 狀態檔／D7 params 漂移／D8 頻率覆蓋 |
| `check_hygiene.sh` | E1 未 push／E2 dirty／E3 大檔誤入 git／E4 public 用量 |

參數：`--skip-network`（離線只跑 docs／hygiene）、`--only <name>`（只跑一支）。

### Step 2 — 對帳與趨勢

拿本週 `metrics` 對上週報告的趨勢表做差分。**要自己算變化量，不要只報當下值**。

> **首跑無基準時**：`docs/audit/weekly/` 找不到上一份報告 → 趨勢表所有「上週」欄一律標
> `—（無基準，本份即基準）`。**不得推測、不得回填、不得拿 proposal §3 的實測數字冒充上週值**。

- Supabase 週增量（>3GB／週 → 🟡，異常跳升 → 🔴）
- 慢 RPC 數量變化。⚠️ `pg_stat_statements` 是**自上次 reset 起的累計視圖**，
  當下均值會混入舊時代 → 用本週 snapshot 減上週 snapshot 的 `calls`／`total_exec_time` 求本週真實均值。
- 斷更表數、線上 404 數、孤兒資產總量的增減。

### Step 3 — 判讀（LLM 的活）

收集器只給初判，這步要覆寫成有根據的判斷：

1. **慢查詢必附「誰在打」**——`pg_stat_statements` 只給數字不給呼叫者。
   逐一 `grep -r "<rpc_name>" src/`、查 `cron.job.command`、必要時查上游 repo。
   前端在打 vs 背景 job 在打，嚴重度完全不同。
   （實例：`health_snapshot` 均值 23 秒看似重大效能債，查完發現前端根本沒呼叫，
   是 `data-collectors/tasks/monitoring.py` 的背景監控——從 🔴 降為 🟡。）
2. **孤兒判定要收斂口徑**——「DB 有 1023 個 function」是含 extension 的毛數，
   排除 extension-owned、pg_cron 呼叫的、前端用到的之後才是候選（實際約 86 個，不是 800 多）。
3. **散檔歸檔看連結不看檔名**——`water-resources-status.md` 看起來像一次性 status，
   實際是全域 MEMORY.md 指定的現行狀態檔。
4. **本週新增圖層專章**：先 `git log --since="7 days ago" --stat src/data/layerManifest.ts` 看範圍，
   要看內容用 `-U0`（**不要用 `-p`**，這是萬行登記簿，完整 diff 會灌爆 context）抓新 entry，
   逐一過 A1~A4（有沒有資料、線上檔在不在、UX 四鐵則有沒有漏）。

### Step 4 — 產報告

寫 `docs/audit/weekly/YYYY-Www.md`（ISO 週編號，`date +%G-W%V`）。結構：

```markdown
# Weekly Audit YYYY-Www (YYYY-MM-DD ~ MM-DD)

## 摘要
🔴 N · 🟡 N · 🟢 N ｜ 上週：🔴 N · 🟡 N
（收集器失敗時在這裡標明哪幾項是 blocked）

## 趨勢
| 指標 | 本週 | 上週 | 變化 |

## 🔴 需拍板
- [代號] 標題 → 證據 → 建議動作

## 🟡 已列入 backlog
## 🟢 已自動處理
## 本週新增圖層驗收
## 本次巡檢的盲區
（沒跑到的、被 timeout 的、上游 repo 不在的，據實列出）
```

### Step 5 — 自動修（白名單，逐類分開 commit）

先開分支 `chore/weekly-audit-YYYY-Www`（**不要直接 commit 到當前分支**——這個 repo 有 39 個
branch、15 個無 upstream、長期有平行 session，整潔 commit 混進別人的 feature 分支會很難拆）。
只有這四類能自動動手，**每類一個 commit**，方便單獨 revert：

| 動作 | commit 前綴 |
|---|---|
| 補 `.gitignore`（大檔誤入版控） | `chore(audit): ` |
| 更新 README 中與 manifest 對不上的數字 | `docs(audit): ` |
| 補 `docs/features/*/` 缺的檔案骨架（照 `_TEMPLATE`） | `docs(audit): ` |
| 更新過期的狀態檔數字（如 `PMTILES_STATUS.md`） | `memory: ` |

**不在白名單 = 列進報告等拍板**：搬移／刪除文件、改程式碼、改 migration、
動 pg_cron、動 S3／R2 物件、push、deploy、`git add -A`。

### Step 6 — 收尾

- 更新 `docs/audit/weekly/README.md` 的趨勢表（追加一列）。
- 🔴🟡 條目 append 到 `.claude/memory/BACKLOG.md`，避免報告寫完就沉底。
- 回報用戶：先講 🔴，再講變化最大的趨勢，最後才是清單。

## 本 skill 不做

- 不做真 render 驗收（圖層畫面是不是空白）——需要 agent-browser，v2 再加。
  v1 只驗「資料源活著」，這個界線要在報告裡講清楚。
- 不做單層上線驗收、不做 session 收尾、不做 feature 開發。
- 不重跑 `tsc -b` / `npm test`——CI 每個 PR 已經在守，重跑是浪費。
- 不 deploy、不 push、不寫 DB、不動雲端物件。

## 已知盲區（每份報告都要誠實標示）

**本 repo 內查不到「上游資料多久沒更新」**。`src/data/upstreamRegistry.ts` 只做
layer_key ↔ catalog dataset_id 的橋接，沒有頻率／最後更新時間欄位；
頻率目前散在各 `handoff.md` 的自由文字（44 份中 23 份有寫），無法機器巡檢。
A1 能抓到**動態表**斷更，半動態／靜態資料的過期只能靠 F2 跨 repo 讀 catalog frontmatter。
長期解是把更新頻率結構化——這是本 skill 之外的獨立工作。

## 腳本實作陷阱（改收集器前必讀）

1. `src/data/layerParamsSpec.ts` 含非文字位元組，**BSD grep 會判成 binary 並靜默回空**（不報錯）。
   用 import 讀，或 `grep -a`。
2. **資料夾層級 `git log -1` 會被批次 commit 洗掉**（一個 `docs(backlog): reorganize…`
   摸過幾乎每個 feature 夾）。staleness 要看單檔，或排除 `docs:`／`memory:` 前綴的 commit。
3. `.claude/.cache/weekly-audit/` 不進版控——所以趨勢比較的基準是**報告本身**，
   報告的趨勢表必須自帶關鍵數字。
4. **判定不要拿「結構上本來就會不等」的兩個數字當紅線**（2026-08-21 教訓）。
   原本 Three.js 檢查用 `目錄總項目數 !== *Scene.ts 數` 判歧義，但 `src/three/`
   本來就有支援檔與 `shaders/` 子目錄——這種判準會永遠亮黃，變成每週噪音。
   正確做法是比對「README 宣稱的數」與「該敘述真正對應的實際數」。
5. **「30+」「約 N」這種開放式寫法不能當精確值比**。collector 差 2 倍才報、
   nginx location 差 30% 才報，否則每週都在報一個作者本來就沒打算寫精確的數字。

## 主動更新時機

- 新增檢查項 → 改對應收集器 + 本檔 Step 1 的表 + proposal 的 §2 總表 + **本檔 frontmatter 的 description**，
  四處同步（description 若寫死項目數就會 drift，所以它現在只寫「六組」不寫總項數）。
- 收集器誤報／漏報 → 先改腳本，並把踩到的坑寫進上面「腳本實作陷阱」。
- 連續 3 週某項都是 🟢 且沒變化 → 考慮降頻或移除，別讓報告變成噪音。
- 白名單自動修出過事 → 立刻把那類移出白名單，並在此註明原因。
- v2 接上 agent-browser 真 render 驗收後 → 改寫「本 skill 不做」第一條。

## Related

- 設計提案：`docs/proposal/weekly-audit-2026-08-21/README.md`
- 報告索引：`docs/audit/weekly/README.md`
- 上層生態的跨 repo drift check：`../.gis-agent-system/schedule/`
- 相鄰 skill：`layer-onboarding`（單層上線驗收）、`wrap-up`（session 收尾）、
  `supabase-optimize` + `/check-rpc`（慢 RPC 的處置）
