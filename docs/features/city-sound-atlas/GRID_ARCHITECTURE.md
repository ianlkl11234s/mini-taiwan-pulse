# 聲景全範圍網格架構（W6-1 起）

> 第一個上網格的是雨（W6-1，2026-11-12），第二個是道路車流（W6-2，同日）。網格定義與量測見 [W6_GRID_SPIKE.md](./W6_GRID_SPIKE.md)；模型決定見 [MODEL_DECISIONS.md](./MODEL_DECISIONS.md) §7（雨）、§8（道路）。

## 1. 分層

| 層 | 檔案 | 職責 |
|---|---|---|
| 網格定義 | `src/sound/grid/gridSpec.json`／`gridSpec.ts` | 北北 250 m 網格（292×285、row 0＝北）、縣市遮罩、`GRID_UNKNOWN=255`；Python 與 TS 共讀 |
| 分級表 | `src/sound/grid/rainClasses.json`／`rainClass.ts`；道路 `soundProfiles.ROAD_GRID.potentialClassEdges`＋`roadNetwork.roadGridCode` | 分級門檻、Z-R、未知碼；分級規則只在這裡 |
| 預算包（需要時） | `scripts/preprocess/sound/build-sound-*.py --publish` → `public/sound-atlas/grid/*.class.bin`＋`.meta.json` | 每日一包，gzip 的 uint8（幀主序：`frame * cells + cell`）；meta 記網格參數＋sha256、幀時刻、缺幀、分級版本 |
| 包讀取 | `src/sound/grid/*Pack.ts` | fetch＋loadingRegistry、驗 meta（網格 sha 不符就拒用）、解壓、查某格某區間 |
| 估計（單點） | `sourceAdapters/*Adapter.ts` 的 `*EstimateAt` | **網格、接收點查詢、格 popup 共用的同一支**（網格值＝queryReceiver 值） |
| 估計（整幀） | `src/sound/grid/*Grid.ts` | 只做預先計算（每格最近站等），每格結果必須與單點估計一致；測試逐格比對 |
| 渲染 | `src/map/soundGridCustomLayer.ts` | 通用：分級碼 → 色表；255 畫斜線；遮罩外不畫；透明度 uniform |
| 計算（W6-4 起） | `src/sound/grid/soundGrid.worker.ts`＋`gridComputeCore.ts`／`gridWorkerHost.ts`；主執行緒端 `soundGridClient.ts` | 所有整幀計算（含建場、綜合）在 Web Worker；見 §6 |
| 接線 | `src/hooks/useSoundGridLayer.ts`（各族 `useSound*GridLayer.ts` 是薄包裝） | timeStore 節流訂閱、10 分一格、向 Worker 要幀、只套最後一次請求、等待中註冊 loading |
| 點選查詢（W6-5 起） | `src/sound/grid/pointQuery.ts`＋`*GridState.ts` 的 `*CellInfo`；面板 `components/sound/SoundCellSection.tsx` | 接收點所在格、此 10 分格：七族格資訊（對格心呼叫單點估計）＋Worker 回的七個碼（綜合）；各族格子 popup 已停用 |

## 2. 渲染器介面（`createSoundGridLayer`）

```ts
createSoundGridLayer({ id, getOpacity, mask, hatch: { color, alpha }, onUploadMs? }): SoundGridLayer
layer.setPalette(paletteFromClasses(colors, alphas)) // 256×1 RGBA，索引＝分級碼
layer.setFrame(values | null)                         // 長度 GRID_CELLS 的 uint8；null＝不畫
```

- 貼圖 LUMINANCE_ALPHA 292×285（值＋遮罩），每列一條 quad strip（Web Mercator 下列內緯度線性），所以格邊與 gridSpec 一致。
- 255 一律是螢幕座標斜線（不是色表的一格），所以「無法判斷」在所有族長相一致。
- zoom < 6（地球模式）不畫。

## 3. 每日包格式（以雷達雨 `pulse-sound-radar-rain-v1` 為例）

- `radar-rain-<D>.class.bin`：gzip 後的 uint8 陣列，長度 `144 × 83,220`（幀數 × GRID_CELLS），幀主序，`frame k` 的第 `row·292+col` 格。值＝分級碼 0–4，255＝無法判斷（缺幀整幀 255、雜波格 255）。
- 讀取端先看前兩個 byte 是否 `1f 8b`：是才解壓（dev server／CDN 可能已解過）；解完長度必須等於 meta 的 `raw_bytes`。
- `radar-rain-<D>.meta.json` 主要欄位：
  - `schema`、`date_taiwan`、`product`（O-A0058-005）、`generated_at`
  - `grid`：`id`、`west`、`north`、`dLon`、`dLat`、`cols`、`rows`、`sha256`（gridSpec.json 的雜湊，前端不符就拒用）
  - `payload`：`file`、`encoding`、`dtype`、`layout`、`bytes`、`raw_bytes`、`sha256`
  - `frames`：`count`、`step_s`=600、`first_slot_utc`、`slot_rule`（frame k＝[first_slot + 600k, +600)）；`frames_missing`：缺幀索引
  - `classes`（分級版本與門檻）、`zr`、`palette`（色表版本）、`transparent_rule`
  - `clutter`：`rule`=clutter-v1、`min_dbz`、`jump_db`、`neighbor_cells`、被標的格數（bbox／北北內）與各幀明細
- 其他族沿用同樣的 bin＋meta 形狀，`schema` 改成 `pulse-sound-<family>-v1`。

## 4. 新增一族網格的步驟

1. 若需要預算（影像、大量測站）：寫 `build-sound-<family>.py --publish`，輸出 `<family>-<D>.class.bin`＋`.meta.json`，用 `build-public-assets-lock.py add` 登記；`.gitignore` 已含 `public/sound-atlas/grid/`。
2. 在該族 adapter 抽出 `<family>EstimateAt(records, lon, lat, t0, t1)`，讓 contribution 與網格共用。
3. 寫 `<family>Grid.ts`（預算＋整幀），測試仿 `src/sound/__tests__/rainGrid.test.ts`：合成資料逐格比對 0 不符；有真實資產時再跑真實日（無資產自動略過，CI 不依賴）。
4. 色表放 `soundAtlasColors.ts`（分級色＋每級透明度）；圖例與 popup 的級名放 i18n。
5. hook 仿 `useSoundRainGridLayer`；layer id `sound-atlas-grid-<family>`，放在 `sound-atlas-route-line` 之前。
6. manifest 的 popup 陣列加 `sound<Family>Cell`、params 若有新開關一併登記；重產 layer-golden 與樣式盤點。

## 4a. 道路車流的差異（W6-2）

- **不預算整幀**：網格值在前端算（kernel 只在 TS）。靜態路網 `road-network-v1.json`（路段折線、證據種類、VD 對應、等級）＋每日 `freeway-vd-<D>.json`（每支 VD 144 格的 1 分鐘流量，null＝QA 剔除或缺）。都在 `public/sound-atlas/grid/`、lock 登記、gitignore。
- **集合形狀**：`sets.road_traffic.records` 只有**一筆** `road_network` record（payload＝編譯後路網＋當日脈絡），不是每條路一筆；coverage 一筆 provider `sound_road_network`。國道包缺、臺北非平日只讓對應候選變無法判斷，不讓 coverage 變 error。
- **整幀**：`buildRoadGridField` 預先算每格的近鄰道路（只跟路網有關，換日不重建，約 100–135 ms）；`roadGridFrame` 每格呼叫同一支 `roadEstimateFromNear`，同一來源同一格只算一次流量項（每幀 3–11 ms）。
- **碼**：證據基底＋五級（國道 0–4、臺北典型 10–14、新北推估 20–24），255＝無法判斷；色表由 `roadGridPalette()` 依 `ROAD_EVIDENCE_BASE` 組。0 同時代表「很低」與「離路遠」（都不是缺資料）。
- **Python 測試**：`python3 -m unittest scripts/preprocess/sound/test_road_grid_lib.py`（QA、里程切段、路名、延伸規則）。

## 4b. 連續潛勢五族的差異（W6-3）

- **共用**：碼 `src/sound/grid/potentialCode.ts`（0／1–200／255，刻度 1/200）；hook `useSoundPotentialGridLayer(map, family, visible, opacity, gate)`，layer id `sound-atlas-grid-<family>`；狀態與點格查詢 `potentialGridState.ts`（W6-3 時是 popup layerType `soundPotentialCell`；W6-5 起改由點選查詢面板呼叫 `potentialCellInfo`，對格心即時呼叫 `queryFamilyInterval`）；色表 `SOUND_POTENTIAL_GRID_COLORS`（飛機粉紅、鐵道黃→橄欖、風萊姆→深綠、浪青、河川翠綠），0 級淡灰、斜線同雨。
- **全北北來源檔**（`gridSources.ts`，Python `scripts/preprocess/build-sound-grid-sources.py` 產生，`SOUND_S3_LOCAL_DIR` 指本機 S3 快取）：`aviation-src-<D>.json`（航跡，網格外框外擴 23 km 內有段落的航班）、`rain-gauge-<D>.json`（雨量站逐時列）、`natural-<D>.json`（風、浪、河川觀測＋近岸海域面＋河道線，同場景快照 natural 區塊格式）。`loadSoundFamily` 在接收點不存在或在網格外框內時先讀這些檔（origin＝grid），讀不到才走快照／即時。
- **飛機**：唯一要預算的。`scripts/preprocess/sound/build-sound-grid-packs.ts aviation <D…>`（vite-node，kernel 在 TS）→ `aviation-<D>.{class.bin,meta.json}`（`pulse-sound-potential-v1`，144 幀、frame-major、gzip，只存分箱碼），一天約 71 s。
- **鐵道**：前端每幀即時算（`railGrid.ts`）。冷算一幀 node 量到 70–280 ms（尖峰時段最慢），超過 50 ms → hook 以 10 分格快取（36 格）＋閒置時預算前後各一格；播放與來回拖曳時換幀是查表。段組外框下界剪枝（每 16 段一組，下界 ≥ 目前最短或 > 1.5 km 就跳過），結果與逐段完全相同。
- **自然三族**（`naturalGrid.ts`）：每格空間項（樹冠／離岸／離河距離、最近站、站點範圍）建一次（node 190–650 ms），每幀只算每站時間項，換幀 1–5 ms。樹冠每格值 `canopy-cells-v1.{bin,meta.json}`（`build-sound-grid-packs.ts canopy <scratch 30 m 格網>`，19,968 B）。
- **測試**：`src/sound/__tests__/potentialGrids.test.ts`（碼、分箱、門檻、包解碼；真實 11-09／10-24 五族各 ≥200 格 × 4 區間比對 queryReceiver，資產不在就略過）。

### 4b.1 量測（node，2026-11-12）

| 項目 | 11-09 | 10-24 |
|---|---|---|
| 飛機每日包（gzip） | 358,157 B | 295,129 B |
| 飛機來源檔（原始／gzip） | 1,194,152／323,032 B | 683,004／189,044 B |
| 雨量站來源檔（原始／gzip） | 1,929,611／53,255 B | 1,841,519／75,671 B |
| 自然來源檔（原始／gzip） | 1,318,610／380,026 B | 1,317,848／383,553 B |
| 自然三族換幀 | 1.0–4.9 ms | 0.7–2.8 ms |
| 鐵道冷算一幀（班表範本） | 68–279 ms（閒置）；verify 平行跑時 141–770 ms | — |

- 瀏覽器（dev server、SwiftShader、11-09）：鐵道冷算一幀 64–101 ms、快取或預算過的格 0.6 ms（**冷跳轉未達 50 ms 目標**）；自然三族與飛機換幀都在 5 ms 內。
- 比 W6 spike 估計大：飛機包 358 KB（估 236 KB，因多存三個門檻箱界）；鐵道沒有做每日包（估 109 KB/日），改前端算。

## 5. 量測（W6-1，dev server、SwiftShader、taipei-1109）

- 切 30 個不同 10 分格：算幀中位 3.4 ms、最大 14.3 ms；上傳貼圖中位 0.1 ms、最大 1 ms（需求 < 50 ms）。
- 淺色底圖：斜線清楚；但「無雨」（透明度 0.14 的灰）在淺底幾乎看不出來，和範圍外難分（未調整，待決）。
- 包大小：11-09 92,688 B（128/144 幀）、10-24 153,499 B（139/144 幀）。
- W6-2 道路（dev server、SwiftShader）：建近鄰 96 ms（瀏覽器）／135 ms（node）；整幀 3–11 ms（瀏覽器實測 11.2 ms），上傳 0.1 ms。淺色底圖斜線與分級都清楚。資產：路網 1,389,342 B（gzip 348,831）、11-09 包 189,776 B（gzip 49,660）、10-24 包 185,450 B（gzip 42,917）。

## 6. Web Worker、綜合網格與點選查詢（W6-4／W6-5，2026-11-12）

### 6.1 Worker

- **主執行緒只送資料、收幀、上傳貼圖**。`soundGridClient()`（全站一個）訂閱 `soundAtlasStore`，七族 set 換了才送：鐵道軌道打包成 Float64Array（transfer，同一條軌道只送一次）＋班次 JSON；道路路網只送一次；飛機改送每日包（主執行緒抓、驗來源 sha）；其他族整個 set structured clone。
- 送出佇列一個 task 只送一則，編碼也在那個 task 做 → 主執行緒單次阻塞＝單一族的編碼＋clone。
- Worker 端（`gridComputeCore.ts`）：每族 36 格快取、建場（雨量站場、道路近鄰、自然三族空間項）延到第一次要幀才做；同 key 請求排隊中被新請求取代（回 `superseded`）；閒置時預算鐵道前後各一格。
- hook（`useSoundGridLayer`）：以自己的序號只套用最後一次請求（跳時間時晚回來的舊格不蓋新格）；等待中註冊 `sound-grid:<layerId>` loading，沒回來前不畫（不會畫成全 0）；族版次一換先清幀。
- 沒有 Worker（node 測試）或建立失敗 → 同執行緒後備（同一個 host）。
- 測試：`gridWorker.test.ts`（編碼還原後幀相同、核心＝各族原函式、同格不重算（工作量計數）、請求取代、亂序回應只套最後一次、hook 不 import 算格函式）；`potentialGrids.test.ts` 的鐵道冷算改驗工作量（不看牆鐘）。

### 6.2 綜合網格 `soundComposite`

- 規則見 MODEL_DECISIONS §10。Worker 的 `composite(bin, gate)` 用同一個 10 分格的七幀算甲乙兩版（`compositeFrames`），一次回兩張；切版本只換色表與幀，不重算。
- 開綜合不必開七個單族圖層：`soundAtlasHost` 把七族當背景族交給 `useSoundAtlasLayer` 載入；七族都載完、飛機包抓完才請求。
- 色：靛藍單一色相、越深越多（`SOUND_COMPOSITE_A_COLORS`、`SOUND_COMPOSITE_B_RAMP`），和七族色分開；255 斜線同其他網格。

### 6.3 點選查詢

- 一個工具（面板「點選查詢：開／關」）：開著時點地圖任一處＝放／移接收點。點擊仲裁在 `useMapInteraction`：畫路線 > 點選查詢 > 其他 popup。
- 面板列：此刻前 5 個來源（原本）、**此格網格值**（綜合甲乙＋七族各一列，展開是原本的格子 popup 內容）、來源健康、路線、24 小時。網格外 → 「網格範圍外」。
- 關面板（X）＝關工具＋面板縮成一行，**不動圖層**（舊版 closeAll 會把十個聲景圖層全關，已修）；縮起後按「開啟點選查詢」恢復。面板內的開關只切工具、不縮面板（場景、畫路線、24 小時照常）。聲景圖層從全關到有開時，工具預設開。
- **取捨（待使用者確認）**：工具開著時，點地圖一律放接收點，其他圖層與聲景點位的 popup 點不到；要看 popup 先把工具關掉。

### 6.4 量測

瀏覽器（dev server 3746、SwiftShader、11-09 08:00、只開綜合；機器 load 10–25）：

| 項目 | 結果 |
|---|---|
| 主執行緒單次送出（編碼＋postMessage）最大 | 34–44 ms（鐵道 set）；雨 17–18、道路 7–9、河 6–8、風 3–4、浪 1、飛機 1 ms |
| 綜合幀套用（收幀＋上傳貼圖）最大 | 2.4–7.9 ms |
| 拖時間軸 08:00 → 10:28（套 7 幀） | 主執行緒 0 個 > 50 ms 長任務 |
| 點地圖放接收點（改版前） | 24h 構成一次算完 2,082–2,100 ms 長任務（七族背景載入後鐵道全日最慢） |
| 點地圖放接收點（`dayProfileSteps` 分段後） | 構成總計算 2.0–2.9 s 分成多段，最長一段 52–125 ms（單一鐵道 10 分區間無法再切）；放點當下單一 task 約 160–190 ms（未拆解；量到的只有：預篩 1–4 ms、當下查詢 5–14 ms、格資訊 20–35 ms 且一次放點跑了兩次，原因未查） |

- node（Worker 核心，同資料）：鐵道冷算一幀 79–131 ms、其他族 ≤ 10 ms；第一次建場最多雨 792／風 363 ms（都在 Worker）；綜合一幀 11–14 ms。
- **未達標**：放接收點當下約 160–190 ms、構成最長一段可到 125 ms，都在主執行緒（不是網格計算）；要再降需把 24h 構成與當下查詢也搬進 Worker（Worker 已有七族資料，但雷、垃圾車、施工不在 Worker），未做。

### 6.5 選定甲或乙之後要移除什麼（PREVIEW 清單）

1. 刪 `src/sound/grid/compositePreview.ts`；`useSoundCompositeGridLayer.ts`、`SoundCellSection.tsx`、`soundAtlasLegends.tsx` 的 `compositePreviewStore` 改成固定版本。
2. 刪 `src/components/sound/SoundCompositePreviewBar.tsx` 與 `App.tsx` 的 lazy import＋掛載（標 PREVIEW）。
3. `App.tsx` 網址同步保留 `?soundComposite=` 的兩行（標 PREVIEW）。
4. 沒選的那版：`compositeGrid.ts` 的 codeA 或 codeB／index、`soundProfiles.COMPOSITE` 的對應常數（甲：activeMinLevel、levelCuts；乙：weights、minKnownWeightShare、displayMaxIndex）、`soundAtlasColors.ts` 的對應色表、Worker `composite` 回傳的另一張、三語 i18n（`soundAtlas.composite.preview*`、`unknownShare`、`legend.soundAtlas.compositeA*`／`compositeB*`）、圖例分支、`compositeGrid.test.ts` 對應題。
5. MODEL_DECISIONS §10 改成「已選定」並刪掉沒選的那節；manifest `soundComposite` 的 qualifier「推估・預覽」、description、processing／source 說明改寫；en／ja `layers.json` 的「(Preview)／（プレビュー）」、`layer-status.csv` 的標籤一起改；改完重跑 `dump-layer-golden.ts` 與 `design:audit-layers`。

