# Handoff — 切主題不重抓資料＋關閉的圖層不建資料來源（給 Codex）

> 指派者：使用者（手動轉交）。完成後回報給 Claude session 驗收，**不要自行 merge**。
> Repo：`mini-taiwan-pulse`。從最新 `origin/master` 開分支；worktree 開在 `.worktrees/<名稱>`，`node_modules` symlink 到 `../analysis-prod/mini/node_modules`。主目錄、`analysis-prod`、`research-streamline`、`transport-facilities` 有別人的工作，不要動。監看模式（Monitor）另有 session 在做，**不要碰 `src/components/intel/monitor/`、`MonitorPanel`**。
> 先讀：`docs/perf-audit-2026-09-30.md`（上一輪效能改造，量測方法 §4 照用）、`.claude/pitfalls/2026-09-30-hidden-layer-paint-transition.md`、`docs/development-rules.md` §8（動態圖層時間訂閱）、`docs/design-system/README.md`「已知未修」。

本包分兩個 PR，**依序做**：

| PR | 內容 | 風險 |
|---|---|---|
| **P1** | 切主題（暗／淡）或改透明度時，hook 不得重新抓資料或重建 source | 低：逐 hook 拆 effect |
| **P2** | 開站時只建「可見」圖層的 source／layer，其他第一次打開才建 | 中：牽涉圖層疊放順序、點擊登記、style 重載 → **先交設計說明、停下來等驗收再實作** |

## P1 切主題不重抓資料

### 背景

規則（`CLAUDE.md` 原則、design system README）：**主題、透明度只能改樣式（`setPaintProperty`），不可觸發重新抓資料、`setData`、`removeLayer`／`addLayer` 或重算。** README 列的既有違規 hook：淹水感測、地下水、水利 IoT、河川水位、雨量、漁船軌跡、抽水站、清潔隊。R3b（#475）已順手修了 3D 建物、不動產行政區、淹水等時圈、日本醫療圈，**這份清單可能已過時，第一步要重新量**。

### 做法

1. **量測先行**：寫一支量測（瀏覽器 agent-browser 或單元測試皆可），對每個「有自己 hook 的圖層」：開圖層 → 等載完 → 切主題暗→淡→暗、拖透明度滑桿 min→max → 記錄期間的 `fetch`／Supabase RPC 次數、`source.setData` 次數、`addLayer`／`removeLayer` 次數。**分開量測、分開驗收**：(a) 純樣式變更（改透明度、同一底圖內的樣式切換）：fetch／setData／addLayer／removeLayer 全部應為 0；(b) 換底圖（暗→淡會 `setStyle` 換不同 style URL，自訂 source／layer 會被清掉）：網路 refetch 必須為 0，但允許在 `style.load` 後 `addLayer` 重建與用快取資料 `setData` 回填。把結果做成表：圖層｜換底圖 refetch／（允許的）重建與回填｜改透明度 fetch／setData／rebuild。
   - 包 `window.fetch`、`map.getSource(id).setData`、`map.addLayer`／`removeLayer` 計數即可（上一輪 R3b 報告有同類做法）。
   - 時間相關圖層（雨量、河川水位等）量測時**暫停時間軸**，避免把正常的時間推進算成重抓。
2. **逐 hook 修**：把「抓資料／setData」的 effect 與「樣式」的 effect 拆開；`isDark`、`isDarkTheme`、透明度、顏色等只放在樣式 effect 的 deps，裡面只呼叫 `setPaintProperty`（或 `setLayoutProperty`）。抓資料 effect 的 deps 只留資料相關（可見性、時間視窗 dateKey、篩選條件）。
   - 動態圖層禁止把 `currentTime` 放進 deps，走 timeStore 訂閱（development-rules §8）。
   - 換底圖（`setStyle`）會清掉自訂 source／layer；原本若是靠 `isDark` 變動「順便」重建，拆開後要改成監聽 `style.load` 重建（只在 style 真的重載時），不要靠主題 deps。
3. **護欄**：能機械檢查的加測試（例：指定 hook 檔的抓資料 effect deps 不得含 `isDark`／`opacity`；或量測腳本的結果 snapshot）。

### 驗收

- 量測表：修前／修後，修後純樣式變更全部 0、換底圖 refetch 為 0（重建與快取回填不計；其他例外要寫原因，例如圖層本身依主題換資料檔）。
- 換底圖（暗↔淡↔衛星）後圖層仍正確顯示、資料不重抓（style 重載只重建，不重抓）。
- `npx tsc -b`、`npx vitest run` 全套（research 類高負載逾時可單獨重跑）。

## P2 關閉的圖層不建資料來源

### 背景

`src/map/overlayManager.ts` `addAllOverlays()` 開站時對 registry 約 318 組 config 全部 `addSource`＋`addLayer`，再把不可見的設 `visibility: none`。PMTiles 在隱藏時不抓圖磚，但 **GeoJSON source 一建就下載並解析**，style 重載（換底圖）時又全部重來。目標：開站與換底圖只建可見圖層；其他第一次被打開時才建。

### 必須先想清楚的事（寫進設計說明）

1. **疊放順序**：registry 順序＝圖層上下順序。晚建的圖層不能直接疊到最上面。可參考 #464 的 3D `three-layers-anchor` 佔位圖層做法，或在建立時找「registry 中排在它後面、已存在的第一個圖層」當 `beforeId`。要證明「全部打開時」順序與現在完全相同。
2. **所有引用 layer id 的地方**：`gisClickRegistry.ts`（點擊）、`queryRenderedFeatures({ layers })`、`map.on("click", id)`、`moveLayer`、`setPaintProperty`、`getLayer` 判斷、hover／選取圈、圖例或 popup 讀 paint、`jpHeightLifecycle.ts`、`setOverlayVisible`、`updateAllOverlayThemes`、`applyLayerOpacity`、paint 暫存（`setPaintPropertyGuarded`）。不存在的 layer 傳給 `queryRenderedFeatures` 會丟錯；逐一列出並說明怎麼處理。
3. **style 重載**：換底圖後要重建「目前可見＋曾經建過」還是只「目前可見」？選一個並說明理由。
4. **深連結、會員場景、All Off、統計顯示模式**（`statisticsDisplayModeStore`）、Agent 研究控制（`src/research/` 透過 `pulse_set_layers` 開圖層）：打開路徑都要能觸發「第一次建立」。
5. **載入提示**：第一次建立時的下載要接 `loadingRegistry`（design system §5.30 載入狀態條），不能靜默。
6. **黃金快照**：快照是從 registry 抽 config，不受 lazy 影響；確認測試仍有意義。

**設計說明**寫成 `docs/features/perf-lifecycle/P2-design.md`，commit、push、回報後**停下來**，等 Claude 驗收設計再實作。

### 驗收（實作後）

- 量測：開站（預設圖層）時的 GeoJSON／PMTiles 請求數、`addSource` 數、首屏到 `allReady` 時間，修前修後對照；換底圖同樣量一次。
- 全部圖層打開後，`map.getStyle().layers` 的 id 順序與 master **完全相同**（寫測試或腳本比對）。
- 抽 10 個圖層（含 GeoJSON、PMTiles、有點擊 popup、有 hover、有自訂 hook 的）：第一次打開能顯示、點擊 popup 正常、關閉再開不重抓。
- All Off、深連結（`?v=1&layers=...`）、Agent 開圖層都正常。
- `npx tsc -b`、`npx vitest run` 全套。

## 共同鐵則

- 不改資料來源 URL、popup 內容、圖層 id、圖例；只改生命週期與 effect 結構。
- 主題、透明度只改樣式。
- dev server 用 port **3753**（`npx vite --host 127.0.0.1 --port 3753 --strictPort`）；worktree 缺大型圖資時，用暫時的 vite 設定把 `publicDir` 指到主目錄 `public/`（該設定檔不 commit）。**絕不 `pkill -f vite`**，用 `lsof -ti tcp:3753 -sTCP:LISTEN` 找 PID 再 kill。agent-browser 帶 WebGL 參數（`--enable-unsafe-swiftshader,--use-gl=angle,--use-angle=swiftshader,--ignore-gpu-blocklist,--enable-webgl`），不要平行截圖，深連結帶 `v=1`。
- 不讀 `.env`、不 curl vite 轉譯後的模組（會印出金鑰）；`.env` 需要時 symlink，不讀內容。
- 本機 `grep` 被覆寫；否定結論用 `rg` 或 `/usr/bin/grep`。
- 不 `reset --hard`／`checkout -- .`／`clean -fd`；看到不是你改的檔不要碰、不要 revert。
- 對照頁或截圖若要 commit，用 JPEG 且整頁 ≤ 5MB（不要內嵌 PNG）。
- commit 用 Conventional Commits；可以 push、開 PR；**不要 merge**。
- 文件：P1、P2 各自在 `docs/design-system/README.md` 進度表與「已知未修」、`CHANGELOG.md`、`docs/perf-audit-2026-09-30.md` §3（或新增一段）更新。

## 回報

- P1：PR＋量測表（修前／修後）＋改了哪些 hook（檔案:行號）＋例外與原因。
- P2 設計：`P2-design.md` 路徑＋上面 6 個問題的答案。
- P2 實作：PR＋量測對照＋圖層順序比對結果＋抽測清單結果。
