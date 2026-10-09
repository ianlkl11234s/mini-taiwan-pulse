# R6 提案：Three.js 圖層加「平面點線面」模式

> 2026-10-05 使用者拍板。盤點：[`R6-inventory.md`](./R6-inventory.md)；交接：[`handoff-r6.md`](./handoff-r6.md)；選擇頁：[`r6-picks.html`](./r6-picks.html)（11 題太細，改為只問 2 題，其餘照建議、到各段對照頁再調）。

## 使用者決定

| 題 | 決定 | 原話／備註 |
|---|---|---|
| 預設模式 | **移動物件預設立體，其他預設平面** | 修訂 09-28 G-1「全部預設 Mapbox」；移動物件保留發光拖尾當門面 |
| 移動物件 | **做平面版，分兩段**：先小量（垃圾車、台鐵列車、飛機），看過對照頁再做大量（公車三層、船、垃圾車班表、漁船軌跡） | |

## 照建議、對照頁再確認（未逐題問）

- **範圍**：一類（已有平面版）只加開關；二類（機組出力、水庫水位、區域用電、垃圾設施五類）做平面版＋補圖例；三類（實價登錄、歷史航跡）本輪不做；風場、洋流不納入。
- **開關**：每層設定一個「立體／平面」切換，放顏色附近；沿用現成 select／toggle（先例 `railTrackMode`、`fireStations3D`），不新增 kind。已有的 `fireStations3D`、`tempExtruded` 併入同一語意。
- **移動物件平面畫法**：每幀插值平滑移動；只有點選的物件畫軌跡；拉遠圓點、拉近換箭頭（箭頭受 P-5 5 千點上限，大量層另議）。
- **效能**：大量層拉遠抽樣（照 P-4 用熱區、不用聚合）＋降更新頻率。

## 分段

| 段 | 內容 | 預設 |
|---|---|---|
| 1 | 切換機制＋一類（地震漣漪、消防站、燈塔、輸電線／夜景發光、車站光柱、溫度波、地下水監測井）；同步改 `map-layers.md` G-1 預設規則（電廠／變電所 Bloom 測試層不動，見下）| 平面 |
| 2 | 二類平面版＋圖例 | 平面 |
| 3 | 小量移動物件（垃圾車、台鐵列車、飛機）：插值抽成純函式、平面點＋箭頭 | 立體 |
| 4 | 大量移動物件（公車三層、船、垃圾車班表、漁船軌跡）：抽樣／降頻 | 立體 |
| 延後 | 三類（實價登錄、歷史航跡） | — |

每段一支 PR 到 `develop`、一般 merge、CI 綠才合；實作前後附真實截圖對照頁（暗／淡、拉遠／拉近、移動物件動態），使用者確認再進下一段。待複核：區域用電是否孤兒、公路客運點選註解不一致（段 2／4 處理時查）。

## 段 1 決定（2026-10-05）

1. **溫度波採 A 案**：「立體效果」關時，溫度波改顯示既有 Mapbox 溫度網格（同 `temperatureGrid` 的原生 fill，可點選、有圖例，透明度跟溫度波自己的滑桿）；開啟才是 Three.js 溫度波。`temperatureGrid` 自己那個 key 的行為不變。
2. **Bloom 測試層不動**：`powerPlantGlow`、`substationEhvGlow` 維持測試層原樣，不加「立體效果」toggle。
3. **移出背景預載**：段 1 的立體模組（夜景 bloom、輸電線 glow、地震漣漪）不再於開任一圖層後背景預載，使用者開啟立體效果時才下載；3D bundle 的載入判斷改看各層 toggle（開車站但光柱關不下載）。bundle 本身仍與移動物件共用，照舊預載。

## 段 3 實作紀錄（2026-10-06）

**範圍縮為台鐵列車＋垃圾車 GPS**（使用者同意）：`rail`（同一層含高鐵、捷運列車）與 `wasteTruck`。**飛機不動**；船、公車三層、垃圾車班表、漁船軌跡留段 4。對照頁：[`r6-s3-compare.html`](./r6-s3-compare.html)。

| 項目 | 做法 |
|---|---|
| 開關 | `rail.railTrain3D`、`wasteTruck.wasteTruck3D`，label「立體效果」，**預設開**（移動物件預設立體），`out: null`。列車的開關只在「列車」顯示時出現（`showWhen railTrainVisible`）。 |
| 與「軌道」2D／3D 的關係 | 2026-10-09 決議改為連動：列車平面（`railTrain3D=false`）時軌道有效值一律 2D（`effectiveRailTrackMode()`，`src/map/railTracks.ts`），立體開時照 `railTrackMode`；存值不改寫，面板以 `disableRule` 停用 3D 選項並顯示「3D（列車平面時用 2D）」。`rail-3d` 這個 Three 圖層在「3D 軌道」或「列車立體」任一成立時才畫（`railThreeVisible`）；兩者都關（軌道 2D＋列車平面）時 Three 不畫、不 repaint，也不因 rail 觸發 3D bundle 下載。 |
| 插值抽取 | 垃圾車：`WasteTruckScene` 內的 GPS 三種插值、matched polyline progress、live 落後 5 分鐘原樣搬到 three-free 的 `src/data/wasteTruckFrames.ts`（`computeWasteTruckFrames`），Scene 與平面共用；另加純函式方位角（前後 20 秒取樣）與點選近段軌跡。列車：位置本來就在 `RailEngine`／`TraTrainEngine`（three-free）算，新增 `interpolateWithBearingOnLineString`（位置與原函式逐字相同、同一次走訪），引擎輸出 `bearing`（依行進方向，停站時朝下一站），暫停或拖時間軸時方向也正確。 |
| 平面畫法 | `src/map/flatMovingLayers.ts`：circle 點三階（M 4.5px；垃圾車停車／離線 S 3px，對應立體 ×0.6）、P-2 底圖色描邊、主體 0.85；色＝立體版同一來源（`train.color`、`WASTE_STATUS_COLORS`）；大小滑桿（光點）與垃圾車透明度滑桿兩模式共用。**z ≥ 12** 有方向的物件換 SDF 導航箭頭（P-5 L 階 13px、`icon-rotate`＝方位角、貼地、不避讓、halo 1px 描邊），算不出方向（停著）的維持圓點。不畫拖尾；只有點選的物件畫近段軌跡（列車：平面模式下累積的 3 分鐘位置；垃圾車：往前 10 分鐘插值取樣）。音符在平面模式不顯示。 |
| 更新節流 | `src/map/flatMovingController.ts`：`timeStore.subscribeThrottled(40ms)`（約 25fps）→ RAF 合併 → `setData`；暫停＝不更新、頁面隱藏＝RAF 不跑。參數／可見性／資料／主題各自 store 訂閱觸發一次。不把 currentTime 放進任何 deps。換底圖後自動重建圖層與箭頭圖。 |
| 點選 | `useMapInteraction`：立體關時改用 Mapbox `queryRenderedFeatures`（半徑 25px，同 Three 拾取門檻）找回原物件，沿用既有 train tooltip／`wasteTruck` featureInfo；立體開照舊 Three 拾取（立體關時 Scene 停更新，不再用它，避免點到舊位置）。 |
| 圖例 | `wasteTruck` 補 LG-1 單列（所有狀態同一色，不另造類別）＋註記；兩層在平面模式加 LG-6 箭頭列（`SwatchArrow`，與地圖同形狀）。`rail` 色票兩模式相同。 |
| Agent | `research/layerControls` 由規格自動帶出「立體效果」toggle（測試鎖住）。 |

待使用者決定：
1. ~~軌道離地 110m 與平面列車的位移~~ → **2026-10-09 決議**：列車平面時軌道自動 2D（有效值推導、不改寫存值；Three 判斷同用有效值，列車平面時不因 rail 觸發 3D bundle）。邊角：列車隱藏時「立體效果」toggle 被收起，但它若是關的，軌道仍走 2D（與面板停用規則一致）。
2. ~~音符滑桿~~ → **2026-10-09 決議**：wasteTruck 的音符兩支滑桿掛 `showWhen: wasteTruck3D=true`，平面模式收起；值仍與 `wasteSchedule` 共用（sharedGroup 守門改為比對時剔除只管渲染的 `showWhen`），表定那層照常顯示。
3. **點選軌跡隨 tooltip 消失**：train tooltip 既有行為是地圖一移動就關閉，平面模式的列車軌跡跟著清掉；列車軌跡只在播放時累積（剛點選、暫停中只有目前位置）。

段 3 子代理自行決定（請確認）：
- 平面圖層建在樣式最上層（不放 3D 錨點之前）；2D 軌道晚加入時以 `styledata` 把列車層移回軌道之上（`railTracks.ts` 匯出 `RAIL_TRACKS_LAYER_ID`）。
- 列車方位角在引擎內算（`RailTrain` 加選填 `bearing`），兩支引擎改呼叫同一次走訪的新函式（位置與舊函式逐字相同，測試鎖住）。
- `rail` 在「列車隱藏且軌道 2D」時不再算作需要 3D bundle（以前會下載但沒東西畫）。
- 箭頭用 L 階 13px（9px 看不清方向）；垃圾車停車／離線用 S 階。
- `HOOK_POINT_TIERS` 文件表格數量更新為實際值 2／102／6／16／126（改前文件已是舊值 122）。
- 圖例共用元件新增 `SwatchArrow`（LG-6），活元件頁與 spec §9 同步。
