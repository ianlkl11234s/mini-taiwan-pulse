# property-value

> 🤖 **本檔由 weekly-audit 2026-W34 [D2] 自動補的骨架，內容尚未填寫。**
> 補的是「缺檔」不是「缺內容」——請接手的人依實際情況填，或若本 feature 不適用
> 本檔類型（例如純前端元件沒有上游資料契約），直接在下方寫明 `N/A` 與原因即可。

> **Slug**：`property-value`（與 taipei-gis-analytics handoff 一致）
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

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/property-value.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

- ADR-XXXX（若有）

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/property-value.md`
- 開發規則：`../../development-rules.md`
