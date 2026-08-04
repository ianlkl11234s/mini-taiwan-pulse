# 嵌入版免費底圖（OSM / Protomaps）— 探索紀錄與計畫

> 2026-08-03 探索 · **尚未動工**
> 上游脈絡：[`embeddable-map.md`](./embeddable-map.md)（目標／費用）· [`embeddable-map-impl.md`](./embeddable-map-impl.md)（實作計畫）
> 起因：嵌入版若走 Mapbox，成本隨別人的文章流量增長。想讓 **embed 用免費 OSM 底圖、主站保留 Mapbox**。

## 1. 結論先講

**想法可行，而且你的技術棧已經準備好了 —— 但關鍵前提跟直覺相反：**

> ❗ **只換底圖圖磚（tile）省不到錢。必須連地圖函式庫一起換掉。**

原因：Mapbox 的計費單位是 **map load = `Map` 物件初始化一次**
（[官方定義](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/)），
**與你載入誰的圖磚無關**。只要頁面上跑的是 `mapbox-gl` 這個函式庫，初始化就計一次。

所以路徑是：**embed 改用 MapLibre GL JS**（`mapbox-gl` v1 的開源分支，BSD 授權、無計費、無 token），
搭配自託管的 Protomaps OSM 底圖 → **embed 的地圖成本真正歸零**。主站完全不動，繼續用 Mapbox 的好底圖。

### 查證狀態（誠實標記）

| 主張 | 狀態 |
|---|---|
| map load = `Map` 初始化，與 tile 來源無關 | ✅ 官方文件明文 |
| Mapbox **明文禁止**搭配第三方圖磚 | ❌ **查不到明文**。ToS 與 pricing 頁都未提及第三方來源；業界分析（CARTO／Geoapify）認為 v2+ 按函式庫使用計費 |
| 搭第三方圖磚是否仍計費 | ⚠️ **官方未書面說明** — 灰色地帶 |

> 我沒有證實「Mapbox 禁止你這樣做」。但**走 MapLibre 就完全繞開這個灰色地帶**，
> 不必去問 Mapbox 業務、也不必賭條款解釋。這是選 MapLibre 而非「Mapbox GL + OSM tiles」的真正理由。

## 2. 底圖來源選型

| 方案 | 成本 | 判定 |
|---|---|---|
| **Protomaps PMTiles 自託管**（R2） | 儲存 ~$0.015/GB/月，**egress 免費** | ✅ **採用** — 你已有 PMTiles 技術棧 |
| MapTiler / Stadia / CARTO 等託管服務 | 有免費額度，超量計費 | ⏸ 備案（省事但又回到「流量=帳單」） |
| `tile.openstreetmap.org` 官方圖磚 | 免費 | ❌ **不可用** — [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) 明文要求重度使用者自架，會無預警封鎖 |

### 為什麼 Protomaps 特別適合你

你**已經有全套基礎建設**，這不是從零開始：

| 你已有的 | 用途 |
|---|---|
| `pmtiles ^4.4.1`（package.json:36） | Protomaps 官方讀取器，**已裝但目前沒用到**（現在走 `mapbox-pmtiles`） |
| 59 個 PMTiles 圖層在線上跑 | 團隊已熟悉 PMTiles 工作流 |
| Cloudflare R2（`.env.example:8`） | 底圖託管位置，egress 免費 |
| S3/R2 部署腳本（`scripts/deploy/`） | 上傳流程現成 |

Protomaps 的模型是：**整張底圖就是一個靜態檔**，瀏覽器用 HTTP Range Request 直接讀，
沒有 tile server、沒有資料庫、沒有 API key。

### 檔案大小

| 範圍 | 大小 |
|---|---|
| 全球 z0–15 | ~120 GB |
| 全球 z0–6 | ~60 MB |
| 歐洲 extract | 30–50 GB |
| **台灣 extract z0–14** | ⚠️ **需實測**（`pmtiles extract --bbox` 可從遠端 daily build 直接抽，不必下載全球） |

每多一個 zoom level，大小約翻倍。台灣範圍實測前不編數字。

## 3. 成本試算

假設台灣底圖 extract 為 500 MB（實測後修正）：

| 項目 | 計算 | 月成本 |
|---|---|---|
| R2 儲存 | 0.5 GB × $0.015 | **$0.008**（且在 10 GB 免費額度內 → **$0**） |
| R2 egress | 免費 | **$0** |
| R2 Class B 讀取 | 每次瀏覽約 20–50 tiles；免費額度 1,000 萬次/月 → 約 **20–50 萬次瀏覽** | **$0** |
| MapLibre 授權 | BSD-3，開源 | **$0** |

**→ embed 的地圖成本實質為 $0**，對照原方案（10 篇文章 × 5,000 PV 走 Mapbox ≈ **+$250/月**）。

> R2 定價已查證：儲存 $0.015/GB-月、**egress 免費**、免費額度 10 GB + 1,000 萬次 Class B 讀取
> （[R2 pricing](https://developers.cloudflare.com/r2/pricing/)）。

## 4. 遷移範圍盤點 ⭐

「換底圖要調整很多地方嗎？」——**取決於範圍**。我實際盤過：

### 4-1. 好消息：核心圖層邏輯幾乎不用改

| 模組 | 行數 | 對 mapbox-gl 的依賴 | 遷移成本 |
|---|---|---|---|
| **`overlayManager.ts`**（189 個圖層的裝載邏輯） | 367 | **只有 3 處，全是 TypeScript 型別**（`overlayManager.ts:1, 134, 197`） | 🟢 換型別即可，執行期零改動 |
| `overlayRegistry.ts`（189 個圖層定義） | — | 純設定物件 + Mapbox expression | 🟢 MapLibre 相容 |
| `LegendPanel.tsx` | — | 不碰地圖 API | 🟢 直接複用 |

MapLibre 是 mapbox-gl v1 的分支，API **約 95% 相同**，`addSource` / `addLayer` / expression 幾乎照搬。

### 4-2. 要改的地方

| # | 項目 | 現況 | 改法 | 難度 |
|---|---|---|---|---|
| 1 | **PMTiles 註冊方式** | `pmtilesSourceType.ts:26` 用 Mapbox 專有的 `Style.setSourceType()` + `mapbox-pmtiles` 套件 | MapLibre 改用 `maplibregl.addProtocol("pmtiles", …)`，走**已安裝的** `pmtiles` 套件 | 🟡 標準做法，~20 行 |
| 2 | **底圖 style** | `StyleSelector.tsx:4-12` 7 個全是 `mapbox://styles/mapbox/*` | embed 用 Protomaps 官方 style JSON（dark/light 都有） | 🟢 |
| 3 | **Embed 地圖殼層** | `MapView.tsx` 431 行是為 mapbox-gl 寫的 | embed 另寫一層薄殼（MapLibre 版），**共用 overlayManager** | 🟡 見下方 trade-off |
| 4 | **底圖產製** | 無 | `pmtiles extract --bbox` 抽台灣 → 上 R2 → 排每月更新 | 🟢 |

### 4-3. Trade-off：修正上一份計畫的一個假設 ⚠️

`embeddable-map-impl.md` §0 發現① 說「embed 可直接複用 `MapView`」。
**改用 MapLibre 後這點不成立** —— `MapView` 綁定 mapbox-gl。

但沒有回到「大工程」，因為真正的重活可以共用：

| | 能否共用 | 說明 |
|---|---|---|
| `overlayManager`（367 行，圖層裝載） | ✅ | 只有 3 處型別要泛化 |
| `overlayRegistry`（189 個圖層定義） | ✅ | 純資料 |
| `LegendPanel`（圖例） | ✅ | 不碰地圖 API |
| `MapView` 那層薄殼（初始化、style 切換、Three.js / isochrone factory 接線） | ❌ | embed 另寫約 150–200 行，且**不需要** Three.js 與各 factory |

**代價**：embed 多寫約 150–200 行，並多一個維護面（overlayManager 的型別要同時滿足兩個引擎）。
**換到的**：embed 地圖成本從 $250/月 → $0，且不再受 Mapbox 條款解釋風險影響。

### 4-4. 不建議：全站改 MapLibre

你已明說主站要保留 Mapbox 的好底圖，所以這條路本來就不在考慮內。附帶理由：
主站有 Three.js CustomLayer（`src/three/*Scene.ts`、`src/map/*CustomLayer.ts`）、
多個 layerFactory、mapbox-gl v3 專有功能，全站遷移風險遠高於收益。

## 5. 對既有計畫的影響

`embeddable-map-impl.md` 的 Phase 調整：

| Phase | 原計畫 | 改為 |
|---|---|---|
| Phase 1（主站 deep link + 解封鎖） | 不變 | ✅ 不受影響 |
| Phase 2（`/embed`） | 複用 `MapView` | 改為 MapLibre 薄殼 + 共用 overlayManager；**新增底圖產製前置** |
| Phase 3（分享按鈕） | 不變 | ✅ 不受影響 |

新增前置工作（可與 Phase 1 平行，互不阻塞）：

- **Phase 0-B：底圖產製** — `pmtiles extract` 抽台灣 → 上 R2 → 設 CORS → 用 MapLibre 最小範例驗證能顯示

## 6. 建議執行順序

| 步驟 | 內容 | 阻塞關係 |
|---|---|---|
| 1 | **底圖 spike**（半天）：抽台灣 extract、測實際大小、放 R2、MapLibre 最小頁面顯示成功 | 無依賴，**建議先做** — 它驗證整條路且能得到真實檔案大小 |
| 2 | Phase 1（URL 參數 + 解除 iframe 封鎖） | 無依賴 |
| 3 | Phase 3（分享按鈕） | 依賴 2 |
| 4 | `overlayManager` 型別泛化 | 依賴 1 |
| 5 | Phase 2（embed MapLibre 薄殼） | 依賴 1、4 |

**步驟 1 是最有價值的第一步**：半天內就能知道「台灣底圖多大、看起來夠不夠好、能不能接受」，
而且失敗的話整個 OSM 路線就此打住，不會浪費後面的工。

## 7. 待確認 / 風險

| # | 項目 | 說明 |
|---|---|---|
| 1 | **台灣 extract 實際大小** | 步驟 1 得到。若 z0-15 過大，降到 z0-14 或 z0-13（每降一級約減半） |
| 2 | **底圖美觀度落差** | Protomaps 底圖 vs Mapbox 底圖有視覺差距。**你要親眼看過再決定能否接受**——這是主觀判斷，我不能代你決定 |
| 3 | **OSM 標示義務** | ODbL 要求標示「© OpenStreetMap contributors」。與 proposal §7-5 的出處標示合併處理，同樣不可關閉 |
| 4 | **底圖更新頻率** | Protomaps 有 daily build。建議每月重抽一次；排程與現有 deploy 腳本整合 |
| 5 | **overlayManager 雙引擎型別** | 泛化後要確保主站 Mapbox 路徑不回歸 → 既有測試（`overlayManager.test.ts`）須全綠 |
| 6 | **中文標示品質** | OSM 台灣中文地名覆蓋率不如 Mapbox。步驟 1 時一併目視檢查 |

## 8. 參考

- Protomaps 基本用法：<https://docs.protomaps.com/guide/getting-started> · [basemap 下載](https://docs.protomaps.com/basemaps/downloads)
- MapLibre 遷移指南：<https://maplibre.org/maplibre-gl-js/docs/guides/mapbox-migration-guide/>
- OSM 圖磚使用政策：<https://operations.osmfoundation.org/policies/tiles/>
- R2 定價：<https://developers.cloudflare.com/r2/pricing/>
- Mapbox map load 定義：<https://docs.mapbox.com/mapbox-gl-js/guides/pricing/>
