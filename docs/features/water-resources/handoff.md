# Handoff — water-resources（下游視角）

> 🤖 **本檔由 weekly-audit 2026-W34 [D2] 自動補的骨架，內容尚未填寫。**
> 補的是「缺檔」不是「缺內容」——請接手的人依實際情況填，或若本 feature 不適用
> 本檔類型（例如純前端元件沒有上游資料契約），直接在下方寫明 `N/A` 與原因即可。

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/water-resources.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：<S3 path / RPC 名稱>
- 更新頻率：<>
- 座標系統：WGS84
- 資料量：<>

（完整契約 → 上游 handoff）

## 前端接線位置

- Loader：`src/data/xxxLoader.ts`
- Hook：`src/hooks/useXxxLayer.ts`
- Overlay：`src/map/overlayRegistry.ts` 或 `src/map/xxxCustomLayer.ts`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS）

## 硬依賴欄位（改一定爆）

從上游 handoff 挑出「前端硬依賴」的欄位，列在這：
- `field_a` — 用於 <哪個功能>
- `field_b` — 用於 <哪個功能>

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 加新 city | `LAYER_COLORS` 檢查 domain |
| 改 refresh 頻率 | timeStore 節流可能要調 |

## 已知不對稱

（上下游對這個 feature 認知不一致的地方）
