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
| 接線 | `src/hooks/useSound*GridLayer.ts` | 讀 `soundAtlasStore.sets[family]`（不另載）、timeStore 節流訂閱、10 分一格、同格不重算 |
| 點格 | `src/sound/grid/*GridState.ts` | 模組狀態＋`pick*Cell`（對格心呼叫單點估計）；`useMapInteraction` fallback 進 FeatureInfo |

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

- **共用**：碼 `src/sound/grid/potentialCode.ts`（0／1–200／255，刻度 1/200）；hook `useSoundPotentialGridLayer(map, family, visible, opacity, gate)`，layer id `sound-atlas-grid-<family>`；狀態與點格查詢 `potentialGridState.ts`（popup layerType `soundPotentialCell`，對格心即時呼叫 `queryFamilyInterval`）；色表 `SOUND_POTENTIAL_GRID_COLORS`（飛機粉紅、鐵道黃→橄欖、風萊姆→深綠、浪青、河川翠綠），0 級淡灰、斜線同雨。
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
| 鐵道冷算一幀（班表範本） | 68–279 ms | — |

- 比 W6 spike 估計大：飛機包 358 KB（估 236 KB，因多存三個門檻箱界）；鐵道沒有做每日包（估 109 KB/日），改前端算。

## 5. 量測（W6-1，dev server、SwiftShader、taipei-1109）

- 切 30 個不同 10 分格：算幀中位 3.4 ms、最大 14.3 ms；上傳貼圖中位 0.1 ms、最大 1 ms（需求 < 50 ms）。
- 淺色底圖：斜線清楚；但「無雨」（透明度 0.14 的灰）在淺底幾乎看不出來，和範圍外難分（未調整，待決）。
- 包大小：11-09 92,688 B（128/144 幀）、10-24 153,499 B（139/144 幀）。
- W6-2 道路（dev server、SwiftShader）：建近鄰 96 ms（瀏覽器）／135 ms（node）；整幀 3–11 ms（瀏覽器實測 11.2 ms），上傳 0.1 ms。淺色底圖斜線與分級都清楚。資產：路網 1,389,342 B（gzip 348,831）、11-09 包 189,776 B（gzip 49,660）、10-24 包 185,450 B（gzip 42,917）。
