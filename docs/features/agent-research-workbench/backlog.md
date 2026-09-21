> **歷史 backlog（2026-09-14 起）**：保留原 Research Workbench 分階段工作，不作目前地圖探索優先順序或發布狀態。現在的能力、缺口與下一步以 [探索能力計劃](./exploration-capabilities-plan.md) 為準；新增來源應依 [分析能力 onboarding](./analysis-capability-onboarding.md) 驗收。

## 2026-09-21 後續：可保存的分析成果

> 順序：先完成 session-local result overlay 的 `accepted → applied → ready → browser readback`，再做持久化。目前 `resultId` 維持 browser session 內暫存，不自動寫入 Supabase。

- [ ] 定義「儲存分析」明確動作：只有使用者主動儲存時，才將 session-local `resultId` 晉升為持久、版本化的 `artifactId`；不保存每次探索與失敗嘗試。
- [ ] 定義 durable artifact contract：保留 schema/method version、query/filters/time/bbox、dataset/source version、CRS/geometry role、coverage/freshness、units、missing/suppressed/zero/exclusions、lineage、row/feature count、checksum 與建立時間。
- [ ] 做儲存選型與容量實測：優先評估 Supabase 儲存 metadata/index/RLS；小型、有界 JSON 才可直存，大型 geometry/result 改用 private R2/S3 immutable object，Supabase 只存 manifest/hash/pointer。
- [ ] 定義權限與生命週期：owner ACL/RLS、quota、TTL/retention、刪除與撤銷、來源權限變更、source version 過期，並確保撤銷後無法繼續讀取與呈現。
- [ ] 定義 restore/resume 路徑：以 `artifactId` 讀回時重新授權，明示 stale/source drift，恢復結果 overlay 與數量/範圍 readback，不把舊結果假裝成當前來源。
- [ ] 完成持久化驗收：頁面重載、重新配對、跨裝置授權、過期、撤銷、刪除、大小限制、checksum/count 與 browser 可視讀回均有實際證據。

## 2026-09-21 後續：正式服務拓樸

> 邏輯上需要網站、Gateway、MCP 與既有 Supabase；第一版只有網站與 Gateway 必須部署成伺服器，MCP 維持使用者端 stdio。Result overlay 仍是 session-local，不因部署自動持久化。

- [ ] Mini Taiwan Pulse 正式站保留同源 `/api/research/v1/`，由 TLS reverse proxy 轉送 Research Gateway；不得直接公開未加密的 loopback port。
- [ ] Research Gateway 以受管理的 sidecar/process 部署，負責 Supabase Auth、pilot ACL、pairing、session、revision、receipt、pause/revoke 與 rate limit；它只轉送 bounded declarative commands，不承載分析資料本體。
- [ ] `pulse-research` MCP 第一版以本機 stdio 安裝，連線正式 HTTPS Gateway；若未來改成 Remote MCP，需另設多使用者 auth、credential isolation、quota、監控及 offline-geocoder 資料部署。
- [ ] 少量 pilot 可採單節點 Gateway＋持久 SQLite volume；正式多 instance 前改用可共享且具交易語意的 Postgres/Redis 類 state store，或明確限制單節點與故障切換。
- [ ] 正式驗收需分開記錄：Gateway 部署、Supabase OAuth redirect／pilot allowlist、MCP 安裝、配對、accepted → applied → ready、browser readback、重啟／撤銷；任一項通過不得代替其他項。

## 2026-09-21 產品主流程：地址作為探索起點

> 目標體驗：輸入地址後，以該位置為中心搜尋、分析並高亮周圍各種已支援資料；不只回文字或移動鏡頭。地址精度、資料來源、分析方法與限制仍須可見。

- [ ] 建立 address → geocode precision → map center／result bounds → dataset search → bounded query／analysis → result overlay → browser readback 的共用流程，讓不同資料集可沿用，而不是每個圖層各做一條特殊路徑。
- [ ] 每新增呈現型 command／query operation，都同步檢查 MCP schema、Gateway allowlist／normalizer、browser `Scene`／`BrowserQuery` validator、renderer 與 readback；Gateway 應允許有界 declarative capability，不以舊白名單無聲阻斷已支援功能。
- [ ] 「分析成功但地圖沒顯示」的排查順序固定為：Gateway HTTP status／`INVALID_INPUT` → command 是否 accepted → browser 是否 applied → renderer 是否 ready → `map_context.resultPresentation` → dataset geometry/count/source；不得一開始就判定資料不存在。
- [ ] 周邊資料只對已支援、語意合格的 dataset 計算；未註冊、geometry role 不明、資料契約不足或需要路網／point-in-polygon 的問題，先說明目前不能做並提供可開啟的相關圖層。

### 下一個可見成果：分析中心與範圍

- [ ] 將地址／選點中心作為獨立 origin marker 呈現，不混入分析結果筆數；popup 顯示輸入位置、geocode provider、precision 與是否為估算。
- [ ] 為分析結果增加 typed `scope`：`within_distance` 畫實際半徑圓、bbox／行政區畫來源邊界、walking 顯示 routing engine 回傳的 isochrone；`nearest N` 若只有最遠結果距離，只能標成「結果涵蓋提示」，不可冒充查詢邊界。
- [ ] map readback 增加 origin／scope geometry type、method、cutoff、units、source/version 與 ready；圖例與 popup 使用網站既有黑色不透明玻璃視覺，不另造一套浮層樣式。
- [ ] 驗收 address → origin → scope → result overlay → fit bounds → accepted／applied／ready → browser readback，並確認 theme switch、style reload、clear、expiry／revoke 後不殘留。

### 地址定位 fallback：可選的 Google Geocoding

- [ ] 本機 TGOS／OSM exact 與 interpolation 仍是第一順位；只有 `no_match`／`unavailable` 且使用者同意將精確地址送往外部 provider 時，才允許 Google fallback，不得靜默外傳。
- [ ] Google Geocoding 經 Gateway／server-side adapter 呼叫，key 不進網站 bundle 或 MCP tool arguments；加入 quota、timeout、rate limit、成本 ledger 與 provider circuit breaker。
- [ ] 回傳契約保留 provider、place ID、location type／precision、partial match、viewport、attribution、request time 與外傳 consent receipt；不可把 Google 結果和本機 exact 命中合併成同一種精度。
- [ ] 先完成 Google Maps Platform 儲存、attribution 與 map-display 條款 review；Google 回傳內容不可直接假設能長期存入 Supabase，持久層優先保存可允許長期保存的 identifier／consent／request metadata。

### OSM 步行範圍：有界 routing pilot

- [ ] 先選 routing engine 與責任邊界：第一個 isochrone pilot 優先評估原生提供 pedestrian isochrone GeoJSON 的 Valhalla；若選 OSRM，需另有 isochrone 計算層，不把 route／table API 誤稱為等時圈。
- [ ] 固定 Taiwan OSM extract、抓取時間、engine/version、pedestrian profile、turn/access rules 與 build checksum；路網更新不可和舊分析結果混用。
- [ ] 定義 `route_distance`／`walking_isochrone` typed contract：origin、5／10／15 分鐘 cutoff、snap distance、unreachable、disconnected、excluded ways、units、network version 與 warnings。
- [ ] 第一個 vertical slice 只做單一地址：地址定位 → 5／10／15 分鐘步行圈 → 圈內已支援學校 → result/scope overlay → ready/readback；同畫面保留 Haversine 直線距離作比較但不混名。
- [ ] 以已知可步行／不可跨越案例驗證 topology、橋梁／隧道／人行限制與 disconnected behavior；在 graph/profile/coverage 證據完成前維持 HOLD，不擴大到全台大量 dataset adapters。

## 2026-09-14 本輪增量

- [x] M2 語意卡 schema／validator／schools、news、paddy 與負向測試。
- [x] 本地 Research Library 契約、immutable asset、search／describe／promote／stale。
- [x] 真實 schools 150 m assign／aggregate／materialize、固定 receipt、resultId 與主地圖驗收。
- [x] Routing 現況盤點：缺 graph／profile 證據，明確 HOLD。
- [ ] 新 grid 透過登入配對 MCP 的端到端及 mobile 驗收。
- [ ] 合格來源 licence／observed time 與第二個真實 library asset。
- [ ] Network engine／graph version／walking profile／topology／unreachable 證據。
- [ ] School district、real estate 真實可用資料；雲端 library 與跨使用者 ACL。

# Implementation backlog

完整目標以 spec.md 為準；證據以 handoff.md 為準。

- [x] 隔離 worktrees，保留原始並行工作。
- [x] Phase A synthetic result契約、共用驗證器與有界renderer。
- [x] `/lab`點／線／單外環面／表格、loading、opacity、legend、popup、clear。
- [x] 本地MCP驗證與列檔；bounded reads與symlink檢查。
- [x] Phase B配對domain安全核心及tests（非可部署gateway）。
- [ ] 完整v1 geometry（含holes/MultiPolygon）與參考底圖／圖層。
- [x] 真實登入verifier、SQLite durable store、pilot ACL、HTTP配對／relay程式與本地tests。
- [x] MCP session/scene tools、網站StudyController、manual優先與同revision ready。
- [ ] 正式HTTPS部署、pilot IDs、OAuth redirects、header readback與browser配對。
- [x] Codex全域MCP安裝、真Supabase登入、實際Codex CLI配對／操作／同revision ready驗收。
- [ ] 使用者重新載入桌面MCP後的日常操作驗收。
- [ ] 受授權的本地workspace快取／版本／pin／quota／eviction。
- [ ] S3/Supabase/R2共用catalog與receipt-aware acquisition。
- [ ] 估價、預算approval、reservation與受控reader。
- [ ] 私有artifacts、TTL、snapshot restore與ACL繼承。
- [ ] S3-only真實資料分析／方法基準／第二次payload零下載。
- [ ] 同revision inspect/capture、cancel/reconnect與production驗收。
