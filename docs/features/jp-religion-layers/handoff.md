# Handoff — 日本宗教設施三源圖層（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/jp-religion-layers.md`
>
> 本檔只記前端硬依賴與接線差異；完整研究與資料契約以上游 handoff 為準。

## 上游產物

| layer | 靜態產物 | 筆數 | 授權 |
|---|---|---:|---|
| GSI | `public/world/jp_religion_gsi.pmtiles` | 167,037 | 国土地理院規約 |
| OSM | `public/world/jp_religion_osm.geojson` | 71,040 | ODbL |
| Wikidata | `public/world/jp_religion_wikidata.geojson` | 37,154 | CC0 |

座標系統皆為 WGS84 Point。三者是獨立來源，不做 UNION 或融合。

## 前端接線位置

- Loader：`src/data/jpReligionLoader.ts`（OSM／Wikidata）
- Hook：`src/hooks/useJpReligionLayers.ts`（含 GSI PMTiles source）
- Host：`src/layers/hosts/climateHosts.tsx`
- UI：`src/components/sidebar/layerCatalog.ts` 的 `世界 World · 宗教`
- Legend／popup：`src/components/LegendPanel.tsx`、`src/components/featureInfo/religionPanels.tsx`

## 硬依賴欄位

- `religion` — `shinto | buddhist | christian`，用於三源共用分色；GSI／Wikidata 沒有 christian。
- `name` — optional；缺值時 key 不存在，popup 必須 fallback。
- `id` — OSM element id／Wikidata QID；GSI PMTiles 刻意不含此欄。
- GSI vector source-layer 固定為 `jp_religion_gsi`，source `maxzoom` 固定 14，地圖 z15+ 依 overzoom 顯示。

## 授權與資料誠實度

LegendPanel 必須依開啟來源顯示：

- `© OpenStreetMap contributors, ODbL`
- `出典：国土地理院最適化ベクトルタイル`
- `Wikidata, CC0`

日本沒有官方全國宗教設施圖層。任何單一來源都不是全量，三者數字不可相加。大阪府清冊實測 GSI 對上 62%，三源聯集仍漏 25.9%。

## 驗收

- All Off 時 globe 無宗教點；三層預設皆 off。
- 三層逐一開啟可見，色票一致，opacity slider 有效。
- popup 不顯示 `undefined`；GSI 無名點顯示地圖記號 fallback。
- Legend 顯示當前來源 attribution 與不可加總 disclaimer。
- GSI 在 z15／z16 仍可見。
