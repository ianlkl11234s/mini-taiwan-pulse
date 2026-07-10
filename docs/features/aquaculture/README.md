# 養殖漁業 Aquaculture

> **Slug**：`aquaculture`（與 `taipei-gis-analytics/docs/handoff/aquaculture.md` 一致）
> **狀態**：dev（已驗證，未 push）
> **Owner**：migu
> **上線日期**：（pending）
> **相關 PR**：（pending）
> **Branch**：`feat/aquaculture-layers`

## 一句話說明

全國養殖漁業「面」視覺化：逐口魚塭（OSM 15,241 面）+ 養殖漁業生產區（MOA 62 面）+ 海上箱網（澎湖海域為主 42 面）。掛在 Layers 側欄「農業 Agriculture」主題下新分組「養殖漁業 Aquaculture」，全部**公開（非 owner-gated）**，預設全關。

## 圖層 / 元件（🐟 養殖漁業分組，3 layer，預設全關）

| layer key | 名稱 | 類型 | 資料源 | 顏色 | 筆數 | minzoom |
|---|---|---|---|---|---|---|
| `aquaculturePonds` | 逐口魚塭 | PMTiles fill+line | `public/fishery/aquaculture_ponds_osm.pmtiles`（sourceLayer `aquaculture_ponds_osm`, z5–14, keep_attrs osm_id/osm_type/name/produce/area_ha） | `#26c6da` 青 | 15,241（OSM, ODbL） | 顯示 minzoom 9 |
| `aquacultureZone` | 養殖漁業生產區 | GeoJSON fill+line | `public/fishery/aquaculture_production_zone.geojson`（589KB） | `#66bb6a` 綠 | 62（MOA E01 / datagov:56684） | 6 |
| `aquacultureCageNet` | 海上箱網 | GeoJSON fill+line | `public/fishery/aquaculture_cage_net.geojson`（20KB） | `#5c6bc0` 靛 | 42（datagov:127504，澎湖海域為主） | 6 |

> 逐口魚塭走 PMTiles（15,241 面量大 → 向量磚 + `keep_attrs` 帶最小屬性）；生產區 / 箱網走靜態 GeoJSON（面數少）。逐口魚塭**顯示 minzoom 9**（避免全台縮小時滿版青面）。
>
> 放養量 G70 dataset（79 點）這次**未接**，列為 backlog。

## 資料路由（前端 CDN 靜態，不打 Supabase）

- **前端（用戶讀）→ CDN 靜態，走 `public/fishery/`**：
  - `aquaculturePonds` → `aquaculture_ponds_osm.pmtiles`（3.1MB，向量磚）
  - `aquacultureZone` → `aquaculture_production_zone.geojson`
  - `aquacultureCageNet` → `aquaculture_cage_net.geojson`
- **無 Supabase、無 RPC、無 fallback**（同 `agriculture/*` 靜態面資料那一層）。
- 生產區 / 箱網 geojson 早已在前端 `public/fishery/`（此前為孤兒檔，本次才接線）；逐口魚塭 pmtiles 由上游 `taipei-gis-analytics` 新產出後複製進 `public/fishery/`。

## 渲染參數

- 三層皆 fill + line 雙 layer：fill 帶 `fill-opacity`（可調），line 描邊定界。
- `aquaculturePonds` fill / line 掛 `minzoom 9`（顯示層級控制）；`aquacultureZone` / `aquacultureCageNet` minzoom 6。
- 預設全關（`false`，未列入 `useLayerVisibility` 的 `DEFAULT_ON` → 自動派生 false）。

## 四鐵則（⚠️ 缺一不可）

- [x] **① 透明度 slider** — 3 個 fill 各接 `fill-opacity` slider（`useTransportParams.ts`）
- [x] **② 圖例** — `LEGEND_REGISTRY` 加行 + `AquacultureLegend` sub-component（`LegendPanel.tsx`）
- [x] **③ popup** — `fisheryPanels.tsx` 3 個 panel（ponds / zone / cageNet）；`useMapInteraction.ts` + `featureInfo/registry.tsx` 各加行
- [x] **④ dropdown** — N/A（無子分類選項，非 dropdown 情境）

## 驗收證據（全綠）

- `npx tsc -b` → exit 0
- `pnpm test` → **190/190 passed**（含 `deployContract` fishery 契約 + `layerConsistency` 圖例守門）
- **Browser**（本地 dev `localhost:3721`，z12 雲嘉南沿海）：
  - ponds 渲染 2,400 面（青）、zone 28 面（綠）、cageNet 澎湖海域 41 面（靛）
  - popup 點魚塭跳面板（面積 1.08 ha）
  - console 0 error
  - pmtiles HEAD 200 / Range 206（magic `PMTiles`）
  - 截圖 2 張存 scratchpad

## 部署契約（本次一併補齊）

前端一旦引用 `./fishery/*`，`deployContract.test.ts` 要求 fishery 進 nginx + pull 契約（防「林班事件」大檔 404）。因此改了 3 個部署檔：

- `nginx.conf` — 加 `location /fishery/`
- `scripts/deploy/pull-deploy-assets.sh` — mkdir + fire catch-all 加 `--exclude "fishery/*"` + fishery sync
- `scripts/deploy/upload-deploy-assets.sh` — 新增 `FISHERY_FILES` 區塊

> ⚠️ **部署方式待決**：3.1MB pmtiles 要 git commit 進版控、還是 gitignore + 跑 `upload-deploy-assets.sh` 上 S3（deploy 腳本已備 S3 路徑）。見 [backlog.md](./backlog.md)。

## 關鍵檔案（本次改動 13 檔）

接線 10：
- `src/types/index.ts`（`LayerVisibility` 加 3 key）
- `src/map/overlayRegistry.ts`（3 layer fill+line 宣告）
- `src/hooks/useMapInteraction.ts`（popup click）
- `src/components/featureInfo/fisheryPanels.tsx`（**新**，3 panel）
- `src/components/featureInfo/registry.tsx`
- `src/hooks/useTransportParams.ts`（3 opacity slider）
- `src/components/LegendPanel.tsx`（`AquacultureLegend`）
- `src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + `SECTIONS`「農業」下新分組「養殖漁業」）
- `src/components/IconRailSidebar.tsx`（Fish icon）
- `src/data/upstreamRegistry.ts`

部署契約 3：`nginx.conf`、`scripts/deploy/pull-deploy-assets.sh`、`scripts/deploy/upload-deploy-assets.sh`

## 資料契約 / backlog / changelog

見 [handoff.md](./handoff.md) / [backlog.md](./backlog.md) / [changelog.md](./changelog.md)。
上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/aquaculture.md`。
</content>
