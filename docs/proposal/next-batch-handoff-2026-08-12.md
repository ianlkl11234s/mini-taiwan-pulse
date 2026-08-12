# 下一批工作交接（2026-08-12 晚場定稿）— W1~W6

> **交接對象**：新 session（owner 指示：opus 主控拆解／決策／驗收，sonnet 執行）。
> **前情**：Layer Manifest 收尾棒 **PR #131 已 merge**（`a037a45`）——AR-22 終點（per-key 訂閱、
> `useLayerParamsRuntime`＋等值閘退役）／App.tsx 掛載 manifest 化（`layerHookRegistry` 74 entry）／
> 4b 改案（LEGEND 真派生＋`gisClickRegistry`）／觸點 #20 部署雙向斷言（6 缺口修＋S3 已上傳驗證）。
> 本批 6 條工作 owner 已於 2026-08-12 全數點頭「都要做」。
> **本文件自足**：所有 SSOT 路徑、驗收條件、拍板點都在文內，接手不需回問上一個 session。

---

## 0. 開工前必讀（環境與鐵則）

1. **平行 session 警告**：截至交接時，主工作樹被另一個 session 佔用在 `feat/vessel-watch`
   （未提交改動，開發船舶監視圖層，基於 #131 架構）。開工先 `git status`：
   - 若還被佔用 → **一切工作走 `git worktree`（base = origin/master）**，絕不動它的檔案、
     絕不代 commit、絕不 `reset --hard`（工作區鐵則見根目錄 `../CLAUDE.md`）。
   - 若已釋出 → `git switch master && git pull` 正常開工。
   - ⚠️ 主樹在 vessel-watch 分支時，SessionStart hook 讀到的 `.claude/memory/STATUS.md`
     是**舊版**（該分支分岔早於 #131 收尾 memory commits）。最新版用
     `git show origin/master:.claude/memory/STATUS.md` 讀。
2. **驗收閘（每個 track 都適用）**：`npx tsc -b`（禁 `--noEmit`）0 error；`npx vitest run`
   全綠（master 基準：**42 檔 560 tests**；曾出現一次 MG-3 已知 flake，重跑兩次綠即放行，
   但要把失敗輸出留檔）；黃金快照 `src/data/__tests__/__fixtures__/layer-golden.json`
   **禁止無腦重 dump**——只有「有意圖的變更」可重生且必須逐行 review diff。
3. **PostToolUse hook**：編輯 `layerManifest.ts`／`layerParamsSpec.ts` 會觸發守門 hook 秒級
   紅綠回饋——紅了是它在工作，不是環境壞掉。
4. **owner 拍板點**：push／merge／migration／S3 上傳／刪資料一律先問。本文各節已標好
   哪些「已預先拍板」哪些「屆時要問」。
5. **新圖層／改接線的地標檔**（#131 之後的新家，別照舊文件的路徑走）：

   | 用途 | 檔 |
   |---|---|
   | 圖層登記 SSOT（348 key） | `src/data/layerManifest.ts` |
   | 滑桿參數規格 | `src/data/layerParamsSpec.ts`（⚠️ 檔頭有切檔禁令） |
   | hook 掛載 registry（74 entry＋三桶 ledger） | `src/layers/layerHookRegistry.tsx` |
   | per-key 參數訂閱 | `layerParamsStore.useLayerParams(key)`（`src/state/layerParamsStore.ts:249`） |
   | Three.js RAF 參數鏡像 | `src/state/layerParamRefs.ts` |
   | 點擊表（first-hit-wins） | `src/map/gisClickRegistry.ts` |
   | 圖例 keys 派生 | `src/data/legendGroups.ts`（LEGEND_REGISTRY 只寫 `{id, render}`） |
   | 四份豁免 ledger（雙向凍結） | `src/components/sidebar/__tests__/layerConsistency.test.ts` |
   | 部署契約雙向斷言 | `src/map/__tests__/deployContract.test.ts` |
   | 新增圖層流程 | `/new-layer` command（已更新到 registry 時代） |

**建議執行順序**：W6-d（資料在流失，先查）＋ W5（自包含）平行開場 → W1（5 分鐘）→
W2 分包 → W3 → W4（最大，建議獨立場次、先拍板 R2）。

---

## W1. `staticAssets` 代拍追認落地（S，文書級）

- **是什麼**：#131 的 Track C 替 `LayerSource` 的 `kind:"custom"` 變體新增了
  `staticAssets?: string[]`（結構化宣告該層用到的靜態檔路徑，26 個 entry 已填），
  依專案慣例標了「**代拍待 owner 追認**」。owner 已口頭同意做這批工作，
  但**開工時仍要用一句話跟 owner 確認追認**（例：「staticAssets schema 追認嗎？」）。
- **要做**：確認後，把「代拍待 owner 追認」字樣改成「已追認（日期）」——三處：
  `src/data/layerManifest.ts` 的 staticAssets 型別註解、
  `docs/features/layer-manifest/backlog.md`（4b／觸點 #20 段）、
  `docs/features/layer-manifest/changelog.md` 收尾棒段。
- **驗收**：`grep -rn "代拍" src/ docs/features/layer-manifest/` 無 staticAssets 相關殘留；tsc／vitest 綠。
- **風險**：零。

## W2. Popup 補強：29 筆 CANDIDATE（9 工作包）＋ 6 筆 EDGE（S~M×9 包）

- **SSOT**：`docs/features/layer-manifest/no-popup-audit.md`（258 行，逐 key 有：
  成因分類／資料欄位有無／建議接線路徑／工作量 S/M/L）。§5 已把 29 筆收斂成 9 個工作包。
- **為何**：57 個 `popup: null` 圖層裡 29 個「資料都有、只差接線」——使用者點了想知道是什麼。
- **每包的標準接線步驟**（順序照做，ledger 測試會逼你同步，漏一步就紅）：
  1. `featureInfo/<domain>Panels.tsx` 寫（或複用）panel ＋ `featureInfo/registry.tsx`
     的 `PANEL_REGISTRY`＋`HEADER_LABELS` 各一行
  2. `src/map/gisClickRegistry.ts` 加條目（**first-hit-wins：小範圍點層排前、大面積面層排後**，
     參考檔內既有中文排序註解）
  3. `layerManifest.ts` 該 key 的 `popup: null` → 改宣告 layerType
  4. `layerConsistency.test.ts` 的 `NO_POPUP_LEDGER` 移除該 key（雙向凍結，不移會紅）
  5. 黃金快照 `gisLayers` section 會 diff → 跑 dump 合法重生，**diff 必須恰好只有新增的 row**，逐行 review
  6. 瀏覽器實點驗收（agent-browser 座標點擊法見 `~/.claude-migu` 全域 memory
     `agent-browser-mapbox-verify`；新增兩坑：CSS text-transform 使 innerText 與 textContent
     大小寫不一致→DOM 搜尋一律 `/i`；React 重繪換 DOM 節點→迴圈每步重查元素）
- **順位建議**：先做 4 個 S 級包（幾行就通）——水資源 8 層（`groundwaterWells` 成本最低：
  panel 已存在只差 gisClickRegistry 一行）、`osmExpressway`（複用 `osmRoadDrive` panel）、
  `wasteStopsStatic`、`stationsTHSR`。raster 值探針（urbanHeat/canopyHeight）是 M-L 放最後。
- **EDGE 6 筆逐項問 owner**（都在報告裡有兩難說明）：房地產 Grid×3（hover 無觸控替代，
  補 click 是 S）／`temperatureWave`（3D raycast 換重複讀數，M-L）／`waterFloodExtreme`
  （payload=圖例已標的分級）／`powerPoles`（欄位薄但族群不一致是真的）。
- **風險**：接錯 key→面板顯示錯資料。報告已標「需先確認欄位語意」者（如 `waterCanals`
  縮寫欄位）先對上游 catalog（`../taipei-gis-analytics/docs/data-catalog/`）查證再接。

## W3. 完整性測試的 7 個雙桶 key 盲區（M）

- **是什麼**：`src/layers/__tests__/layerHookRegistry.test.ts` 的三桶（registry／
  HOOKS_IN_APP／NO_HOOK）互斥＋聯集斷言，對**同時落在 registry 與 HOOKS_IN_APP 的
  7 個 key 不設防**：`rail`／`h3Population`／`popCount`／`indicators`／`socioeconomic`／
  `spatialEconomy`／`youbikeFullness`（全是「資料 hook 在 App、上圖 Host 在 registry」的分工）。
  紅燈實測：拿掉 `h3Population` 的 registry entry 測試照樣綠。盲區說明在該測試檔頭。
- **要做**：把聯集判準升級成「per-key 宣告需要哪幾種機制」的顯式表
  （key → 需要 {host, appHook} 的哪些組合），照現況機械盤點初始化，斷言逐 key 對表。
- **驗收**：紅燈演練——拿掉 `h3Population` 的 registry entry **必須紅**（現在不會）；
  拿掉任一單桶 key 照樣紅（不退化）；565+ 全綠。
- **風險**：表初始化抄錯=誤報；照現況程式碼機械盤點即可，不要憑記憶填。

## W4. snapshot-to-CDN 主線（AR-12/13，L，建議獨立場次）

- **是什麼／為何**：bus current、news、alerts 這類「所有訪客看到同一份」的 C 類即時資料，
  現在每個訪客各打一次 DB（讀取 O(N)）；改成 collector 每輪抓完**順手寫一份快照檔上 CDN**，
  所有人共用（O(1)）。這是「數百人在線」規模的關鍵一步。資料新鮮度只多「快照間隔＋
  CDN edge TTL」（對這類資料無感）；**點開圖層反而更快**（同款 static-to-cdn 前例：
  settle 16s→2s）。秒級要求的資料（地震速報等）**不走這條**，留原通道。
- **先拍板（跟 owner）**：儲存方案 **D-A=R2**（提案 Cloudflare R2；前例：AR-11 影像
  已在 R2 `data.itsmigu.com` 跑穩，21,587 張 backfill、DB 影像 egress 歸零）。
- **SSOT**：`docs/proposal/architecture-overhaul-plan.md`（AR-12/13 節）＋
  `.claude/memory/BACKLOG.md` AR 系列（L129 附近）＋審計報告
  `docs/research/architecture-audit-2026-07-02.md`。
  既有可抄的 pattern：`src/data/staticRpc.ts`（讀 CDN 快照、404/parse fail 自動 fallback
  回真 RPC——**這個 fallback 設計已在 prod 驗證**，新 loader 照抄形狀）；
  完整 SOP `PLAYBOOKS.md` PB-27（static-to-cdn 版，本案是它的「即時快照」延伸）。
- **跨 repo 順序（CLAUDE.md 鐵則：上游先動）**：
  1. `../data-collectors` 加 snapshot_writer（collector 抓完寫 R2；**best-effort 雙寫**，
     寫失敗不影響主流程——抄 AR-11 collector 的雙寫慣例）＋ 停寫警報（Telegram，
     collectors 既有通知慣例）
  2. gis-platform 不動（無 schema 變更）
  3. 前端 loader 改「快照優先、RPC fallback」＋ per-layer flag 可獨立回退
- **做法建議**：挑 1~2 個示範層先走通全鏈（建議 `busLive`（量大最有感）或
  news（結構簡單）），端到端驗收後再批量複製到其他 C 類層。
- **驗收**：切換層在 network 面板 **0 次該層 RPC**；資料新鮮度 ≤ 收集週期＋快照間隔
  （比對快照 timestamp 欄位）；fallback 演練（暫時改壞快照 URL → RPC 接手、圖層不空窗）；
  快照停寫警報演練會叫。
- **風險**：快照停寫=畫面停在舊資料（→警報必配）；R2 計費（低，讀免 egress 費）；
  分層漸進、每層有 flag 可獨立回退。

## W5. AI-1 警訊整合 Phase 1（M，估 4-5hr）

- **SSOT（本身就是合規交接文件，直接照做）**：`docs/proposal/alerts-integration-impl.md`
  ——自帶 12 顆 task、RPC signature（RETURNS TABLE 級）、元件 Props＋設計 jsx 行號、
  設計 bundle 重抓 URL、驗收 walkthrough。前置需求說明在同目錄
  `alerts-integration-handoff.md`。
- **⚠️ 該文件 2026-06-17 寫成，接線段已被 #129/#130/#131 時代超車，照舊做會被測試擋。
  對照修正**：
  - 「App.tsx 直呼 hook」→ 改在 `src/layers/layerHookRegistry.tsx` 加 registry entry（走 `/new-layer` 流程）
  - 「`useMapInteraction` 的 GIS_LAYERS」→ `src/map/gisClickRegistry.ts`
  - 新圖層必有 `layerManifest.ts` entry＋`layerParamsSpec.ts` 規格（PostToolUse hook 會盯）
  - legend／popup 宣告後，`layerConsistency` 四 ledger 與契約測試會逼你把接線補齊
  - 文件裡的 RPC／migration／元件 Props／設計 URL 部分**照舊有效**
- **拍板點**：migration 211（gis-platform）上線前問 owner（migration 鐵則）。
- **風險**：低（純新增）。NCDR 告警原文直接上牆，留意空欄位／怪格式的防禦性渲染。

## W6. 陳舊項關單＋快贏（S 合集，可全部平行）

- **6a. BM-1~4 關單（純文書）**：`.claude/memory/BACKLOG.md`「Base Map 擴展（BM）」節，
  BM-1~4 標 done＋一句證據——`osmExpressway`／`hillshade`／`slopeVector`／`aspectVector`
  全在 manifest 348 層內且上線（#131 期間逐一驗過；hillshade 部署缺口也已修）。
  BM-5（deck.gl COG 路線）保留為未來觸發項不動。commit prefix `memory:`。
- **6b. MO-17 push（需 owner 拍板 push/merge）**：台股 30 日 sparkline **程式已完成並
  commit**——pulse `feat/market-index-30d`（`d1ee986`＋`fcd5f32`）、gis-platform
  `d852752`（同名分支）。順序：gis-platform 先（上游先動）→ pulse 後。
  ⚠️ 分支落後 master 兩個月，先 rebase/merge master 跑全套測試再提 PR。
  驗收：Monitor 面板加權指數卡出現 30 日 sparkline。風險：低，壞了 revert 單 PR。
- **6c. AU-6 雙 lockfile 定政策（需 owner 拍板方向）**：`package-lock.json`
  （Dockerfile `npm ci` 在用）與 `pnpm-lock.yaml` 併存會漂移。二選一：
  (A) 跟 Dockerfile 走——留 npm、刪 pnpm-lock（日常改用 npm）；
  (B) 全面 pnpm——Dockerfile 改 `corepack enable && pnpm install --frozen-lockfile`，刪 package-lock。
  **先讀 Dockerfile 與部署腳本再提案**；改完必須本機 `docker build` 成功才算數。
  風險：選錯邊=「本機能跑、部署掛」；驗收就是 build。
- **6d. DS-06 ships 筆數下滑調查（唯讀，先做）**：ships 日筆數 8 天 17,500→7,224（−39%）
  單調下滑，疑 AIS collector 退化。查三處：(1) `../data-collectors` 的 AIS/ship collector
  近期 log（Zeabur，`zeabur-deployment-logs` skill）；(2) DB 端每日筆數趨勢 SQL
  （**必加 LIMIT**，用 `SUPABASE_DB_URL` psql）；(3) 上游航港局 AIS 來源是否改版／限流。
  產出：根因報告＋修法提案（先不動手修）。風險：零（唯讀）；**不查的風險是資料持續流失**。

---

## 附：本批不含（別順手撈）

- `vessel-watch`（平行 session 的活，別碰）
- AR-11e（清 DB 3.2GB bytea）——不可逆，owner 說要做時單獨執行
- BC-4a OAuth 網域（owner 本人 dashboard 操作，Claude 只能陪跑）
- G013 KHH SCP（owner 手動上 VM）
- snapshot-to-CDN 以外的 AR 系列（AR-14~16 供檔端等）——W4 做完的自然下一棒
