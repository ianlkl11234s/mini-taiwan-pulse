# Research bridge Phase B wire contract

Implementation contract for local integration; production acceptance remains separate.
All endpoints prefix `/api/research/v1`. JSON only, private no-store, no secrets in URLs.
Browser auth: `Authorization: Bearer <Supabase access token>`, fixed same-origin API.
Agent auth: `Authorization: Research <session credential>`; credential only companion memory.

Browser owner API:
- POST `/studies` `{tabId}` => `{studyId,tabId}`
- POST `/pairings` `{studyId,tabId}` => `{pairingId,code,expiresAt}`
- POST `/pairings/status` `{pairingId,tabId}` => `{claimed,approved,deviceLabel,phrase,...}`
- POST `/pairings/approve` `{pairingId,tabId,phrase}` => approved
- POST `/browser/sync` `{studyId,tabId}` => StudyState; refreshes 45s heartbeat
- POST `/browser/manual` `{studyId,tabId,expectedRevision,scene}` => StudyState; cancels pending command and increments revision
- POST `/browser/ack` `{studyId,tabId,commandId,expectedRevision}` => StudyState; CAS commit pending scene patch, revision+1, phase applied
- POST `/browser/report` `{studyId,tabId,revision,phase:'ready'|'error'}` => StudyState
- POST `/browser/pause` `{studyId,tabId,paused:boolean}` => StudyState; cancels pending command
- POST `/studies/revoke` `{studyId}` => revoked; invalidates pending claims and active sessions

Unauthenticated, trusted-IP rate-limited pairing API:
- POST `/pairings/claim` `{pairingId,code,deviceLabel}` => `{pairingId,claimSecret,deviceLabel,phrase}`
- POST `/pairings/exchange` `{pairingId,claimSecret}` => `{sessionId,studyId,tabId,credential,capabilities,expiresAt}`
  Before owner confirms, HTTP 409 `{error:{code:'PAIRING_PENDING'}}`; other denial sanitized.
  Pilot pairing ticket contains public pairingId plus eight-character short code; code-only discovery is deferred.

Agent API:
- POST `/session` `{}` => session metadata (never credential)
- POST `/disconnect` `{}` => revoked
- POST `/state` `{}` => StudyState scoped by credential
- POST `/commands` Command => `{commandId,status:'accepted'|'applied'|'ready'|'error'|'conflict',revision}`
- POST `/commands/status` `{commandId}` => same receipt (command must belong to session)

Command = `{protocolVersion:'1',sessionId,studyId,tabId,commandId,expectedRevision,expiresAt,patch}`.
`expiresAt` Unix ms, max now+30s. IDs ASCII safe max128. `patch` strict object with
optional camera and/or resultMode, at least one. camera `{center:[lng,lat],zoom}`
finite lng[-180,180],lat[-85,85],zoom[0,18]. resultMode `'empty'|'synthetic'` only.
No arbitrary GeoJSON, URL, code, HTML or stored artifact reads in this phase.

StudyState = `{studyId,tabId,revision,scene:{camera:{center,zoom},resultMode},
view:{revision,phase:'empty'|'applied'|'ready'|'error'},connected:boolean,paused:boolean,
pendingCommand:Command|null}`. Initial revision0, center[121.525,25.025],zoom12,resultMode empty.
Owner and agent scopes resolved server-side; agent state strips owner identity and
pairing material. A scene command only becomes applied after owner browser ack;
ready follows actual renderer idle report at the same revision. Acceptance is not readiness.

One pending command per study; a hard cap of 32 accepted commands per study. All receipts stay until study TTL; no eviction that could reopen replay. Create a new study when full. Repeated commandId
+ same normalized payload returns its existing receipt; changed payload rejected.
Manual operations cancel pending commands. Browser serial controller suspends command application during gestures and queued manual edits; CAS at ack rejects old commits.
Expired/disconnected/paused/revoked sessions cannot submit new mutations. Browser
reports do not authorize data access. No screenshot, upload or acquisition endpoints.

API errors `{error:{code}}`, HTTP400 validation,401/403 authorization,409 conflict,
410 expiry,413 size,429 throttle,503 upstream unavailable. Clients must never echo
raw upstream errors or request headers. HTTP body cap32KiB; responses bounded.

## 主地圖圖層開關增量（2026-09-11）

scene/patch 可選 `layers: Record<string, boolean>`，最多20鍵，key 為 `[A-Za-z][A-Za-z0-9_]{0,79}` 且不得使用 prototype 特殊鍵。每筆 layers 全組取代上一組 overrides；未列出的原地圖開關保持原狀。主地圖 adapter 驗證 catalog/lock 並呼叫既有 handler，lab 拒絕非空 layers。`pulse_set_layers({layers,expectedRevision})` 是專用入口。主地圖 ready 僅證明開關狀態已讀回，不代表 source/geometry 完成。完整可見圖層 discovery、資料 readiness 另立後續契約，不從此 receipt 推論。

## Browser query relay（2026-09-11）

讀取不走scene mutation。Agent `POST /agent/query {requestId,operation,args,expiresAt}`，browser `POST /browser/query {studyId,tabId}` 取得pending request，回 `/browser/query-result {studyId,tabId,requestId,result}`。result為 `{ok:true,data:object}` 或 `{ok:false,error:CODE}`；Agent `/agent/query-status {requestId}` 回receipt。固定operations為 search_layers/describe_layer/read_layer/map_context/find_places/nearby；無任意URL、SQL或程式碼。MCP等候至多25秒，pending可用pulse_get_query_result繼續讀。

30秒requestTTL、45秒browser heartbeat、一次1pending、每study32次request，最多4筆完成資料、24KiB/depth6/array100邊界。淘汰回expired但保留ID tombstone。配對撤銷／pause不再交付；session/tab隔離。回覆receipt即使complete也不是地圖變更；scene.nearby可設 `{queryId}` 或null。queryId為成功nearby requestId，browser記憶體保存相應衍生資料；show由expectedRevision決定，禁止跨session呈現。

map_context回真正camera、selection、visibleLayerKeys及截斷旗標、loading清單及totalLoading/loadingTruncated，不能把visible當資料已載齊。find_places只搜尋既有camera presets，不是地址geocoder。
