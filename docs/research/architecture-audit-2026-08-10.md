# 全系統結構稽核（2026-08-10）

> 範圍：疊床架屋 / 技術債與效能 / 被改壞的地方 / 過度設計。
> 方法：4 個平行稽核 agent（規則違反掃描 / 效能資產 / 架構 / 死碼），主 agent 對 top 7 發現逐一 spot-check 證實後彙整。
> 基準：HEAD=master，`npx tsc -b` 通過、`pnpm test` 441/441 全綠。
> 前作：[architecture-audit-2026-07-02.md](./architecture-audit-2026-07-02.md)（AR 系列藥方）。本次所有發現皆標注 **[新發現]** 或 **[已追蹤]**（對照 BACKLOG / known-issues）。

---

## 0. 總體診斷（TL;DR）

1. **編譯與測試層面沒有壞掉**；壞掉的東西全在「測試蓋不到的縫」——最大一條是 **16 個多色圖層無圖例**（ratchet baseline 批次凍結後與程式碼脫節）。
2. **停用圖層的閒置成本 ≈ 0**（boot-lazy 紀律是系統性的，三種圖層型態逐條追蹤證實）——效能體質比預期好，真正的固定稅是**零 code splitting 的 1.44MB gzip 首載**。
3. **「疊床架屋」的直覺大部分不成立**：overlayRegistry 9.2k 行是同質資料膨脹（中位 entry 38 行、零 I/O）、三 registry 職責正交且 348/348 由 tsc 守門零漂移。**真正的結構債只有一個主嫌：`useTransportParams` 單一函式 3,079 行 / 644 useState / 539 項手寫 deps。**
4. **過度設計幾乎不存在**（engines/ 健康、spike 有歷史價值）；反而是「抽象建了沒推廣」（dayPrefetch、factories 6.2% 採用率、designTokens 橋）造成第二份手刻實作各自演化。
5. **07-02 審計的結構藥方（AR-21~26 Layer Manifest）還沒吃，病灶又長了 60%**：layer key 237→348、overlayRegistry 5,750→9,217 行、useTransportParams 2,104→3,161 行。守門測試有效壓住了漂移，但不阻止增長。

---

## A. 被改壞 / 實質失守（最優先）

### A-1. [新發現｜高] 16 個圖層屬性驅動多色渲染、但全站無圖例

UX 四鐵則之鐵則 2 實質失守。`BASELINE_NO_LEGEND`（105 筆）當初批次凍結（`layerConsistency.test.ts:90-92` 水利 11 筆連豁免註解都沒有），ratchet 先天不會再檢查已入 baseline 的項目。已證實漂移的 16 個：

**registry 側 7 個**（`match` on `["get",...]`，LegendPanel 0 次出現）：

| layer | 分類欄位 | 語意類數 | file:line |
|---|---|---:|---|
| `waterProtectionZones` | `zone_kind` | 4 | `overlayRegistry.ts:2918`（✅ spot-check 證實） |
| `waterMonitorStations` | `station_type` | 8 | `:3216` |
| `waterFloodExtreme` | `depth_class` | 6 | `:3160`（淹水深度分級無圖例=實質資訊遺失） |
| `waterFacilities` | `facility_type` | 5 | `:3105` |
| `submarineCables` | `cable_type` | 5 | `:1720` |
| `cctv` | `source` | 3 | `:1318` |
| `landingStations` | `station_type` | 3 | `:1777` |

**hook 側 9 個**：`freewayCongestion`（6 級）、`riverLevel`、`groundwater`、`rainGauge`、`taipeiSewer`、`taipeiPumb`、`indicators`、`socioeconomic`、`temperatureWave`（各 file:line 見稽核紀錄）。

放大傷害：`LAYER_COLORS` 只存單一代表色（實為 match 的 fallback）→ sidebar 圓點色與地圖實際多色對不上。
**處置**：分批補圖例（或有意識降單色並補豁免註解）；同時把 baseline 逐筆補上豁免理由，讓 ratchet 恢復可信。

### A-2. [新發現｜中高] rail 圖層 boot 後開啟＝零 loading 提示

`railLoader.ts` 全檔 0 個 `withLoading`（✅ 證實）。loading 回饋完全依賴 App.tsx 的一次性 `LoadingScreen`（`dismissedLoading` 後永久消失）；`railScheduleLoading` banner 只蓋切日路徑。若 rail 預設關、用戶在開機畫面消失後才開 → `loadAllRail()` 的 10+ 個 fetch 無任何指示。違反 CLAUDE.md §3。
**處置**：railLoader 接 loadingRegistry（或 useRailData 的 loading 接進現有 banner 路徑）。

### A-3. [已追蹤｜高] gas station static-rpc 檔缺 → 現在就在付 egress

BACKLOG EM-17 附註，2026-08-10 覆核 `public/static-rpc/` 仍無該檔，loader 靜默 fallback 打 RPC。**EM 系列優先級最高項，建議立即處理**（產檔上傳即可，非程式改動）。

### A-4. [新發現｜中] 守門機制本身的三個洞

1. **`intelLoaders.ts` 檔名複數逃過 ratchet**：`loadingRegistryContract.test.ts:53` 用 `endsWith("Loader.ts")`，`intelLoaders.ts` 不匹配（✅ 證實）。目前 15 個 RPC 都有 wrap（零實害），但未來改動無守門。改 filter 為 `/Loaders?\.ts$/` 即可。
2. **AqiLegend 繞過 `LEGEND_REGISTRY`**（掛在 `App.tsx:3123`）→ aqi 兩層被算進「合法無圖例」baseline，覆蓋率指標灌水、豁免註解與事實不符。
3. **測試只掃 `src/data/`**：`App.tsx:238-386` 四個圖層 toggle 的靜默 `fetch()`（lighthouse / station pillars / airports / ports）與 `MonitorPanel.tsx:290` 直接在元件內打 RPC（違反 loader 目錄慣例 + 永久逃過 ratchet），都在掃描範圍外。

### A-5. [新發現｜中] `docs/supabase_rpc_audit.md` 雙向漂移、正在主動誤導

- 130/149 個現役 RPC 從未進稽核文件（2026-04-09 後上線的所有 domain）；§3 SOP 第 5 步早已沒人跑。
- 反向更糟：文件標 🔴 最高風險的 `get_youbike_h3_snapshots` / `get_freeway_congestion_day` **其實已修好**（data-collectors 有 matview SQL + cron 錯峰），文件仍叫人去修。
- `get_bus_current_taipei` 已改名 `get_bus_current`，文件未更新。
**處置**：要嘛重整此文件、要嘛正式宣告退役改用 `/check-rpc` 即時判斷（二選一，別留半死狀態）。

### A-6. [已追蹤] 既有壞損提醒（本次未重驗，backlog 已有）

G005（waste 圖層切底圖後消失）、FE-01（`p.*` URL 參數解析了但沒套用）、BL-25（四條上游死管線）。

---

## B. 效能

### 正面結論（先講好消息）

- **停用圖層閒置成本 ≈ 0**：動態 Supabase（useBusLayer 4 個 effect 全 `if (!enabled) return`）、靜態 registry（overlayManager 空 FC 起手 + 三處 hydrate 呼叫點全檢查 visible）、Three.js（13 個常駐 layer 關閉時 `getIsVisible()` 一個布林檢查就 return、不 triggerRepaint、上游三個 data hook 全 boot-lazy）——三條路徑逐行追蹤證實。
- **repo 沒被大檔灌爆**：git 追蹤 335MB ≈ .git 336MB，2.77GB 差額全是 .gitignore 刻意排除的本機資產；top-20 大檔全部有被引用。
- **部署是清單制**（upload-deploy-assets.sh explicit array），不是全上傳。

### B-1. [已追蹤 CS-1｜現有實測數字] 零 code splitting，首載固定稅 1.44MB gzip

`main-*.js` 3,949KB raw / 1,084KB gzip + modulepreload 的 LegendPanel 831KB + RailScene 511KB。全 src 零 `React.lazy`、`vite.config.ts` 無 manualChunks；LegendPanel/RailScene 獨立 chunk 是 main/embed 雙 entry 去重的副產品，不是懶載入。**下載量與圖層開關無關**。CS-1 的觸發條件是「用戶抱怨首載」——數字現在有了，是否觸發由 Owner 拍板。

### B-2. [新發現｜低中] 9 檔 33.4MB 烤進 Docker image、但 nginx 架構上永遠讀不到

git-based deploy + `Dockerfile COPY . .` + `.dockerignore` 未排除 public/ + nginx 純 `/data` location 無 `try_files @dist`：`public/base_map/{aspect,hillshade,slope}.png`（32MB，✅ 證實 git 追蹤 + no-fallback）+ `public/climate/` 6 檔（1.4MB）。與 G004 同族但更具體、可 100% 確認。修法：移出 git 走 S3，或補 `try_files $uri @dist;`。

### B-3. [新發現｜低] 2 個未防護的 200ms 輪詢 timer（複製貼上對）

`useAviationAirspaceLayer.ts:230-237`（✅ 證實）與 `useDroneRestrictedZonesLayer.ts:174-181`：`bindTimer` 不受 `anyVisible` 保護，圖層全關仍每 200ms 跑。成本微小，但這是全站唯一違反 boot-lazy 慣例的計時器且已複製 2 份。

### B-4. [部分已追蹤 EDU-10｜低] `public/geo/schools.geojson` 2.5MB — git 內檔案本體漏刪

EDU-10 已完成退役（deploy 腳本移除 + src 零引用 + S3 物件刻意保留），但 `git ls-files` 證實 **repo 內的檔案本體仍被追蹤**——是 EDU-10 清單的漏項，`git rm` 即可。

---

## C. 結構債（疊床架屋判定）

> 判準：CLAUDE.md 已宣告「新增 Layer 多檔 register」為 Simplicity 例外。本節只認「例外保護範圍之外」的債。

### C-1. [部分已追蹤 G008｜高] 真正的主嫌：`useTransportParams.ts`

單一 React 函式 3,079 行（97% 檔案）、**644 個 useState**（✅ 證實 645 含 import）、341 個 switch case、466 行 overlayParams useMemo、539 項手寫 deps。與 overlayRegistry 的差別：那是 N 個獨立條目並排，這是**一個閉包內 644 個互相可見的 state**。`overlayParamsDeps.test.ts` 的存在本身就是失敗模式已發生過的證據——守門降低復發率但不阻止增長（每層 +4~5 hunk）。G008 有列此檔但數字已過期（當時 1,031 行）。**這是 AR-21~26（params 進 manifest、useTransportParams 退役為 generic renderer）的核心目標，也是本次稽核最支持優先執行的一項。**

### C-2. [新發現｜中] 觸點文件過期：宣稱 7 步、實測 14 檔 ≈ 21 處

三個實際 commit 量測（落雷單層 11 檔 29 hunk / 殯葬 5 層 14 檔 / 教育 16 層同 14 檔=規模經濟）。`layerConsistency.test.ts:4` 自己寫「~13 個檔案接觸點」。§4 步驟表漏了 7 個觸點（IconRailSidebar LAYER_ICONS、upstreamRegistry、chat datasets、nginx+deploy scripts 等）——新人照文件做必漏。**處置**：更新 development-rules §4 為完整觸點表。

### C-3. 正面判定：三個「看起來像債」的東西不是債

- **overlayRegistry 9,217 行**：218 entry、中位 38 行、零 fetch/setInterval → 同質資料膨脹，例外保護成立。
- **LegendPanel 4,531 行**：110 個 sub-component、中位 31 行、0 useEffect/0 useMemo、主元件 1 行 registry filter → 本次稽核設計最乾淨的大檔。
- **三 registry（overlayRegistry / upstreamRegistry / layerCatalog）**：職責正交（渲染/血緣/UI），id・名稱・分類**零重複宣告**，其中兩層 `Record<keyof LayerVisibility,T>` tsc 強制 348/348 零漂移——是優秀設計，應為其背書。

### C-4. [新發現｜中] 唯一真重複：顏色三寫、且無任何守門

sidebar 色點（LAYER_COLORS）/ 地圖 paint（overlayRegistry）/ 圖例色塊（LegendPanel）三處獨立 hex，兩檔重複 hex 上界 138 個。實證手抄 2 則：`#2e7d32`（overlayRegistry:135 ↔ LegendPanel:1622）、`#d32f2f`（:153 ↔ :1663）——都是 tour 主題，因其色表 inline 在 registry（`:133-171`）**違反 development-rules:152-153 自家規定**。religion/funeral/education 已示範正解（`data/*Types.ts` 匯出供三邊 import，31 檔在做對的事）。**處置**：tour 三組色表抽 `tourTypes.ts`（立即）；三邊色彩一致性測試（backlog）。

### C-5. [新發現｜中] 同 pattern 手抄 N 份（不在例外保護範圍）

- **glow 家族 73% 逐行相同**：`usePowerPlantGlowLayer` vs `useSubstationEhvGlowLayer`（48/66 行逐字同）+ `useOsmPowerLinesGlowLayer`，底層 CustomLayer 同樣重複。（與 `docs/features/bloom-experiments/` BE-2「泛化 line glow scene」方向天然合流——若做 BE-2 可一併收斂。）
- **IotWra 雙生子**：`useIotWraRiverLayer` 走 factory、`useIotWraStructureLayer`（241 行）同族卻手寫——收斂路徑就在隔壁檔案。
- **factories/ 採用率 6.2%**（1 檔 4 hook），同型手寫 18 檔 ≈ 3,800 行；而真正有效的收斂機制（registry 泛用路徑覆蓋 49% 圖層、6 個 entry factory 產 28+ entry）住在 overlayRegistry 頭部而非 factories/。

### C-6. App.tsx 3,155 行：減壓閥有效、膨脹來源是子系統

60% 是 hook 掛載板；registry 驅動圖層增量只 +2~9 行（教育 16 層 App.tsx **零改動**），自訂 hook 圖層 +20~42，新子系統 +79~141（embed/BYOK/owner-gated）。「每加功能 +30 行」只作用於 133/348 非 registry 圖層。長期解仍是 AR-21 manifest；短期可接受。

---

## D. 過度設計 / 死碼

**總判定：無大規模過度設計。** `src/engines/` 是 3 個具體 class 各有多個呼叫者（健康）；`src/spike/` 是支撐 embed 架構決策的已完成實驗（自成 entry 不拖 bundle，可留作歷史證據）；`dateNotifier` 的 DI 有單元測試正當理由。

| # | 發現 | 標記 | 嚴重度 | 處置 |
|---|---|---|---|---|
| D-1 | `@deck.gl/*` 4 死依賴（0 import；不進 bundle 只佔 node_modules） | [已追蹤 G007] | 低 | 從 package.json 移除（1 分鐘） |
| D-2 | 4 個真孤兒檔：`DataCalendarPanel.tsx`（✅ 證實零引用）/ `PowerStatusHud.tsx`（已被 monitor PowerCard 取代）/ `medicalPOILayerFactory.ts` / `utils/taiwanPass.ts` | [新發現] | 中 | 刪除（PowerStatusHud 先確認） |
| D-3 | 31/56 loader 檔含死 export：`wasteLoader` 15、`energyLoader` 9、`intelLoaders` 9（檔案層孤兒率 0%，export 層 55%） | [新發現] | 低中 | 批次清 export（tsc 會抓連帶孤兒） |
| D-4 | `dayPrefetch.ts` 自稱「所有 layer 共用」實際 1 個呼叫者；`useCwaImageryLayer.ts:238-244` 手刻第二份同邏輯 | [新發現] | 中 | 推廣或收斂，別留兩份各自演化 |
| D-5 | `designTokens.ts` 相容橋 16 個 re-export 零人走（大家仍直接 import intelTokens） | [已追蹤 DS-6] | 低 | 併入 DS-6 收編計畫 |
| D-6 | 3 個 Three scene 繞過 `toMercator()` 寫死 Mapbox 座標轉換（`TemperatureWaveScene:109` / `OsmPowerLinesGlowScene:156` / `RealEstatePointsScene:190`）——目前主站 only 無實害，**搬進 embed（MapLibre）即踩雷** | [新發現] | 中 | 改走 coordinates.ts（預防性） |
| D-7 | `knip` 無 config → embed/spike/showcase entry 全誤報 | [新發現] | 低 | 補 `knip.json` 宣告 3 個 entry |

### D-8. 分支健康（需 Owner 拍板，勿直接刪）

- **monitor 4 分支**（07-07 分岔、落後 191 commit）：排版架構已被 PR #121 `monitorPacking.ts` 取代＝確定殘枝 [已追蹤 G015 部分]。**但 `feat/monitor-widgets-batch1` 上有 4 個 hazard widget（颱風/地震/輻射/落雷）未以任何形式進 master** [新發現]——刪分支前先決定要不要這些功能。
- **`memory/wrap-up-funeral-integration`**（10 個 memory commit 未合回）：殯葬程式碼已隨 PR #107 進 master，但該 session 的 INCIDENTS 七事件 / DATA_SCOPE 規格 / BACKLOG PA-9、DL-1 系列**只活在這條孤兒分支上** [新發現｜中]——違反自家 wrap-up 治理慣例，建議挑揀合併。

---

## E. 建議行動優先序

**立即修（低風險高值，各 <1hr）**
1. gas station static-rpc 補檔（A-3，正在付錢）
2. `loadingRegistryContract` filter 改 `/Loaders?\.ts$/`（A-4.1）
3. bindTimer 2 處加 `anyVisible` gate（B-3）
4. `@deck.gl/*` 移除 + 4 孤兒檔刪除 + schools.geojson 清（D-1/2、B-4）
5. tour 三組色表抽 `data/tourTypes.ts`（C-4）

**分批專項（建議開 PR 系列）**
6. 16 圖層圖例補齊 or 有意識降單色 + baseline 逐筆補豁免註解（A-1）
7. rail loading 接線（A-2）
8. development-rules §4 觸點表更新至 14 檔實況（C-2）
9. supabase_rpc_audit.md 重整或正式退役（A-5）

**進 backlog（與既有計畫合流）**
10. `useTransportParams` 拆解 → 併入 AR-21~26 manifest 計畫，本次稽核最支持優先啟動的結構工程（C-1）
11. 33.4MB image 死重 → 併入 G004（B-2）
12. 三邊色彩一致性測試（C-4）；glow 家族收斂（C-5）；dayPrefetch 推廣（D-4）；toMercator 統一（D-6）；loader 死 export 批次清（D-3）

**需 Owner 拍板**
13. monitor widgets-batch1 的 4 個 hazard widget 去留（D-8）
14. funeral memory 分支挑揀合併（D-8）
15. code splitting 是否觸發（B-1，CS-1 條件已有實測數字）

---

## 附：本次稽核覆蓋聲明

- 機械全掃：348 key × 6 註冊表雙向 diff、overlayRegistry 218 entry 行數分布、LegendPanel 110 元件、BASELINE_NO_LEGEND 105 筆逐筆判定、`src/data` 全檔 RPC 掃描（149 unique）、App.tsx 50 commit numstat、knip + 自製 import 圖比對、production build 實跑。
- 抽樣：觸點數基於 3 個 commit；hook 重複度精算 2 對；98 hook 的 idle-cost 掃描為啟發式初篩 + 18 候選逐一人工檢視。
- **未驗證**：執行期行為（未開瀏覽器——16 筆圖例漂移是靜態證據）、DB 端（未連線——pre-aggregate 部署狀態未確認）、`GIS_LAYERS` 反向覆蓋（無守門但未查獲漂移）、IconRailSidebar/layerCatalog 內部結構、138 hex 雙寫中手抄 vs 巧合的完整區分（僅 2 則人工確認）。
