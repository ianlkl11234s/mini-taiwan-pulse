# Static-to-CDN — 靜態圖層讀取去 DB 化

> Branch: `perf/static-to-cdn` · 起於 BC-8 診斷 · 對應 BACKLOG AR-02/12/13 脈絡
> 狀態：pilot（電網 3 層）→ 批次搬完 param-less 靜態層

## 問題（root cause，來自 BC-8 實測）

- 前端有全域併發上限 8（`src/lib/supabase.ts`），保護 DB 不被單人 reload 雪崩。
- **但** 31 個「靜態卻走 RPC」的圖層都擠這條排隊 → 開多層時被排後面的層暫時顯示 0（~8-16s 才補上）。
- 更嚴重的是**多人**：8 格排隊是「每個瀏覽器一條」，DB 卻是共用的一台。10 人各自打同一份靜態資料 = DB 被重複打 10 次（最多 ~80 併發）。這是 O(N)，數十~數百人會打爆 pooler / CPU / egress。

## 解法

把「靜態、參數無關」的 RPC 輸出**預先匯出成靜態 JSON 快照**，放 S3 → nginx → Cloudflare 邊緣快取。前端改讀 CDN 檔，**完全脫離 DB 併發排隊**。讀取成本 O(N)→O(1)（一份檔服務所有人）。

- 靜態檔（本計畫）→ **S3 + Cloudflare**（沿用現成 deploy-assets 管線）
- 半動態共享快照（公車 current / 新聞 / 警報）→ R2 快照（AR-12/13，非本計畫）
- 真動態（時序回放 / by-day 軌跡）→ 保留 Supabase RPC（正確）

## 架構 / 模板（會被複製 N 次，務必一致）

### 1. 匯出：`scripts/export/export-static-rpc-snapshots.sh`
psql 直連（`SUPABASE_DB_URL`）逐一呼叫 RPC，把 JSON **原樣**存檔（不重寫 property mapping，最省事最不易錯）：
- table-returning RPC：`SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM public.<rpc>() t`
- jsonb-returning RPC（如 `get_osm_power_towers`）：`SELECT public.<rpc>()`
- 輸出 → `public/static-rpc/<rpc>.json`（檔名 = RPC 名，前端好對應）
- 沿用 water 腳本的 `SET statement_timeout='120s'` + graceful psql shutdown

### 2. 供檔：獨立鏡像子前綴 `static-rpc/`（比照 `/agriculture/`）
- **nginx.conf**：加 `location /static-rpc/ { root /data; expires 1d; add_header Cache-Control "public"; }`
- **upload-deploy-assets.sh**：加 `for f in public/static-rpc/*.json` → `s3://.../deploy-assets/static-rpc/`
- **pull-deploy-assets.sh**：加 `mkdir -p /data/static-rpc` + `aws s3 sync $S3/static-rpc/ /data/static-rpc/`（整夾 sync → 之後加檔**零改腳本**）
- **.gitignore**：加 `public/static-rpc/`（產生物、大檔不進 git）
- dev：Vite 自動把 `public/static-rpc/*.json` 供在 `/static-rpc/`

### 3. 前端 helper：`src/data/staticRpc.ts`
```ts
// 讀靜態化 RPC 快照；404 → fallback 回真 RPC（rollout 安全網）。回傳形狀同 supabase.rpc。
export async function staticRpc<T>(name: string): Promise<{ data: T | null; error: unknown }> {
  try {
    const res = await fetch(`/static-rpc/${name}.json`);
    if (res.ok) return { data: (await res.json()) as T, error: null };
  } catch { /* fall through to RPC */ }
  return supabase.rpc(name) as unknown as Promise<{ data: T | null; error: unknown }>;
}
```

### 4. Loader 改動（每處僅一 token）
```ts
// before
withLoading("energy:substations", "變電所 785", supabase.rpc("get_osm_substations"))
// after
withLoading("energy:substations", "變電所 785", staticRpc("get_osm_substations"))
```
transform / popup / legend / source id / loadingRegistry / cachedOnce **全部不動**。

## 範圍（來自 31 個 STATIC 盤點）

### Batch 1 — param-less 能源靜態（~18，本計畫主體）
OSM 6：`get_osm_substations` `get_osm_power_lines` `get_osm_power_towers` `get_osm_wind_turbines` `get_osm_solar_farms` `get_osm_power_plants_static`
misc 7：`get_renewable_permits_taipei` `get_offshore_wind_zones` `get_geothermal_wells` `get_island_power_grid` `get_fossil_fuel_infrastructure` `get_fossil_fuel_layers` `get_ev_charging_stations`
SSOT 靜態 5：`get_ssot_facilities_secondary_small` `get_ssot_facilities_planned` `get_ssot_facilities_offshore_zones` `get_ssot_facilities_historical` `get_ssot_facilities_osm_supplement`

### Batch 2 — 需模板擴充（延後）
- **參數化**（per-city / per-key）：`get_waste_disposal_points`（cities,types）`get_waste_routes`/`get_waste_stops`（city）`get_data_catalog_for_layer`/`get_data_catalog_by_theme`（key）→ 需「全量一檔 + 前端 client filter」或「per-key 多檔」
- **param-less 廢棄物**：`get_waste_facilities` `get_waste_cleaning_squads` `get_waste_facility_counts` `get_waste_disposal_point_counts`（可併入 batch 1 template，待確認無參數）
- **realtime 糾纏**：`get_ssot_facilities_primary_operating`（綁 realtime 出力 join，需先拆）
- **低衝擊延後**：`get_h3_demographics_yearly`（年份參數）`get_reservoir_context`（混即時水情）`get_satellite_catalog`（已永久 session cache）電廠 popup provenance/units（僅點擊 lazy）

## Pilot（電網 3 層，先跑通完整流程）
`get_osm_substations` / `get_osm_power_lines` / `get_osm_power_towers`

驗收：
1. `npx tsc -b` 綠
2. 冷載入 browser：reload 清 cache → 開電網 4 層 → **立即從 `/static-rpc/` 載入、Network 不打 supabase rpc、無暫時 0**
3. S3 上傳 + （prod 驗證留後）

## 維護 / 風險
- **資料刷新**：OSM 月更 collector 更新後，需重跑 export → upload → `purge-cloudflare-cache.sh`。同 `water_*.geojson` 慣例（手動）。
- **rollback**：staticRpc 404 自動 fallback 回 RPC；最壞情況等同現況（不會壞，只是沒加速）。單層回退 = 把該 loader 的 `staticRpc(` 改回 `supabase.rpc(`。
- **驗證陷阱**：fallback 讓「忘了部署檔」也能跑 → 驗收時要確認 Network 真的打 `/static-rpc/*.json`（非 fallback 到 rpc）。

## 進度
- [ ] Pilot：export 腳本 + staticRpc helper + 3 grid loader + deploy 接線 + 冷載驗證 + S3
- [ ] Batch 1 其餘 15 能源層
- [ ] Batch 2 規劃（參數化模板）
