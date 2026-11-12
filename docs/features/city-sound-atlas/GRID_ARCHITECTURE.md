# 聲景全範圍網格架構（W6-1 起）

> 第一個上網格的是雨（W6-1，2026-11-12）。網格定義與量測見 [W6_GRID_SPIKE.md](./W6_GRID_SPIKE.md)；雨的模型決定見 [MODEL_DECISIONS.md](./MODEL_DECISIONS.md) §7。

## 1. 分層

| 層 | 檔案 | 職責 |
|---|---|---|
| 網格定義 | `src/sound/grid/gridSpec.json`／`gridSpec.ts` | 北北 250 m 網格（292×285、row 0＝北）、縣市遮罩、`GRID_UNKNOWN=255`；Python 與 TS 共讀 |
| 分級表 | `src/sound/grid/rainClasses.json`／`rainClass.ts` | 分級門檻、Z-R、未知碼；分級規則只在這裡 |
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

## 3. 新增一族網格的步驟

1. 若需要預算（影像、大量測站）：寫 `build-sound-<family>.py --publish`，輸出 `<family>-<D>.class.bin`＋`.meta.json`，用 `build-public-assets-lock.py add` 登記；`.gitignore` 已含 `public/sound-atlas/grid/`。
2. 在該族 adapter 抽出 `<family>EstimateAt(records, lon, lat, t0, t1)`，讓 contribution 與網格共用。
3. 寫 `<family>Grid.ts`（預算＋整幀），測試仿 `src/sound/__tests__/rainGrid.test.ts`：合成資料逐格比對 0 不符；有真實資產時再跑真實日（無資產自動略過，CI 不依賴）。
4. 色表放 `soundAtlasColors.ts`（分級色＋每級透明度）；圖例與 popup 的級名放 i18n。
5. hook 仿 `useSoundRainGridLayer`；layer id `sound-atlas-grid-<family>`，放在 `sound-atlas-route-line` 之前。
6. manifest 的 popup 陣列加 `sound<Family>Cell`、params 若有新開關一併登記；重產 layer-golden 與樣式盤點。

## 4. 量測（W6-1，dev server、SwiftShader、taipei-1109）

- 切 30 個不同 10 分格：算幀中位 3.4 ms、最大 14.3 ms；上傳貼圖中位 0.1 ms、最大 1 ms（需求 < 50 ms）。
- 包大小：11-09 92,688 B（128/144 幀）、10-24 153,499 B（139/144 幀）。
