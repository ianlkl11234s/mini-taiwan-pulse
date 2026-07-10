# <feature-name>

> **Slug**：`<feature-slug>`（與 taipei-gis-analytics handoff 一致）
> **狀態**：planning / dev / staging / shipped / deprecated
> **Owner**：<你>
> **上線日期**：YYYY-MM-DD
> **相關 PR**：#XX #YY

## 一句話說明

<這個 feature 給用戶看到什麼、解決什麼問題>

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| xxx | point / line / polygon / 3D / raster | PMTiles / RPC / GeoJSON | ✅ |

## 關鍵檔案

- Loader：`src/data/xxxLoader.ts`
- Hook：`src/hooks/useXxxLayer.ts`
- Overlay：`src/map/overlayRegistry.ts`（或 CustomLayer）
- Catalog：`src/components/sidebar/layerCatalog.ts`
- Legend：`src/components/panels/LegendPanel.tsx`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/<slug>.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

- ADR-XXXX（若有）

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/<slug>.md`
- 開發規則：`../../development-rules.md`
