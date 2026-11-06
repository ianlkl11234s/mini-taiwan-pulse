# owner-gated-layers（私人圖層鎖定）

> **Slug**：`owner-gated-layers`
> **狀態**：上線（2026-11-06 名單與呈現統一，見「現況」）
> **Owner**：migu
> **上線日期**：2026-07-07
> **相關 PR**：前端 #60（Phase 1+2）· #62（lock_type）；gis-platform #28（275/276/277）· #30（278/279）
> **依賴 migration**：275（RPC owner 檢查 + REVOKE anon）· 276（分層 tier + 治理表 + admin RPC + `get_layer_gates`）· 277（gated RPC STABLE→VOLATILE 修 read-only tx）· 278（lock_type 分型）· 279（電廠 public schema 洩漏修補）；profiles.tier 讀取靠 migration 270 的 `profiles_select_own` RLS

## 一句話說明

把一批敏感私有資料圖層鎖起來：只有登入且 `profiles.tier='owner'` 的帳號能開啟；
其他訪客照常看到圖層名稱但顯示鎖頭、無法 toggle、資料也不會下載。

## 現況（2026-11-06 統一）

### 名單：一份

- **唯一來源＝manifest `topics` 的 `"OWNER_ONLY"` 標記**（`src/data/layerManifest.ts`）。
  `layerCatalog.ts` 的 `GATED_LAYERS` 由它派生（名稱、型別不變，urlState／embedWhitelist／layerGates／搜尋等消費端照舊）。
- 釘死清單測試 `src/data/__tests__/ownerOnlyRegistry.test.ts`：manifest 標記與 `GATED_LAYERS` 都必須等於表內 59 個 key；
  少一個標記（＝私人圖層對外開放）或多一個都會紅。新增站主限定圖層時三處一起改：manifest topics、該測試、gis-platform `public.gated_layers`。
- DB `public.gated_layers`：mig 276（34 列）＋494（electionEvents2026）＋499（gbPollutionInventoryEngland）＋**500**（補前端獨有的 22 個 key 與 allenCoralAtlas，共 23 列，`rpc_name` NULL、`required_tier='owner'`、`lock_type='full'`）。
  DB 另有 `info_medical_ltc`（member tier，mig 281）不屬站主限定，不在前端名單。
- 舊的 manifest 第三套名單（`OWNER_ONLY` 標記執行時沒人讀）與 `OWNER_ONLY_THEME_TITLES` 已併入／移除。

### 呈現：一種（spec §5.5）

非站主一律看到**反灰＋鎖頭**，點了走 `App.tsx` `handleGatedIntercept`（未登入導 Google 登入；已登入非站主顯示「私人圖層，僅擁有者可檢視」）。不可整個隱藏。

| 位置 | 2026-11-06 前 | 現在 |
|---|---|---|
| 圖層面板列（含 jpWater、土壤液化、BSS、allenCoralAtlas 等私人 Range API 層） | 鎖頭 | 鎖頭（不變） |
| 主題「歷史底圖」（古地圖） | 非站主整個主題隱藏 | 主題照常顯示，列帶鎖頭；右上地名提示卡仍只在解鎖時出現 |
| 模擬面板（busCrowdingSim、bridgeResilienceTwinCity） | 非站主濾掉 | 列出鎖頭列（`resolveLayerPanel` 不再分站主） |
| 面板搜尋（圖層、資料來源） | 上鎖層不出結果 | 照常列出並帶鎖頭（`searchLayers(…, { excludeLocked: false })`）；Agent 工具 `catalogTools` 仍用預設 fail-closed |
| facOffshore／osmPowerPlantsStatic／powerPlants | 無介面 | 不變：沒有 LayerDef，只擋程式化開啟 |

`lockedKeys`（`App.tsx`）＝ tier＋`get_layer_gates()` 解析 ∪ RELEASE_HOLD ∪ 各私人 Range API 探測結果。
私人 API 探測（jpWater、土壤液化、BSS、橋梁韌性、公車擁擠、allenCoralAtlas）負責資料能不能讀，名單負責介面上不上鎖，兩者都要過。

**不屬站主權限、維持原樣**：`RELEASE_HOLD_LAYERS`（授權未驗證，連站主都鎖）、`IS_PRODUCTION`／`localResearchGroup`（開發中，只在本機 DEV 顯示；4 個 Glow 層同時在名單內）、統計比較 build flag。

### 已知限制

- 私人 Range API（`server/coral-private/*`）仍認寫死的站主 `OWNER_ID`，不讀 `profiles.tier`；把某層在後台降到 insider 只會解開介面，資料端仍只給站主。
- 分享網址：`urlState.parseLayers` 在解析階段就丟掉所有 `GATED_LAYERS`（測試 `urlState.test.ts`「🔒 gated 圖層一律 drop」釘住），所以站主收到含私人圖層的分享網址也不會還原。這是設計上的丟棄，不是 tier 載入時序問題；要改需使用者拍板。

## 機制摘要（Phase 1，2026-07-07 原始設計）

三層防護：

1. **前端 SSOT 旗標**：`src/components/sidebar/layerCatalog.ts` 的 `GATED_LAYERS`（Set）為單一真實來源（2026-11-06 起改由 manifest 派生，見上），
   LayerDef 另加 `gated?: boolean` 型別欄位。桌機 `IconRailSidebar` 與手機 `LayerSidebar` 兩邊
   都依 `GATED_LAYERS.has(key) && !isOwner` 顯示鎖頭（inline SVG，非 emoji）+ 降透明度 + title 提示。
2. **前端 toggle gate**：`App.tsx` 的 `handleGatedIntercept` 攔截所有「開啟」意圖
   （`handleToggleVisibility` / `handleLayerClick` / 手機 inline onLayerClick / `handleBulkSetVisibility`）——
   非 owner 點鎖層：未登入→導 Google 登入（`signInWithGoogle`）；已登入非 owner→顯示「私人圖層，僅擁有者可檢視」提示。
   因所有 loader 都「visible 才 fetch」，toggle 擋住 → 資料永不下載（避免 403 洗版）。
3. **後端 owner 檢查（migration 275）**：對應 RPC 加 owner 檢查 + REVOKE anon（另一 agent 負責）。

owner 判定：`src/lib/auth.ts` 的 `useMemberGate()` 登入後 `select tier from profiles where id = auth.uid()`；
tier 載入為非同步，載入完成前 `isOwner=false`（先顯示鎖），完成後才解鎖。

Phase 1 的 key 分組（電力、石化、畜牧與 3 個無介面層）與後來加入的日本水資源、BSS、橋梁韌性、公車擁擠、選舉活動、土壤液化、古地圖、
英格蘭污染排放、allenCoralAtlas，完整清單看 `ownerOnlyRegistry.test.ts`。

**明確排除（保持公開，不鎖）**：`waterCanals`（灌排渠道）、`powerPoles`（電桿 2.96M）、
加油站 5 層（gasStationCpc/Fpcc/Taisugar/Other/Canonical）與加油站覆蓋分析。

## 資料路徑變更

| 圖層群 | 原路徑 | 新路徑 |
|---|---|---|
| 畜牧飼養場 / 屠宰場 | 靜態 `./agriculture/*.geojson` | owner-only RPC `get_livestock_farms` / `get_livestock_slaughterhouses`（dynamicData + setData） |
| 石化 9 層 | staticRpc CDN `get_fossil_fuel_layers` | 直連 `supabase.rpc("get_fossil_fuel_layers")` |
| 加油站 5 層（公開） | staticRpc `get_fossil_fuel_layers`（共用） | 拆出走公開 `staticRpc("get_gas_station_layers")` |
| 電網 4 + 電廠 5 + fossil infra + offshore + osm static | staticRpc CDN | 直連 `supabase.rpc(...)` |

## 關鍵檔案

- Auth：`src/lib/auth.ts`（`useMemberGate`）
- Catalog SSOT：`src/components/sidebar/layerCatalog.ts`（`GATED_LAYERS`、`isLayerLockedFor`）
- Sidebar：`src/components/IconRailSidebar.tsx`、`src/components/LayerSidebar.tsx`（鎖頭 UI）
- Toggle gate：`src/App.tsx`（`handleGatedIntercept` + 提示 toast）
- Loaders：`src/data/fossilFuelLoader.ts`（拆兩路）、`src/data/energyLoader.ts`、`src/data/livestockLoader.ts`（新）
- Hooks：`src/hooks/useFossilFuelLayers.ts`、`src/hooks/useLivestockLayers.ts`（新）
- Overlay：`src/map/overlayRegistry.ts`（畜牧 8 config 加 `dynamicData: true`）
- Deploy：`scripts/deploy/upload-deploy-assets.sh`、`scripts/deploy/pull-deploy-assets.sh`、`scripts/export/export-static-rpc-snapshots.sh`

## livestock RPC 契約（前端依賴的 properties）

- `get_livestock_farms` → GeoJSON FeatureCollection（Point）：`證號 / 場名 / 縣市 / 主畜種 / 總隻數 / 種類明細 / 段 / 地號 / 定位來源 / 精度`
  - paint/filter 實際依賴：`主畜種`（分 7 畜種）、`總隻數`（size/color ramp）、`種類明細`（品項高亮）、`精度`（低精度淡化）
- `get_livestock_slaughterhouses` → GeoJSON FeatureCollection（Point）：`場名 / 種類 / 來源 / 地址 / geocode_type`
  - paint 實際依賴：`種類`（首字分家畜/家禽）

## 風險

- ⚠️ **`get_fossil_fuel_layers` 一 RPC 餵兩類**：公開加油站 + 私有石化。migration 若對它 blanket REVOKE anon 會連加油站也斷。
  已依 coordinator 契約拆出公開 `get_gas_station_layers`，前端加油站改走它；`get_fossil_fuel_layers` 可安全鎖。
- tier 讀取失敗（RLS/網路）→ isOwner 保持 false（fail-safe 上鎖，不會誤放行）。

## Phase 2 — 分層治理系統（migration 276 + 站內後台）

把 Phase 1 的「單人 owner 硬鎖」升級成可治理的分層存取 + owner-only 後台。

### 分層 tier 模型（有序 4 級）

| tier | rank | 意義 |
|---|---|---|
| `free` | 0 | 一般訪客 / 未升級會員 |
| `member` | 1 | 登入會員（保留給未來一般付費層） |
| `insider` | 2 | 受信任、可看敏感圖層的授權帳號 |
| `owner` | 3 | 全權 + 後台唯一管理者 |

授權判斷一律 `tier_rank(使用者tier) >= tier_rank(圖層required_tier)`。`insider` 只是「能看鎖定圖層」，**不能進後台**（後台仍限 `is_owner()`）。

### 動態 gating 機制（取代寫死的 GATED_LAYERS Set）

- 公開 RPC `get_layer_gates()`（anon 可呼叫，只回 `layer_key / required_tier / enabled`，**不含任何地理資料**）為圖層鎖定的權威來源。
- 前端 `src/lib/layerGates.ts`：
  - `loadLayerGates()` — App 啟動拉一次，存 module-level cache；admin 改動後 refetch。
  - `useLayerGates()` — `useSyncExternalStore` 訂閱，載入 / refetch 後自動 re-render。
  - `isLayerLocked(key, tier, gates)` — 純函式解析；`tierRank()` 做 4 級對應。
  - `isAccessDenied(err)` — 辨識 403 / code 42501，供 loader 靜默處理。
- **fail-safe（絕不因 RPC 失敗而解鎖）**：`get_layer_gates()` 失敗 / 尚未回來時 `gatesCache=null`，一律 fallback 回靜態 `GATED_LAYERS` Set（保持鎖定，需 owner 才解鎖）；載入成功後動態清單為權威（owner 若把某層設 `enabled=false` 或降到 `insider`，地圖鎖頭即時跟隨）。
- `App.tsx` 從動態清單 + 當前使用者 tier 算出 `lockedKeys: Set`，取代兩個 sidebar 原本 inline 的 `!isOwner && GATED_LAYERS.has(key)`（sidebar prop 由 `isOwner` 改為 `lockedKeys`）；`handleGatedIntercept` / `handleBulkSetVisibility` 亦改讀 `lockedKeys`。
- `useMemberGate()` 擴充回傳 `tier`（字串），供分層判斷；`isOwner` 保留為 `tier==='owner'` 捷徑。

### 站內治理後台（owner-only）

- 入口：`UserAvatar` 下拉新增「🛡 資料治理」項，**僅 `isOwner` 才渲染**（非 owner 完全看不到）。
- `src/components/admin/AdminPanel.tsx` — 站內 modal（跟隨 design token，無新路由 / 無新套件），四分頁：
  1. **會員管理** — `admin_list_members`，每列 tier `<select>`（4 選項）→ `admin_set_member_tier`；自己那列禁改（呼應 DB 端防呆），改動後 refetch。
  2. **稽核記錄** — `admin_list_audit`（預設 limit 200），granted=false 紅底；「只看被拒」toggle 切 `p_only_denied`。**匿名限制**（頂部灰字說明）：anon 打鎖定 RPC 在 API gateway / ACL 層就被擋、函式未執行 → **不進 audit_log**；本表只涵蓋「已登入且函式有跑到」的存取（owner 正常使用 + 登入者越權嘗試），真正的匿名掃描記錄需看 Supabase 平台 logs。
  3. **圖層鎖定** — `admin_list_gated_layers` 依 category 分組，每列 required_tier `<select>` + enabled checkbox → `admin_set_layer_gate`，改動後 `loadLayerGates()` refetch 讓地圖鎖頭即時更新；`is_stale` 紅點。
  4. **資料新鮮度** — 唯讀顯示各 dataset 的 source_date / next_refresh / refresh_cadence / row_count / is_stale（過期紅標）；編輯（`admin_upsert_freshness`）留待未來。
- `src/lib/adminApi.ts` — admin RPC 型別化薄封裝。

### 錯誤處理（§6.4）

鎖定 RPC 對非授權者回 403 / code 42501。gated loader 的 hook catch 以 `isAccessDenied()` 辨識並靜默（不噴 console、不重試）；正常路徑仍由前端 gate 擋在 fetch 之前（Phase 1 行為不變）。專案所有 gated loader 一律 `console.warn` + 無 retry（Supabase resilientFetch 只 retry 5xx/429，不 retry 403）。

### Phase 2 關鍵檔案

- `src/lib/layerGates.ts`（新）、`src/lib/adminApi.ts`（新）、`src/components/admin/AdminPanel.tsx`（新）
- `src/lib/auth.ts`（`useMemberGate` 加回傳 `tier`）
- `src/components/auth/UserAvatar.tsx`（加 owner-only 後台入口）
- `src/App.tsx`（`lockedKeys` 動態計算 + 接線 + 掛 AdminPanel）
- `src/components/IconRailSidebar.tsx` / `LayerSidebar.tsx`（prop `isOwner` → `lockedKeys`）
- `src/hooks/useLivestockLayers.ts` / `useFossilFuelLayers.ts`（access-denied 靜默）

## Phase 3 — 鎖型分型（UI 鎖 vs 乾淨鎖，migration 278）

`gated_layers` 加 `lock_type`（`'ui'` | `'full'`），區分兩種鎖的**目的與強度**：

| lock_type | DB 端 | 前端行為 | 用途 |
|---|---|---|---|
| `full`（乾淨鎖，預設）| REVOKE anon，資料真鎖 | 鎖頭；非授權完全拿不到 | 機密資料（現有 34 圖層全是這種）|
| `ui`（UI 鎖）| **不** REVOKE，資料公開 | 未登入顯示鎖頭引導登入，登入即可開 | 非機密、想引導註冊的圖層 |

**關鍵安全取捨**：`lock_type` 是純宣告欄位，**後台改它不會自動改任何 DB grant**。理由：若切成 `ui` 就自動 GRANT anon，會有「誤觸把機密公開」的風險。所以真正要上線一個 `ui` 圖層，除了後台設 `lock_type='ui'`，還必須另跑 migration GRANT anon。寧可「切了 ui 但資料仍被 DB 擋」的錯配，也不誤洩。

⚠️ **anon key 是公開的**：任何人打開網站就能從前端 bundle 取得 anon key。所以「UI 鎖」（不 REVOKE）等於資料對所有人公開——機密資料**只能**用乾淨鎖（`full` + DB REVOKE），這是本系統的根本前提。

`isLayerLocked(key, tier, gates)`（`src/lib/layerGates.ts`）依 lock_type 分支：`full` 依 tier rank（現狀）；`ui` 未登入一律鎖（引導登入）、登入且 tier 足夠即開。後台「圖層鎖定」分頁每列可切 lock_type。

## 安全模型與審計

### 三道防線
1. **DB GRANT/RLS（唯一真防線）** — 機密表 REVOKE anon + 鎖定 RPC 改 SECURITY DEFINER + `enforce_layer_access` owner 守門。就算拿到公開 anon key 也擋在門外。
2. **前端 gating** — 鎖頭 UI + toggle gate，防一般使用者、引導登入。**不是安全邊界**（DevTools 可繞），只是體驗層。
3. **CDN 斷源 + gitignore** — 靜態機密檔不進 CDN 供應、不進 git。

### 稽核涵蓋範圍
- `access_audit_log` 記「已登入且函式有執行到」的存取（owner 正常使用 granted=true；登入者越權嘗試 granted=false 另寫 Postgres server log，因 RAISE 會 rollback 表 INSERT）。
- **匿名掃描記不到本表**（ACL 在函式執行前就擋 → 不進 audit）；需看 Supabase 平台 API logs。

### 安全審計紀錄（2026-07-07）
上線後做過一次全面洩漏掃描（DB 繞道 / PostgREST exposed schema / GitHub git 歷史 / 前端 bundle / CDN），結論：

- ✅ **守住**：畜牧 / 石化油氣 / 電網 / PostgREST schema 繞道（`agriculture`/`energy`/`realtime` 未 expose）/ git 歷史（無機密資料檔或 service key 進過歷史，`.env` 未 track）/ CDN 靜態機密檔 404 / profiles 防提權（authenticated 不能自改 tier）。
- 🔴 **發現並修補（migration 279）**：`public` schema 有 4 個電廠 table/view（`all_power_plants_v` 全台電廠 SSOT 鏡像、`power_plants`、`nuclear_plants`、`ipp_thermal_plants`）migration 275 漏了 REVOKE，anon 用公開 key 直打 `/rest/v1/` 可讀，繞過所有 owner-gated 電廠圖層。已 REVOKE + DROP anon policy；前端 `powerPlants`（用 `all_power_plants_v` 的已下架圖層）補進 GATED_LAYERS。
- ⚙️ **確認維持公開（開放資料）**：離島電廠 `island_power_grid`、OSM 太陽能/風機、政府離岸風電潛力場址——皆為 OSM/政府開放資料且有公開圖層在用，經 owner 確認維持公開。

**教訓**：鎖 schema-level（未 expose 的 schema）很安全，但散在 `public` schema 的同主題 table/view 容易漏。新增機密資料時，凡放 `public` schema 的一律確認 anon grant + RLS policy 都收斂。

## 相關 backlog / changelog / ADR

看 [backlog.md](./backlog.md)、[changelog.md](./changelog.md)。上游 handoff：taipei-gis-analytics/docs/handoff/owner-gated-layers.md（migration 275 由 DB agent 維護）。
