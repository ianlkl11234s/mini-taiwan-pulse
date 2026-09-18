# GFW safe history and seven-day serving repair — 2026-09-18

## Scope

Based on origin/master `6954dc0d`, including the already-released freshness UI hotfix. Collector counterpart: `data-collectors/.claude/worktrees/gfw-safe-publish-20260918` based on `3518569`.

- S3 is the durable archive of successfully published, processed/full-fidelity releases. The collector no longer deletes old successful releases; mutable root indexes current plus one rollback only. Raw provider responses remain outside this repair.
- Frontend serves the selected UTC seven-day v2/v3 window, with the existing five-day source lag. Seven days is a display window, not permission for seven days of failed jobs.
- New mirror fetches one candidate root and verifies every referenced asset's size and SHA-256 before replacing the installed root. It never re-fetches a newer root after downloading assets. Missing files, checksum failures, incomplete time indexes, same-date artifact mutation and date regression fail closed.
- Startup and periodic refresh share one helper; default refresh interval is one hour (an existing environment override still wins). OS `flock` prevents concurrent refreshes and releases automatically on process exit; Linux runtime installs its dependency.
- Only candidate assets are fetched, not the entire archived S3 prefix. Already-present exact bytes are reused.
- Local serving cache can retire enumerated old assets only eight days after they stop being current, allowing the seven-day immutable cache plus grace. Current assets, unindexed files and S3 history are never removed by this cleanup. A failed candidate never retires the current release. Interrupted unindexed candidate files are retained for inspection.
- Optional v4 remains a distinct publication boundary: absent root is a no-op; an existing published root and release manifest must pass pointer/hash/publication gates before mirroring. No v4 activation, migration or schedule change is included.

## Validation

- Existing production manifests parse with new verifier: schema 2, 343 assets; schema 3, 3,311 assets.
- Eight Node integration tests pass on macOS and isolated Linux Node 20: partial fetch/hash failure, concurrent upstream root change, rollback, unsafe paths/symlinks, optional v4 pointer, reuse, precise eight-day cache expiry.
- `tsc -b` passed. Focused deployment/freshness tests: 22 passed. Full suite: 1,641 passed, 8 skipped, 3 unrelated five-second timeouts; rerunning the two affected files with one worker passed all 42 tests without changing their assertions or timeout.
- Alpine runtime dependency image verifies Node/AWS CLI/flock. Offline Linux shell smoke test verifies missing optional roots, concurrent lock exclusion and lock release. No production sync was executed.
- Read-only S3 lifecycle inspection: current rules have no Expiration or NoncurrentVersionExpiration. Storage tier transitions were not modified.
- Existing v3 release declares 993,557,709 bytes of payload (~0.99 GB decimal). Each new rolling-window release retains its own revision; historical size grows with successful releases. This is a measured old-release size, not a future storage forecast.

## Release order and acceptance

1. Review/merge/deploy frontend safe mirror first (storage contract remains backward-compatible); confirm runtime dependency and failed-candidate behavior. Do not roll back to broad prefix syncing after permanent history begins growing.
2. Review/merge/deploy collector safe publication and monitoring. Keep its daily 08:30 Asia/Taipei schedule; no manual publisher run or credential changes are required by this patch.
3. After the next scheduled completion, read `public.get_gfw_hourly_publish_health()` and the exact `live.gfw_hourly_publish_runs` receipt. Require succeeded current release, successful timestamp and UTC source-date progression.
4. Compare S3 root to production HTTP root. Verify seven consecutive UTC days, 168 hourly indexes, sampled/full asset bytes/SHA and PMTiles Range 206. Verify UI shows that same date and an appropriate freshness state.
5. Validate the following day's automatic release, retained historical S3 release and frontend refresh. A running deployment alone is not acceptance.

No deployment, schedule mutation, external data write or manual publisher run was performed for this repair's local validation. The last observed production release was still 2026-08-21. Exact release commit/deployment identifiers must be added after authorization and actual readback.


## Authorized release evidence

User authorized push, ordinary merge and deployment after local validation.

- Frontend PR #300: https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/300 ; merge `8707834b26c2263a367277c8e46a1e8b78f66524`. GitHub CI passed build and the complete test workflow.
- A parallel water-layer PR subsequently merged. Active frontend deployment `6aace0570f50de6ff52c3469`, commit `5fdde19d0af1e73492f9acdb6b52c867ac4a3a96`, reached RUNNING at 2026-09-18T07:01:08Z. Git ancestry and unchanged GFW helper verified.
- Production helper SHA-256 `12e6fc95f9f2a8d1f7e6948fc8761301fae2adc423d681ac37af15913647d362` matches the tested source. Node v24.18.1 and flock present; effective refresh interval 3600 seconds.
- Read-only validation inside the production frontend container passed all 3,311 current v3 assets' exact bytes and SHA-256 plus manifest time-index validation. Current release remains 2026-08-21. Public HTTP root returned 200; sampled grid PMTiles full bytes/SHA passed and Range returned 206.
- Collector PR #91: https://github.com/ianlkl11234s/gis-data-collectors/pull/91 ; merge `0d3d6d5786d3f9ffafccfbd1ace0f3a49eef334e`. Full GitHub CI: 478 passed, 2 skipped. The initial inventory test failure was repaired by registering the dedicated success-health RPC coverage in the existing exemptions; monitoring remains independently tested.
- Collector deployment `6aace2410f50de6ff52c351a` was triggered from that exact merge after frontend verification; final runtime acceptance is recorded below.

These deployments do not establish a new data release. No publisher rerun, schedule/credential change or direct S3 root write was performed. The next normal run is 2026-09-19 08:30 Asia/Taipei; the following day is the second automatic-continuity acceptance gate.


### Collector runtime acceptance

Deployment `6aace2410f50de6ff52c351a` reached RUNNING from merge `0d3d6d5786d3f9ffafccfbd1ace0f3a49eef334e` (finishedAt 2026-09-18T07:08:17Z). Read-only runtime checks matched local SHA-256 for release publisher, task, monitoring reader and freshness policy. boto3 1.43.97 supports both IfMatch and IfNoneMatch; tippecanoe and pmtiles resolve under /usr/local/bin. Publisher remains enabled with publish_time 08:30.

The deployed health reader queried the production RPC successfully: current release 2026-08-21, window 2026-08-15..21, source_age_days 28, state SOURCE_STALE, level critical. This is correct detection of the still-old data, not a failed deployment. HTTP /health returned healthy, DB connected and main loop alive at 2026-09-18 15:10 Asia/Taipei.

Release implementation and container validation are complete. New-date publication and next-day continuity remain scheduled acceptance gates; neither is claimed here. This post-deployment receipt is preserved in the local permanent worktree.
