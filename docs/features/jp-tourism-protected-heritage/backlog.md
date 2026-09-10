# Backlog — 日本旅宿、自然保護與世界遺產

## Active

| ID | State | Next action | Acceptance |
|---|---|---|---|
| JP-TOUR-1 | verifying | 上傳 production allowlist 後做 S3/nginx/browser readback | 6 assets checksum/bytes 相符；PMTiles URL 回 `206`；desktop/mobile 無 error |

## Conditional

| ID | State | Trigger | Next action |
|---|---|---|---|
| JP-TOUR-2 | waiting_external | A10/A11/A28 用途 clearance 完成 | 個別解除 production gate，不得整批 wildcard 發布 |
| JP-TOUR-3 | waiting_external | 鳥獸保護與 Ramsar license/geometry clearance 完成 | 更新 upstream handoff、重跑 deployContract 與 browser QA |

## Explicitly not planned

- A15（coverage 45/47）、OECM geometry、A34 HOLD layers：本次不接。
