# Embeddable Map — Handoff

> 給「另一個 session／另一個人」接手用。目標是**不用回問**就能繼續做。
> 全貌看 [`README.md`](./README.md)，剩餘工作看 [`backlog.md`](./backlog.md)。

## 0. 現況：已上線

正式站可用，嵌入碼可直接貼進文章：

```
https://mini-taiwan-pulse.itsmigu.com/embed?v=1&lng=120.13&lat=23.09&z=11.2&layers=aquaculturePonds
```

底圖（297 MB）與快照已在 S3，Zeabur 由 push 自動部署。**日後只有兩種情況要再動部署**：

```bash
# (a) 新增歷史快照後 —— 上傳 + 讓容器重啟（entrypoint 才會 pull）
aws s3 sync public/embed-snapshots/ "s3://$S3_BUCKET/deploy-assets/embed-snapshots/" --region ap-southeast-2

# (b) 重抽底圖後（Protomaps 每月更新）
aws s3 cp public/base_map/taiwan_basemap.pmtiles "s3://$S3_BUCKET/deploy-assets/base_map/" --region ap-southeast-2
```

⚠️ **不要跑整個 `upload-deploy-assets.sh`** —— base_map 那段是逐檔 `aws s3 cp`，
會把既有 400 MB+ 全部重傳。針對新增檔案上傳即可。

⚠️ 容器**啟動時**才 pull S3，光上傳不會生效。要 push 觸發部署（empty commit 無效，
Zeabur webhook 看 file diff）或用 Zeabur dashboard redeploy。

## 0b. Cloudflare 快取設定（EM-13，2026-08-05 已設定）

⚠️ **這是 dashboard 設定、不在程式碼裡**，故完整記於此。要重建或除錯時照抄。

**Rules → Cache Rules → `Static map data`**

條件（Custom filter expression）：

```
(ends_with(http.request.uri.path, ".pmtiles")) or
(ends_with(http.request.uri.path, ".geojson")) or
(starts_with(http.request.uri.path, "/static-rpc/")) or
(starts_with(http.request.uri.path, "/embed-snapshots/"))
```

| 設定 | 值 |
|---|---|
| Cache eligibility | **Eligible for cache** |
| Edge TTL | **Use cache-control header if present, bypass cache if not** |
| Browser TTL | **Respect origin TTL** |
| Status code TTL | **不設**（見下） |

**為什麼要建這條規則**：Cloudflare 預設只快取特定副檔名清單（`.js`/`.css`/`.jpg`…），
`.pmtiles` 與 `.geojson` **不在內** → 設定前全部是 `cf-cache-status: DYNAMIC`，每次都回源。

**為什麼不設 Status code TTL**：Edge TTL 選的是「沒有 cache-control 就 bypass」，
而 nginx 的 `add_header Cache-Control "public"` **沒有 `always`** → 404 回應不帶該 header
→ Cloudflare 直接 bypass。PRINCIPLES 2026-06-02 那個「404 被釘住整個 TTL」的坑天然避開。
**若日後把 `add_header` 改成 `always`，就必須回來補 Status code TTL（404/5xx → No cache）。**

### ⚠️ 驗證快取時不要用 `curl -I`

`-I` 是 HEAD 請求，Cloudflare 對 HEAD 的快取行為與 GET 不同 —— 會回 `DYNAMIC`
讓人誤以為規則沒生效。**一律用 GET**：

```bash
curl -s -o /dev/null -D - <url> | grep -i cf-cache-status
```

2026-08-05 實測（設定後）：

| 目標 | 結果 |
|---|---|
| 快照 GeoJSON，GET ×3 | HIT / HIT / HIT |
| `temples.pmtiles`（12 MB） | MISS → HIT（age: 4） |
| 底圖 297 MB，**純 Range Request** ×3 | MISS → HIT → HIT |

最後一項確認了 Cloudflare 會自行處理大檔案的分段快取 —— PMTiles 的 range request
不需要先有完整 GET 就能吃到邊緣快取。

## 1. 架構一句話

**共用資料與圖層邏輯，不共用地圖引擎與 UI。**

```
overlayRegistry (189 圖層定義)  ─┬─→ 主站 MapView (mapbox-gl) + App.tsx 3000 行狀態機
overlayManager  (source/layer)  ─┤
LegendPanel                     ─┴─→ /embed EmbedApp (MapLibre) 極簡 UI
```

`overlayManager` 是雙引擎共用的關鍵。它**只用兩者共有的 8 個 map 方法**，差異只有兩處：

1. **型別**：`OverlayMap` 是結構介面，不是 `MapboxMap | MaplibreMap` union
   —— union 會讓每個呼叫點都 TS2349（兩者 `getSource`/`addLayer` 泛型簽名分家）。
   檔內有兩行編譯期斷言，任一引擎改簽名就會紅。
2. **PMTiles source**：Mapbox 走 `mapbox-pmtiles` 的 `Style.setSourceType()`（Mapbox 專有 API），
   MapLibre 走 `addProtocol("pmtiles", …)`。由 `OverlayEngineOptions.pmtilesSource` 注入。

## 2. 網址 schema（`src/lib/urlState.ts`）

```ts
export interface UrlState {
  camera?: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  layers?: (keyof LayerVisibility)[];
  params?: Record<string, number>;   // 僅 /embed 消費
  date?: string;                     // YYYY-MM-DD
  hour?: number;                     // 0–23
  style?: string;                    // 主站底圖 id
  theme?: "dark" | "light";
  ui?: string[];
}

export function parseUrlState(search: string, opts?: { allowedLayers?: ReadonlySet<string> }): UrlState;
export function buildUrl(state: UrlState, base: string): string;
```

**改 schema 時的鐵則**：

- `v=1` 是版本閘門，缺它或不符一律回空物件 → 舊嵌入碼不會被新解析器誤讀。
  **要破壞相容性時應該升版號並保留舊版解析路徑**，不是直接改欄位語意。
- 一切驗證失敗都**靜默 drop**，絕不 throw —— 嵌入碼散落在別人的文章裡，白屏是最糟的失敗模式。
- `GATED_LAYERS` 的 key 一律 drop（`parseLayers` 內），這是私人資料的第一道防線。

## 3. 白名單怎麼派生（`src/embed/embedWhitelist.ts`）

```ts
EMBED_ALLOWED_CONFIGS = OVERLAY_REGISTRY.filter(
  (o) => (!o.dynamicData || o.id in EMBED_CDN_LAYERS) && !GATED_LAYERS.has(o.id)
);
EMBED_ALLOWED = new Set([...EMBED_ALLOWED_CONFIGS.map(o => o.id), ...SNAPSHOT_KEYS]);
```

**新增靜態圖層不必動這裡**（自動派生）。要放行一個動態圖層時：

1. 先確認它有 CDN 快照（`public/static-rpc/<rpc>.json`）
2. 加進 `EMBED_CDN_LAYERS`（key → rpc 名）
3. 測試會自動驗「快照檔真的存在」與「不是 gated」

## 4. 歷史快照怎麼加一層（`snapshotLayers.ts` + export 腳本）

以 `plaActivity` 為樣板，兩處要改：

**(a) 匯出**：`scripts/export/export-embed-snapshot.sh` 的 `case "$LAYER"` 加一個分支，
SQL 直接組 GeoJSON。注意兩個既有踩雷：

- psql 的 `-c` **不做** `:'var'` 插值 → 用 `__DATE__` 佔位符 + shell 端替換（日期已 regex 驗過）
- `.env` 含未引號特殊字元 → **不要 `source .env`**，只 grep 需要的那一行

**(b) 前端**：`SNAPSHOT_LAYERS` 加一個 `SnapshotLayerSpec`（sourceId + layers）。
樣式要對齊主站的 hook，但**只做單日靜態版** —— 不做多日疊加／回放／ageFade。

```bash
./scripts/export/export-embed-snapshot.sh plaActivity 2026-07-30
# → [export] ✅ features=4  size=4.0K
```

⚠️ **產出後一定要看 features 數**。BACKLOG BL-25 記著幾條上游死管線
（`get_flight_trails` retention ≈9 天、`get_waste_trails_matched_day` 全日期 0 rows、
`get_youbike_h3_*` matview 停更於 04-09）—— **RPC 有回應不代表那天真有資料**。

## 5. 相關 RPC signature

歷史快照 pilot 用的：

```sql
public.get_pla_tracks_range(p_end_date date, p_days int, p_include_review boolean)
  RETURNS TABLE (
    report_date date, days_ago int, shape_no int,
    geom_geojson jsonb,          -- Polygon
    shape_kind text,             -- 'rect'（走廊）| 'poly'（活動區）
    vertices int, needs_review boolean, guided boolean, ...
  )
```

顏色對照（與 `src/data/plaTracksLoader.ts` 的 `PLA_KIND_COLORS` 一致，改動要同步）：
`rect → #38bdf8`、`poly → #a855f7`。

## 6. 驗證嵌入版真的沒碰 Mapbox

這是本功能的成本前提，每次改動後都該重驗：

```bash
npm run build
grep -c "pk.eyJ" dist/assets/embed-*.js   # 必須是 0
grep -c "pk.eyJ" dist/assets/main-*.js    # 主站會是 1
```

執行期驗證（瀏覽器 console）：

```js
performance.getEntriesByType('resource').filter(e => /mapbox|supabase\.co/.test(e.name))
// 嵌入頁應為空陣列
```

## 7. 用 agent-browser 驗收的注意事項

`/embed` 是 WebGL 頁面，踩到的坑與主站相同（全域 memory `agent-browser-mapbox-verify`）：

- **daemon 導航後會遺失 WebGL context**（報 `Failed to initialize WebGL`、整頁空白但 UI 正常）。
  本 feature 開發期間踩了 3 次。解法：`agent-browser close` 後帶 launch args 重開 session，
  並**在同一輪 bash 呼叫內**完成 open → eval → screenshot。
- 點擊 popup 要用真實滑鼠：`mouse move X Y` → `mouse down` → `mouse up`
  （沒有 `mouse click` 子命令；MapLibre 的手勢處理不吃合成事件）。
- 先用 `window.__embedMap.queryRenderedFeatures({layers})` + `map.project()` 找到
  真的有圖徵的螢幕座標再點，否則會點在空白處誤判成「popup 壞了」。

## 8. 本機跑起來

```bash
# dev server（用 subshell 起，否則會被背景任務管理清掉）
(npm run dev > /tmp/vite-pulse.log 2>&1 &)

# 主站（Share 按鈕在右上）
open "http://localhost:3721/"

# 嵌入版
open "http://localhost:3721/embed.html?v=1&lng=120.2&lat=23.0&z=12.5&layers=religionTemples,religionChurches"

# 文章嵌入效果（需另起 8900 供檔，見 docs/proposal/embed-prototype/README.md）
open "http://localhost:8900/demo-religion.html"
```
