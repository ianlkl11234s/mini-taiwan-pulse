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
