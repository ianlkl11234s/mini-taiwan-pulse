# live.* RLS anon-only → 登入會員半殘站三週（2026-07-26）

## 症狀

登入 Google 會員後，監看模式幾乎所有面板變空：TAIEX 空、CDC 週報空、急診「載入中」、在監「載入中」、機場 0/0、能源儀表「資料更新中」。**反直覺的線索**：owner-gated 的機組出力（`get_ssot_facility_output_24h`）反而登入後才有資料。未登入（anon）一切正常。

沒有任何錯誤訊息——RLS 對「無 matching policy 的角色」是**靜默回傳 0 筆**，不是 401/403。前端只看到永遠的 loading / 空狀態。

## 根因鏈

1. 2026 春季（migration 142/145/204/206/258/259…）：`realtime.*` 各表建立時 policy 寫 `CREATE POLICY … FOR SELECT TO anon USING (true)`。**當時系統 anon-only，沒有登入功能，這樣寫沒有錯。**
2. 2026-07-03（migration 270）：Supabase Auth 會員系統上線，`authenticated` 角色第一次有意義。**沒有人回掃既有 ~48 條 anon-only policy。**
3. 2026-07-24（migration 312-317, PR #88）：`realtime`→`live` schema 搬遷 + 兩輪安全清理。**315 的掃描依據是 Advisor lint 0013「rls_disabled_in_public」——只抓 RLS 沒開的表**；這批表 RLS 早已 enabled（只是 roles 不完整），兩輪都掃不到。315 對別的 schema 用的正是正確寫法 `TO anon, authenticated`，證明團隊知道 pattern，是掃描盲區不是知識缺口。
4. 監看模式 RPC 多為 `SECURITY INVOKER`（用呼叫者身分讀表）→ 登入者的 JWT 是 authenticated → RLS 靜默 0 rows。`SECURITY DEFINER` 的 RPC（get_source_health / get_news_trending）不受影響——這解釋了「部分面板正常」的混亂表象。

## 診斷法（三步定罪）

```sql
-- 1. 直接模擬兩種身分（勝過讀 policy 定義猜行為）
SET ROLE anon;          SELECT count(*) FROM live.er_hospital_current;  -- 59
RESET ROLE;
SET ROLE authenticated; SELECT count(*) FROM live.er_hospital_current;  -- 0 ← 定罪
RESET ROLE;

-- 2. 掃出全部受害 policy
SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies
WHERE schemaname='live' AND roles::text='{anon}';   -- 48 rows

-- 3. 由現場生成修復 SQL（不手抄，避免 typo/漏網）
SELECT format('ALTER POLICY %I ON %I.%I TO anon, authenticated;',
              policyname, schemaname, tablename)
FROM pg_policies
WHERE schemaname='live' AND roles::text='{anon}' AND cmd='SELECT'
ORDER BY tablename, policyname;
```

## 修復（migration 318）

48 條 `ALTER POLICY … TO anon, authenticated`——**純加法**：`USING (true)` 不動、anon 行為零變化，只擴大套用角色。單一交易；回滾 = 逐條改回 `TO anon`。apply 前後照 314/315 慣例跑 SET ROLE 對照（anon 前後不變、authenticated 從 0 恢復 = anon）。

## 防復發（已入 PRINCIPLES「RLS policy 角色完整性」）

- 新表 policy 一律 `TO anon, authenticated`（或 `roles={public}`，reservoir_* 是現成範本）
- **新增身分角色上線 = 必須回掃全 schema 既有 policy roles**（這次的洞就是 270 上線時沒回掃）
- lint 驅動清理要核對 lint 的涵蓋類別；「RLS 已開但 roles 不完整」沒有現成 lint，要自己用上面第 2 步的查詢掃
- 登入態 bug 第一反應：SET ROLE 模擬兩種身分,比對 count
