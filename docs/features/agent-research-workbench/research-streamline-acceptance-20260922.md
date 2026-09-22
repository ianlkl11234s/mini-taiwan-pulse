# Research transport optimization — 2026-09-22

## Scope and isolation

Implemented locally in three persistent worktrees, branch `codex/research-streamline-20260922`, without commit, push, merge or deployment. Worktree root: `mini-taiwan-pulse/.worktrees/research-streamline/`; checkouts are `mini`, `mcp`, `gateway`. Original dirty workspaces were preserved.

Local preview: http://127.0.0.1:3734 ; isolated Gateway: http://127.0.0.1:8794 . Existing 3732/8791 services were not restarted. Runtime receipts/logs live in sibling `runtime/`, outside the tracked source. Pairing credentials are process-local and must not be copied into documentation. Browser reload loses session-local results; pair again to reproduce. Preview uses original public assets read-only and existing local auth configuration.

## Implemented

- MCP now has **49 tools**, adding `pulse_run_analysis_plan`: 1–16 typed read/analysis steps, entire-plan schema validation before dispatch, bounded result-ID references, 32 KiB input, 192 KiB output, sampled rows, and explicit partial continuation. It retains the serial browser query gate. It does not bypass consent, authorize new sources, run arbitrary code, or make external-provider calls. The 20-second budget is checked between steps; one in-flight query can use its existing 25-second wait. This is not an absolute 20-second cancellation deadline.
- MCP query-status immediately uses bounded Gateway long-poll instead of unconditional 1.5-second initial sleeps. Pending receipts retain requestId/retry guidance. Gateway rechecks authorization after waits; browser owner is reverified after long-poll. Scene wait is 20 seconds and still distinguishes accepted/applied/ready.
- `pulse_set_result_collection` accepts framing in the same revision. Camera-only changes do not reinstall unchanged result GeoJSON. Layout wait is bounded; actual map render/readback is still required.
- Discovery/capabilities use registered datasets rather than hardcoded unavailable fields. Required statistics release choices are exposed. A unique `filters.release_id eq` can normalize into `parameters.releaseId`; conflicting/missing selectors fail early, before materialization. Locked layers stay filtered. All three dataRole schemas include admin_statistic.
- `contains_center` resolves an explicit map/user coordinate against actual, eligible administrative geometry. Boundary points are excluded; overlapping matches remain multiple matches. Display-radius geometry stays ineligible for authoritative spatial joins.
- Active collection items, including hidden groups, are pinned within the existing 16-result store. Pins do not extend TTL, grant access or create persistent storage. Only unpinned results are evicted.
- Browser validates the serialized JSON wire representation against Gateway limits. Oversize row geometry becomes explicitly marked transport metadata; complete geometry remains in the session store. Scope replies preserve compatible `area.resultId` / `centerResult.resultId` with compact metadata. Irreducible oversized results return recoverable references rather than repeated INVALID_INPUT delivery failures.
- Statistics metadata fetches have 12-second deadlines and shared boundary fetches 40-second deadlines. Caller cancellation stops waiting without cancelling another caller's shared download. SHA, boundary version and missing/suppressed/zero semantics are preserved.
- Valhalla upstream timeout is 6.5 seconds, below the browser 8-second request budget, and follows request cancellation. Google/Valhalla per-call consent remains mandatory.
- Skill now prefers known bounded workflows, reuses descriptors, avoids mandatory Jev routing, uses explicit releases and combines collection/framing before one readiness/readback cycle.

## Verification

| Surface | Final evidence |
|---|---|
| Mini research + statistics loader/routing | 39 files; 218 passed, 5 existing opt-in skips |
| Mini TypeScript | `npx tsc -b` passed |
| MCP | Full suite 59 passed; build passed; fresh built stdio reports 49 tools |
| Gateway | Full Node suite 57 passed |
| Skill | `quick_validate.py` passed |
| Workspace | Three diffs pass `git diff --check`; original Mini dirty-file list unchanged |

MCP WebSocket tests initially hit sandbox EPERM; rerunning with loopback permission passed. Real-browser integration found and fixed scope geometry transport and undefined-property wire-validation issues not caught by the initial mocks. HMR runs were excluded from final timing.

## Paired-browser workflow and timing

Fixed test coordinate `[121.5318,25.0464]`, radius 2,000 metres. Four datasets: schools, public libraries, township housing (2020 census release), county elementary student/teacher ratio (academic year 114). Bbox limits the two point queries. Statistical source reads preserve all administrative rows; contains_center subsequently selects 中山區 and 臺北市.

Fourteen-step plan: four source reads, two radius filters, two grouped counts, two quality reads, two administrative containment queries, display scope, and bounds. Final first run after website reload: **13.879 s**, 28,138-byte plan response. Three repeated warm runs: **9.317 / 9.041 / 9.150 s**, all 14 steps complete; sampled-zero response 24,287 bytes. Sources and analysis remain browser-backed, not mocks. These timings exclude model deliberation, browser setup/pairing and manual inspection; they are not full Codex end-to-end p95 or a universal 90-second SLA.

Results: 42 school source records, 8 library source records, one township, one county, one radius and one center. This is 54 rendered features, not 54 facilities. Counts preserve source grain, missingness and periods; 2020 housing is not a current observation.

Combined collection/framing command accepted, then ready revision 1; `map_context.resultPresentation` read back six results, all sources/layers ready and 54 features. Screenshot and website collection UI independently showed points, administrative polygons and radius. Hiding statistics group produced 4 rendered results / 52 features while retaining six collection items. Sixteen additional aggregate results completed in 7.519 s; restoring the hidden group returned 6 results / 54 features / ready, demonstrating pin retention under capacity pressure.

Runtime evidence: `final-analysis.json`, `warm-analysis-last.json`, `final-browser-readback.json`, `hidden-group-readback.json`, `pin-retention-readback.json`, `stdio-receipts.jsonl`, `mini-tests.log`. Full receipts contain source evidence; do not equate successful source/analysis tests with production deployment.

## Data splitting: next implementation

Independent HTTP measurement of the declared township boundary: **45,242,401 bytes / 20.138 s** cold download through the local public-CDN proxy. The existing complete-boundary cache helps warm runs; transport compaction does not remove this cold-download cost.

1. In Analytics `pipelines/shared/regional_statistics/assemble_social_frontend.py`, publish immutable full-feature shards (initially by county groups) plus a small area-code/bbox index. Retain the parent boundary SHA/version and content-address each shard. Do not clip or simplify exact analysis geometry. Use feature bboxes rather than guessing containment from code prefixes.
2. Add optional shard-index support in `regionalStatisticsLoader.ts` / `statisticsGeometryCache.ts`. Given explicit bbox/area-code scope, fetch every intersecting shard, verify each SHA, deduplicate codes and preserve parent lineage. Cross-county/overlapping/island queries must select all relevant complete polygons. Full-source fallback stays available.
3. Keep values and geometry scope explicit. Viewport display coverage is not the statistical population; national denominators still use complete values. Verify the union of shards equals all 368 original codes and coordinates, with exact join equivalence for single-area, cross-county, islands and national modes. No generated shards, adapters or CDN publication were added in this change.

## Remaining boundaries

This improves orchestration and correctness; it does not make every manifest layer analytically readable. The audited checkout has 778 manifest entries, 768 discovery entries and 52 explicit dataset adapters; 45 are social-statistics recipes. On-demand Point candidates still require runtime validation. PMTiles/raster/RPC/custom readers without a source contract remain unsupported. Current paired capability query returned 46 admin_statistic entries (not a claim of 46 new social adapters).

Google and Valhalla tests validate mocked consent, timeout and failure contracts; no real paid geocode or external routing E2E was performed. Production, deployment and whole-agent 90-second p95 remain unverified. Next priority is exact boundary sharding, followed by repeated full-agent timing with a fixed workflow and then source-family coverage expansion.
