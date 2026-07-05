# Status

**最後更新**：2026-07-04（static-to-cdn — 25 靜態層搬 CDN，BC-8 根治）
**mini-taiwan-pulse head**：`master` = `325bae6`（PR #54），CI（test+review）綠 + Zeabur 部署 + prod 端到端驗證
**gis-platform head**：無變動（純前端 + S3/CDN，無 migration）
**data-collectors head**：無變動

## 本 session 完成（2026-07-04）

用戶起手：「變電所/電力線開多圖層回 0，是不是 Supabase 改動造成的？硬重載一樣」→ 診斷 → 結構面根治 → 一路做到 prod 驗證。

### A. BC-8 診斷（根因非 Supabase）
- 線上 anon key 直打 RPC → 後端回滿（785/2305 筆）；migration 271/272 表清單不含 osm 電力表（早在 176/228 自帶 anon policy）→ **排除 Supabase / 資安改動**。
- **真冷 repro**（page reload 清 `cachedOnce` 記憶體，`setData([])` 不算冷）→ 併發上限 8（AR-01）的 FIFO 佇列讓靜態大層排在動態層後 → 冷載暫態空窗 ~16s（非 fetch 失敗、非 render race）。且多人各自打同一份 = DB 讀取 **O(N)**。

### B. static-to-cdn — 25 靜態層讀取去 DB 化（PR #54，squash `325bae6`）
- **可複用管線**：`scripts/export/export-static-rpc-snapshots.sh`（psql 匯出）+ `src/data/staticRpc.ts`（讀 `/static-rpc/*.json`，404 fallback 回 RPC）+ deploy 鏈（nginx `/static-rpc/` + upload/pull 鏡像子前綴，加檔零改腳本）。
- **25 層**：電網 3 + 能源 15（含 fossil_fuel_layers 9.5MB）+ 廢棄物 6（2 counts + routes/facilities/disposal_points/squads 全量+前端 filter）+ 主要電廠座標 1。loader 改動多數僅一 token（transform/popup/legend 不動）。
- **成效**：脫離 DB 併發排隊，BC-8 settle 16s→2s，O(N)→O(1)。
- **排除**：`get_waste_stops`（193k/56MB，保留 per-city RPC）；data_catalog/h3_yearly/reservoir/satellite（低衝擊延後 → SC-1）。

### C. 驗證鏈（每關綠）
- `tsc -b` ✅ · CI（test+review）✅ · 廢棄物 **psql 對數驗證 10/10 全等** ✅
- Pilot 冷載 browser（BC-8 不再重現、settle 16s→2s）✅ · Batch 1 browser（11 層零 fallback）✅ · 最終 browser（渲染 + popup 屬性未壞）✅
- **prod 端到端**：25 檔上線、缺檔正確 404、首頁正常、fallback 安全 ✅

### 多 agent 協作模式
主 agent 定 pattern + 電網 pilot 驗證 → delegate：靜態層盤點（31 個）+ 廢棄物重構（帶 psql 對數 gate）+ browser 驗證（`bc8` session 複用）。信任 subagent push-back（stops 56MB 判斷不搬）。詳 PLAYBOOKS PB-27 / INCIDENTS + REFLECTIONS 2026-07-04。

## 待辦
- **SC-1**（P3）：static-to-cdn 延後項（waste_stops per-city 拆檔 / data_catalog / h3_yearly / reservoir/satellite）— 模板成熟，需要時 export append
- **BC-4**（P1）：部署前置（CSP header + 隱私頁 BYOK 揭露 + OAuth 正式網域切換）— 公開前必做
- **BC-2**（P1）：會員加值（細部規劃已拍板，見 `docs/proposal/member-features-plan.md` M 系列，migration 273/274）— 另條工作流
- 前 session 遺留：BC-3、GC 系列、AR-11e/12~16、SAT/NE/MO 系列

---

_本 session memory commits_：INCIDENTS / PLAYBOOKS PB-27 / PRINCIPLES / REFLECTIONS / DATA_SCOPE / GLOSSARY / BACKLOG（BC-8 done + SC-1）+ 本檔
