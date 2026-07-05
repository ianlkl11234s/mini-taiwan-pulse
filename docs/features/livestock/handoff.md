# Handoff — 畜牧 Livestock（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/topic-research/livestock/HANDOFF_mini-taiwan-pulse.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。

## 上游 handoff 摘要

- 產物路徑（上游）：`taipei-gis-analytics/data/processed/agriculture/livestock_ranch/`（4 geojson）
- 前端 CDN 路徑：`public/agriculture/{livestock_farms,slaughterhouses,feed_factories,livestock_markets}.geojson`（去日期穩定檔名）
- Supabase 留底：`agriculture.{livestock_farms,slaughterhouses,feed_factories,livestock_markets}`（前端不讀）
- 更新頻率：不定期（ARIS batch 補齊時覆蓋，目前 v3 batch01+02+03，⑤⑥ 已查回）
- 座標系統：WGS84
- 資料量：farm 13,087 / slaughter 185 / feed 258 / market 21

## 前端接線位置

- Loader：`src/data/livestockLoader.ts`
- Hook：`src/hooks/useLivestockLayer.ts`
- Overlay：`src/map/overlayRegistry.ts`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS「農業」→「畜牧」子分區）

## 硬依賴欄位（改一定爆）

farm（`livestock_farms.geojson`）：
- `主畜種` — **分層 filter + 分色**（值域：豬/雞/牛/鴨/鵝/羊/鹿/鵪鶉/馬/其他/兔/鴕鳥）。改名或改值 → 4 層 filter 全失效。
- `總隻數` — **circle-radius per-species log 尺標**（數值）。
- `精度` — 值 `低` → 前端淡化（769 場，v3）。
- `場名` / `種類明細` / `縣市` / `定位來源` — popup 顯示。

slaughter：`種類`（家畜/家禽）分色 + popup。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| ARIS 補到 100% 覆蓋同名檔 | CDN 重新 upload + `purge-cloudflare-cache.sh`；**Supabase 也要重跑 `ingest_livestock.py`**（雙寫） |
| 新增畜種值（超出現有值域） | 落入「其他」層（`!in [豬,雞,牛,鴨,鵝,羊]` 自動涵蓋，通常免改）；若要獨立成層才動 catalog |
| farm 各畜種數量分布大變 | 檢查 per-species size domain（p95 錨點）是否要重算 |
| 改欄位名（主畜種/總隻數/精度） | filter / radius / 淡化全要跟改 → **務必先開 upstream handoff** |

## 已知不對稱

- v3（20260705, batch03）主畜種實測：雞 5,176 / 豬 4,584 / 鴨 1,305 / 羊 644 / 牛 574 / 鵝 531 / 其他 273 → 以 enriched 實測為準。
- 「其他」層（273）內含鹿(216)/鵪鶉(25)/馬(11)/其他(11)/兔(7)/鴕鳥(3)，量級跨度大 → 該層 **size + 顏色皆 per-species**（鹿綠/鵪鶉橙/馬靛/兔粉/鴕鳥橄欖）。
