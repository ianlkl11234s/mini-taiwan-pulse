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

## PB-06 Deploy（Zeabur auto build + S3 deploy-assets 同步）

### 6a. 純程式部署（沒新資料）

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

### 6b. ⚠️ 新增大型資料檔到 S3 → **5 檔強制同步 checklist**（2026-03-06 教訓）

漏一處就 production 404 或載入 index.html：

| # | 檔案 | 動作 |
|---|---|---|
| 1 | `scripts/upload-deploy-assets.sh` | FILES 陣列加新檔名 |
| 2 | `scripts/pull-deploy-assets.sh` | FILES 字串加新檔名 |
| 3 | `docker-compose.yml` | volumes 加對應掛載 |
| 4 | `.gitignore` | 加排除規則 |
| 5 | **`nginx.conf`** | **location regex 加新檔名路由到 /data**（⚠️ 最常漏，漏了 fetch 走 SPA fallback 回 index.html → JSON parse fail → 圖層不顯示） |

### 6c. Glob pattern 例外（水資源模式，2026-04-24）

若同群檔（例如 `water_*.geojson`）預期會不斷新增，改走 glob 動態列舉可免掉每次改 5 處：

- `.gitignore` 用 glob 排除
- `upload-deploy-assets.sh` 顯式 FILES 迴圈後 append `for f in public/geo/xxx_*.geojson`
- `pull-deploy-assets.sh` 用 `aws s3 ls | grep '^xxx_'` 動態抓
- nginx `location /geo/` 已涵蓋所有 `.geojson`，不需個別 regex

**已用 glob**：`water_*.geojson`
**其他類別想用**：照 water_* 段抄一份改 prefix

### 6d. 首次部署 checklist

1. Zeabur → GitHub repo
2. 環境變數：`VITE_MAPBOX_TOKEN` (build) / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_REGION=ap-southeast-2` / `S3_BUCKET=migu-gis-data-collector`
3. Volume mount `/data`
4. Web Terminal：`sh /usr/local/bin/pull-deploy-assets.sh`
5. 確認 `rail/ extracted to /data/rail/`

### 6e. 資料更新流程

```bash
# 本地
bash scripts/upload-deploy-assets.sh     # 上 S3 deploy-assets/

# Zeabur Web Terminal
sh /usr/local/bin/pull-deploy-assets.sh  # 從 S3 拉到 /data/
```

### 6f. 7 個易錯提醒

1. **S3 路徑**：部署一律用 `upload-deploy-assets.sh`（`deploy-assets/`），不是 `npm run s3:upload:rail`（`rail-data/`，前端 fallback 用）
2. **rail 格式**：前端請求個別 `.json` / S3 存 `rail.tar.gz` / pull 腳本自動解壓，**不是**單一 `rail_bundle.json`
3. **S3 ACL**：bucket 不支援 ACL（`--acl public-read` 會 fail），改用私密 + 環境變數認證
4. **pull 腳本路徑**：`/usr/local/bin/pull-deploy-assets.sh`（不是舊 README 寫的 nginx html 路徑）
5. **腳本更新**：改 `pull-deploy-assets.sh` 後需要 commit + push + **重部署**（Dockerfile COPY 到 image 內），只跑 pull 不會更新腳本
6. **判 cutover 不看 `zeabur deployment list` 的 RUNNING 標籤**（會滯後，舊 deployment 數小時後仍標 RUNNING）。改認三條 runtime 證據：runtime log 出現**新 pod started** → log 出現 `[pull] all assets synced` → **自己發一個可辨識的請求**（帶 token 的 query string）確認它出現在**新 pod 的** access log。前兩條只證明新 pod 起來了，第三條才證明流量切過去了
7. **deploy 落地前不要裸探測新檔名**：`curl -I "<url>?cb=$(date +%s)"`。CF 預設會 negative-cache 404 最長 4hr（`.gz` 中招、`.json` 不會），而本專案唯一的 purge 是 `purge_everything`

### 6g. rail 幾何更新（2026-08-09 起走**內容雜湊檔名**）

```bash
python3 scripts/preprocess/build-rail-slim-bundle.py   # 產 rail_slim.<hash>.json.gz + rail-manifest.json
npx tsx scripts/preprocess/verify-rail-slim.ts         # 位置偏差 p95<30m / max<100m（自動讀 manifest）
aws s3 sync public/embed-rail/ "s3://$S3_BUCKET/deploy-assets/embed-rail/" --region ap-southeast-2
```

- 第 3 步一次上傳新 bundle 與新 manifest，**不加 `--delete`**（遠端留舊 hash 供回滾 + 避開部署競態）
- 容器 pull 後 **60 秒**內讀者收斂到新幾何：**不必 purge、不必改 nginx、不必改前端**
  （檔名帶 hash ⇒ 新 URL；purge_everything 會連 297MB 底圖一起清，這裡完全用不到）
- 內容沒變 ⇒ hash 不變 ⇒ 整條是 no-op（冪等，已實測連跑同 hash、gz 逐位元組相同）
- **回滾**：把 manifest 的 `bundle` 改回上一份 hash 再 sync 一次即可（bundle 本體還在 S3）
- 本機 `--keep 3` 只清本機舊檔，不傳染遠端

**Long-form**：`~/.claude/projects/.../memory/_archive/deploy-checklist.md`

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
⚠️ **empty commit 不會觸發 Zeabur build**（2026-07-30 deployment list 實證無新部署）——換資料磚別推空 commit，直接 service exec pull。
換磚時序：**S3 上傳完成要早於 merge/deploy**（merge 後容器 ~2min 內就啟動 pull，上傳沒完成就拿舊檔）；錯過用 service exec 補拉，`curl -I "<url>?cb=<ts>"` cache-bust 驗 origin。
origin 換新後 Cloudflare edge 仍可能 HIT 舊檔至多 1d（PMTiles range request 同吃舊快取）；要立即生效跑 `purge-cloudflare-cache.sh`（需 .env CF_ZONE_ID/CF_API_TOKEN → BACKLOG G017）。
⚠️ 但 **`/embed-snapshots/`（檔名含日期）與 `/embed-rail/`（檔名含內容雜湊）不在此列**：
內容變 ⇒ 檔名變 ⇒ 新 URL，本來就不會 HIT 到舊檔，**永遠不需要 purge**
（purge-cloudflare-cache.sh 是 purge_everything，會連 297MB 底圖一起清，能不用就不用）→ 見 PB-06g。

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

---

## PB-17 衛星圖層分群上線（CelesTrak 或 Supabase？）

> 2026-06-13 制定。新國家 / 新系列衛星 layer 都套這個流程。

### Step 1: 資料來源決策（CelesTrak vs Supabase）

| 條件 | 用 |
|---|---|
| gis-platform Supabase 已有 `satellite_classified` view | **Supabase**（推薦）|
| 完全沒有衛星管線 | CelesTrak（要先測瀏覽器是否 403） |

⚠️ CelesTrak 對瀏覽器 fetch 直接 403（CORS/UA），本機 curl 不能拿來判斷。
若一定要走 CelesTrak，要做 Supabase wrapper RPC 後端代理。

### Step 2: 衛星清單篩選（雙保險）

```ts
// loader 同時跑兩個 query 合併去重
const [byCountry, byName] = await Promise.all([
  fetchView("country_operator=eq.<國>"),            // UCS 有對齊的
  fetchView("or=(name.ilike.系列前綴*)&category=neq.debris"), // UCS 漏網 + 排碎片
]);
```

理由：UCS Satellite Database 半年才更新一次，新發射衛星 `country_operator=null`
半年內查不到（FS-8A / TRITON 都中過招）。靠名稱 regex 補位。

### Step 3: 分群（避免「重要性差距大」的雜訊）

中國衛星跑 351 顆全混時：北斗 49 顆慢繞 MEO/GEO 視覺喧賓奪主，蓋過 Yaogan
「每 10 分鐘過台灣」的戲劇性。

→ 按名稱前綴 regex 分群拆 toggle：
```ts
const CN_YAOGAN_RE = /^YAOGAN/i;
const CN_JILIN_RE = /^JILIN/i;
const CN_GAOFEN_RE = /^GAOFEN/i;
// 其他 (含 TJS / Beidou / Shiyan) 歸 china_other 預設關
```

S 級三組（即時偵察）預設可開、其他預設關。

### Step 4: SGP4 計算頻率分流（避免跳格 / 過熱）

```ts
// 點 + 足跡（廉價，每顆 1 SGP4）→ 高頻
subscribeThrottled(100ms, recomputeLight);  // 10 Hz 流暢
// 軌跡 polyline（昂貴，每顆 60 SGP4）→ 低頻
subscribeThrottled(1000ms, recomputeTrack); // 1 Hz 即可
```

實測 350 顆 × 10 Hz light + 1 Hz heavy ≈ 23k SGP4/s，現代瀏覽器輕鬆。

### Step 5: Hook 穩定性鐵則

- `visibility` / `trackMinutes` 走 ref，不入 useCallback deps
- recompute 是 stable callback（useCallback deps `[]`）
- 所有 `map.on(...)` listener 必須進 cleanup
- 新增 `visKey` 字串穩定化 effect：toggle 一動立即 force recompute（0 延遲、0 閃爍）

### Step 6: 9 觸點接線（依 CLAUDE.md 規則 5）

types/index.ts → satelliteTypes.ts (colors/labels/regex) → satelliteSGP4.ts (純函式)
→ satelliteLoader.ts (Supabase) → useSatellitesLayer.ts → layerCatalog.ts (LAYER_COLORS + SPACE section)
→ useLayerVisibility.ts (DEFAULT_ON 視需要) → IconRailSidebar.tsx (LAYER_ICONS 對應)
→ App.tsx (hook call) → SatellitePanel + featureInfo/registry.tsx + LegendPanel.tsx
→ useMapInteraction.ts (GIS_LAYERS 加 sat-current-point)
→ useTransportParams.ts (opacity slider case)

### 反例（不要做）

- ❌ 全部混一個 layer 不分群（北斗喧賓奪主）
- ❌ recompute 入 useCallback deps（effect 頻繁重綁 + throttle 殭屍 closure）
- ❌ 直接走 CelesTrak 不測瀏覽器（部署後才發現 403 整天 0 顆）
- ❌ 只看 country_operator 不靠名稱保底（FS-8A 找半天）

---

## 新增 realtime collector → Supabase 表 → 前端 5 處 SOP（2026-06-17）

> 從零加一支新 realtime 管線（如 yt_live_video_resolver / pla / cdc / twse_market_index）的標準步驟。

### data-collectors（5 處檔案，缺一即靜默失敗）

```
collectors/<name>.py              # 1. collector class（繼承 BaseCollector）
collectors/registry.py            # 2. import + CollectorEntry tuple
config.py                         # 3. _COLLECTOR_TOGGLES 加 (PREFIX, default_enabled, interval)
storage/supabase_tables.py        # 4. 加表 schema (history/current/columns/upsert_key/strategy)
storage/supabase_writer.py        # 5. _transform_<name> 方法 + TRANSFORMERS dict ⚠ 易忘第二步
```

### gis-platform（1 個 migration）

```sql
-- migrations/<NNN>_realtime_<name>.sql
CREATE TABLE realtime.<name>_history (... UNIQUE(...));
CREATE TABLE realtime.<name>_current (PK=key, UPSERT);
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... FOR SELECT TO anon USING (true);
CREATE OR REPLACE FUNCTION public.get_<name>_xxx() RETURNS TABLE (...)
  LANGUAGE sql STABLE AS $$ SELECT ... FROM realtime.<name>_current $$;
GRANT EXECUTE ON FUNCTION public.get_<name>_xxx() TO anon, authenticated;
```

### mini-taiwan-pulse（前端）

```
src/data/<name>Loader.ts          # fetchXxx() 包 withLoading()，type 完整
src/components/.../XxxComponent.tsx  # UI
src/App.tsx 或對應 Panel           # 接線 + 30s polling
```

### Verification（ship 前必跑）

```sh
# 1. collector 離線跑一次
cd data-collectors && SUPABASE_ENABLED=true <PREFIX>_ENABLED=true python3 -m collectors.<name>

# 2. 確認資料進 Supabase（不是只 buffer）
psql "$DATABASE_URL" -c "SELECT count(*) FROM realtime.<name>_current"
# 應 > 0；若 = 0 → 通常漏 step 5（transformer 註冊到 TRANSFORMERS dict）

# 3. 確認 RPC 真的存在
psql "$DATABASE_URL" -c "SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
  WHERE n.nspname='public' AND proname LIKE 'get_<name>%'"
# 應有；若無 → migration 還沒 apply 或函數名拼錯

# 4. RPC 真的回資料
psql "$DATABASE_URL" -c "SELECT * FROM public.get_<name>_xxx() LIMIT 3"

# 5. 前端 tsc + 開瀏覽器看 console 沒 [Xxx] failed warn
```

### Zeabur 部署

```sh
# 1. push 三 repo
# 2. 啟用 collector env
npx zeabur@latest variable create --id <data-collectors service id> -k "<PREFIX>_ENABLED=true" -y -i=false
# 3. 等 ~1-2 min 部署 + interval_min 內首輪 run
```

### 反例（本 session 教訓）

- ❌ 跳過 step 5 `supabase_writer.py` transformer 註冊 → collector log 顯示「✓ 已儲存」但 DB 0 rows，靜默失敗
- ❌ Handoff doc 寫了 RPC 名沒實際建 → 前端跑時 fallback 空殼，使用者看到「等待中」
- ❌ 用 regex 抓 page 上「第一個」videoId / 第一個 isLiveContent → 頻道頭推薦影片會混入

---

## PB-18 React 元件效能優化 5 step（2026-06-18）

> 觸發：使用者回報「網頁變慢」、Profiler 看到大量無謂 commit、RPC 流量超預期
> 來源：PR #21 Monitor / News 5 commits 實戰，每 step 可獨立驗收
> 鐵則：不改 UI、不改 props 對外契約、不改檔案位置、不引入新依賴

### Step 1 — RPC cache 包一層（最便宜見效）

對象：polling RPC、無參數或 string-key 化的 RPC。

```ts
// data/xxxLoader.ts
import { cachedOnce, keyedThunkCache } from "../lib/loaderCache";
const TTL_FAST = 25_000;  // 略短於 polling interval（30s），雙 panel 共享一次 fetch
const TTL_SLOW = 55_000;

async function _fetchFooRaw() { /* 原本內容 */ }
export const fetchFoo = cachedOnce(_fetchFooRaw, TTL_FAST);

// 有參數版本
const _barCache = keyedThunkCache<Bar[]>(TTL_SLOW);
export function fetchBar(hours: number) {
  return _barCache(`${hours}`, () => _fetchBarRaw(hours));
}
```

驗收：Network 面板 30s 內每支 RPC 只打 1 次（雙 panel 開也一樣）。

### Step 2 — 1Hz tick 隔離（wallClock store）

對象：父元件用 `useState + setInterval(1000)` 顯示「現在時間」/「3 分鐘前」。

```ts
// state/timeStore.ts 已有 wallClock 命名空間（2026-06-18）
// 元件內：
const now = Math.floor(useWallClock(5_000) / 1000);  // 5s 粒度
// 真的需要 1Hz 的子元件自己 useWallClock(1_000)
```

避雷：⚠️ **`useWallClock` 用 `useState + useEffect(subscribe)`，不要用
`useSyncExternalStore`**（getSnapshot 回 Date.now() 會無限 re-render）。

驗收：Profiler 看 idle 狀態 parent commit = 0；只有真的訂閱 1Hz 的子元件每秒動。

### Step 3 — ref-DOM 或 rAF + throttle（playback / 動畫）

對象：`setInterval(70ms)` 或更密、用 setState 推進動畫。

```ts
// 改 rAF + ref 累積 + commit throttle
const playbackRef = useRef(playbackTs);
useEffect(() => {
  if (!playing) return;
  let raf = 0, last = performance.now(), lastCommit = last;
  const tick = (t: number) => {
    const dt = (t - last) / 1000; last = t;
    playbackRef.current += advancePerSec * dt;
    if (t - lastCommit >= 200) {  // 5Hz commit
      setPlaybackTs(Math.floor(playbackRef.current));
      lastCommit = t;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [playing]);
```

驗收：scrub 跟手；Profiler 顯示 commit ≤5Hz、frame-rate independent。

### Step 4 — IntersectionObserver gate（重元件 lazy mount）

對象：iframe（YouTube / Twitter embed）、Three.js scene、大 SVG / Canvas。

```ts
// hooks/useInView.ts 已有（lock once，進入視窗後不再卸載避免 jank）
const ref = useRef<HTMLDivElement>(null);
const visible = useInView(ref);  // rootMargin: '200px' 預載
return <div ref={ref}>{visible && <iframe ... />}</div>;
```

驗收：MonitorPanel 關閉時 0 個 iframe 連線；非 wall mode 未捲到 LiveWall 同樣 0 個。

### Step 5 — React.memo 撒網（葉節點防穿透）

優先：零 props 或 props 純 primitive 的葉節點（LiveWall / HazardWatchStrip）。
條件：callbacks 用 useCallback、物件 props 用 useMemo 穩住才有意義。

```ts
export const LiveWall = memo(function LiveWall() { /* ... */ });
```

驗收：Profiler 各葉節點不再被父層 trigger render。

### 順序鐵則

1 → 2 → 3 → 4 → 5。**Step 1 最便宜先做、Step 5 最後撒網**。倒過來做（先 memo
再清 polling）會浪費功夫，memo 效果被父層 1Hz cascade 蓋掉。

### 失誤點（PR #21 實戰）

- ❌ `useWallClock` 第一版用 `useSyncExternalStore + getSnapshot=Date.now()` →
  無限 re-render 炸線（INCIDENTS 2026-06-18）
- ⚠️ tsc + 102/102 test 全綠 ≠ runtime 過：useSyncExternalStore 的 stale snapshot
  是 dev-only runtime 檢查，**push 前先 browser 跑一遍**
- ⚠️ Wall mode 暫停地圖 engine 看似順手但會視覺凍結，留作 G011 backlog 不該硬塞進效能 PR

---

## PB-19 大規模 design tokens migration（6-phase pattern）

> 跨 60+ 元件、1200+ inline 值的 token 化作業，分 phase 獨立 PR / commit，
> 每 phase 可單獨 revert。本 SOP 來自 2026-06-18 design system 6 phase 實戰
> （PR #22 merged）。

### 何時用

- 元件數 ≥ 20、要替換的散落值 ≥ 200 處
- 改動跨「外觀」+「行為」兩種語意時（單純改色換 SQL 就好）
- 需保留隨時 revert 能力時（視覺改動風險中高）

不適用：< 20 元件的小型重構，直接做不要分 phase。

### Phase 結構

```
Phase 0  純新增 token SSOT + 規範文件     ← 零風險，先打底
Phase 1  panel bg + shadow（視覺零差）     ← 從值不變的開始
Phase 2  fontFamily（字體 fallback）       ← 風險低
Phase 3  text color（半透明白 → 純灰 hex） ← 視覺極微差，需 user 驗收
Phase 4  borderRadius + fontSize 收斂      ← 視覺極微差
Phase 5  語意色對齊（業務語意：地圖 vs 警示）← 需 user 拍板
Phase 6  小元件統一（CloseButton / Loading） ← 收尾
```

**鐵則**：
1. **Phase 0 純新增**，不動既有元件。讓 token SSOT + 規範文件先 ship，後續所有
   phase 都能 import。
2. **由低視覺風險往高排**：值不變（Phase 1）→ 字體 fallback（Phase 2）→ 微差
   （Phase 3/4）→ 業務拍板（Phase 5）→ 收尾（Phase 6）。
3. **每 phase 獨立 commit**，user 隨時可 `git revert <hash>` 單獨還原任一 phase
   不影響其他。
4. **每 phase 後 tsc + codex review + 必要時 user browser 驗收**。

### 執行流程

#### 1. Audit（盤點現況）

派 Explore agent 全專案 grep 散落的硬寫值，產出：
- 顏色 / 字體 / 間距 / 圓角 / 陰影 使用次數統計
- 已有 SSOT 痕跡（如 LAYER_COLORS / intelTokens）
- 一致性問題候選清單（同 panel bg 4 種寫法等）

audit 給整個 6 phase 提供精準對映表，**不能省**。

#### 2. Phase 0：建 designTokens.ts + design-system.md

- token scale 從 audit 數據反推（如 fontSize 9/10/11/12/13 佔 80% → 7 階）
- 沿用既有 token（如 intelTokens）**單向 re-export**，不破壞既有元件
- design-system.md 必含：SSOT 結構 / token 全表 / 使用守則 / KEEP OUT / 新元件 checklist
- Codex review 抓 circular dep / 命名雙軌風險 / scale 缺位

#### 3. Phase N（替換）：subagent 平行 + 精準對映表

派 general-purpose subagent 做大量精準替換，prompt 必含：

```
1. 對映表：給「出現值 → token」對照（含 alpha → hex 階梯範圍）
2. 嚴格規則：只動哪個屬性、不動哪個屬性（borderColor/background/glow/textShadow 區分）
3. import 路徑：依檔案深度給對應的相對路徑
4. 跳過情境：計算式 / 三元 / CSS string / SVG / mapbox paint
5. 回報格式：替換數、新增 import 數、跳過原因統計、tsc 結果
```

**Pitfall**：grep pattern 寫精確 — 「rgba(10,10,20,0.88)」沒空格 vs
「rgba(10, 10, 20, 0.88)」有空格是兩種 hit。Phase 1 漏掉 LegendPanel /
FeatureInfoPanel 因為沒列空格版。

#### 4. Codex 交叉檢驗

每 phase 完成跑 `Agent(codex:codex-rescue)` review uncommitted diff：

```
review the uncommitted diff. context: phase N of design tokens migration.
check:
(1) 對映正確性
(2) 任何不該動的屬性被動了
(3) 任何該動的屬性漏動（leftover grep）
(4) import 相對路徑正確
report only, don't fix.
```

Phase 1 codex 抓到 10 處 over-replacement（control bg 不該收進 SURFACE）→ 還原。
Phase 0 codex 抓到 註解過期 / 命名雙軌 / circular dep 風險 → 修。

#### 5. Codex 卡死的 fallback

Codex 偶爾在 verifying phase 卡 20+ min（特別是改動量大時）。**判斷 5 min 沒回 → cancel + 手動 grep**：

```bash
node "/Users/migu/.claude/plugins/cache/openai-codex/.../codex-companion.mjs" status
# 若 elapsed > 5min 且 phase 一直在 verifying → cancel
node "/.../codex-companion.mjs" cancel <task-id>

# 手動 spot check
grep -rn 'rgba(255,255,255' src/ --include="*.tsx" | head -10  # leftover
grep -rn 'fontFamily: "monospace"' src/                          # missed
git diff --stat                                                  # 範圍
```

實例：Phase 3 codex 卡 23 min（Python script exit 1），cancel 後手動 grep 5 處
leftover 全屬聲明的保留情境，commit 過。

#### 6. Phase 5 需 user 拍板（業務語意）

純技術替換（Phase 1-4 / 6）可一氣呵成，但**業務語意對齊**（哪個語意配哪個色）
必須 user 拍板：

- 列出選項 + trade-off（如 flood 改紅 vs 保留青綠的視覺辨識度）
- 標明同色 collision 風險（flood #ef4444 vs safety #fb7185 接近）
- 接受變更後在 commit message 寫明 trade-off 與還原方式

#### 7. 文件補完 + PR

- design-system.md §6 標 phase commit hash（之後找變動歷史不用 grep）
- design-system.md §9 加新元件 checklist（你 / 未來 AI 寫新元件直接抄）
- PR body 列：6 phase 總表 / 視覺影響重點 / 萬一不滿意的 revert 指令

### 失誤點（PR #22 實戰）

- ❌ **Phase 1 對映表沒列「rgba 中含空格版」**：漏改 2 檔，user-side 沒發現是
  codex 沒覆蓋的盲區，subagent 看 spec 寫 grep
- ❌ **Phase 1 subagent 把 control bg 也吃進 SURFACE.subtle**：10 處 over-replacement
  → 還原。spec 沒明確區分「panel 容器底」vs「控件互動態背景」語意
- ❌ **Phase 3 codex 卡 23 min**：沒設 timeout 直接跑，hung 在 verifying phase。
  之後改成「5 min 沒回就手動 grep fallback」
- ⚠️ **Phase 0 codex 抓到 fontSize 12px 缺位**：原 scale 從 13 跳 18，audit 顯示
  12px 有 66 use 是真實常用。修成 xs:9/sm:10/base:11/md:12/lg:13/xl:18/xxl:22

### 何時不要分 6 phase

- 元件數 < 20：直接做不分 phase
- token scale 已成熟：只是新增元件用 token，不算 migration
- 純語意修正（如 #ff3b30 → #ef4444）一行改就好


---

## PB-20 — Mini Taiwan Pulse 大主題視覺化：9 phase + 微修迭代

> **觸發**：要為新「能源 / hazard / 醫療」等主題接整套（後端 RPC + 前端 layer + 互動 + 鐵則對齊）
> **實戰來源**：能源 MVP v1.0~v1.3.5（PR #23 + #10）

### 大框架：9 phase（第一次接，做完就能 ship 看到畫面）

| Phase | 工作 | 預估 commit |
|---|---|---|
| **A** | gis-platform 寫所有 RPC + apply Supabase + EXPLAIN ANALYZE 驗證 < 1s | 4-6 commit |
| **B** | mini-taiwan-pulse types/index.ts 加 LayerVisibility key + xxxLoader.ts 寫 fetcher + 顏色/分級 const | 1 commit |
| **C** | overlayRegistry 加 2D POI（dynamicData=true） + useXxxLayer hook + setData on style.load | 1 commit |
| **D** | 3D Scene + CustomLayer（按需）：blending 還原 + dispose + frustumCulled=false | 1 commit |
| **E** | HUD / KPI 卡 + App.tsx 接線（pitch 警示給用戶看 3D 要傾斜地圖） | 1 commit |
| **F** | 第二輪 3D（例如 beam）— InstancedMesh + setColorAt 不 pre-alloc + lerp | 1 commit |
| **G** | layerCatalog SECTIONS 新分組 + LAYER_COLORS + IconRailSidebar LAYER_ICONS + LegendPanel sub-component | 1 commit |
| **H** | featureInfo PANEL_REGISTRY + HEADER_LABELS + useMapInteraction GIS_LAYERS | 1 commit |
| **I** | npx tsc -b + vitest run + ratchet baseline 對齊 | 1 commit + status doc |

### 微修迭代（v1.x）— 用戶 review 後幾乎一定會有

| 類型 | 範例 | 教訓 |
|---|---|---|
| 視覺微調 | beam radius 粗 → 細 → 更細 → 回粗 | **每次改 radius 一定要在 zoom 5 + zoom 12 + zoom 19 三個視角都看一次** |
| 標籤命名 | 「電廠 10,665」→「電廠」 | 跟其他 layer 對齊；數量寫進 popup 不寫在 sidebar |
| Sidebar 結構 | KPI 性質 layer 從 sidebar 移除 → monitor | LayerVisibility key 留下，hooks/scene 保留供 monitor 整合複用 |
| Bug 修 | popup 點不到（OSM 興達 vs 政府興達不同點）| RPC plant_name 前綴 LIKE，前端不卡 source 條件 |
| 性能 | 10,665 row payload 每次 scrub 重抓 | 寫 slim RPC（14 行 ~3KB）+ 24h preload + client binary search |
| 鐵則對齊 | 4 layer 都要 opacity slider + expandable | ratchet test 會擋，baseline 必須移除 |

### 失誤點（能源 MVP 實戰）

- ❌ **HANDOFF unit_name JOIN 公式錯**：寫 `SPLIT_PART(name, '#', 1) = plant_name`，真實是 `{廠名core}{機型}#{編號}`，要 prefix LIKE 才對。下次寫 RPC 前**先抽 5 筆 raw 跑 SELECT** 驗 JOIN 規則
- ❌ **VIEW 含 polygon 沒檢查**：`all_power_plants_v` 36 個 MultiPolygon → ST_X 炸。後續所有 RPC 用 `ST_X(ST_Centroid(geom))` 兼容
- ❌ **isStyleLoaded race 第二次踩**：2026-04-22 水庫圖層 pitfall 早就記錄，但寫 energy beam 時沒讀。卡 4 輪才回想（詳見 PB 末尾觸發詞 + INCIDENTS 2026-06-18）
- ❌ **InstancedMesh 預先 alloc instanceColor=0 卡 shader define**：所有 instance 畫成黑色。**不要 pre-alloc，用 setColorAt 自動配置**
- ❌ **CylinderGeometry openEnded 預設 false**：用戶 zoom 進柱位置時看到黑色圓盤蓋。**openEnded=true 是預設選項**
- ⚠️ **每次視覺改動只看單一 zoom**：v1.3 改 BEAM_RADIUS 0.00006→0.00002（只在 zoom 12 試），zoom 5 視角下每柱 < 1px → 用戶看不到 → 卡一輪才發現

### 觸發詞（下次自動跳到 PB-20）

「能源 / hazard / 第二波 / monitor 整合 / 新主題視覺化 / 多 RPC + 多 layer + popup + sparkline」

---

## PB-21 — git rebase 自動拋棄 already-in-upstream commit（PR squash 後安全同步）

> **觸發**：PR 已 squash merge 後，本地 master/main 有「PR 之前還沒 push 的舊 commit」，pull --ff-only 拒絕快轉

### 為什麼會發生

GitHub PR squash merge 把 feature branch 的**最終檔案狀態**整套寫進 master 一個 commit。如果 feature branch 是從「本地 master + N 個未 push commit」分出去的，那這 N 個 commit 的檔案變動都被 squash 帶進 origin/master 了。

本地 master 上「N 個 commit」跟 origin/master 上「1 個 squash commit」**內容已重疊**但 hash 不同 → git 視為 diverged。

### 安全同步 SOP

```bash
git fetch
git rebase origin/master
# 結果：
# "拋棄 XXX -- 修補檔的內容已在上游"  ← git 自動偵測重複，乾淨拋棄
# "自動合併 INCIDENTS.md"
# "衝突（內容）：合併衝突於 INCIDENTS.md"  ← 兩邊都 append 到檔尾才會發生
```

對衝突的 commit 用 `git rebase --skip`（如果 conflict 內容你方那邊是空的 = upstream 已有完整版）。

### 為什麼這安全

- **non-destructive**：本地 commit 還在 reflog 裡 30 天
- 拋棄是 **git 對比 patch 內容**，不是粗暴 reset
- 若有 commit 沒被拋棄（真新內容）會 cherry-pick 上 origin

### 失誤點

- ❌ 直接 `git reset --hard origin/master`：本地未 push commit 永久消失（reflog 90 天但難找）。**禁用**
- ❌ `git merge origin/master`：產生額外 merge commit，git log 多分叉

### 預檢查（rebase 前）

```bash
# 看本地領先什麼
git log --oneline origin/master..master
# 看 origin 領先什麼
git log --oneline master..origin/master
# 工作區乾淨嗎？不乾淨先 git stash
git status -s
```

### 觸發詞

「PR merge 完本地拒絕 fast-forward / 本地有舊 commit / 拒絕快轉 / 安全同步」

---

## PB-22 — 新增 POI 可達性分析（accessibility-analysis SKILL 入口）

> 完整 SOP 在 `.claude/skills/accessibility-analysis/SKILL.md`（10 章 + 4 個 references）。
> 本 PB 只列**入口流程**，避免在兩處同步維護。

### 何時觸發

- 用戶說「30km 路網可達」「最近 X 站」「服務範圍」「沙漠」「孤島」「等時圈」「isochrone」
- 新增任何 POI（加油 / 醫療 / 消防 / 充電 / 警消 / 學校）做「離 POI 多遠」分析

### 4 步入口

1. **invoke SKILL**：用 Skill tool 開 `accessibility-analysis` 或 `service-coverage`
2. **讀 §⚠️ 兩大鐵則**（multi-bucket / whitelist）— 任何分 layer 的 bucket 邏輯必過
3. **讀 §🚨 troubleshooting.md** — 跑前 30 秒健康檢查
4. **clone scripts/pipeline-template.py 改 SQL + bucket** → 跑 → swap PMTiles → 前端 11 處 SOP

### 三模式記憶（從問題選 mode）

| 問題 | Mode |
|---|---|
| 「最近站幾 km」 | A — 路網染色 LineString |
| 「服務範圍是哪一片」 | B — Polygon 沿路網外殼 |
| 「沙漠在哪 / 跨服務疊圖」 | C — Hex / Grid |
| 多個都要 | A + B + C 疊圖 |

### 已落地案例（reference）

- **Mode A**：加油站 / EV 30km coverage（本 session，commits 702e382→17c148b）
- **Mode B**：fire isochrone 救援等時圈（`fetch-fire-isochrones.py`）
- **Mode C**：medical isochrone grid_accessibility（`pipelines/poi/medical/isochrone/`）

### 失誤點（→ INCIDENTS 2026-06-22）

- ❌ 用 SQL CASE 分 bucket：雙身分 POI 漏歸（73 個台糖站漏掉）
- ❌ 用 NOT IN 反向定義「其他」：吸入 374 個 41455 false positive
- ❌ osmnx + 全台 bbox 沒 fallback：Overpass mirror 卡時整 pipeline 卡死

### 觸發詞

「30km 可達 / 最近站 / 等時圈 / isochrone / 路網覆蓋 / 服務範圍 / 服務沙漠 / 孤島 / 補點 / 擴點選址 / 競爭者疊圖」

## PB-24 Isochrone × Overlap Count 全流程（2026-07-01 加）

> 用於「N 個 station 每個都跑 isochrone，看多站重疊區顏色深淺」。
> reference：警察 3 層級（派出所 1541 / 分局 163 / 縣市警局 32）× 步行/開車 × 5/10 min（或該層級對應）= 12 變體 → 3 個 combined PMTiles。

### 何時觸發

- 「N 個服務站的重疊服務範圍」— 多重保護區、警力沙漠、消防重疊區
- 「不同層級的可能覆蓋範圍蝶圖」— 3 層機構各自 isochrone
- 「重疊越多顏色越深」= service coverage overlap count / service redundancy

### 5 檔 pipeline（`taipei-gis-analytics/pipelines/police_justice/isochrone/`）

**架構（2026-07-02 PI-1 收尾後定型）**：Stage 1 只出 raw per-station polys（不 dissolve），Stage 2 全域 dedup + 全域 dissolve。禁「per-region dissolve → concat」（會產生同片區域多 count 疊層）。

| 檔 | 職責 |
|---|---|
| `10_police_isochrone.py` | 主 script：pyrosm 讀 PBF → per-station ego_graph → concave_hull(0.5) + buffer 15% + simplify。**`--polys-only` mode 只出 raw per-station polygons（每 feature 帶 `entity_id + station_name`），檔名 `*.polys.geojson`**。全 mode 才走完整 polygonize + dissolve。`--mode-filter walk/drive` 搭配 `--all` 只跑指定 mode 變體。`station_polygon()` 加 500m 閾值 fallback（山區離線 station → 圓 buffer at station 座標） |
| `15_run_by_region.sh` | 分 5 區跑（north/north2/central/south/east）— 全台 walk graph 6M nodes OOM 的救援；每區跑 `--all --polys-only`，mv `*.polys.geojson` 到 `by_region/{name}/`。**不做 dissolve** |
| `16_merge_regions.py` | Concat 5 區 raw polys → dedup by entity_id（overlap 帶 station 兩區都跑到，dedup 保留一次）→ 呼叫 `mod.dissolve_polys_to_final()` **全域 compute_overlap_count + dissolve** → 產最終 `police_iso_{tier}_{mode}_{min}min.geojson` |
| `20_merge_combined.py` | 同 tier 4 變體（walk 5/10 + drive 5/10）合進 1 個 combined GeoJSON（每 feature 帶 `tier + mode + minutes + overlap_count`），前端用 case fill-opacity 按 mode/minutes 切、不換 sourceUrl |
| `25_to_pmtiles.sh` | tippecanoe 產 3 個 combined PMTiles：`-Z4 -z14 --coalesce-densest-as-needed --no-tile-size-limit -y overlap_count -y mode -y minutes` |

### 前端接線 pattern

- 3 個 layer（每 tier 一個）鎖固定 combined PMTiles
- **不切 sourceUrl**：case fill-opacity 讀 `mode + minutes` properties + `${id}Mode_drive` (0/1) / `${id}Minutes_num` params 互斥顯示
- **必配 dissolve**：沒 dissolve = 幾萬 fragment 切碎 + 同心圓錯覺；有 dissolve = N 個乾淨階梯 MultiPolygon
- **line-opacity ≤ 0.08**：避免 multipolygon 內部 ring（單站 hull 邊界）畫出來造成同心圓

### 三段演化的教訓（→ INCIDENTS 2026-07-01）

- convex_hull → 過度膨脹三角形鋸齒
- concave_hull(0.3) → 26,644 micro fragments
- concave_hull(0.5) + buffer + **dissolve by overlap_count** → 73 features 乾淨階梯

### 已知限制 / 已收尾

- **PI-1 收尾（2026-07-02）**：區界斷裂修好（改架構：per-region raw polys → 全域 dedup + dissolve），山區偏移修好（500m 閾值 + fallback 圓 buffer）
- **PI-2 open**：離島 60 顆 substation 無 isochrone（澎湖 27 / 金門 6 / 馬祖 3 / 綠島 1 / 恆春 2 / 本島邊界 3）— 主島 bbox 排除，需另抓離島 OSM PBF
- **PS-1 open**：`police_stations` upstream geocode bug（綠島分駐所座標 26.22 位於馬祖，屬 taipei-gis-analytics 上游）

### 觸發詞

「N 站重疊 / 覆蓋計數 / overlap count / service redundancy / 多重保護 / 警力沙漠 / 蝶圖 / N 分鐘可達且重疊多」

## PB-25 混亂分支拆乾淨 → 依序 PR 併回 master（2026-07-02 加）

一條分支混了多個 feature（bloom + 派出所 sidebar + 大量 memory）要拆成乾淨 PR 時：

1. **先盤點不動手**：`git log --oneline master..<branch>` 看 commit 組成，判斷每個 commit 屬哪個 feature；`git diff --stat master <branch> -- <path>` 確認哪些檔已在 master（避免重複 / 遺失）。
2. **確認已併的別重做**：feature code 可能早已透過別的 squash PR 進 master（commit 看似「領先」但內容重複）。用 `git grep -l <代表 key> master -- src/` 驗證 feature 是否已在 master。
3. **舊分支改名備份**：`git branch -m feat/X feat/X-OLD`，再從 master 切乾淨 `feat/X`。
4. **topic-scoped cherry-pick**：每個 feature 的 commit 各自 cherry-pick 到乾淨分支。commit 若各自 scope 清楚（bloom commit 只動 bloom 段），衝突少。
5. **依序 merge + 每次同步 master**：`gh pr create` → `gh pr merge --squash --delete-branch` → `git checkout master && git pull` → 下一條 rebase 到新 master。共用檔（layerCatalog/App/types）的衝突在此逐一解。
6. **memory commit 直接 cherry-pick**：純 memory/docs 的 commit（append-only）通常乾淨 cherry-pick，不同 section 不衝突。
7. **清理**：`gh pr merge --delete-branch` 連本地也刪；stale 分支確認 content 在 master 後 `git branch -D`；worktree 分支（`+` 前綴）不動。

本次：climate/bloom/police 三條乾淨併回，衝突只 2 個（useMemo deps 陣列合併 + layerConsistency baseline 補 glow 層），全綠 merge。

### PB-26：契約檔解耦的多 agent 平行派工 + orchestrator ground-truth 審查（2026-07-03）

**情境**：功能可切成互不相交模組（如 BYOK 對話 = UI 層 + 邏輯層 + tools），想平行派多 agent 加速又避免衝突。

**SOP**：
1. **先定契約檔**（如 `src/chat/types.ts`）：介面 + 依賴注入點（MapBridge/RunChatTurn/KeyVault），標「不可改」。
2. **切互不相交檔案集**派工，任務書明列禁區（對方領域 + 契約檔 + 不 commit）。可混模型：UI/機械用 Sonnet、複雜/安全用 Opus。背景平行跑。
3. **orchestrator 審查鐵則**：不信 agent 自述 → 自己 `tsc -b`+`pnpm test` 獨立重跑 + 關鍵面 grep（key 洩漏/token 合規）+ 安全類做 psql/curl ground-truth 實查。
4. **整合階段單獨派**：接線 App.tsx（唯一交會點）+ 修審出瑕疵，agent-browser 截圖驗收。
5. **收尾**：feature 四件組 → 分批 atomic commit → rebase 最新 master 重驗 → PR（模板）→ squash。

**⚠️ 血淚教訓（2026-07-03）**：orchestrator 若把「規劃描述」誤當「已執行」，會累積幻覺——聲稱做完 DB 修復/migration/CI 修復實際沒發生。**每個「已完成」節點必有工具輸出佐證**（git/psql/curl/gh api），收尾時務必 ground-truth 複查全部聲稱。

**跨 repo 順序（會員/安全類）**：gis-platform migration 先（psql 套用+實測+commit，加 to_regclass 守衛）→ 前端後接（worktree 先 reset origin/master）→ Dashboard 手動項（OAuth provider/Exposed schemas）用戶做 → CI/部署確認查 check-runs。

**踩過的坑**：pnpm worktree 加依賴 CI npm ci 掛（`npm install --package-lock-only`）；worktree 缺 gitignored public/ 資料（rsync 補）；捏造表名的 migration 會全新套用 ERROR（加 to_regclass 守衛）。

### PB-27：靜態層讀取去 DB 化（static-to-cdn 遷移 SOP，2026-07-04）

**情境**：某圖層資料靜態（月更或更慢）卻走 Supabase RPC → 開多層擠併發排隊出現暫態空窗；且多人各自打同一份 = DB 讀取 O(N)。要搬去 CDN 靜態檔（O(N)→O(1)）。

**判斷候選**：param-less（或 DEFAULT NULL=全量）+ 資料月更以下 + 非時序/realtime。用 psql `pg_get_function_arguments` / `pg_get_function_result` 探參數與回傳型別（table vs jsonb）。

**SOP**：
1. **匯出腳本** `scripts/export/export-static-rpc-snapshots.sh`：psql 把 RPC 輸出**原樣**存 `public/static-rpc/<rpc>.json`（table→`SELECT jsonb_agg(t) FROM f() t`；jsonb→直接 `SELECT f()`）。清單 append 一行即可。
2. **前端 helper** `src/data/staticRpc.ts`：`staticRpc(name)` fetch `/static-rpc/<name>.json`，回傳形狀同 `supabase.rpc`（error 型別 `{message}|null`），**404 / parse fail 自動 fallback 回真 RPC**（rollout + 部署過渡期 HTML→json 失敗都安全）。
3. **swap loader**：`supabase.rpc("X")` → `staticRpc("X")`（一 token，transform/popup/legend/cachedOnce 全不動）。
4. **參數化層**（per-city/type）：改「cachedOnce 抓全量 + 記憶體 filter」；filter 欄位**讀 migration 確認**（p_city→回傳哪欄）。**⚠️ 全量太大者不搬**（waste_stops 193k/56MB，且無參 fallback 打全表撞 pooler 2min timeout）。
5. **deploy 鏈**：nginx `location /static-rpc/ { root /data; }`（純鏡像無 SPA fallback → 缺檔回 404 供 staticRpc fallback）；upload/pull 用鏡像子前綴（比照 `/agriculture/`，整夾 sync，加檔零改腳本）；`.gitignore` 加 `public/static-rpc/`。
6. **驗證三關**：`tsc -b` + **psql 對數驗證**（客戶端 filter 筆數 = RPC 帶參筆數，每層抽 1-2 參數）+ **冷載 browser**（reload 清 cache → 開多層 → fetch 攔截確認打 /static-rpc/ 非 rpc）+ **prod curl**（真檔 size、缺檔 404）。
7. 上 S3 → PR → CI 綠 → squash merge → poll prod 部署（/static-rpc/ 供真檔）。

**成效範本（本次）**：25 層搬 CDN（最大 fossil_fuel_layers 9.5MB），BC-8 settle 16s→2s。多 agent 分工：主 agent 定 pattern + 電網 pilot 冷載驗證，delegate batch（廢棄物重構帶 psql 對數 gate），信任 subagent push-back（stops 56MB 判斷不搬）。詳見 [[incidents]] 2026-07-04。

## PB-28：worktree 隔離拆分混合工作區成多 PR（2026-07-07）

情境：單一工作區同時堆疊多份未 commit 工作（owner-gated + pollution + 主題化 + docs WIP），改到同幾個檔案、hunk 交錯，要拆成各自乾淨的 PR。

SOP：
1. **hunk 分類**：`git diff <混合檔>` 拆 hunk，按關鍵字自動分類（Python 腳本：每份工作的特徵詞 → OWNER/POLL/…），無法自動判的人工看 added 行。⚠️ **import 區最易行級混合**（大家往同一 import block 加行），hunk 級歸類會誤判（如 Biohazard pollution icon 混進 owner import）→ 要看 added 行實際內容，必要時行級拆。
2. **純檔整檔 diff + 混合檔選定 hunks** → 生成 per-work patch，驗證「各 patch hunk 數相加 = 原始，無漏無重疊」。
3. **worktree 隔離驗證**：`git worktree add -b <branch> <path> master` + symlink node_modules + `git apply <patch>` + copy untracked → **tsc -b + pnpm test 在隔離 worktree 跑**（確認該份工作自足、不暗依賴其他份）→ commit + push + PR。原工作區完全不碰（保護用戶其他 WIP）。
4. **merge 後 sync**：備份要保留的 WIP patch → `git reset --hard origin/master`（清已 merge 的，untracked 保留）→ apply 回 WIP patch。⚠️ 大檔（pmtiles >100MB）走 S3 + gitignore，不進 git。

成效：owner-gated / pollution / lock_type 三份各自乾淨 PR（#60/#61/#62），GitHub 判無衝突（拆分不重疊），原工作區的主題化 + docs WIP 全程零觸碰。

## PB-29 大批次 layer 平行分工（2026-07-24 定型：觀光 12 層；前例公共設施 8 層）

適用：一次上 ≥8 個同主題 layer（單線串行太慢、多 agent 同檔會撞）。

1. **偵察先行（平行 2 agent）**：① 接線 recipe——拿最近一批同型 PR 的 `git show --stat` 當檔案清單基準 + 各 registry 結構/行號；② 資料驗收——feature 數/欄位/座標系對 handoff 契約 + **node strict-JSON 驗證**（見 PRINCIPLES）
2. **規格書釘死共用識別字**（orchestrator 自寫單一 SSOT 檔）：layer key / sourceId / mapbox layer id（`${sourceId}-${suffix}`）/ 參數名 / 分色 hex / 特殊行為。實作 agent 一律照表不可自創
3. **3 工作包按「檔案集合互斥」切**（可全平行）：骨架（types / layerCatalog / LAYER_ICONS / upstreamRegistry）｜核心渲染（overlayRegistry + useTransportParams）｜互動（*Panels.tsx 新檔 + featureInfo registry + useMapInteraction + LegendPanel + layerConsistency baseline）。跨包型別耦合（FeatureInfo union 等）指定給單一包，其他包用釘死名字
4. **包級 tsc gate**：平行中全量 tsc 必互紅，prompt 寫明「錯誤不指向你的檔即可」；orchestrator 收齊後跑全量 tsc + pnpm test + 接縫抽查（參數名 / click id / 圖例 hex 三處對齊）
5. **browser 驗收**（agent-browser 8 條坑照全域 memory）：All Off 起手、逐層 queryRenderedFeatures + popup + 參數面板、旗艦層特殊行為逐項驗

成效：觀光 12 層一天 spec→merged（PR #82），3 包零檔案衝突、ratchet 全綠；browser 驗收揪出 Infinity 資料 bug（tsc/vitest 抓不到的類型）。

## PB-30 排版沙盒 → monitorLayout.ts 換版流程（2026-07-26 定型；2026-08-10 九版大改）

監看模式版面 = 資料驅動，`monitorLayout.ts` 為 SSOT（相容 react-grid-layout `layout` 格式）。

⚠️ **沙盒原始碼在 repo：`docs/features/monitor-grid-static/sandbox.html`**
（= artifact `f5d75312-…` 的來源）。**改沙盒一律改這份再重新發布**，
發布時帶 `url` 參數更新同一個 artifact，別在對話裡重寫一份 —— 2026-08-02~10
就是因為它只活在 artifact 上而漂掉兩個版本（見 INCIDENTS 2026-08-10 事件 A）。

1. 改 repo 的 `sandbox.html` → 用 `url` 重新發布 → 用戶拖拉 / 縮放 / 勾隱藏 → 「複製 JSON」
2. 貼回 → **只換** `MONITOR_LAYOUT` + `MONITOR_HIDDEN`，JSX 零改動；
   hidden 的 widget 保留在對照表可隨時勾回（histogram 案例）
3. **逐格比對**（換版必跑）：抽出沙盒 `<script>` 成 `.js`，比對 restored preset 的
   `L("id",x,y,w,h)` 與 `MONITOR_LAYOUT` 的 `{ i,x,y,w,h }`，全對齊 + 無重疊 + 未超 12 欄才算過。
   widget 清單有變 → **沙盒 `STORE_KEY` 必須換版號**，否則舊 localStorage 快照缺新 id，
   還原時會被塞到 (0,0) 疊在別人身上
4. HMR 即時生效 → agent-browser 量測 + 截圖（見下方第 6 點）
5. **高度政策二選一**（九版起，欄位是 `fit?: "content"`）：
   - **資訊卡** → `fit: "content"`：高度跟內容走、不留白不格內捲，下方 widget 順勢下移。
     這類 widget 的 `h` **不再是高度**，只是拆解與同欄排序的佔位值
   - **清單／影音類**（新聞 Feed／警報／時間軸／熱區／信號分級）→ 不標，吃 `h` 當固定高 +
     格內捲。**必須固定**，否則會被幾百筆內容拉成無限長
   - 機制在 `monitorPacking.ts`：座標先 guillotine 切成欄／列巢狀結構，欄內用 flex 直向流。
     CSS grid 的列跨欄共用，做不到「這格長高、下面的推下去」
6. **格高與圖表高度一律開實機量，不要估**：
   `document.querySelectorAll('[data-widget]')` 逐格比 `scrollHeight` vs `clientHeight`。
   ⚠️ 這只抓得到「溢出」，**抓不到「塌陷」** —— auto 高度容器裡另外量關鍵子元素
   （例：柱狀圖量「120 根柱子有幾根高度 0」）。截圖要確認**真的拍到目標區塊**，
   不是只拍到它的標題（見 REFLECTIONS 2026-08-10）
7. widget 內容不隨格高展開時（非 fit 的固定高 widget）套統一模式：
   根節點 flex column + height:100%、圖表區 flex:1 + minHeight:0、固定列 flexShrink:0
   （TimelineDock / 直方圖 / AlertBoard 皆此修法）。
   ⚠️ **`fit` widget 不適用這條** —— 父層無確定高時 `flex:1` 分不到東西，
   圖表要寫確定像素高（PLA 趨勢 190 / 食品走勢 140，皆實機量過），
   且百分比高度會塌成 0（見 PRINCIPLES「auto 高度容器的兩個尺寸陷阱」）
8. 常數：ROW_HEIGHT 40 / GAP 10 / 堆疊斷點 1100px（容器實寬非視窗寬）；
   非 fit 的 cell 高 = h×40+(h-1)×10；**堆疊模式 cell 必設 flexShrink:0**
   （flex column 子元素不設會被壓縮塞進容器而非溢出捲動），
   fit widget 在堆疊模式也要 `height:auto` 否則窄螢幕退回死白

成效：v1→v5 每輪 <10 分鐘（七版前）；八/九版含機制重寫仍在同一 session 內完成並上線（PR #121）。

## PB-31 raster PMTiles 值編碼圖層（2026-07-31 定型：canopyHeight + urbanHeat 兩例）

單/雙分量連續值 raster 上地圖的標準流程（完整方法論：analytics `docs/topic-research/remote_sensing/urban-heat-lst-methodology.md` §7）：

1. **上游烤磚**（taipei-gis-analytics）：GeoTIFF → 值編碼 RGBA（R=量化數值、G 可放第二通道、A=nodata mask）
   → `gdal_translate -of MBTILES TILE_FORMAT=PNG BLOCKSIZE=512` → `gdaladdo -r nearest`
   （⚠ 值磚金字塔必 **nearest**——average 會把 nodata 的 DN=0 平均進來，海岸/雲洞長出假值邊）
   → `pmtiles convert`。範本：`pipelines/environment/urban_heat_lst/tile_lst_pmtiles.sh`、`pipelines/forestry/canopy_height_meta/tile_canopy_pmtiles.sh`
2. **量化參數**：`DN = round((值 − offset) × scale)`，值域用**該資料實際分布** P2–P98 訂（勿沿用試作版——POC 值域拿到全島 69% 像元貼地板）；寫進 `encoding.json` + handoff（前端硬編 mix 的契約源）
3. **前端接線**（pulse）：overlayRegistry raster config（`pmtiles.minzoom/maxzoom` 對齊實際磚層級，z 超過 = 討不存在的磚）+ `raster-color-mix = [物理斜率×255, …, offset]`（見 PRINCIPLES）+ stop 寫物理值 + `raster-color-range` 用通道完整值域；nodata 靠 source alpha 自動透明
4. **多模式切換** = 換 mix 通道 + 色帶 + range（零重載）；色票/值域抽 `src/data/xxxTypes.ts` SSOT，layer 與 legend 同源
5. **驗收**：像素取樣（多點 RGB 彼此相異 + nodata 透明見底圖）+ 拿 canopy 當對照組；大檔 gitignore 走 S3 deploy-assets 三處接線 + upload script glob

## PB-31 圖片型公文轉錄（走訂閱額度、不打 API）

適用：來源機關把內容做成圖片（掃描件 / 版面圖 / 表格圖），網頁無文字可解析。
2026-08-02 共機通報圖片版時代（~2025-02-02 以前 185 天）實證，185 份全數解析成功、
中英交叉驗證 0 筆不符。

**核心設計：讓 LLM 只抄字，不判讀數字。**
LLM 抄寫穩、算數與判斷易錯；把數值交給既有的確定性解析器產生，語意才與文字版一致。

1. **備料**（`scripts/*_ocr_prepare.py`）：從 DB 撈待轉錄清單 → 下載圖到本地
   （已存在則跳過）→ 切成每批 20–25 張的 JSON 清單
2. **轉錄**（Claude Code subagent，走訂閱額度）：每個 agent 認領一批，用 Read 看圖，
   **逐字照抄**成 txt。提示詞要明寫：不改寫、不換算、不推測；看不清寫 `[?]` 不猜
3. **套用**（`scripts/*_ocr_apply.py`）：轉錄文字 → **既有 regex 解析器** → UPDATE DB
4. **交叉驗證**：若原件有雙語或重複敘述（如中英對照），比對兩邊數字，
   不一致標記待複核（`source_lang='zh?'`）而非靜默採用；檔名日期 vs 內文日期不符則跳過（防轉錯圖）
5. **原文入庫**：轉錄結果寫進 `raw_text`，未來加欄位可直接重解析，不必再看一次圖

**成本**：純轉錄用不到高階模型；主 context 不受影響（subagent 只回一行摘要）。
**前提**：原件需為印刷體、版型固定；手寫或低品質掃描不適用。

## PB-32 跨 repo 四包依序開 PR 並 merge（2026-08-03 定型）

CLAUDE.md 的鐵則是「上游先動、下游後動」，但實務上常見的狀況是**工作已經 commit
在各 repo 的預設分支上**（開工時就在 main/master）。此時不要直接 push 主幹，
拉回 feature branch 再開 PR，保留可審核紀錄 —— migration 尤其需要。

**順序**：`taipei-gis-analytics`（pipeline）→ `gis-platform`（migration）
→ `data-collectors`（collector）→ `mini-taiwan-pulse`（前端 PR）

**已在主幹的 commit 拉回 branch**：
```bash
git fetch origin -q
git switch -c feat/<slug>            # branch 建在目前 HEAD
git push -u origin feat/<slug>
gh pr create --base <main|master> --head feat/<slug> --title … --body …
gh pr checks <n> --watch --interval 20     # 有 CI 的 repo 一定要等
gh pr merge <n> --rebase --delete-branch   # 多 commit 想保留顆粒度用 rebase
git switch <main|master> && git pull --ff-only
git branch -D feat/<slug>
```

**兩個實測踩到的細節**：
1. `gh pr merge` 之後 gh 會嘗試更新本地主幹，因為本地主幹仍指著 rebase 前的舊 commit，
   會噴「無法快轉，中止」。**不是失敗** —— 接 `git switch <main> && git pull --ff-only` 即可。
2. `git switch <main> -q 2>/dev/null` 若失敗會被吞掉，後面的 `git reset --hard origin/<main>`
   就落在**錯的 branch** 上。切分支不要吞錯誤訊息。

**merge 策略**：多個獨立 commit（如 migration 一支一個）用 `--rebase` 保留顆粒度；
單一 feature 的連續演進（圖層 → 疊加 → 歷史模式 → 戰情板）用 `--merge` 保留整段脈絡。

## PB-33 Zeabur collector 上線與「證明它真的在跑」（2026-08-07 定型：pla_tracks_vectorize + lightning_cwa 兩例）

新 collector merge 後不是「等它自己跑」就好 —— 兩次實戰都在這裡卡過。四步：

**1. 設環境變數**
```bash
zeabur variable create --id <service-id> -k XXX_ENABLED=true --yes --interactive=false
```

**2. 確認生效（關鍵，會騙人）**
```bash
zeabur service exec --id <service-id> -- sh -c "python -c \"import config; print(config.XXX_ENABLED)\""
```
- 若變數是在**運行中的容器**設的 → 回 `False`，**必須 `zeabur service restart`**
- 若變數是在**新部署 build 開始之前**設的 → 部署完直接生效，不用 restart

差別在時序不在指令。**永遠用 exec 進容器讀 config 驗證**，不要看 dashboard 猜。

**3. 確認是新 code 而非舊 image**
```bash
zeabur service exec --id <svc> -- sh -c "python -c \"
from collectors.registry import COLLECTOR_REGISTRY
print(len(COLLECTOR_REGISTRY), any(x.config_prefix=='XXX' for x in COLLECTOR_REGISTRY))\""
```
順便驗重依賴（`import skimage, scipy` / `tesseract --version`）。

**4. 證明它真的產出**（`main.py:99` 啟動時會立即跑一輪，不必等第一個 interval）
- 有事可做時：直接查 DB 看資料有沒有進來
- **沒事可做時（pending=0）heartbeat 不會更新** → 看起來像沒跑。
  這時**故意製造一個缺口**（刪掉 ledger 某一列）再看它會不會自動補回 ——
  這同時驗證了「偵測 → 補跑」的完整迴路，比看 log 有說服力得多
- 或直接 `zeabur service exec` 在容器內跑一次 `collect()`（不寫 DB，安全）

⚠️ 別忘了 `config/cross_layer_map.yaml` 與 `config/realtime_tables.yaml` ——
漏加會讓 CI 紅（`tests/test_cross_layer_sync.py` 三個 ratchet），
且 daily_report 完全不會掃這個 collector。有 `scripts/sync_cross_layer_map.py` 可自動補，
但它填的 `enabled`/`deployment` 是 config 預設值，要依 production 實況人工改。

## PB-34 新增一個 embed 回放圖層（2026-08-08 定型：flights → ships → rail 三次成型）

**前提**：嵌入頁的不變量是「零 Supabase、零 Mapbox 請求」。每一步都在保護它。

**0. 先判型別**（決定後面所有事）
- **軌跡插值型**（flights / ships）：快照存逐點軌跡，引擎插值。日檔隨載具數線性長
- **時刻表推算型**（rail）：快照只存時刻表，位置由幾何推算 →
  幾何抽成**日期無關共用資產**，日檔小兩個數量級

**1. 匯出 case**（`scripts/export/export-embed-snapshot.sh` 加一個 case）
- 量化座標 5 位小數。⚠️ **量化是否無損要實測**，不要假設：
  ships 的驗法是「量化前後 `filterGpsAnomalies` 保留／丟棄數完全相同」
- 產物落 `public/embed-snapshots/<layer>/<YYYY-MM-DD>.json.gz`（檔名含日期 → 可 immutable）

**2. 共用解析模組**（`src/embed/<layer>ReplayData.ts`）
純 TS、零渲染依賴。引擎（`RailEngine` / `TraTrainEngine` / `BusEngine`）本來就不 import
three / mapbox-gl / React，可直接複用；**沒有獨立引擎的（ships/flights，插值寫在 Scene 檔內）
整套搬 Scene 反而免去抽取重構**。

**3. 註冊到 `REPLAY_LAYERS`**（`src/embed/replayLayers.ts`）
這是 base bundle 的 metadata（名稱、資產路徑、是否需共用資產），**不可 import 任何 three 的東西**。

**4. 走 lazy runtime**（`src/embed/replayRuntime.ts`）
three 的**唯一入口**，只能被 dynamic import 觸及。Scene 掛上 `threeReplayLayer.ts`
（maplibre CustomLayer 泛化包裝）。
⚠️ maplibre 的 `render(gl, options)` 第二參數是**物件** →
取 `options.defaultProjectionData.mainMatrix`；取 `modelViewProjectionMatrix` 會**靜默**
把東西投到畫面外約 −54,000px，不報錯。
⚠️ 座標走 `coordinates.ts` 的**顯式引擎注入**（`setMercatorEngine()`），
side-effect 模組要確保求值早於 import graph；未注入即 throw（不 silent fallback）。

**5. 圖例**（`src/embed/…Legend`）
忠實反映渲染語意（見 PRINCIPLES §圖例不憑空發明分類）。
⚠️ 色票放 `src/data/*.ts`，**不要向 Scene 檔取色** —— LegendPanel 是 static import，
會把 three 拖進純靜態 bundle。做完把該層從 `layerConsistency` 的 `BASELINE_NO_LEGEND` 移出。

**6. demo 卡**（`demo-embed.html` 加一張）
挑一個「看得出東西在動」的時間窗。⚠️ **預設 960x 對密集班距太快**：
北捷尖峰班距只剩 0.2 牆鐘秒、高雄輕軌 4.3 秒繞完一圈 → 糊成一團看不出疏密，
這類卡片要帶 `p.speed=180`。

**7. 實測四項**（缺一不可）
```bash
npx tsc -b                         # ① 型別
pnpm test                          # ② 含 layerConsistency（漏圖例會紅）
pnpm build && grep -c "WebGLRenderer\|InstancedMesh" dist/assets/embed-*.js   # ③ 必須 0
# ④ 瀏覽器近景實測（rail 用 z13.5 確認列車貼軌）
```

**8. 上生產供檔**（S3 → pull → nginx 三處，照 PB-06）
- 含日期的快照 → `expires 1y` + immutable
- 固定檔名的共用資產 → `expires 1d` + public（**不可 immutable**，見 PRINCIPLES）
- **`Content-Encoding` 不要設** —— 線上服務的是 volume 本地檔，S3 metadata 到不了瀏覽器，
  改由前端讀 magic byte（`0x1f 0x8b`）判斷

## PB-35 Retention 搶救：把「快被吃掉的」動態資料轉成保存層（2026-08-08 定型）

**觸發時機**：任何「之後再做」的功能若依賴滾動視窗的動態資料 —— 現在不存，
每過一天就永久少一天。實測 retention：bus / bus_intercity **3 天**、ships / flights **7 天**。

**1. 先算清楚成本再開**
日總量 ≈ 76MB → 月增 2.3GB → 滿一年約 **US$0.69/月**、首年合計 **~US$4.5**。
（對照：讓前端直讀這批檔的 egress 一個月就超過整年儲存費 → 見 PRINCIPLES §保存層 vs 成品包）

**2. 腳本三道防呆**（`data-collectors/scripts/export_daily_trails.py`）
- **`rows=0` 硬性 exit 1** —— 最重要的一條。`get_*_dates` 這類 dates matview 會**謊報**
  （flights 顯示 117 天但 trails 實際只剩 ~9 天，BL-25）→ 不能信「有這天」就當匯出成功
- **today-guard**：當天資料還在寫，只匯昨天以前
- **上傳後 HEAD 驗證** ContentLength，不要 put 完就當成功
- 直連 `live.*_trails_daily` + keyset 分頁（不走 RPC，避 pooler timeout）；
  Arrow **不壓縮**（arrow-js 限制）

**3. 排程時間要看資料何時定版**
排 **02:00 Asia/Taipei** —— 依 summary 表 `refreshed_at` 實測，資料在 **D+1 01:00–01:20** 才定版。
排太早會匯到半成品。

**4. 預設關閉，明確開啟**
`TRAILS_EXPORT_ENABLED` 預設 false：manifest 是 get→merge→put **非原子**，多實例會互蓋。

**5. 立刻回補能救的**
`--backfill N`。⚠️ **只能救 retention 窗內的**，窗外的永久沒了 ——
本次救回 ships/flights 各 8 天、bus 系 3 天；**bus/bus_intercity 08-04、ships/flights 07-30 已救不回**。

**6. 漏跑不會自動補**
`backfill=1` 表示只做昨天。漏掉的一晚**不會自己回頭補** →
偵測靠 Telegram 🧊/🚨、恢復靠手動 `--backfill N`。
