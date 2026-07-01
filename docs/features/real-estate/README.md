# Real Estate（實價登錄）

> **Slug**：`real-estate`
> **狀態**：✅ shipped（部分優化仍在 `feat/real-estate-points-customlayer` 未 push）
> **Owner**：migu
> **上線日期**：2026-06-24（PR #31 merged）
> **相關 PR**：#31（主功能）+ 未 push 分支（CustomLayer 效能優化）

## 一句話說明

視覺化全國實價登錄 — 租賃 / 買賣 / 預售 三類，每類提供 150m grid 與點兩種呈現，可跨時間軸播放季/月/週。

## 圖層（6 個）

| Layer key | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| real_estate_rental_grid | polygon (PMTiles) | S3 pmtiles | ✅ |
| real_estate_rental_points | point (CustomLayer + Float32 buffer) | S3 bin | ✅ |
| real_estate_sale_grid | polygon | S3 pmtiles | ✅ |
| real_estate_sale_points | point | S3 bin | ✅ |
| real_estate_presale_grid | polygon | S3 pmtiles | ✅ |
| real_estate_presale_points | point | S3 bin | ✅ |

## 關鍵檔案

- Timeline：`src/hooks/useRealEstateTimeline.ts` + `src/lib/realEstateTime.ts`
- CustomLayer 點層（效能重構分支）：
  - `src/three/RealEstatePointsScene.ts`（Three.js Points + ShaderMaterial）
  - `src/map/realEstatePointsCustomLayer.ts`
  - `src/hooks/useRealEstatePointsLayer.ts`
  - `src/state/realEstatePointsStore.ts`
- Palette：`overlayRegistry.ts` 的 `RE_PALETTES`（色票 + domain 單一來源）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/real-estate.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 相關 ADR

- (待補) 點層改 CustomLayer 放棄 hover 的取捨

## 相關文件

- 全站 memory：`~/.claude/projects/.../memory/real-estate-layers.md`
- Runbook（上游）：`taipei-gis-analytics/docs/systems/real_estate_sync_runbook.md`
