# 可嵌入地圖 — 實作計畫（EM 系列）

> 2026-08-03 · 決策依據見 [`embeddable-map.md`](./embeddable-map.md)（目標／費用／風險）
> 本檔專注**怎麼做**：架構研究結論 + 逐檔工作項 + 驗收。
> 狀態：**尚未動工**，待 owner 拍板 §7 的三項決策。

## 0. 研究結論摘要（本計畫的地基）

實際讀過 codebase 後，工作量比初版 proposal 估的**小很多**，因為四個機制已經存在：

| # | 發現 | 位置 | 對計畫的影響 |
|---|---|---|---|
| ① | **`MapView` 只有 10 個 props、431 行，且自足處理全部 199 個 2D overlay** | `src/map/MapView.tsx:86-98` | `/embed` 不需要 `App.tsx` 的 3003 行 → Phase 2 從「大工程」降為「小工程」 |
| ② | **`CameraPreset` 已含 `layers` + `time`，且 App 已在套用** | `src/types/index.ts:22-39`、`src/App.tsx:1735-1740` | 「場景 = 相機＋圖層＋時間」機制**是活的**，URL 只是新的觸發來源，不是新機制 |
| ③ | **`MapBridge` 已提供雙向能力** | `src/App.tsx:1745-1776` | `bulkSetVisibility` / `flyTo` / `getCamera` / `getVisibleLayerKeys` 全都有 → §5 分享按鈕幾乎白撿 |
| ④ | **`OverlayConfig.dynamicData` 是現成的動態／靜態判準** | `src/types/index.ts:646` | embed 白名單可**自動派生**，不用手維護清單 |

**唯一的硬阻礙**（見 §2）：`useTransportParams` 是 3028 行、數百個 hardcode `useState` 的巨型 hook，
**無法從外部注入初始值**。這決定了 `p.*` 參數的實作路徑必須繞路。

### 數字盤點

| 項目 | 數量 | 來源 |
|---|---|---|
| Layer key 總數 | **320** | `LAYER_COLORS`（`layerCatalog.ts:32`） |
| Overlay 註冊數 | **199** | `overlayRegistry.ts` |
| ├ 動態（走 Supabase RPC） | 45（`dynamicData: true`） | 同上 |
| └ **靜態（GeoJSON / PMTiles）** | **154**（其中 59 個 PMTiles） | 同上 |
| owner-gated（須排除） | **32** | `GATED_LAYERS`（`layerCatalog.ts:1435`） |

→ **embed 預設白名單 = 154 靜態 − gated ≈ 150 個圖層**，且完全不打 Supabase。
魚塭（`aquaculturePonds` / `aquacultureZone` / `aquacultureCageNet`）都在靜態池內。

## 1. 架構決策

### 1-1. 兩條路徑，分開處理 ⭐

| | 主站 deep link（`/?...`） | `/embed?...` |
|---|---|---|
| 用途 | 分享「當前畫面」連結 | 文章嵌入 |
| 相機 | ✅ | ✅ |
| `layers` | ✅ 走 `setLayerVisibility` 真 setter | ✅ |
| `p.*` 參數 | ❌ **不支援**（見 §2） | ✅ 走 merge 注入 |
| `date` 凍結 | ✅ 走 `timelineSeek` | ✅ |
| UI | 完整 | 極簡 |
| 依賴 | `App.tsx` | 只依賴 `MapView` + `LegendPanel` |

**為什麼主站不支援 `p.*`**：主站有 sidebar，使用者會去拉 slider。URL override 若持續生效會蓋掉使用者操作；
若只套用一次又會在下次 render 跳回預設值。兩者都是壞體驗。而 embed 沒有 sidebar，不存在這個衝突。

**這個切分讓兩邊都不必動 `useTransportParams`（3028 行）** — 符合外科手術式修改原則。

### 1-2. `/embed` 不呼叫 `useTransportParams`

`MapView` 的每個參數消費點都寫成 `params.xxx ?? fallback`（如 `MapView.tsx:14`
`p.fireIsochroneOpacity ?? 0.5`、`:32` `params.agricultureOpacity ?? 1`），
所以 **embed 直接傳 `{...urlParams}` 即可**，未指定的參數自動落到各 factory 的內建預設。

> ⚠️ **假設待驗證**（Phase 2 第一件事）：抽查 10 個代表性圖層確認 `?? fallback` 是普遍 pattern。
> 若發現某些 layer 缺 fallback → 退路是從 `useTransportParams` 抽出 `DEFAULT_OVERLAY_PARAMS` 常數共用
> （純抽常數，不改邏輯）。

### 1-3. 白名單自動派生

```ts
// src/embed/embedWhitelist.ts
export const EMBED_ALLOWED = new Set(
  OVERLAY_REGISTRY
    .filter((o) => !o.dynamicData)           // 靜態檔才收 → Supabase egress 歸零
    .map((o) => o.id)
    .filter((id) => !GATED_LAYERS.has(id)),  // 硬排除 32 個私人圖層
);
```

動態圖層要逐案加白名單（需同時評估 Supabase egress，見 proposal §6-2）。

## 2. 硬阻礙：`useTransportParams` 無法注入初始值

**現況**：`src/hooks/useTransportParams.ts` 3028 行，內含數百個 `useState(hardcode)`
（`:81` `useState(3)`、`:83` `useState(0.1)`…），最後 derive 出 `overlayParams`（`:2991`）。

評估過的四條路：

| 方案 | 做法 | 判定 |
|---|---|---|
| A | 改簽名 `useTransportParams(initial?)`，每個 `useState` 加 `?? initial.x` | ❌ 要改數百行，違反外科手術原則 |
| B | 開機後用 `getControls()` 的 `onChange` 套用 | ❌ controls 以中文 label 分組，無穩定 key |
| C | **在 `overlayParams` 出口 merge URL override** | ✅ **embed 採用**（無 sidebar 衝突） |
| D | override 存 state，使用者操作時逐 key 清除 | ⏸ 主站若日後要支援 `p.*` 再做 |

**決策：採 C，且只用在 `/embed`。** 主站 deep link 不支援 `p.*`（§1-1）。

## 3. Phase 1 — 主站 deep link + 解除 iframe 封鎖

> 估 1–2 天。結束後：主站可被 iframe 嵌入，且支援 `?layers=&lng=&lat=&z=`。

### 1.1 解除 iframe 封鎖 — `nginx.conf`

| 動作 | 位置 |
|---|---|
| **刪除** `add_header X-Frame-Options "SAMEORIGIN" always;` | `:232` |
| **新增**一條正式 CSP，只含 `frame-ancestors` | `:232` 原處 |
| 保留 `Content-Security-Policy-Report-Only` 整條不動 | `:241` |

```nginx
# 刪掉 X-Frame-Options（不支援白名單語法，ALLOW-FROM 已廢棄）
# 新增：只放 frame-ancestors 的正式 CSP。其餘規則維持 Report-Only（:241）避免一次轉正炸掉 Mapbox/R2
add_header Content-Security-Policy "frame-ancestors *" always;
```

> ⚠️ **兩個坑**：
> 1. `frame-ancestors` 在 `-Report-Only` 下**不生效**，所以現在真正在擋的是 `X-Frame-Options` — 只改 CSP 不刪它等於沒改。
> 2. nginx 的 `add_header` **在同一 location 內會累加不覆蓋**；若某 location block 另有 `add_header` 會使父層整組失效。改完要逐 location 確認。

若 §7 決定走白名單 → `frame-ancestors 'self' https://<允許網域>`。

### 1.2 URL 解析器（純函式，可單測）

新增 `src/lib/urlState.ts`：

```ts
export interface UrlState {
  camera?: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  layers?: (keyof LayerVisibility)[];
  params?: Record<string, number>;   // 僅 embed 消費
  date?: string;                     // YYYY-MM-DD
  theme?: "dark" | "light";
  ui?: string[];
}

export function parseUrlState(search: string, opts: { allowedLayers?: ReadonlySet<string> }): UrlState;
export function buildUrl(state: UrlState, base: string): string;   // 給 §5 分享按鈕用
```

規則（全部要有測試）：
- 未知 layer key → **靜默 drop**（不 throw、不白屏）
- `GATED_LAYERS` key → **靜默 drop**
- 數值 parse 失敗 / 超出合理範圍（zoom 0–22、lat ±90、lng ±180）→ drop 該欄位
- 缺 `v` 或 `v` 非 `1` → 回傳空物件（未來版本相容）

### 1.3 接進 `App.tsx`

| # | 改動 | 位置 |
|---|---|---|
| a | mount 時解析一次 URL，存入 `useRef` | `App.tsx` 頂部 |
| b | `preset` 改成 URL 優先 | `App.tsx:1363-1366` |
| c | 初始 `layerVisibility` 套用 URL 的 `layers` | 走現成 `handleBulkSetVisibility`（`:1710` 附近） |
| d | `date` → `timelineSeek` | 複用 `handleLocationJump` 的既有寫法（`:1735`） |

(b) 的具體改法：
```ts
const preset = useMemo(
  () => urlStateRef.current.camera
    ? { ...DEFAULT_CAMERA, ...urlStateRef.current.camera, id: "url", name: "URL", category: "city" as const }
    : getPresetById(selectedAirport) ?? DEFAULT_CAMERA,
  [selectedAirport],
);
```
> 注意 `MapView:337-343` 有 effect 對 `preset` 變動做 `flyTo`，所以 URL 相機**只在初次生效**即可，
> 不要讓 `urlStateRef` 進 deps（會在使用者操作後把鏡頭拉回去）。

### 1.4 測試

新增 `src/lib/__tests__/urlState.test.ts`：
- round-trip：`buildUrl(parseUrlState(x)) === x`
- gated key 被 drop（用真實的 `powerPlants`）
- 未知 key 被 drop
- 超範圍數值被 drop
- 缺版本號回空

## 4. Phase 2 — `/embed` 精簡模式

> 估 2–3 天。

### 2.1 驗證 §1-2 假設（先做，30 分鐘）

抽查 10 個代表圖層的 params 消費點確認 `?? fallback` 普遍成立。不成立則先抽 `DEFAULT_OVERLAY_PARAMS`。

### 2.2 Vite 多入口 — `vite.config.ts`

```ts
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, "index.html"),
      embed: resolve(__dirname, "embed.html"),
    },
  },
},
```
新增 `embed.html`（複製 `index.html` 改 script 指向 `/src/embed/main.tsx`）。
> 產出為 `/embed.html`。要讓 `/embed` 這個乾淨網址可用，需在 `nginx.conf` 加
> `location = /embed { try_files /embed.html =404; }`（dev server 走 `/embed.html` 即可）。

### 2.3 Embed 元件

新增 `src/embed/`：

| 檔案 | 內容 |
|---|---|
| `main.tsx` | entry，`createRoot` → `<EmbedApp />` |
| `EmbedApp.tsx` | 解析 URL → `<MapView>` + `<LegendPanel>` + 出處列 + 「開啟完整地圖 ↗」 |
| `embedWhitelist.ts` | §1-3 的自動派生白名單 |

`EmbedApp` 骨架（**不呼叫 `useTransportParams`**）：
```tsx
const url = parseUrlState(window.location.search, { allowedLayers: EMBED_ALLOWED });
const visibility = buildVisibility(url.layers);          // 全 false + 指定的 true
return (
  <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
    <MapView
      preset={cameraOf(url)} styleUrl={getStyleUrl(url.theme === "light" ? "light" : "dark")}
      flights={[]} renderMode="2d" isDarkTheme={url.theme !== "light"} showTrails={false}
      layerVisibility={visibility} overlayParams={url.params ?? {}}
    />
    <LegendPanel visibility={visibility} overlayParams={url.params ?? {}} isDarkTheme={url.theme !== "light"} />
    <EmbedFooter />   {/* 出處標示（不可關閉）+ 連回主站 */}
  </div>
);
```
> `LegendPanel` props 只要 3 個（`LegendPanel.tsx:184-189`）→ 直接複用，滿足圖層 UX 四鐵則的「圖例」。
> 不呼叫 `handleMapReady` 的 `addAllLayers` → 不掛 Three.js，bundle 與 GPU 都省。

### 2.4 出處標示（法律義務，不可關閉）

`EmbedFooter` 固定顯示資料來源 + 「Mini Taiwan Pulse」連結。
`ui=` 參數**不接受**移除 attribution（proposal §7-5）。

### 2.5 行動裝置降級

窄螢幕（`innerWidth < 640`）自動 `pitch=0`、忽略 URL 的 pitch。

### 2.6 Bundle 實測（驗收條件）

`npm run build` 後比較 `dist/assets/embed-*.js` vs `index-*.js`。
目標 **< 1.5 MB**（主站現況 5.1 MB）。
> 風險：`MapView` → `overlayRegistry` → 幾十個 `data/*Types` 的 import 鏈可能把體積拉回去。
> 若超標，處置是把 `overlayRegistry` 按主題拆分做動態 import，**不是**放棄獨立 entry。

## 5. Phase 3 — 分享／嵌入按鈕（建議緊接 Phase 1）

| # | 工作 | 依賴 |
|---|---|---|
| 3.1 | 操作時 `history.replaceState` 更新網址 | `buildUrl()` + `getCamera()`（**已存在**，`App.tsx:1768`） |
| 3.2 | 「分享／嵌入」UI：吐出 `<iframe>` 代碼 + 複製鈕 | `getVisibleLayerKeys()`（**已存在**，`App.tsx:1763`） |

> 沒有 3.2，你每次寫文章都要手拼 URL。**這是體感上投報率最高的一項。**

oEmbed / 動態 OG **不做**（proposal §8 決策 4）。

## 6. 守門與相容

| 守門 | 影響 | 處置 |
|---|---|---|
| `layerConsistency.test.ts` | 掃 `useTransportParams.ts` 原始碼文字 | 本計畫不改該檔 → **不受影響** |
| `deployContract.test.ts` | 掃 `overlayRegistry` sourceUrl vs nginx location | 只改 header 不改 location → **不受影響**；但 2.2 新增 `location = /embed` 後要重跑確認 |
| **新增** `urlState.test.ts` | gated / 未知 key / 範圍檢查 | §3.4 |
| **新增** embed 白名單測試 | 確保 45 個 `dynamicData` 與 32 個 gated 都不在 `EMBED_ALLOWED` | §4.3 |

### 嵌入碼防腐（proposal §7-1）

新增 `src/lib/layerAliases.ts`：`Record<oldKey, newKey>`。
`parseUrlState` 先過別名表再驗證。改名圖層時加一筆而非直接改。
配套測試：`LAYER_COLORS` 少了某 key 且別名表無對應 → 紅。

## 7. 待 owner 拍板（擋住動工）

| # | 問題 | 選項 | 建議 |
|---|---|---|---|
| 1 | `frame-ancestors` 開放範圍 | `*` 全開 / 白名單 | **全開**，但**先設 Mapbox 用量告警**（proposal §7-2） |
| 2 | Phase 順序 | 1→2→3 / **1→3→2** | **1→3→2**：先有分享按鈕，你才能實際用起來並發現真正的需求 |
| 3 | Mapbox 現況月用量 | — | **動工前先查 dashboard**，決定 facade 是「建議」還是「必須」 |

## 8. 驗收條件

**Phase 1**
- [ ] 外站 HTML 的 iframe 能顯示地圖（非白屏）— 用本機 file:// 或 CodePen 實測
- [ ] `?v=1&lng=120.13&lat=23.09&z=11.2&layers=aquaculturePonds` 開機即定位並開層
- [ ] `layers=powerPlants`（gated）→ 該層被 drop，其餘正常
- [ ] `layers=notARealKey` → 靜默忽略，不 crash
- [ ] URL 相機不干擾使用者後續操作（拖曳後不會被拉回）
- [ ] `npx tsc -b` 綠 · `pnpm test` 綠

**Phase 2**
- [ ] `/embed` bundle < 1.5 MB
- [ ] `dynamicData` 圖層無法經 URL 開啟（Supabase egress = 0）
- [ ] 出處標示存在且無法用 `ui=` 移除
- [ ] 手機實機不卡頓（pitch 自動降級生效）

**Phase 3**
- [ ] 分享按鈕產出的 iframe 代碼，貼到外部 HTML 能重現當下畫面

## 9. 不做（明確排除）

- oEmbed endpoint / 動態 OG 圖（需動態後端，等真有第三方 CMS 需求）
- 給第三方的 JS SDK
- embed 版的會員功能（iframe 內第三方 cookie 被擋，登入態不存在 — proposal §7-3）
- 動態圖層的 embed 支援（逐案評估，非預設）
