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

<!-- /wrap-up 之後追加新反省 -->
