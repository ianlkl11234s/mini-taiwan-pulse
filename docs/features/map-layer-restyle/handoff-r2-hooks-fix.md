# R2 後半修正（PR #396）交接

> 指派：Claude（主 session）→ 隔壁 session（mini-taiwan-pulse-a4）｜2026-09-29
> 背景：Codex 依 `handoff-r2-hooks.md` 完成 R2 後半（PR #396，分支 `feat/map-restyle-r2-hooks`）。驗收後大方向正確（分階、滑桿倍率、光暈上限、沒刪層、沒改 ID、黃金快照不變、盤點只動 110 個目標 key），但有下列問題要修。**先讀完 `handoff-r2-hooks.md` §1–§8**，本文件只補「要修什麼、怎麼判斷」。

## 0. 工作方式

- **工作目錄**：`.worktrees/r2-hooks`（已在 `feat/map-restyle-r2-hooks`，與 remote 一致）。其他 worktree、主樹都不要碰。
- **第一步**：`git fetch origin && git merge --no-edit origin/master`（一般 merge；master 已含 #395 開站畫面、#397 時間軸，已確認無衝突）。不要 rebase、不要 reset、不要改寫既有 commit。
- **node_modules**：不存在就 `ln -s ../map-r1/node_modules node_modules`（不要 npm install）。
- **dev server**：用 **port 3749**（`npx vite --port 3749 --strictPort --host 127.0.0.1`）；結束時用 port 找 PID 再 kill。**絕不 `pkill -f vite`**。
- **禁止**：讀 `.env`、curl vite 轉譯後的模組（會印出金鑰）、`git reset --hard`／`checkout -- .`／`clean -fd`。
- **commit**：Conventional Commits，一個問題一個 commit；可以 push 到 `feat/map-restyle-r2-hooks`（更新 PR #396）。**不要 merge PR**。
- **不確定就停**：遇到本文件沒寫到、要改資料語意、要改圖例文字以外的 UI 時，停下來在回報裡列出，不要自行決定。

## 1. 可以改／不能改

- **可以改**：R2 hook 名單（`handoff-r2-hooks.md` §10）裡的 hook／factory 檔、它們的 host（`src/layers/hosts/*`）、相關測試、`src/map/__tests__/hookPointSpec.test.ts`。
- **本次特許**（其他都不行）：
  - `src/map/pointTiers.ts`：**只改 `HOOK_POINT_TIERS`** 裡 §4 列出的 10 個 key 的值（改成 `"B"`）與註解。
  - `src/map/mapStyleScale.ts`：**只能**給 `pointStrokePaint` 加一個選填參數 `opacityFactor = 1`（見 §3-6），預設值必須讓現有呼叫結果完全不變。
  - `src/components/LegendPanel.tsx`：**只改**因本次修正而與地圖不一致的圖例文字（如有）。
  - `docs/design-system/layer-style-inventory.json`：跑 `npm run design:audit-layers` 重新產生後 commit。
- **不能改**：`overlayRegistry.ts`、`pointSpec.ts`、`layerManifest.ts`、`layerParamsSpec.ts`、`src/data/__tests__/__fixtures__/*`、`docs/design-system*.md`、其他 hook。

## 2. 判斷原則（遇到新情況照這個推）

1. **描邊有兩種**：
   - 固定描邊（寫死一個顏色或寬度）→ 統一成底圖色細縫：`pointStrokePaint(isDark, 透明度倍率)`。
   - **依資料屬性變化的描邊**（`case`／`match` 讀 feature 屬性，例如 `geom_status`、`pumb_running`、`maneuver`）＝**資料編碼**，必須保留：該屬性成立時維持原本的顏色與寬度，其餘情況才用底圖色細縫。
   - 描邊本身就是圖形（例如透明填色＋外框的空心圈）也算資料編碼，不能換成底圖色。
2. **地圖與圖例必須一致**：改了地圖，就去 `LegendPanel.tsx` 對應段落確認圖例文字仍正確。
3. **主題、透明度只影響樣式**：`isDark`、`opacity`、`size` 變動只能走 `setPaintProperty`，**不可**放進「抓資料／建 source／訂閱 timeStore」那個 effect 的 deps。需要在建立圖層時讀最新值，就用 ref（參考 `useGfwHourlyGridLayer.ts` 的寫法）。
4. **同一個檔案找全部寫入點**：改 paint 時，搜尋同檔所有 `setPaintProperty(同一 layer` 與 `addLayer`，確認沒有別段把值寫回舊值。
5. **滑桿倍率＝值 ÷ 預設**：預設值用 `paramDefault(layerKey, paramName)`（`src/data/layerParamsSpec.ts:3506`），不要手寫 0.85、0.9 這種數字。
6. **不重複造輪子**：描邊一律用 `pointStrokePaint`，半徑用 `pointRadius(tier, factor)`。

## 3. 要修的問題（依優先序）

1. **AQI 測站描邊被蓋回舊色**（blocker）— `src/hooks/useAqiStationsLayer.ts:175-189`：「主題變更刷新 paint」effect 仍寫死 `rgba(255,255,255,0.8)`／`rgba(0,0,0,0.5)`，會覆蓋建圖層時的底圖色描邊。改成 `pointStrokePaint` 的值；glow 透明度維持在即時上限（≤0.35）內。
2. **颱風預測點在暗底圖消失**（blocker）— `src/hooks/useTyphoonTracksLayer.ts:126-132`：預測點＝透明填色＋藍色外框的空心環（圖例 `LegendPanel.tsx:3600` 寫「空心點」）。依原則 2-1：`point_type == "forecast"` 時還原 master 上的原外框色與寬度（`git show origin/master:src/hooks/useTyphoonTracksLayer.ts` 查原值），實際觀測點才用底圖色細縫。
3. **資料編碼描邊被拿掉**（should-fix，原則 2-1＋2-2）：
   - `useJpPoliceFacilitiesLayer.ts`：還原 `geom_status == "degraded"` → `JP_POLICE_DEGRADED_COLOR`、寬 1.5；其餘底圖色細縫。圖例 `LegendPanel.tsx:6358`「橘色外框＝約略位置」應維持正確。
   - `useTaipeiPumbLayer.ts`：還原 `pumb_running == true` → 2px 外框；其餘底圖色細縫。原本是白色 `#ffffff`，淡色底圖上白框會看不見 → 淡色主題改用 `#111827`（暗色維持白），並在回報中註明。圖例 `LegendPanel.tsx:4603` 同步說明「運轉中有外框」。
   - `useSatellitesLayer.ts:237-242`：機動中（maneuver）的紅色描邊還原（現有的環圈可保留）。
   - 火災（`useFireEventsLayer.ts`／`useFireLatestLayer.ts`）：若 master 上有依傷亡等屬性變化的描邊，同樣還原；沒有就不動。
4. **橋梁雨量拖透明度會重抓 API**（should-fix）— `useBridgeRainLayer.ts:93`：主 effect deps 拿掉 `opacity`、`isDark`（第二個 effect 已處理 paint）；建立圖層時需要的值改讀 ref。
5. **衛星拖透明度會重算軌道**（should-fix）— `useSatellitesLayer.ts:270`：`ensureLayers` deps 從 `[isDarkTheme, opacity]` 改回穩定（讀 ref），另開一個只做 `setPaintProperty` 的 effect。確認 timeStore 訂閱 effect（約 :459）不會因主題／透明度重建。
6. **描邊算式手寫 36 次＋ratchet 太弱**（should-fix）：
   - `mapStyleScale.ts` 的 `pointStrokePaint` 加選填參數：`(isDark: boolean, opacityFactor = 1)`，`circle-stroke-opacity` 改為 `Math.min(1, POINT_STROKE.opacity[theme] * opacityFactor)`。跑黃金快照確認不變（`npx vite-node scripts/preprocess/dump-layer-golden.ts` 後 `git diff` 該 fixture 應為空）。
   - 把 hook 裡手寫的 `Math.min(1, POINT_STROKE.opacity[...] * x / 預設)` 與各檔自寫的 clone 全換成 `pointStrokePaint(isDark, sliderValue / paramDefault(...))`（或同檔已有的倍率變數）。
   - 重寫 `hookPointSpec.test.ts` 成真正的 ratchet：
     - 對 `HOOK_POINT_TIERS` 裡非 B、且確實畫點的每個 hook 檔：斷言原始碼有用到 `pointRadius(` 與 `pointStrokePaint(`。
     - 斷言這些檔案不再出現舊的半徑 helper 名稱：`scaledRadius`、`dotRadiusExpression`、`CIRCLE_RADIUS`、`RADIUS_EXPR`、`marineObservationRadiusExpression`。
     - 字面 `"circle-radius"` 數值的計數用 `toBeLessThanOrEqual(基準)`，不是 `toHaveLength`。
     - 名單外的例外（非點、B 類）用明確的 allowlist 並寫原因。
7. **小問題**：
   - 刪掉沒人用的 `marineObservationRadiusExpression`（`useMarineObservationLayer.ts:95`）與只測它的測試。
   - 海洋觀測站兩支 hook 的預設透明度不一致（`useMarineObservationLayer` 0.9 vs `useMarineObservationLayers` 0.85）→ 兩者都改讀 `paramDefault`。
   - `wasteMapboxLayers.ts:98-110` 用模組層級變數記主題：若能改成參數傳入且改動 < 30 行就改；否則加註解說明，不要大重構。

## 4. 10 層改成 B（使用者 2026-09-29 拍板）

這些點的大小代表資料數值（規模、雨量、水位、數量），**保留原本依資料決定的半徑**，只統一描邊：

`animalAdoption`、`earthquakes`、`earthquakesGlobal`、`floodSensor`、`gfwHourlyTracks`、`groundwater`、`iotWraRiver`、`iotWraStructure`、`rainGauge`、`riverLevel`，以及 `earthquakeReplay`。

- `pointTiers.ts` 的 `HOOK_POINT_TIERS` 把以上 key 改成 `"B"`，註解補「資料驅動半徑，2026-09-29 拍板」。
- 各 hook：半徑**完全不動**；固定描邊換成 `pointStrokePaint(...)`；依資料變化的描邊照原則 2-1 保留。
- `earthquakeReplay`：只處理**站點** circle；波前、震央等回放裝飾不動。
- 有靜態光暈的照 `handoff-r2-hooks.md` §5 處理（靜態 → 透明度 0 但保留子圖層；即時 → 上限內）。地震、雨量、水位、淹水、IoT 都算即時資料。

## 5. 需要在瀏覽器確認

- **日本宗教設施（國土地理院，約 16.7 萬點）低縮放**：原本 z4–z8 刻意把描邊寬設 0，避免點糊成一片。開 z4、z6、z8 各截一張。
  - 若糊成一片：描邊寬改成 `["interpolate", ["linear"], ["zoom"], 8, 0, 9, 1]`（z8 以下不畫描邊），這是允許的例外，要在回報註明。
  - 同樣檢查其他超過 5 萬點的 hook 層（有的話）。
- **截圖清單**（暗／淡各一張，存 `/tmp/r2-hooks-fix/`）：AQI、颱風（含預測點）、日本警察設施（找得到 degraded 點的地方）、北市抽水站、衛星、地震、雨量站、日本宗教 z4／z6。
- **瀏覽器操作注意**：agent-browser 要帶 WebGL 參數（`--args "--enable-unsafe-swiftshader,--use-gl=angle,--use-angle=swiftshader,--ignore-gpu-blocklist,--enable-webgl"`），不要平行開多個截圖。圖層參數（滑桿）要在 UI 上操作；用 import 呼叫 `layerParamsStore.setParam` 不會傳到地圖。開關圖層可以用 `layerVisibilityStore.setVisibility`。
- **驗證「拖透明度不重抓」**：在 Network 或 console 確認拖橋梁雨量、衛星的透明度時沒有新的資料請求、沒有重算。

## 6. 驗收（全部過才 push）

- `npx tsc -b` 通過（禁用 `--noEmit`）。
- `npx vitest run` 全套通過。`capabilityAudit`、`pollutionPenaltiesDataset`、`explorationBoundary` 在高負載可能逾時，單獨重跑通過即可，回報裡註明。
- 黃金快照不變：跑 dump 後 `git diff src/data/__tests__/__fixtures__/layer-golden.json` 為空。
- design guard（`src/styles/__tests__/designSystemGuard.test.ts`）通過，不可用改基準繞過。
- `npm run design:audit-layers` 重產並 commit；盤點變動只應出現在 R2 hook 名單的 key。

## 7. 回報格式（完成後回覆主 session）

1. commit 清單（hash＋一行說明）。
2. §3 每一項：怎麼改、檔案:行、驗證方式。
3. §4 的 10 層：每層原本的描邊是「固定」還是「資料編碼」，最後怎麼處理。
4. §5 截圖路徑，以及日本宗教低縮放的判斷。
5. §6 驗收結果（貼測試總數與逾時重跑結果）。
6. **停下來沒做、需要主 session 或使用者決定的事**（沒有就寫「無」）。
