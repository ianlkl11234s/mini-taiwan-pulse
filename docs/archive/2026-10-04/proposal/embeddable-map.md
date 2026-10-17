# 可嵌入地圖（Embeddable Map / EM 系列）

> 2026-08-03 規劃 · **尚未實作**，本檔為決策文件（目標／費用／風險）
> **實作計畫見 [`embeddable-map-impl.md`](./embeddable-map-impl.md)**（架構研究結論 + 逐檔工作項）
> 起因：把 Mini Taiwan Pulse 當成「文章裡的互動插圖」——寫魚塭主題時，
> 文章中間直接嵌一張已經定位到臺南、已開好 `aquaculturePonds` 圖層的活地圖。
> 正式站：`https://mini-taiwan-pulse.itsmigu.com`

## 1. 目標

讓任何一篇文章（自己的部落格、Medium、新聞稿）能用一段 `<iframe>` 嵌入
**針對該文特化**的 Mini Taiwan Pulse 畫面：指定相機位置、指定開啟的圖層、指定圖層參數，
讀者可直接在文章裡拖曳縮放，點右下角連回完整站台。

非目標（本階段不做）：
- 不做給第三方用的 JS SDK（安全與維運成本都高，iframe 已足夠）
- 不做嵌入方自訂樣式（只開放參數，不開放 CSS）

## 2. 技術名詞

常被混為一談的三層，釐清後才知道要做多少：

| 層次 | 名稱 | 做什麼 | 本專案 |
|---|---|---|---|
| 基礎 | **iframe embed** | `<iframe src>` 把頁面塞進別人文章 | ✅ 必做 |
| 參數化 | **deep link / permalink** | URL query 決定初始畫面 | ✅ 必做，工作量最大 |
| 自動化 | **oEmbed** | 貼一條網址，CMS 自動轉成嵌入區塊（IG / YouTube 用的就是這個） | ⏸ 暫緩，需動態後端 |

搭配技術：**Open Graph meta**（貼連結時的預覽卡）、**postMessage**（iframe ↔ 父頁通訊，
用於自動調整高度）、**facade / lite-embed**（先放靜態縮圖，點擊才載入真地圖——見 §6 費用）。

## 3. 現況盤點（三個阻礙）

### 3-1. nginx 明確禁止被嵌入 ⛔

`nginx.conf:232` 與 `:241`：

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
# CSP（目前是 Report-Only）
... frame-ancestors 'self'
```

現在任何外站放 iframe 一律白屏。**這是硬阻擋，不改則整個功能為零。**

兩個細節：
- `X-Frame-Options` 不支援白名單語法（`ALLOW-FROM` 已被主流瀏覽器廢棄），要開放就得**整條刪掉**，
  改用 CSP `frame-ancestors` 來控制。
- 目前 CSP 掛在 `Content-Security-Policy-Report-Only`。**`frame-ancestors` 在 Report-Only 模式下不生效**，
  所以真正在擋的是 `X-Frame-Options`。改法是拆一條正式的 `Content-Security-Policy` 只放 `frame-ancestors`，
  其餘規則維持 Report-Only 不動（避免一次性把整個 CSP 轉正式而炸掉 Mapbox / Supabase / R2）。

### 3-2. 完全沒有 URL 參數機制

全站唯一一處讀 query 的地方是 `src/map/MapView.tsx:273` 的 debug flag。
圖層與參數都是純記憶體 state，重新整理即消失：

| State | 來源 | 形狀 | 規模 |
|---|---|---|---|
| `layerVisibility` | `src/hooks/useLayerVisibility.ts` | `Record<layerKey, boolean>` | **320 個 key**（`LAYER_COLORS` 派生） |
| `overlayParams` | `src/hooks/useTransportParams.ts:2991` | `Record<string, number>` | 數百個 |

好消息：兩者都極易序列化。`overlayParams` **刻意只收數字**（select 一律編成 `...Idx`、
boolean 一律 0/1，見 PRINCIPLES「boolean 透過 overlayParams 一律 0/1 中介」），
所以 URL 不需要處理型別歧義。

壞消息：320 個 key 不可能全塞 URL → 必須走 **diff-based 序列化**（只寫非預設值），見 §4。

### 3-3. bundle 5.1 MB

`dist/assets/index-*.js` 未壓縮 5.1 MB（gzip 約 1.3–1.5 MB）。
`App.tsx` 3003 行把所有 hook 掛上，但一次嵌入通常只需要 1–2 個圖層。

這同時是**效能問題**與**費用問題**（§6）。解法是 `/embed` 走 Vite 獨立 entry，不是在 `App.tsx` 加 `if`。

## 4. URL Schema 設計

### 4-1. 原則

1. **Diff-based**：只序列化與預設值不同的項目。預設幾乎全關（`DEFAULT_ON` 只有 `streetTreesTaipeiDiff`），
   所以 `layers=` 就是「要開的清單」，通常 1–3 個。
2. **Human-readable**：你寫文章時要手打／手改，不用 base64 壓縮。
3. **版本化**：`v=1` 開頭。日後 schema 改動時，舊嵌入碼仍能被正確解讀（見 §7-1）。
4. **未知 key 靜默忽略**：日後圖層下架時，舊嵌入碼要退化成「少一層」而不是白屏。

### 4-2. 參數表

| 參數 | 型別 | 說明 | 範例 |
|---|---|---|---|
| `v` | int | schema 版本，必填 | `v=1` |
| `lng` / `lat` | float | 相機中心 | `lng=120.19&lat=23.12` |
| `z` | float | zoom | `z=11.5` |
| `pitch` / `bearing` | float | 傾角／方位，可省略 | `pitch=45&bearing=-20` |
| `layers` | csv | 要開啟的 layer key（逗號分隔） | `layers=aquaculturePonds,aquacultureZone` |
| `p.<key>` | number | `overlayParams` 覆寫 | `p.aquaculturePondsOpacity=0.85` |
| `date` | YYYY-MM-DD | 凍結歷史畫面（見 §7-4） | `date=2026-07-15` |
| `theme` | `dark`\|`light` | 主題 | `theme=dark` |
| `ui` | csv | 要顯示的 UI 元件白名單 | `ui=legend,attribution` |

### 4-3. 完整範例（魚塭文章用）

```
https://mini-taiwan-pulse.itsmigu.com/embed?v=1
  &lng=120.13&lat=23.09&z=11.2&pitch=45
  &layers=aquaculturePonds,aquacultureZone
  &p.aquaculturePondsOpacity=0.9
  &theme=dark&ui=legend,attribution
```

嵌入碼：

```html
<iframe
  src="https://mini-taiwan-pulse.itsmigu.com/embed?v=1&lng=120.13&lat=23.09&z=11.2&layers=aquaculturePonds"
  width="100%" height="480" style="border:0;border-radius:8px"
  loading="lazy"
  title="臺南魚塭分布 — Mini Taiwan Pulse"
  allowfullscreen></iframe>
```

### 4-4. 硬性排除：owner-gated 圖層 🔒

`GATED_LAYERS`（`layerCatalog.ts:1435`，**35 個 key**：畜牧場／石化油氣／電網／電廠）
**必須在 embed 端硬性拒絕**，且不能只依賴登入態——見 §7-3（iframe 內第三方 cookie 被瀏覽器封鎖，
登入態根本不會存在，但這是「剛好安全」不是「設計安全」）。

作法：embed 的 layer 解析器對 `GATED_LAYERS.has(key)` 直接 drop，並加測試守門。

## 5. 分階段實作

### Phase 1 — 能嵌（估 1–2 天）

| # | 工作 | 檔案 |
|---|---|---|
| 1.1 | 刪 `X-Frame-Options`，新增正式 CSP 只含 `frame-ancestors` | `nginx.conf` |
| 1.2 | `useUrlState` hook：開機讀 query → `setLayerVisibility` / `setOverlayParams`（單向） | 新增 `src/hooks/useUrlState.ts` |
| 1.3 | gated 圖層過濾 + 未知 key 忽略 + 單元測試 | 同上 + `__tests__` |

Phase 1 結束後：主站已可用 URL 深連結，且能被 iframe 嵌入（雖然還是完整版 UI）。

### Phase 2 — 嵌得好看（估 2–3 天）

| # | 工作 | 說明 |
|---|---|---|
| 2.1 | `/embed` 獨立 entry | Vite 多入口（`embed.html` + `src/embed.tsx`），只 import 需要的 layer → 直接解掉 5.1 MB |
| 2.2 | 精簡 UI | 地圖 + 極簡圖例 + 出處標示 + 右下「在 Mini Taiwan Pulse 開啟 ↗」；無 sidebar / 無 chat |
| 2.3 | facade 模式 | `loading="lazy"` 起步；進階版做靜態縮圖 + 點擊載入（§6 費用主力） |
| 2.4 | postMessage 自動高度 | 可選 |

### Phase 3 — 分享得順

| # | 工作 | 說明 |
|---|---|---|
| 3.1 | **URL 雙向同步** | 操作時 `history.replaceState` 更新網址，方便複製當前畫面 |
| 3.2 | **「分享／嵌入」按鈕** ⭐ | 調好畫面按一下吐出 `<iframe>` 代碼。**投報率最高的一項**——沒有它，你每次寫文章都要手拼 URL |
| 3.3 | oEmbed endpoint + 動態 OG | 只有要給第三方 CMS 自動嵌入才需要；靜態 nginx 做不到動態 OG，得走 Cloudflare Worker |

> 建議：3.1 + 3.2 其實應該緊接 Phase 1 做，因為它決定你「用起來順不順」。
> 3.3 可以無限期延後。

## 6. 費用與流量 💰

> 以下 Mapbox / Supabase 數字為 2026-08-03 上網查證；Zeabur 頻寬計價**未在公開頁揭露**，標記為待確認。

### 6-1. Mapbox（最大風險）

**計價**（[官方 pricing](https://www.mapbox.com/pricing)）：

| 月 map loads | 單價 / 1,000 |
|---|---|
| 0 – 50,000 | **免費** |
| 50,001 – 100,000 | $5.00 |
| 100,001 – 200,000 | $4.00 |
| 200,001 – 1,000,000 | $3.00 |

**關鍵定義**：一次 map load = **一次 `Map` 物件初始化**。載入後的縮放、拖曳、切圖層、切樣式
**都不再計費**，且含無限 tile 請求；session 上限 12 小時。

**這代表：嵌入的成本模型 = 文章 PV 數，不是互動次數。**

試算：

| 情境 | 月 map loads | 月費 |
|---|---|---|
| 現況（只有主站訪客） | ？（**待你查 Mapbox dashboard 填入**） | — |
| 10 篇文章 × 5,000 PV，直接 iframe | +50,000 | 若原本已用滿免費額度 → **+$250** |
| 同上，但用 facade（估 10% 點擊率） | +5,000 | **+$25** 或仍在免費額度內 |
| 一篇爆紅 100,000 PV，直接 iframe | +100,000 | **+$450**（$5×50k + $4×50k） |

**結論：facade 模式是 10 倍級的省錢手段，不是效能微調。** 直接 iframe 等於「每個滑過文章的人
都替你點一次地圖」，而多數讀者根本沒往下滑到那一段。

> ⚠️ 先做的第一件事：登入 Mapbox dashboard 查現在月用量距離 50,000 還剩多少。
> 這個數字決定 facade 是「建議」還是「必須」。

### 6-2. Supabase

**計價**：Pro plan $25/月，含 250 GB egress，超出 $0.09/GB
（cached egress $0.03/GB）。專案目前為 **Pro + Small compute**（INCIDENTS 2026-04-09）。

嵌入對 Supabase 的壓力取決於**嵌了哪個圖層**：

| 圖層類型 | 單次載入量 | 250 GB 可撐幾次 |
|---|---|---|
| 輕量點圖層（RPC 回 JSON） | ~1–2 MB | 12 萬 – 25 萬次 |
| 重圖層（全台建物 / 網格） | ~20–50 MB | **5,000 – 12,000 次** |
| 靜態 CDN 圖層（PMTiles / GeoJSON） | 不走 Supabase | 不計 |

**建議：`/embed` 只開放「已 CDN 化的靜態圖層」白名單。** 專案已有 `static-to-cdn` 的做法，
把嵌入常用圖層（魚塭這類靜態圖徵）走 Cloudflare 邊緣快取，Supabase 壓力趨近零。
真要嵌動態圖層（船舶／班機）再逐案評估。

### 6-3. Zeabur / Cloudflare

- Zeabur 方案：Free $0 / Dev $5 / Pro $19 / Team $79。
  **頻寬計價未在公開 pricing 頁列出 → 需到 dashboard 或問客服確認**（未驗證，不要照抄）。
- Cloudflare 在 Zeabur 前面，靜態資產命中邊緣快取就不回源，**Zeabur egress 主要只吃 cache miss**，
  風險相對可控。前提是 Cache Rule 設對（PRINCIPLES 2026-06-02：404/5xx 必設 No cache）。
- 5.1 MB bundle 若沒做 Phase 2.1 的獨立 entry，每個 cache miss 都是 5 MB 回源。

### 6-4. 省錢優先序

1. **facade（點擊才載入）** — 直接砍掉約 90% 的 Mapbox map loads
2. **`/embed` 獨立 entry** — 砍 bundle，降 Cloudflare/Zeabur 流量與行動裝置痛苦
3. **靜態圖層白名單** — 讓 Supabase egress 趨近零
4. **Mapbox token URL restriction + 用量告警** — 出事時你會知道（見 §7-2）

## 7. 你應該想清楚的地方

### 7-1. 嵌入碼會「腐爛」⚠️

文章是永久的，但你的 layer key 不是。哪天把 `aquaculturePonds` 改名或下架，
**所有既有文章的嵌入地圖同時壞掉**，而且你不會收到通知。

對策：
- URL schema 帶 `v=1`，改版時保留舊版解析路徑
- 維護一份 **key 別名表**（`oldKey → newKey`），改名時加一筆而不是直接改
- 加測試：`LAYER_COLORS` 的 key 消失時，若別名表沒有對應 → 測試紅

### 7-2. 流量放大：別人的文章，你的帳單

嵌入本質上是**把成本控制權交給別人**。對方文章爆紅，你的 Mapbox 帳單先爆。

好消息是 **iframe 比給 JS SDK 安全得多**：iframe 內的 JS 跑在**你的 origin**，
所以 Mapbox token 不會外流，URL restriction 也照樣生效（Referer 是你的網域）。

要決定的事：

| 選項 | 優點 | 缺點 |
|---|---|---|
| **`frame-ancestors *`（全開）** | 傳播最廣、零維護 | 誰都能嵌，成本不可控 |
| **白名單** | 成本可控 | 每次有新站要嵌都要改 nginx + 重部署 |

**建議：先全開 + Mapbox 用量告警**，真出事再收白名單。理由是你現在的問題是「沒人嵌」不是「太多人嵌」，
過早最佳化白名單只會拖慢自己。但**告警一定要先設**。

### 7-3. 登入與 gated 圖層

瀏覽器已預設封鎖第三方 cookie，所以 **iframe 內不會有你的 Google 登入態**。
影響兩面：

- ✅ 好處：`GATED_LAYERS`（35 個私人圖層）天然不會在嵌入版出現
- ⚠️ 但這是「剛好安全」。仍要在 embed 端**主動 drop** gated key（§4-4），
  否則哪天 cookie 政策變動或你加了別的登入機制，就會裸奔
- ❌ 限制：嵌入版不能有任何會員功能（BYOK chat 等），設計時直接排除

### 7-4. 資料時效 vs 文章永久性 ⏳

你的文章三年後還有人讀，但即時圖層的資料早就不同了——讀者看到的畫面
可能跟文章描述完全對不上（「如圖所示，臺南沿海密集的魚塭」→ 三年後圖層改版，畫面全空）。

對策：URL 支援 `date=YYYY-MM-DD` **凍結歷史畫面**。專案已有歷史模式（共機活動區、
地震回放都做過），嵌入版接上即可。

**寫文章時的紀律：只要文章有描述具體畫面，就一定帶 `date=`。**

### 7-5. 資料授權與出處標示 ⚖️

多數政府開放資料授權要求標示來源。嵌入版面積小、誘惑是把 attribution 拿掉，
但這是法律義務不是設計選擇。

`ui=` 參數的白名單裡，**`attribution` 必須是不可關閉的**（不接受 `ui=` 把它移除）。

### 7-6. 行動裝置

文章讀者過半是手機。目前站台是 Mapbox 3D + Three.js custom layer，
低階手機上 pitch=45 + 多圖層會明顯卡頓甚至當掉分頁。

建議：`/embed` 偵測到窄螢幕時自動降級（強制 `pitch=0`、關閉 Three.js 圖層、降低 particle 數）。

### 7-7. 你怎麼知道誰嵌了你

沒有主動通知機制。可觀察的來源：
- Cloudflare Analytics 的 Referer 分布
- nginx access log 的 `$http_referer`（`/embed` 路徑單獨看）

若想認真經營，Phase 3 可以加一個極輕量的 embed 計數（但注意隱私與 GDPR，
建議只記錄 referer 網域不記錄使用者）。

### 7-8. 脈絡失控

你的地圖可能被嵌在你不認同的文章旁邊，而讀者會以為你背書。
`frame-ancestors *` 就是接受這個風險。若在意，走白名單。

## 8. 待決事項（需 owner 拍板）

| # | 問題 | 選項 | 建議 |
|---|---|---|---|
| 1 | 嵌入開放範圍 | 全開 / 白名單 | **先全開 + 用量告警** |
| 2 | facade 做到什麼程度 | 只 `loading="lazy"` / 完整靜態縮圖 | 先 lazy，看 Mapbox 用量再決定要不要做縮圖 |
| 3 | `/embed` 圖層白名單 | 全部 320 個（扣 gated）/ 只開靜態 CDN 圖層 | **只開靜態**，動態逐案加 |
| 4 | 是否做 oEmbed | 做 / 不做 | **不做**，等真的有第三方 CMS 需求 |
| 5 | Mapbox 現況用量 | — | **先查 dashboard**，這是所有費用判斷的前提 |

## 9. 驗收條件

Phase 1：
- [ ] 外站 iframe（用 CodePen 或本機 HTML）能成功顯示地圖，非白屏
- [ ] `?v=1&lng=..&lat=..&z=..&layers=aquaculturePonds` 開機即定位 + 開層
- [ ] 帶 gated key（如 `layers=powerPlants`）→ 該層被 drop，其餘正常
- [ ] 帶不存在的 key → 靜默忽略，不 crash
- [ ] `npx tsc -b` 綠、`pnpm test` 綠

Phase 2：
- [ ] `/embed` bundle 顯著小於主站 5.1 MB（目標 < 1.5 MB）
- [ ] 嵌入版有出處標示且無法被 `ui=` 關閉
- [ ] 手機實測不卡頓

## 10. 參考

- Mapbox 計價：<https://www.mapbox.com/pricing> · [map load 定義](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/)
- Supabase 計價：<https://supabase.com/pricing>
- 專案相關：`docs/features/owner-gated-layers/`（gated 機制）、
  `docs/features/static-to-cdn/`（靜態圖層 CDN 化）、
  `.claude/memory/PRINCIPLES.md`（Cloudflare 快取、部署資產三處接線）
