# Handoff — 用 Threads 分享 UI/UX 優化前後對比

> 給新 session：使用者要寫 Threads 貼文，分享 Mini Taiwan Pulse 這兩天（2026-09-27～28）的 UI/UX 統一工作，重點是**優化前後對比**。你的工作是整理素材、拍前後截圖、寫貼文草稿；**發文由使用者自己做**，你不要代發。

## 1. 你要交付什麼

1. **故事線**：先給 2～3 種切角，讓使用者選（見 §3）。
2. **前後對比截圖**：同一個畫面、同一個相機位置、同一種底圖，改版前一張、改版後一張（見 §5、§6）。
3. **貼文草稿**：主文加上串文，每則附上要配哪幾張圖。語氣和長度先問使用者；沒有指定時寫兩種版本（輕鬆、技術）讓他挑。
4. 素材放在使用者指定的資料夾；沒有指定就先問。**截圖不要 commit 進 repo**，除非使用者要求。

開工前先向使用者確認四件事：目標讀者（設計師、工程師、一般使用者）、語氣、要不要提到用 AI 協作、要不要放 repo 或網站連結。

## 2. 事實來源（寫任何數字前先查這些）

| 內容 | 位置 |
|---|---|
| 起因與盤點發現 | `docs/features/ui-consistency-audit-20260927/handoff.md` §1、§2 |
| 五輪拍板與規格要點（每一項改了什麼） | 同檔 §4a |
| 設計稿（多版並排、暗／淡並排、用代號挑） | 同資料夾：`mockup.html`、`popup-density-variants.html`、`ui-unification-sheet.html`、`ui-controls-sheet.html`、`timeline-sheet.html`、`round2-sheet.html`、`timeline-compact-sheet.html` |
| 最後的規範 | `docs/design-system/spec.md`（§5 元件規格、§7 禁止事項、§10 遷移狀態）、`docs/design-system/reference.html` |
| 自動檢查（ratchet guard） | `src/styles/__tests__/designSystemGuard.test.ts`、`designSystemGuardRules.ts` |
| 地圖圖層盤點與拍板 | `docs/design-system/map-layers.md`（§2 現況數字、§7 拍板結果）、`docs/design-system/map-layer-picks.html`（真實底圖比較頁） |
| 地圖圖層後續計畫（尚未實作） | `docs/features/map-layer-restyle/PLAN.md`（若在 PR #387 尚未合併，用 `git show origin/docs/map-layer-restyle-plan:docs/features/map-layer-restyle/PLAN.md`） |
| 每個 PR 的改動 | `gh pr view <號碼>`，UI 統一是 #357–#366、#368、#371、#372、#379–#383 |

可用的事實數字（寫進貼文前仍要再核對來源）：
- UI 統一共 18 個 Phase（A–R），各一個 PR，全部用一般 merge commit 合併（#357–#383 之間，扣掉非 UI 的 #367、#369、#370、#373–#378）。
- 起點只是三個小抱怨：Agent 面板的時間軸線條、字體不一致、popup 每種長得不一樣。盤點後發現是**三個具體缺口**，不是「沒有設計系統」（handoff §2）。
- 盤點時 41 個 popup 檔中有 32 個沒有資料來源標示；改完後全部都有，沒有來源的顯示「來源資訊待補」。
- guard 規則 9 條：web-font、hex-literal-in-ui-css、native-range、triangle-chevron、english-control-label、uppercase-eyebrow、font-data-on-cjk、internal-id-display（只記錄）、raw-z-index；基準值只能往下降。
- 地圖圖層盤點：803 個圖層、544 個圖例、28 個圖例和地圖不一致；拍板 40 題。這部分**只完成規格，還沒套用到地圖**，貼文不能寫成已上線。

## 3. 故事切角（給使用者選）

1. **「三個小抱怨 → 一套設計系統」**：從使用者實際的三個不順手開始，盤點全站，最後收斂成規範＋自動檢查。適合一般讀者。
2. **「怎麼做設計決策」**：每個元件出 2～4 版設計稿，暗色／淡色底圖並排，用代號（例：B 版、T2、TC3）挑選，選定後寫進 design system，再用自動檢查防止退化。適合設計師、PM。
3. **「數字說話」**：803 個地圖圖層、點半徑從 1.2px 到 24.5px 都有、40 題逐一拍板。適合工程師、資料視覺化圈。可以當系列的下一篇，因為地圖圖層還在套用中。

## 4. 前後對比清單（建議的配對，選 6～10 組）

表中「改版前」欄只寫已確認的差異，標「以截圖為準」的要實際拍了再描述，不要憑表格猜。

「改版前」的程式版本是 `da39e40b`（#356 合併、UI 統一開始前的 master）；「改版後」是目前的 master。

| # | 畫面 | 改版前 | 改版後 | 規格出處 |
|---|---|---|---|---|
| 1 | 點地圖出現的資訊卡 | 三種長相（Agent 分析結果是跟著點的 popup＋大寫小標＋內部代號；文化設施、寺廟各不同） | 統一停靠右下、細線緊湊 B 版、底部資料來源 | §4a 第一輪、第三輪 1／3 |
| 2 | 點擊位置 | 沒有標示 | R2 呼吸脈衝選取圈（動畫，適合錄短影片或 GIF） | §4a 第三輪 2 |
| 3 | Layers 清單 | 群組用「└」、主題標題大小寫混雜 | L2 群組細線、LT1 主題標題（中文＋英文小字） | 第三輪 4、第五輪 1 |
| 4 | 圖層控制 | 英文標籤、原生滑桿（細節以截圖為準） | V2＋S1：中文標籤、2px 細軌道＋10px 圓點 | 第四輪 3 |
| 5 | 右上工具列 | 多排按鈕、Monitor BETA、計數列 | T2 單一底板、拍攝模式、座標改中文格式 | 第四輪 1 |
| 6 | 底圖選單 | 舊版選單（以截圖為準） | B3 圖示＋縮圖 | 第四輪 1c |
| 7 | 即時情報面板 | 等寬字中文、徽章不一致 | H2 標頭、兩種徽章公式、淡色版 | 第四輪 2、Phase L |
| 8 | 資料來源總覽 | 右下浮動 ⓘ＋置中大視窗 | 左側 rail 面板、列內展開 | 第四輪 4 |
| 9 | 時間軸 | 舊版時間軸（使用者覺得佔畫面、有壓迫感） | TC3：平常 270px 膠囊，滑過才展開刻度軸 | 第五輪 T |
| 10 | 說明／分享視窗 | 大寫標題、▶ 符號 | H2 標頭、中文／EN 分段、複製鈕不跳動 | 第五輪 3、4 |
| 11 | 手機版標頭 | 舊版（以截圖為準） | M1 | 第五輪 6 |
| 12 | 地圖圖層（規格，尚未套用） | 盤點分佈圖 | `map-layer-picks.html` 真實底圖比較 | map-layers §2、§7 |

設計稿本身就是「前後並排」的現成素材，可以直接截設計稿，不一定要跑兩個版本的網站。

## 5. 怎麼拍截圖

1. **兩個版本各開一個 worktree**（不要在主工作區切分支，主工作區常有其他 session 的未提交改動）：
   ```bash
   git worktree add .worktrees/threads-before da39e40b
   git worktree add .worktrees/threads-after origin/master
   ```
   兩個 worktree 都要 symlink `node_modules`、`.env`、`.env.local`（**只建連結，不讀內容**）。
2. **各自起 vite**，用不同 port（例：3741、3742），`npx vite --host 127.0.0.1 --port 3741 --strictPort`。Agent 配對相關畫面需要研究 gateway，只接受 origin `http://127.0.0.1:3734`；不需要 Agent 的畫面不用管。
3. **agent-browser** 開頁，一定要帶 WebGL 參數，否則地圖是黑的：
   ```bash
   agent-browser --session-name threads --args "--enable-unsafe-swiftshader,--use-gl=angle,--use-angle=swiftshader,--ignore-gpu-blocklist,--enable-webgl" set viewport 1440 900
   ```
   dev 模式下 `window.__map` 可以用：先等 `window.__map.loaded()`，再用 `jumpTo({center,zoom,pitch:0,bearing:0})` 讓前後兩張相機一致；**換底圖要用工具列「底圖」選單**（會更新 `mapStyleId`，`isDarkTheme` 與覆蓋層樣式才會一起切換）；不要直接呼叫 `window.__map.setStyle(...)`，否則底圖和 UI／覆蓋層主題不一致，前後對比截圖會失真。
4. 拍單一圖層前先按側欄「All Off」清空，再只開要拍的圖層。
5. 前後兩張用同一個 viewport、同一個相機、同一種底圖；拼圖或加標籤時，「前」「後」標清楚。
6. 拍完關掉 agent-browser session 和自己起的 vite（用 port 找 PID 再 kill；**絕不 `pkill -f vite`**）。

## 6. 注意事項

- **截圖裡不能有祕密或個人資料**：帳號選單的 email、Agent 配對碼、任何 API key、`.env` 內容。拍帳號相關畫面前先確認。
- **不要 curl vite 轉譯後的模組**（會印出 `VITE_*` 金鑰）；不要讀 `.env` 的值。
- **內部識別碼不上圖**：例如 `datasetId`、資料表名稱，貼文裡用白話描述。
- **不誇大**：地圖圖層規格還沒套用；R1–R6 是計畫。前後對比只放已上線（已 merge 到 master）的東西。
- **不假造數字**：§2 的數字都能從文件或 `gh pr view` 查到；新數字要附來源。
- 是否提到公司或工作單位、是否附 repo 或網站連結，一律先問使用者。
- Threads 的字數與圖片數上限請在開工時查證最新規定，不要憑記憶。
