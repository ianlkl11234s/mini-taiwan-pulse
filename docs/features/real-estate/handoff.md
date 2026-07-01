# Handoff — real-estate（下游視角）

> **上游 SSOT**：[`../../../taipei-gis-analytics/docs/handoff/real-estate.md`](../../../../taipei-gis-analytics/docs/handoff/real-estate.md)
>
> 契約細節看上游，本檔只放前端接線簡表。

## 上游摘要

- 產物：S3 `deploy-assets/coverage/real_estate_{grid,points}.pmtiles` + `real_estate_points_buffer.bin`
- 更新頻率：每季手動 `bash scripts/build_real_estate_pmtiles.sh`
- 座標：WGS84
- 資料量：365,219 points / 39+28+7.3MB

## 前端接線位置

- Timeline：`src/hooks/useRealEstateTimeline.ts` + `src/lib/realEstateTime.ts`
- Palette：`overlayRegistry.ts` → `RE_PALETTES`
- 點層 CustomLayer：`src/three/RealEstatePointsScene.ts` + `src/map/realEstatePointsCustomLayer.ts` + `src/hooks/useRealEstatePointsLayer.ts` + `src/state/realEstatePointsStore.ts`

## 硬依賴欄位（改一定爆）

點 layer PMTiles keep_attrs：
- `trade_ts` — Timeline 梯形窗
- `city` — excludeTaipei 濾除
- `period` — realtime = ALL 全期彙總
- `price` — tooltip

Grid layer PMTiles keep_attrs：
- `city`, `period`, `price_p95`, `price_p50`

Buffer 檔（`.bin`）：
- interleaved Float32 × 5 per point：`lng, lat, tradeTsRel, price, packed`
- **`tradeTsRel = trade_ts - RANGE_START` 硬契約**（float32 精度）

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 加新 city | `RE_PALETTES` 檢查 domain + excludeTaipei 邏輯確認 |
| 改 RANGE_START | Buffer 重打包 + 前端常數同步 |
| 加新期別（新一季） | period dropdown 自動抓，無須改 code |
| 改 `trade_ts / city / period` 欄位名 | ⚠️ 前端立爆，必須先開 ADR |

## 已知不對稱

- 上游 taipei-gis-analytics 的 pipeline 改動**還在本地 master 未 push**（見 real-estate-layers memory）→ 下次同步時要一起推
- CustomLayer 分支的 buffer 打包已接進 `build_real_estate_pmtiles.sh`，但前端接線 (`feat/real-estate-points-customlayer`) 尚未 merge
