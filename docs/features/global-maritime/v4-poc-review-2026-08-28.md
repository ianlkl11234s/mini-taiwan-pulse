# GFW East Asia v4 24hr Shadow POC — 第三方審核

**日期**：2026-08-28
**審核對象**：`codex/gfw-v4-browser-bench`（mini-taiwan-pulse）、`codex/gfw-east-asia-v4-poc`（data-collectors）、`codex/gfw-east-asia-v4-contract`（taipei-gis-analytics）三個 worktree 的 24 小時 local shadow POC
**方法**：不採信 POC 自述，逐項獨立重跑／重算；決策題另諮詢 fable 5
**本文件不改變任何契約**。第 4 節為待拍板事項，需 user 簽字後才是契約修訂。

> 本文引用的 `src/**` 檔名與行號皆以 `codex/gfw-v4-browser-bench` 分支（v4 worktree）為準，
> 非 master。`.claude/memory/PRINCIPLES.md` 行號以主 worktree 為準。

---

## 1. 獨立驗證通過（POC 宣稱屬實）

| 宣稱 | 我的驗證方式 | 結果 |
|---|---|---|
| tsc / 測試 / build | 實際重跑，測試跑兩次 | ✅ `tsc -b` exit 0；77 files / 786 passed / 1 skipped；build exit 0 |
| shadow assets 不進 dist | build 後 `find dist` | ✅ 乾淨（`vite.config.ts` 的 `stripBuildAssets` 在 closeBundle 移除） |
| Grid「count 必等於 member 名單」鐵則 | 抽驗 30/293 shards、9,154 cells、84,669 members | ✅ 0 mismatch、0 重複 `vessel_id`、14 欄位齊全、shard header 一致 |
| Fishing Effort 2,887 polygons / 138,297.72 hours | 直接讀 gz 重算 | ✅ 完全吻合、0 負值、`metric_semantics` 與 dataset version 齊全 |
| 軌跡時間契約 | 檢查全部 106,694 segments | ✅ 0 非嚴格遞增、0 超出選定 UTC 日邊界 |
| HIGH 路線決策 | 檢查軌跡座標量化粒度 | ✅ **正確，且理由比 POC 自述更強**（見下） |

**HIGH 路線的補充論證**：軌跡座標實測為 **0.01° 網格**（抽驗 45,228 點，100% 落在 0.01° 格點）。
LOW 只有 0.1°，物理上無法支撐 Tracks 圖層。所以 HIGH 不只是「因為 canonical cell 對不上」，
而是 Tracks 的必要條件；一次 HIGH fetch 同時餵 Grid(0.1°) 與 Tracks(0.01°) 反而是最省的做法。
LOW 的 90s vs HIGH 的 409s 成本差不構成重新選擇的理由。

**Over-budget 處理是誠實的**：`useGfwV4ShadowTracksLayer.ts:262-274` 對超預算設
`status: "over-budget"` 並顯示「已標記 FAIL，未靜默通過」通知；`GfwV4TrackScene.ts:110` 另有
console.warn；`frame.ts:53` 註解明示超預算 group 的 member identity 仍完整保留。
**沒有靜默丟棄，沒有隱藏 client cap**，符合契約精神。

---

## 2. 主要發現

### 2.1 ⚠️ benchmark 只覆蓋 18.7% 的負載（頭條）

bench 預設 buckets = `cargo` / `tanker` / `passenger`，**而 tanker day pack 是 0 points**
（`src/gfw-v4-bench/App.tsx:21` `DEFAULT_BUCKETS`）。

決定性證據：bench 記錄的 transfer `1,677,092 B` = cargo `1,280,640` + tanker `250` +
passenger `396,202`，精確吻合。

因此「desktop RAF p95 17.6ms、只差 0.9ms」與「mobile 33ms 已通過」**兩個結論都只在
149,827 / 799,771 points 下成立**。最壞情況從未量過。

### 2.2 全負載實測（本次補量）

| 指標 | 預設 3 種 | 全 5 種 JSON | 全 5 種 binary |
|---|---|---|---|
| transfer | 1.68 MB | **10.9 MB** (6.5×) | 7.9 MB (4.7×) |
| decode（主執行緒） | 131 ms | **782 ms** | 864 ms |
| heap afterLoad | 62.7 MB | **282.8 MB** | 266.4 MB |
| heap delta (scrub−start) | +113.6 MB | +343.0 MB | +288.8 MB \* |
| visible head groups | 6,804 | **37,821** | 37,821 |
| `overBudgetHeads` | 0 | **1,035** | 1,041 |

\* runC 的 start heap 已是 187 MB（runB 殘留未回收），delta 基準受汙染，只能當量級參考，
**不可據此判定 binary heap 優於 JSON**。三輪為同頁連續跑、未強制 GC。

**兩個 caveat，請勿誤用**：

- **RAF p95 與 long tasks 這次不可用**。量測環境只能用 headless SwiftShader 軟體光柵化，
  同組態重跑 RAF p95 從 190.8ms 跳到 699.1ms，run-to-run 雜訊本身就數倍；long tasks
  690~964 已達 scrub 總 frame 數的 64~89%，指標飽和。
- decode 是併發載入的 wall-clock span，量級可信、精確值不宜互比。但 **782ms 主執行緒
  blocking 這個量級是真的**（純 CPU JSON.parse，不受 GPU 後端影響）。

**結論**：全開五船種必然進 `over-budget` FAIL 狀態（`GFW_V4_TRACK_BUDGET.maxHeads = 20_000`，
`useGfwV4ShadowTracksLayer.ts:20`）。這不是作弊，但是產品上未解決的狀態。

### 2.3 ⚠️ bucket taxonomy 與上游值域不符

當日（2026-08-21）全量 `vessel_type` 分佈（本人實測）：

| vessel_type | segments | points |
|---|---:|---:|
| OTHER | 30,322 | 324,265 |
| FISHING | 28,726 | 166,789 |
| GEAR | 22,462 | 97,215 |
| NA | 11,731 | 51,296 |
| CARGO | 7,714 | 117,946 |
| PASSENGER | 3,881 | 30,379 |
| (null) | 1,478 | 6,993 |
| SEISMIC_VESSEL | 248 | 3,139 |
| CARRIER | 116 | 1,502 |
| BUNKER | 16 | 247 |
| **TANKER** | **0** | **0** |

衍生五個問題：

1. **TANKER 是死 bucket**。GFW `public-global-vessel-identity:v4.0` 在此 bbox 這天完全不發
   `TANKER` 值，但 `layerParamsSpec.ts:1245` 的 Tanker toggle `default: true` —— sidebar 有一個
   永遠打開、永遠空的開關。契約的「預設 Cargo/Tanker/Passenger」建立在錯誤的上游值域假設上。
2. **油輪確實散在別處**（已 spot-check 驗證，非推測）：`GAS BEGONIA`(SGP, LPG) 在 OTHER、
   `SM JEJU LNG2`(PAN, LNG) 在 BUNKER、多艘在 NA。
3. **GEAR 97,215 點是漁具浮標／FAD，不是船**，卻進了「船舶軌跡」層；
   `gfwHourlyGrid` 的 `vessel_count` 同樣把浮標計為船。
4. **CARRIER 1,502 點被摺進 cargo bucket**。GFW 的 CARRIER 是漁獲運搬船，是轉載
   (transshipment) 監測的核心對象，藏在 cargo 裡不妥。
   驗算：149,827 = CARGO 117,946 + CARRIER 1,502 + PASSENGER 30,379。
5. **OTHER（已知其他）與 NA/null（未識別）混桶**，違反專案既有的
   「NULL 與 0 語意分離」原則（PRINCIPLES.md L984）。

**產品影響**：預設可見 149,827/799,771 = **18.7% points**；segments 口徑
(7,830+0+3,881)/106,694 = **11.0%**。六成的船躲在預設關閉的 `other` 裡。

**機會**：`geartype` 欄位比 `vessel_type` 細得多
（TRAWLERS 13,054 / SET_GILLNETS 1,773 / SET_LONGLINES 1,440 / FIXED_GEAR 1,406 /
OTHER_PURSE_SEINES 472 / POLE_AND_LINE 304 / DRIFTING_LONGLINES 295），
Fishing bucket 未來要細分有現成資料。

### 2.4 遺失風險大於 POC 自述

POC 只提到 mini-taiwan-pulse 一個 worktree。實際範圍：

- **三個 repo 各有未 commit 分支**：pulse 42 檔 / data-collectors 4 檔 /
  taipei-gis-analytics 3 檔（含 `docs/adr/0002-gfw-east-asia-v4-shadow-poc.md` 與
  `docs/handoff/global-maritime-v4.md` 草稿）
- **8 個 driver script 直接躺在 `/private/tmp`**，不在任何 repo 內
  （`run_gfw_v4_{grid,tracks,fishing}_*.py`、`finalize_gfw_v4_shadow_20260828.py`、
  `setup_gfw_v4_browser_aliases_20260828.py` 等）——這是「POC 怎麼跑出來的」唯一紀錄
- 106 MB POC 資料同樣在 `/private/tmp`

macOS 重開機 `/private/tmp` 全清。worktree 的 commit 物件會進主 repo 共用 `.git`（Desktop，
durable），所以 commit-first 是對的，但**三個 worktree 都要做**，散裝 script 要收進 collectors worktree。

### 2.5 `.gitignore` 缺口

以下四個路徑**都沒有被 ignore**（`git check-ignore` exit 1）：

- `public/gfw-v4-poc`（symlink → `/private/tmp/gfw-v4-shadow-poc-20260821-20260828c`）
- `public/gfw-v4-browser-assets`
- `public/gfw-v4-browser-manifest.json`
- `node_modules.vite-cache`（`.gitignore` 只排除精確名稱 `node_modules`）

專案對前代 POC 有先例（`.gitignore` 已含 `public/gfw_hourly_grid_poc/`、
`public/gfw_hourly_tracks_poc/`），這次沒比照。commit 前必補，否則 `git add -A` 會提交
一個指向 repo 外部的斷鏈 symlink。

### 2.6 bench 自身的 heap 量測 bug

`src/gfw-v4-bench/metrics.ts:25-28` 使用 `performance.memory.usedJSHeapSize`（Chrome 非標準 API）。
未帶 `--enable-precise-memory-info` 時回傳量化後的假值（實測固定 `26,000,000 B`）。
修 benchmark 時必須一併處理，否則 heap 那一欄一直是無效數字。

---

## 3. fable 5 的四題判斷

**Q1 — Gate 分兩層**
- Tier 1（預設組合）：desktop p95 < 16.7ms、mobile < 33ms，首屏不妥協
- Tier 2（任何使用者可勾選組合，含全開）：desktop < 33ms、mobile < 50ms，外加 heap 上限與 loading UI
- Tier 2 過不了才觸發 Phase 2 —— 這正是契約寫「條件式 Phase 2」的本意
- 提醒：5.3× points ≠ 5.3× frame time，line rendering 常是次線性，仍須實測

**Q2 — bucket 重設**
移除 TANKER（死 toggle 比沒有 toggle 更糟）、GEAR 移出本圖層（另立 backlog，它是有價值的
漁業行為 proxy，不是丟掉）、OTHER 與 NA/null 分成兩個 bucket、CARRIER 獨立處理、
預設開啟 Fishing + Cargo + Passenger（理由：`gfwHourlyGrid` 已承擔「完整誠實的存在圖像」，
Tracks 是 drill-down 層，預設只開語意明確的類別——前提是未識別的 toggle 活著且標示誠實）。

**Q3 — 凍結「方向」不凍結「規格」**
方向現在定案：**typed binary + uint16 網格索引 + Worker decode + typed array 直通 GPU buffer**。
規格凍結的判準：taxonomy 拍板後，用全負載跑正式 bench，heap 以 delta-from-baseline 量測，
binary 在 heap 與 long tasks 不輸 JSON 才簽字。

> **關鍵判讀**：18.7% 負載時的 heap 倒掛（binary 141.6 > JSON 114.5 MiB，transfer 卻更小）
> 是**實作臭味，不是格式屬性**——多半是 decode 產出 per-point JS object，或 raw buffer 與
> 解碼結果雙重持有。原計畫的「Worker 搬完後 heap 仍高於 JSON 就選 JSON」判準，
> 會把實作 bug 誤判成格式劣勢。

**Q4 — 順序要改**
> 原順序的致命缺陷是把「修 benchmark」排在「知道問題多大」前面。

---

## 4. 待 user 拍板（契約修訂，非 POC 可自決）

1. **Gate 分層定義** —— 採 Tier 1 / Tier 2 兩層，或維持單一 gate？
2. **TANKER bucket 移除** —— 上游不發此值，目前是使用者可見的死開關
3. **GEAR 去留** —— 97,215 點的漁具浮標移出本層、另立 backlog？
   （同時影響 `gfwHourlyGrid` 的 `vessel_count` 語意）
4. **預設開啟集合** —— 現況預設只可見 18.7% points / 11.0% segments
5. **CARRIER 歸屬** —— 併入 cargo、或獨立為轉載監測 bucket？

taxonomy 修訂涉及跨 repo 契約，依專案規則走
`taipei-gis-analytics → gis-platform(如需) → data-collectors → mini-taiwan-pulse` 順序，
且 ADR 應從 clean worktree 補。

---

## 5. 建議行動順序

fable 5 與獨立 review 各自給出同一結論：

1. **Commit 保存**（三個 worktree 各自收；先補 §2.5 的 `.gitignore` 四條；
   `/private/tmp` 的 8 個 driver script 收進 collectors worktree）
2. **全開 worst case 量測**（真實 GPU 環境，非 headless）—— 成本極低卻決定下游一切
3. **Taxonomy 修正 + 契約修訂拍板**（與步驟 2 平行，不互等；
   bucket 怎麼切不影響全開的總資料量，扣掉 GEAR 約 −12%）
4. **benchmark 方法論修正**（空場景 baseline、frame assembly / GPU buffer update /
   render work 分離、dropped frames、§2.6 的 heap flag）+ **Worker decode** +
   **uint16 binary** 合成一個 package，對「新預設集」與「worst case」各量一次
5. **凍結 day-pack 格式**
6. **Phase 2 spatial shards 判決**
7. **production shadow pipeline**（collector → immutable stage → upload → readback →
   pull → deploy → HTTP → browser）

> 一句話：在「commit POC」之後、所有 benchmark 工程之前，插入「全開五船種量一次 worst case」；
> 因為原計畫的每一個後續決策（格式、Worker、gate、Phase 2）都押在一個從未量過的數字上。

**取得步驟 2 數字最便宜的方式**：dev server 執行中時，在真實瀏覽器開
`http://127.0.0.1:3721/gfw-v4-bench.html`，五個 bucket 全勾跑一次。

---

## 6. 未複驗清單（本次審核未涵蓋）

- 24 個 hourly PMTiles 的 tile 內容與 MVT 語意（POC 自驗過，且 Grid detail 抽驗全過，風險低）
- 328 assets 的逐檔 readback（同上）
- LOW 與 HIGH 的 565,964 筆 canonical cell 差異之逐筆歸因（路線決策已由座標粒度獨立確認，不影響結論）
- production S3 / Supabase / Cloudflare 現況（POC 階段本就 not run，無須驗）

---

## 7. 證據可重現性

本文引用的 POC 產物路徑（`/private/tmp/gfw-v4-shadow-poc-20260821-20260828c`、
三個 worktree、8 個 driver script）**在 macOS 重開機後會消失**。
本文的統計數字皆由該批 artifact 直接重算取得；若產物已清空，需重跑 collector POC 才能複現。

主要驗證入口：

- vessel_type 分佈：讀 `tracks/2026-08-21/{cargo,tanker,passenger,fishing,other}.json.gz`，
  逐 segment 取 `segment["vessel"]["vessel_type"]`
- Grid count 契約：讀 `grid/details/<hour>/part-*.json.gz`，比對
  `entries[cell_id]["vessel_count"]` 與 `len(entries[cell_id]["members"])`
- 座標粒度：取 `segment["points"][i][0:2]`，檢查是否落在 0.01° 格點
  （注意 float32 精度，容差需 ≥ 2e-5）
