# Handoff — 海底等深線 Isobath（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/gebco_isobath.md`（詳細契約看那份；已於 2026-08-23 產出並與本檔校對過）
>
> 上游 catalog：`taipei-gis-analytics/docs/data-catalog/base_map/gebco_isobath.md`（dataset_id `gebco_isobath`）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：`public/base_map/gebco_isobath.pmtiles`（前端 URL：`./base_map/gebco_isobath.pmtiles`）
- tippecanoe source-layer：`isobath`，zoom 4–12
- feature 兩種，靠 `kind` 屬性區分：
  - `kind="line"`：LineString 等深線，屬性 `depth_m`（整數負值，11 種：-20 -50 -100 -200 -500 -1000 -2000 -3000 -4000 -5000 -6000）
  - `kind="band"`：Polygon 深度分帶（環差、自帶 hole，陸地已挖空），屬性 `dmin`/`dmax`（整數負值，dmin 較深），共 12 帶（-7000~-6000 … -20~0）
- 資料源：GEBCO 2025（15 arc-sec ≈ 450m），public domain 但需標示來源
- 座標系統：WGS84

（完整契約 → 上游 handoff）

## 前端接線位置

- 色票 SSOT：`src/data/isobathTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（`id: "isobath"`）
- Manifest：`src/data/layerManifest.ts`（`isobath` entry）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（底圖 Base Map > 地形 子群）

## 硬依賴欄位（改一定爆）

- `kind`（`"line"` / `"band"`）— overlayRegistry 兩個 sub-layer 靠它 filter 分流，改名或改值集合會讓其中一層畫不出東西
- `depth_m`（line）／`dmin` + `dmax`（band）— `isobathTypes.ts` 的 `match` 表達式硬編這些整數負值集合（11 級 / 12 級），上游若調整分級邊界，`ISOBATH_BANDS` / `ISOBATH_LINE_DEPTHS` 要同步改
- source-layer 名稱 `isobath` — `overlayRegistry.ts` 的 `pmtiles.sourceLayer` 寫死

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 調整深度分帶邊界（12 級的斷點值） | `src/data/isobathTypes.ts` 的 `ISOBATH_BANDS` / `ISOBATH_LINE_DEPTHS` 要同步改，三個色階陣列長度也要跟著調 |
| 改 `kind` 值集合或欄位名 | `overlayRegistry.ts` 的兩個 `filter` 要同步改 |
| 改 source-layer 名稱 | `overlayRegistry.ts` 的 `pmtiles.sourceLayer` + `layerManifest.ts` 的 `source.sourceLayer` 同步改 |
| 上游 catalog dataset_id 改名 | `layerManifest.ts` 的 `upstream.datasets[].datasetId` 要同步改（現為 `gebco_isobath`） |

## 已知不對稱

- **正式環境尚未部署**：`.gitignore` 第 107 行 `public/base_map/*.pmtiles` 會擋掉這個檔案，
  且 prod 的 nginx `/base_map/` 是純 volume 無 dist fallback → **上線前必須手動跑
  `scripts/deploy/upload-deploy-assets.sh`** 把檔案送上 S3 `deploy-assets/base_map/`，
  否則正式站 404。本機 dev 不受影響（檔案已落地，2.8 MB）。
- 命名不對稱（刻意）：上游 dataset_id 為 `gebco_isobath`（analytics 的 snake_case 慣例），
  下游 layer key 與 feature slug 為 `isobath`。兩邊文件已互相標註，改任一邊要同步。
