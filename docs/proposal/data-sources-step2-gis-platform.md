# Step 2 — gis-platform Migration for Data Catalog

> **前置**：Step 1 已完成（[data-sources-ssot-bridge.md](./data-sources-ssot-bridge.md)）
> **執行者**：Claude 開發、用戶審核 Supabase migration 前 apply
> **預估**：3-4 小時

---

## 1. 目標

把 catalog SSOT（`taipei-gis-analytics/docs/data-catalog/*.md` 271 個 dataset）**同步鏡像**到 Supabase `metadata.data_catalog` table，並開放 `public.*` RPC 讓 mini-taiwan-pulse 前端讀。

架構：
```
[SSOT] taipei-gis-analytics/docs/data-catalog/*.md
        ↓ Step 3 sync 腳本（下個 step）
[Mirror] gis-platform Supabase metadata.data_catalog (本 step 建 table)
        ↓ public.get_data_catalog_for_layer(layer_key) RPC
[Frontend] mini-taiwan-pulse/src/data/dataCatalogLoader.ts (Step 4)
```

---

## 2. Schema 設計

### Table：`metadata.data_catalog`

```sql
create table metadata.data_catalog (
  -- 主 key
  dataset_id text primary key,

  -- 分類
  theme text not null,           -- 對應 catalog 目錄名 (agriculture / water_resources / ...)
  subtopic text,

  -- 顯示
  title text,                    -- 中文標題 (# 標題 markdown)
  summary text,                  -- 一句話摘要 (> 摘要 markdown)

  -- 上游來源
  provider_agency text,          -- 提供機關 (CWA / TDX / WRA / NLSC / 林保署 ...)
  source_url text,               -- API endpoint / 下載頁 URL
  source_dataset_id text,        -- data.gov.tw / data.moa dataset id
  license text,                  -- OGDL-Taiwan-1.0 / CC-BY-4.0 / ...

  -- 更新
  lifecycle text,                -- realtime / daily / weekly / monthly / yearly / static
  update_frequency text,         -- 人類可讀的頻率描述
  last_updated date,             -- catalog frontmatter last_updated

  -- 資料流
  collectors text[],             -- data-collectors 腳本路徑
  supabase_schema text,          -- realtime / reference / spatial / analytics
  supabase_table text,           -- 對應 table 名
  frontend_target text,          -- mini-taiwan-pulse/public/... (若靜態)

  -- 反向索引（Step 1 產物）
  used_by_pulse_layers text[],   -- 對應 pulse layer_keys

  -- 詮釋
  format text,                   -- v2 / v1 / legacy_md
  catalog_md_path text,          -- 相對於 taipei-gis-analytics repo 的 .md 路徑
  raw_frontmatter jsonb,         -- 完整原始 frontmatter（未來擴充欄位免遷移）

  -- 稽核
  synced_at timestamptz default now(),
  content_hash text              -- md 檔案 sha256（Step 3 用來判斷差異）
);

create index idx_data_catalog_theme on metadata.data_catalog (theme);
create index idx_data_catalog_lifecycle on metadata.data_catalog (lifecycle);
create index idx_data_catalog_used_by_pulse on metadata.data_catalog using gin (used_by_pulse_layers);
```

### RPC 1：`public.get_data_catalog_for_layer(layer_key text)`

給前端點 layer 時查上游用。

```sql
create or replace function public.get_data_catalog_for_layer(p_layer_key text)
returns table (
  dataset_id text, title text, provider_agency text, source_url text,
  lifecycle text, update_frequency text, license text, last_updated date,
  catalog_md_path text
)
language sql stable
as $$
  select dataset_id, title, provider_agency, source_url,
         lifecycle, update_frequency, license, last_updated, catalog_md_path
  from metadata.data_catalog
  where p_layer_key = any(used_by_pulse_layers)
  order by dataset_id
$$;
```

### RPC 2：`public.get_data_catalog_by_theme(theme text)`

給資料源總覽 icon 用（按主題列出）。

```sql
create or replace function public.get_data_catalog_by_theme(p_theme text default null)
returns table (
  dataset_id text, theme text, subtopic text, title text,
  provider_agency text, lifecycle text, used_by_pulse_layers text[]
)
language sql stable
as $$
  select dataset_id, theme, subtopic, title,
         provider_agency, lifecycle, used_by_pulse_layers
  from metadata.data_catalog
  where p_theme is null or theme = p_theme
  order by theme, dataset_id
$$;
```

### RPC 3：`public.get_upstream_lineage(layer_key text)`

給派生 layer（pulse_only）用 — 遞迴上溯 upstream datasets。

> 遞迴 layer→dataset 由前端 `resolveUpstreamDatasets()` 處理（Step 1 已有），本 RPC 只給 dataset 詳細資訊。所以其實 RPC 1 就足夠，前端傳 array 進 RPC 2 變體。

**簡化**：只做 RPC 1 + RPC 2 兩個，複合分析在前端 map 多次呼叫。

---

## 3. Migration 檔

**位置**：`../gis-platform/supabase/migrations/243_create_data_catalog.sql`
（243 = 沿用最新遞增；用戶確認 head 是 242）

**內容分 3 段**：
1. `create schema if not exists reference;`（可能已存在）
2. `create table metadata.data_catalog (...)` + indexes
3. `create function public.get_data_catalog_for_layer / get_data_catalog_by_theme`
4. `grant execute on function ... to anon, authenticated;`
5. `grant select on metadata.data_catalog to anon, authenticated;`

**風險評估**：
- 🟢 新表新 RPC，不動任何既有物件
- 🟢 GRANT 只加不減，不影響現有權限
- 🟢 空表建完前端讀到 0 rows，無破壞性
- ⚠️ 需確認 `reference` schema 已存在（跟 gis-platform 團隊確認）

---

## 4. 執行順序

1. **設計 review**（本檔）→ 用戶拍板 schema / RPC 名稱是否合理
2. **寫 migration SQL**（`243_create_data_catalog.sql`）
3. **本地測試**：`supabase db reset` 或在 shadow DB 跑一次確認 syntax
4. **產出 seed CSV**：從 `taipei-gis-analytics/docs/data-catalog/` 產一份 271 rows 的初始資料（給 Step 3 sync 用）
5. **PR 到 gis-platform**：由用戶審核後 merge → Supabase Cloud 自動 apply
6. **驗證**：從 mini-taiwan-pulse 呼叫 `supabase.rpc('get_data_catalog_for_layer', { p_layer_key: 'agriRetail' })` 拿到資料

---

## 5. 給 Step 3 / Step 4 的接口

**Step 3**（sync 腳本）：讀 catalog `.md` frontmatter → upsert `metadata.data_catalog`（`ON CONFLICT (dataset_id) DO UPDATE SET ...`），content_hash 對比跳過未改。

**Step 4**（前端 UI）：新 hook `useDataCatalog(layerKey)` fetch RPC → 存 SWR cache → 顯示浮窗。

---

## 6. 決策要點（已 review 並拍板 2026-07-01）

- [x] Schema 結構 OK — 20 欄含反向索引 + jsonb backup
- [x] `raw_frontmatter jsonb` 保留 — 未來新欄位免 migration
- [x] Migration 編號 **269**（gis-platform head 是 268，經驗證）
- [x] RPC `public.get_data_catalog_for_layer` / `get_data_catalog_by_theme` 命名 OK
- [x] Step 2 就產 seed CSV（`docs/data-catalog/*.md` → 271 rows）migration 一起 apply
- [x] **Schema 改用 `metadata`**（不是 `reference`）— metadata schema 存在於 migration 001，官方定義「系統管理（資料集目錄/Collector 狀態/匯入紀錄）」正是 data catalog 用途

---

**下一步**：等用戶對本計畫 sign-off，我就開始寫 migration SQL + seed。
