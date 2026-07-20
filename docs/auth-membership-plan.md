# 會員系統規劃討論

> 分支：`feat/member-auth` · 狀態：規劃中，未開工
> 上次討論：2026-06-25
> 下次接回：直接讀本檔即可恢復脈絡

## 一、需求釐清結論

| 項目 | 決定 |
|---|---|
| **核心用途** | 主要：**使用監測**（誰查了什麼、哪些圖層被大量使用）<br>次要：付費 / gating 基礎建設（建欄位，先不啟用）<br>延後：收藏 / 書籤 / 分享連結 |
| **登入方式** | Google OAuth only（先做這個就夠） |
| **Auth backend** | Supabase Auth（gis-platform 既有） |
| **強制登入？** | ❌ 否。匿名仍可全功能瀏覽，登入加值 |

## 二、關鍵轉折：GA4 vs 自家 events

討論過程中發現「純 Supabase events」是過度建設。最終共識：**GA4 為主、Supabase events 為輔**。

### 分工原則

| 類型 | 工具 | 理由 |
|---|---|---|
| 通用分析（DAU / retention / device / geo / referrer） | **GA4** | 5 行 script 接完，dashboard 現成，免費永久 |
| 圖層使用熱度、time_seek、popup 開啟 | **GA4 custom event** | GA4 dashboard 足夠看 top N，不用自己刻 |
| 跟 `auth.users.id` join 的 user-level 行為 | **GA4**（用 `gtag('set', {user_id})` 帶過去） | 要 cohort 分析就在 GA 看 |
| 要在 app 內回饋的資料（熱門收藏 heatmap、tier cross-tab） | **Supabase events** | 必須能 SQL 即時查 |
| 收藏 / 分享短碼產生 | **Supabase table** | 業務資料，本來就要存 |

### 事件分工表

| 事件 | GA4 | Supabase |
|---|---|---|
| Page view / session | ✅ | ❌ |
| Device / geo / referrer | ✅ | ❌ |
| `layer_toggle` | ✅ | ❌ 不重複記 |
| `time_seek` | ✅ | ❌ |
| `popup_open` | ✅ | ❌ |
| `bookmark_add` | ✅ | ✅（要顯示在 app 內） |
| `share_create` | ✅ | ✅（要產短碼） |
| 登入 / tier 變更 | ✅ | ✅ |

### 主要 tradeoff

1. **資料保留**：GA4 免費版預設保留 2 個月（可調 14 個月）。要長期持有 → 一鍵打開 BigQuery export（有免費額度，要綁卡）。多數場景不需要。
2. **隱私**：GA4 要在隱私頁註明 + 給 opt-out。台灣目前沒強制 cookie banner 但建議做。Supabase events 自己擁有資料，反而更乾淨。
3. **離線分析**：GA4 看「top 10 layer」簡單；ad-hoc 跨 layer 組合分析還是要 BQ export 寫 SQL。如果這類需求多，custom events 比例可以再拉高。

## 三、Phase 切分（修正後）

### Phase 0 — 基礎建設
- [ ] `gis-platform`：Supabase Dashboard 開 Google OAuth provider
- [ ] migration：`profiles` table（FK → `auth.users.id`，含 `tier: 'free' | 'plus'`, `display_name`, `avatar_url`, `created_at`）
- [ ] 前端 `src/lib/auth.ts`：`signInWithGoogle` / `signOut` / `useUser` hook
- [ ] 右上 Avatar 元件
  - 未登入 → 「使用 Google 登入」按鈕
  - 登入 → 名字 + dropdown（個人 / 登出）
- [ ] 隱私頁草稿（含 GA4 揭露 + opt-out 指引）

### Phase 1 — 監測（P0）
- [ ] 接 GA4（30 分鐘）
- [ ] `src/lib/analytics.ts` 包一層 `track(event, payload)`，內部呼 `gtag('event', ...)`
- [ ] 雙寫 Supabase 的 3 個事件：`bookmark_add` / `share_create` / `tier_change`
- [ ] 登入後 `gtag('set', {user_id: profiles.id})` 綁定
- [ ] **不建** `events` table、**不建** `layer_usage_daily`、**不建** pre-agg cron

### Phase 2 — Gating 預備（建欄位，不啟用）
- [ ] `profiles.tier` 已在 Phase 0 建好
- [ ] `layerCatalog.ts` 每筆加可選 `gating?: 'plus'` 欄位
- [ ] `useUserTier()` hook
- [ ] sidebar 暫不擋 — 欄位先流通

### Phase 3 — 收藏 / 分享（延後）
- [ ] `bookmarks (id, user_id, name, state_snapshot jsonb, created_at)`
  - `state_snapshot`：layer toggles + time + view (bbox/zoom)
- [ ] `shares (short_code, state_snapshot, created_at, expires_at)`
  - 匿名可開，短碼產生器
- [ ] UI：地圖右上「收藏目前狀態」/「複製分享連結」

## 四、跨 repo 動作清單

| Repo | 動作 |
|---|---|
| `gis-platform` | 開 Google OAuth provider + migration（profiles + RLS + Phase 3 的 bookmarks/shares） |
| `mini-taiwan-pulse-auth`（本 repo） | 前端整合、GA4、Avatar、analytics wrapper |
| `data-collectors` | N/A |

## 五、開工時要先確認的

- [ ] GA4 property 帳號歸屬（個人 Gmail？專案專用？）
- [ ] Supabase Google OAuth 的 redirect URL 白名單（dev: localhost:3721 / prod: Zeabur 網域）
- [ ] 隱私頁要不要做 cookie banner（台灣非強制，但決定 GA4 是否需要 opt-in 才載入）
- [ ] `profiles` 是否要存 email（Google OAuth 會給，但 `auth.users` 已有，看要不要冗存方便查）

---

**下次開工順序建議**：先 Phase 0（一晚可完成）→ 跑通 Google 登入閉環 → 再接 GA4（Phase 1，30 分鐘）→ 整套上線觀察一週監測數據 → 再決定 Phase 2/3 排程。
