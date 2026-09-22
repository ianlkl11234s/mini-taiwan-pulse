## 2026-09-14 — Semantic Registry 與本地 Library／Grid

新增三份語意卡與 evidence validator、本地 ResearchAsset／GridDefinition／GridMetric 和 SQLite lifecycle；真實 schools assign／aggregate／materialize 產生固定 receipt，以 session resultId 在主地圖呈現 Polygon、popup、圖例、透明度及清除。補齊 hash／版本／geometry／缺值負向檢查、更新 roadmap 與互動說明。驗收與明確 HOLD 見 acceptance；僅本地提交。

## 2026-09-22 — 通用分析與地圖呈現閉環

- 修復 `set_camera`／`fit_bounds` 後 scene-ready 假 error，完成 accepted → applied → ready → browser readback。
- 新增 session-local Point／Polygon／MultiPolygon results、analysis origin／scope、45 組統計同版 boundary join，以及最多 8 層的 ordered／grouped collection。
- Paired browser 以學校、圖書館、醫院、便利商店與臺北市教育統計面驗收：5 layers／428 features；關閉 healthcare group 後 413 features，readback 一致。
- 新增 consented Google geocode adapter 與公共 Valhalla pedestrian POC adapter；本輪未送出真實地址或座標，production graph、政策 review 與 provider E2E 仍待完成。
- 修正 browser→Gateway→MCP bounded rich-result transport，fresh stdio 可讀回完整 33-version statistics descriptor。
- 最新 local checks：Mini research slice 197 pass／5 skip、tsc；Gateway 55/55；MCP 54/54、typecheck、build。未 push／PR／merge／deploy，未寫入 Supabase／R2。

# Changelog

## 2026-09-11 — local implementation, uncommitted

- 新增獨立研究入口與合成成果renderer，不改主站App/Chat/state。
- Analytics canonical validator供Browser/MCP共用並pin SHA-256。
- 新增唯讀本地MCP工具與配對domain安全核心。
- 完成本地browser及聚焦安全regressions；production、付費acquisition和cache仍待實作。
- 測試／baseline缺口及檔案責任見 handoff.md。未建立PR、commit、push或部署。

## 2026-09-11 Phase B local integration

新增 bounded HTTP/Supabase verifier/SQLite gateway、MCP pairing+scene tools、研究頁配對UI與序列化StudyController。限定camera/fixed synthetic/empty。修正manual與ready競爭；新增durability/auth/relay/controller測試。未部署，未設定正式帳號或來源成本，詳見handoff。

## 2026-09-11 真實本地 pilot

啟用localhost gateway與Codex全域MCP；PKCE獨立tab登入、server已驗證email allowlist。真Codex CLI與網站完成r1合成成果、r2清除、r3再顯示，三筆ready；網站撤銷已readback確認。修正browser fetch receiver、MCP numeric array schema與resize誤判manual。去敏證據 `/private/tmp/pulse-research-workbench/evidence/live-pilot-result.json`。正式站未部署。

## 2026-09-17 — Exploration checkpoint and viewport repair

- 第一階段探索介面、圖層控制、時間操作與取景修正已本地提交。
- 新增故事 Skill、連線稽核及基礎統計下一步 checkpoint。
- VIEWPORT_OCCLUDED 不再阻止 map context；使用明確遮擋面板與替代可用矩形。
- 最新全站測試 1458 passed / 5 skipped；Gateway 39 passed。完整 release 結果見 release-handoff-20260917.md。
- 配對 TTL/輪詢、最新圖資缺失與 paired browser E2E 仍未完成；本次是程式碼整合，非 production-ready 宣告。

### 主線整合驗證

保留一般 merge history（976b7981），解決 7 處探索/Statistics/Coral/代理衝突。合併後全站1543 passed /6 skipped、production build通過。使用者確認目的地授權後，前端 PR #257（9550d072）與 Gateway PR #112（0ffa1abc）皆 CI 全綠並一般 merge；詳 release-handoff-20260917.md。
