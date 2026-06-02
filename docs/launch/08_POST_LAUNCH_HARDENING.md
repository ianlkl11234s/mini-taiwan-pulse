# 上線後硬化操作指引（Cloudflare 快取 + Supabase 收窄曝光）

> 2026-06-02 上線後。兩件事：① Cloudflare 快取靜態檔（省成本）② Supabase 收窄曝光 schema（資安）。
> 兩者都在各自的 dashboard 操作、都可逆。

---

## ① Cloudflare Cache Rule — 快取靜態 GIS 資產（省回源流量）

**現況**：靜態大檔 `cf-cache-status: DYNAMIC` = 每個訪客都回源到 Zeabur 重抓。nginx 已送 `cache-control: public, max-age=86400`，差一條 Cloudflare 規則讓它真的快取。

### 步驟（Cloudflare 後台）
1. 登入 Cloudflare → 選網域 `itsmigu.com`
2. 左側 **Caching → Cache Rules → Create rule**
3. **Rule name**：`Cache GIS static assets`
4. **When incoming requests match**：選「Custom filter expression」，貼：
   ```
   (starts_with(http.request.uri.path, "/geo/")) or
   (starts_with(http.request.uri.path, "/h3/")) or
   (starts_with(http.request.uri.path, "/bus/")) or
   (starts_with(http.request.uri.path, "/agriculture/")) or
   (starts_with(http.request.uri.path, "/fire/")) or
   (starts_with(http.request.uri.path, "/rail/"))
   ```
5. **Then（Cache settings）**：
   - Cache eligibility → **Eligible for cache**
   - Edge TTL → **Use cache-control header if present，否則 1 day**（origin 已送 86400，照用即可；也可 Override 設更長如 7 days）
   - Browser TTL → Respect origin
6. **Deploy**

### 驗證（過幾分鐘 + 第二次請求才會 HIT）
```bash
curl -sI https://mini-taiwan-pulse.itsmigu.com/geo/provincial_road.geojson | grep -i cf-cache-status
# 第一次 MISS → 第二次應變 HIT
```
- ✅ 大 GeoJSON（省道 46M / 淹水 80M / 農企業 20M…）會被邊緣快取 → 回源流量大降。
- ⚠️ **PMTiles 走 Range 請求**：免費方案 range 快取有限，可能仍 DYNAMIC；GeoJSON 的省最明顯。可觀察 cf-cache-status 決定要不要升級方案。
- ❗ **不要**對 `/`（index.html）設快取，否則前端改版不會更新——本規則只針對資產路徑，已避開。

### 注意
- 改版部署後，若想讓 CDN 立刻拿新檔：Cloudflare → Caching → **Purge Cache**（Purge Everything 或指定 URL）。
- JS/CSS bundle（`/assets/*.js`）Cloudflare 預設就會快取，無需額外規則。

---

## ② Supabase 收窄曝光 schema —— 封住 anon 直讀原始表（資安）

> ⚠️ **不要用「撤 anon table 權限」的做法**：實測 81 個 RPC 中 **74 個是 SECURITY INVOKER**，
> 以 anon 身分執行、需要 anon 對底層表有 SELECT；撤權會當場打掛 74 個 RPC。
> **正確做法是收窄 PostgREST 對外曝光的 schema**（不動 grant、不動 RPC）。

**目標**：曝光清單從
`public, graphql_public, reference, spatial, metadata, opendata, fire, maritime, rail, safety, demographics`
收窄成 **只留 `public, graphql_public`**。

**為什麼安全**：
- 前端只用 public（RPC + `earthquake_events` 這個 public view）→ 不受影響。
- RPC 在 DB 內部查 realtime/spatial 表，不需要那些 schema「對外曝光」→ 81 個 RPC 照常。
- 直接 `GET /rest/v1/<表>` + `Accept-Profile: spatial` → 變成像 realtime 一樣被擋（PGRST106）→ 濫用破口關閉。

### ⚠️ 套用前必確認（因為是 gis-platform 共用 DB、專案層級設定）
**其他應用（如 mini-taiwan-info 或別的站）有沒有「透過 REST + Accept-Profile 直讀」reference/spatial/fire/… 這些 schema？**
- 若**只有** mini-taiwan-pulse 在用、且都走 RPC → 直接收窄安全。
- 若有別的站直讀這些 schema → 收窄會打掛它們，要嘛保留該 schema、要嘛把那些站也改走 RPC。
- 判斷法：看其他站的前端有沒有 `.schema('spatial')` / `.from()` 直打這些 schema 的程式。

### 步驟（Supabase 後台）
1. 登入 Supabase → 選 **gis-platform** 專案
2. **Project Settings → API → Exposed schemas**（或 Data API 設定）
3. 把清單改成只留 `public, graphql_public`（移除 reference/spatial/metadata/opendata/fire/maritime/rail/safety/demographics）
4. Save（PostgREST 會自動 reload，幾秒生效）

### 驗證（套用後）
```bash
# A) 濫用破口應被擋（spatial 直讀 → 不再 200）
URL=<VITE_SUPABASE_URL>; KEY=<anon key>
curl -s -o /dev/null -w "spatial 直讀: %{http_code}\n" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: spatial" \
  "$URL/rest/v1/h3_demographics_yearly?limit=1"
# 期望：406（PGRST106 not exposed），不再是 200

# B) 網站逐層 smoke test（最重要）
#    開 https://mini-taiwan-pulse.itsmigu.com → All Off → 逐層開
#    特別測：地震層（.from earthquake_events）、各 RPC 動態層（公車/水/空品/H3…）全部正常
# C) 若 gis-platform 有別站 → 也各跑一輪 smoke test
```

### Rollback（秒級可逆）
回到 Exposed schemas 把移除的 schema 重新加回去、Save 即還原。

---

## 建議順序
1. **先 ①Cloudflare**（純省錢、零破壞風險）
2. **再 ②Supabase 收窄**：先做「套用前必確認」那步（查其他站），確認只有本站用 → 再收窄 → 逐層 smoke test。
