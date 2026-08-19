# Backlog — 社福長照 Welfare

## Decision recorded（不列入 active）

- **WF-1 · 預設開啟三層？→ ✅ 2026-08-13 owner 拍板：不預設開，維持現況。**
  上游 handoff 建議預設開 `welfareNursingHomes` ＋ `welfareElderlyHomes` ＋
  `welfareDisability`；本 PR 沒有照做，因為與本站 2026-08-10「預設全關」規則衝突
  （`DEFAULT_ON` 是空 Set，訪客一進站不打任何 RPC、不載任何圖層）。照做的話社福會
  變成全站唯一預設開啟的內容，一進站多載 ~1.9 MB。
  owner 確認語意（「預設開＝我打開網址就是」）後拍板維持全關。
  折衷保留：建議的三層排 sidebar 群內最前。日後若要改，
  是 `src/state/layerVisibilityStore.ts` 的 `DEFAULT_ON` 加三個 key，一行。

## Data quality / verifying（owner decision recorded）

- **WF-2 · `medLTC` 暫不同步，待查清上游縮量原因**。上游 2026-08-11 實測 `abc.csv`
  30,764 → 24,409（-20.7%），**C 級巷弄長照站 4,232 → 560（-86.8%）**，已確認是上游
  真實變動不是下載截斷。2026-08-11 用戶拍板**先不同步**（同步等於在 pulse 地圖上
  砍掉約 3,700 個點，得先查清上游為何砍 87%）。本批 9 層與此無關，但兩層同時開時
  使用者會看到新舊並存。
  - Outcome：避免未解釋的上游縮量直接變成地圖缺點；新舊長照體系的差異保持可見。
  - Next action：向上游取得版本差異、C 級定義與完整性證據；查清後再由 owner 決定是否同步。

## Product enhancement / decision needed（另開一棒）

- **WF-3 · 托嬰中心對 0-5 歲人口的人均密度**（上游建議的第三個視覺化）。
  這是**衍生分析層**不是點層 —— 要 join `demographics` 的 0-5 歲人口做面量圖，
  性質同 `funeralOperatorDensity`（無幾何 ＋ feature-state join 鄉鎮界 PMTiles），
  需要自己的 loader / hook。本棒是接線棒，故只上點層。
  ⚠️ 做的時候務必在圖上標「名單約 21 個月舊」。
  - Outcome：把托嬰供給轉成可比較的人口密度，而非只增加點數。
  - Next action：確認 demographics 年份、join 粒度與 stale-data 文案後再開分析層。

- **WF-4 · 長照服務覆蓋分析**（立案機構 vs 特約單位擇一）。
  兩套體系不可 UNION（交集僅 2,365），要做得先拍板用哪一邊。
  可搭 `accessibility-analysis` skill 做等時圈／可近性。
  - Outcome：明確選定一套長照體系計算覆蓋，避免兩套名冊 UNION 造成重複與漏算。
  - Next action：owner 先選立案機構或特約單位，再定義 coverage 指標與驗收範圍。

- **WF-5 · 早療「純社福」切分**。`child_services` 的 `welfare_class = child_dev`
  裡 `unit_type` 含醫院／診所（與醫療主題重疊）。目前只在 popup 提醒，
  沒有做成 filter —— 要做的話是 `welfareChildServices` 再加一個 select。
  - Outcome：使用者可把醫療重疊的早療單位與純社福服務分開讀。
  - Next action：確認 `unit_type` codebook 與 filter labels，再補分類覆蓋測試。

- **WF-6 · 縣市級統計**。9 層的 `city` 覆蓋 ≈100%（僅 child_services 5 筆缺），
  除 `child_services` 少 29 筆外**圖層點數＝全量**，可以直接拿來做各縣市統計。
  現在沒有任何彙總 UI。
  - Outcome：可從 9 層全量點資料得到縣市供給摘要。
  - Next action：先定義統計分母、缺 city 處理與 UI 位置，再開 aggregation POC。

## Conditional / upstream

- **WF-7 · `trust_chain` 空間層級融合**（上游）。目前 `src_datasets`/`n_src` 是
  名稱＋統編層級的 provenance，**同址不同名的機構仍算兩筆**（例如同一棟樓的
  「XX養護中心」與「XX長照機構」）→ 前端若做「這個地址有幾間機構」會偏高。
  上游座標已補到 99.7%，技術上可以跑了。
  - Outcome：同址多名稱機構不再在地址密度分析中被高估。
  - Next action：上游先產 trust_chain 對照與去重前後筆數，再決定是否接前端。

- **WF-8 · 性侵害防治中心補齊**。`welfareGovOffices` 的 T0102 只有 7 筆
  （22 縣市應各 1），上游 datagov 13718 官方下載連結 404。
  - Outcome：補齊性侵害防治中心的縣市覆蓋，避免圖層看似全國但實際缺漏。
  - Next action：先找到替代官方來源或確認停供，再決定補檔或明確標缺資料。

- **WF-9 · Supabase migration ×9**（`reference.*`）。上游未規劃、前端不依賴。
  之後要做跨主題 SQL 分析（社福 × 高齡人口 × 醫療可近性）才需要。
  - Trigger：出現跨主題 SQL/BI 需求；目前前端不依賴，維持 deferred。

- **WF-10 · 居家托育（保母）全國源**。目前無。`welfareChildcare` 只有機構式托嬰中心。
  - Trigger：取得可授權、可全國覆蓋的居家托育官方來源。

## Decision recorded（明確跳過，不是漏做）

- **WF-13 · 觸點 #19 `src/chat/tools/datasets.ts` 的 `DATASET_WHITELIST` 沒加**。
  這 9 層正好是該白名單的目標形狀（點狀 ＋ 有分類欄位的靜態 GeoJSON），
  加進去 BYOK 對話就能查詢。第一版沒加是因為**還沒決定要用哪個欄位當查詢維度**
  —— `welfare_class` 有 8 層是單一值（沒有區辨力），真正有料的是各層專屬欄位
  （`nh_type` / `attr_type` / `sub_code` / 使用率），每層不同，白名單要一層一設。
  要做的話建議先從三個有數值欄位的層開始（護理／老人／身障）。
  - Decision：目前刻意不加入白名單；若重啟，先決定每層查詢欄位再做最小三層 POC。

## Tech debt

- **WF-11 · `upstreamRegistry` 跨 repo 檢查在 worktree 下會 skip**。
  它按 sibling path 找 `../taipei-gis-analytics`，worktree 在 `.claude/worktrees/<name>/`
  深了兩層找不到 → 印 `⚠ skipping cross-repo check` 而不是紅。
  本批 9 個 dataset_id 已手動核對過。要修的話是讓它往上找 git common dir。
  - Outcome：worktree 與主樹都能執行跨 repo contract check，不再只印 skip 警告。
  - Next action：有跨 repo CI 需求時再修路徑搜尋，並保留現有手動核對作 regression。

- **WF-12 · `src/data/layerParamsSpec.ts` 含一個 NUL byte**，`grep` 視它為 binary
  （要 `grep -a` 才有輸出）。與本批無關，不在本 PR 順手修。
  - Decision：暫不處理；若重啟，先以 binary-safe tooling 清除 NUL 並補測試。
