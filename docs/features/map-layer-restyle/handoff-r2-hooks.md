# Handoff — R2 後半：hook 自己畫的點圖層（給 Codex）

> 指派者：使用者（手動轉交）。完成後回報給 Claude session 驗收，**不要自行 merge**。
> 分支：`feat/map-restyle-r2-hooks`（已從 master `a9034643` 開好，本檔與 `HOOK_POINT_TIERS` 已 commit）。在這個分支上繼續 commit、push，最後開 PR，標題寫「R2 後半」。
> Repo：`mini-taiwan-pulse`。建議開自己的 worktree（見 §8），不要在主工作區切分支。

## 1. 背景（一分鐘版）

地圖圖層視覺規格已拍板（`docs/design-system/map-layers.md` §3、§7）。R2 前半（PR #392，已上線）把 **OVERLAY_REGISTRY 驅動的 192 個點圖層**統一成：

- **P-1 B 固定三階半徑**：小 S 3、中 M 4.5、大 L 6.5（px），**不隨縮放**；乘上大小滑桿（以滑桿預設值為 1）。
- **P-2 A 描邊**：底圖色 1px（暗 `#0a0a14` 透明度 0.8、淡 `#ffffff` 0.9），描邊透明度跟透明度滑桿。
- **P-6 光暈**：只有即時資料保留光暈（半徑 ≤ 主體 ×2、透明度 ≤ 0.35、blur ≥ 0.6）；靜態資料的光暈**改透明度 0、子圖層保留**（常被當點擊範圍）。

前半的做法是在 registry 出口集中套用（`src/map/pointSpec.ts` 的 `withPointSpec`）。**hook／factory 自己 addLayer 的圖層不經過 registry**，這次要逐檔改。

必讀：
- `src/map/mapStyleScale.ts`：所有數值與 helper（`pointRadius`、`pointStrokePaint`、`POINT_STROKE`、`mapSeamColor`、`POINT_RADIUS`）
- `src/map/pointSpec.ts`：前半的套用邏輯（半徑與描邊的算法、光暈規則、`LIVE_DECORATION_LAYERS`、`DECORATION_SUFFIX_RE`、`POINT_SPEC_EXEMPT`），**照這個邏輯寫，不要自創**
- `src/map/pointTiers.ts`：`HOOK_POINT_TIERS`（本次名單，使用者已確認「全照建議」）
- `docs/features/map-layer-restyle/PLAN.md` R2 段、`docs/design-system/spec.md` §10.3

## 2. 目標與完成定義

對 `HOOK_POINT_TIERS` 裡**真的畫 circle 的圖層**：

1. 主體 circle 的 `circle-radius` = `pointRadius(tier, 大小滑桿值 ÷ 大小滑桿預設)`，常數（不得有 `["zoom"]`）。tier = `HOOK_POINT_TIERS[key]`。
2. 主體 circle 的描邊 = `mapSeamColor(isDark)`、寬 `POINT_STROKE.width`、透明度 `POINT_STROKE.opacity[暗|淡] × (透明度滑桿值 ÷ 預設)`（若該層透明度已在外層統一乘，照 `pointSpec.ts` 的處理只除預設）。
3. 裝飾子圖層（光暈、漣漪…）依 §5 處理。
4. tier 為 `"B"`（泡泡，依資料放大）：**半徑不動**，只套描邊。
5. 大小滑桿、透明度滑桿都仍有效；點擊（popup）仍點得到。
6. 驗收全過（§7），回報表完整（§9）。

**不在範圍**：泡泡改 M3 正規化、依點數的透明度（P-3，R5 做）、熱區、Three.js／WebGL CustomLayer、文字標籤、icon（symbol）大小、線／面圖層。

## 3. 第一步：確認哪些層真的畫點（不要跳過）

名單來自 `design:audit-layers` 的 **hook 層級掃描**：同一支 hook 裡只要有 circle，整支 hook 服務的所有圖層都會被列進來。已知例子：`useJpWaterLayers` 的「洪水浸水想定」其實是 raster；`agricultureLayerFactory` 的「作物適栽」其實是面。

對每個檔：
1. 讀程式，找出每個 layer key 實際 addLayer 了哪些 `type: "circle"`，子圖層 id 是什麼。
2. 名單裡**沒有畫 circle** 的 key：不改，回報表標「非點圖層（掃描誤列）」。
3. 名單外但同檔**有畫 circle** 的 key：不改，回報表列出來（由 Claude 決定是否補進分階）。
4. circle 其實是 **cluster／聚合泡泡、計數徽章、選取圈、點擊熱區（透明度 0）**：不套主體規格，回報表註明。

## 4. 數值怎麼取

- **大小滑桿**：規格在 `src/data/layerParamsSpec.ts`（名稱含 `scale|radius|size` 的 slider）。預設值用 `paramDefault(key, name)` 或 spec 物件的 `default`。hook 取滑桿值的方式各不同（`paramRefs.xxx.current`、props、`useLayerParams`…），**沿用該 hook 現有的取值方式**，只改算式。
- 沒有大小滑桿的層：`pointRadius(tier)`（倍率 1），回報表註明「無大小滑桿」。**不要新增滑桿**（`layerParamsSpec.ts` 是共用檔，見 §6）。
- 若 hook 對同一類點用 `["match", ["get", "x"], …]` 依類別給不同大小：這是**依類別的大小編碼**，不是依數值。處理方式：最大一類 = tier 半徑，其他類依原比例縮放（同 `overlayRegistry.ts` 變電所 icon 的做法，搜尋 `substationIconSize`），固定不隨縮放。回報表註明。
- 依屬性數值放大（`["interpolate", …, ["get", …]]`）但 tier 不是 B：**停下來回報**，不要自行改成固定值。

## 5. 光暈與裝飾（P-6）

判斷子圖層是不是裝飾：用 `DECORATION_SUFFIX_RE`（整詞比對 glow／halo／ripple／pulse／hit／range…）或該子圖層明顯是光暈（大半徑＋blur＋低透明度）。

1. **先查是不是點擊範圍**：搜 `src/map/gisClickRegistry.ts`、該 hook 裡的 `map.on("click", <layerId>)`、`queryRenderedFeatures({ layers: [...] })`。有被引用 → **只改透明度 0，保留子圖層與半徑**。
2. **靜態資料**（設施、據點、清冊）：光暈透明度 0（`circle-opacity`／`line-opacity` = 0）；沒被點擊引用也可以直接移除子圖層，但**移除要同步移除所有引用它 id 的程式**（setPaintProperty、moveLayer、removeLayer、測試）。不確定就改透明度 0。
3. **即時資料**（資料本身是進行中的事件或持續更新的讀值）：保留光暈，限制半徑 ≤ 主體半徑 ×2、透明度 ≤ 0.35、blur ≥ 0.6。**「資料由程式載入」不等於即時**（前半的能源設施就不算）。本批可能是即時的候選：災害示警、AIS／GFW 船舶、空品測站、微型感測、衛星、颱風路徑——逐一看資料是否隨時間更新（timeStore 訂閱、輪詢、即時 API），回報判斷依據。
4. **點擊熱區**（`hit`、透明度已是 0）：不動。

## 6. 禁改清單（共用檔，會跟其他工作衝突）

**不要修改**：`src/map/overlayRegistry.ts`、`src/map/pointSpec.ts`、`src/map/pointTiers.ts`、`src/map/mapStyleScale.ts`、`src/data/layerManifest.ts`、`src/data/layerParamsSpec.ts`、`src/data/__tests__/__fixtures__/*`、`docs/design-system*.md`、`docs/design-system/layer-style-inventory.json`、`LegendPanel.tsx`。
需要改這些檔才能完成的（例如缺 helper、要新增滑桿、要改分階）：**不要改，寫進回報表「需要 Claude 處理」**。

例外：`docs/design-system/layer-style-inventory.json` 由 §7 的 `npm run design:audit-layers` 重產，**可以 commit 重產結果**（不要手改）。

## 7. 驗收（每一項都要做，結果寫進回報）

1. `npx tsc -b`（禁用 `--noEmit`）綠。
2. `npm test` 全過。**機器負載高時**，`capabilityAudit.test.ts`、`pollutionPenaltiesDataset.test.ts`、`discovery` 類測試會逾時：單獨重跑通過即可，回報寫明。其他失敗要修。
3. 黃金快照（`layerGoldenSnapshot.test.ts`）**應該不變**（hook 不在 registry）。若紅了，代表動到 registry 相關檔，停下來回報。
4. `npx vitest run src/styles/__tests__/designSystemGuard.test.ts` 綠；若提示違規減少，跑 `npm run design:baseline` 並 commit。
5. `npm run design:audit-layers`，比對 `git diff docs/design-system/layer-style-inventory.json`：只該動到本次改的 key；列出變動的 key。
6. **新增 ratchet 測試**：`src/map/__tests__/hookPointSpec.test.ts`
   - 掃 `src/hooks/**`、`src/map/**`（排除 `overlayRegistry.ts`、測試檔），計算 `"circle-radius"` 值裡含 `["zoom"]` 的次數（多行也要算，用 AST 或寬鬆的括號配對，不要只抓單行）；**改之前先量基準**，測試斷言 ≤ 改後數量並在註解寫改前／改後。
   - 對每個改過的 key，至少斷言一個 paint 產生函式（若可抽成純函式）在預設參數下半徑 = tier 半徑、描邊色 = 底圖色。抽不出純函式的，回報表註明「只靠瀏覽器驗證」。
7. **瀏覽器實看**（見 §8）：每個 hook 家族（同一個檔）至少開一層，暗／淡 × z10／z14 四張截圖，改前（master）與改後（本分支）各一組，存到 `/tmp/r2-hooks/<家族>/`（**不要 commit 截圖**），回報路徑。並確認：大小滑桿拉到兩端有效、點擊有 popup。

## 8. 本機環境與地雷（違反可能出事）

- **不要讀 `.env`／`.env.local` 的內容**，不要 `cat`、不要 grep 它們；新 worktree 只建 symlink：`ln -s ../../.env .env`、`ln -s ../../.env.local .env.local`。
- **不要 curl vite 轉譯後的模組**（會印出 `VITE_*` 金鑰）。
- **絕不 `pkill -f vite`**（會殺掉其他 dev server）；關自己起的 server 用 `lsof -tiTCP:<port> -sTCP:LISTEN` 取 PID 再 kill。
- **絕不 `git reset --hard`**、`git checkout -- .`、`git clean -fd`；工作區可能有別人的改動，看到不是自己的檔**不要碰、不要 commit**。
- **worktree**：`git worktree add .worktrees/r2-hooks feat/map-restyle-r2-hooks`。`node_modules` 不要 symlink 主工作區的（主工作區在別的分支，缺 master 新增的 `@turf/*`）：在 worktree 內 `npm ci`，或 symlink `.worktrees/map-r1/node_modules`（已是完整安裝）。
- **dev server port**：改後用 **3746**，改前（master）用 **3747**（開另一個 master worktree）。**不要用 3734／3744／3745**（使用者正在用）。啟動：`npx vite --host 127.0.0.1 --port 3746 --strictPort`。
- **agent-browser 必須帶 WebGL 參數**，否則地圖黑屏：
  `agent-browser --session-name <名字> --args "--enable-unsafe-swiftshader,--use-gl=angle,--use-angle=swiftshader,--ignore-gpu-blocklist,--enable-webgl" ...`
  多個瀏覽器 session **不要平行跑**，會互相干擾截到同一張圖；一次一個。
- dev 模式有 `window.__map`：等 `window.__map.loaded()` 再操作；`jumpTo({center, zoom, pitch: 0, bearing: 0})` 讓前後相機一致。
- 開圖層：可用 `await import('/src/state/layerVisibilityStore.ts')` 後 `layerVisibilityStore.setVisibility(key, true)`。**但改參數不能用 import 的 `layerParamsStore.setParam`**（實測不會傳到地圖）：滑桿與顯示模式要點側欄介面（Layers → 主題 → 圖層列展開）。
- 拍單一圖層前先按側欄「All Off」。
- 本機 `grep` 可能是被覆寫的 shell function，否定結論用 `/usr/bin/grep` 或 `rg` 複驗。zsh 變數不會自動斷詞，迴圈用陣列。

## 9. Commit、PR 與回報

- **一個檔（或一個家族）一個 commit**，Conventional Commits，例：`feat(map): fixed point tiers for Japan tourism layers (R2 hooks)`。訊息寫改了哪些 key、光暈怎麼處理。
- push 到 `feat/map-restyle-r2-hooks`，開 PR（base `master`）。**不要 merge**，不要 squash。
- PR 描述＋回報給使用者的內容要有：

| key | 檔案 | 真的畫點？ | tier | 改前半徑（z10／z14） | 改後 | 大小滑桿 | 描邊 | 光暈處理（即時？依據） | 點擊範圍引用 | 備註／需要 Claude 處理 |

  另附：驗收 §7 每一項的結果（指令與輸出摘要）、截圖路徑、ratchet 改前／改後數字、無法判斷或刻意沒改的清單（附理由）。

## 10. 名單（`HOOK_POINT_TIERS`，122 層／44 檔）

「現在」是盤點讀到的 z14 半徑（hook 層級，**可能是兄弟圖層的值**），只當參考。

| 檔案 | key | 圖層 | 現在 z14 | 分階 |
|---|---|---|---|---|
| `src/hooks/useJpTourismLayers.ts` | `jpAccommodationCanonical` | 旅宿去重總覽 宿泊施設の統合一覧 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpAccommodationJta` | 觀光廳登錄飯店／旅館 観光庁登録ホテル・旅館 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpAccommodationLocal` | 地方旅館業許可 地方自治体の旅館業許可 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpAccommodationOsm` | OpenStreetMap 住宿涵蓋 OpenStreetMap 宿泊施設カバレッジ | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpMarineEbsaCoastal` | 沿岸生態重要海域 沿岸EBSA（2015） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpNaturalParksNational` | 國立公園 国立公園（A10 2010） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpNaturalParksPrefectural` | 都道府縣立自然公園 都道府県立自然公園（A10 2010） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpNaturalParksQuasiNational` | 國定公園 国定公園（A10 2010） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpNatureConservationArea` | 自然保育地域 自然保全地域（A11 2015） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpNatureConservationSpecialDistrict` | 自然保育特別地區 自然保全特別地区（A11 2015） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpPrimitiveNatureEnvironmentArea` | 原生自然環境地域 原生自然環境保全地域（A11 2015） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpRamsarSites` | 拉姆薩濕地名冊衍生點 ラムサール条約湿地名簿の派生点 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpWildlifeProtectionNational` | 國家指定鳥獸保護區 国指定鳥獣保護区 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpWildlifeSpecialProtectionDesignatedArea` | 鳥獸特別保護指定區域 特別保護指定区域 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpWildlifeSpecialProtectionDistrict` | 鳥獸特別保護地區 鳥獣保護区特別保護地区 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpWorldHeritageCultural` | UNESCO 文化遺產代表點 UNESCO 文化遺産代表点 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpWorldHeritageNatural` | UNESCO 自然遺產代表點 UNESCO 自然遺産代表点 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpTourismLayers.ts` | `jpWorldNaturalHeritageHistorical` | 世界自然遺產歷史範圍 世界自然遺産の歴史的範囲（A28 2011） | 讀不到 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesBeidou` | 北斗 BD-3 PNT | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesFrance` | 🇫🇷 France · CSO / PLEIADES / ELISA | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesGaofen` | Gaofen 高分 | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesGermany` | 🇩🇪 Germany · SAR-Lupe / SARah | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesIndia` | 🇮🇳 India · CARTOSAT / RISAT / EOS | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesIsrael` | 🇮🇱 Israel · Ofeq / EROS | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesItaly` | 🇮🇹 Italy · COSMO-SkyMed | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesJapan` | 🇯🇵 Japan · IGS / ALOS | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesJilin` | Jilin 吉林 | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesKorea` | 🇰🇷 Korea · KOMPSAT | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesRussia` | 🇷🇺 Russia · PERSONA / RESURS / COSMOS | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesShiyan` | Shiyan / Shijian 試驗 | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesTJS` | TJS / TJSW GEO 情報 | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesTaiwan` | 台灣 FORMOSAT / TRITON / IRIS-C | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesUSA` | 🇺🇸 USA · KH / BlackSky / Planet | 4–6 | 中 M（4.5） |
| `src/hooks/useSatellitesLayer.ts` | `satellitesYaogan` | Yaogan 遙感 | 4–6 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpCareCombined` | 複合服務 訪問・通い・宿泊の組合せ | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpCareDayServices` | 日間服務 施設に通う | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpCareEquipment` | 福祉用具 福祉用具 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpCareHomeVisit` | 到宅服務 自宅に訪問 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpCarePlanning` | 照護諮詢／計畫 介護の相談・ケアプラン | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpCareResidential` | 住宿／短期入住 施設で生活・宿泊 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpMedicalAreasPrimary` | 一次醫療圈 一次医療圏 · 2020 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpMedicalAreasSecondary` | 二次醫療圈 二次医療圏 · 2020 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpMedicalAreasTertiary` | 三次醫療圈 三次医療圏 · 2020 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpMedicalClinics` | 診所 診療所 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpMedicalDental` | 牙科 歯科 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpMedicalHospitals` | 醫院 病院 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpMedicalMaternity` | 助產所 助産所 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpMedicalLayers.ts` | `jpMedicalPharmacies` | 藥局 薬局 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterAgriculturalPonds` | 農業蓄水池（2026-03） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterDams` | 水壩 ダム（2014） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterFloodHazard` | 洪水浸水想定（最大規模） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterGroundwaterSites` | 地下水等觀測點（24縣） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterLakes` | 湖沼 湖沼（W09・2005） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterLevelStations` | 橫濱水位站 横浜市 | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterLocalFacilities` | 高松供排水相關設施 高松市 | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterNilimDams` | NILIM 水壩位置（46縣） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterQualityStations` | 水質測定地点 水質測定地点（2024） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterRivers` | 河川流路 河川（2006–2009） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterSewerFacilities` | 下水道設施（2012） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterSupplyAreas` | 給水區域 給水区域（2010） | 7 | 中 M（4.5） |
| `src/hooks/useJpWaterLayers.ts` | `jpWaterSupplyFacilities` | 上水道相關設施（2010） | 7 | 中 M（4.5） |
| `src/map/wasteMapboxLayers.ts` | `wdBattery` | 電池回收 Battery | 讀不到 | 中 M（4.5） |
| `src/map/wasteMapboxLayers.ts` | `wdClothes` | 衣物回收箱 Clothes | 讀不到 | 中 M（4.5） |
| `src/map/wasteMapboxLayers.ts` | `wdMixed` | 混合投放點 Mixed | 讀不到 | 中 M（4.5） |
| `src/map/wasteMapboxLayers.ts` | `wdRecyclingContainer` | 街頭資收桶 Container | 讀不到 | 中 M（4.5） |
| `src/map/wasteMapboxLayers.ts` | `wfMonitoring` | 地下水監測井 Monitor | 讀不到 | 中 M（4.5） |
| `src/map/wasteMapboxLayers.ts` | `wfOther` | 其他事廢設施 Other | 讀不到 | 中 M（4.5） |
| `src/map/wasteMapboxLayers.ts` | `wfRecycling` | 資源回收廠 Recycling | 讀不到 | 中 M（4.5） |
| `src/map/wasteMapboxLayers.ts` | `wfScrapYard` | 廢車 / 廢金屬 Scrap | 讀不到 | 中 M（4.5） |
| `src/map/agricultureLayerFactory.ts` | `agriCropSuitability` | 作物適栽 Crop Suitability | 8 | 中 M（4.5） |
| `src/map/agricultureLayerFactory.ts` | `agriLeisureFarmZones` | 休閒農業區 Leisure Farm Zones | 8 | 中 M（4.5） |
| `src/map/agricultureLayerFactory.ts` | `agriPOI` | 休農場 / 田媽媽 / 特色農旅 POI | 8 | 中 M（4.5） |
| `src/map/agricultureLayerFactory.ts` | `agriRuralRegen` | 農村再生社區 Rural Regen | 8 | 中 M（4.5） |
| `src/map/agricultureLayerFactory.ts` | `agriSoil` | 全台土壤分類 Soil Map | 8 | 中 M（4.5） |
| `src/map/agricultureLayerFactory.ts` | `agriSoilFertility` | 土壤肥力 250m Soil Fertility | 8 | 中 M（4.5） |
| `src/map/agricultureLayerFactory.ts` | `agriculture` | 農田範圍 FTW Fields 2025 | 8 | 中 M（4.5） |
| `src/hooks/useDisasterAlertLayer.ts` | `floodAlerts` | 水文防汛 Flood Alerts | 7 | 中 M（4.5） |
| `src/hooks/useDisasterAlertLayer.ts` | `lifelineAlerts` | 民生中斷 Lifeline | 7 | 中 M（4.5） |
| `src/hooks/useDisasterAlertLayer.ts` | `safetyAlerts` | 安全環境 Safety Alerts | 7 | 中 M（4.5） |
| `src/hooks/useDisasterAlertLayer.ts` | `transitAlerts` | 交通阻斷 Transit Alerts | 7 | 中 M（4.5） |
| `src/hooks/useDisasterAlertLayer.ts` | `weatherAlerts` | 氣象特報 Weather Alerts | 7 | 中 M（4.5） |
| `src/hooks/useJpReligionLayers.ts` | `jpReligionGsi` | 宗教設施 宗教施設（国土地理院） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpReligionLayers.ts` | `jpReligionOsm` | 宗教設施 宗教施設（OpenStreetMap） | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpReligionLayers.ts` | `jpReligionWikidata` | 宗教設施 宗教施設（Wikidata） | 讀不到 | 中 M（4.5） |
| `src/hooks/useGlobalMaritimeLayers.ts` | `aisstreamVessels` | AISStream 船舶 AISStream Vessels | 9 | 大 L（6.5） |
| `src/hooks/useGlobalMaritimeLayers.ts` | `gfwVesselPresence` | GFW 舊版每日船舶 Historical Presence | 9 | 大 L（6.5） |
| `src/hooks/useMarineObservationLayer.ts` | `marineObservationCwa` | CWA 海洋觀測站 CWA Marine | 讀不到 | 中 M（4.5） |
| `src/hooks/useMarineObservationLayer.ts` | `marineObservationIsohe` | ISOHE 港區海氣象 ISOHE Port | 讀不到 | 中 M（4.5） |
| `src/hooks/useAnimalAdoptionLayer.ts` | `animalAdoption` | 待認領養動物 Animal Adoption | 讀不到 | 中 M（4.5） |
| `src/hooks/useAnimalWelfarePointsLayer.ts` | `animalWelfarePoints` | 動物服務據點 Animal Services | 讀不到 | 中 M（4.5） |
| `src/hooks/useAqiStationsLayer.ts` | `aqiStations` | 空氣品質測站 AQI Station | 22 | 大 L（6.5） |
| `src/hooks/useBridgeRainLayer.ts` | `bridgeRainThresholds` | 一級監控橋梁參考雨量 | 10.2 | 大 L（6.5） |
| `src/hooks/useEarthquakeLayer.ts` | `earthquakes` | 地震 Earthquake | 8 | 中 M（4.5） |
| `src/hooks/useEarthquakesGlobalLayer.ts` | `earthquakesGlobal` | 全球地震 USGS Earthquake | 8 | 中 M（4.5） |
| `src/hooks/useFireEventsLayer.ts` | `fireEvents` | 火災歷史 Fire History | 3–6 | 泡泡（依資料） |
| `src/hooks/useFireLatestLayer.ts` | `fireLatest` | 火災最新年度 Latest | 3–6 | 泡泡（依資料） |
| `src/hooks/useFloodSensorLayer.ts` | `floodSensor` | 都市淹水感測 USWG | 讀不到 | 中 M（4.5） |
| `src/hooks/useGfwDarkVesselsLayer.ts` | `gfwDarkVessels` | GFW SAR 未匹配 AIS Unmatched Detections | 5–26 | 泡泡（依資料） |
| `src/hooks/useGfwHourlyGridLayer.ts` | `gfwHourlyGrid` | GFW 小時船舶網格 Hourly Grid | 5–22 | 泡泡（依資料） |
| `src/hooks/useGfwHourlyTracksLayer.ts` | `gfwHourlyTracks` | GFW 小時近似航跡 Hourly Tracks | 讀不到 | 中 M（4.5） |
| `src/hooks/useGlobalEventsLayer.ts` | `globalEvents` | 全球重大事件 Global Events | 2 | 小 S（3） |
| `src/hooks/useGroundwaterLayer.ts` | `groundwater` | 地下水井 Groundwater | 讀不到 | 中 M（4.5） |
| `src/hooks/useGroundwaterWellsLayer.ts` | `groundwaterWells` | 水井點位 Wells | 讀不到 | 中 M（4.5） |
| `src/hooks/useIotWraRiverLayer.ts` | `iotWraRiver` | IoT 河川 IoT River | 讀不到 | 中 M（4.5） |
| `src/hooks/useIotWraStructureLayer.ts` | `iotWraStructure` | IoT 水工結構 IoT Structure | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpAirportsLayer.ts` | `jpAirports` | 機場 空港 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpPoliceFacilitiesLayer.ts` | `jpPoliceFacilities` | 警察設施 警察施設 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpSchoolsLayer.ts` | `jpSchools` | 學校 学校 | 讀不到 | 中 M（4.5） |
| `src/hooks/useJpStationsLayer.ts` | `jpStations` | 車站 駅 | 讀不到 | 中 M（4.5） |
| `src/hooks/useMicroSensorsLayer.ts` | `aqiMicroSensors` | LASS 微型感測 Micro Sensor | 10–24 | 泡泡（依資料） |
| `src/hooks/usePowerPolesLayer.ts` | `powerPoles` | 電桿 Power Poles (2.96M) | 讀不到 | 中 M（4.5） |
| `src/hooks/useRainGaugeLayer.ts` | `rainGauge` | 即時雨量 Rain Gauge | 讀不到 | 中 M（4.5） |
| `src/hooks/useRiverLevelLayer.ts` | `riverLevel` | 河川水位 River Level | 讀不到 | 中 M（4.5） |
| `src/hooks/useRoadEventsLayer.ts` | `roadEvents` | 即時路況 Road Events | 讀不到 | 中 M（4.5） |
| `src/hooks/useTaipeiEvacuateLayer.ts` | `taipeiEvacuate` | 北市疏散門 Evacuate Gate (TP) | 讀不到 | 中 M（4.5） |
| `src/hooks/useTaipeiPumbLayer.ts` | `taipeiPumb` | 北市抽水站 Pump Station (TP) | 讀不到 | 中 M（4.5） |
| `src/hooks/useTaipeiSewerLayer.ts` | `taipeiSewer` | 北市下水道水位 Sewer (TP) | 讀不到 | 中 M（4.5） |
| `src/hooks/useTyphoonTracksLayer.ts` | `typhoonTracks` | 颱風軌跡 Typhoon Track | 5 | 中 M（4.5） |
| `src/hooks/useVesselWatchLayer.ts` | `vesselWatch` | 特殊船舶 Vessel Watch | 讀不到 | 中 M（4.5） |
| `src/hooks/useWasteCleaningSquadLayer.ts` | `wasteCleaningSquads` | 清潔隊 Squads | 10 | 大 L（6.5） |
| `src/hooks/useWorldTrashDebrisLayer.ts` | `worldTrashDebris` | 垃圾與殘骸觀測 Trash & Debris Observations | 讀不到 | 中 M（4.5） |
| `src/map/earthquakeReplayLayerFactory.ts` | `earthquakeReplay` | 地震回放 EQ Replay | 0 | 小 S（3） |
