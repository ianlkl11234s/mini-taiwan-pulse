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
