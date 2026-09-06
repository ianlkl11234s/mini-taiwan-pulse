# 會員專區與 Supabase 基建盤點

範圍：2026-09-06 唯讀 source audit。未套 migration、未讀帳號資料；migration 檔案是**預期 schema 的 source evidence**，不是 production 現況。已補本次 metadata-only DB 讀回；見文末及 db-metadata.json。

## 現有可沿用與缺口

| 領域 | source evidence | 結論 |
|---|---|---|
| 登入 | `src/lib/auth.ts`、`src/components/auth/UserAvatar.tsx` | Google OAuth、session 訂閱與登出已接；未登入可保留公開瀏覽。 |
| 身份/權限 | `../gis-platform/migrations/270_member_profiles.sql`、`276_governance_layer.sql` | `public.profiles` 為 `auth.users` 1:1，self SELECT、僅可更新顯示名稱/avatar；275 的 assert 固化此限制，276 只調整 tier CHECK，未重建 profile。 |
| gated layer | `src/lib/layerGates.ts`、migration 275 | tier 是 layer gate，不是 billing/subscription 真相；場景還原仍須重新過 gate。 |
| 快照規劃 | `docs/proposal/member-features-plan.md`、`docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md` | 有 v1 設計；migration 目錄搜尋未找到 `user_favorites`、`member_visits`、`user_layer_favorites`、`user_places`、`user_scenes` 的建表，273/274 僅存在規劃文件。 |
| 地圖 state | `src/App.tsx`、`src/lib/urlState.ts`、`src/state/layerVisibilityStore.ts`、`src/state/layerParamsStore.ts`、`src/state/timeStore.ts` | 已有 layer key、camera、time 與 params 的擷取基礎；URL 只覆蓋部分 state，不能直接當完整保存格式。 |
| 既有側欄 | `src/components/IconRailSidebar.tsx`、`src/components/LayerSidebar.tsx` | 桌機 rail 採 `PanelId` + floating panel；手機有獨立 `LayerSidebar`，不能只加桌機入口。右上 `UserAvatar` 目前只做登入/owner/登出。 |

## 第一批產品範圍

會員 icon 為「會員專區」，而非把 tier 稱作方案或付費會員。未登入可使用本機收藏／已開啟管理，並顯示 Google 登入 CTA 說明同步用途；各批次依序交付：

1. **收藏圖層**：以 manifest stable `layer_key` 儲存、顯示名稱即時由 manifest 解出；移除 manifest key 時呈現「已下架」並可刪除。
2. **已開啟管理**：顯示現在開啟圖層（直接取 visibility state），再提供本機 session/local 的最近開啟清單。首版不把每次 toggle 上傳，避免把操作追蹤誤做成收藏或個資紀錄；跨裝置同步可在需求確認後才加表。
3. **命名場景**：保存可重開的地圖組合，不保存分析結果或 API key。
4. **收藏地點/範圍**：名稱、Point/Polygon、選取來源（手動/geocode）、位置精度與可選備註；精確位置屬私有資料。

場景與地點在同一面板，但資料模型分開。首版不放空的「對話歷史、通知、分享、付費方案」頁籤。

## 建議資料契約

| object | 最小欄位/索引 | RLS 與行為 |
|---|---|---|
| `user_layer_favorites` | `user_id, layer_key, created_at`；PK/unique `(user_id, layer_key)`，索引 `(user_id, created_at desc)` | authenticated 本人 CRUD；無需 RPC。 |
| `user_places` | UUID、`user_id`、名稱、Point/Polygon geometry 或受限 GeoJSON、`source_kind`、`precision`、`created_at/updated_at`；GiST geometry（僅在日後空間查詢需要時）+ `(user_id, updated_at desc)` | authenticated 本人 CRUD；座標不可進公開分享/analytics 預設資料流。 |
| `user_scenes` | UUID、`user_id`、名稱、`snapshot_version`、`snapshot jsonb`、`created_at/updated_at`；`(user_id, updated_at desc)` | authenticated 本人 CRUD；大小 CHECK、每人 quota trigger。場景更新採 optimistic `updated_at`，衝突可保留副本。 |

每表啟 RLS、`REVOKE ALL` 後只授 authenticated 所需的 `SELECT/INSERT/UPDATE/DELETE`，policy 同時 `USING` 與 `WITH CHECK (auth.uid() = user_id)`。`profiles` 的 column-level UPDATE 防 self-escalation 模式不可直接套到可 CRUD 的收藏表；保護 owner 隔離靠 `user_id` RLS 和 grant。只有計數/配額等不可由 client 信任的寫入才需要 `SECURITY DEFINER` RPC；首批 CRUD 不需要通用 RPC。

建議 scene snapshot versioned 且 allowlist：`layers`（key array）、camera（lng/lat/zoom/pitch/bearing）、time mode/range、basemap、允許持久化的 params。還原順序：驗 schema → layer key 與現有 manifest 取交集 → gate/資料可用性檢查 → 套 camera/time/layers/params。跳過遺失、受限或不相容項目並給可理解提示，不能讓舊快照繞過權限。不得存 BYOK key、session/auth token、私有分析原始結果或當時可見資料列。

## UI 接線與交付順序

桌機在 `IconRailSidebar` 的 `PanelId` 擴充 `member`、新增 User icon、以既有 floating panel/`PanelHeader` 掛 `MemberPanel`；開啟時沿用目前 Intel/Satellite/Property 面板 mutex。手機同步在 `LayerSidebar` 加入口。`App.tsx` 負責把 live map bridge（camera、timeline、visibility、params）與登入狀態傳入，`UserAvatar` 可保留為快速登入/帳號選單，避免重複管理兩份身份狀態。

先做 F1（會員 icon、登入 CTA、收藏圖層、本機已開啟管理）以驗 UI 與 key 契約；再做 F2（上游 migration、private places、scene CRUD/還原）取得跨裝置保存。資料庫 migration 必須在 `gis-platform` 先完成並以 RLS readback 驗收，前端才接雲端寫入。不要先做 tier/billing、分享或自動行為追蹤。

## 驗收

- 未登入：公開地圖與本機收藏可用，會員面板說明登入同步用途；不產生雲端個資寫入。
- 收藏 layer：toggle 可逆、重整後本機仍可讀；登入同步版本在另一裝置可讀回，A 不能讀 B。
- 已開啟：現在開啟清單與 map visibility 一致；「最近」明確標示為本機而非跨裝置歷史。
- scene：camera、time、layers、allowlisted params round-trip；不存在 layer、失去 gate、版本不相容皆不崩潰且有提示。
- place：Point/Polygon 依原精度回讀；登出清除私有 client cache；不出現在 URL/分享/analytics 預設 payload。
- DB：anon 對三表的讀寫均拒絕；authenticated 僅能 CRUD 自己列；quota/size 超限有可讀錯誤；migration 後 metadata、policy、index、function name 以 read-only 查詢 readback。

## Production metadata verification

主 agent 已執行唯讀查詢，結果見 [db-metadata.json](db-metadata.json)。`transaction_read_only=on`，errors 為空；查到 public.profiles 欄位、RLS enabled、本人 SELECT／UPDATE policy 與 profiles_pkey。目標表名中未找到 member_visits、user_favorites、user_layer_favorites、user_places、user_scenes 或 chat_logs。這是指定 public 表名的存在性盤點，沒有掃描其他命名的同類產品資料表。

未讀使用者列、email、function body、cron command/message，也未輸出 DSN。policy 包含 auth.uid 的布林結果不能取代兩帳號越權測試；table grants 不含 column grants，因此不能據此判定 display_name/avatar 的 UPDATE 權限缺失。
