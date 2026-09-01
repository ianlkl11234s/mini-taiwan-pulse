# Handoff — jp-core-layers（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/jp-core-layers.md`（9 層資料速覽、20 觸點、tab 外殼接線點:行號、auto-flyTo 範本、大檔 S3 路由，全在那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**，不重複契約。

## 上游 handoff 摘要

- 產物路徑：`taipei-gis-analytics/data/processed/world/jp_*/`（小檔 cp 進本 repo `public/world/`）
- 座標系統：WGS84（EPSG:4326；上游自 JGD2011/EPSG:6668 轉出）
- 資料量：縣界 47 / 市界 1,905 / 車站 9,046 / 機場 108（本輪 4 層）
- 授權：CC BY 4.0（機場為舊約款、商用可）
- Supabase `reference.world_jp_*` 七表僅供未來 point-in-polygon 空間查詢，**畫圖不走**

## 前端渲染路徑（本輪 = git-track / dist fallback，免 S3）

小檔（admin PMTiles 6+1MB、stations 7.2MB、airports 256KB）git-track 進 `public/world/`，
nginx `/world/` location 有 `root /data; try_files $uri @dist`，build 後從 dist 供檔——
**免觸點 #20**（比照既有 jp_religion_*）。deployContract.test.ts 走 `gitTracked` 路徑通過。

## 硬依賴欄位（改一定爆）

| 欄位 | 來源 | 用於 |
|---|---|---|
| PMTiles source-layer=`jp_admin_boundaries_prefecture`（z2-9） | 縣界 PMTiles | hook addLayer 的 source-layer；改名 = 空白渲染 |
| PMTiles source-layer=`jp_admin_boundaries`（z4-11） | 市界 PMTiles | 同上 |
| `pref_name` / `pref_code` | 縣界 tile 屬性 | 縣界 popup |
| `admin_code` / `city_name` / `county_name` / `ward_name` / `pref_name` | 市界 tile 屬性 | 市界 popup |
| `name` / `lines` / `operators` / `railway_categories` / `passengers_{2022..2024}` / `passengers_latest*` | 車站 GeoJSON | 車站 popup（運量逐年 fallback）|
| `name` / `category` / `status` / `regular_flight` / `runway_length_m` / `runway_width_m` | 機場 GeoJSON | 機場 popup |

⚠️ 陣列欄位（lines/operators/railway_categories）經 Mapbox vt-pbf 會 JSON.stringify → panel 用 `parseStringArray` 兩種來源都接。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| PMTiles 重出改 `-l` layer 名 | 改 `useJpAdminLayers.ts` 的 `*_SOURCE_LAYER` 常數 |
| 車站 popup 欄位改名 | 改 `japanPanels.tsx` 的 `JpStationsPanel` |
| 縣界/市界檔名改 | 改 manifest `staticAssets` + hook `file` 常數 + cp 進 public/world/ |

## 已知不對稱 / 決策

- 本輪 4 層皆**單色**（免圖例）；分類分色（車站按 JR/私鐵、機場按空港種別）遞延，見 backlog。
- 機場為 polygon footprint，國家級 zoom 幾乎看不見是**預期**（放大才顯現）。
- auto-flyTo 座標 `[137.5,37.5]` z4.7 為估算（上游踩雷 #7），可目視微調 `JAPAN_CAMERA`。
- 遞延三層（railways/schools/mesh）需資料工序或 S3 deploy，屬另一批。
