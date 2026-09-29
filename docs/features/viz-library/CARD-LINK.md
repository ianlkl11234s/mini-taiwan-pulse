# 分析卡連結（4b）：權威規格

> 2026-09-29 定稿。原始設計草稿已遺失（暫存區清除），本檔依已上線的實作、[DECISIONS.md](./DECISIONS.md) §6.1 與使用者拍板重新整理。**以程式碼與 migration 為準**，本檔負責說明「為什麼這樣做」與「東西在哪」。

## 1. 一句話

Agent 在本機分析出的結果，經授權檢查後產生一張「卡片草稿」；使用者在瀏覽器按「發布連結」，資料庫產生不可猜的連結，任何人打開 `https://mini-taiwan-pulse.itsmigu.com/card/<slug>` 都看得到這張直式 4:5 卡片，30 天後失效，可隨時撤銷。

## 2. 流程與責任

```
Agent（本機 MCP）                 瀏覽器（本機 3734，owner 登入）         Supabase（正式）            任何人
pulse_publish_card
 ├ 授權閘門 publishGate.ts
 ├ 產生 payload cardPayload.ts
 └ relay: analysis_card_draft ──► Agent 面板顯示草稿
                                  使用者按「發布連結」 ──────────────► publish_analysis_card(jsonb)
                                                                       └ 產生 16 字元 slug、30 天到期
                                                                                                   /card/<slug>
                                                                       get_analysis_card(slug) ◄─── 卡片頁（anon）
會員專區「卡片」分頁：list_my_analysis_cards／revoke_analysis_card
```

- **MCP 不持有任何 Supabase 寫入憑證**；Agent 永遠不能自行發布（使用者拍板 8）。
- Agent 面板只在本機開發環境（`import.meta.env.DEV`）顯示，所以**發布只能在本機做**；撤銷在正式站會員專區。
- 研究 gateway 必須放行 `analysis_card_draft`（gis-platform `services/research-gateway/relay-service.mjs`），否則草稿送不到面板。

## 3. 拍板（2026-09-28）

| 題 | 定案 |
|---|---|
| 儲存方案 | B：Supabase 摘要表＋SECURITY DEFINER RPC，只存卡片摘要，不存原始 features／幾何 |
| 誰能發布 | 只有 owner（`public.is_owner()`） |
| 有效期 | 固定 30 天；可撤銷；過期滿 7 天由 cron 清除 |
| 上限 | 每位 owner 200 張；payload ≤ 32KB（DB）、MCP 端 ≤ 28KB（gateway 單次請求 32KB 含包裝） |
| slug | 16 字元、不可猜 |
| 查詢中心點 | 可顯示（原座標）；**不記錄**中心點取得來源——若中心點是用 Google 查的地址，依條款不應公開，由使用者自行留意（Agent 產草稿時提醒） |
| 社群預覽圖 og:image | 不做 |
| 看卡的人能否開完整地圖 | 不能 |
| 界線檔保留期限 | 不承諾；卡片頁在界線載入失敗時仍顯示結論、數字、長條 |
| 村里層級 | v1 不支援 |

## 4. 授權閘門

- 白名單 `mcp/src/warehouse/publishAllowlist.json`（141 筆：OGDL 133、base_map 衍生 6、縣市／鄉鎮界 2），以 `ds_*` 表名為鍵；重產：`npm run allowlist:build -- --catalog <catalog.json>`（腳本 `scripts/build-publish-allowlist.mts`，含明確排除清單）。
- 一律擋：Google geocode 衍生 21 個資料集、一般地址定位（TGOS 等）57 個、明寫不得再散布、未標授權、混合授權；食品價格指數（原料未查證，2026-09-28 使用者決定暫不公開）。
- 閘門依結果 lineage 判斷：SQL 來源表名、nearby_profile 的 dataset、region_rank 逐列 license＋界線表、`iso_*` 往回追（Valhalla/OSM 第一批不收）。追不到來源也擋。擋下時回白話原因。
- **Google 條款結論：不可發布** Google Geocoding 結果（Maps Service Specific Terms §6.2 不得與非 Google 地圖並用、§6.3.1 暫存上限 30 天；ToS §3.2.3）。來源：https://cloud.google.com/maps-platform/terms/maps-service-terms 、https://cloud.google.com/maps-platform/terms 。此為條文字面判讀，非法律意見。倉庫長期存放 Google 座標是否合規另列 [BACKLOG](./BACKLOG.md)。

## 5. payload v1

型別以 `mcp/src/warehouse/cardPayload.ts` 的 `CardPayloadV1` 為準，前端驗證在 `mini/src/card/cardPayload.ts`，DB 驗證在 `analysis_card_payload_is_valid()`。重點：

- 頂層鍵固定：`schema_version, kind, title, generated_at, data_period, stats(≤3), top(≤5，含選填 code), map, points(≤50), query_scope, legend, sources, caveats`。
- `map.geometry` 引用已上線界線檔（縣市 `COUNTY_MOI_1140318`、鄉鎮 `township_reference_20260626_v1`），`areas` 為 `[code, classIndex]`。
- `legend.value_kind`（count／ratio／percent／number）決定數字格式；單位含「／ / 每 率 %」或非整數 → ratio（保留小數）。`pulse_publish_card` 可帶 `legendTitle` 覆蓋圖例標題（拒絕代碼）。
- **禁止**：address、phone、任何原始 properties、snake_case 代碼。界線被引用時 `sources` 自動加「內政部國土測繪中心」（OGDL 顯名）。

## 6. 資料庫（gis-platform）

| migration | 內容 |
|---|---|
| `414_analysis_cards.sql`（#120） | `analysis_cards` 表＋RLS、`publish_analysis_card(jsonb)`、`get_analysis_card(text)`、`revoke_analysis_card(text)`、`list_my_analysis_cards()`、`cleanup_expired_analysis_cards()`、cron `cleanup-analysis-cards`（UTC 20:40＝台灣 04:40） |
| `415_analysis_cards_pgcrypto_path.sql`（#121） | slug 觸發器 search_path 加 `extensions`（Supabase 的 pgcrypto 在 extensions schema；少了這條正式環境每次發布都失敗） |

測試：`migrations/414_analysis_cards.test.psql`（本機拋棄式 PG17；已模擬 pgcrypto 在 extensions）。撤回：drop 表與上述函式。

## 7. 前端（mini）

- 卡片頁：`card.html`＋`src/card/`（不 import 主站 supabase client，以 anon 讀 RPC）；nginx `location ^~ /card/`（`frame-ancestors 'none'`）。
- 面板草稿：`src/research/MainMapConnection.tsx`（relay 分派、草稿區、「做成卡片」提示）；RPC 集中在 `src/lib/analysisCardApi.ts`。
- 我的卡片：會員專區「卡片」分頁（owner）。

## 8. 相關 PR

mini #394、#399；mcp #21、#22；gis-platform #120、#121。
