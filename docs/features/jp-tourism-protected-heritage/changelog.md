# Changelog — 日本旅宿、自然保護與世界遺產

## 2026-09-11 — production packaging

- 18 個本地 layer keys 接線；日本切換不自動開啟都道府縣界。
- canonical、OSM、EBSA 與三份大型 research polygon 改為 PMTiles lazy source。
- 新增 S3 `deploy-assets/world/` 明確 allowlist；HOLD/non-commercial 資產維持本地限定。
- UNESCO popup 補明確 license、status 與 representative-point precision。
- 無 migration、runtime API 或上游 pipeline 修改。
