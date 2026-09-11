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
