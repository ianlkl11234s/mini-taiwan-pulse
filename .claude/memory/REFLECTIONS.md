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

<!-- /wrap-up 之後追加新反省 -->
