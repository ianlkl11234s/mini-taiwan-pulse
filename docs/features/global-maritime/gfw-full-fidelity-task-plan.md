# GFW Full-Fidelity Maritime Layers Task Plan

**Status**: frontend/collector contract、focused tests 與 production build 已完成；migration 376 與 audit migration 377 已套用 production。v3 shadow S3/Supabase audit 已完成（3,311/3,311 HEAD）；尚未 push、deploy 或 browser 驗收，canonical v2 尚未切換。
**Created**: 2026-08-26
**Scope**: `data-collectors` → S3/Cloudflare → `gis-platform` ledger → `mini-taiwan-pulse`
**Frontend baseline**: production hourly GFW layers introduced by PR #173, plus the production timestamp-parser hotfix
**Plan owner**: main agent; delegated execution uses bounded Terra/Luna task packets

This file is the execution SSOT for replacing the capped GFW hourly-track POC with
full-fidelity production assets and for upgrading the hourly grid from center points
to time-aware grid polygons.

## Current release status (2026-08-26)

| Boundary | Status | Evidence / limitation |
|---|---|---|
| collector + v3 asset generation | complete | Seven complete UTC days were generated; immutable v3 shadow assets exist. |
| frontend contract | complete | Strict v3 parser, PMTiles/frame/detail loaders, H/H+1 grid cross-fade, truthful short trail, popup detail and rollback flag are implemented and focused-tested. |
| platform migration | complete | migration **376** and audit migration **377** are applied to production. |
| production S3/Supabase audit | complete | Shadow root is schema 3/full_fidelity release 2026-08-21 with matching bytes/hash; Supabase run e00 succeeded/is_current schema 3 shadow with 3,311 assets/counters reconciled; full S3 HEAD audit is 3,311/3,311 with zero missing, errors, bytes/SHA mismatches and no timeout. |
| push / deploy / browser | not done | Push, deployment and browser acceptance remain outstanding; no deployed shadow-runtime claim. |
| canonical release | unchanged | Canonical v2 remains the live rollback path; do not enable shadow or replace v2 until all gates below pass. |

Generated release metrics (bbox contract, 2026-08-15..21 UTC):

| metric | value |
|---|---:|
| canonical points | 1,426,359 |
| canonical features | 226,830 |
| vessels | 64,051 |
| valid segments | 168,936 |
| singleton nodes | 57,894 |
| grid cells | 1,105,448 |
| unmatched SAR detections | 0 |
| generated asset volume | about 995 MB |

These are release-accounting metrics, not a claim of every physical vessel at sea.
GFW positions remain hourly HIGH grid-center observations; inferred polygons and
linearly interpolated positions are visualization constructs, not original AIS tracks
or official GFW cell boundaries.

## 1. Product outcome

The production result must provide three semantically separate views:

1. **GFW hourly vessel grid**
   - inferred 0.01-degree footprint polygons around documented HIGH-resolution
     grid-cell centers, labeled as a visualization footprint rather than official
     GFW cell boundaries;
   - all canonical vessels in each observed UTC hour;
   - hour H fades out while hour H+1 fades in;
   - no claim that the grid or vessels moved continuously between observations.
2. **GFW vessel approximate tracks**
   - every eligible track segment is published; no display sampling/cap;
   - line color follows vessel type;
   - only adjacent points in the same valid segment are linearly interpolated;
   - gaps, implausible-speed splits, and singletons never become fabricated lines.
3. **GFW current-frame vessel nodes**
   - all canonical vessel-hour positions remain visible, including singletons;
   - vessels at the same display position form a count-scaled node;
   - clicking a node or grid cell can retrieve every member vessel.

`gfwDarkVessels` remains an independent SAR-unmatched layer. AISStream remains an
independent, recent AIS source. Neither is merged into the GFW AIS-derived layers.

## 2. Definition of "all data"

"All data" means all observations successfully fetched and accepted by the release
contract for its bbox, dataset version, and UTC window. It does not mean all vessels
physically present at sea and does not override GFW coverage or latency limitations.

The release must reconcile these stages independently:

```text
fetched report rows
  └─ invalid / exact duplicate accounting
     └─ normalized observations
        └─ same-vessel-hour conflict accounting
           └─ canonical vessel-hour positions
              ├─ eligible segment points → every eligible segment is published
              └─ singleton points       → every singleton is published as a node
```

Required release invariants:

- every expected spatial request tile completes with one consistent dataset version;
- any non-zero `nextOffset`, missing tile, schema drift, or incomplete asset fails closed;
- `sum(grid_cell.vessel_count) == canonical_vessel_hour_count` for every hour;
- `published_segment_count == eligible_segment_count`;
- `published_segment_points == eligible_segment_points`;
- `omitted_by_display_cap == 0` and `cap_applied == false`;
- each canonical point belongs to exactly one eligible segment or singleton bucket;
- every popup sidecar member count equals the corresponding cell/node count;
- every immutable asset has matching manifest path, bytes, SHA-256, and S3 HEAD evidence.

Raw GFW API response bodies remain out of the durable archive unless a separate license
and retention decision explicitly permits them. Fetch ledgers preserve counts, request
signatures, dataset versions, statuses, and failure reasons instead.

## 3. Historical capped baseline (superseded by generated v3 shadow release)

The current 2026-08-20 release demonstrates why this is not a cosmetic frontend change:

| Metric | Current value |
|---|---:|
| normalized rows | historical local POC; not the v3 release metric |
| candidate vessels | 57,220 |
| candidate segments | 170,246 |
| candidate track points | 1,393,757 |
| selected source segments/vessels | 982 / 982 |
| published point cap | 150,000 (reached) |
| candidate segment selection rate | about 0.58% |
| grid vessel presences | 1,451,353 |
| grid hourly assets | 168 |
| grid assets, seven days | about 587.7 MiB |

This historical section explains the old cap. It is not production evidence for v3 and
must not override the current release status above.

## 4. Locked design decisions

### D1. Grid animation is cross-fade, not spatial interpolation

Let `f` be progress from hour H to H+1, from 0 to 1:

- H opacity = `userOpacity * (1 - f)`;
- H+1 opacity = `userOpacity * f`.

No cell polygon, vessel count, or membership list is numerically interpolated. The UI
must call this a cross-fade between two observed hourly snapshots.

If the next frame is unavailable or invalid, H stays at full opacity; the UI must not
fade toward an empty map. During a cross-fade, the popup opens the dominant hour by
default and offers both H and H+1 snapshot sections when both exist. Each section is
labeled with its exact UTC observation hour.

### D2. Inferred grid footprint is produced upstream and labeled honestly

The frontend must not infer a cell polygon from neighboring point distances. GFW
documents that HIGH resolution is one hundredth of a degree and that report latitude /
longitude values are grid-cell centers, but does not document the exact global grid
origin or boundary rule. The collector therefore emits a square visualization footprint
of `center +/- 0.005 degrees` and records
`geometry_semantics=inferred_0_01_degree_footprint`. It must never be labeled as an
official GFW cell boundary. The original center remains the stable identity property.

At low zoom, coarser overview cells may be generated, but their aggregation level must
be explicit. Overview cell counts cannot be described as raw GFW HIGH-cell counts.

### D3. Canonical data and browser assets are different products

The canonical full-fidelity partitions are the audit source. Browser delivery uses:

- PMTiles/MVT for viewport/zoom-bounded grid polygons and complete track lines;
- lightweight adjacent-hour motion frames for smooth endpoints and the partial current
  segment;
- lazy detail sidecars keyed by release/hour/cell-or-group for complete popup members.

The browser must not download the full seven-day canonical dataset or a monolithic full
day track GeoJSON.

### D4. Track smoothing stays semantically bounded

Only linear interpolation between adjacent GFW grid-center observations in the same
valid segment is allowed. Catmull-Rom or other curvature that implies an unknown route
is prohibited. The default visual tail remains short (target: 30 minutes) and is clipped
at segment/gap boundaries.

### D5. Node grouping is data-space grouping

Dynamic nodes group vessels with the same proven runtime display position/group key.
Mapbox screen-distance clustering is not used because it changes with zoom and is not
equivalent to a GFW grid cell or shared position.

- radius uses a square-root count scale;
- one vessel keeps its vessel-type color;
- mixed vessel types use an explicit mixed/neutral treatment;
- the count label and node are clicked before line and grid polygon;
- popup detail is lazy-loaded and never silently capped.

### D6. v2 remains the rollback path during migration

v3 assets publish to a shadow prefix and are enabled behind an independent frontend
runtime flag. v2 assets and loaders remain available until the production S3/Supabase
audit, deployment, browser acceptance, two successful v3 daily releases, and one
rollback drill have passed. A failed hash/count/cache/detail-popup check means disable
the shadow flag and retain canonical v2; do not patch an immutable release in place.

## 5. Dependency DAG

```text
T0 contract + source-evidence gate (Main)
│
├─ T1 full-fidelity one-day POC and count reconciliation (Terra)
│  ├─ T2 API completeness/resume hardening (Terra)
│  └─ T3 PMTiles/sidecar benchmark and schema choice (Main review)
│
├─ T4 v3 ledger/health migration, only if schema changes (Terra)
│
├─ T5 v3 collector assets + S3 shadow publisher (Terra)
│  └─ T6 manifest/cache/retention/rollback tests (Luna)
│
├─ T7 frontend v3 strict loaders + feature flag (Terra)
│  ├─ T8 grid polygon cross-fade + popup detail (Terra)
│  └─ T9 full tracks + aggregated nodes + popup detail (Terra)
│
├─ T10 unit/contract/browser case execution (Luna)
└─ T11 shadow acceptance, production cutover, rollback drill (Main)
```

Tasks in separate repos may run in parallel only after their shared input contract is
frozen. Only one write agent owns a repo/file family at a time.

## 6. Executable work packages

### T0 — Freeze v3 semantics and source evidence

**Owner**: Main
**Repos**: source-contract docs first; no production mutation

Deliverables:

- versioned definition of canonical vessel-hour position and conflict accounting;
- evidence for GFW HIGH cell polygon size/origin/boundaries;
- v3 manifest fixture covering grid, tracks, motion frames, popup sidecars, and SAR;
- explicit `full_fidelity=true`, count fields, coordinate semantics, and UTC contracts;
- decision on PMTiles source layers, minimum retained properties, stable IDs, and zooms.

Gate: no implementation task may invent missing geometry or silently reinterpret
singletons/conflicts.

### T1 — Produce an uncapped, full-fidelity POC

**Owner**: Terra worker, `data-collectors` only
**Primary files**:

- `scripts/gfw_hourly_tracks_poc.py`
- `scripts/gfw_hourly_grid_poc.py`
- `scripts/gfw_hourly_release.py`
- related focused tests

Deliverables:

- all eligible segments without longest-first selection;
- separate singleton/node partitions;
- polygon grid fixture after T0 geometry approval;
- one full day first, then the current seven-day bbox fixture;
- measured rows, vessels, segments, points, bytes, processing time, and peak memory.

Acceptance:

- candidate and published track counts/points are equal;
- singleton count is additive and every singleton can be resolved;
- no change to gap/speed/same-hour semantic rules without Main review;
- if resources are exceeded, the run fails rather than re-enabling sampling.

### T2 — Harden API completeness and resumability

**Owner**: Terra worker, `data-collectors` fetch path only
**Primary files**:

- `scripts/gfw_hourly_tracks_poc.py`
- `tasks/gfw_hourly_publish.py`
- `collectors/gfw_vessel_presence.py`
- related focused tests

Deliverables:

- expected-tile/request-signature ledger;
- dataset-version consistency gate;
- per-tile counts, invalid counts, status, and pagination evidence;
- resumable failed spool without re-fetching verified tiles;
- failure fixtures for pagination, missing tile, schema drift, and version mismatch.

Acceptance: any incomplete fetch leaves the public root unchanged.

### T3 — Select and freeze delivery partitions

**Owner**: Main decision; Terra prepares benchmark; Luna validates measurements

Compare on the exact same seven-day input:

- daily versus hourly grid PMTiles;
- full track PMTiles source-layer design;
- adjacent-hour motion-frame partitioning;
- detail sidecar key/index and compression.

The chosen design must demonstrate viewport-only transfer, stable feature identity,
complete property/count reconciliation, and no need to download a full day GeoJSON.
If a tile exceeds safe limits, subdivide it or fail; never omit features.

### T4 — Extend the platform ledger if required

**Owner**: Terra worker, `gis-platform` only
**Dependency**: frozen v3 manifest and counts
