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
