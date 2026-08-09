# Embeddable Map（可嵌入地圖 / EM 系列）

> **Slug**：`embeddable-map`
> **狀態**：✅ shipped **且已部署**（2026-08-05 端到端驗證通過）
> **Owner**：migu
> **上線時分支**：`feat/embeddable-map`（PR #105）+ `feat/embed-popup-share`
> **規劃文件**：[`../../proposal/embeddable-map.md`](../../proposal/embeddable-map.md)（目標／費用／風險）·
> [`embeddable-map-impl.md`](../../proposal/embeddable-map-impl.md)（逐檔工作項）·
> [`embed-basemap-osm.md`](../../proposal/embed-basemap-osm.md)（免費底圖路線）·
> [`embed-dynamic-layers.md`](../../proposal/embed-dynamic-layers.md)（動態／歷史圖層）

## 一句話說明

一條網址就能重現特定畫面（相機／圖層／底圖／日期），並提供 `/embed` 極簡版供文章以
`<iframe>` 嵌入 —— 嵌入版走 **MapLibre + 自託管 Protomaps 底圖**，
**不論文章被讀幾次都不產生 Mapbox 費用**。

## 💰 成本模型（本功能的存在理由）

> **Mapbox 的計費單位是 `Map` 物件初始化一次 = 文章的 PV 數，與載入誰的圖磚無關。**

所以「保留 mapbox-gl、只把底圖換成 OSM」**省不到任何錢**。要真的歸零，必須連地圖函式庫
一起換掉。這是整個 EM 系列最反直覺、也最關鍵的一條。

| 情境 | 月成本 |
|---|---|
| 10 篇文章 × 5,000 PV，嵌入走 mapbox-gl | **+$250**（超出 50k 免費額度後 $5/1k） |
| 同上，嵌入走 MapLibre + 自託管底圖 | **$0** |
| 底圖儲存（R2 或既有 S3 管線） | 283 MB → 免費額度內 |

> ⚠️ 查證誠實標記：查不到 Mapbox **明文禁止**搭第三方圖磚（ToS 與 pricing 頁皆未提及）。
> 走 MapLibre 的真正理由是**繞開這個灰色地帶**，不是「被禁止」。

## 三個入口

| 入口 | 網址 | 用途 |
|---|---|---|
| 主站 deep link | `/?v=1&lng=…&lat=…&z=…&layers=…&style=…` | 分享畫面 |
| 嵌入版 | `/embed?v=1&…` | 文章 `<iframe>` |
| Share 按鈕 | 主站 header（桌機 + 精簡工具列各一） | 產出上面兩者 + 複製 |

主站網址由 `moveend` 與圖層／底圖變動時自動同步（`replaceState`），所以按 Share 之前
網址列已經是最新狀態。

## 網址參數

| 參數 | 說明 | 主站 | `/embed` |
|---|---|---|---|
| `v=1` | schema 版本。**缺它整組不解析**（舊嵌入碼防腐） | ✅ | ✅ |
| `lng` / `lat` / `z` | 相機（缺一則整組相機 drop） | ✅ | ✅ |
| `pitch` / `bearing` | 非 0 才寫入 | ✅ | ✅ |
| `layers` | 逗號分隔的 layer key | ✅ | ✅ |
| `style` | 主站底圖 id（7 種）。embed 用它推明暗 | ✅ | ✅ |
| `date` / `h` | 凍結日期（YYYY-MM-DD）+ 小時 0–23 | ✅ | ✅（需有快照） |
| `p.<key>` | overlayParams 覆寫 | ❌ | ✅ |
| `theme` | `dark`\|`light`（style 未給時的回退） | — | ✅ |
| `rsys` | 鐵路只顯示哪幾個營運者／線路（見下節代碼表） | — | ✅ |

**主站不支援 `p.*` 是刻意的**：主站有 sidebar，URL override 會與使用者拉 slider 打架
（`useTransportParams` 3028 行、數百個 hardcode `useState`，無法注入初始值）。

## `rsys=` 鐵路代碼表（營運者級 + 線路級）

一個參數吃三種粒度，可混用取聯集（`rsys=trtc-bl,tymc`）。代碼一律小寫、線路碼**必帶
營運者前綴**（北捷與高捷都有 `R`／`O`，裸碼會撞名）。未知代碼逐一 drop、全 drop 後
＝ 未指定 ＝ 顯示全部（不會白畫面）。SSOT：[`src/constants/railLines.ts`](../../../src/constants/railLines.ts)。

### ⚠️ Breaking change（2026-08-09，owner 拍板）

`trtc` 在資料裡是「台北都會區軌道」的大雜燴，不只北捷：

| | 舊語意（PR #118） | 新語意 |
|---|---|---|
| `rsys=trtc` | 整個 trtc 系統 = 北捷 5 線 **+ 機場捷運 + 新北 4 線**（94 軌道／4,516 班次） | **只有北捷本體 5 線**（76 軌道／3,017 班次） |
| 要回到舊範圍 | — | 寫 `rsys=trtc,tymc,ntm` |

**沒有升 `URL_STATE_VERSION`**：升版會讓所有舊嵌入碼（含與 rail 無關的）整組作廢，
代價遠大於這欄的語意修正；而且解析結果本身沒變（仍是 `["trtc"]`），變的是下游詮釋。
理由與例外紀錄同時寫在 `src/lib/urlState.ts` 檔頭第 3 點。

### 營運者／系統級

| 代碼 | 中文名 | 涵蓋 line_id | 軌道數 | 班次（2026-08-06） |
|---|---|---|---|---|
| `tra` | 台鐵 | —（無線路概念） | 267 O-D（畫 37 golden） | 907 |
| `thsr` | 高鐵 | — | 2 | 160 |
| `trtc` | 台北捷運 | BR / R / G / O / BL | 76 | 3,017 |
| `tymc` | 桃園捷運（機場線） | A | 8 | 329 |
| `ntm` | 新北捷運 | Y / V / K / LB | 10 | 1,170 |
| `krtc` | 高雄捷運 | 整個系統 | 4 | 620 |
| `klrt` | 高雄輕軌 | 整個系統 | 2 | 154 |
| `tmrt` | 台中捷運 | 整個系統 | 2 | 306 |

> `tymc` 與 `ntm` 的線路在資料裡都住在 `trtc` **系統**底下（快照與幾何 bundle 的 key），
> 代碼是營運者視角、系統是引擎視角，兩者刻意分開。

### 線路級

| 代碼 | 中文名 | line_id | 軌道數 | 班次 | 官方線色 |
|---|---|---|---|---|---|
| `trtc-br` | 文湖線 | BR | 2 | 402 | `#c48c31` |
| `trtc-r` | 淡水信義線 | R | 19 | 768 | `#d90023` |
| `trtc-g` | 松山新店線 | G | 15 | 689 | `#008659` |
| `trtc-o` | 中和新蘆線 | O | 25 | 562 | `#f8b61c` |
| `trtc-bl` | 板南線 | BL | 15 | 596 | `#0070c0` |
| `tymc-a` | 機場捷運 | A | 8 | 329 | `#8246af` |
| `ntm-y` | 環狀線 | Y | 2 | 332 | `#fedb00` |
| `ntm-v` | 淡海輕軌 | V | 4 | 494 | `#a4ce4e` |
| `ntm-k` | 安坑輕軌 | K | 2 | 177 | `#8cc540` |
| `ntm-lb` | 三鶯線 | LB | 2 | 167 | `#6db7d0` |
| `krtc-r` | 高雄紅線 | R | 2 | 319 | `#e2211c` |
| `krtc-o` | 高雄橘線 | O | 2 | 301 | `#f8981d` |
| `tmrt-g` | 台中捷運綠線 | G | 2 | 306 | `#0cab2c` |

**沒有線路碼的三個系統**：`tra` / `thsr` / `klrt` —— 資料裡的軌道沒有 `line_id`
（klrt 只有一條環狀線），系統級即最細粒度，刻意不發明 `klrt-c` 這種「查得到卻沒東西」的代碼。

**貓空纜車（`MK-*`）刻意沒有代碼**：它掛在 trtc 底下但不是軌道運輸，主站與嵌入版都排除，
所以 `rsys=trtc` 是 94→76 而不是 96→76。打 `rsys=trtc-mk` 會被當未知代碼 drop。

### ⚠️ 資料的坑：`line_id` 並非每條軌道都有

`rail_slim.json.gz` 裡 trtc 的 96 條軌道中，**13 條淡水信義線變體**（`R-4-*`～`R-15-*`，
如「大安 → 象山」「北投 → 淡水」）只有 `track_id` / `route_id` / `name` / `color`，
**沒有 `line_id`**；時刻表快照更是整份都沒有 `line_id`（只有 `track_id`）。
所以線路歸屬是 `properties.line_id` 優先、缺了才退回 **trtc 專用**的 `track_id` 前綴解析
（`railLineIdOf()`）。上游 `build-rail-slim-bundle.py` 補齊後可刪掉這個 fallback。

### 圖例

`RailLegend` 跟著代碼收斂到同一粒度：`rsys=trtc` 列五線、`rsys=trtc-bl` 只列板南線
（用上表的官方線色，與地圖上那條線同色）；未指定（主站）維持泛稱一行「捷運依各路線官方線色」，
輸出逐字不變。

## 嵌入版可用的圖層（三層白名單）

| 類別 | 數量 | 來源 | 說明 |
|---|---|---|---|
| 靜態 | **145** | `overlayRegistry` 扣掉 dynamicData 與 gated | 自動派生，新增圖層不必改程式 |
| 動態但已 CDN 化 | **7** | `/static-rpc/*.json` | 風機/光電/離岸風場/地熱/充電站/離島電網/北市再生 |
| 歷史快照 | **1** | `/embed-snapshots/<layer>/<date>.geojson` | `plaActivity`（共機），需帶 `date=` |

🔒 **35 個 owner-gated 圖層一律排除**，且不只是「不顯示」——實測 URL 硬塞 gated key 時，
對應的資料檔**連一個 byte 都不會下載**（source 根本不建立）。

**回放層（EM-16，2026-08-09 上線）**：`ships` / `flights` / `rail` 三層 Three.js 回放，
只在網址真的帶了這些 key + `date=` 時才 `import()` three（純靜態嵌入完全不下載）。
`busLive` 仍不支援（EM-24）。原「Three.js 圖層不做」的結論已翻案，詳見
[`embed-dynamic-layers.md`](../../proposal/embed-dynamic-layers.md) §2 與 [`changelog.md`](./changelog.md)。

## 檔案地圖

| 檔案 | 職責 |
|---|---|
| `src/lib/urlState.ts` | 網址 ↔ 狀態（`parseUrlState` / `buildUrl`）；版本閘門 + 靜默降級 |
| `src/embed/EmbedApp.tsx` | 嵌入版主體（MapLibre）。不呼叫 `useTransportParams`、不掛 Three.js |
| `src/embed/embedWhitelist.ts` | 三層白名單派生 |
| `src/embed/maplibreAdapters.ts` | PMTiles protocol（兩引擎唯一的**實質**差異） |
| `src/embed/basemapStyle.ts` | Protomaps style；底圖位置可由 `VITE_EMBED_BASEMAP_URL` 覆寫 |
| `src/embed/dynamicCdnLayers.ts` | CDN 例外清單 + 通用 `rowsToGeoJSON` |
| `src/embed/snapshotLayers.ts` | 歷史快照層的單日靜態 spec |
| `src/embed/embedPopup.ts` | 通用 popup（欄位過濾 + XSS escape） |
| `src/map/overlayManager.ts` | **雙引擎共用**：結構介面 `OverlayMap` + `pmtilesSource` 注入點 |
| `src/components/ShareModal.tsx` | 分享面板 |
| `scripts/export/export-embed-snapshot.sh` | 產歷史快照（psql 直出 GeoJSON） |
| `embed.html` / `vite.config.ts` | 獨立 entry（多入口） |

## Bundle

| | 未壓縮 | gzip |
|---|---|---|
| 主站 | 4.4 MB | 1.2 MB |
| `/embed` | 1.1 MB + 共用 LegendPanel 787 KB | **505 KB** |

驗證方式：搜尋 build 產物中的 Mapbox token 特徵字串 `pk.eyJ` —— **embed chunk 出現 0 次**、
主站 1 次，確認嵌入版完全不載入 mapbox-gl。

## 部署（✅ 2026-08-05 完成）

| 項目 | 狀態 |
|---|---|
| 底圖 `deploy-assets/base_map/taiwan_basemap.pmtiles` | ✅ 297 MB 已上 S3 |
| 快照 `deploy-assets/embed-snapshots/plaActivity/2026-07-30.geojson` | ✅ 已上 S3 |
| Zeabur 部署 | ✅ push master 自動觸發，entrypoint 拉取成功 |
| 正式站驗證 | ✅ `/embed` 200、底圖 Range 206、**Mapbox 0 / Supabase 0** |

> 上傳時**不要**跑整個 `upload-deploy-assets.sh` —— base_map 那段用 `aws s3 cp` 逐檔重傳，
> 會把既有 400 MB+ 全部再上傳一次。針對新增檔案 `aws s3 cp` / `sync` 即可。

**日後新增快照後**：
```bash
aws s3 sync public/embed-snapshots/ "s3://$S3_BUCKET/deploy-assets/embed-snapshots/" --region ap-southeast-2
# 容器需重啟才會 pull（entrypoint 執行）→ 改檔 + push 觸發，或 Zeabur dashboard redeploy
```

⚠️ 尚待處理：Cloudflare 對 `/base_map/` 與 `/embed-snapshots/` 的快取規則（EM-13）。

## 驗收紀錄

- `npx tsc -b` 綠 / **311 tests** 綠（EM 系列新增 ~60）
- `nginx -t` 通過
- **正式站端到端**（2026-08-05，agent-browser 實測 `https://mini-taiwan-pulse.itsmigu.com/embed`）：
  `mapboxCalls: 0` / `supabaseCalls: 0` / 底圖與 `temples.pmtiles`×7 tiles + `churches.geojson` 正常載入
- 開發期端到端（localhost）：
  - 相機參數精準命中、只開指定圖層（6 個兄弟層維持 none）
  - gated 圖層零下載
  - 嵌入版三種資料源（PMTiles / CDN 快照 / 歷史快照）皆正常渲染
  - popup 點擊、hover 游標、明暗主題
  - 文章嵌入排版（`docs/proposal/embed-prototype/demo-religion.html`）

## 相關

- 原型與重建步驟：[`../../proposal/embed-prototype/README.md`](../../proposal/embed-prototype/README.md)
- 剩餘待辦：[`backlog.md`](./backlog.md)
- 接手入口：[`handoff.md`](./handoff.md)
