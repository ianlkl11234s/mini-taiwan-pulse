# Backlog — owner-gated-layers

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 對應項編號一致（OG 系列）。

## Security / governance active

- [ ] **OG-1：anon key 濫用防護 / Supabase Spend Cap 確認**（2026-07-07 討論後記）
  - 背景：機密資料已 RLS/REVOKE 鎖死（拿到公開 anon key 也讀不到）。殘餘風險只剩「有人狂打公開端點灌爆 Supabase 用量/帳單」。
  - ⚠️ **關鍵發現**：Supabase host `*.supabase.co` 是架在 **Supabase 自己的 Cloudflare** 後面（回應 header `server: cloudflare`），**不經過我方 zone `itsmigu.com`** → 在我方 Cloudflare 設 rate limit 對 Supabase **完全無效**。
  - 下一步（依優先序）：
    1. Supabase Dashboard → Organization → Billing → **確認 Spend Cap 開啟**（超額限制服務而非繼續計費；免費方案預設有，Pro 要確認）。最重要、最簡單。
    2.（可選）我方 Cloudflare（itsmigu.com）→ Security → Bots → **Bot Fight Mode** + WAF rate limiting rule → 只保護前端網站本身，與 Supabase 資料無關。
    3. ❌ 不建議：為 rate limit Supabase 去搞 Custom Domain 過我方 Cloudflare（過度工程，機密已鎖）。

## Product enhancement / governance

- [ ] **OG-2：資料新鮮度後台可編輯** — 目前「資料新鮮度」分頁唯讀；`admin_upsert_freshness` RPC 已備但無 UI 表單。
  - Outcome：owner 可維護 freshness metadata，不必直接操作 DB。
  - Next action：定義欄位驗證、audit 權限與錯誤狀態後，再接表單；以 admin/non-admin browser evidence 關閉。

## UX validation

- [ ] **OG-3：UI 鎖首個實際圖層驗收** — lock_type='ui' 機制已就緒但目前無實際 ui 圖層在用；未來加非機密引導註冊圖層時，需驗「未登入鎖頭 → 登入即開 + DB 有 GRANT anon」的完整鏈。
  - Outcome：鎖頭不會把權限錯誤誤顯示成 loading 或空資料。
  - Next action：有第一個 ui layer 時做 anonymous/authenticated browser test 與 DB grant check。

## Conditional / decision needed

- [ ] **OG-4：powerPlants owner 存取（若需要）** — migration 279 REVOKE `all_power_plants_v` 後，已下架的 powerPlants 電廠總圖 owner 也讀不到；若日後要恢復給 owner 用，需建 owner-gated RPC 包該 view。目前 owner 看電廠走 facPrimary 等 SSOT RPC，暫不影響。
  - Trigger：owner 決定恢復 powerPlants 總圖。
  - Acceptance：新增 RPC 的 RLS/GRANT、owner/non-owner browser 與 no-anon-leak test。

## UX validation / decision recorded

- [ ] **OG-5：Monitor PowerCard 誤導性空狀態**（2026-07-26 發現，owner 拍板「先不動」記錄備查）
  - `get_ssot_facility_output_24h` 是 owner-gated（`powerGenerationUnit`，PR #60 刻意鎖），但 MonitorPanel 對 gating 零感知：無條件呼叫、generic catch，匿名者看到「等待機組出力資料…」——像在載入、其實永遠不會來。
  - 修法（待啟動時）：`MonitorPanel.tsx:164-189` 的 catch 改 `isAccessDenied()` 分類（比照 useFossilFuelLayers），PowerCard UNIT OUTPUT 段顯示「機組出力為私有資料，擁有者登入可檢視」。
  - 相關：`energyLoader.ts:122-134`（缺 owner-gated 註解標記）、`PowerCard.tsx:207-215`。
  - Trigger：owner 重新啟動此 UX 修正。
  - Outcome：匿名者看到「私有資料」而非永久 loading 假象；修正後以 anonymous browser evidence 驗收。

## 已完成（歷史，不列入 active）

- [x] **Phase 1 — 資料真鎖**（畜牧/石化/電網/電廠 34 層）— 前端 PR #60 + gis-platform #28（migration 275/276/277），2026-07-07
- [x] **Phase 2 — 分層治理後台**（tier + 治理表 + admin RPC + get_layer_gates）— 同上
- [x] **Phase 3 — UI 鎖/乾淨鎖分型**（lock_type）— 前端 PR #62 + gis-platform #30（migration 278），2026-07-07
- [x] **電廠 public schema 洩漏修補** — 安全審計發現 all_power_plants_v / power_plants / nuclear_plants / ipp_thermal_plants anon 可讀，gis-platform #30（migration 279）REVOKE，2026-07-07
- [x] **README 補 Phase 3 + 安全審計** — PR #63，2026-07-07

## Decision recorded / deferred

- **開放資料電力圖層維持公開** — island_power_grid（離島電廠）/ osm_solar_farms / osm_wind_turbines / offshore_wind_zones：經 owner 確認為 OSM/政府開放資料 + 有公開圖層在用，維持公開不鎖（2026-07-07）。
