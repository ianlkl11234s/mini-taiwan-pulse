# Reflections（append-only）

每次 `/wrap-up` 追加一篇。格式：What worked / What didn't / Next-time rules / Memory 產出。

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

<!-- /wrap-up 之後追加新反省 -->
