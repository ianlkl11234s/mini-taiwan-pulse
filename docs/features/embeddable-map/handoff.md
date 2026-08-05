# Embeddable Map — Handoff

> 給「另一個 session／另一個人」接手用。目標是**不用回問**就能繼續做。
> 全貌看 [`README.md`](./README.md)，剩餘工作看 [`backlog.md`](./backlog.md)。

## 0. 現在最該做的一件事

**底圖與快照還沒上 S3，所以正式站的 `/embed` 是壞的**（會載不到底圖）。

```bash
# 1. 確認本機有底圖（283 MB，gitignore；沒有的話照 docs/proposal/embed-prototype/README.md 重抽）
ls -lh public/base_map/taiwan_basemap.pmtiles

# 2. 上傳（三處接線已就緒，不必改腳本）
./scripts/deploy/upload-deploy-assets.sh

# 3. 部署後驗收
#    - https://mini-taiwan-pulse.itsmigu.com/embed?v=1&lng=120.13&lat=23.09&z=11.2&layers=aquaculturePonds
#    - 外站 iframe 實測（非 localhost）
#    - Network 應只見 /base_map/ 與圖層檔，**不得出現 api.mapbox.com**
```

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
