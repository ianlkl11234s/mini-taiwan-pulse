# 比較模式 P0 試驗（spike）結果

> **試驗分支，不合併。** 設計文件：`docs/features/compare-mode/DESIGN.md`（PR #1009）。
> 量測日期 2026-11-11；程式基準 `origin/develop` @ `dda9caa0`。原型程式：`src/spike/compareSpike.ts`（只在 dev 且網址帶 `compareSpike=1` 時載入，`src/main.tsx` 加 4 行）。

## 0. 給使用者：用自己手機實測（最短步驟）

1. Mac 與手機連同一個 Wi-Fi。
2. Mac 終端機：
   ```bash
   cd "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/compare-spike"
   npm run dev -- --host --port 3792
   ```
   畫面會印出 `Network: http://<Mac 的區網 IP>:3792/`（macOS 若跳出防火牆詢問，按「允許」）。
3. 手機瀏覽器開（把 `<IP>` 換成上一步印出的位址）：
   ```
   http://<IP>:3792/?v=1&compareSpike=1&cmpAuto=0&cmpPanel=1&layers=statsDemographicsTownshipPopulationDensity&lat=23.75&lng=120.95&z=6.6&style=dark
   ```
   上方會出現黑色測試面板。等台灣人口密度圖出來後，依序按：
   1. **開比較** → 中間出現白線與圓形把手；
   2. **右側統計 2018** → 把手右邊變成 2018 年的人口密度（左邊是 2026 年）；
   3. 用手指拖圓形把手左右移動、在左右兩半各拖動／雙指縮放地圖，看兩邊是否同步、有沒有卡頓；
   4. **量平移 FPS**、**量拖把手 FPS**、**開關 10 次**（約 10 秒）。
4. 要看的事：
   - 有沒有白畫面、頁面自己重新整理、瀏覽器跳「此網頁發生問題」（iOS 記憶體不足時常見）；
   - 拖把手與平移是否順；把手左邊（被裁掉那半）點地圖時，跳出的是主站的區域資訊卡；
   - 開關 10 次後地圖還正常。
5. 回報：面板文字截圖一張（含 `device` 那行）＋手機型號與瀏覽器（例：iPhone 13／Safari、Pixel 6／Chrome）＋上面三項的「是／否」。
6. 測完在 Mac 終端機按 `Ctrl+C` 關掉 dev server。

可能卡住的地方：地圖整片空白而面板有出現 → 可能是 Mapbox 金鑰限制了網址來源（只允許 localhost／正式網域），請回報，不需要自己改設定。

## 1. 方法

| 項目 | 做法 |
|---|---|
| 原型 | 主站照常啟動；`compareSpike` 模組等 `window.__map` 就緒後，在主地圖容器後面插一個同尺寸容器，`new mapboxgl.Map` 建第二張地圖；容器用 `clip-path: inset(0 0 0 X%)` 裁成右半，把手 `role="slider"`＋pointer capture＋←→ 鍵 5%。鏡頭雙向同步：`move` → `jumpTo(center/zoom/bearing/pitch)`，防重入旗標。 |
| 右圖內容 | 同底圖（dark-v11）＋中研院 1904 臺灣堡圖 raster（`historicalMapSinica` 預設層 `JM20K_1904`）＋人口密度（鄉鎮）面量圖。 |
| 統計掛右圖 | **只讀現有程式**：取主地圖 store 的 `selection`，換 `releaseId` 與 `dimensions` 後直接呼叫 `loadRegionalStatistics`，色階用 `statisticsFillCase(statisticsRenderRecipe(...))`；**不經 `regionalStatisticsStore`、不寫 localStorage、不呼叫 `attachRegionalStatistics`**（避免 DESIGN §2.2 的共用狀態問題）。 |
| 桌機 | agent-browser（Chrome Headless Shell 145），`--use-angle=metal`，GPU 為 **Apple M3（真 GPU，非 SwiftShader）**，1440×900、DPR 1，dev build。 |
| 行動近似 | 同一顆 Chrome 以 CDP：`Emulation.setDeviceMetricsOverride` 390×844、DPR 3、mobile、觸控，`Emulation.setCPUThrottlingRate` 4×。**這不是實機**：GPU 沒有被節流（仍是 M3）、記憶體上限與 iOS Safari 的 WebGL 限制都沒有模擬。 |
| 幀率 | `requestAnimationFrame` 間隔，3 秒；平移＝每幀 `panBy`（主地圖帶、右圖跟著同步）；拖把手＝每幀改 `clip-path`。headless 不鎖 60 Hz，所以桌機上限約 120 fps。 |
| 記憶體 | JS heap：`performance.memory`（`--enable-precise-memory-info`、`--expose-gc` 後先 `gc()`）。GPU：macOS `footprint -p <Chrome GPU 行程>` 的 phys footprint（含 IOSurface／IOAccelerator 圖形記憶體）。 |
| map load | Resource Timing 數 `api.mapbox.com/map-sessions/v1` 請求次數（只記路徑，不記 query／token）。 |

## 2. 數據

### 2.1 桌機（M3、1440×900）

| 項目 | 數值 |
|---|---|
| 建第二張地圖（第一次，底圖未快取） | `load` 446 ms；首次 `idle` 2,746 ms（含 1904 堡圖圖磚） |
| 建第二張地圖（之後 10 次） | `load` 56–160 ms；首次 `idle` 366–476 ms |
| 右側統計載入（鄉鎮 368 面，2018-12） | 214 ms |
| 平移幀率：單地圖 | 118.6 fps（p95 10.3 ms，最長 18.1 ms） |
| 平移幀率：雙地圖＋右側統計＋古地圖 | 113.9 fps（p95 10.3 ms，最長 25.1 ms） |
| 拖把手幀率 | 119.5 fps（p95 10.0 ms，最長 15.1 ms） |
| JS heap（關 → 開 → 開＋統計） | 299.5 → 301.4 → 317.1 MB（統計 GeoJSON 約 +16 MB） |
| GPU 行程 footprint（關 → 開 → 開＋統計＋古地圖圖磚 → 關） | 163 → 245 → 358 → 168 MB（開比較 +82 MB；有內容時 +195 MB；關閉後回到原值） |
| 反覆開關 10 次 | JS heap 297.0 → 297.5 MB；GPU 行程 167 → 162 MB；`<canvas>` 數 1 → 1；console 無 WebGL context 警告 |
| map load | 每開一次 +1 個 `map-sessions/v1` 請求（1 次頁面載入＋13 次開啟＝14） |

renderer 行程 footprint 跳動大（879–1,284 MB，主要是主站本身），不作為判斷依據。

### 2.2 行動近似（390×844、DPR 3、CPU 4×；GPU 未節流）

| 項目 | 數值 |
|---|---|
| 主站就緒 | 18.6 s |
| 建第二張地圖（第一次／之後 10 次） | `load` 692 ms、`idle` 2,037 ms／`load` 185–261 ms、`idle` 496–573 ms |
| 平移幀率：單地圖 | 28.8 fps（p95 50 ms，最長 67 ms） |
| 平移幀率：雙地圖＋統計＋古地圖 | 31.2 fps（p95 41.8 ms，最長 83.7 ms）——與單地圖差異在雜訊內，瓶頸是主站本身的主執行緒 |
| 拖把手幀率 | 113 fps（p95 10.1 ms，有一次 167.6 ms 長幀） |
| JS heap（關 → 開＋統計） | 277.9 → 286.4 MB |
| 反覆開關 10 次 | JS heap 278.9 → 277.9 MB |
| map load | 1＋1＋10 次開啟＝12 個 `map-sessions/v1` 請求 |

截圖：`/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/5abff673-a4e0-478b-ad8b-3e7f7690082b/scratchpad/compare-spike-shots/`（不入 git）。

## 3. 行為觀察

| 項目 | 結果 |
|---|---|
| 被裁掉的那半是否攔截指標事件（DESIGN §6） | **不攔截（Chromium）**。`elementFromPoint` 在把手左側回傳主地圖；真實滑鼠點左側 → 只有主地圖收到 `click`、主站區域資訊卡正常跳出（西屯區、2026-08）。Safari、Firefox、iOS **未測**。 |
| 右側點擊 | 只有第二張地圖收到；主站資訊卡**不會更新**（仍顯示上一次左側的內容）。右圖的 `click` 處理拿得到 feature（area_code 10015110、2018 值 9.83）。→ P1 必須讓右圖另綁點擊、接到同一個 FeatureInfo，並標「右側・期別」。 |
| hover | 同上：右半的 hover 由右圖處理（游標變手指要右圖自己設），主地圖的 hover 效果在右半不會發生。 |
| 在右半拖曳／滾輪縮放 | 右圖動、主地圖同步（實測中心 120.95 → 121.47、縮放 7.6 → 8.0）；把手兩側邊界線像素對齊（截圖可見鄉鎮界在把手處連續）。 |
| 統計層掛第二張地圖 | **成功**。左 2026-08、右 2018-12 同時顯示。注意：人口密度的期別不只 `releaseId`，`dimensions` 的 `roc_year`／`month` 也要一起換（只換 releaseId 會對不上）——Q2 (b)「期別＋細項」的狀態模型要把 `dimensions` 當一等欄位。 |
| 古地圖 raster | 正常；1904 堡圖在 z7.6 有一塊整片黑色的圖磚（來源圖磚本身，非比較模式造成；P1 驗收時順便看主站同層是否一樣）。 |
| WebGL context 釋放 | `map.remove()` 會呼叫 `WEBGL_lose_context.loseContext()`（`node_modules/mapbox-gl/dist/mapbox-gl-unminified.js:89159`，3.18.1）；開關 13 次無「Too many active WebGL contexts」。 |

## 4. 單地圖 scissor 夾心（限時評估，約 15 分鐘）

在主地圖統計層前後各插一個 CustomLayer：前者 `gl.enable(SCISSOR_TEST)`＋`gl.scissor(右半)`，後者關掉。

- **pitch 0、無地形**：統計面與界線確實只畫在右半（截圖 `scissor-test-desktop.png`）。
- **pitch 60（主站傾斜時會自動開地形，`ensureTerrainIfTilted`）**：**完全不裁**，整層畫滿全畫面（截圖 `scissor-test-pitch60-terrain.png`）——地形 draping 先畫到離屏貼圖再合成，scissor 失效。
- 結論：**放棄 scissor 路線**。就算修好地形情況，同層左右不同期別仍要兩組 source／layer，省下的只有一個 WebGL context 與一次 map load。

## 5. 結論

1. **P1 可以照「雙地圖＋CSS 裁切」做。** 建立快（快取後 < 0.6 s 到 idle）、關閉後 JS 與 GPU 記憶體都回收、反覆開關無洩漏，同步與像素對齊沒有問題，被裁區域不攔截指標（Chromium）。
2. P1 要注意：
   - **點擊與 hover 要在右圖另綁**，接同一個 FeatureInfo（右半點擊目前不會更新主站資訊卡）。
   - 統計右側載入沿用本 spike 的做法（直接呼叫 loader、不寫 localStorage）或照 DESIGN §3 把 store 加命名空間；**`dimensions` 要與 `releaseId` 一起存**（URL 的 `cmpy` 也一樣）。
   - **GPU 記憶體是主要成本**：桌機開比較 +82 MB、有統計＋古地圖時 +195 MB。手機上這是最大風險。
   - 每開一次比較 = 一次 map load（`map-sessions` 請求數證實）；Q4 選 (a) 的計費影響照預期。
   - clip-path 不攔截指標只在 Chromium 驗過，P1 要補 Safari（含 iOS）與 Firefox；不成立就改「容器寬度裁切」備案（spike 未實作）。
3. **對 Q3（手機）的建議**：行動近似顯示主執行緒沒有因第二張地圖明顯變慢（瓶頸在主站本身），但近似**沒有限制 GPU 與記憶體**，而桌機量到的 +82～195 MB 圖形記憶體正是舊 iPhone 會被瀏覽器殺分頁的量級。建議**維持 (b) 退路**（手機不提供入口、開到比較網址退回單地圖並提示），等以下實機確認後再決定開放：

   仍需實機確認的清單：
   - [ ] 一支 iPhone（最好是 3–4 年前的機種）＋ Safari：開比較＋右側統計、平移 10 秒、開關 10 次，無白畫面／自動重整。
   - [ ] 一支中階 Android ＋ Chrome：同上，並記下面板的 FPS 數字。
   - [ ] iOS Safari 上把手左半點地圖，跳出的是主站資訊卡（clip-path 不攔截指標）。
   - [ ] 拖把手時頁面不會跟著捲動或觸發瀏覽器返回手勢。
   - [ ] 手機直向是否要改上下分割（DESIGN §3「手機」）：實機看左右分割在 390 寬是否還好用。

## 6. 沒做／限制

- Safari、Firefox、實體手機都未測；GPU 記憶體只有桌機 macOS 的數字。
- dev build 量測（StrictMode、未壓縮），絕對值偏高；比較的是增量。
- 右圖只放了一層統計與一層古地圖，沒有測多層統計同時在右側。
- 沒做 UI（側別選單、右側期別選單、圖例、URL 參數）——屬 P1。
