# B1 權限盤點（2026-09-07）

範圍：Pulse `9cf23f9`（`master=origin/master=HEAD`）及 gis-platform `main=10b71fb`（2026-09-06）；後者有三個與本題無關的未提交檔，Portal API/middleware 無 diff。未做 HTTP、DB、部署或私有資料讀取，以下 runtime 均為 unknown。

## 需優先處理

* **P0（若 Portal 對網際網路公開）— `/api/data`：無 auth，先用 `service_role` 讀取 `metadata.datasets`，再把其中每個 `table_name` 變成可讀表；呼叫者還可自訂 `select`、filter、order、limit（未設最大值）。見 `portal/src/app/api/data/route.ts:42-63,66-129` 與 `lib/supabase-server.ts:8-11`。請求以 service_role 身分執行，無法靠終端使用者 RLS 區分權限；誤登記或原本非公開 dataset 可能被取回（仍受實際 PostgREST exposed schema 與該服務角色可用權限約束）；不能由「metadata 是目錄」推定公開政策。
* **P0（同條件）— `/api/distinct`：無 table/schema allowlist，只檢查 field 字元；任意表任意欄可由 `service_role` 讀前 500 列並回傳 distinct。見 `api/distinct/route.ts:10-51`。此為比 data proxy 更直接的越權讀取面。
* **P1（同條件）— `/api/rpc`：無 auth 卻 allowlist `report_collector_heartbeat`；proxy 用 service role 執行（`api/rpc/route.ts:11-52`），而該 RPC 會 insert/upsert `metadata.collector_status`（migration `006_views_and_functions.sql:87-130`；DB ACL 僅授 service_role：`009_grant_permissions.sql:46-49`）。因此可偽造 collector 健康/錯誤與計數。其餘列出的 RPC 是 read-only 仍應維持各自參數上限。

## 已落地的 Pulse 保護（source，非 production 證明）

* owner/tier 取登入者自己的 `profiles.tier`，身份切換時先失效（`src/lib/auth.ts:59-108`）；UI toggle 未登入導 OAuth、非授權者 no-op（`src/App.tsx:1269-1307`）。
* gate RPC 載入失敗回退靜態鎖（`src/lib/layerGates.ts:9-13,96-114`）；敏感 RPC migration 276 以 `enforce_layer_access` + 42501 守門（`gis-platform/migrations/276_governance_layer.sql:173-216,219+`）。此為 DB-side 設計證據，尚未讀回已套用 ACL/RLS。
* URL layers 與 embed 均排除 `GATED_LAYERS`（`src/lib/urlState.ts:132-147`; `src/embed/embedWhitelist.ts:7-55`）；畜牧已由公開靜態檔改為 owner RPC（`src/data/livestockLoader.ts:5-36`）。UI gate 不是 DB 取代品，但此處有後端 guard 的來源證據。

## 部署與最小修補

Portal `middleware.ts` 僅 match `/api/schedules/*` 的 `*` CORS（:4-35），未保護上述 API；repo 只有 standalone Next config，未見部署設定。是否上線、URL、env key 存在性與實際 migration 狀態皆 unknown。

先將 Portal Explorer 改為**靜態 table→可選 columns/filters** policy（審核後 public view/RPC only），`/data`/`distinct` 同用它，固定上限、拒絕 `*` 與任意 schema；不要以 metadata 動態授權。移除 public `/api/rpc` 的 heartbeat，改 collector 直連或 server route 加 machine secret/簽名與 rate limit；read RPC 逐支 schema/參數驗證。若 Portal 只供管理，最小做法是在 middleware 前置登入/owner 驗證，仍保留上述 server allowlist。

驗收：未登入對敏感/未列 resource 三路皆 401/403，對明列公開 view/RPC 保持 200 且欄位相同；heartbeat 無有效 machine credential 不可改狀態，有效 collector 可寫一次；owner/member/anon 各呼叫一支 full-gated RPC，僅授權 tier 成功；production 再以匿名瀏覽器與 Supabase privilege/RLS catalog readback 證明，不取真實敏感列。
