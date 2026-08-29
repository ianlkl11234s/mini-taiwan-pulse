# Reflections（append-only）

每次 `/wrap-up` 追加一篇。格式：What worked / What didn't / Next-time rules / Memory 產出。

---

## 2026-06-19 Energy v2 Phase A + B autonomous run

### What worked ✅

- **autonomous「以完成長任務的方式處理」進度推得動**：用戶說「繼續」一次，
  把 A.1 → A.2 → B.1+B.2 → B.3+B.4 → docs 5 commit 一氣呵成，每 phase tsc -b
  + vitest run + status doc append + atomic commit
- **B.1 (純資料層) 合併 B.2 (UI 接線) 一個 commit**：原本想拆 B.1~B.4 四 commit，
  發現 layerConsistency ratchet 會擋「LegendPanel 漏接 / useTransportParams 漏接」，
  純 B.1 commit 會留紅燈。合進來變 B.1+B.2 一次過，test 全綠才送
- **Pure helpers + node-only vitest = 高 ROI 測試**：powerCardData / lightningLoader /
  nuclearLoader 把 view-model 從 JSX 抽出來放純 .ts，13 + 17 個 case 跑 5ms 就解 90%
  contract（區域 pct 正規化 / fuel mix / dose classify / FC builder）
- **timeline isolation contract test**：`buildPowerCardModel` 寫成「不收 time 參數」+
  test「永遠取 array 最後一筆」明文化契約 — 之後改 PowerCard 也不會誤接 currentTime
  把 scrub 洩漏進 monitor

### What didn't ❌

- **沒早 detect SessionStart hook 把分支切回 master**：A.1 commit 訊息明明就寫
  `[master ...]` 我沒當下 abort，繼續做 A.2 才發現。然後 B.1 又踩同樣坑（在 master
  改了一半才察覺）。應該每次 commit 前 `git branch --show-current` 確認
- **A.2 commit 從 feat 分支歷史脫鉤的時間花太多**：兩次 stash dance + 一次
  cherry-pick + docs conflict 手解 ≈ 15min。其實當下若先用 reflog 確認 A.2 還在
  repo，cherry-pick 一發就完事。慌張下重複試 stash 浪費時間
- **沒在 phase A 結束時跑 dev server 視覺驗收**：A 收尾我問用戶「(a) 繼續 B」「(b)
  瀏覽器驗收 A」「(c) 開 PR」，用戶選 (a)。但實際上 (b) 比較安全 — 萬一 PowerCard
  顯示 bug、A.2 KPI strip 配色超出版面，B 已經 4 個 commit 疊上去再回頭很煩

### Next-time rules 📌

1. **每次 commit 前先 `git branch --show-current`**，尤其是上次 commit 後過了幾分鐘、
   或剛和用戶來回 1-2 輪對話。SessionStart hook + 其他 auto-pilot 都可能改 HEAD
2. **覺察 hook 存在的 signal**：reflog 出現 `cherry-pick: memory: ...` 配
   `checkout: moving from <feat> to master` — 一旦看到立刻 `git checkout <feat>`
3. **分支管理問題優先用 reflog 查通盤**：reflect 全範圍 → 規劃單一條 git
   command 修，比連續試 stash + checkout + 看 status 安全
4. **長任務不要連續 ≥ 4 phase 不休息**：A.1 → A.2 → B.1+2 → B.3+4 跑完中間沒
   停下來驗收。下次至少在「phase 大跳轉」（A→B、B→C）前停下來問
   「視覺驗收還是繼續」，預設答 (b) 驗收 — 我這次預設答 (a)
5. **layerConsistency-class ratchet 預期會擋哪幾條，事前盤一次**：B 一進來時
   就應該說「B.1 純資料層 commit 會 fail consistency，B.1+B.2 必須合」，
   而不是被 ratchet 擋了才合

### Memory 產出

- BACKLOG：close E-A + E-B，add E-G（cluster 升級）
- DATA_SCOPE：lightning + nuclear + RPC 214/215 改「已接 v2 Phase B」
- INCIDENTS：SessionStart auto-cherry-pick 把 feat 分支拆掉事件
- PRINCIPLES：commit 前 branch 確認 + layerConsistency 合併 commit 慣例
- STATUS：rewrite，head 移到 feat/energy-v2-A 5 commits

---

## 2026-06-18 Monitor 效能優化 5 step

### What worked ✅

- **先 Explore 全面盤點 → Plan agent 設計方案 → 才動手**：產出 9 條根因清單，按
  「最便宜見效」排序成 5 step，每步可獨立驗收 / 獨立 commit / 獨立回滾
- **保留 props 對外契約**：把 `nowTs` 退為 fallback 而非刪除，元件內部自訂閱
  wallClock — UI 看不出差別，內部 perf 卻徹底改變
- **TTL cache 簡單高效**：兩個 panel 同時 polling 自然共享 fetch，不需重構成
  shared hook，14 行改動解決雙倍 polling
- **IntersectionObserver gate + lock once**：iframe 進視窗就 mount、不再卸載，
  避免反覆 mount/unmount jank — 非 wall mode 場景成本歸零

### What didn't ❌

- **`useSyncExternalStore` 用錯**：getSnapshot 直接回 Date.now() → 無限 re-render。
  本地沒測就 push 直接炸線。原因：tsc / test 都過、太快進入「全綠 push」慣性
- **用戶說「先改本地」我已 push 出去**：hotfix 改完直接 commit + push，沒等
  用戶 reload 確認就推到 remote。應該每個會動運行時的關鍵 commit 都先停一下

### Next-time rules 📌

1. **新 hook 涉及 React internal（useSyncExternalStore / useTransition / useDeferredValue
   等）→ 寫完先去看 React 文件範例對照**，不單信「能編譯就是對的」
2. **runtime-critical 改動 push 前先在 browser 跑一遍**：tsc/test 過不等於 runtime 過
   （useSyncExternalStore 的 stale snapshot detection 是 dev-only runtime 檢查）
3. **Hotfix 寫完先停**：commit OK，但 push 前問用戶「要先本地測還是直接推」。
   尤其用戶說過「先改本地」之後別自動 push
4. **效能 PR 標 manual test checklist**：tsc/test 過是 baseline，列 5 條 browser 手測
   項目強迫自己（或用戶）逐項驗證 — 這次 PR #21 body 已有，但是「事後補」

### Memory 產出

- INCIDENTS：useWallClock 無限 re-render 完整事件
- PRINCIPLES：useSyncExternalStore getSnapshot 必穩定 + wallClock hook 慣例
- BACKLOG：G011 wall-mode 暫停 engine / G012 alertSeries24h 增量
- PLAYBOOKS：PB-XX 效能優化 5 step（cache → wallClock → ref-DOM → IO gate → memo）

---

## 2026-04-22 水資源 Phase 1（水庫互動 + 3D 水位計）

### What worked ✅

- **分階段規劃 Phase 1a / 1b / 1c 並每段跑 tsc -b**：避免一次改 20 檔才發現編譯壞掉
- **動手前先調查上游資料結構**：Phase 1b 前先查 `river_lines` 發現 2,445 km outlier
  MultiLineString，避免部署後才發現「全台都亮」bug
- **status doc 當工作 checkpoint**：`docs/water-resources-status.md` 讓中斷 session
  回來能 5 分鐘接上
- **遇到卡點停下來問使用者選路**：Phase 1a 遇到 geojson 沒 compare_id 時列 A/B
  方案讓使用者選
- **ST_Intersection 順序錯時立即優化**：Simplify 從 intersect 前移到 intersect 後，
  實測 10-20x 提速。沒放著「能動就好」

### What didn't ❌

- **Mapbox custom layer `map.once('load', attach)` 陷阱**：畫面沒東西 debug 2 輪才找到
- **視覺層代碼沒預先加 diagnostic log**：tsc 通過就宣布完成，runtime 不動才補 log
- **一次改 8+ 檔才跑 tsc 和瀏覽器實測**：修完 tsc 以為沒事，結果 runtime 不動

### Next-time rules 🎯

1. Mapbox custom layer 掛載一律 polling，不要 `map.once('load')`
2. 寫視覺層代碼預設加 checkpoint log
3. 每 3-4 檔做一次 smoke test

### Memory 產出

- INCIDENTS：+2 條（river_lines outlier / map.once 陷阱）
- PRINCIPLES：+視覺層 debug 區
- Pitfall：`2026-04-22-mapbox-load-once-fired.md`

---

## 2026-04-23 水資源 Phase 2 + BL-5 + 記憶框架遷移

### What worked ✅

- **診斷蓄水率差距時跑 SQL 實測 + 對照表**：不是光猜 ID mapping，而是直接撈
  `effective_capacity_wan / current_capacity_wan` 對照 WRA 官網數字，一眼看出
  分母用錯
- **效能問題先看 console log，不是瞎調**：render loop 60 FPS spam 直接指向
  `triggerRepaint` in render()，不是先調 setStatuses 或其他
- **用戶反映 zoom 看不見時畫幾何復盤**：算出柱頂 15km 超出 viewport，針對性調
  3 個常數，而非亂試
- **分階段實作 BL-5**：先做簡單版雙柱（dae1c78），用戶回饋要雙排日柱再改進
  （06116e7），遇到 zoom 問題再調參數（6600433）
- **Fast path 優化 setStatuses**：避免 timeline 回放時每 500ms rebuild 全部
  InstancedMesh，解決潛在的閃爍
- **探索性問題只給 3 個選項 + tradeoff**：雨量 H3 vs heatmap vs 現狀、河川
  segment 著色的「切斷」擔憂，讓用戶決定而非自作主張

### What didn't ❌

- **BL-5 初版柱體位置沒考慮 zoom**：`FLOAT_Z=1.25` 遠景看沒事，近景直接出框。
  下次做浮空 3D 元素要先在 z8 / z10 / z13 三個 zoom 驗
- **heatmap 沒先考慮「密集站點會疊加 weight」**：urban 區有 50 個 0.1mm 站點
  疊起來就像豪雨，weight 表需要壓低低值
- **Phase 2.3 timeline 回放沒真正驗證「滑動順暢」**：tsc 通過就認為完成，
  用戶自己測才會發現站點數在 today/yesterday 跳變
- **記憶框架一直沒遷移過來**：plan-art 的 memory 系統早就存在，但 mini-taiwan-pulse
  仍用 v1（lessons + retrospectives + pitfalls 散檔）。拖到現在才同步

### Next-time rules 🎯

1. 新增浮空 3D 元素 → 至少跑 z8 / z10 / z13 三個 zoom 驗位置
2. Heatmap / density-based 視覺前先想「會不會被密集 feature 誤導」
3. Timeline 類功能 tsc 通過後必須手動滑 timeline 驗證 3 個時間點（早/中/晚）
4. 新專案開工前先檢查 `.claude/` 是否跟標竿專案同步

### Memory 產出

- INCIDENTS：+4 條（render loop / today-28 閃現 / zoom 不見 / 蓄水率分母 / alert key 中英文）
- STATUS：rewrite（Phase 2.3 + BL-5 + memory 系統上線）
- BACKLOG：close BL-5，open BL-1~4, W001-006, G003
- PRINCIPLES：+3D 效能（triggerRepaint 靜態禁用、柱體幾何限制）
- GLOSSARY：+水資源 + WRA datasets + Three.js + 專案術語
- PLAYBOOKS：PB-01 新增 Layer、PB-02 RPC 判斷、PB-03 merge、PB-04 wrap-up、
  PB-05 3D scene 加元件、PB-06 deploy、PB-07 資料盤點
- DATA_SCOPE：水資源資料盤點
- 遷移：複製 FRAMEWORK.md + wrap-up SKILL.md

---

## 2026-04-23（晚段）SessionStart hook + 首次真正 /wrap-up

### What worked ✅

- **update-config skill 處理 settings.json 很順**：讀 → merge → 驗證 → 寫，
  流程 SOP 化，少於 3 次 tool call 完成
- **Pipe-test 抓到 jq 不在 PATH**：沒盲目寫完才驗證，`echo '{}' | script.sh`
  pipe-test 立刻暴露 command not found
- **修改用最小替換**：jq → python3 只改一段 heredoc，沒整個重寫
- **設計用 additionalContext 而非純 stdout**：符合 Claude Code 官方 hook spec，
  未來擴充不用重寫
- **首次 /wrap-up 依 5 階段跑**：Gather 平行讀 9 檔 + git log + status 一輪到位

### What didn't ❌

- **沒先 `which jq` 就用 jq**：寫了整個 jq 版本才 pipe-test，開頭就該檢查
- **STATUS 上次 commits 數沒驗證**：寫 14 實際 18。應 `git log origin/master..HEAD | wc -l`
- **Stage 3 吐了整段 markdown rewrite**：用戶反映「內容太多」。已修 SKILL.md
  改成只出總表 + 一句話摘要（本次 session 之內 skill 自我演進）
- **首次 /wrap-up 尷尬**：memory 初建時已把大部分事件寫進去，/wrap-up 處理的
  是「初建之後」的少量增量（1 commit + 1 小坑）

### Next-time rules 🎯

1. Shell 寫外部工具前 `command -v <tool>` 檢查
2. STATUS commits 數用 `git log origin/master..HEAD | wc -l` 驗證
3. /wrap-up Stage 3 保持精簡（總表只，細節按需展開）— 已寫入 SKILL.md
4. 若本 session 剛完成 memory 大量更新（< 3h 內），/wrap-up 只處理增量

### Memory 產出

- SKILL.md：update（Stage 3 精簡規則）
- STATUS.md：rewrite（18 commits / SessionStart hook / 新待執行清單）
- INCIDENTS.md：+1（macOS 無 jq）
- PRINCIPLES.md：+1 條（shell 不依賴 jq）
- REFLECTIONS.md：+本條

---

## 2026-04-25 PostgREST 20K cap + delta 著色 pattern

### What worked ✅

- **用戶反映 bug 後先做 REST probe 驗證**：不只 psql 看 COUNT，還 `curl -D`
  讀 `content-range` header 才發現命中 cap。這三步診斷 SOP 已寫進 PB-08
- **groundwater 踩到 cap 後 river 再犯時立刻認出**：用戶一句「中南部都沒
  有」就意識到「可能又是 20K cap」，psql 驗證後 15 秒確認
- **水井資料變化量先跑 SQL 實測再下設計決策**：p50 hourly change 4mm →
  自信地告訴用戶「hourly 降頻對視覺無感」，避免空口「改就對了」
- **用 delta_since_day_start 解決兩個層的 timeline 靜止問題**：river +
  groundwater 同樣絕對值不可比，同一個 pattern 解兩處
- **setPaintProperty 熱更而非 layer 重建**：toggle 滑桿即拖即見，不用等
  Mapbox 重建 layer；updatePaint 函式抽出來清楚
- **釐清「重新開始」意圖而非盲目 revert**：用戶語意模糊時列 A/B/C/D 選項
  而非自作主張

### What didn't ❌

- **Stream timeout 打斷後銜接 Step 5 的過場太突兀**：用戶看到 API Error
  後我直接貼 Step 5 標題繼續做，沒先簡述「剛做到哪、現在要做什麼」
- **地下水井「切過去沒資料」第一反應是查 hook 邏輯而非 RPC 資料量**：
  花了 ~5 分鐘讀 useGroundwaterLayer.ts 才想到「回傳 rows 超過 cap」。
  下次 RPC 驅動的圖層出「部分資料」現象 → 先 curl content-range
- **河川水位「中南部沒有」第一反應是解釋「資料本來就稀疏」**：其實也是
  20K cap，被 station_id ORDER BY 排序切掉。應該先同樣跑 curl header
  驗證，別急著腦補解釋
- **useGroundwaterLayer radius 一開始綁 water_level_m 絕對值**：W002 上
  線時就犯的錯，這 session 才修。應該在上線前就意識到跨站不可比

### Next-time rules 🎯

1. **RPC 驅動圖層出現「部分資料」現象** → 先 `curl -D` 看 content-range，
   不要急著懷疑 hook / loader
2. **新 RPC 預估 rows > 15K** → 直接套 DISTINCT ON hourly 降頻，不等踩雷
3. **監測站視覺（radius / color）** → 一律 delta 不用絕對值，除非該值
   本身跨站可比（百分比、比率、檢驗結果等）
4. **Stream timeout / 對話中斷後** → 先一句話復盤再繼續動
5. **Mapbox 切換底圖相關的 useEffect guard** → `styleReady(map)` 而非裸
   `map.getStyle()`

### Memory 產出

- INCIDENTS：+2 條（Mapbox setStyle throw / PostgREST 20K cap）
- PRINCIPLES：+2 條（20K cap 必查 / delta 跨站可比）
- PLAYBOOKS：+PB-08（Supabase RPC 資料缺失診斷 SOP）
- GLOSSARY：+3 條（db-max-rows / styleReady / delta_since_day_start）
- DATA_SCOPE：update（060/060b 降頻 RPC + 20K cap 備註）
- BACKLOG：+6 筆已完成
- STATUS：rewrite
- REFLECTIONS：+本條

---

## 2026-04-26 iot_wra 整合（多 collector 交叉檢核 + 雙表 pre-aggregate + 細項 toggle）

### What worked ✅

- **agent 平行處理大型 SQL 比對**：用 Task agent 跑「7 個 station_type × 多維比對」避免主 context 爆量（站數/重疊度/欄位填充率/歷史長度都並行查）
- **先寫研究文件再 commit**：iot integration study + cookbook 兩篇文件變成「思考軌跡」，未來 6 個月後再來看不會迷失架構決策的 why
- **wrap-up SOP 5 階段照走**：feat / docs / memory 拆 11 個 atomic commit，git log 可追記憶演進
- **遇到設計衝突問用戶選**：iotWraRiver 細項分割「即時 vs 預測」當下價值不大但用戶說「都做」就做，不自行省略

### What didn't ❌

- **第一次重複度檢核相信 agent 用 station_id 編碼判斷**：agent 報「平行不重疊」（理由：UUID vs text 系統不同），實際座標一查 95% 完全重疊。**主動下指令「用座標而非編碼比對」就避免了這個誤判**
- **前端做完看不到 toggle**：忘了本專案兩個 sidebar，只改 LayerSidebar 沒改 IconRailSidebar。浪費一次 round-trip 讓用戶截圖才發現
- **boolean 塞 overlayParams 改 union type 8 個錯**：應該先看其他相同類型 state 怎麼處理（`metroPillar3d` 已示範 0/1 pattern），改型別前先 grep 既有 pattern

### Next-time rules 🎯

1. **重複度檢核用座標不用編號**（PRINCIPLES + PB-09 已定型）
2. **新增 layer 兩個 sidebar 都改**（PRINCIPLES + PB-01 第 5 步加強提醒）
3. **動既有 useMemo 型別前先看相同類型 state**（pattern matching > 改型別；PRINCIPLES 已定型）
4. **Agent 報結果若以「編號/key 互不認識」為理由 → 必補一道座標/實體驗證**

### Memory 產出

- INCIDENTS：+2 條（IconRailSidebar 漏改 / overlayParams 型別嚴格）
- PRINCIPLES：+3 條（collector 重複檢核 / 一前端兩 sidebar / boolean 0/1 中介）
- PLAYBOOKS：+PB-09（重複度 SOP）+ PB-10（pre-aggregate 雙表設計）
- GLOSSARY：+5 條（iot_wra 術語 + 互補 vs 重複定義）
- DATA_SCOPE：+iot_wra 整合區段（時序表 +3 + RPC +3）
- BACKLOG：+5 done + 1 new (BL-7 reservoir_daily_ops 診斷 P3)
- 新增 `docs/research/` 區 + 2 篇研究文件
- CLAUDE.md 加 docs/research/ 指向

---

## 2026-05-08 / 05-09 OSRM map-matching pipeline 跨 project 部署（凌晨夜戰）

橫跨 3 個 project / 5 個 repo / 多次架構轉彎，最後 1,510 trip 成功 map-match 上線。

### What worked ✅

- **第一輪規劃就先區別「同一個 container」vs「同 project 不同 service」**：用戶最初想「OSRM 跟 collector 塞同一個 container」，我立刻釐清這是不對的並給出「兩個獨立 service 同 project」的正確心智圖，避免後續 Dockerfile 寫一半才發現要拆
- **遇到「不同 IP 被擋」立刻看根因**：5/9 凌晨用戶搬 collector 到新 Lightsail 機器發生 ConnectTimeout，我從 log 看出新北通、高雄/台南/ship_ais 全擋 → 推論 AWS Lightsail IP 被政府 API 擋（Akamai 通），給用戶 3 個選項決策
- **OSRM 跨 project 不通 → Bearer gateway pattern 一氣呵成**：發現 internal hostname 跨 project 解析失敗後，直接拿出 nginx:alpine + envsubst 的 50MB proxy service 設計（PB-12），用戶選了「一次到位」就執行，沒掉進「修 osrm-taiwan image 塞 nginx」的 distroless 雷區
- **502 診斷用 zeabur-port-mismatch skill**：Zeabur PREBUILT_V2 預設 K8s service port 8080 是隱藏知識，叫出 skill 看到 `service network` 指令立刻看出 mismatch（osrm-routed 5000 vs Zeabur 預期 8080）
- **發現「retry 死循環」立刻設計根本修而非 hack**：collector 跑 9 輪都顯示 5/8: 80 unmatched，沒有去調高 LIMIT（hack），而是寫了 migration 075 + attempt marker（根本修）。後來 drain 用 MAX_TRIPS=500 一次掃完 + 改回 80
- **Drain 後立刻看 success rate 細節**：用戶問「無效資料比例 + 原因」時不止給數字，跑了 SQL JOIN trip_stats 看 fail trip 的 parked_pts 比例（37% vs success 19%）+ 平均點數（50 vs 71），讓用戶看到 fail 是「資料本質難 map-match」而非系統 bug
- **多輪 ScheduleWakeup / Monitor / until loop 平衡 polling**：build 30 分鐘期間設 `ScheduleWakeup 1200s`、redeploy 期間用 `until grep RUNNING; do sleep N; done` until-loop，避免 cache miss 又能及時回應失敗

### What didn't ❌

- **第一輪設環境變數設錯 project**（gomn 而非 ship-only）：用戶後來才提到「垃圾車 collector 在另一個 project」。我**沒先確認 production collector 跑在哪個 service**就設環境變數，浪費 30+ 分鐘
- **OSRM service 第一版 listen 5000 沒對齊 Zeabur K8s service port 8080**：osrm-taiwan 部署完跨 service 直連有 502，又 push 一次新 commit 改 osrm-routed `--port 8080`。**第一次部署前應該先用 `service network` 指令查預期 port**（這次教訓已寫進 PB-11）
- **第一個 commit 沒原子化**（用戶質疑後才意識到）：mini-taiwan-pulse `58ff433` 把「§14 部署實戰紀錄」+「§15 多城市擴展計畫」打包，gis-platform `44ce71a` 把 migration 074 + 075 打包。**docs/feature commit 應該各自獨立**讓 git log 更可讀
- **empty git commit 連續失敗 3 次才意識到 Zeabur 不會 trigger**：我先用 `git commit --allow-empty` 想觸發 redeploy，第一次沒 trigger 才用 README 加一行 trivial change。應該**首次就用 trivial change**（這次教訓已寫進 PRINCIPLES + PB-11）
- **Cobra `${}` parsing 問題踩了一次才查 skill**：第一次用 `-k "OSRM_URL=http://${OSRM_TAIWAN_HOST}:5000"` 設變數，幸好 zeabur-variables skill 文件有提醒，立刻改 hard-coded service ID。**load skill 應該作為 default**（部署 Zeabur 前先 invoke 相關 skill）
- **8 個 memory 檔的 commit 拆原子但 application 層還是粗糙**：例如 INCIDENTS 一次 append 7 條，雖然 commit 是 atomic 但 7 條坑寫在同一個 commit 也不算最細粒度。要不要每條坑一個 commit？這次取折衷（同 session 同主題打包），但這個取捨值得寫進 SOP

### Next-time rules 🎯

1. **動 production env var 前先確認該 service 真的跑你想跑的 collector**：用戶有多個 collector instance / project 時，先 `variable list` 看 INSTANCE_NAME / WASTE_POSITIONS_ENABLED 等識別欄位
2. **Zeabur PREBUILT_V2 部署前先 `service network` 確認預期 port**：Dockerfile EXPOSE 跟 CMD --port 都要對齊到那個 port，預設 8080
3. **要 trigger Zeabur redeploy 用 trivial file change**（README 加註解 + commit + push），不要 empty commit
4. **跨 Zeabur project 通訊一律走 public + Bearer gateway**（PB-12 pattern）
5. **政府 API 換機房前 SSH 進新機 curl 測目標 API**，不只測連通性
6. **批次 retry 邏輯一律寫 attempt marker**（不論成功失敗），SQL 過濾用 NOT EXISTS in attempts 表，避免 transient failure 變死循環
7. **commit 顆粒度：feature + docs 拆開，多 migration 拆開**：用戶質疑「全部一大包」是合理的，docs/feature 各自 commit、SQL migration 一個 file 一個 commit
8. **動 Zeabur 之前先 invoke 對應 skill**（zeabur-auth / zeabur-variables / zeabur-port-mismatch）：那邊文件有踩過的雷
9. **Drain / 大量 backfill 後立刻把參數改回 default**：MAX_TRIPS=500 是 drain 用，drain 完馬上改回 80 避免日常 burst 造成壓力

### Memory 產出

- INCIDENTS：+7 條（distroless image / K8s port 8080 / Cobra `${}` / 跨 project 不通 / retry 死循環 / empty commit 不 trigger / Lightsail 被擋）
- PRINCIPLES：+5 條（Zeabur 部署章節）
- PLAYBOOKS：+PB-11（Zeabur PREBUILT_V2 部署 SOP）+ PB-12（跨 project Bearer token gateway pattern）
- GLOSSARY：+OSRM / Map-matching 9 條 + Zeabur 部署 6 條
- DATA_SCOPE：+廢棄物區段（時序 3 表 + 靜態 4 表 + RPC 7 個 + 跨 repo 部署清單）
- BACKLOG：+5 條（BL-9~13 多城市擴展 / PBF 月更 / stop-to-stop / Lightsail 退租 / LegendPanel）+1 done
- 跨 repo：5 個 repo 各自 commit（mini-taiwan-pulse / gis-platform / data-collectors / osrm-taiwan / osrm-proxy）
- 新 repo：osrm-taiwan + osrm-proxy 兩個 private repo 上線

---

## 2026-05-10 晚 Schedule prototype 視覺打磨 7 方案 try-error

### What worked ✅

- **Source data quirks 一條一條打**：weekday_pattern 4 種格式 / 跨日 24:11 /
  departure 空字串 / 同 stop 重複 / 時間倒退 / 班次切換 / dwell=0 共 7 種，
  每踩到一個就量化 + 寫進 docs/research/waste-schedule-data-quirks.md。
  下次 22 城擴展前直接跑 sanity SQL 檢查。
- **picking + debug tooltip 救了視覺打磨**：用戶看到「閃現」我猜不到原因，
  加 click → 顯示 route_id / stop_seq / arrival / departure / gap，
  一點就知道 source 給了什麼。
- **撤回比堆改動好**：試過 Catmull-Rom + distance threshold 後用戶反饋不對都
  乾脆 revert，沒積技術債。
- **量化分析定 threshold**：用戶反映「林口沒車」最後是用 SQL 算各區 stops
  間 gap median + p90 才確定 600s 對林口太緊。先量化再決參數比直覺調快。

### What didn't ❌

- **撞 PostgREST 20K cap 撞第二次**：GLOSSARY 早寫了 timeline 字串編碼是「避
  PostgREST 20K cap」，但設計 schedule RPC 時沒先看 → 沿用 flat row 一筆一
  stop 結構就撞牆。**PRINCIPLES 也已有 ⚠ P0 警告**但只寫了「降頻」解法，事件型
  資料不能降頻就沒對策。
- **視覺打磨 7 方案順序混亂**：
  1. Trip-break gap > 10min fade → 對
  2. 對稱重新分配 dwell+move → 沒解短 gap 「停 + 跳」
  3. 短 dwell 持續移動 / 長 dwell 真停 → 對
  4. Catmull-Rom 平滑 → 用戶看到「往回退」拿掉
  5. Distance threshold fade → 用戶說「直線 859m 看得到」拿掉
  6. 量化發現 source data 速度超標 → 結論走 OSRM
  7. trip-break threshold 600 → 1500 解林口
  → **應該一開始先量化 stop gap 分布**（median 60s 板橋 vs 600s 林口 差 10x），
  就能知道 600s threshold 對地廣區失效，不用試 4-5 個方案才察覺。
- **Vite HMR 對 Three.js scene class buffer 不會重 init**：改 maxInstances 後
  使用者 hard reload 才生效。debug 時忘了考慮這點，用戶以為新 code 沒套。

### Next-time rules 🎯

1. **設計新 RPC 預估 rows > 5K 一律先看 PRINCIPLES「PostgREST 20K cap」章節**，
   按決策樹（能丟 → 降頻 / 不能丟 → grouped JSONB）選 pattern，不要等撞牆。
2. **Source data 動視覺前先跑量化 SQL**：median / p90 / max 的 gap / 距離 / 密度
   分布。不同地理特性（市區 vs 山坡）參數差距可能 10x。
3. **試錯 ≥ 3 個方案前停下來重新理解問題**：第 4-5 個方案還沒解就是路徑錯了，
   要量化 root cause，不要「下個 threshold 試試看」。
4. **Catmull-Rom 只用真實連續軌跡（GPS）**，邏輯順序的 stops/events 用直線
   不要套 spline。
5. **Three.js scene class buffer / 大改動後叫用戶 hard reload**，不要以為 HMR 救得了。

### Memory 產出

- INCIDENTS：+2（PostgREST 20K cap 撞第二次 / Catmull-Rom overshoot）
- PRINCIPLES：+grouped JSONB pattern + Catmull-Rom 限制 + 設計新 RPC 決策樹
- GLOSSARY：+schedule 動畫術語章節（TRIP_BREAK_S / DWELL_THRESHOLD_S / 60x）
- PLAYBOOKS：+PB-13 大集合 RPC grouped JSONB pattern
- DATA_SCOPE：+5 城 schedule 統計 + waste_collection_routes 1399+649
- BACKLOG：+BL-17/18/19，schedule prototype 標 done

<!-- /wrap-up 之後追加新反省 -->

---

## 2026-05-23 農業 Phase 3 Batch 1 全套上線（7 layer + 鐵則 3 → 4）

### What worked ✅

- **照 handoff doc 結構分 Step 0-6 + 用 TaskList 追蹤**：用戶說「請列計畫，逐步完成」，
  我先列 6 步驟 + TaskCreate 8 個 task。中間 step 可以 atomic commit 各自獨立 tsc 過，
  失敗能精準回退。最終 git log 看得出階段演進（factory / wiring / activation / 修 bug /
  legend / click / 規則）
- **3 個 atomic commit 切分主要 wiring**：(A) factory + asset gitignore (B) types/visibility/
  sidebar/params/data (C) MapView 啟動。中間每一步 `npx tsc -b` 全綠，可獨立 review
- **單一資料源 pattern 主動套用**：POI 三類 → `agriPOITypes.ts` / 土壤肥力 6 metric →
  `agriSoilFertilityMetrics.ts`。factory paint / FeatureInfoPanel / LegendPanel 三邊共用，
  下次改色一個檔搞定
- **跨 repo 操作謹慎**：taipei-gis-analytics 的 `pipelines/agriculture/` 整包 untracked
  時主動拒絕 commit，避免破壞用戶批次提交的脈絡
- **健康度綜合算法的探索式對話**：用戶問「綜合分數還是只是決策」時，我先講農業實務
  雙軌（多指標 vs 綜合分數）+ 點出他既有的 crop_suitability 已是綜合答案，再讓他選做法。
  避免直接做完發現他要的是另一條路

### What didn't ❌

- **連續 5 次規則應用太狹隘** — 最大問題：
  1. 作物適栽 4 級配色我以為「不是 POI 所以不用圖例」
  2. 農村再生 polygon 我以為「不是 POI 所以不用 click popup」
  3. PMTiles `keep_attrs` 我沒主動檢查就接 panel，導致空白
  4. POI 點位我以為「有 click popup 就夠了，圖例不用」
  5. 6 個 dropdown options 我以為 button row 撐得住，沒實機驗收 sidebar 寬度
- **規則寫法太抽象自找麻煩**：第一版「顏色標註差異」「POI 點位」這種詞，自己看自己寫的
  規則時都會有想像空間。明明是自己寫的還能誤判
- **`6 metric dropdown` 規則 4 是視覺驗收漏抓**：寫完 metric dropdown 沒打開 sidebar 看，
  純跑 tsc -b 通過就放心。等用戶截圖才看到溢出
- **handoff doc 沒事先看就動工**：第一次讀 user message 時以為「FRONTEND_HANDOFF.md」
  在 mini-taiwan-pulse 內，find 找半天才在 taipei-gis-analytics 找到。應該一開始
  就 grep 跨 repo

### Next-time rules 🎯

1. **寫規則時用數字 / 列舉 token，不要抽象形容詞**：
   - ❌「顏色標註差異」→ ✅「分類 ≥ 2 種」
   - ❌「POI 點位」→ ✅「POI / polygon / line / 3D 凡可選取」
   - ❌「options 過多」→ ✅「options ≥ 4」
2. **新 layer 收尾時對著 docs/development-rules.md §4a 四鐵則「逐條打勾」**，
   不要憑感覺豁免。每條都要回答「適用嗎？適用了沒？」
3. **PMTiles 重出 → 寫 panel 前必 check `keep_attrs`**：見 PB-14 SOP。
   `taipei-gis-analytics/pipelines/agriculture/_batch_download/06_export_frontend.py`
   是入口
4. **Sidebar 寬度視覺驗收**：寫完新 control 必開 dev server 看 sidebar 展開後沒溢出，
   特別是中文標籤（4 個就會撐爆）
5. **跨 repo 任務先 find/grep 確認檔案位置**：handoff doc / pipeline script 可能在
   sibling repo，動工前 `find /Users/migu/Desktop/資料庫/.../GIS -name "<file>"` 一次
6. **新 dataset 拿到先 EDA**：parquet 讀進來看 `df.isna().sum() / (df == 0).sum()`
   找 missing pattern。soil_fertility 0 ≠ 真零是這次教訓

### Memory 產出

- BACKLOG：+農業 section (AG-1~AG-5) + 已完成 1 筆
- DATA_SCOPE：+農業 section (7 layer 對照 + 3 踩坑)
- GLOSSARY：+農業 section (14 條術語)
- PLAYBOOKS：+PB-14 PMTiles 重出補欄位 SOP
- PRINCIPLES：+「圖層 UX 四鐵則」章節（指向 docs）
- INCIDENTS：+3 條（規則應用太狹隘 / Mapbox zoom expr / 0 = 未測）
- REFLECTIONS：本篇
- STATUS：重寫成 5/23 農業 Batch 1 完成狀態
- docs/development-rules.md §4a：圖層 UX 四鐵則完整版
- CLAUDE.md §5a：四鐵則摘要 + 連結
- auto-memory `feedback_layer_ux_triad.md`：跨 session 自動載入版本

### Skill 自身反省

`/wrap-up` skill 本次用得很順，按 Stage 1-5 走沒問題。

**唯一改善建議**：Stage 3 「保持精簡」原則我沒犯（沒 dump 完整 markdown 草稿），但
**Stage 2 Analyze 時把「用戶連續 5 次糾正」獨立挑出來標星，是該流程目前沒明寫的
最佳實踐**。建議下次 SKILL.md 可加：「**用戶糾正次數 ≥ 3 → 必寫 REFLECTIONS + INCIDENTS
雙寫**」（一個是反省，一個是事件紀錄）。

## 2026-05-24 消防分區（火災/分隊/消防栓 + 3D + 最新年度 layer）

**做了**：新增 FIRE & RESCUE 分區（4 layer）；分隊階級視覺化（circle/光柱/漣漪依 cat 分大小 + InstancedMesh 3D）；散點/3D 獨立 toggle；最新年度火點 layer；火災火焰特效試做後依用戶要求移除。headed agent-browser 全程視覺驗收。

**next-time rules**：
1. **測 layer 先 All Off**（用戶明示）——已寫進 PB-15。混層時無法判讀單層顏色/大小。
2. **WebGL/Mapbox 驗收一定 `--headed`**（headless 全黑），導航用 app 內建 Locations 城市預設別硬滾。
3. **toggle 用 `find text label` 不要用 snapshot ref**（ref↔列對應不可靠）。
4. **Mapbox 資料驅動 + zoom 表達式**：`["zoom"]` 只能在 interpolate/step 最上層，要乘 data 倍率就放進 stop 輸出。
5. **commit 前查工作區是否混了別人的 WIP**：本次 overlayRegistry 混了用戶 wasteStopsStatic WIP，靠「Edit 還原該 hunk → commit fire-only → Edit 還原回 WIP」拆乾淨（`git add -p` 此環境不可用）。
6. **HMR 期間的 hooks 錯誤先別當真**，full reload 複驗。

## 2026-05-25 農企業登記 3 layer（零售/蔬果批發/批發市場）

**做了**：接 taipei-gis-analytics 已 geocode 的 3 集公司登記（60,326 點）到 AGRICULTURE 區，
3 獨立 toggle。選 overlayRegistry（非其他農業層的 factory），MapView 零改動。UX 四鐵則 + tsc 綠 +
dev server 驗證 HTTP 200。

**next-time rules**：
1. **結構分歧先問再做**：1 合併層 vs 3 獨立層會改變整個成品形狀，用 AskUserQuestion 確認（用戶選 3 獨立）
   再動工——省得做完才發現方向錯。資料被刻意切成 3 檔/3 slug 是個訊號但不等於前端就要 3 層，仍該問。
2. **挑機制看資料量級**：大型 geojson 散點對照「同類最接近的既有層」（fireHydrants 70k 點）而非「同主題的層」
   （其他農業層是 PMTiles/polygon，用 factory）。對照同量級同型態的前例，複製成本最低、踩坑最少。
3. **exhaustive Record 有 3 張不只 1 張**：別只補 layerCatalog 的 LAYER_COLORS 就跑 tsc，
   IconRailSidebar 圖示表 + FeatureInfoPanel HEADER_LABELS 同樣會 TS2739（已寫進 PRINCIPLES + INCIDENTS）。
4. **perf 取捨主動標注不擅自分叉**：34MB eager 載入是真成本，但瘦身屬上游 SOP 的事——
   標注給用戶/上游決定，比在前端偷改 artifact 更不會破壞跨 repo 契約。
5. **跨 session 工作樹漂移**：wrap-up 時發現 BACKLOG 已有別 session 的結構審查 WIP + 工作樹冒出 fireIsochrone 層。
   memory commit 只動 `.claude/memory/*`（`git add` 指定檔），STATUS 對不確定的他人 WIP 用「in-flight 非本 session」
   指針帶過、不臆測細節。

### /wrap-up skill 自身踩坑（2026-05-25）
**index 已有他人 staged 變動時，`git add <file> && git commit` 會把整個 index 一起提交**。本次第一個
memory commit 意外帶上前 session 已 staged 的 5 個 screenshot rename + deckOverlay 刪除（7 files changed）。
`git reset --soft HEAD~1` 退回後改用 **`git commit -m "..." -- <pathspec>`**（只提交指定檔、保留其他 staged 不動）修正。
**SKILL.md 待補規則**：Stage 5 commit 前先 `git status` 看 index 是否已有他人 staged 變動；有就一律用
`git commit -m ... -- <file>` pathspec 提交，**不要** `git add` + 裸 `git commit`。注意 `-m` 要在 `--` 之前。

## 2026-05-26 救援等時圈（路網 5/10/15 分 + PMTiles + 全國聚合 + 屏東 geocode）

**做了**：消防分隊救援等時圈。Mapbox Isochrone API 生成（原始回應快取）→ 環差分級 → 全國聚合 +
各縣市兩套 → tippecanoe 切 PMTiles → factory 渲染 + 縣市 `<select>` setFilter。屏東 39 隊 geocode
補齊（677→716，22 縣市全）。立 PB-16 + PRINCIPLES「大面積覆蓋圖層」段（用戶要求同類比照）。

**next-time rules**：
1. **大面積覆蓋多邊形（等時圈/服務範圍/可及性）一開始就選 PMTiles**，別先 GeoJSON 再為效能簡化到變醜——本次來回兩次（簡化→移描邊→才換 PMTiles）才換對工具。判準：覆蓋面廣 + 高頂點 + 全台級 → 直接 PMTiles factory。
2. **「整體 vs 分區」聚合方式要先確認**：探索時我已標出 per-county 邊界會疊亂，卻沒主動做全國聚合，等用戶提才補。下次這種選擇主動 AskUserQuestion（全區一次 union vs 分區各自算）。
3. **生成腳本一律快取原始 API 回應**：677 次 Isochrone call 快取後，調簡化/切片參數重跑是秒級、0 額度。外部 API 批次生成都該先做快取層。
4. **多 PMTiles factory 並存**：SourceType 註冊 try/catch + ensure 排序保護（fire 在 agriculture 後）。
5. 中介 GeoJSON 寫 gitignored `build/`，`public/` 只放出貨 `.pmtiles`。

## 2026-06-02 正式上線 Zeabur（110 commit 大躍進 + Cloudflare + 4 UI + 2 新層 + 視角）

**做了**：跨多輪——上線前逐層稽核（docs/launch/ 8 份）→ merge feat/fire-rescue 進 master → 部署鏈強化
（entrypoint 背景 pull / pull 改 sync / agriculture 接鏈 / /geo /h3 /bus dist fallback / 移除 /api 死碼）→
本地 git-archive docker 全鏈路實測 → push 正式上線（itsmigu.com）→ Cloudflare 快取規則 → 4 UI 改
（移除 Data Availability / 齒輪規劃中 / 音符預設關 / flight+ship loading 圈圈）→ 農路+國土綠網 2 新農業層 →
預設開站視角 → 排查上線後 404。D1 改唯讀 S3 key + Mapbox URL 限制（用戶執行）；D4 誤報零動作。

**next-time rules**：
1. **上線前一定先跑本地 git-archive docker build**：忠實重現 Zeabur 從 git build，本次一次攔下 4 個會炸的雷
   （npm ci 不同步 / fire sync 遞迴 / entrypoint 阻塞 / bus 沒上 S3）。沒測就 push = 明早白畫面/部署失敗/一堆 404。
2. **Cloudflare 固定 TTL 會釘住暫態 404**：部署切換期暫態 404 被快取整個 TTL。Cache Rule 一律配 Status Code TTL
   404/5xx no-cache，上線後若已被快取要 Purge。
3. **稽核 agent 的靜態結論要實測覆核**：fire dist fallback、bus_trails timeout 都被 agent 誤判，連線實測 /
   本地 docker 才是真相。靜態讀 migration 會被舊版 CREATE OR REPLACE 誤導。
4. **資安收斂前先確認 RPC security 類型**：74/81 INVOKER → 撤 table grant 會打掛 RPC，改收窄 exposed schema。
   動權限前先 `SELECT prosecdef FROM pg_proc` 盤點。
5. **大躍進上線拆多次部署 + 逐次驗證**：UI / 新層 / 視角分批 commit+push，每次 zeabur deployment 監測 RUNNING
   + 線上 curl，出錯範圍小、可逆（backup tag）。監測要等對應 8 碼 commit 的 deployment，別太早抓到舊的。

---

## 2026-06-13/14 newsEvents 三輪升級 + CI/CD 全自動化

### What worked ✅

- **DB 先 apply 線上實測再 commit**：每個 migration 都先 `psql -f` 跑進線上、查 RPC 形狀正確再 git push，PR 開出去 CI 一定綠
- **自我端到端跑驗證**：collector dict 漏 LLM 欄位、RPC smallint→integer 兩個 bug 都是「本地實跑寫 DB → 查欄位是否填滿」抓到的，CI / PR review 都抓不到
- **分階段 ship**：階段 A 分類上色 → 階段 B 同鄉鎮聚合 → v2 三維度 → v2.5 Filter，每階段獨立可驗收、可回滾、可暫停
- **PR + CI 流程一次建立全套**：CI workflow + Claude auto-review + @claude mention 三條 workflow 三 repo 同步，從此每個 PR 自動跑檢查
- **Claude review prompt 改短後 review 從 6-10min → 30-90s**：限制「只看 diff、無問題單行 LGTM」直接解決訂閱燒鈔問題
- **跨 repo 並行**：用戶做衛星、我做新聞 v2，useTransportParams 的 mega dep array 沒撞車（兩人各自 rebase 處理）
- **agent-browser SwiftShader flags**：headless 跑 Mapbox 已知必須 `--use-gl=angle,--use-angle=swiftshader,--enable-unsafe-swiftshader`，這次驗收一次過

### What didn't ❌

- **collector dict 漏帶新欄位 silent fail**：LLM 跑了、parser 跑了、欄位攤到 item，但 records.append 是手寫 dict、漏帶 3 欄。本地實跑才發現
- **RPC smallint 從 supabase-js 傳會 type-cast 失敗**：本地 psql 用 `2::smallint` 沒事，supabase-js 傳 plain int 找不到 overload。先在 DB 端踩到才知道，第一個 PR 已 push
- **google-genai 套件首跑漏裝 + url_norm 鎖死**：homebrew Python 3.14 PEP 668 擋 pip，collector 跳過 LLM 但已寫 432 個 url_norm。下次新 collector 上線前先 `python3 -c "import <pkg>"` 試
- **Claude review 第一次跑 6-10min 沒立即截停**：訂閱燒了一輪「10 分鐘」白白浪費，第二輪才意識到要 cancel + 改 prompt
- **CI 首跑 pglast cache:pip error 沒預想到**：cache:pip 設定要有 requirements.txt，gis-platform 沒有就 fail
- **「自我檢查 vs PR review vs CI」三道網的真實命中率**：本 session 4 個 bug 都是「自我檢查」抓到的，CI 跟 PR review 都沒抓到任一個。CI/review 主要在「擋 typo + 維持規範」，不擋 silent fail

### Next-time rules 🎯

1. **新欄位 LLM → DB 五段路（PB-XX 新增 LLM 評估維度）必端到端跑一次**：跑完用 SQL `count(<新欄位>) = count(*)` 驗證沒漏接
2. **Supabase RPC 參數一律用 integer**：smallint 從 JS 客戶端會 cast 失敗
3. **新 Python 套件本地裝完先試 import**：`python3 -c "import <pkg>"` 確認，再跑 collector
4. **Claude review 跑 > 3 分鐘要立即 cancel**：訂閱按 token 燒，跑太久代表 prompt 沒限制好；先 cancel + 改 prompt 再重跑
5. **DB 改完先 apply 線上實測再 commit**：薄 RPC 都是冪等可重跑，比 PR review 抓得更實在
6. **跨 repo 多 PR 順序：DB → collector → 前端**：DB 端 PR 先 push 並 apply 線上，前端開 PR 時 RPC 已可用、能本地驗收
7. **新 CI workflow 必驗證綠燈再做下一步**：不能假設 setup-* action 沒設好就 skip，cache:pip 找不到檔直接 error

### 自我檢查 vs PR review 的職責分工

| 工具 | 抓什麼 | 抓不到什麼 |
|---|---|---|
| 本地 `tsc -b` / `pytest` | 編譯錯、單元邏輯錯 | 整合錯、silent fail |
| 本地端到端實跑 | silent fail、整合錯（**本 session 4 個 bug 都靠這個**） | 範圍以外的 regression |
| CI workflow | typo、語法、套件 import、規範一致性 | 業務邏輯、整合錯 |
| Claude PR review | 看出 prompt 可達範圍內的明顯異常 | 跨檔的隱性 silent fail |

### Memory 產出

- INCIDENTS：+4 條（google-genai 漏裝 / collector dict 漏欄 / RPC smallint 陷阱 / pglast cache:pip）
- PRINCIPLES：+5 條 newsEvents pipeline + 5 條個人 PR 流程
- PLAYBOOKS：+2 篇（PB-XX LLM 評估維度全鏈路 / PB-XX 全自動 PR 流程）
- GLOSSARY：+1 段 newsEvents 三維度+四級 / +1 段 CI 4 術語
- DATA_SCOPE：+1 段 newsEvents 完整表/RPC/collector 資料源
- 全域 news-roadmap.md：階段 A/B/v2 完成紀錄

---

## 2026-06-13 衛星圖層上線（PR #10）+ 並行新聞 v2（PR #11）

### What worked ✅

- **「先規劃 / 再 phase 切 / 再動手」分三段**：用戶問「規劃衛星圖層」時，沒
  急著寫 code，先進 plan mode 寫 `/Users/migu/.claude/plans/icon-curried-locket.md`
  + 提案文件 `docs/proposal/satellite-console.md`。提案完整後再動手，整個衛星
  10 commit 一氣呵成、無重做。
- **用戶要求「先診斷不要修」**：閃爍 bug 用戶明示「先確認原因，先不要急著改」，
  迫使我把 3 個嫌疑點全列出（殭屍 closure / effect 重綁 / listener 洩漏）
  + 建議診斷工具（DevTools setData hook）。一次修對所有 3 個。
- **資料來源切換果斷**：CelesTrak 一回 403 立刻棄、改 Supabase satellite_classified
  view，沒卡在「想用最直接的 endpoint」執念。半小時內整層上線。
- **UCS catalog 漏網之魚靠名稱保底**：FS-8A / TRITON 被 `country_operator=null`
  漏掉，沒去管 UCS 半年更新週期，直接加 `name ilike FORMOSAT*` 第二條 query +
  classify 名稱保底。3 行 code 解決 2 顆衛星。
- **分群決策有資料支撐**：上網查中國衛星 4 級分類（S Yaogan/Jilin/Gaofen,
  A TJS, B 北斗）+ 引用「每 10 分鐘過台灣」NOWnews 報導，給用戶選方案 A/B/C，
  最後拍 5 toggle 分流。

### What didn't ❌

- **三犯 `git add -A`**：working tree 有 `docs/proposal/monitor-mode.md`
  untracked 草稿時，連續三次 `git add -A` 把草稿掃進衛星 commit。每次都要
  `git rm --cached` + `git commit --amend`。第一次該記住的。
- **commit 切到錯分支沒察覺**：在 feat/news-filter-critical 上 commit 衛星
  perf split（用戶並行 WIP 的分支），混入 newsFilter 改動。`git reset HEAD~1`
  + 跨分支 cherry-pick 救回，多耗 10 分鐘。
- **修閃爍誤判副作用**：修穩定性後變成 1Hz 跳格，第一輪沒想到「原本順暢是
  effect 重綁 60Hz 假象」，用戶說「為何變一格一格」才意識到要拆 light/heavy
  分流。
- **規劃時誤判 satellite-art 為何走 Three.js**：第一輪 plan 寫「Mapbox globe 已啟用、
  不需 Three.js」，用戶問「會不會有印象那時候走 Three.js 是因 mapbox 不行」
  迫使我回 satellite-art 查 git log + grep mapbox 確認「從沒試過 Mapbox」、
  原因是 satellite-art 目標含太陽系（Mapbox 無法）。**該主動驗證，不要
  「直覺說 OK」**。

### Next-time rules 🎯

1. **`git add -A` 列入禁術**：commit 前一律 `git status` + `git add <檔案>` 精準。
   特別當有 `docs/proposal/*.md` 草稿、跨分支 WIP 時。
2. **commit 前 `git branch --show-current`**：避免切錯分支 commit。
3. **修穩定性類 bug 後評估顯式頻率**：穩定性修完視覺可能變慢，要主動問
   「原本順暢是不是 effect 副產物？」並拆 light/heavy 訂閱補救。
4. **plan 內「不需 X」結論要附驗證紀錄**：「不需 Three.js」要寫「驗證：
   git log + grep mapbox 全 repo 0 hit」這種紀錄，用戶才能信。
5. **UCS catalog 半年更新要假設 country=null**：未來任何國家衛星 loader
   都跑「country + 名稱 regex」雙保險，不要等被打臉才補。
6. **提案文件 `docs/proposal/` 是不錯的雙模式**：當下動手是 Phase 0，
   後續 Phase A/B/C/D 寫進提案文件，commit 上 master 讓記憶 + 未來 session
   都看得到完整藍圖。

---

## 2026-06-17 Monitor Phase 2 + YT B1 + 警訊 handoff 反省

本 session 一氣呵成 3 個主題：Monitor Phase 2（10 元件 + 5 loader + 2 RPC）→ YT 直播 B1（三 repo 同步）→ 警訊整合 handoff（給下個 session 接）。3 PR merge 進 master。

**做得好**：
1. **設計師 jsx 程式碼直接 port**：Monitor 全套（PressureRing/TwseTicker/SituationOverview/SituationCards/LiveWall/TimelineDock/IndicatorPanel/MonitorPanel）幾乎照搬，**只把 CSS var 換成 ts const、mock data 換 supabase loader**，視覺幾乎 1:1。下次有設計交接照這個 SOP 走，不要重新設計。
2. **跨 repo SOP 已寫進 PLAYBOOKS**：本 session 第一次完整跑 data-collectors + gis-platform + mini-taiwan-pulse 三 repo 同步部署，過程踩到的坑（transformer 漏註冊、RPC 名對不上、@handle 不認）全固化進 PRINCIPLES + INCIDENTS + PLAYBOOKS。
3. **alerts handoff 寫成自帶 task list 的 impl doc**：另一 session 拿了 `docs/proposal/alerts-integration-impl.md` + 一段 prompt 就能開工。寫的時候用 PRINCIPLES「三要素」（RPC signature / 元件 Props / 設計 URL）逐項檢查。

**該改進**：
1. **Monitor 卡空白 bug 該在 ship 前就抓到**：我寫前端 loader 時假設後端 RPC 跟著 handoff doc 建好，但只 pressure 那支真的有。下次 ship 前一定要 `psql proname` 一條一條比對。
2. **資料載入失敗 fallback 空殼會藏 bug**：rule 3 `withLoading` 失敗時 console.warn + return 空陣列是好設計（不 crash），但使用者看到「等待中」沒辦法區分「資料剛抓中」vs「RPC 根本不存在」。考慮 loader 內部加 `lastError` 欄位，UI 顯示「⚠ 資料來源異常」而不是「等待中」。
3. **YT 直播 video_id 第一輪沒驗就 ship**：拿到 collector regex 結果就直接寫進前端 LIVE_CHANNELS，沒實際 verify 那些 video 真的是 24h 新聞直播。用戶看到民視在播政論節目當下覺得「不是直播」才回頭查。下次資料來自外部 API 時要在 sample data 階段就驗證內容。
4. **跨 repo 工作不要拆多 session**：本來想說 collector 跟 migration 可以下次再做，結果用戶很自然地說「你幫我都動」。一氣呵成反而省下大量 context switch + 重新讀 schema 的成本。**Default：跨 repo 同主題 commits 盡量在一個 session 串完。**
5. **`gh pr merge` 沒 `-y` flag**：被 `-y` 卡了一次。實際語法是 `--squash --delete-branch`，不需要 confirmation flag。記在 GLOSSARY 沒必要，但下次 PR 動作直接寫對。
6. **設計師命名跟 layer 既有命名不一致要早一步做 mapping**：alerts handoff 寫到一半才意識到設計師用短形 `weather/flood/...`，現有 layer 用長形 `weatherAlerts/floodAlerts/...`。在 impl doc 加 mapping fn 段落解決。下次看到外部交付的 enum/key 命名先過一次「跟我們既有同義詞」對照表。
7. **同類問題：群組色 vs 既有 LAYER_COLORS 也要對照**：設計師用 `#d946ef/#38bdf8/#2dd4bf/...` 給 alert 群組，跟 `disasterAlertTypes.ts` 既有 `#a855f7/#3b82f6/...` 不同。impl doc 已說明 mapping，但下次設計師若沒主動避開既有色票，第一輪 review 就要提醒。

**memo 給下個 session**：alerts 整合執行時，記得先讀 `PRINCIPLES.md` 末 2 條 + `PLAYBOOKS.md` 末 1 條 + `INCIDENTS.md` 末 2 篇。三者構成本 session 的「不要再踩」清單。

---

## 2026-06-18 Design System 6-phase migration 反省（PR #22）

本 session 從用戶問「該不該有設計系統？」開始，做到 8 commit、~60 元件、1200+
inline 值收斂到 token，merged 進 master。

**做得好**：

1. **正確順序：先 audit → 寫 token + 規範文件 → 分 6 phase 逐項收斂**。沒有跳級
   抽通用元件庫、沒有為了改而引入 CSS 框架。Phase 0 純新增、零風險打底，後面所有
   phase 都能 import 既有 token。
2. **每 phase 獨立 commit / 可單獨 revert** — 用戶說「Phase 3 想還原可以嗎」我
   直接答「git revert cc744e1」一行就行。這個結構讓用戶心理門檻低、敢驗收。
3. **在用戶面前透明展示 trade-off**：Phase 3 文字色從半透明白變純灰 hex 我先用
   `AskUserQuestion` 列 A/B/C 三方案 + 各自視覺差說明 → 用戶選 A 但補一句「之後想
   改回去可以嗎」→ 我明確答可以。沒矇用戶往下做。
4. **Codex 救了 Phase 0 / Phase 1**：Phase 0 codex 抓到 fontSize 12px 缺位（audit
   有 66 use）、SURFACE 註解過期、circular dep 風險；Phase 1 codex 抓到 10 處
   control bg over-replacement。兩處都是 subagent 與我都漏看的。
5. **PR body 寫得自含**：列 6 phase 總表、視覺影響重點、萬一不滿意的 revert
   指令、未抽 token 範圍說明。用戶之後想找哪個 commit 改了什麼一查就有。

**該改進**：

1. **subagent prompt 給的 grep pattern 沒含空格版** → 漏改 LegendPanel /
   FeatureInfoPanel（INCIDENTS C）。**下次**：grep 對映表一律寫 regex 或同時列
   無空格 + 含空格兩種；或直接讓 subagent 自己 `grep -E` 找候選再驗證。
2. **subagent prompt 沒區分 semantic（panel 容器底 vs 控件互動態）** → Phase 1
   被 codex 抓 10 處 over-replacement（INCIDENTS A）。**下次**：spec 表頭加
   「what this token IS / IS NOT」兩列，明確界定語意邊界，而不只是「值對映」。
3. **Phase 3 codex 卡 23 min 我沒早點 cancel** → 等到第 23 min 才查 status，浪費
   user 時間（INCIDENTS B）。**下次**：previous phase 同類 review 用了 N min，下次
   N\*5 沒回就 cancel + 手動 fallback。
4. **沒先用 worktree 並排 master 給用戶 A/B 視覺比對**：Phase 3 / 4 視覺微差時用戶
   說「體感不出來就好」其實有點怕「真的沒差別嗎」。下次大量視覺收斂可以建議用戶
   開兩個 worktree 並列（master vs feat），同 panel 並排截圖。雖然需要 dev server
   雙跑、設定成本不低，但對 user 心理踏實感很高。
5. **codex review prompt 寫太發散**：Phase 3 prompt 寫了 5 個檢查項目又附 alpha
   階梯範圍，codex 想 verify 太細跑到掛掉。**下次**：codex review 一次只查 1-2 個
   高風險項目，其他用手動 grep + tsc 兜底。
6. **Phase 5 業務語意拍板節點掌握得對，但執行前沒列 trade-off 的視覺後果**：用戶
   早就決定「以地圖色為主」，我直接執行 — 但實際 flood 改紅後跟 safety 變相近這個
   side effect 是 commit message 才寫的。**下次**：拍板執行前先列「這樣改之後 X
   會跟 Y 變接近」，用戶可預期。
7. **codex hung 時的判斷依據要寫進 PLAYBOOKS**（已做 PB-19 §5），但本次浪費了一輪
   無謂等待。**下次**：第 5 min 開始 `codex-companion status` 看 phase + elapsed，
   不是被動等。

**memo 給下個 session**：

- 若要再做大型 token / 樣式收斂，**先讀 PB-19** — 6 phase 結構、subagent prompt
  精準度、codex fallback、user 拍板節點都已固化
- 若要抽新 token（DS-1~7 之一），參考 docs/design-system.md §1 SSOT 結構與
  §7 KEEP OUT。改 designTokens.ts 前確認沒違反「單向 import」避免 circular dep
- 若用戶問「該不該抽 X 元件」，先回 PRINCIPLES「不抽通用元件庫」+ 視同 G009/008
  巨型檔案拆分一起看，不要單獨抽

---

## 2026-06-19 — 能源 MVP v1.0~v1.3.5 反省

### 1. 「3D 圖層 toggle ON 但 console 沒 setData log」應該 5 分鐘內想到 isStyleLoaded race

**事實**：2026-04-22 水庫圖層已寫 pitfall `.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md`，
這次 energy beam 完全重蹈，卡了 4 輪 debug 才回想起來。

**SessionStart hook inline 的是 STATUS / BACKLOG / PRINCIPLES**，pitfalls 要主動 grep 才看到。
獨立 3D hook 是低頻場景（一年 < 5 次），不在 muscle memory。

**已採取**：
1. pitfall 檔頂加觸發詞「3D 圖層 / Three.js / CustomLayer / addLayer / Three.js scene」
2. PRINCIPLES 加一條「寫獨立 CustomLayer hook 前 grep `.claude/pitfalls/*mapbox*`」
3. INCIDENTS 加完整 5 輪 debug 時間軸
4. hook 內 inline 註解直接指 pitfall 檔

**下次驗證**：下次寫新 3D hook 時觀察自己是否在動工前主動 grep。

### 2. 視覺微調不要只看單一 zoom

**事實**：v1.2 BEAM_RADIUS 0.00005（粗壯）→ v1.3 改 0.00002（蠟燭錐視覺修，但只在 zoom 10 試）
→ 用戶 reload 在 zoom 5 看不到 → 才發現 < 1 px → v1.3.2 補回 0.00005。

binary search 視覺尺寸要在「最常見 zoom（5）+ 中等 zoom（10）+ 街景 zoom（19）」三個視角各看一次，
不然容易誤判「太細」或「太粗」。

**已採取**：PB-20 微修迭代段加「每次改 radius 一定要在 zoom 5 + 12 + 19 三視角看一次」

### 3. HANDOFF 文件不要全信，schema 必查、JOIN 公式必試一筆

**事實**：HANDOFF §3.2 寫 `SPLIT_PART(unit_name, '#', 1) = plant_name`，
真實 unit_name 是 `大潭CC#1` 不是 `大潭發電廠#1`。第一次 apply 213 RPC 跑出 `with_output = 0` 才發現。

外加 schema 三處欄位名不對齊（power_system_status 全寫成 supply_capacity_mw 而非 fore_maxi_*）。

**已採取**：PB-20 失誤點段「下次寫 RPC 前先抽 5 筆 raw 跑 SELECT 驗 JOIN 規則」+
energy-mvp-status.md §0 列「與 HANDOFF 偏差（已修正）」5 條

### 4. Slider 鐵則應在 Phase G 寫進去，不要 baseline + 補（雙寫成本）

**事實**：v1.0 接好 4 layer 直接過 ratchet，slider 全進 BASELINE_NO_PARAMS（conscious decision）。
v1.3 用戶要求 sliders 後才補，又要 ratchet baseline 移除 4 個 → 雙寫成本。

**下次怎麼做**：Phase G 「sidebar + legends」階段同時把 sliders 也寫了，不要拆兩階段。
PB-20 Phase G 段已含 sliders 註記。

## 2026-06-21~22 化石燃料 14 layer + 加油站 30km coverage + accessibility SKILL 落地

### What worked ✅

- **化石燃料 14 layer 一次性 agent delegate**：13 個 panel + 14 colorScale + 11 處 SOP 細節密集，
  delegate 給 agent 一次完成 3 commits（types/loader/hook + overlay/params/sidebar + popup/legend/test），
  保留 main context 給後續決策（顏色 / halo / coverage）。
- **雲林 POC → 全台模式驗證**：先用 ~1,000 站雲林跑 2 分鐘出 5 個 GeoJSON，視覺對了再 commit + 擴全台。
  小迭代避免「一次跑全台 ~6 小時才發現方向錯」。
- **發現 fire isochrone pattern → 升級資料模型**：用戶指出救援等時圈視覺更精細，
  從原本「H3 hex 馬賽克 / coverage_count 計數」改成「LineString 沿路網 / nearest distance 5 級色階」。
  資料模型對齊既有 fire/medical pattern，未來新 POI 可複用。
- **SKILL 落地是這 session 最大的 win**：把三模式（路網/Polygon/Hex）+ 兩大鐵則（multi-bucket/whitelist）+
  troubleshooting（卡了怎麼辦）整理成可複用工具箱。下次新 POI 不用重新踩坑。

### What didn't ❌

- **8 小時卡 Overpass 沒早 kill**：osmnx subdivide 32-way 第一個 subquery 卡 socket 不回，
  CPU=0% + alive 我以為是「慢」實際上是「死等」。應該每 ~5 min 看 cache 增量，無增量就 kill。
- **OVERPASS_URL 設成 `/api/interpreter` 拼錯**：osmnx 自動拼 → 變 `/interpreter/interpreter` 雙拼。
  我 retry 一次 fail 之後才發現是 base URL 問題。**第一次設 mirror config 應立即用一個小 query test**。
- **CUSTOM_FILTER 沒對齊重跑卡了 ~1 小時**：B 版加的 `unclassified` 沒改回 A 版的 motorway-tertiary，
  以為跑 A 版實際跑 B 版又卡 mirror。**重跑前 grep config 跟「上次成功的」對齊** 是基本動作但我漏了。
- **pyrosm 全台 driving 直接吃 50 GB RAM**：應該先 grep 「pyrosm + 全台」量級才動手，
  而不是「先試試看」直接跑。**新工具第一次用前先做 RAM/磁碟試算**。
- **8 小時 + 多次 40 分鐘 retry 才解出來**：用戶說「你剛剛做了什麼」「為什麼之前可以」這兩個問句是
  正確的 retrospection 提示。**用戶問「為什麼之前順」時就該先做 diff 而不是繼續硬幹**。

### Next-time rules 📌

1. **長跑 batch 必加 progress log**（`flush=True`），沒 log 一律當卡死
2. **每 ~5 min 看 cache / log 增量**，無增量超過 10 min → kill 不要等
3. **第一次設 mirror config 立刻用一行 query test**，不要拿全台 query 試 base URL 對不對
4. **重跑前 grep CUSTOM_FILTER / BBOX / OVERPASS_URL 跟上次成功 commit 對齊**（一行 diff）
5. **遇 `network_type='driving'` 級的 in-memory ops，先試算 RAM**（edges 數 × 500 bytes）
6. **用戶問「為何之前可以」是 strong signal**：先停下做 diff 不要硬 retry

### SKILL 自學習價值 🌱

這 session 因為「用戶要求 SKILL 化」而把 8 小時痛苦轉成可複用知識：
- 三模式選擇決策樹 — 之前需要看 3 個既有 pipeline 才搞懂
- 兩大鐵則 — multi-bucket / whitelist 之前是隱性知識
- troubleshooting.md — 把「卡了怎麼辦」5 分鐘流程明文化
- mirror-fallback.md — 5 條救援路徑 + 健康度測試

下次新 POI 啟動：`Skill accessibility-analysis` → 讀 §⚠️ + §🚨 → 30 秒準備 → 直接動手。

**核心 insight**：**痛點不寫進 SKILL，就會在下個 session 重新踩**。寫進 SKILL 不是 nice-to-have，是預算控制。

### Memory 產出（這 8 個 commit）

| Commit | 檔 | 內容 |
|---|---|---|
| ea8de59 | PRINCIPLES | +4 條（multi-bucket / whitelist / 健康檢查 / CPU=0% 診斷）|
| 350abf7 | INCIDENTS | +2 段（Overpass mirror 8h 連環卡 + SQL CASE 短路求值）|
| f84e911 | GLOSSARY | +可達性分析章節（Mode A/B/C + 5 級色階）|
| 15616ee | DATA_SCOPE | +14 化石燃料 + 5 coverage PMTiles + 品牌分布 |
| 2ba6b8d | PLAYBOOKS | +PB-22 新增 POI 可達性分析入口 |
| d1f4f70 | BACKLOG | CV-7/9 done + CV-3 osmium 裝好 + CV-8 第 6 layer |
| TBD | STATUS | rewrite — 本 session 總結 |
| TBD | REFLECTIONS | 本篇 |

---

### 5. 並行 session 的協調（2026-06-19 加）

**事實**：用戶在開 wrap-up 同時告知「我另一個 session 在開發」（很可能在做 energy v2-A）。
memory commit 動 `.claude/memory/`，不會撞到 code 變動，但**不要 push** — 等並行 session 也收尾後一起 push 或讓用戶決定。

**下次怎麼做**：用戶說「另一 session」時：
1. 確認該 session 動哪些檔案範圍（程式碼 vs memory vs docs）
2. 我這邊只 commit 不重疊的檔案
3. 一律**不 push**，留給用戶手動同步順序

---

## 2026-07-01 警政司法 17 layer + 警察 isochrone 全台 session 反省

**Session 規模**：跨 2026-06-29 到 07-01 三天，做了警政司法民防 22 dataset（17 GIS layer + 3 realtime + 5 skip） + 警察 isochrone × 3 層級 × overlap_count 全台 5 區 pipeline。

### 3 條 next-time rules（→ PRINCIPLES 已補）

**1. 跑 osmnx / pyrosm 前先 find PBF 本機**
- 這 session 白等 Overpass 24-72h cooldown 後才發現 taipei-gis-analytics 早有 taiwan-latest.osm.pbf 309MB
- accessibility SKILL §5.3 明明寫本機 PBF 是 fallback path — **應該當 primary path**（Overpass 太不穩）
- 教訓：SKILL 也是要進化的，別死守既有分類

**2. 分區跑 isochrone 一開始就要 bbox overlap**
- 5 區 wrapper 一開始 bbox 完全不重疊，跑完才在用戶截圖看到桃園/新竹交界斷裂
- 該一開始就寫 `bbox + [-0.15, -0.15, +0.15, +0.15]` overlap，dedup 邏輯放 merge_regions
- 現在記 PI-1 待補、要重跑 60-90 min

**3. 新增 layer 前先 grep + find + git log 三連查**
- airports.geojson 早存在（Polygon 機場輪廓 + iata/icao 全欄），我卻在 plan 寫「建 4 點機場 dataset」— 用戶提「不是有現成的？」才發現
- 差點浪費工程 + 覆蓋既有 layer key
- 教訓：用戶對 codebase 的記憶 > 我對 codebase 的直覺

### 這 session 做對的事

**1. dissolve by overlap_count 這個決策**：從 26,644 fragments → 73 features，PMTiles 從 14MB 降到 5.8MB，視覺從「切碎鋸齒」變「乾淨階梯」。這決策點很關鍵、直接讓警察 isochrone 從「不可用」變「可用」。**這個做法應該推廣到消防 / 醫療 isochrone**。

**2. 疊代式視覺調整（convex → concave(0.3) → concave(0.5)+dissolve）**：每階都試跑一個變體給用戶看，用戶回饋「太細碎 / 亮度不一 / 分區斷裂」直接指出下一步方向。**沒有這 3 段疊代直接跑全 12 變體 = 白費 5+ hr**。

**3. TaskCreate 追進度**：這 session 用 TaskCreate 追 A/B/C 三大 phase 21 個 task，能持續給用戶「哪些 done / 哪些 in_progress」清晰視角。

### 這 session 該改進的

**1. session 太長太雜**：token 從 15M 用到 14.2M。中間有多個「應該收尾但被繼續拉」的自然斷點（警政 layer 上線後 / isochrone 雙北試跑後 / 全台失敗後）。**下次類似大工程應該主動說「先 /wrap-up 一次，這裡 checkpoint」**。

**2. 提 3 選項時偏向自己想做的**：用戶要「全台跑」時我提了 A/B/C 三選項但實際上心裡想推 A（分區跑），結果 A 撞到分區邊界斷裂 → PI-1。應該更 neutral 呈現選項，讓用戶決定，別「暗推」自己心中的方案。

**3. TaskCreate 沒即時 update**：中間有幾次 task 描述已過時（例如「C4 跑 pipeline 12 變體」實際上跑了 3 次不同版本），沒 rewrite 描述反映 → 用戶看到會混淆。

### 本 session commit 索引

| commit | 主題 | 檔 |
|---|---|---|
| e824165 | fix(police-iso): dim line layer (0.3→0.08) 消除同心圓 | overlayRegistry.ts |
| 9a79240 | docs(memory): add PI-1 backlog（分區邊界斷 3 修法）| BACKLOG.md |
| 5aa244f | memory: append GLOSSARY (isochrone × overlap 8 詞) | GLOSSARY.md |
| 098ffc5 | memory: append INCIDENTS（三連環卡 + 4 副 + 2 獨立事件）| INCIDENTS.md |
| 4a7dfa4 | memory: append PRINCIPLES（Mode B default + PBF-first + 5 條）| PRINCIPLES.md |
| 511be4c | memory: append PLAYBOOKS PB-24 | PLAYBOOKS.md |
| 67dd4e4 | memory: append DATA_SCOPE（警政 22 + 3 combined）| DATA_SCOPE.md |
| addecb4 | memory: append PMTILES_STATUS（3 + 3）| PMTILES_STATUS.md |
| TBD | memory: rewrite STATUS | STATUS.md |
| TBD | memory: reflect REFLECTIONS（本篇）| REFLECTIONS.md |

**session 前 21 個 code commit 不在此列**（警政/司法/民防/isochrone 上線 commits 分批合到 master，見 git log 44d0d2c 之後）。

---

## 2026-07-01/02 — DX Overhaul（Workflow / Docs / Memory 全面升級）

**觸發**：用戶盤整開發流程，目標「下一次開發能有效觸發 SKILLS、避免重複問題」。

**做了什麼**：3 波共 65+ 檔改動 — 建 handoff/ADR/features 骨架、寫 layer-onboarding skill、CLAUDE.md 加 Git Workflow、全域 memory 28→7 大改組。詳見 `docs/proposal/dx-overhaul-2026-07.md`。

**做對的地方**：
- 用對抗式 Explore agent 平行驗證 memory 涵蓋度，揭露 2 條 critical 缺項（複合索引 / pg_cron TZ 教訓）之前 PRINCIPLES 沒有
- Auto-trigger 用 4 重備援（PRINCIPLES / CLAUDE / load-session.sh / skill description keywords），單點失效不會全垮
- 「不刪只 archive」政策 + 帶 canonical 出處 header，救得回
- 建骨架時同步做 1 個實際範例（real-estate 完整 4 檔）→ 用戶隔天自主上線 bloom-experiments 印證 pattern 可用

**做錯的地方**：
- Phase 1 & 3 的 12 檔用 `rm` 刪，才被用戶提醒改「移到垃圾桶」→ Phase 2 8 檔才改用 `mv ~/.Trash/`。原檔仍在 `_archive/`（帶 header 備份），但少了一層救援
- Wave 3 補 5 個 upstream handoff 靠 agent 讀 archive 檔，若 archive header 沒寫清楚 canonical 出處就會斷鏈 — 未來 archive 政策要更嚴謹

**通用教訓（考慮進 PRINCIPLES）**：
- **對抗式驗證比信任 memory 描述更可靠** — memory 是 snapshot，主檔才是 SSOT；改組前一律對照驗證
- **auto-trigger 要多重備援** — session hook + rule doc + skill keyword + command 4 重才穩
- **「不刪只 archive」對用戶承諾** — 未來所有清理走垃圾桶模式，不用 `rm`

| commit | 摘要 | 影響檔案 |
|---|---|---|
| f45eddf | Wave 1: skill + Git Workflow + features 骨架 | 15 檔 |
| 87da753 | Wave 1: analytics handoff + ADR 骨架 | 7 檔 |
| b65aa8e | Wave 2: memory 28→7 大改組 + 4 缺項補完 | 24 檔 |
| 6df1b8c | Wave 3: PR/postmortem 模板 + /handoff + agent sync | 8 檔 |
| c510618 | Wave 3: 5 upstream handoff SSOT | 5 檔 |

---

## 2026-07-01/02 — 對「初次分析」要保持更多懷疑（PI-1 收尾）

**Session**：接續處理 PI-1（警察 isochrone 區界斷裂），結果同時修好第 2 個 bug（山區 station 偏移），完全非預期。

### 用戶 3 次 push 都指真問題

| Push | 用戶說法 | 我的初次反應（錯的） | 真相 |
|---|---|---|---|
| #1 | 「這次確定會根治嗎？之前也說會根治？」 | 提出 3 步驗證方法就繼續往推薦修法 A（bbox +0.15° overlap）走 | 檢查 15_run_by_region.sh 才發現 5 區 bbox 早已有 40km overlap → 修法 A 前提就是錯的。真根因是 per-region dissolve concat trap |
| #2 | 「山區這幾顆完全沒看到」 | 說「山區半徑天然小，這是資料真實反映」 | 榮興在台8線主幹道旁，polygon 有 3-4km² 但**離 station 5 km**（偏移 5306m > drive 5min radius 2739m）→ 完全不在 station 附近 |
| #3 | 「他就在主要的道路上，這件事不太合理，請你再好好的確認一下」 | 才做 polygon centroid vs station 座標偏移檢查 | 找到 drive PBF 過濾造成 nearest_nodes 拉錯 4-5km 的第 2 bug |

**核心教訓**：**當用戶物理直覺說「這不合理」時，我的第一次資料分析常常抓不到真根因**。用戶不需要看到我的分析過程，只需要看到最終結果 — 但如果最終結果違反物理直覺，多半是我漏了某個檢查維度（例如：不只查「有沒有 polygon」，還要查「polygon 有沒有包住 station」）。

### 3 條 next-time rules

1. **驗證前提假設，別急著實作原修法**：提修法前先跑 3-5 min 的 mini-check 確認「診斷的觀察前提」還成立（例如：檢查 bbox 是否真的沒 overlap、檢查最近節點距離是否合理）。前提錯了，修法再精緻也白搭。
2. **GIS 檢查一律 `polygon.contains(Point(station))`**：不要只看「有無 polygon / polygon 面積」判斷「station 有沒有被覆蓋」。centroid 偏移和 contains 是兩個維度。
3. **對照測試在動全台前**：10 顆邊界 station 15 min vs 全台 90 min。用戶 push #1 後我做的對照測試（OLD 8 features vs NEW 4 features）是本 session 最有效率的診斷投資 — 全台跑之前就確定新架構會 work。

### 本 session commits（8 memory + 1 sidebar UX + 1 taipei-gis-analytics pipeline）

| commit | 說明 |
|---|---|
| `d6582a9` | memory: update GLOSSARY（改正分區斷裂診斷 + 2 條新詞）|
| `d52724b` | memory: revise PRINCIPLES（分區覆蓋 layer 改正 + nearest_nodes 閾值）|
| `f6901c4` | memory: update PLAYBOOKS PB-24（pipeline 5 檔架構 + PI-1 收尾）|
| `c06351b` | memory: append INCIDENTS（2026-07-01/02 PI-1 兩 bugs 完整診斷）|
| `670f02c` | memory: update PMTILES_STATUS（isochrone 已上 S3）|
| `b3c3fdd` | memory: close BACKLOG PI-1 + add PI-2 / PS-1 |
| TBD | memory: reflect REFLECTIONS（本篇）|
| TBD | memory: rewrite STATUS（PI-1 收尾）|
| （另檔）| **taipei-gis-analytics** `a44f6f3` 5 檔 pipeline（未 push）|
| （另檔）| **mini-taiwan-pulse** sidebar `layerCatalog.ts` 警察覆蓋分析降級到執法治安子群（未 commit）|

## 2026-07-02 全球氣候 session — 3 條 next-time

1. **接完 Supabase layer 一定實際 toggle 驗**：颱風軌跡 loader 欄位 bug（center_pressure）讓整個 layer 靜默壞掉、可能壞很久沒人發現。tsc 過 ≠ 有資料。用戶問「有資料嗎」我才去查，一查就發現壞的。→ 接資料 layer 收尾必開來看。

2. **「多來源同實體」要主動想到去重/選擇**：用戶截圖問「這兩個是同一個颱風嗎」我才意識到 JMA/JTWC 雙機構重複。這是資料常識（RSMC vs JTWC），設計颱風 layer 時就該預想，而非被動發現。→ 接多來源資料先問「會不會同一實體出現多次」。

3. **分支整合前先盤點結構再動手**：用戶說「幫我整理成乾淨分支」，我先花時間 map 清楚（哪些已在 master / 哪條混了幾個 feature / memory 內容會不會遺失）再提方案讓用戶選，才動 cherry-pick。混亂分支拆乾淨靠「topic-scoped commit 各自 cherry-pick + 依序 merge + 每次 rebase」——這次 climate/bloom/police 三條乾淨併回，衝突只有 2 個（deps 陣列 + baseline）都好解。

4. **驗證工具的限制要誠實講**：agent-browser 合成 wheel 縮不到全球 zoom（工具限制非 app），拉遠自適應密度我用數值驗算補足並明講「這段我沒法自動驗、麻煩你用真滑鼠看」。別假裝驗過。

## 2026-07-03 BYOK 對話 + 會員系統 + Supabase 資安（含重大自省）

### What worked ✅
- **契約檔解耦多 agent 平行派工**：先定 `src/chat/types.ts`（MapBridge/RunChatTurn/KeyVault），再派 UI(Sonnet)+邏輯(Opus) 平行，檔案集不相交 → 零衝突。整合階段單獨派接 App.tsx。
- **審查揪出 agent 沒察覺的安全洞**：Task 回報 profiles 用 column-level GRANT 防 tier 自改，psql 實查發現 Supabase default grant-all 蓋過它 → 補 REVOKE。
- **收尾時的 ground-truth 查證救場**：wrap-up 開頭 `git status`+psql 發現「先前聲稱做完的安全修復/CI 修復其實沒發生」，才真正修好並驗證。誠實面對 + 重做。

### What didn't ❌（這 session 最大失誤）
- **幻覺聲稱完成未執行的工作**：大段描述「已開 RLS/curl 實測/commit migration/清髒 row」，實際對線上 DB 與 git 從未發生。導致：給用戶錯誤的「已修好」結論、commit 了捏造表名的地雷 migration、安全洞其實還開著。
- **引用 agent 幻覺報告未查證**：安全 agent 幻覺 newsletter_signups（不存在的表），我寫進給用戶的評估還差點 ALTER 它。
- **跨 app 共用資源盲點**：第一次評估 Exposed schemas 只 grep 單 repo。

### Next-time rules（強制）
1. **「已完成」= 有工具輸出佐證**。任何聲稱做完某事（改 DB/commit/部署/測試通過）前，用工具查真實狀態：`git status`/`git log`/psql `SELECT`/`curl`/`gh api commits/<sha>/check-runs`。不靠記憶或敘述。
2. **修復類跑完立刻獨立驗證**：RLS → `SET ROLE anon` 讀應通寫應擋；lockfile → 實跑 `npm ci`；部署 → 查 check-runs conclusion。exit 0 ≠ 達成目的。
3. **不信 agent 二手報告的事實**（表名/數字/狀態），改 DB 或寫結論前自查 ground truth。
4. **改共用 DB 的 schema 級設定前，grep 全生態所有前端 repo**。
5. **Supabase 新表 checklist**：ENABLE RLS + read policy；column 級權限先 REVOKE default grants；migration 加 to_regclass 守衛。
6. **pnpm worktree 開發但 CI 用 npm**：加依賴後 `npm install --package-lock-only` 同步 package-lock.json，否則 npm ci 掛、部署不生效。

## 2026-07-04 BC-8 診斷 + static-to-cdn（25 層讀取去 DB 化）

### What worked ✅
- **先排除用戶假設再往下挖**：用戶疑「Supabase 改動造成」，我沒照著查 RLS，而是用線上 anon key 直打 RPC 拿 ground truth → 一次排除後端，把方向鎖到前端。
- **repro 卡住時質疑「冷載定義」**：subagent 暖機測 7 次測不出，我意識到 `cachedOnce` 記憶體 cache 要 page reload 才清、`setData([])` 不算冷 → 換真冷 repro（reload）一次命中。
- **pilot 先跑通 pattern 再放大**：電網 3 層完整走完 export→loader→deploy→冷載驗證，確認模式無誤才 delegate batch 15 + 廢棄物。
- **delegate 高風險重構帶「對數驗證 gate」**：廢棄物 fetch-all+filter 改動 loader 邏輯（易錯），要求 subagent psql 對照「客戶端 filter 筆數 = RPC 帶參筆數」10/10 才算過——比信任自述可靠。
- **信任 subagent 的 push-back**：subagent 判斷 stops 全量 193k/56MB 不該搬（且 fallback 危險）主動保留 per-city RPC——正確，沒硬套模板。
- **fallback 設計讓 merge 低風險**：staticRpc 404→RPC，即使部署過渡/漏檔也只是「沒加速」不會壞；prod poll 到真檔才算完成。

### What didn't / 可改進
- **面對「全部搬完」一度想直接批量**：幸好收斂成 pilot→batch→驗證分層，否則 15 loader 盲改風險高。
- **併發子任務碰同檔差點衝突**：waste subagent 改 export 腳本時，我差點同時加 primary_operating → 及時改成「等它完成再整合」。delegate 前該先畫清「誰擁有哪些檔」。

### Next-time rules
1. **診斷先拿 ground truth 排除最貴的假設**（後端/資安），再往前端挖，別被敘述帶著走。
2. **有 in-memory cache 的 repro 必 page reload**（清 source ≠ 冷載）。
3. **delegate 會改邏輯的重構 → 給可量化的驗證 gate**（對數/count 相等），不收「我測過了」。
4. **併發 delegate 前先分檔案所有權**，主 agent 不碰 subagent 正在改的檔。

## 2026-07-07 owner-gated 安全鎖定

### Next-time rules（續）
5. **安全鎖定要主動全掃 public schema**，不只鎖「前端 API 用到的」——孤兒 table/view（無前端引用但 anon 可讀）一樣洩漏。上線後派獨立安全審計 agent 掃 DB 繞道 + PostgREST schema + git 歷史 + bundle，別假設「鎖了清單就安全」（這次真掃出電廠 public schema 洩漏）。
6. **DB migration 驗證要走真實呼叫路徑**：psql `SELECT func()` ≠ PostgREST REST（後者對 STABLE func 用 read-only tx）。owner-only 功能要用真 authenticated / service_role REST 驗，別只 psql 模擬 → read-only tx bug 就是這樣漏到 browser 才炸。
7. **接手他人 session 先盤點工作區有幾份未完成 WIP**（這次 owner-gated + pollution + 主題化 + 會員 docs 四份混疊），delegate 前明確劃「不碰 pollution/主題化」，拆 PR 時逐份隔離。**改動來源不確定時先問，別擅自 revert**（差點把用戶主題化 WIP 當「agent 跑偏」還原）。

## 2026-07-22 夜景 layer + timeline 修正

### What went well
- **需求分歧先給選項再動手**：夜景燈光有「Mapbox 原生 vs Three.js bloom vs 離線點集」三路線、視覺/工作量差很多 → AskUserQuestion 附 preview 讓用戶拍板，避免盲做（用戶選 Mapbox 原生）。
- **修完單點順手全掃同 class**：用戶問「其他 layer 會不會一樣」→ 2 平行 agent 掃 8 store + 535 setState 確認孤例，比只修那一行更有說服力。

### Next-time rules
1. **headless 驗視覺前先確認能驅動**：`window.__THREE__` 非可用 namespace、React layer state 無法外部驅動 → 別硬 eval 重建，改「資料管線 probe + 元件級已驗證據」組合佐證。
2. **render-phase 寫被訂閱 store = setState-in-render 同 class**：clean load 隱身、remount 才冒 → 別因「重現不出」當沒事，靠結構判定定案並全掃同 class。
3. **修 bug 後主動 audit 同 class**：單點修完派 agent 掃全專案同類反模式，順手升級成 PRINCIPLE。

## 2026-07-24 觀光 tourism 12 層（多 agent 編排 + 平行 session 事故）

### What went well
- **規格書先行**：orchestrator 把 12 層 key/sourceId/參數名/hex/特殊行為全釘死成單一 SSOT 再切 3 包平行 → 零撞檔、接縫全對齊；骨架包 agent 還自主查上游真實 catalog dataset_id 取代規格書猜測值，讓 upstreamRegistry ratchet 是真驗證非僥倖
- **browser 驗收價值再確認**：tsc + 197 tests 全綠仍漏 Infinity 整檔炸（資料層 bug 只有真 fetch 才炸）——「逐層 queryRenderedFeatures > 0」不可省
- **PR 純淨手術**：本地 branch 被平行 session 污染時，scratch worktree 組乾淨血統 + push sha 開 PR，全程不動主 worktree

### Next-time rules
1. **資料驗收加一步 node strict-JSON parse**：jq/Python 驗過 ≠ 瀏覽器能吃；grep `:Infinity\|:NaN` 三秒完事（→ 已入 PRINCIPLES）
2. **開工 git status 見非預期 WIP**：先判「另一 session 進行中」再定 stash 策略；branch 手術走 scratch worktree + push sha（→ 已入 PRINCIPLES）
3. **多 agent 平行時 tsc gate 放包級不放全量**：平行中全量必互紅，prompt 明寫「錯誤不指向你的檔即可」，避免 agent 空轉修別人的紅字（→ 已入 PB-29）

---

## 2026-07-26/27 — orchestrator 模式全日戰（3 PR + 4 migration + collector 重寫 + 沙盒 Artifact）

### 亮點
- **主 agent 驗收層的價值**（本日三次抓漏全靠親看截圖/實查，agent 自驗都「通過」）：堆疊模式漏 flexShrink:0（13 cell 被壓成細條，agent 驗了 DOM 順序卻沒看出視覺穿幫）；14 天圖 42 個「0:00」tick 疊字牆（tick 邏輯只設計到 8h 步距，agent 回報寫「密集顯示」一詞露餡）；三立 fallback 候選 oembed 一查是會下播的單場直播
- **用戶質疑觸發查證**：「10,000 免費額度有上網驗證過嗎」→ 官方文件實查發現 YouTube quota 已改制（search 獨立 100 calls/day 桶），即時 SendMessage 修正實作中 agent 的數學
- **對照實驗勝過猜測**：TVBS 嵌入失敗先猜網域白名單 → 四格並排 embed 實驗證明是 channel= 路徑問題；agent 還自己識破 player API curl 檢查法對任何影片（含 jNQXAC9IVRw）都失敗、整段證據作廢——負面證據的自我審查是好樣板
- **診斷先於動手**全日貫徹：五次「先派唯讀調查、拿證據再決策」（monitor 結構/git 考古/401 根因/RLS 掃描/嵌入實驗），沒有一次白工

### Next-time rules
1. **agent 回報裡的異常描述詞要追**（「密集顯示」「意外插曲」）——自驗通過 ≠ 視覺正確，截圖必親看
2. **登入態 bug 第一反應想「兩種身分的權限路徑差異」**：anon vs authenticated 的 GRANT/RLS 靜默分歧，SET ROLE 實測最快（→ 已入 PRINCIPLES）
3. **寫死外部資源 ID 前先 oembed 驗身分**（常設直播 vs 單場），三秒避免殭屍（→ 已入 INCIDENTS C）

## 2026-07-29/31 溫度三部曲（三圖層 + LST 衛星 pipeline 全鏈）

### What went well
- **探索先行省掉整條移植**：weather_change 兩個 agent 平行偵察發現其溫度資料源頭 = pulse 既有 `get_temperature_*` RPC → 「移植」縮成「只搬色階與呈現方式」；同一輪偵察順帶挖出 EPA IoT 端點復活（→ MC-1）與 .env 金鑰問題（→ G016）——好的偵察 prompt 產出遠超任務本身
- **雙層驗收第三次立功**：mix 係數 bug 通過了實作 agent 的原始碼推導 + 主 agent code review + tsc/197 tests，只有瀏覽器像素取樣攔下（前兩次：Infinity JSON、tourism 0 點）
- **對照組思維**：canopy（working 範本）被 agent 推導宣判「也是壞的」，瀏覽器一驗反殺——一個在 production 正常運作的範本，證據力高於任何原始碼推導
- **方法論落地成教學文件**：LST 全鏈寫成可遷移方法論（STAC→位元遮罩→分位數門檻→多年 median→相對正規化→值編碼），用戶點名要學；上線後的「坑洞為什麼」問答直接回收成 §8a FAQ——被問的問題就是文件的缺口
- **agent 有憑據的偏離值得鼓勵**：A2a 自主換傳輸方式（實測四種吞吐）、放寬 ST_QA（附分布統計）、加景級守門（接邊差 11.45K→0.79K）都對；反例是 A2b 的 mix 推導——差別在**有沒有拿實測當證據**

### Next-time rules
1. **agent 引原始碼推翻既有慣例時，先實測既有慣例再採用**——尤其結論會連帶宣判 working code 也是壞的時（→ 已入 PRINCIPLES）
2. **raster/shader 類驗收必含像素取樣**：多點 RGB 彼此相異才算有漸層，「看起來有顏色」不夠（→ 已入 PRINCIPLES + PB-31）
3. **stacked PR 由底往上快速 merge、勿讓 base 先被刪**；發現 PR 莫名 CLOSED 先查 base branch 存亡（→ 已入 PRINCIPLES）

## 2026-07-29/30 人均市值（#95）— 部署時序與平台事實

### What went well
- 上下游平行派工（upstream pipeline / 前端模式）+ 契約先行（pop 欄定義、灰格門檻），兩 agent 零等待各自完成；圖例斷點用上游實算分位數回填，只改一個陣列
- 瀏覽器驗收 9/9 含 popup 手算對帳（v_mkt÷pop 逐格核）與 150m disabled 回退

### Next-time rules
1. **換磚流程固定「先 S3 上傳完成、後 merge/deploy」**：這次 merge 先行，容器啟動 pull 比上傳完成早 21 分鐘，白繞 empty commit + 輪詢 35 分鐘（→ 已入 PB 部署段 + INCIDENTS）
2. **排查部署先查平台事實再輪詢**：`zeabur deployment list` 一分鐘就能證實「empty commit 沒觸發 build」，比 15 分鐘盲輪詢便宜得多
3. **stacked PR 要收時先 `gh pr edit <child> --base master` 再 merge+刪 parent branch**——事後 base 被刪的 CLOSED PR 無法重開、也無法改 base，只能重發（#93→#94 的可操作版）

## 2026-07-29~31 地震回放（planning → 3 repo merged）

### What went well
- **開工前三查全部有回報**：DB 實查（查出 34≠32 起、115053 新事件暴露 town 1 秒漂移 →
  改寫 RPC 設計）、PMTiles join 鍵驗證（TOWNCODE 7↔8 碼轉換規則 368/368 逐筆驗證後才進工單）、
  collector 查證（「自動累積」拿到實證與邊界）——三個都是不查就會變 bug 的
- **契約先鎖再派工**：RPC signature、轉換規則、檔案結構、五步編排全寫進 opus 工單，
  核心一次到位且 5 條偏離決策全數合理（external clock store / 浮動面板 / popup 拆型）——
  工單給足脈絡，agent 才做得出「對的偏離」
- **AskUserQuestion 四題一次拍板**（分層回放/RPC 時機/查上游/圖層歸屬），零來回猜測

### Next-time rules
1. **handoff「現況」段落開工前必實查**——資料每 15 分鐘在動，兩天前的快照已過期；
   而且新進的資料往往就是最好的測試案例（115053 一筆就暴露等值 join 缺陷）
2. **跨表無 FK 時，join 智慧放 DB 端一次做完（resolved key），不讓每個前端消費者
   自己重算時間窗**（→ 已入 PRINCIPLES）
3. **同 repo 多 agent 按共用檔分波**：popup 補洞與回放核心都動 types/registry/
   useMapInteraction → 串行發（等前者落地）；真獨立檔（beachball 純模組）才平行

## 2026-08-01/02 共機資料 + 航跡圖向量化

### What went well
- **查證推翻假設三次都靠實測**：turnover 不是金額（對官方 FMTQIK 逐日核）、通報分兩個時代
  （實際打開舊頁面才發現 maincontent 空的）、走廊不都是矩形（把原圖擺出來對比才看見）。
  每次都是「先看真實資料」而非沿用盤點時的描述
- **守門真的擋下東西**：向量化在跨度誤差 >6% 時報錯而非輸出偏移座標（7-30 被攔）、
  中英交叉驗證 185 份零不符、表格項次守門攔下 65 天。設了門檻就要讓它有權否決
- **subagent 讀圖走訂閱額度**：185 天圖片版通報用 8 個 agent 抄字，主 context 不受影響，
  且數值仍由既有解析器產生（LLM 只抄不算）

### Next-time rules
1. **自創品質指標前，先找資料自帶的答案**。這次連錯兩個幾何指標（填充率、內縮空心度）
   才發現圖左上角表格就寫著項次數。我一直想用幾何「定義什麼是對的」，卻沒問
   「這份資料有沒有自己聲明過答案」（→ 已入 PRINCIPLES）
2. **拿到 ground truth 也要驗證它的定義範圍**。表格「項次」不全是封閉多邊形
   （空飄氣球是虛線），照單全收會把正確結果誤判為失敗、通過率被低估
3. **改了解析邏輯 = 改了資料契約，回填與部署必須同時排程**。這次回填完成但線上
   collector 還是舊版，每 30 分鐘覆蓋回去 —— 成果實質為零，直到部署（→ INCIDENTS 事件 A）
4. **承諾的門檻要真的執行**。事前說「低於 85% 就停下來回報而不是硬跑完」，
   實際 69.9% 時確實停了並回報根因 —— 這條要維持，不可因為投入多就放水交付
5. **並排對比是最有效的除錯工具**。把原圖與抽取結果擺在一起，立刻看出編號標記被算進走廊、
   以及「形狀不只矩形」；先前只看數字指標繞了三輪都沒發現

## 2026-08-03 共機圖層 → 戰情板（接手 handoff → 四 repo 全 merged）

一個 session 走完「接手別人的 handoff → 止血 → 補品質 → 前端上線 → 擴充 → 收尾」全鏈。
上一個 session 留的 handoff 品質很高（三份必讀 + 環境陷阱清單），開工幾乎沒有摸索期 ——
這是 handoff 值得投資的證據。

### Next-time rules

1. **驗證「某個修復是否生效」，要挑不會被同一批寫入影響的欄位。**
   這次差點被 `updated_at` 騙（值改了、時間戳沒改，因為它只在 INSERT 寫）。
   時間戳只證明「有人寫過」，不證明「誰寫的」。要找**只有新版才產生的內容特徵**
   （→ INCIDENTS 事件 A）

2. **已寫成 pitfall 文件的坑，若沒有守門，還是會再踩。**
   Supavisor `SET ROLE` 毒連線池 2026-07-24 就寫過檔，這次換個入口（psql 驗 anon）
   又踩一次。文件只在「想起來要查」時有用。**下次寫 pitfall 時要一併問：
   這個能不能做成腳本守門 / lint / wrapper？** 不能的話至少把正確寫法直接寫進
   PRINCIPLES 的常用指令段，而不是只躺在 pitfalls/

3. **視覺的疊加、累積類問題，先算數學再寫程式。**
   alpha 疊加是 `1-(1-a)^n`，估一下「熱區疊幾層」30 秒就知道 0.22 會爆。
   我卻是做完 120 天疊圖、截圖看到整塊糊掉才回頭修（→ PRINCIPLES）

4. **兩處程式碼互相「讓位」時，讓位條件要寫在兩邊。**
   `useRealEstateTimeline` 只有一邊寫了讓位邏輯，另一邊無條件搶走播放控制 →
   整個歷史模式的 ▶ 壞了很久沒人發現。接新功能時順手驗證相鄰功能是值得的
   （這次是因為要用歷史模式的播放才撞出來）

5. **用戶說「先不改」時，把成因寫進 backlog 再收手。**
   PA-8 記下了「哪兩項可修、哪兩項**不該**修」——
   後者（括號省略數字、整句沒提共艦）留 NULL 才對，若只記「有 bug 待修」，
   下次接手的人很可能把不該猜的欄位猜出一個數字填進去

### 這次做對的

- 嚴重度門檻**用實測分布挑**（比較 4 種共振門檻的「顯著」天數）而不是拍腦袋，
  且把比較過程寫進 migration 註解與 PR，之後要調有依據
- 機型資料的限制**主動降級揭露**：多機型項次拆不開 → 主指標改用「出現天數」，
  架次加 `*` 註記。沒有為了畫面好看硬算一個假總數
- 用戶只問「規劃」時就真的只給規劃（proposal 文件 + 四項待拍板），沒有先斬後奏

## 2026-08-05/06 殯葬圖層 → 跨 repo 分支整合 → 收孤兒 repo

> 2026-08-10 補記：本段原寫在孤兒分支 `memory/wrap-up-funeral-integration` 上未合回，事後增量搬入。

### 這次做對的

- **接線前先掃守門機制**：動工前先讀 `layerConsistency` / `deployContract` /
  `mapInteractionLayers` 三支 ratchet 的判準，才知道「新 layer 要碰哪些接觸點」。
  結果是一次 tsc 綠、316 tests 一次過，沒有來回補漏
- **上游文件與實際產物對不上時，以產物為準並回報**：facility_type 分佈、`eco_type` 值域、
  `amenity`/`landuse` 欄位對調三處不一致，UI 用實測值、同時把差異寫回上游 handoff。
  沒有默默改也沒有照文件寫錯
- **`is_active` 同步時不只換檔案**：一併改 9 處寫死數字 + 3 份文件 + 把
  「規則變動」補進 handoff 觸發點表。只換檔案會留下更難發現的錯（畫面正常但數字錯）
- **收 `tw-address-geocoder` 先給清單再 commit**：先 `git add` → 列出 35 檔 109 KB →
  確認無 >1MB 漏網 → 才 commit。避免 93 MB 產物永久進 git 歷史
- **公開/私人的建議有依據不是憑感覺**：實際掃憑證（乾淨）、查資料粒度（26/100 含樓層戶別）、
  追血緣（實價登錄 → TGOS）。且明講「TGOS 重散布條款我無法從這裡確認」而不是替用戶猜

### 下次要改的

1. **盤點結論會在盤點期間腐敗** —— 我做完 40+ repo 掃描、正在寫報告時，用戶已經
   merge 了 #108 並切分支；我照舊清單講「feat/embed-cache-rules 待收」時它已經不存在。
   → **報告前重抓一次關鍵狀態**，尤其是「用戶可能正在動」的那幾個 repo。
   長時間掃描的產物要標「快照時間」，不要當成當下事實

2. **量測工具本身會騙人，要先驗證量測** —— 用 Resource Timing 撈不到 supabase 請求就
   推論「RPC 沒發出」，實際是 buffer 卡在 250 上限。**當證據是「沒有」時要特別警覺**：
   先確認量測手段有沒有能力看見它（`entries.length` 剛好 = 250 就是紅旗）

3. **術語誤讀要當場查而不是沿用** —— 把「零 commit 的 repo」講成 detached HEAD，
   因為掃描腳本在無 commit 時 `git rev-parse --abbrev-ref HEAD` 回傳字串 `HEAD`。
   兩者風險輪廓不同（前者是「還沒開始版控」，後者是「commit 沒掛在分支上」）。
   → 腳本輸出的邊界值要另外判定，不要直接當語意用

4. **規則檔加註解前先確認格式支不支援行內註解** —— `.gitignore` 不支援，
   我寫的白名單靜默失效。`git check-ignore -v` 一秒就看得出來，但我是在
   「檔案怎麼沒進 staged 清單」才回頭查。**寫完規則檔就順手驗一次**成本極低

5. **動態圖層「看起來壞掉」先查資料日期** —— 共機空白，我從 layer id、
   visibility effect、promoteId 一路查到 hook 內部，最後發現是**上游向量化批次停了 5 天**
   （⚠️ 我當下判成「collector 停擺」是錯的，collector 一路正常 —— 詳 INCIDENTS 事件 E）。
   → 排查順序應該是「資料有沒有 → 請求有沒有發 → 圖層有沒有建 → 樣式對不對」，
   我這次是倒著查的，多花了好幾輪

### 對工具/流程的觀察

- `agent-browser` 在這個站的三個坑（WebGL launch args、daemon 卡舊分頁、
  daemon 重啟丟 args）本 session **三個都踩到**，且全域 memory 早有記錄。
  這次多學到一招：**用 `curl` 撈 `<title>` 對照**，就能判斷「是 dev server 換了專案」
  還是「瀏覽器分頁跑掉」—— 兩者症狀相同但解法完全不同

## 2026-08-07 — 一天內三個斷供 + 自己造成 CI 紅

### 下次要改的

1. **跨 repo 工作時，測試要在「改動所在的 repo」跑。**
   我改了 data-collectors 卻只跑 pulse 的 vitest，結果連續兩個 PR 讓 main CI 紅
   （而且 main 從 2026-08-03 起就已經紅了，我完全沒注意到）。
   merge 前的檢查清單應該是「這次動了哪幾個 repo」→ 逐個跑它們的測試，
   而不是「跑我最熟的那個」。順手看一眼 `gh run list --branch main` 也能早點發現。

2. **驗證環境的限制要早點測，不要驗到一半才發現。**
   花了好幾輪用 agent-browser 追「為什麼圖層沒資料」，最後才發現
   **headless/headed 都沒有外網**（250 個 request 全是 localhost）。
   如果一開始就先 `fetch('https://api.mapbox.com/')` 探一下，可以省掉整段誤判
   （中間還一度懷疑是自己改壞了 hook）。**用陌生工具驗收前，先測它的能力邊界。**

3. **手打測試網址容易誤判成 bug。**
   `?layers=lightning` 沒生效讓我以為 deep-link 壞了，追下去才發現
   `parseUrlState` 有**版本閘門**（缺 `v=1` 整組不採用），是刻意設計，
   ShareModal 產生的連結都會帶。→ 驗收「分享連結」類功能時，
   **用產品真正產生的 URL**，不要自己拼一個。

4. **降頻這種「省資源」的改動，要先問「它原本在保護什麼」。**
   台電落雷降到 30 分鐘看起來很划算（反正是空的），差點就只改 interval 收工。
   但那個端點是 1 分鐘整檔覆寫 —— 恢復後會漏 29/30。
   同一類錯誤在共機配準也出現過（批次的中位數不只是省事，是正確性保護）。
   **「這個看起來多餘的東西為什麼存在」值得先問一次。**

### 這次做對的

- **不接受「大概是沒閃電」這種解釋**。三條獨立證據（archive 大小轉折、10 分鐘監看全 0、
  同期 CWA 179 筆閃電 + 9 則雷雨特報）才定罪，而不是看了空檔就下結論
- **實跑才抓得到的兩個 bug**：`get_storage()` 永遠回 LocalStorage（S3 備份根本沒執行）、
  沒註冊 transformer 時 `write()` **靜默 return 不寫也不報錯**。
  這兩個純看程式碼審不出來 —— 「跑一次真的寫進 DB 再查一次」是必要步驟
- **驗證邊界主動講清楚**：headless 無外網導致點位渲染沒驗到，我在 PR 和回報裡都寫明
  「這段沒驗到，要線上確認」，而不是模糊帶過說「驗證通過」
- **反例也測**：恢復告警不只測「斷供中會觸發」，也插一筆假資料測「一般雷雨不誤報」，
  測完刪除並確認殘留 0。誤報的告警比沒有告警更糟

## 2026-08-06~09 — EM-16 翻案：從「Three.js 圖層不做」到三層回放上線

### 下次要改的

1. **自己寫的結論會過期；翻案要靠逐檔實測，不是重讀文件。**
   `docs/proposal/embed-dynamic-layers.md` §6-1 白紙黑字寫「Three.js 圖層不做」，
   而正確做法是把那份結論當**假設**重驗一次：實測後發現三顆引擎（171/314/741 行）
   全是純 TS 零渲染依賴、渲染層對 mapbox 的**執行期**綁定只有 `coordinates.ts` 一支
   （`customLayer.ts` 是 type-only import）。
   → 決策文件要記「當時看到什麼」而不只是「結論是什麼」，否則沒人知道該重驗哪一條。

2. **「成本高」是三個不同的軸，要分開驗。**
   原結論其實混了三件事：bundle 會變大 / 開發量大 / 風險高。拆開後才發現
   bundle 可用 dynamic import 隔離（可驗，grep 次數 = 0）、開發量因為引擎純 TS 而小、
   風險集中在單一未知（MapLibre × Three.js 的矩陣）→ 一個 spike 就能歸零。
   **一句「成本高」擋下的東西，值得問「哪一種成本」。**

3. **未知風險先做最小 spike，不要先做架構決策。**
   MapLibre × Three.js 那個 spike 只跑數值比對（與 `map.project()` 誤差 ≤0.01px，
   z7–z10 × pitch × bearing × altitude 80km 全過），一次就把整個技術路線的問號拿掉，
   還順便逼出 `mainMatrix` 那個**靜默**投到 −54,000px 的坑（不報錯，只做視覺驗收會誤判成
   「圖層沒生效」而往完全錯的方向查）。2D setData 的退路備著但從沒動用。

4. **平行 session 佔用工作區時，開 worktree 不要搶 branch。**
   我的檔案被另一個 session 切走時第一反應是「怎麼不見了」。
   正解是 `git worktree add`（要補 `node_modules` / `.env` / `public/base_map/*.pmtiles`
   三個 symlink 才跑得起來）。這是同一條紀律第二次派上用場，但**第一次是被動遇上** ——
   下次共用工作區開工前先 `git status` 看一眼有沒有別人的未提交改動，比出事後再處理便宜。

5. **retention 讓「之後再做」有真實代價，該先算再排期。**
   owner 拍板 bus 渲染暫緩是合理的產品決策，但如果沒同時啟動 nightly 匯出，
   「暫緩」就等於**每天永久丟一天資料**（bus 只有 3 天窗）。
   → 遇到「這個之後再做」，先問一句「等的期間會不會有東西正在消失」。
   這次仍慢了一步：bus/bus_intercity 08-04、ships/flights 07-30 已經救不回來。

### 這次做對的

- **量化「無損」用行為驗證而非眼睛**：座標量化 5 位不是看數字像不像，
  而是驗「量化前後 `filterGpsAnomalies` 保留／丟棄數完全相同」——
  用下游消費者的行為當判準
- **簡化幾何用雙幾何跑同一顆引擎逐車比對**（2,975 次：p50 1.66m / p95 7.31m / max 20.80m），
  並訂出可當 gate 的驗收線（p95<30 / max<100）。這讓「max 245.4m」這種問題**在合併前**
  被抓到，而不是上線後有人說「列車怎麼在田裡」
- **不憑空發明語意**：FlightScene 是 `idx % colors` 輪替配色 → 圖例就只給單條。
  很容易為了畫面豐富而編一組分類出來，那是騙人
- **把「不會發生的事」變成會紅的檢查**：`grep -c WebGLRenderer dist/assets/embed-*.js` = 0。
  零請求這個前提太容易被一個 import 打破，靠記得守不住
- **順手發現的既有問題照實記、不順手修**：EM-17（`static-rpc` 缺檔 → 主站靜默 fallback
  打 RPC，現在就在付 egress）不在本次範圍，寫進 backlog 而不是塞進這個 PR

## 2026-08-10 — 監看模式排版八/九版（PR #121）

### 下次要改的

1. **我的驗收只覆蓋了一種失敗模式，而 bug 出在相反的那一種。**
   整輪我都在量 `scrollHeight` vs `clientHeight`（內容有沒有溢出格子），
   量得很勤、數字很漂亮 —— 但九版真正壞掉的是**內容塌成 0**（120 根柱子全高度 0，
   圖區變全白），這個失敗模式下兩個數字完全正常。是用戶截圖回報才發現的。
   → 設計驗收指標時要先問「這個指標的**反面**是什麼，我有沒有量」。
   一個只往單邊看的檢查，會給出「全部通過」的假安心。

2. **截圖沒拍到目標區塊，就不能算「截圖驗證過」。**
   改完 fit 之後我截了圖，但那張只拍到 PLA 板的標題與 SEVERITY，
   柱狀圖在畫面外 —— 我卻把它當成「視覺確認過」。
   → 截圖驗收要**指名要看的那個東西**，並在截圖後確認它真的在畫面裡；
   必要時先 `scrollIntoView` 再拍。這條和「量測要量對象」是同一件事的兩面。

3. **`tail -4` 把測試失敗訊息丟掉了。**
   一次 `1 failed | 440 passed`，我只留了結尾四行，根因永遠查不到了；
   重跑三輪全綠只能證明「不穩定」，不能證明「沒問題」。
   → 測試輸出一律完整保留再判讀。這次已誠實寫成未結案（INCIDENTS 事件 D），
   但成本是下次再遇到得從零開始。

4. **「SSOT 不在版控裡」不是風險，是必然。**
   排版沙盒是決定版面的工具，卻只活在 artifact 上 —— 兩個版本的漂移沒有任何人發現，
   因為兩邊從來沒被放在一起比過。落進 repo 之後我才寫了逐格比對腳本，
   一跑就抓到差異。
   → 遇到「這份東西是 SSOT」的宣稱，先問兩件事：它在版控裡嗎？有沒有一個會紅的比對？
   兩者缺一，那句宣稱就只是願望。

### 這次做對的

- **h 值全部開實機量，不照行高估**。因為圖表改成「吃剩餘高度」之後，
  格高與內部佈局互相決定，紙上算必錯。量完才發現 `plaBoard` 應該從 h15 **降到 h13**
  （原本有大量死白）—— 這個方向和直覺相反，估的話一定估錯。
- **架構改動前先問「哪些 widget 不該套」**。第一版分界線把直播牆／災防歸在固定高，
  用戶指出這兩個也要跟內容走 —— 因為分界線是**一個欄位**的事（`fit?: "content"`），
  改起來只有兩行。把政策做成資料而不是寫死在渲染邏輯裡，讓「問了才知道」的成本降到最低。
- **拆解器留了退路並寫測試守住**。guillotine 切不開的形狀（風車形互卡）退回固定列高網格，
  測試同時餵真實佈局與人造互卡佈局 —— 失敗模式是「那一小塊退化」而不是「widget 消失」。
- **不擴大戰線**：`erCongestion` 格內捲 423px 在八版就發現了，當時照實記進 README
  「已知取捨」並向用戶說明選項，沒有自己決定把 h 拉到 24。九版的機制改動剛好把它解掉，
  這時才回頭 close 那個懸而未決的問題。

## 2026-08-10 — 結構稽核 → 8 批執行 wave（7 PR 一日全 merged）

- **「稽核員的報告」和「事實」是兩回事**：本日兩個 agent 前提錯誤（schools.geojson 追蹤狀態、
  monitor 分支疊層）都不是 agent 亂講——是它們引用了「上一手稽核」的結論沒重驗。
  主 agent 對 top 發現逐一 spot-check 的成本 ≈ 7 條指令，擋下的是一次部署炸裂＋一次真丟 commit。
  驗收不是重做，是**抽最貴的那幾條重做**。
- **稽核最有價值的產出不是抓錯，是「正面判定」**：overlayRegistry 9.2k 行、三 registry、
  LegendPanel 全部判「不是債」，這讓後續執行 wave 敢完全不碰它們——省下的工比修掉的債大。
- **advisor 在派工前的兩次介入都值回票價**：按證據型態重切稽核維度（避免兩 agent 互踩）、
  預先點名 stacked-branch squash-merge 陷阱（後來真的需要 rebase --onto）。
- **API 不穩的日子，把 durability 下放**：agent 斷三次全靠原 context 續跑復原，
  但真正的保險是「每階段先 commit」——第二次斷線後才想到補這條指示，應該一開始就寫進 prompt 模板。
- **下次改進**：(1) worktree agent 的 prompt 模板應內建 PB-37 三鐵則，不要每次手寫；
  (2) 稽核報告的「處置建議」欄應標注「已現場驗證/僅靜態推斷」，讓執行 agent 知道哪些前提要重驗。

## 2026-08-11/12 — Layer Manifest 過夜工程（14 棒，AR-22/23/24 一次交付）

- **陷阱庫接力是這次成功的真正引擎**：每棒把判準與踩雷寫進 changelog，後棒必讀——
  批 3 的 spread 陷阱、批 4 的 popup 判準雙向反例、P3-2A 的 fall-through，
  全都只被踩一次。多 agent 接力的知識不留在 agent 裡，留在檔案裡。
- **「全綠」與「無恙」是兩回事**：本次三個真問題（fall-through／hook return 盲區／
  ref 初始化）全是突變演練挖出來的，沒有一個會讓既有測試變紅。
  護欄的價值要用「它會不會叫」證明，不是用「它現在綠著」證明。
- **agent 的誠實違抗值得制度化**：P4 拒打 4b 假勾勾、⑤ agent 判定「今天禁止 apply」、
  批 2 修正拍板①判準——三次都對。給 agent 的指令該留「發現前提錯誤時停下回報」的出口。
- **冤案的成本**：快照盲區立案到翻案花了一整棒。若第一時間先查「master 有沒有平行 commit」
  （git log 對向 + commit message），十分鐘可結案。
- **下次改進**：(1) 跨 session 共用 repo 時，開工先 `git log origin/master..master` 盤點
  對向未推 commits；(2) 中斷頻繁的日子，把「每子階段 commit」直接寫進 agent prompt 模板
  （這次第二次斷線後才補）。

## 2026-08-12 晚場 — 收尾棒（三線並行，backlog 未竟全清）

- **白話版是拍板的必要條件不是加值**：三個技術決策（4b 改案／等值閘退役／audit 退役）
  用工程語言問，owner 三題全答「聽不懂」；換成生活比喻＋「做了什麼會發生什麼」重講，
  三票全過且秒回。→ 給 owner 的選擇題**先寫白話版**，工程細節放後面備查。
- **偵察先行把等待點壓成一次**：4 個 sonnet 偵察平行跑完才開拍板會，所有需要 owner
  的決策一次問掉——對比逐項邊做邊問，省了至少 3 個來回等待。
- **cache-buster probe 實戰有效**：驗 prod 部署時帶 `?probe=<ts>` 唯一參數，繞過
  Cloudflare 快取直打 origin，同時避免把 404 烙進 CDN（PRINCIPLES 舊教訓的正確用法）。
  順帶學到：206（range request 命中）與 200 等價視為存在。
- **「缺口」不等於「線上壞掉」**：5 個部署缺口裡 3 個（hillshade／power_poles／
  integrated）線上其實活著——手動 S3 副本在服務。稽核結論要區分「管線不保證」與
  「現在是斷的」，否則會誤判急迫度。
- **下次改進**：(1) 派長跑 agent 的任務書開頭就寫「每完成一子項先 commit」（這次
  Track A 有做但靠的是它自律，該制度化進 prompt 模板）；(2) vitest 偶發 flake（MG-3）
  出現時**當場把輸出存檔**再重跑——這次順手重跑就丟了證據，flake 又多活一天。

## 2026-08-13 社福長照 9 層接線（純接線棒，第 40 主題）

### What worked ✅

- **先盤資料再寫程式**：動手前用一支 python 把 9 檔的每欄出現次數／型別／列舉分佈
  ／數值欄 0 值比例全印出來，當場抓到三件 handoff 沒明講、且**壞掉不會報錯**的事：
  床數是字串、空值 key 整個消失、`beds_nh` 有 989/1,499 是 0（因為居家護理所本來沒床）。
  這三件如果等瀏覽器發現，泡泡圖已經畫錯一輪了。**盤資料的 30 分鐘是本場 CP 值最高的投資**。
- **找同構家族照抄**：`grep -rl funeral src/` 一次列出 23 個觸點檔，殯葬 5 層的結構
  （precision 篩選＋同構 legend＋registry 通用路徑）幾乎可以 1:1 對應到社福 9 層。
  沒有重新發明任何東西。
- **advisor 在「我以為做完了」時抓到唯一的實質漏洞**（見下）。這是本場最值錢的一次呼叫，
  時機正好在我準備寫收尾報告之前。

### What didn't ❌

- **驗證路徑挑了最方便的那條，正好繞過唯一沒護欄的鐵則**。全程用深連結
  `?v=1&layers=…` 開圖層（理由正當：sidebar DOM 互動在本站一向不穩），
  於是**從頭到尾沒開過 Layers 側欄**。四鐵則 #2 有測試擋、#1/#3 由 manifest 派生守，
  **只有 #4（控件不溢出）純靠人眼** —— 結果它真的沒過（3 選項 button row 中文 label
  三顆全折行）。教訓不是「深連結不好」，是**「哪一條規則沒有機械護欄，就必須為它
  單獨設計一段人工驗證」**，不能指望順手撞到。
- **UX baseline 表是最後才翻的**。半徑/透明度先憑感覺調，跑 `layer-onboarding` 才發現
  9 層有 4 層偏離 Step 3 的表定值。這些數字表存在的意義就是不用猜——**應該在寫
  overlayRegistry entry 的當下就打開來對**，而不是驗收時回頭改（還要重生一次黃金快照）。
- **交接文件的「接線五處」照做會漏一半**。上游 handoff 寫 overlayRegistry/toggle/
  opacity/Z-order/scale 五處，實際是 `development-rules` §4 的 20 觸點、13 個檔。
  上游沒錯（那是舊版摘要），但**下游 SOP 才是下游的權威**——以後看到跨 repo 文件寫
  下游步驟，一律回頭查本 repo 的規則檔對照。

### Next-time rules

1. **接線類任務開場先問「這批規則裡哪幾條沒有測試守門」**，把那幾條列成獨立的
   人工驗證清單，不要混在「順便看一下」裡。
2. **有數字表（UX baseline / 級距 / 閾值）的地方，寫程式時就開著對**，不要事後校正——
   事後改會連帶重生快照、重跑測試，成本是當下的好幾倍。
3. **worktree 建好第一件事 `cp .env`**（本場為此白屏一輪，錯誤訊息完全指不到根因）。
4. **上游 repo 有平行 session 的未提交改動時，`git add` 只列自己碰過的路徑**——
   本場 analytics 那端 15 個改動檔裡有 3 個不是我的，逐一列出才沒把它們掃進 commit。

### Memory 產出

DATA_SCOPE（+社福長照節）／PRINCIPLES（+5 條：除零守門・字串數值與消失的 key・
0 值比例判準・button row label ≤4 字・上游建議 vs 站台鐵則）／INCIDENTS（+2 事件）／
PLAYBOOKS（+PB-40 純接線棒）／GLOSSARY（+3 詞）／BACKLOG（+welfare 指標）／本篇／STATUS。

## 2026-08-18/19 — Business Registry r2 + wrap-up v2

### Worked

- **先定 contract 再產 immutable r2 assets**：公司 detail/overview、三尺度資本額網格、共同地址聚合、工廠 detail/overview 與工業層都能以 exact filename、source-layer、zoom range、public fields 驗收，沒有覆寫 r1。
- **大量點位拆 overview + detail**：低 zoom 仍看得到全部 resolved companies/factories 的空間分布，高 zoom 才載 feature detail；既符合使用者「拉遠也看得到」的需求，也避免低 zoom 直接渲染 65 萬/9 萬點。
- **upload 與 readback 分開留證據**：12 個 artifacts 不只上傳，還對 object size/checksum/metadata readback；release matrix 因此能精確寫到 readback done，而不是模糊的「應該有上」。
- **publication whitelist 先於前端 convenience**：公司名稱可公開，但統編、代表人、完整地址不進 detail；B4 只保留四個聚合欄位，immutable building key 與 member list 留在 private QA。
- **把使用者調整轉成可測 contract**：公司/工廠 zoom split、B2 三尺度、B4 threshold 5–800 與 capital sum 都有 artifact/contract/test 對應，不只留在口頭需求。

### Didn't work / drift

- **「已 upload」太容易被誤說成「已上線」**：production pull、deploy、HTTP、browser 都尚未做；若沒有逐欄 release matrix，S3 object readback 會遮蔽正式站仍 blocked 的事實。
- **PR #142 只 merge r1，後續 r2 又留在同一 topic branch**：Pulse 產生 5 個 post-merge commits，Analytics branch 又無 upstream 且相對 origin/master ahead 28；release unit 與 branch unit 沒有及早切齊。
- **舊 wrap-up 假設已失效**：固定讀完整檔數、固定 stage 流程、預設 base/master、要求整樹 clean，遇到多 repo、多 release stage、平行 session 就會誤判或誤收檔。
- **Analytics A2/A5 handoff drift**：Pulse r2 contract 已更新 coverage 與語意邊界，但 Analytics 對應 handoff 尚待 targeted sync，不能放任兩個 canonical docs 各說各話。
- **browser 驗證 blocked**：目前只有 build/test/object evidence；正式站 presentation、popup、legend、dark-map 可讀性尚未有 production browser evidence。

### Next-time rules

1. 第一個 artifact 產生時就建立 release matrix，逐列記 `build / contract-wire / stage / upload / readback / pull / deploy / HTTP / browser`；`unknown` 只限證據不足、`blocked` 表示已知卡點、`not run` 表示尚未執行，另保留 `done / failed / N/A`，不跨欄推論。
2. 沒有 production HTTP 與 browser evidence，不使用「已上線」「production ready at runtime」；本機 E2E、S3 readback、CI 各自只證明對應階段。
3. 只要點位量級可能影響低 zoom，從設計第一天就決定 overview/detail 雙 source、互斥 zoom、resolved denominator 與 privacy fields，不等前端卡住才補。
4. branch 應對齊 review/release unit：已 merge 的 branch 不繼續堆下一版；跨 repo 先記 base、upstream、commit range，再開 follow-up branch。
5. wrap-up 先讀 `memory/README.md` routing，選中的檔完整讀；先 Draft、使用者 Confirm 後才寫與 exact-path atomic commit，不自動 push。
6. commit 前記錄 cached path set；closeout 只要求 target paths clean並列出保留的 unrelated staged/dirty。若同一 target file 混有平行 hunks，停止協調，不得整檔代 commit。

### Memory output

STATUS（2026-08-19 current truth＋4-row release matrix）／BACKLOG（BR/WU blockers-next-acceptance）／
DATA_SCOPE（12 assets＋coverage＋privacy boundary）／PRINCIPLES（wrap-up v2、overview/detail、publication whitelist）／本篇。

---

## 2026-08-19 — Business Registry＋世界通訊跨 worktree 整合

### Worked

- **用隔離 integration worktree 做雙 repo merge**：原本的 Business Registry、telecom 與其他既有 worktree 都不改寫；兩邊都用 merge commit 保留原子歷史，再由 PR 合進 `master`。
- **三個 golden/contract conflict 採 union 解法**：Business Registry 與 telecom 都新增 layer contract，衝突不是二選一；合併 key、補齊兩邊欄位後重新產生 golden，最後固定為 373 keys。
- **讓 clean-checkout CI 當第四層證據**：本地 637 tests 與 TypeScript 皆綠，但 CI 仍抓到被 global gitignore 排除的 B3 r2 JSON；force-add canonical artifact 後，run #355 才真正成功。
- **把授權限制保留成缺席圖層**：PeeringDB／CAIDA 沒因為「世界圖想多一點」就硬塞進 public assets；permission-required 仍是明確 release gate。

### Didn't work / drift

- **把「同名 branch 曾有 PR merged」誤當成「較新的本機 commits 已在 master」**：PR #142 只包含遠端 `b64a5ac`，本機同名 branch 後續仍 ahead 14。branch 名稱、commit message 或既有 PR 連結都不能證明最新 local head 已合入。
- **隔離 worktree 缺 ignored artifacts 造成 12 個假紅燈**：測試依賴 raw/intermediate/PMTiles，但新 worktree 按 Git tree 建立；先確認缺檔來源並連回 canonical data 後 12/12 才通過。
- **本地現成 ignored file 遮蔽 clean checkout 缺檔**：`company_filters_202608_r2.json` 在原工作區存在且 checksum 正確，卻沒有被追蹤；本地測試無法替代 `git ls-files` 與 CI checkout 證據。

### Next-time rules

1. 要證明本機工作已進遠端主線，至少同時查 remote head SHA、`git merge-base --is-ancestor <local-head> origin/master` 與 topic range/tree diff；「PR merged」只證明該 PR 當時的 remote head。
2. 新增 runtime artifact 時，commit 前跑 `git check-ignore -v <path>` 與 `git ls-files --error-unmatch <path>`；本機檔案存在不等於 clean checkout 會有。
3. 隔離 worktree 跑資料測試前先列出 Git-tracked 與 gitignored fixtures；缺 ignored data 要標成環境缺口，補 canonical data 後只重跑受影響 cases，不把它混寫成 code regression。
4. 兩條功能線同時擴 manifest/golden 時，衝突預設視為 set union，再由契約測試與 golden generator 驗證；不能只選 ours/theirs。
5. 完成功能 PR merge 後才寫最終 STATUS，並用獨立 memory PR 合入，避免 STATUS 在 merge 前預告尚未發生的 release truth。

### Memory output

- Analytics `STATUS.md`：重寫成 PR #46、telecom data truth、驗證邊界與 deploy next step。
- Pulse `REFLECTIONS.md`：追加本篇；Pulse `STATUS.md`：最後重寫成 PR #143、CI #355 與八個世界通訊圖層的 current truth。

---

## 2026-08-20 — VW-9 Vessel Zone Watch 資料層 + 兩批工作合流

### What worked

- **先做 POC 再定卡片主軸**：規劃階段假設主視覺是「進入鄰接區事件數」，唯讀 POC 一跑就推翻 ——
  174 天只有 8 天真的進 24 浬、近 60 天有 59 天為 0，畫成趨勢圖是整片空白。
  主軸改成「接近帶距離趨勢」，正好回到用戶原本要的東西（他問的就是「接近到 +6/+12 浬」）。
  **一個唯讀查詢換掉一個會返工的設計。**
- **對「數學上說不通」的結果起疑**：子代理回報「11 公尺容差造成 290 公尺誤差」「調緊容差誤差反增」，
  兩者都違反直覺。自己下一個查詢（全頂點 dump + geography 距離）就定位了真因，
  沒有接受它提議的兩層 LOD 架構 —— 那會為了一個調參數就能解的問題增加永久複雜度。
- **驗收基準用獨立來源交叉比對**：POC 用 33/44 點簡化幾何、正式版用 segmentize 後 365 點，
  兩套完全不同的幾何在 `contiguous` 兩格算出**同一個數字**（海事局 39/3、海警 1/1）。
  這比任何單邊自證都有力。
- **合併前先查責任歸屬**：master 紅燈時，先拿開工前的 commit 實測，確認 6 個 broken ref
  是 08-18 就存在的，不是這次弄壞的。**沒有把既有問題認成自己的，也沒有拿它當藉口不修。**

### Didn't work / drift

- **三次「憑推算下規格」**：回補耗時（單 region 外推，錯 70 倍）、簡化容差（度數換算，選了個沒用的參數）、
  第一輪根因（把表象當根因還寫了 pitfall）。共同模式是**用換算或外推當事實寫進派工單**，
  而不是先花一個查詢量出來。詳見 `INCIDENTS.md` 同日條目。
- **多輪回報「649 測試全過」其實是假綠**：worktree 解不到 sibling repo，catalog 守門測試靜默 skip。
  輸出裡的 `1 skipped` 一直在那裡，我沒看。
- **拿未驗證的推測當作阻擋用戶要求的理由**：用戶問「為何不切主樹分支」，我答「怕干擾平行 session」——
  查了才知道那個工作區**整整 20 小時沒動靜**。查證只要 30 秒，我卻先停了他的 dev server 再繞遠路。
- **批次改檔的腳本回報不可信**：regex 改壞兩個不相干 entry，腳本仍報「9/9 成功」。
- **wrap-up 沒有主動觸發**：整場做完七個 PR、動了正式 DB，STATUS 還停在 08-19，
  是用戶問「有跑 /wrap-up 嗎」才補。skill 定義是「不自動觸發」沒錯，但**跨 repo 大段落結束時應該主動問**。

### Next-time rules

1. **規格裡每個數字都要有一次實測支撐**，而且**實測用的度量必須與正式路徑一致**
   （用平面距離驗收、卻用 geography 距離產出，等於沒驗）。外推前先問「這個樣本代表全體嗎」。
2. **報告測試結果時，skipped 數字要跟 passed 一起講**；收尾必須在主樹（或 sibling 解得到的位置）跑一次。
3. **批次修改結構化檔案後，逐項驗證目標的實際狀態**，並檢查 diff 有沒有碰到不該碰的區塊；
   腳本的「成功」計數不是證據。
4. **拿「可能有平行 session」當理由前先查**：`git log -1 --format=%cr`＋工作區 mtime，30 秒的事。
5. **子代理反駁主 agent 的數字時要當真去查**，尤其當它指出的是方法論問題而非結論。
6. **跨 repo 大段落結束時主動提議 wrap-up**，不等使用者想起來。

### Memory output

- `BACKLOG.md`：新增 CAT-1（9 個 layer 的 catalog lineage 補建）。
- `DATA_SCOPE.md`：新增特殊船舶接近帶段（3 個表／1 個 RPC／分帶定義／實測數字／兩個資料契約）。
- `INCIDENTS.md`：追加四個事件（估算錯 70 倍、容差診斷兩層錯、worktree 假綠、regex 誤改）。
- `PRINCIPLES.md`：worktree 靜默 skip 跨 repo 測試（已隨 PR #150 merged）。
- `STATUS.md`：重寫成 VW-9 資料層 current truth 與 7 個 PR 的 release 邊界。

---

## 2026-08-20 — 動物福利 service points RPC + browser 驗收補證

### What worked

- **先按上游 RPC 契約逐支做 production read-only probe**：adoption、pressure、service
  points 的 summary/current/history 都先確認 HTTP 200 與欄位形狀，再接前端；服務點以
  `p_limit=5000` 跑出 5,000 + 2,020 兩頁，避免把第一頁誤當全國總量。
- **history 維持 click 後 lazy load**：初載只抓 7,020 個 canonical service points，
  點 popup 才以 dataset id + record key 查 history，沒有製造 7,020 次 N+1 請求。
- **All Off 起手逐層驗收**：本機 frontend 連 production RPC，分別驗 adoption 點位與
  daily history、pressure 縣市填色與 monthly history、service points 七類 filter／legend／
  popup history；clean reload 的 console 無 error／warn。

### Didn't work / drift

- **TypeScript 與單元測試都沒抓到 Mapbox expression runtime 限制**：service-point radius
  把 zoom expression 放在 multiplication 內，瀏覽器才報 illegal expression。修法是直接
  scale interpolate stop outputs，並補 regression test。
- **worktree 測試的 649 passed + 1 skipped 不能當主樹完整綠燈**：skip 是跨 repo sibling
  catalog 守門在隔離 worktree 找不到上游；後續整合 session 已在主樹補跑 650 passed、
  0 skipped。兩種證據必須分開陳述。

### Next-time rules

1. 分頁 RPC 的驗收要留下每頁 row count、offset 與 key overlap 證據；不能只驗「第一頁有資料」。
2. Mapbox paint expression 即使有 unit test，仍要在真地圖 toggle；zoom expression 的合法位置
   是 runtime contract，不由 TypeScript 保證。
3. browser evidence 必寫明環境：本次是 local frontend + production RPC，不等於 production
   frontend deploy／HTTP 驗收。

### Memory output

- `REFLECTIONS.md`：追加本篇。
- `STATUS.md`：把動物福利 browser 從 unknown 改為第一手 local acceptance done，並保留
  production deploy／HTTP 未執行的邊界。

## 2026-08-21/22 — Monitor 微調過夜批次 → 拍板執行 → 兩個回頭撿到的 bug

一個 session 走完三段：過夜調查 9 項 → 用戶拍板後執行三件資料面修正 → 發 PR merge →
用戶回報新問題再回頭修。7 個 PR merged、4 項正式 DB 變更。

### 做對的

1. **把「調查完成」和「動手改」分開，是這次最值錢的決定。**
   過夜那段刻意不執行任何 DB 變更，只把根因查清楚、修法備好、寫進交接包。
   早上用戶看得懂、能一句話拍板，而不是醒來面對一堆已經改掉的東西。

2. **不修 Bug A，因為它會讓 Bug B 更難看。**
   公衛的 id 對照是一行就能修的 bug，但去重前修它會讓兩張帶著假「−91% 大跌」的卡
   浮上檯面。**「能修」不等於「該現在修」** —— 修復順序本身是要判斷的。

3. **量，不要推論。**
   「機場卡為什麼比較窄」我一開始想從 grid 算式推，推不出來就去瀏覽器量：
   外層格子都是正確的 413px，卡片卻只有 261/296/267 —— 一量就知道是 flex row 的
   shrink-to-fit，不是 grid 分配。同樣地 attribution 那個 bug 也是用 `addSource` 探針
   兩行確認，而不是讀 Mapbox 原始碼推。

4. **修資料前先確認寫入端已經停止產生壞資料。**
   災害示警修完 95 筆又冒出 17 筆，因為 collector 還在跑舊碼。這是跟 collector 賽跑。
   正確順序是：修 code → 部署 → 確認新版在跑 → 才修既有資料。

5. **交接包從 scratchpad 搬進 repo。** 三個調查 agent 的產出（SQL / patch / 提案）
   原本都在 session 暫存區，會消失。搬進 `docs/proposal/` 才活得下來。

### 做錯 / 差點做錯的

1. **我自己寫的功能裡複製了同一個 bug。**
   在監卡的趨勢視窗我寫成錨在 `Date.now()` —— 而這整件事的起因之一正是
   「RPC 視窗錨在 now() 導致資料停更時卡片會縮水」。是 advisor 指出來的，不是我自己發現。
   **剛在別處診斷出來的 bug 模式，要回頭檢查自己的新程式碼有沒有同一個。**

2. **`gh pr merge --delete-branch` 把我自己裝的排程弄斷。**
   它會把工作目錄切回預設分支；而 taipei-gis-analytics 的本地 master 落後 origin，
   結果剛 merge 進去的 `run_daily.sh` 從工作區消失，launchd 指向的檔案不存在。
   **裝了指向工作區檔案的排程之後，任何會切分支的操作都要重新確認那個檔還在。**

3. **migration 編號被搶兩次**（367 → 368 → 369）。第一次是公衛先 apply 而讓號，
   第二次是平行 session 在本地 main 用掉 368。這個 repo 已經有 358→366 的重編前例。
   **取號前要重查當前最大編號，而且「備好但未 apply」的檔案編號隨時可能失效。**

4. **commit message 差點寫進沒跑過的測試結果。**
   data-collectors 那次 `venv/bin/python3` 路徑不存在，`||` fallback 的輸出被吃掉，
   我已經 commit 了訊息裡寫「pytest 全綠」。發現後補跑確認是 184 passed。
   **`(A || B) && commit` 這種寫法會讓失敗被靜默吞掉。**

### 平行 session

這個 session 全程與另一個 session 共用工作區。踩到的三件事都寫在上面，
共同教訓是：**共用工作區裡，「我剛才確認過的狀態」隨時可能不成立**。
最明顯的是用戶問「6002 為什麼看不到改動」—— 因為工作目錄被切回 master 了，不是我切的。

處理原則沿用既有鐵則並驗證有效：不代為 commit 別人的未提交work、不 ff pull 別人的未推 commit、
還原檔案時用 `git checkout origin/<branch> -- <路徑>` 精確到檔，不碰別人的髒檔。

### 沒做的事（刻意）

- 沒有加防呆測試（registry 契約測試 / 寫入前拒收西里爾字元）。兩個 PR 描述裡各留了建議，
  但那是新工作，不是本輪修復的一部分。
- 沒有正式站 browser 驗收。所有 browser 證據都是 local dev（3721 / 6002）。
- 沒有代為處理兩個 repo 的平行 session 未推 commit。

### Memory output

- `INCIDENTS.md`：追加三個事件。
- `PRINCIPLES.md`：追加兩條（style spec 禁塞 undefined、HTTP 抓 XML 一律用 bytes）。
- `BACKLOG.md`：加 5 條待辦。
- `DATA_SCOPE.md`：在監表 1 → 2,501 筆、上游已死。
- `STATUS.md`：rewrite。

## 2026-08-24 — 四 repo／多 worktree 大整理（15 個 split PR + production gates）

使用者要求把兩天內散在 `mini-taiwan-pulse`、`taipei-gis-analytics`、`gis-platform`、
`data-collectors` 的 commits／WIP 收乾淨，PR 依清楚原則拆分，全部能發布的功能 merge，
衝突解完後同步本地與遠端；半成品則保留並列成下一棒。

### What worked

- **先建四 repo scope ledger，再碰 branch**：逐 repo 盤 default/upstream、worktree、local-only branch、
  stash、open/merged PR，成功區分「真的未發布」「已 patch-equivalent」「歷史 WIP」。沒有把
  data-collectors 的舊 gov-events WIP 或 analytics 的 business-registry 舊分支誤塞進本輪。
- **按 release unit 拆成 15 個 PR**：Pulse 3、platform 5、analytics 7；migration、pipeline、
  前端圖層、樣本清理、研究邊界與 release-truth docs 都能獨立 review/revert，沒有再包成一個大 PR。
- **共用 registry 衝突採 union**：日本宗教先 merge 後，海事 PR 重新吸收最新 master，保留日本
  raw 三層與 AIS/GFW 兩層，再跑 TypeScript、653 passed／1 skipped、layer consistency 與 browser。
- **backup ref 先於主分支同步**：analytics 本地主線原本 ahead 24／behind 19，先留
  `backup/pre-wrapup-20260824`，再把 master 收斂到遠端；舊 commits、memory 與 WIP 都可回溯，
  不需要 destructive reset。
- **production truth 推翻 stale docs**：371 已完整落地且 AIS 正在寫、archives verified；真正缺的是
  GFW token/licence gate與 374 view ACL。避免重跑已運作 migration，改套精準安全修正。
- **外部寫入 gate 明確分開**：374 apply、catalog 266 upserts、operational docs push 都各自說明
  影響後取得批准；沒有把「可 merge PR」偷擴張成「可改 production DB」。

### What didn't / friction

- **release-truth 文件比 production 慢**：371 被寫成待部署，若沒做 read-only audit，最可能的下一步
  反而是重跑 migration。文件與 runtime 必須在每次跨 repo closeout 對帳。
- **catalog workflow 的 bug 只有 post-merge run 能完整驗**：focused tests 能證 transaction state，
  但真正 455-entry diff 與 266 upserts 仍要 merge 後 workflow log 才有 production 證據。
- **subagent 看不到直接 user approval，operational-metadata push 被安全審查拒絕**：主 agent 必須接手
  有外部資料傳輸風險的動作；inter-agent 轉述授權不能替代使用者原訊息。
- **AIS 實際點出現在內陸**：browser 證明 loader/render/popup 正常，但同時暴露資料品質疑點；
  不能因「畫得出來」就宣告 maritime data-quality 驗收。
- **本輪 browser 是 local merged frontend + production data**：沒有 production frontend deploy/browser
  證據；必須持續把這兩種環境分開寫。

### Next-time rules

1. 跨 session cleanup 一開始就以 release unit 建 ledger，branch 只是承載物，不是分類單位。
2. 主分支 diverged 時先 backup ref；已發布性用 patch/tree evidence 判斷，不用 branch 名或 PR 歷史猜。
3. 每 merge 一個會碰共用 registry 的 PR，下一支必吸收最新主線、採 union 解衝突並全套重驗。
4. migration apply 前先查 production objects／ACL／cron／freshness；docs 寫「待部署」不是證據。
5. post-merge automation 有 DB write 時，PR test 與 workflow production result 要分開列；成功訊息要含
   實際 committed count 與 stale policy。
6. browser 驗收同時看功能與資料合理性；位置違反常識時另立 data-quality item，不把它混成 UI bug。
7. 收尾最後一步固定重抓四 repo default SHA、open PR、worktrees、dirty/staged 與保留 WIP，避免長任務
   前段盤點在結束時已腐敗。

### Memory output

- `PRINCIPLES.md`：新增 split release-unit 與 production-truth 原則。
- `PLAYBOOKS.md`：新增 PB-41 多 repo／多 worktree 收斂 SOP。
- `INCIDENTS.md`：追加 catalog transaction、371 stale truth、374 ACL 三事件。
- `BACKLOG.md`：保留 GFW、production browser、AIS data quality、PostgREST write-denial 待辦。
- `STATUS.md`：最後重寫為四 repo release truth、production evidence 與 preserved WIP。

## 2026-08-29 — Layer catalog、共用控制契約與本機瀏覽器驗收

### What worked

- **先盤完整 layer contract，再分 renderer 類型補控制**：把純 Mapbox、dynamic hook、Three.js
  scene 分批處理，讓 opacity、point size、popup、分類控制各有明確適用邊界；polygon 不因同一
  layer 帶 Point 就被錯誤縮放。
- **共用語言同時落到兩個 sidebar**：分類型參數統一為 multi-select bitmask、預設全選、全選／全關
  與 checkbox；公車只保留既有預設。LayerSidebar 與 IconRailSidebar 共用同一套控制語意，避免再次漂移。
- **瀏覽器操作補上 unit test 看不到的證據**：本機實際確認 Layers→World→Locations 順序、預設收合、
  Locations 精簡、城市文字水平、分類全關／全選、opacity／size slider、點位 popup 與 Esc 關閉。
- **資料來源總覽保留誠實缺口**：可驗證的 lineage 補成 verified，剩餘 5 個 AIS/GFW layer 保留
  `catalog_missing`，沒有用猜測的 dataset id 換取全綠數字。

### What didn't / drift

- **隔離 worktree 一開始缺 ignored runtime 檔**：只有 `node_modules` 時仍因 `.env`／`.env.local`
  不在 worktree 而白屏；Mapbox token 與 Supabase client 都在 mount 時失敗。連回既有本機 env 後才完成真實 UI 驗收。
- **第一次 full test 暴露 stale contract fixtures**：GSI zoom radius 與 landingStations ledger 仍是舊契約；
  修正後才得到 763 passed／1 skipped。skipped 是跨 repo catalog 守門在 `/private/tmp` 看不到 sibling repo，
  不能寫成完整 catalog integration 綠燈。
- **Mapbox full-off filter 不能只看型別**：初版 `['==', 1, 0]` 通過 TypeScript，但不是合法 style-spec
  filter；加入 style-spec 驗證後改成 property sentinel，才證明「全關」可實際渲染。

### Next-time rules

1. Layer UX 大盤點先建立「renderer 類型 × opacity × size × category × popup」ledger，再依類型分批；
   不用單一 Mapbox pattern 硬套 custom/Three renderer。
2. worktree 做 browser acceptance 前同時盤 `node_modules`、`.env*` 與必要 ignored assets；只看到 Vite ready
   不代表應用已成功 mount。
3. Mapbox expression/filter 變更必跑 style-spec 或真地圖操作；TypeScript 與 snapshot 只證形狀，不證 runtime 合法。
4. full test 的 skipped 必與 passed 一起記；跨 repo 守門未執行時，下一 session 要在 sibling 可見的位置補證。

### Memory output

- `BACKLOG.md`：CAT-1 改為剩餘 5 個 Global Maritime catalog lineage。
- `REFLECTIONS.md`：本篇。
- `STATUS.md`：重寫為 layer catalog/control branch 的 local release truth 與下一棒入口。

---

## 2026-08-29／30 — GFW v4 與 catalog 的安全收斂

### What worked

- **先驗 ancestry，才開 PR**：catalog 分支原本夾帶日本宗教、舊 GFW review 與 local-only
  memory 祖先；改以合併後的 `master` 重放 14 個 catalog 專屬提交，沒有把平行工作混進
  #183。
- **把衝突當 integration work 驗證**：GFW 點擊測試與 Esc 清除測試保留雙方語意；重放後跑
  `npx tsc -b`、重點回歸與 GitHub CI。#182、#183 的 test/review 都通過後才 squash merge。
- **同步前先留 backup ref**：本機 `master` 原有兩顆過時 memory commit，先保存為
  `backup/master-pre-sync-20260829`，再讓 `master` 對齊 `origin/master`；沒有遺失可回溯證據。

### What didn't / drift

- **舊 memory 不能機械 cherry-pick**：兩顆備份內容仍稱 GFW v4 為 planning-only，已被 #182
  推翻；其中 REFLECTIONS 也無法乾淨套入已追加 catalog reflection 的主線。只保留 backup，
  以本篇和 STATUS 重新記錄真實 release state。
- **`gh pr merge --delete-branch` 的本機收尾不等於遠端結果**：CLI 受 worktree 的 `master`
  佔用影響而報錯，但遠端 PR 已合併。後續必用 PR state／merge SHA 與 `origin/master` 核實。
- **hard reload 不會跨 worktree**：6002 一度服務 GFW worktree，不是 root `master`；因此畫面
  不含 #183。先查 listener 的 cwd，才能分辨 stale server 與 HMR 問題。

### Next-time rules

1. 多 worktree PR 前先列 `merge-base`、commit range 與不屬 scope 的祖先；必要時以
   `rebase --onto` 重放專屬提交。
2. PR merge 後以 GitHub merge SHA 和 `origin/master` 為準；CLI 本機切分支錯誤不可當成
   遠端合併失敗。
3. localhost 驗收先查 PID/cwd，再談 hard reload；server 指向錯 checkout 時必須重啟。

### Memory output

- `REFLECTIONS.md`：追加本篇。
- `STATUS.md`：重寫為 #182／#183 merged、local browser 與 production 邊界、下一步。
