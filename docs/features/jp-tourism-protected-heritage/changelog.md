# Changelog — 日本旅宿、自然保護與世界遺產

## 2026-09-11 — production release

- Frontend PR #243 squash merged as `59c57c77`；CI build、Vitest 與 private coral backend tests 通過。
- 6 個 production assets 以 immutable create-only publisher 上傳；S3 checksum/bytes 與公開 `206 Range` readback 通過。
- Production desktop/mobile browser 驗證 canonical、EBSA、popup metadata、日本行政區不自動開啟與 production-only catalog；console 無 warning/error。
- Claude Code Review check 因 Anthropic organization OAuth 無權限失敗，沒有產生 code finding；保留為外部 review infrastructure failure。

## 2026-09-11 — production packaging

- 18 個本地 layer keys 接線；日本切換不自動開啟都道府縣界。
- canonical、OSM、EBSA 與三份大型 research polygon 改為 PMTiles lazy source。
- 新增 S3 `deploy-assets/world/` 明確 allowlist；HOLD/non-commercial 資產維持本地限定。
- UNESCO popup 補明確 license、status 與 representative-point precision。
- 無 migration、runtime API 或上游 pipeline 修改。
