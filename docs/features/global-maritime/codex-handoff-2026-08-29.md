# GFW East Asia v4 — Codex implementation handoff

**Date:** 2026-08-29  
**Audience:** Claude Code / next implementation reviewer  
**Status:** local committed implementation; not pushed, uploaded, deployed, or enabled for automatic updates

> **Post-review resolution (Claude, 2026-08-29):** both P0s in §10 are resolved — see the
> "Resolution note" at the top of [`handoff.md`](./handoff.md) for the fix commits, browser
> verification, and the rebuilt/promoted/installed local release. Three factual corrections to
> this document, preserved as-is below for the historical record:
>
> 1. §6/§10 "v6": the Tier 2 evidence target `5df1ec6b…` (510,986 B) is **not an older v6
>    release** — it is byte-identical to the v8 build's own pre-promotion candidate. The promoter
>    validated the evidence binding, then mutated the same manifest (bind-then-mutate), so the
>    bound target ceased to exist. Binding is now to a promotion-invariant core digest.
> 2. §11 migration path: the platform worktree has no `supabase/` directory; the actual file is
>    `migrations/379_gfw_hourly_manifest_v4_release_ledger.sql`.
> 3. §6 "zero warm transfer": the bench's second decode pass was removed with the persistent
>    worker; cache reuse is now proven by a second same-profile run showing `wire.requestCount 0`
>    and zero duplicate fetches/evictions.

## 1. Read this first

The feature SSOT remains [`handoff.md`](./handoff.md). The frozen cross-repo contract is at
`/private/tmp/taipei-gis-analytics-gfw-v4-contract-20260828/docs/handoff/global-maritime-v4.md`.
This document is a review-oriented account of what Codex changed, why, what was verified, and
what is still unsafe to claim.

Do **not** review the shared Mini Taiwan Pulse worktree as if it contained this implementation.
The frontend work is in this isolated worktree and branch:

```text
/private/tmp/mini-taiwan-pulse-gfw-v4-bench-20260827
codex/gfw-v4-browser-bench
4df21b8 feat(gfw): wire formal East Asia v4 layers
```

All four worktrees listed below were clean immediately after their local commits. None has an
upstream branch. Do not reset, clean, sync, or merge unrelated work from other sessions.

## 2. Executive summary

Codex implemented the agreed East Asia 24-hour GFW v4 path around the fixed bbox:

```text
115.93462,20.36314,134.73486,36.52495
```

The implementation:

- compared GFW LOW 0.1° with HIGH 0.01° locally aggregated to a globally aligned 0.1° grid;
- selected HIGH because both routes contained the same 799,771 canonical vessel-hours, but LOW
  assigned 565,964 identities to different canonical 0.1° cells;
- produced hourly Grid PMTiles with complete member detail;
- rejected whole-region JSON/binary Tracks day packs after full-load browser benchmarks failed,
  then implemented Phase 2 fixed-z6 spatial PMTiles with viewport/time culling;
- kept Grid, Tracks, Fishing Effort, and existing SAR-unmatched vessels as four independent layers;
- installed a local schema-4 root that the frontend reads without a shadow query flag;
- implemented fail-closed collector, publisher, release-ledger, and scheduler boundaries;
- did not upload, deploy, apply migration 379, or activate a daily collector.

This is therefore a **locally committed release candidate**, not production acceptance.

## 3. Worktree and commit ledger

| repo | isolated worktree / branch | session commits | purpose | remote truth |
|---|---|---|---|---|
| Mini Taiwan Pulse | `/private/tmp/mini-taiwan-pulse-gfw-v4-bench-20260827` / `codex/gfw-v4-browser-bench` | `759c5eb`, `7b169d7`, `4df21b8` | shadow POC, density scale, formal v4 layers | local only; no upstream |
| data-collectors | `/private/tmp/data-collectors-gfw-v4-poc-20260827` / `codex/gfw-east-asia-v4-poc` | `60c73be`, `861de2a` | preserve POC drivers; fail-closed v4 daily publisher | local only; no upstream |
| taipei-gis-analytics | `/private/tmp/taipei-gis-analytics-gfw-v4-contract-20260828` / `codex/gfw-east-asia-v4-contract` | `96632ac`, `53c82ce` | schema-4 contract, ADR, cross-repo handoff | local only; no upstream |
| gis-platform | `/private/tmp/gis-platform-gfw-v4-release-ledger-20260828` / `codex/gfw-v4-release-ledger` | `219e111` | migration 379, validation, ledger, health RPC | local only; no upstream |

The analytics branch contains older, unrelated commits before the GFW work. Review or transplant
the explicit GFW commits; do not merge the whole branch blindly.

## 4. Data and architecture decisions

```text
GFW 4Wings API
  ├─ HOURLY HIGH presence (0.01°)
  │    └─ local floor aggregation to global 0.1°
  │         ├─ Grid hourly PMTiles + complete detail shards
  │         └─ Tracks fixed-z6 spatial PMTiles + detail shards
  └─ independent DAILY LOW fishing effort
       └─ Fishing Effort daily artifact

immutable schema-4 release
  └─ root manifest
       └─ frontend loaders/hooks
            ├─ gfwHourlyGrid
            ├─ gfwHourlyTracks
            ├─ gfwFishingEffort
            └─ gfwDarkVessels (existing, unchanged)
```

The LOW/HIGH comparison found:

| metric | LOW | HIGH → local 0.1° |
|---|---:|---:|
| canonical vessel-hours | 799,771 | 799,771 |
| response bytes | 372,435,396 | 375,200,404 |
| wall time | 90.35 s | 409.13 s |
| peak RSS | 1,292,402,688 B | 1,475,969,024 B |

Identity and complete popup member fields matched, but cell placement did not. HIGH was retained
because it preserves the accepted canonical grid assignment; the larger wall time and RSS are
explicit costs, not hidden from the decision.

## 5. Layer behavior

### Grid — `gfwHourlyGrid`

- Globally aligned 0.1° polygons, one PMTiles archive per UTC hour.
- Six count bands: `1`, `2–3`, `4–7`, `8–15`, `16–49`, `50+`.
- Colour and continuous opacity both encode vessel density.
- H/H+1 interpolation is linear. H remains fully visible until H+1 is ready; then their alpha
  crossfades. H+2 is prefetched.
- PMTiles tile reads are deduplicated and held in a per-archive 192-tile LRU.
- Popup hydration uses detail sidecars and fails closed if count/member identity is incomplete.
- No-data cells are absent; they are not presented as zero or quiet.

Primary files:

- `src/hooks/useGfwHourlyGridLayer.ts`
- `src/map/gfwPmtilesSourceType.ts`
- `src/layers/hosts/globalMaritimeHosts.tsx`

### Tracks — `gfwHourlyTracks`

- Independent from Grid; formal artifacts are `track_frame_pmtiles`, fixed z6.
- Spatial frames are split by vessel bucket and selected hour/day.
- Web Worker decoding, viewport shard selection, typed buffers, viewport culling, and fixed budgets
  replace the failed full-region day-pack render path.
- Fractional ticks within the same selected hour reuse decoded data and interpolate locally;
  future geometry is not exposed.
- Same-coordinate groups preserve complete member lists and singleton tracks.
- Formal popup sidecars are namespaced as `<vessel-bucket>:<track-hash-prefix>`.
- The formal layer owns its detail context so legacy v2/v3 hook cleanup cannot erase it.
- Shared WebGL state is restored after rendering.

Formal taxonomy:

```text
FISHING, CARGO, PASSENGER, CARRIER, OTHER, UNKNOWN
```

Default enabled buckets are `FISHING`, `CARGO`, and `PASSENGER`. `CARRIER` is independent and
off by default. `TANKER` is quarantined from the formal taxonomy. `GEAR`/`FAD` are non-vessel
observations and cannot enter Grid vessel counts or Tracks.

Primary file: `src/hooks/useGfwV4TracksLayer.ts`.

### Fishing Effort — `gfwFishingEffort`

- Independent daily sample, not a presence identity or a reconstructed vessel track.
- Represents model-derived **apparent fishing hours**.
- Uses a continuous sequential `log1p` scale so lower-density variation remains visible.
- Popup and legend expose dataset version, temporal resolution, unit, methodology, quality, and
  caveat fields.

Primary file: `src/hooks/useGfwFishingEffortLayer.ts`.

### SAR unmatched — `gfwDarkVessels`

This pre-existing fourth layer was not rebuilt or republished. SAR-unmatched-AIS is not proof of
illegal activity and must not be renamed or semantically merged into the other three layers.

## 6. Day-pack decision and browser performance work

The corrected 100% workload benchmark showed that whole-region day packs were not acceptable:

| format | points | transfer | decode | RAF p95 | frame-work p95 | head overflow |
|---|---:|---:|---:|---:|---:|---:|
| JSON | 799,771 | 10,900,081 B | 1,464.5 ms | 80.5 ms | 72.6 ms | 4,022 |
| typed binary | 799,771 | 7,895,543 B | 515.9 ms | 74.4 ms | 66.9 ms | 4,019 |

An earlier default-only benchmark covered only 18.7% of points and 11.0% of segments; it is not
release evidence. The benchmark was changed to report explicit coverage, whole-scrub frame work,
DEFAULT/ALL presets, and null heap evidence when precise-memory attestation is unavailable.

Phase 2 fixed-z6 spatial shards later passed a local Tier 2 run for default/all desktop/mobile
viewport profiles, including HTTP Range 206 and zero warm transfer. However, that evidence is
bound to release manifest SHA `5df1ec6b…`, 510,986 B (v6), while the installed final candidate is
SHA `f4f8b650…`, 513,811 B (v8). Do not transfer the Tier 2 result to v8 without rerunning and
binding evidence to the exact final manifest.

## 7. Manifest, HTTP, and publisher contract

- Schema version: `4`.
- Canonical local root: `/global-maritime/gfw-hourly/v4/manifest.json`.
- Immutable release prefix: `.../v4/releases/<release_id>/`.
- Formal required artifacts:
  `tracks_day_pmtiles`, `track_frame_pmtiles`, `track_detail_bucket`,
  `grid_hour_pmtiles`, `grid_detail_bucket`, `fishing_effort_day`.
- Legacy `track_frame_hour` is rejected by formal schema 4.
- Each asset declares bytes, SHA-256, strong ETag, content headers, cache policy, and semantic
  counts. Local readback verifies bytes/hash/declared semantics.
- Publisher uploads immutable assets first, release manifest second, and atomically switches the
  root last. Failed root verification restores the previous root when possible.
- Retention deletes only keys explicitly declared retired by manifests; no prefix-wide deletion.
- Supabase stores compact run/release/audit metadata only, not bulk Grid/Tracks/Fishing assets.

Installed local candidate v8 readback:

```text
root:     352 B, SHA 4a73282006a90bbe42ccf28907937ebdf7de1270386490ea994367fbb9973c68
release:  513,811 B, SHA f4f8b650be86fdeaea4d9e355a1d23330496b6b508f26d9c58fe54c16c3cfe19
assets:   542 declared artifacts
```

`production_cutover: true` in this file means only that the **local** root points at v8. It is not
evidence of an external upload, deployment, or live production cutover.

## 8. Claude review findings that were addressed

| finding | resulting change |
|---|---|
| benchmark covered only 18.7% | explicit point/segment coverage; DEFAULT and ALL runs; full scrub timing |
| heap reading was not auditable | precise-memory attestation recorded; otherwise heap is null with warning |
| taxonomy merged/assigned wrong entities | frozen six buckets; independent CARRIER; GEAR/FAD excluded; OTHER/UNKNOWN separate |
| POC drivers existed only under `/private/tmp` | preserved in collector commit `60c73be` |
| generated evidence was vulnerable to gitignore gaps | targeted ignore rules added |
| formal Tracks popup detail lookup failed | strict bucket/hash path, canonical labels, full grouped members |
| legacy cleanup raced formal popup context | explicit `legacy` versus `formal-v4` ownership |
| Fishing used weak linear styling/governance | log1p scale and governance metadata |
| custom renderer leaked GL state | blend state restored and resources disposed |

## 9. Verification truth

| boundary | current result |
|---|---|
| build | passed locally: Mini `83` files / `819` passed / `1` skipped; TypeScript and production build passed |
| contract / wire | passed locally for schema 4 and four-layer wiring |
| stage | v8 installed under the local canonical root |
| upload | **not run** |
| readback | passed locally for root, release manifest, hashes, bytes, and 542 artifacts |
| pull | local installer readback passed; external/container pull **not run** |
| deploy | **not run** |
| HTTP | localhost 6002 root/release 200 and PMTiles Range 206 passed |
| browser functional | static toggle, opacity, legends, popups, style reload, layer independence, desktop and 390×844 viewport checks passed |
| browser animation | **not accepted**: user reported whole Grid flicker at 300× playback on localhost 6002 |
| Tier 2 final candidate | **blocked**: existing evidence is byte-bound to v6, not installed v8 |
| collector auto-update | **not active** |

Collector tests were also run after commit: full suite `335 passed, 2 skipped`; one later focused
v4 selection reported `52 passed`. The earlier release/daily/monitoring/driver selection reported
`58 passed`; these were different test selections, not additive totals. Claude should recover the
exact command scope before citing either number. Platform SQL contract tests/verifier exist, but
migration 379 and those scripts have not been run against production Supabase.

## 10. Open issues and contradiction gate

### P0 — reproduce and remove the 300× Grid flicker

The anti-flicker design exists, but the user observed flicker after the earlier browser acceptance.
Treat the report as a failed animation-stability gate. The next reviewer should record a clean,
long-running 300× playback across hour boundaries and inspect:

- source/layer add/remove events and style reloads;
- H/H+1/H+2 readiness and opacity values;
- PMTiles Range requests, aborted requests, and unexpected 200/full-archive transfers;
- URL/timeline state updates and React effect cleanup;
- pan/zoom and layer toggle during playback;
- console and frame recording.

Distinguish intended H/H+1 crossfade from the entire Grid disappearing for a frame. Add a
regression test that proves the current hour remains visible until the next hour is ready.

### P0 — bind Tier 2 evidence to the exact release candidate

Rebuild the final candidate, freeze its manifest, rerun all Tier 2 profiles against that exact
manifest, and persist matching manifest bytes/SHA in the evidence. Any later manifest mutation
invalidates the evidence and requires another run.

### External release gates remain closed

- Migration 379 is committed but not applied.
- Scheduler defaults remain disabled and fail closed.
- GFW redistribution approval, token, single-writer, accepted Tier 2 evidence, Supabase URL, S3
  bucket/prefix, public HTTPS URL, and toolchain checks are not authorized/complete.
- No S3/R2/Cloudflare upload, external readback, container pull, Zeabur deploy, or production HTTP
  verification occurred.
- The 390×844 run is a desktop viewport emulation, not real-device mobile evidence.
- Local port 6002 is an ephemeral development process, not deployment evidence.

## 11. Suggested next review order

1. Start from this frontend worktree and `4df21b8`; verify only the two handoff-doc edits are dirty.
2. Read the cross-repo contract at analytics `53c82ce`.
3. Review `useGfwHourlyGridLayer.ts` for the 300× flicker and source lifecycle.
4. Review `useGfwV4TracksLayer.ts` and `gfwPmtilesSourceType.ts` for Range/cache/budget semantics.
5. Reproduce Grid playback on localhost 6002 with a clean reload and capture evidence.
6. Fix and add a regression test if the whole-layer blink is reproducible.
7. Generate a new immutable release candidate and rerun Tier 2 against its exact manifest.
8. Only after those local gates pass, separately decide whether to push/apply/upload/deploy.

Before using port 6002, verify that its process cwd and HEAD are this worktree and `4df21b8`.
If it is not running, the local command is:

```bash
npm run dev -- --host 127.0.0.1 --port 6002
```

For upstream release mechanics, review these absolute paths:

- `/private/tmp/data-collectors-gfw-v4-poc-20260827/tasks/gfw_v4_daily_publish.py`
- `/private/tmp/data-collectors-gfw-v4-poc-20260827/tasks/gfw_v4_manifest_publisher.py`
- `/private/tmp/data-collectors-gfw-v4-poc-20260827/scripts/gfw_v4_production_release.py`
- `/private/tmp/gis-platform-gfw-v4-release-ledger-20260828/supabase/migrations/379_gfw_hourly_release_ledger_v4.sql`
- `/private/tmp/gis-platform-gfw-v4-release-ledger-20260828/scripts/test_gfw_hourly_manifest_v4_contract.sql`
- `/private/tmp/gis-platform-gfw-v4-release-ledger-20260828/scripts/verify_gfw_hourly_manifest_v4_contract.sql`

## 12. Safety constraints

- Do not reset/clean shared or isolated worktrees.
- Do not alter or delete existing v2/v3, S3, Supabase, or Cloudflare assets.
- Do not infer external production readiness from local `production_cutover: true`.
- Do not enable the scheduler or write external state without separate authorization.
- Do not call SAR-unmatched vessels illegal or confirmed dark activity.
- Do not convert absent cells or missing identities into zero-valued geometry.
