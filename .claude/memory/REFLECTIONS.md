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
