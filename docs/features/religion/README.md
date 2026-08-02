# 宗教 Religion

> **Slug**：`religion`（上游批次 handoff：`pulse-batch-20260801`）
> **狀態**：dev
> **Owner**：migu
> **上線日期**：（待 PR merge）
> **相關 PR**：#（待補）

## 一句話說明

全站第 36 個主題群：把全台 **23,074 個宗教場所**（寺廟 19,201 / 教會 2,116 / 其他宗教場所 1,319
/ 宗祠 173 / 基金會 165 / 宗教百景 100）接上地圖，並用「主祀神祇」與「有沒有登記」兩把尺
讀台灣的宗教地景。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 特色 |
|---|---|---|---|
| `religionTemples` | point (19,201) | **PMTiles** `public/religion/temples.pmtiles`（12.2MB，S3 管理） | `deity_family` 9 族分色 + 主祀/登記雙 filter |
| `religionChurches` | point (2,116) | GeoJSON `public/religion/churches.geojson` | 登記態 filter；OSM 補 1,066 聚會點 |
| `religionAncestralHalls` | point (173) | GeoJSON `public/religion/ancestral_halls.geojson` | `facility_type` 3 類分色 |
| `religionFoundations` | point (165) | GeoJSON `public/religion/foundations.geojson` | 單一源 |
| `religionOtherWorship` | point (1,319) | GeoJSON `public/religion/other_worship.geojson` | 清真寺/神社遺構/風獅爺…全 OSM |
| `religionTop100` | point (100) | GeoJSON `public/religion/top100.geojson` | **自 `tourReligion` 更名搬群** |

## 兩個設計重點

### 1. 主祀神祇分族 `deity_family`（9 族）

`main_deity` 是**自由填寫的 1,950 種**（「北極玄天上帝」「玄天上帝」「上帝公」都是同一位），
而 Mapbox `match` 表達式**沒有 regex**——所以歸併不可能在前端做。

→ 正規化寫在**上游** `taipei-gis-analytics/pipelines/religion/_shared/deity_family.py`，
產出 `deity_family` 欄（媽祖/土地公/觀音/關聖帝君/玄天上帝/王爺千歲/佛教諸佛/其他神祇/未標示），
pulse 只做 family → 顏色。**改規則要改上游、重跑 07+08、重新 publish**。

實測分布：未標示 6,855、其他神祇 4,276（長尾 1,286 種）、佛教諸佛 1,717、王爺千歲 1,559、
土地公 1,385、觀音 1,043、媽祖 1,039、玄天上帝 772、關聖帝君 555。

### 2. `in_moi_registry` 雙態

一個開關切「官方登記版」vs「含登記制度外的全量版」：
- temples：登記 12,399 / 制度外 6,802（OSM 民間宮壇，土地公祠約 2,300）
- churches：登記 1,014 / 制度外 1,102（OSM 教會聚會點）
- ancestral_halls：**語意不同** —— false 的 96 筆是**文資祠堂**（非 OSM），故該層選項標籤另寫

⚠️ 資料事實：**「登記制度外」那 6,802 筆寺廟全部沒有 main_deity**（deity_family=unknown），
所以「主祀分族」實際上只作用在官方登記版。兩個 filter 取交集時「媽祖 ∩ 登記制度外 = 0」
是正確結果不是 bug。

## 授權標示（⚠️ 必須保留）

temples / churches / other_worship 含 OSM 來源 → **ODbL**：
- 圖例：`ReligionLegend` 底部（三層任一開啟就顯示）
- Popup：`OdblNote`（`source === "osm_overpass"` 才顯示）

## 關鍵檔案

- 分類 / 配色 SSOT：`src/data/religionTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（6 entry；temples 走 pmtiles）
- Catalog：`src/components/sidebar/layerCatalog.ts`（THEMES 新主題群，插在 文化 Culture 與 觀光 Tourism 之間）
- Legend：`src/components/LegendPanel.tsx`（`ReligionLegend`）
- Popup：`src/components/featureInfo/religionPanels.tsx`（6 個 panel）
- 參數：`src/hooks/useTransportParams.ts`
- 部署：`nginx.conf`（`location /religion/`）+ `scripts/deploy/{upload,pull}-deploy-assets.sh`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/pulse-batch-20260801.md`。

## 相關 backlog / 歷次改動

[backlog.md](./backlog.md) · [changelog.md](./changelog.md)
