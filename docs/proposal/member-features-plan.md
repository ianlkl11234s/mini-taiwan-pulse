# 會員功能規劃 — 會員面板 + 收藏 + 上站統計（M 系列）

> 2026-07-03 拍板。本檔細化 [`member-byok-chat-plan.md`](./member-byok-chat-plan.md) §6 / BACKLOG BC-2，
> 並新增「上站統計」（原文件未涵蓋）。BC-2 的 chat_logs / 對話歷史跨裝置維持原規劃，排入 M-P1。

## 0. 一句話結論

加一顆會員 icon（IconRailSidebar activePanel 模式）+ 面板三件事：**個人卡（含上站統計）、
視圖快照收藏、（M-P1）對話歷史**。DB 走 migration **273**（member_visits）+ **274**（user_favorites），
RLS/GRANT 照 270 的防自改模式。

## 1. 現況與前置

| 項目 | 狀態 |
|---|---|
| BC-1 會員 P0（Google OAuth + profiles + UserAvatar） | ✅ done（PR #52，migration `270_member_profiles.sql`） |
| BYOK 對話（MapBridge / chatStore / ChatPanel） | ✅ done（PR #51） |
| ⚠️ 主 checkout master | **落後 origin/master**（#51/#52 由 `-auth` worktree 併入），開工先 `git pull` |
| ⚠️ migration 號 | 271/272 已被 RLS lockdown 用掉 → 本計畫用 **273/274** |
| 上線硬前置 | BC-4（OAuth 正式網域 + 隱私頁）必須先於會員功能公開 |

## 2. 功能分期

### M-P0（約 2-3 天，對應原 P3 估時）

| ID | 項目 | 內容 |
|---|---|---|
| M-1 | 會員面板 icon | IconRailSidebar 加 `"member"` panel + MemberPanel；手機 LayerSidebar 對應 |
| M-2 | 視圖快照收藏 | `user_favorites` CRUD + 快照 schema v1 + 存/還原（還原 v1 套圖層/相機/時間三塊） |
| M-3 | 上站統計 | `member_visits` 天粒度表 + `bump_member_visit` RPC + 面板顯示「累計 N 天 / 連續 M 天」 |

### M-P1

| ID | 項目 | 內容 |
|---|---|---|
| M-4 | 對話歷史跨裝置 | chat_logs migration + 寫入 + 面板「我的對話」區（原 BC-2 範圍） |
| M-5 | 預設視圖 | 收藏可設「登入後自動還原」（`user_favorites` 加 `is_default boolean`，一人一筆） |
| M-6 | overlayParams 還原 | overlayParams bulk setter（v1 快照已存全量，補還原入口即可） |

### M-P2+（延後）

- tier / 站方免費額度（原 P4 / BC-7）
- 收藏轉公開分享連結（涉及匿名讀取權限，另議）

## 3. DB 設計（gis-platform）

### 3.1 `273_member_visits.sql` — 上站統計

**拍板：天粒度表，不用 profiles counter 欄位。** 理由：
1. 同日重複呼叫 upsert 不增量 → **天然防灌水**（counter 欄位 + RPC 仍可被狂 call 灌大）
2. 免費算出「累計天數 / 連續天數」，未來可做月曆熱圖
3. 一人一年最多 365 列，量可忽略

```sql
CREATE TABLE public.member_visits (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, visit_date)
);

ALTER TABLE public.member_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_visits_select_own ON public.member_visits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 照 270 模式：先 REVOKE 再最小授權；寫入不開放給前端（只能走 RPC）
REVOKE ALL ON public.member_visits FROM anon;
REVOKE ALL ON public.member_visits FROM authenticated;
GRANT SELECT ON public.member_visits TO authenticated;

-- 寫入唯一入口：SECURITY DEFINER + 冪等（ON CONFLICT DO NOTHING → retry 安全）
CREATE OR REPLACE FUNCTION public.bump_member_visit()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.member_visits (user_id, visit_date)
  SELECT auth.uid(), (now() AT TIME ZONE 'Asia/Taipei')::date  -- 台北時區切日，同 pg_cron 慣例
  WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id, visit_date) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.bump_member_visit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_member_visit() TO authenticated;
```

統計計算放前端：`SELECT visit_date FROM member_visits ORDER BY visit_date DESC`（RLS 自動只回本人，
量小不需 RPC 聚合），client 算累計/連續天數。

### 3.2 `274_user_favorites.sql` — 視圖快照收藏

**與 profiles 相反：INSERT/UPDATE/DELETE 要開放**（使用者自建自刪自己的收藏）。

```sql
CREATE TABLE public.user_favorites (
  id         uuid PRIMARY KEY,                -- ⚠️ 前端 crypto.randomUUID() 生成（見 §5 風險 7）
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  state_snapshot jsonb NOT NULL CHECK (pg_column_size(state_snapshot) <= 16384),  -- 16KB 上限
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_favorites_user ON public.user_favorites (user_id, created_at DESC);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_favorites_own ON public.user_favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.user_favorites FROM anon;
REVOKE ALL ON public.user_favorites FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorites TO authenticated;

-- 每人上限 50 筆（RLS 只管「誰能寫」不管「寫多少」）
CREATE OR REPLACE FUNCTION public.enforce_favorites_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_favorites WHERE user_id = NEW.user_id) >= 50 THEN
    RAISE EXCEPTION 'favorites quota exceeded (max 50)';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_user_favorites_quota
  BEFORE INSERT ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_favorites_quota();
```

### 3.3 RLS / GRANT 模式對照

| 表 | 前端可寫？ | 防護重點 |
|---|---|---|
| profiles（270） | 只有 display_name/avatar_url 兩欄 UPDATE | REVOKE 表級權限防 tier 自改 |
| member_visits（273） | ❌ 只能 SELECT | 寫入走 SECURITY DEFINER RPC，天粒度冪等 |
| user_favorites（274） | ✅ 全 CRUD（RLS 限本人） | quota trigger + snapshot 大小 CHECK |

## 4. 前端設計

### 4.1 快照 schema v1

```jsonc
{
  "v": 1,                                        // schema 版本，還原時判斷
  "layers": ["freeway", "youbikeH3"],            // ⚠️ 只存「開啟中的 key 陣列」，不存整包 boolean map
  "camera": { "lng": 121.0, "lat": 23.8, "zoom": 7.5, "pitch": 45, "bearing": 0 },
  "time":   { "unix": 1751500000, "rangeDays": 1 },
  "params": { "freewayOpacity": 0.8 }            // overlayParams 全量（v1 只存不還原，M-6 補）
}
```

**layers 存 key 陣列的理由（防 schema 腐化）**：`LayerVisibility` 有 200+ key 且持續演進；
還原時 `layers ∩ 現有 keys` 取交集、unknown key 靜默丟棄，舊快照永不炸。

### 4.2 擷取與還原

新檔 `src/lib/viewSnapshot.ts`：`captureSnapshot()` / `restoreSnapshot(snap)`。

| 塊 | 擷取 | 還原 |
|---|---|---|
| layers | `layerVisibility` 中為 true 的 keys | 由現有 state shape 重建整包（全 false + 交集 keys 設 true）→ `setLayerVisibility()` |
| camera | `map.getCenter/getZoom/getPitch/getBearing` | `map.flyTo({center, zoom, pitch, bearing})` |
| time | `timeStore.getTime()` / `getRangeDays()` | 走 useTimeline 同一入口（`timeStore.setTime` 註明僅 useTimeline 呼叫，需對齊；跨日會觸發 `subscribeDate` 重載 → loading UI 自然生效） |
| params | `overlayParams`（已是 flat `Record<string,number>`） | v1 不還原；M-6 加 bulk setter（目前散落幾十個 useState，是唯一要新寫的還原入口） |

可複用 BYOK 的 `MapBridge`（`src/chat/types.ts`）：`bulkSetVisibility` / `allOff` / `flyTo` /
`getVisibleLayerKeys` / `getCurrentTimeISO` 都現成；**`getCamera` 缺 pitch/bearing 要補**。

### 4.3 MemberPanel + 接線點

面板走 **IconRailSidebar activePanel 模式**（非 ChatPanel 浮層模式），改動點：

1. `src/components/IconRailSidebar.tsx`（注意：不在 `sidebar/` 子目錄）4 個點：
   - `PanelId` union（:347）加 `"member"`
   - Icon rail（:453-520）加一顆 `<RailIcon icon={UserCircle} ...>`（lucide）
   - Floating panel（:548-608）加 `{activePanel === "member" && <MemberPanel ... />}`
   - 複用現成 `PanelHeader`（:648）
2. `src/components/LayerSidebar.tsx` 手機端對應（一前端兩 Sidebar 同步改，PRINCIPLES 既有教訓）
3. 新檔 `src/components/member/MemberPanel.tsx`：
   - 未登入：Google 登入鈕（複用 `auth.ts` `signInWithGoogle`）+ 一句「登入可收藏視圖與跨裝置同步」
   - 登入後：個人卡（avatar/名稱/tier + 累計 N 天/連續 M 天）→ 收藏區（「儲存目前視圖」+
     列表：名稱/時間/還原/改名/刪除）→（M-P1）我的對話 → 登出
4. `src/App.tsx` 接線；右上角 `UserAvatar` 可順勢收進面板（或保留，開工時再定）

### 4.4 Loader 規範

新檔 `src/data/memberLoader.ts`：favorites CRUD + visits 讀取，**全部掛 `loadingRegistry`**
（P0 規則：禁止靜默 `supabase.from().then()`）。`bump_member_visit` 是寫入非資料載入，
不掛 loading、失敗靜默（統計非關鍵路徑）。

### 4.5 visits bump 時機

`useUser` 偵測到 signed-in 後呼叫一次 `bump_member_visit()`，module-level flag 防同 session
重複呼叫（DB 端 ON CONFLICT 已冪等，前端 flag 只是省請求）。

## 5. 風險與對策（2026-07-03 盤點）

| # | 風險 | 對策 |
|---|---|---|
| 1 | **快照 schema 腐化**：layer key 半年後改名/刪除，舊收藏還原炸掉 | layers 存 key 陣列 + 交集還原 + `v` 版本欄（§4.1） |
| 2 | **統計自改**：counter 欄位開 UPDATE 會被自灌（同 270 tier 教訓） | member_visits 不開寫入，只走 SECURITY DEFINER RPC；天粒度天然防灌 |
| 3 | **行為追蹤 vs 手動收藏混淆**：自動記錄每次 toggle = 高頻寫入 + 可識別行為個資 | v1 只做手動收藏；`sessionTracker`/`log_session_events` 保持匿名不綁 user_id（GA4 `user_id` 為 2026-06-25 既有拍板，屬另一軌） |
| 4 | **隱私揭露**：收藏內容/上站日期/對話記錄都是會員個資 | BC-4 隱私頁併入「會員資料」段；UI 留刪除帳號入口或聯絡方式（DB CASCADE 已就緒） |
| 5 | **收藏塞爆**：RLS 不擋量 | quota trigger 50 筆 + snapshot 16KB CHECK（§3.2） |
| 6 | **OAuth 網域**：正式站 Site URL/Google JS 來源只設 localhost | BC-4 為硬前置，先於會員功能公開 |
| 7 | **resilientFetch retry × 非冪等寫入**：supabase.ts 韌性層會重試，favorites INSERT 重試 = 重複列 | `id` 由前端 `crypto.randomUUID()` 生成 + upsert → 冪等；bump RPC 已 ON CONFLICT 冪等 |
| 8 | **timeStore.setTime 入口約定**：註解限定僅 useTimeline 呼叫 | 還原走 useTimeline 同一 setter 或 MapBridge 擴充，開工時對齊，不繞過約定 |

## 6. 驗收條件

- [ ] 登入 → 面板顯示統計；同日重整/重登 bump 不增量；隔日 +1；連續天數正確
- [ ] 儲存目前視圖 → 另一裝置登入可見；點擊還原：圖層/相機/時間三塊生效
- [ ] 手造含「已不存在 layer key」的快照 → 還原不炸、靜默忽略
- [ ] 未登入 → 面板只見登入 CTA；anon 對兩新表 SELECT/INSERT 全被拒（SQL 驗證）
- [ ] 帳號 A 讀不到帳號 B 的 favorites/visits（RLS，SQL 驗證）
- [ ] 第 51 筆收藏被拒且 UI 有可讀錯誤訊息
- [ ] favorites/visits 讀取有 loading UI（loadingRegistry）
- [ ] `npx tsc -b` + `pnpm test` 綠

## 7. 開工順序（跨 repo：上游先動）

1. 主 checkout `git pull` 對齊 #51/#52
2. `taipei-gis-analytics/docs/handoff/member-features.md`（DB 契約：兩表一 RPC）
3. gis-platform：migration 273 + 274，apply 後 SQL 驗證 RLS
4. mini-taiwan-pulse：`feat/member-features` 分支 + `docs/features/member/` 四件組
   → viewSnapshot.ts → memberLoader.ts → MemberPanel + 兩 Sidebar 接線 → App.tsx
5. 隱私頁會員資料段（併 BC-4 一起做）
6. PR（模板照 CLAUDE.md）→ squash → changelog

## 8. 拍板記錄（2026-07-03）

1. 上站統計 = **天粒度 `member_visits` 表**（非 profiles counter 欄位）
2. 收藏 = **手動快照**；不做自動 toggle 行為記錄（行為分析歸 GA4/匿名 sessionTracker）
3. 快照 v1 = layers key 陣列 + camera 五欄 + time + params **全量存**；還原 v1 先套三塊，params 還原為 M-6
4. 上限：每人 50 筆、單筆 16KB
5. migration 號 **273/274**（271/272 已被 RLS lockdown 用掉）
6. 面板走 IconRailSidebar activePanel 模式（非 ChatPanel 浮層）
7. 待定（開工時再拍）：右上 UserAvatar 收進面板 or 保留兩處
