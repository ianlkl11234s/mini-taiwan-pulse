# Playbooks

固定流程的 step-by-step runbook。規則：做過 ≥ 2 次才寫進來。

---

## PB-01 新增 Layer（完整 7 層順序）

> ⚠ 必守順序（CLAUDE.md 規則 5）：缺一個會 tsc error 或 runtime 不顯示。

```bash
# 1. 加 LayerVisibility key
# src/types/index.ts
export type LayerVisibility = { ...; newLayer: boolean; }

# 2. Loader + loadingRegistry
# src/data/newLayerLoader.ts
export async function fetchNewData() {
  return withLoading("new-layer", "標籤", supabase.rpc("get_xxx"));
}

# 3. React Hook（Mapbox native layer）
# src/hooks/useNewLayer.ts
#   - polling attach pattern（不用 map.once('load')）
#   - checkpoint log：mount / attach / fetch / setData
#   - 動態時序記得走 timeStore.subscribeDate + subscribeThrottled

# 4. Overlay registry 或 Custom WebGL layer
# src/map/overlayRegistry.ts  或  src/map/newLayerCustomLayer.ts

# 5. UI toggle
# src/components/LayerSidebar.tsx
#   - 加 toggle row
#   - LAYER_COLORS 補新 key（漏了 tsc error）
# src/components/IconRailSidebar.tsx
#   - LAYER_COLORS / LAYER_ICONS 補新 key

# 6. App.tsx 接線
# 參考現有 hook 的呼叫位置

# 7. 預設可見性
# src/hooks/useLayerVisibility.ts
export const DEFAULT_VISIBILITY = { ...; newLayer: false };

# 驗證
npx tsc -b
npm run dev    # 手動 toggle 確認
```

可用 slash command `/new-layer <name>` 自動產生骨架。

---

## PB-02 新增 Supabase RPC（pre-aggregate 判斷）

```bash
# 1. 先 EXPLAIN 預估（對目標 query）
psql "$SUPABASE_DB_URL" -c "EXPLAIN (ANALYZE, BUFFERS) SELECT ..."

# 2. 判斷路徑
# - execution < 1s AND rows < 10k → 直接寫薄 RPC（STABLE + SET statement_timeout '30s'）
# - 超過門檻 → 套 pre-aggregate pattern（見 docs/supabase-optimization.md）

# 3. 寫 migration
# gis-platform/migrations/NNN_xxx.sql
#   - CREATE OR REPLACE FUNCTION public.get_xxx(...)
#   - LANGUAGE sql STABLE
#   - SET statement_timeout TO '30s'
#   - GRANT EXECUTE ON FUNCTION ... TO anon, authenticated

# 4. 本地套用
cd ../gis-platform
psql "$DATABASE_URL" -f migrations/NNN_xxx.sql

# 5. 驗證
psql "$DATABASE_URL" -c "\\timing on" -c "SELECT COUNT(*) FROM public.get_xxx(...);"

# 6. 前端 loader
# src/data/xxxLoader.ts 加 fetchXxx() 包 withLoading

# 7. commit（gis-platform 與 mini-taiwan-pulse 各自 commit）
```

可用 slash command `/check-rpc <name>` 自動 EXPLAIN 判斷。

---

## PB-03 Merge feat/* → master

```bash
git branch --show-current   # 確認在 feat 分支
git log master..HEAD --oneline   # 看要合什麼
git diff master..HEAD --stat     # 看規模

git checkout master
git merge feat/xxx --no-ff -m "Merge branch 'feat/xxx'

<摘要>

Co-Authored-By: ..."

git log --oneline --graph -5   # 驗證 merge commit

# 保留分支（不 delete），以備回溯
# push 由用戶決定
```

---

## PB-04 Session 結束（/wrap-up）

1. 喊 `/wrap-up` 或「收工」 → skill 自動跑 5 階段
2. Stage 1 Gather：平行讀 memory + git log + git status
3. Stage 2 Analyze：分類事件到 9 檔
4. Stage 3 Draft：產 diff 給用戶 review
5. Stage 4 Confirm：等用戶回「全採用 / 修哪幾個 / skip 哪些」
6. Stage 5 Atomic Commit：每檔一 commit，prefix `memory:`，STATUS 最後
7. 提醒用戶 `git push` 但不自動 push

詳見 `.claude/skills/wrap-up/SKILL.md`。

---

## PB-05 水資源 3D Scene 加新視覺元件

> 場景：`ReservoirScene.ts` 這類要加新的 InstancedMesh / Mesh。

1. **設 constants 放頂部**（`OPS_BAR_SIDE_FACTOR` 這種）
2. **加 interface** `ActiveXxxInput`
3. **加 state 欄位** `activeXxx: ActiveXxxState | null`
4. **加 setter** `setActiveXxx(input: Input | null)`，內部找 data[i] 取座標
5. **加 ensureMeshes**（InstancedMesh 先 dispose 再 create）
6. **加 updateMatrices**（共用 tmp Matrix4 + scale Matrix4）
7. **setVisible / setTheme / setHeightScale 同步更新新 mesh**
8. **setStatuses 的 fast path / slow path 結尾**：若 activeXxx 存在，重算
9. **dispose 同步 dispose**

**關鍵限制**（2026-04-23 教訓）：

- 柱體總高 ≤ `H_SHELL × 1.5`，否則 zoom + pitch 時被截頂
- 柱體水平位置 > `radius × 1.0`（放殼外），避免被透明殼遮
- 用 log 正規化大值跨 orders of magnitude（`Math.log10(x+1)/Math.log10(BASE+1)`）
- 不在 render() 內 `triggerRepaint()`（靜態 3D）

---

## PB-06 Deploy（Zeabur auto build）

```bash
# 本地驗證
npx tsc -b
git status --short
git log --oneline -5

# push → Zeabur 自動 build + deploy
git push origin master
```

若改了 5 處關鍵檔案（vite.config.ts / Dockerfile / nginx.conf / zeabur.json / package.json）
要同步確認 port 3721 一致。

---

## PB-07 資料盤點（DB 有沒有前端沒用的 Quick Win）

```bash
# 列所有 water / gis 相關 table + geom 有無
psql "$DATABASE_URL" -c "
WITH t AS (SELECT table_schema||'.'||table_name AS tbl FROM information_schema.tables
  WHERE table_schema IN ('public','reference')
    AND (table_name ILIKE '%water%' OR table_name ILIKE '%reservoir%' OR ...))
SELECT tbl, (SELECT count(*) FROM pg_attribute WHERE attrelid=tbl::regclass
  AND attname IN ('geom','geometry') AND attnum>0 AND NOT attisdropped) AS has_geom
FROM t;"

# 針對每個有 geom 的表
psql "$DATABASE_URL" -c "\\d public.<table>"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM public.<table>;"

# 看前端 public/geo/ 是否有對應 *.geojson
ls public/geo/ | grep -i <keyword>

# 找出「DB 有但前端沒用」 → 記進 BACKLOG
```

---

## PB-08 診斷 Supabase RPC「資料看起來少一半」

> 觸發情境：前端某圖層只顯示北部 / 部分站點；某 timeline 只有前段看得見；
> 前端抓 RPC 後 `data.length` 比 `psql COUNT(*)` 少很多。

```bash
# Step 1：psql 直接查 RPC 實際列數
psql "$SUPABASE_DB_URL" -c "
  SELECT COUNT(*), COUNT(DISTINCT station_id)
  FROM public.get_xxx_day(CURRENT_DATE);
"

# Step 2：curl REST 看 content-range header
set -a && source .env && set +a
curl -s -X POST "${VITE_SUPABASE_URL}/rest/v1/rpc/get_xxx_day" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: count=exact" \
  -d '{"target_date":"2026-04-25"}' \
  -D /tmp/hdr.txt -o /dev/null
grep -i "content-range\|HTTP/" /tmp/hdr.txt

# Step 3：若 content-range 顯示 0-19999/N（N > 20K）→ 命中 PostgREST cap
# 解：RPC 側降頻
# SELECT DISTINCT ON (station_id, date_trunc('hour', observed_at)) ...
# ORDER BY station_id, date_trunc('hour', observed_at), observed_at DESC

# Step 4：驗證降頻後依地理區覆蓋不再偏斜
psql "$SUPABASE_DB_URL" -c "
  SELECT CASE WHEN lat >= 24.5 THEN '北' WHEN lat >= 23.5 THEN '中'
              WHEN lat >= 22.5 THEN '南' ELSE '最南' END,
         COUNT(DISTINCT station_id)
  FROM public.get_xxx_day(CURRENT_DATE)
  GROUP BY 1 ORDER BY 1;
"
```

**不要做**：
- ❌ 盲目加 `.range(0, 99999)` — gateway 擋，無效
- ❌ 盲目懷疑 ORDER BY 順序不對 — 根本問題是 cap
- ❌ 改成 paginate pagination — 時序圖層難 reassemble，降頻簡單得多

**實例**：migration 060 / 060b。

---

## PB-09 Collector 重複度檢核 SOP

> 觸發：新加的 collector，懷疑跟既有 collector 抓同一批站。

```bash
# Step 1: 兩邊各多少有座標的站
psql "$SUPABASE_DB_URL" -c "
SELECT
  (SELECT COUNT(*) FROM <old_stations> WHERE geom IS NOT NULL) AS old_n,
  (SELECT COUNT(*) FROM <new_stations> WHERE geom IS NOT NULL) AS new_n;"

# Step 2: 100m 內配對對數
psql "$SUPABASE_DB_URL" -c "
SELECT COUNT(*) AS overlap
FROM <old> o JOIN <new> n
  ON ST_DWithin(o.geom::geography, n.geom::geography, 100);"

# Step 3: 各邊有幾個站找得到對應（用 500m 寬鬆配）
psql "$SUPABASE_DB_URL" -c "
SELECT
  COUNT(DISTINCT o.id) AS old_with_match,
  COUNT(DISTINCT n.id) AS new_with_match
FROM <old> o JOIN <new> n
  ON ST_DWithin(o.geom::geography, n.geom::geography, 500);"

# Step 4: 8 對最近站看名字（dist=0 + 名字相近 = 確認同源）
psql "$SUPABASE_DB_URL" -c "
WITH a AS (SELECT id, name, geom FROM <old> WHERE geom IS NOT NULL),
     b AS (SELECT id, name, geom FROM <new> WHERE geom IS NOT NULL)
SELECT a.name AS old_name, b.name AS new_name,
       ROUND(ST_Distance(a.geom::geography, b.geom::geography)::numeric, 1) AS dist_m
FROM a CROSS JOIN LATERAL (
  SELECT id, name, geom FROM b ORDER BY a.geom::geography <-> b.geom LIMIT 1
) b
WHERE ST_Distance(a.geom::geography, b.geom::geography) < 100
LIMIT 8;"
```

**判讀矩陣**：

| 配對率 | 結論 | 動作 |
|---|---|---|
| > 90% | 完全重複 | 停一邊（保留資訊豐富的） |
| 30 - 70% | 部分重疊 | case by case，看欄位差異 |
| < 30% | 互補 | 兩邊都留 |

**順便比 schema 欄位**：填充率（COUNT vs sample 全空）+ 歷史長度 + 取樣頻率，決定誰當主源。

詳見：`docs/research/iot-wra-integration-study.md` § 3 + § 7。

實例：iot_wra groundwater（95% → 停 iot）vs river（16% → 兩邊都留）。

---

## PB-10 Pre-aggregate 雙表設計（latest snapshot + daily timeline）

> 觸發：新時序資料源 24h rows > 100k，前端需要 **latest 地圖點** + **timeline 拖拉** 兩種視覺。

| 表 | 規模 | 用途 | refresh 頻率 |
|---|---|---|---|
| `realtime.<src>_latest` | 固定 ~站數 × 測項 | 地圖點圖示 | 每 10 min |
| `realtime.<src>_daily` | ~站數 × 7 天 | timeline 拖拉 | 每 20 min today + yesterday |

關鍵設計：

1. **Latest 表欄位**：`value` + `value_day_start` + `delta_since_day_start`（跨站可比著色用）
2. **Daily 表 timeline 字串編碼**：`"epoch1,val1;epoch2,val2;..."` 每小時 1 個 timepoint，**仿 freeway pattern**，避 PostgREST 20K cap
3. **Refresh function 三件套**：
   - `pg_advisory_xact_lock` 防並發
   - `DELETE` + `INSERT FROM (DISTINCT ON ...)` 模式
   - `SET statement_timeout TO '0'`（cron 不受 PostgREST 2min 限制）
4. **Cron 排程錯開分鐘**（避 IO 撞車，依 cron_throttle.sql 規則編號）

**前端解析 timeline 字串**（給其他 layer 抄）：

```ts
function parseTimeline(timeline: string): Array<{ t: number; v: number }> {
  if (!timeline) return [];
  return timeline.split(";").reduce<Array<{t:number;v:number}>>((acc, pair) => {
    const [t, v] = pair.split(",").map(Number);
    if (Number.isFinite(t) && Number.isFinite(v)) acc.push({ t, v });
    return acc;
  }, []);
}
```

實例：migration 063（iot_wra）— `iot_wra_latest` 4k rows + `iot_wra_daily` ~4k rows × 7 天 / 23 timepoints。

詳見：`docs/research/iot-wra-integration-study.md` § 5.2。

---

## PB-11 Zeabur PREBUILT_V2 service 部署（從 GitHub repo）

> 觸發：要把外部服務（如 OSRM、reverse proxy）放上 Zeabur 給 collector 或 frontend 用。

```bash
# 1. 本機建 minimal repo
mkdir -p ~/.../<service-name>
cd ~/.../<service-name>
# 寫 Dockerfile + 必要 config（範例: osrm-taiwan, osrm-proxy）
git init -b main
git add . && git -c commit.gpgsign=false commit -m "feat: initial <service>"

# 2. GitHub private repo + push
# 用戶手動建 https://github.com/new (private)
git remote add origin git@github.com:<user>/<service>.git
git push -u origin main

# 3. Zeabur dashboard 部署
# - 進目標 project（同 collector 同 project 才能用內網）
# - + Add Service → Deploy from GitHub → 選 repo
# - Build 等候（30 分鐘 OSRM / 1 分鐘 nginx）

# 4. 確認 K8s service port 預期
npx zeabur@latest service network --id <service-id>
# 注意：PREBUILT_V2 預期 web (HTTP) 是 8080
# Dockerfile EXPOSE 跟 osrm-routed --port / nginx listen 都要對齊到這個 port
```

**坑點**：
- Dockerfile EXPOSE 不影響 K8s service targetPort，**容器內進程必須真的 listen 8080**
- Empty commit Zeabur 不會 trigger redeploy，env var 變更後要 trivial file change 才生效
- 含 `${}` 的 env var 用 dashboard 設，不要用 CLI（Cobra parser 雷）
- Mac M1 build 多階段 image 會跨平台慢，本機驗證 OK 後**讓 Zeabur 自己 build**（如果機器規格夠）或推 amd64 image 到 registry pull

**內網 hostname 解析規則**：
- 同 project：`<service-name>.zeabur.internal:8080` 或 `service-<service-id>:8080`
- 跨 project：**不通**，必須走 public domain（見 PB-12）

詳見：`docs/research/waste-osrm-mapmatching-plan.md` §14（OSRM 部署完整紀錄）。

---

## PB-12 跨 project Bearer token gateway pattern

> 觸發：A service（如 OSRM、AI Hub、自有 API）必須放在 project X，但呼叫方 collector / frontend 在 project Y。Zeabur 內網跨 project 不通。

**架構**：
```
caller (project Y) ──https + Bearer token──▶
  proxy service (project X，nginx:alpine + envsubst)
    ──internal http──▶ underlying service (project X)
```

**Step 1: 建一個 nginx:alpine proxy service**

`Dockerfile`（3 行）：
```dockerfile
FROM nginx:1.25-alpine
COPY default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
```

`default.conf.template`（envsubst 啟動時自動展開 `${OSRM_TOKEN}` / `${UPSTREAM_HOST}`）：
```nginx
server {
    listen 8080;
    location = /health { return 200 "ok\n"; }
    location / {
        if ($http_authorization != "Bearer ${API_TOKEN}") { return 401; }
        proxy_pass http://${UPSTREAM_HOST};
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
    }
}
```

**Step 2: Zeabur 部署到 underlying service 同 project**

設兩個 env var：
- `API_TOKEN=<openssl rand -hex 32>`
- `UPSTREAM_HOST=<underlying>.zeabur.internal:8080`

開 public domain（這個 service 就是要對外）。

**Step 3: caller 設環境變數**

```
API_URL=https://<proxy>.zeabur.app
API_TOKEN=<same token>
```

caller code 用 session-level header 一次設好：
```python
self.session = requests.Session()
self.session.headers.update({'Authorization': f'Bearer {token}'})
```

**驗證**（部署後從 caller container exec）：
```bash
# 1. health 不需 auth
curl https://<proxy>.zeabur.app/health  # 期望 200 "ok"

# 2. 沒 token → 401
curl https://<proxy>.zeabur.app/some-endpoint  # 期望 401

# 3. 帶 token → 200
curl -H "Authorization: Bearer $TOKEN" https://<proxy>.zeabur.app/some-endpoint
```

**月度 token 輪換**：改 proxy 的 `API_TOKEN` env var → Zeabur reload nginx → 同步改 caller 的 `API_TOKEN`。

實例：osrm-proxy 包 osrm-taiwan，給跨 project ship-only collector 用。詳見 `docs/research/waste-osrm-mapmatching-plan.md` §14。

---

## PB-13 大集合 RPC 設計 SOP（避 PostgREST 20K cap）

> ⚠ 動手前先看 PRINCIPLES「Supabase PostgREST 20K cap」章節，做過兩次（063 timeline、079 schedule）

### Step 1：估 rows 數

寫 RPC 前先 SQL count 預期 row 數。**> 5K 必須採取對策**，不要等 production 撞牆。

```sql
SELECT COUNT(*) FROM (<RPC body 主 query>) x;
```

### Step 2：選 pattern

| 資料性質 | Pattern | 範例 |
|---|---|---|
| 時序 latest / 每小時 snapshot（**能丟**）| 降頻 `DISTINCT ON (id, hour) ORDER BY ... DESC` | groundwater 78K → 16.5K (060) |
| 時序 timeline 完整序列（不能丟但可壓縮）| 字串編碼 `"epoch,val;..."` | iot_wra_daily (063) |
| 事件 / 動態結構（**不能丟**） | Grouped JSONB `jsonb_agg ORDER BY ...` GROUP BY parent | schedule stops (079) |

### Step 3：實作 grouped JSONB（Pattern 3 範本）

```sql
WITH filtered AS (
    SELECT ... FROM source WHERE ...
),
seq AS (
    SELECT *,
        ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY arrival_sec)::INT AS seq
    FROM filtered
)
SELECT
    parent_id,
    MAX(parent_attr) AS parent_attr,
    jsonb_agg(
        jsonb_build_object(
            'seq', seq,
            'lng', lng, 'lat', lat,
            'arrival_sec', arrival_sec
        ) ORDER BY arrival_sec, id
    ) AS items
FROM seq
GROUP BY parent_id
ORDER BY parent_id;
```

注意：**parent attributes 用 `MAX()` 包**（即使值都一樣），否則 PostgreSQL GROUP BY 會抱怨。

### Step 4：Loader 對應 grouped 結構

```ts
interface RawRow {
  parent_id: string;
  parent_attr: string;
  items: ItemJson[];   // jsonb_agg 直接拆成 array
}

const routes = rows.map(r => ({
  parentId: r.parent_id,
  items: r.items.map(s => ({ ... })),
}));
```

### Step 5：驗證

```bash
# 1. psql 直查 row count
psql -c "SELECT COUNT(*) FROM public.get_xxx(...)"

# 2. curl 看 content-range header（確認沒撞 cap）
curl -D /tmp/hdr.txt -X POST $SUPABASE_URL/rest/v1/rpc/get_xxx ...
grep content-range /tmp/hdr.txt
# 期望：content-range: 0-N/N（N != 19999）

# 3. 前端 console.log fetched 數，跟 psql 比
console.log(`[Layer] fetched ${rows.length} rows`)
```

### Step 6：寫 GLOSSARY 註明

寫一行「避 PostgREST 20K cap，改用 grouped JSONB」+ migration 編號。下次同類 case 一查就避坑。

---


## PB-14 PMTiles 重出補欄位 SOP（跨 repo，2026-05-23 加）

**情境**：前端 click popup 拿到 `undefined` / 空白 → 多半是 PMTiles `keep_attrs` 沒加要顯示的欄位。

### 為什麼會踩

tippecanoe 預設**只保留 `-y` 指定的欄位**，其他 raw 屬性全丟。`06_export_frontend.py` 為了瘦身只 keep 三五個欄位，但前端要顯示其他屬性時必須重出。

### 5 步流程

1. **確認 parquet 是否有那欄**（`taipei-gis-analytics/data/processed/agriculture/<slug>/<slug>.parquet`）
   ```bash
   venv/bin/python3 -c "import pandas as pd; df = pd.read_parquet('data/processed/agriculture/<slug>/<slug>.parquet'); print(df.columns.tolist())"
   ```
   有 → 進 step 2；沒有 → 該 dataset 真的沒這資料，斷念

2. **改 keep_attrs**：編輯 `pipelines/agriculture/_batch_download/06_export_frontend.py` 的 `keep_attrs` list，**加上**要顯示的欄位

3. **重出該 PMTiles**（不需跑全部 script，可單獨 import 函式 trigger）：
   ```bash
   cd /path/to/taipei-gis-analytics
   venv/bin/python3 -c "
   import importlib.util
   spec = importlib.util.spec_from_file_location('ef', 'pipelines/agriculture/_batch_download/06_export_frontend.py')
   m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
   m.export_pmtiles(
       '<slug>',
       layer_name='<layer_name>',
       keep_attrs=[...],   # 同步 06_export_frontend.py 那邊
       minzoom=<...>, maxzoom=<...>,
   )"
   ```

4. **複製到 mini-taiwan-pulse**：
   ```bash
   cp data/processed/agriculture/<slug>/<slug>.pmtiles \
      ../mini-taiwan-pulse/public/agriculture/
   ```
   注意 `public/agriculture/*.pmtiles` 已 gitignore，**不會進 mini repo 的 git** —
   走 S3 deploy-assets 上線

5. **前端接 panel**：在 `FeatureInfoPanel.tsx` 加 sub-panel + `HEADER_LABELS` +
   switch case + `useMapInteraction.ts` 的 `GIS_LAYERS` 加 `{ layers: [...], type: "..." }` +
   `FeatureInfo.layerType` union 加 key

### 驗證

- Dev server reload，toggle 該 layer，點 polygon/POI → 應該看到所有欄位
- 中文欄位（如「社區名」「土系」）注意 JS 端要用字串字面值 lookup：`props["社區名"]`，
  別忘了 useMapInteraction 拿到的 properties keys 是 PMTiles 寫進去的原始名稱

### 實例（2026-05-23 連跑 4 個 layer）

| Layer | 原 keep_attrs | 新 keep_attrs（加哪些）| 重出後大小變化 |
|---|---|---|---:|
| soil_map_national | row_id, area_ha | +圖幅名稱/地區/調查區/土類/土系/土型/表土質地/坡度相 | 23 → 28 MB |
| soil_fertility_grid_250m | row_id, area_ha | +pH_H2O/OM_OMU/CEC/M3_P/M3_K | 14 → 32 MB |
| leisure_farm_zones_2025 | +AA45/AA46 | +休區名/LANAME/KeyCode | 0.35 → 0.42 MB |
| rural_regen_communities_2025 | row_id, area_ha | +社區名/計畫名/縣市/鄉鎮/村里/分署/核定時/計畫年/NOTE | 1.6 → 2.4 MB |
| crop_suitability_132 | 不變（原本就有 kind/crop_name_zh）| — | 不變 |

⚠ **soil_fertility 加 5 個數值欄位翻倍**（14 → 32MB）— 134K grid × 5 numeric col。
minzoom 8 + range request 不會一次全載，但要評估部署成本。

## PB-15 Browser 視覺驗收 WebGL / Mapbox 圖層 SOP（2026-05-24 加）

### 為什麼會踩
- **headless agent-browser 渲染不出 Mapbox/Three.js**：console 報 `Failed to initialize WebGL`、截圖全黑（headless Chromium 無 GPU）。
- 手動 mouse-wheel zoom + drag 導航到特定城市**極不精準**，常落在鄉間空白處（無資料）浪費大量 round-trip。

### 5 步流程
0. **先按「All Off」清掉所有圖層再只開要測的那層**（2026-05-24 用戶提醒）——否則其他 layer 的點會混進來，誤判顏色/大小/數量。
1. **一定用 `--headed --session-name <name>`**（真實 GPU 才有 WebGL）。dev server `npm run dev`（port 3721），`.env` 確認 `VITE_DATA_SOURCE=supabase`。
2. **先驗證靜態資源端點**：`curl -s -o /dev/null -w "%{http_code} %{size_download}" http://localhost:3721/geo/xxx.geojson`（200 才往下）。
3. **toggle 圖層**：`snapshot | grep <中文label>` 找到 → expandable layer 的「文字 label」是展開、**toggle 開關是後面那顆 button ref**（點 label 不會切換可見性，要點 ref 如 e65）。
4. **導航用 app 內建「Locations」面板城市預設**（台北/台中/高雄…），**別用 wheel/drag 硬找**。火災最密 + 有消防栓的是台北（county A）。
5. **驗 popup**：`mouse move x y` → `down` → `up` → `snapshot | grep <panel 欄位>`。custom WebGL 層（火焰/3D）不可點，要靠底下常駐的 2D circle 命中。

### 實例（2026-05-24 消防火焰特效）
- headless 全黑 → 換 headed 立刻正常。
- wheel/drag 卡在苗栗鄉間 6+ 次都無火點 → 改點 Locations「台北」一次到位，火焰特效 + popup 全驗出。

---

## PB-16 大面積覆蓋／等時圈圖層 SOP（PMTiles + 全區聚合 + 分區 filter，2026-05-26 加）

> 適用：**等時圈、服務範圍、可及性分析**等「大面積 / 高頂點覆蓋多邊形」圖層。
> 首例：消防救援等時圈（路網 5/10/15 分鐘，全台 22 縣市 716 隊）。
> 核心教訓：這類圖層**不要用 GeoJSON overlay**——要麼檔案大（pan 卡頓），要麼簡化到變醜。

### 鐵則（順序照做）

1. **門檻時間要有官方依據**，別隨便抓 15/30。先 WebSearch 查 KPI：
   - 消防署緊急救護 KPI = **10 分鐘到場率**；救命黃金期 4–6 分；NFPA 1710 首車 4 分。
   - 採「黃金救援」框架 **5 / 10 / 15 分**（轟燃前 / 消防署 KPI / 偏鄉可及）。

2. **路網等時圈生成** = Mapbox Isochrone API（`driving`, `contours_minutes`, `polygons=true`）。
   - 腳本 `scripts/fetch/fetch-fire-isochrones.py`：**原始回應務必磁碟快取**（`.fire_isochrone_cache/`，gitignored），調簡化參數免重打 API。
   - 圖例/popup 標註「driving 未計優先路權＝**保守估計**」。

3. **分級用環差（ring-difference）**：`band10 = union10.difference(union5)`，每塊只歸最快可達的一級
   → 單一 fill layer（`match` minutes 配色）即可正確上色，**無填色重疊**。綠 5 / 黃 10 / 橙 15。

4. **「全區」與「分區」分開算，禁止疊加**（用戶踩過：各縣市各自 dissolve 疊起來縣界很亂）：
   - **全區**（tag `全台`）= 所有來源點**一起 union**（無接縫）。
   - **分區**（tag county）= 區內各自 dissolve。
   - 兩套 feature 同 PMTiles 層，靠 `county` 欄位 + `setFilter` 切換（dropdown idx 0 → 全區）。

5. **來源缺座標 → geocode 補**（屏東 39 隊只有地址）：`scripts/fetch/geocode-pingtung-fire-stations.py`
   = Mapbox Geocoding v6（`country=tw` + `proximity` 偏壓 + **bbox 驗證丟掉界外**），冪等附加回 geojson。

6. **出貨用 PMTiles，不是 GeoJSON**：
   ```bash
   tippecanoe -o public/fire/fire_isochrone_coverage.pmtiles -l coverage -Z5 -z14 \
     --simplification=8 --drop-densest-as-needed --extend-zooms-if-still-dropping --force \
     build/fire_isochrone/fire_isochrone_coverage.geojson
   ```
   - `-l <name>` = 前端 `source-layer` 名。range request（dev/S3/nginx 都支援）→ 只載視窗瓦片。

7. **前端走 factory，不走 overlayRegistry**：`src/map/fireIsochroneLayerFactory.ts`（仿 `agricultureLayerFactory.ts`）。
   - PMTiles SourceType 註冊：factory 自帶 `registerSourceTypeOnce` + **try/catch**（agriculture 也會註冊）；
     **MapView 裡 ensure 必須排在 `ensureAllAgricultureLayers` 之後**（先註冊者成功，後者 try 命中 already-registered 被吞）。
   - 縣市切換 = `map.setFilter(fillId, ["==",["get","county"], 名稱])`；單一真實來源 `src/data/fireIsochroneCounties.ts`（dropdown + filter 共用）。
   - 接 MapView 三處：`style.load` / `load` handler（ensure+update）+ params effect + visibility effect。

8. **中介 GeoJSON 寫 gitignored `build/`**，`public/` 只放 `.pmtiles`（生成腳本 OUT_DIR 指 build/）。

9. **UX 四鐵則照舊**：透明度 slider、顏色分級必寫圖例（`fireTypes.ts` 的 `FIRE_ISOCHRONE_BANDS` 單一來源）、
   面可點 → popup（`useMapInteraction` GIS_LAYERS 放**清單末端**避免大面積擋點選）、**縣市選項 ≥4 用原生 `<select>`**。

### 檔案地圖（首例）
`fetch-fire-isochrones.py`（生成+全國聚合）/ `geocode-pingtung-fire-stations.py`（補座標）/
`fireIsochroneLayerFactory.ts`（PMTiles 渲染+filter）/ `fireIsochroneCounties.ts`（縣市清單）/
`fireTypes.ts`（分級配色）/ `public/fire/*.pmtiles`（出貨）/ `build/fire_isochrone/`（中介）。

## PB-17 Zeabur 正式上線（push master → 自動部署 → 驗證，2026-06-02）

完整計畫/稽核/runbook/SOP 見 `docs/launch/`（00 計畫 / 01 逐層稽核 / 02 Go-NoGo / 03 runbook /
04 新資料分類SOP / 05 晨間報告 / 06 deploy-assets搬家 / 07 key設定 / 08 上線後硬化）。

```bash
# 0. 安全網
git tag backup/pre-launch-master-<ts> origin/master
# 1. 本地驗證（忠實重現 Zeabur 從 git build）
npx tsc -b
git archive HEAD | docker build --build-arg VITE_MAPBOX_TOKEN=<t> -t pulse-local -
docker run -d -p 8088:8080 -e S3_ACCESS_KEY=.. -e S3_SECRET_KEY=.. -e S3_REGION=ap-southeast-2 -e S3_BUCKET=migu-gis-data-collector pulse-local
# curl 逐路徑 /geo /h3 /bus /agriculture /fire 200/206 + dist fallback（git 小檔即使 volume 空也要 200）
# 2. 靜態大檔上 S3（gitignore 的；新增/改名後必跑 + 比對 aws s3 ls）
bash scripts/deploy/upload-deploy-assets.sh
# 3. 上線
git checkout master && git merge --no-ff <feature> && npx tsc -b
git push origin master            # Zeabur git-connected → 自動 build（從 git）
# 4. 監測 + 驗證
npx zeabur@latest deployment list --id <service-id> -i=false      # 等 8 碼 commit 對應 deployment RUNNING
npx zeabur@latest deployment log --id <id> -t runtime -i=false    # 看 entrypoint 背景 pull
curl -sI https://<domain>/<path>                                  # 線上逐層 200/206
```

關鍵：Zeabur 從 git build（gitignore 大檔不在 image）→ entrypoint 從 S3 pull 進 /data volume；
nginx `/geo /h3 /bus` 帶 `@dist` fallback；Cloudflare Cache Rule 配 404/5xx no-cache。
容器內補抓單檔（免重啟）：`npx zeabur@latest service exec --id <id> -i=false -- /usr/local/bin/pull-deploy-assets.sh`。
flag 是 `--id` 不是 `--service-id`。

---

## PB-XX 新增 LLM 評估維度全鏈路（2026-06-13）

新增 LLM 輸出欄位（如 gis_relevance / severity / is_event）必過 5 段路，
任一段漏接 → silent fail（LLM 跑了但 DB 全 NULL）。

```
1. data-collectors/collectors/<x>.py SYSTEM_PROMPT_HEADER
   - 加規則 + 加輸出 schema 範例
   - LLM_BATCH_SIZE 視 output 變多適度降低

2. _annotate_items 內解析新欄位
   - 加 validate（範圍 / 型別 / fallback None）

3. _no_location_defaults / dry-run 補預設 None

4. ⚠️ records.append({...}) dict 補新欄位
   - 漏這步 = LLM 跑了但 DB 全 NULL（本 session 踩過）

5. storage/supabase_tables.py TABLE_MAP[<x>].columns 補新欄位
   - 漏這步 = supabase_writer 過濾掉新欄位、DB INSERT 不帶

6. gis-platform migration <next>:
   - ALTER TABLE realtime.<x> ADD COLUMN ... (允許 NULL，舊資料相容)
   - ALTER TABLE realtime.<x>_daily ADD COLUMN ...
   - refresh function 重出，帶新欄位
   - 加 (day, <new col>) 索引給前端篩選
   - Apply：psql "$SUPABASE_DB_URL" -f migrations/...

7. 本地實跑驗證（必跑）：
   NEWS_EVENTS_ENABLED=true SUPABASE_ENABLED=true python3 -m collectors.news_events
   psql 驗證 count(<新欄位>) = count(*) — 沒填滿就是有環節漏接

8. 前端（如需）：
   - 新 RPC v2 加參數
   - loader 改吃新 RPC、cache key 包含參數
   - hook 加參數、useEffect 包含參數的 deps
   - sidebar 加 control（options ≥ 4 自動 dropdown）
   - paint 用新欄位（match/case expression）
```

關鍵：寫完每段「先 grep 同名舊欄位」確認 5+ 處都有對應改動。

---

## PB-XX 全自動 PR 工作流程（2026-06-13）

個人 side project 標準流程，從寫 code 到上線約 5 分鐘：

```
# 1. 開 feature 分支
git checkout -b feat/<name>

# 2. 寫 code + 本地驗證
npx tsc -b && npm test                # 前端
pytest tests/ -v                      # data-collectors
psql "$SUPABASE_DB_URL" -f migrations/<next>.sql  # gis-platform，先 apply 線上實測

# 3. 本地實跑（特別是 LLM/collector/RPC 端到端）
# - 改 LLM prompt → NEWS_EVENTS_ENABLED=true 跑一輪 + DB 驗證
# - 改 RPC → psql 跑各種參數確認形狀
# - 改前端 → dev server + agent-browser 截圖驗證

# 4. push + PR
git add -A && git commit -m "<type>: <subject>" && git push -u origin <branch>
gh pr create --title "<title>" --body "<summary + 自我檢查結果 + 截圖路徑>"

# 5. 等 CI + Claude review（30s-2min）
# - CI 紅 → 修 → push 重跑
# - Claude review 有意見 → 看是否合理、修或 dismiss
# - 兩道全綠 → merge

# 6. merge + sync
gh pr merge <#> --squash --delete-branch
git checkout master && git pull --ff-only && git branch -d <branch>

# Zeabur 自動部署、Supabase migration 已預先 apply（步驟 2）
```

跨 repo 多 PR 時策略：DB 端 PR 先（先 apply 線上）→ collector PR → 前端 PR。
這樣前端開 PR 時 RPC 已可用、本地驗收能跑。

GitHub Actions 配置：
- `.github/workflows/ci.yml` 跑既有測試
- `.github/workflows/claude-review.yml` PR 開啟時自動 review
- `.github/workflows/claude-mention.yml` `@claude` mention 觸發回應
- 三 repo 都需要 `CLAUDE_CODE_OAUTH_TOKEN` secret（`claude setup-token` 產出）
