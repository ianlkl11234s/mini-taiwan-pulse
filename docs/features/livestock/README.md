# 畜牧 Livestock

> **Slug**：`livestock`（與 `taipei-gis-analytics/docs/topic-research/livestock/` 一致）
> **狀態**：dev
> **Owner**：migu
> **上線日期**：（pending）
> **相關 PR**：（pending）
> **Branch**：`feat/livestock`

## 一句話說明

全國畜牧點位視覺化：畜禽飼養場 13,087（v3, batch03, 2026-07-05）+ 屠宰場 185 + 飼料廠 258 + 拍賣/批發市場 21。飼養場依**主畜種分層著色**、依**總隻數（各畜種獨立 log 尺標）**定圓圈大小。

## 圖層 / 元件（🐷 畜牧群組，10 toggle，預設全關）

| layer key | 名稱 | 類型 | 資料源 | 分色 | 大小 |
|---|---|---|---|---|---|
| `livestockFarmPig` | 飼養場·豬 | point | `livestock_farms` filter 主畜種=豬（4,584） | 珊瑚粉 | log(總隻數) 100→4000 |
| `livestockFarmChicken` | 飼養場·雞 | point | 同上 =雞（5,176） | 橙黃 | log 1000→75000 |
| `livestockFarmCattle` | 飼養場·牛 | point | 同上 =牛（574） | 棕 | log 20→700 |
| `livestockFarmDuck` | 飼養場·鴨 | point | 同上 =鴨（1,305） | 青綠 | log 100→16000 |
| `livestockFarmGoose` | 飼養場·鵝 | point | 同上 =鵝（531） | 藍綠 | log 100→8000 |
| `livestockFarmSheep` | 飼養場·羊 | point | 同上 =羊（644） | 紫 | log 20→600 |
| `livestockFarmOther` | 飼養場·其他 | point | 同上 非豬雞牛鴨鵝羊（273） | 灰 | log 50→3000 |
| `livestockSlaughter` | 屠宰場 | point | `slaughterhouses`（185） | 依種類 家畜/家禽 | 固定 |
| `livestockFeed` | 飼料廠 | point | `feed_factories`（258） | 單色 | 固定 |
| `livestockMarket` | 拍賣市場 | point | `livestock_markets`（21） | 醒目 | 固定（大） |

> 飼養場 4 層**共用單一 source `livestock_farms`**（1 次 fetch）+ Mapbox `filter` 分層。全點渲染、不 cluster、不做 zoom 密度抽稀（用戶明確要求全撒）。

## 資料路由（雙軌正交）

- **前端（用戶讀）→ CDN 靜態 geojson**：`public/agriculture/{livestock_farms,slaughterhouses,feed_factories,livestock_markets}.geojson`（`.gitignore` 已含，走 S3 deploy-assets → Cloudflare）。**不打 Supabase、無 RPC、無 fallback**（同 `water_*` / `agri_pois` 那一層）。
- **Supabase（留底備查）→ `agriculture.*` schema 4 表**（新開 schema，gis-platform 首個農業 schema）。**前端不讀**。gis-platform migration + `ingest_livestock.py`。
- ⚠️ **更新雙寫**：farm 之後補到 100%（ARIS 後續 batch）時，**CDN 檔 + DB 兩邊都要重載**，不是只覆蓋 CDN。

## 尺寸設計（per-species 獨立 log — 關鍵，別退化成全域尺標）

各畜種量級差極大 → **禁用全域尺標**（否則牛/豬全被雞的 70 萬壓成點）。每層自己的 domain，錨在 p95 + 兩端 clamp，radius 3→20px、log 內插：

| 層 | domain（總隻數 lo→hi） | 依據（實測分布） |
|---|---|---|
| 牛 | 20 → 700 | max 才 1,003，用 p99 |
| 豬 | 100 → 4,000 | p95 ≈ 3,685 |
| 雞 | 1,000 → 75,000 | p95 ≈ 74,000（max 708,802 clamp） |
| 鴨 | 100 → 16,000 | p95 ≈ 16,337 |
| 鵝 | 100 → 8,000 | p95 ≈ 7,819 |
| 羊 | 20 → 600 | p95 ≈ 603 |
| 其他 | **依主畜種各自**（Mapbox `match`） | 鹿 30–300 / 鵪鶉 5000–120000 / 馬 5–80 / 兔 200–1500 / 鴕鳥 50–200 / default 50–3000（混物種量級差極大，不共用尺標） |

**預設 scale**：飼養場 7 層 = `0.3`（小點）；設施 3 層（屠宰/飼料/市場）= `1.0`。
**顏色**：飼養場各層同色系「淺→深」依總隻數內插（越多越深）；「其他」層**顏色也依主畜種各自色系**（鹿綠/鵪鶉橙/馬靛/兔粉/鴕鳥橄欖，各自淺→深，Mapbox `match`）。
**品項高亮**：飼養場每層參數面板有「品項」下拉（種類明細子字串比對）→ 選一品項則命中場正常、其他淡化 0.08。

> ⚠️ **必然取捨**：圓圈大小**只在同一層內可比**，跨畜種不可比（max 牛 1,003 和 max 雞 708,802 會畫成一樣大）→ 圖例必註記「大小為各畜種層內相對值」。

## 資料品質旗標

- farm 用 **最新 enriched（20260705，13,087 全命中，batch01+02+03）**。`精度` 欄：高 12,271 / 中 47 / **低 769**。
- **低精度 769 場**（`定位來源=段質心_google`）＝只定位到段/村里中心 → 前端**降 opacity 或 stroke 虛化**，勿當精確場址。

## 施工步驟（逐一，對應 layer-onboarding SOP + CLAUDE.md §5/§5a）

- [x] **Step 0 規劃**：branch `feat/livestock` / feature docs / 4 geojson → `public/agriculture/`（穩定檔名）
- [x] **Step 1 資料驗收**：counts 13087/185/258/21；farm 欄位齊（證號/場名/縣市/主畜種/總隻數/種類明細/段/地號/定位來源/精度）
- [ ] **Step 2 接線 7 步**：types → `livestockLoader` → `useLivestockLayer` → overlay → catalog(LAYER_COLORS+SECTIONS 畜牧子分區) → App → useLayerVisibility(預設 false 自動派生)
- [ ] **Step 3 UX baseline**：點層 1k–10k → per-species radius / opacity 0.85 / 不 cluster
- [ ] **Step 4 四鐵則**：① opacity slider ② legend(畜種 4 色 + size 註記 + 屠宰種類) ③ popup(場名/主畜種/總隻數/種類明細/精度) ④ dropdown（N/A，是 toggle）
- [ ] **Step 5 跨 repo**：handoff 反向引用 + 上游治理文件（taipei-gis-analytics，委派中）
- [ ] **部署**：`upload-deploy-assets.sh` 加 `public/agriculture/livestock_*.geojson` glob
- [ ] **Supabase 留底**：gis-platform agriculture schema（委派中）
- [ ] **Step 6 驗收**：`npx tsc -b` / `pnpm test`（含 layerConsistency）/ browser All Off 單測

## 關鍵檔案

- Loader：`src/data/livestockLoader.ts`
- Hook：`src/hooks/useLivestockLayer.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Catalog：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS「農業 Agriculture」下加「畜牧 Livestock」）
- Legend：`src/components/panels/LegendPanel.tsx` + `LEGEND_REGISTRY`
- Popup：`src/hooks/useMapInteraction.ts` + `featureInfo/registry`
- 部署：`scripts/deploy/upload-deploy-assets.sh`

## 資料契約 / backlog / changelog

見 [handoff.md](./handoff.md) / [backlog.md](./backlog.md) / [changelog.md](./changelog.md)。
上游 SSOT：`../../../taipei-gis-analytics/docs/topic-research/livestock/HANDOFF_mini-taiwan-pulse.md`。
